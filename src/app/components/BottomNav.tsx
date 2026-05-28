import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Home, Send, Plus, ClipboardList, UserCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { icon: Home,          label: "主頁", path: "/" },
  { icon: Send,          label: "聊天", path: "/chat" },
  { icon: Plus,          label: "新增", path: "/create" },
  { icon: ClipboardList, label: "訂單", path: "/orders" },
  { icon: UserCircle2,   label: "我",   path: "/profile" },
];

export function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user }  = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) { setHasUnread(false); return; }
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .neq("sender_id", user.id)
      .is("read_at", null)
      .is("deleted_at", null)
      .then(({ count }) => setHasUnread((count ?? 0) > 0));
  }, [user, location.pathname]);

  return (
    <div className="absolute bottom-0 left-0 right-0 pb-6 pt-2 px-6 z-50 pointer-events-none">
      <div className="flex justify-between items-center bg-black/70 backdrop-blur-2xl border border-white/10 rounded-full px-5 py-3 pointer-events-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const isCreate = item.path === "/create";
          const isChat   = item.path === "/chat";

          if (isCreate) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-11 h-11 rounded-full bg-[#f9a8d4] flex items-center justify-center shadow-md shadow-pink-400/25 hover:bg-[#f472b6] active:scale-95 transition-all -mt-6"
              >
                <Plus size={20} strokeWidth={2.5} className="text-black" />
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 transition-all ${
                isActive ? "text-white" : "text-white/35 hover:text-white/60"
              }`}
            >
              <div className="relative">
                <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                {isChat && hasUnread && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#f9a8d4] border border-black" />
                )}
              </div>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#f9a8d4]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
