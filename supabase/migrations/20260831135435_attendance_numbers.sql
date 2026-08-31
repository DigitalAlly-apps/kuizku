-- Numbering is a presentation concern for existing exams, while the legacy
-- `nis` value remains untouched so active sessions and submitted work keep
-- their stable identity. New exams use the attendance number as that value.
alter table public.personal_exam_students
  add column if not exists sort_order integer;

with ordered as (
  select id, row_number() over (partition by group_id order by created_at, id)::integer as sort_order
  from public.personal_exam_students
)
update public.personal_exam_students students
set sort_order = ordered.sort_order
from ordered
where students.id = ordered.id and students.sort_order is null;

alter table public.personal_exam_students
  alter column sort_order set not null;

alter table public.preloaded_students
  add column if not exists attendance_no integer;

-- Saved-roster exams can recover their original Excel/paste order from the
-- source student's creation order. Other existing lists retain their saved
-- row order.
with personal_order as (
  select students.id::text as legacy_identifier,
    row_number() over (partition by students.group_id order by students.sort_order, students.created_at, students.id)::integer as attendance_no
  from public.personal_exam_students students
), roster_rows as (
  select roster.id, personal_order.attendance_no
  from public.preloaded_students roster
  join personal_order on personal_order.legacy_identifier = roster.nis
)
update public.preloaded_students roster
set attendance_no = roster_rows.attendance_no
from roster_rows
where roster.id = roster_rows.id and roster.attendance_no is null;

with ordered as (
  select id, row_number() over (partition by exam_id order by created_at, id)::integer as attendance_no
  from public.preloaded_students
  where attendance_no is null
)
update public.preloaded_students roster
set attendance_no = ordered.attendance_no
from ordered
where roster.id = ordered.id;

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

  insert into public.questions (id, exam_id, type, text, image_url, options, correct_option_id, accepted_answers, answer_guide, weight, timer_seconds, tags, "order")
  select (q ->> 'id')::uuid, v_exam_id, q ->> 'type', q ->> 'text', nullif(q ->> 'image_url', ''),
    case when q ->> 'type' = 'MULTIPLE_CHOICE' then coalesce(q -> 'options', '[]'::jsonb) else null end,
    case when q ->> 'type' = 'MULTIPLE_CHOICE' then nullif(q ->> 'correct_option_id', '') else null end,
    case when q ->> 'type' = 'SHORT_ANSWER' then coalesce(q -> 'accepted_answers', '[]'::jsonb) else '[]'::jsonb end,
    nullif(q ->> 'answer_guide', ''), coalesce((q ->> 'weight')::numeric, 1), nullif(q ->> 'timer_seconds', '')::integer,
    coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'), coalesce((q ->> 'order')::integer, 0)
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;

  insert into public.preloaded_students (exam_id, name, nis, attendance_no)
  select v_exam_id, s ->> 'name', coalesce(s ->> 'nis', ''), nullif(s ->> 'attendance_no', '')::integer
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s;
end;
$$;

create or replace function public.get_public_exam(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where code = upper(trim(p_code));
  if not found then return null; end if;
  return jsonb_build_object('id', v_exam.id, 'title', v_exam.title, 'description', v_exam.description, 'subject', v_exam.subject, 'class_name', v_exam.class_name, 'exam_type', v_exam.exam_type, 'format', v_exam.format, 'status', v_exam.status, 'code', v_exam.code, 'settings', v_exam.settings, 'active_from', v_exam.active_from, 'active_to', v_exam.active_to, 'question_count', (select count(*) from public.questions q where q.exam_id = v_exam.id), 'preloaded_students', case when v_exam.settings ->> 'participantMode' = 'PERSONAL_ROSTER' then coalesce((select jsonb_agg(jsonb_build_object('name', ps.name, 'nis', ps.nis, 'attendance_no', ps.attendance_no) order by ps.attendance_no, ps.name) from public.preloaded_students ps where ps.exam_id = v_exam.id), '[]'::jsonb) else '[]'::jsonb end);
end;
$$;
