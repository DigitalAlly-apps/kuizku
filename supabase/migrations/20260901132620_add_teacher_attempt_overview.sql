-- The override table stays private. This function exposes only the additional
-- attempt count, and only to the teacher who owns the requested exam.
create or replace function public.get_teacher_attempt_overview(p_exam_id uuid)
returns table (participant_id uuid, extra_attempts integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'UNAUTHORIZED';
  end if;

  if not exists (
    select 1
    from public.exams e
    where e.id = p_exam_id
      and e.teacher_id = (select auth.uid())
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  return query
  select p.id, coalesce(o.extra_attempts, 0)
  from public.preloaded_students p
  left join public.student_exam_overrides o
    on o.exam_id = p.exam_id
   and o.student_identifier = p.id::text
  where p.exam_id = p_exam_id
  order by p.attendance_no nulls last, p.name;
end;
$$;

revoke all on function public.get_teacher_attempt_overview(uuid) from public;
grant execute on function public.get_teacher_attempt_overview(uuid) to authenticated;

notify pgrst, 'reload schema';
