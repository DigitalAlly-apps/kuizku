-- ============================================================
-- KUIZKU (UJIANLY) — SQL CLEANUP: DROP COMMERCIAL/SAAS DATABASE OBJECTS
-- ============================================================
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor untuk
-- menghapus total semua struktur/tabel database yang dulunya digunakan
-- untuk komersial/SaaS (jualan/sistem langganan/workspace/billing).
-- Skrip ini aman dijalankan dan tidak akan merusak data inti ujian/guru Anda.
-- ============================================================

-- 1. DROP SEMUA TABEL SAAS / JUALAN (Cascade otomatis menghapus foreign key & policy terkait)
drop table if exists public.subscriptions cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.plans cascade;

-- 2. DROP KOLOM 'workspace_id' DARI SEMUA TABEL INTI
-- Kolom ini digunakan untuk membagi data per-workspace saat mode SaaS aktif.
-- Untuk pemakaian pribadi, kolom ini tidak lagi diperlukan dan aman untuk dihapus.
alter table public.exams drop column if exists workspace_id;
alter table public.questions drop column if exists workspace_id;
alter table public.preloaded_students drop column if exists workspace_id;
alter table public.submissions drop column if exists workspace_id;
alter table public.student_answers drop column if exists workspace_id;
alter table public.bank_questions drop column if exists workspace_id;

-- 3. DROP FUNGSI ATAU TRIGGER BILLING / SAAS YANG PERNAH ADA
drop function if exists public.set_user_plan(text, text, integer, text) cascade;
drop function if exists public.list_user_plans() cascade;
drop function if exists public.sync_teacher_to_subscription() cascade;
drop function if exists public.sync_teacher_update_to_subscriptions() cascade;
drop function if exists public.sync_teacher_to_sub() cascade;

-- 4. VERIFIKASI AKHIR
-- Menampilkan daftar tabel publik yang tersisa di database Supabase Anda.
-- Seharusnya hanya ada tabel-tabel inti pemakaian pribadi (teachers, exams, questions, dll).
select 
  table_name as "Tabel Inti yang Tersisa (Aman)"
from information_schema.tables
where table_schema = 'public'
  and table_name not in ('pg_stat_statements')
order by table_name;
