-- =====================================================================
-- accept_commission(): tag its opening message with commission_id
--
-- Now that messages.commission_id exists, the system message this function
-- posts when a commission is accepted should land in that commission's own
-- thread from the start, not just carry the id inside its jsonb content.
-- Everything else about the function is unchanged.
-- =====================================================================

create or replace function public.accept_commission(p_commission_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_client_id uuid;
  v_artist_id uuid;
  v_org_name text;
  v_usera_id uuid;
  v_userb_id uuid;
  v_chat_id bigint;
begin
  select cr.client_id, ap.user_id, coalesce(cr.org_name, cr.title, '合作邀請')
    into v_client_id, v_artist_id, v_org_name
  from public.commission_requests cr
  join public.artist_profiles ap on ap.id = cr.artist_id
  where cr.id = p_commission_id
    and ap.user_id = auth.uid()
    and cr.status = 'pending'
  for update of cr;

  if not found then
    raise exception 'invitation_not_pending_or_not_authorized';
  end if;

  if v_artist_id::text < v_client_id::text then
    v_usera_id := v_artist_id;
    v_userb_id := v_client_id;
  else
    v_usera_id := v_client_id;
    v_userb_id := v_artist_id;
  end if;

  insert into public.conversations (usera_id, userb_id, last_message_at)
  values (v_usera_id, v_userb_id, now())
  on conflict (usera_id, userb_id)
  do update set last_message_at = excluded.last_message_at
  returning id into v_chat_id;

  update public.commission_requests
  set status = 'accepted', chat_id = v_chat_id, updated_at = now()
  where id = p_commission_id;

  insert into public.messages (chat_id, sender_id, type, content, commission_id)
  values (
    v_chat_id,
    auth.uid(),
    'commission',
    jsonb_build_object(
      'commission_id', p_commission_id,
      'text', format('我接受了「%s」的合作邀請，我們來討論細節。', v_org_name)
    ),
    p_commission_id
  );

  return v_chat_id;
end;
$$;

grant execute on function public.accept_commission(bigint) to authenticated;
