import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Search, Bell, Heart, Star, ChevronRight } from "lucide-react";

const categories = ["熱門推薦", "個人化推薦", "角色委託", "品牌視覺", "客製刺青", "校園創作者"];

const bentoItems = [
  {
    id: 1,
    tag: "角色設計",
    title: "霧面藍銀角色",
    image: "https://images.unsplash.com/photo-1768797646664-0c33d518facf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW50YXN5JTIwY2hhcmFjdGVyJTIwZGVzaWduJTIwYXJ0d29ya3xlbnwxfHx8fDE3NzMyMjUyNzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    span: "tall-left",
  },
  {
    id: 2,
    tag: "品牌設計",
    title: "Y2K 專輯視覺",
    image: "https://images.unsplash.com/photo-1634242795248-4b45073ee336?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5MmslMjBhZXN0aGV0aWMlMjBhbGJ1bSUyMGNvdmVyJTIwZGVzaWdufGVufDF8fHx8MTc3MzIyNTI3N3ww&ixlib=rb-4.1.0&q=80&w=1080",
    span: "top-right",
  },
  {
    id: 3,
    tag: "刺青線稿",
    title: "極簡刺青線稿",
    image: "https://images.unsplash.com/photo-1704345911745-f2524e8b76f6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsJTIwdGF0dG9vJTIwbGluZSUyMGFydCUyMHNrZXRjaHxlbnwxfHx8fDE3NzMyMjUyNzZ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    span: "bottom-left",
  },
  {
    id: 4,
    tag: "數位插畫",
    title: "Exhibit 展覽海報",
    image: "https://images.unsplash.com/photo-1767652723573-161f1c223d63?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwb3N0ZXIlMjBncmFwaGljJTIwZGVzaWduJTIwZXhoaWJpdGlvbiUyMGFydHxlbnwxfHx8fDE3NzMyMjUyODB8MA&ixlib=rb-4.1.0&q=80&w=1080",
    span: "wide",
  },
  {
    id: 5,
    tag: "抽象",
    title: "夢核色彩插畫",
    image: "https://images.unsplash.com/photo-1759270958540-c98ae17aec4c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGRpZ2l0YWwlMjBhcnQlMjBpbGx1c3RyYXRpb258ZW58MXx8fHwxNzczMTkxNzU5fDA&ixlib=rb-4.1.0&q=80&w=1080",
    span: "square",
  },
  {
    id: 6,
    tag: "雕塑",
    title: "手作陶瓷質感",
    image: "https://images.unsplash.com/photo-1558300249-1ecd0bbb9068?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaWx2ZXIlMjBzY3VscHR1cmUlMjBjZXJhbWljJTIwYXJ0JTIwdGV4dHVyZXxlbnwxfHx8fDE3NzMyMjUyNzd8MA&ixlib=rb-4.1.0&q=80&w=1080",
    span: "square",
  },
];

const creators = [
  {
    id: "eavan",
    name: "EAVAN",
    role: "插畫 / 平面設計",
    avatar: "https://images.unsplash.com/photo-1730295004949-d3f6c773aedd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcnRpc3QlMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MXx8fHwxNzczMTY2NjQyfDA&ixlib=rb-4.1.0&q=80&w=400",
    rating: 4.9,
    price: "NT$800+",
    badge: "Fast Reply",
    badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  },
  {
    id: "pop",
    name: "popOpooP",
    role: "角色設計 / 3D",
    avatar: "https://images.unsplash.com/photo-1595745688820-1a8bca9dd00f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHBlcnNvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0NTMzOHww&ixlib=rb-4.1.0&q=80&w=400",
    rating: 4.8,
    price: "NT$1200+",
    badge: "Open for Commission",
    badgeColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  },
  {
    id: "maya",
    name: "Maya Patel",
    role: "品牌視覺 / UI",
    avatar: "https://images.unsplash.com/photo-1740128041073-68257e968a2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNpZ25lciUyMHBvcnRyYWl0JTIwcHJvZmVzc2lvbmFsfGVufDF8fHx8MTc3MzEyMjk3MHww&ixlib=rb-4.1.0&q=80&w=400",
    rating: 5.0,
    price: "NT$2000+",
    badge: "Limited Slot",
    badgeColor: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
  },
];

