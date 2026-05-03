# Ujianly - Ringkasan Lengkap Aplikasi

Dokumen ini dibuat agar agent AI bisa memahami keseluruhan aplikasi Ujianly hanya dari satu file ini.

## Gambaran Umum

Ujianly adalah aplikasi web/PWA untuk membuat, membagikan, mengerjakan, dan menilai ujian online. Target pengguna utamanya adalah guru dan murid Indonesia.

Aplikasi memiliki dua mode utama:

- Guru: login/register, dashboard, membuat ujian, mengelola bank soal, melihat hasil, memberi nilai essay, memberi feedback, mengatur akun.
- Murid: masuk ujian dengan kode, mengisi identitas, membaca instruksi, mengerjakan ujian, autosave/resume, melihat hasil/riwayat.

Stack utama:

- React 18 + TypeScript.
- Vite sebagai dev server/build tool.
- React Router DOM untuk routing.
- Supabase Auth dan database sebagai backend.
- Vite PWA untuk service worker dan manifest.
- XLSX untuk import/export Excel/CSV.
- Mammoth untuk import Word `.docx`.
- Lucide React untuk ikon.
- DnD Kit untuk drag-and-drop reorder soal.

## Cara Menjalankan

Script tersedia di `package.json`:

- `npm run dev`: menjalankan Vite dev server.
- `npm run build`: menjalankan `tsc` lalu `vite build`.
- `npm run lint`: menjalankan ESLint.
- `npm run preview`: preview hasil build.

Environment yang dibutuhkan:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Client Supabase dibuat di `src/lib/supabase.ts`. Jika env kosong, aplikasi hanya memberi `console.warn`, tetapi operasi backend tidak akan berfungsi.

## Struktur Folder Penting

- `src/main.tsx`: entry React, import CSS global dan components.
- `src/App.tsx`: routing utama, lazy loading halaman, provider global, toast, network banner.
- `src/context/AppContext.tsx`: state global dan API context untuk auth, ujian, bank soal, submission, toast.
- `src/types/index.ts`: semua tipe/domain utama aplikasi.
- `src/utils/storage.ts`: data layer Supabase dan queue submission offline.
- `src/utils/examSession.ts`: session lokal murid, autosave localStorage, resume, attempt validation, build submission.
- `src/utils/helpers.ts`: helper ID, kode ujian, scoring, formatter, validasi.
- `src/utils/importParser.ts`: import Excel/CSV/Word, template Excel, export hasil.
- `src/hooks/useCountdown.ts`: timer countdown untuk ujian.
- `src/components/layout`: layout guru dan sidebar.
- `src/components/ui`: komponen UI reusable seperti toast, modal, badge, loader.
- `src/components/exam`: editor soal, modal import, modal bank soal.
- `src/pages/auth`: login dan register guru.
- `src/pages/teacher`: halaman guru.
- `src/pages/teacher/wizard`: step wizard pembuatan ujian.
- `src/pages/student`: halaman murid.
- `src/pages/student/exam`: komponen pengalaman mengerjakan ujian.
- `src/styles/global.css`: design tokens dan style global.
- `src/styles/components.css`: style komponen/layout responsif.
- `supabase_medium_features_migration.sql`: migration kolom `anti_cheat_events`.
- `supabase_submission_feedback_migration.sql`: migration kolom `teacher_feedback` dan `is_returned`.
- `dist` dan `dev-dist`: hasil build/service worker, bukan sumber utama.
- `public`: ikon PWA.

## Routing Aplikasi

Routing didefinisikan di `src/App.tsx`.

Public routes:

- `/`: landing page.
- `/login`: login guru.
- `/daftar`: register guru.
- `/ujian`: murid memasukkan kode ujian.
- `/ujian/:code/instruksi`: halaman instruksi sebelum mulai.
- `/ujian/:code/kerjakan`: halaman pengerjaan ujian.
- `/riwayat`: riwayat ujian murid dari localStorage.

Teacher routes, dibungkus `TeacherLayout`:

- `/guru`: redirect ke `/guru/dashboard`.
- `/guru/dashboard`: dashboard guru.
- `/guru/ujian`: daftar ujian.
- `/guru/ujian/baru`: wizard buat ujian.
- `/guru/bank-soal`: bank soal.
- `/guru/hasil`: hasil dan nilai.
- `/guru/pengaturan`: pengaturan akun.

