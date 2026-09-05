import { supabase } from "./supabase";

/** Data access for the tag autocomplete + create-or-reuse flow on artwork upload. */

export interface Tag {
  id: number;
  name: string;
}

export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS_PER_ARTWORK = 10;

/** Suggests existing tags matching a partial name, for the autocomplete dropdown. */
export async function searchTags(query: string, limit = 8): Promise<Tag[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("tags")
    .select("id, name")
    .ilike("name", `%${trimmed}%`)
    .order("name")
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/**
 * Resolves free-typed tag names to tag ids, creating any that don't exist
 * yet. Upserting on conflict (name) — instead of insert-then-ignore — lets
 * one round trip return both newly created and already-existing rows.
 */
export async function resolveTagIds(names: string[]): Promise<number[]> {
  const uniqueNames = Array.from(
    new Set(
      names
        .map((name) => name.trim().slice(0, MAX_TAG_LENGTH))
        .filter(Boolean),
    ),
  ).slice(0, MAX_TAGS_PER_ARTWORK);

  if (!uniqueNames.length) return [];

  const { data, error } = await supabase
    .from("tags")
    .upsert(
      uniqueNames.map((name) => ({ name })),
      { onConflict: "name" },
    )
    .select("id");

  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}
