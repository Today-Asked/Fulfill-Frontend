import React, { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Send, Paperclip, Loader2, Briefcase } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useUpload } from "../../lib/useUpload";
import { confirmDraft, confirmFinal, getCommission, inviteCommissionArtist, listConversationCommissions, type Commission } from "../../lib/commissions";
import { submitReport, toggleBlock, type ReportReason } from "../../lib/creators";

const PAGE_SIZE = 50;

interface DbMessage {
  id: number;
  chat_id: number;
  sender_id: string;
  type: string;
  content: { text?: string; url?: string; commission_id?: number; kind?: string } | null;
  created_at: string;
  commission_id: number | null;
}

interface OtherUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  artist_profiles: { id: number } | null;
}

interface TabDragState { id: number; startX: number; startY: number; moved: boolean; }

const MESSAGE_SELECT = "id, chat_id, sender_id, type, content, created_at, commission_id";

export function ChatRoomPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const chatId = Number(id);
  const { upload, uploading } = useUpload();

  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  // "總覽" (null) 或某一筆委託的討論串——messages 永遠只代表目前這個分頁的內容，
  // 不是整個聊天室的所有訊息，切分頁時會整批重新抓
  const [activeTab, setActiveTab] = useState<number | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [threads, setThreads] = useState<Commission[]>([]);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");

  // 這個聊天室提到的「未指定委託」——委託人可以在這裡一鍵邀請對方正式接案。
  // 諮詢訊息永遠留在總覽分頁（委託被接受前還沒有自己的討論串），所以這個只
  // 會在切到「總覽」時算得出東西，切到某個委託分頁時自然是 null。
  const [referencedCommission, setReferencedCommission] = useState<Commission | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // 載入更早訊息時不要自動捲到底部
  const skipNextScrollRef = useRef(false);
  // 拖移分頁調整順序——「總覽」不參與，永遠固定第一個
  const tabDragRef = useRef<TabDragState | null>(null);

  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText]);

  // 載入對話資訊——一個聊天室只需要載一次，換分頁不用重跑
  useEffect(() => {
    if (!user || !chatId) return;
    setActiveTab(null); // 換到不同聊天室時重置回總覽

    supabase
      .from("conversations")
      .select(`
        usera:usera_id(id, username, name, avatar_url, bio, artist_profiles!artist_profiles_user_id_fkey(id)),
        userb:userb_id(id, username, name, avatar_url, bio, artist_profiles!artist_profiles_user_id_fkey(id))
      `)
      .eq("id", chatId)
      .single()
      .then(({ data: conv }) => {
        if (!conv) return;
        const other = (conv.usera as any).id === user!.id ? conv.userb : conv.usera;
        setOtherUser(other as OtherUser);
      });
  }, [user, chatId]);

  // 這個聊天室裡曾經被接受過的委託——每一筆一個分頁。包含 completed，讓已
  // 完成的委託分頁繼續留著；rejected 不會出現，因為委託要被接受才會有 chat_id。
  useEffect(() => {
    if (!chatId) return;
    listConversationCommissions(chatId)
      .then(setThreads)
      .catch(() => setThreads([]));
  }, [chatId]);

  // 載入「目前分頁」的最新訊息——換分頁時整批重抓，不是從已載入的訊息裡篩選
  async function loadThread(commissionId: number | null) {
    if (!user || !chatId) return;
    setLoadingMessages(true);

    let query = supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    query = commissionId == null ? query.is("commission_id", null) : query.eq("commission_id", commissionId);

    const { data: msgs } = await query;
    setMessages(msgs ? ([...msgs].reverse() as DbMessage[]) : []);
    setHasMore((msgs?.length ?? 0) === PAGE_SIZE);
    setLoadingMessages(false);

    let markRead = supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("chat_id", chatId)
      .neq("sender_id", user.id)
      .is("read_at", null);
    markRead = commissionId == null ? markRead.is("commission_id", null) : markRead.eq("commission_id", commissionId);
    await markRead;
  }

  useEffect(() => {
    void loadThread(activeTab);
  }, [user, chatId, activeTab]);

  // Realtime——訂閱整個 chat_id，但只有屬於目前分頁的訊息才會被加進畫面；
  // 屬於其他分頁的訊息不會遺失，使用者切過去時 loadThread 會重新抓到。
  useEffect(() => {
    if (!user || !chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}:${activeTab ?? "general"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const msg = payload.new as DbMessage;
          if (msg.sender_id === user!.id) return;
          if ((msg.commission_id ?? null) !== activeTab) return;
          setMessages((prev) => [...prev, msg]);
          supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", msg.id);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, chatId, activeTab]);

  // 載入更早訊息——一樣只在目前分頁裡找
  async function loadEarlier() {
    if (!messages.length || loadingEarlier) return;
    setLoadingEarlier(true);

    const oldest = messages[0].created_at;
    let query = supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("chat_id", chatId)
      .is("deleted_at", null)
      .lt("created_at", oldest)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    query = activeTab == null ? query.is("commission_id", null) : query.eq("commission_id", activeTab);

    const { data } = await query;
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
        .select(MESSAGE_SELECT)
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

  // 買家確認初稿／完稿——現在就在目前分頁的委託卡片裡按，不用點開任何下拉。
  // 只會在該委託自己的分頁被顯示，所以收到的訊息一定屬於目前分頁，直接接上去就好
  async function handleConfirmMilestone(commission: Commission, kind: "draft" | "final") {
    if (!user) return;
    setActionBusyId(commission.id);
    setActionError("");
    try {
      const posted = kind === "draft" ? await confirmDraft(commission, user.id) : await confirmFinal(commission, user.id);
      if (posted) setMessages((prev) => [...prev, posted as DbMessage]);

      setThreads((prev) =>
        prev.map((item) =>
          item.id === commission.id
            ? kind === "draft"
              ? { ...item, draftConfirmedAt: new Date().toISOString() }
              : { ...item, finalConfirmedAt: new Date().toISOString(), status: "completed" }
            : item,
        ),
      );
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "操作失敗，請重新整理再試一次。");
    } finally {
      setActionBusyId(null);
    }
  }

  // 拖移委託分頁調整順序（純前端排序，重新整理會回到依建立時間排）。
  // 用 pointer event 而不是 HTML5 drag-and-drop，跟 CreatePage.tsx 的圖片排序
  // 同一套寫法，觸控裝置也能用。
  function moveThread(sourceId: number, targetId: number) {
    setThreads((current) => {
      const from = current.findIndex((thread) => thread.id === sourceId);
      const to = current.findIndex((thread) => thread.id === targetId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function handleTabPointerDown(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    tabDragRef.current = { id, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTabPointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = tabDragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
    drag.moved = true;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-thread-id]");
    const targetId = target?.dataset.threadId ? Number(target.dataset.threadId) : null;
    if (targetId != null && targetId !== drag.id) moveThread(drag.id, targetId);
  }

  // 沒有明顯移動就當成一般點擊——切到那個分頁；有拖移過就不切，維持原本顯示的分頁
  function handleTabPointerUp(event: React.PointerEvent<HTMLButtonElement>, id: number) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const drag = tabDragRef.current;
    tabDragRef.current = null;
    if (drag && !drag.moved) setActiveTab(id);
  }

  // 傳送文字——帶上目前分頁的 commission_id，訊息就會落在正確的討論串裡
  const handleSend = async () => {
    if (!inputText.trim() || !user || !chatId || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const { data: newMsg } = await supabase
      .from("messages")
      .insert({ chat_id: chatId, sender_id: user.id, type: "text", content: { text }, commission_id: activeTab })
      .select(MESSAGE_SELECT)
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
        .insert({ chat_id: chatId, sender_id: user.id, type: "image", content: { url: publicUrl }, commission_id: activeTab })
        .select(MESSAGE_SELECT)
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
  const activeThread = activeTab == null ? null : threads.find((t) => t.id === activeTab) ?? null;

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

      {/* 委託分頁——總覽固定第一個，後面依委託建立時間排，長得像網頁分頁（底線標示目前分頁） */}
      {threads.length > 0 && (
        <div className="flex-shrink-0 px-4 pt-3">
          <div className="flex gap-5 overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className={`shrink-0 border-b-2 pb-2.5 text-xs font-medium transition-colors ${activeTab === null ? "border-white text-white" : "border-transparent text-white/40 hover:text-white/70"}`}
            >
              總覽
            </button>
            {threads.map((thread) => {
              const done = thread.status === "completed";
              const active = activeTab === thread.id;
              return (
                <button
                  key={thread.id}
                  type="button"
                  data-thread-id={thread.id}
                  onPointerDown={(event) => handleTabPointerDown(event, thread.id)}
                  onPointerMove={handleTabPointerMove}
                  onPointerUp={(event) => handleTabPointerUp(event, thread.id)}
                  onPointerCancel={(event) => handleTabPointerUp(event, thread.id)}
                  className={`shrink-0 max-w-[9rem] touch-none select-none truncate border-b-2 pb-2.5 text-xs font-medium transition-colors ${
                    active ? "border-white text-white" : done ? "border-transparent text-white/25 hover:text-white/40" : "border-transparent text-white/40 hover:text-white/70"
                  }`}
                >
                  {done ? "✓ " : ""}{thread.orgName}
                </button>
              );
            })}
          </div>

          {activeThread && (
            <CommissionThreadCard
              commission={activeThread}
              myUserId={user?.id ?? null}
              busy={actionBusyId === activeThread.id}
              error={actionError}
              onConfirmDraft={() => void handleConfirmMilestone(activeThread, "draft")}
              onConfirmFinal={() => void handleConfirmMilestone(activeThread, "final")}
            />
          )}
        </div>
      )}

      {/* 委託人一鍵邀請對方正式接案——只有在總覽分頁才會算出東西 */}
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
        {loadingMessages ? (
          <div className="flex justify-center pt-10">
            <Loader2 size={20} className="animate-spin text-white/30" />
          </div>
        ) : (
          <>
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
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 border-t border-white/6 px-4 pb-4 pt-2">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            {uploading
              ? <Loader2 size={18} className="text-gray-400 animate-spin" />
              : <Paperclip size={18} className="text-gray-400" />}
          </button>
          <div className="flex-1 flex items-end bg-white/6 border border-white/10 rounded-2xl px-4 py-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="發送訊息......"
              rows={1}
              className="flex-1 resize-none bg-transparent py-1 text-sm text-white outline-none placeholder:text-gray-600 max-h-32 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || sending}
            aria-label="傳送訊息"
            className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-full bg-white text-black transition-all hover:opacity-90 disabled:bg-white/8 disabled:text-gray-600 disabled:opacity-60"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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

interface ThreadStep {
  label: string;
  done: boolean;
}

function buildThreadSteps(commission: Commission): ThreadStep[] {
  return [
    { label: "已接單", done: true },
    { label: "初稿交付", done: !!commission.draftDeliveredAt },
    { label: "初稿確認", done: !!commission.draftConfirmedAt },
    { label: "完稿交付", done: !!commission.finalDeliveredAt },
    { label: "完稿確認", done: !!commission.finalConfirmedAt },
  ];
}

/** The card shown under a commission's own tab — progress stepper + whatever action is the client's turn to take. */
function CommissionThreadCard({
  commission,
  myUserId,
  busy,
  error,
  onConfirmDraft,
  onConfirmFinal,
}: {
  commission: Commission;
  myUserId: string | null;
  busy: boolean;
  error: string;
  onConfirmDraft: () => void;
  onConfirmFinal: () => void;
}) {
  const iAmClient = commission.clientId === myUserId;
  const canConfirmDraft = iAmClient && !!commission.draftDeliveredAt && !commission.draftConfirmedAt;
  const canConfirmFinal = iAmClient && !!commission.finalDeliveredAt && !commission.finalConfirmedAt;
  const steps = buildThreadSteps(commission);

  return (
    <div className="mt-3 mb-3 rounded-2xl border border-sky-300/15 bg-sky-400/[0.055] px-4 py-3">
      <div className="flex items-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.label}>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${step.done ? "bg-emerald-300" : "bg-white/15"}`} />
            {index < steps.length - 1 && <span className={`h-px flex-1 ${steps[index + 1].done ? "bg-emerald-300/40" : "bg-white/10"}`} />}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-center text-[9px] text-white/30">
        {steps.map((step) => <span key={step.label} className={step.done ? "text-white/55" : ""}>{step.label}</span>)}
      </div>

      {(canConfirmDraft || canConfirmFinal) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canConfirmDraft && (
            <button type="button" disabled={busy} onClick={onConfirmDraft} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
              {busy ? "確認中…" : "確認初稿完成"}
            </button>
          )}
          {canConfirmFinal && (
            <button type="button" disabled={busy} onClick={onConfirmFinal} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-black hover:opacity-90 disabled:opacity-50">
              {busy ? "確認中…" : "確認完稿・結案"}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-red-300">{error}</p>}
    </div>
  );
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
