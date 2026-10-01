import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Heart, Send, Trash2 } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { formatChatTime } from "../../lib/chat";
import {
  ArtworkComment,
  COMMENT_MAX_LENGTH,
  deleteArtworkComment,
  fetchArtworkComments,
  parseMentions,
  postArtworkComment,
  setCommentLiked,
} from "../../lib/comments";

interface ArtworkCommentsProps {
  artworkId: number;
  /** 作品作者的 user id — 作者可以刪除自己作品底下的任何留言 */
  artworkOwnerId: string | null;
  requireAuth: (user: unknown, action: () => void, customMessage?: string) => void;
}

/**
 * 作品留言區 — 只有一層，不做巢狀。
 * 按「回覆」會在輸入框帶入 @username，送出後就是一則普通留言。
 */
export function ArtworkComments({ artworkId, artworkOwnerId, requireAuth }: ArtworkCommentsProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [comments, setComments] = useState<ArtworkComment[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [draft,    setDraft]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function load() {
    try {
      setComments(await fetchArtworkComments(artworkId, user?.id ?? null));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setDraft("");
    load();

    // 別人新留的留言即時出現；自己送出的已經在 handleSubmit 重新載入過
    const channel = supabase
      .channel(`artwork-comments:${artworkId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "artwork_comments", filter: `artwork_id=eq.${artworkId}` },
        (payload) => {
          if ((payload.new as { user_id?: string }).user_id === user?.id) return;
          load();
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [artworkId, user?.id]);

  // 輸入框隨內容長高，最多約四行
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
  }, [draft]);

  function handleSubmit() {
    requireAuth(user, async () => {
      if (!draft.trim() || sending) return;
      setSending(true);
      setError(null);
      try {
        await postArtworkComment(artworkId, user!.id, draft);
        setDraft("");
        await load();
      } catch (err: any) {
        setError(err?.message ?? "留言失敗，請再試一次。");
      } finally {
        setSending(false);
      }
    }, "登入後就可以留言");
  }

  function handleReply(comment: ArtworkComment) {
    requireAuth(user, () => {
      if (!comment.username) return;
      const mention = `@${comment.username} `;
      setDraft((prev) => (prev.startsWith(mention) ? prev : mention + prev));
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    }, "登入後就可以回覆留言");
  }

  function handleToggleLike(comment: ArtworkComment) {
    requireAuth(user, async () => {
      const liked = !comment.likedByMe;
      // 先更新畫面，失敗再還原
      const apply = (target: boolean) =>
        setComments((prev) =>
          prev.map((c) =>
            c.id === comment.id
              ? { ...c, likedByMe: target, likeCount: c.likeCount + (target === c.likedByMe ? 0 : target ? 1 : -1) }
              : c,
          ),
        );
      apply(liked);
      try {
        await setCommentLiked(comment.id, user!.id, liked);
      } catch (err) {
        console.error(err);
        apply(!liked);
      }
    });
  }

  async function handleDelete(comment: ArtworkComment) {
    if (!window.confirm("確定要刪除這則留言嗎？")) return;
    try {
      await deleteArtworkComment(comment.id);
      setComments((prev) => prev.filter((c) => c.id !== comment.id));
    } catch (err) {
      console.error(err);
      window.alert("刪除失敗，請再試一次。");
    }
  }

  const canSend = !!draft.trim() && !sending;

  return (
    <section className="mb-10">
      <p
        className="text-white font-bold text-xl mb-4"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Comments
        {comments.length > 0 && (
          <span className="ml-2 align-middle font-sans text-sm font-normal text-white/40">{comments.length}</span>
        )}
      </p>

      {/* List */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/4 rounded bg-white/10" />
                <div className="h-3 w-3/4 rounded bg-white/8" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-white/30">還沒有留言，來當第一個吧</p>
      ) : (
        <ul className="space-y-5">
          {comments.map((comment) => {
            const displayName = comment.name ?? comment.username ?? "使用者";
            const canDelete = !!user && (user.id === comment.userId || user.id === artworkOwnerId);
            return (
              <li key={comment.id} className="flex gap-3">
                <button
                  onClick={() => comment.username && navigate(`/creator/${comment.username}`)}
                  className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-white/10 flex items-center justify-center"
                  aria-label={displayName}
                >
                  {comment.avatarUrl ? (
                    <img src={comment.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-medium text-white/40">{displayName[0]?.toUpperCase()}</span>
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <button
                      onClick={() => comment.username && navigate(`/creator/${comment.username}`)}
                      className="truncate text-sm font-medium text-white hover:text-white/70"
                    >
                      {displayName}
                    </button>
                    <span className="flex-shrink-0 text-xs text-white/30">{formatChatTime(comment.createdAt)}</span>
                  </div>

                  <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-white/75">
                    {parseMentions(comment.content).map((segment, i) =>
                      segment.type === "mention" ? (
                        <button
                          key={i}
                          onClick={() => navigate(`/creator/${segment.username}`)}
                          className="font-medium text-fuchsia-300 hover:underline"
                        >
                          @{segment.username}
                        </button>
                      ) : (
                        <React.Fragment key={i}>{segment.value}</React.Fragment>
                      ),
                    )}
                  </p>

                  <div className="mt-1.5 flex items-center gap-4 text-xs text-white/40">
                    <button onClick={() => handleReply(comment)} className="hover:text-white">
                      回覆
                    </button>
                    {canDelete && (
                      <button onClick={() => handleDelete(comment)} className="hover:text-white" aria-label="刪除留言">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleToggleLike(comment)}
                  className="flex w-8 flex-shrink-0 flex-col items-center pt-1 active:scale-90 transition-transform"
                  aria-label={comment.likedByMe ? "取消喜愛留言" : "喜愛留言"}
                >
                  <Heart
                    size={15}
                    strokeWidth={1.8}
                    className={comment.likedByMe ? "fill-white text-white" : "text-white/30 hover:text-white"}
                  />
                  {comment.likeCount > 0 && (
                    <span className="mt-0.5 text-[11px] text-white/40">{comment.likeCount}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Composer */}
      <div className="mt-6 flex items-end gap-2 rounded-2xl bg-white/6 px-4 py-2.5">
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          maxLength={COMMENT_MAX_LENGTH}
          onFocus={() => { if (!user) { inputRef.current?.blur(); requireAuth(user, () => {}, "登入後就可以留言"); } }}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="留言⋯（@使用者名稱 可以回覆別人）"
          className="max-h-24 flex-1 resize-none bg-transparent py-1 text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="送出留言"
          className="mb-0.5 text-white transition-opacity disabled:opacity-30"
        >
          <Send size={18} />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
