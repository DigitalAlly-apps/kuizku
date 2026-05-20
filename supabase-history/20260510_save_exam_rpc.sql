-- ============================================================
-- RPC: save_exam_full
-- Menggantikan pola DELETE+INSERT non-atomik di storage.ts
-- Semua operasi (upsert exam, replace questions, replace students)
-- berjalan dalam satu transaksi — aman dari network drop.
-- ============================================================

create or replace function public.save_exam_full(
  p_exam      jsonb,
  p_questions jsonb,
  p_students  jsonb
)
returns void
language plpgsql
security definer
as $$
begin
  -- 1. Upsert exam row
  insert into public.exams (
    id, teacher_id, title, description, subject, class_name,
    exam_type, format, status, code, settings,
    active_from, active_to, updated_at
  )
  values (
    (p_exam->>'id')::uuid,
    (p_exam->>'teacher_id')::uuid,
    p_exam->>'title',
    p_exam->>'description',
    p_exam->>'subject',
    p_exam->>'class_name',
    p_exam->>'exam_type',
    p_exam->>'format',
    p_exam->>'status',
    p_exam->>'code',
    p_exam->'settings',
    nullif(p_exam->>'active_from', '')::timestamptz,
    nullif(p_exam->>'active_to', '')::timestamptz,
    (p_exam->>'updated_at')::timestamptz
  )
  on conflict (id) do update set
    title        = excluded.title,
    description  = excluded.description,
    subject      = excluded.subject,
    class_name   = excluded.class_name,
    exam_type    = excluded.exam_type,
    format       = excluded.format,
    status       = excluded.status,
    code         = excluded.code,
    settings     = excluded.settings,
    active_from  = excluded.active_from,
    active_to    = excluded.active_to,
    updated_at   = excluded.updated_at;

  -- 2. Replace questions atomically
  delete from public.questions where exam_id = (p_exam->>'id')::uuid;

  insert into public.questions (
    id, exam_id, type, text, image_url, options,
    correct_option_id, answer_guide, weight, timer_seconds, tags, "order"
  )
  select
    (q->>'id')::uuid,
    (p_exam->>'id')::uuid,
    q->>'type',
    q->>'text',
    q->>'image_url',
    q->'options',
    q->>'correct_option_id',
    q->>'answer_guide',
    (q->>'weight')::numeric,
    nullif(q->>'timer_seconds', '')::integer,
    -- Convert jsonb array → text[] (kolom tags di DB tipe text[])
    coalesce(
      (select array_agg(value::text) from jsonb_array_elements_text(coalesce(q->'tags', '[]'::jsonb))),
      array[]::text[]
    ),
    (q->>'order')::integer
  from jsonb_array_elements(p_questions) as q
  where jsonb_array_length(p_questions) > 0;

  -- 3. Replace preloaded_students atomically
  delete from public.preloaded_students where exam_id = (p_exam->>'id')::uuid;

  insert into public.preloaded_students (exam_id, name, nis)
  select
    (p_exam->>'id')::uuid,
    s->>'name',
    s->>'nis'
  from jsonb_array_elements(p_students) as s
  where jsonb_array_length(p_students) > 0;

end;
$$;
