import React from "react";
import { Outlet, useLocation, Navigate } from "react-router";
import { BottomNav } from "./components/BottomNav";
import { TopNav } from "./components/TopNav";
import { useAuth } from "../contexts/AuthContext";

/**
 * Auth guards below are unchanged from the original. Only the Frame component
 * was rewritten: it used to lock the whole site inside a 390x844 phone shell,
 * which is why desktop visitors saw a phone mockup floating on a dark page.
 */
export function Root() {
  const location = useLocation();
  const { user, loading, profileChecked, needsOnboarding, isPasswordRecovery } = useAuth();

  const isAuthPage    = ["/login", "/register", "/forgot-password", "/welcome"].includes(location.pathname);
  const isOnboarding  = location.pathname === "/onboarding";
  const isResetPassword = location.pathname === "/reset-password";

  if (loading) return <Spinner />;

  if (isPasswordRecovery && !isResetPassword) return <Navigate to="/reset-password" replace />;

  if (isResetPassword) return <Frame isAuthPage={false} isOnboarding={false}><Outlet /></Frame>;

  if (!user && !isAuthPage) return <Navigate to="/welcome" replace />;

  if (user && isAuthPage) return <Navigate to="/" replace />;

  if (user && !profileChecked && !isOnboarding) return <Spinner />;

  if (user && needsOnboarding && !isOnboarding) return <Navigate to="/onboarding" replace />;
  if (user && !needsOnboarding && isOnboarding) return <Navigate to="/" replace />;

  return (
    <Frame isAuthPage={isAuthPage} isOnboarding={isOnboarding}>
      <Outlet />
    </Frame>
  );
}

function Spinner() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-ink">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
    </div>
  );
}

function Frame({
  children,
  isAuthPage,
  isOnboarding,
}: {
  children: React.ReactNode;
  isAuthPage: boolean;
  isOnboarding: boolean;
}) {
  const chromeless = isAuthPage || isOnboarding;

  // Account screens stay a single narrow column at every width. A login form
  // stretched across a 27 inch monitor looks broken.
  if (chromeless) {
    return (
      <div className="min-h-[100dvh] bg-black text-white font-sans selection:bg-white/25">
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-5">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-ink text-white font-sans selection:bg-white/25">
      <TopNav />

      {/* pb leaves room for the floating mobile nav; lg drops it. */}
      <main className="relative z-10 mx-auto w-full max-w-[1440px] px-4 pb-32 sm:px-6 lg:px-10 lg:pb-16">
        {children}
      </main>

      <BottomNav />
    </div>
  );
}
