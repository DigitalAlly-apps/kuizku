-- Critical student attempt lifecycle fix.
-- Keep UNIQUE (exam_id, nis, attempt_number) intact.
-- Drafts are resumed, never deleted/replaced just to bypass the unique key.

-- Remove the earlier stale-draft replacement approach if it was ever installed.
drop trigger if exists submissions_replace_stale_draft_before_insert on public.submissions;
drop function if exists public.replace_stale_submission_draft();

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
  v_next_attempt integer;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_identifier text := coalesce(nullif(trim(coalesce(p_identifier, '')), ''), regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_restricted boolean;
  v_draft public.submissions%rowtype;
begin
  select * into v_exam
  from public.exams
  where code = upper(trim(coalesce(p_code, '')));

  if not found then return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND'); end if;
  if v_exam.status <> 'ACTIVE' then return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE'); end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED'); end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then return jsonb_build_object('allowed', false, 'reason', 'ENDED'); end if;
  if v_name = '' then return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED'); end if;

  select exists(select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
  into v_restricted;

  if v_restricted and not exists (
    select 1
    from public.preloaded_students ps
    where ps.exam_id = v_exam.id
      and (
        lower(regexp_replace(trim(ps.name), '\s+', ' ', 'g')) = lower(v_name)
        or (v_identifier <> '' and trim(ps.nis) = v_identifier)
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED');
  end if;

  -- Resume the existing unfinished attempt before calculating a new attempt.
  select s.* into v_draft
  from public.submissions s
  where s.exam_id = v_exam.id
    and trim(s.nis) = v_identifier
    and not s.is_complete
  order by s.attempt_number desc, s.started_at desc
  limit 1;

  select count(*) into v_attempt_count
  from public.submissions s
  where s.exam_id = v_exam.id
    and trim(s.nis) = v_identifier
    and s.is_complete
    and not s.is_returned;

  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);

  if found then
    return jsonb_build_object(
      'allowed', true,
      'access_mode', case when v_restricted then 'LIST' else 'OPEN' end,
      'attempt_count', v_attempt_count,
      'next_attempt_number', v_draft.attempt_number,
      'resume_submission_id', v_draft.id,
      'resume_started_at', v_draft.started_at,
      'resume', true
    );
  end if;

  if v_max_attempts > 0 and v_attempt_count >= v_max_attempts then
    return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS');
  end if;

  -- Numbering follows the highest historical attempt so returned rows or old data
  -- can never collide with the preserved unique key.
  select coalesce(max(s.attempt_number), 0) + 1 into v_next_attempt
  from public.submissions s
  where s.exam_id = v_exam.id and trim(s.nis) = v_identifier;

  return jsonb_build_object(
    'allowed', true,
    'access_mode', case when v_restricted then 'LIST' else 'OPEN' end,
    'attempt_count', v_attempt_count,
    'next_attempt_number', v_next_attempt,
    'resume', false
  );
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
  v_resume_id uuid;
begin
  v_access := public.validate_exam_student(p_code, p_name, p_identifier);
  if coalesce((v_access ->> 'allowed')::boolean, false) is not true then return v_access; end if;

  select * into v_exam from public.exams where code = upper(trim(p_code));
  v_resume_id := nullif(v_access ->> 'resume_submission_id', '')::uuid;

  return jsonb_build_object(
    'allowed', true,
    'attempt_count', v_access -> 'attempt_count',
    'next_attempt_number', v_access -> 'next_attempt_number',
    'resume', coalesce((v_access ->> 'resume')::boolean, false),
    'resume_submission', case when v_resume_id is null then null else (
      select jsonb_build_object(
        'id', s.id,
        'attempt_number', s.attempt_number,
        'started_at', s.started_at,
        'answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'question_id', a.question_id,
            'question_type', a.question_type,
            'selected_option_id', a.selected_option_id,
            'essay_text', a.essay_text,
            'short_answer', a.short_answer,
            'time_taken_seconds', a.time_taken_seconds
          ) order by a.created_at)
          from public.student_answers a where a.submission_id = s.id
        ), '[]'::jsonb)
      )
      from public.submissions s where s.id = v_resume_id
    ) end,
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

