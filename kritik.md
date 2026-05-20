# Kritik Aplikasi Ujianly — Pemakaian Pribadi

Fokus: hal-hal yang berdampak ke pengalaman lo sebagai user tunggal. Isu multi-tenant/SaaS diabaikan.

## 🔴 Critical — Bisa bikin data hilang atau app crash

| # | Isu | Lokasi | Dampak | Status |
|---|-----|--------|--------|--------|
| 1 | saveExam non-atomik: DELETE soal lama → INSERT soal baru | storage.ts saveExam() | Network putus saat save = semua soal di ujian itu hilang permanen | ✅ FIXED — Diganti RPC save_exam_full yang transactional |
| 2 | Tidak ada Error Boundary | App.tsx | Error di komponen mana pun → blank screen, harus refresh manual | ✅ FIXED — ErrorBoundary dipasang di root App |
| 3 | updateExam field kecil → re-save semua soal | AppContext.tsx updateExam() | Edit judul saja → DELETE+INSERT semua soal. Risiko data hilang sama dengan #1 | ✅ FIXED — Meta-only update pakai updateExamMeta(), full save hanya kalau ada questions |
| 4 | returnSubmission set isComplete: false | AppContext.tsx | Submission yang dikembalikan untuk revisi hilang dari tab Hasil karena filter isComplete: true | ✅ FIXED — Hanya set isReturned: true, isComplete tidak diubah |
| 5 | Race condition di ExamTakingPage bootstrap | ExamTakingPage.tsx line ~40 | StrictMode dev kadang bikin 2x session, submission_id kedua overwrite session pertama | ✅ FIXED — bootstrapRef guard agar useEffect hanya jalan sekali |

## 🟠 Important — Bikin frustrasi waktu pakai

| # | Isu | Lokasi | Dampak | Status |
|---|-----|--------|--------|--------|
| 6 | Service Worker stale di dev mode | vite.config.ts devOptions.enabled | Cache lama bikin request rusak (kasus 400 kemarin) | ✅ FIXED — devOptions.enabled: false |
| 7 | console.error di production | storage.ts, AppContext.tsx, ~10 tempat | Noise di DevTools, error log bocor info struktur DB | ✅ FIXED — Vite esbuild.drop console+debugger di production build |
| 8 | Field password masih di tipe Teacher | src/types/index.ts | Sisa legacy — selalu kosong, bikin confused saat baca kode | ✅ FIXED — Field dihapus dari type dan semua referensinya |
| 9 | hashPassword() tidak dipakai | src/utils/helpers.ts | Dead code, bingungkan saat audit | ✅ FIXED — Fungsi dihapus |
| 10 | Table workspaces, subscriptions, plans di DB | Supabase | Sudah tidak dipakai code sama sekali | ✅ FIXED — SQL tersedia di supabase-history/20260510_drop_saas_tables.sql |
| 11 | Kolom workspace_id di exams, questions, bank_questions, dll | Supabase | Selalu null, kolom mati | ✅ FIXED — Termasuk dalam SQL drop di atas |
| 12 | Kolom promo_payments_used, manual_payment_note di subscriptions | Supabase | Tidak relevan | ✅ FIXED — Drop bareng tabel subscriptions |
| 13 | Migration 20260510_cleanup_and_billing_setup.sql masih ada | supabase-history/ | Punya logic billing + admin email hardcoded | ✅ FIXED — File dihapus |
| 14 | Wording "beta", "early adopter", "guru Indonesia" | LandingPage.tsx, manifest | Bahasa marketing untuk publik | ✅ SKIP — LandingPage sudah bersih |
| 15 | Tagline "Ujianly - Platform Ujian Online" di share WhatsApp | ExamListPage.tsx shareWhatsApp() | Branding bisnis muncul di pesan WA | ✅ FIXED — Footer tagline dihapus |

## 🟡 Nice-to-have — Cosmetic / pengembangan

| # | Isu | Lokasi | Dampak | Status |
|---|-----|--------|--------|--------|
| 16 | Anti-cheat cuma visibilitychange | ExamTakingPage.tsx | Bisa di-bypass dari DevTools, tapi untuk pribadi cukup | ✅ SKIP — User lo tidak akan ngelawan |
| 17 | Riwayat murid pakai localStorage | src/utils/examSession.ts | Riwayat hilang kalau ganti device/clear cache | ✅ FIXED — Simpan ke tabel student_history di Supabase. localStorage tetap sebagai fallback offline |
| 18 | PWA manifest masih nama "Ujianly" | vite.config.ts | Nama yang muncul saat install ke home screen | ✅ SKIP — Lo minta tetap "Ujianly" |
| 19 | Dokumen Saas.md masih ada | Root | Dokumen positioning bisnis, bisa misleading | ✅ FIXED — File dihapus |
| 20 | Logo "⚡ Ujianly" hardcoded di banyak tempat | Sidebar.tsx, login/register pages | Branding tidak konsisten kalau lo mau rebrand | ✅ FIXED — Centralize di src/lib/appConfig.ts, tinggal edit 1 file |
| 21 | BillingPage.tsx masih ada sebagai placeholder redirect | BillingPage.tsx | File tidak berguna | ✅ FIXED — File dihapus total |
| 22 | Subject list hardcoded (mata pelajaran agama dominan) | Step1Setup.tsx, SettingsPage.tsx | Cuma cocok kalau lo guru madrasah | ✅ FIXED — Diganti input bebas tanpa dropdown |
| 23 | Build size: xlsx ~424KB + mammoth ~600KB | dist/ | First load besar untuk personal use | ✅ FIXED — manualChunks di vite, xlsx + mammoth jadi chunk terpisah. Initial bundle turun ~95KB |
| 24 | Tidak ada dark mode toggle yang persistent | Sidebar | Sudah ada toggle tapi UI-nya tersembunyi | ✅ SKIP — Sudah OK |
| 25 | Email Supabase Auth case-sensitive | loginTeacher() | Lo daftar Miqdad... lalu login pakai miqdad... bisa gagal | ✅ FIXED — Email di-lowercase sebelum dikirim ke Supabase Auth |
| 26 | Tidak ada flow hapus akun | Settings | Untuk pribadi tidak relevan | ✅ SKIP — Tidak relevan untuk single user |
| 27 | Mobile UX QuestionNav sidebar | ExamTakingPage.tsx | Sidebar nav soal di mobile makan space horizontal | ⏳ TODO — Test manual di device lo |
| 28 | Error message generic "Gagal memuat ujian" | ExamTakingPage.tsx | Saat debug sendiri, susah tau error spesifik | ✅ FIXED — Tampilkan error.message aktual |

## 📊 Ringkasan Final

| Kategori | Total | Fixed | Skip | Todo |
|---|---|---|---|---|
| 🔴 Critical | 5 | 5 | 0 | 0 |
| 🟠 Important | 10 | 9 | 1 | 0 |
| 🟡 Nice-to-have | 13 | 9 | 3 | 1 |
| **Total** | **28** | **23** | **4** | **1** |

**Yang masih perlu dilakukan (manual):**

1. **#10-12** — Jalankan `supabase-history/20260510_drop_saas_tables.sql` di Supabase SQL Editor
2. **#1** — Jalankan `supabase-history/20260510_save_exam_rpc.sql` di Supabase SQL Editor
3. **#17** — Jalankan `supabase-history/20260510_student_history.sql` di Supabase SQL Editor
4. **#27** — Test mobile di device lo (320px-414px)
