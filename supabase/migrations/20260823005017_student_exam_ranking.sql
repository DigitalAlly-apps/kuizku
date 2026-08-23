-- Student-facing ranking. This function intentionally exposes only names and
-- final scores; answer keys, answers, and NIS values never leave the database.
create or replace function public.get_student_exam_ranking(
  p_exam_code text,
  p_submission_id uuid,
  p_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_submission public.submissions%rowtype;
  v_max_score numeric(10,2);
  v_has_essay boolean;
  v_ranking jsonb;
  v_current_rank integer;
  v_total_participants integer;
begin
  select * into v_exam
  from public.exams
  where code = upper(trim(p_exam_code));

  if not found then
    return jsonb_build_object('available', false, 'reason', 'NOT_FOUND');
  end if;

  select s.* into v_submission
  from public.submissions s
  where s.id = p_submission_id
    and s.exam_id = v_exam.id
    and s.nis = trim(p_identifier)
    and s.is_complete
    and not s.is_returned;

  if not found then
    return jsonb_build_object('available', false, 'reason', 'INVALID_SUBMISSION');
  end if;

  if coalesce((v_exam.settings ->> 'showScoreAfterSubmit')::boolean, true) is not true then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;

  select exists(select 1 from public.questions q where q.exam_id = v_exam.id and q.type = 'ESSAY') into v_has_essay;
  if v_has_essay and v_submission.total_score is null then
    return jsonb_build_object('available', false, 'reason', 'ESSAY_PENDING');
  end if;
  if v_has_essay
    and coalesce((v_exam.settings ->> 'releaseResultsAfterGrading')::boolean, false)
    and v_exam.status <> 'ENDED' then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;

  select coalesce(sum(q.weight), 0) into v_max_score
  from public.questions q where q.exam_id = v_exam.id;

  with best_per_student as (
    select
      s.nis,
      max(s.total_score) as score,
      (array_agg(s.student_name order by s.total_score desc, s.submitted_at desc))[1] as student_name
    from public.submissions s
    where s.exam_id = v_exam.id
      and s.is_complete
      and not s.is_returned
      and s.total_score is not null
    group by s.nis
  ), ranked as (
    select
      rank() over (order by b.score desc)::integer as rank,
      b.nis,
      b.student_name,
      b.score
    from best_per_student b
  )
  select jsonb_agg(
    jsonb_build_object(
      'rank', r.rank,
      'studentName', r.student_name,
      'score', r.score,
      'maxScore', v_max_score,
      'isCurrent', r.nis = v_submission.nis
    ) order by r.rank, r.student_name
  ), max(r.rank), count(*)::integer
  into v_ranking, v_current_rank, v_total_participants
  from ranked r;

  select r.rank into v_current_rank
  from (
    with best_per_student as (
      select s.nis, max(s.total_score) as score
      from public.submissions s
      where s.exam_id = v_exam.id and s.is_complete and not s.is_returned and s.total_score is not null
      group by s.nis
    )
    select rank() over (order by score desc)::integer as rank, nis from best_per_student
  ) r
  where r.nis = v_submission.nis;

  return jsonb_build_object(
    'available', true,
    'entries', coalesce(v_ranking, '[]'::jsonb),
    'currentRank', v_current_rank,
    'totalParticipants', coalesce(v_total_participants, 0),
    'maxScore', v_max_score
  );
end;
$$;

revoke all on function public.get_student_exam_ranking(text, uuid, text) from public;
grant execute on function public.get_student_exam_ranking(text, uuid, text) to anon, authenticated;
