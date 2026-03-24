import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";

const conversations = [
  {
    id: "eavan",
    name: "EAVAN",
    lastMessage: "可，直接填委託單就好 記得選急件加價",
    time: "12:34",
    unread: 2,
    isPaid: true,
    avatar: "https://images.unsplash.com/photo-1730295004949-d3f6c773aedd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc3QlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MXx8fHwxNzczMTY2NjQyfDA&ixlib=rb-4.1.0&q=80&w=200",
  },
  {
    id: "pop",
    name: "popOpooP",
    lastMessage: "好的！我最快下週交稿",
    time: "昨天",
    unread: 0,
    isPaid: false,
    avatar: "https://images.unsplash.com/photo-1595745688820-1a8bca9dd00f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHBlcnNvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0NTMzOHww&ixlib=rb-4.1.0&q=80&w=200",
  },
  {
    id: "eavan2",
    name: "EAVAN",
    lastMessage: "您好，我想委託海報",
    time: "週一",
    unread: 0,
    isPaid: true,
    avatar: "https://images.unsplash.com/photo-1730295004949-d3f6c773aedd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc3QlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MXx8fHwxNzczMTY2NjQyfDA&ixlib=rb-4.1.0&q=80&w=200",
  },
  {
    id: "pop2",
    name: "popOpooP",
    lastMessage: "請問有接角色立繪嗎？",
    time: "3/2",
    unread: 0,
    isPaid: false,
    avatar: "https://images.unsplash.com/photo-1595745688820-1a8bca9dd00f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHBlcnNvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0NTMzOHww&ixlib=rb-4.1.0&q=80&w=200",
  },
];

export function ChatListPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
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
        {filtered.map((conv) => (
          <button
            key={conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/4 transition-colors text-left"
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-14 h-14 rounded-full border-2 border-white/15 overflow-hidden">
                <img
                  src={conv.avatar}
                  alt={conv.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {conv.isPaid && (
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white flex items-center justify-center border-2 border-black">
                  <span className="text-[8px] font-bold text-gray-800">$</span>
                </div>
              )}
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
        ))}
      </div>
    </div>
  );
}