export function HomePage() {
  const [activeCat, setActiveCat] = useState(0);
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#0a0a0f]">
      {/* Top area: search button */}
      <div className="px-5 pt-12 pb-3 flex items-center justify-between">
        <button className="flex items-center justify-center w-11 h-11 bg-white/8 backdrop-blur-md border border-white/12 rounded-full hover:bg-white/14 transition-colors">
          <Search size={18} className="text-gray-300" />
        </button>
        <button className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-white/10 transition-colors">
          <Bell size={17} className="text-white" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border border-[#0a0a0f] bg-blue-400" />
        </button>
      </div>

      {/* Bento Grid */}
      <div className="px-3 mb-4">
        {/* Row 1 + Row 2: Left stacked, Right tall */}
        <div className="flex gap-2 mb-2">
          {/* Left column: 2 stacked cards */}
          <div className="flex flex-col gap-2 flex-[3]">
            {/* Card 1 - top left */}
            <div className="relative h-44 rounded-[20px] overflow-hidden cursor-pointer group">
              <img
                src={bentoItems[0].image}
                alt={bentoItems[0].title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] text-gray-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                  {bentoItems[0].tag}
                </span>
              </div>
              <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <Heart size={13} className="text-white" />
              </button>
            </div>
            {/* Card 3 - bottom left */}
            <div className="relative h-36 rounded-[20px] overflow-hidden cursor-pointer group">
              <img
                src={bentoItems[2].image}
                alt={bentoItems[2].title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] text-gray-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                  {bentoItems[2].tag}
                </span>
              </div>
            </div>
          </div>

          {/* Right column: 1 tall card */}
          <div className="flex-[2]">
            <div className="relative h-[21.5rem] rounded-[20px] overflow-hidden cursor-pointer group bg-white">
              <img
                src={bentoItems[1].image}
                alt={bentoItems[1].title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <span className="text-[10px] text-gray-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                  {bentoItems[1].tag}
                </span>
              </div>
              <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                <Heart size={13} className="text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 3: Wide panoramic card */}
        <div className="relative h-36 rounded-[20px] overflow-hidden cursor-pointer group mb-2">
          <img
            src={bentoItems[3].image}
            alt={bentoItems[3].title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute bottom-3 left-4 flex items-center gap-2">
            <span className="text-[10px] text-gray-200 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
              {bentoItems[3].tag}
            </span>
            <span className="text-[11px] text-white font-medium">{bentoItems[3].title}</span>
          </div>
          <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Heart size={13} className="text-white" />
          </button>
        </div>

        {/* Row 4: 2 equal cards */}
        <div className="flex gap-2">
          <div className="relative flex-1 h-44 rounded-[20px] overflow-hidden cursor-pointer group">
            <img
              src={bentoItems[4].image}
              alt={bentoItems[4].title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="text-[10px] text-gray-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                {bentoItems[4].tag}
              </span>
            </div>
          </div>
          <div className="relative flex-1 h-44 rounded-[20px] overflow-hidden cursor-pointer group">
            <img
              src={bentoItems[5].image}
              alt={bentoItems[5].title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-3">
              <span className="text-[10px] text-gray-300 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10">
                {bentoItems[5].tag}
              </span>
            </div>
            <button className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
              <Heart size={13} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Tags */}
      <div className="pl-4 mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pr-4 w-max">
          {categories.map((cat, idx) => (
            <button
              key={cat}
              onClick={() => setActiveCat(idx)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
                activeCat === idx
                  ? "bg-gradient-to-r from-violet-500 via-fuchsia-500 to-cyan-400 text-white shadow-[0_0_12px_rgba(217,70,239,0.3)]"
                  : "bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/8"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Top Creators */}
      <div className="px-4 mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-white tracking-wide">推薦創作者</h2>
          <button className="text-xs text-fuchsia-400 flex items-center gap-0.5">
            全部 <ChevronRight size={12} />
          </button>
        </div>
        <div className="flex flex-col gap-2.5">
          {creators.map((creator) => (
            <div
              key={creator.id}
              onClick={() => navigate(`/chat/${creator.id}`)}
              className="flex items-center justify-between p-3 bg-white/4 backdrop-blur-md border border-white/6 rounded-2xl hover:bg-white/8 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <img
                    src={creator.avatar}
                    alt={creator.name}
                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#0a0a0f] rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{creator.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${creator.badgeColor}`}>
                      {creator.badge}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-gray-400 text-[11px]">{creator.role}</span>
                    <span className="text-gray-600 text-[10px]">•</span>
                    <div className="flex items-center gap-0.5">
                      <Star size={10} className="text-fuchsia-400 fill-fuchsia-400" />
                      <span className="text-[10px] text-gray-300">{creator.rating}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs text-gray-300 font-medium">{creator.price}</span>
                <button className="text-[10px] px-2.5 py-1 rounded-lg bg-white/8 border border-white/10 text-gray-200 hover:bg-white/14 transition-colors">
                  委託
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
