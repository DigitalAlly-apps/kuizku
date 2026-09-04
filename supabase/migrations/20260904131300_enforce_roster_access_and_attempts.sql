-- Explicitly preserve legacy behaviour when participantAccess is absent:
-- a legacy roster restricts access, while a legacy empty roster stays open.
create or replace function public.is_exam_participant_allowed(p_exam_id uuid, p_participant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy text;
  v_has_roster boolean;
  v_is_active_roster_member boolean;
begin
  select e.settings ->> 'participantAccess' into v_policy
  from public.exams e where e.id = p_exam_id;
  if not found then return false; end if;
  if v_policy = 'BLOCKED' then return false; end if;
  if v_policy = 'OPEN' then return true; end if;

  select exists(select 1 from public.preloaded_students p where p.exam_id = p_exam_id and p.is_preloaded)
    into v_has_roster;
  if v_policy = 'ROSTER_ONLY' or v_has_roster then
    select exists(select 1 from public.preloaded_students p where p.id = p_participant_id and p.exam_id = p_exam_id and p.is_preloaded)
      into v_is_active_roster_member;
    return v_is_active_roster_member;
  end if;
  return true;
end;
$$;

revoke all on function public.is_exam_participant_allowed(uuid, uuid) from public, anon, authenticated;

-- Keep historical participant rows, but remove omitted names from the active
-- roster so stale participant IDs cannot continue an exam after removal.
create or replace function public.save_exam_full(p_exam jsonb, p_questions jsonb, p_students jsonb)
returns void language plpgsql security invoker set search_path = '' as $function$
declare v_exam_id uuid := (p_exam ->> 'id')::uuid;
begin
  if (select auth.uid()) is null or (p_exam ->> 'teacher_id')::uuid <> (select auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.exams (id, teacher_id, title, description, subject, class_name, exam_type, format, status, code, settings, active_from, active_to, updated_at)
  values (v_exam_id, (p_exam ->> 'teacher_id')::uuid, p_exam ->> 'title', nullif(p_exam ->> 'description', ''), coalesce(p_exam ->> 'subject', ''), nullif(p_exam ->> 'class_name', ''), coalesce(p_exam ->> 'exam_type', 'UJIAN'), p_exam ->> 'format', coalesce(p_exam ->> 'status', 'DRAFT'), p_exam ->> 'code', coalesce(p_exam -> 'settings', '{}'::jsonb), nullif(p_exam ->> 'active_from', '')::timestamptz, nullif(p_exam ->> 'active_to', '')::timestamptz, now())
  on conflict (id) do update set title = excluded.title, description = excluded.description, subject = excluded.subject, class_name = excluded.class_name, exam_type = excluded.exam_type, format = excluded.format, status = excluded.status, code = excluded.code, settings = excluded.settings, active_from = excluded.active_from, active_to = excluded.active_to where public.exams.teacher_id = (select auth.uid());
  if not found then raise exception 'exam was not saved'; end if;
  delete from public.questions where exam_id = v_exam_id;
  insert into public.questions (id, exam_id, type, text, image_url, options, correct_option_id, accepted_answers, answer_guide, weight, timer_seconds, tags, "order")
  select (q ->> 'id')::uuid, v_exam_id, q ->> 'type', q ->> 'text', nullif(q ->> 'image_url', ''), case when q ->> 'type' = 'MULTIPLE_CHOICE' then coalesce(q -> 'options', '[]'::jsonb) else null end, case when q ->> 'type' = 'MULTIPLE_CHOICE' then nullif(q ->> 'correct_option_id', '') else null end, case when q ->> 'type' = 'SHORT_ANSWER' then coalesce(q -> 'accepted_answers', '[]'::jsonb) else '[]'::jsonb end, nullif(q ->> 'answer_guide', ''), coalesce((q ->> 'weight')::numeric, 1), nullif(q ->> 'timer_seconds', '')::integer, coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'), coalesce((q ->> 'order')::integer, 0) from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;
  update public.preloaded_students p set is_preloaded = false
  where p.exam_id = v_exam_id and p.is_preloaded and not exists (select 1 from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s where nullif(s ->> 'participant_id', '')::uuid = p.id);
  insert into public.preloaded_students (id, exam_id, name, normalized_name, nis, attendance_no, is_preloaded)
  select coalesce(nullif(s ->> 'participant_id', '')::uuid, gen_random_uuid()), v_exam_id, regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g'), lower(regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g')), coalesce(s ->> 'nis', ''), nullif(s ->> 'attendance_no', '')::integer, true from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s
  on conflict (id) do update set name = excluded.name, normalized_name = excluded.normalized_name, attendance_no = excluded.attendance_no, is_preloaded = true where public.preloaded_students.exam_id = v_exam_id;
