-- Phase 4: automatically graded short-answer questions.
alter table public.questions add column if not exists accepted_answers jsonb not null default '[]'::jsonb;
alter table public.bank_questions add column if not exists accepted_answers jsonb not null default '[]'::jsonb;
alter table public.student_answers add column if not exists short_answer text;

alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions drop constraint if exists questions_check;
alter table public.questions drop constraint if exists questions_structure_check;
alter table public.questions add constraint questions_type_check check (type in ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY'));
alter table public.questions add constraint questions_structure_check check (
  (type = 'MULTIPLE_CHOICE' and options is not null and correct_option_id is not null and jsonb_array_length(accepted_answers) = 0)
  or (type = 'SHORT_ANSWER' and options is null and correct_option_id is null and jsonb_typeof(accepted_answers) = 'array' and jsonb_array_length(accepted_answers) > 0)
  or (type = 'ESSAY' and options is null and correct_option_id is null and jsonb_array_length(accepted_answers) = 0)
);

alter table public.bank_questions drop constraint if exists bank_questions_type_check;
alter table public.bank_questions drop constraint if exists bank_questions_check;
alter table public.bank_questions add constraint bank_questions_type_check check (type in ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY'));
alter table public.bank_questions add constraint bank_questions_structure_check check (
  (type = 'MULTIPLE_CHOICE' and options is not null and correct_option_id is not null and jsonb_array_length(accepted_answers) = 0)
  or (type = 'SHORT_ANSWER' and options is null and correct_option_id is null and jsonb_typeof(accepted_answers) = 'array' and jsonb_array_length(accepted_answers) > 0)
  or (type = 'ESSAY' and options is null and correct_option_id is null and jsonb_array_length(accepted_answers) = 0)
);

alter table public.student_answers drop constraint if exists student_answers_question_type_check;
alter table public.student_answers drop constraint if exists student_answers_check;
alter table public.student_answers add constraint student_answers_question_type_check check (question_type in ('MULTIPLE_CHOICE', 'SHORT_ANSWER', 'ESSAY'));
alter table public.student_answers add constraint student_answers_check check (
  (question_type = 'MULTIPLE_CHOICE' and essay_text is null and short_answer is null)
  or (question_type = 'SHORT_ANSWER' and selected_option_id is null and essay_text is null)
  or (question_type = 'ESSAY' and selected_option_id is null and short_answer is null)
);

create or replace function public.save_exam_full(p_exam jsonb, p_questions jsonb, p_students jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exam_id uuid := (p_exam ->> 'id')::uuid;
begin
  if (select auth.uid()) is null or (p_exam ->> 'teacher_id')::uuid <> (select auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.exams (id, teacher_id, title, description, subject, class_name, exam_type, format, status, code, settings, active_from, active_to, updated_at)
  values (v_exam_id, (p_exam ->> 'teacher_id')::uuid, p_exam ->> 'title', nullif(p_exam ->> 'description', ''), coalesce(p_exam ->> 'subject', ''), nullif(p_exam ->> 'class_name', ''), coalesce(p_exam ->> 'exam_type', 'UJIAN'), p_exam ->> 'format', coalesce(p_exam ->> 'status', 'DRAFT'), p_exam ->> 'code', coalesce(p_exam -> 'settings', '{}'::jsonb), nullif(p_exam ->> 'active_from', '')::timestamptz, nullif(p_exam ->> 'active_to', '')::timestamptz, now())
  on conflict (id) do update set title = excluded.title, description = excluded.description, subject = excluded.subject, class_name = excluded.class_name, exam_type = excluded.exam_type, format = excluded.format, status = excluded.status, code = excluded.code, settings = excluded.settings, active_from = excluded.active_from, active_to = excluded.active_to
  where public.exams.teacher_id = (select auth.uid());
  if not found then raise exception 'exam was not saved'; end if;
  delete from public.questions where exam_id = v_exam_id;
  delete from public.preloaded_students where exam_id = v_exam_id;
  insert into public.questions (id, exam_id, type, text, image_url, options, correct_option_id, accepted_answers, answer_guide, weight, timer_seconds, tags, "order")
  select (q ->> 'id')::uuid, v_exam_id, q ->> 'type', q ->> 'text', nullif(q ->> 'image_url', ''), q -> 'options', nullif(q ->> 'correct_option_id', ''), coalesce(q -> 'accepted_answers', '[]'::jsonb), nullif(q ->> 'answer_guide', ''), coalesce((q ->> 'weight')::numeric, 1), nullif(q ->> 'timer_seconds', '')::integer, coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'), coalesce((q ->> 'order')::integer, 0)
  from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;
  insert into public.preloaded_students (exam_id, name, nis)
  select v_exam_id, s ->> 'name', coalesce(s ->> 'nis', '')
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s;
end;
$$;

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
  v_auto_score numeric(10,2);
  v_essay_count integer;
  v_total_score numeric(10,2);
  v_answer_count integer;
  v_distinct_question_count integer;
begin
  select * into v_exam from public.exams where id = (p_submission ->> 'exam_id')::uuid;
  if not found or v_exam.status <> 'ACTIVE' then raise exception 'exam is not active'; end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then raise exception 'exam has not started'; end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then raise exception 'exam has ended'; end if;
  if v_submission_id is null or v_attempt is null or v_attempt < 1 or v_name = '' or v_nis = '' then raise exception 'student identity is required'; end if;
  if exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    and not exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id and (lower(regexp_replace(trim(ps.name), '\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\s+', ' ', 'g')) or ps.nis = v_nis)) then raise exception 'student is not registered'; end if;
  select count(*), count(distinct (a.value ->> 'question_id')::uuid) into v_answer_count, v_distinct_question_count from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value);
  if v_answer_count <> v_distinct_question_count then raise exception 'duplicate answers are not allowed'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
    left join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id
    where q.id is null or a.value ->> 'question_type' is distinct from q.type
      or (q.type = 'MULTIPLE_CHOICE' and nullif(a.value ->> 'selected_option_id', '') is not null and not exists (select 1 from jsonb_array_elements(coalesce(q.options, '[]'::jsonb)) o where o ->> 'id' = a.value ->> 'selected_option_id'))
      or (q.type = 'MULTIPLE_CHOICE' and nullif(a.value ->> 'short_answer', '') is not null)
      or (q.type = 'SHORT_ANSWER' and (nullif(a.value ->> 'selected_option_id', '') is not null or nullif(a.value ->> 'essay_text', '') is not null))
      or (q.type = 'ESSAY' and (nullif(a.value ->> 'selected_option_id', '') is not null or nullif(a.value ->> 'short_answer', '') is not null))
  ) then raise exception 'invalid answer payload'; end if;
  select count(*) into v_completed from public.submissions s where s.exam_id = v_exam.id and s.nis = v_nis and s.is_complete and not s.is_returned and s.id <> v_submission_id;
  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_complete and v_max_attempts > 0 and v_completed >= v_max_attempts then raise exception 'maximum attempts reached'; end if;

  select coalesce(sum(q.weight) filter (where q.type = 'MULTIPLE_CHOICE' and a.value ->> 'selected_option_id' = q.correct_option_id), 0)
       + coalesce(sum(q.weight) filter (where q.type = 'SHORT_ANSWER' and nullif(a.value ->> 'short_answer', '') is not null and exists (select 1 from jsonb_array_elements_text(q.accepted_answers) accepted where lower(regexp_replace(trim(accepted), '\s+', ' ', 'g')) = lower(regexp_replace(trim(a.value ->> 'short_answer'), '\s+', ' ', 'g')))), 0),
         count(*) filter (where q.type = 'ESSAY')
    into v_auto_score, v_essay_count
  from public.questions q left join lateral jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) on (a.value ->> 'question_id')::uuid = q.id
  where q.exam_id = v_exam.id;
  v_total_score := case when v_complete and v_essay_count = 0 then v_auto_score else null end;
  insert into public.submissions (id, exam_id, student_name, nis, attempt_number, mc_score, total_score, started_at, submitted_at, is_complete, anti_cheat_events)
  values (v_submission_id, v_exam.id, v_name, v_nis, v_attempt, v_auto_score, v_total_score, (p_submission ->> 'started_at')::timestamptz, case when v_complete then now() else null end, v_complete, coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb))
  on conflict (id) do update set mc_score = excluded.mc_score, total_score = case when v_essay_count = 0 then excluded.total_score else public.submissions.total_score end, submitted_at = case when excluded.is_complete then excluded.submitted_at else public.submissions.submitted_at end, is_complete = public.submissions.is_complete or excluded.is_complete, anti_cheat_events = excluded.anti_cheat_events
  where public.submissions.exam_id = v_exam.id and public.submissions.nis = v_nis;
  if not found then raise exception 'submission does not belong to this student'; end if;
  delete from public.student_answers where submission_id = v_submission_id;
  insert into public.student_answers (submission_id, question_id, question_type, selected_option_id, essay_text, short_answer, time_taken_seconds)
  select v_submission_id, q.id, q.type, nullif(a.value ->> 'selected_option_id', ''), nullif(a.value ->> 'essay_text', ''), nullif(a.value ->> 'short_answer', ''), nullif(a.value ->> 'time_taken_seconds', '')::integer
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id;
  select s.total_score into v_total_score from public.submissions s where s.id = v_submission_id;
  return jsonb_build_object('saved', true, 'mc_score', v_auto_score, 'total_score', v_total_score, 'is_complete', v_complete);
