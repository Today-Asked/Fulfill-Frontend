import { supabase } from "./supabase";

/**
 * Artwork comments — flat, one level only. Replying to someone is a new
 * comment that starts with "@username"; there is no parent/child relation.
 */

export const COMMENT_MAX_LENGTH = 500;

export interface ArtworkComment {
  id: number;
  content: string;
  createdAt: string;
  userId: string;
  username: string | null;
  name: string | null;
  avatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
}

export async function fetchArtworkComments(artworkId: number, myId: string | null): Promise<ArtworkComment[]> {
  const { data, error } = await supabase
    .from("artwork_comments")
    .select("id, content, created_at, user_id, users:user_id(username, name, avatar_url), artwork_comment_likes(count)")
    .eq("artwork_id", artworkId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = data ?? [];

  let likedIds = new Set<number>();
  if (myId && rows.length) {
    const { data: mine } = await supabase
      .from("artwork_comment_likes")
      .select("comment_id")
      .eq("user_id", myId)
      .in("comment_id", rows.map((row: any) => row.id));
    likedIds = new Set((mine ?? []).map((row: any) => row.comment_id));
  }

  return rows.map((row: any) => ({
    id:        row.id,
    content:   row.content,
    createdAt: row.created_at,
    userId:    row.user_id,
    username:  row.users?.username ?? null,
    name:      row.users?.name ?? null,
    avatarUrl: row.users?.avatar_url ?? null,
    likeCount: row.artwork_comment_likes?.[0]?.count ?? 0,
    likedByMe: likedIds.has(row.id),
  }));
}

export async function postArtworkComment(artworkId: number, userId: string, content: string): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error("留言不能是空的。");
  if (text.length > COMMENT_MAX_LENGTH) throw new Error(`留言最多 ${COMMENT_MAX_LENGTH} 字。`);

  const { error } = await supabase
    .from("artwork_comments")
    .insert({ artwork_id: artworkId, user_id: userId, content: text });
  if (error) throw error;
}

export async function deleteArtworkComment(commentId: number): Promise<void> {
  const { error } = await supabase.from("artwork_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function setCommentLiked(commentId: number, userId: string, liked: boolean): Promise<void> {
  const { error } = liked
    ? await supabase.from("artwork_comment_likes").insert({ user_id: userId, comment_id: commentId })
    : await supabase.from("artwork_comment_likes").delete().eq("user_id", userId).eq("comment_id", commentId);
  if (error) throw error;
}

export type CommentSegment = { type: "text"; value: string } | { type: "mention"; username: string };

/** Splits comment text into plain text and @username mentions (same charset as usernames). */
export function parseMentions(content: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  const pattern = /(?<![a-z0-9._])@([a-z0-9._]{3,30})/gi;
  let last = 0;

  for (const match of content.matchAll(pattern)) {
    // "@amy." at the end of a sentence — the trailing dot is punctuation, not part of the name
    const username = match[1].replace(/\.+$/, "");
    if (username.length < 3) continue;
    const start = match.index!;
    if (start > last) segments.push({ type: "text", value: content.slice(last, start) });
    segments.push({ type: "mention", username: username.toLowerCase() });
    last = start + 1 + username.length;
  }

  if (last < content.length) segments.push({ type: "text", value: content.slice(last) });
  return segments;
}
