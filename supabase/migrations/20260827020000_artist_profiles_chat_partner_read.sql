-- =====================================================================
-- Let chat partners see each other's artist_profiles row
--
-- "artist_profiles: published or self read" (commission_v2) only allows
-- reading a profile if it's published or it's your own — correct for the
-- public creator-search page, but it also silently blocks the nested
-- `artist_profiles` embed inside ChatRoomPage's conversation query for any
-- partner who hasn't published yet. That embed is how the client's
-- "邀請他接案" button knows the other party's artist_profiles.id — with it
-- filtered to null, the button never appears, no error anywhere (RLS just
-- drops the row, it doesn't fail the query).
--
-- This adds a narrow SELECT policy: visible to whoever you already have a
-- conversation with, published or not. Doesn't touch discoverability —
-- only two people already talking can see each other this way.
-- =====================================================================

drop policy if exists "artist_profiles: conversation partner read" on public.artist_profiles;

create policy "artist_profiles: conversation partner read"
  on public.artist_profiles for select
  using (
    exists (
      select 1 from public.conversations c
      where (c.usera_id = auth.uid() and c.userb_id = artist_profiles.user_id)
         or (c.userb_id = auth.uid() and c.usera_id = artist_profiles.user_id)
    )
  );
