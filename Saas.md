# Ujianly SaaS Plan

## Ringkasan Produk

Ujianly adalah SaaS ujian online untuk guru individu dan bimbel kecil. Guru dapat membuat ujian, membagikan kode/link publik, murid mengerjakan tanpa login, dan hasil terkumpul otomatis.

Target awal:

- Guru individu
- Tutor
- Bimbel kecil

Model produk:

- SaaS hosted terpusat
- Freemium
- Pembayaran bulanan manual via Midtrans
- Murid tanpa login

## Positioning

Platform ujian online simpel untuk guru dan bimbel: buat ujian, bagikan kode, murid langsung kerjakan tanpa akun, hasil otomatis terekap.

## Target User

### Guru Individu

- Membuat ujian/tugas/latihan
- Membagikan kode ke murid
- Melihat hasil dasar
- Upgrade jika butuh import, export, timer, dan kapasitas lebih besar

### Bimbel Kecil

- Membuat banyak ujian
- Mengelola lebih banyak submission
- Butuh bank soal lebih besar
- Butuh export Excel dan analitik hasil

## Tier Pricing

### Free

Limit:

- 2 ujian aktif
- 20 pengumpulan jawaban per bulan
- 10 bank soal
- Share public link/kode ujian
- Murid tanpa login
- Buat soal manual
- Hasil dasar

Fitur terkunci:

- Import soal
- Export hasil
- Timer semua mode
- Anti-cheat
- Kapasitas besar

Catatan UI:

- Jangan pakai kata "submission" untuk user.
- Gunakan "pengumpulan jawaban".
- Contoh: `12/20 pengumpulan jawaban bulan ini`.

### Pro Monthly

Limit:

- 50 ujian aktif
- 2.000 pengumpulan jawaban per bulan
- 1.000 bank soal

Fitur:

- Import Excel/Word
- Export Excel
- Timer semua mode
- Anti-cheat
- Analitik/hasil lengkap
- Feedback murid
- Kapasitas lebih besar

Harga:

- Harga normal: Rp49.000/bulan
- Promo early adopter: Rp29.000/bulan untuk 3 pembayaran pertama
- Pembayaran ke-4 dan seterusnya: Rp49.000/bulan

Plan key:

- `free`
- `pro_monthly`

## Billing Model

Gateway:

- Midtrans

Model MVP:

- Payment bulanan manual
- Bukan recurring otomatis
- User klik bayar bulan ini
- Sistem membuat transaksi Midtrans
- Midtrans mengirim webhook setelah pembayaran sukses
- Subscription aktif selama 30 hari

Flow:

1. Guru daftar.
2. Sistem membuat workspace Free otomatis.
3. Guru memakai limit Free.
4. Saat klik fitur Pro, tampil modal upgrade.
5. Guru klik upgrade.
6. App membuat transaksi Midtrans.
7. Guru menyelesaikan pembayaran.
8. Webhook Midtrans memverifikasi pembayaran.
9. Workspace menjadi Pro selama 30 hari.
10. Untuk 3 pembayaran Pro pertama, harga Rp29.000.
11. Pembayaran ke-4 dan seterusnya, harga Rp49.000.

Expired/cancel behavior:

- Workspace turun ke Free.
- Data lama tetap aman.
- Jika data melebihi limit Free, user tetap bisa melihat data lama.
- User tidak bisa publish ujian baru, menambah bank soal, atau memakai fitur Pro sampai upgrade lagi.
- Ujian aktif berlebih tetap terlihat, tapi action publish/reactivate dibatasi.

## Arsitektur SaaS

### Workspace

Ujianly harus memakai model workspace.

Aturan:

- Setiap guru baru otomatis punya workspace pribadi.
- Untuk MVP, satu owner per workspace cukup.
- Bimbel/multi-guru bisa jadi roadmap setelah Pro stabil.
- Semua data utama harus terkait ke `workspace_id`.

Tabel baru:

- `workspaces`
- `workspace_members`
- `plans`
- `subscriptions`
- `payments`
- `usage_counters`

Tabel existing yang perlu diarahkan ke workspace:

- `exams`
- `questions`
- `preloaded_students`
- `submissions`
- `student_answers`
- `bank_questions`

### Role

MVP:

- `owner`

Roadmap:

- `owner`
- `teacher`

Murid:

- Tidak login
- Akses publik memakai kode ujian

## Data Model Draft

### workspaces

Tujuan:

- Menampung tenant SaaS.

Field:

- `id`
- `name`
- `type`: `individual` atau `bimbel`
- `owner_id`
- `created_at`
- `updated_at`

### workspace_members

Tujuan:

- Relasi user/guru ke workspace.

Field:

- `id`
- `workspace_id`
- `user_id`
- `role`: `owner` atau `teacher`
- `created_at`

MVP:

- Otomatis 1 owner per workspace.

### plans

Tujuan:

- Definisi paket.

Field:

- `key`: `free` atau `pro_monthly`
- `name`
- `price`
- `active_exam_limit`
- `monthly_submission_limit`
- `bank_question_limit`
- `can_import`
- `can_export`
- `can_use_timer`
- `can_use_anticheat`
- `created_at`

### subscriptions

Tujuan:

- Status plan aktif workspace.

Field:

- `id`
- `workspace_id`
- `plan_key`
- `status`: `free`, `active`, `expired`, `past_due`
- `current_period_start`
- `current_period_end`
- `promo_payments_used`
- `created_at`
- `updated_at`

Aturan:

- Workspace baru punya `plan_key = free`.
- Pro aktif jika `status = active` dan `current_period_end > now()`.

### payments

Tujuan:

- Riwayat transaksi Midtrans.

Field:

- `id`
- `workspace_id`
- `subscription_id`
- `midtrans_order_id`
- `midtrans_transaction_id`
- `amount`
- `currency`
- `status`
- `payment_type`
- `paid_at`
- `raw_payload`
- `created_at`
- `updated_at`

### usage_counters

Tujuan:

- Menghitung pemakaian bulanan.

Field:

- `id`
- `workspace_id`
- `period_month`
- `submission_count`
- `created_at`
- `updated_at`

Format `period_month`:

- `YYYY-MM`

## Feature Gates

Feature gate harus dicek di UI dan logic backend/database.

### Publish Exam

Free:

- Maksimal 2 ujian aktif.

Pro:

- Maksimal 50 ujian aktif.

Cek saat:

- User publish ujian
- User reactivate ujian
- User duplicate lalu publish

### Student Submit

Free:

- Maksimal 20 pengumpulan jawaban per bulan.

Pro:

- Maksimal 2.000 pengumpulan jawaban per bulan.

Cek saat:

- Murid submit final jawaban

Jika limit habis:

- Submission ditolak dengan pesan ramah.
- Guru perlu upgrade agar ujian bisa menerima jawaban lagi.
- Untuk UX, guru harus melihat warning sebelum limit habis.

### Bank Soal

Free:

- Maksimal 10 bank soal.

Pro:

- Maksimal 1.000 bank soal.

Cek saat:

- Save bank question
- Import ke bank soal
- Add question to bank

### Import

Free:

- Locked.

Pro:

- Enabled.

Cek saat:

- Klik import modal
- Proses parsing/import
- Save hasil import

### Export

Free:

- Locked.

Pro:

- Enabled.

Cek saat:

- Klik export hasil
- Generate Excel

### Timer

Free:

- Tidak ada timer mode apa pun.
- Default wajib `NONE`.

Pro:

- `NONE`
- `WHOLE_EXAM`
- `PER_QUESTION`

Cek saat:

- Step setup ujian
- Save exam
- Publish exam

### Anti-Cheat

Free:

- Locked/off.

Pro:

- Enabled.

Cek saat:

- Save exam
- Publish exam
- Exam taking logic

## UX SaaS

### Free Usage Indicator

Tampilkan di dashboard:

- Ujian aktif: `1/2`
- Pengumpulan jawaban bulan ini: `12/20`
- Bank soal: `7/10`

### Upgrade Prompt

Trigger:

- Klik Import
- Klik Export
- Aktifkan Timer
- Aktifkan Anti-cheat
- Limit publish habis
- Limit bank soal habis
- Submission hampir habis

Copy contoh:

- "Upgrade ke Pro untuk membuka fitur ini."
- "Paket Free mendukung 20 pengumpulan jawaban per bulan. Upgrade agar ujian tetap bisa menerima jawaban."

### Billing Page

Isi:

- Current plan
- Status subscription
- Period end
- Promo payments used
- Next price
- Button bayar/upgrade
- Payment history sederhana

### Pricing Page

Free:

- Rp0
- 2 ujian aktif
- 20 pengumpulan jawaban/bulan
- 10 bank soal
- Share link publik

Pro:

- Rp49.000/bulan
- Promo Rp29.000/bulan untuk 3 pembayaran pertama
- 50 ujian aktif
- 2.000 pengumpulan jawaban/bulan
- 1.000 bank soal
- Import/export
- Timer
- Anti-cheat

## Midtrans Integration

### Server-Side Requirement

Jangan membuat transaksi Midtrans penuh dari frontend.

Butuh server-side function:

- Supabase Edge Function atau backend API.

