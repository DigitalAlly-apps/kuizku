-- ============================================================
-- Admin Snippets — copy-paste sesuai kebutuhan
-- Pakai di Supabase Dashboard → SQL Editor
-- ============================================================

-- ============================================================
-- LIHAT SEMUA USER DAN PLAN-NYA
-- ============================================================
select * from public.list_user_plans();

-- ============================================================
-- UPGRADE USER KE PRO (MANUAL — Rp 29rb)
-- ============================================================
-- Default: 30 hari
select * from public.set_user_plan('email@user.com', 'pro_manual', 30, 'Transfer BCA 10/05/2026');

-- Custom durasi (misal 90 hari)
select * from public.set_user_plan('email@user.com', 'pro_manual', 90, 'Bayar 3 bulan');

-- Lifetime / 1 tahun
select * from public.set_user_plan('email@user.com', 'pro_manual', 365, 'Paket tahunan');

-- ============================================================
-- UPGRADE KE PRO BULANAN (Rp 49rb)
-- ============================================================
select * from public.set_user_plan('email@user.com', 'pro_monthly', 30, 'Subscription bulanan');

-- ============================================================
-- DOWNGRADE KE FREE
-- ============================================================
select * from public.set_user_plan('email@user.com', 'free', 0, null);

-- ============================================================
-- LIHAT USER YANG MASA AKTIFNYA HABIS DALAM 7 HARI
-- ============================================================
select email, name, plan_key, expires_at
from public.list_user_plans()
where expires_at is not null
  and expires_at between now() and now() + interval '7 days'
order by expires_at asc;

-- ============================================================
-- LIHAT USER YANG SUDAH EXPIRED (perlu downgrade manual)
-- ============================================================
select email, name, plan_key, expires_at
from public.list_user_plans()
where expires_at is not null
  and expires_at < now()
  and status = 'active'
order by expires_at asc;

-- ============================================================
-- COUNT USER PER PLAN
-- ============================================================
select plan_key, status, count(*) as total
from public.list_user_plans()
group by plan_key, status
order by total desc;
