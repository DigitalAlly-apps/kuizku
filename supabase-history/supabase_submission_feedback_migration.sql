alter table public.submissions
  add column if not exists teacher_feedback text,
  add column if not exists is_returned boolean not null default false;
