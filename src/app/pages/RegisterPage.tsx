import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("兩次密碼不一致");
      return;
    }

    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    setLoading(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        {/* Glow */}
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
          <span className="text-2xl">✓</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">驗證信已送出</h2>
          <p className="text-sm text-gray-400">
            請到 <span className="text-white">{email}</span> 收取驗證信，點擊連結後即可登入。
          </p>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3 rounded-2xl bg-white/8 border border-white/10 text-sm text-gray-300 hover:bg-white/12 transition-all"
        >
          回到登入
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-6 pt-16 pb-8">
      {/* Header */}
      <div className="mb-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 mb-6 shadow-lg shadow-fuchsia-500/30" />
        <h1 className="text-2xl font-bold text-white mb-1">建立帳號</h1>
        <p className="text-sm text-gray-500">加入 Fulfill，開始委託你的創作</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
        {/* Email */}
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

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            密碼
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

        {/* Confirm Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            確認密碼
          </label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再輸入一次密碼"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? "建立中…" : "建立帳號"}
        </button>

        {/* Login link */}
        <p className="text-center text-sm text-gray-500 mt-auto pt-4">
          已有帳號？{" "}
          <Link to="/login" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
            登入
          </Link>
        </p>
      </form>
    </div>
  );
}
