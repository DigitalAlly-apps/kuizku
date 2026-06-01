-- ============================================================
-- KUIZKU (UJIANLY) — CONSOLIDATED DATABASE SCHEMA FOR PERSONAL USE
-- ============================================================
-- Jalankan skrip SQL ini langsung di Supabase Dashboard -> SQL Editor.
-- Skrip ini dirancang khusus untuk pemakaian pribadi (tanpa SaaS/billing/multi-workspace).
-- Menjamin performa tinggi, RLS (Row Level Security) yang aman, dan kemudahan deployment.
-- ============================================================

-- Aktifkan ekstensi pgcrypto jika belum aktif
create extension if not exists pgcrypto;

-- ============================================================
-- 1. PEMBUATAN TABEL-TABEL UTAMA
-- ============================================================

-- TABEL: TEACHERS (Profil Guru)
create table if not exists public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  subject text not null default '',
  institution text not null default '',
  created_at timestamptz not null default now()
);

-- TABEL: EXAMS (Ujian/Tugas/Latihan)
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  title text not null,
  description text,
  subject text not null,
  class_name text,
  exam_type text not null default 'UJIAN' check (exam_type in ('UJIAN', 'TUGAS', 'LATIHAN')),
  format text not null check (format in ('PG_ONLY', 'ESSAY_ONLY', 'COMBINATION')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED')),
  code text not null unique,
  settings jsonb not null default '{}'::jsonb,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- TABEL: QUESTIONS (Soal Ujian)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  type text not null check (type in ('MULTIPLE_CHOICE', 'ESSAY')),
  text text not null,
  image_url text,
  options jsonb, -- Untuk Pilihan Ganda (array of option objects)
  correct_option_id text, -- ID opsi jawaban yang benar
  answer_guide text, -- Panduan jawaban untuk Soal Essay
  weight numeric not null default 1 check (weight >= 0),
  timer_seconds integer, -- Batasan waktu per soal (opsional)
  tags text[] not null default '{}'::text[],
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- TABEL: PRELOADED_STUDENTS (Whitelist Peserta Ujian)
create table if not exists public.preloaded_students (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name text not null,
  nis text not null,
  created_at timestamptz not null default now()
);

-- TABEL: SUBMISSIONS (Hasil Pekerjaan Ujian Murid)
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_name text not null,
  nis text not null,
  attempt_number integer not null default 1,
  mc_score numeric not null default 0,
  total_score numeric, -- Nilai akhir gabungan (MC + Manual Essay)
  started_at timestamptz not null default now(),
  submitted_at timestamptz not null default now(),
  is_complete boolean not null default false,
  teacher_feedback text,
  is_returned boolean not null default false,
  anti_cheat_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- TABEL: STUDENT_ANSWERS (Jawaban Detail Per Soal Murid)
create table if not exists public.student_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_type text not null,
  selected_option_id text,
  essay_text text,
  time_taken_seconds integer,
  essay_score numeric,
  essay_comment text,
  created_at timestamptz not null default now()
);

-- TABEL: BANK_QUESTIONS (Bank Soal Pribadi Guru)
create table if not exists public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject text not null,
  class_name text,
  used_in_exam_ids uuid[] not null default '{}'::uuid[],
  type text not null check (type in ('MULTIPLE_CHOICE', 'ESSAY')),
  text text not null,
  image_url text,
  options jsonb,
  correct_option_id text,
  answer_guide text,
  weight numeric not null default 1 check (weight >= 0),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- TABEL: STUDENT_HISTORY (Riwayat Hasil Ujian di Device Murid)
