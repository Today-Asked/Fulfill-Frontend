-- =====================================================================
-- Trigram index for tag autocomplete
--
-- searchTags() (src/lib/tags.ts) runs `ilike name, '%query%'` — a leading
-- wildcard, so the unique constraint's btree index on name can't help (btree
-- only accelerates prefix/equality lookups). At 8 seed rows a sequential
-- scan is free; once creators have added a few hundred tags, every
-- autocomplete keystroke would scan the whole table. pg_trgm + a GIN index
-- lets Postgres use an index for arbitrary substring matches instead.
-- =====================================================================

create extension if not exists pg_trgm;

create index if not exists idx_tags_name_trgm
  on public.tags using gin (name gin_trgm_ops);
