-- Fulfill Grid: free-form bento-style portfolio layout, opt-in per creator.
--
-- Layout unit system: a fixed 6-column grid where every unit cell is a square
-- (unit size = container width / 6, computed client-side). grid_x/grid_y/grid_w/grid_h
-- are all expressed in these grid units, not pixels, so the same layout renders at
-- the same proportions on any device width.

alter table public.artworks
  add column if not exists grid_x smallint not null default 0,
  add column if not exists grid_y smallint not null default 0,
  add column if not exists grid_w smallint not null default 2,
  add column if not exists grid_h smallint not null default 2;

alter table public.artist_profiles
  add column if not exists layout_style varchar(20) not null default 'classic';

do $$ begin
  alter table public.artist_profiles
    add constraint artist_profiles_layout_style_check
    check (layout_style in ('classic', 'fulfill_grid'));
exception
  when duplicate_object then null;
end $$;

alter table public.artwork_media
  add column if not exists width integer,
  add column if not exists height integer;

-- Backfill: pack existing artworks into the 6-column grid using their current
-- display_order, 2x2 tiles (3 per row), so pre-existing portfolios have a sane
-- starting layout the moment a creator switches to Fulfill Grid.
with ranked as (
  select
    id,
    row_number() over (partition by artist_id order by display_order asc, id asc) - 1 as position
  from public.artworks
  where grid_x = 0 and grid_y = 0
)
update public.artworks
set
  grid_x = (ranked.position % 3) * 2,
  grid_y = (ranked.position / 3) * 2
from ranked
where public.artworks.id = ranked.id;

create index if not exists artworks_artist_grid_idx
  on public.artworks (artist_id, grid_y, grid_x);
