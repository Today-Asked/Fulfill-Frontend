-- =====================================================================
-- Notifications table
--
-- Until now NotificationsPage assembled notifications on every visit by
-- querying likes / follows / comments / commission_requests directly. That
-- left nowhere to record per-notification state (read, and later pushed /
-- emailed). Each event now writes one row here via triggers, and undoing the
-- event (unlike, unfollow, deleting a comment) removes it again.
--
--   follow            actor followed user
--   like              actor liked user's artwork
--   comment           actor commented on user's artwork
--   mention           actor @mentioned user in a comment
--   comment_like      actor liked user's comment
--   commission_received  actor (client) sent user (artist) a commission
--   commission_status    the other party moved a commission to data.status
--
-- Commission deadline reminders are NOT stored here — they come from time
-- passing rather than an event, so they stay computed on the client until
-- there's a scheduler (pg_cron) to generate them.
-- =====================================================================

create table if not exists public.notifications (
    id            bigint generated always as identity primary key,
    user_id       uuid not null references public.users(id) on delete cascade,
    actor_id      uuid references public.users(id) on delete cascade,
    type          text not null check (type in (
                    'follow', 'like', 'comment', 'mention', 'comment_like',
                    'commission_received', 'commission_status'
                  )),
    artwork_id    bigint references public.artworks(id)            on delete cascade,
    comment_id    bigint references public.artwork_comments(id)    on delete cascade,
    commission_id bigint references public.commission_requests(id) on delete cascade,
    data          jsonb not null default '{}',
    created_at    timestamptz not null default now(),
    read_at       timestamptz
);

create index if not exists idx_notifications_user_created
  on public.notifications(user_id, created_at desc);

-- The unread dot only ever asks "does this user have any unread row?"
create index if not exists idx_notifications_user_unread
  on public.notifications(user_id)
  where read_at is null;

alter table public.notifications enable row level security;

do $$ begin
  create policy "notifications: self read"
    on public.notifications for select
    using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "notifications: self mark read"
    on public.notifications for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Rows are only ever inserted by the security-definer triggers below, and
-- the only thing a user may change on their own rows is read_at.
revoke insert, update, delete on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- Helpers
-- ─────────────────────────

-- Users @mentioned in a comment (same rules as parseMentions() in
-- src/lib/comments.ts), excluding the comment's own author.
create or replace function public.comment_mentioned_user_ids(p_content text, p_author uuid)
returns setof uuid
language sql
stable
set search_path = public
as $$
  select distinct u.id
  from (
    select lower(rtrim(m[1], '.')) as uname
    from regexp_matches(p_content, '(?<![a-z0-9._])@([a-z0-9._]{3,30})', 'gi') as m
  ) x
  join public.users u on lower(u.username) = x.uname
  where length(x.uname) >= 3
    and u.id <> p_author
    and u.deleted_at is null;
$$;

create or replace function public.artwork_owner_id(p_artwork_id bigint)
returns uuid
language sql
stable
set search_path = public
as $$
  select ap.user_id
  from public.artworks a
  join public.artist_profiles ap on ap.id = a.artist_id
  where a.id = p_artwork_id;
$$;


-- ─────────────────────────
-- follows
-- ─────────────────────────

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.following_id <> new.follower_id then
      insert into public.notifications (user_id, actor_id, type, created_at)
      values (new.following_id, new.follower_id, 'follow', coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  delete from public.notifications
  where type = 'follow' and user_id = old.following_id and actor_id = old.follower_id;
  return old;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert or delete on public.follows
  for each row execute function public.notify_follow();


-- ─────────────────────────
-- likes (artwork)
-- ─────────────────────────

create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    v_owner := public.artwork_owner_id(new.artwork_id);
    if v_owner is not null and v_owner <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, artwork_id, created_at)
      values (v_owner, new.user_id, 'like', new.artwork_id, coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  delete from public.notifications
  where type = 'like' and actor_id = old.user_id and artwork_id = old.artwork_id;
  return old;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert or delete on public.likes
  for each row execute function public.notify_like();


-- ─────────────────────────
-- artwork_comments (comment + mention)
-- Deleting a comment removes its notifications through the comment_id FK.
-- ─────────────────────────

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at)
  select m, new.user_id, 'mention', new.artwork_id, new.id, new.created_at
  from public.comment_mentioned_user_ids(new.content, new.user_id) as m;

  -- Artwork owner gets "commented on your work" — unless that same comment
  -- already @mentioned them, in which case the mention is enough.
  v_owner := public.artwork_owner_id(new.artwork_id);
  if v_owner is not null
     and v_owner <> new.user_id
     and not exists (
       select 1 from public.notifications
       where type = 'mention' and comment_id = new.id and user_id = v_owner
     ) then
    insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at)
    values (v_owner, new.user_id, 'comment', new.artwork_id, new.id, new.created_at);
  end if;

  return new;
end;
$$;

drop trigger if exists artwork_comments_notify on public.artwork_comments;
create trigger artwork_comments_notify
  after insert on public.artwork_comments
  for each row execute function public.notify_comment();


