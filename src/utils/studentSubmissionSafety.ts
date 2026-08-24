import { supabase } from '../lib/supabase';
import { storage, type SaveSubmissionResult } from './storage';
import { loadSession, saveSession, type ExamSession } from './examSession';
import type { StudentAnswer } from '../types';

// Critical student lifecycle safety layer.
// Keep this narrowly scoped to login/resume/submission behavior.

const SUBMISSION_ERROR_MESSAGES: Record<string, string> = {
  MAX_ATTEMPTS: 'Kesempatan mengerjakan sudah habis. Silakan hubungi guru jika ingin meminta tambahan kesempatan.',
  ENDED: 'Waktu ujian sudah berakhir. Silakan hubungi guru jika kamu belum sempat mengerjakan.',
  NOT_STARTED: 'Ujian belum dibuka. Silakan kembali sesuai jadwal yang diberikan guru.',
  NOT_ACTIVE: 'Ujian sedang tidak tersedia. Silakan hubungi guru.',
  NOT_REGISTERED: 'Data kamu tidak ditemukan pada ujian ini. Periksa kembali nama atau NIS. Jika sudah benar, hubungi guru.',
  STUDENT_NOT_REGISTERED: 'Data kamu tidak ditemukan pada ujian ini. Periksa kembali nama atau NIS. Jika sudah benar, hubungi guru.',
  INVALID_IDENTITY: 'Data kamu belum benar atau belum lengkap. Periksa kembali lalu coba masuk lagi.',
  INVALID_ANSWERS: 'Ada jawaban yang belum dapat diproses. Jawabanmu tidak perlu dikerjakan ulang. Coba lagi.',
  SUBMISSION_CONFLICT: 'Ujian yang belum selesai ditemukan. Jawaban sebelumnya tetap tersimpan. Silakan masuk kembali untuk melanjutkan kesempatan yang sama.',
  SUBMISSION_FINAL: 'Ujian ini sudah berhasil dikumpulkan sebelumnya. Kamu tidak perlu mengirimkannya lagi.',
};

