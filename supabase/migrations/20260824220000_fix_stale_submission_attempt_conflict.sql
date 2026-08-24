-- Recover safely when a student starts the same attempt again after the local
-- session was replaced/cleared while an incomplete autosave draft still exists.
--
-- The unique key (exam_id, nis, attempt_number) remains intact. We only remove
-- an older INCOMPLETE draft when a different submission id is about to claim
-- the same attempt. Completed submissions are never touched.

create or replace function public.replace_stale_submission_draft()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.submissions s
  where s.exam_id = new.exam_id
    and s.nis = new.nis
    and s.attempt_number = new.attempt_number
    and s.id <> new.id
    and not s.is_complete;

  return new;
end;
$$;

drop trigger if exists submissions_replace_stale_draft_before_insert on public.submissions;
create trigger submissions_replace_stale_draft_before_insert
before insert on public.submissions
for each row
execute function public.replace_stale_submission_draft();

revoke all on function public.replace_stale_submission_draft() from public;
