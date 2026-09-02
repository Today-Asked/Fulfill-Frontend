-- Persist the owner's manual portfolio layout.
alter table public.artworks
  add column if not exists display_order integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (partition by artist_id order by created_at desc, id desc) - 1 as position
  from public.artworks
)
update public.artworks
set display_order = ranked.position
from ranked
where public.artworks.id = ranked.id;

create index if not exists artworks_artist_display_order_idx
  on public.artworks (artist_id, display_order);
