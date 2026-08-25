-- Per-peserta extension untuk kesempatan mengerjakan. Tidak mengubah
-- exams.settings.maxAttempts sehingga peserta lain tidak terpengaruh.
create table if not exists public.student_exam_overrides (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_identifier text not null check (length(trim(student_identifier)) > 0),
  extra_attempts integer not null default 0 check (extra_attempts >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_identifier)
);

alter table public.student_exam_overrides enable row level security;
revoke all on table public.student_exam_overrides from anon, authenticated;

create or replace function public.grant_student_extra_attempt(
  p_exam_id uuid,
  p_student_identifier text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_identifier text := trim(coalesce(p_student_identifier, ''));
  v_extra_attempts integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'UNAUTHORIZED';
  end if;
  if v_identifier = '' then
    raise exception using errcode = 'P0001', message = 'INVALID_IDENTIFIER';
  end if;
  if not exists (
    select 1 from public.exams e where e.id = p_exam_id and e.teacher_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'FORBIDDEN';
  end if;

  insert into public.student_exam_overrides (exam_id, student_identifier, extra_attempts)
  values (p_exam_id, v_identifier, 1)
  on conflict (exam_id, student_identifier) do update
  set extra_attempts = public.student_exam_overrides.extra_attempts + 1,
      updated_at = now()
  returning extra_attempts into v_extra_attempts;

  return jsonb_build_object('success', true, 'extra_attempts', v_extra_attempts);
end;
$$;

revoke all on function public.grant_student_extra_attempt(uuid, text) from public;
grant execute on function public.grant_student_extra_attempt(uuid, text) to authenticated;
