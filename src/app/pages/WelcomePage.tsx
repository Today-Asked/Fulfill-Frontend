import React from "react";
import { useNavigate } from "react-router";

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="relative h-full flex flex-col items-center justify-between px-8 py-16 bg-black select-none overflow-hidden">

      {/* Brand mark */}
      <div className="flex-1 flex items-center justify-center">
        <img
          src="/logo-mark.png"
          alt="FULFILL ㄈㄈ標誌"
          className="h-auto w-52 object-contain sm:w-56"
        />
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
          className="w-24 h-24 rounded-full bg-[#FFFFFF] text-black font-semibold text-base hover:bg-[#C4C4C4] active:scale-95 transition-all shadow-lg shadow-white/30"
        >
          登入
        </button>

        {/* 註冊 – outlined circle */}
        <button
          onClick={() => navigate("/register")}
          className="w-24 h-24 rounded-full border-2 border-[#FFFFFF] text-[#FFFFFF] font-semibold text-base hover:bg-[#FFFFFF]/10 active:scale-95 transition-all"
        >
          註冊
        </button>
      </div>
    </div>
  );
}
