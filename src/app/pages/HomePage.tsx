import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, Bell, Heart, ChevronRight, ImageOff } from "lucide-react";
import { supabase } from "../../lib/supabase";

const categories = ["熱門推薦", "個人化推薦", "角色委託", "品牌視覺", "客製刺青", "校園創作者"];

interface Artwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

interface Creator {
  id: number;          // artist_profiles.id
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export function HomePage() {
  const [activeCat, setActiveCat] = useState(0);
  const navigate = useNavigate();

  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingArtworks, setLoadingArtworks] = useState(true);
  const [loadingCreators, setLoadingCreators] = useState(true);

  useEffect(() => {
    supabase
      .from("artworks")
      .select("id, title, cover_image_url")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setArtworks(data ?? []);
        setLoadingArtworks(false);
      });

    supabase
      .from("artist_profiles")
      .select("id, users:user_id ( username, name, bio, avatar_url )")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        const mapped: Creator[] = (data ?? [])
          // 過濾掉 user 已被軟刪除 / 不存在的
          .filter((row: any) => row.users)
          .map((row: any) => ({
            id: row.id,
            username: row.users.username,
            name: row.users.name,
            bio: row.users.bio,
            avatar_url: row.users.avatar_url,
          }))
          .slice(0, 3);
        setCreators(mapped);
        setLoadingCreators(false);
      });
  }, []);

  // 把作品依 bento 位置取出（不足就回傳 undefined，渲染時顯示佔位）
  const slot = (i: number): Artwork | undefined => artworks[i];

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#0a0a0f]">
      {/* Top area: search button */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <button className="flex items-center justify-center w-11 h-11 bg-white/8 backdrop-blur-md border border-white/12 rounded-full hover:bg-white/14 transition-colors">
          <Search size={18} className="text-gray-300" />
        </button>
        <button className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors">
          <Bell size={17} className="text-white" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-[#0a0a0f] bg-blue-400" />
        </button>
      </div>

      {/* Bento Grid */}
      {loadingArtworks ? (
        <BentoSkeleton />
      ) : artworks.length === 0 ? (
        <BentoEmpty />
      ) : (
        <div className="px-3 mb-4">
          {/* Row 1 + Row 2: Left stacked, Right tall */}
          <div className="flex gap-2 mb-2">
            {/* Left column: 2 stacked cards */}
            <div className="flex flex-col gap-2 flex-[3]">
              <BentoCard artwork={slot(0)} heightClass="h-44" showHeart />
              <BentoCard artwork={slot(2)} heightClass="h-36" />
            </div>

            {/* Right column: 1 tall card */}
            <div className="flex-[2]">
              <BentoCard artwork={slot(1)} heightClass="h-[21.5rem]" showHeart />
            </div>
          </div>

          {/* Row 3: Wide panoramic card */}
          <div className="mb-2">
            <BentoCard artwork={slot(3)} heightClass="h-36" showHeart showTitle />
          </div>

          {/* Row 4: 2 equal cards */}
          <div className="flex gap-2">
            <BentoCard artwork={slot(4)} heightClass="h-44 flex-1" />
            <BentoCard artwork={slot(5)} heightClass="h-44 flex-1" showHeart />
          </div>
        </div>
      )}

      {/* Category Tags */}
      <div className="pl-4 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pr-4 w-max">
          {categories.map((cat, idx) => (
            <button
              key={cat}
              onClick={() => setActiveCat(idx)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeCat === idx
                  ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.3)]"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/8"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Top Creators */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-white tracking-wide">推薦創作者</h2>
          <button className="text-xs text-fuchsia-400 flex items-center gap-0.5">
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
                    <Avatar url={creator.avatar_url} name={creator.name} />
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0a0a0f] rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-white text-sm font-medium truncate block">
                      {creator.name ?? creator.username ?? "未命名"}
                    </span>
                    {creator.bio && (
                      <span className="text-gray-400 text-[11px] truncate block">
                        {creator.bio}
                      </span>
                    )}
                  </div>
                </div>
                <button className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-gray-200 hover:bg-white/14 transition-colors shrink-0 ml-2">
                  委託
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────── */

function BentoCard({
  artwork,
  heightClass,
  showHeart = false,
  showTitle = false,
}: {
  artwork: Artwork | undefined;
  heightClass: string;
  showHeart?: boolean;
  showTitle?: boolean;
}) {
  const navigate = useNavigate();

  if (!artwork) {
    return (
      <div
        className={`relative ${heightClass} rounded-[20px] overflow-hidden bg-white/5 border border-white/8 flex items-center justify-center`}
      >
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      {showTitle && artwork.title && (
        <div className="absolute bottom-3 left-4">
          <span className="text-[11px] text-white font-medium">{artwork.title}</span>
        </div>
      )}
      {showHeart && (
        <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <Heart size={13} className="text-white" />
        </button>
      )}
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

function BentoEmpty() {
  return (
    <div className="mx-3 mb-4 rounded-[20px] border border-dashed border-white/10 px-6 py-14 flex flex-col items-center gap-2">
      <ImageOff size={28} className="text-gray-600" />
      <p className="text-gray-400 text-sm">尚未有公開作品</p>
      <p className="text-gray-600 text-xs">創作者發佈第一件作品後會出現在這裡</p>
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

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "creator"}
        className="w-10 h-10 rounded-full object-cover border border-white/10"
      />
    );
  }
  return (
    <div className="w-10 h-10 rounded-full bg-purple-900 border border-white/10 flex items-center justify-center">
      <span className="text-white/70 text-sm font-bold">
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}
