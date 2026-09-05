import { supabase } from "./supabase";
import { resolveTagIds } from "./tags";

/** Data access for publishing a new artwork from the creator's own upload flow. */

export interface CreateArtworkInput {
  title: string;
  description: string;
  coverImageUrl: string;
  mediaUrls?: string[];
  tagNames?: string[];
}

export async function createArtwork(artistId: number, input: CreateArtworkInput): Promise<number> {
  const title = input.title.trim();
  if (!title) throw new Error("請填寫作品標題。");
  if (!input.coverImageUrl) throw new Error("請上傳一張作品圖片。");

  const { data, error } = await supabase
    .from("artworks")
    .insert({
      artist_id: artistId,
      title,
      description: input.description.trim() || null,
      cover_image_url: input.coverImageUrl,
      status: "published",
    })
    .select("id")
    .single();

  if (error) throw error;

  const mediaUrls = (input.mediaUrls?.length ? input.mediaUrls : [input.coverImageUrl]).filter(Boolean);
  const { error: mediaError } = await supabase.from("artwork_media").insert(
    mediaUrls.map((mediaUrl, sortOrder) => ({
      artwork_id: data.id,
      media_url: mediaUrl,
      media_type: "image",
      sort_order: sortOrder,
    })),
  );

  if (mediaError) throw mediaError;

  if (input.tagNames?.length) {
    const tagIds = await resolveTagIds(input.tagNames);
    if (tagIds.length) {
      const { error: tagError } = await supabase
        .from("artwork_tags")
        .insert(tagIds.map((tagId) => ({ artwork_id: data.id, tag_id: tagId })));
      if (tagError) throw tagError;
    }
  }

  return data.id;
}
