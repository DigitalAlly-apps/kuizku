-- Return structured, student-safe context so the client can explain access
-- outcomes without inferring meaning from a database error message.
create or replace function public.validate_exam_student(p_code text, p_name text, p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_attempt_count integer := 0;
  v_max_attempts integer;
  v_next_attempt integer;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_identifier text := coalesce(nullif(trim(coalesce(p_identifier, '')), ''), regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
  v_restricted boolean;
  v_draft public.submissions%rowtype;
  v_has_draft boolean := false;
  v_context jsonb;
begin
  select * into v_exam
  from public.exams
  where code = upper(trim(coalesce(p_code, '')));

  if not found then
    return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND');
  end if;

  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  v_context := jsonb_build_object(
    'exam_status', v_exam.status,
    'active_from', v_exam.active_from,
    'active_to', v_exam.active_to,
    'max_attempts', v_max_attempts
  );

  if v_exam.status <> 'ACTIVE' then
    return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE') || v_context;
  end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then
    return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED') || v_context;
  end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then
    return jsonb_build_object('allowed', false, 'reason', 'ENDED') || v_context;
  end if;
  if v_name = '' then
    return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED') || v_context;
  end if;

  select exists(select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
  into v_restricted;

  if v_restricted and not exists (
    select 1 from public.preloaded_students ps
    where ps.exam_id = v_exam.id
      and (
        lower(regexp_replace(trim(ps.name), '\s+', ' ', 'g')) = lower(v_name)
        or (v_identifier <> '' and trim(ps.nis) = v_identifier)
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED') || v_context;
  end if;

  select s.* into v_draft
  from public.submissions s
  where s.exam_id = v_exam.id and trim(s.nis) = v_identifier and not s.is_complete
  order by s.attempt_number desc, s.started_at desc
  limit 1;
  v_has_draft := found;

  select count(*) into v_attempt_count
  from public.submissions s
  where s.exam_id = v_exam.id
    and trim(s.nis) = v_identifier
    and s.is_complete
    and not s.is_returned;

  v_context := v_context || jsonb_build_object('attempt_count', v_attempt_count);

  if v_has_draft then
    return jsonb_build_object(
      'allowed', true,
      'access_mode', case when v_restricted then 'LIST' else 'OPEN' end,
      'next_attempt_number', v_draft.attempt_number,
      'resume_submission_id', v_draft.id,
      'resume_started_at', v_draft.started_at,
      'resume', true
    ) || v_context;
  end if;

  if v_max_attempts > 0 and v_attempt_count >= v_max_attempts then
    return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS') || v_context;
  end if;

  select coalesce(max(s.attempt_number), 0) + 1 into v_next_attempt
  from public.submissions s
  where s.exam_id = v_exam.id and trim(s.nis) = v_identifier;

  return jsonb_build_object(
    'allowed', true,
    'access_mode', case when v_restricted then 'LIST' else 'OPEN' end,
    'next_attempt_number', v_next_attempt,
    'resume', false
  ) || v_context;
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
    'max_attempts', v_access -> 'max_attempts',
    'active_from', v_access -> 'active_from',
    'active_to', v_access -> 'active_to',
    'exam_status', v_access -> 'exam_status',
    'next_attempt_number', v_access -> 'next_attempt_number',
    'resume', coalesce((v_access ->> 'resume')::boolean, false),
    'resume_submission', case when v_resume_id is null then null else (
      select jsonb_build_object(
        'id', s.id, 'attempt_number', s.attempt_number, 'started_at', s.started_at,
        'answers', coalesce((
          select jsonb_agg(jsonb_build_object(
            'question_id', a.question_id, 'question_type', a.question_type,
            'selected_option_id', a.selected_option_id, 'essay_text', a.essay_text,
            'short_answer', a.short_answer, 'time_taken_seconds', a.time_taken_seconds
          ) order by a.created_at)
          from public.student_answers a where a.submission_id = s.id
        ), '[]'::jsonb)
      ) from public.submissions s where s.id = v_resume_id
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
        ) order by q."order") from public.questions q where q.exam_id = v_exam.id
      ), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.validate_exam_student(text, text, text) from public;
revoke all on function public.get_student_exam(text, text, text) from public;
grant execute on function public.validate_exam_student(text, text, text) to anon, authenticated;
grant execute on function public.get_student_exam(text, text, text) to anon, authenticated;
