import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Download, ExternalLink, Inbox, MessageCircle, Send, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
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
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<"received" | "sent">(() => searchParams.get("view") === "sent" ? "sent" : "received");
  const [items, setItems] = useState<Commission[]>([]);
  const [calendarItems, setCalendarItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declining, setDeclining] = useState<Commission | null>(null);

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const [received, sent] = await Promise.all([
        listCommissions("received", user.id),
        listCommissions("sent", user.id),
      ]);
      const all = Array.from(new Map([...received, ...sent].map((item) => [item.id, item])).values());
      setItems(role === "received" ? received : sent);
      setCalendarItems(all);
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
    <div className="pt-6 lg:pt-10">
      <CommissionCalendar
        commissions={calendarItems}
        onOpenCommission={(commission) => {
          if (commission.chatId) {
            navigate(`/chat/${commission.chatId}`);
            return;
          }
          document.getElementById(`commission-${commission.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[0.18em] text-white/40">ORDERS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">訂單</h1>
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
          <h2 className="font-medium text-white">目前沒有{role === "received" ? "收到" : "送出"}的訂單</h2>
          <p className="mt-2 text-sm text-white/40">{role === "received" ? "收到的合作邀請與委託會顯示在這裡。" : "你送出的委託會顯示在這裡。"}</p>
          {role === "sent" && <button onClick={() => navigate('/search')} className="mt-5 bg-white px-5 py-2.5 text-sm font-semibold text-black">搜尋創作者</button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const itemRole = role;
            return (
            <article id={`commission-${item.id}`} key={item.id} onClick={() => { if (!item.viewedAt && itemRole === 'received') void markCommissionViewed(item.id); }} className="scroll-mt-24 border border-white/10 bg-white/[0.035] p-5 lg:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-xs text-white/40"><Clock3 size={14} />{new Date(item.createdAt).toLocaleDateString('zh-TW')}</div>
                  <h2 className="text-xl font-semibold text-white">{item.orgName}</h2>
                  <p className="mt-1 text-sm text-white/50">{itemRole === 'received' ? `來自 ${item.clientName}` : item.artistUserId ? `邀請 ${item.artistName}` : '公開委託（尚未有人接下）'}</p>
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
                  <p className="text-xs text-white/35">{itemRole === 'sent' ? '對方婉拒原因' : '你婉拒的原因'}</p>
                  <p className="mt-1 text-sm text-white/70">{declineReasonLabel[item.declineReason]}</p>
                  {item.replyNote && <p className="mt-1 whitespace-pre-wrap text-sm text-white/50">{item.replyNote}</p>}
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {itemRole === 'received' && item.status === 'pending' && <>
                  <button disabled={busyId === item.id} onClick={() => void accept(item)} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />接受並開始對話</button>
                  <button onClick={() => setDeclining(item)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30"><X size={16} />婉拒</button>
                </>}
                {item.chatId && <button onClick={() => navigate(`/chat/${item.chatId}`)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70"><MessageCircle size={16} />開啟對話</button>}
              </div>
            </article>
          );})}
        </div>
      )}

      {declining && <DeclineDialog item={declining} onClose={() => setDeclining(null)} onDone={async () => { setDeclining(null); await reload(); }} />}
    </div>
  );
}

interface DeadlineEvent {
  id: string;
  date: string;
  kind: "draft" | "final";
  label: string;
  commission: Commission;
}

function CommissionCalendar({ commissions, onOpenCommission }: { commissions: Commission[]; onOpenCommission: (commission: Commission) => void }) {
  const events = useMemo<DeadlineEvent[]>(() => commissions
    .filter((item) => item.status !== "rejected" && item.status !== "completed")
    .flatMap((item) => [
      ...(item.draftDueDate ? [{ id: `${item.id}-draft`, date: item.draftDueDate, kind: "draft" as const, label: "初稿期限", commission: item }] : []),
      ...(item.finalDueDate ? [{ id: `${item.id}-final`, date: item.finalDueDate, kind: "final" as const, label: "完稿 Deadline", commission: item }] : []),
    ])
    .sort((a, b) => a.date.localeCompare(b.date)), [commissions]);

  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || events.length === 0) return;
    const today = localDateKey(new Date());
    const firstUpcoming = events.find((event) => event.date >= today) ?? events[0];
    const eventDate = parseLocalDate(firstUpcoming.date);
    setMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    setSelectedDate(firstUpcoming.date);
    setInitialized(true);
  }, [events, initialized]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((offset + days) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? day : null;
  });
  const selectedEvents = events.filter((event) => event.date === selectedDate);

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.035]">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 px-5 py-5 lg:px-6">
        <div>
          <div className="flex items-center gap-2"><CalendarDays size={18} className="text-sky-300" /><h2 className="font-semibold text-white">委託行程</h2></div>
          <p className="mt-1.5 text-xs leading-5 text-white/35">整合收到與送出的初稿、完稿與交件期限</p>
        </div>
        <button type="button" disabled={events.length === 0} onClick={() => downloadCalendar(events)} className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-xs text-white/65 hover:bg-white/10 disabled:opacity-30">
          <Download size={14} />匯出 Google／TimeTree
        </button>
      </div>

      <div className="grid lg:grid-cols-[1.45fr_0.75fr]">
        <div className="border-b border-white/8 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="mb-4 flex items-center justify-between">
            <button type="button" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))} aria-label="上個月" className="grid h-9 w-9 place-items-center rounded-full text-white/50 hover:bg-white/8 hover:text-white"><ChevronLeft size={18} /></button>
            <strong className="text-sm font-medium text-white">{year} 年 {monthIndex + 1} 月</strong>
            <button type="button" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))} aria-label="下個月" className="grid h-9 w-9 place-items-center rounded-full text-white/50 hover:bg-white/8 hover:text-white"><ChevronRight size={18} /></button>
          </div>

          <div className="grid grid-cols-7 text-center text-[10px] text-white/25">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day} className="pb-2">{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day == null) return <span key={`blank-${index}`} className="min-h-14 sm:min-h-20" />;
              const key = localDateKey(new Date(year, monthIndex, day));
              const dayEvents = events.filter((event) => event.date === key);
              const selected = key === selectedDate;
              const today = key === localDateKey(new Date());
              return (
                <button key={key} type="button" onClick={() => setSelectedDate(key)} className={`min-h-14 overflow-hidden rounded-xl border p-1.5 text-left transition-colors sm:min-h-20 ${selected ? "border-sky-300/50 bg-sky-400/10" : "border-transparent hover:bg-white/5"}`}>
                  <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${today ? "bg-white text-black" : "text-white/55"}`}>{day}</span>
                  <span className="mt-1 grid gap-1">
                    {dayEvents.slice(0, 2).map((event) => <span key={event.id} className={`block truncate rounded px-1 py-0.5 text-[8px] sm:text-[9px] ${event.kind === "draft" ? "bg-sky-400/15 text-sky-200" : "bg-amber-300/15 text-amber-100"}`}>{event.commission.orgName}</span>)}
                    {dayEvents.length > 2 && <span className="text-[8px] text-white/30">+{dayEvents.length - 2}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="p-5">
          <h3 className="text-sm font-medium text-white">{selectedDate ? formatCalendarDate(selectedDate) : "選擇日期"}</h3>
          {selectedEvents.length === 0 ? (
            <div className="grid min-h-36 place-items-center text-center"><p className="text-xs leading-5 text-white/30">這天沒有委託行程<br />點選有標記的日期查看</p></div>
          ) : (
            <div className="mt-4 grid gap-3">
              {selectedEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-black/20 p-3.5">
                  <div className="flex items-center justify-between gap-2"><span className={`rounded-full px-2 py-1 text-[10px] ${event.kind === "draft" ? "bg-sky-400/15 text-sky-200" : "bg-amber-300/15 text-amber-100"}`}>{event.label}</span><span className="text-[10px] text-white/25">{statusLabel[event.commission.status]}</span></div>
                  <p className="mt-3 text-sm font-medium text-white">{event.commission.orgName}</p>
                  <p className="mt-1 truncate text-xs text-white/35">{event.commission.services.join('、')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => onOpenCommission(event.commission)} className="rounded-full bg-white/8 px-3 py-1.5 text-[11px] text-white/65 hover:bg-white/12">查看訂單</button>
                    <button type="button" onClick={() => openGoogleCalendar(event)} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/50 hover:text-white"><ExternalLink size={11} />Google Calendar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-5 text-[10px] leading-4 text-white/25">TimeTree 可匯入手機原生日曆；若日期變更，需重新匯出更新。</p>
        </aside>
      </div>
    </section>
  );
}

function parseLocalDate(value: string) { const [year, month, day] = value.slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day); }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatCalendarDate(value: string) { return parseLocalDate(value).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }); }
function nextDate(value: string) { const date = parseLocalDate(value); date.setDate(date.getDate() + 1); return localDateKey(date); }
function compactDate(value: string) { return value.replaceAll('-', ''); }
function escapeIcs(value: string) { return value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll(',', '\\,').replaceAll(';', '\\;'); }

function openGoogleCalendar(event: DeadlineEvent) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${event.commission.orgName}｜${event.label}`,
    dates: `${compactDate(event.date)}/${compactDate(nextDate(event.date))}`,
    details: `委託服務：${event.commission.services.join('、')}\n狀態：${statusLabel[event.commission.status]}`,
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, '_blank', 'noopener,noreferrer');
}

function downloadCalendar(events: DeadlineEvent[]) {
  const body = events.map((event) => [
    'BEGIN:VEVENT',
    `UID:fulfill-${event.id}@calendar`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${compactDate(event.date)}`,
    `DTEND;VALUE=DATE:${compactDate(nextDate(event.date))}`,
    `SUMMARY:${escapeIcs(`${event.commission.orgName}｜${event.label}`)}`,
    `DESCRIPTION:${escapeIcs(`委託服務：${event.commission.services.join('、')}\n狀態：${statusLabel[event.commission.status]}`)}`,
    'END:VEVENT',
  ].join('\r\n')).join('\r\n');
  const content = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//FULFILL//Commission Calendar//ZH-TW\r\nCALSCALE:GREGORIAN\r\n${body}\r\nEND:VCALENDAR\r\n`;
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'fulfill-委託行程.ics';
  anchor.click();
  URL.revokeObjectURL(url);
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
