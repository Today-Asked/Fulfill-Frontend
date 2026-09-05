import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";

/**
 * Site-wide search bar shown alongside Sidebar on md+ screens. Sidebar owns
 * navigation now, so this stays a single search field — no logo, no nav
 * items — to avoid duplicating what Sidebar already renders.
 */
export function TopSearchBar() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");

  // Guests get login/register in Sidebar instead; no search bar for them,
  // matching the old TopNav's guest state.
  if (!user) return null;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = keyword.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <header className="sticky top-0 z-30 hidden border-b border-white/8 bg-ink/90 px-6 py-3.5 backdrop-blur-xl md:block lg:px-10">
      <form onSubmit={submitSearch} role="search" className="mx-auto flex w-full max-w-[460px]">
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
    </header>
  );
}
