-- Per-exam participant identity. `preloaded_students.id` is reused as the
-- stable participant UUID; no student account or global student identity is
-- created. Legacy NIS is retained for historical submissions.
alter table public.preloaded_students
  add column if not exists normalized_name text,
  add column if not exists is_preloaded boolean not null default true;

update public.preloaded_students
set normalized_name = lower(regexp_replace(trim(name), '\s+', ' ', 'g'))
where normalized_name is null;

alter table public.preloaded_students
  alter column normalized_name set not null;

-- Old roster uniqueness prohibited two students with the same name. The UUID
-- primary key is the identity now, so duplicate display names are permitted.
alter table public.preloaded_students
  drop constraint if exists preloaded_students_exam_id_name_nis_key;

create index if not exists preloaded_students_exam_name_idx
  on public.preloaded_students (exam_id, normalized_name);

alter table public.submissions
  add column if not exists participant_id uuid references public.preloaded_students(id) on delete restrict;

-- Backfill only unambiguous legacy links. Ambiguous historical names remain
-- readable via `nis` compatibility and are intentionally not guessed.
update public.submissions s
set participant_id = p.id
from public.preloaded_students p
where s.participant_id is null
  and p.exam_id = s.exam_id
  and trim(p.nis) <> ''
  and trim(p.nis) = trim(s.nis);

create index if not exists submissions_exam_participant_idx
  on public.submissions (exam_id, participant_id);

-- New writes are protected by the participant identity before retiring the
-- legacy uniqueness key. Existing NIS data remains intact.
create unique index if not exists submissions_exam_participant_attempt_unique
  on public.submissions (exam_id, participant_id, attempt_number)
  where participant_id is not null;

alter table public.submissions
  drop constraint if exists submissions_exam_id_nis_attempt_number_key;

-- Save roster rows without replacing their participant UUIDs. Existing rows
-- are retained when their id is supplied, and only removed when no submission
-- references them; this protects historical data and in-progress attempts.
create or replace function public.save_exam_full(p_exam jsonb, p_questions jsonb, p_students jsonb)
returns void language plpgsql security invoker set search_path = '' as $function$
declare v_exam_id uuid := (p_exam ->> 'id')::uuid;
begin
  if (select auth.uid()) is null or (p_exam ->> 'teacher_id')::uuid <> (select auth.uid()) then raise exception 'not authorized'; end if;
  insert into public.exams (id, teacher_id, title, description, subject, class_name, exam_type, format, status, code, settings, active_from, active_to, updated_at)
  values (v_exam_id, (p_exam ->> 'teacher_id')::uuid, p_exam ->> 'title', nullif(p_exam ->> 'description', ''), coalesce(p_exam ->> 'subject', ''), nullif(p_exam ->> 'class_name', ''), coalesce(p_exam ->> 'exam_type', 'UJIAN'), p_exam ->> 'format', coalesce(p_exam ->> 'status', 'DRAFT'), p_exam ->> 'code', coalesce(p_exam -> 'settings', '{}'::jsonb), nullif(p_exam ->> 'active_from', '')::timestamptz, nullif(p_exam ->> 'active_to', '')::timestamptz, now())
  on conflict (id) do update set title = excluded.title, description = excluded.description, subject = excluded.subject, class_name = excluded.class_name, exam_type = excluded.exam_type, format = excluded.format, status = excluded.status, code = excluded.code, settings = excluded.settings, active_from = excluded.active_from, active_to = excluded.active_to where public.exams.teacher_id = (select auth.uid());
  if not found then raise exception 'exam was not saved'; end if;
  delete from public.questions where exam_id = v_exam_id;
  insert into public.questions (id, exam_id, type, text, image_url, options, correct_option_id, accepted_answers, answer_guide, weight, timer_seconds, tags, "order")
  select (q ->> 'id')::uuid, v_exam_id, q ->> 'type', q ->> 'text', nullif(q ->> 'image_url', ''), case when q ->> 'type' = 'MULTIPLE_CHOICE' then coalesce(q -> 'options', '[]'::jsonb) else null end, case when q ->> 'type' = 'MULTIPLE_CHOICE' then nullif(q ->> 'correct_option_id', '') else null end, case when q ->> 'type' = 'SHORT_ANSWER' then coalesce(q -> 'accepted_answers', '[]'::jsonb) else '[]'::jsonb end, nullif(q ->> 'answer_guide', ''), coalesce((q ->> 'weight')::numeric, 1), nullif(q ->> 'timer_seconds', '')::integer, coalesce(array(select jsonb_array_elements_text(coalesce(q -> 'tags', '[]'::jsonb))), '{}'), coalesce((q ->> 'order')::integer, 0) from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) q;
  delete from public.preloaded_students p where p.exam_id = v_exam_id and p.is_preloaded and not exists (select 1 from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s where nullif(s ->> 'participant_id', '')::uuid = p.id) and not exists (select 1 from public.submissions x where x.participant_id = p.id);
  insert into public.preloaded_students (id, exam_id, name, normalized_name, nis, attendance_no, is_preloaded)
  select coalesce(nullif(s ->> 'participant_id', '')::uuid, gen_random_uuid()), v_exam_id, regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g'), lower(regexp_replace(trim(s ->> 'name'), '\s+', ' ', 'g')), coalesce(s ->> 'nis', ''), nullif(s ->> 'attendance_no', '')::integer, true from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) s
  on conflict (id) do update set name = excluded.name, normalized_name = excluded.normalized_name, attendance_no = excluded.attendance_no, is_preloaded = true where public.preloaded_students.exam_id = v_exam_id;
