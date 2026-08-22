create extension if not exists pgcrypto;

create table public.teachers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  email text not null unique check (email = lower(email)),
  subject text not null default '',
  institution text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.teachers(id) on delete cascade,
  name text not null,
  type text not null default 'individual' check (type in ('individual', 'bimbel')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free', 'pro_manual', 'pro_monthly')),
  status text not null default 'free' check (status in ('free', 'active', 'expired', 'past_due')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  promo_payments_used integer not null default 0 check (promo_payments_used >= 0),
  manual_payment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  description text,
  subject text not null default '',
  class_name text,
  exam_type text not null default 'UJIAN' check (exam_type in ('UJIAN', 'TUGAS', 'LATIHAN')),
  format text not null check (format in ('PG_ONLY', 'ESSAY_ONLY', 'COMBINATION')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'ENDED', 'ARCHIVED')),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  settings jsonb not null default '{}'::jsonb,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (active_to is null or active_from is null or active_from < active_to)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  type text not null check (type in ('MULTIPLE_CHOICE', 'ESSAY')),
  text text not null check (char_length(trim(text)) > 0),
  image_url text,
  options jsonb,
  correct_option_id text,
  answer_guide text,
  weight numeric(10, 2) not null default 1 check (weight > 0),
  timer_seconds integer check (timer_seconds is null or timer_seconds > 0),
  tags text[] not null default '{}',
  "order" integer not null check ("order" >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, "order"),
  check (
    (type = 'MULTIPLE_CHOICE' and options is not null and correct_option_id is not null)
    or (type = 'ESSAY' and options is null and correct_option_id is null)
  )
);

create table public.preloaded_students (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  nis text not null default '',
  created_at timestamptz not null default now(),
  unique (exam_id, name, nis)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_name text not null check (char_length(trim(student_name)) > 0),
  nis text not null,
  attempt_number integer not null check (attempt_number > 0),
  mc_score numeric(10, 2) not null default 0 check (mc_score >= 0),
  total_score numeric(10, 2) check (total_score is null or total_score >= 0),
  started_at timestamptz not null,
  submitted_at timestamptz,
  is_complete boolean not null default false,
  teacher_feedback text,
  is_returned boolean not null default false,
  anti_cheat_events jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, nis, attempt_number)
);

create table public.student_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  question_type text not null check (question_type in ('MULTIPLE_CHOICE', 'ESSAY')),
  selected_option_id text,
  essay_text text,
  time_taken_seconds integer check (time_taken_seconds is null or time_taken_seconds >= 0),
  essay_score numeric(10, 2) check (essay_score is null or essay_score >= 0),
  essay_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, question_id),
  check (
    (question_type = 'MULTIPLE_CHOICE' and essay_text is null)
    or (question_type = 'ESSAY' and selected_option_id is null)
  )
);

create table public.bank_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject text not null default '',
  class_name text,
  used_in_exam_ids uuid[] not null default '{}',
  type text not null check (type in ('MULTIPLE_CHOICE', 'ESSAY')),
  text text not null check (char_length(trim(text)) > 0),
  image_url text,
  options jsonb,
  correct_option_id text,
  answer_guide text,
  weight numeric(10, 2) not null default 1 check (weight > 0),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_history (
  id uuid primary key default gen_random_uuid(),
  exam_code text not null,
  exam_title text not null,
  student_name text not null,
  nis text not null,
  mc_score numeric(10, 2) not null default 0,
  total_score numeric(10, 2),
  max_score numeric(10, 2) not null,
  submitted_at timestamptz not null,
  show_score boolean not null default false,
  created_at timestamptz not null default now()
);

