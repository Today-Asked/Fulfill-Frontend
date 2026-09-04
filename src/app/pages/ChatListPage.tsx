import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { formatChatTime, getLastMessageText } from "../../lib/chat";

interface ConvItem {
  id: number;
  name: string;
  avatar: string | null;
  lastMessage: string;
  time: string;
  unread: number;
}

export function ChatListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [convs, setConvs] = useState<ConvItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      const { data: rows } = await supabase
        .from("conversations")
        .select(`
          id, last_message_at,
          usera:usera_id(id, username, name, avatar_url),
          userb:userb_id(id, username, name, avatar_url)
        `)
        .or(`usera_id.eq.${user!.id},userb_id.eq.${user!.id}`)
        .order("last_message_at", { ascending: false, nullsFirst: false });

      if (!rows?.length) {
        setLoading(false);
        return;
      }

      const ids = rows.map((r: any) => r.id as number);

      // Batch: 最新幾則訊息（用來取得每個對話的最後一則）
      const { data: msgs } = await supabase
        .from("messages")
        .select("chat_id, content, type, created_at")
        .in("chat_id", ids)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(ids.length * 5);

      // Batch: 未讀數（sender 不是自己 且 read_at 為 null）
      const { data: unreads } = await supabase
        .from("messages")
        .select("chat_id")
        .in("chat_id", ids)
        .neq("sender_id", user!.id)
        .is("read_at", null)
        .is("deleted_at", null);

      // 每個 chat 的最後一則訊息文字
      const lastMsgMap: Record<number, string> = {};
      (msgs ?? []).forEach((m: any) => {
        if (lastMsgMap[m.chat_id] === undefined) {
          lastMsgMap[m.chat_id] = getLastMessageText(m.content, m.type);
        }
      });

      // 每個 chat 的未讀數
      const unreadMap: Record<number, number> = {};
      (unreads ?? []).forEach((m: any) => {
        unreadMap[m.chat_id] = (unreadMap[m.chat_id] ?? 0) + 1;
      });

      setConvs(
        rows.map((r: any) => {
          const other = r.usera.id === user!.id ? r.userb : r.usera;
          return {
            id: r.id,
            name: other.name || other.username || "用戶",
            avatar: other.avatar_url,
            lastMessage: lastMsgMap[r.id] ?? "",
            time: formatChatTime(r.last_message_at),
            unread: unreadMap[r.id] ?? 0,
          };
        })
      );
      setLoading(false);
    }

    load();
  }, [user]);

  const filtered = convs.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-[70vh] flex-col rounded-2xl bg-[#141414] lg:min-h-[76vh]">
      {/* Header */}
      <div className="px-5 pb-4 pt-6">
        <div className="flex items-center gap-4">
          <h1 className="text-white font-semibold tracking-widest text-sm">CHAT</h1>
          <div className="flex-1 flex items-center bg-white/8 border border-white/10 rounded-full px-3 h-8">
            <Search size={13} className="text-gray-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋對話..."
              className="flex-1 bg-transparent text-xs text-white outline-none placeholder:text-gray-600"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X size={13} className="text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden pb-28">
        {loading ? (
          <p className="text-center text-gray-600 text-sm mt-8">載入中...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-600 text-sm mt-8">還沒有對話</p>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-14 h-14 rounded-full border-2 border-white/15 overflow-hidden bg-white/10 flex items-center justify-center">
                  {conv.avatar ? (
                    <img src={conv.avatar} alt={conv.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white/40 text-xl font-medium">
                      {conv.name[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm font-medium">{conv.name}</span>
                  <span className="text-gray-600 text-[10px]">{conv.time}</span>
                </div>
                <p className="text-gray-500 text-xs truncate">{conv.lastMessage}</p>
              </div>

              {/* Unread badge */}
              {conv.unread > 0 && (
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                  <span className="text-[10px] font-bold text-black">{conv.unread}</span>
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
