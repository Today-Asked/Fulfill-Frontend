import React, { useEffect, useMemo, useState } from "react";
import { Bookmark, Search, SlidersHorizontal } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { listSavedCreatorIds, searchCreators, toggleSaveCreator, type CreatorSummary } from "../../lib/creators";

const services = ["", "平面設計", "插畫", "攝影", "影像", "3D 創作", "網頁設計"];

export function SearchPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get('q') ?? '');
  const [service, setService] = useState(params.get('service') ?? '');
  const [availability, setAvailability] = useState(params.get('availability') ?? '');
  const [items, setItems] = useState<CreatorSummary[]>([]);
  const [saved, setSaved] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const queryKey = useMemo(() => `${params.get('q') ?? ''}|${params.get('service') ?? ''}|${params.get('availability') ?? ''}|${user?.id ?? ''}`, [params, user?.id]);
  useEffect(() => { setKeyword(params.get('q') ?? ''); setService(params.get('service') ?? ''); setAvailability(params.get('availability') ?? ''); }, [params]);
  useEffect(() => {
    setLoading(true); setError('');
    Promise.all([
      searchCreators({ keyword: params.get('q') ?? '', service: params.get('service') ?? undefined, availability: (params.get('availability') || undefined) as 'open' | 'limited' | 'closed' | undefined, viewerId: user?.id, limit: 60 }),
      user ? listSavedCreatorIds(user.id) : Promise.resolve([]),
    ]).then(([creators, ids]) => { setItems(creators); setSaved(new Set(ids)); }).catch((e) => setError(e instanceof Error ? e.message : '搜尋失敗。')).finally(() => setLoading(false));
  }, [queryKey]);

  function submit(e: React.FormEvent) { e.preventDefault(); const next: Record<string, string> = {}; if (keyword.trim()) next.q = keyword.trim(); if (service) next.service = service; if (availability) next.availability = availability; setParams(next); }
  async function toggle(id: number) { if (!user) { navigate('/login'); return; } try { const active = await toggleSaveCreator(user.id, id); setSaved((old) => { const next = new Set(old); active ? next.add(id) : next.delete(id); return next; }); } catch (e) { setError(e instanceof Error ? e.message : '無法更新收藏的創作者。'); } }

  return <main className="mx-auto min-h-full w-full max-w-6xl px-5 pb-32 pt-10 lg:px-10 lg:pt-14">
    <div className="mb-8"><p className="mb-2 text-xs tracking-[0.18em] text-white/40">DISCOVER</p><h1 className="text-3xl font-semibold tracking-tight">找創作者</h1><p className="mt-2 text-sm text-white/45">依服務與接案狀態縮小範圍，再收藏適合的創作者。</p></div>
    <form onSubmit={submit} className="grid gap-3 border-y border-white/10 py-5 md:grid-cols-[1fr_180px_180px_auto]">
      <label className="flex h-12 items-center gap-3 border border-white/15 bg-white/[0.035] px-4"><Search size={18} className="text-white/35" /><input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" placeholder="名字、帳號或自介" /></label>
      <select aria-label="服務類型" value={service} onChange={(e) => setService(e.target.value)} className="h-12 border border-white/15 bg-black px-3 text-sm text-white/70 outline-none">{services.map((x) => <option key={x} value={x}>{x || '所有服務'}</option>)}</select>
      <select aria-label="接案狀態" value={availability} onChange={(e) => setAvailability(e.target.value)} className="h-12 border border-white/15 bg-black px-3 text-sm text-white/70 outline-none"><option value="">所有狀態</option><option value="open">開放邀請</option><option value="limited">檔期有限</option><option value="closed">暫不接案</option></select>
      <button className="flex h-12 items-center justify-center gap-2 bg-white px-5 text-sm font-semibold text-black"><SlidersHorizontal size={17} />套用</button>
    </form>
    {error && <div role="alert" className="mt-5 border-l-2 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
    {loading ? <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[1,2,3].map((x) => <div key={x} className="h-72 animate-pulse bg-white/5" />)}</div> : items.length === 0 ? <div className="grid min-h-72 place-items-center text-center"><div><p className="text-white/65">找不到符合條件的創作者</p><button onClick={() => { setKeyword(''); setService(''); setAvailability(''); setParams({}); }} className="mt-3 text-sm text-white/40 underline underline-offset-4">清除篩選</button></div></div> : <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((creator) => <article key={creator.artistId} className="group border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/25">
      <div className="flex items-start justify-between gap-4"><button onClick={() => navigate(`/creator/${creator.username}`)} className="flex min-w-0 items-center gap-3 text-left"><Avatar creator={creator} /><span className="min-w-0"><strong className="block truncate text-white">{creator.name}</strong><span className="block truncate text-xs text-white/35">@{creator.username ?? 'creator'}</span></span></button><button aria-label={saved.has(creator.artistId) ? '取消收藏創作者' : '收藏創作者'} onClick={() => void toggle(creator.artistId)} className={`grid h-9 w-9 shrink-0 place-items-center border ${saved.has(creator.artistId) ? 'border-white bg-white text-black' : 'border-white/15 text-white/45'}`}><Bookmark size={16} fill={saved.has(creator.artistId) ? 'currentColor' : 'none'} /></button></div>
      <p className="mt-5 line-clamp-3 min-h-[4.5rem] text-sm leading-6 text-white/55">{creator.bio || '尚未填寫自我介紹。'}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{creator.services.slice(0, 3).map((x) => <span key={x} className="border border-white/10 px-2 py-1 text-xs text-white/45">{x}</span>)}</div>
      <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs"><span className={creator.availability === 'open' ? 'text-emerald-300' : 'text-white/40'}>{creator.availability === 'open' ? '開放邀請' : creator.availability === 'limited' ? '檔期有限' : '暫不接案'}</span><button onClick={() => navigate(`/creator/${creator.username}`)} className="text-white/65 hover:text-white">查看資料</button></div>
    </article>)}</div>}
  </main>;
}

function Avatar({ creator }: { creator: CreatorSummary }) { return creator.avatarUrl ? <img src={creator.avatarUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 text-sm">{creator.name.slice(0, 1)}</div>; }