create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index subscriptions_workspace_created_idx on public.subscriptions (workspace_id, created_at desc);
create index exams_teacher_created_idx on public.exams (teacher_id, created_at desc);
create index questions_exam_order_idx on public.questions (exam_id, "order");
create index preloaded_students_exam_id_idx on public.preloaded_students (exam_id);
create index submissions_exam_nis_idx on public.submissions (exam_id, nis);
create index student_answers_submission_id_idx on public.student_answers (submission_id);
create index bank_questions_teacher_created_idx on public.bank_questions (teacher_id, created_at desc);
create index student_history_nis_submitted_idx on public.student_history (nis, submitted_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger teachers_set_updated_at before update on public.teachers for each row execute function public.set_updated_at();
create trigger workspaces_set_updated_at before update on public.workspaces for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger exams_set_updated_at before update on public.exams for each row execute function public.set_updated_at();
create trigger questions_set_updated_at before update on public.questions for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger student_answers_set_updated_at before update on public.student_answers for each row execute function public.set_updated_at();
create trigger bank_questions_set_updated_at before update on public.bank_questions for each row execute function public.set_updated_at();

alter table public.teachers enable row level security;
alter table public.workspaces enable row level security;
alter table public.subscriptions enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.preloaded_students enable row level security;
alter table public.submissions enable row level security;
alter table public.student_answers enable row level security;
alter table public.bank_questions enable row level security;
alter table public.student_history enable row level security;

create policy teachers_own_row on public.teachers for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy workspaces_owner on public.workspaces for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy subscriptions_workspace_owner on public.subscriptions for all to authenticated using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid()))) with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = (select auth.uid())));
create policy exams_teacher on public.exams for all to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);
create policy questions_exam_teacher on public.questions for all to authenticated using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid()))) with check (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid())));
create policy students_exam_teacher on public.preloaded_students for all to authenticated using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid()))) with check (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid())));
create policy submissions_exam_teacher on public.submissions for all to authenticated using (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid()))) with check (exists (select 1 from public.exams e where e.id = exam_id and e.teacher_id = (select auth.uid())));
create policy answers_submission_teacher on public.student_answers for all to authenticated using (exists (select 1 from public.submissions s join public.exams e on e.id = s.exam_id where s.id = submission_id and e.teacher_id = (select auth.uid()))) with check (exists (select 1 from public.submissions s join public.exams e on e.id = s.exam_id where s.id = submission_id and e.teacher_id = (select auth.uid())));
create policy bank_questions_teacher on public.bank_questions for all to authenticated using ((select auth.uid()) = teacher_id) with check ((select auth.uid()) = teacher_id);

