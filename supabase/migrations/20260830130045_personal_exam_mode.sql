-- Personal exam mode is deliberately opt-in. Provision one teacher with:
-- insert into public.personal_exam_feature_flags (teacher_id) values ('<teacher UUID>');

create table public.personal_exam_feature_flags (
  teacher_id uuid primary key references public.teachers(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.personal_exam_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table public.personal_exam_groups (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (teacher_id, name)
);

create table public.personal_exam_students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  group_id uuid not null references public.personal_exam_groups(id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  created_at timestamptz not null default now()
);
create index personal_exam_students_group_idx on public.personal_exam_students(group_id, name);

alter table public.personal_exam_feature_flags enable row level security;
alter table public.personal_exam_subjects enable row level security;
alter table public.personal_exam_groups enable row level security;
alter table public.personal_exam_students enable row level security;
revoke all on table public.personal_exam_feature_flags, public.personal_exam_subjects, public.personal_exam_groups, public.personal_exam_students from anon, authenticated;
grant select on public.personal_exam_feature_flags to authenticated;
grant select, insert, update, delete on public.personal_exam_subjects, public.personal_exam_groups, public.personal_exam_students to authenticated;

create policy personal_feature_owner_select on public.personal_exam_feature_flags for select to authenticated using (teacher_id = (select auth.uid()));
create policy personal_subject_select on public.personal_exam_subjects for select to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_subject_insert on public.personal_exam_subjects for insert to authenticated with check (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_subject_update on public.personal_exam_subjects for update to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled)) with check (teacher_id = (select auth.uid()));
create policy personal_subject_delete on public.personal_exam_subjects for delete to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_group_select on public.personal_exam_groups for select to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_group_insert on public.personal_exam_groups for insert to authenticated with check (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_group_update on public.personal_exam_groups for update to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled)) with check (teacher_id = (select auth.uid()));
create policy personal_group_delete on public.personal_exam_groups for delete to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_student_select on public.personal_exam_students for select to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));
create policy personal_student_insert on public.personal_exam_students for insert to authenticated with check (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled) and exists (select 1 from public.personal_exam_groups g where g.id = group_id and g.teacher_id = (select auth.uid())));
create policy personal_student_update on public.personal_exam_students for update to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled)) with check (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_groups g where g.id = group_id and g.teacher_id = (select auth.uid())));
create policy personal_student_delete on public.personal_exam_students for delete to authenticated using (teacher_id = (select auth.uid()) and exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled));

create or replace function public.enforce_personal_exam_mode()
returns trigger language plpgsql set search_path = '' as $$
begin
  if coalesce(new.settings ->> 'participantMode', 'MANUAL') = 'PERSONAL_ROSTER'
     and not exists (select 1 from public.personal_exam_feature_flags f where f.teacher_id = (select auth.uid()) and f.enabled) then
    raise exception 'personal exam mode is not enabled for this teacher';
  end if;
  return new;
end;
$$;
create trigger exams_enforce_personal_mode before insert or update of settings on public.exams for each row execute function public.enforce_personal_exam_mode();
revoke all on function public.enforce_personal_exam_mode() from public;

create or replace function public.get_public_exam(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where code = upper(trim(p_code));
  if not found then return null; end if;
  return jsonb_build_object('id', v_exam.id, 'title', v_exam.title, 'description', v_exam.description, 'subject', v_exam.subject, 'class_name', v_exam.class_name, 'exam_type', v_exam.exam_type, 'format', v_exam.format, 'status', v_exam.status, 'code', v_exam.code, 'settings', v_exam.settings, 'active_from', v_exam.active_from, 'active_to', v_exam.active_to, 'question_count', (select count(*) from public.questions q where q.exam_id = v_exam.id), 'preloaded_students', case when v_exam.settings ->> 'participantMode' = 'PERSONAL_ROSTER' then coalesce((select jsonb_agg(jsonb_build_object('name', ps.name, 'nis', ps.nis) order by ps.name) from public.preloaded_students ps where ps.exam_id = v_exam.id), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;
