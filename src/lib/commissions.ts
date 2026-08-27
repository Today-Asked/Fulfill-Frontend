import { supabase } from "./supabase";
import { getOrCreateConversation } from "./chat";

/**
 * Data access for the structured collaboration invitation flow.
 *
 * Mirrors the style of chat.ts: plain async functions returning the shape the
 * pages want, with Supabase details kept out of the components.
 */

export type Availability = "open" | "limited" | "closed";
export type BudgetMode = "ask" | "from" | "range";
export type WorkMode = "remote" | "in_person" | "both";
export type DeclineReason = "schedule" | "budget" | "not_taking" | "style_mismatch" | "other";
export type CommissionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "in_progress"
  | "delivered"
  | "completed";

export interface CommissionDraft {
  orgName: string;
  services: string[];
  budgetMin: number;
  budgetMax: number;
  draftDueDate: string;
  finalDueDate: string;
  description: string;
  contact: string;
  hasAssets: boolean;
  referenceUrls?: string[];
}

function assertCommissionDraft(draft: CommissionDraft): void {
  if (!draft.orgName.trim()) throw new Error("請填寫委託單位或專案名稱。");
  if (!draft.description.trim()) throw new Error("請填寫合作需求。");
  if (draft.services.length === 0) throw new Error("請至少選擇一項服務。");
  if (draft.budgetMin < 0 || draft.budgetMax < 0 || draft.budgetMin > draft.budgetMax) {
    throw new Error("預算範圍不正確。");
  }
  if (draft.draftDueDate && draft.finalDueDate && draft.draftDueDate > draft.finalDueDate) {
    throw new Error("初稿日期不得晚於交件日期。");
  }
}

/** `<input type="date">` reports an unset value as "", which Postgres
 *  rejects for date/timestamptz columns — needs to be a real null. */
function toDateOrNull(value: string): string | null {
  return value.trim() === "" ? null : value;
}

export interface Commission {
  id: number;
  chatId: number | null;
  clientId: string;
  clientName: string;
  clientAvatarUrl: string | null;
  artistId: number;
  artistName: string;
  artistUserId: string;
  orgName: string;
  services: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  draftDueDate: string | null;
  finalDueDate: string | null;
  description: string;
  contact: string;
  hasAssets: boolean;
  referenceUrls: string[];
  status: CommissionStatus;
  declineReason: DeclineReason | null;
  replyNote: string | null;
  viewedAt: string | null;
  createdAt: string;
}

/** Nested selects keep this to a single round trip. */
const SELECT = `
  id, chat_id, client_id, artist_id, title, description, org_name, services,
  budget_min, budget_max, draft_due_date, final_due_date, contact, has_assets,
  reference_urls, status, decline_reason, reply_note, viewed_at, created_at,
  client:users!commission_requests_client_id_fkey ( id, name, username, avatar_url ),
  artist:artist_profiles!commission_requests_artist_id_fkey (
    id, user_id, users!artist_profiles_user_id_fkey ( id, name, username, avatar_url )
  )
`;

function toCommission(row: any): Commission {
  const artistUser = row.artist?.users;
  return {
    id: row.id,
    chatId: row.chat_id,
    clientId: row.client_id,
    clientName: row.client?.name ?? row.client?.username ?? "使用者",
    clientAvatarUrl: row.client?.avatar_url ?? null,
    artistId: row.artist_id,
    artistName: artistUser?.name ?? artistUser?.username ?? "創作者",
    artistUserId: artistUser?.id ?? "",
    orgName: row.org_name ?? row.title ?? "",
    services: row.services ?? [],
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    draftDueDate: row.draft_due_date,
    finalDueDate: row.final_due_date,
    description: row.description ?? "",
    contact: row.contact ?? "",
    hasAssets: row.has_assets ?? false,
    referenceUrls: row.reference_urls ?? [],
    status: row.status,
    declineReason: row.decline_reason,
    replyNote: row.reply_note,
    viewedAt: row.viewed_at,
    createdAt: row.created_at,
  };
}

export async function createCommission(
  artistId: number,
  clientId: string,
  draft: CommissionDraft,
): Promise<Commission> {
  assertCommissionDraft(draft);
  const { data, error } = await supabase
    .from("commission_requests")
    .insert({
      artist_id: artistId,
      client_id: clientId,
      title: draft.orgName,
      org_name: draft.orgName,
      description: draft.description,
      services: draft.services,
      budget_min: draft.budgetMin,
      budget_max: draft.budgetMax,
      // Keep the legacy single-value columns populated so older screens and
      // any existing reports keep working.
      budget: draft.budgetMax,
      deadline: toDateOrNull(draft.finalDueDate),
      draft_due_date: toDateOrNull(draft.draftDueDate),
      final_due_date: toDateOrNull(draft.finalDueDate),
      contact: draft.contact,
      has_assets: draft.hasAssets,
      reference_urls: draft.referenceUrls ?? [],
      status: "pending",
    })
    .select(SELECT)
    .single();

  if (error) throw error;
  return toCommission(data);
}

/**
 * Posts a commission with no artist_id at all — visible to every creator on
 * the home feed's "未指定的委託" tab. Any number of them can inquire; the
 * client picks one later from inside that chat (inviteCommissionArtist()).
 * Contrast with createCommission(), which targets one specific (already
 * published) creator directly from their own profile page.
 */
