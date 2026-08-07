import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Smile, Paperclip, X, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useUpload } from "../../lib/useUpload";

const PAGE_SIZE = 50;

interface DbMessage {
  id: number;
  chat_id: number;
  sender_id: string;
  type: string;
  content: { text?: string; url?: string } | null;
  created_at: string;
}

interface OtherUser {
  id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  const [showInfo, setShowInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 載入更早訊息時不要自動捲到底部
  const skipNextScrollRef = useRef(false);

  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 載入對話資訊 + 最新 50 則訊息
  useEffect(() => {
    if (!user || !chatId) return;

    async function load() {
      const { data: conv } = await supabase
        .from("conversations")
        .select(`
          usera:usera_id(id, username, name, avatar_url, bio),
          userb:userb_id(id, username, name, avatar_url, bio)
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
    <div className="h-full flex flex-col bg-[#141414] relative">
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
          <div className="w-9 h-9 rounded-full overflow-hidden border border-white/15 bg-white/10 flex items-center justify-center flex-shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white/40 text-sm font-medium">{displayName[0]?.toUpperCase()}</span>
            )}
          </div>
          <span className="text-white font-medium text-sm">{displayName}</span>
        </div>
        <button
          onClick={() => setShowInfo(true)}
          className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center"
        >
          <Info size={16} className="text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:hidden space-y-3">
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
      <div className="flex-shrink-0 px-4 pb-24 pt-2 border-t border-white/6">
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
            <button className="ml-2 text-gray-500 flex-shrink-0">
              <Smile size={18} />
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

      {/* Info Panel */}
      {showInfo && (
        <div
          className="absolute inset-0 z-50 flex items-end bg-black/40 backdrop-blur-sm"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="w-full bg-[#111111] border-t border-white/8 rounded-t-3xl px-6 pt-5 pb-10 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />

            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-5 w-7 h-7 rounded-full bg-white/8 flex items-center justify-center"
            >
              <X size={14} className="text-gray-400" />
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-white/15 bg-white/10 flex items-center justify-center flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-white/40 text-xl font-medium">{displayName[0]?.toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="text-white font-semibold">{displayName}</p>
                {otherUser?.username && (
                  <p className="text-gray-500 text-sm">@{otherUser.username}</p>
                )}
              </div>
            </div>

            {otherUser?.bio && (
              <p className="text-gray-400 text-sm leading-relaxed mb-5">{otherUser.bio}</p>
            )}

            {otherUser?.username && (
              <button
                onClick={() => { navigate(`/creator/${otherUser.username}`); setShowInfo(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/8 border border-white/12 text-white text-sm hover:bg-white/12 transition-colors"
              >
                <ExternalLink size={15} />
                查看個人頁
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
