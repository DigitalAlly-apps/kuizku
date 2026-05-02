// ============================================================
// KuizKu — Student Exam Session Manager
// Handles: autosave, resume, attempt tracking, timer state
// ============================================================

import type { Exam, Submission, StudentAnswer } from '../types';
import { generateId, calcMCScore } from './helpers';

const SESSION_KEY = (code: string, nis: string) => `kk_session_${code}_${nis}`;

export interface ExamSession {
  submissionId: string;
  examId: string;
  examCode: string;
  studentName: string;
  nis: string;
  attemptNumber: number;
  answers: StudentAnswer[];
  startedAt: string;
  remainingSeconds?: number; // for whole-exam timer
  currentQuestionIndex: number;
  isSubmitted: boolean;
}

// ---- Save session to localStorage ----
export function saveSession(session: ExamSession): void {
  try {
    localStorage.setItem(SESSION_KEY(session.examCode, session.nis), JSON.stringify(session));
  } catch {
    console.warn('Failed to save session');
  }
}

// ---- Load existing session ----
export function loadSession(code: string, nis: string): ExamSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY(code, nis));
    if (!raw) return null;
    return JSON.parse(raw) as ExamSession;
  } catch {
    return null;
  }
}

// ---- Clear session after submit ----
export function clearSession(code: string, nis: string): void {
  localStorage.removeItem(SESSION_KEY(code, nis));
}

// ---- Create a new session ----
export function createSession(
  exam: Exam,
  studentName: string,
  nis: string,
  attemptNumber: number,
): ExamSession {
  const session: ExamSession = {
    submissionId: generateId(),
    examId: exam.id,
    examCode: exam.code,
    studentName,
    nis,
    attemptNumber,
    answers: [],
    startedAt: new Date().toISOString(),
    remainingSeconds: exam.settings.timerMode === 'WHOLE_EXAM'
      ? (exam.settings.wholExamTimerSeconds ?? 3600)
      : undefined,
    currentQuestionIndex: 0,
    isSubmitted: false,
  };
  saveSession(session);
  return session;
}

// ---- Upsert an answer ----
export function upsertAnswer(
  session: ExamSession,
  answer: StudentAnswer,
): ExamSession {
  const existing = session.answers.findIndex(a => a.questionId === answer.questionId);
  const updated = existing >= 0
    ? session.answers.map((a, i) => i === existing ? answer : a)
    : [...session.answers, answer];
  const newSession = { ...session, answers: updated };
  saveSession(newSession);
  return newSession;
}

// ---- Update timer remaining ----
export function updateTimer(session: ExamSession, remaining: number): ExamSession {
  const updated = { ...session, remainingSeconds: remaining };
  saveSession(updated);
  return updated;
}

// ---- Update current question index ----
export function updateCurrentIndex(session: ExamSession, index: number): ExamSession {
  const updated = { ...session, currentQuestionIndex: index };
  saveSession(updated);
  return updated;
}

// ---- Build final Submission from session ----
export function buildSubmission(session: ExamSession, exam: Exam): Submission {
  const mcScore = calcMCScore(exam, session.answers);
  return {
    id: session.submissionId,
    examId: exam.id,
    studentName: session.studentName,
    nis: session.nis,
    attemptNumber: session.attemptNumber,
    answers: session.answers,
    mcScore,
    essayScores: [],
    startedAt: session.startedAt,
    submittedAt: new Date().toISOString(),
    isComplete: true,
  };
}

// ---- Build draft Submission for server-side autosave ----
export function buildDraftSubmission(session: ExamSession, exam: Exam): Submission {
  const mcScore = calcMCScore(exam, session.answers);
  return {
    id: session.submissionId,
    examId: exam.id,
    studentName: session.studentName,
    nis: session.nis,
    attemptNumber: session.attemptNumber,
    answers: session.answers,
    mcScore,
    essayScores: [],
    startedAt: session.startedAt,
    isComplete: false,
  };
}

// ---- Validate access to exam ----
export interface AccessResult {
  allowed: boolean;
  reason?: string;
  attemptNumber?: number;
  existingSession?: ExamSession | null;
}

export function validateExamAccess(
  exam: Exam,
  nis: string,
  existingSubmissions: import('../types').Submission[],
): AccessResult {
  if (exam.status !== 'ACTIVE') {
    return { allowed: false, reason: 'Ujian ini tidak sedang aktif.' };
  }

  // Check date range
  const now = Date.now();
  if (exam.activeFrom && new Date(exam.activeFrom).getTime() > now) {
    return { allowed: false, reason: 'Ujian belum dibuka.' };
  }
  if (exam.activeTo && new Date(exam.activeTo).getTime() < now) {
    return { allowed: false, reason: 'Ujian sudah ditutup.' };
  }

  // Count previous complete attempts by this NIS
  const prevAttempts = existingSubmissions.filter(
    s => s.examId === exam.id && s.nis === nis && s.isComplete,
  );

  const maxAttempts = exam.settings.maxAttempts; // 0 = unlimited
  if (maxAttempts > 0 && prevAttempts.length >= maxAttempts) {
    return {
      allowed: false,
      reason: `Anda sudah mencapai batas percobaan (${maxAttempts}x).`,
    };
  }

  // Check for in-progress (unsubmitted) session
  const existingSession = loadSession(exam.code, nis);
  if (existingSession && !existingSession.isSubmitted) {
    return {
      allowed: true,
      attemptNumber: existingSession.attemptNumber,
      existingSession,
    };
  }

  return {
    allowed: true,
    attemptNumber: prevAttempts.length + 1,
    existingSession: null,
  };
}
