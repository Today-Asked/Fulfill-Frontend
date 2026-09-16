const ERROR_MAP: Record<string, string> = {
  "Email rate limit exceeded":
    "Email 寄送次數已達上限，請稍後再試。",
  "For security purposes, you can only request this once every 60 seconds":
    "請等待 60 秒後再重新申請。",
  "Invalid login credentials":
    "Email 或密碼錯誤",
  "Email not confirmed":
    "Email 尚未驗證，請至信箱查看驗證碼完成驗證",
  "Token has expired or is invalid":
    "驗證碼已失效或不正確，請重新申請",
  "New password should be different from the old password.":
    "新密碼不能與舊密碼相同",
  "User already registered":
    "此 Email 已被註冊",
  "Password should be at least 6 characters":
    "密碼至少 6 個字元",
  "Unable to validate email address: invalid format":
    "Email 格式不正確",
  "signup is disabled":
    "目前暫停開放註冊",
};

export function translateAuthError(message: string): string {
  // 完全匹配
  if (ERROR_MAP[message]) return ERROR_MAP[message];

  // 部分匹配（Supabase 有時會附加額外資訊）
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value;
  }

  // 找不到對應就回傳原始訊息
  return message;
}
