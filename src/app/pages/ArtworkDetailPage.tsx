import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ImageOff, UserCircle2 } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface ArtworkDetail {
  id: number;
  title: string | null;
  description: string | null;
  cover_image_url: string | null;
  artist_id: number;
}

interface CreatorInfo {
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export function ArtworkDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [artwork, setArtwork] = useState<ArtworkDetail | null>(null);
  const [creator, setCreator] = useState<CreatorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    supabase
      .from("artworks")
      .select("id, title, description, cover_image_url, artist_id")
      .eq("id", id)
      .eq("status", "published")
      .is("deleted_at", null)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setArtwork(data);

        // 撈創作者資訊
        const { data: ap } = await supabase
          .from("artist_profiles")
          .select("users:user_id ( username, name, bio, avatar_url )")
          .eq("id", data.artist_id)
          .single();

        if (ap?.users) {
          setCreator(ap.users as CreatorInfo);
        }
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="h-full bg-black overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden">
        <div className="animate-pulse">
          <div className="w-full aspect-square bg-white/8" />
          <div className="px-5 pt-5 space-y-3">
            <div className="h-7 w-2/3 bg-white/8 rounded-xl" />
            <div className="h-4 w-full bg-white/6 rounded-xl" />
            <div className="h-4 w-4/5 bg-white/6 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !artwork) {
    return (
      <div className="h-full bg-black flex flex-col items-center justify-center gap-4">
        <ImageOff size={36} className="text-gray-600" />
        <p className="text-gray-400 text-sm">找不到這件作品</p>
        <button
          onClick={() => navigate(-1)}
          className="text-fuchsia-400 text-sm underline underline-offset-2"
        >
          返回上一頁
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-black overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden">
      {/* 返回按鈕 (浮在圖片上) */}
      <div className="relative">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-12 left-4 z-10 w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>

        {/* 封面大圖 */}
        {artwork.cover_image_url ? (
          <img
            src={artwork.cover_image_url}
            alt={artwork.title ?? ""}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="w-full aspect-square bg-white/5 flex items-center justify-center">
            <ImageOff size={40} className="text-gray-600" />
          </div>
        )}

        {/* 圖片底部漸層 */}
        <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-black to-transparent" />
      </div>

      {/* 內容區 */}
      <div className="px-5 pt-4 space-y-5">
        {/* 標題 */}
        <h1 className="text-white text-2xl font-bold leading-snug">
          {artwork.title ?? "未命名作品"}
        </h1>

        {/* 描述 */}
        {artwork.description && (
          <p className="text-gray-400 text-sm leading-relaxed">
            {artwork.description}
          </p>
        )}

        {/* 分隔線 */}
        <div className="h-px bg-white/8" />

        {/* 創作者卡片 */}
        {creator && (
          <button
            onClick={() => creator.username && navigate(`/creator/${creator.username}`)}
            className="w-full flex items-center gap-3 p-4 bg-white/4 border border-white/8 rounded-2xl hover:bg-white/7 transition-colors text-left"
          >
            <CreatorAvatar url={creator.avatar_url} name={creator.name} />
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-medium truncate">
                {creator.name ?? creator.username ?? "創作者"}
              </p>
              {creator.bio && (
                <p className="text-gray-500 text-xs truncate mt-0.5">{creator.bio}</p>
              )}
            </div>
            <UserCircle2 size={16} className="text-gray-500 shrink-0" />
          </button>
        )}

        {/* 委託按鈕 */}
        <button
          onClick={() => navigate("/create")}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white font-semibold text-sm shadow-[0_0_20px_rgba(217,70,239,0.3)] hover:opacity-90 transition-opacity"
        >
          委託這位創作者
        </button>
      </div>
    </div>
  );
}

function CreatorAvatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "creator"}
        className="w-12 h-12 rounded-full object-cover border border-white/10 shrink-0"
      />
    );
  }
  return (
    <div className="w-12 h-12 rounded-full bg-purple-900 border border-white/10 flex items-center justify-center shrink-0">
      <span className="text-white/70 text-base font-bold">
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}
