-- P0: server-confirmed student scoring and atomic teacher essay grading.
-- The browser never supplies an authoritative score or answer key.

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
  v_answer_count integer;
  v_distinct_question_count integer;
begin
  select * into v_exam from public.exams where id = (p_submission ->> 'exam_id')::uuid;
  if not found or v_exam.status <> 'ACTIVE' then raise exception 'exam is not active'; end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then raise exception 'exam has not started'; end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then raise exception 'exam has ended'; end if;
  if v_submission_id is null or v_attempt is null or v_attempt < 1 then raise exception 'invalid submission identity'; end if;
  if v_name = '' or v_nis = '' then raise exception 'student identity is required'; end if;

  if exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    and not exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id and (lower(regexp_replace(trim(ps.name), '\\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\\s+', ' ', 'g')) or ps.nis = v_nis)) then
    raise exception 'student is not registered';
  end if;

  select count(*), count(distinct (a.value ->> 'question_id')::uuid)
    into v_answer_count, v_distinct_question_count
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value);
  if v_answer_count <> v_distinct_question_count then raise exception 'duplicate answers are not allowed'; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
    left join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id
    where q.id is null
      or a.value ->> 'question_type' is distinct from q.type
      or (q.type = 'MULTIPLE_CHOICE' and nullif(a.value ->> 'selected_option_id', '') is not null and not exists (
        select 1 from jsonb_array_elements(coalesce(q.options, '[]'::jsonb)) option_value
        where option_value ->> 'id' = a.value ->> 'selected_option_id'
      ))
      or (q.type = 'ESSAY' and nullif(a.value ->> 'selected_option_id', '') is not null)
  ) then raise exception 'invalid answer payload'; end if;

  select count(*) into v_completed
  from public.submissions s
  where s.exam_id = v_exam.id and s.nis = v_nis and s.is_complete and not s.is_returned and s.id <> v_submission_id;
  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_complete and v_max_attempts > 0 and v_completed >= v_max_attempts then raise exception 'maximum attempts reached'; end if;

  select coalesce(sum(q.weight) filter (where a.value ->> 'selected_option_id' = q.correct_option_id), 0)
    into v_mc_score
  from public.questions q
  left join lateral jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
    on (a.value ->> 'question_id')::uuid = q.id
  where q.exam_id = v_exam.id and q.type = 'MULTIPLE_CHOICE';

  insert into public.submissions (id, exam_id, student_name, nis, attempt_number, mc_score, total_score, started_at, submitted_at, is_complete, anti_cheat_events)
  values (v_submission_id, v_exam.id, v_name, v_nis, v_attempt, v_mc_score, case when v_complete then v_mc_score else null end, (p_submission ->> 'started_at')::timestamptz, case when v_complete then now() else null end, v_complete, coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb))
  on conflict (id) do update set
    mc_score = excluded.mc_score,
    total_score = case when excluded.is_complete then excluded.mc_score else public.submissions.total_score end,
    submitted_at = case when excluded.is_complete then excluded.submitted_at else public.submissions.submitted_at end,
    is_complete = public.submissions.is_complete or excluded.is_complete,
    anti_cheat_events = excluded.anti_cheat_events
  where public.submissions.exam_id = v_exam.id and public.submissions.nis = v_nis;
  if not found then raise exception 'submission does not belong to this student'; end if;

  delete from public.student_answers where submission_id = v_submission_id;
  insert into public.student_answers (submission_id, question_id, question_type, selected_option_id, essay_text, time_taken_seconds)
  select v_submission_id, q.id, q.type, nullif(a.value ->> 'selected_option_id', ''), nullif(a.value ->> 'essay_text', ''), nullif(a.value ->> 'time_taken_seconds', '')::integer
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
  join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id;

  return jsonb_build_object('saved', true, 'mc_score', v_mc_score, 'total_score', case when v_complete then v_mc_score else null end, 'is_complete', v_complete);
end;
$$;

create or replace function public.save_submission_grading(
  p_submission_id uuid,
  p_grades jsonb,
  p_feedback text default null,
  p_update_feedback boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_submission public.submissions%rowtype;
  v_essay_count integer;
  v_graded_count integer;
  v_essay_total numeric(10,2);
begin
  if (select auth.uid()) is null then raise exception 'not authorized'; end if;
  select s.* into v_submission
  from public.submissions s join public.exams e on e.id = s.exam_id
  where s.id = p_submission_id and e.teacher_id = (select auth.uid());
  if not found then raise exception 'submission not found'; end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) grade(value)
    left join public.questions q on q.id = (grade.value ->> 'question_id')::uuid and q.exam_id = v_submission.exam_id and q.type = 'ESSAY'
    where q.id is null
      or coalesce((grade.value ->> 'score')::numeric, -1) < 0
      or coalesce((grade.value ->> 'score')::numeric, -1) > q.weight
  ) then raise exception 'invalid essay grade'; end if;

  insert into public.student_answers (submission_id, question_id, question_type, essay_score, essay_comment)
  select p_submission_id, q.id, 'ESSAY', (grade.value ->> 'score')::numeric, nullif(grade.value ->> 'comment', '')
  from jsonb_array_elements(coalesce(p_grades, '[]'::jsonb)) grade(value)
  join public.questions q on q.id = (grade.value ->> 'question_id')::uuid and q.exam_id = v_submission.exam_id and q.type = 'ESSAY'
  on conflict (submission_id, question_id) do update set
    essay_score = excluded.essay_score,
    essay_comment = excluded.essay_comment;

  select count(*) into v_essay_count from public.questions where exam_id = v_submission.exam_id and type = 'ESSAY';
  select count(*), coalesce(sum(a.essay_score), 0) into v_graded_count, v_essay_total
  from public.student_answers a join public.questions q on q.id = a.question_id
  where a.submission_id = p_submission_id and q.type = 'ESSAY' and a.essay_score is not null;

  update public.submissions
  set teacher_feedback = case when p_update_feedback then nullif(p_feedback, '') else teacher_feedback end,
      total_score = case when v_graded_count = v_essay_count then v_submission.mc_score + v_essay_total else null end
  where id = p_submission_id;

  return jsonb_build_object(
    'success', true,
    'essay_graded_count', v_graded_count,
    'essay_count', v_essay_count,
    'is_final', v_graded_count = v_essay_count,
    'total_score', case when v_graded_count = v_essay_count then v_submission.mc_score + v_essay_total else null end
  );
end;
$$;

revoke all on function public.save_student_submission(jsonb) from public;
revoke all on function public.save_submission_grading(uuid, jsonb, text, boolean) from public;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;
grant execute on function public.save_submission_grading(uuid, jsonb, text, boolean) to authenticated;
