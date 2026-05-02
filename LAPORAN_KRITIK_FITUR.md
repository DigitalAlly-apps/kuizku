# Laporan Kritik Fitur KuizKu

Tanggal: 2026-05-02

Laporan ini merangkum peninjauan kode pada folder `src` (routing aplikasi, context, data layer Supabase, halaman guru/siswa, dan utilitas). Temuan dikelompokkan berdasarkan tingkat prioritas penyelesaian/penambahan fitur.

---

## 🔴 HARD (Kritis - Harus Segera Diperbaiki / Ditambahkan)

**1. Sesi & Autosave Siswa (Sesi Pengerjaan)**
*   **Masalah:** Autosave dan riwayat murni mengandalkan `localStorage` yang rawan hilang jika berganti perangkat. Selain itu, sesi tidak dibersihkan otomatis setelah siswa berhasil *submit*.
*   **Solusi:** Buat sistem *autosave server-side* (sebagai *draft submission*) dan pastikan sesi lokal dihapus begitu ujian selesai di-*submit*.

**2. Keamanan & Validasi Akses (Sesi Pengerjaan)**
*   **Masalah:** Integritas ujian seperti skor, *attempt*, dan batas waktu masih banyak dikalkulasi di sisi *client* (mudah di-*bypass*). Keamanan sangat bertumpu pada RLS Supabase.
*   **Solusi:** Pindahkan fungsi validasi keamanan dan penghitungan ke sisi *server/database*. Lakukan audit ketat pada aturan RLS.

**3. Proteksi Ujian Berjalan (Manajemen Ujian)**
*   **Masalah:** Guru saat ini masih bisa bebas mengedit pengaturan dan struktur soal pada ujian yang sudah aktif/dikerjakan siswa.
*   **Solusi:** Kunci (*lock*) fitur perubahan pada ujian aktif untuk mencegah rusaknya konsistensi penilaian.

**4. Validasi *Publish* Ujian (Manajemen Ujian)**
*   **Masalah:** Ujian dapat di-*publish* meskipun kosong (tanpa soal) atau *deadline*-nya sudah terlewat.
*   **Solusi:** Terapkan validasi tegas untuk kelengkapan soal, *timer*, dan *deadline* sebelum tombol *publish* bisa ditekan.

**5. Fitur Peserta & Kelas (Manajemen Ujian)**
*   **Masalah:** Tipe data `preloadedStudents` secara sistem sudah ada, tapi antarmuka (UI) untuk mengelolanya tidak ada. Input nama kelas juga masih berupa ketikan bebas (*free text*).
*   **Solusi:** Buat halaman/UI untuk meng-*import* daftar siswa (dari Excel/CSV) dan terapkan sistem manajemen nama kelas yang baku.

**6. Penyimpanan *Feedback* & Revisi (Penilaian)**
*   **Masalah:** Fungsi `setTeacherFeedback` dan pengembalian revisi sudah ada, tapi datanya tidak ikut tersimpan ke *database*. Jika layar di-*refresh*, komentar guru akan hilang.
*   **Solusi:** Tambahkan dan petakan ( *mapping* ) kolom `teacher_feedback` serta `is_returned` di skema *database*.

---

## 🟡 MEDIUM (Sedang - Perbaikan Fungsionalitas & Analitik)

**1. Import Soal Word (`.docx`)**
*   **Masalah:** *Parser* dokumen Word sudah ditulis di sistem, tapi di-blokir oleh UI modal *import* karena ekstensi `.docx` tidak diizinkan.
*   **Solusi:** Izinkan file `.docx` pada modal *import* UI dan beri instruksi format yang jelas untuk guru.

**2. Bocoran Kunci Jawaban**
*   **Masalah:** Fitur *toggle* "Tampilkan Kunci" terkadang langsung memunculkan kunci begitu siswa *submit*, padahal ujian belum resmi ditutup oleh guru.
*   **Solusi:** Tampilkan kunci HANYA setelah status ujian secara global sudah berubah menjadi `ENDED`.

**3. Atribut Bank Soal & Randomisasi**
*   **Masalah:** Baru bisa mengacak urutan soal, belum bisa men-*generate* paket ujian acak dari bank soal berdasarkan tingkat kesulitan tertentu. Aturan default *timer* per soal juga membingungkan (60 detik jika dikosongkan).
*   **Solusi:** Tambahkan opsi tag/tingkat kesulitan, fitur *generate* paket acak, serta durasi default yang eksplisit di UI.

**4. Laporan & Ekspor Hasil Ujian**
*   **Masalah:** Riwayat hasil siswa hilang jika membersihkan *cache*. Hasil *export* ke Excel juga hanya berupa satu angka rekap nilai, tanpa merincikan nilai dan poin per soal.
*   **Solusi:** Sediakan riwayat daring (online) siswa berdasarkan NIS/kode. Perkaya *export* Excel dengan rincian jawaban tiap butir soal.

**5. Modul Penilaian Essay**
*   **Masalah:** Penilaian *essay* masih murni manual tanpa ada panduan rubrik. Belum ada opsi untuk menunda rilis nilai ke siswa sebelum semua *essay* selesai dikoreksi.
*   **Solusi:** Fasilitasi pembuatan rubrik nilai dan buat alur persetujuan rilis nilai final ujian.

**6. Anti-Cheat (Kejujuran)**
*   **Masalah:** Pendeteksi curang hanya berdasar tab yang pindah (*visibilitychange*) tanpa menyimpan log rekam jejak untuk dilihat kembali oleh guru.
*   **Solusi:** Simpan log jejak pelanggaran agar bisa diaudit guru dan buat pengaturan tingkat sensitivitas *anti-cheat*.

**7. Dashboard & Statistik Lanjutan**
*   **Masalah:** Informasi statistik setelah ujian selesai masih mendasar (hanya rerata dasar).
*   **Solusi:** Lengkapi *dashboard* dengan grafik distribusi nilai, tingkat ketuntasan siswa, dan pemeringkatan.

---

## 🟢 EASY (Rendah - Fitur Pelengkap & Kenyamanan)

**1. Pengaturan Akun & Keamanan Lanjutan**
*   **Masalah:** Pembaruan profil masih kaku; guru belum bisa mengganti kata sandi, email, memulihkan akun, atau memperbarui foto profil.
*   **Solusi:** Tambahkan halaman pengaturan akun komprehensif, mencakup *reset password* dan pemulihan.

**2. Penguatan Mode PWA / Offline**
*   **Masalah:** Aplikasi berjalan sebagai PWA (*Progressive Web App*) namun proses *load* ujian dan penyerahan nilai (*submit*) tetap butuh koneksi tanpa jeda.
*   **Solusi:** Perjelas arsitektur *offline* (misalnya: menampung antrean *submission* jika internet mendadak mati lalu mensinkronisasikan ulang saat *online*).

**3. Bank Soal Publik / Berbagi Pakar**
*   **Masalah:** Repositori soal masih hanya bisa diakses dan digunakan secara pribadi oleh masing-masing guru.
*   **Solusi:** Siapkan ruang repositori komunal yang memungkinkan guru membagikan soal mereka untuk diadaptasi oleh guru lainnya.
