# Ujianly SaaS Plan

Dokumen ini adalah source of truth untuk arah bisnis, paket SaaS, billing, dan rancangan Supabase Ujianly.

## Ringkasan Produk

Ujianly adalah platform ujian dan tugas online untuk guru individu. Guru dapat membuat ujian/tugas/latihan, membagikan kode atau link, murid mengerjakan tanpa login lewat HP, dan hasil terkumpul otomatis.

Target awal:

- Guru individu.
- Tutor.
- Bimbel kecil sebagai tahap berikutnya.

Positioning:

- Alat cepat untuk membuat ujian/tugas rumah.
- Murid cukup masuk pakai kode.
- Guru terbantu dalam rekap nilai, feedback, dan export hasil.
- Bukan diposisikan dulu sebagai CBT high-stakes dengan anti-cheat keras.

Tagline arah produk:

- Buat ujian online lebih cepat, koreksi lebih ringan.
- Ujian, tugas, dan rekap nilai dalam satu tempat.

## Target User

### Guru Individu

Pain utama:

- Bikin soal lama.
- Rekap nilai ribet.
- Butuh alat cepat untuk tugas rumah, latihan, dan ulangan ringan.
- Murid mayoritas mengerjakan lewat HP.

Kebutuhan utama:

- Buat ujian/tugas cepat.
- Share kode/link/WhatsApp.
- Murid tanpa login.
- Hasil langsung rapi.
- Export Excel jika perlu.

### Bimbel Kecil

Pain utama:

- Banyak kelas dan banyak latihan.
- Perlu kapasitas submission lebih besar.
- Butuh bank soal dan export hasil.

Roadmap:

- Bimbel/multi-guru setelah Pro stabil.

## Model Produk

- SaaS hosted terpusat.
- Freemium.
- Beta awal memakai billing manual (`pro_manual`).
- Production nanti bisa memakai Midtrans (`pro_monthly`).
- Murid tidak login.
- Guru membayar secara pribadi.

## Paket dan Pricing

### Free

Limit app saat ini:

- 3 ujian aktif.
- 30 pengumpulan jawaban per bulan.
- 20 bank soal.

Fitur:

- Buat soal manual.
- Share kode/link publik.
- Murid tanpa login.
- Hasil dasar.

Fitur terkunci:

- Import soal.
- Export Excel.
- Countdown/timer.
- Anti-cheat.
- Kapasitas besar.

Catatan UI:

- Jangan pakai kata `submission` ke user.
- Gunakan `pengumpulan jawaban`.
- Contoh: `12/30 pengumpulan jawaban bulan ini`.

### Pro

Limit:

- 50 ujian aktif.
- 2.000 pengumpulan jawaban per bulan.
- 1.000 bank soal.

Fitur:

- Import Excel/Word/CSV.
- Export Excel.
- Countdown/timer.
- Share WhatsApp/link/QR.
- Bank soal lebih besar.
- Feedback murid.
- Daftar peserta belum mengerjakan.
- Analitik hasil lebih lengkap.
- Anti-cheat sebagai pencatatan, bukan klaim keamanan utama.

Harga:

- Early adopter beta: Rp29.000/bulan.
- Harga normal: Rp49.000/bulan.
- Saat Midtrans aktif, promo bisa berlaku untuk 3 pembayaran pertama.

Plan key:

- `free`: paket gratis.
- `pro_manual`: Pro aktif manual oleh admin saat beta.
- `pro_monthly`: Pro aktif otomatis lewat payment gateway nanti.

## Beda `pro_manual` dan `pro_monthly`

Secara fitur, keduanya sama-sama Pro.

`pro_manual`:

- Dipakai untuk beta awal.
- Guru bayar manual via transfer/QRIS/WhatsApp.
- Admin cek bukti pembayaran.
- Admin update subscription di Supabase.
- Tidak ada payment history otomatis.
- Cocok untuk validasi 100 user pertama.

`pro_monthly`:

- Dipakai untuk production saat payment gateway siap.
- Guru bayar lewat Midtrans.
- Webhook otomatis mengaktifkan subscription.
- Bisa punya payment history otomatis.
- Butuh Supabase Edge Function/backend.

Logika app:

- User dianggap Pro jika `planKey !== 'free'`, `status = active`, dan `current_period_end` belum lewat.

## Billing Beta Manual

Flow beta saat ini:

