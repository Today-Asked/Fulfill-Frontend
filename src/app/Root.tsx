import React from "react";
import { Outlet, useLocation, Navigate } from "react-router";
import { BottomNav } from "./components/BottomNav";
import { useAuth } from "../contexts/AuthContext";

export function Root() {
  const location = useLocation();
  const { user, loading, profileChecked, needsOnboarding } = useAuth();

  const isChatRoom    = location.pathname.startsWith("/chat/");
  const isAuthPage    = ["/login", "/register", "/forgot-password"].includes(location.pathname);
  const isOnboarding  = location.pathname === "/onboarding";
  const isResetPassword = location.pathname === "/reset-password";

  // ── 等 Supabase 恢復 session ──────────────────────────────────────────
  if (loading) return <Spinner />;

  // ── /reset-password：不做任何跳轉守衛，讓頁面自己處理 token / error ──
  if (isResetPassword) return <Frame isChatRoom={false} isAuthPage={false} isOnboarding={false}><Outlet /></Frame>;

  // ── 未登入 ──────────────────────────────────────────────────────────
  if (!user && !isAuthPage) return <Navigate to="/login" replace />;

  // ── 已登入 + auth 頁面 → 首頁 ───────────────────────────────────────
  if (user && isAuthPage) return <Navigate to="/" replace />;

  // ── 已登入，等 profile 檢查 ──────────────────────────────────────────
  if (user && !profileChecked && !isOnboarding) return <Spinner />;

  // ── 需要 onboarding ──────────────────────────────────────────────────
  if (user && needsOnboarding && !isOnboarding) return <Navigate to="/onboarding" replace />;
  if (user && !needsOnboarding && isOnboarding) return <Navigate to="/" replace />;

  return (
    <Frame isChatRoom={isChatRoom} isAuthPage={isAuthPage} isOnboarding={isOnboarding}>
      <Outlet />
    </Frame>
  );
}

// ── 共用元件 ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#050508]">
      <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
    </div>
  );
}

function Frame({
  children,
  isChatRoom,
  isAuthPage,
  isOnboarding,
}: {
  children: React.ReactNode;
  isChatRoom: boolean;
  isAuthPage: boolean;
  isOnboarding: boolean;
}) {
  return (
    <div className="flex justify-center items-center min-h-screen bg-[#050508] sm:p-4 text-white font-sans selection:bg-fuchsia-500/30">
      <div className="w-full h-screen sm:h-[844px] sm:w-[390px] bg-[#0a0a0f] relative overflow-hidden sm:rounded-[40px] shadow-2xl border border-white/5 flex flex-col">
        {/* Ambient glow orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 bg-fuchsia-600/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[120px] right-[-40px] w-56 h-56 bg-cyan-500/8 rounded-full blur-[70px] pointer-events-none" />
        <div className="absolute top-[40%] right-[-80px] w-72 h-72 bg-violet-600/10 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex-1 overflow-hidden relative z-10">{children}</div>

        {!isChatRoom && !isAuthPage && !isOnboarding && <BottomNav />}
      </div>
    </div>
  );
}
