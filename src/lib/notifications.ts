import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { supabase } from "./supabase";

/**
 * Notifications live in public.notifications, written by db triggers (see
 * migration 20261002000000_notifications.sql). The client only reads them
 * and sets read_at.
 */

export type NotificationType =
  | "follow"
  | "like"
  | "comment"
  | "mention"
  | "comment_like"
  | "commission_received"
  | "commission_status";

export type CommissionStatus = "pending" | "accepted" | "rejected" | "in_progress" | "delivered" | "completed";

export interface NotificationRow {
  id: number;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  actor: { id: string; username: string | null; name: string | null; avatarUrl: string | null } | null;
  artworkId: number | null;
  artworkTitle: string | null;
  commentPreview: string | null;
  commissionId: number | null;
  commissionName: string | null;
  /** 我是委託的哪一方 — 決定點了要去 /orders 的哪個分頁 */
  commissionRole: "received" | "sent" | null;
  status: CommissionStatus | null;
  milestone: CommissionMilestone | null;
}

export type CommissionMilestone = "draft_delivered" | "draft_confirmed" | "final_delivered" | "final_confirmed";

export async function fetchNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select(`
      id, type, created_at, read_at, data, artwork_id, commission_id,
      actor:actor_id(id, username, name, avatar_url),
      artworks(title),
      artwork_comments(content),
      commission_requests(org_name, title, client_id)
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const commission = row.commission_requests;
    return {
      id:             row.id,
      type:           row.type,
      createdAt:      row.created_at,
      readAt:         row.read_at,
      actor:          row.actor
        ? { id: row.actor.id, username: row.actor.username, name: row.actor.name, avatarUrl: row.actor.avatar_url }
        : null,
      artworkId:      row.artwork_id,
      artworkTitle:   row.artworks?.title ?? null,
      commentPreview: row.artwork_comments?.content ?? null,
      commissionId:   row.commission_id,
      commissionName: commission ? commission.org_name ?? commission.title ?? "未命名委託" : null,
      commissionRole: commission ? (commission.client_id === userId ? "sent" : "received") : null,
      status:         row.data?.status ?? null,
      milestone:      row.data?.milestone ?? null,
    };
  });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw error;
}

/**
 * 通知鈴鐺上的小圓點。換頁時重新檢查，有新通知進來時即時亮起；
 * 人在 /notifications 上就不顯示（那頁會把全部標成已讀）。
 */
export function useHasUnreadNotifications(userId: string | null | undefined): boolean {
  const location = useLocation();
  const [hasUnread, setHasUnread] = useState(false);
  const onNotificationsPage = location.pathname.startsWith("/notifications");

  useEffect(() => {
    if (!userId) { setHasUnread(false); return; }

    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null)
      .then(({ count }) => setHasUnread((count ?? 0) > 0));
  }, [userId, location.pathname]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      // Sidebar 和 HomePage 可能同時掛著，頻道名稱要各自獨立
      .channel(`notifications-dot:${userId}:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => setHasUnread(true),
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return hasUnread && !onNotificationsPage;
}
