-- Ranking murid hanya menampilkan peringkat dan nama. Skor tetap dipakai
-- secara internal untuk mengurutkan hasil, tetapi tidak pernah dikirim ke klien.
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
      b.student_name
    from best_per_student b
  )
  select jsonb_agg(
    jsonb_build_object(
      'rank', r.rank,
      'studentName', r.student_name,
      'isCurrent', r.nis = v_submission.nis
    ) order by r.rank, r.student_name
  ), count(*)::integer
  into v_ranking, v_total_participants
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
    'totalParticipants', coalesce(v_total_participants, 0)
  );
end;
$$;

revoke all on function public.get_student_exam_ranking(text, uuid, text) from public;
grant execute on function public.get_student_exam_ranking(text, uuid, text) to anon, authenticated;

-- Visitor ranking uses the same privacy boundary and must not create an attempt.
create or replace function public.get_student_exam_ranking_visitor(
  p_exam_code text,
  p_name text default '',
  p_identifier text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_name text := trim(coalesce(p_name, ''));
  v_identifier text := trim(coalesce(p_identifier, ''));
  v_current_key text;
  v_restricted boolean;
  v_has_essay boolean;
  v_has_pending_essay boolean;
  v_entries jsonb;
  v_current_rank integer;
  v_total_participants integer;
begin
  select * into v_exam
  from public.exams
  where code = upper(trim(coalesce(p_exam_code, '')));

  if not found or v_exam.status in ('DRAFT', 'ARCHIVED') then
    return jsonb_build_object('available', false, 'reason', 'NOT_FOUND');
  end if;

  select exists(select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
  into v_restricted;

  if v_restricted and v_name = '' and v_identifier = '' then
    return jsonb_build_object('available', false, 'reason', 'IDENTITY_REQUIRED');
  end if;

  if v_restricted and not exists (
    select 1
    from public.preloaded_students ps
    where ps.exam_id = v_exam.id
      and (
        (v_name <> '' and lower(regexp_replace(trim(ps.name), '\\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\\s+', ' ', 'g')))
        or (v_identifier <> '' and trim(ps.nis) = v_identifier)
      )
  ) then
    return jsonb_build_object('available', false, 'reason', 'STUDENT_NOT_REGISTERED');
  end if;

  if coalesce((v_exam.settings ->> 'showScoreAfterSubmit')::boolean, true) is not true then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;

  select exists(select 1 from public.questions q where q.exam_id = v_exam.id and q.type = 'ESSAY')
  into v_has_essay;

  if v_has_essay
    and coalesce((v_exam.settings ->> 'releaseResultsAfterGrading')::boolean, false)
    and v_exam.status <> 'ENDED' then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;

  select exists(
    select 1
    from public.submissions s
    where s.exam_id = v_exam.id
      and s.is_complete
      and not s.is_returned
      and s.total_score is null
  ) into v_has_pending_essay;

  if v_has_essay and v_has_pending_essay then
    return jsonb_build_object('available', false, 'reason', 'ESSAY_PENDING');
  end if;

  v_current_key := coalesce(nullif(v_identifier, ''), nullif(v_name, ''));

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
    select rank() over (order by b.score desc)::integer as rank, b.nis, b.student_name
    from best_per_student b
  )
  select
    jsonb_agg(jsonb_build_object(
      'rank', r.rank,
      'studentName', r.student_name,
      'isCurrent', v_current_key is not null and r.nis = v_current_key
    ) order by r.rank, r.student_name),
    count(*)::integer,
    max(r.rank) filter (where v_current_key is not null and r.nis = v_current_key)
  into v_entries, v_total_participants, v_current_rank
  from ranked r;

  return jsonb_build_object(
    'available', true,
    'entries', coalesce(v_entries, '[]'::jsonb),
    'currentRank', v_current_rank,
    'totalParticipants', coalesce(v_total_participants, 0)
  );
end;
$$;

revoke all on function public.get_student_exam_ranking_visitor(text, text, text) from public;
grant execute on function public.get_student_exam_ranking_visitor(text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
