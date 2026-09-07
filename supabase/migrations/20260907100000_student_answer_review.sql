-- Provide answer review only after the student's own completed submission and
-- only when the teacher's configured release policy allows it. Question guides
-- are deliberately excluded: the portal exposes review, not pembahasan.
create or replace function public.get_student_answer_review(
  p_exam_code text,
  p_submission_id uuid,
  p_participant_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_exam public.exams%rowtype;
  v_release text;
  v_released boolean;
begin
  select * into v_exam
  from public.exams
  where code = upper(trim(coalesce(p_exam_code, '')));

  if not found then
    return jsonb_build_object('available', false, 'reason', 'NOT_FOUND');
  end if;

  if not exists (
    select 1
    from public.submissions s
    where s.id = p_submission_id
      and s.exam_id = v_exam.id
      and s.participant_id = p_participant_id
      and s.is_complete
      and not s.is_returned
  ) then
    return jsonb_build_object('available', false, 'reason', 'INVALID_SUBMISSION');
  end if;

  -- `showAnswerKeyAfterSubmit` is retained as a compatibility fallback for
  -- exams created before the release-mode setting was introduced.
  v_release := coalesce(
    v_exam.settings ->> 'answerKeyReleaseMode',
    case when coalesce((v_exam.settings ->> 'showAnswerKeyAfterSubmit')::boolean, false)
      then 'AFTER_EXAM_END' else 'NEVER' end
  );
  v_released := v_release = 'IMMEDIATE'
    or (v_release = 'AFTER_EXAM_END'
      and (v_exam.status = 'ENDED' or (v_exam.active_to is not null and v_exam.active_to <= now())));

  if not v_released then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;

  return jsonb_build_object(
    'available', true,
    'keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', q.id,
        'correct_option_id', case when q.type = 'MULTIPLE_CHOICE' then q.correct_option_id else null end,
        'accepted_answers', case when q.type = 'SHORT_ANSWER' then coalesce(q.accepted_answers, '[]'::jsonb) else '[]'::jsonb end
      ) order by q."order")
      from public.questions q
      where q.exam_id = v_exam.id
    ), '[]'::jsonb)
  );
end;
$function$;

revoke all on function public.get_student_answer_review(text, uuid, uuid) from public;
grant execute on function public.get_student_answer_review(text, uuid, uuid) to anon, authenticated;
