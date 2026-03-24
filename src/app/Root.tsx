import React from "react";
import { Outlet, useLocation } from "react-router";
import { BottomNav } from "./components/BottomNav";

export function Root() {
  const location = useLocation();
  const isChatRoom = location.pathname.startsWith("/chat/");

  return (
    <div className="flex justify-center items-center min-h-screen bg-[#050508] sm:p-4 text-white font-sans selection:bg-fuchsia-500/30">
      {/* Mobile Device Frame */}
      <div className="w-full h-screen sm:h-[844px] sm:w-[390px] bg-[#0a0a0f] relative overflow-hidden sm:rounded-[40px] shadow-2xl border border-white/5 flex flex-col">
        {/* Ambient glow orbs */}
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 bg-fuchsia-600/15 rounded-full blur-[90px] pointer-events-none" />
        <div className="absolute bottom-[120px] right-[-40px] w-56 h-56 bg-cyan-500/8 rounded-full blur-[70px] pointer-events-none" />
        <div className="absolute top-[40%] right-[-80px] w-72 h-72 bg-violet-600/10 rounded-full blur-[90px] pointer-events-none" />

        {/* Page content */}
        <div className="flex-1 overflow-hidden relative z-10">
          <Outlet />
        </div>

        {/* Bottom nav shown on all pages except individual chat room */}
        {!isChatRoom && <BottomNav />}
      </div>
    </div>
  );
}
