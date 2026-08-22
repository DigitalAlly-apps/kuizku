# MASTER PLAN KUIZKU — STABILISASI, SCORING, IMPORT EXCEL, DAN PENILAIAN ESSAY

Repository:
DigitalAlly-apps/kuizku

Tujuan:
Menjadikan Kuizku stabil untuk dipakai latihan/kuis/LCC secara nyata, terutama memastikan:
- data tidak false-success
- nilai benar
- ujian guru benar-benar tersimpan/publish
- murid bisa masuk dan submit
- offline aman
- auth Google benar
- import Excel aman
- scoring PG + Essay konsisten
- essay bisa dinilai dengan beberapa mode tanpa AI

JANGAN melakukan redesign besar.
JANGAN menambah fitur di luar scope.
Prioritaskan integritas data, scoring, dan reliability.

==================================================
BAGIAN A — FIX FALSE-SUCCESS CRUD
==================================================

Masalah sistemik yang sudah ditemukan:
UI sering berubah dulu, lalu database dipanggil, dan error server diabaikan.

Akibat:
- delete terlihat sukses lalu balik setelah refresh
- create/duplicate bisa jadi ghost data
- grading/feedback bisa terlihat tersimpan padahal belum

PRINSIP BARU:

SERVER WRITE
→ SERVER CONFIRM
→ UPDATE LOCAL STATE

Jangan:
UPDATE LOCAL STATE
→ FIRE REQUEST
→ IGNORE ERROR

Audit dan fix:

1. deleteExam
2. createExam
3. duplicateExam
4. gradeEssay
5. returnSubmission
6. setTeacherFeedback
7. saveBankQuestion/update/delete jika pola sama
8. mutation penting lain

Semua mutation harus return structured result:

{
  success: boolean;
  error?: string;
}

Kalau gagal:
- jangan update state permanen
- tampilkan toast error
- jangan tampilkan sukses palsu

==================================================
BAGIAN B — FIX DELETE UJIAN BALIK SETELAH REFRESH
==================================================

Masalah nyata:
Guru hapus ujian dari Dashboard/Ujian Saya.
Card hilang.
Setelah refresh, ujian muncul lagi.

Audit:
src/context/AppContext.tsx
src/utils/storage.ts

Fix storage.deleteExam:

const { data, error } = await supabase
  .from('exams')
  .delete()
  .eq('id', id)
  .select('id')
  .maybeSingle();

Jika error:
→ gagal

Jika tidak ada row:
→ gagal

Baru setelah server confirm:
setExamsState(prev => prev.filter(...))

Optional:
refreshExams() setelah delete untuk verifikasi.

==================================================
BAGIAN C — FIX CREATE DAN DUPLICATE GHOST EXAM
==================================================

createExam saat ini berpotensi:
- state lokal bertambah
- save server gagal
- UI tetap menampilkan exam
- refresh → exam hilang

Fix:
1. buat object
2. save ke server
3. jika sukses → update state
4. jika gagal → throw/return error
5. UI tampil error

duplicateExam:
sama.

Jangan update state sebelum saveExam sukses.

==================================================
BAGIAN D — FIX SILENT READ ERRORS
==================================================

Saat ini beberapa query server error berubah menjadi [].

Audit:
- getExamsByTeacher
- getSubmissionsByTeacher
- getSubmissionsByExam
- getBankQuestions
- query data guru lain

Bedakan:
1. success + data kosong
2. backend error

Jangan membuat dashboard tampil “belum ada data” kalau sebenarnya Supabase gagal.

Target return:

{
  data: T[];
  error?: string;
}

==================================================
BAGIAN E — FIX SCORING PG 0 PADAHAL ADA BENAR
==================================================

Masalah nyata:
- 30 soal PG
- Andi menjawab beberapa benar
- Analytics menunjukkan beberapa soal 100% benar
- tabel peserta menunjukkan PG = 0/30

Jangan expose answer key ke frontend murid.

Server tetap source of truth.

Audit chain:

1. payload answers ke save_student_submission
2. v_mc_score di RPC
3. return RPC
4. submissions.mc_score di DB
5. storage.getSubmissionsByTeacher
6. dbToSubmission
7. ResultsPage
8. export Excel

Cari titik pertama di mana nilai benar menjadi 0.

Expected test:
30 soal bobot 1
2 benar
→ mc_score = 2
→ UI = 2/30

Test:
0 benar → 0
2 benar → 2
30 benar → 30
bobot berbeda → sesuai weight

Analytics dan table score harus konsisten.

