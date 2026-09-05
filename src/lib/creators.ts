import { supabase } from "./supabase";
import type { Availability, BudgetMode, WorkMode } from "./commissions";

/** Discovery, commission profile, shortlist, and trust actions. */

export interface CreatorSummary {
  artistId: number;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  school: string | null;
  availability: Availability;
  services: string[];
  budgetMode: BudgetMode;
  budgetFrom: number | null;
  budgetTo: number | null;
  availableFrom: string | null;
  turnaroundDays: number | null;
  workMode: WorkMode;
  isPublished: boolean;
  isVerified: boolean;
  schoolVerified: boolean;
}

const SELECT = `
  id, user_id, availability, services, budget_mode, budget_from, budget_to,
  available_from, turnaround_days, work_mode, school, cover_image_url,
  is_published, is_verified,
  users!artist_profiles_user_id_fkey ( id, name, username, avatar_url, bio, school_verified_at )
`;

function toCreator(row: any): CreatorSummary {
  const user = row.users;
  return {
    artistId: row.id,
    userId: row.user_id,
    name: user?.name ?? user?.username ?? "創作者",
    username: user?.username ?? null,
    avatarUrl: user?.avatar_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    bio: user?.bio ?? null,
    school: row.school ?? null,
    availability: row.availability ?? "open",
    services: row.services ?? [],
    budgetMode: row.budget_mode ?? "ask",
    budgetFrom: row.budget_from,
    budgetTo: row.budget_to,
    availableFrom: row.available_from,
    turnaroundDays: row.turnaround_days,
    workMode: row.work_mode ?? "both",
    isPublished: row.is_published ?? false,
    isVerified: row.is_verified ?? false,
    schoolVerified: Boolean(user?.school_verified_at),
  };
}

export interface CreatorQuery {
  keyword?: string;
  service?: string;
  availability?: Availability;
  limit?: number;
  viewerId?: string;
}

export async function searchCreators(query: CreatorQuery = {}): Promise<CreatorSummary[]> {
  let request = supabase
    .from("artist_profiles")
    .select(SELECT)
    .eq("is_published", true)
    .limit(query.limit ?? 40);

  if (query.service) request = request.contains("services", [query.service]);
  if (query.availability) request = request.eq("availability", query.availability);

  const { data, error } = await request;
  if (error) throw error;

  let rows = (data ?? []).map(toCreator);

  if (query.viewerId) {
    const blockedIds = new Set(await listBlockedIds(query.viewerId));
    rows = rows.filter((row) => row.userId !== query.viewerId && !blockedIds.has(row.userId));
  }

  // Name matching happens client side: the name lives on the joined users
  // row, which PostgREST cannot filter on inside this nested select.
  if (query.keyword) {
    const needle = query.keyword.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        (row.username ?? "").toLowerCase().includes(needle) ||
        (row.bio ?? "").toLowerCase().includes(needle),
    );
  }

  return rows;
}

/** Fetches specific creators by artist id, regardless of is_published — for callers with their own visibility rules. */
export async function listCreatorsByIds(artistIds: number[]): Promise<CreatorSummary[]> {
  if (!artistIds.length) return [];
  const { data, error } = await supabase.from("artist_profiles").select(SELECT).in("id", artistIds);
  if (error) throw error;
  return (data ?? []).map(toCreator);
}

export async function getCreator(artistId: number): Promise<CreatorSummary | null> {
  const { data, error } = await supabase.from("artist_profiles").select(SELECT).eq("id", artistId).maybeSingle();
  if (error) throw error;
  return data ? toCreator(data) : null;
}

export async function getCreatorByUserId(userId: string): Promise<CreatorSummary | null> {
  const { data, error } = await supabase.from("artist_profiles").select(SELECT).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? toCreator(data) : null;
}

export interface CommissionProfilePatch {
  availability?: Availability;
  services?: string[];
  budgetMode?: BudgetMode;
  budgetFrom?: number | null;
  budgetTo?: number | null;
  availableFrom?: string | null;
  turnaroundDays?: number | null;
  workMode?: WorkMode;
  school?: string | null;
  coverImageUrl?: string | null;
  isPublished?: boolean;
}

