# Kritik Aplikasi Ujianly — Pemakaian Pribadi

Fokus: hal-hal yang berdampak ke pengalaman lo sebagai user tunggal. Isu multi-tenant/SaaS diabaikan.

## 🔴 Critical — Bisa bikin data hilang atau app crash

| # | Isu | Lokasi | Dampak | Saran |
|---|-----|--------|--------|-------|
| 1 | `saveExam` non-atomik: DELETE soal lama → INSERT soal baru | `src/utils/storage.ts` `saveExam()` | Network putus saat save = **semua soal di ujian itu hilang permanen** | ✅ **FIXED** — Diganti RPC `save_exam_full` yang transactional |
| 2 | Tidak ada Error Boundary | `src/App.tsx` | Error di komponen mana pun → blank screen, harus refresh manual | ✅ **FIXED** — `ErrorBoundary` dipasang di root App |
| 3 | `updateExam` field kecil → re-save semua soal | `src/context/AppContext.tsx` `updateExam()` | Edit judul saja → DELETE+INSERT semua soal. Risiko data hilang sama dengan #1 | ✅ **FIXED** — Meta-only update pakai `updateExamMeta()`, full save hanya kalau ada questions |
| 4 | `returnSubmission` set `isComplete: false` | `src/context/AppContext.tsx` | Submission yang dikembalikan untuk revisi **hilang dari tab Hasil** karena filter `isComplete: true` | ✅ **FIXED** — Hanya set `isReturned: true`, `isComplete` tidak diubah |
| 5 | Race condition di `ExamTakingPage` bootstrap | `src/pages/student/ExamTakingPage.tsx` line ~40 | StrictMode dev kadang bikin 2x session, submission_id kedua overwrite session pertama | ✅ **FIXED** — `bootstrapRef` guard agar useEffect hanya jalan sekali |

## 🟠 Important — Bikin frustrasi waktu pakai

| # | Isu | Lokasi | Dampak | Saran |
|---|-----|--------|--------|-------|
| 6 | Service Worker stale di dev mode | `vite.config.ts` `devOptions.enabled` (sekarang sudah `false`) | Sudah fix, tapi kalau lo unlock lagi: cache lama bikin request rusak (kasus 400 kemarin) | ✅ **FIXED** — Biarkan `false` di dev |
| 7 | `console.error` di production | `storage.ts`, `AppContext.tsx`, ~10 tempat | Noise di DevTools, error log bocor info struktur DB | ✅ **FIXED** — Vite `esbuild.drop: ['console','debugger']` di production build |
| 8 | Field `password` masih di tipe `Teacher` | `src/types/index.ts` | Sisa legacy — selalu kosong, bikin confused saat baca kode | ✅ **FIXED** — Field dihapus dari type dan semua referensinya |
| 9 | `hashPassword()` tidak dipakai | `src/utils/helpers.ts` | Dead code, bingungkan saat audit | ✅ **FIXED** — Fungsi dihapus |
| 10 | Table `workspaces`, `subscriptions`, `plans` di DB | Supabase | Sudah tidak dipakai code sama sekali, tapi data masih ada (bayar storage) | ✅ **FIXED** — SQL tersedia di `supabase-history/20260510_drop_saas_tables.sql` |
| 11 | Kolom `workspace_id` di `exams`, `questions`, `bank_questions`, dll | Supabase | Selalu null, kolom mati | ✅ **FIXED** — Termasuk dalam SQL drop di atas |
| 12 | Kolom `promo_payments_used`, `manual_payment_note` di `subscriptions` | Supabase | Tidak relevan, kalau tabel `subscriptions` masih ada | ✅ **FIXED** — Drop bareng tabel subscriptions |
| 13 | Migration `20260510_cleanup_and_billing_setup.sql` masih ada | `supabase-history/` | Punya logic billing + admin email hardcoded | ✅ **FIXED** — File dihapus |
| 14 | Wording "beta", "early adopter", "guru Indonesia" | `src/pages/LandingPage.tsx`, manifest, `dokumen.md` | Bahasa marketing untuk publik, ga relevan dipakai sendiri | ✅ **SKIP** — LandingPage sudah bersih, tidak ada wording marketing |
| 15 | Tagline "Ujianly - Platform Ujian Online" di share WhatsApp | `ExamListPage.tsx` `shareWhatsApp()` | Branding bisnis muncul di pesan WA | ✅ **FIXED** — Footer tagline dihapus dari pesan WA |