==================================================
BAGIAN F — SERVER-SIDE PG GRADING
==================================================

PG harus selalu dinilai server.

Jangan gunakan calcMCScore frontend sebagai nilai final.

Frontend calc hanya boleh:
- preview lokal
- tampilan sementara
- helper non-authoritative

Nilai final harus dari:
submissions.mc_score

save_student_submission harus:
- validasi question belongs to exam
- validasi selected_option_id
- hitung berdasarkan correct_option_id di database
- simpan mc_score
- return mc_score

==================================================
BAGIAN G — ESSAY GRADING FALSE SUCCESS
==================================================

Masalah:
ResultsPage saveGrading memanggil gradeEssay berkali-kali tanpa await lalu langsung toast sukses.

Fix:
saveGrading harus async.

Gunakan Promise.all atau RPC batch.

Contoh:
await Promise.all(
  Object.entries(gradingScores).map(...)
)

Baru setelah semua sukses:
toast sukses
close modal

Kalau satu gagal:
jangan bilang sukses.

Lebih baik:
buat server operation batch:
save_essay_grading(submission_id, grades, feedback)

agar atomik.

==================================================
BAGIAN H — STATUS NILAI SEMENTARA VS FINAL
==================================================

Untuk exam kombinasi PG + Essay:

Jangan anggap essay belum dinilai = nilai final 0.

Gunakan status:

PENDING_ESSAY_GRADING
FINAL

Saat essay belum selesai:
PG: 18/20
Essay: Menunggu penilaian
Total: Nilai sementara
Status: Belum final

Setelah seluruh essay dinilai:
PG: 18/20
Essay: 24/30
Total: 42/50
Status: Final

Ranking final, rata-rata final, median final, ketuntasan final:
jangan dianggap final kalau essay belum selesai dinilai.

Boleh tampil statistik sementara dengan label jelas:
"Statistik sementara"

==================================================
BAGIAN I — FIX “ESSAY DINILAI” STAT
==================================================

Jangan:

essayScores.length > 0

sebagai tanda sudah dinilai.

Harus:

jumlah essay score
===
jumlah seluruh soal essay

Untuk tiap submission.

Status:
- Belum dinilai
- Dinilai sebagian
- Selesai dinilai

==================================================
BAGIAN J — SISTEM PENILAIAN ESSAY TANPA AI
==================================================

Tambahkan tiga mode non-PG:

1. JAWABAN_SINGKAT
2. ESSAY_RUBRIK
3. ESSAY_MANUAL

Jangan gunakan AI.

==================================================
BAGIAN K — JAWABAN SINGKAT
==================================================

Tujuan:
Cocok untuk LCC.

Contoh:
Pertanyaan:
"Siapa khalifah pertama?"

Accepted answers:
- Abu Bakar
- Abu Bakar Ash-Shiddiq
- Abu Bakr

Server auto-grade.

Normalization:
- trim
- lowercase
- collapse whitespace
- optional remove punctuation
- optional normalize dash/apostrophe

Jangan terlalu fuzzy secara default.

Mode:
EXACT_NORMALIZED

Optional config:
acceptedAnswers: string[]

Jika match salah satu:
score = weight

Kalau tidak:
0

Jangan gunakan AI.

==================================================
BAGIAN L — ESSAY RUBRIK
==================================================

Setiap essay bisa punya rubric criteria.

Contoh soal bobot 10:

[
  {
    id: "...",
    label: "Pengertian benar",
    maxScore: 3
  },
  {
    id: "...",
    label: "Menyebutkan minimal 2 poin",
    maxScore: 4
  },
  {
    id: "...",
    label: "Contoh relevan",
    maxScore: 2
  },
  {
    id: "...",
    label: "Jawaban runtut",
    maxScore: 1
  }
]

Total maxScore rubric harus <= atau = question.weight.

UI guru:
- checkbox atau input per kriteria
- skor otomatis dijumlahkan
- total tidak boleh > weight

Simpan detail rubric grading supaya audit jelas.

==================================================
BAGIAN M — ESSAY MANUAL
==================================================

Pertahankan mode manual:

- tampilkan jawaban murid
- tampilkan panduan jawaban
- guru isi skor 0 sampai weight
- komentar opsional

Tidak perlu rubrik.

==================================================
BAGIAN N — PG + JAWABAN SINGKAT + ESSAY
==================================================

Total nilai:

PG auto
+
Jawaban Singkat auto
+
Essay Rubrik/Manual
=
Total Final

Jangan hitung essay pending sebagai nilai final.

==================================================
BAGIAN O — OFFLINE SUBMIT
==================================================

