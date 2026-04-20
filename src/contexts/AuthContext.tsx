import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profileChecked: boolean;
  needsOnboarding: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileChecked, setProfileChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("id", uid)
      .single();
    setNeedsOnboarding(!data?.username);
    setProfileChecked(true);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await checkProfile(user.id);
  }, [user, checkProfile]);

  useEffect(() => {
    // 頁面載入時恢復 session
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUser(u);
      if (u) {
        checkProfile(u.id);
      } else {
        setLoading(false);
      }
    });

    // 監聽後續狀態變化
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (u) {
        checkProfile(u.id);
      } else {
        setProfileChecked(false);
        setNeedsOnboarding(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [checkProfile]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, profileChecked, needsOnboarding, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
