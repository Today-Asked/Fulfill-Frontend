import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { AvatarUpload } from "../components/AvatarUpload";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isArtist, setIsArtist] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError(null);
    setLoading(true);

    // 1. 更新 public.users
    const { error: updateError } = await supabase
      .from("users")
      .update({
        username: username.trim(),
        name: name.trim(),
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // 2. 若選擇開放委託，建立 artist_profiles
    if (isArtist) {
      const { error: artistError } = await supabase
        .from("artist_profiles")
        .insert({ user_id: user.id });

      if (artistError && artistError.code !== "23505") {
        // 23505 = unique violation，已存在就不管
        setError(artistError.message);
        setLoading(false);
        return;
      }
    }

    await refreshProfile();
    setLoading(false);
    navigate("/");
  }

  return (
    <div className="flex flex-col h-full px-6 pt-14 pb-8 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-400 mb-6 shadow-lg shadow-fuchsia-500/30" />
        <h1 className="text-2xl font-bold text-white mb-1">設定你的個人檔案</h1>
        <p className="text-sm text-gray-500">這些資訊會顯示在你的公開頁面</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Avatar */}
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            頭像
            <span className="text-gray-600 normal-case font-normal ml-1">（選填，點擊上傳）</span>
          </label>
          <div className="flex items-center gap-4">
            <AvatarUpload
              currentUrl={avatarUrl}
              name={name}
              size="md"
              onUploaded={setAvatarUrl}
            />
            <p className="text-xs text-gray-600">
              {avatarUrl ? "點擊更換頭像" : "支援 JPG、PNG、WebP"}
            </p>
          </div>
        </div>

        {/* Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            用戶名稱 <span className="text-fuchsia-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm select-none">
              @
            </span>
            <input
              type="text"
              required
              maxLength={50}
              pattern="^[a-zA-Z0-9_.]+$"
              title="只能使用英文、數字、底線、句點"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_handle"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all"
            />
          </div>
          <p className="text-xs text-gray-600">只能使用英文、數字、底線、句點</p>
        </div>

        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            顯示名稱 <span className="text-fuchsia-500">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="你想讓別人怎麼稱呼你"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all"
          />
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-gray-400 font-medium tracking-wide uppercase">
            自我介紹
            <span className="text-gray-600 normal-case font-normal ml-1">（選填）</span>
          </label>
          <textarea
            rows={3}
            maxLength={160}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="簡單介紹一下自己…"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/60 focus:bg-white/8 transition-all resize-none"
          />
          <p className="text-xs text-gray-600 text-right">{bio.length} / 160</p>
        </div>

        {/* Artist toggle */}
        <div
          onClick={() => setIsArtist((v) => !v)}
          className={`flex items-center justify-between px-4 py-4 rounded-2xl border cursor-pointer transition-all ${
            isArtist
              ? "bg-fuchsia-500/10 border-fuchsia-500/40"
              : "bg-white/5 border-white/10"
          }`}
        >
          <div>
            <p className="text-sm font-medium text-white">我是創作者，開放委託</p>
            <p className="text-xs text-gray-500 mt-0.5">
              你可以接受來自客戶的委託需求
            </p>
          </div>
          {/* Toggle pill */}
          <div
            className={`w-11 h-6 rounded-full transition-all shrink-0 ml-4 relative ${
              isArtist ? "bg-fuchsia-500" : "bg-white/10"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                isArtist ? "left-6" : "left-1"
              }`}
            />
          </div>
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
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-cyan-500 text-white text-sm font-semibold shadow-lg shadow-fuchsia-500/25 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              儲存中…
            </>
          ) : (
            "完成，開始使用"
          )}
        </button>
      </form>
    </div>
  );
}
