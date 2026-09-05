import { supabase } from "./supabase";
import { listCreatorsByIds, type CreatorSummary } from "./creators";

/** Natural-language creator discovery: describe a style/vibe, get ranked creator matches. */

export type MatchTier = "very_high" | "high" | "medium" | "low" | "very_low";

export const MATCH_TIER_LABEL: Record<MatchTier, string> = {
  very_high: "極度相符",
  high: "高度相符",
  medium: "中度相符",
  low: "略為相符",
  very_low: "低度相符",
};

// Fallback ranking only — used if match-creators can't be reached. A result's
// position walks down this ladder so results still read as "roughly ranked"
// instead of every fallback result landing in the same tier.
const FALLBACK_TIER_LADDER: MatchTier[] = ["very_high", "high", "high", "medium", "medium", "low", "low", "very_low"];

// The model is asked to return results already sorted best-to-worst, but
// that's a request, not a guarantee — this enforces it. Array.prototype.sort
// is stable, so ties (same tier) keep the model's own relative order instead
// of being shuffled.
const TIER_RANK: Record<MatchTier, number> = { very_high: 0, high: 1, medium: 2, low: 3, very_low: 4 };

export interface PortfolioPiece {
  id: number;
  imageUrl: string;
}

export interface RankedCreator {
  artistId: number;
  userId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  categories: string[];
  matchTier: MatchTier;
  reason: string;
}

export interface AISearchResponse {
  keywords: string[];
  rankedCreators: RankedCreator[];
}

const CANDIDATE_POOL_SIZE = 40;
const MAX_DISPLAY_KEYWORDS = 5;

/** Local fallback only — used if the generate-tags edge function call fails. */
function extractKeywordsLocally(query: string): string[] {
  const tokens = query
    .split(/[\s、,，。.!！?？；;:：]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
  return tokens.length ? tokens.slice(0, MAX_DISPLAY_KEYWORDS) : [query.trim()].filter(Boolean);
}

/** Calls the generate-tags edge function to extract style keywords from the user's free-text query. */
async function fetchKeywords(query: string): Promise<string[]> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-tags", {
      body: { userInput: query },
    });
    if (error) throw error;
    if (Array.isArray(data) && data.length) return data.slice(0, MAX_DISPLAY_KEYWORDS);
  } catch (err) {
    console.error("generate-tags call failed, falling back to local keyword extraction:", err);
  }
  return extractKeywordsLocally(query);
}

function fallbackReason(creator: CreatorSummary, keywords: string[]): string {
  const focus = creator.services.slice(0, 2).join("、") || "多元風格";
  const keywordText = keywords[0] ? `與你提到的「${keywords[0]}」相近` : "與你的需求相近";
  return `擅長${focus}，${keywordText}。`;
}

/** Degrades gracefully if match-creators can't be reached: keeps the pool's original order and fakes a tier/reason. */
function fallbackRanking(pool: CreatorSummary[], keywords: string[]): RankedCreator[] {
  return pool.map((creator, index) => ({
    artistId: creator.artistId,
    userId: creator.userId,
    name: creator.name,
    username: creator.username,
    avatarUrl: creator.avatarUrl,
    categories: creator.services.slice(0, 2),
    matchTier: FALLBACK_TIER_LADDER[Math.min(index, FALLBACK_TIER_LADDER.length - 1)],
    reason: fallbackReason(creator, keywords),
  }));
}

/**
 * A creator's bio often says nothing about what they actually make — the fix
 * is feeding the model their real portfolio, not writing a better bio. Pulls
 * each candidate's most recent artwork titles + tags (the same tags added
 * via the artwork-upload TagInput) as a proxy for "what this creator's work
 * actually looks like", since matching only has text to work with (no vision
 * model — this stays pure text reasoning per the original design).
 */
