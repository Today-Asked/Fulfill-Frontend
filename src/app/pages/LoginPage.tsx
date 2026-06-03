import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) { setError(translateAuthError(signInError.message)); return; }
    navigate("/");
  }

  async function handleGoogleLogin() {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (oauthError) setError(translateAuthError(oauthError.message));
  }

  return (
    <div className="flex flex-col h-full bg-black px-6 pt-10 pb-8 overflow-y-auto [&::-webkit-scrollbar]:hidden">

      {/* Tab switcher */}
      <div className="flex bg-white/8 rounded-full p-1 mb-8">
        <span className="flex-1 py-2 rounded-full bg-white text-black text-sm font-semibold text-center">
          登入
        </span>
        <Link
          to="/register"
          className="flex-1 py-2 rounded-full text-gray-400 text-sm font-medium text-center hover:text-white transition-colors"
        >
          註冊
        </Link>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-white mb-8">Log in</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 flex-1">

        {/* Email */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">電子郵件信箱</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            className="w-full bg-white rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">密碼</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少輸入六位數字"
              className="w-full bg-white rounded-xl px-4 py-3.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-gray-500 hover:text-white transition-colors">
              忘記密碼?
            </Link>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit circle button */}
        <div className="flex justify-center mt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-20 h-20 rounded-full bg-[#f9a8d4] text-black font-semibold text-sm hover:bg-[#f472b6] active:scale-95 transition-all shadow-lg shadow-pink-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "登入"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-500 text-xs">其他登入選項</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social buttons */}
        <div className="flex justify-center gap-5">
          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            aria-label="使用 Google 登入"
            className="w-14 h-14 rounded-full bg-white/8 border border-white/12 flex items-center justify-center hover:bg-white/12 active:scale-95 transition-all"
          >
            <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
          </button>
          {/* Facebook — 暫時停用 */}
          <button
            type="button"
            onClick={() => setError("目前暫時無法使用 Facebook 登入，請改用 Google 或電子郵件。")}
            aria-label="Facebook 登入（暫時無法使用）"
            aria-disabled="true"
            title="暫時無法使用"
            className="w-14 h-14 rounded-full bg-white/5 border border-white/8 flex items-center justify-center opacity-40 cursor-not-allowed transition-all"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#9ca3af" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          </button>
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-gray-500 mt-auto pt-4">
          Don't have an account?{" "}
          <Link to="/register" className="text-white font-medium hover:text-pink-300 transition-colors">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}
