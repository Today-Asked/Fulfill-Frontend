import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  profileChecked: boolean;
  needsOnboarding: boolean;
  isPasswordRecovery: boolean;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  const checkProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("username")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;
      setNeedsOnboarding(!data?.username);
      setProfileChecked(true);
    } catch (error) {
      console.error("Unable to check profile", error);
      setNeedsOnboarding(false);
      setProfileChecked(true);
    } finally {
      setLoading(false);
    }
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
    }).catch(() => setLoading(false));

    // 監聽後續狀態變化
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setLoading(false);
      if (event === "PASSWORD_RECOVERY") {
        setIsPasswordRecovery(true);
      } else if (event === "USER_UPDATED" || event === "SIGNED_OUT") {
        setIsPasswordRecovery(false);
      }
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
    <AuthContext.Provider value={{ user, loading, profileChecked, needsOnboarding, isPasswordRecovery, refreshProfile, signOut }}>
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
