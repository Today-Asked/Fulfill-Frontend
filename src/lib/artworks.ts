import { supabase } from "./supabase";

/** Data access for publishing a new artwork from the creator's own upload flow. */

export interface CreateArtworkInput {
  title: string;
  description: string;
  coverImageUrl: string;
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
  return data.id;
}
