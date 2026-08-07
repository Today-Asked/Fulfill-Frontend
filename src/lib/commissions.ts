import { supabase } from "./supabase";

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
    id, user_id, users ( id, name, username, avatar_url )
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
      deadline: draft.finalDueDate,
      draft_due_date: draft.draftDueDate,
      final_due_date: draft.finalDueDate,
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
