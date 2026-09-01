-- `participant_id` became the canonical student identity in the migration
-- immediately before this one. That migration recreated both public student
-- RPCs, but accidentally restored their old global-only maxAttempts checks.
--
-- Preserve the currently deployed functions and replace only that assignment:
-- this retains the submission-integrity and participant-resume behaviour while
-- making the teacher's per-student +1 override effective again at both entry
-- and first-save time.
do $$
declare
  v_validate text;
  v_save text;
  v_old text := 'v_max := coalesce((v_exam.settings ->> ''maxAttempts'')::integer, 1);';
  v_new text := 'v_max := public.get_effective_max_attempts(v_exam.id, v_participant.id::text, v_exam.settings);';
begin
  select pg_get_functiondef('public.validate_exam_student(text,text,uuid)'::regprocedure)
    into v_validate;
  if position(v_old in v_validate) = 0 then
    raise exception 'validate_exam_student does not contain the expected global attempt limit';
  end if;
  execute replace(v_validate, v_old, v_new);

  select pg_get_functiondef('public.save_student_submission(jsonb)'::regprocedure)
    into v_save;
  if position(v_old in v_save) = 0 then
    raise exception 'save_student_submission does not contain the expected global attempt limit';
  end if;
  execute replace(v_save, v_old, v_new);
end;
$$;

revoke all on function public.validate_exam_student(text, text, uuid) from public;
revoke all on function public.save_student_submission(jsonb) from public;
grant execute on function public.validate_exam_student(text, text, uuid) to anon, authenticated;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
