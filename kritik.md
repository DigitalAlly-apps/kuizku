# Kritik Aplikasi Ujianly — Audit Workflow & Fitur

Audit fitur dan workflow setelah Critical/Important/Nice-to-have sebelumnya sudah di-fix. Fokus: UX, mobile, dan fitur yang setengah jadi.

## 🔴 Critical — Workflow & Data Integrity

| # | Isu | Lokasi | Dampak |
|---|-----|--------|--------|
| 1 | Submit gagal silent saat offline | ExamTakingPage.tsx handleSubmit | Murid lihat "berhasil" padahal data hanya di pendingQueue localStorage. Kalau clear cache atau ganti device sebelum reconnect, data hilang. Tidak ada UI peringatan "tertunda, jangan tutup browser" |
| 2 | Auto-submit anti-cheat tanpa peringatan jelas | ExamTakingPage.tsx visibilitychange handler | Sensitivity HIGH = 1x pindah tab langsung tutup ujian. Murid yang HP-nya ke-notif WA otomatis kehilangan ujian tanpa warning sebelumnya |
| 3 | Per-question timer reset saat back-and-forth | ExamTakingPage.tsx perQTimer reset | Murid pindah soal lalu balik = timer reset penuh. Mode "per soal" defeat tujuan timer |
| 4 | returnSubmission attempt counting bug | AppContext returnSubmission + JoinExamPage | Submission yang dikembalikan untuk revisi tetap dihitung sebagai attempt. Murid dengan attempt:1 dan 1x return = tidak bisa attempt lagi |
| 5 | Resume session tidak validasi exam status | JoinExamPage step 'resume' | Sesi dari pagi, ujian sudah ENDED siang. Murid klik Lanjutkan, kerja sia-sia, lalu submit ditolak. Jawaban hilang |
| 6 | ResultsPage tidak auto-refresh | ResultsPage.tsx | Saat ujian berlangsung, guru tidak tahu siapa sudah submit tanpa reload manual. Tidak ada polling, tidak ada tombol refresh |
| 7 | Tidak ada draft autosave di wizard buat ujian | CreateExamPage.tsx | Refresh tab di Step 3 (sudah input 30 soal) = semua hilang. Tidak ada beforeunload warning, tidak ada localStorage draft |

## 🟠 Important — UX Friction

| # | Isu | Lokasi | Dampak |
|---|-----|--------|--------|
| 8 | Edit ujian existing tidak bisa edit soal/timer | ExamListPage Edit Modal | Modal cuma support meta (title, desc, subject, kelas, tipe, jadwal). Tidak ada akses ke soal, timer, anti-cheat. Typo di soal aktif = harus duplikat lalu publish ulang |
| 9 | Tidak ada preview ujian dari sisi murid | Wizard Step 4 + ExamListPage | Guru tidak bisa lihat tampilan murid sebelum publish. Bug typo/format hanya ketahuan setelah murid komplain |
| 10 | Edit di QuestionBank tidak propagasi ke exam | QuestionBankPage handleEditSave | Update soal di bank tidak update di ujian yang sudah pakai. Confusing — guru kira sudah perbaiki, padahal di ujian aktif tetap salah |
| 11 | Daftar peserta tidak bisa diedit setelah create | Step1Setup + ExamListPage | preloadedStudents hanya bisa diisi di Step 1 saat create. Tidak ada UI tambah/hapus peserta di ujian existing. Murid baru/pindahan tidak bisa join |
| 12 | Whitelist matching nama case + space sensitive | JoinExamPage handleIdentitySubmit | Cek nama exact match. "Ahmad Fauzi" vs "Ahmad  Fauzi" (double space) atau typo kecil = ditolak |
| 13 | Lookup riwayat murid by NIS tidak forgiving | StudentHistoryPage | Murid masukkan "12" pertama kali dan "012" lain kali = riwayat terpisah. Tidak ada normalisasi |
| 14 | Wizard ganti format auto-hapus soal incompatible | CreateExamPage handleStep2Next | Pindah Combination → PG_ONLY = semua soal essay dihapus tanpa konfirmasi. Cuma toast info, tidak ada undo |

## 🧩 Missing Features

