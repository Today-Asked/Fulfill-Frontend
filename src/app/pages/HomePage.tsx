import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Search, Bell, Heart, Bookmark, ChevronRight, ImageOff, X, Loader2, Menu } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { listOpenCommissions, inquireCommission, type Commission } from "../../lib/commissions";
import { useLoginGate, LoginGateDialog } from "../components/LoginGate";

interface Artwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
  tags?: string[];
}

const artworkCategories = ["全部", "繪畫與插畫", "平面設計", "品牌設計", "攝影", "3D 創作", "動態設計"];

function normalizeArtwork(row: any): Artwork {
  return {
    id: row.id,
    title: row.title,
    cover_image_url: row.cover_image_url,
    tags: (row.artwork_tags ?? []).map((item: any) => item.tags?.name).filter(Boolean),
  };
}

interface Creator {
  id: number;
  userId: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

interface SearchCreator {
  id: number;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── 主資料 ─────────────────────────────────────────────────────────────
  const [artworks, setArtworks]         = useState<Artwork[]>([]);
  const [creators, setCreators]         = useState<Creator[]>([]);
  const [likes, setLikes]               = useState<Set<number>>(new Set());
  const [saves, setSaves]               = useState<Set<number>>(new Set());
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);
  // 自己的 artist_profile id（排除自己作品用）
  const [myArtistId, setMyArtistId]     = useState<number | null>(null);
  const [myArtistReady, setMyArtistReady] = useState(false);

