// ============================================================
// KuizKu — Supabase Data Layer
// Replaces old localStorage implementation
// ============================================================
import { supabase } from '../lib/supabase';
import type { Teacher, Exam, BankQuestion, Submission, StudentAnswer } from '../types';

export const storage = {
  // ---- Auth / Teacher ----
  async registerTeacher(data: Omit<Teacher, 'id' | 'createdAt'>): Promise<Teacher | null> {
    // 1. SignUp to Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (authErr || !authData.user) {
      console.error('Supabase Auth Error:', authErr);
      return null;
    }
    // 2. Insert into public.teachers
    const teacher: Teacher = {
      id: authData.user.id,
      name: data.name,
      email: data.email,
      password: '', // do not store plain text
      subject: data.subject,
      institution: data.institution,
      createdAt: new Date().toISOString()
    };
    const { error: dbErr } = await supabase.from('teachers').insert([
      { id: teacher.id, name: teacher.name, email: teacher.email, subject: teacher.subject, institution: teacher.institution }
    ]);
    if (dbErr) {
      console.error('Teacher Insert Error:', dbErr);
      return null;
    }
    return teacher;
  },

  async loginTeacher(email: string, password: string): Promise<Teacher | null> {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !authData.user) return null;
    
    const { data: tData, error: dbErr } = await supabase.from('teachers').select('*').eq('id', authData.user.id).single();
    if (dbErr || !tData) return null;

    return {
      id: tData.id,
      name: tData.name,
      email: tData.email,
      password: '',
      subject: tData.subject || '',
      institution: tData.institution || '',
      createdAt: tData.created_at
    };
  },

  async logout(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getCurrentTeacher(): Promise<Teacher | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: tData } = await supabase.from('teachers').select('*').eq('id', user.id).single();
    if (!tData) return null;
    return {
      id: tData.id, name: tData.name, email: tData.email, password: '',
      subject: tData.subject || '', institution: tData.institution || '', createdAt: tData.created_at
    };
  },

  // ---- Exams ----
  async getExamsByTeacher(teacherId: string): Promise<Exam[]> {
    const { data, error } = await supabase.from('exams').select('*, questions(*), preloaded_students(*)').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error || !data) return [];
    
    return data.map(dbToExam);
  },

  async getExamByCode(code: string): Promise<Exam | null> {
    const { data, error } = await supabase.from('exams').select('*, questions(*), preloaded_students(*)').eq('code', code.toUpperCase()).single();
    if (error || !data) return null;
    return dbToExam(data);
  },

  async saveExam(exam: Exam): Promise<void> {
    // 1. Upsert Exam
    const { error: examErr } = await supabase.from('exams').upsert({
      id: exam.id,
      teacher_id: exam.teacherId,
      title: exam.title,
      description: exam.description,
      subject: exam.subject,
      format: exam.format,
      status: exam.status,
      code: exam.code,
      settings: exam.settings,
      active_from: exam.activeFrom,
      active_to: exam.activeTo,
      updated_at: new Date().toISOString()
    });
    if (examErr) { console.error('Error saving exam:', examErr); return; }

    // 2. Refresh Questions (Delete old, Insert new)
    await supabase.from('questions').delete().eq('exam_id', exam.id);
    if (exam.questions.length > 0) {
      const qInserts = exam.questions.map(q => ({
        id: q.id,
        exam_id: exam.id,
        type: q.type,
        text: q.text,
        image_url: q.imageUrl,
        options: q.options,
        correct_option_id: q.correctOptionId,
        answer_guide: q.answerGuide,
        weight: q.weight,
        timer_seconds: q.timerSeconds,
        tags: q.tags,
        order: q.order
      }));
      await supabase.from('questions').insert(qInserts);
    }

    // 3. Refresh Preloaded Students
    await supabase.from('preloaded_students').delete().eq('exam_id', exam.id);
    if (exam.preloadedStudents && exam.preloadedStudents.length > 0) {
      const sInserts = exam.preloadedStudents.map(s => ({
        exam_id: exam.id,
        name: s.name,
        nis: s.nis
      }));
      await supabase.from('preloaded_students').insert(sInserts);
    }
  },

  async deleteExam(id: string): Promise<void> {
    await supabase.from('exams').delete().eq('id', id);
  },

  // ---- Submissions ----
  async getSubmissionsByTeacher(teacherId: string): Promise<Submission[]> {
    // Requires joining submissions with exams where teacher_id matches
    // For simplicity in prototype, we'll fetch exams then submissions
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

  async saveSubmission(sub: Submission): Promise<void> {
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
      is_complete: sub.isComplete
    });
    if (subErr) { console.error('Error saving submission:', subErr); return; }

    // Upsert Answers
    if (sub.answers.length > 0) {
      const aInserts = sub.answers.map(a => {
        // Also find grade if exists
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
      // Delete old answers for this submission to avoid unique constraint issues then insert
      await supabase.from('student_answers').delete().eq('submission_id', sub.id);
      await supabase.from('student_answers').insert(aInserts);
    }
  },

  // ---- Question Bank ----
  async getBankQuestions(teacherId: string): Promise<BankQuestion[]> {
    const { data, error } = await supabase.from('bank_questions').select('*').eq('teacher_id', teacherId).order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(q => ({
      id: q.id,
      teacherId: q.teacher_id,
      subject: q.subject,
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
  }
};

// --- Parsers ---
function dbToExam(db: any): Exam {
  return {
    id: db.id,
    teacherId: db.teacher_id,
    title: db.title,
    description: db.description,
    subject: db.subject,
    format: db.format,
    status: db.status,
    code: db.code,
    settings: db.settings || {},
    activeFrom: db.active_from,
    activeTo: db.active_to,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    preloadedStudents: db.preloaded_students?.map((s:any) => ({ name: s.name, nis: s.nis })) || [],
    questions: (db.questions || []).map((q:any) => ({
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
    })).sort((a:any, b:any) => a.order - b.order)
  };
}

function dbToSubmission(db: any): Submission {
  const answers: StudentAnswer[] = [];
  const essayScores: any[] = [];
  
  (db.student_answers || []).forEach((a:any) => {
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
    answers,
    essayScores
  };
}
