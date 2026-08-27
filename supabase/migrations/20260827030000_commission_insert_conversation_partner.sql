-- =====================================================================
-- Let a client formally invite a creator they're already chatting with,
-- even if that creator hasn't published their commission profile
--
-- Knock-on effect of 20260827020000 (chat-partner read on artist_profiles):
-- once a client can see an unpublished creator's profile through an
-- existing conversation, CreatorProfilePage's "合作邀請" button (which was
-- never gated on is_published to begin with) becomes reachable for that
-- creator — but the insert policy still required is_published = true,
-- so submitting the form failed with a bare RLS error.
--
-- This mirrors the same "conversation partner" exception onto the insert
-- check: a published creator can always be invited (unchanged, this is
-- how public discovery/search invites still work); an unpublished one can
-- only be invited by someone who already has a conversation with them —
-- so a stranger poking at an unpublished profile via a guessed URL still
-- can't insert anything.
-- =====================================================================

drop policy if exists "commission_requests: client insert" on public.commission_requests;

create policy "commission_requests: client insert"
  on public.commission_requests for insert
  with check (
    auth.uid() = client_id
    and (
      artist_id is null
      or exists (
        select 1 from public.artist_profiles ap
        where ap.id = commission_requests.artist_id
          and ap.user_id <> auth.uid()
          and (
            ap.is_published = true
            or exists (
              select 1 from public.conversations c
              where (c.usera_id = auth.uid() and c.userb_id = ap.user_id)
                 or (c.userb_id = auth.uid() and c.usera_id = ap.user_id)
            )
          )
      )
    )
  );
