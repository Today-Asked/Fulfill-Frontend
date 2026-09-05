-- =====================================================================
-- Fix infinite recursion in artist_profiles RLS
--
-- The previous migration's "published or self read" policy added a raw
-- EXISTS subquery against artworks. But "artworks: read" has its own EXISTS
-- subquery back into artist_profiles (for an artist to read their own
-- unpublished drafts) — so evaluating one policy re-triggers the other,
-- forever: "infinite recursion detected in policy for relation
-- artist_profiles".
--
-- Fix: move the artworks check into a SECURITY DEFINER function. It runs as
-- its owner (bypassing RLS on the nested artworks lookup) instead of the
-- calling role, which breaks the cycle — the function only ever answers
-- "does this specific artist_id have a published, non-deleted artwork?",
-- the same fact "artworks: read" already exposes to everyone anyway.
-- =====================================================================

create or replace function public.artist_has_published_artwork(target_artist_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.artworks
    where artist_id = target_artist_id
      and status = 'published'
      and deleted_at is null
  );
$$;

drop policy if exists "artist_profiles: published or self read" on public.artist_profiles;

create policy "artist_profiles: published or self read"
  on public.artist_profiles for select
  using (
    is_published = true
    or user_id = auth.uid()
    or public.artist_has_published_artwork(id)
  );
