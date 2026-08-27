-- =====================================================================
-- Open commissions: chat first, then the client picks — not first-claim-wins
--
-- Replaces the claim_open_commission() model from the previous migration.
-- Multiple creators can now each open a conversation about the same open
-- commission (HomePage "諮詢詳情"). The client then promotes exactly one
-- of those conversations into a real targeted invite with one click — no
-- re-filling the form — by having the app set artist_id directly. From
-- that point on it behaves exactly like any other targeted invite: the
-- chosen creator still has to accept it themselves (existing
-- accept_commission() / "commission_requests: artist update" policy,
-- untouched) before anything formally starts.
-- =====================================================================

drop function if exists public.claim_open_commission(bigint);

-- ─────────────────────────
-- Client assigns one of their open commissions to a specific creator
--
-- Only reachable while the row is still unclaimed (artist_id is null) and
-- pending — once assigned, this policy's USING clause no longer matches,
-- so the client can't reassign it out from under a creator who's already
-- been invited. Status stays 'pending': the creator's own acceptance is
-- still what actually starts the commission.
-- ─────────────────────────

drop policy if exists "commission_requests: client assign" on public.commission_requests;

create policy "commission_requests: client assign"
  on public.commission_requests for update
  using (
    auth.uid() = client_id
    and artist_id is null
    and status = 'pending'
  )
  with check (
    auth.uid() = client_id
    and status = 'pending'
    and exists (
      select 1 from public.artist_profiles ap
      where ap.id = commission_requests.artist_id
        and ap.user_id <> auth.uid()
    )
  );
