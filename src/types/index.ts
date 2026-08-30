// ============================================================
// Kuizku — Core Type Definitions
// ============================================================

export type ExamFormat = 'PG_ONLY' | 'ESSAY_ONLY' | 'COMBINATION';
export type QuestionType = 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY';
export type TimerMode = 'PER_QUESTION' | 'WHOLE_EXAM' | 'NONE';
export type ExamStatus = 'DRAFT' | 'ACTIVE' | 'ENDED' | 'ARCHIVED';
export type ExamType = 'UJIAN' | 'TUGAS' | 'LATIHAN';
export type PlanKey = 'free' | 'pro_manual' | 'pro_monthly';
export type SubscriptionStatus = 'free' | 'active' | 'expired' | 'past_due';

// ---- Auth ----
export interface Teacher {
  id: string;
  name: string;
  email: string;
  subject: string;
  institution: string;
  createdAt: string;
}

// ---- Billing / SaaS ----
export interface Workspace {
  id: string;
  name: string;
  type: 'individual' | 'bimbel';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  planKey: PlanKey;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  promoPaymentsUsed?: number;
  manualPaymentNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCounter {
  id: string;
  workspaceId: string;
  periodMonth: string;
  submissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSnapshot {
  workspace: Workspace | null;
  subscription: Subscription;
}

export interface FeatureAccess {
  planKey: PlanKey;
  isPro: boolean;
  limits: {
    activeExams: number;
    monthlySubmissions: number;
    bankQuestions: number;
  };
  usage: {
    activeExams: number;
    monthlySubmissions: number;
    bankQuestions: number;
  };
  canImport: boolean;
  canExport: boolean;
  canUseTimer: boolean;
  canUseAntiCheat: boolean;
  canPublishExam: boolean;
  canAddBankQuestion: boolean;
}

export interface PersonalExamSubject { id: string; teacherId: string; name: string; }
export interface PersonalExamGroup { id: string; teacherId: string; name: string; }
export interface PersonalExamStudent { id: string; teacherId: string; groupId: string; name: string; }

// ---- Question Option (for Multiple Choice) ----
export interface QuestionOption {
  id: string;
  text: string;
}

// ---- Question ----
export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  imageUrl?: string;       // base64 data URL or external URL
  // Multiple Choice fields
  options?: QuestionOption[];
  correctOptionId?: string;
  acceptedAnswers?: string[]; // normalized alternatives for short answer
  // Essay fields
  answerGuide?: string;
  // Shared
  weight: number;        // point value
  timerSeconds?: number; // per-question timer (if mode = PER_QUESTION)
  tags: string[];
  order: number;
}

// ---- Exam Settings ----
export interface ExamSettings {
  timerMode: TimerMode;
  wholExamTimerSeconds?: number; // if timerMode = WHOLE_EXAM
  perQuestionDefaultSeconds?: number; // fallback if timerMode = PER_QUESTION
  maxAttempts: number;            // 1 | 2 | 3 | 0 = unlimited
  showScoreAfterSubmit: boolean;
  showAnswerKeyAfterSubmit: boolean;
  releaseResultsAfterGrading?: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;        // for MC only
  antiCheatSensitivity?: 'OFF' | 'LOW' | 'MEDIUM' | 'HIGH';
  /** Nilai skala 0-100 agar peserta dinyatakan tuntas. */
  passingScore?: number;
  /** FREE mempertahankan perilaku ujian lama. */
  navigationMode?: 'FREE' | 'SEQUENTIAL';
  /** Kebijakan baru; resolver tetap membaca field lama untuk ujian terdahulu. */
  scoreReleaseMode?: 'IMMEDIATE' | 'AFTER_EXAM_END' | 'AFTER_GRADING' | 'NEVER';
  answerKeyReleaseMode?: 'IMMEDIATE' | 'AFTER_EXAM_END' | 'NEVER';
  explanationReleaseMode?: 'IMMEDIATE' | 'AFTER_EXAM_END' | 'NEVER';
  showRankingAfterSubmit?: boolean;
  autoSubmitOnTimeUp?: boolean;
  /** Available only to the private personal-exam module. */
  participantMode?: 'MANUAL' | 'PERSONAL_ROSTER';
}

// ---- Pre-loaded Student List ----
export interface PreloadedStudent {
  name: string;
  nis: string;
}

// ---- Exam ----
export interface Exam {
  id: string;
  teacherId: string;
  title: string;
  description: string;
  subject: string;
  className?: string;     // Added for grouping by class
  examType: ExamType;    // UJIAN | TUGAS | LATIHAN
  format: ExamFormat;
  status: ExamStatus;
  code: string;           // 6-char uppercase alphanumeric
  settings: ExamSettings;
  questions: Question[];
  preloadedStudents: PreloadedStudent[];
  activeFrom?: string;    // ISO date
  activeTo?: string;      // ISO date
  createdAt: string;
  updatedAt: string;
}

// ---- Bank Question (extends Question with cross-exam meta) ----
export interface BankQuestion extends Question {
  teacherId: string;
  collectionId?: string;
  subject: string;
  className?: string; // Added for grouping by class
  usedInExamIds: string[]; // track reuse
  createdAt: string;
  updatedAt: string;
}

export interface QuestionCollection {
  id: string;
  teacherId: string;
  name: string;
  description?: string;
  subject: string;
  className?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// ---- Student Answer ----
export interface StudentAnswer {
  questionId: string;
  questionType: QuestionType;
  selectedOptionId?: string;  // for MC
  essayText?: string;         // for Essay
  shortAnswer?: string;       // for Short Answer
  timeTakenSeconds?: number;  // time spent on this question
}

// ---- Essay Grade (teacher grading) ----
export interface EssayGrade {
  questionId: string;
  score: number;         // 0 – question.weight
  comment?: string;
}

export type AiGradingSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface AiGradingSuggestion {
  id: string;
  questionId: string;
  suggestedScore: number;
  reason: string;
  feedback: string;
  model: string;
  status: AiGradingSuggestionStatus;
  createdAt: string;
}

export interface AntiCheatEvent {
  type: 'TAB_HIDDEN';
  timestamp: string;
  count: number;
}

// ---- Submission ----
export interface Submission {
  id: string;
  examId: string;
  studentName: string;
  nis: string;
  attemptNumber: number;
  answers: StudentAnswer[];
  mcScore: number;         // auto-calculated
  essayScores: EssayGrade[];
  totalScore?: number;     // set after all essays graded
  teacherFeedback?: string; // komentar/feedback dari guru
  antiCheatEvents?: AntiCheatEvent[];
  startedAt: string;
  submittedAt?: string;
  isComplete: boolean;
  isReturned?: boolean;    // dikembalikan guru untuk revisi
}

export interface RankingEntry {
  rank: number;
  studentName: string;
  isCurrent?: boolean;
}

export interface StudentRanking {
  available: boolean;
  entries: RankingEntry[];
  currentRank?: number;
  totalParticipants?: number;
  reason?: string;
}

// ---- Import Result ----
export interface ImportRow {
  rowIndex: number;
  question: Partial<Question>;
  errors: string[];
  warnings?: string[];
  sourceRow?: Record<string, string>;
  isValid: boolean;
}

export interface ImportResult {
  valid: ImportRow[];
  invalid: ImportRow[];
  totalRows: number;
}

// ---- UI State Types ----
export interface CreateExamWizardState {
  step: 1 | 2 | 3 | 4 | 5;
  exam: Partial<Exam>;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
}

export interface FilterState {
  type?: QuestionType;
  subject?: string;
  tag?: string;
  search?: string;
}
