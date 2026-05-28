import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ChevronDown, LogOut, Plus, X,
  ChevronRight, Image, Bookmark,
  Heart, Lock, Camera, Trash2,
  EyeOff, Eye, Pencil, Check,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { AvatarUpload } from "../components/AvatarUpload";
import { ArtworkUploadSheet } from "../components/ArtworkUploadSheet";

interface UserProfile {
  username: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
}

interface ArtistProfile {
  id: number;
  is_verified: boolean;
}

interface Artwork {
  id: number;
  title: string;
  cover_image_url: string;
  status: "published" | "archived" | "draft";
}

interface LikedArtwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [artist, setArtist]             = useState<ArtistProfile | null>(null);
  const [artworks, setArtworks]         = useState<Artwork[]>([]);
  const [likedArtworks, setLikedArtworks] = useState<LikedArtwork[]>([]);
  const [activeTab, setActiveTab]       = useState(0);
  const [showUpload, setShowUpload]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [editingBio, setEditingBio]     = useState(false);
  const [bioInput, setBioInput]         = useState("");
  const [savingBio, setSavingBio]       = useState(false);

  // 分頁依身份動態決定
  const tabs = artist
    ? [
        { icon: Image,     label: "作品集",   isLockHeart: false },
        { icon: Bookmark,  label: "收藏",     isLockHeart: false },
        { icon: null,      label: "喜愛",     isLockHeart: true  },
      ]
    : [
        { icon: Bookmark,  label: "收藏",     isLockHeart: false },
        { icon: null,      label: "喜愛",     isLockHeart: true  },
      ];

  useEffect(() => {
    if (!user) return;

    // 撈 profile
    supabase.from("users").select("username, name, bio, avatar_url")
      .eq("id", user.id).single()
      .then(({ data }) => { if (data) setProfile(data); });

    // 撈 artist profile
    supabase.from("artist_profiles").select("id, is_verified")
      .eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { setArtist(data); });

    // 撈喜愛的作品
    supabase
      .from("likes")
      .select("artwork_id, artworks(id, title, cover_image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const mapped: LikedArtwork[] = (data ?? [])
          .filter((l: any) => l.artworks)
          .map((l: any) => ({
            id: l.artworks.id,
            title: l.artworks.title,
            cover_image_url: l.artworks.cover_image_url,
          }));
        setLikedArtworks(mapped);
      });
  }, [user]);

  useEffect(() => {
    if (!artist) return;
    // 自己的 profile 看全部（含隱藏），才能管理
    supabase.from("artworks")
      .select("id, title, cover_image_url, status")
      .eq("artist_id", artist.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setArtworks(data as Artwork[]); });
  }, [artist]);

  async function handleArchiveToggle(artwork: Artwork) {
    const newStatus = artwork.status === "published" ? "archived" : "published";
    await supabase.from("artworks").update({ status: newStatus }).eq("id", artwork.id);
    setArtworks((prev) =>
      prev.map((a) => (a.id === artwork.id ? { ...a, status: newStatus } : a))
    );
  }

  async function handleDeleteArtwork(id: number) {
    await supabase
      .from("artworks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    setArtworks((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSaveBio() {
    if (!user) return;
    setSavingBio(true);
    const trimmed = bioInput.trim() || null;
    await supabase.from("users").update({ bio: trimmed }).eq("id", user.id);
    setProfile((p) => p ? { ...p, bio: trimmed } : p);
    setEditingBio(false);
    setSavingBio(false);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    await supabase.rpc("delete_own_account");
    await signOut();
  }

  // 作品集 tab index（有 artist 才是 0，否則不存在）
  const artworkTabIdx = artist ? 0 : -1;
  const isArtworkTab  = activeTab === artworkTabIdx && artist != null;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f] overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-12 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-medium">
            {profile?.username ? `@${profile.username}` : "…"}
          </span>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
        <button onClick={signOut} className="text-gray-400 hover:text-white transition-colors">
          <LogOut size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28 [&::-webkit-scrollbar]:hidden">
        {/* Profile info */}
        <div className="px-5 pb-4">
          <div className="flex items-start gap-4 mb-4">
            <AvatarUpload
              currentUrl={profile?.avatar_url ?? null}
              name={profile?.name}
              size="lg"
              onUploaded={(url) => setProfile((p) => p ? { ...p, avatar_url: url } : p)}
            />

            <div className="flex-1 pt-1">
              <h2 className="text-white text-lg font-semibold mb-0.5">
                {profile?.name ?? "…"}
              </h2>
              {profile?.bio && (
                <p className="text-gray-500 text-xs mb-2 line-clamp-2">{profile.bio}</p>
              )}
              {/* Artist badge */}
              {artist && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300">
                    創作者
                  </span>
                  {artist.is_verified && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                      已認證
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          <button className="flex items-center gap-1.5 mb-4">
            <ChevronRight size={13} className="text-gray-500" />
            <span className="text-gray-400 text-xs">檢視你的評價……</span>
          </button>

          {!profile?.bio && !editingBio && (
            <button
              onClick={() => { setBioInput(""); setEditingBio(true); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 border border-white/12 rounded-full hover:bg-white/4 transition-colors"
            >
              <Plus size={14} className="text-gray-400" />
              <span className="text-gray-400 text-xs">新增你的個人簡介</span>
            </button>
          )}
          {editingBio && (
            <div className="w-full">
              <textarea
                autoFocus
                value={bioInput}
                onChange={(e) => setBioInput(e.target.value)}
                rows={3}
                maxLength={160}
                placeholder="簡單介紹一下自己…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-fuchsia-500/40 transition-all resize-none"
              />
              <p className="text-gray-600 text-[10px] text-right mt-0.5">{bioInput.length} / 160</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveBio}
                  disabled={savingBio}
                  className="flex-1 py-2 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-xs hover:bg-fuchsia-500/30 transition-colors disabled:opacity-50"
                >
                  {savingBio ? "儲存中…" : "儲存"}
                </button>
                <button
                  onClick={() => setEditingBio(false)}
                  className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 text-xs hover:bg-white/8 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/6 mx-5 mb-4" />

        {/* Tabs */}
        <div className="flex items-center px-5 mb-5 gap-2">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors relative ${
                activeTab === idx
                  ? "bg-white/10 border border-white/15"
                  : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {tab.isLockHeart ? (
                <div className="relative">
                  <Heart size={16} className={activeTab === idx ? "text-white" : "text-gray-600"} />
                  <Lock size={8} className={`absolute -bottom-0.5 -right-0.5 ${activeTab === idx ? "text-white" : "text-gray-600"}`} />
                </div>
              ) : tab.icon ? (
                <tab.icon size={18} className={activeTab === idx ? "text-white" : "text-gray-600"} />
              ) : null}
              {activeTab === idx && (
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-white rounded-full" />
              )}
            </button>
          ))}

          {/* Stats */}
          <div className="ml-auto flex items-center gap-4">
            <div className="text-center">
              <p className="text-white text-sm font-semibold">{artworks.length}</p>
              <p className="text-gray-600 text-[9px]">作品</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-semibold">0</p>
              <p className="text-gray-600 text-[9px]">收藏</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-semibold">{likedArtworks.length}</p>
              <p className="text-gray-600 text-[9px]">喜愛</p>
            </div>
          </div>
        </div>

        {/* ── 作品集 ── */}
        {isArtworkTab && (
          artworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
                <Camera size={32} className="text-gray-500" />
              </div>
              <p className="text-gray-500 text-sm">尚無作品</p>
              <button
                onClick={() => setShowUpload(true)}
                className="mt-2 px-5 py-2 rounded-full bg-white/8 border border-white/12 text-gray-300 text-xs hover:bg-white/12 transition-colors"
              >
                上傳第一件作品
              </button>
            </div>
          ) : (
            <div className="px-5">
              {/* 作品網格 header */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-500 text-xs">{artworks.length} 件作品</span>
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
                    editMode
                      ? "bg-fuchsia-500/20 border-fuchsia-500/40 text-fuchsia-300"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  {editMode ? <><Check size={11} />完成</> : <><Pencil size={11} />管理</>}
                </button>
              </div>

              {/* 作品網格 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {artworks.map((artwork) => (
                  <div
                    key={artwork.id}
                    onClick={() => !editMode && navigate(`/artwork/${artwork.id}`)}
                    className={`aspect-square rounded-xl overflow-hidden relative group ${
                      editMode ? "cursor-default" : "cursor-pointer"
                    }`}
                  >
                    <img
                      src={artwork.cover_image_url}
                      alt={artwork.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        editMode ? "brightness-50" : "group-hover:scale-105"
                      } ${artwork.status === "archived" ? "opacity-50" : ""}`}
                    />

                    {/* 隱藏中標籤 */}
                    {artwork.status === "archived" && !editMode && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded-full">
                        <EyeOff size={10} className="text-gray-300" />
                        <span className="text-[9px] text-gray-300">隱藏中</span>
                      </div>
                    )}

                    {/* 一般模式 hover overlay */}
                    {!editMode && (
                      <>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                          <p className="text-white text-xs font-medium truncate">{artwork.title}</p>
                        </div>
                      </>
                    )}

                    {/* 編輯模式 overlay */}
                    {editMode && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3">
                        <p className="text-white text-[10px] font-medium text-center truncate w-full px-1">
                          {artwork.title}
                        </p>
                        <div className="flex gap-2">
                          {/* 隱藏 / 顯示 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchiveToggle(artwork); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-[10px] hover:bg-white/25 transition-colors"
                          >
                            {artwork.status === "archived"
                              ? <><Eye size={11} />顯示</>
                              : <><EyeOff size={11} />隱藏</>
                            }
                          </button>
                          {/* 刪除 */}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteArtwork(artwork.id); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 size={11} />刪除
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 新增按鈕（非編輯模式才顯示）*/}
                {!editMode && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 transition-all"
                  >
                    <Plus size={24} className="text-gray-600" />
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {/* ── 收藏 ── */}
        {((!artist && activeTab === 0) || (artist && activeTab === 1)) && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
              <Bookmark size={32} className="text-gray-500" />
            </div>
            <p className="text-gray-500 text-sm">尚無收藏</p>
          </div>
        )}

        {/* ── 喜愛 ── */}
        {((!artist && activeTab === 1) || (artist && activeTab === 2)) && (
          likedArtworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
                <Heart size={32} className="text-gray-500" />
              </div>
              <p className="text-gray-500 text-sm">尚無喜愛的作品</p>
            </div>
          ) : (
            <div className="px-5">
              <span className="text-gray-500 text-xs block mb-2">{likedArtworks.length} 件喜愛</span>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {likedArtworks.map((artwork) => (
                  <button
                    key={artwork.id}
                    onClick={() => navigate(`/artwork/${artwork.id}`)}
                    className="aspect-square rounded-xl overflow-hidden relative group bg-white/5"
                  >
                    {artwork.cover_image_url ? (
                      <img
                        src={artwork.cover_image_url}
                        alt={artwork.title ?? ""}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Heart size={20} className="text-gray-600" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                    {artwork.title && (
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-all">
                        <p className="text-white text-xs font-medium truncate">{artwork.title}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        )}

        {/* Delete account */}
        <div className="px-5 pt-6 pb-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 text-xs text-red-500/60 hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} />
            刪除帳號
          </button>
        </div>
      </div>

      {/* Artwork upload sheet */}
      {showUpload && artist && (
        <ArtworkUploadSheet
          artistProfileId={artist.id}
          onClose={() => setShowUpload(false)}
          onUploaded={(artwork) => setArtworks((prev) => [artwork, ...prev])}
        />
      )}

      {/* Delete confirm sheet */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full bg-[#111116] border border-white/10 rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-4">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-2" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold">確定要刪除帳號？</p>
                <p className="text-gray-500 text-xs mt-0.5">此操作無法還原，所有資料將永久刪除</p>
              </div>
            </div>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="w-full py-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-all disabled:opacity-50"
            >
              {deleting ? "刪除中…" : "確認刪除"}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-full py-3 rounded-2xl bg-white/5 text-gray-400 text-sm hover:bg-white/8 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
