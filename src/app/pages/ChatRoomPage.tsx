import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Info,
  Smile,
  Paperclip,
  Send,
  ChevronRight,
  Home,
  Plus,
  UserCircle2,
} from "lucide-react";

type Message =
  | { id: number; type: "sent" | "received"; text: string; time: string }
  | { id: number; type: "system"; text: string }
  | { id: number; type: "commission-invite" }
  | { id: number; type: "image-msg"; src: string; side: "sent" | "received" };

const initialMessages: Message[] = [
  { id: 1, type: "sent", text: "您好，我想委託海報", time: "12:20" },
  {
    id: 2,
    type: "received",
    text: "沒問題喔\n麻煩填一下委託單喔",
    time: "12:21",
  },
  { id: 3, type: "commission-invite" },
  {
    id: 4,
    type: "sent",
    text: "想問我們社團已經有規劃好海報版面了\n像附圖這樣，急要。不知道你可以接嗎",
    time: "12:22",
  },
  {
    id: 5,
    type: "received",
    text: "可，\n直接填委託單就好\n記得選急件加價",
    time: "12:23",
  },
];

function CommissionInviteCard() {
  return (
    <div className="mx-auto my-2 w-4/5">
      <p className="text-center text-gray-500 text-[11px] mb-2">
        EAVAN 邀請你填寫委託單
      </p>
      <button className="w-full flex items-center gap-3 bg-white/8 border border-white/12 rounded-2xl px-4 py-3 hover:bg-white/12 transition-colors">
        <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
        <span className="text-gray-200 text-sm">點開填寫委託詳情......</span>
      </button>
    </div>
  );
}

export function ChatRoomPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");

  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMsg: Message = {
      id: Date.now(),
      type: "sent",
      text: inputText.trim(),
      time: new Date().toLocaleTimeString("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setInputText("");
  };

  return (
    <div className="h-full flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/chat")} className="text-white">
            <ArrowLeft size={22} />
          </button>
          <div className="relative">
            <img
              src="https://images.unsplash.com/photo-1730295004949-d3f6c773aedd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc3QlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MXx8fHwxNzczMTY2NjQyfDA&ixlib=rb-4.1.0&q=80&w=100"
              alt="EAVAN"
              className="w-9 h-9 rounded-full object-cover border border-white/15"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-white rounded-full border-2 border-black flex items-center justify-center">
              <span className="text-[6px] font-bold text-gray-700">$</span>
            </div>
          </div>
          <span className="text-white font-medium text-sm">EAVAN</span>
        </div>
        <button className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
          <Info size={16} className="text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 [&::-webkit-scrollbar]:hidden space-y-3">
        {messages.map((msg) => {
          if (msg.type === "commission-invite") {
            return <CommissionInviteCard key={msg.id} />;
          }
          if (msg.type === "system") {
            return (
              <p key={msg.id} className="text-center text-gray-500 text-[11px] py-1">
                {msg.text}
              </p>
            );
          }
          const isSent = msg.type === "sent";
          return (
            <div
              key={msg.id}
              className={`flex ${isSent ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[72%] px-4 py-2.5 rounded-[20px] ${
                  isSent
                    ? "bg-white text-black rounded-br-md"
                    : "bg-white text-black rounded-bl-md"
                }`}
              >
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Bar */}
      <div className="flex-shrink-0 px-4 pb-5 pt-2 border-t border-white/6">
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center bg-white/6 border border-white/10 rounded-full px-4 h-11">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="發送訊息......"
              className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-600"
            />
            <button className="ml-2 text-gray-500">
              <Smile size={18} />
            </button>
          </div>
          <button className="w-11 h-11 rounded-full bg-white/8 border border-white/12 flex items-center justify-center flex-shrink-0">
            <Paperclip size={18} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Simplified bottom nav for chat room */}
      <div className="flex-shrink-0 pb-5 pt-2 px-6">
        <div className="flex justify-around items-center bg-white/4 backdrop-blur-xl border border-white/8 rounded-full px-6 py-3">
          <button onClick={() => navigate("/")} className="text-gray-500">
            <Home size={20} strokeWidth={1.5} />
          </button>
          <button onClick={() => navigate("/create")} className="text-gray-500">
            <Plus size={20} strokeWidth={1.5} />
          </button>
          <button className="text-white">
            <Send size={20} strokeWidth={1.5} />
          </button>
          <button onClick={() => navigate("/profile")} className="text-gray-500">
            <UserCircle2 size={20} strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
