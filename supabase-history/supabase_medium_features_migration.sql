alter table public.submissions
  add column if not exists anti_cheat_events jsonb not null default '[]'::jsonb;
