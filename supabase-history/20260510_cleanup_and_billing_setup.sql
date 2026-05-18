-- ============================================================
-- Cleanup database + setup billing untuk semua user existing
-- Tanggal: 2026-05-10
-- ============================================================

-- -----------------------------------------------------------------------------
-- 1. Drop tabel yang tidak dipakai
-- -----------------------------------------------------------------------------
drop table if exists public.workspace_members cascade;
drop table if exists public.usage_counters cascade;

-- -----------------------------------------------------------------------------
-- 2. Drop kolom clerk_id beserta semua RLS policies yang depend padanya
-- -----------------------------------------------------------------------------
alter table public.teachers drop column if exists clerk_id cascade;

-- Recreate RLS policies pakai auth.uid() (Supabase Auth native)
drop policy if exists "Teachers can read own profile" on public.teachers;
drop policy if exists "Teachers can update own profile" on public.teachers;
drop policy if exists "Teachers can insert own profile" on public.teachers;

create policy "Teachers can read own profile"
  on public.teachers for select
  to authenticated
  using (id = auth.uid());

create policy "Teachers can update own profile"
  on public.teachers for update
  to authenticated
  using (id = auth.uid());

create policy "Teachers can insert own profile"
  on public.teachers for insert
  to authenticated
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3. Tambah kolom teacher_email dan teacher_name ke subscriptions
--    Sync otomatis dari tabel teachers via trigger
-- -----------------------------------------------------------------------------
alter table public.subscriptions
  add column if not exists teacher_email text,
  add column if not exists teacher_name  text;

-- Trigger function: sync email+name dari teachers ke subscriptions
create or replace function public.sync_teacher_to_subscription()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Dipanggil saat INSERT/UPDATE di subscriptions
  -- Cari teacher lewat workspaces.owner_id
  update public.subscriptions s
  set
    teacher_email = t.email,
    teacher_name  = t.name
  from public.workspaces w
  join public.teachers t on t.id = w.owner_id
  where s.id = new.id
    and w.id = new.workspace_id;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_to_subscription on public.subscriptions;
create trigger trg_sync_teacher_to_subscription
  after insert or update on public.subscriptions
  for each row execute function public.sync_teacher_to_subscription();

-- Trigger function: sync ke subscriptions saat teacher update nama/email
create or replace function public.sync_teacher_update_to_subscriptions()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.subscriptions s
  set
    teacher_email = new.email,
    teacher_name  = new.name
  from public.workspaces w
  where w.owner_id = new.id
    and s.workspace_id = w.id;

  return new;
end;
$$;

drop trigger if exists trg_sync_teacher_update on public.teachers;
create trigger trg_sync_teacher_update
  after update of email, name on public.teachers
  for each row execute function public.sync_teacher_update_to_subscriptions();

-- -----------------------------------------------------------------------------
-- 4. Backfill: setiap guru harus punya 1 workspace + 1 subscription
-- -----------------------------------------------------------------------------

-- Hapus duplikat subscriptions kalau ada (keep yang paling baru)
delete from public.subscriptions s1
using public.subscriptions s2
where s1.workspace_id = s2.workspace_id
  and s1.created_at < s2.created_at;

-- Pastikan unique constraint di subscriptions.workspace_id
alter table public.subscriptions
  drop constraint if exists subscriptions_workspace_id_unique;
alter table public.subscriptions
  add constraint subscriptions_workspace_id_unique unique (workspace_id);

-- Buat workspace untuk guru yang belum punya
insert into public.workspaces (name, type, owner_id)
select
  coalesce(nullif(trim(t.institution), ''), nullif(trim(t.name), ''), 'Workspace') || ' Workspace',
  'individual',
  t.id
from public.teachers t
where not exists (
  select 1 from public.workspaces w where w.owner_id = t.id
);

-- Buat subscription Free untuk workspace yang belum punya
insert into public.subscriptions (workspace_id, plan_key, status)
select w.id, 'free', 'free'
from public.workspaces w
where not exists (
  select 1 from public.subscriptions s where s.workspace_id = w.id
);

