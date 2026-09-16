import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { translateAuthError } from "../../lib/authErrors";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "verify">("form");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

    setLoading(false);

    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }

    setStep("verify");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.trim().length !== 8) { setError("請輸入 8 位數驗證碼"); return; }
    setVerifying(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: "recovery" });
    setVerifying(false);

    if (verifyError) { setError(translateAuthError(verifyError.message)); return; }
    navigate("/reset-password");
  }

  async function handleResend() {
    setError(null);
    setResent(false);
    setResending(true);
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);
    if (resendError) { setError(translateAuthError(resendError.message)); return; }
    setResent(true);
  }

  if (step === "verify") {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center shadow-lg shadow-white/30">
          <span className="text-2xl">✉️</span>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">驗證碼已送出</h2>
          <p className="text-sm text-gray-400">
            請到 <span className="text-white">{email}</span> 收取密碼重設信，輸入信中的 8 位數驗證碼繼續。
          </p>
          <p className="text-xs text-gray-600 mt-3">
            沒看到信嗎？記得看一下垃圾郵件匣。
          </p>
        </div>

        <form onSubmit={handleVerify} className="w-full flex flex-col gap-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="12345678"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-center text-lg tracking-[0.35em] text-white placeholder:text-gray-600 placeholder:tracking-[0.35em] focus:outline-none focus:border-white/60 focus:bg-white/8 transition-all"
          />

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          {resent && !error && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              已重新寄送一組驗證碼。
            </p>
          )}

          <button
            type="submit"
            disabled={verifying}
            className="w-full py-3.5 rounded-2xl bg-white/10 text-white text-sm font-semibold shadow-lg shadow-white/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? "驗證中…" : "確認驗證碼"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            {resending ? "寄送中…" : "沒收到？重新寄送驗證碼"}
          </button>
        </form>

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
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-white/60 focus:bg-white/8 transition-all"
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
          className="w-full py-3.5 rounded-2xl bg-white/10 text-white text-sm font-semibold shadow-lg shadow-white/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
        >
          {loading ? "寄送中…" : "寄送重設連結"}
        </button>
      </form>
    </div>
  );
}
