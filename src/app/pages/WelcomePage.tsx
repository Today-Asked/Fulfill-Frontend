import React from "react";
import { useNavigate } from "react-router";

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative h-full flex flex-col items-center justify-between px-8 py-16 bg-black select-none overflow-hidden">

      {/* Blob */}
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-48 h-48">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #fecdd3 0%, #f9a8d4 18%, #e879f9 46%, #818cf8 72%, #7dd3fc 100%)",
              borderRadius: "71% 29% 62% 38% / 39% 58% 42% 61%",
              boxShadow:
                "inset -10px -10px 20px rgba(0,0,0,0.25), inset 8px 8px 14px rgba(255,255,255,0.35), 0 12px 40px rgba(249,168,212,0.35)",
            }}
          />
          {/* Gloss highlight */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at 32% 28%, rgba(255,255,255,0.55) 0%, transparent 52%)",
              borderRadius: "71% 29% 62% 38% / 39% 58% 42% 61%",
            }}
          />
        </div>
      </div>

      {/* Brand */}
      <div className="flex flex-col items-center gap-3 mb-16">
        <h1
          className="text-5xl font-black tracking-widest text-white"
          style={{ fontStretch: "expanded", letterSpacing: "0.18em" }}
        >
          FULFILL
        </h1>
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          Fulfill what matters.{"\n"}Drop what doesn't.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-8 w-full">
        {/* 登入 – solid pink circle */}
        <button
          onClick={() => navigate("/login")}
          className="w-24 h-24 rounded-full bg-[#f9a8d4] text-black font-semibold text-base hover:bg-[#f472b6] active:scale-95 transition-all shadow-lg shadow-pink-400/30"
        >
          登入
        </button>

        {/* 註冊 – outlined circle */}
        <button
          onClick={() => navigate("/register")}
          className="w-24 h-24 rounded-full border-2 border-[#f9a8d4] text-[#f9a8d4] font-semibold text-base hover:bg-[#f9a8d4]/10 active:scale-95 transition-all"
        >
          註冊
        </button>
      </div>
    </div>
  );
}