## 🟡 Nice-to-have — Cosmetic / pengembangan

| # | Isu | Lokasi | Dampak | Saran |
|---|-----|--------|--------|-------|
| 16 | Anti-cheat cuma `visibilitychange` | `ExamTakingPage.tsx` | Bisa di-bypass dari DevTools, tapi untuk pribadi cukup | ✅ **SKIP** — User lo tidak akan ngelawan |
| 17 | Riwayat murid pakai `localStorage` | `src/utils/examSession.ts` | Riwayat hilang kalau ganti device/clear cache | Pindah ke tabel `student_history` di Supabase |
| 18 | PWA manifest masih nama "Ujianly" | `vite.config.ts` | Nama yang muncul saat install ke home screen | Ganti ke nama yang lo mau |
| 19 | Dokumen `Saas.md` masih ada | Root | Dokumen positioning bisnis, bisa misleading saat baca ulang nanti | Hapus atau rename `roadmap_lama.md` |
| 20 | Logo "⚡ Ujianly" hardcoded | `Sidebar.tsx`, login/register pages | Branding tidak konsisten kalau lo mau rebrand | Centralize di constant |
| 21 | Tombol "Upgrade Pro via WhatsApp" reference (sudah ke-hapus) | `BillingPage.tsx` | File jadi placeholder redirect, bisa dihapus total | Hapus file + import lazy di App.tsx |
| 22 | Subject list hardcoded (mata pelajaran agama dominan) | `Step1Setup.tsx`, `SettingsPage.tsx` | Cuma cocok kalau lo guru madrasah | Edit list sesuai mapel lo |
| 23 | Build size: `xlsx` ~424KB + `mammoth` ~600KB | `dist/` | First load besar untuk personal use | ✅ **FIXED** — `manualChunks` di vite, xlsx + mammoth jadi chunk terpisah. Initial bundle turun ~95KB |
| 24 | Tidak ada dark mode toggle yang persistent | Sidebar | Sudah ada toggle tapi UI-nya tersembunyi | ✅ **SKIP** — Sudah OK |
| 25 | Email Supabase Auth case-sensitive | `loginTeacher()` | Lo daftar `Miqdad...` lalu login pakai `miqdad...` bisa gagal | ✅ **FIXED** — Email di-lowercase sebelum dikirim ke Supabase Auth |
| 26 | Tidak ada flow hapus akun | Settings | Untuk pribadi tidak relevan, tapi data lo nempel di Supabase | ✅ **SKIP** — Tidak relevan untuk single user |
| 27 | Mobile UX `QuestionNav` sidebar | `ExamTakingPage.tsx` | Sidebar nav soal di mobile makan space horizontal | Test 320px-414px, tambah breakpoint kalau perlu |
| 28 | Error message generic "Gagal memuat ujian" | `ExamTakingPage.tsx` | Saat debug sendiri, susah tau error spesifik | ✅ **FIXED** — Tampilkan `error.message` aktual |

## 📊 Ringkasan

| Kategori | Jumlah | Prioritas |
|---|---|---|
| 🔴 Critical | 5 | Fix sebelum dipakai serius |
| 🟠 Important | 10 | Fix sambil jalan |
| 🟡 Nice-to-have | 13 | Optional |

**Rekomendasi urutan fix:**

1. Item #1, #3 (saveExam transactional) — paling sering dipakai, paling besar risiko
2. Item #2 (Error Boundary) — safety net umum
3. Item #4 (returnSubmission) — fitur rusak
4. Item #10-13 (cleanup tabel SaaS DB) — bersihkan database
5. Item #14, #18, #19, #22 (rebrand sesuai pemakaian lo) — UX personal
6. Sisanya bisa di-skip atau dikerjakan saat senggang
