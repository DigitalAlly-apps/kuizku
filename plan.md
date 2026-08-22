# PLAN PERBAIKAN KUIZKU

Repository: `DigitalAlly-apps/kuizku`  
Fokus: stabilisasi alur guru → publish ujian → murid buka → kerjakan → submit, sekaligus persiapan perpindahan ke Supabase baru.

## 1. Ringkasan Temuan Utama

Setelah membaca struktur dan alur kode Kuizku, masalah utama bukan hanya project Supabase lama yang mati atau terkena limit. Ada beberapa kelemahan arsitektur yang bisa membuat guru merasa ujian sudah berhasil dipublikasikan, sementara murid tetap gagal membuka ujian.

Temuan terpenting:

1. Publish ujian bisa terlihat berhasil walaupun database belum tentu benar-benar berubah.
2. Error Supabase di portal murid disamarkan menjadi “kode tidak ditemukan”.
3. Query murid anonymous mengambil banyak tabel sekaligus dan sangat bergantung pada RLS.
4. Murid membaca seluruh submission suatu ujian untuk mengecek attempt/resume.
5. Penyimpanan submission bisa gagal tetapi UI tetap melanjutkan seolah save berhasil.
6. Kuizku bergantung pada RPC `save_exam_full`.
7. History GitHub menunjukkan portal murid sebelumnya memang pernah bermasalah karena ketergantungan ke auth guru.
8. Integrasi Supabase hanya memakai satu client frontend dengan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`.
9. File `.env` terlihat ter-track di repository dan harus ditinjau dari sisi keamanan.

## 2. Flow Aplikasi Saat Ini

### Guru

`CreateExamPage`
→ membuat object exam status `DRAFT`
→ `storage.saveExam()`
→ RPC `save_exam_full`
→ Step 5
→ `publishExam(exam.id)`
→ `updateExam(id, { status: 'ACTIVE' })`
→ `storage.updateExamMeta()`

### Murid

`JoinExamPage`
→ input kode
→ `storage.getExamByCode(code)`
→ query:

`exams + questions + preloaded_students`

→ cek status `ACTIVE`
→ `getSubmissionsByExam(exam.id)`
→ validasi attempt
→ `InstructionsPage`
→ query exam ulang
→ `ExamTakingPage`
→ query exam ulang
→ query submissions ulang
→ autosave / submit

Arsitektur ini terlalu banyak mengandalkan direct table access dari client anonymous.

---

# PRIORITAS P0 — HIDUPKAN BACKEND DULU

## 3. Migrasi / Transfer Supabase

Prioritas pertama adalah memindahkan backend Kuizku ke Supabase baru.

Metode utama:

**Transfer project Supabase lama ke organization akun baru jika masih memungkinkan.**

Jangan langsung membuat ulang database secara manual jika transfer project masih bisa dilakukan.

Alasan:
- UUID Auth user tetap sama.
- Database tetap sama.
- RLS tetap sama.
- RPC tetap sama.
- Trigger tetap sama.
- Storage tetap sama.
- Relasi teacher/exam/submission tidak rusak.

Jika project lama tidak bisa ditransfer dan harus memakai project baru, lakukan migrasi manual secara lengkap.

Yang wajib dipindahkan:

- `teachers`
- `exams`
- `questions`
- `preloaded_students`
- `submissions`
- `student_answers`
- `bank_questions`
- `workspaces`
- `subscriptions`
- tabel tambahan lain yang ditemukan

Juga wajib:

- Supabase Auth users
- RLS policies
- PostgreSQL functions
- RPC
- triggers
- indexes
- constraints
- storage buckets
- Edge Functions jika ada
- Auth configuration

RPC penting yang harus diverifikasi:

`save_exam_full`

Tanpa RPC ini, wizard guru tidak dapat menyimpan exam lengkap seperti implementasi sekarang.

---

# PRIORITAS P1 — FIX FALSE SUCCESS PUBLISH

## 4. Masalah Publish Guru

Saat ini:

`publishExam(id)`

hanya memanggil:

`updateExam(id, { status: 'ACTIVE' })`

dan akhirnya:

`supabase.from('exams').update(payload).eq('id', id)`

Masalah:

Frontend hanya memeriksa `error`.

Tidak ada verifikasi apakah row benar-benar ter-update.

Dalam kondisi RLS tertentu, update bisa gagal secara efektif / tidak mengenai row tetapi UI tetap berpotensi menganggap proses berhasil.

## Solusi

Refactor `storage.updateExamMeta()` agar:

1. update row,
2. return row hasil update,
3. cek jumlah row,
4. cek status final.

Target:

```ts
const { data, error } = await supabase
  .from('exams')
  .update(payload)
  .eq('id', id)
  .select('id,status')
  .single();