export async function updateCommissionProfile(
  artistId: number,
  patch: CommissionProfilePatch,
): Promise<void> {
  if ((patch.budgetFrom ?? 0) < 0 || (patch.budgetTo ?? 0) < 0) {
    throw new Error("預算不得小於 0。");
  }
  if (patch.budgetFrom != null && patch.budgetTo != null && patch.budgetFrom > patch.budgetTo) {
    throw new Error("預算上限不得低於下限。");
  }
  if (patch.turnaroundDays != null && patch.turnaroundDays <= 0) {
    throw new Error("交件天數必須大於 0。");
  }
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.availability !== undefined) payload.availability = patch.availability;
  if (patch.services !== undefined) payload.services = patch.services;
  if (patch.budgetMode !== undefined) payload.budget_mode = patch.budgetMode;
  if (patch.budgetFrom !== undefined) payload.budget_from = patch.budgetFrom;
  if (patch.budgetTo !== undefined) payload.budget_to = patch.budgetTo;
  if (patch.availableFrom !== undefined) payload.available_from = patch.availableFrom;
  if (patch.turnaroundDays !== undefined) payload.turnaround_days = patch.turnaroundDays;
  if (patch.workMode !== undefined) payload.work_mode = patch.workMode;
  if (patch.school !== undefined) payload.school = patch.school;
  if (patch.coverImageUrl !== undefined) payload.cover_image_url = patch.coverImageUrl;
  if (patch.isPublished !== undefined) payload.is_published = patch.isPublished;

  const { error } = await supabase.from("artist_profiles").update(payload).eq("id", artistId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Publishing rules
 * ------------------------------------------------------------------ */

export const MIN_ARTWORKS_TO_PUBLISH = 3;

export interface CompletenessItem {
  key: string;
  label: string;
  done: boolean;
  required: boolean;
}

/**
 * A half-filled page hurts both sides: the club cannot judge, and the creator
 * looks inactive. Publishing is gated on the required items.
 */
export function evaluateProfile(
  creator: CreatorSummary | null,
  artworkCount: number,
): { items: CompletenessItem[]; percent: number; canPublish: boolean; missing: string[] } {
  const items: CompletenessItem[] = [
    { key: "avatar", label: "設定頭貼", done: Boolean(creator?.avatarUrl), required: true },
    {
      key: "bio",
      label: "寫一段自我介紹（至少 20 字）",
      done: (creator?.bio?.trim().length ?? 0) >= 20,
      required: true,
    },
    {
      key: "artworks",
      label: `上傳至少 ${MIN_ARTWORKS_TO_PUBLISH} 件作品`,
      done: artworkCount >= MIN_ARTWORKS_TO_PUBLISH,
      required: true,
    },
    { key: "services", label: "選擇可承接項目", done: (creator?.services.length ?? 0) > 0, required: true },
    { key: "availability", label: "設定接案狀態", done: Boolean(creator?.availability), required: true },
    {
      key: "budget",
      label: "說明預算方式",
      done: creator?.budgetMode === "ask" || creator?.budgetFrom != null,
      required: false,
    },
    { key: "turnaround", label: "填寫一般交件時間", done: (creator?.turnaroundDays ?? 0) > 0, required: false },
    { key: "cover", label: "上傳分享用的封面圖", done: Boolean(creator?.coverImageUrl), required: false },
  ];

  const done = items.filter((item) => item.done).length;
  const missing = items.filter((item) => item.required && !item.done).map((item) => item.label);

  return {
    items,
    percent: Math.round((done / items.length) * 100),
    canPublish: missing.length === 0,
    missing,
  };
}

/* ------------------------------------------------------------------ *
 * Shortlist
 * ------------------------------------------------------------------ */

export async function listSavedCreatorIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase.from("creator_saves").select("artist_id").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.artist_id);
}

export async function listSavedCreators(userId: string): Promise<CreatorSummary[]> {
  const ids = await listSavedCreatorIds(userId);
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("artist_profiles").select(SELECT).in("id", ids);
  if (error) throw error;
  return (data ?? []).map(toCreator);
}

export async function toggleSaveCreator(userId: string, artistId: number): Promise<boolean> {
  const { data: existing, error: lookupError } = await supabase
    .from("creator_saves")
    .select("artist_id")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase.from("creator_saves").delete().eq("user_id", userId).eq("artist_id", artistId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("creator_saves").insert({ user_id: userId, artist_id: artistId });
  if (error) throw error;
  return true;
}

export async function listFollowedUserIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.following_id);
}

export async function toggleFollowCreator(userId: string, creatorUserId: string): Promise<boolean> {
  const { data: existing, error: lookupError } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .eq("following_id", creatorUserId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", userId)
      .eq("following_id", creatorUserId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: userId, following_id: creatorUserId });
  if (error) throw error;
  return true;
}

/* ------------------------------------------------------------------ *
 * Trust and safety
 * ------------------------------------------------------------------ */

export type ReportTarget = "creator" | "artwork" | "invitation";
export type ReportReason =
  | "impersonation"
  | "stolen_work"
  | "harassment"
  | "spam"
  | "inappropriate"
  | "other";

export async function submitReport(input: {
  reporterId: string;
  targetType: ReportTarget;
  targetId: string;
  reason: ReportReason;
  detail: string;
}): Promise<void> {
  const { error } = await supabase.from("reports").insert({
    reporter_id: input.reporterId,
    target_type: input.targetType,
    target_id: input.targetId,
    reason: input.reason,
    detail: input.detail,
  });
  if (error) throw error;
}

export async function listBlockedIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.blocked_id);
}

export async function toggleBlock(userId: string, targetId: string): Promise<boolean> {
  if (userId === targetId) throw new Error("不能封鎖自己。");
  const { data: existing, error: lookupError } = await supabase
    .from("blocks")
    .select("blocked_id")
    .eq("blocker_id", userId)
    .eq("blocked_id", targetId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", targetId);
    if (error) throw error;
    return false;
  }

  const { error } = await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: targetId });
  if (error) throw error;
  return true;
}

/* ------------------------------------------------------------------ *
 * School verification
 * ------------------------------------------------------------------ */

const SCHOOL_DOMAINS = ["ncku.edu.tw", "gs.ncku.edu.tw", "email.ncku.edu.tw"];

export function isSchoolEmail(email: string): boolean {
  const domain = email.trim().split("@")[1]?.toLowerCase() ?? "";
  return SCHOOL_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
}

/**
 * Records the school email. Actual delivery of the code is a Supabase Edge
 * Function; until that exists this only stores the address, so the badge
 * stays off.
 */
export async function saveSchoolEmail(userId: string, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!isSchoolEmail(normalized)) {
    throw new Error("請使用成大信箱（@ncku.edu.tw 或 @gs.ncku.edu.tw）。");
  }
  const { error } = await supabase
    .from("users")
    .update({ school_email: normalized, school_verified_at: null })
    .eq("id", userId);
  if (error) throw error;
}
