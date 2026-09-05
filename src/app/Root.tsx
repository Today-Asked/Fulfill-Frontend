import React from "react";
import { Outlet, useLocation, Navigate } from "react-router";
import { BottomNav } from "./components/BottomNav";
import { Sidebar } from "./components/Sidebar";
import { TopSearchBar } from "./components/TopSearchBar";
import { useAuth } from "../contexts/AuthContext";

/**
 * Auth guards below are unchanged from the original. Only the Frame component
 * was rewritten: it used to lock the whole site inside a 390x844 phone shell,
 * which is why desktop visitors saw a phone mockup floating on a dark page.
 */
export function Root() {
  const location = useLocation();
  const { user, loading, profileChecked, needsOnboarding, isPasswordRecovery } = useAuth();

  const isAuthPage    = ["/login", "/register", "/forgot-password"].includes(location.pathname);
  const isOnboarding  = location.pathname === "/onboarding";
  const isResetPassword = location.pathname === "/reset-password";

  // Guests can browse Home, an artwork's detail page, a creator's public
  // profile, and search — the same things a logged-out visitor could always
  // window-shop. Everything else (chat, orders, create, profile, …) still
  // requires an account.
  const isGuestAccessible =
    location.pathname === "/" ||
    location.pathname.startsWith("/search") ||
    location.pathname.startsWith("/artwork/") ||
    location.pathname.startsWith("/creator/");

  if (loading) return <Spinner />;

  if (isPasswordRecovery && !isResetPassword) return <Navigate to="/reset-password" replace />;

  if (isResetPassword) return <Frame isAuthPage={false} isOnboarding={false}><Outlet /></Frame>;

  if (!user && !isAuthPage && !isGuestAccessible) return <Navigate to="/login" replace />;

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

/**
 * Per-route content width.
 *
 * Pages were each setting their own max-width (or none at all), so desktop
 * layouts jumped between screens and unconstrained pages stretched text across
 * the full monitor. Deciding it here means a new page is correct by default.
 */
function widthFor(pathname: string): string {
  // Reading columns: long prose and single-column forms.
  const narrow = ["/profile/edit", "/profile/commission", "/invite", "/notifications", "/orders"];
  // Conversation views read best in a fixed column.
  const chat = ["/chat"];

  if (chat.some((path) => pathname.startsWith(path))) return "max-w-[820px]";
  if (narrow.some((path) => pathname.startsWith(path))) return "max-w-[760px]";
  if (pathname.startsWith("/artwork/")) return "max-w-[1100px]";
  if (pathname.startsWith("/creator/") || pathname === "/profile") return "max-w-[1100px]";
  // Galleries and search results use the full grid.
  return "max-w-[1440px]";
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
  const { pathname } = useLocation();
  const chromeless = isAuthPage || isOnboarding;
  const focusedPage = pathname === "/profile/edit";

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
      {!focusedPage && <Sidebar />}

      {/* Offset matches Sidebar's width: icon-only at md, full at lg. */}
      <div className={focusedPage ? "" : "md:pl-[76px] lg:pl-64"}>
        {!focusedPage && <TopSearchBar />}

        {/* pb leaves room for the floating mobile nav; md drops it, since Sidebar takes over from md up. */}
        <main
          className={`relative mx-auto w-full px-4 pb-32 sm:px-6 md:pb-16 lg:px-10 ${widthFor(pathname)}`}
        >
          {children}
        </main>
      </div>

      {!focusedPage && <BottomNav />}
    </div>
  );
}