function friendlySubmissionError(message?: string, queued = false): string | undefined {
  if (queued) return 'Koneksi terputus. Jawabanmu tetap tersimpan. Periksa koneksi internet lalu coba kumpulkan lagi.';
  if (!message) return message;

  for (const [code, friendly] of Object.entries(SUBMISSION_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendly;
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('duplicate key') || normalized.includes('unique constraint')) {
    return 'Ujian yang belum selesai ditemukan. Jawaban sebelumnya tetap tersimpan. Silakan masuk kembali untuk melanjutkan kesempatan yang sama.';
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('timeout')) {
    return 'Koneksi terputus. Jawabanmu tetap tersimpan. Periksa koneksi internet lalu coba kumpulkan lagi.';
  }

  return 'Terjadi gangguan pada sistem. Jawabanmu tidak perlu dikerjakan ulang. Tunggu sebentar lalu coba lagi.';
}

function friendlyAccessMessage(message?: string, maxAttempts?: number): string {
  const normalized = (message ?? '').toLowerCase();

  if (normalized.includes('batas percobaan') || normalized.includes('max_attempts') || normalized.includes('kesempatan mengerjakan sudah habis')) {
    if (maxAttempts === 1) {
      return 'Ujian ini hanya menyediakan 1 kali kesempatan dan kamu sudah menggunakannya. Silakan hubungi guru jika ingin mengerjakan kembali.';
    }
    return 'Kesempatan mengerjakan sudah habis. Silakan hubungi guru jika ingin meminta tambahan kesempatan.';
  }
  if (normalized.includes('belum dimulai') || normalized.includes('not_started')) {
    return 'Ujian belum dibuka. Silakan kembali sesuai jadwal yang diberikan guru.';
  }
  if (normalized.includes('sudah berakhir') || normalized.includes('ended')) {
    return 'Waktu ujian sudah berakhir. Silakan hubungi guru jika kamu belum sempat mengerjakan.';
  }
  if (normalized.includes('tidak aktif') || normalized.includes('not_active') || normalized.includes('belum dipublikasikan') || normalized.includes('diarsipkan')) {
    return 'Ujian sedang tidak tersedia. Silakan hubungi guru.';
  }
  if (normalized.includes('tidak ditemukan dalam daftar peserta') || normalized.includes('student_not_registered') || normalized.includes('nama/nis tidak terdaftar')) {
    return 'Data kamu tidak ditemukan pada ujian ini. Periksa kembali nama atau NIS. Jika sudah benar, hubungi guru.';
  }
  if (normalized.includes('kode ujian tidak ditemukan') || normalized.includes('not_found')) {
    return 'Ujian tidak ditemukan. Periksa kembali kode atau tautan yang diberikan guru.';
  }
  if (normalized.includes('koneksi') || normalized.includes('network') || normalized.includes('failed to fetch')) {
    return 'Koneksi ke server ujian terputus. Periksa koneksi internet lalu coba lagi.';
  }
  if (normalized.includes('server') || normalized.includes('database') || normalized.includes('backend')) {
    return 'Terjadi gangguan pada sistem. Tunggu sebentar lalu coba lagi.';
  }

  return message || 'Ujian belum dapat dibuka. Silakan coba lagi.';
}

function mapServerAnswers(rawAnswers: any[]): StudentAnswer[] {
  return (rawAnswers ?? []).map(answer => ({
    questionId: String(answer.question_id),
    questionType: answer.question_type,
    selectedOptionId: answer.selected_option_id ?? undefined,
    essayText: answer.essay_text ?? undefined,
    shortAnswer: answer.short_answer ?? undefined,
    timeTakenSeconds: answer.time_taken_seconds == null ? undefined : Number(answer.time_taken_seconds),
  }));
}

function mergeAnswers(serverAnswers: StudentAnswer[], localAnswers: StudentAnswer[]): StudentAnswer[] {
  const merged = new Map<string, StudentAnswer>();
  serverAnswers.forEach(answer => merged.set(answer.questionId, answer));
  localAnswers.forEach(answer => merged.set(answer.questionId, answer));
  return Array.from(merged.values());
}

function hydrateServerDraft(exam: any, name: string, identifier: string, draft: any): void {
  if (!draft?.id || !draft?.attempt_number || !draft?.started_at) return;

  const nis = identifier.trim() || name.trim();
  const existingLocal = loadSession(exam.code, nis);
  const startedAt = String(draft.started_at);
  const wholeDuration = Number(exam.settings?.wholExamTimerSeconds ?? 3600);
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const serverAnswers = mapServerAnswers(Array.isArray(draft.answers) ? draft.answers : []);

  // Local answers can be newer than the 5-second server autosave interval.
  // Preserve them while restoring the canonical server submission UUID.
  const localAnswers = existingLocal && existingLocal.attemptNumber === Number(draft.attempt_number)
    ? existingLocal.answers
    : [];

  const session: ExamSession = {
    submissionId: String(draft.id),
    examId: exam.id,
    examCode: exam.code,
    studentName: name.trim(),
    nis,
    attemptNumber: Number(draft.attempt_number),
    answers: mergeAnswers(serverAnswers, localAnswers),
    startedAt,
    remainingSeconds: existingLocal?.remainingSeconds ?? (exam.settings?.timerMode === 'WHOLE_EXAM'
      ? Math.max(0, wholeDuration - elapsed)
      : undefined),
    currentQuestionIndex: existingLocal?.currentQuestionIndex ?? 0,
    isSubmitted: false,
  };

  saveSession(session);
}

const originalGetExamByCode = storage.getExamByCode.bind(storage);
storage.getExamByCode = async (code: string) => {
  const result = await originalGetExamByCode(code);
  if (result.exam || !result.error) return result;
  return {
    ...result,
    error: {
      ...result.error,
      message: friendlyAccessMessage(result.error.message),
    },
  };
};

const originalGetStudentExamByCode = storage.getStudentExamByCode.bind(storage);
storage.getStudentExamByCode = async (code: string, name: string, identifier: string) => {
  const result = await originalGetStudentExamByCode(code, name, identifier);

  if (!result.exam) {
    let maxAttempts: number | undefined;
    const rawMessage = result.error?.message ?? '';
    if (rawMessage.toLowerCase().includes('batas percobaan') || rawMessage.toLowerCase().includes('max_attempts')) {
      const publicLookup = await originalGetExamByCode(code);
      if (publicLookup.exam) maxAttempts = Number(publicLookup.exam.settings?.maxAttempts ?? 0) || undefined;
    }

    if (!result.error) return result;
    return {
      ...result,
      error: {
        ...result.error,
        message: friendlyAccessMessage(result.error.message, maxAttempts),
      },
    };
  }

  // The public student RPC already performs exam schedule, restriction and
  // max-attempt validation. Read it once more only to recover the unfinished
  // server draft that the legacy storage adapter does not expose yet.
  const { data, error } = await supabase.rpc('get_student_exam', {
    p_code: code,
    p_name: name,
    p_identifier: identifier,
  });

  if (!error && data?.allowed && data?.resume === true && data?.resume_submission) {
    hydrateServerDraft(result.exam, name, identifier, data.resume_submission);
  }

  return result;
};

const originalSaveSubmission = storage.saveSubmission.bind(storage);
storage.saveSubmission = async (...args): Promise<SaveSubmissionResult> => {
  const result = await originalSaveSubmission(...args);
  if (result.saved) return result;
  return {
    ...result,
    error: friendlySubmissionError(result.error, result.queued),
  };
};
