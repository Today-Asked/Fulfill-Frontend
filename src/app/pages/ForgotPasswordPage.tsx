import React, { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);

    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
          <span className="text-2xl">✉️</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">重設信已送出</h2>
          <p className="text-sm text-gray-400">
            請到 <span className="text-white">{email}</span> 收取密碼重設信，點擊連結後即可設定新密碼。
          </p>
        </div>
        <Link
          to="/login"
          className="w-full py-3 rounded-2xl bg-white/8 border border-white/10 text-sm text-gray-300 hover:bg-white/12 transition-all text-center"
        >
          回到登入
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-6 pt-16 pb-8">
      {/* Header */}
      <div className="mb-10">
        <Link to="/login" className="flex items-center gap-2 text-gray-500 hover:text-gray-300 transition-colors mb-6 w-fit">
          <ArrowLeft size={16} />
          <span className="text-sm">返回登入</span>
        </Link>
        <h1 className="text-2xl font-bold text-white mb-1">忘記密碼</h1>
        <p className="text-sm text-gray-500">輸入你的 email，我們會寄送重設連結</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            電子郵件
          </label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
          {loading ? "寄送中…" : "寄送重設連結"}
        </button>
      </form>
    </div>
  );
}
