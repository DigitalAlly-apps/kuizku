-- ============================================================
-- FIX RLS POLICIES — Personal Use
-- Jalankan ini PERTAMA sebelum SQL lainnya
--
-- Masalah yang di-fix:
-- 1. Murid tidak bisa akses ujian via kode (anon blocked)
-- 2. Guru tidak bisa save/read exam (authenticated blocked)
-- 3. Soal tidak tersimpan (questions blocked)
-- ============================================================

-- -----------------------------------------------------------------------------
-- TEACHERS
-- -----------------------------------------------------------------------------
alter table public.teachers enable row level security;

drop policy if exists "Teachers can read own profile" on public.teachers;
drop policy if exists "Teachers can update own profile" on public.teachers;
drop policy if exists "Teachers can insert own profile" on public.teachers;

create policy "Teachers can read own profile"
  on public.teachers for select to authenticated
  using (id = auth.uid());

create policy "Teachers can update own profile"
  on public.teachers for update to authenticated
  using (id = auth.uid());

create policy "Teachers can insert own profile"
  on public.teachers for insert to authenticated
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- EXAMS
-- Guru: full CRUD milik sendiri
-- Murid (anon): bisa baca exam ACTIVE saja
-- -----------------------------------------------------------------------------
alter table public.exams enable row level security;

drop policy if exists "Teachers manage own exams" on public.exams;
drop policy if exists "Anon read active exams" on public.exams;

create policy "Teachers manage own exams"
  on public.exams for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

create policy "Anon read active exams"
  on public.exams for select to anon
  using (status = 'ACTIVE');

-- -----------------------------------------------------------------------------
-- QUESTIONS
-- Guru: kelola soal milik exam sendiri
-- Murid (anon): baca soal dari exam ACTIVE
-- -----------------------------------------------------------------------------
alter table public.questions enable row level security;

drop policy if exists "Teachers manage own questions" on public.questions;
drop policy if exists "Anon read active exam questions" on public.questions;

create policy "Teachers manage own questions"
  on public.questions for all to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id
        and e.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id
        and e.teacher_id = auth.uid()
    )
  );

create policy "Anon read active exam questions"
  on public.questions for select to anon
  using (
    exists (
      select 1 from public.exams e
      where e.id = questions.exam_id
        and e.status = 'ACTIVE'
    )
  );

-- -----------------------------------------------------------------------------
-- PRELOADED_STUDENTS
-- Guru: kelola daftar peserta exam sendiri
-- Murid (anon): baca daftar peserta exam ACTIVE (untuk validasi whitelist)
-- -----------------------------------------------------------------------------
alter table public.preloaded_students enable row level security;

drop policy if exists "Teachers manage own preloaded students" on public.preloaded_students;
drop policy if exists "Anon read active exam students" on public.preloaded_students;

create policy "Teachers manage own preloaded students"
  on public.preloaded_students for all to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id
        and e.teacher_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id
        and e.teacher_id = auth.uid()
    )
  );

create policy "Anon read active exam students"
  on public.preloaded_students for select to anon
  using (
    exists (
      select 1 from public.exams e
      where e.id = preloaded_students.exam_id
        and e.status = 'ACTIVE'
    )
  );

-- -----------------------------------------------------------------------------
-- SUBMISSIONS
-- Murid (anon): insert + update draft milik sendiri
-- Guru: baca semua submission exam miliknya, update untuk grading
-- -----------------------------------------------------------------------------
alter table public.submissions enable row level security;

drop policy if exists "Anon insert submissions" on public.submissions;
drop policy if exists "Anon update own draft" on public.submissions;
drop policy if exists "Anon read own submissions" on public.submissions;
drop policy if exists "Teachers read own exam submissions" on public.submissions;
drop policy if exists "Teachers update submissions for grading" on public.submissions;

create policy "Anon insert submissions"
  on public.submissions for insert to anon
  with check (true);

create policy "Anon update own draft"
  on public.submissions for update to anon
  using (true);

create policy "Anon read own submissions"
  on public.submissions for select to anon
  using (true);

create policy "Teachers read own exam submissions"
  on public.submissions for select to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = submissions.exam_id
        and e.teacher_id = auth.uid()
    )
  );

create policy "Teachers update submissions for grading"
  on public.submissions for update to authenticated
  using (
    exists (
      select 1 from public.exams e
      where e.id = submissions.exam_id
        and e.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- STUDENT_ANSWERS
-- Murid (anon): full access (insert/update/select)
-- Guru: baca jawaban dari submission exam miliknya
-- -----------------------------------------------------------------------------
alter table public.student_answers enable row level security;

drop policy if exists "Anon manage student answers" on public.student_answers;
drop policy if exists "Teachers read own student answers" on public.student_answers;
drop policy if exists "Teachers update student answers for grading" on public.student_answers;

create policy "Anon manage student answers"
  on public.student_answers for all to anon
  using (true)
  with check (true);

create policy "Teachers read own student answers"
  on public.student_answers for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.exams e on e.id = s.exam_id
      where s.id = student_answers.submission_id
        and e.teacher_id = auth.uid()
    )
  );

create policy "Teachers update student answers for grading"
  on public.student_answers for update to authenticated
  using (
    exists (
      select 1 from public.submissions s
      join public.exams e on e.id = s.exam_id
      where s.id = student_answers.submission_id
        and e.teacher_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- BANK_QUESTIONS
-- Guru: full CRUD milik sendiri saja
-- -----------------------------------------------------------------------------
alter table public.bank_questions enable row level security;

drop policy if exists "Teachers manage own bank questions" on public.bank_questions;

create policy "Teachers manage own bank questions"
  on public.bank_questions for all to authenticated
  using (teacher_id = auth.uid())
  with check (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Verifikasi: cek semua tabel sudah punya RLS
-- -----------------------------------------------------------------------------
select
  tablename,
  rowsecurity as rls_enabled,
  (select count(*) from pg_policies p where p.tablename = t.tablename) as policy_count
from pg_tables t
where schemaname = 'public'
  and tablename in ('teachers','exams','questions','preloaded_students',
                    'submissions','student_answers','bank_questions')
order by tablename;
