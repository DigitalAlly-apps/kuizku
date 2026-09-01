// ============================================================
// Kuizku — Supabase Data Layer
// Replaces old localStorage implementation
// ============================================================
import { supabase } from '../lib/supabase';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { localDateTimeToIso } from './helpers';
import { getStudentAccessMessage, type StudentAccessMetadata, type StudentAccessReason } from './studentMessages';
import type { Teacher, Exam, BankQuestion, QuestionCollection, Submission, StudentAnswer, BillingSnapshot, Subscription, Workspace, StudentRanking, AiGradingSuggestion, AiGradingSuggestionStatus } from '../types';

const PENDING_SUBMISSION_QUEUE_KEY = 'kuizku_pending_submission_queue';

export type ExamLookupErrorType = 'NOT_FOUND' | 'NETWORK_ERROR' | 'PERMISSION_ERROR' | 'DATABASE_ERROR' | 'BACKEND_UNAVAILABLE';

export interface ExamLookupResult {
  exam: Exam | null;
  error?: {
    type: ExamLookupErrorType;
    message: string;
    reason?: StudentAccessReason;
    metadata?: StudentAccessMetadata;
  };
}

export interface SaveSubmissionResult {
  saved: boolean;
  queued: boolean;
  error?: string;
  mcScore?: number;
  totalScore?: number;
}

export interface MutationResult {
  success: boolean;
  error?: string;
  isFinal?: boolean;
  totalScore?: number;
  essayGradedCount?: number;
  essayCount?: number;
}

export interface StudentAttemptOverview {
  participantId: string;
  extraAttempts: number;
}

const AI_GRADING_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: 'Sesi guru sudah berakhir. Silakan login ulang lalu coba lagi.',
  forbidden: 'Ujian ini tidak dapat dinilai oleh akun guru yang sedang login.',
  submission_not_available: 'Jawaban murid belum final, sudah dikembalikan, atau tidak ditemukan.',
  no_essay_questions: 'Submission ini tidak memiliki soal essay.',
  answer_guide_required: 'Lengkapi panduan jawaban pada semua soal essay terlebih dahulu.',
  gemini_not_configured: 'Secret GEMINI_API_KEY belum terbaca oleh Edge Function.',
  gemini_auth_failed: 'API key Gemini tidak valid, diblokir, atau tidak memiliki akses. Buat key baru di Google AI Studio.',
  gemini_rate_limited: 'Kuota Gemini sedang habis atau terkena batas permintaan. Coba lagi beberapa saat.',
  gemini_timeout: 'Gemini terlalu lama merespons. Coba lagi.',
  gemini_unavailable: 'Layanan Gemini tidak dapat dijangkau. Coba lagi.',
  gemini_provider_error: 'Gemini menolak permintaan. Periksa model dan akses API key.',
  gemini_invalid_schema: 'Format penilaian dari Gemini tidak sesuai. Nilai belum diubah.',
  gemini_invalid_response: 'Respons Gemini tidak dapat dibaca. Nilai belum diubah.',
  audit_save_failed: 'Saran diterima, tetapi audit penilaian gagal disimpan. Nilai belum diubah.',
  database_error: 'Data penilaian tidak dapat dibaca dari server.',
};

async function describeAiFunctionError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await (error.context as Response).json() as { error?: string };
      if (body.error && AI_GRADING_ERROR_MESSAGES[body.error]) return AI_GRADING_ERROR_MESSAGES[body.error];
    } catch {
      // Response non-JSON ditangani dengan pesan status di bawah.
    }
    const status = (error.context as Response | undefined)?.status;
    return status ? `Server penilaian AI mengembalikan error ${status}. Coba login ulang lalu ulangi.` : 'Server penilaian AI menolak permintaan.';
  }
  if (error instanceof FunctionsFetchError) return 'Browser gagal terhubung ke Edge Function. Periksa koneksi lalu muat ulang aplikasi.';
  if (error instanceof FunctionsRelayError) return 'Edge Function sedang tidak tersedia. Coba lagi beberapa saat.';
  return error instanceof Error ? error.message : 'Saran AI belum tersedia. Coba lagi.';
}

export interface StudentExamLookupResult extends ExamLookupResult {
  participantId?: string;
  attemptNumber?: number;
  attemptCount?: number;
  maxAttempts?: number;
  resume?: boolean;
}

