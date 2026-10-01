-- =====================================================================
-- Publish artist_profiles by default
--
-- The "open for commissions" is_published gate (commission_v2) needed a
-- companion "make private" UI to be a real toggle, and that never got
-- built: /profile/commission (the only place that flips is_published) is
-- not linked from anywhere in the app — Root.tsx references the path
-- only for its own layout-width lookup. So nobody has an actual, reachable
-- way to set is_published back to false; every account sitting at false
-- today just never got flipped, it didn't opt out. That's exactly why a
-- user reported not being findable in creator search.
--
-- Flip the default so new signups are published from creation, and
-- backfill everyone currently unpublished. The completeness checklist,
-- publish/unpublish buttons on CommissionProfilePage, and the RLS
-- policies gating reads/inserts on is_published all stay as-is — a real
-- private-account feature is future work, this just stops the gate from
-- silently hiding people who never chose to hide.
-- =====================================================================

alter table public.artist_profiles
  alter column is_published set default true;

update public.artist_profiles
set is_published = true
where is_published = false;
