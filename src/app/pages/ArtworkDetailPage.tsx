import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Heart, ImageOff } from "lucide-react";
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
  const [creator,      setCreator]      = useState<CreatorInfo | null>(null);
  const [moreArtworks, setMoreArtworks] = useState<MoreArtwork[]>([]);
  const [isLiked,      setIsLiked]      = useState(false);
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

      const [apRes, moreRes, likeRes] = await Promise.all([
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
      setLoading(false);
    })();
  }, [id, user]);

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

  const dateStr = artwork?.created_at
    ? new Date(artwork.created_at)
        .toLocaleDateString("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" })
        .replace(/\//g, ".")
    : "";

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full bg-white overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden animate-pulse">
        <div className="px-5 pt-12 pb-3 flex justify-between">
          <div className="w-6 h-6 bg-gray-100 rounded" />
          <div className="w-20 h-4 bg-gray-100 rounded" />
        </div>
        <div className="mx-4 rounded-2xl bg-gray-100" style={{ height: 420 }} />
        <div className="px-5 pt-5 space-y-3">
          <div className="h-7 w-2/3 bg-gray-100 rounded-xl" />
          <div className="h-4 w-1/4 bg-gray-100 rounded-xl" />
          <div className="h-4 w-full bg-gray-100 rounded-xl mt-4" />
          <div className="h-4 w-4/5 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (notFound || !artwork) {
    return (
      <div className="h-full bg-white flex flex-col items-center justify-center gap-4">
        <ImageOff size={36} className="text-gray-300" />
        <p className="text-gray-400 text-sm">找不到這件作品</p>
        <button onClick={() => navigate(-1)} className="text-pink-400 text-sm underline underline-offset-2">
          返回上一頁
        </button>
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <div className="h-full bg-white overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3">
        <button onClick={() => navigate(-1)} className="text-gray-900 hover:text-gray-600 transition-colors">
          <ArrowLeft size={24} strokeWidth={1.8} />
        </button>
        {dateStr && <span className="text-gray-400 text-xs tracking-wide">{dateStr}</span>}
      </div>

      {/* Cover image */}
      <div className="px-4">
        {artwork.cover_image_url ? (
          <img
            src={artwork.cover_image_url}
            alt={artwork.title ?? ""}
            className="w-full rounded-2xl object-cover"
          />
        ) : (
          <div className="w-full aspect-[4/5] rounded-2xl bg-gray-100 flex items-center justify-center">
            <ImageOff size={40} className="text-gray-300" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-5 pt-5 pb-2">

        {/* Title + heart */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="flex-1 text-2xl font-bold italic text-gray-900 leading-snug">
            {artwork.title ?? "未命名作品"}
          </h1>
          <button
            onClick={handleToggleLike}
            className="mt-1 flex-shrink-0 active:scale-90 transition-transform"
            aria-label={isLiked ? "取消喜愛" : "加入喜愛"}
          >
            <Heart
              size={28}
              strokeWidth={1.8}
              className={`transition-colors ${isLiked ? "text-red-400 fill-red-400" : "text-gray-300 hover:text-red-300"}`}
            />
          </button>
        </div>

        {/* Author */}
        {creator && (
          <button
            onClick={() => creator.username && navigate(`/creator/${creator.username}`)}
            className="flex items-center gap-2 mb-5 group"
          >
            {creator.avatar_url ? (
              <img
                src={creator.avatar_url}
                alt={creator.name ?? ""}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-purple-500 text-[10px] font-bold">
                  {creator.name?.[0]?.toUpperCase() ?? "?"}
                </span>
              </div>
            )}
            <span className="text-gray-500 text-sm group-hover:text-gray-900 transition-colors">
              {creator.name ?? creator.username ?? "創作者"}
            </span>
          </button>
        )}

        {/* Description */}
        {artwork.description && (
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            {artwork.description}
          </p>
        )}

        {/* Find more */}
        {moreArtworks.length > 0 && (
          <div className="mt-2">
            <p className="text-gray-900 text-sm font-semibold mb-3 tracking-wide">Find more</p>
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
                    <div className="w-full aspect-square bg-gray-100 flex items-center justify-center">
                      <ImageOff size={20} className="text-gray-300" />
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