function describeStudentAccessDenial(data?: Record<string, unknown>): ExamLookupResult['error'] {
  const reason = String(data?.reason ?? '') as StudentAccessReason;
  const metadata: StudentAccessMetadata = {
    attemptCount: data?.attempt_count == null ? undefined : Number(data.attempt_count),
    maxAttempts: data?.max_attempts == null ? undefined : Number(data.max_attempts),
    activeFrom: typeof data?.active_from === 'string' ? data.active_from : null,
    activeTo: typeof data?.active_to === 'string' ? data.active_to : null,
    examStatus: typeof data?.exam_status === 'string' ? data.exam_status : null,
  };
  return {
    type: reason === 'NOT_FOUND' ? 'NOT_FOUND' : reason === 'NETWORK_ERROR' ? 'NETWORK_ERROR' : 'PERMISSION_ERROR',
    reason,
    metadata,
    message: getStudentAccessMessage(reason, metadata),
  };
}

function classifyExamLookupError(error: { code?: string; message?: string; status?: number }): ExamLookupResult['error'] {
  const message = error.message?.toLowerCase() ?? '';

  if (error.status === 401 || error.status === 403 || error.code === '42501' || message.includes('permission denied')) {
    return { type: 'PERMISSION_ERROR', message: 'Ujian tidak dapat diakses saat ini.' };
  }
  if (message.includes('failed to fetch') || message.includes('network') || message.includes('networkerror')) {
    return { type: 'NETWORK_ERROR', message: 'Koneksi ke server ujian bermasalah. Silakan coba lagi.' };
  }
  if (error.status === 502 || error.status === 503 || error.status === 504 || message.includes('project is paused')) {
    return { type: 'BACKEND_UNAVAILABLE', message: 'Server ujian sedang bermasalah. Silakan coba lagi.' };
  }
  return { type: 'DATABASE_ERROR', message: 'Ujian belum dapat dimuat. Silakan coba lagi.' };
}

