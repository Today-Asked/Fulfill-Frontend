import React, { useEffect, useState } from "react";
import { Check, Clock3, Inbox, MessageCircle, Send, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  acceptCommission,
  declineCommission,
  listCommissions,
  markCommissionViewed,
  type Commission,
  type DeclineReason,
} from "../../lib/commissions";

const statusLabel: Record<Commission["status"], string> = {
  pending: "待回覆",
  accepted: "已接受",
  rejected: "已婉拒",
  in_progress: "進行中",
  delivered: "已交件",
  completed: "已完成",
};

const declineReasonLabel: Record<DeclineReason, string> = {
  schedule: "時間無法配合",
  budget: "預算不合",
  not_taking: "目前不接案",
  style_mismatch: "風格不合",
  other: "其他",
};

export function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<"received" | "sent">("received");
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declining, setDeclining] = useState<Commission | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      setItems(await listCommissions(role, user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "無法載入合作邀請。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [authLoading, user, navigate]);

  useEffect(() => { void reload(); }, [role, user?.id]);

  async function accept(item: Commission) {
    setBusyId(item.id);
    setError("");
    try {
      const chatId = await acceptCommission(item);
      navigate(`/chat/${chatId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "接受邀請失敗。");
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-full w-full max-w-5xl px-5 pb-32 pt-10 lg:px-10 lg:pt-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[0.18em] text-white/40">COLLABORATION</p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">合作邀請</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/50">先確認需求，再決定是否開啟對話。平台不會把未接受的邀請偽裝成訂單。</p>
        </div>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
          {([['received', '收到的'], ['sent', '送出的']] as const).map(([value, label]) => (
            <button key={value} onClick={() => setRole(value)} className={`rounded-full px-4 py-2 text-sm transition-colors ${role === value ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}>{label}</button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="mb-5 border-l-2 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {loading ? (
        <div className="grid gap-3"><Skeleton /><Skeleton /></div>
      ) : items.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-white/15 bg-white/[0.02] px-6 text-center">
          {role === "received" ? <Inbox className="mb-4 text-white/25" /> : <Send className="mb-4 text-white/25" />}
          <h2 className="font-medium text-white">目前沒有{role === "received" ? "收到" : "送出"}的邀請</h2>
          <p className="mt-2 text-sm text-white/40">{role === "received" ? "發布接案資料後，對方可以從你的創作者頁提出邀請。" : "到搜尋頁找到適合的創作者，先送出清楚的合作需求。"}</p>
          {role === "sent" && <button onClick={() => navigate('/search')} className="mt-5 bg-white px-5 py-2.5 text-sm font-semibold text-black">搜尋創作者</button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <article key={item.id} onClick={() => { if (!item.viewedAt && role === 'received') void markCommissionViewed(item.id); }} className="border border-white/10 bg-white/[0.035] p-5 lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-xs text-white/40"><Clock3 size={14} />{new Date(item.createdAt).toLocaleDateString('zh-TW')}</div>
                  <h2 className="text-xl font-semibold text-white">{item.orgName}</h2>
                  <p className="mt-1 text-sm text-white/50">{role === 'received' ? `來自 ${item.clientName}` : item.artistUserId ? `邀請 ${item.artistName}` : '公開委託（尚未有人接下）'}</p>
                </div>
                <span className={`border px-3 py-1 text-xs ${item.status === 'pending' ? 'border-amber-300/30 text-amber-200' : item.status === 'rejected' ? 'border-white/10 text-white/35' : 'border-emerald-300/30 text-emerald-200'}`}>{statusLabel[item.status]}</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-white/70">{item.description}</p>
              <dl className="mt-5 grid gap-3 border-t border-white/8 pt-4 text-sm sm:grid-cols-3">
                <Info label="服務" value={item.services.join('、') || '未填寫'} />
                <Info label="預算" value={formatBudget(item)} />
                <Info label="交件" value={item.finalDueDate ? new Date(item.finalDueDate).toLocaleDateString('zh-TW') : '未指定'} />
              </dl>
              {item.status === 'rejected' && item.declineReason && (
                <div className="mt-4 border-l-2 border-white/10 pl-4">
                  <p className="text-xs text-white/35">{role === 'sent' ? '對方婉拒原因' : '你婉拒的原因'}</p>
                  <p className="mt-1 text-sm text-white/70">{declineReasonLabel[item.declineReason]}</p>
                  {item.replyNote && <p className="mt-1 whitespace-pre-wrap text-sm text-white/50">{item.replyNote}</p>}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {role === 'received' && item.status === 'pending' && <>
                  <button disabled={busyId === item.id} onClick={() => void accept(item)} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />接受並開始對話</button>
                  <button onClick={() => setDeclining(item)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30"><X size={16} />婉拒</button>
                </>}
                {item.chatId && <button onClick={() => navigate(`/chat/${item.chatId}`)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70"><MessageCircle size={16} />開啟對話</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {declining && <DeclineDialog item={declining} onClose={() => setDeclining(null)} onDone={async () => { setDeclining(null); await reload(); }} />}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-white/35">{label}</dt><dd className="mt-1 text-white/75">{value}</dd></div>; }
function Skeleton() { return <div className="h-52 animate-pulse border border-white/8 bg-white/[0.035]" />; }
function formatBudget(item: Commission) { if (item.budgetMin == null && item.budgetMax == null) return '另議'; return `NT$ ${(item.budgetMin ?? 0).toLocaleString()} 到 ${(item.budgetMax ?? item.budgetMin ?? 0).toLocaleString()}`; }

function DeclineDialog({ item, onClose, onDone }: { item: Commission; onClose: () => void; onDone: () => Promise<void> }) {
  const [reason, setReason] = useState<DeclineReason>('schedule');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() { setBusy(true); setError(''); try { await declineCommission(item.id, reason, note.trim()); await onDone(); } catch (err) { setError(err instanceof Error ? err.message : '操作失敗。'); setBusy(false); } }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-5" role="dialog" aria-modal="true" aria-labelledby="decline-title">
    <div className="w-full max-w-md border border-white/15 bg-[#171717] p-6 shadow-2xl">
      <h2 id="decline-title" className="text-xl font-semibold text-white">婉拒「{item.orgName}」</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">簡短原因能幫對方調整需求，不會公開顯示。</p>
      <label className="mt-5 block text-sm text-white/60">主要原因<select value={reason} onChange={(e) => setReason(e.target.value as DeclineReason)} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-white outline-none"><option value="schedule">時間無法配合</option><option value="budget">預算不合</option><option value="not_taking">目前不接案</option><option value="style_mismatch">風格不合</option><option value="other">其他</option></select></label>
      <label className="mt-4 block text-sm text-white/60">補充說明<textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={4} className="mt-2 w-full resize-none border border-white/15 bg-black p-3 text-white outline-none" /></label>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-6 flex justify-end gap-2"><button onClick={onClose} className="px-4 py-2.5 text-sm text-white/50">取消</button><button disabled={busy} onClick={() => void submit()} className="bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40">確認婉拒</button></div>
    </div>
  </div>;
}
