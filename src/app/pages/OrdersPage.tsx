import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
} from "lucide-react";

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_ROWS = [
  [null, null, null, 1, 2, 3, 4],
  [5, 6, 7, 8, 9, 10, 11],
  [12, 13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23, 24, 25],
  [26, 27, 28, 29, 30, 31, null],
];

const HIGHLIGHTED_DATES = new Set([12, 20, 25]);
const DEADLINE_DATE = 12;

const orders = [
  {
    id: "ORD-001",
    title: "社團活動海報設計",
    creator: "EAVAN",
    client: "蚊子",
    status: "製作中",
    due: "2025/1/12",
    statusColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    dot: "bg-violet-400",
  },
  {
    id: "ORD-002",
    title: "角色立繪委託",
    creator: "popOpooP",
    client: "蚊子",
    status: "下單",
    due: "2026/3/20",
    statusColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    dot: "bg-cyan-400",
  },
  {
    id: "ORD-003",
    title: "品牌 Logo 設計",
    creator: "Maya Patel",
    client: "蚊子",
    status: "已完成",
    due: "2026/2/25",
    statusColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
];

const flowSteps = [
  { label: "下單", done: true },
  { label: "保證金確認", done: true },
  { label: "製作中", done: false, active: true },
  { label: "申請退款", done: false },
  { label: "撥款", done: false },
  { label: "到帳", done: false },
];

export function OrdersPage() {
  const [month, setMonth] = useState("Mar");

  return (
    <div className="h-full overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden bg-[#0a0a0f]">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <p className="text-gray-500 text-xs tracking-widest mb-0.5">ORDER FLOW</p>
        <h1 className="text-white text-xl font-semibold">我的訂單</h1>
      </div>

      {/* Calendar Card */}
      <div className="mx-4 mb-5 bg-[#1a1a2e] rounded-2xl overflow-hidden border border-white/8">
        {/* Calendar header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#2a2a40]">
          <span className="text-white font-semibold text-sm">Calendar</span>
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full border border-white/30" />
            <div className="w-3 h-3 rounded-full bg-blue-500" />
          </div>
        </div>
        {/* Month selector */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/6">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-sm">Dec</span>
            <ChevronRight size={14} className="text-gray-400" />
            <div className="flex items-center gap-1 bg-[#3a3a55] rounded px-2 py-0.5">
              <span className="text-gray-300 text-xs">Month</span>
              <ChevronLeft size={10} className="text-gray-400 rotate-180" />
            </div>
          </div>
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">≡</span>
          </div>
        </div>
        {/* Calendar grid */}
        <div className="px-3 pb-3">
          <div className="grid grid-cols-8 mb-1 mt-2">
            <div className="col-span-1" />
            {DAYS.map((d, i) => (
              <div key={i} className="text-center text-gray-500 text-[10px]">{d}</div>
            ))}
          </div>
          {MONTH_ROWS.map((row, ri) => (
            <div key={ri} className="grid grid-cols-8 mb-1 items-center">
              {/* Row label placeholder */}
              <div className="col-span-1 text-gray-600 text-[9px] truncate pr-1">
                {ri === 0 ? "Lorem" : ri === 1 ? "Dolor" : ri === 2 ? "Conse" : ri === 3 ? "Adipi" : ""}
              </div>
              {row.map((day, ci) => (
                <div key={ci} className="flex items-center justify-center">
                  {day ? (
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-colors ${
                        day === DEADLINE_DATE
                          ? "bg-blue-600 text-white font-bold"
                          : HIGHLIGHTED_DATES.has(day)
                          ? "bg-blue-800/60 text-blue-200"
                          : "text-gray-400"
                      }`}
                    >
                      {day}
                    </div>
                  ) : (
                    <div className="w-6 h-6" />
                  )}
                </div>
              ))}
            </div>
          ))}
          {/* Color-coded task rows */}
          <div className="mt-2 space-y-1">
            {[
              { color: "bg-blue-500", w: "w-4/5" },
              { color: "bg-[#4a4a6a]", w: "w-3/5" },
              { color: "bg-[#4a4a6a]", w: "w-2/3" },
            ].map((bar, i) => (
              <div key={i} className="flex gap-1 items-center">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${bar.color}`} />
                <div className={`h-1.5 ${bar.w} ${bar.color} rounded-full opacity-60`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Order Flow Timeline */}
      <div className="mx-4 mb-5 bg-white/4 border border-white/8 rounded-2xl p-4">
        <p className="text-gray-400 text-xs mb-3 tracking-wide">訂單進度 — ORD-001</p>
        <div className="flex items-center">
          {flowSteps.map((step, i) => (
            <React.Fragment key={i}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    step.done
                      ? "bg-fuchsia-500"
                      : step.active
                      ? "bg-fuchsia-500/30 border-2 border-fuchsia-500"
                      : "bg-white/8 border border-white/15"
                  }`}
                >
                  {step.done && <CheckCircle2 size={12} className="text-white" />}
                  {step.active && <div className="w-2 h-2 rounded-full bg-fuchsia-400" />}
                </div>
                <span
                  className={`text-[8px] text-center leading-tight ${
                    step.done || step.active ? "text-gray-200" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < flowSteps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-0.5 mb-3 ${
                    step.done ? "bg-fuchsia-500/60" : "bg-white/8"
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-4 mb-5 grid grid-cols-3 gap-2">
        {[
          { label: "訂單狀態", value: "製作中", icon: Clock, color: "text-violet-400" },
          { label: "平台託管", value: "NT$800", icon: CheckCircle2, color: "text-cyan-400" },
          { label: "退款流程", value: "未觸發", icon: AlertCircle, color: "text-gray-500" },
        ].map((card) => (
          <div key={card.label} className="bg-white/4 border border-white/8 rounded-xl p-3 flex flex-col gap-1">
            <card.icon size={14} className={card.color} />
            <p className="text-gray-500 text-[9px]">{card.label}</p>
            <p className="text-white text-xs font-medium">{card.value}</p>
          </div>
        ))}
      </div>

      {/* My Orders List */}
      <div className="px-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center">
            <Receipt size={15} className="text-gray-300" />
          </div>
          <span className="text-white font-medium text-sm">我的訂單</span>
        </div>

        <div className="space-y-2.5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white/4 border border-white/8 rounded-2xl p-4 hover:bg-white/6 transition-colors cursor-pointer"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-white text-sm font-medium">{order.title}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">
                    {order.client} → {order.creator}
                  </p>
                </div>
                <span
                  className={`text-[9px] px-2 py-0.5 rounded-full border flex-shrink-0 ml-2 ${order.statusColor}`}
                >
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-gray-600 text-[10px]">{order.id}</p>
                <p className="text-gray-400 text-[10px]">截止 {order.due}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