1. Guru daftar dan masuk paket Free.
2. Guru klik fitur Pro atau halaman `Paket & Billing`.
3. Guru klik upgrade via WhatsApp.
4. Admin mengirim instruksi pembayaran.
5. Guru kirim bukti pembayaran.
6. Admin verifikasi manual.
7. Admin update `subscriptions` ke `pro_manual` selama 30 hari.
8. Guru klik `Refresh Status` atau login ulang.
9. Fitur Pro terbuka.

Nomor WhatsApp admin saat ini ada di:

- `src/pages/teacher/BillingPage.tsx`

Nomor aktif:

- `62895397265635`

## Billing Production Midtrans

Midtrans tidak dikerjakan dulu. Ini roadmap setelah billing manual terbukti.

Butuh server-side function:

- `create-midtrans-transaction`
- `midtrans-webhook`

Prinsip:

- Jangan membuat transaksi Midtrans penuh dari frontend.
- Validasi user adalah owner workspace.
- Buat payment record pending.
- Midtrans webhook memverifikasi signature.
- Jika sukses, update subscription ke `pro_monthly`.
- Jika gagal/expired, update payment status.

Status sukses Midtrans:

- `capture`
- `settlement`

Status pending:

- `pending`

Status gagal/expired:

- `deny`
- `cancel`
- `expire`
- `failure`

## Arsitektur SaaS

Ujianly memakai model workspace.

Aturan:

- Setiap guru baru idealnya otomatis punya workspace pribadi.
- MVP cukup satu owner per workspace.
- Semua data utama nantinya diarahkan ke `workspace_id`.
- Multi-guru dalam workspace menjadi roadmap setelah Pro stabil.

Tabel SaaS penuh:

- `workspaces`
- `workspace_members`
- `plans`
- `subscriptions`
- `payments`
- `usage_counters`

Tabel existing yang perlu terhubung ke workspace:

- `exams`
- `questions`
- `preloaded_students`
- `submissions`
- `student_answers`
- `bank_questions`

## Data Model Supabase

### `teachers`

Tujuan:

- Profil guru.
- `teachers.id` sama dengan `auth.users.id`.

Dipakai untuk:

- Login/register.
- Query ujian guru.
- Query bank soal guru.

### `workspaces`

Tujuan:

- Menampung tenant SaaS.

Field utama:

- `id`
- `name`
- `type`: `individual` atau `bimbel`
- `owner_id`
- `created_at`
- `updated_at`

Catatan relasi:

- Untuk production, standar yang direkomendasikan adalah `owner_id references public.teachers(id)` agar konsisten dengan domain aplikasi.
- Schema beta saat ini memakai `auth.users(id)` dan masih bisa jalan karena `teachers.id = auth.users.id`.

### `workspace_members`

Tujuan:

- Relasi user/guru ke workspace.

Field:

- `id`
- `workspace_id`
- `user_id`
- `role`: `owner` atau `teacher`
- `created_at`

MVP:

- Satu owner saja.

Roadmap:

- Multi-guru untuk bimbel.

### `plans`

Tujuan:

- Definisi paket.

Field:

- `key`
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

Catatan:

- App saat ini belum membaca tabel `plans` langsung.
- Limit masih didefinisikan di `src/context/AppContext.tsx`.

### `subscriptions`

Tujuan:

- Status paket aktif workspace.

Field:

- `id`
- `workspace_id`
- `plan_key`
- `status`: `free`, `active`, `expired`, `past_due`
- `current_period_start`
- `current_period_end`
- `promo_payments_used`
- `manual_payment_note`
- `created_at`
- `updated_at`

Aturan:

- Workspace baru default `free`.
- Pro aktif jika status `active` dan belum expired.

### `payments`

Tujuan:

- Riwayat transaksi saat Midtrans sudah dipakai.

Field rencana:

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

Catatan:

- Belum dipakai di billing manual beta.

### `usage_counters`

Tujuan:

- Menghitung pemakaian bulanan secara backend.

Field rencana:

- `id`
- `workspace_id`
- `period_month`: format `YYYY-MM`
- `submission_count`
- `created_at`
- `updated_at`

Catatan:

- Belum dipakai di beta.
- Saat ini usage dihitung dari data existing di frontend: `exams`, `submissions`, dan `bank_questions`.

## Ringkasan SQL Supabase

Folder SQL:

- `supabase-history/supabase_medium_features_migration.sql`
- `supabase-history/supabase_submission_feedback_migration.sql`
- `supabase-history/20260505_saas_phase1_workspace_plan.sql`
- `supabase-history/20260507_manual_billing_beta.sql`

### `supabase_medium_features_migration.sql`

