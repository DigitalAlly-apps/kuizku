// ============================================================
// Ujianly — Utility Functions
// ============================================================

import { v4 as uuidv4 } from 'uuid';
import type { Exam, Question, StudentAnswer, Submission } from '../types';

// ---- ID & Code Generation ----

export function generateId(): string {
  return uuidv4();
}

export function generateExamCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ambiguous chars removed
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---- Scoring ----

export function calcMCScore(exam: Exam, answers: StudentAnswer[]): number {
  let total = 0;
  for (const question of exam.questions) {
    if (question.type !== 'MULTIPLE_CHOICE') continue;
    const answer = answers.find(a => a.questionId === question.id);
    if (answer && answer.selectedOptionId === question.correctOptionId) {
      total += question.weight;
    }
  }
  return total;
}

export function calcMaxMCScore(exam: Exam): number {
  return exam.questions
    .filter(q => q.type === 'MULTIPLE_CHOICE')
    .reduce((sum, q) => sum + q.weight, 0);
}

export function calcMaxEssayScore(exam: Exam): number {
  return exam.questions
    .filter(q => q.type === 'ESSAY')
    .reduce((sum, q) => sum + q.weight, 0);
}

export function calcMaxTotalScore(exam: Exam): number {
  return exam.questions.reduce((sum, q) => sum + q.weight, 0);
}

export function calcSubmissionTotalScore(submission: Submission): number {
  const essayTotal = submission.essayScores.reduce((sum, g) => sum + g.score, 0);
  return submission.mcScore + essayTotal;
}

// ---- Format Helpers ----

export function formatExamCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatTimer(seconds: number): string {
  if (seconds <= 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatExamFormat(format: Exam['format']): string {
  switch (format) {
    case 'PG_ONLY': return 'Pilihan Ganda';
    case 'ESSAY_ONLY': return 'Essay';
    case 'COMBINATION': return 'PG + Essay';
  }
}

export function formatTimerMode(mode: Exam['settings']['timerMode']): string {
  switch (mode) {
    case 'PER_QUESTION': return 'Per Soal';
    case 'WHOLE_EXAM': return 'Keseluruhan Ujian';
    case 'NONE': return 'Tanpa Timer';
  }
}

export function formatStatus(status: Exam['status']): string {
  switch (status) {
    case 'DRAFT': return 'Draft';
    case 'ACTIVE': return 'Aktif';
    case 'ENDED': return 'Selesai';
    case 'ARCHIVED': return 'Diarsipkan';
  }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  if (days === 1) return 'Kemarin';
  return `${days} hari lalu`;
}

// ---- Question Helpers ----

export function canAddMC(format: Exam['format']): boolean {
  return format === 'PG_ONLY' || format === 'COMBINATION';
}

export function canAddEssay(format: Exam['format']): boolean {
  return format === 'ESSAY_ONLY' || format === 'COMBINATION';
}

export function reorderQuestions(questions: Question[]): Question[] {
  return questions.map((q, i) => ({ ...q, order: i + 1 }));
}

// ---- Validation ----

export function validateQuestion(q: Partial<Question>): string[] {
  const errors: string[] = [];
  if (!q.text?.trim()) errors.push('Teks soal tidak boleh kosong');
  if (q.type === 'MULTIPLE_CHOICE') {
    if (!q.options || q.options.length < 2) errors.push('Minimal 2 opsi jawaban');
    if (!q.correctOptionId) errors.push('Pilih jawaban yang benar');
    if (q.options?.some(o => !o.text?.trim())) errors.push('Semua opsi harus diisi');
  }
  if (!q.weight || q.weight <= 0) errors.push('Bobot nilai harus lebih dari 0');
  return errors;
}

export function validateExam(exam: Partial<Exam>): string[] {
  const errors: string[] = [];
  if (!exam.title?.trim()) errors.push('Judul ujian tidak boleh kosong');
  if (!exam.subject?.trim()) errors.push('Mata pelajaran tidak boleh kosong');
  if (!exam.format) errors.push('Pilih format ujian');
  if (!exam.questions || exam.questions.length === 0) errors.push('Tambahkan minimal 1 soal');
  return errors;
}

// ---- Hash (demo-only, not cryptographically strong for prod) ----
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'ujianly_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