function defaultFreeSubscription(teacherId: string): Subscription {
  const now = new Date().toISOString();
  return {
    id: `free_${teacherId}`,
    workspaceId: `workspace_${teacherId}`,
    planKey: 'free',
    status: 'free',
    promoPaymentsUsed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function readPendingSubmissionQueue(): Submission[] {
  try {
    return JSON.parse(localStorage.getItem(PENDING_SUBMISSION_QUEUE_KEY) || '[]') as Submission[];
  } catch {
    return [];
  }
}

function writePendingSubmissionQueue(queue: Submission[]): void {
  localStorage.setItem(PENDING_SUBMISSION_QUEUE_KEY, JSON.stringify(queue));
}

function isRetryableNetworkError(error: { message?: string; status?: number }): boolean {
  const message = error.message?.toLowerCase() ?? '';
  return !navigator.onLine || error.status === 502 || error.status === 503 || error.status === 504
    || message.includes('failed to fetch') || message.includes('network') || message.includes('networkerror');
}

export const storage = {
  // ---- Auth / Teacher ----
  async registerTeacher(data: Omit<Teacher, 'id' | 'createdAt'> & { password: string }): Promise<{ teacher: Teacher | null, error?: string }> {
    // 1. SignUp to Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: data.email.toLowerCase().trim(),
      password: data.password,
    });

    if (authErr) {
      console.error('Supabase Auth Error:', authErr);
      if (authErr.message.includes('User already registered') || authErr.message.includes('already been registered')) {
        return { teacher: null, error: 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.' };
      }
      return { teacher: null, error: authErr.message || 'Gagal mendaftar.' };
    }
    if (!authData.user) return { teacher: null, error: 'Gagal membuat akun.' };

    if (!authData.user.identities || authData.user.identities.length === 0) {
      return { teacher: null, error: 'Email ini sudah terdaftar. Silakan login atau gunakan email lain.' };
    }

    // 2. Upsert into public.teachers
    const teacher: Teacher = {
      id: authData.user.id,
      name: data.name,
      email: data.email,
      subject: data.subject,
      institution: data.institution,
      createdAt: new Date().toISOString()
    };
    const { error: dbErr } = await supabase.from('teachers').upsert(
      [{ id: teacher.id, name: teacher.name, email: teacher.email, subject: teacher.subject, institution: teacher.institution }],
      { onConflict: 'id' }
    );
    if (dbErr) {
      console.error('Teacher Upsert Error:', dbErr);
      return { teacher: null, error: 'Gagal menyimpan profil guru: ' + dbErr.message };
    }
    return { teacher };
  },

  async loginTeacher(email: string, password: string): Promise<{ teacher: Teacher | null, error?: string }> {
    // Lowercase email agar case-insensitive (Supabase Auth case-sensitive)
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: email.toLowerCase().trim(),
      password,
    });
    if (authErr) {
      if (authErr.message.includes('Email not confirmed')) return { teacher: null, error: 'Email belum dikonfirmasi. Silakan cek inbox/spam email Anda.' };
      return { teacher: null, error: 'Email atau password salah' };
    }
    if (!authData.user) return { teacher: null, error: 'User tidak ditemukan' };

    // Pastikan session sudah tersimpan sebelum query DB
    await supabase.auth.getSession();

    const { data: tData, error: dbErr } = await supabase.from('teachers').select('*').eq('id', authData.user.id).single();
    if (dbErr || !tData) return { teacher: null, error: 'Data profil guru tidak ditemukan di database' };

    return {
      teacher: {
        id: tData.id,
        name: tData.name,
        email: tData.email,
        subject: tData.subject || '',
        institution: tData.institution || '',
        createdAt: tData.created_at
      }
    };
  },

  async loginWithGoogle(): Promise<{ error?: string }> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    return error ? { error: error.message } : {};
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentTeacher(): Promise<Teacher | null> {
    // getSession restores the persisted browser session without forcing a
    // network round-trip before the protected layout has rendered.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return null;
    const { data: tData } = await supabase.from('teachers').select('*').eq('id', user.id).single();
    if (!tData) {
      const { error } = await supabase.from('teachers').upsert({
        id: user.id,
        name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Guru',
        email: user.email?.toLowerCase() || '',
        subject: '',
        institution: '',
      }, { onConflict: 'id' });
      if (error) return null;
      return this.getCurrentTeacher();
    }
    return {
      id: tData.id, name: tData.name, email: tData.email,
      subject: tData.subject || '', institution: tData.institution || '', createdAt: tData.created_at
    };
  },

  async updateTeacher(id: string, data: { name: string; subject: string; institution: string }): Promise<{ error?: string }> {
    const { error } = await supabase.from('teachers').update({
      name: data.name,
      subject: data.subject,
      institution: data.institution,
    }).eq('id', id);
    if (error) return { error: error.message };
    return {};
  },

  async getBillingSnapshot(teacher: Teacher): Promise<BillingSnapshot> {
    const fallback: BillingSnapshot = {
      workspace: null,
      subscription: defaultFreeSubscription(teacher.id),
    };

    const { data: wsData, error: wsErr } = await supabase.from('workspaces')
      .select('*')
      .eq('owner_id', teacher.id)
      .maybeSingle();

    if (wsErr || !wsData) return fallback;

    const workspace: Workspace = {
      id: wsData.id,
      name: wsData.name || `${teacher.name} Workspace`,
      type: wsData.type || 'individual',
      ownerId: wsData.owner_id,
      createdAt: wsData.created_at,
      updatedAt: wsData.updated_at,
    };

    const { data: subData, error: subErr } = await supabase.from('subscriptions')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !subData) {
      return { workspace, subscription: { ...fallback.subscription, workspaceId: workspace.id } };
    }

    const subscription: Subscription = {
      id: subData.id,
      workspaceId: subData.workspace_id,
      planKey: subData.plan_key || 'free',
      status: subData.status || 'free',
      currentPeriodStart: subData.current_period_start || undefined,
      currentPeriodEnd: subData.current_period_end || undefined,
      promoPaymentsUsed: subData.promo_payments_used ?? 0,
      manualPaymentNote: subData.manual_payment_note || undefined,
      createdAt: subData.created_at,
      updatedAt: subData.updated_at,
    };

    return { workspace, subscription };
  },

  async requestPasswordReset(email: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { error: error.message };
    return {};
  },

  async updatePassword(password: string): Promise<{ error?: string }> {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return {};
  },

  // ---- Exams ----
  async getExamsByTeacher(teacherId: string): Promise<Exam[]> {
    const { data, error } = await supabase.from('exams').select('*, questions(*), preloaded_students(*)').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) throw new Error(`Gagal memuat ujian: ${error.message}`);
    if (!data) return [];
    return data.map(dbToExam);
  },

  async getExamByCode(code: string): Promise<ExamLookupResult> {
    const { data, error } = await supabase.rpc('get_public_exam', { p_code: code });
    if (error) {
      console.error('getExamByCode error:', error);
      return { exam: null, error: classifyExamLookupError(error) };
    }
    if (!data) return { exam: null, error: { type: 'NOT_FOUND', message: 'Kode ujian tidak ditemukan. Periksa kembali kode dari guru Anda.' } };
    return { exam: dbToExam({ ...data, questions: [], preloaded_students: data.preloaded_students ?? [] }) };
  },

  async getStudentExamByCode(code: string, name: string, participantId = ''): Promise<StudentExamLookupResult> {
    const { data, error } = await supabase.rpc('get_student_exam', { p_code: code, p_name: name, p_participant_id: participantId || null });
    if (error) return { exam: null, error: classifyExamLookupError(error) };
    if (!data?.allowed) return { exam: null, error: describeStudentAccessDenial(data) };
    return {
      exam: dbToExam(data.exam),
      participantId: typeof data.participant_id === 'string' ? data.participant_id : undefined,
      attemptNumber: Number(data.next_attempt_number ?? 1),
      attemptCount: Number(data.attempt_count ?? 0),
      maxAttempts: Number(data.max_attempts ?? data.exam?.settings?.maxAttempts ?? 1),
      resume: data.resume === true,
    };
  },

  async saveExam(exam: Exam): Promise<{ error?: string }> {
    const activeFrom = localDateTimeToIso(exam.activeFrom);
    const activeTo = localDateTimeToIso(exam.activeTo);

    const examPayload = {
      id: exam.id,
      teacher_id: exam.teacherId,
      title: exam.title,
      description: exam.description || null,
      subject: exam.subject,
      class_name: exam.className || null,
      exam_type: exam.examType || 'UJIAN',
      format: exam.format,
      status: exam.status,
      code: exam.code,
      settings: exam.settings,
      active_from: activeFrom,
      active_to: activeTo,
      updated_at: new Date().toISOString(),
    };

    const questionsPayload = exam.questions.map(q => ({
      id: q.id,
      type: q.type,
      text: q.text,
      image_url: q.imageUrl || null,
      // The database constraint requires non-MC questions to use NULL for
      // options/correct_option_id. Empty arrays are not equivalent to NULL
      // in PostgreSQL and used to make Essay saves fail.
      options: q.type === 'MULTIPLE_CHOICE' ? (q.options || []) : null,
      correct_option_id: q.type === 'MULTIPLE_CHOICE' ? (q.correctOptionId || null) : null,
      accepted_answers: q.type === 'SHORT_ANSWER' ? (q.acceptedAnswers || []) : [],
      answer_guide: q.answerGuide || null,
      weight: q.weight,
      timer_seconds: q.timerSeconds ?? null,
      tags: q.tags || [],
      order: q.order,
    }));

    const studentsPayload = (exam.preloadedStudents || []).map(s => ({
      name: s.name,
      participant_id: s.participantId ?? null,
      // Kept solely so editing an old exam does not discard legacy data.
      nis: s.nis ?? '',
      attendance_no: s.attendanceNo ?? null,
    }));

    const { error } = await supabase.rpc('save_exam_full', {
      p_exam: examPayload,
      p_questions: questionsPayload,
      p_students: studentsPayload,
    });

    if (error) {
      console.error('❌ saveExam RPC error:', error);
      alert(`Gagal simpan ujian:\n\n${error.message}\n\nDetails: ${error.details ?? '-'}\nHint: ${error.hint ?? '-'}`);
      return { error: error.message };
    }
    return {};
  },

  // Update hanya metadata exam (judul, deskripsi, dll) tanpa menyentuh soal
  async updateExamMeta(id: string, data: {
    title?: string; description?: string; subject?: string; className?: string;
    examType?: string; activeFrom?: string | null; activeTo?: string | null;
    status?: string; settings?: object; updatedAt?: string;
  }): Promise<{ error?: string }> {
    const payload: Record<string, unknown> = { updated_at: data.updatedAt ?? new Date().toISOString() };
    if (data.title !== undefined) payload.title = data.title;
    if (data.description !== undefined) payload.description = data.description || null;
    if (data.subject !== undefined) payload.subject = data.subject;
    if (data.className !== undefined) payload.class_name = data.className || null;
    if (data.examType !== undefined) payload.exam_type = data.examType;
    if (data.activeFrom !== undefined) payload.active_from = localDateTimeToIso(data.activeFrom);
    if (data.activeTo !== undefined) payload.active_to = localDateTimeToIso(data.activeTo);
    if (data.status !== undefined) payload.status = data.status;
    if (data.settings !== undefined) payload.settings = data.settings;

    const { data: updatedRow, error } = await supabase
      .from('exams')
      .update(payload)
      .eq('id', id)
      .select('id, status')
      .maybeSingle();
    if (error) return { error: error.message };
    if (!updatedRow) return { error: 'Perubahan tidak dikonfirmasi oleh server. Ujian belum diperbarui.' };
    if (data.status !== undefined && updatedRow.status !== data.status) {
      return { error: 'Status ujian di server tidak sesuai dengan perubahan yang diminta.' };
    }
    return {};
  },

  async deleteExam(id: string): Promise<MutationResult> {
    const { data, error } = await supabase.rpc('delete_teacher_exam', { p_exam_id: id });
    if (error) {
      console.error('Error deleting exam:', error);
      if (error.code === '42501' || error.message.toLowerCase().includes('not authorized')) {
        return { success: false, error: 'Anda tidak memiliki izin untuk menghapus ujian ini.' };
      }
      return { success: false, error: 'Gagal menghapus ujian. Data ujian belum dihapus. Silakan coba lagi.' };
    }
    if (!data?.success) return { success: false, error: 'Ujian tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.' };
    return { success: true };
  },

  // ---- Submissions ----
  async getSubmissionsByTeacher(teacherId: string): Promise<Submission[]> {
    const exams = await this.getExamsByTeacher(teacherId);
    if (!exams.length) return [];

    const examIds = exams.map(e => e.id);
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .in('exam_id', examIds);

    if (error) throw new Error(`Gagal memuat hasil ujian: ${error.message}`);
    if (!data) return [];
    return data.map(dbToSubmission);
  },

  async getSubmissionsByExam(examId: string): Promise<Submission[]> {
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .eq('exam_id', examId);
    if (error) throw new Error(`Gagal memuat hasil ujian: ${error.message}`);
    if (!data) return [];
    return data.map(dbToSubmission);
  },

  // Portal murid hanya perlu melihat submission miliknya sendiri untuk menghitung attempt/resume.
  async getStudentSubmissionsByExam(examId: string, participantId: string): Promise<Submission[]> {
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .eq('exam_id', examId)
      .eq('participant_id', participantId);
    if (error) throw new Error(`Gagal memuat riwayat murid: ${error.message}`);
    if (!data) return [];
    return data.map(dbToSubmission);
  },

  async getStudentRanking(examCode: string, submissionId: string, participantId: string): Promise<StudentRanking> {
    const { data, error } = await supabase.rpc('get_student_exam_ranking', {
      p_exam_code: examCode,
      p_submission_id: submissionId,
      p_participant_id: participantId,
    });
    if (error) {
      console.error('Error loading student ranking:', error);
      return { available: false, entries: [], reason: 'UNAVAILABLE' };
    }
    if (!data?.available) {
      return { available: false, entries: [], reason: data?.reason ?? 'NOT_RELEASED' };
    }
    return {
      available: true,
      entries: Array.isArray(data.entries) ? data.entries.map((entry: { rank: number; studentName: string; isCurrent?: boolean }) => ({
        rank: Number(entry.rank),
        studentName: String(entry.studentName),
        isCurrent: entry.isCurrent === true,
      })) : [],
      currentRank: data.currentRank == null ? undefined : Number(data.currentRank),
      totalParticipants: data.totalParticipants == null ? undefined : Number(data.totalParticipants),
    };
  },

  async getStudentRankingVisitor(examCode: string, name = '', participantId = ''): Promise<StudentRanking> {
    const { data, error } = await supabase.rpc('get_student_exam_ranking_visitor', {
      p_exam_code: examCode,
      p_name: name,
      p_participant_id: participantId || null,
    });
    if (error) {
      console.error('Error loading visitor student ranking:', error);
      return { available: false, entries: [], reason: 'UNAVAILABLE' };
    }
    if (!data?.available) return { available: false, entries: [], reason: data?.reason ?? 'NOT_RELEASED' };
    return {
      available: true,
      entries: Array.isArray(data.entries) ? data.entries.map((entry: { rank: number; studentName: string; isCurrent?: boolean }) => ({
        rank: Number(entry.rank),
        studentName: String(entry.studentName),
        isCurrent: entry.isCurrent === true,
      })) : [],
      currentRank: data.currentRank == null ? undefined : Number(data.currentRank),
      totalParticipants: data.totalParticipants == null ? undefined : Number(data.totalParticipants),
    };
  },

  async saveSubmission(sub: Submission): Promise<SaveSubmissionResult> {
    const { data, error } = await supabase.rpc('save_student_submission', {
      p_submission: {
        id: sub.id, exam_id: sub.examId, student_name: sub.studentName, participant_id: sub.participantId ?? null, nis: sub.nis ?? '',
        attempt_number: sub.attemptNumber, started_at: sub.startedAt, is_complete: sub.isComplete,
        answers: sub.answers.map(answer => ({ question_id: answer.questionId, question_type: answer.questionType, selected_option_id: answer.selectedOptionId ?? null, essay_text: answer.essayText ?? null, short_answer: answer.shortAnswer ?? null, time_taken_seconds: answer.timeTakenSeconds ?? null })),
        anti_cheat_events: sub.antiCheatEvents ?? [],
      },
    });
    if (error) {
      console.error('Error saving student submission:', error);
      if (isRetryableNetworkError(error)) {
        const queue = readPendingSubmissionQueue().filter(item => item.id !== sub.id);
        writePendingSubmissionQueue([...queue, sub]);
        return { saved: false, queued: true, error: error.message };
      }
      return { saved: false, queued: false, error: error.message };
    }
    writePendingSubmissionQueue(readPendingSubmissionQueue().filter(item => item.id !== sub.id));
    return { saved: true, queued: false, mcScore: Number(data?.mc_score ?? 0), totalScore: data?.total_score == null ? undefined : Number(data.total_score) };
  },

  async grantStudentExtraAttempt(examId: string, studentIdentifier: string): Promise<{ extraAttempts?: number; error?: string }> {
    const { data, error } = await supabase.rpc('grant_student_extra_attempt', {
      p_exam_id: examId,
      p_student_identifier: studentIdentifier.trim(),
    });
    if (error || data?.success !== true) {
      console.error('grantStudentExtraAttempt error:', error ?? data);
      return { error: 'Kesempatan tambahan belum dapat diberikan. Silakan coba lagi.' };
    }
    return { extraAttempts: Number(data.extra_attempts ?? 0) };
  },

  async getTeacherAttemptOverview(examId: string): Promise<{ overrides: StudentAttemptOverview[]; error?: string }> {
    const { data, error } = await supabase.rpc('get_teacher_attempt_overview', { p_exam_id: examId });
    if (error) {
      console.error('getTeacherAttemptOverview error:', error);
      return { overrides: [], error: 'Data kesempatan belum dapat dimuat.' };
    }
    return {
      overrides: (data ?? []).map((row: { participant_id: string; extra_attempts: number }) => ({
        participantId: row.participant_id,
        extraAttempts: Number(row.extra_attempts ?? 0),
      })),
    };
  },

  async saveSubmissionGrading(submissionId: string, grades: Array<{ questionId: string; score: number; comment?: string }>, feedback: string): Promise<MutationResult> {
    const { data, error } = await supabase.rpc('save_submission_grading', {
      p_submission_id: submissionId,
      p_grades: grades.map(grade => ({ question_id: grade.questionId, score: grade.score, comment: grade.comment ?? '' })),
      p_feedback: feedback,
      p_update_feedback: true,
    });
    if (error) return { success: false, error: error.message };
    return {
      success: true,
      isFinal: data?.is_final === true,
      totalScore: data?.total_score == null ? undefined : Number(data.total_score),
      essayGradedCount: data?.essay_graded_count == null ? undefined : Number(data.essay_graded_count),
      essayCount: data?.essay_count == null ? undefined : Number(data.essay_count),
    };
  },

  async requestAiEssaySuggestions(submissionId: string): Promise<{ suggestions?: AiGradingSuggestion[]; error?: string }> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      return { error: 'Sesi guru tidak ditemukan. Silakan login ulang lalu coba lagi.' };
    }
    const { data, error } = await supabase.functions.invoke('suggest-essay-grades', {
      body: { submissionId },
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      timeout: 55_000,
    });
    if (error) return { error: await describeAiFunctionError(error) };
    if (!Array.isArray(data?.suggestions)) return { error: 'Saran AI tidak valid. Nilai belum diubah.' };
    return { suggestions: data.suggestions as AiGradingSuggestion[] };
  },

  async updateAiGradingSuggestionStatuses(decisions: Array<{ id: string; status: AiGradingSuggestionStatus }>): Promise<void> {
    await Promise.all(decisions.map(({ id, status }) => supabase.from('ai_grading_suggestions')
      .update({ status, decided_at: new Date().toISOString() })
      .eq('id', id)));
  },

  async returnSubmission(submissionId: string): Promise<MutationResult> {
    const { data, error } = await supabase.from('submissions')
      .update({ is_returned: true })
      .eq('id', submissionId)
      .select('id')
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Jawaban tidak ditemukan atau Anda tidak memiliki izin.' };
    return { success: true };
  },

  async deleteTeacherSubmission(submissionId: string): Promise<MutationResult> {
    const { data, error } = await supabase.rpc('delete_teacher_submission', { p_submission_id: submissionId });
    if (error) {
      // Detail Supabase tetap tersedia bagi developer tanpa membocorkan nama
      // function, schema cache, atau struktur database kepada guru.
      console.error('Error deleting teacher submission:', error);
      if (error.code === '42501' || error.message.toLowerCase().includes('not authorized')) {
        return { success: false, error: 'Anda tidak memiliki izin untuk menghapus submission ini.' };
      }
      return { success: false, error: 'Submission gagal dihapus. Silakan coba lagi.' };
    }
    if (data?.deleted !== true) return { success: false, error: 'Submission gagal dihapus. Silakan coba lagi.' };
    return { success: true };
  },

  getPendingSubmissionQueueCount(): number {
    return readPendingSubmissionQueue().length;
  },

  async syncPendingSubmissions(): Promise<{ count: number; submissionIds: string[] }> {
    const queue = readPendingSubmissionQueue();
    if (!queue.length) return { count: 0, submissionIds: [] };
    const submissionIds: string[] = [];
    for (const submission of queue) {
      const result = await this.saveSubmission(submission);
      if (result.saved) submissionIds.push(submission.id);
    }
    return { count: submissionIds.length, submissionIds };
  },

  // ---- Question Bank ----
  async getQuestionCollections(teacherId: string): Promise<QuestionCollection[]> {
    const { data, error } = await supabase.from('question_collections').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: true });
    if (error) throw new Error(`Gagal memuat kategori bank soal: ${error.message}`);
    return (data ?? []).map(c => ({ id: c.id, teacherId: c.teacher_id, name: c.name, description: c.description || undefined, subject: c.subject || '', className: c.class_name || undefined, tags: c.tags || [], createdAt: c.created_at, updatedAt: c.updated_at }));
  },

  async createQuestionCollection(collection: Omit<QuestionCollection, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ collection?: QuestionCollection; error?: string }> {
    const { data, error } = await supabase.from('question_collections').insert({
      teacher_id: collection.teacherId, name: collection.name.trim(), description: collection.description || null,
      subject: collection.subject || '', class_name: collection.className || null, tags: collection.tags || [],
    }).select('*').single();
    if (error) return { error: error.message };
    return { collection: { id: data.id, teacherId: data.teacher_id, name: data.name, description: data.description || undefined, subject: data.subject || '', className: data.class_name || undefined, tags: data.tags || [], createdAt: data.created_at, updatedAt: data.updated_at } };
  },

  async getOrCreateDefaultQuestionCollection(teacherId: string): Promise<{ collection?: QuestionCollection; error?: string }> {
    const { data, error } = await supabase.from('question_collections').select('*').eq('teacher_id', teacherId).eq('name', 'Belum Dikelompokkan').maybeSingle();
    if (error) return { error: error.message };
    if (data) return { collection: { id: data.id, teacherId: data.teacher_id, name: data.name, description: data.description || undefined, subject: data.subject || '', className: data.class_name || undefined, tags: data.tags || [], createdAt: data.created_at, updatedAt: data.updated_at } };
    return this.createQuestionCollection({ teacherId, name: 'Belum Dikelompokkan', subject: '', tags: [] });
  },

  async getBankQuestions(teacherId: string): Promise<BankQuestion[]> {
    const { data, error } = await supabase.from('bank_questions').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error) throw new Error(`Gagal memuat bank soal: ${error.message}`);
    if (!data) return [];
    return data.map(q => ({
      id: q.id,
      teacherId: q.teacher_id,
      collectionId: q.collection_id,
      subject: q.subject,
      className: q.class_name,
      usedInExamIds: q.used_in_exam_ids || [],
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      type: q.type,
      text: q.text,
      imageUrl: q.image_url,
      options: q.options,
      correctOptionId: q.correct_option_id,
      acceptedAnswers: q.accepted_answers || [],
      answerGuide: q.answer_guide,
      weight: q.weight,
      tags: q.tags || [],
      order: 0
    }));
  },

  async saveBankQuestion(bq: BankQuestion): Promise<MutationResult> {
    let collectionId = bq.collectionId;
    if (!collectionId) {
      const collectionResult = await this.getOrCreateDefaultQuestionCollection(bq.teacherId);
      if (!collectionResult.collection) return { success: false, error: collectionResult.error || 'Kategori bank soal tidak tersedia.' };
      collectionId = collectionResult.collection.id;
    }
    const { data, error } = await supabase.from('bank_questions').upsert({
      id: bq.id,
      teacher_id: bq.teacherId,
      collection_id: collectionId,
      subject: bq.subject,
      class_name: bq.className || null,
      used_in_exam_ids: bq.usedInExamIds,
      type: bq.type,
      text: bq.text,
      image_url: bq.imageUrl,
      options: bq.options,
      correct_option_id: bq.correctOptionId,
      accepted_answers: bq.acceptedAnswers || [],
      answer_guide: bq.answerGuide,
      weight: bq.weight,
      tags: bq.tags,
      updated_at: new Date().toISOString()
    }).select('id').maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Soal tidak dikonfirmasi oleh server.' };
    return { success: true };
  },

  async deleteBankQuestion(id: string): Promise<{ error?: string }> {
    const { data, error } = await supabase
      .from('bank_questions')
      .delete()
      .eq('id', id)
      .select('id');

    if (error) {
      console.error('Error deleting bank question:', error);
      return { error: error.message };
    }
    if (!data?.some(question => question.id === id)) {
      return { error: 'Soal tidak ditemukan atau Anda tidak memiliki izin untuk menghapusnya.' };
    }
    return {};
  },

};

