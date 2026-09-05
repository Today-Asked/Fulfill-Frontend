-- =====================================================================
-- artist_profiles visible if the creator has published work
--
-- "artworks: read" already lets anyone read a published artwork regardless
-- of the artist's is_published flag — that flag is specifically the
-- separate "open for commissions" toggle on /profile/commission, not a
-- general visibility switch. But "artist_profiles: published or self read"
-- only allowed is_published = true or your own row, so:
--   - ArtworkDetailPage's "by <creator>" lookup silently returned nothing
--     for any artwork made by a creator who hasn't published a commission
--     profile — the artwork renders, the byline doesn't.
--   - The AI search candidate pool (meant to include anyone with published
--     work, not just people currently open for commissions) could resolve
--     the right artist ids but then couldn't actually read those rows.
--
-- Widen the policy to also cover anyone with at least one published,
-- non-deleted artwork — mirroring "artworks: read"'s own self-read clause.
-- =====================================================================

drop policy if exists "artist_profiles: published or self read" on public.artist_profiles;

create policy "artist_profiles: published or self read"
  on public.artist_profiles for select
  using (
    is_published = true
    or user_id = auth.uid()
    or exists (
      select 1 from public.artworks a
      where a.artist_id = artist_profiles.id
        and a.status = 'published'
        and a.deleted_at is null
    )
  );
