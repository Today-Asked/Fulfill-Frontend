-- =====================================================================
-- Commission milestone notifications
--
-- notify_commission() only reacted to status changes, but the progress
-- milestones (commission_progress_tracking) don't map 1:1 onto status:
--
--   draft_delivered_at   creator  -> status in_progress (was shown as "已開始進行")
--   draft_confirmed_at   client   -> no status change   (never notified)
--   final_delivered_at   creator  -> status delivered
--   final_confirmed_at   client   -> status completed
--
-- The trigger now also watches the four timestamps and records which
-- milestone happened in data.milestone. A milestone takes precedence over
-- the status change it causes, so each action still yields one notification.
-- =====================================================================

create or replace function public.notify_commission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artist_user uuid;
  v_actor       uuid;
  v_recipient   uuid;
  v_milestone   text;
begin
  select user_id into v_artist_user from public.artist_profiles where id = new.artist_id;

  if tg_op = 'INSERT' then
    if v_artist_user is not null and v_artist_user is distinct from new.client_id then
      insert into public.notifications (user_id, actor_id, type, commission_id, created_at)
      values (v_artist_user, new.client_id, 'commission_received', new.id, coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  v_milestone := case
    when new.final_confirmed_at is not null and old.final_confirmed_at is null then 'final_confirmed'
    when new.final_delivered_at is not null and old.final_delivered_at is null then 'final_delivered'
    when new.draft_confirmed_at is not null and old.draft_confirmed_at is null then 'draft_confirmed'
    when new.draft_delivered_at is not null and old.draft_delivered_at is null then 'draft_delivered'
  end;

  if v_milestone is null
     and (new.status is not distinct from old.status or new.status = 'pending') then
    return new;
  end if;

  v_actor := coalesce(auth.uid(), v_artist_user);
  v_recipient := case when v_actor = new.client_id then v_artist_user else new.client_id end;

  if v_recipient is not null and v_recipient is distinct from v_actor then
    insert into public.notifications (user_id, actor_id, type, commission_id, data)
    values (
      v_recipient, v_actor, 'commission_status', new.id,
      jsonb_strip_nulls(jsonb_build_object('status', new.status, 'milestone', v_milestone))
    );
  end if;

  return new;
end;
$$;

drop trigger if exists commission_requests_notify on public.commission_requests;
create trigger commission_requests_notify
  after insert or update of status, draft_delivered_at, draft_confirmed_at, final_delivered_at, final_confirmed_at
  on public.commission_requests
  for each row execute function public.notify_commission();

-- Existing status notifications that were really milestones: in_progress and
-- delivered are only ever reached by the creator delivering the draft / final.
update public.notifications
set data = data || '{"milestone": "draft_delivered"}'
where type = 'commission_status'
  and data->>'status' = 'in_progress'
  and not data ? 'milestone';

update public.notifications
set data = data || '{"milestone": "final_delivered"}'
where type = 'commission_status'
  and data->>'status' = 'delivered'
  and not data ? 'milestone';
