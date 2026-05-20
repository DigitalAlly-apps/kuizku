-- ============================================================
-- Cleanup tabel SaaS yang tidak dipakai untuk pemakaian pribadi
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- Drop tabel SaaS (cascade hapus semua foreign key + policies)
drop table if exists public.subscriptions cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.plans cascade;

-- Drop kolom workspace_id yang selalu null di semua tabel
alter table public.exams           drop column if exists workspace_id;
alter table public.questions       drop column if exists workspace_id;
alter table public.preloaded_students drop column if exists workspace_id;
alter table public.submissions     drop column if exists workspace_id;
alter table public.student_answers drop column if exists workspace_id;
alter table public.bank_questions  drop column if exists workspace_id;

-- Drop helper functions billing yang tidak dipakai lagi
drop function if exists public.set_user_plan(text, text, integer, text) cascade;
drop function if exists public.list_user_plans() cascade;
drop function if exists public.sync_teacher_to_subscription() cascade;
drop function if exists public.sync_teacher_update_to_subscriptions() cascade;
drop function if exists public.sync_teacher_to_sub() cascade;

-- Verifikasi
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
