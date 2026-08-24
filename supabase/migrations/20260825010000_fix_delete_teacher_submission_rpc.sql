-- Production repair for the teacher submission deletion RPC.
-- The parent deletion cascades to student_answers and ai_grading_suggestions:
-- both foreign keys are defined with ON DELETE CASCADE in the schema migrations.
-- Keeping the child cleanup in the foreign-key layer prevents orphan records and
-- keeps the whole operation atomic.
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
    raise exception using errcode = '42501', message = 'not authorized';
  end if;

  -- Lock the owned submission before deletion. The ownership check is made in
  -- the database; the UUID supplied by the browser is never trusted on its own.
  select s.* into v_submission
  from public.submissions s
  join public.exams e on e.id = s.exam_id
  where s.id = p_submission_id
    and e.teacher_id = (select auth.uid())
  for update of s;

  if not found then
    raise exception using errcode = 'P0002', message = 'submission not found or not owned by teacher';
  end if;

  delete from public.submissions
  where id = v_submission.id;

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

-- Ask PostgREST to refresh its RPC signature cache immediately.
notify pgrst, 'reload schema';