end;
$function$;


create or replace function public.get_student_exam_ranking(p_exam_code text, p_submission_id uuid, p_participant_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_submission public.submissions%rowtype; v_essay boolean; v_entries jsonb; v_rank integer; v_total integer;
begin
  select * into v_exam from public.exams where code = upper(trim(p_exam_code)); if not found then return jsonb_build_object('available', false, 'reason', 'NOT_FOUND'); end if;
  select * into v_submission from public.submissions where id = p_submission_id and exam_id = v_exam.id and participant_id = p_participant_id and is_complete and not is_returned; if not found then return jsonb_build_object('available', false, 'reason', 'INVALID_SUBMISSION'); end if;
  if coalesce((v_exam.settings ->> 'showScoreAfterSubmit')::boolean, true) is not true then return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED'); end if;
  select exists(select 1 from public.questions where exam_id = v_exam.id and type = 'ESSAY') into v_essay; if v_essay and v_submission.total_score is null then return jsonb_build_object('available', false, 'reason', 'ESSAY_PENDING'); end if;
  with best as (select participant_id, max(total_score) score, (array_agg(student_name order by total_score desc, submitted_at desc))[1] student_name from public.submissions where exam_id = v_exam.id and participant_id is not null and is_complete and not is_returned and total_score is not null group by participant_id), ranked as (select rank() over(order by score desc)::integer rank, * from best) select jsonb_agg(jsonb_build_object('rank', rank, 'studentName', student_name, 'isCurrent', participant_id = v_submission.participant_id) order by rank, student_name), count(*)::integer into v_entries, v_total from ranked;
  with best as (select participant_id, max(total_score) score from public.submissions where exam_id = v_exam.id and participant_id is not null and is_complete and not is_returned and total_score is not null group by participant_id), ranked as (select participant_id, rank() over(order by score desc)::integer rank from best) select rank into v_rank from ranked where participant_id = v_submission.participant_id;
  return jsonb_build_object('available', true, 'entries', coalesce(v_entries, '[]'::jsonb), 'currentRank', v_rank, 'totalParticipants', coalesce(v_total, 0));
end;
$function$;

create or replace function public.get_student_exam_ranking_visitor(p_exam_code text, p_name text default '', p_participant_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_participant public.preloaded_students%rowtype; v_submission uuid;
begin
  select * into v_exam from public.exams where code = upper(trim(coalesce(p_exam_code, ''))); if not found or v_exam.status in ('DRAFT', 'ARCHIVED') then return jsonb_build_object('available', false, 'reason', 'NOT_FOUND'); end if;
  if p_participant_id is not null then select * into v_participant from public.preloaded_students where id = p_participant_id and exam_id = v_exam.id; elsif trim(coalesce(p_name,'')) <> '' then select * into v_participant from public.preloaded_students where exam_id = v_exam.id and normalized_name = lower(regexp_replace(trim(p_name), '\s+', ' ', 'g')) order by is_preloaded desc, attendance_no nulls last limit 1; end if;
  if not found then return jsonb_build_object('available', false, 'reason', case when exists(select 1 from public.preloaded_students where exam_id = v_exam.id and is_preloaded) then 'IDENTITY_REQUIRED' else 'NOT_RELEASED' end); end if;
  select id into v_submission from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and is_complete and not is_returned order by total_score desc nulls last, submitted_at desc limit 1; if not found then return jsonb_build_object('available', false, 'reason', 'NOT_RELEASED'); end if;
  return public.get_student_exam_ranking(v_exam.code, v_submission, v_participant.id);
end;
$function$;

-- Resolve a participant in the server. Open participants are created once and
-- subsequently revalidated by their browser-held UUID; the browser is never
-- trusted for attempt counts, scores, or final state.
create or replace function public.resolve_exam_participant(p_exam_id uuid, p_name text, p_participant_id uuid default null)
returns public.preloaded_students language plpgsql security definer set search_path = '' as $function$
declare v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'); v_normalized text := lower(v_name); v_participant public.preloaded_students%rowtype; v_restricted boolean;
begin
  if v_name = '' then raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED'; end if;
  select exists(select 1 from public.preloaded_students where exam_id = p_exam_id and is_preloaded) into v_restricted;
  if p_participant_id is not null then
    select * into v_participant from public.preloaded_students where id = p_participant_id and exam_id = p_exam_id;
    if found and v_participant.normalized_name = v_normalized then return v_participant; end if;
    raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED';
  end if;
  if v_restricted then
    select * into v_participant from public.preloaded_students where exam_id = p_exam_id and is_preloaded and normalized_name = v_normalized order by attendance_no nulls last, created_at limit 1;
    if not found then raise exception using errcode = 'P0001', message = 'STUDENT_NOT_REGISTERED'; end if;
    return v_participant;
  end if;
  insert into public.preloaded_students (exam_id, name, normalized_name, nis, is_preloaded) values (p_exam_id, v_name, v_normalized, '', false) returning * into v_participant;
  return v_participant;
end;
$function$;

create or replace function public.validate_exam_student(p_code text, p_name text, p_participant_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_participant public.preloaded_students%rowtype; v_draft public.submissions%rowtype; v_completed integer; v_next integer; v_max integer;
begin
  select * into v_exam from public.exams where code = upper(trim(coalesce(p_code, '')));
  if not found then return jsonb_build_object('allowed', false, 'reason', 'NOT_FOUND'); end if;
  if v_exam.status <> 'ACTIVE' then return jsonb_build_object('allowed', false, 'reason', 'NOT_ACTIVE'); end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then return jsonb_build_object('allowed', false, 'reason', 'NOT_STARTED'); end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then return jsonb_build_object('allowed', false, 'reason', 'ENDED'); end if;
  begin select * into v_participant from public.resolve_exam_participant(v_exam.id, p_name, p_participant_id); exception when sqlstate 'P0001' then return jsonb_build_object('allowed', false, 'reason', 'STUDENT_NOT_REGISTERED'); end;
  select * into v_draft from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and not is_complete order by attempt_number desc, started_at desc limit 1;
  select count(*) into v_completed from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and is_complete and not is_returned;
  v_max := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1);
  if v_draft.id is not null then return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'next_attempt_number', v_draft.attempt_number, 'resume_submission_id', v_draft.id, 'resume_started_at', v_draft.started_at, 'resume', true); end if;
  if v_max > 0 and v_completed >= v_max then return jsonb_build_object('allowed', false, 'reason', 'MAX_ATTEMPTS'); end if;
  select coalesce(max(attempt_number), 0) + 1 into v_next from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id;
  return jsonb_build_object('allowed', true, 'participant_id', v_participant.id, 'attempt_count', v_completed, 'next_attempt_number', v_next, 'resume', false);
end;
$function$;

create or replace function public.get_student_exam(p_code text, p_name text, p_participant_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_access jsonb; v_resume uuid;
begin
  v_access := public.validate_exam_student(p_code, p_name, p_participant_id); if coalesce((v_access ->> 'allowed')::boolean, false) is not true then return v_access; end if;
  select * into v_exam from public.exams where code = upper(trim(p_code)); v_resume := nullif(v_access ->> 'resume_submission_id', '')::uuid;
  return jsonb_build_object('allowed', true, 'participant_id', v_access -> 'participant_id', 'attempt_count', v_access -> 'attempt_count', 'next_attempt_number', v_access -> 'next_attempt_number', 'resume', coalesce((v_access ->> 'resume')::boolean, false), 'resume_submission', case when v_resume is null then null else (select jsonb_build_object('id', s.id, 'attempt_number', s.attempt_number, 'started_at', s.started_at, 'answers', coalesce((select jsonb_agg(jsonb_build_object('question_id', a.question_id, 'question_type', a.question_type, 'selected_option_id', a.selected_option_id, 'essay_text', a.essay_text, 'short_answer', a.short_answer, 'time_taken_seconds', a.time_taken_seconds) order by a.created_at) from public.student_answers a where a.submission_id = s.id), '[]'::jsonb)) from public.submissions s where s.id = v_resume) end, 'exam', jsonb_build_object('id', v_exam.id, 'teacher_id', v_exam.teacher_id, 'title', v_exam.title, 'description', v_exam.description, 'subject', v_exam.subject, 'class_name', v_exam.class_name, 'exam_type', v_exam.exam_type, 'format', v_exam.format, 'status', v_exam.status, 'code', v_exam.code, 'settings', v_exam.settings, 'active_from', v_exam.active_from, 'active_to', v_exam.active_to, 'created_at', v_exam.created_at, 'updated_at', v_exam.updated_at, 'preloaded_students', '[]'::jsonb, 'questions', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'type', q.type, 'text', q.text, 'image_url', q.image_url, 'options', q.options, 'weight', q.weight, 'timer_seconds', q.timer_seconds, 'tags', q.tags, 'order', q."order") order by q."order") from public.questions q where q.exam_id = v_exam.id), '[]'::jsonb)));