Fallback route `*` redirect ke `/`.

## Model Domain Utama

Tipe utama ada di `src/types/index.ts`.

### Teacher

Guru memiliki:

- `id`: sama dengan Supabase Auth user id.
- `name`, `email`, `subject`, `institution`.
- `password`: ada di tipe, tetapi setelah migrasi Supabase selalu dikosongkan di client.
- `createdAt`.

### Exam

Ujian memiliki:

- `id`, `teacherId`, `title`, `description`, `subject`, `className`.
- `examType`: `UJIAN`, `TUGAS`, atau `LATIHAN`.
- `format`: `PG_ONLY`, `ESSAY_ONLY`, atau `COMBINATION`.
- `status`: `DRAFT`, `ACTIVE`, `ENDED`, atau `ARCHIVED`.
- `code`: kode 6 karakter uppercase alphanumeric untuk murid.
- `settings`: timer, attempt, result visibility, shuffle, anti-cheat.
- `questions`: array soal.
- `preloadedStudents`: daftar murid whitelist opsional.
- `activeFrom`, `activeTo`: jadwal buka/tutup.
- `createdAt`, `updatedAt`.

Catatan: properti timer ujian di tipe bernama `wholExamTimerSeconds`, bukan `wholeExamTimerSeconds`. Ini typo yang sudah dipakai di kode, jadi agent harus konsisten memakai nama tersebut kecuali melakukan refactor menyeluruh.

### Question

Soal memiliki:

- `id`, `type`, `text`, `imageUrl`, `weight`, `timerSeconds`, `tags`, `order`.
- Untuk pilihan ganda: `options` dan `correctOptionId`.
- Untuk essay: `answerGuide`.

Jenis soal:

- `MULTIPLE_CHOICE`
- `ESSAY`

### BankQuestion

`BankQuestion` memperluas `Question` dengan:

- `teacherId`, `subject`, `className`.
- `usedInExamIds`.
- `createdAt`, `updatedAt`.

### Submission

Submission murid memiliki:

- `id`, `examId`, `studentName`, `nis`, `attemptNumber`.
- `answers`: jawaban murid.
- `mcScore`: skor pilihan ganda otomatis.
- `essayScores`: nilai essay manual dari guru.
- `totalScore`: opsional, biasanya terisi setelah essay dinilai.
- `teacherFeedback`: feedback/komentar guru.
- `antiCheatEvents`: daftar event anti-cheat, saat ini `TAB_HIDDEN`.
- `startedAt`, `submittedAt`, `isComplete`, `isReturned`.

Draft/autosave submission memiliki `isComplete: false`. Submission final memiliki `isComplete: true`.

## Data Layer Supabase

Semua akses backend utama ada di `src/utils/storage.ts`.

Tabel Supabase yang dipakai/inferensi dari kode:

- `teachers`
- `exams`
- `questions`
- `preloaded_students`
- `submissions`
- `student_answers`
- `bank_questions`

Mapping penting:

- `teachers.id` sama dengan `auth.users.id`.
- `exams.teacher_id` menjadi `Exam.teacherId`.
- `exams.class_name` menjadi `Exam.className`.
- `exams.exam_type` menjadi `Exam.examType`.
- `exams.settings` menyimpan object `ExamSettings` sebagai JSON.
- `questions.options` menyimpan array opsi sebagai JSON.
- `questions.correct_option_id` menjadi `Question.correctOptionId`.
- `submissions.anti_cheat_events` menjadi `Submission.antiCheatEvents`.
- `submissions.teacher_feedback` menjadi `Submission.teacherFeedback`.
- `submissions.is_returned` menjadi `Submission.isReturned`.
- `student_answers.essay_score` dan `essay_comment` dipakai untuk membangun `essayScores`.

Operasi penting di `storage`:

- `registerTeacher`: Supabase Auth signUp lalu upsert profil ke `teachers`.
- `loginTeacher`: Supabase Auth signIn lalu ambil profil `teachers`.
- `logout`: Supabase Auth signOut.
- `getCurrentTeacher`: baca user aktif dari Supabase Auth lalu profil `teachers`.
- `updateTeacher`: update nama, mapel, institusi.
- `requestPasswordReset`: kirim reset password via Supabase Auth.
- `getExamsByTeacher`: ambil exam guru beserta questions dan preloaded_students.
- `getExamByCode`: ambil exam publik berdasarkan kode, dipakai murid tanpa login guru.
- `saveExam`: upsert exam, hapus lalu insert ulang questions dan preloaded_students.
- `deleteExam`: hapus exam.
- `getSubmissionsByTeacher`: ambil semua submission untuk exam milik guru.
- `getSubmissionsByExam`: ambil submissions untuk satu exam.
- `saveSubmission`: upsert submission, hapus lalu insert ulang student_answers.
- `syncPendingSubmissions`: kirim ulang submission yang gagal tersimpan.
- `getBankQuestions`, `saveBankQuestion`, `deleteBankQuestion`.

Catatan data layer:

- `saveExam` mengganti seluruh daftar questions dan preloaded_students setiap simpan.
- `saveSubmission` mengganti seluruh daftar student_answers setiap simpan.
- Jika simpan submission gagal, submission masuk localStorage queue `ujianly_pending_submission_queue`.
- Queue offline disinkronkan saat app init dan saat event browser `online` di `AppContext`.

## Global State dan Context

`AppProvider` di `src/context/AppContext.tsx` membungkus seluruh app.

State global:

- `currentTeacher`
- `isLoading`
- `exams`
- `bankQuestions`
- `submissions`
- `toasts`

Context menyediakan hook:

- `useApp`: akses semua state/action.
- `useAuth`: auth subset.
- `useExams`: exam subset.
- `useBank`: bank soal subset.
- `useToast`: toast subset.

Saat app mount:

- `storage.getCurrentTeacher()` dipanggil.
- Jika guru masih login, app memuat exams, bank questions, dan submissions milik guru secara paralel.
- Jika tidak ada guru, loading selesai tanpa data guru.

Behavior penting:

- Banyak operasi memakai optimistic UI, misalnya create/update/delete exam dan bank question.
- `createExam` di context ada, tetapi wizard `CreateExamPage` memilih membuat object exam lengkap dan langsung `storage.saveExam` agar tidak terkena race condition state React.
- `publishExam`, `archiveExam`, dan `endExam` hanya update status.
- `gradeEssay` menambah/mengubah nilai essay lalu update `totalScore` menjadi `mcScore + essayTotal`.
- `returnSubmission` mengubah `isComplete: false` dan `isReturned: true` supaya jawaban dibuka kembali untuk revisi.
- Toast otomatis hilang setelah 5 detik.

## Flow Guru

### Register dan Login

Register guru:

- Route `/daftar`.
- Input nama, email, password, mata pelajaran, institusi.
- `AppContext.register` memanggil `storage.registerTeacher`.
- Supabase Auth membuat user, lalu profil guru disimpan di tabel `teachers`.
- Setelah berhasil, `currentTeacher` diset dan guru masuk dashboard.

Login guru:

- Route `/login`.
- `AppContext.login` memanggil `storage.loginTeacher`.
- Setelah berhasil, app memuat exams, bank questions, dan submissions guru.

Protected layout:

- Semua route `/guru/*` dibungkus `TeacherLayout`.
- Jika tidak login, layout seharusnya redirect ke login.
- Sidebar menyediakan navigasi guru.

### Dashboard

Dashboard menampilkan ringkasan data guru seperti statistik ujian, status, dan aktivitas. Datanya berasal dari `exams`, `submissions`, dan `currentTeacher` di context.

### Daftar Ujian

Halaman `/guru/ujian` menampilkan ujian guru dengan fitur daftar/filter/search/action. Action yang didukung oleh context:

- Publish: status `ACTIVE`.
- End: status `ENDED`.
- Archive: status `ARCHIVED`.
- Duplicate: membuat exam draft baru dengan kode baru dan copy soal.
- Delete: hapus exam.

Kode ujian dibuat dengan `generateExamCode`, 6 karakter dari alfabet yang menghindari karakter ambigu: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

### Wizard Buat Ujian

