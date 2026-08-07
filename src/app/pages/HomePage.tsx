import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Bell, Heart, ChevronRight, ImageOff, X, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { getOrCreateConversation } from "../../lib/chat";

// Category → DB tag name (null = special mode, not tag-filtered)
const CATEGORY_CONFIG = [
  { label: "熱門推薦",  tagName: null as string | null },
  { label: "個人化推薦", tagName: null as string | null },
  { label: "角色設計",  tagName: "Character Design" },
  { label: "品牌設計",  tagName: "Brand Design" },
  { label: "插畫",     tagName: "Illustration" },
  { label: "數位藝術",  tagName: "Digital Art" },
];

interface Artwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
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
  const [activeCat, setActiveCat] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── 主資料 ─────────────────────────────────────────────────────────────
  const [artworks, setArtworks]         = useState<Artwork[]>([]);
  const [creators, setCreators]         = useState<Creator[]>([]);
  const [likes, setLikes]               = useState<Set<number>>(new Set());
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);
  // 自己的 artist_profile id（排除自己作品用）
  const [myArtistId, setMyArtistId]     = useState<number | null>(null);
  const [myArtistReady, setMyArtistReady] = useState(false);

  // ── 搜尋 ───────────────────────────────────────────────────────────────
  const [showSearch, setShowSearch]         = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [searchArtworks, setSearchArtworks] = useState<Artwork[]>([]);
  const [searchCreators, setSearchCreators] = useState<SearchCreator[]>([]);
  const [searching, setSearching]           = useState(false);

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

  // ── Effect 2: 依分類撈作品（user / activeCat / myArtistReady 改變時執行）──
  useEffect(() => {
    if (!myArtistReady) return;

    setLoadingArtworks(true);
    setArtworks([]);
    setLikes(new Set());

    const cat = CATEGORY_CONFIG[activeCat];

    async function fetchArtworks() {
      let loaded: Artwork[] = [];

      if (activeCat === 1) {
        // 個人化推薦：顯示追蹤中創作者的作品
        if (!user) {
          setArtworks([]);
          setLoadingArtworks(false);
          return;
        }
        const { data: followData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", user.id);
        const followedIds = (followData ?? []).map((f: any) => f.following_id);

        if (followedIds.length > 0) {
          const { data: apData } = await supabase
            .from("artist_profiles")
            .select("id")
            .in("user_id", followedIds);
          const artistIds = (apData ?? []).map((ap: any) => ap.id);

          if (artistIds.length > 0) {
            let q = supabase
              .from("artworks")
              .select("id, title, cover_image_url")
              .in("artist_id", artistIds)
              .eq("status", "published")
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(6);
            if (myArtistId !== null) q = q.neq("artist_id", myArtistId);
            const { data } = await q;
            loaded = data ?? [];
          }
        }
      } else if (cat.tagName) {
        // 標籤分類
        const { data: tagRow } = await supabase
          .from("tags")
          .select("id")
          .eq("name", cat.tagName)
          .maybeSingle();

        if (tagRow?.id) {
          const { data: atRows } = await supabase
            .from("artwork_tags")
            .select("artwork_id")
            .eq("tag_id", tagRow.id)
            .limit(30);

          const ids = (atRows ?? []).map((r: any) => r.artwork_id);
          if (ids.length > 0) {
            let q = supabase
              .from("artworks")
              .select("id, title, cover_image_url")
              .in("id", ids)
              .eq("status", "published")
              .is("deleted_at", null)
              .order("created_at", { ascending: false })
              .limit(6);
            if (myArtistId !== null) q = q.neq("artist_id", myArtistId);
            const { data } = await q;
            loaded = data ?? [];
          }
        }
      } else {
        // 熱門推薦（預設）
        let q = supabase
          .from("artworks")
          .select("id, title, cover_image_url")
          .eq("status", "published")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(6);
        if (myArtistId !== null) q = q.neq("artist_id", myArtistId);
        const { data } = await q;
        loaded = data ?? [];
      }

      setArtworks(loaded);
      setLoadingArtworks(false);

      // 撈已按讚
      if (user && loaded.length > 0) {
        const { data: likeData } = await supabase
          .from("likes")
          .select("artwork_id")
          .eq("user_id", user.id)
          .in("artwork_id", loaded.map((a) => a.id));
        setLikes(new Set((likeData ?? []).map((l: any) => l.artwork_id)));
      }
    }

    fetchArtworks();
  }, [user, activeCat, myArtistReady, myArtistId]);

  // ── 按讚切換 ────────────────────────────────────────────────────────────
  async function handleToggleLike(artworkId: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!user) return;

    if (likes.has(artworkId)) {
      await supabase.from("likes").delete()
        .eq("user_id", user.id).eq("artwork_id", artworkId);
      setLikes((prev) => { const s = new Set(prev); s.delete(artworkId); return s; });
    } else {
      await supabase.from("likes").insert({ user_id: user.id, artwork_id: artworkId });
      setLikes((prev) => new Set([...prev, artworkId]));
    }
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
          .select("id, title, cover_image_url")
          .eq("status", "published")
          .is("deleted_at", null)
          .ilike("title", `%${q}%`)
          .limit(6),
        supabase
          .from("artist_profiles")
          .select("id, users:user_id!inner(username, name, avatar_url)")
          .limit(40),
      ]);

      setSearchArtworks(aw ?? []);
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

  const slot = (i: number) => artworks[i];

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#141414]">
      {/* Top bar */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <button
          onClick={() => setShowSearch(true)}
          className="flex items-center justify-center w-11 h-11 bg-white/8 backdrop-blur-md border border-white/12 rounded-full hover:bg-white/14 transition-colors"
        >
          <Search size={18} className="text-gray-300" />
        </button>
        <button
          onClick={() => navigate("/notifications")}
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors"
        >
          <Bell size={17} className="text-white" />
        </button>
      </div>

      {/* Bento Grid */}
      {loadingArtworks ? (
        <BentoSkeleton />
      ) : artworks.length === 0 ? (
        <BentoEmpty
          message={
            activeCat === 1
              ? "追蹤創作者後，這裡會顯示他們的作品"
              : CATEGORY_CONFIG[activeCat].tagName
              ? `「${CATEGORY_CONFIG[activeCat].label}」分類尚無作品`
              : "尚未有公開作品"
          }
        />
      ) : (
        <div className="px-3 mb-4">
          <div className="flex gap-2 mb-2">
            <div className="flex flex-col gap-2 flex-[3]">
              <BentoCard artwork={slot(0)} heightClass="h-44"        isLiked={likes.has(slot(0)?.id ?? -1)} onToggleLike={handleToggleLike} />
              <BentoCard artwork={slot(2)} heightClass="h-36"        isLiked={likes.has(slot(2)?.id ?? -1)} onToggleLike={handleToggleLike} />
            </div>
            <div className="flex-[2]">
              <BentoCard artwork={slot(1)} heightClass="h-[21.5rem]" isLiked={likes.has(slot(1)?.id ?? -1)} onToggleLike={handleToggleLike} />
            </div>
          </div>
          <div className="mb-2">
            <BentoCard artwork={slot(3)} heightClass="h-36"          isLiked={likes.has(slot(3)?.id ?? -1)} onToggleLike={handleToggleLike} />
          </div>
          <div className="flex gap-2">
            <BentoCard artwork={slot(4)} heightClass="h-44 flex-1"   isLiked={likes.has(slot(4)?.id ?? -1)} onToggleLike={handleToggleLike} />
            <BentoCard artwork={slot(5)} heightClass="h-44 flex-1"   isLiked={likes.has(slot(5)?.id ?? -1)} onToggleLike={handleToggleLike} />
          </div>
        </div>
      )}

      {/* Category Tags */}
      <div className="pl-4 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pr-4 w-max">
          {CATEGORY_CONFIG.map((cat, idx) => (
            <button
              key={cat.label}
              onClick={() => setActiveCat(idx)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeCat === idx
                  ? "bg-white/10 text-white shadow-[0_0_12px_rgba(255,255,255,0.12)]"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/8"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Creators */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-white tracking-wide">推薦創作者</h2>
          <button className="text-xs text-white flex items-center gap-0.5">
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
                className="flex items-center justify-between p-3 bg-white/4 backdrop-blur-md border border-white/6 rounded-2xl hover:bg-white/8 transition-colors cursor-pointer"
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
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!user) { navigate("/login"); return; }
                    const convId = await getOrCreateConversation(user.id, creator.userId);
                    if (convId) navigate(`/chat/${convId}`);
                  }}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-gray-200 hover:bg-white/14 transition-colors shrink-0 ml-2"
                >
                  聊聊
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * BentoCard
 * ───────────────────────────────────────────────────────────────────────── */
function BentoCard({
  artwork,
  heightClass,
  isLiked,
  onToggleLike,
}: {
  artwork: Artwork | undefined;
  heightClass: string;
  isLiked: boolean;
  onToggleLike: (id: number, e: React.MouseEvent) => void;
}) {
  const navigate = useNavigate();

  if (!artwork) {
    return (
      <div className={`relative ${heightClass} rounded-[20px] overflow-hidden bg-white/5 border border-white/8 flex items-center justify-center`}>
        <ImageOff size={20} className="text-gray-700" />
      </div>
    );
  }

  return (
    <div
      className={`relative ${heightClass} rounded-[20px] overflow-hidden cursor-pointer group bg-white/5`}
      onClick={() => navigate(`/artwork/${artwork.id}`)}
    >
      {artwork.cover_image_url ? (
        <img
          src={artwork.cover_image_url}
          alt={artwork.title ?? ""}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <ImageOff size={20} className="text-gray-700" />
        </div>
      )}

      {/* 漸層 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* 左下：標題 pill（全部卡片都有）*/}
      {artwork.title && (
        <div className="absolute bottom-2.5 left-2.5">
          <span className="text-[10px] text-gray-200 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 max-w-[100px] truncate block">
            {artwork.title}
          </span>
        </div>
      )}

      {/* 右上：愛心按鈕（全部卡片都有）*/}
      <button
        onClick={(e) => onToggleLike(artwork.id, e)}
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center transition-transform active:scale-90"
      >
        <Heart
          size={13}
          className={isLiked ? "text-red-400 fill-red-400" : "text-white"}
        />
      </button>
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
    <div className="absolute inset-0 z-50 bg-[#141414] flex flex-col">
      {/* Search bar */}
      <div className="flex items-center gap-3 px-4 pt-14 pb-3 border-b border-white/6">
        <div className="flex-1 flex items-center bg-white/8 border border-white/12 rounded-full px-4 h-11">
          <Search size={15} className="text-gray-500 mr-2 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="搜尋作品或創作者..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
          />
          {query && (
            <button onClick={() => onQueryChange("")}>
              <X size={14} className="text-gray-500" />
            </button>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 text-sm shrink-0">
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
            <div className="grid grid-cols-2 gap-2">
              {artworks.map((a) => (
                <button
                  key={a.id}
                  onClick={() => onArtworkClick(a.id)}
                  className="relative aspect-square rounded-xl overflow-hidden bg-white/5"
                >
                  {a.cover_image_url ? (
                    <img src={a.cover_image_url} alt={a.title ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageOff size={16} className="text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <p className="absolute bottom-2 left-2 right-2 text-white text-[10px] font-medium truncate text-left">
                    {a.title}
                  </p>
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
    <div className="px-3 mb-4 animate-pulse">
      <div className="flex gap-2 mb-2">
        <div className="flex flex-col gap-2 flex-[3]">
          <div className="h-44 rounded-[20px] bg-white/5" />
          <div className="h-36 rounded-[20px] bg-white/5" />
        </div>
        <div className="flex-[2]">
          <div className="h-[21.5rem] rounded-[20px] bg-white/5" />
        </div>
      </div>
      <div className="h-36 rounded-[20px] bg-white/5 mb-2" />
      <div className="flex gap-2">
        <div className="flex-1 h-44 rounded-[20px] bg-white/5" />
        <div className="flex-1 h-44 rounded-[20px] bg-white/5" />
      </div>
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