| # | Isu | Lokasi | Dampak |
|---|-----|--------|--------|
| 15 | Soal tidak support gambar | QuestionEditor.tsx + QuestionView.tsx | Type Question.imageUrl ada di types tapi tidak ada UI upload/paste/render. Matematika geometri, IPA rangkaian, Geografi peta — tidak bisa pakai gambar |
| 16 | Tidak ada bulk action | ExamListPage, QuestionBankPage | Tidak ada multi-select untuk arsip banyak ujian atau hapus banyak soal. Bersih-bersih semester = klik satu-satu di kebab menu 30 kali |
| 17 | ImportModal Word parser fragile | importParser.ts parseWordText | Tergantung format ketat blank line + *A. atau Kunci:. Bullet Word tidak terdeteksi. Preview "invalid" tanpa cara edit inline. Guru bolak-balik Word ↔ app |
| 18 | Import soal bersama via JSON paste reload page | QuestionBankPage handleImportShared | location.reload() kasar, hilang filter/scroll. Format JSON juga techie, bukan UX untuk guru |
| 19 | ResultScreen murid tidak bisa cetak/PDF | ResultScreen.tsx | Murid hanya lihat skor, tidak ada export. Orangtua minta bukti formal = tidak ada solusi |
| 20 | Tidak ada notifikasi murid saat dikembalikan revisi | AppContext returnSubmission | Guru klik Kembalikan, murid tidak tahu. Tidak ada email/push, murid harus check sendiri |

## 📱 Mobile Issues

| # | Isu | Lokasi | Dampak |
|---|-----|--------|--------|
| 21 | QuestionNav fixed bottom menutupi keyboard | QuestionNav + global.css mobile rule | Soal essay panjang di HP — keyboard naik, QuestionNav tertutup atau menutupi area ketik. Tidak ada toggle hide |
| 22 | Filter bar ExamListPage stack panjang di mobile | ExamListPage filter bar | 17+ tombol berurut di mobile (search, status 5, type 4, group-by 4). Scroll panjang sulit cari |
| 23 | Tabel hasil di mobile horizontal scroll | ResultsPage participant table | 8-9 kolom, sticky header tidak ada, action button di kanan butuh scroll dulu. Lihat nilai cepat di HP frustrasi |
| 24 | Wizard step header label hilang di mobile | global.css .wizard-step-label display: none | Cuma angka 1-2-3-4-5. Disorientasi step apa di HP 5 inch |
| 25 | QR Code & WhatsApp share tidak optimal mobile | ExamListPage QR Modal | QR dari third-party API (api.qrserver.com) tanpa fallback. Tidak ada Save to Photos. WA share via wa.me/?text= tidak konsisten di mobile WA |

## 📌 Polish & Nice-to-have

| # | Isu | Lokasi | Dampak |
|---|-----|--------|--------|
| 26 | Logout button tanpa konfirmasi | Sidebar.tsx | Klik tidak sengaja = logout, draft wizard hilang |
| 27 | Toast tidak ada tombol close/action | ui/index.tsx ToastItem | Auto dismiss 5 detik, kalau user mau action atas toast (misal "Lihat") tidak bisa |
| 28 | Settings ID akun tidak bisa di-copy | SettingsPage.tsx | Tampilkan slice 8 char tanpa tombol copy. Untuk debug/lapor bug, susah |
| 29 | Tidak ada breadcrumb di mobile header | TeacherLayout.tsx | Saat di submenu (Buat Ujian), header cuma logo. Tidak jelas posisi |
| 30 | Dashboard "Pemakaian Paket" sisa kosong | DashboardPage.tsx | Grid 2 kolom dengan satu child rendered. Layout tidak rapi (kolom kanan kosong) |
| 31 | formatRelative tidak handle future dates | helpers.ts | Tanggal aktif yang belum tiba tampil "X menit lalu" kalau dates dibalik di display |

## 📊 Ringkasan

| Kategori | Total |
|---|---|
| 🔴 Critical workflow | 7 |
| 🟠 Important UX | 7 |
| 🧩 Missing features | 6 |
| � Mobile | 5 |
| 📌 Polish | 6 |
| **Total** | **31** |

## 🎯 Prioritas Fix

**Wajib fix (bisa bikin user frustrasi atau data hilang):**
1. #1, #4, #5 — data integrity (offline, return, resume)
2. #2 — UX anti-cheat (kasih warning sebelum auto-submit)
3. #7 — autosave wizard (selamat dari refresh accidental)
4. #11 — edit peserta whitelist (kasus murid baru)
5. #21 — keyboard menutupi konten di mobile

**Sebaiknya fix (sering dipakai):**
6. #8 — edit soal di ujian existing
7. #6 — auto-refresh ResultsPage saat live monitoring
8. #15 — gambar di soal (banyak mapel butuh)
9. #12, #13 — name/NIS matching forgiving

**Boleh nanti:**
- Bulk action, import improvement, PDF export, notif revisi
- Mobile polish (filter bar, table, breadcrumb)
- Cosmetic (logout confirm, toast close, copy ID)
