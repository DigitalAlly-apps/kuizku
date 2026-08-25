-- Enforce new ranking and score-release settings in the RPC layer, not only UI.
-- Existing exams keep their old behaviour because an absent ranking flag defaults
-- to true here, while all newly created V2 exams save an explicit false value.
do $$
declare
  v_source text;
  v_marker text := 'if coalesce((v_exam.settings ->> ''showScoreAfterSubmit'')::boolean, true) is not true then';
  v_policy text := $policy$
  if coalesce((v_exam.settings ->> 'showRankingAfterSubmit')::boolean, true) is not true then
    return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
  end if;
  if v_exam.settings ? 'scoreReleaseMode' then
    if v_exam.settings ->> 'scoreReleaseMode' = 'NEVER' then
      return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
    end if;
    if v_exam.settings ->> 'scoreReleaseMode' = 'AFTER_EXAM_END'
      and v_exam.status <> 'ENDED'
      and (v_exam.active_to is null or v_exam.active_to > now()) then
      return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED');
    end if;
  end if;
$policy$;
begin
  select pg_get_functiondef('public.get_student_exam_ranking(text,uuid,text)'::regprocedure) into v_source;
  if position('showRankingAfterSubmit' in v_source) = 0 then
    if position(v_marker in v_source) = 0 then
      raise exception 'get_student_exam_ranking source does not match audited version; migration stopped safely';
    end if;
    execute replace(v_source, v_marker, v_policy || E'\n  ' || v_marker);
  end if;

  select pg_get_functiondef('public.get_student_exam_ranking_visitor(text,text,text)'::regprocedure) into v_source;
  if position('showRankingAfterSubmit' in v_source) = 0 then
    if position(v_marker in v_source) = 0 then
      raise exception 'get_student_exam_ranking_visitor source does not match audited version; migration stopped safely';
    end if;
    execute replace(v_source, v_marker, v_policy || E'\n  ' || v_marker);
  end if;
end;
$$;

revoke all on function public.get_student_exam_ranking(text, uuid, text) from public;
revoke all on function public.get_student_exam_ranking_visitor(text, text, text) from public;
grant execute on function public.get_student_exam_ranking(text, uuid, text) to anon, authenticated;
grant execute on function public.get_student_exam_ranking_visitor(text, text, text) to anon, authenticated;
notify pgrst, 'reload schema';
