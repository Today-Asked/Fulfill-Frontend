import React, { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { AvatarUpload } from "../components/AvatarUpload";

interface EditableProfile {
  username: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  expertise: string[] | null;
  username_changed_at: string | null;
}

export function EditProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [expertise, setExpertise] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("users")
      .select("username, name, bio, avatar_url, expertise, username_changed_at")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setProfile(data);
        setName(data.name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setExpertise(data.expertise ?? []);
      });
  }, [user]);

  const usernameDaysRemaining = profile?.username_changed_at
    ? Math.max(0, Math.ceil((14 * 86_400_000 - (Date.now() - new Date(profile.username_changed_at).getTime())) / 86_400_000))
    : 0;

  function addTag(value: string) {
    const tag = value.trim().replace(/^#/, "").slice(0, 20);
    if (!tag || expertise.includes(tag) || expertise.length >= 8) return;
    setExpertise((current) => [...current, tag]);
    setTagDraft("");
  }

  async function save() {
    if (!user || !profile) return;
    const nextName = name.trim();
    const nextUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!nextName) return setError("請輸入姓名");
    if (!/^[a-z0-9._]{3,30}$/.test(nextUsername)) {
      return setError("ID 需為 3–30 個小寫英文字母、數字、句點或底線");
    }

    setSaving(true);
    setError("");
    const usernameChanged = nextUsername !== profile.username;
    const { error: saveError } = await supabase
      .from("users")
      .update({
        name: nextName,
        bio: bio.trim() || null,
        expertise,
        updated_at: new Date().toISOString(),
        ...(usernameChanged ? { username: nextUsername, username_changed_at: new Date().toISOString() } : {}),
      })
      .eq("id", user.id);

    if (saveError) {
      const message = String(saveError.message ?? "");
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "這個 ID 已被使用，請換一個"
          : message.includes("14 days")
            ? "ID 於 14 天內只能更改一次"
            : "儲存失敗，請稍後再試",
      );
      setSaving(false);
      return;
    }
    navigate("/profile", { replace: true });
  }

  if (!profile) {
    return <div className="grid min-h-[70dvh] place-items-center"><Loader2 className="animate-spin text-white/55" /></div>;
  }

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-2xl bg-[#0d1014]">
      <header className="sticky top-0 z-20 grid grid-cols-[44px_1fr_64px] items-center border-b border-white/10 bg-[#0d1014]/95 px-4 py-3 backdrop-blur-xl">
        <button type="button" onClick={() => navigate(-1)} aria-label="返回" className="grid h-11 w-11 place-items-center rounded-full text-white hover:bg-white/8">
          <ArrowLeft size={25} />
        </button>
        <h1 className="text-center text-lg font-semibold text-white">編輯個人檔案</h1>
        <button type="button" onClick={save} disabled={saving} className="justify-self-end text-sm font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-45">
          {saving ? "儲存中" : "完成"}
        </button>
      </header>

      <section className="border-b border-white/10 px-5 py-8 text-center">
        <div className="flex justify-center">
          <AvatarUpload
            currentUrl={profile.avatar_url}
            name={name}
            size="lg"
            onUploaded={(url) => setProfile((current) => current ? { ...current, avatar_url: url } : current)}
          />
        </div>
        <p className="mt-3 text-sm font-medium text-sky-400">編輯大頭貼照</p>
        <p className="mt-1 text-xs text-white/30">點擊頭貼即可上傳新圖片</p>
      </section>

      <section className="divide-y divide-white/8 px-5">
        <EditRow label="姓名">
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="w-full bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/25" placeholder="你的顯示名稱" />
        </EditRow>

        <EditRow label="用戶 ID">
          <div>
            <div className="flex items-center">
              <span className="text-sm text-white/35">@</span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                disabled={usernameDaysRemaining > 0}
                maxLength={30}
                className="w-full bg-transparent px-1 py-1 text-sm text-white outline-none disabled:cursor-not-allowed disabled:text-white/35"
              />
            </div>
            <p className="mt-1 text-[11px] leading-4 text-white/30">
              {usernameDaysRemaining > 0 ? `還有 ${usernameDaysRemaining} 天可再次修改` : "修改後 14 天內無法再次更改"}
            </p>
          </div>
        </EditRow>

        <EditRow label="擅長領域" alignStart>
          <div>
            <div className="flex flex-wrap gap-2">
              {expertise.map((tag) => (
                <button key={tag} type="button" onClick={() => setExpertise((current) => current.filter((item) => item !== tag))} className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1.5 text-xs text-white/70">
                  #{tag}<X size={11} />
                </button>
              ))}
            </div>
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag(tagDraft);
                }
              }}
              onBlur={() => addTag(tagDraft)}
              disabled={expertise.length >= 8}
              className="mt-2 w-full bg-transparent py-1 text-sm text-white outline-none placeholder:text-white/25 disabled:hidden"
              placeholder="輸入後按 Enter 新增 #標籤"
            />
            <p className="mt-1 text-[11px] text-white/30">最多 8 個標籤</p>
          </div>
        </EditRow>

        <EditRow label="個人簡介" alignStart>
          <div>
            <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} maxLength={160} className="w-full resize-none bg-transparent py-1 text-sm leading-6 text-white outline-none placeholder:text-white/25" placeholder="簡單介紹一下自己…" />
            <p className="mt-1 text-right text-[11px] text-white/30">{bio.length} / 160</p>
          </div>
        </EditRow>
      </section>

      {error && <p className="mx-5 mt-5 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      <div className="px-5 py-8">
        <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-black disabled:opacity-45">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {saving ? "儲存中…" : "儲存變更"}
        </button>
      </div>
    </div>
  );
}

function EditRow({ label, children, alignStart = false }: { label: string; children: React.ReactNode; alignStart?: boolean }) {
  return (
    <div className={`grid grid-cols-[92px_1fr] gap-4 py-5 ${alignStart ? "items-start" : "items-center"}`}>
      <span className="text-sm text-white/70">{label}</span>
      {children}
    </div>
  );
}