export async function createOpenCommission(clientId: string, draft: CommissionDraft): Promise<Commission> {
  assertCommissionDraft(draft);
  const { data, error } = await supabase
    .from("commission_requests")
    .insert({
      artist_id: null,
      client_id: clientId,
      title: draft.orgName,
      org_name: draft.orgName,
      description: draft.description,
      services: draft.services,
      budget_min: draft.budgetMin,
      budget_max: draft.budgetMax,
      // Keep the legacy single-value columns populated so older screens and
      // any existing reports keep working.
      budget: draft.budgetMax,
      deadline: toDateOrNull(draft.finalDueDate),
      draft_due_date: toDateOrNull(draft.draftDueDate),
      final_due_date: toDateOrNull(draft.finalDueDate),
      contact: draft.contact,
      has_assets: draft.hasAssets,
      reference_urls: draft.referenceUrls ?? [],
      status: "pending",
    })
    .select(SELECT)
    .single();

  if (error) throw error;
  return toCommission(data);
}

/** Open commissions any signed-in creator can browse and inquire about. */
export async function listOpenCommissions(): Promise<Commission[]> {
  const { data, error } = await supabase
    .from("commission_requests")
    .select(SELECT)
    .is("artist_id", null)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toCommission);
}

/** Fetches one commission's current state — used to re-check whether an
 *  open commission a chat referenced is still unclaimed. */
export async function getCommission(commissionId: number): Promise<Commission | null> {
  const { data, error } = await supabase
    .from("commission_requests")
    .select(SELECT)
    .eq("id", commissionId)
    .maybeSingle();
  if (error) throw error;
  return data ? toCommission(data) : null;
}

/**
 * "諮詢詳情" from the open-commissions feed. Doesn't claim anything — any
 * number of creators can inquire about the same open commission, each in
 * their own 1:1 chat with the client. Tags the opening message with the
 * commission id so ChatRoomPage can offer the client a one-tap "邀請他接案"
 * once they've decided who they like.
 */
export async function inquireCommission(commission: Commission, myUserId: string): Promise<number> {
  const chatId = await getOrCreateConversation(myUserId, commission.clientId);
  if (!chatId) throw new Error("無法建立對話。");

  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    sender_id: myUserId,
    type: "commission",
    content: {
      commission_id: commission.id,
      kind: "inquiry",
      text: `我對「${commission.orgName}」這則委託有興趣，想聊聊細節。`,
    },
  });
  if (error) throw error;

  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", chatId);
  return chatId;
}

/**
 * The client's one-click "邀請他接案" from inside a chat — no form to
 * refill. Just assigns the commission to that creator; it still shows up
 * as a normal pending invite in their OrdersPage inbox, and nothing about
 * the commission actually starts until they accept it themselves.
 */
export async function inviteCommissionArtist(commissionId: number, artistId: number): Promise<void> {
  const { data, error } = await supabase
    .from("commission_requests")
    .update({ artist_id: artistId, updated_at: new Date().toISOString() })
    .eq("id", commissionId)
    .is("artist_id", null)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("這則委託已經指定給別人了，請重新整理。");
}

/** `received` is the artist's inbox; `sent` is what the current user issued. */
export async function listCommissions(
  role: "received" | "sent",
  userId: string,
): Promise<Commission[]> {
  let query = supabase.from("commission_requests").select(SELECT).order("created_at", { ascending: false });

  if (role === "sent") {
    query = query.eq("client_id", userId);
  } else {
    const artistId = await getMyArtistProfileId(userId);
    if (!artistId) return [];
    query = query.eq("artist_id", artistId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(toCommission);
}

export async function markCommissionViewed(id: number): Promise<void> {
  const { error } = await supabase
    .from("commission_requests")
    .update({ viewed_at: new Date().toISOString() })
    .eq("id", id)
    .is("viewed_at", null);
  if (error) throw error;
}

/**
 * Accepting opens a conversation so the two sides can keep talking in-app,
 * and posts an opening message so the thread is never empty.
 */
export async function acceptCommission(
  commission: Commission,
  _artistUserId?: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("accept_commission", {
    p_commission_id: commission.id,
  });
  if (error) throw error;
  const chatId = Number(data);
  if (!Number.isSafeInteger(chatId) || chatId <= 0) {
    throw new Error("無法建立合作對話，請稍後再試。");
  }
  return chatId;
}

export async function declineCommission(
  id: number,
  reason: DeclineReason,
  note: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("commission_requests")
    .update({
      status: "rejected",
      decline_reason: reason,
      reply_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("這筆邀請已處理，請重新整理。");
}

export async function getMyArtistProfileId(userId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/* ------------------------------------------------------------------ *
 * Match outcome tracking
 * ------------------------------------------------------------------ */

export type MatchOutcome =
  | "confirmed"
  | "discussing"
  | "no_deal"
  | "no_reply"
  | "budget"
  | "schedule"
  | "style";

export async function saveMatchOutcome(
  commissionId: number,
  userId: string,
  outcome: MatchOutcome,
): Promise<void> {
  const { error } = await supabase
    .from("match_outcomes")
    .upsert({ commission_id: commissionId, user_id: userId, outcome });
  if (error) throw error;
}

export async function getMatchOutcomes(
  userId: string,
): Promise<Record<number, MatchOutcome>> {
  const { data, error } = await supabase
    .from("match_outcomes")
    .select("commission_id, outcome")
    .eq("user_id", userId);
  if (error) throw error;

  const map: Record<number, MatchOutcome> = {};
  for (const row of data ?? []) map[row.commission_id] = row.outcome;
  return map;
}
