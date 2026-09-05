-- =====================================================================
-- Seed Chinese tag options
--
-- The original seed tags (init migration, 2026-04-20) are all English
-- ("Oil Painting", "Illustration", ...), so the new tag-input autocomplete
-- had nothing to suggest for a Chinese query. These are additional rows,
-- not replacements — both vocabularies stay searchable side by side.
-- =====================================================================

insert into public.tags (name, category) values
  ('插畫',     'medium'),
  ('油畫',     'medium'),
  ('數位繪圖',  'medium'),
  ('抽象',     'style'),
  ('肖像',     'subject'),
  ('角色設計',  'subject'),
  ('品牌設計',  'subject'),
  ('3D 創作',  'medium')
on conflict (name) do nothing;
