import React, { useState } from "react";
import {
  ChevronDown,
  Menu,
  Plus,
  X,
  ChevronRight,
  Image,
  Bookmark,
  Heart,
  Lock,
  Camera,
} from "lucide-react";

const tabs = [
  { icon: Image, label: "作品集" },
  { icon: Bookmark, label: "收藏" },
  { icon: null, label: "喜愛", isLockHeart: true },
];

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState(0);
  const [isOpenCommission, setIsOpenCommission] = useState(false);

  return (
    <div className="h-full flex flex-col bg-black overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">wen_zi_10.26</span>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
        <button>
          <Menu size={22} className="text-white" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden">
        {/* Profile info */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-4 mb-4">
            {/* Avatar */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-white/20 bg-purple-900">
                <img
                  src="https://images.unsplash.com/photo-1595745688820-1a8bca9dd00f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcmVhdGl2ZSUyMHBlcnNvbiUyMHBvcnRyYWl0fGVufDF8fHx8MTc3MzE0NTMzOHww&ixlib=rb-4.1.0&q=80&w=200"
                  alt="蚊子"
                  className="w-full h-full object-cover"
                />
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white flex items-center justify-center border-2 border-black">
                <Plus size={12} className="text-black" strokeWidth={3} />
              </button>
            </div>

            {/* Name + info */}
            <div className="flex-1 pt-1">
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="text-white text-lg font-semibold">蚊子</h2>
              </div>
              <p className="text-gray-500 text-xs mb-3">travelers</p>

              {/* Commission toggle */}
              <button
                onClick={() => setIsOpenCommission(!isOpenCommission)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  isOpenCommission
                    ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300"
                    : "bg-white/6 border-white/15 text-gray-300"
                }`}
              >
                {!isOpenCommission && <X size={11} />}
                {isOpenCommission ? "開放委託中" : "不開放委託"}
              </button>
            </div>
          </div>

          {/* View reviews */}
          <button className="flex items-center gap-1.5 mb-4">
            <ChevronRight size={13} className="text-gray-500" />
            <span className="text-gray-400 text-xs">檢視你的評價……</span>
          </button>

          {/* Add bio */}
          <button className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/12 rounded-full hover:bg-white/4 transition-colors">
            <Plus size={14} className="text-gray-400" />
            <span className="text-gray-400 text-xs">新增你的個人簡介</span>
          </button>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/6 mx-5 mb-4" />

        {/* Tabs */}
        <div className="flex items-center px-5 mb-5 gap-2">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors relative ${
                activeTab === idx
                  ? "bg-white/10 border border-white/15"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {tab.isLockHeart ? (
                <div className="relative">
                  <Heart
                    size={16}
                    className={activeTab === idx ? "text-white" : "text-gray-600"}
                  />
                  <Lock
                    size={8}
                    className={`absolute -bottom-0.5 -right-0.5 ${
                      activeTab === idx ? "text-white" : "text-gray-600"
                    }`}
                  />
                </div>
              ) : tab.icon ? (
                <tab.icon
                  size={18}
                  className={activeTab === idx ? "text-white" : "text-gray-600"}
                />
              ) : null}
              {activeTab === idx && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}

          {/* Stats row */}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <p className="text-white text-sm font-semibold">0</p>
              <p className="text-gray-600 text-[9px]">收藏</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-semibold">1</p>
              <p className="text-gray-600 text-[9px]">委託中</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-semibold">0</p>
              <p className="text-gray-600 text-[9px]">已完成</p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
              <Camera size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">尚無作品</p>
            <button className="mt-2 px-5 py-2 rounded-full bg-white/8 border border-white/12 text-gray-300 text-xs hover:bg-white/12 transition-colors">
              上傳第一件作品
            </button>
          </div>
        )}

        {activeTab === 1 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
              <Bookmark size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">尚無收藏</p>
          </div>
        )}

        {activeTab === 2 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
              <Heart size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">尚無喜愛的作品</p>
          </div>
        )}
      </div>
    </div>
  );
}
