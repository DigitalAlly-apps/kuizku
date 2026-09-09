-- Allow granting custom number of extra attempts (p_count, default 1)
-- and allow teachers to grant attempts even if remaining attempts exist (preventative support)

create or replace function public.grant_student_extra_attempt(
  p_exam_id uuid,
  p_student_identifier text,
  p_count integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_participant_id uuid;
  v_exam public.exams%rowtype;
  v_base integer;
  v_count integer;
  v_extra_attempts integer;
begin
  if (select auth.uid()) is null then raise exception using errcode = '42501', message = 'UNAUTHORIZED'; end if;

  v_count := greatest(1, coalesce(p_count, 1));
  if v_count > 20 then
    raise exception using errcode = 'P0001', message = 'COUNT_TOO_LARGE';
  end if;

  begin
    v_participant_id := nullif(trim(coalesce(p_student_identifier, '')), '')::uuid;
  exception when invalid_text_representation then
    raise exception using errcode = 'P0001', message = 'INVALID_IDENTIFIER';
  end;

  select * into v_exam from public.exams where id = p_exam_id and teacher_id = (select auth.uid());
  if not found then raise exception using errcode = '42501', message = 'FORBIDDEN'; end if;

  if not exists(select 1 from public.preloaded_students p where p.id = v_participant_id and p.exam_id = p_exam_id) then
    raise exception using errcode = 'P0001', message = 'NOT_REGISTERED';
  end if;

  v_base := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_base = 0 then raise exception using errcode = 'P0001', message = 'UNLIMITED_ATTEMPTS'; end if;

  insert into public.student_exam_overrides (exam_id, student_identifier, extra_attempts)
  values (p_exam_id, v_participant_id::text, v_count)
  on conflict (exam_id, student_identifier) do update
  set extra_attempts = public.student_exam_overrides.extra_attempts + v_count, updated_at = now()
  returning extra_attempts into v_extra_attempts;

  return jsonb_build_object('success', true, 'extra_attempts', v_extra_attempts);
end;
$function$;

-- Preserve overloaded signature (p_exam_id, p_student_identifier) for backward compatibility
create or replace function public.grant_student_extra_attempt(p_exam_id uuid, p_student_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  return public.grant_student_extra_attempt(p_exam_id, p_student_identifier, 1);
end;
$function$;

revoke all on function public.grant_student_extra_attempt(uuid, text, integer) from public;
grant execute on function public.grant_student_extra_attempt(uuid, text, integer) to authenticated;
notify pgrst, 'reload schema';