Route `/guru/ujian/baru`, file `src/pages/teacher/CreateExamPage.tsx`.

Wizard 5 langkah:

1. `Step1Setup`: judul, deskripsi, mapel, kelas, tipe ujian, jadwal aktif, settings, preloaded students.
2. `Step2Format`: pilih format `PG_ONLY`, `ESSAY_ONLY`, atau `COMBINATION`.
3. `Step3Questions`: input soal manual, import, ambil dari bank soal, duplikasi/edit.
4. `Step4Review`: review final dan reorder soal.
5. `Step5Publish`: tampilkan kode/link, publish, finish.

Default settings wizard:

- `timerMode: NONE`
- `wholExamTimerSeconds: 3600`
- `perQuestionDefaultSeconds: 60`
- `maxAttempts: 1`
- `showScoreAfterSubmit: true`
- `showAnswerKeyAfterSubmit: false`
- `releaseResultsAfterGrading: false`
- `shuffleQuestions: false`
- `shuffleOptions: false`
- `antiCheatSensitivity: MEDIUM`

Jika format diganti dan ada soal yang tidak kompatibel, soal tersebut difilter dan toast warning muncul.

Pada akhir Step 4, `CreateExamPage` membuat object `Exam` lengkap dengan status `DRAFT`, menyimpan via `storage.saveExam`, lalu `refreshExams`.

### Editor Soal

Komponen utama di `src/components/exam/QuestionEditor.tsx`.

Soal mendukung:

- Pilihan ganda dengan minimal 2 opsi dan 1 opsi benar.
- Essay dengan panduan jawaban.
- Bobot nilai.
- Tag.
- Timer per soal.
- Gambar via `imageUrl`.

Validasi dasar ada di `validateQuestion`:

- Teks soal wajib.
- PG wajib punya minimal 2 opsi, jawaban benar, dan semua opsi terisi.
- Bobot harus lebih dari 0.

### Import Soal

Parser ada di `src/utils/importParser.ts`.

Format file yang didukung:

- Excel `.xlsx`, `.xls`.
- CSV `.csv`.
- Word `.docx`.

Kolom Excel/CSV yang didukung:

- `Tipe`
- `Pertanyaan` atau `Soal`
- `Opsi A` sampai `Opsi F`
- `Kunci`
- `Bobot`
- `Tag`
- `Panduan Jawaban`

Nilai tipe yang diterima:

- PG: `PG`, `MC`, `PILIHAN_GANDA`, `MULTIPLE_CHOICE`, atau kosong sebagai default.
- Essay: `ESSAY`, `E`, `URAIAN`.

Format Word yang didukung:

- Setiap soal dipisah baris kosong atau numbering.
- Kunci PG ditandai `*A.`, `*B.`, dll atau baris `Kunci: A`.
- Essay ditandai `[Essay]` di awal soal.
- Bobot memakai `Bobot: 5`.
- Tag memakai `Tag: IPA, Biologi`.

`downloadExcelTemplate` membuat template Excel contoh.

### Bank Soal

Route `/guru/bank-soal`, file `QuestionBankPage.tsx`.

Fitur:

- Menampilkan soal pribadi guru.
- Search berdasarkan teks soal, mapel, atau kelas.
- Filter tipe soal PG/Essay.
- Filter tag.
- Group by kelas, mapel, atau tanpa grouping.
- Preview soal.
- Edit soal.
- Hapus soal.
- Share satu soal sebagai JSON ke clipboard.
- Import soal bersama dari payload JSON.

Bank soal disimpan di tabel `bank_questions`.

Catatan: import soal bersama saat ini melakukan `location.reload()` setelah simpan agar data termuat ulang.

### Hasil dan Nilai

Route `/guru/hasil`, file `ResultsPage.tsx`.

Fitur:

- Pilih ujian non-draft.
- Tabel peserta yang sudah submit (`isComplete: true`).
- Statistik ringkas: total peserta, rata-rata, max poin, median, nilai tertinggi, ketuntasan, status essay dinilai.
- Statistik lanjutan: distribusi nilai dan top 5 ranking.
- Analitik soal PG: jumlah menjawab, jumlah benar, persentase benar.
- Detail submission: jawaban per soal.
- Penilaian essay manual per soal, termasuk komentar per soal.
- Feedback guru untuk submission.
- Return/revisi submission dengan `isComplete: false`, `isReturned: true`.
- Export Excel rekap lengkap, termasuk jawaban detail dan jumlah pelanggaran anti-cheat.