-- Backfill teacher_email + teacher_name untuk semua subscription yang sudah ada
update public.subscriptions s
set
  teacher_email = t.email,
  teacher_name  = t.name
from public.workspaces w
join public.teachers t on t.id = w.owner_id
where s.workspace_id = w.id
  and (s.teacher_email is null or s.teacher_name is null);

-- -----------------------------------------------------------------------------
-- 5. Helper function: set plan user by email
-- -----------------------------------------------------------------------------
create or replace function public.set_user_plan(
  p_email    text,
  p_plan_key text    default 'pro_manual',
  p_days     integer default 30,
  p_note     text    default null
)
returns table (
  out_email   text,
  out_name    text,
  out_plan    text,
  out_status  text,
  out_expires timestamptz
)
language plpgsql
security definer
as $$
declare
  v_teacher_id   uuid;
  v_teacher_name text;
  v_workspace_id uuid;
begin
  select t.id, t.name into v_teacher_id, v_teacher_name
  from public.teachers t
  where lower(t.email) = lower(p_email);

  if v_teacher_id is null then
    raise exception 'Teacher dengan email % tidak ditemukan', p_email;
  end if;

  select w.id into v_workspace_id
  from public.workspaces w
  where w.owner_id = v_teacher_id
  limit 1;

  if v_workspace_id is null then
    insert into public.workspaces (name, type, owner_id)
    values (v_teacher_name || ' Workspace', 'individual', v_teacher_id)
    returning id into v_workspace_id;
  end if;

  -- Update jika sudah ada
  update public.subscriptions
  set
    plan_key              = p_plan_key,
    status                = case when p_plan_key = 'free' then 'free' else 'active' end,
    current_period_start  = case when p_plan_key = 'free' then null else now() end,
    current_period_end    = case when p_plan_key = 'free' then null else now() + (p_days || ' days')::interval end,
    manual_payment_note   = coalesce(p_note, manual_payment_note),
    teacher_email         = p_email,
    teacher_name          = v_teacher_name,
    updated_at            = now()
  where workspace_id = v_workspace_id;

  -- Insert kalau belum ada
  if not found then
    insert into public.subscriptions (
      workspace_id, plan_key, status,
      current_period_start, current_period_end,
      manual_payment_note, teacher_email, teacher_name
    )
    values (
      v_workspace_id,
      p_plan_key,
      case when p_plan_key = 'free' then 'free' else 'active' end,
      case when p_plan_key = 'free' then null else now() end,
      case when p_plan_key = 'free' then null else now() + (p_days || ' days')::interval end,
      p_note,
      p_email,
      v_teacher_name
    );
  end if;

  return query
  select t.email, t.name, s.plan_key, s.status, s.current_period_end
  from public.teachers t
  join public.workspaces w on w.owner_id = t.id
  join public.subscriptions s on s.workspace_id = w.id
  where t.id = v_teacher_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Helper function: list semua user dan plan-nya
-- -----------------------------------------------------------------------------
create or replace function public.list_user_plans()
returns table (
  out_email   text,
  out_name    text,
  out_plan    text,
  out_status  text,
  out_expires timestamptz,
  out_note    text
)
language sql
security definer
as $$
  select
    t.email,
    t.name,
    coalesce(s.plan_key, 'free'),
    coalesce(s.status,   'free'),
    s.current_period_end,
    s.manual_payment_note
  from public.teachers t
  left join public.workspaces w on w.owner_id = t.id
  left join public.subscriptions s on s.workspace_id = w.id
  order by t.created_at desc;
$$;

-- -----------------------------------------------------------------------------
-- 7. Set akun admin ke Pro 1 tahun
-- -----------------------------------------------------------------------------
select * from public.set_user_plan(
  'Miqdadabd99@gmail.com',
  'pro_manual',
  365,
  'Admin self-upgrade'
);

-- Verifikasi semua user
select * from public.list_user_plans();
