-- =====================================================================
-- Artwork comments
--
-- Deliberately flat: there is no parent_id. Replying to someone is just a
-- new top-level comment that starts with "@username" — the client inserts
-- the mention and renders it as a link. One level only, unlike FB threads.
--
-- artwork_comment_likes mirrors public.likes (one row per user per comment).
-- =====================================================================

create table if not exists public.artwork_comments (
    id         bigint generated always as identity primary key,
    artwork_id bigint not null references public.artworks(id) on delete cascade,
    user_id    uuid   not null references public.users(id)    on delete cascade,
    content    text   not null check (char_length(btrim(content)) between 1 and 500),
    created_at timestamptz not null default now()
);

create index if not exists idx_artwork_comments_artwork
  on public.artwork_comments(artwork_id, created_at);

create table if not exists public.artwork_comment_likes (
    user_id    uuid   references public.users(id)            on delete cascade,
    comment_id bigint references public.artwork_comments(id) on delete cascade,
    created_at timestamptz default now(),
    primary key (user_id, comment_id)
);

create index if not exists idx_artwork_comment_likes_comment
  on public.artwork_comment_likes(comment_id);

alter table public.artwork_comments      enable row level security;
alter table public.artwork_comment_likes enable row level security;


-- ─────────────────────────
-- artwork_comments
-- 看得到作品就看得到留言；登入者可以留言在已發佈的作品上；
-- 本人或作品作者可以刪除
-- ─────────────────────────

do $$ begin
  create policy "artwork_comments: read if artwork visible"
    on public.artwork_comments for select
    using (exists (select 1 from public.artworks a where a.id = artwork_comments.artwork_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "artwork_comments: self insert on published"
    on public.artwork_comments for insert
    with check (
      auth.uid() = user_id
      and exists (
        select 1 from public.artworks a
        where a.id = artwork_id
          and a.status = 'published'
          and a.deleted_at is null
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "artwork_comments: author or artwork owner delete"
    on public.artwork_comments for delete
    using (
      auth.uid() = user_id
      or exists (
        select 1
        from public.artworks a
        join public.artist_profiles ap on ap.id = a.artist_id
        where a.id = artwork_comments.artwork_id
          and ap.user_id = auth.uid()
      )
    );
exception when duplicate_object then null; end $$;


-- ─────────────────────────
-- artwork_comment_likes
-- ─────────────────────────

do $$ begin
  create policy "artwork_comment_likes: public read"
    on public.artwork_comment_likes for select
    using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "artwork_comment_likes: self manage"
    on public.artwork_comment_likes for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
