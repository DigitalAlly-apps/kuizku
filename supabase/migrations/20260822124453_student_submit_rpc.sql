create or replace function public.save_student_submission(p_submission jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_submission_id uuid := (p_submission ->> 'id')::uuid;
  v_nis text := trim(p_submission ->> 'nis');
  v_name text := trim(p_submission ->> 'student_name');
  v_attempt integer := (p_submission ->> 'attempt_number')::integer;
  v_complete boolean := coalesce((p_submission ->> 'is_complete')::boolean, false);
  v_max_attempts integer;
  v_completed integer;
  v_mc_score numeric(10,2);
begin
  select * into v_exam from public.exams where id = (p_submission ->> 'exam_id')::uuid;
  if not found or v_exam.status <> 'ACTIVE' then raise exception 'exam is not active'; end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then raise exception 'exam has not started'; end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then raise exception 'exam has ended'; end if;
  if v_name = '' or v_nis = '' then raise exception 'student identity is required'; end if;

  if exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    and not exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id and (lower(regexp_replace(trim(ps.name), '\\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\\s+', ' ', 'g')) or ps.nis = v_nis)) then
    raise exception 'student is not registered';
  end if;

  select count(*) into v_completed from public.submissions s where s.exam_id = v_exam.id and s.nis = v_nis and s.is_complete and not s.is_returned and s.id <> v_submission_id;
  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_complete and v_max_attempts > 0 and v_completed >= v_max_attempts then raise exception 'maximum attempts reached'; end if;

  select coalesce(sum(q.weight) filter (where a.value ->> 'selected_option_id' = q.correct_option_id), 0) into v_mc_score
  from public.questions q left join lateral jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) on (a.value ->> 'question_id')::uuid = q.id
  where q.exam_id = v_exam.id and q.type = 'MULTIPLE_CHOICE';

  insert into public.submissions (id, exam_id, student_name, nis, attempt_number, mc_score, total_score, started_at, submitted_at, is_complete, anti_cheat_events)
  values (v_submission_id, v_exam.id, v_name, v_nis, v_attempt, v_mc_score, case when v_complete then v_mc_score else null end, (p_submission ->> 'started_at')::timestamptz, case when v_complete then now() else null end, v_complete, coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb))
  on conflict (id) do update set mc_score = excluded.mc_score, total_score = excluded.total_score, submitted_at = excluded.submitted_at, is_complete = excluded.is_complete, anti_cheat_events = excluded.anti_cheat_events
  where public.submissions.exam_id = v_exam.id and public.submissions.nis = v_nis;
  if not found then raise exception 'submission does not belong to this student'; end if;

  delete from public.student_answers where submission_id = v_submission_id;
  insert into public.student_answers (submission_id, question_id, question_type, selected_option_id, essay_text, time_taken_seconds)
  select v_submission_id, (a.value ->> 'question_id')::uuid, a.value ->> 'question_type', nullif(a.value ->> 'selected_option_id', ''), nullif(a.value ->> 'essay_text', ''), nullif(a.value ->> 'time_taken_seconds', '')::integer
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a
  join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id;

  return jsonb_build_object('saved', true, 'mc_score', v_mc_score, 'is_complete', v_complete);
end;
$$;

revoke all on function public.save_student_submission(jsonb) from public;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;
