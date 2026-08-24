# Kuizku — Sisa Plan Hasil & Analitik

Status terakhir:
- Nilai skala 0–100 sudah masuk.
- Skor asli tetap ditampilkan.
- Statistik kelas sudah pakai skala 0–100.
- Total peserta sudah dihitung unik berdasarkan NIS/fallback nama.
- Submission/percobaan dipisahkan dari jumlah peserta.
- Ranking/statistik memakai attempt FINAL terbaik per peserta.
- Export Excel sudah memiliki kolom Nilai (0–100).
- State `analysisFilter` sudah ada di `ResultsPage.tsx`.

## Prioritas 1 — Analisis per Anak

Ubah modal detail peserta menjadi modal `Analisis — {Nama}` saat bukan grading mode.

Tambahkan summary di atas daftar soal:
- Nilai final /100 jika submission final.
- Jika belum final, tampilkan `Belum final`.
- Poin total x/maxTotal.
- PG x/maxMC.
- Essay x/maxEssay.
- Percobaan ke-N.

## Prioritas 2 — Filter Analisis

Tambahkan chip horizontal mobile-first:
- Semua
- Salah
- Benar
- Essay

Gunakan state yang sudah tersedia:
`analysisFilter: 'ALL' | 'WRONG' | 'CORRECT' | 'ESSAY'`

Aturan:
- ALL = semua soal.
- WRONG = hanya PG/short answer yang salah.
- CORRECT = hanya PG/short answer yang benar.
- ESSAY = hanya soal essay.
- gradingMode tetap hanya menampilkan essay seperti behavior sekarang.

Reset filter ke ALL saat:
- membuka peserta lain;
- menutup modal;
- berpindah dari grading mode ke analisis.

## Prioritas 3 — Card Analisis Soal Mobile

Saat gradingMode=false, render setiap soal sebagai card/list yang readable di HP.

PG:
- Nomor dan pertanyaan.
- Jawaban murid.
- Kunci.
- Badge Benar/Salah.
- Poin didapat / bobot.

Short answer:
- Jawaban murid.
- Jawaban diterima.
- Badge Benar/Salah.
- Poin didapat / bobot.

Essay:
- Jawaban murid.
- Panduan jawaban jika tersedia.
- Nilai x/bobot jika sudah dinilai.
- `Belum dinilai` jika belum ada grade.
- Komentar guru jika ada.

Jangan ubah form grading saat gradingMode=true.

## Prioritas 4 — Mobile UX

- Filter chip horizontal, boleh overflow-x auto.
- Summary card 2 kolom di mobile bila muat, 1 kolom di layar sangat kecil.
- Question card tidak menggunakan tabel horizontal.
- Tap target minimal 44px.
- Jangan menambah scroll horizontal pada modal analisis.
- Pertahankan dark theme Kuizku.

## Jangan Rusak

Wajib tetap berfungsi:
- AI grading.
- Quick grading.
- Save grading.
- Return revision.
- Anti-cheat log.
- Global question analytics.
- Export Excel.
- Statistik /100.
- Multi-attempt grouping.

## Acceptance Criteria

- [ ] Modal peserta berjudul Analisis — Nama saat bukan grading mode.
- [ ] Nilai /100 dan skor asli terlihat di summary.
- [ ] Essay belum final tidak mendapat nilai final palsu.
- [ ] Filter Semua/Salah/Benar/Essay bekerja.
- [ ] Salah/Benar hanya memfilter PG + short answer.
- [ ] Essay menampilkan poin parsial dan komentar guru.
- [ ] Layout analisis nyaman di mobile.
- [ ] AI grading dan quick grading tetap berjalan.
- [ ] `npx tsc -b --force` lolos.
- [ ] `npm run build` lolos.

## Catatan Implementasi

Sebisa mungkin cukup ubah:
- `src/pages/teacher/ResultsPage.tsx`
- CSS results/mobile yang sudah ada bila dibutuhkan.

Tidak perlu schema Supabase baru untuk fitur analisis per anak ini.