Functions:

- `create-midtrans-transaction`
- `midtrans-webhook`

### create-midtrans-transaction

Input:

- workspace id
- user id

Logic:

1. Validasi user adalah owner workspace.
2. Ambil subscription workspace.
3. Hitung harga: jika `promo_payments_used < 3`, amount = 29000; jika `promo_payments_used >= 3`, amount = 49000.
4. Buat `order_id` unik.
5. Buat payment record status pending.
6. Request transaksi ke Midtrans.
7. Return checkout URL/token ke frontend.

### midtrans-webhook

Logic:

1. Verifikasi signature Midtrans.
2. Ambil payment berdasarkan `order_id`.
3. Jika sukses, update payment status, update subscription ke `pro_monthly`, set `status = active`, set `current_period_start = now()`, set `current_period_end = now() + 30 days`, dan increment `promo_payments_used` jika payment termasuk promo.
4. Jika gagal/expired, update payment status.

Status sukses Midtrans yang perlu diproses:

- `capture`
- `settlement`

Status pending:

- `pending`

Status gagal/expired:

- `deny`
- `cancel`
- `expire`
- `failure`

## RLS Supabase

RLS wajib untuk SaaS.

Prinsip:

- Guru hanya bisa akses data workspace tempat dia menjadi member.
- Owner bisa kelola billing workspace.
- Murid publik hanya bisa baca exam aktif via kode.
- Murid publik hanya bisa submit ke exam yang aktif dan belum melewati limit.
- Bank soal tidak bocor antar workspace.

Policy area:

- `workspaces`
- `workspace_members`
- `exams`
- `questions`
- `preloaded_students`
- `submissions`
- `student_answers`
- `bank_questions`
- `subscriptions`
- `payments`
- `usage_counters`

Catatan:

- Limit kritis jangan hanya di client.
- Minimal enforce di Edge Function/RPC untuk submit final dan publish exam.

## Roadmap Implementasi

### Phase 0: Fondasi Repo

- Tambah `.gitignore`.
- Tambah `.env.example`.
- Rapikan README untuk SaaS/dev/deploy.
- Tambah ESLint config.
- Pastikan `typecheck`, `lint`, dan `build` jalan.
- Matikan PWA dev mode.
- Pastikan branding Ujianly konsisten.

### Phase 1: Workspace dan Plan

- Tambah schema `workspaces`.
- Tambah `workspace_members`.
- Tambah `plans`.
- Tambah `subscriptions`.
- Tambah `workspace_id` ke data utama.
- Register guru otomatis buat workspace Free.
- AppContext menyimpan `currentWorkspace`.
- Semua query guru pakai workspace.

### Phase 2: Usage dan Feature Gate

- Tambah `usage_counters`.
- Tambah plan limit config.
- Tambah usage indicator.
- Lock fitur Free: import, export, timer, dan anti-cheat.
- Guard publish exam.
- Guard bank soal.
- Guard final submit.

### Phase 3: Billing UI

- Tambah halaman Billing.
- Tambah pricing section.
- Tambah upgrade modal.
- Tampilkan promo Rp29.000/bulan untuk 3 pembayaran pertama, lalu Rp49.000/bulan.

### Phase 4: Midtrans

- Setup Midtrans sandbox.
- Tambah Edge Function create transaction.
- Tambah Edge Function webhook.
- Simpan payment history.
- Update subscription dari webhook.
- Test status pending, success, expired, failed.

### Phase 5: Production Readiness

- Terms of Service.
- Privacy Policy.
- Refund Policy.
- Admin internal sederhana.
- Error monitoring.
- Backup/export strategy.
- Rate limit public submission.
- Review RLS dan security.

## MVP Non-Goals

Tidak dikerjakan dulu:

- Recurring auto-debit
- Multi-guru dalam workspace
- White-label/custom domain
- Akun murid
- Mobile app native
- Payment tahunan
- Paket enterprise
- AI question generator

## Keputusan Final

- Nama produk: Ujianly.
- Model: SaaS hosted.
- Target: guru individu dan bimbel kecil.
- Tier: Free dan Pro.
- Billing: bulanan.
- Payment: Midtrans.
- Promo: 3 pembayaran pertama Pro Rp29.000/bulan.
- Harga normal: Rp49.000/bulan.
- Murid: tanpa login.
- Free limit: 2 ujian aktif, 20 pengumpulan jawaban/bulan, 10 bank soal, share public, tanpa import/export/timer/anti-cheat.
- Pro limit: 50 ujian aktif, 2.000 pengumpulan jawaban/bulan, 1.000 bank soal, import/export/timer/anti-cheat aktif.
