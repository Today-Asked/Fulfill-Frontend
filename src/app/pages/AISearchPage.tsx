import React, { useState } from "react";
import { ArrowLeft, ImageOff, Loader2, Plus, Search, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router";
import {
  searchCreatorsWithAI,
  fetchPortfolios,
  MATCH_TIER_LABEL,
  type RankedCreator,
  type PortfolioPiece,
  type MatchTier,
} from "../../lib/aiSearch";

const EXAMPLE_PROMPTS = [
  "想要一種很夢幻、帶點復古膠片感的插畫",
  "簡約俐落的品牌識別設計，適合科技新創",
  "溫暖手繪風格的角色插圖，給兒童繪本用",
];

// Ranking already happens once for the whole pool up front (see aiSearch.ts),
// so showing more per page doesn't cost an extra AI call — only a cheap
// portfolio-thumbnail fetch for the newly revealed creators.
const PAGE_SIZE = 6;

const TIER_STYLE: Record<MatchTier, string> = {
  very_high: "bg-emerald-400/15 text-emerald-300",
  high: "bg-indigo-400/15 text-indigo-300",
  medium: "bg-white/10 text-white/70",
  low: "bg-white/6 text-white/45",
  very_low: "bg-white/5 text-white/35",
};

export function AISearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [isEditingKeywords, setIsEditingKeywords] = useState(false);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [rankedCreators, setRankedCreators] = useState<RankedCreator[]>([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [portfolios, setPortfolios] = useState<Record<number, PortfolioPiece[]>>({});
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  async function loadPortfoliosFor(creators: RankedCreator[]) {
    const ids = creators.map((creator) => creator.artistId);
    if (!ids.length) return;
    const loaded = await fetchPortfolios(ids);
    setPortfolios((current) => ({ ...current, ...loaded }));
  }

  async function runSearch(text: string, overrideKeywords?: string[]) {
    if (!text.trim()) return;
    setLoading(true);
    setError("");
    setIsEditingKeywords(false);
    try {
      const response = await searchCreatorsWithAI(text, { keywords: overrideKeywords });
      setSubmittedQuery(text);
      setKeywords(response.keywords);
      setRankedCreators(response.rankedCreators);
      setPortfolios({});
      setVisibleCount(PAGE_SIZE);
      setHasSearched(true);
      await loadPortfoliosFor(response.rankedCreators.slice(0, PAGE_SIZE));
    } catch (e) {
      setError(e instanceof Error ? e.message : "搜尋失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextSlice = rankedCreators.slice(visibleCount, visibleCount + PAGE_SIZE);
      await loadPortfoliosFor(nextSlice);
      setVisibleCount((current) => current + PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  function removeKeyword(keyword: string) {
    setKeywords((current) => current.filter((item) => item !== keyword));
  }

  function addKeywordFromDraft() {
    const trimmed = keywordDraft.trim();
    if (trimmed && !keywords.includes(trimmed)) setKeywords((current) => [...current, trimmed]);
    setKeywordDraft("");
  }

  function submitAdjustedKeywords() {
    void runSearch(submittedQuery, keywords);
  }

  const visibleResults = rankedCreators.slice(0, visibleCount);
  const hasMore = visibleCount < rankedCreators.length;

  return (
    <div className="pt-5 lg:pt-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label="返回上一頁"
        className="mb-5 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-white active:scale-[0.98]"
      >
        <ArrowLeft size={20} strokeWidth={1.8} />
      </button>

      <div className="mb-8">
        <p className="mb-2 flex items-center gap-1.5 text-xs tracking-[0.18em] text-white/40">
          <Sparkles size={13} />
          AI MATCH
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">AI 幫你找創作者</h1>
        <p className="mt-2 text-sm text-white/45">不知道想要的風格叫什麼名字？直接描述感覺，AI 幫你配對合適的創作者。</p>
      </div>

      <form
        onSubmit={(event) => { event.preventDefault(); void runSearch(query); }}
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-5 py-4"
      >
        <Search size={19} className="shrink-0 text-white/35" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="想要一種很夢幻、帶點復古膠片感的插畫"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex h-10 shrink-0 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : "搜尋"}
        </button>
      </form>

      {!hasSearched && !loading && (
        <div className="mt-5 flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => { setQuery(prompt); void runSearch(prompt); }}
              className="rounded-full border border-white/10 px-3.5 py-2 text-xs text-white/50 transition-colors hover:border-white/25 hover:text-white"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {hasSearched && !loading && keywords.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {keywords.map((keyword) => (
            <span key={keyword} className="flex items-center gap-1.5 rounded-full bg-indigo-400/15 px-3.5 py-1.5 text-sm text-indigo-200">
              {keyword}
              {isEditingKeywords && (
                <button type="button" onClick={() => removeKeyword(keyword)} aria-label={`移除關鍵字 ${keyword}`} className="grid h-4 w-4 place-items-center rounded-full text-indigo-200/70 hover:bg-white/15 hover:text-white">
                  <X size={11} />
                </button>
              )}
            </span>
          ))}

          {isEditingKeywords ? (
            <>
              <input
                value={keywordDraft}
                onChange={(event) => setKeywordDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { event.preventDefault(); addKeywordFromDraft(); }
                }}
                placeholder="新增關鍵字"
                className="h-8 w-28 rounded-full border border-white/15 bg-transparent px-3 text-xs text-white outline-none placeholder:text-white/30"
              />
              <button type="button" onClick={submitAdjustedKeywords} className="rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black">
                重新搜尋
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setIsEditingKeywords(true)} className="flex items-center gap-1 text-sm text-white/40 hover:text-white">
              <Plus size={14} />
              調整關鍵字
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="mt-8 grid gap-4">
          {[1, 2, 3].map((x) => <div key={x} className="h-64 animate-pulse rounded-2xl bg-white/5" />)}
        </div>
      ) : hasSearched && visibleResults.length === 0 ? (
        <div className="mt-10 grid place-items-center text-center">
          <p className="text-white/55">找不到符合這個描述的創作者，試著換個說法看看？</p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4">
          {visibleResults.map((result) => (
            <CreatorMatchCard
              key={result.artistId}
              result={result}
              portfolio={portfolios[result.artistId]}
              onClick={() => result.username && navigate(`/creator/${result.username}`)}
            />
          ))}
        </div>
      )}

      {hasSearched && !loading && hasMore && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="flex h-11 items-center gap-2 rounded-full border border-white/15 px-6 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore && <Loader2 size={15} className="animate-spin" />}
            更多創作者推薦
          </button>
        </div>
      )}
    </div>
  );
}

function CreatorMatchCard({
  result,
  portfolio,
  onClick,
}: {
  result: RankedCreator;
  portfolio: PortfolioPiece[] | undefined;
  onClick: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25">
      <button onClick={onClick} className="flex w-full items-start justify-between gap-4 text-left">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={result.name} url={result.avatarUrl} />
          <span className="min-w-0">
            <strong className="block truncate text-white">{result.name}</strong>
            <span className="block truncate text-xs text-white/40">{result.categories.join(" ・ ") || "創作者"}</span>
          </span>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${TIER_STYLE[result.matchTier]}`}>
          {MATCH_TIER_LABEL[result.matchTier]}
        </span>
      </button>

      <p className="mt-4 text-sm leading-6 text-white/55">{result.reason}</p>

      {portfolio === undefined ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="aspect-square animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      ) : portfolio.length > 0 ? (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {portfolio.map((piece) => (
            <div key={piece.id} className="aspect-square overflow-hidden rounded-xl bg-white/5">
              <img src={piece.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ))}
          {Array.from({ length: Math.max(0, 4 - portfolio.length) }).map((_, index) => (
            <div key={index} className="grid aspect-square place-items-center rounded-xl bg-white/[0.03]">
              <ImageOff size={16} className="text-white/15" />
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  if (url) return <img src={url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />;
  return <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-sm text-white">{name.slice(0, 1)}</div>;
}
