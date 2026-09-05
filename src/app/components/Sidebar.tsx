import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router";
import { Home, ClipboardList, Send, Bell, UserCircle2, Plus, LogIn } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { CreateMenu } from "./CreateMenu";

const navItems = [
  { to: "/",              icon: Home,          label: "首頁", end: true },
  { to: "/orders",        icon: ClipboardList, label: "訂單" },
  { to: "/chat",          icon: Send,          label: "聊天" },
  { to: "/notifications", icon: Bell,          label: "通知" },
  { to: "/profile",       icon: UserCircle2,   label: "我的" },
];

/**
 * Desktop/tablet navigation. Hidden below md, where BottomNav takes over.
 * Icon-only between md and lg; full labels from lg up. Replaces the old
 * TopNav — nav items moved here so TopSearchBar can stay a single search bar.
 */
export function Sidebar() {
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) {
      setHasUnread(false);
      return;
    }
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .neq("sender_id", user.id)
      .is("read_at", null)
      .is("deleted_at", null)
      .then(({ count }) => setHasUnread((count ?? 0) > 0));
  }, [user]);

  if (!user) {
    return (
      <aside className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/8 bg-ink/95 py-7 md:flex md:w-[76px] md:items-center md:px-2 lg:w-64 lg:items-stretch lg:px-5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 lg:self-start" aria-label="FULFILL 首頁">
          <img src="/logo-mark.svg" alt="" className="h-7 w-auto" />
          <span className="hidden text-xl font-semibold tracking-tight lg:inline">FULFILL</span>
        </Link>

        {/* Icon-only login entry at md (a full text button won't fit); both buttons from lg up. */}
        <div className="mt-8 flex w-full flex-col gap-2">
          <Link
            to="/login"
            aria-label="登入"
            className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/8 hover:text-white lg:mx-0 lg:h-10 lg:w-full lg:text-sm lg:font-medium"
          >
            <LogIn size={20} strokeWidth={1.8} className="lg:hidden" />
            <span className="hidden lg:inline">登入</span>
          </Link>
          <Link
            to="/register"
            className="hidden h-10 items-center justify-center rounded-full bg-paper text-sm font-semibold text-ink transition-colors hover:bg-brand-muted lg:flex"
          >
            註冊
          </Link>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-white/8 bg-ink/95 py-7 md:flex md:w-[76px] md:items-center md:px-2 lg:w-64 lg:items-stretch lg:px-5">
      <Link to="/" className="flex shrink-0 items-center gap-2.5 lg:self-start" aria-label="FULFILL 首頁">
        <img src="/logo-mark.svg" alt="" className="h-7 w-auto" />
        <span className="hidden text-xl font-semibold tracking-tight lg:inline">FULFILL</span>
      </Link>

      <nav className="mt-10 flex w-full flex-1 flex-col gap-1">
        {navItems.map((item) => (
          <SidebarNavItem key={item.to} {...item} dot={item.to === "/chat" && hasUnread} />
        ))}
      </nav>

      <CreateMenu
        direction="up"
        align="start"
        className="mx-auto flex h-11 w-11 shrink-0 items-center justify-center lg:mx-0 lg:w-full"
        trigger={(open) => (
          <span
            className={`flex h-full w-full items-center justify-center gap-2 rounded-full bg-paper text-sm font-semibold text-ink transition-colors hover:bg-brand-muted ${
              open ? "opacity-90" : ""
            }`}
          >
            <Plus size={18} strokeWidth={2.5} className={`transition-transform ${open ? "rotate-45" : ""}`} />
            <span className="hidden lg:inline">發布</span>
          </span>
        )}
      />
    </aside>
  );
}

function SidebarNavItem({
  to,
  icon: Icon,
  label,
  end,
  dot = false,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  end?: boolean;
  dot?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative mx-auto flex h-11 w-11 items-center justify-center gap-3 rounded-full text-sm transition-colors lg:mx-0 lg:w-full lg:justify-start lg:px-4 ${
          isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
        }`
      }
    >
      <span className="relative shrink-0">
        <Icon size={20} strokeWidth={1.7} />
        {dot && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-ink bg-paper" />
        )}
      </span>
      <span className="hidden lg:inline">{label}</span>
    </NavLink>
  );
}