async function fetchArtworkDigest(artistId: number): Promise<string[]> {
  const { data } = await supabase
    .from("artworks")
    .select("title, artwork_tags(tags(name))")
    .eq("artist_id", artistId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(6);

  return (data ?? []).map((row: any) => {
    const tagNames: string[] = (row.artwork_tags ?? []).map((item: any) => item.tags?.name).filter(Boolean);
    const title = row.title?.trim() || "未命名作品";
    return tagNames.length ? `${title}（標籤：${tagNames.join("、")}）` : title;
  });
}

/**
 * Calls the match-creators edge function once per search: it sends the whole
 * candidate pool's text profile (bio, services, and recent artwork titles/
 * tags) to MiniMax and gets back a full ranking (tier + reason per creator).
 * Ranking happens once, up front — "load more" in the UI just reveals
 * further slices of this same list rather than calling the model again per
 * page.
 */
async function matchCreatorsWithAI(query: string, keywords: string[], pool: CreatorSummary[]): Promise<RankedCreator[]> {
  try {
    const candidates = await Promise.all(
      pool.map(async (creator) => ({
        artistId: creator.artistId,
        name: creator.name,
        bio: creator.bio,
        services: creator.services,
        recentWorks: await fetchArtworkDigest(creator.artistId),
      })),
    );

    const { data, error } = await supabase.functions.invoke("match-creators", {
      body: { query, keywords, candidates },
    });
    if (error) throw error;

    const byId = new Map(pool.map((creator) => [creator.artistId, creator]));
    const ranked: RankedCreator[] = (data?.results ?? [])
      .map((result: { artistId: number; matchTier: MatchTier; reason: string }) => {
        const creator = byId.get(result.artistId);
        if (!creator) return null;
        byId.delete(result.artistId);
        return {
          artistId: creator.artistId,
          userId: creator.userId,
          name: creator.name,
          username: creator.username,
          avatarUrl: creator.avatarUrl,
          categories: creator.services.slice(0, 2),
          matchTier: result.matchTier,
          reason: result.reason,
        };
      })
      .filter((result: RankedCreator | null): result is RankedCreator => result !== null);

    if (!ranked.length) throw new Error("match-creators returned no usable results");

    ranked.sort((a, b) => TIER_RANK[a.matchTier] - TIER_RANK[b.matchTier]);

    // The model isn't guaranteed to include every candidate — append any it
    // dropped at the bottom with a fallback tier rather than losing them.
    const missing = fallbackRanking(Array.from(byId.values()), keywords).map((creator) => ({ ...creator, matchTier: "very_low" as MatchTier }));
    return [...ranked, ...missing];
  } catch (err) {
    console.error("match-creators call failed, falling back to local ranking:", err);
    return fallbackRanking(pool, keywords);
  }
}

async function fetchPortfolio(artistId: number): Promise<PortfolioPiece[]> {
  const { data } = await supabase
    .from("artworks")
    .select("id, cover_image_url")
    .eq("artist_id", artistId)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(4);

  return (data ?? [])
    .filter((row) => row.cover_image_url)
    .map((row) => ({ id: row.id, imageUrl: row.cover_image_url as string }));
}

/** Fetches portfolio thumbnails for a batch of creators — called lazily as pages of results are revealed. */
export async function fetchPortfolios(artistIds: number[]): Promise<Record<number, PortfolioPiece[]>> {
  const entries = await Promise.all(artistIds.map(async (artistId) => [artistId, await fetchPortfolio(artistId)] as const));
  return Object.fromEntries(entries);
}

/**
 * The AI search candidate pool isn't "who's formally open for commissions"
 * (creators.ts's searchCreators(), gated by is_published, which the regular
 * filter-based SearchPage uses) — it's "who has actually made something",
 * since matching here is driven entirely by portfolio content. A creator
 * with a well-tagged portfolio but an unpublished or incomplete commission
 * profile should still be discoverable through a style search.
 */
async function fetchCandidatePool(limit: number): Promise<CreatorSummary[]> {
  const [{ data: publishedProfiles, error: profileError }, { data: artworkRows, error: artworkError }] = await Promise.all([
    supabase.from("artist_profiles").select("id").eq("is_published", true),
    supabase.from("artworks").select("artist_id").eq("status", "published").is("deleted_at", null),
  ]);
  if (profileError) throw profileError;
  if (artworkError) throw artworkError;

  const artistIds = Array.from(
    new Set<number>([
      ...(publishedProfiles ?? []).map((row) => row.id as number),
      ...(artworkRows ?? []).map((row) => row.artist_id as number),
    ]),
  ).slice(0, limit);

  return listCreatorsByIds(artistIds);
}

/**
 * Runs one search: extracts keywords (generate-tags) and ranks the whole
 * candidate pool (match-creators) in one pass. Both calls hit real edge
 * functions backed by MiniMax; only the candidate pool itself is a stand-in
 * for a proper retrieval step — it's every creator with published work or a
 * published commission profile, capped at `limit`, rather than a
 * pre-filtered shortlist.
 */
export async function searchCreatorsWithAI(query: string, opts: { keywords?: string[] } = {}): Promise<AISearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { keywords: [], rankedCreators: [] };

  const keywords = opts.keywords?.length ? opts.keywords : await fetchKeywords(trimmed);
  const pool = await fetchCandidatePool(CANDIDATE_POOL_SIZE);
  const rankedCreators = await matchCreatorsWithAI(trimmed, keywords, pool);

  return { keywords, rankedCreators };
}
