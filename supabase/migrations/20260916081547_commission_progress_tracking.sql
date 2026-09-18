-- =====================================================================
-- Commission progress tracking
--
-- Gives the existing commission_status lifecycle (accepted -> in_progress ->
-- delivered -> completed) something that actually drives it. Those values
-- were already defined but nothing ever set them — every accepted
-- commission just sat at 'accepted' forever, and listConversationCommissions
-- already filtered on in_progress/delivered as if they were in use.
--
-- Four timestamps mark the two milestone pairs: the creator delivers (set
-- from the Orders page progress line), the client confirms (set from the
-- chat room's existing commission panel). Confirming the final milestone
-- flips status to 'completed', which drops the row out of every "active"
-- filter (listConversationCommissions, and the Orders page's default view)
-- without needing separate archival logic.
-- =====================================================================

alter table public.commission_requests
  add column if not exists draft_delivered_at timestamptz,
  add column if not exists draft_confirmed_at timestamptz,
  add column if not exists final_delivered_at timestamptz,
  add column if not exists final_confirmed_at timestamptz;

-- The client had no general update permission on their own commission rows —
-- only a narrow policy for claiming an open (unassigned) commission. Confirming
-- a milestone is a client-side update, so that gate needs widening.
create policy "commission_requests: client update"
  on public.commission_requests for update
  using (auth.uid() = client_id)
  with check (auth.uid() = client_id);