// --- Parsers ---
function dbToExam(db: any): Exam {
  return {
    id: db.id,
    teacherId: db.teacher_id,
    title: db.title,
    description: db.description,
    subject: db.subject,
    className: db.class_name,
    examType: (db.exam_type as import('../types').ExamType) || 'UJIAN',
    format: db.format,
    status: db.status,
    code: db.code,
    settings: db.settings || {},
    activeFrom: db.active_from,
    activeTo: db.active_to,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    preloadedStudents: db.preloaded_students?.map((s: any) => ({ name: s.name, participantId: s.participant_id ?? s.id, nis: s.nis || undefined, attendanceNo: s.attendance_no == null ? undefined : Number(s.attendance_no) })) || [],
    questions: (db.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      imageUrl: q.image_url,
      options: q.options,
      correctOptionId: q.correct_option_id,
      acceptedAnswers: q.accepted_answers || [],
      answerGuide: q.answer_guide,
      weight: q.weight,
      timerSeconds: q.timer_seconds,
      tags: q.tags || [],
      order: q.order
    })).sort((a: any, b: any) => a.order - b.order)
  };
}

function dbToSubmission(db: any): Submission {
  const answers: StudentAnswer[] = [];
  const essayScores: any[] = [];

  (db.student_answers || []).forEach((a: any) => {
    answers.push({
      questionId: a.question_id,
      questionType: a.question_type,
      selectedOptionId: a.selected_option_id,
      essayText: a.essay_text,
      shortAnswer: a.short_answer,
      timeTakenSeconds: a.time_taken_seconds
    });
    if (a.essay_score !== null && a.essay_score !== undefined) {
      essayScores.push({
        questionId: a.question_id,
        score: a.essay_score,
        comment: a.essay_comment
      });
    }
  });

  return {
    id: db.id,
    examId: db.exam_id,
    studentName: db.student_name,
    participantId: db.participant_id ?? undefined,
    nis: db.nis || undefined,
    attemptNumber: db.attempt_number,
    mcScore: db.mc_score,
    totalScore: db.total_score,
    startedAt: db.started_at,
    submittedAt: db.submitted_at,
    isComplete: db.is_complete,
    teacherFeedback: db.teacher_feedback || undefined,
    isReturned: db.is_returned || false,
    antiCheatEvents: db.anti_cheat_events || [],
    answers,
    essayScores
  };
}
