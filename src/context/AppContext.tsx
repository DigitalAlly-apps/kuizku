// ============================================================
// Kuizku — Global App Context (Personal Use — no billing)
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Teacher, Exam, Submission, BankQuestion, QuestionCollection, AiGradingSuggestion, AiGradingSuggestionStatus, ToastMessage } from '../types';
import { storage, type MutationResult } from '../utils/storage';
import { generateId, generateExamCode } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';
import { clearSessionBySubmissionId } from '../utils/examSession';
import { supabase } from '../lib/supabase';

// Semua fitur aktif — tidak ada gate
const featureAccess = {
  isPro: true,
  planKey: 'pro_manual' as const,
  canImport: true,
  canExport: true,
  canUseTimer: true,
  canUseAntiCheat: true,
  canPublishExam: true,
  canAddBankQuestion: true,
  limits: { activeExams: 9999, monthlySubmissions: 9999, bankQuestions: 9999 },
  usage: { activeExams: 0, monthlySubmissions: 0, bankQuestions: 0 },
};

interface AppContextShape {
  // Auth
  currentTeacher: Teacher | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ error?: string }>;
  register: (data: Omit<Teacher, 'id' | 'createdAt'> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Feature access (always unlocked)
  featureAccess: typeof featureAccess;

  // Exams
  exams: Exam[];
  getExam: (id: string) => Exam | undefined;
  createExam: (data: Omit<Exam, 'id' | 'code' | 'status' | 'questions' | 'createdAt' | 'updatedAt' | 'preloadedStudents'>) => Promise<MutationResult & { exam?: Exam }>;
  updateExam: (id: string, data: Partial<Exam>) => Promise<{ error?: string }>;
  deleteExam: (id: string) => Promise<MutationResult>;
  duplicateExam: (id: string) => Promise<MutationResult & { exam?: Exam }>;
  publishExam: (id: string) => Promise<{ error?: string }>;
  archiveExam: (id: string) => Promise<{ error?: string }>;
  endExam: (id: string) => Promise<{ error?: string }>;
  refreshExams: () => Promise<void>;

  // Question Bank
  bankQuestions: BankQuestion[];
  questionCollections: QuestionCollection[];
  createQuestionCollection: (name: string) => Promise<MutationResult & { collection?: QuestionCollection }>;
  copyExamQuestionsToBank: (exam: Exam, collectionId: string) => Promise<MutationResult & { count?: number }>;
  addToBankFromQuestion: (q: import('../types').Question, subject: string) => Promise<MutationResult>;
  deleteBankQuestion: (id: string) => Promise<{ error?: string }>;
  updateBankQuestion: (id: string, data: Partial<BankQuestion>) => Promise<MutationResult>;
  refreshBank: () => Promise<void>;

  // Submissions
  submissions: Submission[];
  getExamSubmissions: (examId: string) => Submission[];
  gradeEssay: (submissionId: string, questionId: string, score: number, comment?: string) => Promise<MutationResult>;
  saveSubmissionGrading: (submissionId: string, grades: Submission['essayScores'], feedback: string) => Promise<MutationResult>;
  returnSubmission: (submissionId: string) => Promise<MutationResult>;
  deleteSubmission: (submissionId: string) => Promise<MutationResult>;
  setTeacherFeedback: (submissionId: string, feedback: string) => Promise<MutationResult>;
  requestAiEssaySuggestions: (submissionId: string) => Promise<{ suggestions?: AiGradingSuggestion[]; error?: string }>;
  updateAiGradingSuggestionStatuses: (decisions: Array<{ id: string; status: AiGradingSuggestionStatus }>) => Promise<void>;
  refreshSubmissions: () => Promise<void>;

  // Toast notifications
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextShape | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentTeacher, setCurrentTeacher] = useState<Teacher | null>(null);
  const [exams, setExamsState] = useState<Exam[]>([]);
  const [bankQuestions, setBankState] = useState<BankQuestion[]>([]);
  const [questionCollections, setQuestionCollections] = useState<QuestionCollection[]>([]);
  const [submissions, setSubmissionsState] = useState<Submission[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Bootstrap ----
  const loadTeacherData = async (teacher: Teacher) => {
    setIsLoading(true);
    try {
      const [exs, bqs, collections, subs] = await Promise.all([
        storage.getExamsByTeacher(teacher.id),
        storage.getBankQuestions(teacher.id),
        storage.getQuestionCollections(teacher.id),
        storage.getSubmissionsByTeacher(teacher.id),
      ]);
      setExamsState(exs);
      setBankState(bqs);
      setQuestionCollections(collections);
      setSubmissionsState(subs);
    } catch (e) {
      console.error('Failed to load teacher data:', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const clearTeacherState = () => {
      if (!mounted) return;
      setCurrentTeacher(null);
      setExamsState([]);
      setBankState([]);
      setQuestionCollections([]);
      setSubmissionsState([]);
      setIsLoading(false);
    };

    const hydrateTeacher = async () => {
      if (!mounted) return;
      setIsLoading(true);
      const teacher = await storage.getCurrentTeacher();
      if (!mounted) return;
      if (teacher) {
        setCurrentTeacher(teacher);
        await loadTeacherData(teacher);
      } else {
        clearTeacherState();
      }
    };

    const initAuth = async () => {
      await hydrateTeacher();
    };
    void initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        const manualLogout = sessionStorage.getItem('kuizku_manual_logout') === '1';
        sessionStorage.removeItem('kuizku_manual_logout');
        if (!manualLogout) sessionStorage.setItem('kuizku_auth_expired', '1');
        clearTeacherState();
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        void hydrateTeacher();
      }
      // TOKEN_REFRESHED intentionally keeps the already loaded teacher data.
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // ---- Refresh ----
  const refreshExams = async () => {
    if (currentTeacher) setExamsState(await storage.getExamsByTeacher(currentTeacher.id));
  };
  const refreshBank = async () => {
    if (!currentTeacher) return;
    const [questions, collections] = await Promise.all([
      storage.getBankQuestions(currentTeacher.id),
      storage.getQuestionCollections(currentTeacher.id),
    ]);
    setBankState(questions);
    setQuestionCollections(collections);
  };
  const refreshSubmissions = async () => {
    if (currentTeacher) setSubmissionsState(await storage.getSubmissionsByTeacher(currentTeacher.id));
  };

  // ---- Auth ----
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { teacher, error } = await storage.loginTeacher(email, password);
    if (teacher) {
      setCurrentTeacher(teacher);
      await loadTeacherData(teacher);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error };
  };
  const loginWithGoogle = () => storage.loginWithGoogle();

  const register = async (data: Omit<Teacher, 'id' | 'createdAt'> & { password: string }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    const { teacher, error } = await storage.registerTeacher(data);
    if (teacher) {
      setCurrentTeacher(teacher);
      setExamsState([]);
      setBankState([]);
      setSubmissionsState([]);
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error };
  };

  const logout = async () => {
    sessionStorage.setItem('kuizku_manual_logout', '1');
    await storage.logout();
    setCurrentTeacher(null);
    setExamsState([]);
    setBankState([]);
    setQuestionCollections([]);
    setSubmissionsState([]);
  };

  // ---- Exam CRUD ----
  const getExam = useCallback((id: string) => exams.find(e => e.id === id), [exams]);

  const createExam = async (data: Omit<Exam, 'id' | 'code' | 'status' | 'questions' | 'createdAt' | 'updatedAt' | 'preloadedStudents'>): Promise<MutationResult & { exam?: Exam }> => {
    let code = generateExamCode();
    while (exams.some(e => e.code === code)) code = generateExamCode();
    const now = new Date().toISOString();
    const newExam: Exam = { ...data, id: generateId(), teacherId: currentTeacher?.id ?? '', code, status: 'DRAFT', questions: [], preloadedStudents: [], createdAt: now, updatedAt: now };
    const result = await storage.saveExam(newExam);
    if (result.error) return { success: false, error: result.error };
    setExamsState(prev => [newExam, ...prev]);
    return { success: true, exam: newExam };
  };

  // updateExam: kalau data hanya berisi field meta (tidak ada questions/preloadedStudents),
  // pakai updateExamMeta — hanya UPDATE satu row, soal tidak disentuh sama sekali.
  // Kalau ada questions/preloadedStudents, pakai saveExam (RPC transactional).
  const updateExam = async (id: string, data: Partial<Exam>): Promise<{ error?: string }> => {
    const updatedAt = new Date().toISOString();
    const existing = exams.find(e => e.id === id);
    if (!existing) return { error: 'Ujian tidak ditemukan.' };
    const updated: Exam = { ...existing, ...data, updatedAt };

    const hasQuestions = data.questions !== undefined;
    const hasStudents = data.preloadedStudents !== undefined;

    let res: { error?: string } = {};
    if (hasQuestions) {
      res = await storage.saveExam(updated);
    } else if (hasStudents) {
      res = await storage.saveExamSettingsAndRoster(updated);
    } else {
      res = await storage.updateExamMeta(id, {
        title: data.title,
        description: data.description,
        subject: data.subject,
        className: data.className,
        examType: data.examType,
        activeFrom: data.activeFrom,
        activeTo: data.activeTo,
        status: data.status,
        settings: data.settings,
        updatedAt,
      });
    }

    if (res?.error) {
      return { error: res.error };
    }

    // State lokal baru diperbarui setelah database mengonfirmasi perubahan.
    setExamsState(prev => prev.map(e => e.id === id ? updated : e));
    return {};
  };

  const deleteExam = async (id: string): Promise<MutationResult> => {
    const result = await storage.deleteExam(id);
    if (!result.success) return result;
    setExamsState(prev => prev.filter(e => e.id !== id));
    return result;
  };

  const duplicateExam = async (id: string): Promise<MutationResult & { exam?: Exam }> => {
    const original = exams.find(e => e.id === id);
    if (!original) return { success: false, error: 'Ujian tidak ditemukan.' };
    let code = generateExamCode();
    while (exams.some(e => e.code === code)) code = generateExamCode();
    const now = new Date().toISOString();
    const copy: Exam = { ...original, id: generateId(), code, title: `${original.title} (Salinan)`, status: 'DRAFT', questions: original.questions.map(q => ({ ...q, id: generateId() })), createdAt: now, updatedAt: now };
    const result = await storage.saveExam(copy);
    if (result.error) return { success: false, error: result.error };
    setExamsState(prev => [copy, ...prev]);
    return { success: true, exam: copy };
  };

  const publishExam = async (id: string) => updateExam(id, { status: 'ACTIVE' });
  const archiveExam = async (id: string) => updateExam(id, { status: 'ARCHIVED' });
  const endExam = async (id: string) => updateExam(id, { status: 'ENDED' });

  // ---- Question Bank ----
  const addToBankFromQuestion = async (q: import('../types').Question, subject: string): Promise<MutationResult> => {
    const existing = bankQuestions.find(b => b.id === q.id);
    if (existing) {
      const updated = { ...existing, ...q, updatedAt: new Date().toISOString() };
      const result = await storage.saveBankQuestion(updated);
      if (result.success) await refreshBank();
      return result;
    }
    const now = new Date().toISOString();
    const bq: BankQuestion = { ...q, id: generateId(), teacherId: currentTeacher?.id ?? '', subject, usedInExamIds: [], createdAt: now, updatedAt: now };
    const result = await storage.saveBankQuestion(bq);
    if (result.success) await refreshBank();
    return result;
  };

  const createQuestionCollection = async (name: string): Promise<MutationResult & { collection?: QuestionCollection }> => {
    if (!currentTeacher) return { success: false, error: 'Sesi guru tidak ditemukan.' };
    const cleanName = name.trim();
    if (!cleanName) return { success: false, error: 'Nama kategori wajib diisi.' };
    const result = await storage.createQuestionCollection({ teacherId: currentTeacher.id, name: cleanName, subject: '', tags: [] });
    if (!result.collection) return { success: false, error: result.error || 'Kategori gagal dibuat.' };
    setQuestionCollections(prev => [...prev, result.collection!]);
    return { success: true, collection: result.collection };
  };

  const copyExamQuestionsToBank = async (exam: Exam, collectionId: string): Promise<MutationResult & { count?: number }> => {
    if (!currentTeacher) return { success: false, error: 'Sesi guru tidak ditemukan.' };
    if (!collectionId) return { success: false, error: 'Pilih kategori tujuan terlebih dahulu.' };
    if (exam.questions.length === 0) return { success: false, error: 'Ujian ini belum memiliki soal.' };

    const now = new Date().toISOString();
    for (const question of exam.questions) {
      const result = await storage.saveBankQuestion({
        ...question,
        id: generateId(),
        teacherId: currentTeacher.id,
        collectionId,
        subject: exam.subject,
        className: exam.className,
        usedInExamIds: [exam.id],
        createdAt: now,
        updatedAt: now,
      });
      if (!result.success) return { success: false, error: result.error || 'Sebagian soal belum tersalin.' };
    }
    await refreshBank();
    return { success: true, count: exam.questions.length };
  };

  const deleteBankQuestion = async (id: string): Promise<{ error?: string }> => {
    const result = await storage.deleteBankQuestion(id);
    if (result.error) return result;
    setBankState(prev => prev.filter(b => b.id !== id));
    return {};
  };

  const updateBankQuestion = async (id: string, data: Partial<BankQuestion>): Promise<MutationResult> => {
    const existing = bankQuestions.find(b => b.id === id);
    if (!existing) return { success: false, error: 'Soal tidak ditemukan.' };
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    const result = await storage.saveBankQuestion(updated);
    if (result.success) setBankState(prev => prev.map(b => b.id === id ? updated : b));
    return result;
  };

  // ---- Submissions ----
  const getExamSubmissions = useCallback((examId: string) =>
    submissions.filter(s => s.examId === examId), [submissions]);

  const gradeEssay = async (submissionId: string, questionId: string, score: number, comment?: string): Promise<MutationResult> => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return { success: false, error: 'Jawaban tidak ditemukan.' };
    const existingGrade = sub.essayScores.find(g => g.questionId === questionId);
    const newEssayScores = existingGrade
      ? sub.essayScores.map(g => g.questionId === questionId ? { ...g, score, comment } : g)
      : [...sub.essayScores, { questionId, score, comment }];
    return saveSubmissionGrading(submissionId, newEssayScores, sub.teacherFeedback ?? '');
  };

  const saveSubmissionGrading = async (submissionId: string, grades: Submission['essayScores'], feedback: string): Promise<MutationResult> => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return { success: false, error: 'Jawaban tidak ditemukan.' };
    const result = await storage.saveSubmissionGrading(submissionId, grades, feedback);
    if (!result.success) return result;
    const updated = {
      ...sub,
      essayScores: grades,
      teacherFeedback: feedback || undefined,
      totalScore: result.isFinal ? result.totalScore : undefined,
    };
    setSubmissionsState(prev => prev.map(s => s.id === submissionId ? updated : s));
    return result;
  };

  const returnSubmission = async (submissionId: string): Promise<MutationResult> => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return { success: false, error: 'Jawaban tidak ditemukan.' };
    const result = await storage.returnSubmission(submissionId);
    if (!result.success) return result;
    const updated = { ...sub, isReturned: true };
    setSubmissionsState(prev => prev.map(s => s.id === submissionId ? updated : s));
    return result;
  };

  const deleteSubmission = async (submissionId: string): Promise<MutationResult> => {
    const result = await storage.deleteTeacherSubmission(submissionId);
    if (!result.success) return result;
    clearSessionBySubmissionId(submissionId);
    setSubmissionsState(prev => prev.filter(submission => submission.id !== submissionId));
    return result;
  };

  const setTeacherFeedback = async (submissionId: string, feedback: string): Promise<MutationResult> => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return { success: false, error: 'Jawaban tidak ditemukan.' };
    return saveSubmissionGrading(submissionId, sub.essayScores, feedback);
  };

  const requestAiEssaySuggestions = (submissionId: string) => storage.requestAiEssaySuggestions(submissionId);
  const updateAiGradingSuggestionStatuses = (decisions: Array<{ id: string; status: AiGradingSuggestionStatus }>) => storage.updateAiGradingSuggestionStatuses(decisions);

  // ---- Toasts ----
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const syncPending = async () => {
      const synced = await storage.syncPendingSubmissions();
      if (synced.count > 0) {
        synced.submissionIds.forEach(clearSessionBySubmissionId);
        addToast({ type: 'success', title: 'Sinkronisasi offline berhasil', message: `${synced.count} submission tertunda berhasil dikirim.` });
        if (currentTeacher) await refreshSubmissions();
      }
    };
    void syncPending();
    const handleOnline = () => { void syncPending(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [currentTeacher, addToast]);

  const value: AppContextShape = {
    currentTeacher, isLoading,
    login, loginWithGoogle, register, logout,
    featureAccess,
    exams, getExam, createExam, updateExam, deleteExam, duplicateExam,
    publishExam, archiveExam, endExam, refreshExams,
    bankQuestions, questionCollections, createQuestionCollection, copyExamQuestionsToBank, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank,
    submissions, getExamSubmissions, gradeEssay, saveSubmissionGrading, returnSubmission, deleteSubmission, setTeacherFeedback, requestAiEssaySuggestions, updateAiGradingSuggestionStatuses, refreshSubmissions,
    toasts, addToast, removeToast,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextShape {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export const useAuth = () => {
  const { currentTeacher, isLoading, login, loginWithGoogle, register, logout } = useApp();
  return { currentTeacher, isLoading, login, loginWithGoogle, register, logout };
};

export const useExams = () => {
  const { exams, getExam, createExam, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, refreshExams } = useApp();
  return { exams, getExam, createExam, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, refreshExams };
};

export const useBank = () => {
  const { bankQuestions, questionCollections, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank } = useApp();
  return { bankQuestions, questionCollections, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank };
};

export const useToast = () => {
  const { toasts, addToast, removeToast } = useApp();
  return { toasts, addToast, removeToast };
};