Skor PG dihitung otomatis dari jawaban benar. Skor essay disimpan di `essayScores`, sumber DB-nya adalah kolom `essay_score` dan `essay_comment` pada `student_answers`.

### Pengaturan Akun

Route `/guru/pengaturan`.

Fungsi data layer yang relevan:

- `storage.updateTeacher` untuk update nama, mapel, institusi.
- `storage.requestPasswordReset` untuk reset password via email Supabase.

## Flow Murid

### Masuk Ujian

Route `/ujian`, file `JoinExamPage.tsx`.

Langkah:

1. Murid memasukkan kode 6 karakter.
2. App memanggil `storage.getExamByCode(code)` langsung ke Supabase.
3. Jika exam tidak ditemukan atau status bukan `ACTIVE`, tampil error.
4. App mengambil submissions exam untuk validasi attempt.
5. Murid mengisi nama dan identitas nomor opsional.
6. Jika exam punya `preloadedStudents`, nama atau NIS harus cocok dengan whitelist.
7. `validateExamAccess` memeriksa status, jadwal aktif, batas attempt, dan session lokal yang bisa di-resume.
8. Jika ada session belum submit, user diarahkan ke pilihan resume.
9. Jika valid, user diarahkan ke instruksi lalu pengerjaan.

Identitas nomor bisa NISN atau nomor absen. Secara teknis field ini disimpan sebagai `nis`. Jika kosong, fallback identifier adalah nama murid.

### Instruksi

Route `/ujian/:code/instruksi`.

Halaman instruksi membaca data navigasi dari `JoinExamPage`, lalu mengarahkan ke `/ujian/:code/kerjakan` untuk mulai.

### Session Ujian Murid

Session lokal dikelola oleh `src/utils/examSession.ts`.

Key localStorage:

- `kk_session_${code}_${nis}` untuk session ujian aktif.
- `ujianly_student_history` untuk riwayat hasil murid.
- `ujianly_pending_submission_queue` untuk queue submission yang gagal dikirim.

Isi session:

- `submissionId`
- `examId`, `examCode`
- `studentName`, `nis`
- `attemptNumber`
- `answers`
- `startedAt`
- `remainingSeconds` untuk whole-exam timer.
- `currentQuestionIndex`
- `isSubmitted`

Fungsi penting:

- `createSession`: membuat session baru dan simpan localStorage.
- `loadSession`: baca session lama.
- `saveSession`: simpan session.
- `clearSession`: hapus session setelah submit final.
- `upsertAnswer`: tambah/update jawaban dan autosave lokal.
- `updateTimer`: simpan sisa waktu whole exam.
- `updateCurrentIndex`: simpan posisi soal.
- `buildSubmission`: membuat final submission `isComplete: true`.
- `buildDraftSubmission`: membuat draft submission `isComplete: false`.
- `validateExamAccess`: validasi akses murid sebelum mulai/resume.

### Mengerjakan Ujian

Route `/ujian/:code/kerjakan`, file `ExamTakingPage.tsx`.

Saat mount:

- Wajib ada `state.examId` dari route navigation; jika tidak ada, redirect ke `/ujian`.
- Ambil ulang exam dengan `storage.getExamByCode(code)`.
- Validasi exam id cocok.
- Jika soal kosong, tampil error.
- Urutkan soal berdasarkan `order`.
- Jika `shuffleQuestions` aktif, shuffle soal.
- Jika `shuffleOptions` aktif, shuffle opsi tiap soal.
- Load session lokal jika resume, atau buat session baru.

Autosave:

- Jawaban selalu disimpan ke localStorage saat berubah.
- Setiap 5 detik, jika ada jawaban dan belum submit, app menyimpan draft submission ke Supabase dengan `isComplete: false`.
- Jika save ke Supabase gagal, data masuk pending queue.

Submit final:

