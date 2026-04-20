import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { supabase } from "../../lib/supabase";

type PageState = "loading" | "expired" | "ready";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 先檢查 URL hash 有沒有 error（過期 / 無效連結）
    const hash = window.location.hash;
    if (hash.includes("error=access_denied") || hash.includes("otp_expired")) {
      setPageState("expired");
      return;
    }

    // 監聽 PASSWORD_RECOVERY 事件
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    // 若已有 session（重新整理）
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setPageState("ready");
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("兩次密碼不一致");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    navigate("/");
  }

  // ── 過期 / 無效 ──────────────────────────────────────────────────────
  if (pageState === "expired") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
          <span className="text-2xl">⏱</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">連結已過期</h2>
          <p className="text-sm text-gray-400">
            這個密碼重設連結已失效，請重新申請一次。
          </p>
        </div>
        <Link
          to="/forgot-password"
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold text-center shadow-lg shadow-fuchsia-500/25 hover:opacity-90 transition-all"
        >
          重新申請
        </Link>
        <Link
          to="/login"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          回到登入
        </Link>
      </div>
    );
  }

  // ── 載入中 ───────────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="w-8 h-8 rounded-full border-2 border-fuchsia-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── 可以設定新密碼 ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full px-6 pt-16 pb-8">
      <div className="mb-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 mb-6 shadow-lg shadow-fuchsia-500/30" />
        <h1 className="text-2xl font-bold text-white mb-1">設定新密碼</h1>
        <p className="text-sm text-gray-500">請輸入你的新密碼</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            新密碼
          </label>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="至少 6 個字元"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            確認新密碼
          </label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再輸入一次"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? "更新中…" : "更新密碼"}
        </button>
      </form>
    </div>
  );
}
