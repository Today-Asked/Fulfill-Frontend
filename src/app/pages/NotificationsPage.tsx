import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Heart, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { formatChatTime } from "../../lib/chat";

type NotifItem =
  | {
      id: string;
      type: "follow";
      userId: string;
      username: string | null;
      name: string | null;
      avatar_url: string | null;
      created_at: string;
    }
  | {
      id: string;
      type: "like";
      userId: string;
      username: string | null;
      name: string | null;
      avatar_url: string | null;
      artworkId: number;
      artworkTitle: string | null;
      created_at: string;
    };

export function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      // 我的 artist profile + artwork ids（for likes query）
      const { data: ap } = await supabase
        .from("artist_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      let myArtworkIds: number[] = [];
      if (ap?.id) {
        const { data: artworks } = await supabase
          .from("artworks")
          .select("id")
          .eq("artist_id", ap.id)
          .is("deleted_at", null);
        myArtworkIds = (artworks ?? []).map((a: any) => a.id);
      }

      const [followsRes, likesRes] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id, created_at, users:follower_id(id, username, name, avatar_url)")
          .eq("following_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(30),

        myArtworkIds.length > 0
          ? supabase
              .from("likes")
              .select("user_id, artwork_id, created_at, users:user_id(id, username, name, avatar_url), artworks(id, title)")
              .in("artwork_id", myArtworkIds)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const notifs: NotifItem[] = [];

      (followsRes.data ?? []).forEach((f: any) => {
        if (!f.users) return;
        notifs.push({
          id: `follow-${f.follower_id}-${f.created_at}`,
          type: "follow",
          userId: f.follower_id,
          username: f.users.username,
          name: f.users.name,
          avatar_url: f.users.avatar_url,
          created_at: f.created_at,
        });
      });

      (likesRes.data ?? []).forEach((l: any) => {
        if (!l.users) return;
        notifs.push({
          id: `like-${l.user_id}-${l.artwork_id}`,
          type: "like",
          userId: l.user_id,
          username: l.users.username,
          name: l.users.name,
          avatar_url: l.users.avatar_url,
          artworkId: l.artwork_id,
          artworkTitle: l.artworks?.title ?? null,
          created_at: l.created_at,
        });
      });

      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(notifs);
      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <h1 className="text-white font-semibold tracking-widest text-sm">NOTIFICATIONS</h1>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden pb-28">
        {loading ? (
          <p className="text-center text-gray-600 text-sm mt-8">載入中...</p>
        ) : items.length === 0 ? (
          <p className="text-center text-gray-600 text-sm mt-8">還沒有通知</p>
        ) : (
          items.map((item) => {
            const displayName = item.name || item.username || "用戶";

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === "like") navigate(`/artwork/${item.artworkId}`);
                  else if (item.username) navigate(`/creator/${item.username}`);
                }}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
              >
                {/* Avatar + type badge */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/15 bg-white/10 flex items-center justify-center">
                    {item.avatar_url ? (
                      <img src={item.avatar_url} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/40 text-lg font-medium">
                        {displayName[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0a0a0f] ${
                    item.type === "follow" ? "bg-fuchsia-500" : "bg-red-500"
                  }`}>
                    {item.type === "follow"
                      ? <UserPlus size={9} className="text-white" />
                      : <Heart size={9} className="text-white fill-white" />
                    }
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-snug">
                    <span className="font-medium">{displayName}</span>
                    {item.type === "follow" && (
                      <span className="text-gray-400"> 追蹤了你</span>
                    )}
                    {item.type === "like" && (
                      <>
                        <span className="text-gray-400"> 對</span>
                        <span className="text-white">《{item.artworkTitle || "你的作品"}》</span>
                        <span className="text-gray-400">按讚</span>
                      </>
                    )}
                  </p>
                  <p className="text-gray-600 text-[10px] mt-0.5">
                    {formatChatTime(item.created_at)}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