  // ── 搜尋 ───────────────────────────────────────────────────────────────
  const [showSearch, setShowSearch]         = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchArtworks, setSearchArtworks] = useState<Artwork[]>([]);
  const [searchCreators, setSearchCreators] = useState<SearchCreator[]>([]);
  const [searching, setSearching]           = useState(false);

  // ── 頁籤：作品與創作者 / 未指定的委託 ──────────────────────────────────
  const [tab, setTab] = useState<"discover" | "commissions">("discover");
  const [openCommissions, setOpenCommissions]   = useState<Commission[]>([]);
  const [loadingCommissions, setLoadingCommissions] = useState(false);
  const [commissionsError, setCommissionsError] = useState("");
  const [inquiringId, setInquiringId]           = useState<number | null>(null);
  const loginGate = useLoginGate();

  // ── Effect 1: 拿 myArtistId + 創作者（只在 user 改變時執行）──────────────
  useEffect(() => {
    setMyArtistReady(false);
    (async () => {
      // 自己的 artist_profile id
      let aid: number | null = null;
      if (user) {
        const { data: ap } = await supabase
          .from("artist_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        aid = ap?.id ?? null;
      }
      setMyArtistId(aid);
      setMyArtistReady(true);

      // 撈推薦創作者（排除自己）
      setLoadingCreators(true);
      let creatorQuery = supabase
        .from("artist_profiles")
        .select("id, user_id, users:user_id(username, name, bio, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(6);
      if (user) creatorQuery = creatorQuery.neq("user_id", user.id);

      const { data: creatorData } = await creatorQuery;
      const mapped: Creator[] = (creatorData ?? [])
        .filter((row: any) => row.users)
        .map((row: any) => ({
          id: row.id,
          userId: row.user_id,
          username: row.users.username,
          name: row.users.name,
          bio: row.users.bio,
          avatar_url: row.users.avatar_url,
        }))
        .slice(0, 3);
      setCreators(mapped);
      setLoadingCreators(false);
    })();
  }, [user]);

  // ── Effect 2: 撈熱門作品（user / myArtistReady 改變時執行）───────────────
  useEffect(() => {
    if (!myArtistReady) return;

    setLoadingArtworks(true);
    setArtworks([]);
    setLikes(new Set());
    setSaves(new Set());

    async function fetchArtworks() {
      let q = supabase
        .from("artworks")
        .select("id, title, cover_image_url, artwork_tags(tags(name))")
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(6);
      if (myArtistId !== null) q = q.neq("artist_id", myArtistId);
      const { data } = await q;
      const loaded: Artwork[] = (data ?? []).map(normalizeArtwork);

      setArtworks(loaded);
      setLoadingArtworks(false);

      // 撈已按讚
      if (user && loaded.length > 0) {
        const [{ data: likeData }, { data: saveData }] = await Promise.all([
          supabase.from("likes").select("artwork_id").eq("user_id", user.id).in("artwork_id", loaded.map((a) => a.id)),
          supabase.from("saves").select("artwork_id").eq("user_id", user.id).in("artwork_id", loaded.map((a) => a.id)),
        ]);
        setLikes(new Set((likeData ?? []).map((l: any) => l.artwork_id)));
        setSaves(new Set((saveData ?? []).map((s: any) => s.artwork_id)));
      }
    }

    fetchArtworks();
  }, [user, myArtistReady, myArtistId]);

  // ── 按讚切換 ────────────────────────────────────────────────────────────
  function handleToggleLike(artworkId: number, e: React.MouseEvent) {
    e.stopPropagation();
    loginGate.requireAuth(user, async () => {
      if (likes.has(artworkId)) {
        await supabase.from("likes").delete()
          .eq("user_id", user!.id).eq("artwork_id", artworkId);
        setLikes((prev) => { const s = new Set(prev); s.delete(artworkId); return s; });
      } else {
        await supabase.from("likes").insert({ user_id: user!.id, artwork_id: artworkId });
        setLikes((prev) => new Set([...prev, artworkId]));
      }
    });
  }

  function handleToggleSave(artworkId: number, e: React.MouseEvent) {
    e.stopPropagation();
    loginGate.requireAuth(user, async () => {
      if (saves.has(artworkId)) {
        await supabase.from("saves").delete().eq("user_id", user!.id).eq("artwork_id", artworkId);
        setSaves((prev) => { const next = new Set(prev); next.delete(artworkId); return next; });
      } else {
        await supabase.from("saves").insert({ user_id: user!.id, artwork_id: artworkId });
        setSaves((prev) => new Set([...prev, artworkId]));
      }
    });
  }

  // ── Effect 3: 撈未指定的委託（切到該頁籤時才撈）──────────────────────────
  useEffect(() => {
    if (tab !== "commissions") return;
    setLoadingCommissions(true);
    setCommissionsError("");
    listOpenCommissions()
      .then(setOpenCommissions)
      .catch((e) => setCommissionsError(e instanceof Error ? e.message : "載入委託失敗。"))
      .finally(() => setLoadingCommissions(false));
  }, [tab, user]);

  // ── 諮詢詳情：任何人都能聊，不會佔用這則委託。開聊天室並標記這則委託，
  // 讓委託者之後可以在聊天室裡一鍵邀請 ──────────────────────────────────
  function handleInquire(commission: Commission) {
    loginGate.requireAuth(user, async () => {
      setInquiringId(commission.id);
      setCommissionsError("");
      try {
        const chatId = await inquireCommission(commission, user!.id);
        navigate(`/chat/${chatId}`);
      } catch (e) {
        setCommissionsError(e instanceof Error ? e.message : "開啟對話失敗，請稍後再試。");
      } finally {
        setInquiringId(null);
      }
    });
  }

  // ── 搜尋（300ms debounce）──────────────────────────────────────────────
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchArtworks([]);
      setSearchCreators([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const [{ data: aw }, { data: cr }] = await Promise.all([
        supabase
          .from("artworks")
          .select("id, title, cover_image_url, artwork_tags(tags(name))")
          .eq("status", "published")
          .is("deleted_at", null)
          .ilike("title", `%${q}%`)
          .limit(6),
        supabase
          .from("artist_profiles")
          .select("id, users:user_id!inner(username, name, avatar_url)")
          .limit(40),
      ]);

      setSearchArtworks((aw ?? []).map(normalizeArtwork));
      setSearchCreators(
        (cr ?? [])
          .filter((ap: any) => {
            const u = ap.users;
            const ql = q.toLowerCase();
            return u && (
              u.name?.toLowerCase().includes(ql) ||
              u.username?.toLowerCase().includes(ql)
            );
          })
          .slice(0, 4)
          .map((ap: any) => ({
            id: ap.id,
            username: ap.users.username,
            name: ap.users.name,
            avatar_url: ap.users.avatar_url,
          }))
      );
      setSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const visibleArtworks = selectedCategory === "全部"
    ? artworks
    : artworks.filter((artwork) => artwork.tags?.includes(selectedCategory));

  return (
    <div className="min-h-[100dvh] bg-[#090909] pb-10">
      {/* Compact identity bar inspired by the supplied mobile reference. */}
      <header className="px-3 pb-3 pt-7 sm:px-5">
        <div className="flex items-center justify-between px-1">
          <img src="/logo-mark.svg" alt="Fulfill" className="h-9 w-auto" />
          <button onClick={() => navigate("/notifications")} aria-label="查看通知" className="-mr-1 grid h-10 w-10 place-items-center rounded-xl text-white/55 transition-colors hover:bg-white/8 hover:text-white active:scale-[0.98]">
            <Bell size={19} strokeWidth={1.8} />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => setShowSearch(true)} className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-[#f2f2ee] px-4 text-left text-sm text-black shadow-[inset_0_-2px_5px_rgba(0,0,0,0.16)] transition-transform active:scale-[0.99]">
            <Search size={18} strokeWidth={2.2} className="mr-3 shrink-0" />
            <span className="truncate text-black/55">搜尋作品或創作者</span>
          </button>
          <button onClick={() => setShowCategories(true)} aria-label="開啟作品分類" aria-expanded={showCategories} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white/75 transition-colors hover:bg-white/8 active:scale-[0.98]">
            <Menu size={21} strokeWidth={1.8} />
          </button>
        </div>
      </header>

      {/* Tabs */}
      {selectedCategory === "全部" && (
        <div className="mb-4 grid grid-cols-2 gap-1 px-3 sm:px-5">
          <button
            onClick={() => setTab("discover")}
            className={`rounded-xl py-2.5 text-sm font-medium transition-colors active:scale-[0.99] ${
              tab === "discover" ? "bg-[#f2f2ee] text-black" : "bg-white/5 text-white/40 hover:text-white"
            }`}
          >
            作品與創作者
          </button>
          <button
            onClick={() => setTab("commissions")}
            className={`rounded-xl py-2.5 text-sm font-medium transition-colors active:scale-[0.99] ${
              tab === "commissions" ? "bg-[#f2f2ee] text-black" : "bg-white/5 text-white/40 hover:text-white"
            }`}
          >
            未指定的委託
          </button>
        </div>
      )}

      {tab === "discover" ? (
        <>
          <div className="mb-3 px-4 sm:px-6">
            <p className="text-xs text-white/45">{selectedCategory}</p>
          </div>

          {/* Dense two-column masonry on mobile, expanding on larger screens. */}
          {loadingArtworks ? (
            <BentoSkeleton />
          ) : visibleArtworks.length === 0 ? (
            <BentoEmpty message={`目前沒有「${selectedCategory}」作品`} />
          ) : (
            <div className="mb-8 columns-2 gap-2 px-3 sm:columns-3 sm:px-5 lg:columns-4">
              {visibleArtworks.map((artwork, index) => (
                <BentoCard key={artwork.id} artwork={artwork} index={index} isLiked={likes.has(artwork.id)} isSaved={saves.has(artwork.id)} onToggleLike={handleToggleLike} onToggleSave={handleToggleSave} />
              ))}
            </div>
          )}

          {/* Top Creators */}
          <div className="mb-6 px-3 sm:px-5">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-sm font-semibold text-white">推薦創作者</h2>
              <button onClick={() => navigate("/search")} className="flex items-center gap-0.5 text-xs text-white/50 hover:text-white">
                全部 <ChevronRight size={12} />
              </button>
            </div>
            {loadingCreators ? (
              <CreatorListSkeleton />
            ) : creators.length === 0 ? (
              <p className="text-gray-500 text-xs px-3 py-6 text-center">尚無推薦創作者</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {creators.map((creator) => (
                  <div
                    key={creator.id}
                    onClick={() => creator.username && navigate(`/creator/${creator.username}`)}
                    className="flex cursor-pointer items-center justify-between rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/8"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <AvatarImg url={creator.avatar_url} name={creator.name} size={10} />
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#141414] rounded-full" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-white text-sm font-medium truncate block">
                          {creator.name ?? creator.username ?? "未命名"}
                        </span>
                        {creator.bio && (
                          <span className="text-gray-400 text-[11px] truncate block">{creator.bio}</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        loginGate.requireAuth(user, () => navigate(`/invite/${creator.id}`), "登入解鎖合作邀請");
                      }}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-gray-200 hover:bg-white/14 transition-colors shrink-0 ml-2"
                    >
                      委託
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="px-4 mb-6">
          {commissionsError && (
            <p className="text-amber-300 text-xs bg-amber-400/10 border border-amber-400/20 rounded-xl px-4 py-3 mb-3">
              {commissionsError}
            </p>
          )}
          {loadingCommissions ? (
            <OpenCommissionSkeleton />
          ) : openCommissions.length === 0 ? (
            <div className="mx-1 rounded-[20px] border border-dashed border-white/10 px-6 py-14 flex flex-col items-center gap-3">
              <p className="text-gray-400 text-sm">目前沒有未指定的委託</p>
              {user ? (
                <p className="text-gray-600 text-xs">點右上角「+」發布一則，讓所有創作者都看得到</p>
              ) : (
                <>
                  <p className="text-gray-600 text-xs">登入新增一則，讓所有創作者都看得到</p>
                  <button
                    onClick={() => navigate("/login")}
                    className="mt-1 px-5 py-2 rounded-full bg-white/8 border border-white/12 text-gray-300 text-xs hover:bg-white/12 transition-colors"
                  >
                    登入新增一則
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {openCommissions.map((commission) => (
                <OpenCommissionCard
                  key={commission.id}
                  commission={commission}
                  isMine={commission.clientId === user?.id}
                  inquiring={inquiringId === commission.id}
                  onInquire={() => void handleInquire(commission)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Search Overlay */}
      {showSearch && (
        <SearchOverlay
          query={searchQuery}
          onQueryChange={setSearchQuery}
          onClose={() => { setShowSearch(false); setSearchQuery(""); }}
          artworks={searchArtworks}
          creators={searchCreators}
          searching={searching}
          onArtworkClick={(id) => { navigate(`/artwork/${id}`); setShowSearch(false); setSearchQuery(""); }}
          onCreatorClick={(u) => { if (u) { navigate(`/creator/${u}`); setShowSearch(false); setSearchQuery(""); } }}
        />
      )}

      {showCategories && (
        <CategoryDrawer
          categories={artworkCategories}
          selected={selectedCategory}
          onSelect={(category) => { setSelectedCategory(category); setShowCategories(false); setTab("discover"); }}
          onClose={() => setShowCategories(false)}
        />
      )}

      <LoginGateDialog {...loginGate} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * BentoCard
 * ───────────────────────────────────────────────────────────────────────── */
function BentoCard({
  artwork,
  index,
  isLiked,
  isSaved,
  onToggleLike,
  onToggleSave,
}: {
  artwork: Artwork;
  index: number;
  isLiked: boolean;
  isSaved: boolean;
  onToggleLike: (id: number, e: React.MouseEvent) => void;
  onToggleSave: (id: number, e: React.MouseEvent) => void;
}) {
  const navigate = useNavigate();
  const [showMeta, setShowMeta] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartRef = useRef({ x: 0, y: 0 });

  const ratios = ["aspect-[4/5]", "aspect-[3/4]", "aspect-[4/6]", "aspect-square", "aspect-[5/7]", "aspect-[4/5]"];

  function clearLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  useEffect(() => () => clearLongPress(), []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse") return;
    longPressTriggeredRef.current = false;
    pressStartRef.current = { x: event.clientX, y: event.clientY };
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      setShowMeta(true);
      navigator.vibrate?.(18);
    }, 480);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || longPressTimerRef.current === null) return;
    const moved = Math.hypot(event.clientX - pressStartRef.current.x, event.clientY - pressStartRef.current.y);
    if (moved > 10) clearLongPress();
  }

  return (
    <article className="mb-3 break-inside-avoid overflow-hidden rounded-xl bg-[#151515]">
      <div
        className={`artwork-gallery-card group relative cursor-pointer select-none overflow-hidden bg-white/5 ${ratios[index % ratios.length]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          if (longPressTriggeredRef.current) {
            event.preventDefault();
            longPressTriggeredRef.current = false;
            return;
          }
          navigate(`/artwork/${artwork.id}`);
        }}
      >
        {artwork.cover_image_url ? (
          <img src={artwork.cover_image_url} alt={artwork.title ?? ""} loading={index < 4 ? "eager" : "lazy"} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025] motion-reduce:transform-none" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><ImageOff size={20} className="text-gray-700" /></div>
        )}
        <div className={`artwork-reveal absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 to-transparent ${showMeta ? "is-revealed" : ""}`} />
        <p className={`artwork-reveal pointer-events-none absolute inset-x-3 bottom-3 truncate text-xs font-medium text-white ${showMeta ? "is-revealed" : ""}`}>
          {artwork.title ?? "未命名作品"}
        </p>
        <div className={`artwork-reveal artwork-actions absolute right-2 top-2 flex gap-1.5 ${showMeta ? "is-revealed" : ""}`}>
          <button onPointerDown={(event) => event.stopPropagation()} onClick={(e) => onToggleLike(artwork.id, e)} aria-label={isLiked ? "取消喜愛" : "加入喜愛"} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition-transform active:scale-90">
            <Heart size={14} strokeWidth={1.8} className={isLiked ? "fill-white text-white" : "text-white"} />
          </button>
          <button onPointerDown={(event) => event.stopPropagation()} onClick={(e) => onToggleSave(artwork.id, e)} aria-label={isSaved ? "取消收藏" : "收藏作品"} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition-transform active:scale-90">
            <Bookmark size={14} strokeWidth={1.8} className={isSaved ? "fill-white text-white" : "text-white"} />
          </button>
        </div>
      </div>
    </article>
  );
}

function CategoryDrawer({ categories, selected, onSelect, onClose }: { categories: string[]; selected: string; onSelect: (category: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="作品分類">
      <button type="button" aria-label="關閉作品分類" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <aside className="relative ml-auto flex min-h-[100dvh] w-[82%] max-w-sm flex-col bg-[#0d0d0d] px-6 pb-10 pt-7 shadow-[-24px_0_60px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between">
          <div><p className="text-[10px] tracking-[0.2em] text-white/30">CATEGORY</p><h2 className="mt-1 text-lg font-semibold text-white">作品分類</h2></div>
          <button onClick={onClose} aria-label="關閉" className="grid h-9 w-9 place-items-center rounded-full border border-white/15 text-white/65 hover:bg-white/8 hover:text-white"><X size={17} /></button>
        </div>
        <div className="mt-8 grid gap-1">
          {categories.map((category) => (
            <button key={category} onClick={() => onSelect(category)} className={`rounded-xl px-4 py-3 text-left text-sm transition-colors active:scale-[0.99] ${selected === category ? "bg-[#f2f2ee] font-semibold text-black" : "text-white/60 hover:bg-white/6 hover:text-white"}`}>
              {category}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * SearchOverlay
 * ───────────────────────────────────────────────────────────────────────── */
function SearchOverlay({
  query,
  onQueryChange,
  onClose,
  artworks,
  creators,
  searching,
  onArtworkClick,
  onCreatorClick,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
  artworks: Artwork[];
  creators: { id: number; username: string | null; name: string | null; avatar_url: string | null }[];
  searching: boolean;
  onArtworkClick: (id: number) => void;
  onCreatorClick: (username: string | null) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#0d0d0d]">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-8 sm:px-6">
        <div className="flex h-11 flex-1 items-center rounded-full bg-[#f2f2ee] px-4 text-black shadow-[inset_0_-2px_5px_rgba(0,0,0,0.14)]">
          <Search size={16} className="mr-2 shrink-0 text-black" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜尋作品或創作者..."
            className="flex-1 bg-transparent text-sm text-black outline-none placeholder:text-black/40"
          />
          {query && (
            <button onClick={() => onQueryChange("")}>
              <X size={14} className="text-black/45" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="shrink-0 text-sm text-white/55 hover:text-white">
          取消
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 [&::-webkit-scrollbar]:hidden pb-10">
        {searching && (
          <div className="flex justify-center pt-12">
            <Loader2 size={22} className="text-gray-500 animate-spin" />
          </div>
        )}

        {!searching && !query.trim() && (
          <p className="text-gray-600 text-sm text-center pt-16">輸入關鍵字搜尋</p>
        )}

        {!searching && query.trim() && artworks.length === 0 && creators.length === 0 && (
          <p className="text-gray-500 text-sm text-center pt-16">找不到「{query}」相關結果</p>
        )}

        {/* 創作者結果 */}
        {!searching && creators.length > 0 && (
          <div className="mb-5">
            <p className="text-gray-500 text-[10px] tracking-widest mb-2">創作者</p>
            <div className="flex flex-col gap-2">
              {creators.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onCreatorClick(c.username)}
                  className="flex items-center gap-3 p-3 bg-white/4 border border-white/6 rounded-2xl text-left hover:bg-white/8 transition-colors"
                >
                  <AvatarImg url={c.avatar_url} name={c.name} size={10} />
                  <span className="text-white text-sm font-medium">
                    {c.name ?? c.username ?? "未命名"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 作品結果 */}
        {!searching && artworks.length > 0 && (
          <div>
            <p className="text-gray-500 text-[10px] tracking-widest mb-2">作品</p>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {artworks.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onArtworkClick(a.id)}
                  className="relative aspect-square overflow-hidden rounded-xl bg-white/5 transition-transform active:scale-[0.98]"
                >
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt={a.title ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={16} className="text-gray-700" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * 共用小元件
 * ───────────────────────────────────────────────────────────────────────── */

function AvatarImg({ url, name, size = 10 }: { url: string | null; name: string | null; size?: number }) {
  const px = size * 4;
  const style = { width: px, height: px, minWidth: px, minHeight: px };
  if (url) {
    return <img src={url} alt={name ?? ""} style={style} className="rounded-full object-cover border border-white/10 shrink-0" />;
  }
  return (
    <div style={style} className="rounded-full bg-white border border-white/10 flex items-center justify-center shrink-0">
      <span className="text-white/70 text-sm font-bold">{name?.[0]?.toUpperCase() ?? "?"}</span>
    </div>
  );
}

function BentoSkeleton() {
  return (
    <div className="mb-8 columns-2 gap-2 px-3 sm:columns-3 sm:px-5 lg:columns-4">
      {[5, 7, 6, 5, 8, 6, 7, 5].map((height, index) => (
        <div key={index} className="mb-3 break-inside-avoid animate-pulse overflow-hidden rounded-xl bg-[#151515]">
          <div className="bg-white/6" style={{ height: `${height * 32}px` }} />
          <div className="h-9 bg-white/[0.035]" />
        </div>
      ))}
    </div>
  );
}

function BentoEmpty({ message = "尚未有公開作品" }: { message?: string }) {
  return (
    <div className="mx-3 mb-4 rounded-[20px] border border-dashed border-white/10 px-6 py-14 flex flex-col items-center gap-2">
      <ImageOff size={28} className="text-gray-600" />
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * OpenCommissionCard — 未指定的委託
 * ───────────────────────────────────────────────────────────────────────── */
function OpenCommissionCard({
  commission,
  isMine,
  inquiring,
  onInquire,
}: {
  commission: Commission;
  isMine: boolean;
  inquiring: boolean;
  onInquire: () => void;
}) {
  const budget =
    commission.budgetMin == null && commission.budgetMax == null
      ? "預算面議"
      : `NT$ ${(commission.budgetMin ?? 0).toLocaleString()} - ${(commission.budgetMax ?? commission.budgetMin ?? 0).toLocaleString()}`;

  return (
    <div className="p-4 bg-white/4 backdrop-blur-md border border-white/6 rounded-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">{commission.orgName}</p>
          <p className="text-gray-500 text-[11px] mt-0.5">{commission.clientName}</p>
        </div>
        {isMine && (
          <span className="text-[10px] px-2 py-1 rounded-full bg-white/8 text-gray-400 shrink-0">你發布的</span>
        )}
      </div>

      {commission.services.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {commission.services.map((s) => (
            <span key={s} className="text-[10px] px-2 py-1 rounded-full bg-white/6 text-gray-300">
              {s}
            </span>
          ))}
        </div>
      )}

      {commission.description && (
        <p className="text-gray-400 text-xs mt-3 line-clamp-2">{commission.description}</p>
      )}

      <div className="flex items-center justify-between mt-3 text-[11px] text-gray-500">
        <span>{budget}</span>
        {commission.finalDueDate && (
          <span>交件 {new Date(commission.finalDueDate).toLocaleDateString("zh-TW")}</span>
        )}
      </div>

      {!isMine && (
        <button
          onClick={onInquire}
          disabled={inquiring}
          className="w-full mt-4 py-2.5 rounded-xl bg-white/8 text-white text-xs font-medium hover:bg-white/14 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {inquiring ? "開啟對話中…" : "諮詢詳情"}
        </button>
      )}
    </div>
  );
}

function OpenCommissionSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-40 rounded-2xl bg-white/5" />
      ))}
    </div>
  );
}

function CreatorListSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 bg-white/4 border border-white/6 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-white/8" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-white/8 rounded" />
            <div className="h-2.5 w-40 bg-white/6 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
