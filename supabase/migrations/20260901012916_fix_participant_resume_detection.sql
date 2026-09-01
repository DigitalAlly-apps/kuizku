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
  v_max := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_draft.id is not null then return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'next_attempt_number', v_draft.attempt_number, 'resume_submission_id', v_draft.id, 'resume_started_at', v_draft.started_at, 'resume', true); end if;
  if v_max > 0 and v_completed >= v_max then return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS'); end if;
  select coalesce(max(attempt_number), 0) + 1 into v_next from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id;
  return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'next_attempt_number', v_next, 'resume', false);
end;
$function$;
