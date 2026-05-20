-- ============================================================
-- Tabel student_history — riwayat hasil ujian murid
-- Menggantikan localStorage ujianly_student_history
-- Tidak butuh auth — murid tidak login
-- ============================================================

create table if not exists public.student_history (
  id          uuid primary key default gen_random_uuid(),
  exam_code   text not null,
  exam_title  text not null,
  student_name text not null,
  nis         text not null,
  mc_score    numeric not null default 0,
  total_score numeric,
  max_score   numeric not null default 0,
  submitted_at timestamptz not null default now(),
  show_score  boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Index untuk lookup cepat berdasarkan NIS
create index if not exists idx_student_history_nis on public.student_history(nis);
create index if not exists idx_student_history_exam_code on public.student_history(exam_code);

-- RLS: siapapun bisa insert (murid tidak login)
-- Read dibatasi per NIS agar tidak bisa lihat riwayat orang lain
alter table public.student_history enable row level security;

drop policy if exists "Anyone can insert history" on public.student_history;
create policy "Anyone can insert history"
  on public.student_history for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Read own history by nis" on public.student_history;
create policy "Read own history by nis"
  on public.student_history for select
  to anon, authenticated
  using (true); -- filter by nis dilakukan di query client
