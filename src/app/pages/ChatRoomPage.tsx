import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Info, Smile, Paperclip } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";

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
}

export function ChatRoomPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const chatId = Number(id);

  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 載入對話資訊 + 歷史訊息
  useEffect(() => {
    if (!user || !chatId) return;

    async function load() {
      const { data: conv } = await supabase
        .from("conversations")
        .select(`
          usera:usera_id(id, username, name, avatar_url),
          userb:userb_id(id, username, name, avatar_url)
        `)
        .eq("id", chatId)
        .single();

      if (conv) {
        const other =
          (conv.usera as any).id === user!.id ? conv.userb : conv.usera;
        setOtherUser(other as OtherUser);
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id, type, content, created_at")
        .eq("chat_id", chatId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);

      if (msgs) setMessages(msgs as DbMessage[]);

      // 進入聊天室時，把對方的未讀訊息標為已讀
      await supabase
        .from("messages")
        .update({ read_at: new Date().toISOString() })
        .eq("chat_id", chatId)
        .neq("sender_id", user!.id)
        .is("read_at", null);
    }

    load();
  }, [user, chatId]);

  // Realtime：接收對方的新訊息
  useEffect(() => {
    if (!user || !chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const msg = payload.new as DbMessage;
          if (msg.sender_id !== user!.id) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, chatId]);

  const handleSend = async () => {
    if (!inputText.trim() || !user || !chatId || sending) return;
    const text = inputText.trim();
    setInputText("");
    setSending(true);

    const { data: newMsg } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        type: "text",
        content: { text },
      })
      .select("id, chat_id, sender_id, type, content, created_at")
      .single();

    if (newMsg) {
      setMessages((prev) => [...prev, newMsg as DbMessage]);
      await supabase
        .from("conversations")
        .update({ last_message_at: (newMsg as DbMessage).created_at })
        .eq("id", chatId);
    }

    setSending(false);
  };

  const displayName = otherUser?.name || otherUser?.username || "...";
  const avatarUrl = otherUser?.avatar_url;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
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
              <span className="text-white/40 text-sm font-medium">
                {displayName[0]?.toUpperCase()}
              </span>
            )}
          </div>
          <span className="text-white font-medium text-sm">{displayName}</span>
        </div>
        <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
          <Info size={16} className="text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:hidden space-y-3">
        {messages.map((msg) => {
          const isSent = msg.sender_id === user?.id;
          const text = msg.content?.text ?? "";

          if (!text) return null;

          return (
            <div
              key={msg.id}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[72%] px-4 py-2.5 rounded-[20px] ${
                  isSent
                    ? "bg-white text-black rounded-br-md"
                    : "bg-white/10 border border-white/8 text-white rounded-bl-md"
                }`}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">{text}</p>
              </div>
            </div>
          );
        })}
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
            <button className="ml-2 text-gray-500">
              <Smile size={18} />
            </button>
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !inputText.trim()}
            className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0"
          >
            <Paperclip size={18} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
