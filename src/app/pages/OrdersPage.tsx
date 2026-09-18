import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Download, FileText, Inbox, Info as InfoIcon, MessageCircle, Paperclip, Send, Truck, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import {
  acceptCommission,
  confirmDraft,
  confirmFinal,
  declineCommission,
  listCommissions,
  markCommissionViewed,
  markDraftDelivered,
  markFinalDelivered,
  type Commission,
  type DeclineReason,
} from "../../lib/commissions";

interface ProgressStep {
  key: string;
  label: string;
  done: boolean;
}

/** Only meaningful once a commission has actually started — pending/rejected never reach here. */
function buildProgressSteps(item: Commission): ProgressStep[] {
  return [
    { key: "accepted", label: "已接單", done: true },
    { key: "draft_delivered", label: "初稿交付", done: !!item.draftDeliveredAt },
    { key: "draft_confirmed", label: "初稿確認", done: !!item.draftConfirmedAt },
    { key: "final_delivered", label: "完稿交付", done: !!item.finalDeliveredAt },
    { key: "final_confirmed", label: "完稿確認", done: !!item.finalConfirmedAt },
  ];
}

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

/** Rejected commissions have no chip of their own — they only surface under "全部". */
const STATUS_FILTERS: { key: string; label: string; statuses: Commission["status"][] }[] = [
  { key: "pending", label: "待回覆", statuses: ["pending"] },
  { key: "in_progress", label: "進行中", statuses: ["accepted", "in_progress", "delivered"] },
  { key: "completed", label: "已完成", statuses: ["completed"] },
];

/** Ties the received/sent tab to a consistent accent used across the tab pill, card border, and calendar. */
const ROLE_THEME = {
  received: {
    tabActive: "bg-sky-500 text-white",
    cardBorder: "border-l-sky-400/70",
    icon: "text-sky-300",
    tagSoft: "bg-sky-400/15 text-sky-200",
    tagStrong: "bg-sky-400/25 text-sky-100",
    ring: "border-sky-300/50 bg-sky-400/10",
    dotSoft: "bg-sky-300",
    dotStrong: "bg-sky-500",
  },
  sent: {
    tabActive: "bg-indigo-500 text-white",
    cardBorder: "border-l-indigo-400/70",
    icon: "text-indigo-300",
    tagSoft: "bg-indigo-400/15 text-indigo-200",
    tagStrong: "bg-indigo-400/25 text-indigo-100",
    ring: "border-indigo-300/50 bg-indigo-400/10",
    dotSoft: "bg-indigo-300",
    dotStrong: "bg-indigo-500",
  },
} as const;

