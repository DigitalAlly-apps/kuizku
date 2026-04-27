// ============================================================
// KuizKu — Global App Context (Supabase Integration)
// ============================================================

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Teacher, Exam, Submission, BankQuestion, ToastMessage } from '../types';
import { storage } from '../utils/storage';
import { generateId, generateExamCode } from '../utils/helpers';
import { v4 as uuidv4 } from 'uuid';

interface AppContextShape {
  // Auth
  currentTeacher: Teacher | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: Omit<Teacher, 'id' | 'createdAt' | 'password'> & { password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Exams
  exams: Exam[];
  getExam: (id: string) => Exam | undefined;
  createExam: (data: Omit<Exam, 'id' | 'code' | 'status' | 'questions' | 'createdAt' | 'updatedAt' | 'preloadedStudents'>) => Promise<Exam>;
  updateExam: (id: string, data: Partial<Exam>) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  duplicateExam: (id: string) => Promise<Exam>;
  publishExam: (id: string) => Promise<void>;
  archiveExam: (id: string) => Promise<void>;
  endExam: (id: string) => Promise<void>;
  refreshExams: () => Promise<void>;

  // Question Bank
  bankQuestions: BankQuestion[];
  addToBankFromQuestion: (q: import('../types').Question, subject: string) => Promise<void>;
  deleteBankQuestion: (id: string) => Promise<void>;
  updateBankQuestion: (id: string, data: Partial<BankQuestion>) => Promise<void>;
  refreshBank: () => Promise<void>;

  // Submissions
  submissions: Submission[];
  getExamSubmissions: (examId: string) => Submission[];
  gradeEssay: (submissionId: string, questionId: string, score: number, comment?: string) => Promise<void>;
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
  const [submissions, setSubmissionsState] = useState<Submission[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Bootstrap / Load Data ----
  const loadTeacherData = async (teacher: Teacher) => {
    setIsLoading(true);
    try {
      const [exs, bqs, subs] = await Promise.all([
        storage.getExamsByTeacher(teacher.id),
        storage.getBankQuestions(teacher.id),
        storage.getSubmissionsByTeacher(teacher.id)
      ]);
      setExamsState(exs);
      setBankState(bqs);
      setSubmissionsState(subs);
    } catch (e) {
      console.error('Failed to load teacher data:', e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const initAuth = async () => {
      const teacher = await storage.getCurrentTeacher();
      if (teacher) {
        setCurrentTeacher(teacher);
        await loadTeacherData(teacher);
      } else {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // ---- Refresh Functions ----
  const refreshExams = async () => {
    if (currentTeacher) setExamsState(await storage.getExamsByTeacher(currentTeacher.id));
  };
  const refreshBank = async () => {
    if (currentTeacher) setBankState(await storage.getBankQuestions(currentTeacher.id));
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

  const register = async (data: Omit<Teacher, 'id' | 'createdAt' | 'password'> & { password: string }): Promise<{ success: boolean; error?: string }> => {
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
    await storage.logout();
    setCurrentTeacher(null);
    setExamsState([]);
    setBankState([]);
    setSubmissionsState([]);
  };

  // ---- Exam CRUD ----
  const getExam = useCallback((id: string) => exams.find(e => e.id === id), [exams]);

  const createExam = async (data: Omit<Exam, 'id' | 'code' | 'status' | 'questions' | 'createdAt' | 'updatedAt' | 'preloadedStudents'>): Promise<Exam> => {
    let code = generateExamCode();
    while (exams.some(e => e.code === code)) code = generateExamCode();
    
    const now = new Date().toISOString();
    const newExam: Exam = {
      ...data,
      id: generateId(),
      teacherId: currentTeacher?.id ?? '',
      code,
      status: 'DRAFT',
      questions: [],
      preloadedStudents: [],
      createdAt: now,
      updatedAt: now,
    };
    
    // Optimistic UI
    setExamsState(prev => [newExam, ...prev]);
    await storage.saveExam(newExam);
    return newExam;
  };

  const updateExam = async (id: string, data: Partial<Exam>) => {
    const existing = exams.find(e => e.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    
    // Optimistic UI
    setExamsState(prev => prev.map(e => e.id === id ? updated : e));
    await storage.saveExam(updated);
  };

  const deleteExam = async (id: string) => {
    setExamsState(prev => prev.filter(e => e.id !== id));
    await storage.deleteExam(id);
  };

  const duplicateExam = async (id: string): Promise<Exam> => {
    const original = exams.find(e => e.id === id);
    if (!original) throw new Error('Exam not found');
    
    let code = generateExamCode();
    while (exams.some(e => e.code === code)) code = generateExamCode();
    
    const now = new Date().toISOString();
    const copy: Exam = {
      ...original,
      id: generateId(),
      code,
      title: `${original.title} (Salinan)`,
      status: 'DRAFT',
      questions: original.questions.map(q => ({ ...q, id: generateId() })),
      createdAt: now,
      updatedAt: now,
    };
    
    setExamsState(prev => [copy, ...prev]);
    await storage.saveExam(copy);
    return copy;
  };

  const publishExam = async (id: string) => updateExam(id, { status: 'ACTIVE' });
  const archiveExam = async (id: string) => updateExam(id, { status: 'ARCHIVED' });
  const endExam = async (id: string) => updateExam(id, { status: 'ENDED' });

  // ---- Question Bank ----
  const addToBankFromQuestion = async (q: import('../types').Question, subject: string) => {
    const existing = bankQuestions.find(b => b.id === q.id);
    if (existing) {
      const updated = { ...existing, ...q, updatedAt: new Date().toISOString() };
      setBankState(prev => prev.map(b => b.id === q.id ? updated : b));
      await storage.saveBankQuestion(updated);
      return;
    }
    
    const now = new Date().toISOString();
    const bq: BankQuestion = {
      ...q,
      id: generateId(),
      teacherId: currentTeacher?.id ?? '',
      subject,
      usedInExamIds: [],
      createdAt: now,
      updatedAt: now,
    };
    
    setBankState(prev => [bq, ...prev]);
    await storage.saveBankQuestion(bq);
  };

  const deleteBankQuestion = async (id: string) => {
    setBankState(prev => prev.filter(b => b.id !== id));
    await storage.deleteBankQuestion(id);
  };

  const updateBankQuestion = async (id: string, data: Partial<BankQuestion>) => {
    const existing = bankQuestions.find(b => b.id === id);
    if (!existing) return;
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    setBankState(prev => prev.map(b => b.id === id ? updated : b));
    await storage.saveBankQuestion(updated);
  };

  // ---- Submissions ----
  const getExamSubmissions = useCallback((examId: string) =>
    submissions.filter(s => s.examId === examId), [submissions]);

  const gradeEssay = async (submissionId: string, questionId: string, score: number, comment?: string) => {
    const sub = submissions.find(s => s.id === submissionId);
    if (!sub) return;

    const existingGrade = sub.essayScores.find(g => g.questionId === questionId);
    const newEssayScores = existingGrade
      ? sub.essayScores.map(g => g.questionId === questionId ? { ...g, score, comment } : g)
      : [...sub.essayScores, { questionId, score, comment }];
      
    const essayTotal = newEssayScores.reduce((sum, g) => sum + g.score, 0);
    const updated = { ...sub, essayScores: newEssayScores, totalScore: sub.mcScore + essayTotal };

    setSubmissionsState(prev => prev.map(s => s.id === submissionId ? updated : s));
    await storage.saveSubmission(updated);
  };

  // ---- Toasts ----
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = uuidv4();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const value: AppContextShape = {
    currentTeacher, isLoading,
    login, register, logout,
    exams, getExam, createExam, updateExam, deleteExam, duplicateExam,
    publishExam, archiveExam, endExam, refreshExams,
    bankQuestions, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank,
    submissions, getExamSubmissions, gradeEssay, refreshSubmissions,
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
  const { currentTeacher, isLoading, login, register, logout } = useApp();
  return { currentTeacher, isLoading, login, register, logout };
};

export const useExams = () => {
  const { exams, getExam, createExam, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, refreshExams } = useApp();
  return { exams, getExam, createExam, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, refreshExams };
};

export const useBank = () => {
  const { bankQuestions, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank } = useApp();
  return { bankQuestions, addToBankFromQuestion, deleteBankQuestion, updateBankQuestion, refreshBank };
};

export const useToast = () => {
  const { toasts, addToast, removeToast } = useApp();
  return { toasts, addToast, removeToast };
};
