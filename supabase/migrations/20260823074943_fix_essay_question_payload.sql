-- Normalize question JSON at the database boundary as well as in the client.
-- This keeps old cached/PWA bundles from violating questions_structure_check.
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
  select
    (q ->> 'id')::uuid,
    v_exam_id,
    q ->> 'type',
    q ->> 'text',
    nullif(q ->> 'image_url', ''),
    case when q ->> 'type' = 'MULTIPLE_CHOICE' then coalesce(q -> 'options', '[]'::jsonb) else null end,
    case when q ->> 'type' = 'MULTIPLE_CHOICE' then nullif(q ->> 'correct_option_id', '') else null end,
    case when q ->> 'type' = 'SHORT_ANSWER' then coalesce(q -> 'accepted_answers', '[]'::jsonb) else '[]'::jsonb end,
    nullif(q ->> 'answer_guide', ''),
    coalesce((q ->> 'weight')::numeric, 1),
    nullif(q ->> 'timer_seconds', '')::integer,
    coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'),
    coalesce((q ->> 'order')::integer, 0)
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;

  insert into public.preloaded_students (exam_id, name, nis)
  select v_exam_id, s ->> 'name', coalesce(s ->> 'nis', '')
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s;
end;
$$;

revoke all on function public.save_exam_full(jsonb, jsonb, jsonb) from public;
grant execute on function public.save_exam_full(jsonb, jsonb, jsonb) to authenticated;