end;
$function$;

create or replace function public.resolve_exam_participant(p_exam_id uuid, p_name text, p_participant_id uuid default null)
returns public.preloaded_students language plpgsql security definer set search_path = '' as $function$
declare v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); v_normalized text := lower(v_name); v_participant public.preloaded_students%rowtype; v_policy text; v_has_roster boolean;
begin
  if v_name = '' then raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED'; end if;
  select e.settings ->> 'participantAccess' into v_policy from public.exams e where e.id = p_exam_id;
  if not found or v_policy = 'BLOCKED' then raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED'; end if;
  select exists(select 1 from public.preloaded_students where exam_id = p_exam_id and is_preloaded) into v_has_roster;
  if p_participant_id is not null then
    select * into v_participant from public.preloaded_students where id = p_participant_id and exam_id = p_exam_id;
    if found and v_participant.normalized_name = v_normalized and public.is_exam_participant_allowed(p_exam_id, v_participant.id) then return v_participant; end if;
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED';
  end if;
  if v_policy = 'ROSTER_ONLY' or (v_policy is null and v_has_roster) then
    select * into v_participant from public.preloaded_students where exam_id = p_exam_id and is_preloaded and normalized_name = v_normalized order by attendance_no nulls last, created_at limit 1;
    if not found then raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED'; end if;
    return v_participant;
  end if;
  insert into public.preloaded_students (exam_id, name, normalized_name, nis, is_preloaded) values (p_exam_id, v_name, v_normalized, '', false) returning * into v_participant;
  return v_participant;
end;
$function$;

create or replace function public.validate_exam_student(p_code text, p_name text, p_participant_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_participant public.preloaded_students%rowtype; v_draft public.submissions%rowtype; v_completed integer; v_next integer; v_max integer;
begin
  select * into v_exam from public.exams where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND'); end if;
  if v_exam.status <> 'ACTIVE' then return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE'); end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED'); end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then return jsonb_build_object('allowed', false, 'reason', 'ENDED'); end if;
  begin select * into v_participant from public.resolve_exam_participant(v_exam.id, p_name, p_participant_id); exception when sqlstate 'P0001' then return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED'); end;
  select * into v_draft from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and not is_complete order by attempt_number desc, started_at desc limit 1;
  select count(*) into v_completed from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and is_complete and not is_returned;
  v_max := public.get_effective_max_attempts(v_exam.id, v_participant.id::text, v_exam.settings);
  if v_draft.id is not null then return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'max_attempts', v_max, 'next_attempt_number', v_draft.attempt_number, 'resume_submission_id', v_draft.id, 'resume_started_at', v_draft.started_at, 'resume', true); end if;
  if v_max > 0 and v_completed >= v_max then return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS'); end if;
  select coalesce(max(attempt_number), 0) + 1 into v_next from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id;
  return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'max_attempts', v_max, 'next_attempt_number', v_next, 'resume', false);
end;
$function$;

