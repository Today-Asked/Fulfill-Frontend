-- Editable profile fields and server-enforced username cooldown.
alter table public.users
  add column if not exists expertise text[] not null default '{}',
  add column if not exists username_changed_at timestamptz;

alter table public.users
  add constraint users_expertise_limit
  check (cardinality(expertise) <= 8);

create or replace function public.enforce_username_change_cooldown()
returns trigger
language plpgsql
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null
      and old.username_changed_at > now() - interval '14 days' then
      raise exception 'username can only be changed once every 14 days';
    end if;
    new.username_changed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists users_username_change_cooldown on public.users;
create trigger users_username_change_cooldown
  before update of username on public.users
  for each row
  execute function public.enforce_username_change_cooldown();
