-- =====================================================================
-- Commission v2
--
-- Adds everything the structured invitation flow needs, plus the trust
-- and discovery features. Written to be safe to re-run: every statement
-- guards on existence.
--
-- Nothing existing is dropped or renamed. The original budget / deadline
-- columns stay so any current rows and code keep working.
-- =====================================================================

-- ─────────────────────────
-- ENUMS
-- ─────────────────────────

do $$ begin
  create type commission_availability as enum ('open','limited','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type budget_mode as enum ('ask','from','range');
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_mode as enum ('remote','in_person','both');
exception when duplicate_object then null; end $$;

do $$ begin
  create type decline_reason as enum ('schedule','budget','not_taking','style_mismatch','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type match_outcome as enum
    ('confirmed','discussing','no_deal','no_reply','budget','schedule','style');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_target as enum ('creator','artwork','invitation');
exception when duplicate_object then null; end $$;

do $$ begin
  create type report_reason as enum
    ('impersonation','stolen_work','harassment','spam','inappropriate','other');
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- ARTIST PROFILES: commission info
--
-- These drive the "can I hire this person" panel and the search filters.
-- Typed columns rather than portfolio_config jsonb, because they need to
-- be filtered and indexed.
-- ─────────────────────────

alter table public.artist_profiles
  add column if not exists availability      commission_availability default 'open',
  add column if not exists services          text[] default '{}',
  add column if not exists budget_mode       budget_mode default 'ask',
  add column if not exists budget_from       numeric(10,2),
  add column if not exists budget_to         numeric(10,2),
  add column if not exists available_from    date,
  add column if not exists turnaround_days   smallint,
  add column if not exists work_mode         work_mode default 'both',
  add column if not exists school            varchar(100),
  add column if not exists cover_image_url   varchar(500);

-- Preserve the visibility of profiles that already existed before this
-- feature. New profiles still start unpublished. Keeping the backfill inside
-- the column-existence guard makes the migration safe to re-run without
-- republishing creators who later chose to unpublish.
do $$ begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_profiles'
      and column_name = 'is_published'
  ) then
    alter table public.artist_profiles
      add column is_published boolean not null default false;
    update public.artist_profiles set is_published = true;
  end if;
end $$;

create index if not exists idx_artist_availability on public.artist_profiles(availability);
create index if not exists idx_artist_published    on public.artist_profiles(is_published);
create index if not exists idx_artist_services     on public.artist_profiles using gin(services);

do $$ begin
  alter table public.artist_profiles
    add constraint artist_budget_range check (
      (budget_from is null or budget_from >= 0)
      and (budget_to is null or budget_to >= 0)
      and (budget_from is null or budget_to is null or budget_from <= budget_to)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.artist_profiles
    add constraint artist_turnaround_positive check (
      turnaround_days is null or turnaround_days > 0
    );
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- USERS: school verification
--
-- Email only. No student ID, phone, or class number.
-- ─────────────────────────

alter table public.users
  add column if not exists school_email       varchar(255),
  add column if not exists school_verified_at timestamptz;

create unique index if not exists idx_users_school_email_unique
  on public.users (lower(school_email))
  where school_email is not null;


-- ─────────────────────────
-- ARTWORKS: project context
--
-- A club is judging whether this person can do the job, not only whether
-- the picture looks good.
-- ─────────────────────────

alter table public.artworks
  add column if not exists project_client     varchar(200),
  add column if not exists project_context    varchar(100),
  add column if not exists project_year       smallint,
  add column if not exists project_tools      text[] default '{}',
  add column if not exists project_own_role   text,
  add column if not exists project_teamwork   boolean default false,
  add column if not exists production_days    smallint;

do $$ begin
  alter table public.artworks
    add constraint artwork_production_days_positive check (
      production_days is null or production_days > 0
    );
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- COMMISSION REQUESTS: structured brief
--
-- chat_id becomes nullable: an invitation now exists before any
-- conversation does, and the thread is opened when the artist accepts.
-- ─────────────────────────

alter table public.commission_requests
  alter column chat_id drop not null;

alter table public.commission_requests
  add column if not exists org_name        varchar(200),
  add column if not exists services        text[] default '{}',
  add column if not exists budget_min      numeric(10,2),
  add column if not exists budget_max      numeric(10,2),
  add column if not exists draft_due_date  date,
  add column if not exists final_due_date  date,
  add column if not exists contact         varchar(200),
  add column if not exists has_assets      boolean default false,
  add column if not exists decline_reason  decline_reason,
  add column if not exists reply_note      text,
  add column if not exists viewed_at       timestamptz;

create index if not exists idx_commission_artist on public.commission_requests(artist_id);
create index if not exists idx_commission_client on public.commission_requests(client_id);
create index if not exists idx_commission_status on public.commission_requests(status);

-- Budget range must make sense.
do $$ begin
  alter table public.commission_requests
    add constraint commission_budget_range check (
      (budget_min is null or budget_min >= 0)
      and (budget_max is null or budget_max >= 0)
      and (budget_min is null or budget_max is null or budget_min <= budget_max)
    );
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.commission_requests
    add constraint commission_date_order check (
      draft_due_date is null or final_due_date is null or draft_due_date <= final_due_date
    );
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- CREATOR SAVES (shortlist)
--
-- The existing `saves` table is for artworks. Clubs shortlist people.
-- ─────────────────────────

create table if not exists public.creator_saves (
    user_id    uuid references public.users(id) on delete cascade,
    artist_id  bigint references public.artist_profiles(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (user_id, artist_id)
);

alter table public.creator_saves enable row level security;

do $$ begin
  create policy "creator_saves: self only"
    on public.creator_saves for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- MATCH OUTCOMES
--
-- Both sides often move to LINE, so the platform never learns whether the
-- introduction worked. Asking once is the only way to know.
-- ─────────────────────────

create table if not exists public.match_outcomes (
    commission_id bigint references public.commission_requests(id) on delete cascade,
    user_id       uuid references public.users(id) on delete cascade,
    outcome       match_outcome not null,
    created_at    timestamptz default now(),
    primary key (commission_id, user_id)
);

alter table public.match_outcomes enable row level security;

drop policy if exists "match_outcomes: self write" on public.match_outcomes;

do $$ begin
  create policy "match_outcomes: self write"
    on public.match_outcomes for all
    using (
      auth.uid() = user_id
      and exists (
        select 1
        from public.commission_requests cr
        left join public.artist_profiles ap on ap.id = cr.artist_id
        where cr.id = match_outcomes.commission_id
          and (cr.client_id = auth.uid() or ap.user_id = auth.uid())
      )
    )
    with check (
      auth.uid() = user_id
      and exists (
        select 1
        from public.commission_requests cr
        left join public.artist_profiles ap on ap.id = cr.artist_id
        where cr.id = match_outcomes.commission_id
          and (cr.client_id = auth.uid() or ap.user_id = auth.uid())
      )
    );
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- REPORTS
--
-- Insert-only for normal users. Nobody can read reports through the API,
-- including the person who filed one, so a reported user cannot discover
-- who reported them. Review happens in the Supabase dashboard.
-- ─────────────────────────

create table if not exists public.reports (
    id           bigint generated by default as identity primary key,
    reporter_id  uuid references public.users(id) on delete set null,
    target_type  report_target not null,
    target_id    varchar(64)   not null,
    reason       report_reason not null,
    detail       text,
    resolved_at  timestamptz,
    created_at   timestamptz default now()
);

alter table public.reports enable row level security;

do $$ begin
  create policy "reports: authenticated insert"
    on public.reports for insert
    with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- BLOCKS
-- ─────────────────────────

create table if not exists public.blocks (
    blocker_id uuid references public.users(id) on delete cascade,
    blocked_id uuid references public.users(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (blocker_id, blocked_id)
);

do $$ begin
  alter table public.blocks
    add constraint blocks_cannot_block_self check (blocker_id <> blocked_id);
exception when duplicate_object then null; end $$;

alter table public.blocks enable row level security;

drop policy if exists "blocks: self only" on public.blocks;

do $$ begin
  create policy "blocks: self only"
    on public.blocks for all
    using (auth.uid() = blocker_id)
    with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- COMMISSION REQUESTS: only the receiving artist may change invitation state
-- ─────────────────────────

-- A client may invite only a currently published creator, never themselves.
drop policy if exists "commission_requests: client insert"
  on public.commission_requests;

create policy "commission_requests: client insert"
  on public.commission_requests for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from public.artist_profiles ap
      where ap.id = commission_requests.artist_id
        and ap.is_published = true
        and ap.user_id <> auth.uid()
    )
  );

drop policy if exists "commission_requests: participant update"
  on public.commission_requests;

drop policy if exists "commission_requests: artist update"
  on public.commission_requests;

create policy "commission_requests: artist update"
  on public.commission_requests for update
  using (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = commission_requests.artist_id
        and ap.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.artist_profiles ap
      where ap.id = commission_requests.artist_id
        and ap.user_id = auth.uid()
    )
  );

-- Accepting an invitation touches three tables. Keeping it in one database
-- function prevents a half-accepted state if message creation fails midway.
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

  insert into public.messages (chat_id, sender_id, type, content)
  values (
    v_chat_id,
    auth.uid(),
    'commission',
    jsonb_build_object(
      'commission_id', p_commission_id,
      'text', format('我接受了「%s」的合作邀請，我們來討論細節。', v_org_name)
    )
  );

  return v_chat_id;
end;
$$;

grant execute on function public.accept_commission(bigint) to authenticated;


-- ─────────────────────────
-- ARTIST PROFILES: tighten public read
--
-- The original policy exposed every profile. Now only published ones are
-- public; you can always read your own.
-- ─────────────────────────

drop policy if exists "artist_profiles: public read" on public.artist_profiles;
drop policy if exists "artist_profiles: published or self read" on public.artist_profiles;

create policy "artist_profiles: published or self read"
  on public.artist_profiles for select
  using (is_published = true or user_id = auth.uid());
