import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router";
import { Lock } from "lucide-react";

/**
 * Shared "you need to log in for that" flow for guest browsing.
 *
 * Guests can freely browse artworks, creator profiles, and search — but
 * anything that writes data (like, save, follow, invite, inquire...) needs
 * an account. Rather than silently redirecting to /login on every one of
 * those actions, `requireAuth` pops this animated dialog so the guest knows
 * *why* they're being asked and can pick login or register.
 *
 * Usage:
 *   const loginGate = useLoginGate();
 *   ...
 *   onClick={() => loginGate.requireAuth(user, () => doTheThing())}
 *   ...
 *   <LoginGateDialog {...loginGate} />
 */
export function useLoginGate() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | undefined>();

  const requireAuth = useCallback(
    (user: unknown, action: () => void, customMessage?: string) => {
      if (user) {
        action();
        return;
      }
      setMessage(customMessage);
      setOpen(true);
    },
    [],
  );

  const close = useCallback(() => setOpen(false), []);

  return { open, message, close, requireAuth };
}

export function LoginGateDialog({
  open,
  message,
  close,
}: ReturnType<typeof useLoginGate>) {
  const navigate = useNavigate();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[95] grid place-items-center bg-black/75 p-5 backdrop-blur-sm animate-in fade-in duration-[290ms]"
      role="dialog"
      aria-modal="true"
      aria-label="需要登入"
    >
      <button type="button" aria-label="關閉" onClick={close} className="absolute inset-0" />
      <div className="relative z-10 w-full max-w-xs rounded-3xl border border-white/10 bg-[#181818] p-6 text-center shadow-2xl animate-in fade-in zoom-in-95 duration-[290ms] ease-out">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white">
          <Lock size={20} />
        </div>
        <p className="mt-4 text-sm font-medium text-white">{message ?? "登入解鎖更多功能"}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/85"
          >
            登入
          </button>
          <button
            type="button"
            onClick={() => navigate("/register")}
            className="w-full rounded-xl border border-white/10 bg-white/8 py-2.5 text-sm text-gray-300 transition-colors hover:bg-white/12"
          >
            註冊
          </button>
          <button
            type="button"
            onClick={close}
            className="mt-1 text-xs text-gray-500 transition-colors hover:text-gray-300"
          >
            先不用了
          </button>
        </div>
      </div>
    </div>
  );
}
