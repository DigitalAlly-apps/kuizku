create table public.question_collections (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  description text,
  subject text not null default '',
  class_name text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (teacher_id, name)
);

alter table public.bank_questions add column collection_id uuid references public.question_collections(id) on delete cascade;

insert into public.question_collections (teacher_id, name)
select distinct b.teacher_id, 'Belum Dikelompokkan'
from public.bank_questions b
where b.collection_id is null
on conflict (teacher_id, name) do nothing;

update public.bank_questions b
set collection_id = c.id
from public.question_collections c
where c.teacher_id = b.teacher_id
  and c.name = 'Belum Dikelompokkan'
  and b.collection_id is null;

alter table public.bank_questions alter column collection_id set not null;

create index question_collections_teacher_created_idx on public.question_collections (teacher_id, created_at desc);
create index bank_questions_collection_created_idx on public.bank_questions (collection_id, created_at desc);

create trigger question_collections_set_updated_at before update on public.question_collections
for each row execute function public.set_updated_at();

alter table public.question_collections enable row level security;
create policy question_collections_teacher on public.question_collections for all to authenticated
using ((select auth.uid()) = teacher_id)
with check ((select auth.uid()) = teacher_id);

-- Bank questions can only point to a collection owned by the same teacher.
drop policy if exists bank_questions_teacher on public.bank_questions;
create policy bank_questions_teacher on public.bank_questions for all to authenticated
using (
  (select auth.uid()) = teacher_id
  and exists (select 1 from public.question_collections c where c.id = collection_id and c.teacher_id = (select auth.uid()))
)
with check (
  (select auth.uid()) = teacher_id
  and exists (select 1 from public.question_collections c where c.id = collection_id and c.teacher_id = (select auth.uid()))
);
