import type { Exam } from '../types';
import { formatExamFormat } from './helpers';

export function formatShareDateTime(iso?: string): string {
  if (!iso) return 'Setelah ujian dipublikasikan';
  return new Date(iso).toLocaleString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false, hourCycle: 'h23',
  });
}

function formatTimer(exam: Exam): string | undefined {
  if (exam.settings.timerMode === 'NONE') return undefined;
  if (exam.settings.timerMode === 'WHOLE_EXAM' && exam.settings.wholExamTimerSeconds) return `${Math.ceil(exam.settings.wholExamTimerSeconds / 60)} menit untuk seluruh ujian`;
  if (exam.settings.timerMode === 'PER_QUESTION' && exam.settings.perQuestionDefaultSeconds) return `${exam.settings.perQuestionDefaultSeconds} detik per soal`;
  return undefined;
}

export function buildExamWhatsAppMessage(exam: Exam, url: string): string {
  const timer = formatTimer(exam);
  const maxAttempts = exam.settings.maxAttempts;
  const attemptsText = maxAttempts === 1
    ? 'Percobaan: 1x (tidak bisa mengulang)'
    : maxAttempts > 1
      ? `Percobaan: ${maxAttempts}x`
      : undefined;

  return [
    `📝 *${exam.title}*`,
    exam.description?.trim(),
    `\nKode ujian: *${exam.code}*`,
    `Link ujian: ${url}`,
    `\nBentuk soal: ${formatExamFormat(exam.format)}`,
    `Jumlah soal: ${exam.questions.length} soal`,
    exam.activeFrom ? `Waktu dibuka: ${formatShareDateTime(exam.activeFrom)}` : undefined,
    `Waktu ditutup: ${exam.activeTo ? formatShareDateTime(exam.activeTo) : 'Tidak dibatasi'}`,
    timer ? `Timer: ${timer}` : undefined,
    attemptsText,
    `\nSilakan masuk menggunakan kode atau link di atas.`,
  ].filter(Boolean).join('\n');
}
