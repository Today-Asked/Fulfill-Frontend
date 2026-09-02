import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, Info, Send, Paperclip, Loader2, Briefcase } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useUpload } from "../../lib/useUpload";
import { getCommission, inviteCommissionArtist, listConversationCommissions, type Commission } from "../../lib/commissions";
import { submitReport, toggleBlock, type ReportReason } from "../../lib/creators";

const PAGE_SIZE = 50;

interface DbMessage {
  id: number;
  chat_id: number;
  sender_id: string;
  type: string;
  content: { text?: string; url?: string; commission_id?: number; kind?: string } | null;
  created_at: string;
}

interface OtherUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  artist_profiles: { id: number } | null;
}

export function ChatRoomPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const chatId = Number(id);
  const { upload, uploading } = useUpload();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [activeCommissions, setActiveCommissions] = useState<Commission[]>([]);
  const [showOrders, setShowOrders] = useState(false);

  // 這個聊天室提到的「未指定委託」——委託人可以在這裡一鍵邀請對方正式接案
  const [referencedCommission, setReferencedCommission] = useState<Commission | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 載入更早訊息時不要自動捲到底部
  const skipNextScrollRef = useRef(false);

  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  // 載入對話資訊 + 最新 50 則訊息
  useEffect(() => {
    if (!user || !chatId) return;

    async function load() {
      const { data: conv } = await supabase
        .from("conversations")
        .select(`
          usera:usera_id(id, username, name, avatar_url, bio, artist_profiles!artist_profiles_user_id_fkey(id)),
          userb:userb_id(id, username, name, avatar_url, bio, artist_profiles!artist_profiles_user_id_fkey(id))
        `)
        .eq("id", chatId)
        .single();

      if (conv) {
        const other = (conv.usera as any).id === user!.id ? conv.userb : conv.usera;
        setOtherUser(other as OtherUser);
      }

      // 倒序抓最新 PAGE_SIZE 則，再 reverse 成時間正序
      const { data: msgs } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id, type, content, created_at")
        .eq("chat_id", chatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (msgs) {
        setMessages([...msgs].reverse() as DbMessage[]);
        setHasMore(msgs.length === PAGE_SIZE);
      }

      // 標為已讀
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .neq("sender_id", user!.id)
        .is("read_at", null);
    }

    load();
  }, [user, chatId]);

  useEffect(() => {
    if (!chatId) return;
    listConversationCommissions(chatId)
      .then(setActiveCommissions)
      .catch(() => setActiveCommissions([]));
  }, [chatId]);

  // Realtime
  useEffect(() => {
    if (!user || !chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const msg = payload.new as DbMessage;
          if (msg.sender_id !== user!.id) {
            setMessages((prev) => [...prev, msg]);
            supabase.from("messages")
              .update({ read_at: new Date().toISOString() })
              .eq("id", msg.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, chatId]);

  // 載入更早訊息
  async function loadEarlier() {
    if (!messages.length || loadingEarlier) return;
    setLoadingEarlier(true);

    const oldest = messages[0].created_at;
    const { data } = await supabase
      .from("messages")
      .select("id, chat_id, sender_id, type, content, created_at")
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (data) {
      const older = [...data].reverse() as DbMessage[];
      skipNextScrollRef.current = true;
      setMessages((prev) => [...older, ...prev]);
      setHasMore(data.length === PAGE_SIZE);
    }
    setLoadingEarlier(false);
  }

  // 這串對話裡最新一次「諮詢」提到的委託 id
  const inquiredCommissionId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === "commission" && msg.content?.kind === "inquiry" && msg.content.commission_id) {
        return msg.content.commission_id;
      }
    }
    return null;
  }, [messages]);

  // 拿那則委託的即時狀態，判斷是否還能邀請（可能已經被別的對話搶先邀走了）
  useEffect(() => {
    if (!inquiredCommissionId) { setReferencedCommission(null); return; }
    getCommission(inquiredCommissionId)
      .then(setReferencedCommission)
      .catch(() => setReferencedCommission(null));
  }, [inquiredCommissionId]);

  const canInviteFromChat =
    Boolean(user) &&
    Boolean(otherUser?.artist_profiles) &&
    referencedCommission != null &&
    referencedCommission.clientId === user?.id &&
    referencedCommission.artistId == null &&
    referencedCommission.status === "pending";

  async function handleInviteFromChat() {
    if (!referencedCommission || !otherUser?.artist_profiles || !user || !chatId) return;
    setInviting(true);
    setInviteError("");
    try {
      await inviteCommissionArtist(referencedCommission.id, otherUser.artist_profiles.id);

      const { data: newMsg } = await supabase
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: user.id,
          type: "commission",
          content: {
            commission_id: referencedCommission.id,
            kind: "invited",
            text: `我邀請你正式接下「${referencedCommission.orgName}」，請到「訂單」頁確認接受。`,
          },
        })
        .select("id, chat_id, sender_id, type, content, created_at")
        .single();

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg as DbMessage]);
        await supabase.from("conversations")
          .update({ last_message_at: (newMsg as DbMessage).created_at })
          .eq("id", chatId);
      }
      setReferencedCommission((prev) => (prev ? { ...prev, artistId: otherUser.artist_profiles!.id } : prev));
    } catch (e) {
      setInviteError(e instanceof Error ? e.message : "邀請失敗，請重新整理再試一次。");
    } finally {
      setInviting(false);
    }
  }

  // 傳送文字
  const handleSend = async () => {
    if (!inputText.trim() || !user || !chatId || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const { data: newMsg } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: user.id, type: "text", content: { text } })
      .select("id, chat_id, sender_id, type, content, created_at")
      .single();

    if (newMsg) {
      setMessages((prev) => [...prev, newMsg as DbMessage]);
      await supabase.from("conversations")
        .update({ last_message_at: (newMsg as DbMessage).created_at })
        .eq("id", chatId);
    }
    setSending(false);
  };

  // 傳送圖片
  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !chatId) return;

    try {
      const { publicUrl } = await upload(file, { folder: "chat" });

      const { data: newMsg } = await supabase
        .from("messages")
        .insert({ chat_id: chatId, sender_id: user.id, type: "image", content: { url: publicUrl } })
        .select("id, chat_id, sender_id, type, content, created_at")
        .single();

      if (newMsg) {
        setMessages((prev) => [...prev, newMsg as DbMessage]);
        await supabase.from("conversations")
          .update({ last_message_at: (newMsg as DbMessage).created_at })
          .eq("id", chatId);
      }
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const displayName = otherUser?.name || otherUser?.username || "...";
  const avatarUrl = otherUser?.avatar_url;

  return (
    <div className="relative flex h-[calc(100dvh-82px)] flex-col rounded-2xl bg-[#141414] lg:h-[calc(100dvh-150px)]">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleImagePick}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/chat")} className="text-white">
            <ArrowLeft size={22} />
          </button>
          <button
            type="button"
            disabled={!otherUser?.username || !otherUser?.artist_profiles}
            onClick={() => otherUser?.username && navigate(`/creator/${encodeURIComponent(otherUser.username)}`)}
            className="flex items-center gap-3 rounded-xl pr-2 text-left transition-opacity hover:opacity-75 disabled:cursor-default disabled:hover:opacity-100"
            aria-label={`前往 ${displayName} 的個人主頁`}
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/10">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-medium text-white/40">{displayName[0]?.toUpperCase()}</span>
              )}
            </span>
            <span className="text-sm font-medium text-white">{displayName}</span>
          </button>
        </div>
        <button
          onClick={() => setShowSafety(true)}
          aria-label="封鎖或檢舉"
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"
        >
          <Info size={16} className="text-white" />
        </button>
      </div>

      {activeCommissions.length > 0 && (
        <div className="mx-4 mt-3 flex-shrink-0 overflow-hidden rounded-2xl border border-sky-300/15 bg-sky-400/[0.055]">
          <button type="button" onClick={() => setShowOrders((open) => !open)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.025]">
            <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-sky-300/10 text-sky-200"><Briefcase size={16} /></span>
            <span className="min-w-0 flex-1">
              <strong className="block text-sm font-medium text-white">進行中的委託{activeCommissions.length > 1 ? ` ${activeCommissions.length} 筆` : ""}</strong>
              <span className="mt-0.5 block truncate text-xs text-white/35">{activeCommissions.map((item) => item.orgName).join("、")}</span>
            </span>
            <ChevronDown size={17} className={`text-white/40 transition-transform ${showOrders ? "rotate-180" : ""}`} />
          </button>

          {showOrders && (
            <div className="grid max-h-64 gap-2 overflow-y-auto border-t border-white/8 p-3">
              {activeCommissions.map((commission) => (
                <div key={commission.id} className="rounded-2xl bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div><p className="text-sm font-semibold text-white">{commission.orgName}</p><p className="mt-1 text-xs text-white/35">{commission.services.join("、")}</p></div>
                    <span className="rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] text-emerald-200">{chatCommissionStatus(commission.status)}</span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <ChatOrderInfo label="初稿" value={commission.draftDueDate ? new Date(`${commission.draftDueDate}T00:00:00`).toLocaleDateString("zh-TW") : "未指定"} />
                    <ChatOrderInfo label="完稿 Deadline" value={commission.finalDueDate ? new Date(`${commission.finalDueDate}T00:00:00`).toLocaleDateString("zh-TW") : "未指定"} />
                    <ChatOrderInfo label="預算" value={formatChatBudget(commission)} />
                  </dl>
                  <button type="button" onClick={() => navigate('/orders')} className="mt-4 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 hover:bg-white/6 hover:text-white">前往訂單頁</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 委託人一鍵邀請對方正式接案 */}
      {canInviteFromChat && (
        <div className="mx-4 mt-3 flex-shrink-0 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-2 min-w-0">
            <Briefcase size={15} className="text-white/40 shrink-0" />
            <p className="text-xs text-white/60 truncate">「{referencedCommission?.orgName}」還沒有指定創作者</p>
          </div>
          <button
            onClick={handleInviteFromChat}
            disabled={inviting}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {inviting ? "邀請中…" : "邀請他接案"}
          </button>
        </div>
      )}
      {inviteError && (
        <p className="mx-4 mt-2 flex-shrink-0 text-xs text-red-400">{inviteError}</p>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 scroll-pb-4 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:hidden space-y-3">
        {/* 載入更早訊息 */}
        {hasMore && (
          <div className="flex justify-center pb-2">
            <button
              onClick={loadEarlier}
              disabled={loadingEarlier}
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 transition-colors py-1"
            >
              {loadingEarlier
                ? <Loader2 size={12} className="animate-spin" />
                : "↑ 載入更早訊息"}
            </button>
          </div>
        )}

        {messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;

          if (msg.type === "text") {
            const text = msg.content?.text ?? "";
            if (!text) return null;
            return (
              <div key={msg.id} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[72%] px-4 py-2.5 rounded-[20px] ${
                  isSent
                    ? "bg-white text-black rounded-br-md"
                    : "bg-white/10 border border-white/8 text-white rounded-bl-md"
                }`}>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{text}</p>
                </div>
              </div>
            );
          }

          if (msg.type === "commission") {
            const text = msg.content?.text ?? "";
            if (!text) return null;
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="max-w-[85%] rounded-2xl border border-white/10 bg-white/6 px-4 py-2.5 text-center">
                  <p className="text-xs text-white/60 leading-relaxed">{text}</p>
                </div>
              </div>
            );
          }

          if (msg.type === "image") {
            const url = msg.content?.url;
            if (!url) return null;
            return (
              <div key={msg.id} className={`flex ${isSent ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[60%] rounded-2xl overflow-hidden ${
                  isSent ? "rounded-br-md" : "rounded-bl-md"
                }`}>
                  <img src={url} alt="" className="w-full object-cover" loading="lazy" />
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* 上傳中佔位 */}
        {uploading && (
          <div className="flex justify-end">
            <div className="w-16 h-16 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center">
              <Loader2 size={18} className="text-gray-400 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 border-t border-white/6 px-4 pb-4 pt-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-white/6 border border-white/10 rounded-full px-4 h-11">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isComposing) handleSend();
              }}
              placeholder="發送訊息......"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              aria-label="傳送訊息"
              className="ml-2 grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white text-black transition-all hover:opacity-90 disabled:bg-transparent disabled:text-gray-600 disabled:opacity-60"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            {uploading
              ? <Loader2 size={18} className="text-gray-400 animate-spin" />
              : <Paperclip size={18} className="text-gray-400" />}
          </button>
        </div>
      </div>

      {showSafety && user && otherUser && (
        <ChatSafetyDialog
          creatorName={displayName}
          targetId={otherUser.id}
          reporterId={user.id}
          onClose={() => setShowSafety(false)}
          onBlocked={() => navigate('/chat')}
        />
      )}
    </div>
  );
}

function ChatOrderInfo({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[10px] text-white/30">{label}</dt><dd className="mt-1 text-white/65">{value}</dd></div>;
}

function chatCommissionStatus(status: Commission["status"]) {
  return status === "accepted" ? "已接受" : status === "in_progress" ? "製作中" : status === "delivered" ? "已交件" : status;
}

function formatChatBudget(commission: Commission) {
  if (commission.budgetMin == null && commission.budgetMax == null) return "另議";
  const min = (commission.budgetMin ?? 0).toLocaleString();
  const max = (commission.budgetMax ?? commission.budgetMin ?? 0).toLocaleString();
  return `NT$ ${min}–${max}`;
}

function ChatSafetyDialog({ creatorName, targetId, reporterId, onClose, onBlocked }: { creatorName: string; targetId: string; reporterId: string; onClose: () => void; onBlocked: () => void }) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function report() {
    setBusy(true);
    setError('');
    try {
      await submitReport({ reporterId, targetType: 'creator', targetId, reason, detail: detail.trim() });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '檢舉送出失敗。');
      setBusy(false);
    }
  }

  async function block() {
    setBusy(true);
    setError('');
    try {
      await toggleBlock(reporterId, targetId);
      onClose();
      onBlocked();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '封鎖失敗。');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="chat-safety-title">
      <button type="button" aria-label="關閉安全選項" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/15 bg-[#171717] p-6 shadow-2xl">
        <h2 id="chat-safety-title" className="text-xl font-semibold text-white">{mode === 'menu' ? '安全選項' : `檢舉 ${creatorName}`}</h2>
        {mode === 'menu' ? (
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => setMode('report')} className="rounded-xl border border-white/12 px-4 py-3 text-left text-sm text-white/70 hover:bg-white/5">檢舉帳號或內容</button>
            <button type="button" disabled={busy} onClick={() => void block()} className="rounded-xl border border-red-400/20 px-4 py-3 text-left text-sm text-red-200 hover:bg-red-500/8">封鎖 {creatorName}</button>
            <p className="mt-2 text-xs leading-5 text-white/35">封鎖後，你將離開這個聊天室，對方也會從創作者搜尋結果移除。</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="text-sm text-white/60">原因
              <select value={reason} onChange={(event) => setReason(event.target.value as ReportReason)} className="input mt-2 rounded-xl">
                <option value="impersonation">冒用身分</option><option value="stolen_work">盜用作品</option><option value="harassment">騷擾</option><option value="spam">垃圾訊息</option><option value="inappropriate">不當內容</option><option value="other">其他</option>
              </select>
            </label>
            <label className="text-sm text-white/60">補充說明
              <textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={1000} rows={5} className="input mt-2 resize-none rounded-xl" />
            </label>
            <button type="button" disabled={busy} onClick={() => void report()} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-40">送出檢舉</button>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button type="button" onClick={onClose} className="mt-5 rounded-full px-3 py-1.5 text-sm text-white/45 hover:bg-white/8">取消</button>
      </div>
    </div>
  );
}
