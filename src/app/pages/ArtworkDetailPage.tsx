import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ChevronLeft, ChevronRight, Heart, Bookmark, ImageOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

interface ArtworkDetail {
  id: number;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  artist_id: number;
  created_at: string;
}

interface ArtworkMediaItem {
  id: number;
  media_url: string | null;
}

interface CreatorInfo {
  userId: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface MoreArtwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

export function ArtworkDetailPage() {
  const { id }    = useParams<{ id: string }>();
  const navigate  = useNavigate();
  const { user }  = useAuth();

  const [artwork,      setArtwork]      = useState<ArtworkDetail | null>(null);
  const [media,        setMedia]        = useState<ArtworkMediaItem[]>([]);
  const [activeImage,  setActiveImage]  = useState(0);
  const [creator,      setCreator]      = useState<CreatorInfo | null>(null);
  const [moreArtworks, setMoreArtworks] = useState<MoreArtwork[]>([]);
  const [isLiked,      setIsLiked]      = useState(false);
  const [isSaved,      setIsSaved]      = useState(false);
  const [loading,      setLoading]      = useState(true);
  const [notFound,     setNotFound]     = useState(false);

  useEffect(() => {
    if (!id) return;

    (async () => {
      const { data: aw, error } = await supabase
        .from("artworks")
        .select("id, title, description, cover_image_url, artist_id, created_at")
        .eq("id", id)
        .eq("status", "published")
        .is("deleted_at", null)
        .single();

      if (error || !aw) { setNotFound(true); setLoading(false); return; }
      setArtwork(aw);
      setActiveImage(0);

      const [apRes, moreRes, likeRes, saveRes, mediaRes] = await Promise.all([
        // 創作者
        supabase
          .from("artist_profiles")
          .select("user_id, users:user_id(username, name, avatar_url)")
          .eq("id", aw.artist_id)
          .single(),

        // 同創作者其他作品
        supabase
          .from("artworks")
          .select("id, title, cover_image_url")
          .eq("artist_id", aw.artist_id)
          .eq("status", "published")
          .is("deleted_at", null)
          .neq("id", aw.id)
          .order("created_at", { ascending: false })
          .limit(8),

        // 按讚狀態
        user
          ? supabase
              .from("likes")
              .select("artwork_id")
              .eq("user_id", user.id)
              .eq("artwork_id", aw.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),

        // 收藏狀態
        user
          ? supabase
              .from("saves")
              .select("artwork_id")
              .eq("user_id", user.id)
              .eq("artwork_id", aw.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),

        // 所有圖片（按上傳順序）
        supabase
          .from("artwork_media")
          .select("id, media_url")
          .eq("artwork_id", aw.id)
          .order("sort_order", { ascending: true }),
      ]);

      if (apRes.data?.users) {
        setCreator({
          userId:   apRes.data.user_id,
          username: (apRes.data.users as any).username,
          name:     (apRes.data.users as any).name,
          avatar_url: (apRes.data.users as any).avatar_url,
        });
      }
      setMoreArtworks(moreRes.data ?? []);
      setIsLiked(!!(likeRes as any).data);
      setIsSaved(!!(saveRes as any).data);
      // 舊資料可能沒有 artwork_media，退回只顯示封面圖
      setMedia(mediaRes.data?.length ? mediaRes.data : aw.cover_image_url ? [{ id: 0, media_url: aw.cover_image_url }] : []);
      setLoading(false);
    })();
  }, [id, user]);

  const galleryRef = useRef<HTMLDivElement>(null);

  function goToImage(index: number) {
    const clamped = Math.max(0, Math.min(media.length - 1, index));
    setActiveImage(clamped);
    const el = galleryRef.current;
    if (el) el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  // 電腦版可以用左右鍵切換圖片
  useEffect(() => {
    if (media.length < 2) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") goToImage(activeImage - 1);
      else if (e.key === "ArrowRight") goToImage(activeImage + 1);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [media.length, activeImage]);

  async function handleToggleLike() {
    if (!user) { navigate("/login"); return; }
    if (!artwork) return;
    if (isLiked) {
      await supabase.from("likes").delete().eq("user_id", user.id).eq("artwork_id", artwork.id);
      setIsLiked(false);
    } else {
      await supabase.from("likes").insert({ user_id: user.id, artwork_id: artwork.id });
      setIsLiked(true);
    }
  }

  async function handleToggleSave() {
    if (!user) { navigate("/login"); return; }
    if (!artwork) return;
    if (isSaved) {
      await supabase.from("saves").delete().eq("user_id", user.id).eq("artwork_id", artwork.id);
      setIsSaved(false);
    } else {
      await supabase.from("saves").insert({ user_id: user.id, artwork_id: artwork.id });
      setIsSaved(true);
    }
  }

  const dateStr = artwork?.created_at
    ? new Date(artwork.created_at)
        .toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })
        .replace(/\//g, ".")
    : "";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="animate-pulse bg-black pb-10">
        <div className="flex justify-between px-5 pb-3 pt-6">
          <div className="w-6 h-6 bg-white/10 rounded" />
          <div className="w-20 h-4 bg-white/10 rounded" />
        </div>
        <div className="bg-white/10" style={{ height: 420 }} />
        <div className="px-5 pt-5 space-y-3">
          <div className="h-7 w-2/3 bg-white/10 rounded-xl mx-auto" />
          <div className="h-4 w-1/4 bg-white/8 rounded-xl mx-auto" />
          <div className="h-4 w-full bg-white/8 rounded-xl mt-4" />
          <div className="h-4 w-4/5 bg-white/8 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (notFound || !artwork) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 bg-black">
        <ImageOff size={36} className="text-white/20" />
        <p className="text-gray-500 text-sm">找不到這件作品</p>
        <button onClick={() => navigate(-1)} className="text-[#FFFFFF] text-sm underline underline-offset-2">
          返回上一頁
        </button>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-black pb-10">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <button onClick={() => navigate(-1)} className="text-white hover:text-white/70 transition-colors">
          <ArrowLeft size={24} strokeWidth={1.8} />
        </button>
        {dateStr && <span className="text-white/40 text-xs tracking-widest">{dateStr}</span>}
      </div>

      {/* 圖片輪播 — 全寬無 padding，多張可左右滑動 */}
      <div className="relative">
        {media.length > 0 ? (
          <>
            <div
              ref={galleryRef}
              className="flex w-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={(e) => {
                const el = e.currentTarget;
                setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
              }}
            >
              {media.map((item) => (
                <img
                  key={item.id}
                  src={item.media_url ?? ""}
                  alt={artwork.title ?? ""}
                  className="w-full shrink-0 snap-center object-cover"
                />
              ))}
            </div>
            {media.length > 1 && (
              <>
                <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                  {activeImage + 1} / {media.length}
                </span>
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                  {media.map((item, index) => (
                    <span
                      key={item.id}
                      className={`h-1.5 rounded-full transition-all ${index === activeImage ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
                    />
                  ))}
                </div>
                {/* 電腦版左右箭頭，手機用滑的就好 */}
                {activeImage > 0 && (
                  <button
                    onClick={() => goToImage(activeImage - 1)}
                    aria-label="上一張"
                    className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/75 lg:flex"
                  >
                    <ChevronLeft size={22} />
                  </button>
                )}
                {activeImage < media.length - 1 && (
                  <button
                    onClick={() => goToImage(activeImage + 1)}
                    aria-label="下一張"
                    className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/75 lg:flex"
                  >
                    <ChevronRight size={22} />
                  </button>
                )}
              </>
            )}
          </>
        ) : (
          <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
            <ImageOff size={40} className="text-white/20" />
          </div>
        )}
      </div>

      {/* Info — 黑底白字，置中 */}
      <div className="px-6 pt-6 pb-2">

        {/* Title + actions */}
        <div className="flex items-start mb-2">
          <div className="w-[76px] flex-shrink-0" />
          <h1
            className="flex-1 text-center text-3xl font-bold text-white leading-snug"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {artwork.title ?? "未命名作品"}
          </h1>
          <div className="mt-1 flex w-[76px] flex-shrink-0 justify-end gap-3">
            <button onClick={handleToggleLike} className="active:scale-90 transition-transform" aria-label={isLiked ? "取消喜愛" : "加入喜愛"}>
              <Heart size={25} strokeWidth={1.6} className={`transition-colors ${isLiked ? "fill-white text-white" : "text-white/30 hover:text-white"}`} />
            </button>
            <button onClick={handleToggleSave} className="active:scale-90 transition-transform" aria-label={isSaved ? "取消收藏" : "收藏作品"}>
              <Bookmark size={25} strokeWidth={1.6} className={`transition-colors ${isSaved ? "fill-white text-white" : "text-white/30 hover:text-white"}`} />
            </button>
          </div>
        </div>

        {/* Author — 置中，可點擊 */}
        {creator && (
          <button
            onClick={() => creator.username && navigate(`/creator/${creator.username}`)}
            className="w-full text-center mb-5 group"
          >
            <span className="text-white/50 text-sm tracking-widest uppercase group-hover:text-white transition-colors">
              {creator.name ?? creator.username ?? "創作者"}
            </span>
          </button>
        )}

        {/* Description — 置中 */}
        {artwork.description && (
          <p className="text-white/60 text-sm leading-relaxed text-center mb-8">
            {artwork.description}
          </p>
        )}

        {/* Find more */}
        {moreArtworks.length > 0 && (
          <div>
            <p
              className="text-white font-bold text-xl mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >Find more</p>
            <div className="columns-2 gap-3">
              {moreArtworks.map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/artwork/${a.id}`)}
                  className="break-inside-avoid mb-3 w-full rounded-xl overflow-hidden block active:opacity-80 transition-opacity"
                >
                  {a.cover_image_url ? (
                    <img
                      src={a.cover_image_url}
                      alt={a.title ?? ""}
                      className="w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
                      <ImageOff size={20} className="text-white/20" />
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