Tujuan:

- Menambahkan penyimpanan event anti-cheat pada submission.

Isi:

```sql
alter table public.submissions
  add column if not exists anti_cheat_events jsonb not null default '[]'::jsonb;
```

Kegunaan:

- Menyimpan event murid keluar tab/aplikasi.
- Dipakai oleh `ExamTakingPage`.
- Ditampilkan di `ResultsPage`.

### `supabase_submission_feedback_migration.sql`

Tujuan:

- Menambahkan feedback guru dan status pengembalian jawaban.

Isi:

```sql
alter table public.submissions
  add column if not exists teacher_feedback text,
  add column if not exists is_returned boolean not null default false;
```

Kegunaan:

- `teacher_feedback`: komentar umum guru untuk murid.
- `is_returned`: submission dikembalikan untuk revisi.

### `20260505_saas_phase1_workspace_plan.sql`

Tujuan:

- Fondasi SaaS penuh.
- Membuat `workspaces`, `workspace_members`, `plans`, dan `subscriptions`.
- Menambahkan `workspace_id` nullable ke tabel utama.
- Backfill workspace untuk guru existing.

Seed plan di file ini:

- `free`: 2 ujian aktif, 20 pengumpulan jawaban/bulan, 10 bank soal.
- `pro_monthly`: 50 ujian aktif, 2.000 pengumpulan jawaban/bulan, 1.000 bank soal.

Catatan:

- Angka Free di file ini belum sinkron dengan app sekarang.
- App sekarang memakai 3/30/20 untuk Free.
- Sebelum production, file ini perlu dirapikan dan dijadikan baseline final.

### `20260507_manual_billing_beta.sql`

Tujuan:

- Skema ringan untuk billing manual beta.
- Membuat `workspaces` dan `subscriptions`.
- Menambahkan RLS read-only untuk owner.

Kegunaan:

- App membaca status Free/Pro melalui `storage.getBillingSnapshot()`.
- Dashboard menampilkan usage dan plan.
- Halaman billing manual bisa refresh status.

Catatan:

- File ini cocok untuk beta cepat.
- Jika tabel belum ada atau user belum punya workspace, app fallback ke Free.
- Jangan menjalankan `20260505` dan `20260507` sembarangan tanpa cek schema karena keduanya membuat tabel `workspaces` dan `subscriptions`.

## Cara Setup Billing Manual Beta

Urutan setup beta:

1. Pastikan migration dasar aplikasi sudah ada di Supabase.
2. Jalankan `supabase_medium_features_migration.sql`.
3. Jalankan `supabase_submission_feedback_migration.sql`.
4. Jalankan `20260507_manual_billing_beta.sql` untuk billing manual.
5. Buat workspace + subscription Free untuk user existing jika belum ada.
6. Test login guru, halaman billing, refresh status, dan upgrade manual.
7. Test fitur Pro: import, export, timer, dan publish limit.

Membuat workspace Free untuk user existing:

```sql
with new_workspace as (
  insert into public.workspaces (name, owner_id)
  values ('Nama Guru Workspace', 'AUTH_USER_ID')
  returning id
)
insert into public.subscriptions (workspace_id, plan_key, status)
select id, 'free', 'free' from new_workspace;
```

Upgrade manual ke Pro selama 30 hari:

```sql
update public.subscriptions s
set
  plan_key = 'pro_manual',
  status = 'active',
  current_period_start = now(),
  current_period_end = now() + interval '30 days',
  promo_payments_used = coalesce(promo_payments_used, 0) + 1,
  manual_payment_note = 'Paid manually via transfer/QRIS',
  updated_at = now()
from public.workspaces w
where s.workspace_id = w.id
  and w.owner_id = 'AUTH_USER_ID';
```

## Feature Gates

Feature gate harus dicek di UI dan backend. Saat ini sebagian sudah dicek di UI.

### Publish Exam

Free:

- Maksimal 3 ujian aktif.

Pro:

- Maksimal 50 ujian aktif.

Status app:

- UI guard sudah ada di `ExamListPage`.
- Backend guard belum ada.

### Student Submit

Free:

- Maksimal 30 pengumpulan jawaban/bulan.

Pro:

- Maksimal 2.000 pengumpulan jawaban/bulan.

Status app:

- Dashboard usage sudah tampil.
- Backend guard submit final belum ada.

### Bank Soal

Free:

- Maksimal 20 bank soal.

Pro:

- Maksimal 1.000 bank soal.

Status app:

- Usage tampil di dashboard.
- Guard tambah bank soal belum lengkap.

### Import

Free:

- Locked.

Pro:

- Enabled.

Status app:

- UI guard sudah ada di `Step3Questions`.

### Export

Free:

- Locked.

Pro:

- Enabled.

Status app:

- UI guard sudah ada di `ResultsPage`.

### Timer

Free:

- Locked, default `NONE`.

Pro:

- `NONE`
- `WHOLE_EXAM`
- `PER_QUESTION`

Status app:

- UI guard sudah ada di `Step1Setup`.

### Anti-Cheat

Free:

- Locked/off.

Pro:

- Enabled.

Status app:

- Belum sepenuhnya dilock di UI.
- Untuk positioning, anti-cheat jangan jadi klaim utama.

## UX SaaS

Dashboard harus menampilkan:

- Paket aktif.
- Ujian aktif: `x/limit`.
- Pengumpulan jawaban bulan ini: `x/limit`.
- Bank soal: `x/limit`.
- Perlu perhatian: peserta belum mengerjakan, jawaban masuk, essay belum dinilai.

Upgrade prompt trigger:

- Klik import.
- Klik export.
- Aktifkan timer.
- Limit publish habis.
- Limit bank soal habis.
- Submission hampir habis.

Copy:

- Upgrade ke Pro untuk membuka fitur ini.
- Paket Free mendukung 30 pengumpulan jawaban per bulan. Upgrade agar ujian tetap bisa menerima jawaban.

## RLS dan Security Supabase

Prinsip production:

- Guru hanya bisa akses data workspace tempat dia menjadi member.
- Owner bisa kelola billing workspace.
- Murid publik hanya bisa baca exam aktif via kode.
- Murid publik hanya bisa submit ke exam aktif yang belum melewati deadline dan limit.
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

Security yang masih perlu dikerjakan:

- Endpoint/RPC murid harus mengambil soal tanpa `correct_option_id` dan `answer_guide`.
- Scoring PG final harus dihitung server-side.
- Attempt limit harus enforced di backend.
- Deadline submit harus enforced di backend.
- Limit Free/Pro untuk submit final harus dicek backend.
- Shuffle soal/opsi perlu dipersist agar resume stabil.

## Roadmap Implementasi

### Phase 0: Fondasi Produk

- Branding Ujianly konsisten.
- README/setup rapi.
- Build/typecheck aman.
- Landing page sesuai positioning.

### Phase 1: Billing Manual Beta

- Tambah `workspaces` dan `subscriptions` beta.
- Tambah halaman billing.
- Tambah status plan di dashboard.
- Tambah feature gate UI untuk import, export, timer, publish.
- Admin upgrade manual ke `pro_manual`.

Status:

- Sebagian besar sudah ada di app.

### Phase 2: Usage dan Feature Gate Lanjutan

- Guard bank soal.
- Guard final submit.
- Warning jika usage hampir habis.
- Upgrade modal reusable.
- Sinkronkan limit app dan SQL.

### Phase 3: Workspace Production

- Rapikan satu migration final.
- Standardisasi relasi `owner_id`.
- Tambah `workspace_members`.
- Tambah `plans`.
- Tambah `usage_counters`.
- Semua query guru diarahkan ke workspace.

### Phase 4: Midtrans

- Setup Midtrans sandbox.
- Tambah Edge Function create transaction.
- Tambah Edge Function webhook.
- Tambah tabel `payments`.
- Update subscription otomatis ke `pro_monthly`.

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

- Recurring auto-debit.
- Multi-guru dalam workspace.
- White-label/custom domain.
- Akun murid.
- Mobile app native.
- Payment tahunan.
- Paket enterprise.
- AI question generator.

## Keputusan Saat Ini

- Nama produk: Ujianly.
- Model: SaaS hosted.
- Target awal: guru individu.
- Tier: Free dan Pro.
- Billing beta: manual via WhatsApp/admin.
- Plan beta Pro: `pro_manual`.
- Billing production: Midtrans nanti.
- Plan production Pro: `pro_monthly`.
- Harga beta: Rp29.000/bulan.
- Harga normal: Rp49.000/bulan.
- Murid: tanpa login.
- Free limit app saat ini: 3 ujian aktif, 30 pengumpulan jawaban/bulan, 20 bank soal.
- Pro limit: 50 ujian aktif, 2.000 pengumpulan jawaban/bulan, 1.000 bank soal.
- Prioritas berikutnya: backend security, submit/scoring server-side, dan sinkronisasi schema production.
