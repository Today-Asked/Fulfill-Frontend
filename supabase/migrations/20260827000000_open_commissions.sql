-- =====================================================================
-- Open (unassigned) commission requests
--
-- Until now every commission_requests row was aimed at one artist_id from
-- the moment it was created (the "合作邀請" button on a creator's own
-- page). This adds a second path: post a commission with no artist_id at
-- all, browsable by every creator on the home feed, first-claim-wins.
--
-- artist_id was already nullable in the original schema (see init.sql —
-- no NOT NULL was ever added), so this is policy and function work only,
-- no column changes.
-- =====================================================================

-- ─────────────────────────
-- Let any signed-in creator browse open commissions
--
-- Postgres OR-combines multiple permissive SELECT policies, so this adds
-- to (not replaces) "commission_requests: participant read" from init.sql.
-- ─────────────────────────

drop policy if exists "commission_requests: open browse" on public.commission_requests;

create policy "commission_requests: open browse"
  on public.commission_requests for select
  using (artist_id is null and status = 'pending' and auth.uid() is not null);


-- ─────────────────────────
-- Let a client post without naming an artist
--
-- Same policy as commission_v2, just with an "or artist_id is null" escape
-- hatch alongside the existing published/not-self check.
-- ─────────────────────────

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
          and ap.is_published = true
          and ap.user_id <> auth.uid()
      )
    )
  );


-- ─────────────────────────
-- Claiming an open commission
--
-- Can't be expressed as an UPDATE RLS policy: "commission_requests: artist
-- update" (commission_v2) checks artist_id = my artist_profiles row, but
-- that's only true *after* a claim succeeds — before, artist_id is null
-- and no USING clause referencing the pre-update row can match it. So this
-- runs security definer and does its own authorization instead, the same
-- way handle_new_user() does.
--
-- Locks the row with `for update`, so if two creators tap "接下委託" at
-- the same moment, the second one's `not found` check loses instead of
-- both silently succeeding.
-- ─────────────────────────

create or replace function public.claim_open_commission(p_commission_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id      uuid;
  v_artist_id      bigint;
  v_artist_user_id uuid;
  v_org_name       text;
  v_usera_id       uuid;
  v_userb_id       uuid;
  v_chat_id        bigint;
begin
  select ap.id, ap.user_id
    into v_artist_id, v_artist_user_id
  from public.artist_profiles ap
  where ap.user_id = auth.uid();

  if v_artist_id is null then
    raise exception 'no_artist_profile';
  end if;

  select cr.client_id, coalesce(cr.org_name, cr.title, '合作邀請')
    into v_client_id, v_org_name
  from public.commission_requests cr
  where cr.id = p_commission_id
    and cr.artist_id is null
    and cr.status = 'pending'
  for update of cr;

  if not found then
    raise exception 'commission_unavailable';
  end if;

  if v_client_id = auth.uid() then
    raise exception 'cannot_claim_own_commission';
  end if;

  if v_artist_user_id::text < v_client_id::text then
    v_usera_id := v_artist_user_id;
    v_userb_id := v_client_id;
  else
    v_usera_id := v_client_id;
    v_userb_id := v_artist_user_id;
  end if;

  insert into public.conversations (usera_id, userb_id, last_message_at)
  values (v_usera_id, v_userb_id, now())
  on conflict (usera_id, userb_id)
  do update set last_message_at = excluded.last_message_at
  returning id into v_chat_id;

  update public.commission_requests
  set artist_id = v_artist_id, status = 'accepted', chat_id = v_chat_id, updated_at = now()
  where id = p_commission_id;

  insert into public.messages (chat_id, sender_id, type, content)
  values (
    v_chat_id,
    auth.uid(),
    'commission',
    jsonb_build_object(
      'commission_id', p_commission_id,
      'text', format('我接下了「%s」這則委託，我們來討論細節。', v_org_name)
    )
  );

  return v_chat_id;
end;
$$;

grant execute on function public.claim_open_commission(bigint) to authenticated;
