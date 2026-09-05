-- =====================================================================
-- Tags: authenticated users can create/reuse tags
--
-- "tags" only had a public-read policy, so the artwork upload form
-- couldn't let creators type a new tag — inserting one (or upserting to
-- reuse an existing one by name) was silently blocked by RLS. Any
-- signed-in user may add to this shared vocabulary; the upsert-by-name
-- flow also needs update so `on conflict (name) do update` can touch
-- the existing row (it only rewrites name to itself, a no-op).
-- =====================================================================

drop policy if exists "tags: authenticated insert" on public.tags;
drop policy if exists "tags: authenticated update" on public.tags;

create policy "tags: authenticated insert"
  on public.tags for insert
  to authenticated
  with check (true);

create policy "tags: authenticated update"
  on public.tags for update
  to authenticated
  using (true)
  with check (true);
