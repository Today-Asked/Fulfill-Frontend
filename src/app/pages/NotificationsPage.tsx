import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, AtSign, BriefcaseBusiness, CalendarClock, Heart, MessageCircle, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { formatChatTime } from "../../lib/chat";
import {
  CommissionMilestone,
  CommissionStatus,
  NotificationRow,
  fetchNotifications,
  markAllNotificationsRead,
} from "../../lib/notifications";

// 截止日提醒是「時間到了」而不是某個事件，所以不在 notifications 表裡，
// 每次進來依進行中的委託現算。
interface DeadlineItem {
  id: string;
  commissionId: number;
  role: "received" | "sent";
  counterpartName: string;
  avatar_url: string | null;
  orgName: string;
  deadlineKind: "初稿期限" | "最終交件日";
  daysUntil: number;
}

type DisplayItem =
  | { kind: "notification"; key: string; createdAt: string; row: NotificationRow }
  | { kind: "deadline"; key: string; createdAt: string; item: DeadlineItem };

// 委託人收到：創作者對委託做了什麼
const clientSideStatusText: Record<CommissionStatus, string> = {
  pending: "等待回覆",
  accepted: "已接受你的委託",
  rejected: "婉拒了你的委託",
  in_progress: "已開始進行",
  delivered: "已完成委託",
  completed: "訂單已完成",
};

// 交付 / 確認里程碑 — 交付是創作者通知委託人，確認是委託人通知創作者
const milestoneText: Record<CommissionMilestone, string> = {
  draft_delivered: "交付了初稿",
  draft_confirmed: "確認了初稿",
  final_delivered: "交付了完稿",
  final_confirmed: "確認完稿並結案",
};