create or replace function public.save_exam_full(p_exam jsonb, p_questions jsonb, p_students jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exam_id uuid := (p_exam ->> 'id')::uuid;
begin
  if (select auth.uid()) is null or (p_exam ->> 'teacher_id')::uuid <> (select auth.uid()) then
    raise exception 'not authorized';
  end if;

  insert into public.exams (id, teacher_id, title, description, subject, class_name, exam_type, format, status, code, settings, active_from, active_to, updated_at)
  values (v_exam_id, (p_exam ->> 'teacher_id')::uuid, p_exam ->> 'title', nullif(p_exam ->> 'description', ''), coalesce(p_exam ->> 'subject', ''), nullif(p_exam ->> 'class_name', ''), coalesce(p_exam ->> 'exam_type', 'UJIAN'), p_exam ->> 'format', coalesce(p_exam ->> 'status', 'DRAFT'), p_exam ->> 'code', coalesce(p_exam -> 'settings', '{}'::jsonb), nullif(p_exam ->> 'active_from', '')::timestamptz, nullif(p_exam ->> 'active_to', '')::timestamptz, now())
  on conflict (id) do update set title = excluded.title, description = excluded.description, subject = excluded.subject, class_name = excluded.class_name, exam_type = excluded.exam_type, format = excluded.format, status = excluded.status, code = excluded.code, settings = excluded.settings, active_from = excluded.active_from, active_to = excluded.active_to
  where public.exams.teacher_id = (select auth.uid());

  if not found then raise exception 'exam was not saved'; end if;
  delete from public.questions where exam_id = v_exam_id;
  delete from public.preloaded_students where exam_id = v_exam_id;

  insert into public.questions (id, exam_id, type, text, image_url, options, correct_option_id, answer_guide, weight, timer_seconds, tags, "order")
  select (q ->> 'id')::uuid, v_exam_id, q ->> 'type', q ->> 'text', nullif(q ->> 'image_url', ''), q -> 'options', nullif(q ->> 'correct_option_id', ''), nullif(q ->> 'answer_guide', ''), coalesce((q ->> 'weight')::numeric, 1), nullif(q ->> 'timer_seconds', '')::integer, coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'), coalesce((q ->> 'order')::integer, 0)
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;

  insert into public.preloaded_students (exam_id, name, nis)
  select v_exam_id, s ->> 'name', coalesce(s ->> 'nis', '')
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s;
end;
$$;

create or replace function public.publish_exam(p_exam_id uuid)
returns table (id uuid, status text)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not authorized'; end if;
  if not exists (select 1 from public.exams e where e.id = p_exam_id and e.teacher_id = (select auth.uid())) then raise exception 'exam not found'; end if;
  if not exists (select 1 from public.questions q where q.exam_id = p_exam_id) then raise exception 'exam needs at least one question'; end if;
  update public.exams e set status = 'ACTIVE' where e.id = p_exam_id and e.teacher_id = (select auth.uid()) returning e.id, e.status into id, status;
  return next;
end;
$$;

revoke all on function public.save_exam_full(jsonb, jsonb, jsonb) from public;
revoke all on function public.publish_exam(uuid) from public;
grant execute on function public.save_exam_full(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.publish_exam(uuid) to authenticated;

create or replace function public.get_public_exam(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where code = upper(trim(p_code));
  if not found then return null; end if;

  return jsonb_build_object(
    'id', v_exam.id,
    'title', v_exam.title,
    'description', v_exam.description,
    'subject', v_exam.subject,
    'class_name', v_exam.class_name,
    'exam_type', v_exam.exam_type,
    'format', v_exam.format,
    'status', v_exam.status,
    'code', v_exam.code,
    'settings', v_exam.settings,
    'active_from', v_exam.active_from,
    'active_to', v_exam.active_to,
    'question_count', (select count(*) from public.questions q where q.exam_id = v_exam.id)
  );
end;
$$;

create or replace function public.validate_exam_student(p_code text, p_name text, p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
begin
  select * into v_exam from public.exams where code = upper(trim(p_code));
  if not found then return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND'); end if;
  if v_exam.status <> 'ACTIVE' then return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE'); end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED'); end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then return jsonb_build_object('allowed', false, 'reason', 'ENDED'); end if;

  if exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    and not exists (
      select 1 from public.preloaded_students ps
      where ps.exam_id = v_exam.id
        and (lower(regexp_replace(trim(ps.name), '\\s+', ' ', 'g')) = lower(regexp_replace(trim(p_name), '\\s+', ' ', 'g'))
          or (nullif(trim(p_identifier), '') is not null and ps.nis = trim(p_identifier)))
    ) then
    return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED');
  end if;

  select count(*) into v_attempt_count from public.submissions s where s.exam_id = v_exam.id and s.nis = trim(p_identifier) and s.is_complete and not s.is_returned;
  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_max_attempts > 0 and v_attempt_count >= v_max_attempts then return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS'); end if;

  return jsonb_build_object('allowed', true, 'attempt_count', v_attempt_count, 'next_attempt_number', v_attempt_count + 1);
end;
$$;

create or replace function public.get_student_exam(p_code text, p_name text, p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_access jsonb;
begin
  v_access := public.validate_exam_student(p_code, p_name, p_identifier);
  if coalesce((v_access ->> 'allowed')::boolean, false) is not true then return v_access; end if;
  select * into v_exam from public.exams where code = upper(trim(p_code));

  return jsonb_build_object(
    'allowed', true,
    'attempt_count', v_access -> 'attempt_count',
    'next_attempt_number', v_access -> 'next_attempt_number',
    'exam', jsonb_build_object(
      'id', v_exam.id, 'teacher_id', v_exam.teacher_id, 'title', v_exam.title, 'description', v_exam.description,
      'subject', v_exam.subject, 'class_name', v_exam.class_name, 'exam_type', v_exam.exam_type, 'format', v_exam.format,
      'status', v_exam.status, 'code', v_exam.code, 'settings', v_exam.settings, 'active_from', v_exam.active_from,
      'active_to', v_exam.active_to, 'created_at', v_exam.created_at, 'updated_at', v_exam.updated_at,
      'preloaded_students', '[]'::jsonb,
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id, 'type', q.type, 'text', q.text, 'image_url', q.image_url, 'options', q.options,
          'weight', q.weight, 'timer_seconds', q.timer_seconds, 'tags', q.tags, 'order', q."order"
        ) order by q."order")
        from public.questions q where q.exam_id = v_exam.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_public_exam(text) from public;
revoke all on function public.validate_exam_student(text, text, text) from public;
revoke all on function public.get_student_exam(text, text, text) from public;
grant execute on function public.get_public_exam(text) to anon, authenticated;
grant execute on function public.validate_exam_student(text, text, text) to anon, authenticated;
grant execute on function public.get_student_exam(text, text, text) to anon, authenticated;