- Sebelum submit, app mengambil ulang exam terbaru dari Supabase.
- App memastikan exam masih `ACTIVE`, jadwal masih valid, dan attempt belum melewati limit.
- App membangun final submission dengan `buildSubmission`.
- Anti-cheat events ditambahkan ke submission.
- `storage.saveSubmission` dipanggil.
- Session lokal dihapus setelah save selesai.
- UI langsung menampilkan `ResultScreen`.

### Timer

Timer memakai `useCountdown`.

Mode timer:

- `NONE`: tanpa timer.
- `WHOLE_EXAM`: satu timer untuk seluruh ujian, sumber detik dari `settings.wholExamTimerSeconds`, default 3600.
- `PER_QUESTION`: timer per soal, sumber dari `question.timerSeconds` atau `settings.perQuestionDefaultSeconds`, default 60.

Behavior timer:

- Whole-exam timer autosubmit saat habis.
- Sisa whole-exam timer disimpan tiap 5 detik ke localStorage.
- Per-question timer pindah ke soal berikutnya saat habis, atau autosubmit jika soal terakhir.
- Per-question timer reset ketika soal berubah.

### Anti-Cheat

Anti-cheat ada di `ExamTakingPage.tsx`.

Mekanisme:

- Listen event `document.visibilitychange`.
- Jika tab/window hidden, violations bertambah.
- Event disimpan sebagai `{ type: 'TAB_HIDDEN', timestamp, count }`.
- Warning banner tampil 5 detik.
- Jika pelanggaran mencapai batas, ujian autosubmit.

Batas pelanggaran berdasarkan `antiCheatSensitivity`:

- `OFF`: anti-cheat mati.
- `LOW`: 5 pelanggaran.
- `MEDIUM`: 3 pelanggaran.
- `HIGH`: 1 pelanggaran.

### Hasil Murid

`ResultScreen.tsx` tampil setelah submit.

Aturan tampilan skor:

- `showScoreAfterSubmit` harus true.
- Jika ada essay dan `releaseResultsAfterGrading` true, nilai final ditahan sampai exam status `ENDED`.
- Skor PG bisa tampil langsung jika setting mengizinkan.
- Kunci jawaban hanya tampil jika `showAnswerKeyAfterSubmit` true dan exam status `ENDED`.
- Feedback guru tampil jika ada di submission.

`ResultScreen` menyimpan ringkasan ke localStorage `ujianly_student_history`, maksimal 50 entry.

### Riwayat Murid

Route `/riwayat`, file `StudentHistoryPage.tsx`.

Riwayat berasal dari localStorage `ujianly_student_history`, bukan Supabase. Artinya riwayat lokal bergantung pada device/browser yang sama.

## Import, Export, dan Scoring

Scoring helper di `src/utils/helpers.ts`:

- `calcMCScore`: menjumlahkan bobot soal PG yang benar.
- `calcMaxMCScore`: total bobot PG.
- `calcMaxEssayScore`: total bobot essay.
- `calcMaxTotalScore`: total semua bobot.
- `calcSubmissionTotalScore`: `mcScore + total essayScores`.

Export hasil:

- Ada fungsi `exportResultsToExcel` di `importParser.ts`.
- `ResultsPage.tsx` juga punya export Excel sendiri yang lebih detail, termasuk jawaban per soal, skor, komentar, dan pelanggaran anti-cheat.

## PWA

Konfigurasi PWA ada di `vite.config.ts` memakai `vite-plugin-pwa`.

Manifest:

- `name`: `Ujianly - Ujian Online`
- `short_name`: `Ujianly`
- `description`: platform ujian dan kuis online untuk guru/murid Indonesia.
- `theme_color`: `#4F6EF7`
- `background_color`: `#0C0E1A`
- `display`: `standalone`
- Icon: `pwa-192x192.png`, `pwa-512x512.png`, maskable icon.

`devOptions.enabled: true`, sehingga PWA juga aktif di mode dev.

## UI dan Styling

CSS utama:

- `src/styles/global.css`
- `src/styles/components.css`

App memakai CSS variables seperti:

- `--bg`
- `--surface`
- `--surface-2`
- `--text-primary`
- `--text-muted`
- `--primary`
- `--secondary`
- `--success`
- `--warning`
- `--danger`
- `--border`
- `--r-md`, `--r-lg`, `--r-xl`
- `--sp-*`