Masalah nyata:
Murid mulai online.
Internet mati.
Klik Kumpulkan.
UI bilang:
"Ujian sudah tidak aktif."

Ini salah.

Root:
getStudentExamByCode gagal karena network
→ exam null
→ dianggap not active

Bedakan:
NETWORK_ERROR
BACKEND_UNAVAILABLE
PERMISSION_ERROR
ENDED
NOT_FOUND

Jika network/offline:
- jangan bilang exam tidak aktif
- build final submission dari local session
- simpan ke pending queue
- jangan clear session
- jangan show final result

UI:
"Jawaban tersimpan di perangkat tetapi belum terkirim."

==================================================
BAGIAN P — SYNC OFFLINE
==================================================

Audit:
syncPendingSubmissions()
window online listener

Flow target:

offline submit
→ pending queue
→ internet kembali
→ sync
→ server validate
→ server saved
→ queue item removed
→ related local session cleared
→ UI/toast success

Jangan duplicate.

Server tetap validasi:
- exam
- participant
- attempt
- deadline
- status
- question ids
- duplicate id

==================================================
BAGIAN Q — RESUME SESSION
==================================================

Pertahankan local session yang sudah terbukti bekerja.

"Lanjutkan dari Sesi Sebelumnya":
- same attempt
- same answers
- same index
- timer state konsisten

Jangan membuat attempt baru.

==================================================
BAGIAN R — MULAI ULANG DAN ATTEMPT NUMBER
==================================================

Audit JoinExamPage.handleStartFresh().

Jika masih:
attemptNumber: 1
hardcoded

fix.

Gunakan next_attempt_number server.

Jika maxAttempts = 2:
attempt 1 → boleh
attempt 2 → boleh
attempt 3 → ditolak

==================================================
BAGIAN S — GOOGLE LOGIN SALAH MASUK RESET PASSWORD
==================================================

Masalah:
Existing Google user login lagi.
OAuth berhasil.
App malah membuka:
"Atur Password Baru"

Root:
LoginPage mengecek access_token di URL hash sebagai recovery.

Jangan gunakan:
hash.includes('access_token=')

Password recovery hanya boleh dari:
type=recovery
atau Supabase event:
PASSWORD_RECOVERY

Gunakan:
supabase.auth.onAuthStateChange

SIGNED_IN:
→ dashboard

PASSWORD_RECOVERY:
→ reset mode

Manual login harus tetap bekerja.
Forgot password harus tetap bekerja.

==================================================
BAGIAN T — DROPDOWN GURU MENUTUP SAAT CURSOR MASUK
==================================================

Bug:
Menu tiga titik ujian muncul.
Saat cursor masuk item menu, dropdown nutup/ketutup.

Audit:
- onMouseLeave
- onBlur
- hover
- overflow hidden
- z-index
- pointer-events
- outside click listener

Target:
click menu → stay open
cursor masuk → stay open
click item → close
click outside → close
Escape → close

Jangan close hanya karena mouse leave tombol.

==================================================
BAGIAN U — IMPORT EXCEL RELIABILITY
==================================================

Jangan rewrite parser.

Upgrade:
1. bobot kosong → default 1
2. bobot invalid → error
3. opsi harus berurutan
4. tipe normalize
5. kunci normalize
6. header validation
7. preview
8. error per baris
9. import valid only
10. template resmi

==================================================
BAGIAN V — TEMPLATE EXCEL RESMI
==================================================

Workbook:
Sheet 1: SOAL
Sheet 2: PETUNJUK

Header:
Tipe
Pertanyaan
Opsi A
Opsi B
Opsi C
Opsi D
Opsi E
Opsi F
Kunci
Bobot
Tag
Panduan Jawaban

Petunjuk:
- tipe PG/Essay/Jawaban Singkat
- pertanyaan wajib
- bobot kosong = 1
- opsi berurutan
- kunci A-F
- tag opsional
- accepted answers jika ditambah tipe jawaban singkat

==================================================
BAGIAN W — BUG DOWNLOAD TEMPLATE MEMBUKA MODAL KEDUA
==================================================

Masalah:
Klik Download Template di modal import.
Modal import muncul lagi di atas modal lama.

Fix:
- type="button"
- cek event bubbling
- stopPropagation bila perlu
- jangan trigger opener modal
- jangan trigger file picker

Expected:
download file
→ modal tetap satu
→ tidak duplicate overlay

==================================================
BAGIAN X — IMPORT VALIDATION UI
==================================================

