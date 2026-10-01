-- =====================================================================
-- Realtime for artwork comments
--
-- ArtworkComments subscribes to INSERTs on artwork_comments filtered by
-- artwork_id, so new comments from other people show up without a reload.
-- Realtime still applies the "read if artwork visible" select policy.
-- =====================================================================

do $$ begin
  alter publication supabase_realtime add table public.artwork_comments;
exception when duplicate_object then null; end $$;
