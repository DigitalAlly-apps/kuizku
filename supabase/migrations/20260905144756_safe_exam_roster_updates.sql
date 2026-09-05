-- Settings and roster updates must not rewrite question rows: submitted answers
-- reference questions with ON DELETE RESTRICT.
create or replace function public.save_exam_settings_and_roster(p_exam jsonb, p_students jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_exam_id uuid := (p_exam ->> 'id')::uuid;
begin
  if (select auth.uid()) is null
    or (p_exam ->> 'teacher_id')::uuid <> (select auth.uid()) then
    raise exception 'not authorized';
  end if;

  update public.exams
  set title = p_exam ->> 'title',
      description = nullif(p_exam ->> 'description', ''),
      subject = coalesce(p_exam ->> 'subject', ''),
      class_name = nullif(p_exam ->> 'class_name', ''),
      exam_type = coalesce(p_exam ->> 'exam_type', 'UJIAN'),
      format = p_exam ->> 'format',
      status = coalesce(p_exam ->> 'status', 'DRAFT'),
      code = p_exam ->> 'code',
      settings = coalesce(p_exam -> 'settings', '{}'::jsonb),
      active_from = nullif(p_exam ->> 'active_from', '')::timestamptz,
      active_to = nullif(p_exam ->> 'active_to', '')::timestamptz,
      updated_at = now()
  where id = v_exam_id and teacher_id = (select auth.uid());
  if not found then raise exception 'exam was not saved'; end if;

  update public.preloaded_students p
  set is_preloaded = false
  where p.exam_id = v_exam_id and p.is_preloaded
    and not exists (
      select 1 from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s
      where nullif(s ->> 'participant_id', '')::uuid = p.id
    );

  insert into public.preloaded_students (id, exam_id, name, normalized_name, nis, attendance_no, is_preloaded)
  select coalesce(nullif(s ->> 'participant_id', '')::uuid, gen_random_uuid()),
         v_exam_id,
         regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g'),
         lower(regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g')),
         coalesce(s ->> 'nis', ''),
         nullif(s ->> 'attendance_no', '')::integer,
         true
  from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s
  on conflict (id) do update
    set name = excluded.name,
        normalized_name = excluded.normalized_name,
        attendance_no = excluded.attendance_no,
        is_preloaded = true
  where public.preloaded_students.exam_id = v_exam_id;
end;
$$;

revoke all on function public.save_exam_settings_and_roster(jsonb, jsonb) from public;
grant execute on function public.save_exam_settings_and_roster(jsonb, jsonb) to authenticated;
notify pgrst, 'reload schema';
