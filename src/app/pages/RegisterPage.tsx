import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function RegisterPage() {
  const navigate = useNavigate();

  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]                   = useState(false);
  const [loading, setLoading]                 = useState(false);
  const [error, setError]                     = useState<string | null>(null);
  const [success, setSuccess]                 = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("兩次密碼不一致"); return; }
    setLoading(true);

    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (signUpError) { setError(translateAuthError(signUpError.message)); return; }
    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black px-8 gap-6">
        <div className="w-20 h-20 rounded-full bg-[#f9a8d4] flex items-center justify-center text-black text-2xl font-bold shadow-lg shadow-pink-400/30">
          ✓
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">驗證信已送出</h2>
          <p className="text-sm text-gray-400">
            請到 <span className="text-white">{email}</span> 收取驗證信，點擊連結後即可登入。
          </p>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="w-full py-3.5 rounded-xl bg-white/8 border border-white/10 text-sm text-gray-300 hover:bg-white/12 transition-all"
        >
          回到登入
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-black px-6 pt-10 pb-8 overflow-y-auto [&::-webkit-scrollbar]:hidden">

      {/* Tab switcher */}
      <div className="flex bg-white/8 rounded-full p-1 mb-8">
        <Link
          to="/login"
          className="flex-1 py-2 rounded-full text-gray-400 text-sm font-medium text-center hover:text-white transition-colors"
        >
          登入
        </Link>
        <span className="flex-1 py-2 rounded-full bg-white text-black text-sm font-semibold text-center">
          註冊
        </span>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-white mb-8">建立帳號</h1>

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
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 個字元"
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
        </div>

        {/* Confirm password */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400">確認密碼</label>
          <input
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再輸入一次密碼"
            className="w-full bg-white rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-300 transition-all"
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {/* Submit */}
        <div className="flex justify-center mt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-20 h-20 rounded-full bg-[#f9a8d4] text-black font-semibold text-sm hover:bg-[#f472b6] active:scale-95 transition-all shadow-lg shadow-pink-400/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "建立帳號"}
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mt-2">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-gray-500 text-xs">其他註冊選項</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Social buttons */}
        <div className="flex justify-center gap-4">
          {[
            { label: "f", color: "#1877F2" },
            { label: "G", color: "#fff" },
            { label: "🍎", color: "#fff" },
          ].map(({ label, color }) => (
            <button
              key={label}
              type="button"
              className="w-12 h-12 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-base font-bold hover:bg-white/12 transition-colors"
              style={{ color }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Footer link */}
        <p className="text-center text-sm text-gray-500 mt-auto pt-4">
          Already have an account?{" "}
          <Link to="/login" className="text-white font-medium hover:text-pink-300 transition-colors">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
