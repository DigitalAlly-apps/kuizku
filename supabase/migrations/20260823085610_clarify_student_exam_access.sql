-- Make the intended access model explicit at the database boundary:
-- no preloaded rows means public access; one or more rows means restricted.
create or replace function public.validate_exam_student(p_code text, p_name text, p_identifier text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_attempt_count integer;
  v_max_attempts integer;
  v_name text := trim(coalesce(p_name, ''));
  v_identifier text := coalesce(nullif(trim(coalesce(p_identifier, '')), ''), trim(coalesce(p_name, '')));
  v_restricted boolean;
begin
  select * into v_exam from public.exams where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND'); end if;
  if v_exam.status <> 'ACTIVE' then return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE'); end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED'); end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then return jsonb_build_object('allowed', false, 'reason', 'ENDED'); end if;
  if v_name = '' then return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED'); end if;

  select exists(select 1 from public.preloaded_students ps where ps.exam_id = v_exam.id)
    into v_restricted;

  if v_restricted and not exists (
    select 1
    from public.preloaded_students ps
    where ps.exam_id = v_exam.id
      and (
        lower(regexp_replace(trim(ps.name), '\s+', ' ', 'g')) = lower(regexp_replace(v_name, '\s+', ' ', 'g'))
        or (v_identifier <> '' and trim(ps.nis) = v_identifier)
      )
  ) then
    return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED');
  end if;

  select count(*) into v_attempt_count
  from public.submissions s
  where s.exam_id = v_exam.id
    and trim(s.nis) = v_identifier
    and s.is_complete
    and not s.is_returned;

  v_max_attempts := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_max_attempts > 0 and v_attempt_count >= v_max_attempts then
    return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS');
  end if;

  return jsonb_build_object(
    'allowed', true,
    'access_mode', case when v_restricted then 'LIST' else 'OPEN' end,
    'attempt_count', v_attempt_count,
    'next_attempt_number', v_attempt_count + 1
  );
end;
$$;

revoke all on function public.validate_exam_student(text, text, text) from public;
grant execute on function public.validate_exam_student(text, text, text) to anon, authenticated;