-- ─────────────────────────
-- artwork_comment_likes
-- ─────────────────────────

create or replace function public.notify_comment_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author  uuid;
  v_artwork bigint;
begin
  if tg_op = 'INSERT' then
    select user_id, artwork_id into v_author, v_artwork
    from public.artwork_comments where id = new.comment_id;
    if v_author is not null and v_author <> new.user_id then
      insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at)
      values (v_author, new.user_id, 'comment_like', v_artwork, new.comment_id, coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  delete from public.notifications
  where type = 'comment_like' and actor_id = old.user_id and comment_id = old.comment_id;
  return old;
end;
$$;

drop trigger if exists artwork_comment_likes_notify on public.artwork_comment_likes;
create trigger artwork_comment_likes_notify
  after insert or delete on public.artwork_comment_likes
  for each row execute function public.notify_comment_like();


-- ─────────────────────────
-- commission_requests
-- New direct commission -> artist. Status change -> whichever party didn't
-- make the change (artist accepts/delivers -> client; client confirms -> artist).
-- Open commissions (artist_id null) notify nobody until someone claims them,
-- and the claim itself is a status change pending -> accepted.
-- ─────────────────────────

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
begin
  select user_id into v_artist_user from public.artist_profiles where id = new.artist_id;

  if tg_op = 'INSERT' then
    if v_artist_user is not null and v_artist_user is distinct from new.client_id then
      insert into public.notifications (user_id, actor_id, type, commission_id, created_at)
      values (v_artist_user, new.client_id, 'commission_received', new.id, coalesce(new.created_at, now()));
    end if;
    return new;
  end if;

  if new.status is not distinct from old.status or new.status = 'pending' then
    return new;
  end if;

  v_actor := coalesce(auth.uid(), v_artist_user);
  v_recipient := case when v_actor = new.client_id then v_artist_user else new.client_id end;

  if v_recipient is not null and v_recipient is distinct from v_actor then
    insert into public.notifications (user_id, actor_id, type, commission_id, data)
    values (v_recipient, v_actor, 'commission_status', new.id, jsonb_build_object('status', new.status));
  end if;

  return new;
end;
$$;

drop trigger if exists commission_requests_notify on public.commission_requests;
create trigger commission_requests_notify
  after insert or update of status on public.commission_requests
  for each row execute function public.notify_commission();


-- ─────────────────────────
-- Backfill
-- Recreates what the old client-side page showed, all marked as read so
-- nobody gets a dot for history they've already seen.
-- ─────────────────────────

do $$ begin
  if not exists (select 1 from public.notifications) then

    insert into public.notifications (user_id, actor_id, type, created_at, read_at)
    select following_id, follower_id, 'follow', coalesce(created_at, now()), now()
    from public.follows
    where following_id <> follower_id;

    insert into public.notifications (user_id, actor_id, type, artwork_id, created_at, read_at)
    select ap.user_id, l.user_id, 'like', l.artwork_id, coalesce(l.created_at, now()), now()
    from public.likes l
    join public.artworks a on a.id = l.artwork_id
    join public.artist_profiles ap on ap.id = a.artist_id
    where ap.user_id <> l.user_id;

    insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at, read_at)
    select m, c.user_id, 'mention', c.artwork_id, c.id, c.created_at, now()
    from public.artwork_comments c
    cross join lateral public.comment_mentioned_user_ids(c.content, c.user_id) as m;

    insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at, read_at)
    select ap.user_id, c.user_id, 'comment', c.artwork_id, c.id, c.created_at, now()
    from public.artwork_comments c
    join public.artworks a on a.id = c.artwork_id
    join public.artist_profiles ap on ap.id = a.artist_id
    where ap.user_id <> c.user_id
      and not exists (
        select 1 from public.notifications n
        where n.type = 'mention' and n.comment_id = c.id and n.user_id = ap.user_id
      );

    insert into public.notifications (user_id, actor_id, type, artwork_id, comment_id, created_at, read_at)
    select c.user_id, cl.user_id, 'comment_like', c.artwork_id, c.id, coalesce(cl.created_at, now()), now()
    from public.artwork_comment_likes cl
    join public.artwork_comments c on c.id = cl.comment_id
    where c.user_id <> cl.user_id;

    insert into public.notifications (user_id, actor_id, type, commission_id, created_at, read_at)
    select ap.user_id, cr.client_id, 'commission_received', cr.id, coalesce(cr.created_at, now()), now()
    from public.commission_requests cr
    join public.artist_profiles ap on ap.id = cr.artist_id
    where ap.user_id is distinct from cr.client_id;

    -- Old page only knew the current status, so that's all we can rebuild.
    insert into public.notifications (user_id, actor_id, type, commission_id, data, created_at, read_at)
    select cr.client_id, ap.user_id, 'commission_status', cr.id,
           jsonb_build_object('status', cr.status),
           coalesce(cr.updated_at, cr.created_at, now()), now()
    from public.commission_requests cr
    join public.artist_profiles ap on ap.id = cr.artist_id
    where cr.status <> 'pending'
      and cr.client_id is not null
      and ap.user_id is distinct from cr.client_id;

  end if;
end $$;
