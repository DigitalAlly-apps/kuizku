import { supabase } from '../lib/supabase';
import { storage, type SaveSubmissionResult } from './storage';
import { loadSession, saveSession, type ExamSession } from './examSession';
import type { StudentAnswer } from '../types';
import { getStudentAccessMessage, studentSubmissionMessages } from './studentMessages';

// Critical student lifecycle safety layer.
// Keep this narrowly scoped to login/resume/submission behavior.

const SUBMISSION_ERROR_MESSAGES: Record<string, string> = {
  MAX_ATTEMPTS: getStudentAccessMessage('MAX_ATTEMPTS'),
  ENDED: getStudentAccessMessage('ENDED'),
  NOT_STARTED: getStudentAccessMessage('NOT_STARTED'),
  NOT_ACTIVE: getStudentAccessMessage('NOT_ACTIVE'),
  NOT_REGISTERED: getStudentAccessMessage('STUDENT_NOT_REGISTERED'),
  INVALID_IDENTITY: 'Identitas peserta tidak valid. Silakan masuk ulang.',
  INVALID_ANSWERS: 'Ada jawaban yang tidak valid. Muat ulang ujian lalu coba lagi.',
  SUBMISSION_CONFLICT: studentSubmissionMessages.conflict,
  SUBMISSION_FINAL: 'Jawaban untuk percobaan ini sudah dikumpulkan.',
};

function friendlySubmissionError(message?: string, queued = false): string | undefined {
  if (queued) return studentSubmissionMessages.offline;
  if (!message) return message;

  for (const [code, friendly] of Object.entries(SUBMISSION_ERROR_MESSAGES)) {
    if (message.includes(code)) return friendly;
  }

  const normalized = message.toLowerCase();
  if (normalized.includes('duplicate key') || normalized.includes('unique constraint')) {
    return studentSubmissionMessages.conflict;
  }
  if (normalized.includes('failed to fetch') || normalized.includes('network') || normalized.includes('timeout')) {
    return studentSubmissionMessages.offline;
  }

  return 'Jawaban belum dapat disimpan. Silakan coba lagi.';
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

const originalGetStudentExamByCode = storage.getStudentExamByCode.bind(storage);
storage.getStudentExamByCode = async (code: string, name: string, identifier: string) => {
  const result = await originalGetStudentExamByCode(code, name, identifier);
  if (!result.exam) return result;

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
