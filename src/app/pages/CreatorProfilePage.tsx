import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ImageOff, Info, Send, UserCheck, UserPlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { getOrCreateConversation } from "../../lib/chat";
import { submitReport, toggleBlock, type ReportReason } from "../../lib/creators";

interface CreatorProfile {
  userId: string;
  username: string | null;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  expertise: string[];
  artistId: number;
  joinedYear: string;
}

interface Artwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

export function CreatorProfilePage() {
  const { id: usernameParam } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [showSafety, setShowSafety] = useState(false);

  useEffect(() => {
    if (!usernameParam) return;

    (async () => {
      // 1. username 找 user
      const { data: user_data } = await supabase
        .from("users")
        .select("id, username, name, bio, avatar_url, expertise, created_at")
        .eq("username", usernameParam)
        .is("deleted_at", null)
        .single();

      if (!user_data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 2. user → artist_profile
      const { data: ap } = await supabase
        .from("artist_profiles")
        .select("id")
        .eq("user_id", user_data.id)
        .single();

      if (!ap) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile({
        userId: user_data.id,
        username: user_data.username,
        name: user_data.name,
        bio: user_data.bio,
        avatar_url: user_data.avatar_url,
        expertise: user_data.expertise ?? [],
        artistId: ap.id,
        joinedYear: new Date(user_data.created_at).getFullYear().toString(),
      });

      // 3. 撈作品集
      const { data: works } = await supabase
        .from("artworks")
        .select("id, title, cover_image_url")
        .eq("artist_id", ap.id)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(12);

      setArtworks(works ?? []);

      // 粉絲數對所有訪客顯示；登入後再查自己的追蹤狀態
      const { count } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", user_data.id);
      setFollowerCount(count ?? 0);

      if (user && user.id !== user_data.id) {
        const followRes = await supabase
          .from("follows")
          .select("follower_id")
          .eq("follower_id", user.id)
          .eq("following_id", user_data.id)
          .maybeSingle();
        setIsFollowing(!!followRes.data);
      }

      setLoading(false);
    })();
  }, [usernameParam, user]);

  async function handleToggleFollow() {
    if (!user || !profile) return;
    if (isFollowing) {
      await supabase.from("follows").delete()
        .eq("follower_id", user.id).eq("following_id", profile.userId);
      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
    } else {
      await supabase.from("follows").insert({ follower_id: user.id, following_id: profile.userId });
      setIsFollowing(true);
      setFollowerCount((prev) => prev + 1);
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl bg-[#141414] pb-10">
        <div className="px-6 pt-12 pb-6">
          <div className="w-10 h-10 rounded-full bg-white/8 mb-6" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-24 h-24 rounded-full bg-white/8" />
            <div className="flex-1 space-y-2">
              <div className="h-6 w-32 bg-white/8 rounded-xl" />
              <div className="h-4 w-48 bg-white/6 rounded-xl" />
            </div>
          </div>
          <div className="h-4 w-full bg-white/6 rounded-xl mb-2" />
          <div className="h-4 w-2/3 bg-white/6 rounded-xl" />
        </div>
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-2xl bg-[#141414]">
        <p className="text-gray-400 text-sm">找不到這位創作者</p>
        <button
          onClick={() => navigate(-1)}
          className="text-white text-sm underline underline-offset-2"
        >
          返回上一頁
        </button>
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.userId;

  return (
    <div className="rounded-2xl bg-[#141414] pb-10">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            aria-label="返回"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl transition-all hover:bg-white/15"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          {!isOwnProfile && (
            <button
              onClick={() => { if (!user) { navigate('/login'); return; } setShowSafety(true); }}
              aria-label="帳號資訊與安全選項"
              className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/10 text-white/65 backdrop-blur-xl transition-all hover:bg-white/15 hover:text-white"
            >
              <Info size={20} />
            </button>
          )}
        </div>

        {/* Avatar + 名字 */}
        <div className="flex items-center gap-4 mb-5">
          <ProfileAvatar url={profile.avatar_url} name={profile.name} />
          <div className="flex-1">
            <h1 className="text-white text-2xl font-bold mb-0.5">
              {profile.name ?? profile.username ?? "創作者"}
            </h1>
            {profile.username && (
              <p className="text-gray-500 text-sm">@{profile.username}</p>
            )}
            <p className="text-gray-500 text-xs mt-1">加入於 {profile.joinedYear}</p>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-gray-300 text-sm leading-relaxed mb-5">{profile.bio}</p>
        )}

        {profile.expertise.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {profile.expertise.map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/45">#{tag}</span>
            ))}
          </div>
        )}

        <div className="mb-5 flex items-baseline gap-1.5">
          <strong className="text-sm font-semibold text-white">{followerCount}</strong>
          <span className="text-xs text-white/40">粉絲</span>
        </div>

        {/* Actions */}
        {isOwnProfile ? (
          <button
            onClick={() => navigate("/profile")}
            className="w-full py-3 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 text-white font-semibold hover:bg-white/15 transition-all"
          >
            編輯個人頁
          </button>
        ) : (
          <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
            <button
              onClick={() => {
                if (!user) { navigate("/login"); return; }
                navigate(`/invite/${profile.artistId}`);
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 font-semibold text-black transition-opacity hover:opacity-90"
            >
              <Send size={16} />合作邀請
            </button>
            <button
              onClick={async () => {
                if (!user) { navigate("/login"); return; }
                const convId = await getOrCreateConversation(user.id, profile.userId);
                if (convId) navigate(`/chat/${convId}`);
              }}
              className="flex-1 py-3 rounded-xl bg-white/10 backdrop-blur-xl text-white font-semibold hover:opacity-90 transition-opacity shadow-[inset_0_2px_8px_rgba(255,255,255,0.24),0_4px_16px_rgba(255,255,255,0.12)] border border-white/30"
            >
              聊聊
            </button>
            <button
              onClick={() => { if (!user) { navigate("/login"); return; } handleToggleFollow(); }}
              aria-label={isFollowing ? "取消追蹤" : "追蹤這位創作者"}
              className={`flex h-12 min-w-24 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold backdrop-blur-xl transition-all ${
                isFollowing
                  ? "border-white/25 bg-white/15 text-white hover:bg-white/20"
                  : "border-white bg-white text-black hover:bg-white/90"
              }`}
            >
              {isFollowing ? <UserCheck size={17} /> : <UserPlus size={17} />}
              {isFollowing ? "追蹤中" : "追蹤"}
            </button>
          </div>
        )}
      </div>

      {/* 作品集 */}
      <div className="px-6">
        <h2 className="text-white text-lg font-bold mb-4">
          作品集
          {artworks.length > 0 && (
            <span className="text-gray-500 text-sm font-normal ml-2">
              {artworks.length} 件
            </span>
          )}
        </h2>

        {artworks.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <ImageOff size={28} className="text-gray-600" />
            <p className="text-gray-500 text-sm">尚無公開作品</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {artworks.map((artwork) => (
              <button
                key={artwork.id}
                onClick={() => navigate(`/artwork/${artwork.id}`)}
                className="relative aspect-square rounded-2xl overflow-hidden group bg-white/5"
              >
                {artwork.cover_image_url ? (
                  <img
                    src={artwork.cover_image_url}
                    alt={artwork.title ?? ""}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageOff size={20} className="text-gray-600" />
                  </div>
                )}
                {artwork.title && (
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium truncate">
                      {artwork.title}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {showSafety && user && (
        <SafetyDialog
          creatorName={profile.name ?? profile.username ?? "這位創作者"}
          targetId={profile.userId}
          reporterId={user.id}
          onClose={() => setShowSafety(false)}
          onBlocked={() => navigate('/search')}
        />
      )}
    </div>
  );
}

function SafetyDialog({ creatorName, targetId, reporterId, onClose, onBlocked }: { creatorName: string; targetId: string; reporterId: string; onClose: () => void; onBlocked: () => void }) {
  const [mode, setMode] = useState<'menu' | 'report'>('menu');
  const [reason, setReason] = useState<ReportReason>('spam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function report() { setBusy(true); setError(''); try { await submitReport({ reporterId, targetType: 'creator', targetId, reason, detail: detail.trim() }); onClose(); } catch (e) { setError(e instanceof Error ? e.message : '檢舉送出失敗。'); setBusy(false); } }
  async function block() { setBusy(true); setError(''); try { await toggleBlock(reporterId, targetId); onClose(); onBlocked(); } catch (e) { setError(e instanceof Error ? e.message : '封鎖失敗。'); setBusy(false); } }
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="safety-title">
      <div className="w-full max-w-md rounded-3xl border border-white/15 bg-[#171717] p-6 shadow-2xl">
        <h2 id="safety-title" className="text-xl font-semibold">{mode === 'menu' ? '安全選項' : `檢舉 ${creatorName}`}</h2>
        {mode === 'menu' ? (
          <div className="mt-5 grid gap-2">
            <button onClick={() => setMode('report')} className="rounded-xl border border-white/12 px-4 py-3 text-left text-sm text-white/70 transition-colors hover:border-white/30 hover:bg-white/5">檢舉帳號或內容</button>
            <button disabled={busy} onClick={() => void block()} className="rounded-xl border border-red-400/20 px-4 py-3 text-left text-sm text-red-200 transition-colors hover:border-red-400/40 hover:bg-red-500/8">封鎖 {creatorName}</button>
            <p className="mt-2 text-xs leading-5 text-white/35">封鎖後，對方會從你的創作者搜尋結果移除。</p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            <label className="text-sm text-white/60">原因
              <select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)} className="input mt-2 rounded-xl">
                <option value="impersonation">冒用身分</option><option value="stolen_work">盜用作品</option><option value="harassment">騷擾</option><option value="spam">垃圾訊息</option><option value="inappropriate">不當內容</option><option value="other">其他</option>
              </select>
            </label>
            <label className="text-sm text-white/60">補充說明
              <textarea value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={1000} rows={5} className="input mt-2 resize-none rounded-xl" />
            </label>
            <button disabled={busy} onClick={() => void report()} className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40">送出檢舉</button>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <button onClick={onClose} className="mt-5 rounded-full px-3 py-1.5 text-sm text-white/45 transition-colors hover:bg-white/8 hover:text-white/70">取消</button>
      </div>
    </div>
  );
}

function ProfileAvatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name ?? "creator"}
        className="w-24 h-24 rounded-full object-cover border-4 border-white/20 shrink-0"
      />
    );
  }
  return (
    <div className="w-24 h-24 rounded-full bg-white border-4 border-white/20 flex items-center justify-center shrink-0">
      <span className="text-white/70 text-3xl font-bold">
        {name?.[0]?.toUpperCase() ?? "?"}
      </span>
    </div>
  );
}