create table if not exists public.student_history (
  id uuid primary key default gen_random_uuid(),
  exam_code text not null,
  exam_title text not null,
  student_name text not null,
  nis text not null,
  mc_score numeric not null default 0,
  total_score numeric,
  max_score numeric not null default 0,
  submitted_at timestamptz not null default now(),
  show_score boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 2. PEMBUATAN INDEKS UNTUK OPTIMALISASI KINERJA (INDEXES)
-- ============================================================
create index if not exists idx_exams_teacher_id on public.exams(teacher_id);
create index if not exists idx_exams_code on public.exams(code);
create index if not exists idx_questions_exam_id on public.questions(exam_id);
create index if not exists idx_preloaded_students_exam_id on public.preloaded_students(exam_id);
create index if not exists idx_submissions_exam_id on public.submissions(exam_id);
create index if not exists idx_student_answers_submission_id on public.student_answers(submission_id);
create index if not exists idx_bank_questions_teacher_id on public.bank_questions(teacher_id);
create index if not exists idx_student_history_nis on public.student_history(nis);
create index if not exists idx_student_history_exam_code on public.student_history(exam_code);

-- ============================================================
-- 3. KONFIGURASI ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Aktifkan RLS di setiap tabel
alter table public.teachers enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.preloaded_students enable row level security;
alter table public.submissions enable row level security;
alter table public.student_answers enable row level security;
alter table public.bank_questions enable row level security;
alter table public.student_history enable row level security;

-- Hapus kebijakan RLS lama jika ada
drop policy if exists "Teachers can read own profile" on public.teachers;
drop policy if exists "Teachers can update own profile" on public.teachers;
drop policy if exists "Teachers can insert own profile" on public.teachers;
drop policy if exists "Teachers manage own exams" on public.exams;
drop policy if exists "Anon read active exams" on public.exams;
drop policy if exists "Teachers manage own questions" on public.questions;
drop policy if exists "Anon read active exam questions" on public.questions;
drop policy if exists "Teachers manage own preloaded students" on public.preloaded_students;
drop policy if exists "Anon read active exam students" on public.preloaded_students;
drop policy if exists "Anon insert submissions" on public.submissions;
drop policy if exists "Anon update own draft" on public.submissions;
drop policy if exists "Anon read own submissions" on public.submissions;
drop policy if exists "Teachers read own exam submissions" on public.submissions;
drop policy if exists "Teachers update submissions for grading" on public.submissions;
drop policy if exists "Anon manage student answers" on public.student_answers;
drop policy if exists "Teachers read own student answers" on public.student_answers;
drop policy if exists "Teachers update student answers for grading" on public.student_answers;
drop policy if exists "Teachers manage own bank questions" on public.bank_questions;
drop policy if exists "Anyone can insert history" on public.student_history;
drop policy if exists "Read own history by nis" on public.student_history;

-- Kebijakan RLS: TEACHERS
create policy "Teachers can read own profile"
  on public.teachers for select to authenticated using (id = auth.uid());

create policy "Teachers can update own profile"
  on public.teachers for update to authenticated using (id = auth.uid());

create policy "Teachers can insert own profile"
  on public.teachers for insert to authenticated with check (id = auth.uid());

-- Kebijakan RLS: EXAMS
create policy "Teachers manage own exams"
  on public.exams for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

create policy "Anon read active exams"
  on public.exams for select to anon using (status = 'ACTIVE');

-- Kebijakan RLS: QUESTIONS
create policy "Teachers manage own questions"
  on public.questions for all to authenticated
  using (exists (select 1 from public.exams e where e.id = questions.exam_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = questions.exam_id and e.teacher_id = auth.uid()));

create policy "Anon read active exam questions"
  on public.questions for select to anon
  using (exists (select 1 from public.exams e where e.id = questions.exam_id and e.status = 'ACTIVE'));

-- Kebijakan RLS: PRELOADED_STUDENTS
create policy "Teachers manage own preloaded students"
  on public.preloaded_students for all to authenticated
  using (exists (select 1 from public.exams e where e.id = preloaded_students.exam_id and e.teacher_id = auth.uid()))
  with check (exists (select 1 from public.exams e where e.id = preloaded_students.exam_id and e.teacher_id = auth.uid()));

create policy "Anon read active exam students"
  on public.preloaded_students for select to anon
  using (exists (select 1 from public.exams e where e.id = preloaded_students.exam_id and e.status = 'ACTIVE'));

-- Kebijakan RLS: SUBMISSIONS
create policy "Anon insert submissions"
  on public.submissions for insert to anon with check (true);

create policy "Anon update own draft"
  on public.submissions for update to anon using (true);

create policy "Anon read own submissions"
  on public.submissions for select to anon using (true);

create policy "Teachers read own exam submissions"
  on public.submissions for select to authenticated
  using (exists (select 1 from public.exams e where e.id = submissions.exam_id and e.teacher_id = auth.uid()));

create policy "Teachers update submissions for grading"
  on public.submissions for update to authenticated
  using (exists (select 1 from public.exams e where e.id = submissions.exam_id and e.teacher_id = auth.uid()));

-- Kebijakan RLS: STUDENT_ANSWERS
create policy "Anon manage student answers"
  on public.student_answers for all to anon using (true) with check (true);

create policy "Teachers read own student answers"
  on public.student_answers for select to authenticated
  using (exists (
    select 1 from public.submissions s
    join public.exams e on e.id = s.exam_id
    where s.id = student_answers.submission_id and e.teacher_id = auth.uid()
  ));

create policy "Teachers update student answers for grading"
  on public.student_answers for update to authenticated
  using (exists (
    select 1 from public.submissions s
    join public.exams e on e.id = s.exam_id
    where s.id = student_answers.submission_id and e.teacher_id = auth.uid()
  ));

-- Kebijakan RLS: BANK_QUESTIONS
create policy "Teachers manage own bank questions"
  on public.bank_questions for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- Kebijakan RLS: STUDENT_HISTORY
create policy "Anyone can insert history"
  on public.student_history for insert to anon, authenticated with check (true);

create policy "Read own history by nis"
  on public.student_history for select to anon, authenticated using (true);

-- ============================================================
-- 4. DATABASE FUNCTION & STORED PROCEDURE (RPC)
-- ============================================================

-- RPC: save_exam_full
-- Menyimpan/mengubah Ujian beserta soal dan whitelisting murid secara atomik dalam 1 transaksi
create or replace function public.save_exam_full(
  p_exam      jsonb,
  p_questions jsonb,
  p_students  jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Upsert data ujian
  insert into public.exams (
    id, teacher_id, title, description, subject, class_name,
    exam_type, format, status, code, settings,
    active_from, active_to, updated_at
  )
  values (
    (p_exam->>'id')::uuid,
    (p_exam->>'teacher_id')::uuid,
    p_exam->>'title',
    p_exam->>'description',
    p_exam->>'subject',
    p_exam->>'class_name',
    p_exam->>'exam_type',
    p_exam->>'format',
    p_exam->>'status',
    p_exam->>'code',
    p_exam->'settings',
    nullif(p_exam->>'active_from', '')::timestamptz,
    nullif(p_exam->>'active_to', '')::timestamptz,
    (p_exam->>'updated_at')::timestamptz
  )
  on conflict (id) do update set
    title        = excluded.title,
    description  = excluded.description,
    subject      = excluded.subject,
    class_name   = excluded.class_name,
    exam_type    = excluded.exam_type,
    format       = excluded.format,
    status       = excluded.status,
    code         = excluded.code,
    settings     = excluded.settings,
    active_from  = excluded.active_from,
    active_to    = excluded.active_to,
    updated_at   = excluded.updated_at;

  -- 2. Hapus dan masukkan ulang Soal secara atomik
  delete from public.questions where exam_id = (p_exam->>'id')::uuid;

  insert into public.questions (
    id, exam_id, type, text, image_url, options,
    correct_option_id, answer_guide, weight, timer_seconds, tags, "order"
  )
  select
    (q->>'id')::uuid,
    (p_exam->>'id')::uuid,
    q->>'type',
    q->>'text',
    q->>'image_url',
    q->'options',
    q->>'correct_option_id',
    q->>'answer_guide',
    (q->>'weight')::numeric,
    nullif(q->>'timer_seconds', '')::integer,
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(coalesce(q->'tags', '[]'::jsonb))),
      array[]::text[]
    ),
    (q->>'order')::integer
  from jsonb_array_elements(p_questions) as q
  where jsonb_array_length(p_questions) > 0;

  -- 3. Hapus dan masukkan ulang Whitelist Murid secara atomik
  delete from public.preloaded_students where exam_id = (p_exam->>'id')::uuid;

  insert into public.preloaded_students (exam_id, name, nis)
  select
    (p_exam->>'id')::uuid,
    s->>'name',
    s->>'nis'
  from jsonb_array_elements(p_students) as s
  where jsonb_array_length(p_students) > 0;

end;
$$;

-- ============================================================
-- 5. AUTOMATIC TEACHER SYNC TRIGGER (Opsional - Sangat Direkomendasikan)
-- ============================================================
-- Trigger untuk otomatis memasukkan user baru dari auth.users ke public.teachers
-- jika pendaftaran dilakukan lewat Supabase Auth UI / Client.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.teachers (id, name, email, subject, institution)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Guru Baru'),
    new.email,
    '',
    ''
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- VERIFIKASI AKHIR
-- ============================================================
-- Menampilkan status tabel-tabel publik yang telah dibuat
select
  tablename,
  rowsecurity as rls_enabled,
  (select count(*) from pg_policies p where p.tablename = t.tablename) as policy_count
from pg_tables t
where schemaname = 'public'
  and tablename in ('teachers','exams','questions','preloaded_students',
                    'submissions','student_answers','bank_questions','student_history')
order by tablename;
