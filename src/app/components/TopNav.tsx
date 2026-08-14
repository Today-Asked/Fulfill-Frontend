import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Search, Bell, ClipboardList, Send, Plus, UserCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Desktop navigation. Hidden below lg, where BottomNav takes over.
 */
export function TopNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
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

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = keyword.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/8 bg-ink/90 backdrop-blur-xl lg:block">
      <div className="mx-auto flex w-full max-w-[1440px] items-center gap-8 px-10 py-3.5">
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="FULFILL 首頁">
          <img src="/logo-mark.svg" alt="" className="h-7 w-auto" />
          <span className="text-xl font-semibold tracking-tight">FULFILL</span>
        </Link>

        <form onSubmit={submitSearch} role="search" className="flex max-w-[460px] flex-1">
          <div className="flex h-10 w-full items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 transition-colors focus-within:border-white/25">
            <Search size={18} className="text-white/40" />
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜尋作品、創作者或風格"
              aria-label="搜尋"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
            />
          </div>
        </form>

        <nav className="flex items-center gap-1">
          <NavItem to="/orders" icon={ClipboardList} label="訂單" />
          <NavItem to="/chat" icon={Send} label="聊天" dot={hasUnread} />
          <NavItem to="/notifications" icon={Bell} label="通知" />
          <NavItem to="/profile" icon={UserCircle2} label="我的" />

          <Link
            to="/create"
            className="ml-3 flex h-10 items-center gap-2 rounded-full bg-paper px-5 text-sm font-semibold text-ink transition-colors hover:bg-brand-muted"
          >
            <Plus size={18} strokeWidth={2.5} />
            新增作品
          </Link>
        </nav>
      </div>
    </header>
  );
}

function NavItem({
  to,
  icon: Icon,
  label,
  dot = false,
}: {
  to: string;
  icon: typeof Search;
  label: string;
  dot?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `relative flex items-center gap-2 rounded-full px-3.5 py-2 text-sm transition-colors ${
          isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
        }`
      }
    >
      <span className="relative">
        <Icon size={19} strokeWidth={1.7} />
        {dot && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full border border-ink bg-paper" />
        )}
      </span>
      {label}
    </NavLink>
  );
}