end;
$function$;

create or replace function public.save_student_submission(p_submission jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype; v_participant public.preloaded_students%rowtype; v_requested uuid := nullif(p_submission ->> 'id', '')::uuid; v_id uuid; v_name text := regexp_replace(trim(coalesce(p_submission ->> 'student_name', '')), '\s+', ' ', 'g'); v_attempt integer := nullif(p_submission ->> 'attempt_number', '')::integer; v_complete boolean := coalesce((p_submission ->> 'is_complete')::boolean, false); v_existing public.submissions%rowtype; v_completed integer; v_expected integer; v_max integer; v_mc numeric(10,2); v_essays integer; v_total numeric(10,2); v_answers integer; v_distinct integer; v_started timestamptz;
begin
  select * into v_exam from public.exams where id = nullif(p_submission ->> 'exam_id', '')::uuid;
  if not found or v_exam.status <> 'ACTIVE' then raise exception using errcode = 'P0001', message = 'NOT_ACTIVE'; end if;
  if v_exam.active_from is not null and v_exam.active_from > now() then raise exception using errcode = 'P0001', message = 'NOT_STARTED'; end if;
  if v_exam.active_to is not null and v_exam.active_to < now() then raise exception using errcode = 'P0001', message = 'ENDED'; end if;
  if v_requested is null or v_attempt is null or v_attempt < 1 or v_name = '' or nullif(p_submission ->> 'participant_id', '') is null then raise exception using errcode = 'P0001', message = 'INVALID_IDENTITY'; end if;
  select * into v_participant from public.preloaded_students where id = (p_submission ->> 'participant_id')::uuid and exam_id = v_exam.id;
  if not found or v_participant.normalized_name <> lower(v_name) then raise exception using errcode = 'P0001', message = 'NOT_REGISTERED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_exam.id::text || '|' || v_participant.id::text, 0));
  select * into v_existing from public.submissions where id = v_requested for update;
  if found then
    if v_existing.exam_id <> v_exam.id or v_existing.participant_id <> v_participant.id then raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT'; end if;
    if v_existing.is_complete then if v_complete then return jsonb_build_object('saved', true, 'submission_id', v_existing.id, 'mc_score', v_existing.mc_score, 'total_score', v_existing.total_score, 'is_complete', true, 'already_complete', true); else raise exception using errcode = 'P0001', message = 'SUBMISSION_FINAL'; end if; end if;
    if v_existing.attempt_number <> v_attempt then raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT'; end if; v_id := v_existing.id; v_started := v_existing.started_at;
  else
    select * into v_existing from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and attempt_number = v_attempt for update;
    if found then if v_existing.is_complete then raise exception using errcode = 'P0001', message = 'SUBMISSION_FINAL'; end if; v_id := v_existing.id; v_started := v_existing.started_at;
    else
      select count(*) into v_completed from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id and is_complete and not is_returned; v_max := coalesce((v_exam.settings ->> 'maxAttempts')::integer, 1); if v_max > 0 and v_completed >= v_max then raise exception using errcode = 'P0001', message = 'MAX_ATTEMPTS'; end if;
      select coalesce(max(attempt_number), 0) + 1 into v_expected from public.submissions where exam_id = v_exam.id and participant_id = v_participant.id; if v_attempt <> v_expected then raise exception using errcode = 'P0001', message = 'SUBMISSION_CONFLICT'; end if; v_id := v_requested; v_started := coalesce(nullif(p_submission ->> 'started_at', '')::timestamptz, now());
    end if;
  end if;
  select count(*), count(distinct (a.value ->> 'question_id')::uuid) into v_answers, v_distinct from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value); if v_answers <> v_distinct then raise exception using errcode = 'P0001', message = 'INVALID_ANSWERS'; end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) left join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id where q.id is null or a.value ->> 'question_type' is distinct from q.type) then raise exception using errcode = 'P0001', message = 'INVALID_ANSWERS'; end if;
  select coalesce(sum(q.weight) filter (where q.type = 'MULTIPLE_CHOICE' and a.value ->> 'selected_option_id' = q.correct_option_id), 0) + coalesce(sum(q.weight) filter (where q.type = 'SHORT_ANSWER' and nullif(a.value ->> 'short_answer', '') is not null and exists (select 1 from jsonb_array_elements_text(q.accepted_answers) x where lower(regexp_replace(trim(x), '\s+', ' ', 'g')) = lower(regexp_replace(trim(a.value ->> 'short_answer'), '\s+', ' ', 'g')))), 0), count(*) filter (where q.type = 'ESSAY') into v_mc, v_essays from public.questions q left join lateral jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) on (a.value ->> 'question_id')::uuid = q.id where q.exam_id = v_exam.id;
  v_total := case when v_complete and v_essays = 0 then v_mc else null end;
  if exists(select 1 from public.submissions where id = v_id) then update public.submissions s set student_name = v_name, mc_score = v_mc, total_score = case when v_essays = 0 then v_total else s.total_score end, submitted_at = case when v_complete then coalesce(s.submitted_at, now()) else s.submitted_at end, is_complete = s.is_complete or v_complete, anti_cheat_events = coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb) where s.id = v_id and not s.is_complete;
  else insert into public.submissions (id, exam_id, student_name, nis, participant_id, attempt_number, mc_score, total_score, started_at, submitted_at, is_complete, anti_cheat_events) values (v_id, v_exam.id, v_name, '', v_participant.id, v_attempt, v_mc, v_total, v_started, case when v_complete then now() else null end, v_complete, coalesce(p_submission -> 'anti_cheat_events', '[]'::jsonb)); end if;
  delete from public.student_answers where submission_id = v_id;
  insert into public.student_answers (submission_id, question_id, question_type, selected_option_id, essay_text, short_answer, time_taken_seconds) select v_id, q.id, q.type, nullif(a.value ->> 'selected_option_id', ''), nullif(a.value ->> 'essay_text', ''), nullif(a.value ->> 'short_answer', ''), nullif(a.value ->> 'time_taken_seconds', '')::integer from jsonb_array_elements(coalesce(p_submission -> 'answers', '[]'::jsonb)) a(value) join public.questions q on q.id = (a.value ->> 'question_id')::uuid and q.exam_id = v_exam.id;
  select total_score into v_total from public.submissions where id = v_id; return jsonb_build_object('saved', true, 'submission_id', v_id, 'mc_score', v_mc, 'total_score', v_total, 'is_complete', v_complete, 'resumed_existing', v_id <> v_requested);
end;
$function$;

-- The public join payload contains only display data plus an opaque UUID used
-- by the client after a name is selected; it never displays the UUID or NIS.
create or replace function public.get_public_exam(p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_exam public.exams%rowtype;
begin
  select * into v_exam from public.exams where code = upper(trim(p_code)); if not found then return null; end if;
  return jsonb_build_object('id', v_exam.id, 'title', v_exam.title, 'description', v_exam.description, 'subject', v_exam.subject, 'class_name', v_exam.class_name, 'exam_type', v_exam.exam_type, 'format', v_exam.format, 'status', v_exam.status, 'code', v_exam.code, 'settings', v_exam.settings, 'active_from', v_exam.active_from, 'active_to', v_exam.active_to, 'question_count', (select count(*) from public.questions where exam_id = v_exam.id), 'preloaded_students', coalesce((select jsonb_agg(jsonb_build_object('participant_id', p.id, 'name', p.name, 'attendance_no', p.attendance_no) order by p.attendance_no nulls last, p.created_at) from public.preloaded_students p where p.exam_id = v_exam.id and p.is_preloaded), '[]'::jsonb));
end;
$function$;
