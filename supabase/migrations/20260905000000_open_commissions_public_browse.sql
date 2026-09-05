-- =====================================================================
-- Open commissions are public
--
-- "commission_requests: open browse" (open_commissions.sql) required
-- auth.uid() is not null, so guests got an empty result set for the
-- Home "未指定的委託" tab instead of the real list. Open commissions have
-- no client-side confidentiality need — the whole point is that any
-- creator (now: any visitor) can see them and reach out — so drop the
-- sign-in requirement. Inserting, claiming, and messaging still require
-- auth via their own policies/functions; this only widens who can read.
-- =====================================================================

drop policy if exists "commission_requests: open browse" on public.commission_requests;

create policy "commission_requests: open browse"
  on public.commission_requests for select
  using (artist_id is null and status = 'pending');
