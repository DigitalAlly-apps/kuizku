-- OPEN-exam participants have canonical UUIDs in preloaded_students too, but
-- are marked is_preloaded = false. Keep the existing override mechanism and
-- teacher-only authorization while allowing those identities to receive +1.
create or replace function public.grant_student_extra_attempt(p_exam_id uuid, p_student_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_participant_id uuid;
  v_exam public.exams%rowtype;
  v_completed integer;
  v_extra integer;
  v_base integer;
  v_extra_attempts integer;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  begin v_participant_id := nullif(trim(coalesce(p_student_identifier, '')), '')::uuid; exception when invalid_text_representation then raise exception using errcode = 'P0001', message = 'INVALID_IDENTIFIER'; end;
  select * into v_exam from public.exams where id = p_exam_id and teacher_id = (select auth.uid());
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  if not exists(select 1 from public.preloaded_students p where p.id = v_participant_id and p.exam_id = p_exam_id) then raise exception using errcode = 'P0001', message = 'NOT_REGISTERED'; end if;
  v_base := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_base = 0 then raise exception using errcode = 'P0001', message = 'UNLIMITED_ATTEMPTS'; end if;
  select count(*) into v_completed from public.submissions where exam_id = p_exam_id and participant_id = v_participant_id and is_complete and not is_returned;
  select coalesce(o.extra_attempts, 0) into v_extra from public.student_exam_overrides o where o.exam_id = p_exam_id and o.student_identifier = v_participant_id::text;
  if v_completed < v_base + v_extra then raise exception using errcode = 'P0001', message = 'ATTEMPTS_REMAINING'; end if;
  insert into public.student_exam_overrides (exam_id, student_identifier, extra_attempts) values (p_exam_id, v_participant_id::text, 1)
  on conflict (exam_id, student_identifier) do update set extra_attempts = public.student_exam_overrides.extra_attempts + 1, updated_at = now()
  returning extra_attempts into v_extra_attempts;
  return jsonb_build_object('success', true, 'extra_attempts', v_extra_attempts);
end;
$function$;

create or replace function public.get_teacher_attempt_overview(p_exam_id uuid)
returns table (participant_id uuid, extra_attempts integer)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;
  if not exists (select 1 from public.exams e where e.id = p_exam_id and e.teacher_id = (select auth.uid())) then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;
  return query
  select p.id, coalesce(o.extra_attempts, 0)
  from public.preloaded_students p
  left join public.student_exam_overrides o on o.exam_id = p.exam_id and o.student_identifier = p.id::text
  where p.exam_id = p_exam_id
  order by p.attendance_no nulls last, p.name;
end;
$function$;

revoke all on function public.grant_student_extra_attempt(uuid, text) from public;
revoke all on function public.get_teacher_attempt_overview(uuid) from public;
grant execute on function public.grant_student_extra_attempt(uuid, text) to authenticated;
grant execute on function public.get_teacher_attempt_overview(uuid) to authenticated;
notify pgrst, 'reload schema';