// 創作者收到：委託人改了委託狀態（目前只有確認完成）
const artistSideStatusText: Record<CommissionStatus, string> = {
  pending: "等待回覆",
  accepted: "已接受",
  rejected: "已婉拒",
  in_progress: "進行中",
  delivered: "已交件",
  completed: "已完成",
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<DisplayItem[]>([]);
  const [loading, setLoading] = useState(true);

  function handleBack() {
    const historyIndex = Number(window.history.state?.idx ?? 0);
    if (historyIndex > 0) navigate(-1);
    else navigate("/", { replace: true });
  }

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: ap } = await supabase
        .from("artist_profiles")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();

      const commissionSelect = "id, org_name, title, draft_due_date, final_due_date";
      const [rows, receivedRes, sentRes] = await Promise.all([
        fetchNotifications(user!.id).catch((err) => { console.error(err); return [] as NotificationRow[]; }),

        ap?.id
          ? supabase
              .from("commission_requests")
              .select(`${commissionSelect}, client:users!commission_requests_client_id_fkey(username, name, avatar_url)`)
              .eq("artist_id", ap.id)
              .in("status", ["accepted", "in_progress"])
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from("commission_requests")
          .select(`${commissionSelect}, artist:artist_profiles!commission_requests_artist_id_fkey(users!artist_profiles_user_id_fkey(username, name, avatar_url))`)
          .eq("client_id", user!.id)
          .in("status", ["accepted", "in_progress"]),
      ]);

      const display: DisplayItem[] = rows
        // 對方帳號被刪除（或軟刪除）就不顯示
        .filter((row) => row.actor)
        .map((row) => ({ kind: "notification", key: `n-${row.id}`, createdAt: row.createdAt, row }));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const now = new Date().toISOString();
      const deadlineRows = [
        ...(receivedRes.data ?? []).map((commission: any) => ({ commission, role: "received" as const, person: commission.client })),
        ...(sentRes.data ?? []).map((commission: any) => ({ commission, role: "sent" as const, person: commission.artist?.users })),
      ];

      deadlineRows.forEach(({ commission, role, person }) => {
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
          display.push({
            kind: "deadline",
            key: `deadline-${commission.id}-${kind}`,
            createdAt: now,
            item: {
              id: `deadline-${commission.id}-${kind}`,
              commissionId: commission.id,
              role,
              counterpartName: person?.name ?? person?.username ?? (role === "received" ? "委託人" : "創作者"),
              avatar_url: person?.avatar_url ?? null,
              orgName: commission.org_name ?? commission.title ?? "未命名委託",
              deadlineKind: kind,
              daysUntil,
            },
          });
        });
      });

      display.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setItems(display);
      setLoading(false);

      // 進來看過就全部算已讀；這次畫面上仍保留未讀的底色，讓使用者知道哪些是新的
      if (rows.some((row) => !row.readAt)) {
        markAllNotificationsRead(user!.id).catch(console.error);
      }
    }

    load();
  }, [user]);

  function handleClick(entry: DisplayItem) {
    if (entry.kind === "deadline") {
      navigate(`/orders?view=${entry.item.role}`);
      return;
    }
    const row = entry.row;
    if (row.commissionId) navigate(`/orders?view=${row.commissionRole ?? "received"}`);
    else if (row.artworkId) navigate(`/artwork/${row.artworkId}`);
    else if (row.actor?.username) navigate(`/creator/${row.actor.username}`);
  }

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
          items.map((entry) => {
            const unread = entry.kind === "notification" && !entry.row.readAt;
            const displayName =
              entry.kind === "deadline"
                ? entry.item.counterpartName
                : entry.row.actor?.name || entry.row.actor?.username || "用戶";
            const avatarUrl = entry.kind === "deadline" ? entry.item.avatar_url : entry.row.actor?.avatarUrl ?? null;
            const type = entry.kind === "deadline" ? "deadline" : entry.row.type;

            return (
              <button
                key={entry.key}
                onClick={() => handleClick(entry)}
                className={`w-full flex items-center gap-4 px-5 py-4 transition-colors text-left ${
                  unread ? "bg-white/[0.05] hover:bg-white/8" : "hover:bg-white/4"
                }`}
              >
                {/* Avatar + type badge */}
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-white/15 bg-white/10 flex items-center justify-center">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white/40 text-lg font-medium">
                        {displayName[0]?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#141414] ${
                    type === "follow" ? "bg-white"
                    : type === "comment" ? "bg-emerald-500"
                    : type === "mention" ? "bg-fuchsia-500"
                    : type === "deadline" ? "bg-amber-500"
                    : type === "commission_received" || type === "commission_status" ? "bg-sky-500"
                    : "bg-red-500"
                  }`}>
                    {type === "deadline"
                      ? <CalendarClock size={10} className="text-white" />
                      : type === "commission_received" || type === "commission_status"
                      ? <BriefcaseBusiness size={10} className="text-white" />
                      : type === "follow"
                      ? <UserPlus size={9} className="text-white" />
                      : type === "comment"
                      ? <MessageCircle size={10} className="text-white" />
                      : type === "mention"
                      ? <AtSign size={10} className="text-white" />
                      : <Heart size={9} className="text-white fill-white" />
                    }
                  </div>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-snug">
                    <span className="font-medium">{displayName}</span>
                    {entry.kind === "deadline" ? (
                      <>
                        <span className="text-gray-400">《{entry.item.orgName}》的{entry.item.deadlineKind}</span>
                        <span className="text-amber-200">{entry.item.daysUntil === 0 ? "今天到期" : `剩下 ${entry.item.daysUntil} 天`}</span>
                      </>
                    ) : (
                      <NotificationText row={entry.row} />
                    )}
                  </p>
                  {entry.kind === "notification" && entry.row.commentPreview && (
                    <p className="mt-0.5 truncate text-xs text-gray-500">{entry.row.commentPreview}</p>
                  )}
                  <p className="text-gray-600 text-[10px] mt-0.5">
                    {entry.kind === "notification" ? formatChatTime(entry.row.createdAt) : "提醒"}
                  </p>
                </div>

                {unread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-paper" aria-label="未讀" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function NotificationText({ row }: { row: NotificationRow }) {
  const artwork = row.artworkTitle || "你的作品";
  const commission = row.commissionName ?? "委託";

  switch (row.type) {
    case "follow":
      return <span className="text-gray-400"> 追蹤了你</span>;
    case "like":
      return <><span className="text-gray-400"> 對</span><span className="text-white">《{artwork}》</span><span className="text-gray-400">按讚</span></>;
    case "comment":
      return <><span className="text-gray-400"> 在</span><span className="text-white">《{artwork}》</span><span className="text-gray-400">留言</span></>;
    case "mention":
      return <><span className="text-gray-400"> 在</span><span className="text-white">《{row.artworkTitle || "作品"}》</span><span className="text-gray-400">的留言提到你</span></>;
    case "comment_like":
      return <><span className="text-gray-400"> 喜歡你在</span><span className="text-white">《{row.artworkTitle || "作品"}》</span><span className="text-gray-400">的留言</span></>;
    case "commission_received":
      return <><span className="text-gray-400"> 向你送出新委託</span><span className="text-white">《{commission}》</span></>;
    case "commission_status":
      if (row.milestone) {
        return <><span className="text-gray-400"> {milestoneText[row.milestone]}</span><span className="text-white">《{commission}》</span></>;
      }
      if (!row.status) return null;
      return row.commissionRole === "sent"
        ? <><span className="text-gray-400">{clientSideStatusText[row.status]}</span><span className="text-white">《{commission}》</span></>
        : <><span className="text-gray-400"> 將</span><span className="text-white">《{commission}》</span><span className="text-gray-400">標記為{artistSideStatusText[row.status]}</span></>;
    default:
      return null;
  }
}
