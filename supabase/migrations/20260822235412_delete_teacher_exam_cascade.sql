-- Dependency tree audited from the current schema:
-- exams -> questions, submissions, preloaded_students (all ON DELETE CASCADE)
-- submissions -> student_answers (ON DELETE CASCADE)
-- student_answers -> questions (was RESTRICT; must cascade too)
-- student_history and bank_questions have no foreign key to an exam.

alter table public.student_answers
  drop constraint if exists student_answers_question_id_fkey;

alter table public.student_answers
  add constraint student_answers_question_id_fkey
  foreign key (question_id)
  references public.questions(id)
  on delete cascade;

create or replace function public.delete_teacher_exam(p_exam_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_deleted_exam_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not authorized';
  end if;

  delete from public.exams
  where id = p_exam_id
    and teacher_id = (select auth.uid())
  returning id into v_deleted_exam_id;

  if v_deleted_exam_id is null then
    return jsonb_build_object('success', false, 'reason', 'NOT_FOUND_OR_FORBIDDEN');
  end if;

  return jsonb_build_object('success', true, 'exam_id', v_deleted_exam_id);
end;
$$;

revoke all on function public.delete_teacher_exam(uuid) from public;
grant execute on function public.delete_teacher_exam(uuid) to authenticated;
