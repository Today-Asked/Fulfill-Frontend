import { supabase } from "./supabase";

export async function getOrCreateConversation(
  myId: string,
  otherId: string
): Promise<number | null> {
  if (myId === otherId) return null;

  // DB 規定 usera_id < userb_id
  const [usera_id, userb_id] = myId < otherId ? [myId, otherId] : [otherId, myId];

  const { data: existing, error: lookupError } = await supabase
    .from("conversations")
    .select("id")
    .eq("usera_id", usera_id)
    .eq("userb_id", userb_id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("conversations")
    .insert({ usera_id, userb_id })
    .select("id")
    .single();

  if (createError?.code === "23505") {
    const { data: raced, error: racedError } = await supabase
      .from("conversations")
      .select("id")
      .eq("usera_id", usera_id)
      .eq("userb_id", userb_id)
      .single();
    if (racedError) throw racedError;
    return raced.id;
  }
  if (createError) throw createError;

  return created?.id ?? null;
}

export function formatChatTime(timestamp: string | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return "週" + ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function getLastMessageText(
  content: Record<string, unknown> | null,
  type: string
): string {
  if (!content) return "";
  if (type === "text") return (content.text as string) ?? "";
  if (type === "image") return "[圖片]";
  if (type === "file") return "[檔案]";
  if (type === "sticker") return "[貼圖]";
  return "";
}
