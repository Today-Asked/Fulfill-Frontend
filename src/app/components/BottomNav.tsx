import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Home, Send, Plus, ClipboardList, UserCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { CreateMenu } from "./CreateMenu";

const navItems = [
  { icon: Home,          label: "主頁", path: "/" },
  { icon: Send,          label: "聊天", path: "/chat" },
  { icon: Plus,          label: "新增", path: "/create" },
  { icon: ClipboardList, label: "訂單", path: "/orders" },
  { icon: UserCircle2,   label: "我",   path: "/profile" },
];

/**
 * Mobile navigation. Now fixed to the viewport rather than absolutely
 * positioned inside the old phone frame, and hidden from md up where
 * Sidebar covers the same destinations.
 */
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

  if (!user) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-6 pb-6 pt-2 md:hidden">
        <div className="pointer-events-auto mx-auto flex max-w-[420px] items-center gap-3 rounded-full border border-white/10 bg-black/70 px-3 py-2 backdrop-blur-2xl">
          <button
            onClick={() => navigate("/login")}
            className="flex-1 rounded-full py-2.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
          >
            登入
          </button>
          <button
            onClick={() => navigate("/register")}
            className="flex-1 rounded-full bg-paper py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-brand-muted"
          >
            註冊
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-6 pb-6 pt-2 md:hidden">
      <div className="pointer-events-auto mx-auto flex max-w-[420px] items-center justify-between rounded-full border border-white/10 bg-black/70 px-5 py-3 backdrop-blur-2xl">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const isCreate = item.path === "/create";
          const isChat   = item.path === "/chat";

          if (isCreate) {
            return (
              <CreateMenu
                key={item.path}
                className="-mt-6"
                direction="up"
                align="center"
                trigger={(open) => (
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-full bg-paper shadow-md shadow-white/20 transition-all hover:bg-brand-muted active:scale-95 ${
                      open ? "rotate-45" : ""
                    }`}
                  >
                    <Plus size={20} strokeWidth={2.5} className="text-black" />
                  </span>
                )}
              />
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 transition-all ${
                isActive ? "text-white" : "text-white/35 hover:text-white/60"
              }`}
            >
              <div className="relative">
                <item.icon size={22} strokeWidth={isActive ? 2 : 1.5} />
                {isChat && hasUnread && !isActive && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-black bg-paper" />
                )}
              </div>
              {isActive && <span className="h-1 w-1 rounded-full bg-paper" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
