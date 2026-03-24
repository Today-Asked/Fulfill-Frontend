import React from "react";
import { useNavigate, useLocation } from "react-router";
import { Home, Send, Plus, ClipboardList, UserCircle2 } from "lucide-react";

const navItems = [
  { icon: Home, label: "主頁", path: "/" },
  { icon: Send, label: "聊天", path: "/chat" },
  { icon: Plus, label: "新增", path: "/create" },
  { icon: ClipboardList, label: "訂單", path: "/orders" },
  { icon: UserCircle2, label: "我", path: "/profile" },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="absolute bottom-0 left-0 right-0 pb-6 pt-3 px-5 z-50 pointer-events-none">
      <div className="flex justify-between items-center bg-[#111115]/80 backdrop-blur-2xl border border-white/8 rounded-full px-4 py-3 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] pointer-events-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const isCreate = item.path === "/create";

          if (isCreate) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative -mt-8 group"
              >
                <div className="absolute inset-0 bg-fuchsia-500/50 rounded-full blur-md group-hover:bg-fuchsia-500/70 transition-colors" />
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center border-[3px] border-[#0a0a0f] relative z-10 text-white transform group-hover:scale-105 transition-transform">
                  <Plus size={22} strokeWidth={2.5} />
                </div>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 transition-all ${
                isActive ? "text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-gradient-to-r from-fuchsia-400 to-cyan-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
