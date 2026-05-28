import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Heart, ImageOff } from "lucide-react";
import { supabase } from "../../lib/supabase";

interface CreatorProfile {
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  artistId: number;
  joinedYear: string;
}

interface Artwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

export function CreatorProfilePage() {
  const { id: usernameParam } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!usernameParam) return;

    (async () => {
      // 1. username 找 user
      const { data: user } = await supabase
        .from("users")
        .select("id, username, name, bio, avatar_url, created_at")
        .eq("username", usernameParam)
        .is("deleted_at", null)
        .single();

      if (!user) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 2. user → artist_profile
      const { data: ap } = await supabase
        .from("artist_profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!ap) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile({
        username: user.username,
        name: user.name,
        bio: user.bio,
        avatar_url: user.avatar_url,
        artistId: ap.id,
        joinedYear: new Date(user.created_at).getFullYear().toString(),
      });

      // 3. 撈作品集
      const { data: works } = await supabase
        .from("artworks")
        .select("id, title, cover_image_url")
        .eq("artist_id", ap.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(12);

      setArtworks(works ?? []);
      setLoading(false);
    })();
  }, [usernameParam]);

  if (loading) {
    return (
      <div className="h-full bg-black overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden animate-pulse">
        <div className="px-6 pt-12 pb-6">
          <div className="w-10 h-10 rounded-full bg-white/8 mb-6" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-24 h-24 rounded-full bg-white/8" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-32 bg-white/8 rounded-xl" />
              <div className="h-4 w-48 bg-white/6 rounded-xl" />
            </div>
          </div>
          <div className="h-4 w-full bg-white/6 rounded-xl mb-2" />
          <div className="h-4 w-2/3 bg-white/6 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="h-full bg-black flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400 text-sm">找不到這位創作者</p>
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
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-black">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all mb-6"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>

        {/* Avatar + 名字 */}
        <div className="flex items-center gap-4 mb-5">
          <ProfileAvatar url={profile.avatar_url} name={profile.name} />
          <div className="flex-1">
            <h1 className="text-white text-2xl font-bold mb-0.5">
              {profile.name ?? profile.username ?? "創作者"}
            </h1>
            {profile.username && (
              <p className="text-gray-500 text-sm">@{profile.username}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">加入於 {profile.joinedYear}</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-300 text-sm leading-relaxed mb-5">{profile.bio}</p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/create")}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-pink-400/80 via-fuchsia-400/70 to-pink-300/80 backdrop-blur-xl text-white font-semibold hover:opacity-90 transition-opacity shadow-[inset_0_2px_8px_rgba(255,255,255,0.4),0_4px_16px_rgba(236,72,153,0.5)] border border-white/30"
          >
            委託創作
          </button>
          <button className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center hover:bg-white/15 transition-all">
            <Heart size={20} className="text-white" />
          </button>
        </div>
      </div>

      {/* 作品集 */}
      <div className="px-6">
        <h2 className="text-white text-lg font-bold mb-4">
          作品集
          {artworks.length > 0 && (
            <span className="text-gray-500 text-sm font-normal ml-2">
              {artworks.length} 件
            </span>
          )}
        </h2>

        {artworks.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <ImageOff size={28} className="text-gray-600" />
            <p className="text-gray-500 text-sm">尚無公開作品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {artworks.map((artwork) => (
              <button
                key={artwork.id}
                onClick={() => navigate(`/artwork/${artwork.id}`)}
                className="relative aspect-square rounded-2xl overflow-hidden group bg-white/5"
              >
                {artwork.cover_image_url ? (
                  <img
                    src={artwork.cover_image_url}
                    alt={artwork.title ?? ""}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff size={20} className="text-gray-600" />
                  </div>
                )}
                {artwork.title && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium truncate">
                      {artwork.title}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileAvatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "creator"}
        className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shrink-0"
      />
    );
  }
  return (
    <div className="w-24 h-24 rounded-full bg-purple-900 border-4 border-white/20 flex items-center justify-center shrink-0">
      <span className="text-white/70 text-3xl font-bold">
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}
