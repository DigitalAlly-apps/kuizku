# Ringkasan SQL Supabase Ujianly

Dokumen ini merangkum file SQL Supabase yang ada di repo, tujuan tiap migration, kegunaan tabel/kolom, dan catatan operasional untuk beta.

## Gambaran Umum

Ujianly memakai Supabase untuk:

- Auth guru melalui Supabase Auth.
- Penyimpanan profil guru, ujian, soal, peserta, jawaban murid, bank soal, dan submission.
- Autosave draft/final submission murid.
- Billing manual beta melalui workspace dan subscription.

Folder SQL saat ini:

- `supabase-history/supabase_medium_features_migration.sql`
- `supabase-history/supabase_submission_feedback_migration.sql`
- `supabase-history/20260505_saas_phase1_workspace_plan.sql`
- `supabase-history/20260507_manual_billing_beta.sql`

## Tabel Utama Aplikasi

Tabel utama yang dipakai aplikasi dari kode `src/utils/storage.ts`:

- `teachers`: profil guru, memakai `id` yang sama dengan `auth.users.id`.
- `exams`: data ujian/tugas/latihan milik guru.
- `questions`: daftar soal per ujian.
- `preloaded_students`: daftar peserta opsional untuk whitelist murid.
- `submissions`: pengumpulan jawaban murid, baik draft maupun final.
- `student_answers`: detail jawaban tiap soal.
- `bank_questions`: bank soal guru.
- `workspaces`: tenant SaaS/billing.
- `subscriptions`: status paket Free/Pro.

## 1. `supabase_medium_features_migration.sql`

Tujuan:

- Menambahkan penyimpanan event anti-cheat pada submission.

Isi migration:

```sql
alter table public.submissions
  add column if not exists anti_cheat_events jsonb not null default '[]'::jsonb;
```

Kegunaan:

- Menyimpan event seperti murid keluar tab/aplikasi saat ujian.
- Dipakai oleh `ExamTakingPage` untuk mengirim data `antiCheatEvents`.
- Ditampilkan di `ResultsPage` sebagai jumlah pelanggaran.

Catatan:

- Kolom menggunakan `jsonb` agar fleksibel jika event anti-cheat bertambah.
- Saat ini event yang dipakai di tipe TypeScript adalah `TAB_HIDDEN`.

## 2. `supabase_submission_feedback_migration.sql`

Tujuan:

- Menambahkan feedback guru dan status pengembalian jawaban.

Isi migration:

```sql
alter table public.submissions
  add column if not exists teacher_feedback text,
  add column if not exists is_returned boolean not null default false;
```

Kegunaan:

- `teacher_feedback`: komentar umum guru untuk murid.
- `is_returned`: menandai submission dikembalikan untuk revisi.
- Dipakai oleh `ResultsPage`, `AppContext.setTeacherFeedback`, dan `AppContext.returnSubmission`.

Catatan:

- `is_returned = true` biasanya disertai `is_complete = false` agar jawaban bisa dibuka kembali.

## 3. `20260505_saas_phase1_workspace_plan.sql`

Tujuan:

- Fondasi SaaS jangka panjang: workspace, membership, plan, subscription, dan `workspace_id` untuk semua data utama.
- Migration ini non-breaking karena menambahkan `workspace_id` nullable ke tabel existing.

Tabel yang dibuat:

- `workspaces`
- `workspace_members`
- `plans`
- `subscriptions`

Kolom workspace yang ditambahkan ke tabel existing:

- `exams.workspace_id`
- `questions.workspace_id`
- `preloaded_students.workspace_id`
- `submissions.workspace_id`
- `student_answers.workspace_id`
- `bank_questions.workspace_id`

Seed plan:

- `free`: Rp0, 2 ujian aktif, 20 pengumpulan jawaban/bulan, 10 bank soal.
- `pro_monthly`: Rp49.000, 50 ujian aktif, 2.000 pengumpulan jawaban/bulan, 1.000 bank soal, import/export/timer/anti-cheat aktif.

Kegunaan:

- Membuat satu workspace personal untuk setiap guru existing.
- Membuat membership `owner` untuk guru.
- Membuat subscription default `free` untuk workspace.
- Backfill `workspace_id` ke data lama berdasarkan relasi guru/ujian/submission.

Catatan penting:

- File ini cocok untuk roadmap SaaS penuh.
- Di app saat ini, feature gate frontend memakai limit dari `AppContext`, bukan membaca tabel `plans` secara langsung.
- App billing manual saat ini membaca `workspaces` dan `subscriptions` melalui `storage.getBillingSnapshot()`.

## 4. `20260507_manual_billing_beta.sql`

Tujuan:

- Skema ringan untuk billing manual beta.
- Memungkinkan app membaca status paket user tanpa integrasi Midtrans.

Tabel yang dibuat:

- `workspaces`
- `subscriptions`

Kolom penting `workspaces`:

- `id`: primary key UUID.
- `name`: nama workspace.
- `type`: `individual` atau `bimbel`.
- `owner_id`: referensi ke `auth.users(id)`.
- `created_at`, `updated_at`.

Kolom penting `subscriptions`:

- `workspace_id`: relasi ke workspace.
- `plan_key`: `free`, `pro_manual`, atau `pro_monthly`.
- `status`: `free`, `active`, `expired`, atau `past_due`.
- `current_period_start`: awal masa aktif.
- `current_period_end`: akhir masa aktif.
- `promo_payments_used`: jumlah pembayaran promo yang sudah dipakai.
- `manual_payment_note`: catatan admin untuk pembayaran manual.

RLS yang dibuat:

- Guru hanya bisa membaca workspace miliknya sendiri.
- Guru hanya bisa membaca subscription dari workspace miliknya sendiri.

Kegunaan di app:

- Halaman `Paket & Billing` membaca status paket.
- Dashboard menampilkan usage dan status Free/Pro.
- Feature gate menggunakan `featureAccess` untuk lock fitur Pro.

Feature gate saat ini:

- Import soal: Pro.
- Export Excel: Pro.
- Countdown/timer: Pro.
- Publish ujian aktif melebihi limit: diarahkan upgrade.

Catatan penting:

- File ini cocok untuk beta cepat.
- Jika tabel belum ada atau user belum punya workspace, app fallback ke paket `Free`.
- Nomor WhatsApp admin di app ada di `src/pages/teacher/BillingPage.tsx`.

## Perbedaan Dua File SaaS/Billing

Ada dua migration yang sama-sama menyentuh `workspaces` dan `subscriptions`:

- `20260505_saas_phase1_workspace_plan.sql`: versi lebih lengkap untuk SaaS penuh.
- `20260507_manual_billing_beta.sql`: versi ringan untuk billing manual beta.

Rekomendasi penggunaan saat ini:

- Untuk beta cepat: gunakan `20260507_manual_billing_beta.sql`.
- Untuk SaaS penuh nanti: pakai/rapikan `20260505_saas_phase1_workspace_plan.sql` sebagai baseline final.

Perhatian:

- Jangan menjalankan dua migration ini sembarangan tanpa cek struktur database, karena keduanya membuat `workspaces` dan `subscriptions` dengan definisi referensi yang berbeda.
- `20260505` memakai `owner_id references public.teachers(id)`.
- `20260507` memakai `owner_id references auth.users(id)`.
- Karena `teachers.id` memang sama dengan `auth.users.id`, dua pendekatan bisa bekerja, tapi harus distandarkan sebelum production.

Rekomendasi standar untuk production:

- Gunakan `public.teachers(id)` sebagai relasi domain aplikasi, atau `auth.users(id)` sebagai relasi auth langsung, pilih salah satu.
- Untuk konsistensi dengan data app saat ini, `public.teachers(id)` lebih selaras dengan tabel lain.

## Cara Upgrade Manual Beta

Setelah guru membayar dan bukti valid, admin bisa update subscription ke Pro manual.

Contoh dari file `20260507_manual_billing_beta.sql`:

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

Langkah admin:

1. Cari `AUTH_USER_ID` guru dari Supabase Auth atau tabel `teachers`.
2. Pastikan user punya row di `workspaces` dan `subscriptions`.
3. Jalankan update subscription ke `pro_manual`.
4. Guru klik `Refresh Status` di halaman billing atau login ulang.

## Cara Membuat Workspace Free Untuk User Existing

Jika user lama belum punya workspace:

```sql
with new_workspace as (
  insert into public.workspaces (name, owner_id)
  values ('Nama Guru Workspace', 'AUTH_USER_ID')
  returning id
)
insert into public.subscriptions (workspace_id, plan_key, status)
select id, 'free', 'free' from new_workspace;
```

## Limit Paket Yang Dipakai App Saat Ini

Limit saat ini didefinisikan di `src/context/AppContext.tsx`:

- Free:
  - 3 ujian aktif.
  - 30 pengumpulan jawaban/bulan.
  - 20 bank soal.
- Pro manual / Pro monthly:
  - 50 ujian aktif.
  - 2.000 pengumpulan jawaban/bulan.
  - 1.000 bank soal.

Catatan:

- Nilai ini sedikit berbeda dari seed `20260505_saas_phase1_workspace_plan.sql` yang masih memakai Free 2/20/10.
- Jika ingin konsisten, update seed SQL atau ubah limit di `AppContext`.

## Catatan Keamanan Yang Masih Perlu Dikerjakan

Sebelum production/public besar, bagian berikut perlu diperbaiki di SQL/backend:

- Endpoint/RPC untuk murid harus mengambil soal tanpa `correct_option_id` dan `answer_guide`.
- Scoring PG final sebaiknya dihitung server-side, bukan client-side.
- Attempt limit dan deadline submit harus enforced di backend/RPC.
- Limit Free/Pro untuk submit final harus dicek di backend, bukan hanya UI.
- RLS perlu diaudit untuk akses publik murid berdasarkan kode ujian.

## Urutan Setup Beta Yang Disarankan

1. Jalankan migration dasar aplikasi yang sudah ada di project Supabase.
2. Jalankan:
   - `supabase_medium_features_migration.sql`
   - `supabase_submission_feedback_migration.sql`
3. Untuk billing manual beta, jalankan `20260507_manual_billing_beta.sql`.
4. Buat workspace + subscription Free untuk user existing jika belum ada.
5. Ganti nomor WhatsApp admin di `BillingPage` jika berubah.
6. Tes login guru, halaman billing, refresh status, dan upgrade manual.
7. Tes fitur Pro: import, export, timer, dan publish limit.
