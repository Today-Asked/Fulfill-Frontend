import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  LogOut, Menu, Plus, X,
  Image, Bookmark,
  Heart, Lock, Camera, Trash2,
  Pencil, Check, Share2, Users, Archive,
  GripVertical, RotateCcw,
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
  expertise: string[] | null;
  username_changed_at: string | null;
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
  display_order?: number;
}

interface LikedArtwork {
  id: number;
  title: string | null;
  cover_image_url: string | null;
}

interface SocialUser {
  id: string;
  username: string | null;
  name: string | null;
  avatar_url: string | null;
}

export function ProfilePage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile]           = useState<UserProfile | null>(null);
  const [artist, setArtist]             = useState<ArtistProfile | null>(null);
  const [artworks, setArtworks]         = useState<Artwork[]>([]);
  const [likedArtworks, setLikedArtworks] = useState<LikedArtwork[]>([]);
  const [savedArtworks, setSavedArtworks] = useState<LikedArtwork[]>([]);
  const [activeTab, setActiveTab]       = useState(0);
  const [showUpload, setShowUpload]     = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [deleting, setDeleting]         = useState(false);
  const [editMode, setEditMode]         = useState(false);
  const [showArchive, setShowArchive]   = useState(false);
  const [draggedArtworkId, setDraggedArtworkId] = useState<number | null>(null);
  const [coverPickerArtwork, setCoverPickerArtwork] = useState<Artwork | null>(null);
  const [pendingDeleteArtwork, setPendingDeleteArtwork] = useState<Artwork | null>(null);
  const artworkOrderRef = useRef<Artwork[]>([]);
  const pointerDragIdRef = useRef<number | null>(null);
  const [shareCopied, setShareCopied]   = useState(false);
  const [followers, setFollowers]       = useState<SocialUser[]>([]);
  const [following, setFollowing]       = useState<SocialUser[]>([]);
  const [connectionView, setConnectionView] = useState<"followers" | "following" | null>(null);

  useEffect(() => {
    if (!showAccountMenu) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAccountMenu(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showAccountMenu]);

  useEffect(() => {
    if (!shareCopied) return;
    const timer = window.setTimeout(() => setShareCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [shareCopied]);

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
    supabase.from("users").select("username, name, bio, avatar_url, expertise, username_changed_at")
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

    // 撈收藏的作品
    supabase
      .from("saves")
      .select("artwork_id, artworks(id, title, cover_image_url)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        const mapped: LikedArtwork[] = (data ?? [])
          .filter((item: any) => item.artworks)
          .map((item: any) => ({
            id: item.artworks.id,
            title: item.artworks.title,
            cover_image_url: item.artworks.cover_image_url,
          }));
        setSavedArtworks(mapped);
      });

    // 撈粉絲與追蹤中的帳號
    Promise.all([
      supabase.from("follows").select("follower_id").eq("following_id", user.id),
      supabase.from("follows").select("following_id").eq("follower_id", user.id),
    ]).then(async ([followersRes, followingRes]) => {
      const followerIds = (followersRes.data ?? []).map((row: any) => row.follower_id);
      const followingIds = (followingRes.data ?? []).map((row: any) => row.following_id);
      const ids = Array.from(new Set([...followerIds, ...followingIds]));

      if (ids.length === 0) {
        setFollowers([]);
        setFollowing([]);
        return;
      }

      const { data: people } = await supabase
        .from("users")
        .select("id, username, name, avatar_url")
        .in("id", ids);
      const peopleById = new Map<string, SocialUser>(
        (people ?? []).map((person: SocialUser) => [person.id, person]),
      );
      setFollowers(followerIds.map((id: string) => peopleById.get(id)).filter(Boolean) as SocialUser[]);
      setFollowing(followingIds.map((id: string) => peopleById.get(id)).filter(Boolean) as SocialUser[]);
    });
  }, [user]);

  useEffect(() => {
    if (!artist) return;
    // 自己的 profile 看全部（含隱藏），才能管理
    supabase.from("artworks")
      .select("id, title, cover_image_url, status, display_order")
      .eq("artist_id", artist.id)
      .is("deleted_at", null)
      .order("display_order", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        artworkOrderRef.current = data as Artwork[];
        setArtworks(data as Artwork[]);
      });
  }, [artist]);

  async function handleArchiveToggle(artwork: Artwork) {
    const newStatus = artwork.status === "archived" ? "published" : "archived";
    await supabase.from("artworks").update({ status: newStatus }).eq("id", artwork.id);
    const next = artworkOrderRef.current.map((item) => item.id === artwork.id ? { ...item, status: newStatus } : item);
    artworkOrderRef.current = next;
    setArtworks(next);
  }

  async function handleDeleteArtwork(id: number) {
    await supabase
      .from("artworks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    const next = artworkOrderRef.current.filter((artwork) => artwork.id !== id);
    artworkOrderRef.current = next;
    setArtworks(next);
    setPendingDeleteArtwork(null);
  }

  function reorderArtworkState(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;
    const current = artworkOrderRef.current;
    const visible = current.filter((artwork) => artwork.status !== "archived");
    const sourceIndex = visible.findIndex((artwork) => artwork.id === sourceId);
    const targetIndex = visible.findIndex((artwork) => artwork.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const reordered = [...visible];
    const [moved] = reordered.splice(sourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    const archived = current.filter((artwork) => artwork.status === "archived");
    const withOrder = reordered.map((artwork, index) => ({ ...artwork, display_order: index }));
    const next = [...withOrder, ...archived];
    artworkOrderRef.current = next;
    setArtworks(next);
  }

  async function persistArtworkOrder() {
    const visible = artworkOrderRef.current.filter((artwork) => artwork.status !== "archived");
    await Promise.all(
      visible.map((artwork) =>
        supabase.from("artworks").update({ display_order: artwork.display_order }).eq("id", artwork.id),
      ),
    );
  }

  async function handleCoverChange(artwork: Artwork, url: string) {
    const { error } = await supabase.from("artworks").update({ cover_image_url: url }).eq("id", artwork.id);
    if (error) return;
    setArtworks((current) => current.map((item) => item.id === artwork.id ? { ...item, cover_image_url: url } : item));
    artworkOrderRef.current = artworkOrderRef.current.map((item) => item.id === artwork.id ? { ...item, cover_image_url: url } : item);
    setCoverPickerArtwork(null);
  }

  function handleEditProfile() {
    navigate("/profile/edit");
  }

  async function handleShareProfile() {
    const path = profile?.username
      ? `/creator/${encodeURIComponent(profile.username)}`
      : "/profile";
    const url = `${window.location.origin}${path}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name ? `${profile.name} 的個人檔案` : "個人檔案",
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
    } catch {
      setShareCopied(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    await supabase.rpc("delete_own_account");
    await signOut();
  }

  // 作品集 tab index（有 artist 才是 0，否則不存在）
  const artworkTabIdx = artist ? 0 : -1;
  const isArtworkTab  = activeTab === artworkTabIdx && artist != null;
  const visibleArtworks = artworks.filter((artwork) => artwork.status !== "archived");
  const archivedArtworks = artworks.filter((artwork) => artwork.status === "archived");

  return (
    <div className="relative flex flex-col rounded-2xl bg-[#141414]">
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center justify-between px-5 pb-3 pt-6">
        <span className="text-sm font-medium text-white">
          {profile?.username ? `@${profile.username}` : "…"}
        </span>
        <button
          type="button"
          aria-label="開啟帳號選單"
          aria-expanded={showAccountMenu}
          aria-controls="account-menu"
          onClick={() => setShowAccountMenu((open) => !open)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/8 hover:text-white active:scale-[0.98]"
        >
          <Menu size={22} strokeWidth={1.8} />
        </button>
      </div>

      {showAccountMenu && (
        <>
          <button
            type="button"
            aria-label="關閉帳號選單"
            onClick={() => setShowAccountMenu(false)}
            className="absolute inset-0 z-40 cursor-default"
          />
          <div
            id="account-menu"
            role="menu"
            className="absolute right-5 top-[68px] z-50 w-48 overflow-hidden rounded-2xl border border-white/10 bg-[#202020] p-1.5 shadow-[0_18px_48px_rgba(0,0,0,0.36)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowAccountMenu(false);
                setShowArchive(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition-colors hover:bg-white/8 hover:text-white active:scale-[0.98]"
            >
              <Archive size={17} strokeWidth={1.8} />
              <span className="flex flex-1 items-center justify-between">典藏作品 <small className="text-[10px] text-white/30">{archivedArtworks.length}</small></span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setShowAccountMenu(false);
                await signOut();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-white/75 transition-colors hover:bg-white/8 hover:text-white active:scale-[0.98]"
            >
              <LogOut size={17} strokeWidth={1.8} />
              登出
            </button>
            <div className="mx-2 my-1 h-px bg-white/8" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setShowAccountMenu(false);
                setShowDeleteConfirm(true);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-500/10 active:scale-[0.98]"
            >
              <Trash2 size={17} strokeWidth={1.8} />
              刪除帳號
            </button>
          </div>
        </>
      )}

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
              {!!profile?.expertise?.length && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {profile.expertise.map((tag) => (
                    <span key={tag} className="text-[10px] text-white/45">#{tag}</span>
                  ))}
                </div>
              )}
              {profile?.bio && (
                <p className="mt-2 line-clamp-2 text-xs text-gray-500">{profile.bio}</p>
              )}
            </div>
          </div>

          <div className="mb-4 flex items-center gap-6 border-y border-white/8 py-3">
            <button
              type="button"
              onClick={() => setConnectionView("following")}
              className="group flex items-baseline gap-1.5 text-left"
            >
              <strong className="text-sm font-semibold text-white group-hover:text-white/75">{following.length}</strong>
              <span className="text-xs text-white/40 group-hover:text-white/60">追蹤中</span>
            </button>
            <button
              type="button"
              onClick={() => setConnectionView("followers")}
              className="group flex items-baseline gap-1.5 text-left"
            >
              <strong className="text-sm font-semibold text-white group-hover:text-white/75">{followers.length}</strong>
              <span className="text-xs text-white/40 group-hover:text-white/60">粉絲</span>
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleEditProfile}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.045] px-3 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] sm:text-sm"
            >
              <Pencil size={15} strokeWidth={1.8} />
              <span className="whitespace-nowrap">編輯個人檔案</span>
            </button>
            <button
              type="button"
              onClick={handleShareProfile}
              className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.045] px-3 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white active:scale-[0.98] sm:text-sm"
            >
              {shareCopied ? <Check size={15} strokeWidth={2} /> : <Share2 size={15} strokeWidth={1.8} />}
              <span className="whitespace-nowrap">{shareCopied ? "已複製連結" : "分享個人檔案"}</span>
            </button>
          </div>

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
              <p className="text-white text-sm font-semibold">{visibleArtworks.length}</p>
              <p className="text-gray-600 text-[9px]">作品</p>
            </div>
            <div className="text-center">
              <p className="text-white text-sm font-semibold">{savedArtworks.length}</p>
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
          visibleArtworks.length === 0 ? (
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
                <span className="text-gray-500 text-xs">{visibleArtworks.length} 件作品</span>
                <button
                  onClick={() => setEditMode((v) => !v)}
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs border transition-colors ${
                    editMode
                      ? "bg-white/20 border-white/40 text-white"
                      : "bg-white/5 border-white/10 text-gray-400"
                  }`}
                >
                  {editMode ? <><Check size={11} />完成</> : <><Pencil size={11} />管理</>}
                </button>
              </div>

              {/* 作品網格 */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {visibleArtworks.map((artwork) => (
                  <div
                    key={artwork.id}
                    data-artwork-id={artwork.id}
                    onPointerDown={(event) => {
                      if (!editMode || (event.target as HTMLElement).closest("[data-no-drag]")) return;
                      event.preventDefault();
                      pointerDragIdRef.current = artwork.id;
                      setDraggedArtworkId(artwork.id);
                      event.currentTarget.setPointerCapture(event.pointerId);
                    }}
                    onPointerMove={(event) => {
                      if (pointerDragIdRef.current == null) return;
                      event.preventDefault();
                      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-artwork-id]");
                      const targetId = Number(target?.dataset.artworkId);
                      if (targetId) reorderArtworkState(pointerDragIdRef.current, targetId);
                    }}
                    onPointerUp={(event) => {
                      if (pointerDragIdRef.current == null) return;
                      event.preventDefault();
                      pointerDragIdRef.current = null;
                      setDraggedArtworkId(null);
                      void persistArtworkOrder();
                    }}
                    onPointerCancel={() => {
                      pointerDragIdRef.current = null;
                      setDraggedArtworkId(null);
                    }}
                    onClick={() => !editMode && navigate(`/artwork/${artwork.id}`)}
                    className={`aspect-square rounded-xl overflow-hidden relative group ${
                      editMode ? "cursor-grab touch-none select-none active:cursor-grabbing" : "cursor-pointer"
                    } ${draggedArtworkId === artwork.id ? "scale-[0.97] opacity-45" : ""}`}
                  >
                    <img
                      src={artwork.cover_image_url}
                      alt={artwork.title}
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        editMode ? "brightness-50" : "group-hover:scale-105"
                      }`}
                    />

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
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
                        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[9px] text-white/75">
                          <GripVertical size={11} />拖曳排序
                        </div>
                        <p className="text-white text-[10px] font-medium text-center truncate w-full px-1">
                          {artwork.title}
                        </p>
                        <div className="flex gap-2">
                          <button
                            data-no-drag
                            onClick={(e) => { e.stopPropagation(); handleArchiveToggle(artwork); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-[10px] hover:bg-white/25 transition-colors"
                          >
                            <Archive size={11} />典藏
                          </button>
                          <button
                            data-no-drag
                            onClick={(e) => { e.stopPropagation(); setPendingDeleteArtwork(artwork); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] hover:bg-red-500/30 transition-colors"
                          >
                            <Trash2 size={11} />刪除
                          </button>
                        </div>
                        <button
                          data-no-drag
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setCoverPickerArtwork(artwork); }}
                          className="flex items-center gap-1.5 rounded-lg border border-sky-300/25 bg-sky-400/12 px-3 py-1.5 text-[10px] text-sky-200 hover:bg-sky-400/20"
                        >
                          <Image size={11} />選擇首頁照片
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* 新增按鈕（非編輯模式才顯示）*/}
                {!editMode && (
                  <button
                    onClick={() => setShowUpload(true)}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center hover:border-white/40 hover:bg-white/5 transition-all"
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
          savedArtworks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-20 h-20 rounded-full bg-white/8 flex items-center justify-center">
                <Bookmark size={32} className="text-gray-500" />
              </div>
              <p className="text-gray-500 text-sm">尚無收藏作品</p>
            </div>
          ) : (
            <ArtworkCollectionGrid artworks={savedArtworks} label={`${savedArtworks.length} 件收藏`} emptyIcon="bookmark" onOpen={(id) => navigate(`/artwork/${id}`)} />
          )
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
            <ArtworkCollectionGrid artworks={likedArtworks} label={`${likedArtworks.length} 件喜愛`} emptyIcon="heart" onOpen={(id) => navigate(`/artwork/${id}`)} />
          )
        )}

      </div>

      {/* Artwork upload sheet */}
      {showUpload && artist && (
        <ArtworkUploadSheet
          artistProfileId={artist.id}
          onClose={() => setShowUpload(false)}
          onUploaded={(artwork) => {
            const next = [{ ...artwork, display_order: 0 }, ...artworkOrderRef.current];
            artworkOrderRef.current = next;
            setArtworks(next);
          }}
        />
      )}

      {connectionView && (
        <ConnectionSheet
          title={connectionView === "followers" ? "粉絲" : "追蹤中"}
          people={connectionView === "followers" ? followers : following}
          onClose={() => setConnectionView(null)}
          onSelect={(person) => {
            setConnectionView(null);
            if (person.username) navigate(`/creator/${encodeURIComponent(person.username)}`);
          }}
        />
      )}

      {coverPickerArtwork && (
        <CoverPickerSheet
          artwork={coverPickerArtwork}
          onClose={() => setCoverPickerArtwork(null)}
          onSelect={(url) => void handleCoverChange(coverPickerArtwork, url)}
        />
      )}

      {showArchive && (
        <ArchiveSheet
          artworks={archivedArtworks}
          onClose={() => setShowArchive(false)}
          onRestore={(artwork) => void handleArchiveToggle(artwork)}
          onDelete={(artwork) => {
            setShowArchive(false);
            setPendingDeleteArtwork(artwork);
          }}
        />
      )}

      {pendingDeleteArtwork && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/75 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="刪除作品">
          <button type="button" aria-label="取消刪除" onClick={() => setPendingDeleteArtwork(null)} className="absolute inset-0" />
          <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/10 bg-[#181818] p-6 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-red-500/12 text-red-300"><Trash2 size={19} /></span>
              <div className="min-w-0"><h2 className="font-semibold text-white">刪除這件作品？</h2><p className="mt-1 truncate text-xs text-white/40">{pendingDeleteArtwork.title}</p></div>
            </div>
            <p className="mt-5 text-sm leading-6 text-white/45">刪除後作品會從個人檔案移除，且無法自行復原。</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setPendingDeleteArtwork(null)} className="rounded-xl bg-white/7 py-2.5 text-sm text-white/60 hover:bg-white/10">取消</button>
              <button type="button" onClick={() => void handleDeleteArtwork(pendingDeleteArtwork.id)} className="rounded-xl bg-red-500/15 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/25">確認刪除</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm sheet */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full bg-[#111111] border border-white/10 rounded-t-3xl px-6 pt-6 pb-10 flex flex-col gap-4">
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

function ArtworkCollectionGrid({ artworks, label, emptyIcon, onOpen }: { artworks: LikedArtwork[]; label: string; emptyIcon: "bookmark" | "heart"; onOpen: (id: number) => void }) {
  const EmptyIcon = emptyIcon === "bookmark" ? Bookmark : Heart;
  return (
    <div className="px-5">
      <span className="mb-2 block text-xs text-gray-500">{label}</span>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {artworks.map((artwork) => (
          <button key={artwork.id} onClick={() => onOpen(artwork.id)} className="group relative aspect-square overflow-hidden rounded-xl bg-white/5 text-left">
            {artwork.cover_image_url ? (
              <img src={artwork.cover_image_url} alt={artwork.title ?? ""} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full items-center justify-center"><EmptyIcon size={20} className="text-gray-600" /></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent opacity-75 transition-opacity group-hover:opacity-100" />
            {artwork.title && <p className="absolute inset-x-0 bottom-0 truncate p-2 text-xs font-medium text-white">{artwork.title}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}

function CoverPickerSheet({ artwork, onClose, onSelect }: { artwork: Artwork; onClose: () => void; onSelect: (url: string) => void }) {
  const [mediaUrls, setMediaUrls] = useState<string[]>([artwork.cover_image_url]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("artwork_media")
      .select("media_url, media_type, sort_order")
      .eq("artwork_id", artwork.id)
      .eq("media_type", "image")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        const urls = [artwork.cover_image_url, ...(data ?? []).map((item: any) => item.media_url)]
          .filter((url, index, all): url is string => Boolean(url) && all.indexOf(url) === index);
        setMediaUrls(urls);
        setLoading(false);
      });
  }, [artwork]);

  return (
    <div className="fixed inset-0 z-[85] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="選擇首頁照片">
      <button type="button" aria-label="關閉照片選擇" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 flex max-h-[82vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#171717] p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div><h2 className="font-semibold text-white">選擇首頁照片</h2><p className="mt-1 text-xs text-white/35">選擇「{artwork.title}」顯示在作品集的首張圖片</p></div>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid h-9 w-9 place-items-center rounded-full text-white/45 hover:bg-white/8 hover:text-white"><X size={18} /></button>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16 text-sm text-white/35">載入照片中…</div>
        ) : (
          <div className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
            {mediaUrls.map((url) => {
              const selected = url === artwork.cover_image_url;
              return (
                <button key={url} type="button" onClick={() => onSelect(url)} className={`group relative aspect-square overflow-hidden rounded-2xl border-2 ${selected ? "border-sky-400" : "border-transparent hover:border-white/35"}`}>
                  <img src={url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                  {selected && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-sky-400 text-black"><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        )}

        {!loading && mediaUrls.length === 1 && <p className="mt-4 text-center text-xs text-white/30">這件作品目前只有一張照片</p>}
      </div>
    </div>
  );
}

function ArchiveSheet({
  artworks,
  onClose,
  onRestore,
  onDelete,
}: {
  artworks: Artwork[];
  onClose: () => void;
  onRestore: (artwork: Artwork) => void;
  onDelete: (artwork: Artwork) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="典藏作品">
      <button type="button" aria-label="關閉典藏作品" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 flex max-h-[78vh] w-full max-w-lg flex-col rounded-3xl border border-white/10 bg-[#171717] p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Archive size={18} className="text-white/55" />
            <h2 className="font-semibold text-white">典藏作品</h2>
            <span className="text-xs text-white/30">{artworks.length}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid h-9 w-9 place-items-center rounded-full text-white/45 hover:bg-white/8 hover:text-white"><X size={18} /></button>
        </div>

        {artworks.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center text-white/30">
            <Archive size={28} />
            <p className="text-sm">目前沒有典藏作品</p>
          </div>
        ) : (
          <div className="grid gap-3 overflow-y-auto pr-1">
            {artworks.map((artwork) => (
              <div key={artwork.id} className="flex items-center gap-3 rounded-2xl bg-white/5 p-2.5">
                <img src={artwork.cover_image_url} alt={artwork.title} className="h-16 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white">{artwork.title}</p>
                  <p className="mt-1 text-[11px] text-white/30">不會顯示在公開作品集中</p>
                </div>
                <button type="button" onClick={() => onRestore(artwork)} aria-label={`還原 ${artwork.title}`} className="grid h-9 w-9 place-items-center rounded-full bg-white/8 text-white/65 hover:bg-white/14 hover:text-white"><RotateCcw size={15} /></button>
                <button type="button" onClick={() => onDelete(artwork)} aria-label={`刪除 ${artwork.title}`} className="grid h-9 w-9 place-items-center rounded-full bg-red-500/10 text-red-300 hover:bg-red-500/20"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConnectionSheet({
  title,
  people,
  onClose,
  onSelect,
}: {
  title: string;
  people: SocialUser[];
  onClose: () => void;
  onSelect: (person: SocialUser) => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="關閉名單" onClick={onClose} className="absolute inset-0" />
      <div className="relative z-10 flex max-h-[min(72vh,560px)] w-full max-w-md flex-col rounded-3xl border border-white/10 bg-[#171717] px-5 pb-6 pt-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-white/55" />
            <h2 className="text-base font-semibold text-white">{title}</h2>
            <span className="text-xs text-white/35">{people.length}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="關閉名單" className="grid h-9 w-9 place-items-center rounded-full text-white/45 hover:bg-white/8 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {people.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-white/30">
              <Users size={25} />
              <p className="text-sm">目前還沒有{title}</p>
            </div>
          ) : (
            <div className="grid gap-1">
              {people.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => onSelect(person)}
                  className="flex items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/6"
                >
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover ring-1 ring-white/15" />
                  ) : (
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
                      {(person.name ?? person.username ?? "?").slice(0, 1)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-medium text-white">{person.name ?? person.username ?? "使用者"}</strong>
                    {person.username && <span className="block truncate text-xs text-white/35">@{person.username}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
