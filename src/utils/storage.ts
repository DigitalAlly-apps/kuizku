// ============================================================
// Kuizku — Supabase Data Layer
// Replaces old localStorage implementation
// ============================================================
import { supabase } from '../lib/supabase';
import type { Teacher, Exam, BankQuestion, Submission, StudentAnswer, BillingSnapshot, Subscription, Workspace } from '../types';

const PENDING_SUBMISSION_QUEUE_KEY = 'kuizku_pending_submission_queue';

export type ExamLookupErrorType = 'NOT_FOUND' | 'NETWORK_ERROR' | 'PERMISSION_ERROR' | 'DATABASE_ERROR' | 'BACKEND_UNAVAILABLE';

export interface ExamLookupResult {
  exam: Exam | null;
  error?: {
    type: ExamLookupErrorType;
    message: string;
  };
}

export interface SaveSubmissionResult {
  saved: boolean;
  queued: boolean;
  error?: string;
}

export interface StudentExamLookupResult extends ExamLookupResult {
  attemptNumber?: number;
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
    const { data: { user } } = await supabase.auth.getUser();
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
    if (error || !data) return [];
    return data.map(dbToExam);
  },

  async getExamByCode(code: string): Promise<ExamLookupResult> {
    const { data, error } = await supabase.rpc('get_public_exam', { p_code: code });
    if (error) {
      console.error('getExamByCode error:', error);
      return { exam: null, error: classifyExamLookupError(error) };
    }
    if (!data) return { exam: null, error: { type: 'NOT_FOUND', message: 'Kode ujian tidak ditemukan. Periksa kembali kode dari guru Anda.' } };
    return { exam: dbToExam({ ...data, questions: [], preloaded_students: [] }) };
  },

  async getStudentExamByCode(code: string, name: string, identifier: string): Promise<StudentExamLookupResult> {
    const { data, error } = await supabase.rpc('get_student_exam', { p_code: code, p_name: name, p_identifier: identifier });
    if (error) return { exam: null, error: classifyExamLookupError(error) };
    if (!data?.allowed) return { exam: null, error: { type: 'PERMISSION_ERROR', message: 'Akses ujian ditolak.' } };
    return { exam: dbToExam(data.exam), attemptNumber: Number(data.next_attempt_number ?? 1) };
  },

  async saveExam(exam: Exam): Promise<{ error?: string }> {
    const activeFrom = exam.activeFrom && exam.activeFrom.trim() !== '' ? exam.activeFrom : null;
    const activeTo = exam.activeTo && exam.activeTo.trim() !== '' ? exam.activeTo : null;

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
      options: q.options || null,
      correct_option_id: q.correctOptionId || null,
      answer_guide: q.answerGuide || null,
      weight: q.weight,
      timer_seconds: q.timerSeconds ?? null,
      tags: q.tags || [],
      order: q.order,
    }));

    const studentsPayload = (exam.preloadedStudents || []).map(s => ({
      name: s.name,
      nis: s.nis,
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
    if (data.activeFrom !== undefined) payload.active_from = data.activeFrom || null;
    if (data.activeTo !== undefined) payload.active_to = data.activeTo || null;
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

  async deleteExam(id: string): Promise<void> {
    await supabase.from('exams').delete().eq('id', id);
  },

  // ---- Submissions ----
  async getSubmissionsByTeacher(teacherId: string): Promise<Submission[]> {
    const exams = await this.getExamsByTeacher(teacherId);
    if (!exams.length) return [];

    const examIds = exams.map(e => e.id);
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .in('exam_id', examIds);

    if (error || !data) return [];
    return data.map(dbToSubmission);
  },

  async getSubmissionsByExam(examId: string): Promise<Submission[]> {
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .eq('exam_id', examId);
    if (error || !data) return [];
    return data.map(dbToSubmission);
  },

  // Portal murid hanya perlu melihat submission miliknya sendiri untuk menghitung attempt/resume.
  async getStudentSubmissionsByExam(examId: string, nis: string): Promise<Submission[]> {
    const { data, error } = await supabase.from('submissions')
      .select('*, student_answers(*)')
      .eq('exam_id', examId)
      .eq('nis', nis);
    if (error || !data) return [];
    return data.map(dbToSubmission);
  },

  async saveSubmission(sub: Submission): Promise<SaveSubmissionResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      const { error } = await supabase.rpc('save_student_submission', {
        p_submission: {
          id: sub.id, exam_id: sub.examId, student_name: sub.studentName, nis: sub.nis,
          attempt_number: sub.attemptNumber, started_at: sub.startedAt, is_complete: sub.isComplete,
          answers: sub.answers.map(answer => ({ question_id: answer.questionId, question_type: answer.questionType, selected_option_id: answer.selectedOptionId ?? null, essay_text: answer.essayText ?? null, time_taken_seconds: answer.timeTakenSeconds ?? null })),
          anti_cheat_events: sub.antiCheatEvents ?? [],
        },
      });
      if (error) {
        console.error('Error saving student submission:', error);
        const queue = readPendingSubmissionQueue().filter(item => item.id !== sub.id);
        writePendingSubmissionQueue([...queue, sub]);
        return { saved: false, queued: true, error: error.message };
      }
      writePendingSubmissionQueue(readPendingSubmissionQueue().filter(item => item.id !== sub.id));
      return { saved: true, queued: false };
    }
    const { error: subErr } = await supabase.from('submissions').upsert({
      id: sub.id,
      exam_id: sub.examId,
      student_name: sub.studentName,
      nis: sub.nis,
      attempt_number: sub.attemptNumber,
      mc_score: sub.mcScore,
      total_score: sub.totalScore,
      started_at: sub.startedAt,
      submitted_at: sub.submittedAt,
      is_complete: sub.isComplete,
      teacher_feedback: sub.teacherFeedback || null,
      is_returned: sub.isReturned || false,
      anti_cheat_events: sub.antiCheatEvents || []
    });
    if (subErr) {
      console.error('Error saving submission:', subErr);
      const queue = readPendingSubmissionQueue().filter(item => item.id !== sub.id);
      writePendingSubmissionQueue([...queue, sub]);
      return { saved: false, queued: true, error: subErr.message };
    }

    if (sub.answers.length > 0) {
      const aInserts = sub.answers.map(a => {
        const grade = sub.essayScores?.find(g => g.questionId === a.questionId);
        return {
          submission_id: sub.id,
          question_id: a.questionId,
          question_type: a.questionType,
          selected_option_id: a.selectedOptionId,
          essay_text: a.essayText,
          time_taken_seconds: a.timeTakenSeconds,
          essay_score: grade?.score,
          essay_comment: grade?.comment
        };
      });
      await supabase.from('student_answers').delete().eq('submission_id', sub.id);
      const { error: answersErr } = await supabase.from('student_answers').insert(aInserts);
      if (answersErr) {
        console.error('Error saving student answers:', answersErr);
        const queue = readPendingSubmissionQueue().filter(item => item.id !== sub.id);
        writePendingSubmissionQueue([...queue, sub]);
        return { saved: false, queued: true, error: answersErr.message };
      }
    }

    writePendingSubmissionQueue(readPendingSubmissionQueue().filter(item => item.id !== sub.id));
    return { saved: true, queued: false };
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
  async getBankQuestions(teacherId: string): Promise<BankQuestion[]> {
    const { data, error } = await supabase.from('bank_questions').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(q => ({
      id: q.id,
      teacherId: q.teacher_id,
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
      answerGuide: q.answer_guide,
      weight: q.weight,
      tags: q.tags || [],
      order: 0
    }));
  },

  async saveBankQuestion(bq: BankQuestion): Promise<void> {
    await supabase.from('bank_questions').upsert({
      id: bq.id,
      teacher_id: bq.teacherId,
      subject: bq.subject,
      class_name: bq.className || null,
      used_in_exam_ids: bq.usedInExamIds,
      type: bq.type,
      text: bq.text,
      image_url: bq.imageUrl,
      options: bq.options,
      correct_option_id: bq.correctOptionId,
      answer_guide: bq.answerGuide,
      weight: bq.weight,
      tags: bq.tags,
      updated_at: new Date().toISOString()
    });
  },

  async deleteBankQuestion(id: string): Promise<void> {
    await supabase.from('bank_questions').delete().eq('id', id);
  },

  // ---- Student History ----
  async saveStudentHistory(entry: {
    examCode: string;
    examTitle: string;
    studentName: string;
    nis: string;
    mcScore: number;
    totalScore?: number;
    maxScore: number;
    submittedAt: string;
    showScore: boolean;
  }): Promise<void> {
    await supabase.from('student_history').insert({
      exam_code: entry.examCode,
      exam_title: entry.examTitle,
      student_name: entry.studentName,
      nis: entry.nis,
      mc_score: entry.mcScore,
      total_score: entry.totalScore ?? null,
      max_score: entry.maxScore,
      submitted_at: entry.submittedAt,
      show_score: entry.showScore,
    });
  },

  async getStudentHistory(nis: string): Promise<Array<{
    id: string;
    examCode: string;
    examTitle: string;
    studentName: string;
    nis: string;
    mcScore: number;
    totalScore?: number;
    maxScore: number;
    submittedAt: string;
    showScore: boolean;
  }>> {
    const { data, error } = await supabase
      .from('student_history')
      .select('*')
      .eq('nis', nis)
      .order('submitted_at', { ascending: false })
      .limit(100);
    if (error || !data) return [];
    return data.map(r => ({
      id: r.id,
      examCode: r.exam_code,
      examTitle: r.exam_title,
      studentName: r.student_name,
      nis: r.nis,
      mcScore: r.mc_score,
      totalScore: r.total_score ?? undefined,
      maxScore: r.max_score,
      submittedAt: r.submitted_at,
      showScore: r.show_score,
    }));
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
    preloadedStudents: db.preloaded_students?.map((s: any) => ({ name: s.name, nis: s.nis })) || [],
    questions: (db.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      imageUrl: q.image_url,
      options: q.options,
      correctOptionId: q.correct_option_id,
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
    nis: db.nis,
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