export function OrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [role, setRole] = useState<"received" | "sent">(() => searchParams.get("view") === "sent" ? "sent" : "received");
  const [items, setItems] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [declining, setDeclining] = useState<Commission | null>(null);
  const [viewing, setViewing] = useState<Commission | null>(null);
  /** Empty set reads as "全部" — clicking a specific chip clears that implicit default. */
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());

  const theme = ROLE_THEME[role];

  const filteredItems = useMemo(() => {
    if (statusFilters.size === 0) return items;
    const allowed = new Set(STATUS_FILTERS.filter((f) => statusFilters.has(f.key)).flatMap((f) => f.statuses));
    return items.filter((item) => allowed.has(item.status));
  }, [items, statusFilters]);

  function toggleStatusFilter(key: string) {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function reload() {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const list = await listCommissions(role, user.id);
      setItems(list);
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

  async function deliverDraft(item: Commission) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    try {
      await markDraftDelivered(item, user.id);
      await reload();
      setViewing((prev) => (prev && prev.id === item.id ? { ...prev, draftDeliveredAt: new Date().toISOString(), status: "in_progress" } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "標記初稿交付失敗。");
    } finally {
      setBusyId(null);
    }
  }

  async function deliverFinal(item: Commission) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    try {
      await markFinalDelivered(item, user.id);
      await reload();
      setViewing((prev) => (prev && prev.id === item.id ? { ...prev, finalDeliveredAt: new Date().toISOString(), status: "delivered" } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "標記完稿交付失敗。");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDraftOrder(item: Commission) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    try {
      await confirmDraft(item, user.id);
      await reload();
      setViewing((prev) => (prev && prev.id === item.id ? { ...prev, draftConfirmedAt: new Date().toISOString() } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認初稿失敗。");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmFinalOrder(item: Commission) {
    if (!user) return;
    setBusyId(item.id);
    setError("");
    try {
      await confirmFinal(item, user.id);
      await reload();
      setViewing((prev) => (prev && prev.id === item.id ? { ...prev, finalConfirmedAt: new Date().toISOString(), status: "completed" } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : "確認完稿失敗。");
    } finally {
      setBusyId(null);
    }
  }

  function renderCommissionCard(item: Commission) {
    const itemRole = role;
    const canDeliverDraft = itemRole === "received" && (item.status === "accepted" || item.status === "in_progress") && !item.draftDeliveredAt;
    const canDeliverFinal = itemRole === "received" && !!item.draftConfirmedAt && !item.finalDeliveredAt;
    const canConfirmDraft = itemRole === "sent" && !!item.draftDeliveredAt && !item.draftConfirmedAt;
    const canConfirmFinal = itemRole === "sent" && !!item.finalDeliveredAt && !item.finalConfirmedAt;
    return (
      <article id={`commission-${item.id}`} key={item.id} onClick={() => { if (!item.viewedAt && itemRole === 'received') void markCommissionViewed(item.id); }} className={`scroll-mt-24 border-y border-r border-white/10 border-l-4 ${theme.cardBorder} bg-white/[0.035] p-5 lg:p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-xs text-white/40">
              {itemRole === 'received' ? <Inbox size={14} className={theme.icon} /> : <Send size={14} className={theme.icon} />}
              <Clock3 size={14} />{new Date(item.createdAt).toLocaleDateString('zh-TW')}
            </div>
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
        {item.status !== 'pending' && item.status !== 'rejected' && <ProgressLine item={item} />}
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
          {canDeliverDraft && <button disabled={busyId === item.id} onClick={() => void deliverDraft(item)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"><Truck size={16} />標記初稿已交付</button>}
          {canDeliverFinal && <button disabled={busyId === item.id} onClick={() => void deliverFinal(item)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"><Truck size={16} />標記完稿已交付</button>}
          {canConfirmDraft && <button disabled={busyId === item.id} onClick={() => void confirmDraftOrder(item)} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />確認初稿完成</button>}
          {canConfirmFinal && <button disabled={busyId === item.id} onClick={() => void confirmFinalOrder(item)} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />確認完稿・結案</button>}
          {item.chatId && <button onClick={() => navigate(`/chat/${item.chatId}`)} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70"><MessageCircle size={16} />開啟對話</button>}
          <button onClick={(e) => { e.stopPropagation(); setViewing(item); }} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30"><InfoIcon size={16} />查看完整詳情</button>
        </div>
      </article>
    );
  }

  return (
    <div className="pt-6 lg:pt-10">
      <CommissionCalendar
        commissions={items}
        role={role}
        onOpenCommission={(commission) => setViewing(commission)}
      />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs tracking-[0.18em] text-white/40">ORDERS</p>
          <h1 className="text-2xl font-semibold tracking-tight text-white">訂單</h1>
        </div>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-1">
          {(['received', 'sent'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setRole(value)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${role === value ? ROLE_THEME[value].tabActive : 'text-white/40 hover:text-white/60'}`}
            >
              {value === 'received' ? '收到的' : '送出的'}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setStatusFilters(new Set())}
          className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${statusFilters.size === 0 ? 'border-white/70 bg-white text-black' : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'}`}
        >
          全部
        </button>
        {STATUS_FILTERS.map((filter) => {
          const active = statusFilters.has(filter.key);
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => toggleStatusFilter(filter.key)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${active ? 'border-white/70 bg-white text-black' : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/60'}`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {error && <div role="alert" className="mb-5 border-l-2 border-red-400 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</div>}

      {loading ? (
        <div className="grid gap-3"><Skeleton /><Skeleton /></div>
      ) : filteredItems.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center border border-dashed border-white/15 bg-white/[0.02] px-6 text-center">
          {role === "received" ? <Inbox className="mb-4 text-white/25" /> : <Send className="mb-4 text-white/25" />}
          <h2 className="font-medium text-white">{items.length === 0 ? `目前沒有${role === "received" ? "收到" : "送出"}的訂單` : "沒有符合篩選條件的訂單"}</h2>
          <p className="mt-2 text-sm text-white/40">{items.length === 0 ? (role === "received" ? "收到的合作邀請與委託會顯示在這裡。" : "你送出的委託會顯示在這裡。") : "試著調整上方的狀態篩選。"}</p>
          {role === "sent" && items.length === 0 && <button onClick={() => navigate('/search')} className="mt-5 bg-white px-5 py-2.5 text-sm font-semibold text-black">搜尋創作者</button>}
        </div>
      ) : (
        <div className="grid gap-3">
          {filteredItems.map((item) => renderCommissionCard(item))}
        </div>
      )}

      {declining && <DeclineDialog item={declining} onClose={() => setDeclining(null)} onDone={async () => { setDeclining(null); await reload(); }} />}

      {viewing && (
        <CommissionDetailModal
          item={viewing}
          myUserId={user?.id ?? null}
          busy={busyId === viewing.id}
          onClose={() => setViewing(null)}
          onAccept={() => void accept(viewing)}
          onDecline={() => { setDeclining(viewing); setViewing(null); }}
          onOpenChat={() => navigate(`/chat/${viewing.chatId}`)}
          onDeliverDraft={() => void deliverDraft(viewing)}
          onDeliverFinal={() => void deliverFinal(viewing)}
          onConfirmDraft={() => void confirmDraftOrder(viewing)}
          onConfirmFinal={() => void confirmFinalOrder(viewing)}
        />
      )}
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

function startOfWeek(date: Date) { const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()); d.setDate(d.getDate() - d.getDay()); return d; }
function addDays(date: Date, amount: number) { const d = new Date(date); d.setDate(d.getDate() + amount); return d; }

function CommissionCalendar({ commissions, role, onOpenCommission }: { commissions: Commission[]; role: "received" | "sent"; onOpenCommission: (commission: Commission) => void }) {
  const theme = ROLE_THEME[role];
  const events = useMemo<DeadlineEvent[]>(() => commissions
    .filter((item) => item.status !== "rejected" && item.status !== "completed")
    .flatMap((item) => [
      ...(item.draftDueDate ? [{ id: `${item.id}-draft`, date: item.draftDueDate, kind: "draft" as const, label: "初稿期限", commission: item }] : []),
      ...(item.finalDueDate ? [{ id: `${item.id}-final`, date: item.finalDueDate, kind: "final" as const, label: "完稿 Deadline", commission: item }] : []),
    ])
    .sort((a, b) => a.date.localeCompare(b.date)), [commissions]);

  const [expanded, setExpanded] = useState(false);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Re-centers on the nearest upcoming event whenever the visible direction (收到/送出) changes.
  useEffect(() => { setInitialized(false); }, [role]);

  useEffect(() => {
    if (initialized) return;
    if (events.length === 0) { setInitialized(true); return; }
    const today = localDateKey(new Date());
    const firstUpcoming = events.find((event) => event.date >= today) ?? events[0];
    const eventDate = parseLocalDate(firstUpcoming.date);
    setMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    setWeekStart(startOfWeek(eventDate));
    setSelectedDate(firstUpcoming.date);
    setInitialized(true);
  }, [events, initialized]);

  // Keeps the month header in sync with whichever month owns most of the visible week.
  useEffect(() => {
    const dominant = addDays(weekStart, 3);
    setMonth((prev) => (prev.getFullYear() === dominant.getFullYear() && prev.getMonth() === dominant.getMonth() ? prev : new Date(dominant.getFullYear(), dominant.getMonth(), 1)));
  }, [weekStart]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = new Date(year, monthIndex, 1).getDay();
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const cellCount = Math.ceil((offset + days) / 7) * 7;
  const monthDates = Array.from({ length: cellCount }, (_, index) => {
    const day = index - offset + 1;
    return day > 0 && day <= days ? new Date(year, monthIndex, day) : null;
  });
  const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const selectedEvents = events.filter((event) => event.date === selectedDate);

  function toggleExpanded() {
    if (expanded) {
      setWeekStart(startOfWeek(selectedDate ? parseLocalDate(selectedDate) : new Date(year, monthIndex, 1)));
    }
    setExpanded((v) => !v);
  }

  function renderDayCell(date: Date) {
    const key = localDateKey(date);
    const dayEvents = events.filter((event) => event.date === key);
    const selected = key === selectedDate;
    const today = key === localDateKey(new Date());
    return (
      <button key={key} type="button" onClick={() => setSelectedDate(key)} className={`flex min-h-11 flex-col items-center gap-0.5 overflow-hidden rounded-lg border py-1 transition-colors ${selected ? theme.ring : "border-transparent hover:bg-white/5"}`}>
        <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${today ? "bg-white text-black" : "text-white/55"}`}>{date.getDate()}</span>
        <span className="flex h-1.5 items-center justify-center gap-0.5">
          {dayEvents.slice(0, 4).map((event) => <span key={event.id} className={`h-1.5 w-1.5 rounded-full ${event.kind === "draft" ? theme.dotSoft : theme.dotStrong}`} />)}
        </span>
      </button>
    );
  }

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
        <div className="flex items-center gap-2"><CalendarDays size={16} className={theme.icon} /><h2 className="text-sm font-semibold text-white">委託行程</h2></div>
        <button type="button" disabled={events.length === 0} onClick={() => downloadCalendar(events)} className="flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-white/65 hover:bg-white/10 disabled:opacity-30">
          <Download size={13} />匯出
        </button>
      </div>

      <div className="p-3">
        <button type="button" onClick={toggleExpanded} className="mb-2 flex items-center gap-1 text-xs text-white/45 hover:text-white">
          {expanded ? <><ChevronUp size={14} />收合為本週</> : <><ChevronDown size={14} />查看完整月曆</>}
        </button>

        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => (expanded ? setMonth(new Date(year, monthIndex - 1, 1)) : setWeekStart(addDays(weekStart, -7)))}
            aria-label={expanded ? "上個月" : "上一週"}
            className="grid h-7 w-7 place-items-center rounded-full text-white/50 hover:bg-white/8 hover:text-white"
          ><ChevronLeft size={16} /></button>
          <strong className="text-xs font-medium text-white">{year} 年 {monthIndex + 1} 月</strong>
          <button
            type="button"
            onClick={() => (expanded ? setMonth(new Date(year, monthIndex + 1, 1)) : setWeekStart(addDays(weekStart, 7)))}
            aria-label={expanded ? "下個月" : "下一週"}
            className="grid h-7 w-7 place-items-center rounded-full text-white/50 hover:bg-white/8 hover:text-white"
          ><ChevronRight size={16} /></button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] text-white/25">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day} className="pb-1">{day}</span>)}
        </div>
        {expanded ? (
          <div className="grid grid-cols-7 gap-0.5">
            {monthDates.map((date, index) => date == null ? <span key={`blank-${index}`} className="min-h-11" /> : renderDayCell(date))}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {weekDates.map((date) => renderDayCell(date))}
          </div>
        )}

        <div className="mt-2 border-t border-white/8 pt-2">
          <h3 className="mb-1 text-xs font-medium text-white/50">{selectedDate ? formatCalendarDate(selectedDate) : "選擇日期"}</h3>
          {selectedEvents.length === 0 ? (
            <p className="py-2 text-xs text-white/30">這天沒有委託行程</p>
          ) : (
            <div className="grid">
              {selectedEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenCommission(event.commission)}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left hover:bg-white/5"
                >
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-medium ${event.kind === "draft" ? theme.tagSoft : theme.tagStrong}`}>{event.kind === "draft" ? "初稿" : "完稿"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-white/80">{event.commission.orgName}</span>
                  <span className="shrink-0 text-xs text-white/30">{statusLabel[event.commission.status]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
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

function ProgressLine({ item }: { item: Commission }) {
  const steps = buildProgressSteps(item);
  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <p className="mb-3 text-xs text-white/35">進度</p>
      <div className="flex items-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] ${step.done ? "border-emerald-300/60 bg-emerald-300/15 text-emerald-200" : "border-white/15 text-white/30"}`}>
                {step.done ? <Check size={12} /> : index + 1}
              </div>
              <span className={`whitespace-nowrap text-[10px] ${step.done ? "text-white/70" : "text-white/30"}`}>{step.label}</span>
            </div>
            {index < steps.length - 1 && <div className={`mx-1 h-px flex-1 ${steps[index + 1].done ? "bg-emerald-300/40" : "bg-white/10"}`} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
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

/**
 * Everything captured when the commission was created — the calendar's
 * "查看訂單" used to either jump straight to chat or scroll-into-view a card
 * in the current role tab, which silently did nothing if the commission
 * belonged to the *other* tab. This works regardless of which tab is active.
 */
function CommissionDetailModal({
  item,
  myUserId,
  busy,
  onClose,
  onAccept,
  onDecline,
  onOpenChat,
  onDeliverDraft,
  onDeliverFinal,
  onConfirmDraft,
  onConfirmFinal,
}: {
  item: Commission;
  myUserId: string | null;
  busy: boolean;
  onClose: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onOpenChat: () => void;
  onDeliverDraft: () => void;
  onDeliverFinal: () => void;
  onConfirmDraft: () => void;
  onConfirmFinal: () => void;
}) {
  const iAmClient = item.clientId === myUserId;
  const canDeliverDraft = !iAmClient && (item.status === "accepted" || item.status === "in_progress") && !item.draftDeliveredAt;
  const canDeliverFinal = !iAmClient && !!item.draftConfirmedAt && !item.finalDeliveredAt;
  const canConfirmDraft = iAmClient && !!item.draftDeliveredAt && !item.draftConfirmedAt;
  const canConfirmFinal = iAmClient && !!item.finalDeliveredAt && !item.finalConfirmedAt;
  const counterpartLabel = iAmClient
    ? (item.artistUserId ? `邀請 ${item.artistName}` : "公開委託（尚未有人接下）")
    : `來自 ${item.clientName}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="commission-detail-title">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto border border-white/15 bg-[#171717] p-6 shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-white/40"><Clock3 size={13} />{new Date(item.createdAt).toLocaleDateString('zh-TW')}</div>
            <h2 id="commission-detail-title" className="mt-1.5 text-xl font-semibold text-white">{item.orgName}</h2>
            <p className="mt-1 text-sm text-white/50">{counterpartLabel}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={`border px-3 py-1 text-xs ${item.status === 'pending' ? 'border-amber-300/30 text-amber-200' : item.status === 'rejected' ? 'border-white/10 text-white/35' : 'border-emerald-300/30 text-emerald-200'}`}>{statusLabel[item.status]}</span>
            <button onClick={onClose} aria-label="關閉" className="text-white/40 hover:text-white"><X size={20} /></button>
          </div>
        </div>

        <p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-white/70">{item.description || "未填寫合作需求。"}</p>

        <dl className="mt-5 grid gap-4 border-t border-white/8 pt-4 text-sm sm:grid-cols-2">
          <Info label="服務" value={item.services.join('、') || '未填寫'} />
          <Info label="預算" value={formatBudget(item)} />
          <Info label="初稿期限" value={item.draftDueDate ? new Date(item.draftDueDate).toLocaleDateString('zh-TW') : '未指定'} />
          <Info label="完稿 Deadline" value={item.finalDueDate ? new Date(item.finalDueDate).toLocaleDateString('zh-TW') : '未指定'} />
        </dl>

        {item.status !== 'pending' && item.status !== 'rejected' && <ProgressLine item={item} />}

        {item.contact && (
          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="text-xs text-white/35">聯絡方式</p>
            <p className="mt-1 text-sm text-white/75">{item.contact}</p>
          </div>
        )}

        {item.hasAssets && (
          <div className="mt-4 flex items-center gap-2 text-sm text-white/60">
            <Paperclip size={15} className="text-white/35" />已備妥文字、Logo、照片或其他製作素材
          </div>
        )}

        {item.referenceUrls.length > 0 && (
          <div className="mt-4 border-t border-white/8 pt-4">
            <p className="mb-2 text-xs text-white/35">參考連結</p>
            <div className="grid gap-1.5">
              {item.referenceUrls.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-sm text-sky-300 hover:underline">
                  <FileText size={13} className="shrink-0" />{url}
                </a>
              ))}
            </div>
          </div>
        )}

        {item.status === 'rejected' && item.declineReason && (
          <div className="mt-4 border-l-2 border-white/10 pl-4">
            <p className="text-xs text-white/35">{iAmClient ? '對方婉拒原因' : '你婉拒的原因'}</p>
            <p className="mt-1 text-sm text-white/70">{declineReasonLabel[item.declineReason]}</p>
            {item.replyNote && <p className="mt-1 whitespace-pre-wrap text-sm text-white/50">{item.replyNote}</p>}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-white/8 pt-5">
          {!iAmClient && item.status === 'pending' && <>
            <button disabled={busy} onClick={onDecline} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30"><X size={16} />婉拒</button>
            <button disabled={busy} onClick={onAccept} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />接受並開始對話</button>
          </>}
          {canDeliverDraft && <button disabled={busy} onClick={onDeliverDraft} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"><Truck size={16} />標記初稿已交付</button>}
          {canDeliverFinal && <button disabled={busy} onClick={onDeliverFinal} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70 hover:border-white/30 disabled:opacity-40"><Truck size={16} />標記完稿已交付</button>}
          {canConfirmDraft && <button disabled={busy} onClick={onConfirmDraft} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />確認初稿完成</button>}
          {canConfirmFinal && <button disabled={busy} onClick={onConfirmFinal} className="flex items-center gap-2 bg-white px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"><Check size={16} />確認完稿・結案</button>}
          {item.chatId && <button onClick={onOpenChat} className="flex items-center gap-2 border border-white/15 px-4 py-2.5 text-sm text-white/70"><MessageCircle size={16} />開啟對話</button>}
        </div>
      </div>
    </div>
  );
}
