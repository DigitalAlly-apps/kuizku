import { formatDateTime } from './helpers';

export type StudentAccessReason =
  | 'NOT_FOUND'
  | 'NOT_ACTIVE'
  | 'NOT_STARTED'
  | 'ENDED'
  | 'STUDENT_NOT_REGISTERED'
  | 'MAX_ATTEMPTS'
  | 'NETWORK_ERROR'
  | 'SUBMISSION_CONFLICT';

export interface StudentAccessMetadata {
  attemptCount?: number;
  maxAttempts?: number;
  activeFrom?: string | null;
  activeTo?: string | null;
  examStatus?: string | null;
}

export function getStudentAccessMessage(reason?: string, metadata: StudentAccessMetadata = {}): string {
  switch (reason) {
    case 'NOT_FOUND':
      return 'Kode ujian tidak ditemukan. Periksa kembali 6 karakter kode dari guru.';
    case 'NOT_ACTIVE':
      return 'Ujian ini sudah ditutup oleh guru. Pengerjaan baru dan melanjutkan ujian tidak tersedia.';
    case 'NOT_STARTED':
      return metadata.activeFrom
        ? `Ujian belum dimulai. Ujian dapat dikerjakan mulai ${formatDateTime(metadata.activeFrom)}. Silakan kembali sesuai jadwal atau hubungi guru jika jadwalnya tidak sesuai.`
        : 'Ujian belum dimulai. Silakan kembali sesuai jadwal dari guru.';
    case 'ENDED':
      return metadata.activeTo
        ? `Waktu pengerjaan ujian sudah berakhir pada ${formatDateTime(metadata.activeTo)}. Anda tidak dapat mulai mengerjakan lagi. Jika hasil sudah dirilis, Anda masih dapat melihat ranking.`
        : 'Waktu pengerjaan ujian sudah berakhir. Jika hasil sudah dirilis, Anda masih dapat melihat ranking.';
    case 'STUDENT_NOT_REGISTERED':
      return 'Data Anda belum ditemukan di daftar peserta. Periksa kembali nama dan nomor identitas, atau minta guru memeriksa daftar peserta ujian.';
    case 'MAX_ATTEMPTS': {
      const { attemptCount, maxAttempts } = metadata;
      const usage = maxAttempts && maxAttempts > 0
        ? ` Anda sudah menggunakan ${attemptCount ?? maxAttempts} dari ${maxAttempts} kesempatan.`
        : '';
      return `Kesempatan mengerjakan Anda sudah habis.${usage} Jika perlu mengerjakan kembali, minta guru menambah jumlah kesempatan ujian.`;
    }
    case 'NETWORK_ERROR':
      return 'Koneksi ke server sedang bermasalah. Periksa internet lalu coba lagi. Jawaban lokal tidak dihapus.';
    case 'SUBMISSION_CONFLICT':
      return 'Sesi ujian Anda berubah di server. Masuk kembali dengan identitas yang sama agar jawaban tersimpan dapat dipulihkan.';
    default:
      return 'Ujian belum dapat diakses saat ini. Silakan coba lagi atau hubungi guru.';
  }
}

export const studentSubmissionMessages = {
  offline: 'Jawaban belum terkirim ke server. Salinan lokal tetap aman. Periksa koneksi lalu pilih “Coba Kirim Lagi”.',
  conflict: 'Sesi ujian Anda berubah di server. Masuk kembali dengan identitas yang sama agar jawaban tersimpan dapat dipulihkan.',
  essayPending: 'Jawaban sudah terkumpul. Nilai akhir dan ranking akan tersedia setelah guru selesai menilai soal essay.',
  rankingNotReleased: 'Ranking belum tersedia karena hasil ujian belum dirilis oleh guru.',
};
