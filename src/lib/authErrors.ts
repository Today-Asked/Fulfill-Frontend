const ERROR_MAP: Record<string, string> = {
  "Email rate limit exceeded":
    "Email 寄送次數已達上限，請稍後再試。",
  "For security purposes, you can only request this once every 60 seconds":
    "請等待 60 秒後再重新申請。",
  "Invalid login credentials":
    "Email 或密碼錯誤，請再試一次。",
  "Email not confirmed":
    "Email 尚未驗證，請先到信箱點擊驗證連結。",
  "User already registered":
    "這個 Email 已經註冊過了，請直接登入。",
  "Password should be at least 6 characters":
    "密碼至少需要 6 個字元。",
  "Unable to validate email address: invalid format":
    "Email 格式不正確。",
  "signup is disabled":
    "目前暫停開放註冊。",
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
