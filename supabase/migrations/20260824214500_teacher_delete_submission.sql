create or replace function public.delete_teacher_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission public.submissions%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'not authorized';
  end if;

  select s.* into v_submission
  from public.submissions s
  join public.exams e on e.id = s.exam_id
  where s.id = p_submission_id
    and e.teacher_id = (select auth.uid());

  if not found then
    raise exception 'submission not found or not owned by teacher';
  end if;

  -- Child rows such as student_answers and AI grading suggestions may reference
  -- the submission. Delete the known children explicitly so this RPC remains
  -- safe even when their foreign keys are not configured with ON DELETE CASCADE.
  delete from public.ai_grading_suggestions where submission_id = p_submission_id;
  delete from public.student_answers where submission_id = p_submission_id;
  delete from public.submissions where id = p_submission_id;

  return jsonb_build_object(
    'deleted', true,
    'exam_id', v_submission.exam_id,
    'nis', v_submission.nis,
    'attempt_number', v_submission.attempt_number
  );
end;
$$;

revoke all on function public.delete_teacher_submission(uuid) from public;
grant execute on function public.delete_teacher_submission(uuid) to authenticated;