Setelah upload:
"60 soal ditemukan"
"57 valid"
"3 invalid"

Per baris:
Baris 8:
Kunci E tidak valid

Baris 17:
Pertanyaan kosong

Baris 24:
Bobot invalid

Preview soal sebelum import.

Boleh import valid rows saja.

==================================================
BAGIAN Y — SECURITY STUDENT DATA
==================================================

Pastikan student RPC tidak mengirim:
- correct_option_id
- answer_guide
- daftar murid
- submission peserta lain

Response student hanya field yang diperlukan.

get_student_exam:
tetap aman.

Test via Network DevTools.

==================================================
BAGIAN Z — CLEANUP DATA ACCESS
==================================================

Hapus/deprecate direct student query yang tidak dipakai:
getStudentSubmissionsByExam
jika flow baru sudah RPC-based.

Jangan biarkan future code memakai jalur yang rawan.

==================================================
TEST SUITE WAJIB
==================================================

AUTH:
1. Google existing user
2. Google new user
3. manual login
4. forgot password
5. refresh auth

EXAM CRUD:
6. create sukses
7. create gagal
8. duplicate sukses
9. duplicate gagal
10. delete sukses + refresh
11. delete gagal tidak hilang palsu

PUBLISH:
12. DRAFT → ACTIVE
13. server reject → UI tidak false-success

STUDENT:
14. valid code
15. invalid code
16. backend error
17. draft exam
18. ended exam
19. deadline

ATTEMPT:
20. max 2:
1 sukses
2 sukses
3 ditolak

OFFLINE:
21. offline during exam
22. offline submit
23. refresh offline
24. reconnect sync
25. close browser then reopen

SCORING PG:
26. 0 benar
27. 2 benar
28. semua benar
29. weighted questions

SHORT ANSWER:
30. exact
31. normalized
32. alias accepted
33. wrong answer

ESSAY RUBRIC:
34. full score
35. partial
36. zero
37. total rubric > weight harus ditolak

ESSAY MANUAL:
38. save grading sukses
39. save grading gagal
40. refresh tetap konsisten

COMBINATION:
41. PG+Essay pending
42. PG+Essay final
43. ranking sementara
44. ranking final

EXCEL:
45. PG 4 opsi
46. PG 6 opsi
47. bobot kosong
48. gap opsi
49. invalid key
50. 100 soal

SECURITY:
51. answer key tidak bocor
52. student tidak bisa baca submission lain
53. no service role frontend

==================================================
PRIORITAS EKSEKUSI
==================================================

P0:
1. PG score bug
2. delete false-success
3. seluruh mutation false-success
4. essay save false-success
5. silent read error
6. offline submit classification

P1:
7. auth Google reset bug
8. attempt/resume hardening
9. nilai sementara/final
10. essay grading completeness

P2:
11. jawaban singkat
12. essay rubric
13. Excel UX
14. dropdown/menu UI

P3:
15. cleanup/refactor ringan
16. automated regression tests

==================================================
JANGAN LAKUKAN
==================================================

Jangan:
- disable RLS
- USING(true) global
- service_role di frontend
- expose answer key
- menilai PG di client sebagai final
- menampilkan success sebelum server confirm
- rewrite besar local session
- menambah AI
- refactor visual besar
- mengubah fitur unrelated

==================================================
DEFINITION OF DONE
==================================================

[ ] skor PG benar
[ ] delete bertahan setelah refresh
[ ] create/duplicate tidak ghost
[ ] grading benar-benar tersimpan
[ ] feedback/revisi tidak false-success
[ ] backend error tidak dianggap data kosong
[ ] offline submit aman
[ ] reconnect sync bekerja
[ ] auth Google langsung dashboard
[ ] forgot password tetap bekerja
[ ] attempt limit aman
[ ] answer key tidak bocor
[ ] nilai PG+Essay punya status sementara/final
[ ] Jawaban Singkat auto-grade bekerja
[ ] Essay Rubrik bekerja
[ ] Essay Manual tetap bekerja
[ ] import Excel lebih aman
[ ] template Excel jelas
[ ] dropdown guru stabil
[ ] build production sukses
[ ] E2E guru → murid → hasil lolos

==================================================
OUTPUT CODEX
==================================================

Setelah selesai setiap fase, laporkan:

1. root cause
2. file yang berubah
3. behavior sebelum
4. behavior sesudah
5. DB migration yang ditambah
6. test yang dijalankan
7. hasil build
8. regression
9. bug tambahan yang ditemukan

Jangan memperbaiki bug tambahan di luar scope tanpa melaporkannya dahulu.