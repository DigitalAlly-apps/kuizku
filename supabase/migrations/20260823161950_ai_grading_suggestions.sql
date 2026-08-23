create table public.ai_grading_suggestions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  suggested_score numeric(10,2) not null check (suggested_score >= 0),
  reason text not null default '',
  feedback text not null default '',
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'edited')),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_grading_suggestions_submission_created_idx
  on public.ai_grading_suggestions (submission_id, created_at desc);
create index ai_grading_suggestions_teacher_created_idx
  on public.ai_grading_suggestions (teacher_id, created_at desc);

create trigger ai_grading_suggestions_set_updated_at
before update on public.ai_grading_suggestions
for each row execute function public.set_updated_at();

alter table public.ai_grading_suggestions enable row level security;

create policy ai_grading_suggestions_teacher
on public.ai_grading_suggestions
for all to authenticated
using (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.submissions s
    join public.exams e on e.id = s.exam_id
    where s.id = submission_id and e.teacher_id = (select auth.uid())
  )
)
with check (
  teacher_id = (select auth.uid())
  and exists (
    select 1 from public.submissions s
    join public.exams e on e.id = s.exam_id
    join public.questions q on q.id = question_id and q.exam_id = e.id
    where s.id = submission_id and e.teacher_id = (select auth.uid())
  )
);
