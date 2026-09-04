import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, BriefcaseBusiness, CalendarClock, Heart, UserPlus } from "lucide-react";
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
    }
  | {
      id: string;
      type: "commission";
      commissionId: number;
      role: "received" | "sent";
      counterpartName: string;
      avatar_url: string | null;
      orgName: string;
      status: "pending" | "accepted" | "rejected" | "in_progress" | "delivered" | "completed";
      created_at: string;
    }
  | {
      id: string;
      type: "deadline";
      commissionId: number;
      role: "received" | "sent";
      counterpartName: string;
      avatar_url: string | null;
      orgName: string;
      deadlineKind: "初稿期限" | "最終交件日";
      daysUntil: number;
      created_at: string;
    };

const commissionStatusText: Record<Extract<NotifItem, { type: "commission" }>["status"], string> = {
  pending: "等待回覆",
  accepted: "已接受你的委託",
  rejected: "婉拒了你的委託",
  in_progress: "已開始進行",
  delivered: "已完成交件",
  completed: "訂單已完成",
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  function handleBack() {
    const historyIndex = Number(window.history.state?.idx ?? 0);
    if (historyIndex > 0) navigate(-1);
    else navigate("/", { replace: true });
  }

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

      const [followsRes, likesRes, receivedCommissionsRes, sentCommissionsRes] = await Promise.all([
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

        ap?.id
          ? supabase
              .from("commission_requests")
              .select("id, client_id, artist_id, org_name, title, status, draft_due_date, final_due_date, created_at, updated_at, client:users!commission_requests_client_id_fkey(id, username, name, avatar_url)")
              .eq("artist_id", ap.id)
              .order("created_at", { ascending: false })
              .limit(30)
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from("commission_requests")
          .select("id, client_id, artist_id, org_name, title, status, draft_due_date, final_due_date, created_at, updated_at, artist:artist_profiles!commission_requests_artist_id_fkey(id, users!artist_profiles_user_id_fkey(id, username, name, avatar_url))")
          .eq("client_id", user!.id)
          .order("updated_at", { ascending: false })
          .limit(30),
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

      (receivedCommissionsRes.data ?? []).forEach((commission: any) => {
        const client = commission.client;
        notifs.push({
          id: `commission-received-${commission.id}`,
          type: "commission",
          commissionId: commission.id,
          role: "received",
          counterpartName: client?.name ?? client?.username ?? "委託人",
          avatar_url: client?.avatar_url ?? null,
          orgName: commission.org_name ?? commission.title ?? "未命名委託",
          status: commission.status,
          created_at: commission.created_at,
        });
      });

      (sentCommissionsRes.data ?? [])
        .filter((commission: any) => commission.status !== "pending")
        .forEach((commission: any) => {
          const artistUser = commission.artist?.users;
          notifs.push({
            id: `commission-sent-${commission.id}-${commission.status}`,
            type: "commission",
            commissionId: commission.id,
            role: "sent",
            counterpartName: artistUser?.name ?? artistUser?.username ?? "創作者",
            avatar_url: artistUser?.avatar_url ?? null,
            orgName: commission.org_name ?? commission.title ?? "未命名委託",
            status: commission.status,
            created_at: commission.updated_at ?? commission.created_at,
          });
        });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const deadlineRows = [
        ...(receivedCommissionsRes.data ?? []).map((commission: any) => ({ commission, role: "received" as const, person: commission.client })),
        ...(sentCommissionsRes.data ?? []).map((commission: any) => ({ commission, role: "sent" as const, person: commission.artist?.users })),
      ];

      deadlineRows.forEach(({ commission, role, person }) => {
        if (commission.status !== "accepted" && commission.status !== "in_progress") return;
        const deadlines = [
          { kind: "初稿期限" as const, value: commission.draft_due_date },
          { kind: "最終交件日" as const, value: commission.final_due_date },
        ];
        deadlines.forEach(({ kind, value }) => {
          if (!value) return;
          const [year, month, day] = value.split("-").map(Number);
          const dueDate = new Date(year, month - 1, day);
          const daysUntil = Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
          if (daysUntil < 0 || daysUntil > 7) return;
          notifs.push({
            id: `deadline-${commission.id}-${kind}`,
            type: "deadline",
            commissionId: commission.id,
            role,
            counterpartName: person?.name ?? person?.username ?? (role === "received" ? "委託人" : "創作者"),
            avatar_url: person?.avatar_url ?? null,
            orgName: commission.org_name ?? commission.title ?? "未命名委託",
            deadlineKind: kind,
            daysUntil,
            created_at: new Date().toISOString(),
          });
        });
      });

      notifs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(notifs);
      setLoading(false);
    }

    load();
  }, [user]);

  return (
    <div className="flex min-h-[70vh] flex-col rounded-2xl bg-[#141414] lg:min-h-[76vh]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4 pt-5">
        <button
          type="button"
          onClick={handleBack}
          aria-label="返回上一頁"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/12 text-white/75 transition-colors hover:bg-white/8 hover:text-white active:scale-95"
        >
          <ArrowLeft size={19} />
        </button>
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
            const displayName = item.type === "commission" || item.type === "deadline" ? item.counterpartName : item.name || item.username || "用戶";

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.type === "commission" || item.type === "deadline") navigate(`/orders?view=${item.role}`);
                  else if (item.type === "like") navigate(`/artwork/${item.artworkId}`);
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
                  <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#141414] ${
                    item.type === "follow" ? "bg-white" : item.type === "deadline" ? "bg-amber-500" : item.type === "commission" ? "bg-sky-500" : "bg-red-500"
                  }`}>
                    {item.type === "deadline"
                      ? <CalendarClock size={10} className="text-white" />
                      : item.type === "commission"
                      ? <BriefcaseBusiness size={10} className="text-white" />
                      : item.type === "follow"
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
                    {item.type === "commission" && item.role === "received" && (
                      <><span className="text-gray-400"> 向你送出新委託</span><span className="text-white">《{item.orgName}》</span></>
                    )}
                    {item.type === "commission" && item.role === "sent" && (
                      <><span className="text-gray-400"> 對</span><span className="text-white">《{item.orgName}》</span><span className="text-gray-400">{commissionStatusText[item.status]}</span></>
                    )}
                    {item.type === "deadline" && (
                      <><span className="text-gray-400">《{item.orgName}》的{item.deadlineKind}</span><span className="text-amber-200">{item.daysUntil === 0 ? "今天到期" : `剩下 ${item.daysUntil} 天`}</span></>
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