-- The submission RPC is intentionally patched from the deployed, audited
-- implementation so scoring and idempotency stay unchanged. Add the same
-- authoritative roster check used by the entry RPC before any draft/final save.
do $$
declare
  v_save text;
  v_marker text := 'if not found or v_participant.normalized_name <> lower(v_name) then raise exception using errcode = ''P0001'', message = ''NOT_REGISTERED''; end if;';
  v_guard text := 'if not public.is_exam_participant_allowed(v_exam.id, v_participant.id) then raise exception using errcode = ''P0001'', message = ''NOT_REGISTERED''; end if;';
begin
  select pg_get_functiondef('public.save_student_submission(jsonb)'::regprocedure) into v_save;
  if position(v_marker in v_save) = 0 then raise exception 'save_student_submission source does not contain the expected participant validation'; end if;
  if position(v_guard in v_save) = 0 then execute replace(v_save, v_marker, v_marker || ' ' || v_guard); end if;
end;
$$;

create or replace function public.grant_student_extra_attempt(p_exam_id uuid, p_student_identifier text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_participant_id uuid; v_exam public.exams%rowtype; v_completed integer; v_extra integer; v_base integer; v_extra_attempts integer;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  begin v_participant_id := nullif(trim(coalesce(p_student_identifier, '')), '')::uuid; exception when invalid_text_representation then raise exception using errcode = 'P0001', message = 'INVALID_IDENTIFIER'; end;
  select * into v_exam from public.exams where id = p_exam_id and teacher_id = (select auth.uid());
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if not exists(select 1 from public.preloaded_students p where p.id = v_participant_id and p.exam_id = p_exam_id and p.is_preloaded) then raise exception using errcode = 'P0001', message = 'NOT_REGISTERED'; end if;
  v_base := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_base = 0 then raise exception using errcode = 'P0001', message = 'UNLIMITED_ATTEMPTS'; end if;
  select count(*) into v_completed from public.submissions where exam_id = p_exam_id and participant_id = v_participant_id and is_complete and not is_returned;
  select coalesce(o.extra_attempts, 0) into v_extra from public.student_exam_overrides o where o.exam_id = p_exam_id and o.student_identifier = v_participant_id::text;
  if v_completed < v_base + v_extra then raise exception using errcode = 'P0001', message = 'ATTEMPTS_REMAINING'; end if;
  insert into public.student_exam_overrides (exam_id, student_identifier, extra_attempts) values (p_exam_id, v_participant_id::text, 1)
  on conflict (exam_id, student_identifier) do update set extra_attempts = public.student_exam_overrides.extra_attempts + 1, updated_at = now()
  returning extra_attempts into v_extra_attempts;
  return jsonb_build_object('success', true, 'extra_attempts', v_extra_attempts);
end;
$function$;

create or replace function public.get_teacher_attempt_overview(p_exam_id uuid)
returns table (participant_id uuid, extra_attempts integer)
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  if not exists (select 1 from public.exams e where e.id = p_exam_id and e.teacher_id = (select auth.uid())) then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  return query select p.id, coalesce(o.extra_attempts, 0) from public.preloaded_students p left join public.student_exam_overrides o on o.exam_id = p.exam_id and o.student_identifier = p.id::text where p.exam_id = p_exam_id and p.is_preloaded order by p.attendance_no nulls last, p.name;
end;
$$;

revoke all on function public.resolve_exam_participant(uuid, text, uuid) from public;
revoke all on function public.validate_exam_student(text, text, uuid) from public;
revoke all on function public.save_student_submission(jsonb) from public;
revoke all on function public.grant_student_extra_attempt(uuid, text) from public;
revoke all on function public.get_teacher_attempt_overview(uuid) from public;
grant execute on function public.validate_exam_student(text, text, uuid) to anon, authenticated;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;
grant execute on function public.grant_student_extra_attempt(uuid, text) to authenticated;
grant execute on function public.get_teacher_attempt_overview(uuid) to authenticated;
notify pgrst, 'reload schema';
