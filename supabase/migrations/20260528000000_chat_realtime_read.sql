-- =========================
-- 1. Enable Realtime for messages
-- =========================

alter publication supabase_realtime add table public.messages;


-- =========================
-- 2. Allow recipients to mark messages as read
--    原本只有 sender 可以 update；現在加一條讓 recipient 可以更新 read_at
-- =========================

create policy "messages: recipient mark read"
  on public.messages for update
  using (
    auth.uid() != sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.chat_id
        and (c.usera_id = auth.uid() or c.userb_id = auth.uid())
    )
  );