```

Jika:
- `error`
- data kosong
- status bukan `ACTIVE`

maka publish dianggap gagal.

Setelah publish berhasil:

query ulang exam dari server.

Jangan gunakan optimistic local state sebagai bukti publish berhasil.

UI baru boleh menampilkan:

“Ujian berhasil dipublikasikan”

setelah server mengonfirmasi status `ACTIVE`.

---

# PRIORITAS P2 — ERROR HANDLING PORTAL MURID

## 5. Masalah getExamByCode

Saat ini `getExamByCode()` mengembalikan `null` pada hampir semua error.

Akibatnya:

- kode memang tidak ada
- RLS menolak
- Supabase down
- project pause
- network error
- relational query gagal

semuanya terlihat oleh murid sebagai:

“Kode tidak ditemukan.”

Ini menyulitkan debugging dan menyesatkan guru maupun murid.

## Solusi

Ubah return value menjadi structured result.

Contoh:

```ts
type ExamLookupResult = {
  exam: Exam | null;
  error?: {
    type:
      | 'NOT_FOUND'
      | 'NETWORK_ERROR'
      | 'PERMISSION_ERROR'
      | 'DATABASE_ERROR'
      | 'BACKEND_UNAVAILABLE';
    message: string;
  };
};
```

UI harus membedakan:

### Kode salah

“Kode ujian tidak ditemukan.”

### Backend bermasalah

“Server ujian sedang bermasalah. Silakan coba lagi.”

### Permission/RLS

“Ujian tidak dapat diakses saat ini.”

Log development harus menyimpan error Supabase asli.

---

# PRIORITAS P3 — AUDIT DAN REFACTOR RLS

## 6. Role yang Harus Dipisahkan

Kuizku punya dua kelompok utama:

### Guru

Supabase role:

`authenticated`

Guru harus hanya boleh:
- melihat exam miliknya
- membuat exam miliknya
- mengedit exam miliknya
- melihat submission exam miliknya
- memberi nilai

### Murid

Murid sekarang tidak login Supabase.

Role:

`anon`

Murid hanya boleh:
- menemukan exam ACTIVE berdasarkan kode
- membaca soal exam tersebut
- melakukan validasi identitas
- membuat / memperbarui submission miliknya
- submit jawaban

Murid TIDAK boleh membaca:
- exam draft
- exam guru lain secara bebas
- submission semua siswa
- student_answers siswa lain
- profil guru private

---

# PRIORITAS P4 — JANGAN BIARKAN MURID QUERY SELURUH SUBMISSION

## 7. Masalah getSubmissionsByExam

Portal murid memanggil:

`getSubmissionsByExam(exam.id)`

Fungsi ini membaca:

`submissions + student_answers`

untuk seluruh ujian.

Ini berbahaya dari dua sisi.

### Jika RLS ketat

Portal murid bisa gagal.

### Jika RLS longgar

Murid bisa melihat data submission peserta lain.

## Solusi

Buat RPC:

`check_exam_access`

Input:

- exam code
- identifier murid

Output:

```text
allowed
reason
attempt_count
next_attempt_number
has_draft
resume_submission_id
```

Jangan return seluruh submission.

Frontend tidak perlu tahu submission siswa lain.

---

# PRIORITAS P5 — REFACTOR PRELOADED STUDENTS

## 8. Masalah Whitelist Murid

Saat ini `getExamByCode()` juga mengambil:

`preloaded_students(*)`

Artinya anonymous client berpotensi menerima seluruh daftar nama/NIS siswa untuk exam tersebut.

Ini tidak ideal.

## Solusi

Jangan expose seluruh daftar murid.

Buat RPC:

`validate_exam_student`

Input:

- exam code
- nama
- NIS / nomor absen

Output:

```text
valid
student_identifier
reason
```

Database yang melakukan pengecekan.

Frontend hanya menerima hasil valid/tidak valid.

---

# PRIORITAS P6 — FIX BUG SUBMISSION / SESSION HILANG

## 9. Masalah saveSubmission

Saat ini `storage.saveSubmission()`:

- jika Supabase gagal,
- submission dimasukkan ke localStorage pending queue,
- fungsi melakukan `return`,
- tidak melempar error.

Di `ExamTakingPage`:

```ts
await storage.saveSubmission(sub);
clearSession(...)
```

Artinya save bisa gagal di server, tetapi `await` tetap dianggap selesai.

Session lokal kemudian bisa dihapus.

Ini bertentangan dengan komentar kode yang ingin mempertahankan session jika save gagal.

## Solusi

Ubah `saveSubmission()` menjadi:

```ts
Promise<{
  saved: boolean;
  queued: boolean;
  error?: string;
}>
```

Behavior:

### Jika server berhasil

```text
saved = true
queued = false
→ clearSession()
```

### Jika offline / backend gagal

```text
saved = false
queued = true
→ jangan clear session
→ tampilkan warning
```

UI:

“Jawaban belum terkirim ke server. Salinan lokal masih tersimpan dan akan disinkronkan.”

Submission final jangan dianggap benar-benar selesai sampai server memberi konfirmasi.

---

# PRIORITAS P7 — PUBLISH HARUS ATOMIK

## 10. Buat RPC publish_exam

Publish sebaiknya jangan hanya update status dari frontend.

Buat RPC database:

`publish_exam(p_exam_id uuid)`

RPC melakukan:

1. cek user login
2. cek exam milik `auth.uid()`
3. cek exam ada
4. cek minimal 1 question
5. validasi jadwal
6. cek status valid
7. update status menjadi `ACTIVE`
8. return row final

Jika salah satu gagal:

rollback.

Frontend hanya menerima hasil final.

---

# PRIORITAS P8 — BUAT STUDENT API/RPC KHUSUS

## 11. Arsitektur Student yang Disarankan

Hindari anonymous client membaca banyak tabel mentah.

Buat RPC seperti:

### `get_public_exam(code)`

Return hanya data yang dibutuhkan murid:
- id
- title
- subject
- type
- format
- settings aman
- active_from
- active_to
- jumlah soal

Jangan return answer key sebelum waktunya.

### `get_exam_questions(code, identifier)`

Return soal jika peserta valid dan exam ACTIVE.

Untuk pilihan ganda jangan expose `correct_option_id`.

### `check_exam_access(code, identifier)`

Return:
- allowed
- attempt
- resume info

### `save_exam_progress(...)`

Autosave draft.

### `submit_exam(...)`

Submit final secara atomik.

---

# PRIORITAS P9 — JANGAN EXPOSE KUNCI JAWABAN

## 12. Audit Keamanan Question Data

Periksa apakah anonymous query saat ini mengirim:

`correct_option_id`

ke browser murid.

Jika iya, ini critical.

Walaupun UI tidak menampilkannya, murid bisa melihat network response / DevTools.

Solusi:

Untuk portal murid, jangan pernah mengambil row `questions(*)` mentah.

Buat view/RPC public yang mengecualikan:
- `correct_option_id`
- `answer_guide`

Kunci jawaban hanya boleh diberikan jika memang fitur hasil mengizinkan setelah submit.

---

# PRIORITAS P10 — MIGRASI ENV

## 13. Supabase Client

File:

`src/lib/supabase.ts`

menggunakan:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Setelah Supabase baru siap:

update:

`.env.local`

dan production environment di Vercel.

Jangan hardcode credential.

Jangan gunakan `service_role` di browser.

Jika project baru memakai publishable key modern Supabase, sesuaikan variable secara konsisten.

---

# PRIORITAS P11 — SECURITY REPO

## 14. File .env

Repository terlihat memiliki file:

`.env`

Lakukan audit.

Jika hanya berisi anon/public key:
tetap pindahkan ke `.env.example` dan `.env.local`.

Jika pernah ada:
- service role
- AI API key
- database password
- secret

maka lakukan rotasi.

Tambahkan `.env` dan `.env.local` ke `.gitignore`.

Sediakan:

`.env.example`

contoh:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

# PRIORITAS P12 — END-TO-END TEST

## 15. Test Wajib Guru → Murid

Buat scenario fixture.

### Guru

1. login
2. buat ujian
3. isi judul/mapel
4. buat 3 soal
5. simpan
6. pastikan exam ada di DB
7. publish
8. pastikan server return `ACTIVE`

### Murid

Gunakan incognito / clean browser.

1. buka `/ujian`
2. input kode
3. exam ditemukan
4. isi nama
5. validasi peserta
6. masuk instruksi
7. mulai
8. 3 soal tampil
9. jawab soal
10. refresh halaman
11. resume bekerja
12. submit
13. submission benar-benar ada di database

### Guru

1. buka hasil
2. submission murid muncul
3. jawaban sesuai
4. nilai tampil

---

# NEGATIVE TEST

## 16. Kondisi yang Harus Diuji

### Exam DRAFT

Murid tidak bisa masuk.

### Exam ENDED

Murid tidak bisa masuk.

### Exam ARCHIVED

Murid tidak bisa masuk.

### Kode salah

Return:

`NOT_FOUND`

bukan server error.

### Supabase mati

UI:

“Server sedang bermasalah.”

Bukan:

“Kode tidak ditemukan.”

### RLS salah

Development log harus menunjukkan permission error.

### Internet mati saat submit

- session tidak hilang
- submission masuk pending queue
- user diberi warning
- setelah internet kembali submission tersinkron

### Attempt maksimum

Murid tidak bisa membuat attempt tambahan.

### Murid tidak terdaftar

Akses ditolak tanpa expose daftar murid.

---

# PRIORITAS P13 — OBSERVABILITY

## 17. Tambahkan Logging Terstruktur

Untuk operasi penting:

- save exam
- publish exam
- lookup exam
- student validation
- start exam
- autosave
- submit

Log minimal:

```text
operation
exam_id
exam_code
status
error_code
error_message
```

Jangan log:
- password
- service role
- jawaban rahasia
- data sensitif siswa secara berlebihan

---

# PRIORITAS P14 — UPDATE UX

## 18. Guru

Setelah publish:

Jangan langsung tampil:

“Ujian Aktif”

sebelum verifikasi server.

Gunakan:

“Memublikasikan…”

kemudian:

“Ujian berhasil dipublikasikan dan sudah tersedia untuk murid.”

Jika gagal:

“Publish gagal. Perubahan belum diterapkan.”

## Murid

Bedakan:

- kode tidak ditemukan
- ujian belum aktif
- ujian sudah berakhir
- server error
- koneksi internet
- akses peserta ditolak

---

# URUTAN EKSEKUSI CODEX

## 19. Eksekusi Bertahap

### Fase 1

Audit Supabase baru.

- schema
- functions
- RLS
- auth
- keys
- storage

### Fase 2

Pastikan migrasi backend lengkap.

Khusus verifikasi:

`save_exam_full`

### Fase 3

Fix false-success publish.

Files utama:

- `src/context/AppContext.tsx`
- `src/utils/storage.ts`
- `src/pages/teacher/wizard/Step5Publish.tsx`

### Fase 4

Fix error handling lookup exam.

Files:

- `src/utils/storage.ts`
- `src/pages/student/JoinExamPage.tsx`
- `src/pages/student/InstructionsPage.tsx`
- `src/pages/student/ExamTakingPage.tsx`

### Fase 5

Refactor RLS dan RPC student.

Database:

- `get_public_exam`
- `check_exam_access`
- `validate_exam_student`

### Fase 6

Fix submission result contract.

File:

- `src/utils/storage.ts`
- `src/pages/student/ExamTakingPage.tsx`

### Fase 7

Security review.

- jangan expose correct answer
- jangan expose seluruh submissions
- jangan expose daftar siswa

### Fase 8

E2E.

Guru → murid → submit → guru hasil.

---

# ATURAN KERAS

## 20. Jangan Melakukan Ini

JANGAN memperbaiki problem dengan:

```sql
alter table ... disable row level security;
```

JANGAN membuat policy universal:

```sql
using (true)
```

untuk data sensitif.

JANGAN beri `anon` akses membaca seluruh:

- submissions
- student_answers
- teachers
- preloaded_students

JANGAN menaruh:

`service_role`

di Vite/frontend.

JANGAN menghapus project Supabase lama sebelum migrasi diverifikasi.

JANGAN mengganti UUID user jika bisa dihindari.

JANGAN melakukan redesign UI besar sebelum flow utama stabil.

---

# DEFINITION OF DONE

## 21. Kuizku Dianggap Stabil Jika

- [ ] Supabase baru aktif
- [ ] semua schema sudah tersedia
- [ ] Auth guru bekerja
- [ ] RPC `save_exam_full` bekerja
- [ ] guru bisa membuat exam
- [ ] soal tersimpan di database
- [ ] publish benar-benar mengubah row DB
- [ ] publish tidak bisa sukses palsu
- [ ] murid anonymous bisa menemukan exam ACTIVE
- [ ] backend error tidak tampil sebagai “kode tidak ditemukan”
- [ ] murid tidak bisa membaca exam DRAFT
- [ ] murid tidak bisa membaca submission siswa lain
- [ ] daftar murid tidak diexpose penuh
- [ ] kunci jawaban tidak terkirim sebelum waktunya
- [ ] autosave bekerja
- [ ] offline queue bekerja
- [ ] session tidak hilang saat backend gagal
- [ ] submit final tersimpan di Supabase
- [ ] hasil muncul di portal guru
- [ ] E2E test lulus

---

# HASIL AKHIR YANG DIINGINKAN

Arsitektur target:

```text
GURU
  ↓
authenticated Supabase
  ↓
create/save exam
  ↓
publish_exam RPC
  ↓
ACTIVE

MURID
  ↓
anonymous client
  ↓
student RPC/API terbatas
  ↓
validasi exam & peserta
  ↓
load soal tanpa answer key
  ↓
autosave
  ↓
submit_exam RPC
  ↓
submission tersimpan

GURU
  ↓
hasil / grading
```

Target utama bukan hanya membuat Kuizku “bisa dibuka lagi”, tetapi memastikan portal guru dan murid memiliki satu sumber kebenaran yang sama di server dan tidak lagi bergantung pada asumsi state frontend.