create or replace function public.save_student_submission(p_submission jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_requested_id uuid := nullif(p_submission ->> 'id', '')::uuid;
  v_submission_id uuid;
  v_nis text := trim(coalesce(p_submission ->> 'nis', ''));
  v_name text := regexp_replace(trim(coalesce(p_submission ->> 'student_name', '')), '\s+', ' ', 'g');
  v_attempt integer := nullif(p_submission ->> 'attempt_number', '')::integer;
  v_complete boolean := coalesce((p_submission ->> 'is_complete')::boolean, false);
  v_max_attempts integer;
  v_completed integer;
  v_expected_attempt integer;
  v_auto_score numeric(10,2);
  v_essay_count integer;
  v_total_score numeric(10,2);
  v_answer_count integer;
  v_distinct_question_count integer;
  v_existing public.submissions%rowtype;
  v_started_at timestamptz;
begin
  select * into v_exam from public.exams where id = nullif(p_submission ->> 'exam_id', '')::uuid;
  if not found or v_exam.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'NOT_ACTIVE'; end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then raise exception using errcode = 'P0001', message = 'NOT_STARTED'; end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then raise exception using errcode = 'P0001', message = 'ENDED'; end if;
  if v_requested_id is null or v_attempt is null or v_attempt < 1 or v_name = '' or v_nis = '' then
    raise exception using errcode = 'P0001', message = 'INVALID_IDENTITY';
  end if;

  if exists (select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    and not exists (
      select 1 from public.preloaded_students ps
      where ps.exam_id = v_exam.id
        and (lower(regexp_replace(trim(ps.name), '\s+', ' ', 'g')) = lower(v_name) or trim(ps.nis) = v_nis)
    ) then
    raise exception using errcode = 'P0001', message = 'NOT_REGISTERED';
  end if;

  -- Serialize lifecycle mutations for one exam + student identity. This protects
  -- against double-tap submit and near-simultaneous autosave/final requests.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_exam.id::text || '|' || v_nis, 0));

  -- Exact UUID wins. A completed UUID is immutable; retrying the same final
  -- request returns success without rewriting answers or creating an attempt.
  select s.* into v_existing from public.submissions s where s.id = v_requested_id for update;
  if found then
    if v_existing.exam_id <> v_exam.id or trim(v_existing.nis) <> v_nis then
      raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT';
    end if;
    if v_existing.is_complete then
      if v_complete then
        return jsonb_build_object(
          'saved', true,
          'submission_id', v_existing.id,
          'mc_score', v_existing.mc_score,
          'total_score', v_existing.total_score,
          'is_complete', true,
          'already_complete', true
        );
      end if;
      raise exception using errcode = 'P0001', message = 'SUBMISSION_FINAL';
    end if;
    if v_existing.attempt_number <> v_attempt then
      raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT';
    end if;
    v_submission_id := v_existing.id;
    v_started_at := v_existing.started_at;
  else
    -- If the client lost/replaced its local UUID, reuse the unfinished row for
    -- the same unique attempt instead of inserting or deleting anything.
    select s.* into v_existing
    from public.submissions s
    where s.exam_id = v_exam.id
      and trim(s.nis) = v_nis
      and s.attempt_number = v_attempt
    for update;

    if found then
      if v_existing.is_complete then
        raise exception using errcode = 'P0001', message = 'SUBMISSION_FINAL';
      end if;
      v_submission_id := v_existing.id;
      v_started_at := v_existing.started_at;
    else
      select count(*) into v_completed
      from public.submissions s
      where s.exam_id = v_exam.id and trim(s.nis) = v_nis and s.is_complete and not s.is_returned;

      v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
      if v_max_attempts > 0 and v_completed >= v_max_attempts then
        raise exception using errcode = 'P0001', message = 'MAX_ATTEMPTS';
      end if;

      select coalesce(max(s.attempt_number), 0) + 1 into v_expected_attempt
      from public.submissions s where s.exam_id = v_exam.id and trim(s.nis) = v_nis;
      if v_attempt <> v_expected_attempt then
        raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT';
      end if;

      v_submission_id := v_requested_id;
      v_started_at := coalesce(nullif(p_submission ->> 'started_at', '')::timestamptz, now());
    end if;
  end if;

  select count(*), count(distinct (a.value ->> 'question_id')::uuid)
  into v_answer_count, v_distinct_question_count
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value);
  if v_answer_count <> v_distinct_question_count then
    raise exception using errcode = 'P0001', message = 'INVALID_ANSWERS';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
    left join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id
    where q.id is null or a.value ->> 'question_type' is distinct from q.type
      or (q.type = 'MULTIPLE_CHOICE' and nullif(a.value ->> 'selected_option_id', '') is not null and not exists (
        select 1 from jsonb_array_elements(coalesce(q.options, '[]'::jsonb)) o where o ->> 'id' = a.value ->> 'selected_option_id'))
      or (q.type = 'MULTIPLE_CHOICE' and nullif(a.value ->> 'short_answer', '') is not null)
      or (q.type = 'SHORT_ANSWER' and (nullif(a.value ->> 'selected_option_id', '') is not null or nullif(a.value ->> 'essay_text', '') is not null))
      or (q.type = 'ESSAY' and (nullif(a.value ->> 'selected_option_id', '') is not null or nullif(a.value ->> 'short_answer', '') is not null))
  ) then
    raise exception using errcode = 'P0001', message = 'INVALID_ANSWERS';
  end if;

  select count(*) into v_completed
  from public.submissions s
  where s.exam_id = v_exam.id and trim(s.nis) = v_nis
    and s.is_complete and not s.is_returned and s.id <> v_submission_id;
  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_complete and v_max_attempts > 0 and v_completed >= v_max_attempts then
    raise exception using errcode = 'P0001', message = 'MAX_ATTEMPTS';
  end if;

  select
    coalesce(sum(q.weight) filter (
      where q.type = 'MULTIPLE_CHOICE' and a.value ->> 'selected_option_id' = q.correct_option_id
    ), 0)
    + coalesce(sum(q.weight) filter (
      where q.type = 'SHORT_ANSWER'
        and nullif(a.value ->> 'short_answer', '') is not null
        and exists (
          select 1 from jsonb_array_elements_text(q.accepted_answers) accepted
          where lower(regexp_replace(trim(accepted), '\s+', ' ', 'g')) = lower(regexp_replace(trim(a.value ->> 'short_answer'), '\s+', ' ', 'g'))
        )
    ), 0),
    count(*) filter (where q.type = 'ESSAY')
  into v_auto_score, v_essay_count
  from public.questions q
  left join lateral jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
    on (a.value ->> 'question_id')::uuid = q.id
  where q.exam_id = v_exam.id;

  v_total_score := case when v_complete and v_essay_count = 0 then v_auto_score else null end;

  if exists (select 1 from public.submissions s where s.id = v_submission_id) then
    update public.submissions s
    set student_name = v_name,
        mc_score = v_auto_score,
        total_score = case when v_essay_count = 0 then v_total_score else s.total_score end,
        submitted_at = case when v_complete then coalesce(s.submitted_at, now()) else s.submitted_at end,
        is_complete = s.is_complete or v_complete,
        anti_cheat_events = coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb)
    where s.id = v_submission_id and not s.is_complete;
  else
    insert into public.submissions (
      id, exam_id, student_name, nis, attempt_number, mc_score, total_score,
      started_at, submitted_at, is_complete, anti_cheat_events
    ) values (
      v_submission_id, v_exam.id, v_name, v_nis, v_attempt, v_auto_score, v_total_score,
      v_started_at, case when v_complete then now() else null end, v_complete,
      coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb)
    );
  end if;

  -- Answers and submission state commit atomically because this entire RPC call
  -- runs in one PostgreSQL transaction.
  delete from public.student_answers where submission_id = v_submission_id;
  insert into public.student_answers (
    submission_id, question_id, question_type, selected_option_id,
    essay_text, short_answer, time_taken_seconds
  )
  select
    v_submission_id, q.id, q.type,
    nullif(a.value ->> 'selected_option_id', ''),
    nullif(a.value ->> 'essay_text', ''),
    nullif(a.value ->> 'short_answer', ''),
    nullif(a.value ->> 'time_taken_seconds', '')::integer
  from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value)
  join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id;

  select s.total_score into v_total_score from public.submissions s where s.id = v_submission_id;

  return jsonb_build_object(
    'saved', true,
    'submission_id', v_submission_id,
    'mc_score', v_auto_score,
    'total_score', v_total_score,
    'is_complete', v_complete,
    'resumed_existing', v_submission_id <> v_requested_id
  );
end;
$$;

revoke all on function public.validate_exam_student(text, text, text) from public;
grant execute on function public.validate_exam_student(text, text, text) to anon, authenticated;
revoke all on function public.get_student_exam(text, text, text) from public;
grant execute on function public.get_student_exam(text, text, text) to anon, authenticated;
revoke all on function public.save_student_submission(jsonb) from public;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;
