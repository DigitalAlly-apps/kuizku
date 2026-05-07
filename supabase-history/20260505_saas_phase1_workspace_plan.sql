-- Ujianly SaaS Phase 1: workspace + plans foundation
-- Non-breaking migration: keeps existing teacher_id/exam_id/submission_id columns.

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Core SaaS tables
-- -----------------------------------------------------------------------------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'individual' check (type in ('individual', 'bimbel')),
  owner_id uuid not null references public.teachers(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.teachers(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'teacher')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table if not exists public.plans (
  key text primary key,
  name text not null,
  price integer not null default 0,
  active_exam_limit integer not null,
  monthly_submission_limit integer not null,
  bank_question_limit integer not null,
  can_import boolean not null default false,
  can_export boolean not null default false,
  can_use_timer boolean not null default false,
  can_use_anticheat boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null references public.plans(key),
  status text not null default 'free' check (status in ('free', 'active', 'expired', 'past_due')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  promo_payments_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id)
);

-- -----------------------------------------------------------------------------
-- Plan seed data
-- -----------------------------------------------------------------------------
insert into public.plans (
  key, name, price, active_exam_limit, monthly_submission_limit,
  bank_question_limit, can_import, can_export, can_use_timer, can_use_anticheat
) values
  ('free', 'Free', 0, 2, 20, 10, false, false, false, false),
  ('pro_monthly', 'Pro Monthly', 49000, 50, 2000, 1000, true, true, true, true)
on conflict (key) do update set
  name = excluded.name,
  price = excluded.price,
  active_exam_limit = excluded.active_exam_limit,
  monthly_submission_limit = excluded.monthly_submission_limit,
  bank_question_limit = excluded.bank_question_limit,
  can_import = excluded.can_import,
  can_export = excluded.can_export,
  can_use_timer = excluded.can_use_timer,
  can_use_anticheat = excluded.can_use_anticheat;

-- -----------------------------------------------------------------------------
-- Add nullable workspace_id to existing tables first. Nullable keeps this safe
-- for orphaned historical rows while the app is migrated gradually.
-- -----------------------------------------------------------------------------
alter table public.exams
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.questions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.preloaded_students
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.submissions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.student_answers
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

alter table public.bank_questions
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Backfill: one personal workspace per existing teacher.
-- -----------------------------------------------------------------------------
insert into public.workspaces (name, type, owner_id)
select
  coalesce(nullif(trim(t.institution), ''), nullif(trim(t.name), ''), 'Workspace') as name,
  'individual' as type,
  t.id as owner_id
from public.teachers t
where not exists (
  select 1
  from public.workspaces w
  where w.owner_id = t.id
);

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, w.owner_id, 'owner'
from public.workspaces w
where not exists (
  select 1
  from public.workspace_members wm
  where wm.workspace_id = w.id and wm.user_id = w.owner_id
)
on conflict (workspace_id, user_id) do nothing;

insert into public.subscriptions (workspace_id, plan_key, status)
select w.id, 'free', 'free'
from public.workspaces w
where not exists (
  select 1
  from public.subscriptions s
  where s.workspace_id = w.id
)
on conflict (workspace_id) do nothing;

-- -----------------------------------------------------------------------------
-- Backfill workspace_id into existing data through current relationships.
-- -----------------------------------------------------------------------------
update public.exams e
set workspace_id = wm.workspace_id
from public.workspace_members wm
where e.workspace_id is null
  and e.teacher_id = wm.user_id;

update public.bank_questions bq
set workspace_id = wm.workspace_id
from public.workspace_members wm
where bq.workspace_id is null
  and bq.teacher_id = wm.user_id;

update public.questions q
set workspace_id = e.workspace_id
from public.exams e
where q.workspace_id is null
  and q.exam_id = e.id
  and e.workspace_id is not null;

update public.preloaded_students ps
set workspace_id = e.workspace_id
from public.exams e
where ps.workspace_id is null
  and ps.exam_id = e.id
  and e.workspace_id is not null;

update public.submissions s
set workspace_id = e.workspace_id
from public.exams e
where s.workspace_id is null
  and s.exam_id = e.id
  and e.workspace_id is not null;

update public.student_answers sa
set workspace_id = s.workspace_id
from public.submissions s
where sa.workspace_id is null
  and sa.submission_id = s.id
  and s.workspace_id is not null;

-- -----------------------------------------------------------------------------
-- Indexes for workspace-scoped reads and future feature gates.
-- -----------------------------------------------------------------------------
create index if not exists idx_workspaces_owner_id on public.workspaces(owner_id);
create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);
create index if not exists idx_subscriptions_workspace_id on public.subscriptions(workspace_id);

create index if not exists idx_exams_workspace_id on public.exams(workspace_id);
create index if not exists idx_questions_workspace_id on public.questions(workspace_id);
create index if not exists idx_preloaded_students_workspace_id on public.preloaded_students(workspace_id);
create index if not exists idx_submissions_workspace_id on public.submissions(workspace_id);
create index if not exists idx_student_answers_workspace_id on public.student_answers(workspace_id);
create index if not exists idx_bank_questions_workspace_id on public.bank_questions(workspace_id);
