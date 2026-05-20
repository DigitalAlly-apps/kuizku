# Kritik Aplikasi Ujianly — Audit Workflow & Fitur

## 🔴 Critical — Workflow & Data Integrity

| # | Isu | Status |
|---|-----|--------|
| 1 | Submit gagal silent saat offline | ✅ |
| 2 | Auto-submit anti-cheat tanpa warning | ✅ |
| 3 | Per-question timer reset saat back-and-forth | ✅ |
| 4 | returnSubmission attempt counting bug | ✅ |
| 5 | Resume session tidak validasi exam status | ✅ |
| 6 | ResultsPage tidak auto-refresh | ✅ |
| 7 | Tidak ada draft autosave di wizard | ✅ |

## 🟠 Important — UX Friction

| # | Isu | Status |
|---|-----|--------|
| 8 | Edit ujian existing tidak bisa edit soal/timer | ⏳ butuh major refactor |
| 9 | Tidak ada preview ujian dari sisi murid | ⏳ butuh halaman baru |
| 10 | Edit di QuestionBank tidak propagasi ke exam | ⏳ design decision |
| 11 | Daftar peserta tidak bisa diedit setelah create | ✅ |
| 12 | Whitelist matching case + space sensitive | ✅ |
| 13 | Lookup riwayat murid NIS tidak forgiving | ✅ |
| 14 | Wizard ganti format auto-hapus soal tanpa konfirmasi | ✅ |

## 🧩 Missing Features

| # | Isu | Status |
|---|-----|--------|
| 15 | Soal tidak support gambar | ⏳ butuh upload flow |
| 16 | Tidak ada bulk action | ⏳ |
| 17 | ImportModal Word parser fragile | ⏳ |
| 18 | Import soal bersama via JSON reload page | ⏳ |
| 19 | ResultScreen murid tidak bisa cetak/PDF | ⏳ |
| 20 | Tidak ada notifikasi murid saat dikembalikan revisi | ⏳ |

## 📱 Mobile Issues

| # | Isu | Status |
|---|-----|--------|
| 21 | QuestionNav fixed bottom menutupi keyboard | ✅ |
| 22 | Filter bar ExamListPage stack panjang di mobile | ✅ |
| 23 | Tabel hasil di mobile horizontal scroll | ✅ |
| 24 | Wizard step header label hilang di mobile | ✅ |
| 25 | QR Code & WhatsApp share tidak optimal mobile | ⏳ |

## 📌 Polish

| # | Isu | Status |
|---|-----|--------|
| 26 | Logout button tanpa konfirmasi | ✅ |
| 27 | Toast tidak ada tombol close/action | ⏳ |
| 28 | Settings ID akun tidak bisa di-copy | ⏳ |
| 29 | Tidak ada breadcrumb di mobile header | ⏳ |
| 30 | Dashboard grid kosong (sisa billing) | ✅ |
| 31 | formatRelative tidak handle future dates | ✅ |

## 📊 Ringkasan

| Kategori | Total | ✅ Fixed | ⏳ Pending |
|---|---|---|---|
| 🔴 Critical | 7 | 7 | 0 |
| 🟠 Important | 7 | 4 | 3 |
| 🧩 Missing | 6 | 0 | 6 |
| 📱 Mobile | 5 | 4 | 1 |
| 📌 Polish | 6 | 3 | 3 |
| **Total** | **31** | **18** | **13** |
