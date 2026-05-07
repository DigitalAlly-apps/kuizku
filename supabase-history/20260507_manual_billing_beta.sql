-- Manual billing beta schema for Ujianly.
-- Run this before enabling paid beta so the app can read workspace and plan status.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'individual' check (type in ('individual', 'bimbel')),
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  plan_key text not null default 'free' check (plan_key in ('free', 'pro_manual', 'pro_monthly')),
  status text not null default 'free' check (status in ('free', 'active', 'expired', 'past_due')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  promo_payments_used integer not null default 0,
  manual_payment_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create index if not exists subscriptions_workspace_id_idx on public.subscriptions(workspace_id);

alter table public.workspaces enable row level security;
alter table public.subscriptions enable row level security;

drop policy if exists "Owners can read own workspaces" on public.workspaces;
create policy "Owners can read own workspaces"
on public.workspaces for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "Owners can read own subscriptions" on public.subscriptions;
create policy "Owners can read own subscriptions"
on public.subscriptions for select
to authenticated
using (
  exists (
    select 1 from public.workspaces w
    where w.id = subscriptions.workspace_id
      and w.owner_id = auth.uid()
  )
);

-- Create a workspace + Free subscription for an existing teacher.
-- Replace values, then run once per beta user if they do not have a workspace yet.
--
-- with new_workspace as (
--   insert into public.workspaces (name, owner_id)
--   values ('Nama Guru Workspace', 'AUTH_USER_ID')
--   returning id
-- )
-- insert into public.subscriptions (workspace_id, plan_key, status)
-- select id, 'free', 'free' from new_workspace;

-- Upgrade a teacher manually to Pro for 30 days after payment verification.
-- Replace AUTH_USER_ID and optional note.
--
-- update public.subscriptions s
-- set
--   plan_key = 'pro_manual',
--   status = 'active',
--   current_period_start = now(),
--   current_period_end = now() + interval '30 days',
--   promo_payments_used = coalesce(promo_payments_used, 0) + 1,
--   manual_payment_note = 'Paid manually via transfer/QRIS',
--   updated_at = now()
-- from public.workspaces w
-- where s.workspace_id = w.id
--   and w.owner_id = 'AUTH_USER_ID';