end;
$$;

create or replace function public.recompute_submission_scores(p_exam_id uuid default null)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare v_count integer;
begin
  if (select auth.uid()) is null then raise exception 'not authorized'; end if;
  if p_exam_id is not null and not exists (select 1 from public.exams e where e.id = p_exam_id and e.teacher_id = (select auth.uid())) then raise exception 'exam not found'; end if;
  with recalculated as (
    select s.id,
      (coalesce(sum(q.weight) filter (where q.type = 'MULTIPLE_CHOICE' and a.selected_option_id = q.correct_option_id), 0)
       + coalesce(sum(q.weight) filter (where q.type = 'SHORT_ANSWER' and a.short_answer is not null and exists (select 1 from jsonb_array_elements_text(q.accepted_answers) accepted where lower(regexp_replace(trim(accepted), '\s+', ' ', 'g')) = lower(regexp_replace(trim(a.short_answer), '\s+', ' ', 'g')))), 0))::numeric(10,2) as auto_score,
      count(*) filter (where q.type = 'ESSAY') as essay_count,
      count(*) filter (where q.type = 'ESSAY' and a.essay_score is not null) as graded_essay_count,
      coalesce(sum(a.essay_score) filter (where q.type = 'ESSAY' and a.essay_score is not null), 0)::numeric(10,2) as essay_total
    from public.submissions s join public.exams e on e.id = s.exam_id
    left join public.questions q on q.exam_id = s.exam_id
    left join public.student_answers a on a.submission_id = s.id and a.question_id = q.id
    where (p_exam_id is null or s.exam_id = p_exam_id) and e.teacher_id = (select auth.uid())
    group by s.id
  )
  update public.submissions s set mc_score = r.auto_score, total_score = case when not s.is_complete then null when r.essay_count = 0 then r.auto_score when r.graded_essay_count = r.essay_count then r.auto_score + r.essay_total else null end from recalculated r where s.id = r.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.save_exam_full(jsonb, jsonb, jsonb) from public;
revoke all on function public.save_student_submission(jsonb) from public;
grant execute on function public.save_exam_full(jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;
revoke all on function public.recompute_submission_scores(uuid) from public;
grant execute on function public.recompute_submission_scores(uuid) to authenticated;
