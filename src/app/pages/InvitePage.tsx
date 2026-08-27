import React, { useEffect, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { createCommission, createOpenCommission, type CommissionDraft } from "../../lib/commissions";
import { getCreator, type CreatorSummary } from "../../lib/creators";

const SERVICES = ["平面設計", "插畫", "攝影", "影像", "3D 創作", "網頁設計"];
const emptyDraft: CommissionDraft = { orgName: "", services: [], budgetMin: 0, budgetMax: 0, draftDueDate: "", finalDueDate: "", description: "", contact: "", hasAssets: false, referenceUrls: [] };

/**
 * Doubles as two flows depending on whether artistId is in the URL:
 *  - /invite/:artistId — targeted, from a creator's own profile page ("合作邀請")
 *  - /invite            — open, from the global "+" menu; posted with no
 *    artist_id, browsable by every creator until one claims it
 */
export function InvitePage() {
  const { artistId } = useParams<{ artistId?: string }>();
  const isOpen = !artistId;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<CreatorSummary | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [loading, setLoading] = useState(!isOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!authLoading && !user) navigate('/login'); }, [authLoading, user, navigate]);
  useEffect(() => {
    if (isOpen) return;
    const id = Number(artistId);
    if (!Number.isSafeInteger(id)) { setError('無效的創作者連結。'); setLoading(false); return; }
    getCreator(id).then(setCreator).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [artistId, isOpen]);
  function set<K extends keyof CommissionDraft>(key: K, value: CommissionDraft[K]) { setDraft((old) => ({ ...old, [key]: value })); }
  function toggleService(service: string) { set('services', draft.services.includes(service) ? draft.services.filter((x) => x !== service) : [...draft.services, service]); }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!isOpen && !creator) return;
    if (!isOpen && creator!.userId === user.id) { setError('不能邀請自己。'); return; }
    setBusy(true); setError('');
    try {
      if (isOpen) await createOpenCommission(user.id, draft);
      else await createCommission(creator!.artistId, user.id, draft);
      navigate('/orders');
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(
        message.includes('row-level security')
          ? '無法送出邀請，對方可能剛好取消公開接案。可以先跟對方聊聊看。'
          : message || '送出失敗。'
      );
      setBusy(false);
    }
  }

  if (loading) return <div className="mx-auto min-h-screen max-w-3xl animate-pulse px-5 pt-16"><div className="h-64 bg-white/5" /></div>;
  return <main className="mx-auto min-h-full w-full max-w-3xl px-5 pb-32 pt-10 lg:pt-14">
    <button onClick={() => navigate(-1)} className="mb-8 flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft size={17} />返回</button>
    <p className="mb-2 text-xs tracking-[0.18em] text-white/40">STRUCTURED INVITATION</p>
    <h1 className="text-3xl font-semibold tracking-tight text-white">{isOpen ? '發布一則委託' : `邀請 ${creator?.name ?? '創作者'} 合作`}</h1>
    <p className="mt-3 text-sm leading-6 text-white/50">{isOpen ? '所有創作者都看得到這則委託，先接下的人會開始跟你對話——這不是付款訂單，請先把範圍、預算與時程說清楚。' : '這不是付款訂單。創作者接受後才會開啟對話，請先把範圍、預算與時程說清楚。'}</p>
    {error && <div role="alert" className="mt-6 border-l-2 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}
    {!isOpen && !creator ? <p className="mt-8 text-white/50">找不到這位創作者，或對方尚未公開接案資料。</p> : <form onSubmit={submit} className="mt-8 grid gap-6">
      <Field label="委託單位或專案名稱" required><input required value={draft.orgName} onChange={(e) => set('orgName', e.target.value)} maxLength={200} className="input" placeholder="例如：成大攝影社年度展覽" /></Field>
      <fieldset><legend className="text-sm text-white/65">需要的服務 <span className="text-red-300">*</span></legend><div className="mt-3 flex flex-wrap gap-2">{SERVICES.map((service) => <button type="button" key={service} onClick={() => toggleService(service)} className={`border px-3 py-2 text-sm ${draft.services.includes(service) ? 'border-white bg-white text-black' : 'border-white/15 text-white/55'}`}>{service}</button>)}</div></fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="最低預算"><input type="number" min="0" value={draft.budgetMin} onChange={(e) => set('budgetMin', Number(e.target.value))} className="input" /></Field><Field label="最高預算"><input type="number" min="0" value={draft.budgetMax} onChange={(e) => set('budgetMax', Number(e.target.value))} className="input" /></Field></div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="希望看到初稿"><input type="date" value={draft.draftDueDate} onChange={(e) => set('draftDueDate', e.target.value)} className="input" /></Field><Field label="最終交件日"><input type="date" value={draft.finalDueDate} onChange={(e) => set('finalDueDate', e.target.value)} className="input" /></Field></div>
      <Field label="合作需求" required><textarea required value={draft.description} onChange={(e) => set('description', e.target.value)} rows={7} maxLength={3000} className="input resize-none" placeholder="用途、尺寸、數量、風格、必要內容與交付格式" /></Field>
      <Field label="聯絡方式"><input value={draft.contact} onChange={(e) => set('contact', e.target.value)} maxLength={200} className="input" placeholder="Email、LINE ID 或其他方式" /></Field>
      <label className="flex items-start gap-3 border border-white/10 p-4 text-sm text-white/60"><input type="checkbox" checked={draft.hasAssets} onChange={(e) => set('hasAssets', e.target.checked)} className="mt-1" /><span>我已備妥文字、Logo、照片或其他製作素材</span></label>
      <button disabled={busy || (!isOpen && creator?.userId === user?.id)} className="flex h-12 items-center justify-center gap-2 bg-white font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"><Send size={17} />{busy ? '送出中' : isOpen ? '發布委託' : '送出合作邀請'}</button>
    </form>}
  </main>;
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) { return <label className="block text-sm text-white/65">{label}{required && <span className="text-red-300"> *</span>}<span className="mt-2 block">{children}</span></label>; }