Banyak halaman memakai inline style yang tetap bergantung pada CSS variables tersebut.

Komponen UI reusable berada di `src/components/ui/index.tsx`, termasuk loading, toast, modal, empty state, badge, status, network banner.

## Hal yang Perlu Diperhatikan Agent AI

- Jangan edit `dist`, `dev-dist`, atau `node_modules` untuk perubahan source aplikasi.
- Source utama ada di `src`.
- Jangan commit `.env` atau membocorkan Supabase keys.
- `Teacher.password` masih ada di tipe lama, tetapi auth sebenarnya memakai Supabase Auth dan password tidak disimpan di client.
- Nama field `wholExamTimerSeconds` typo tetapi aktif dipakai di banyak tempat.
- Murid tidak login; akses ujian publik berdasarkan kode exam dan validasi di client/Supabase query.
- `saveExam` dan `saveSubmission` menggunakan pola hapus lalu insert ulang untuk child rows. Perubahan pada children harus mempertimbangkan efek overwrite.
- Hasil murid lokal (`ujianly_student_history`) tidak otomatis sinkron antar device.
- Autosave memiliki dua lapis: localStorage session untuk resume cepat dan draft submission Supabase untuk recoverability.
- Queue offline hanya untuk submission, bukan semua operasi guru.
- Anti-cheat saat ini hanya mendeteksi tab/window hidden.
- `validateExamAccess` memakai completed submissions (`isComplete: true`) untuk batas attempt.
- Returned submission diubah menjadi `isComplete: false`, sehingga tidak muncul di daftar hasil yang hanya filter `isComplete`.
- Banyak flow murid mengandalkan `location.state`; direct open ke `/ujian/:code/kerjakan` tanpa state akan redirect ke `/ujian`.
- Import Word parsing sederhana dan berbasis text extraction, bukan layout kompleks.
- Export Excel di `ResultsPage` lebih lengkap daripada helper umum di `importParser.ts`.

## Ringkasan Alur End-to-End

Alur guru membuat ujian:

1. Guru register/login.
2. Guru buka `/guru/ujian/baru`.
3. Guru mengisi metadata, settings, format, soal, review.
4. App menyimpan exam draft lengkap ke Supabase.
5. Guru publish exam sehingga status menjadi `ACTIVE`.
6. Guru membagikan kode/link ujian ke murid.

Alur murid mengerjakan:

1. Murid buka `/ujian`.
2. Murid masukkan kode 6 karakter.
3. App mencari exam aktif di Supabase.
4. Murid isi nama dan identitas opsional.
5. App validasi whitelist, jadwal, status, attempt, dan resume session.
6. Murid membaca instruksi lalu mulai ujian.
7. Jawaban autosave lokal dan draft autosave ke Supabase.
8. Submit final menghitung skor PG, menyimpan submission, dan menghapus session lokal.
9. Murid melihat hasil sesuai setting guru.

Alur guru menilai:

1. Guru buka `/guru/hasil`.
2. Guru pilih exam.
3. App menampilkan submission complete.
4. Skor PG sudah otomatis.
5. Guru memberi nilai essay dan komentar.
6. Guru bisa memberi feedback umum, return untuk revisi, atau export Excel.

## File Referensi Cepat

- Routing: `src/App.tsx`
- State global: `src/context/AppContext.tsx`
- Tipe data: `src/types/index.ts`
- Supabase data layer: `src/utils/storage.ts`
- Session ujian murid: `src/utils/examSession.ts`
- Scoring/formatter/validasi: `src/utils/helpers.ts`
- Import/export: `src/utils/importParser.ts`
- Wizard ujian: `src/pages/teacher/CreateExamPage.tsx` dan `src/pages/teacher/wizard/*`
- Join ujian: `src/pages/student/JoinExamPage.tsx`
- Pengerjaan ujian: `src/pages/student/ExamTakingPage.tsx`
- Hasil murid: `src/pages/student/exam/ResultScreen.tsx`
- Hasil guru: `src/pages/teacher/ResultsPage.tsx`
- Bank soal: `src/pages/teacher/QuestionBankPage.tsx`
- PWA config: `vite.config.ts`
