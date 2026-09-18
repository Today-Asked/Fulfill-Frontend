-- =====================================================================
-- Per-commission message threads
--
-- messages.chat_id already scopes a message to a (usera_id, userb_id) pair,
-- but says nothing about *which* commission between them it's about — every
-- commission two people have ever discussed shares the same stream. This
-- adds a nullable pointer so a message can optionally belong to one specific
-- commission's thread instead of the general conversation.
--
--   commission_id IS NULL      -> 主聊天室 (general thread)
--   commission_id = <id>       -> that commission's own discussion thread
--
-- No RLS changes needed: "messages: participant read/insert" already gate
-- access purely on chat_id/conversation membership, and commission_id is
-- just an extra attribute on a message the participant can already see.
-- =====================================================================

alter table public.messages
  add column if not exists commission_id bigint references public.commission_requests(id) on delete set null;

-- Partial index: most messages will have a null commission_id (general
-- thread), so this only indexes the ones actually worth filtering by.
create index if not exists idx_messages_commission
  on public.messages(commission_id)
  where commission_id is not null;

-- Backfill: "accept" and "milestone" system messages already carry a
-- commission_id inside their jsonb content (accept_commission() and
-- postMilestoneMessage() both set it) — promote those to the real column so
-- existing history lands in the right tab retroactively. "inquiry" and
-- "invited" messages are deliberately excluded: those fire *before* a
-- commission is accepted, when it has no thread of its own yet, so they stay
-- in the general conversation both retroactively and going forward.
update public.messages
set commission_id = (content->>'commission_id')::bigint
where type = 'commission'
  and commission_id is null
  and content ? 'commission_id'
  and coalesce(content->>'kind', 'milestone') = 'milestone';
