-- Keep the attempt calculation in one privileged helper so the public student
-- RPCs use identical limits at admission and final submission.
create or replace function public.get_effective_max_attempts(
  p_exam_id uuid,
  p_student_identifier text,
  p_settings jsonb
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base integer := coalesce((p_settings ->> 'maxAttempts')::integer, 1);
  v_extra integer := 0;
begin
  -- Zero means unlimited. Extra attempts must never turn this into a limit.
  if v_base = 0 then return 0; end if;
  select coalesce(o.extra_attempts, 0) into v_extra
  from public.student_exam_overrides o
  where o.exam_id = p_exam_id and o.student_identifier = trim(p_student_identifier);
  return greatest(0, v_base) + coalesce(v_extra, 0);
end;
$$;

-- The production versions contain substantial submission-integrity logic. We
-- preserve that exact logic and replace only its shared max-attempt assignment.
-- Fail closed if production no longer matches the audited implementation.
do $$
declare
  v_validate text;
  v_submit text;
  v_old text := 'v_max_attempts := coalesce((v_exam.settings ->> ''maxAttempts'')::integer, 1);';
begin
  select pg_get_functiondef('public.validate_exam_student(text,text,text)'::regprocedure) into v_validate;
  if position(v_old in v_validate) > 0 then
    v_validate := replace(v_validate, v_old, 'v_max_attempts := public.get_effective_max_attempts(v_exam.id, v_identifier, v_exam.settings);');
    execute v_validate;
  elsif position('public.get_effective_max_attempts(v_exam.id, v_identifier, v_exam.settings)' in v_validate) = 0 then
    raise exception 'validate_exam_student source does not match audited version; migration stopped safely';
  end if;

  select pg_get_functiondef('public.save_student_submission(jsonb)'::regprocedure) into v_submit;
  if position(v_old in v_submit) > 0 then
    v_submit := replace(v_submit, v_old, 'v_max_attempts := public.get_effective_max_attempts(v_exam.id, v_nis, v_exam.settings);');
    execute v_submit;
  elsif position('public.get_effective_max_attempts(v_exam.id, v_nis, v_exam.settings)' in v_submit) = 0 then
    raise exception 'save_student_submission source does not match audited version; migration stopped safely';
  end if;
end;
$$;

revoke all on function public.get_effective_max_attempts(uuid, text, jsonb) from public;
revoke all on function public.validate_exam_student(text, text, text) from public;
revoke all on function public.save_student_submission(jsonb) from public;
grant execute on function public.validate_exam_student(text, text, text) to anon, authenticated;
grant execute on function public.save_student_submission(jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
