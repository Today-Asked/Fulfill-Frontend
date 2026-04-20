import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
      return;
    }

    navigate("/");
  }

  return (
    <div className="flex flex-col h-full px-6 pt-16 pb-8">
      {/* Header */}
      <div className="mb-10">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 mb-6 shadow-lg shadow-fuchsia-500/30" />
        <h1 className="text-2xl font-bold text-white mb-1">歡迎回來</h1>
        <p className="text-sm text-gray-500">登入你的 Fulfill 帳號</p>
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
          <div className="flex items-center justify-between">
            <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
              密碼
            </label>
            <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-fuchsia-400 transition-colors">
              忘記密碼？
            </Link>
          </div>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="輸入密碼"
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
          {loading ? "登入中…" : "登入"}
        </button>

        {/* Register link */}
        <p className="text-center text-sm text-gray-500 mt-auto pt-4">
          還沒有帳號？{" "}
          <Link to="/register" className="text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
            建立帳號
          </Link>
        </p>
      </form>
    </div>
  );
}
