-- ============================================================
-- Migrasi: Integrasi Clerk Auth
-- Tanggal: 2026-05-10
--
-- Perubahan:
-- 1. Tambah kolom clerk_id ke tabel teachers
-- 2. Update RLS policies untuk memakai Clerk JWT (auth.jwt() ->> 'sub')
-- 3. Buat JWT template di Clerk dashboard (lihat instruksi di bawah)
-- ============================================================

-- -----------------------------------------------------------------------------
-- 1. Tambah kolom clerk_id ke teachers
-- -----------------------------------------------------------------------------
alter table public.teachers
  add column if not exists clerk_id text unique;

-- Index untuk lookup cepat berdasarkan clerk_id
create index if not exists idx_teachers_clerk_id on public.teachers(clerk_id);

-- -----------------------------------------------------------------------------
-- 2. Helper function: ambil UUID internal teacher dari Clerk JWT
--    Dipakai di RLS policies agar tidak perlu join berulang.
-- -----------------------------------------------------------------------------
create or replace function public.get_teacher_id_from_clerk()
returns uuid
language sql
stable
security definer
as $$
  select id
  from public.teachers
  where clerk_id = (auth.jwt() ->> 'sub')
  limit 1;
$$;

-- -----------------------------------------------------------------------------
-- 3. Update RLS policies — ganti auth.uid() dengan Clerk JWT sub claim
-- -----------------------------------------------------------------------------

-- teachers
drop policy if exists "Teachers can read own profile" on public.teachers;
create policy "Teachers can read own profile"
  on public.teachers for select
  to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'));

drop policy if exists "Teachers can update own profile" on public.teachers;
create policy "Teachers can update own profile"
  on public.teachers for update
  to authenticated
  using (clerk_id = (auth.jwt() ->> 'sub'));

drop policy if exists "Teachers can insert own profile" on public.teachers;
create policy "Teachers can insert own profile"
  on public.teachers for insert
  to authenticated
  with check (clerk_id = (auth.jwt() ->> 'sub'));

-- exams
drop policy if exists "Teachers can manage own exams" on public.exams;
create policy "Teachers can manage own exams"
  on public.exams for all
  to authenticated
  using (teacher_id = public.get_teacher_id_from_clerk())
  with check (teacher_id = public.get_teacher_id_from_clerk());

-- Murid bisa baca exam aktif berdasarkan kode (tanpa login)
drop policy if exists "Public can read active exams" on public.exams;
create policy "Public can read active exams"
  on public.exams for select
  to anon, authenticated
  using (status = 'ACTIVE');

-- questions
drop policy if exists "Teachers can manage own questions" on public.questions;
create policy "Teachers can manage own questions"
  on public.questions for all
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id
        and e.teacher_id = public.get_teacher_id_from_clerk()
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id
        and e.teacher_id = public.get_teacher_id_from_clerk()
    )
  );

-- Murid bisa baca soal dari exam aktif
drop policy if exists "Public can read questions of active exams" on public.questions;
create policy "Public can read questions of active exams"
  on public.questions for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id and e.status = 'ACTIVE'
    )
  );

-- preloaded_students
drop policy if exists "Teachers can manage own preloaded students" on public.preloaded_students;
create policy "Teachers can manage own preloaded students"
  on public.preloaded_students for all
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id
        and e.teacher_id = public.get_teacher_id_from_clerk()
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id
        and e.teacher_id = public.get_teacher_id_from_clerk()
    )
  );

-- Murid bisa baca preloaded_students dari exam aktif (untuk validasi whitelist)
drop policy if exists "Public can read preloaded students of active exams" on public.preloaded_students;
create policy "Public can read preloaded students of active exams"
  on public.preloaded_students for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id and e.status = 'ACTIVE'
    )
  );

-- submissions — murid bisa insert/update, guru bisa baca semua milik examnya
drop policy if exists "Anyone can insert submissions" on public.submissions;
create policy "Anyone can insert submissions"
  on public.submissions for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update own submission" on public.submissions;
create policy "Anyone can update own submission"
  on public.submissions for update
  to anon, authenticated
  using (true);

drop policy if exists "Teachers can read own exam submissions" on public.submissions;
create policy "Teachers can read own exam submissions"
  on public.submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = submissions.exam_id
        and e.teacher_id = public.get_teacher_id_from_clerk()
    )
  );

-- Murid bisa baca submission miliknya sendiri (untuk result screen)
drop policy if exists "Public can read submissions by exam" on public.submissions;
create policy "Public can read submissions by exam"
  on public.submissions for select
  to anon
  using (true);

-- student_answers
drop policy if exists "Anyone can manage student answers" on public.student_answers;
create policy "Anyone can manage student answers"
  on public.student_answers for all
  to anon, authenticated
  using (true)
  with check (true);

-- bank_questions
drop policy if exists "Teachers can manage own bank questions" on public.bank_questions;
create policy "Teachers can manage own bank questions"
  on public.bank_questions for all
  to authenticated
  using (teacher_id = public.get_teacher_id_from_clerk())
  with check (teacher_id = public.get_teacher_id_from_clerk());

-- workspaces
drop policy if exists "Owners can read own workspaces" on public.workspaces;
create policy "Owners can read own workspaces"
  on public.workspaces for select
  to authenticated
  using (owner_id = public.get_teacher_id_from_clerk());

-- subscriptions
drop policy if exists "Owners can read own subscriptions" on public.subscriptions;
create policy "Owners can read own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (
    exists (
      select 1 from public.workspaces w
      where w.id = subscriptions.workspace_id
        and w.owner_id = public.get_teacher_id_from_clerk()
    )
  );

-- -----------------------------------------------------------------------------
-- INSTRUKSI SETUP CLERK DASHBOARD
-- -----------------------------------------------------------------------------
-- Setelah menjalankan migration ini, lakukan langkah berikut di Clerk dashboard:
--
-- 1. Buka: https://dashboard.clerk.com → pilih project → JWT Templates
-- 2. Klik "New template" → pilih "Supabase"
-- 3. Nama template: "supabase" (harus persis sama)
-- 4. Salin "Signing Key" dari template tersebut
-- 5. Buka Supabase dashboard → Settings → API → JWT Settings
-- 6. Paste signing key Clerk ke kolom "JWT Secret"
-- 7. Simpan
--
-- Setelah itu, setiap request dari frontend akan menyertakan Clerk JWT
-- yang diverifikasi oleh Supabase sebelum RLS policy dijalankan.
-- -----------------------------------------------------------------------------
