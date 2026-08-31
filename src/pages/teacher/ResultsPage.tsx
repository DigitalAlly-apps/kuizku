import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Download, User, Edit2, BarChart2, RotateCcw, MessageSquare, RefreshCcw, Zap, ArrowLeft, ArrowRight, Sparkles, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, FormatBadge, StatusBadge, SectionHeader, Modal } from '../../components/ui';
import NumericInput from '../../components/ui/NumericInput';
import { calcMaxMCScore, calcMaxEssayScore, formatDateTime } from '../../utils/helpers';
import { getPassingScore } from '../../utils/examSettings';
import { storage } from '../../utils/storage';
import * as XLSX from 'xlsx';
import type { AiGradingSuggestion, Question, StudentAnswer, Submission } from '../../types';

interface QuickEssayTarget {
  submission: Submission;
  question: Question;
}

type AnalysisFilter = 'ALL' | 'WRONG' | 'CORRECT' | 'ESSAY';

interface QuestionAnalysisItem {
  question: Question;
  questionNumber: number;
  answer?: StudentAnswer;
  isCorrect: boolean | null;
}

const ANALYSIS_FILTERS: Array<{ value: AnalysisFilter; label: string }> = [
  { value: 'ALL', label: 'Semua' },
  { value: 'WRONG', label: 'Salah' },
  { value: 'CORRECT', label: 'Benar' },
  { value: 'ESSAY', label: 'Essay' },
];

const normalizeAnswer = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

function getQuestionCorrectness(question: Question, answer?: StudentAnswer): boolean | null {
  if (question.type === 'ESSAY') return null;
  if (question.type === 'MULTIPLE_CHOICE') return answer?.selectedOptionId === question.correctOptionId;
  return !!answer?.shortAnswer
    && (question.acceptedAnswers ?? []).some(value => normalizeAnswer(value) === normalizeAnswer(answer.shortAnswer!));
}

function getEmptyAnalysisMessage(filter: AnalysisFilter): string {
  if (filter === 'WRONG') return 'Tidak ada jawaban salah.';
  if (filter === 'CORRECT') return 'Tidak ada jawaban benar.';
  if (filter === 'ESSAY') return 'Tidak ada soal essay.';
  return 'Belum ada soal untuk dianalisis.';
}

function clipboardCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, ' ').trim();
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Browser tertentu hanya mengekspos Clipboard API pada konteks yang diizinkan.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!copied) throw new Error('Browser tidak dapat menyalin data.');
}



export default function ResultsPage() {
  const { currentTeacher, exams, submissions, saveSubmissionGrading, returnSubmission, deleteSubmission, requestAiEssaySuggestions, updateAiGradingSuggestionStatuses, refreshSubmissions } = useApp();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();

  // Fix #6: Auto-refresh submissions setiap 30 detik
  useEffect(() => {
    const id = setInterval(() => { void refreshSubmissions(); }, 30000);
    return () => clearInterval(id);
  }, [refreshSubmissions]);

  const myExams = useMemo(() => exams.filter(e => e.teacherId === currentTeacher?.id && e.status !== 'DRAFT'), [exams, currentTeacher]);
  const [selectedExamId, setSelectedExamId] = useState<string>(searchParams.get('exam') ?? (myExams[0]?.id ?? ''));
  const [detailSub, setDetailSub] = useState<Submission | null>(null);
  const [gradingMode, setGradingMode] = useState(false);
  const [gradingScores, setGradingScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [feedbackText, setFeedbackText] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, AiGradingSuggestion>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [quickIndex, setQuickIndex] = useState(0);
  const [quickScore, setQuickScore] = useState<number | null>(null);
  const [quickComment, setQuickComment] = useState('');
  const [analysisFilter, setAnalysisFilter] = useState<AnalysisFilter>('ALL');
  const [deletingSubmissionId, setDeletingSubmissionId] = useState<string | null>(null);
  const [attemptTarget, setAttemptTarget] = useState<Submission | null>(null);
  const [grantingAttempt, setGrantingAttempt] = useState(false);
  const quickRequested = searchParams.get('quick') === '1';

  const handleDeleteSubmission = async (submission: Submission) => {
    const confirmed = window.confirm(`Hapus submission ${submission.studentName} (percobaan ke-${submission.attemptNumber})? Jawaban dan nilai submission ini akan dihapus permanen.`);
    if (!confirmed) return;
    setDeletingSubmissionId(submission.id);
    const result = await deleteSubmission(submission.id);
    setDeletingSubmissionId(null);
    if (!result.success) {
      addToast({ type: 'error', title: 'Submission gagal dihapus', message: result.error });
      return;
    }
    if (detailSub?.id === submission.id) setDetailSub(null);
    addToast({ type: 'success', title: 'Submission dihapus', message: `Jawaban ${submission.studentName} telah dihapus.` });
  };

  const grantExtraAttempt = async () => {
    if (!selectedExam || !attemptTarget) return;
    const identifier = attemptTarget.nis.trim() || attemptTarget.studentName.trim();
    setGrantingAttempt(true);
    const result = await storage.grantStudentExtraAttempt(selectedExam.id, identifier);
    setGrantingAttempt(false);
    if (result.error) {
      addToast({ type: 'error', title: 'Kesempatan belum ditambahkan', message: result.error });
      return;
    }
    setAttemptTarget(null);
    addToast({ type: 'success', title: 'Kesempatan ditambahkan', message: `1 kesempatan tambahan diberikan kepada ${attemptTarget.studentName}.` });
  };

  const selectedExam = useMemo(() => myExams.find(e => e.id === selectedExamId), [myExams, selectedExamId]);
  const examSubs = useMemo(() => submissions.filter(s => s.examId === selectedExamId && s.isComplete), [submissions, selectedExamId]);
  const essayQuestionIds = useMemo(() => selectedExam?.questions.filter(q => q.type === 'ESSAY').map(q => q.id) ?? [], [selectedExam]);
  const allEssayGuidesAvailable = useMemo(() => !!selectedExam && selectedExam.questions.filter(q => q.type === 'ESSAY').every(q => !!q.answerGuide?.trim()), [selectedExam]);
  const essayStatus = (sub: Submission): 'NONE' | 'PENDING' | 'PARTIAL' | 'FINAL' => {
    if (essayQuestionIds.length === 0) return 'NONE';
    const gradedIds = new Set(sub.essayScores.map(grade => grade.questionId));
    const gradedCount = essayQuestionIds.filter(id => gradedIds.has(id)).length;
    if (gradedCount === 0) return 'PENDING';
    return gradedCount === essayQuestionIds.length ? 'FINAL' : 'PARTIAL';
  };
  const finalScoreSubs = useMemo(() => examSubs.filter(sub => !sub.isReturned && sub.totalScore != null && (essayStatus(sub) === 'NONE' || essayStatus(sub) === 'FINAL')), [examSubs, essayQuestionIds]);

  const maxMC = selectedExam ? calcMaxMCScore(selectedExam) : 0;
  const maxEssay = selectedExam ? calcMaxEssayScore(selectedExam) : 0;
  const maxTotal = maxMC + maxEssay;
  const passingScore = selectedExam ? getPassingScore(selectedExam.settings) : 70;

  // Nilai skala 0-100
  const toPercent = (points: number) => (maxTotal > 0 ? Math.round((points / maxTotal) * 100) : 0);
  const isFinalSubmission = (sub: Submission) => {
    const status = essayStatus(sub);
    return !sub.isReturned && sub.totalScore != null && (status === 'NONE' || status === 'FINAL');
  };
  // Identitas peserta stabil disimpan internal; UI hanya menampilkan nomor absen.
  const participantKey = (sub: Submission) => (sub.nis?.trim() ? `nis:${sub.nis.trim().toLowerCase()}` : `name:${sub.studentName.trim().toLowerCase()}`);
  const attendanceNoFor = (sub: Submission) => {
    const rosterStudent = selectedExam?.preloadedStudents.find(student => student.nis === sub.nis);
    if (rosterStudent?.attendanceNo != null) return rosterStudent.attendanceNo;
    return /^\d+$/.test(sub.nis.trim()) ? Number(sub.nis) : undefined;
  };

  const uniqueParticipantCount = useMemo(() => new Set(examSubs.map(participantKey)).size, [examSubs]);

  // Attempt FINAL terbaik per peserta — dipakai untuk statistik & ranking
  const bestFinalPerParticipant = useMemo(() => {
    const map = new Map<string, Submission>();
    finalScoreSubs.forEach(sub => {
      const key = participantKey(sub);
      const current = map.get(key);
      if (!current || (sub.totalScore ?? 0) > (current.totalScore ?? 0)) map.set(key, sub);
    });
    return [...map.values()];
  }, [finalScoreSubs]);

  const gradedPercents = useMemo(
    () => bestFinalPerParticipant.map(sub => toPercent(sub.totalScore ?? 0)).sort((a, b) => a - b),
    [bestFinalPerParticipant, maxTotal],
  );

  const avgTotal = useMemo(() => {
    if (!gradedPercents.length) return 0;
    return Math.round(gradedPercents.reduce((a, b) => a + b, 0) / gradedPercents.length);
  }, [gradedPercents]);

  const scoreStats = useMemo(() => {
    const values = gradedPercents;
    if (!values.length) return { median: 0, highest: 0, mastery: 0, masteryCount: 0, distribution: [0, 0, 0, 0], count: 0 };
    const mid = Math.floor(values.length / 2);
    const median = values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2);
    const highest = values[values.length - 1];
    const masteryCount = values.filter(v => v >= passingScore).length;
    const mastery = Math.round((masteryCount / values.length) * 100);
    const distribution = [
      values.filter(v => v < 40).length,
      values.filter(v => v >= 40 && v < 70).length,
      values.filter(v => v >= 70 && v < 85).length,
      values.filter(v => v >= 85).length,
    ];
    return { median, highest, mastery, masteryCount, distribution, count: values.length };
  }, [gradedPercents, passingScore]);

  const ranking = useMemo(() => [...bestFinalPerParticipant]
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .slice(0, 5), [bestFinalPerParticipant]);

  const quickTargets = useMemo<QuickEssayTarget[]>(() => {
    if (!selectedExam) return [];
    return examSubs.filter(sub => !sub.isReturned).flatMap(sub => selectedExam.questions
      .filter(question => question.type === 'ESSAY')
      .map(question => ({ submission: sub, question })));
  }, [examSubs, selectedExam]);
  const quickTarget = quickTargets[quickIndex];
  const quickGradedCount = useMemo(() => quickTargets.filter(target => target.submission.essayScores.some(grade => grade.questionId === target.question.id)).length, [quickTargets]);

  const detailAnalysis = useMemo(() => {
    if (!detailSub || !selectedExam) return null;
    const items: QuestionAnalysisItem[] = selectedExam.questions.map((question, index) => {
      const answer = detailSub.answers.find(item => item.questionId === question.id);
      return {
        question,
        questionNumber: index + 1,
        answer,
        isCorrect: getQuestionCorrectness(question, answer),
      };
    });
    const essayScore = detailSub.essayScores.reduce((total, grade) => total + grade.score, 0);
    const essayQuestionIds = new Set(
      items
        .filter(item => item.question.type === 'ESSAY')
        .map(item => item.question.id),
    );
    const essayGradedCount = new Set(
      detailSub.essayScores
        .map(grade => grade.questionId)
        .filter(questionId => essayQuestionIds.has(questionId)),
    ).size;
    return {
      items,
      correctCount: items.filter(item => item.isCorrect === true).length,
      wrongCount: items.filter(item => item.isCorrect === false).length,
      essayCount: essayQuestionIds.size,
      essayGradedCount,
      essayPendingCount: essayQuestionIds.size - essayGradedCount,
      essayScore,
      provisionalScore: detailSub.mcScore + essayScore,
    };
  }, [detailSub, selectedExam]);

  const visibleDetailQuestions = useMemo(() => {
    if (!detailAnalysis) return [];
    if (gradingMode) return detailAnalysis.items.filter(item => item.question.type === 'ESSAY');
    if (analysisFilter === 'WRONG') return detailAnalysis.items.filter(item => item.isCorrect === false);
    if (analysisFilter === 'CORRECT') return detailAnalysis.items.filter(item => item.isCorrect === true);
    if (analysisFilter === 'ESSAY') return detailAnalysis.items.filter(item => item.question.type === 'ESSAY');
    return detailAnalysis.items;
  }, [analysisFilter, detailAnalysis, gradingMode]);


  const startGrading = (sub: Submission) => {
    setQuickMode(false);
    setDetailSub(sub);
    setAnalysisFilter('ALL');
    const init: Record<string, { score: number; comment: string }> = {};
    sub.essayScores.forEach(g => { init[g.questionId] = { score: g.score, comment: g.comment ?? '' }; });
    setGradingScores(init);
    setFeedbackText(sub.teacherFeedback ?? '');
    setAiSuggestions({});
    setGradingMode(true);
  };

  const requestAiSuggestions = async () => {
    if (!detailSub || !allEssayGuidesAvailable || aiLoading) return;
    setAiLoading(true);
    const result = await requestAiEssaySuggestions(detailSub.id);
    setAiLoading(false);
    if (!result.suggestions) {
      addToast({ type: 'error', title: 'Saran AI belum tersedia', message: result.error });
      return;
    }
    const nextSuggestions = Object.fromEntries(result.suggestions.map(suggestion => [suggestion.questionId, suggestion]));
    setAiSuggestions(nextSuggestions);
    setGradingScores(previous => {
      const next = { ...previous };
      result.suggestions!.forEach(suggestion => { next[suggestion.questionId] = { score: suggestion.suggestedScore, comment: suggestion.feedback }; });
      return next;
    });
    addToast({ type: 'success', title: 'Saran AI siap ditinjau', message: 'Nilai belum disimpan. Periksa setiap saran sebelum menyimpan.' });
  };

  const discardAiSuggestions = async () => {
    const suggestions = Object.values(aiSuggestions);
    if (suggestions.length) await updateAiGradingSuggestionStatuses(suggestions.map(suggestion => ({ id: suggestion.id, status: 'rejected' })));
    setAiSuggestions({});
  };

  const startQuickGrading = () => {
    if (!quickTargets.length) return;
    const firstPending = quickTargets.findIndex(target => !target.submission.essayScores.some(grade => grade.questionId === target.question.id));
    setQuickIndex(firstPending >= 0 ? firstPending : 0);
    setQuickMode(true);
  };

  useEffect(() => {
    if (quickRequested && selectedExam && quickTargets.length > 0 && !quickMode) startQuickGrading();
  }, [quickRequested, selectedExam, quickTargets.length]);

  const closeQuickGrading = () => {
    setQuickMode(false);
    setQuickScore(null);
    setQuickComment('');
  };

  const saveQuickGrade = async (score: number) => {
    if (!quickTarget) return;
    const boundedScore = Math.max(0, Math.min(score, quickTarget.question.weight));
    const grades = [
      ...quickTarget.submission.essayScores.filter(grade => grade.questionId !== quickTarget.question.id),
      { questionId: quickTarget.question.id, score: boundedScore, comment: quickComment.trim() },
    ];
    setQuickScore(boundedScore);
    const result = await saveSubmissionGrading(quickTarget.submission.id, grades, quickTarget.submission.teacherFeedback ?? '');
    if (!result.success) {
      addToast({ type: 'error', title: 'Nilai belum tersimpan', message: result.error });
      return;
    }
    addToast({ type: 'success', title: 'Nilai tersimpan', message: 'Berpindah ke jawaban berikutnya.' });
    const nextIndex = quickIndex + 1;
    if (nextIndex < quickTargets.length) {
      setQuickIndex(nextIndex);
    } else {
      addToast({ type: 'success', title: 'Koreksi essay selesai' });
      closeQuickGrading();
    }
  };

  useEffect(() => {
    if (!quickMode || !quickTarget) return;
    const grade = quickTarget.submission.essayScores.find(item => item.questionId === quickTarget.question.id);
    setQuickScore(grade?.score ?? null);
    setQuickComment(grade?.comment ?? '');
  }, [quickMode, quickTarget?.submission.id, quickTarget?.question.id, quickTarget?.submission.essayScores]);

  useEffect(() => {
    if (!quickMode || !quickTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      if (/^[0-9]$/.test(event.key)) {
        const score = Number(event.key);
        if (score <= quickTarget.question.weight) {
          event.preventDefault();
          void saveQuickGrade(score);
        }
      } else if (event.key === 'Enter' && quickScore != null) {
        event.preventDefault();
        void saveQuickGrade(quickScore);
      } else if (event.key === 'ArrowRight' && quickIndex < quickTargets.length - 1) {
        event.preventDefault();
        setQuickIndex(index => index + 1);
      } else if (event.key === 'ArrowLeft' && quickIndex > 0) {
        event.preventDefault();
        setQuickIndex(index => index - 1);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [quickMode, quickTarget, quickScore, quickIndex, quickTargets.length]);

  const saveGrading = async () => {
    if (!detailSub) return;
    const result = await saveSubmissionGrading(
      detailSub.id,
      Object.entries(gradingScores).map(([questionId, grade]) => ({ questionId, score: grade.score, comment: grade.comment })),
      feedbackText.trim(),
    );
    if (!result.success) {
      addToast({ type: 'error', title: 'Nilai belum tersimpan', message: result.error });
      return;
    }
    const decisions = Object.values(aiSuggestions).map(suggestion => {
      const finalGrade = gradingScores[suggestion.questionId];
      const accepted = finalGrade?.score === suggestion.suggestedScore && finalGrade?.comment.trim() === suggestion.feedback.trim();
      return { id: suggestion.id, status: accepted ? 'accepted' as const : 'edited' as const };
    });
    if (decisions.length) await updateAiGradingSuggestionStatuses(decisions);
    addToast({ type: 'success', title: 'Nilai & feedback disimpan!' });
    setAiSuggestions({});
    setGradingMode(false);
    setDetailSub(null);
    setAnalysisFilter('ALL');
  };

  const handleReturn = async (sub: Submission) => {
    const result = await returnSubmission(sub.id);
    if (!result.success) {
      addToast({ type: 'error', title: 'Gagal mengembalikan jawaban', message: result.error });
      return;
    }
    addToast({ type: 'info', title: 'Dikembalikan untuk revisi', message: `Jawaban ${sub.studentName} dibuka kembali.` });
    setDetailSub(null);
    setGradingMode(false);
    setAnalysisFilter('ALL');
  };

  const exportExcel = () => {
    if (!selectedExam) return;
    const rows = examSubs.map((s, i) => {
      const essayTotal = s.essayScores.reduce((a, g) => a + g.score, 0);
      const gradingStatus = essayStatus(s);
      const isFinal = !s.isReturned && s.totalScore != null && (gradingStatus === 'NONE' || gradingStatus === 'FINAL');
      const details = selectedExam.questions.flatMap((q, qIdx) => {
        const answer = s.answers.find(a => a.questionId === q.id);
        const grade = s.essayScores.find(g => g.questionId === q.id);
        const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
        const shortCorrect = q.type === 'SHORT_ANSWER' && !!answer?.shortAnswer && (q.acceptedAnswers ?? []).some(value => normalize(value) === normalize(answer.shortAnswer!));
        const answerText = q.type === 'MULTIPLE_CHOICE'
          ? q.options?.find(o => o.id === answer?.selectedOptionId)?.text ?? ''
          : q.type === 'SHORT_ANSWER' ? answer?.shortAnswer ?? '' : answer?.essayText ?? '';
        const score = q.type === 'MULTIPLE_CHOICE'
          ? (answer?.selectedOptionId === q.correctOptionId ? q.weight : 0)
          : q.type === 'SHORT_ANSWER' ? (shortCorrect ? q.weight : 0)
          : grade?.score ?? '';
        const comment = q.type === 'ESSAY' ? grade?.comment ?? '' : '';
        return [`${qIdx + 1}. ${answerText}`, score, comment];
      });
      return [i + 1, s.studentName, attendanceNoFor(s) ?? '', s.attemptNumber, s.submittedAt ? formatDateTime(s.submittedAt) : '-', s.mcScore, essayTotal || '', isFinal ? s.totalScore : '', isFinal && s.totalScore != null ? toPercent(s.totalScore) : '', isFinal ? 'FINAL' : gradingStatus === 'PARTIAL' ? 'DINILAI SEBAGIAN' : 'MENUNGGU PENILAIAN', maxMC, maxEssay, maxTotal, s.antiCheatEvents?.length ?? 0, ...details];
    });
    const detailHeaders = selectedExam.questions.flatMap((_, i) => [`S${i + 1} Jawaban`, `S${i + 1} Skor`, `S${i + 1} Komentar`]);
    const ws = XLSX.utils.aoa_to_sheet([
      ['No','Nama','No. Absen','Percobaan','Waktu Submit','Skor PG','Skor Essay','Total','Nilai (0-100)','Status Nilai','Maks PG','Maks Essay','Maks Total','Pelanggaran Anti-cheat', ...detailHeaders],
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `rekap_${selectedExam.title.replace(/\s+/g, '_')}.xlsx`);
    addToast({ type: 'success', title: 'Rekap diexport ke Excel!' });
  };

  const copyGradesToSpreadsheet = async () => {
    if (!selectedExam) return;

    const normalizeName = (value: string) => value.trim().toLocaleLowerCase('id-ID');
    const rosterKey = (student: { name: string; nis: string }) => student.nis.trim()
      ? `nis:${student.nis.trim().toLowerCase()}`
      : `name:${normalizeName(student.name)}`;
    const submissionKey = (submission: Submission) => submission.nis.trim()
      ? `nis:${submission.nis.trim().toLowerCase()}`
      : `name:${normalizeName(submission.studentName)}`;
    const sortSubmissions = (items: Submission[]) => [...items].sort((a, b) =>
      a.attemptNumber - b.attemptNumber
      || (a.submittedAt ?? '').localeCompare(b.submittedAt ?? '')
      || a.studentName.localeCompare(b.studentName, 'id-ID'));
    const isFinal = (submission: Submission) => isFinalSubmission(submission);
    const rowForSubmission = (submission: Submission) => {
      if (!isFinal(submission) || submission.totalScore == null) {
        return [clipboardCell(submission.studentName), '', 'Belum ada nilai'];
      }
      const score = toPercent(submission.totalScore);
      return [clipboardCell(submission.studentName), String(score), score >= passingScore ? 'Lulus' : 'Tidak Lulus'];
    };

    const unassigned = new Map(examSubs.map(submission => [submission.id, submission]));
    const rows: string[][] = [];

    if (selectedExam.preloadedStudents.length > 0) {
      selectedExam.preloadedStudents.forEach(student => {
        const key = rosterKey(student);
        const matched = sortSubmissions(examSubs.filter(submission => submissionKey(submission) === key));
        matched.forEach(submission => unassigned.delete(submission.id));
        if (matched.length) {
          matched.forEach(submission => rows.push(rowForSubmission(submission)));
        } else {
          rows.push([clipboardCell(student.name), '', 'Belum ada nilai']);
        }
      });
      sortSubmissions([...unassigned.values()])
        .sort((a, b) => a.studentName.localeCompare(b.studentName, 'id-ID') || a.attemptNumber - b.attemptNumber)
        .forEach(submission => rows.push(rowForSubmission(submission)));
    } else {
      [...examSubs]
        .sort((a, b) => a.studentName.localeCompare(b.studentName, 'id-ID') || a.attemptNumber - b.attemptNumber)
        .forEach(submission => rows.push(rowForSubmission(submission)));
    }

    if (!rows.length) return;
    try {
      await copyTextToClipboard(rows.map(row => row.join('\t')).join('\n'));
      addToast({ type: 'success', title: 'Nilai siap ditempel!', message: `${rows.length} baris nama, nilai, dan status telah disalin.` });
    } catch (error) {
      console.error('Gagal menyalin nilai:', error);
      addToast({ type: 'error', title: 'Nilai gagal disalin', message: 'Izinkan akses clipboard, lalu coba lagi.' });
    }
  };

  // Question analytics
  const questionAnalytics = useMemo(() => {
    if (!selectedExam) return [];
    return selectedExam.questions.map(q => {
      if (q.type !== 'MULTIPLE_CHOICE') return null;
      const answered = examSubs.filter(s => s.answers.some(a => a.questionId === q.id));
      const correct = examSubs.filter(s => s.answers.some(a => a.questionId === q.id && a.selectedOptionId === q.correctOptionId));
      const pct = answered.length ? Math.round((correct.length / answered.length) * 100) : 0;
      return { question: q, answered: answered.length, correct: correct.length, pct };
    }).filter(Boolean);
  }, [selectedExam, examSubs]);

  if (myExams.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header"><h1>Hasil & Nilai</h1></div>
        <div className="card">
          <EmptyState icon={<BarChart2 size={48} />} title="Belum ada ujian yang selesai"
            description="Publikasikan ujian dan tunggu murid mengerjakan untuk melihat hasil." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="results-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 'var(--sp-6)' }}>
        <h1>Hasil & Nilai</h1>
        <div className="results-page-actions" style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => refreshSubmissions()} title="Refresh data">
            <RefreshCcw size={14} />
          </button>
          <select className="form-select results-exam-select" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} id="result-exam-select">
            {myExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {selectedExam && (examSubs.length > 0 || selectedExam.preloadedStudents.length > 0) && (
            <button className="btn btn-secondary results-export-button" type="button" onClick={() => void copyGradesToSpreadsheet()} title="Salin nama, nilai, dan status untuk ditempel ke Excel atau Google Sheets">
              <Copy size={15} /> Copy untuk Spreadsheet
            </button>
          )}
          {examSubs.length > 0 && (
            <button className="btn btn-secondary results-export-button" onClick={exportExcel}><Download size={15} /> Export Excel</button>
          )}
          {selectedExam?.format !== 'PG_ONLY' && quickTargets.length > 0 && (
            <button className="btn btn-primary" onClick={startQuickGrading} title="Koreksi essay satu per satu">
              <Zap size={15} /> Koreksi Cepat
            </button>
          )}
        </div>
      </div>

      {selectedExam && (
        <>
          {/* Exam info */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
            <FormatBadge format={selectedExam.format} />
            <StatusBadge status={selectedExam.status} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedExam.questions.length} soal • Maks. {maxTotal} poin</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--sp-3)', marginBottom: 'var(--sp-8)' }}>
            {[
              { label: 'Total Peserta', value: uniqueParticipantCount, color: 'var(--primary)' },
              { label: 'Submission', value: examSubs.length, color: 'var(--secondary)' },
              { label: 'Rata-rata Nilai', value: gradedPercents.length ? avgTotal : '—', color: 'var(--success)' },
              { label: 'Median', value: gradedPercents.length ? scoreStats.median : '—', color: 'var(--secondary)' },
              { label: 'Tertinggi', value: gradedPercents.length ? scoreStats.highest : '—', color: 'var(--success)' },
              { label: `Ketuntasan ≥${passingScore}`, value: gradedPercents.length ? `${scoreStats.masteryCount}/${gradedPercents.length} (${scoreStats.mastery}%)` : '—', color: 'var(--warning)' },
              { label: 'Essay Final', value: `${examSubs.filter(s => essayStatus(s) === 'FINAL').length}/${examSubs.length}`, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            ))}
          </div>

          {selectedExam.format !== 'PG_ONLY' && (() => {
            const essayCounts = examSubs.reduce((counts, sub) => {
              const status = essayStatus(sub);
              if (status === 'FINAL') counts.final += 1;
              else if (status === 'PARTIAL') counts.partial += 1;
              else counts.pending += 1;
              return counts;
            }, { final: 0, partial: 0, pending: 0 });
            return <div className="essay-grading-summary" aria-label="Ringkasan status penilaian essay">
              <span><strong>{essayCounts.final}</strong> Selesai Dinilai</span>
              <span><strong>{essayCounts.partial}</strong> Sebagian</span>
              <span><strong>{essayCounts.pending}</strong> Belum Dinilai</span>
            </div>;
          })()}

          {examSubs.length > 0 && (
            <div className="card" style={{ marginBottom: 'var(--sp-8)' }}>
              <SectionHeader title="Statistik Lanjutan" subtitle="Distribusi nilai dan 5 peringkat teratas" />
              <div className="results-advanced-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
                <div>
                  {[
                    ['<40%', scoreStats.distribution[0], 'var(--danger)'],
                    ['40-69%', scoreStats.distribution[1], 'var(--warning)'],
                    ['70-84%', scoreStats.distribution[2], 'var(--success)'],
                    ['85-100%', scoreStats.distribution[3], 'var(--primary)'],
                  ].map(([label, count, color]) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <span style={{ width: 60, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${scoreStats.count ? (Number(count) / scoreStats.count) * 100 : 0}%`, height: '100%', background: String(color) }} />
                      </div>
                      <strong style={{ fontSize: '0.78rem' }}>{count}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  {ranking.map((sub, i) => {
                    const total = sub.totalScore ?? 0;
                    return <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '0.82rem' }}>{i + 1}. {sub.studentName}</span>
                      <span style={{ whiteSpace: 'nowrap' }}>
                        <strong style={{ color: 'var(--success)' }}>{toPercent(total)}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>/100 · {total}/{maxTotal} poin</span>
                      </span>
                    </div>;
                  })}
                </div>

              </div>
            </div>
          )}

          {/* Participant Table */}
          <SectionHeader title="Daftar Peserta" subtitle={`${uniqueParticipantCount} peserta unik • ${examSubs.length} submission${scoreStats.count < uniqueParticipantCount ? ` • statistik dari ${scoreStats.count} peserta yang nilainya final` : ''}`} />
          {examSubs.length === 0 ? (
            <div className="card">
              <EmptyState icon={<User size={48} />} title="Belum ada peserta" description="Bagikan kode ujian ke murid agar mereka bisa mengerjakan." />
            </div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 'var(--sp-8)' }}>
              <table>
                <thead>
                  <tr>
                    <th>No</th><th>Nama</th><th>No. Absen</th><th>Percobaan</th>
                    {selectedExam.format !== 'ESSAY_ONLY' && <th>Skor PG</th>}
                    {selectedExam.format !== 'PG_ONLY' && <th>Skor Essay</th>}
                    <th>Nilai (0–100)</th><th>Waktu Submit</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {examSubs.map((sub, i) => {
                    const essayTotal = sub.essayScores.reduce((a, g) => a + g.score, 0);
                    const gradingStatus = essayStatus(sub);
                    const needsGrading = gradingStatus === 'PENDING' || gradingStatus === 'PARTIAL';
                    const total = sub.totalScore;
                    const isFinal = isFinalSubmission(sub);
                    const provisional = sub.mcScore + essayTotal;
                    return (
                      <tr key={sub.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{sub.studentName}</td>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{attendanceNoFor(sub) ?? '—'}</td>
                        <td style={{ textAlign: 'center' }}>{sub.attemptNumber}</td>
                        {selectedExam.format !== 'ESSAY_ONLY' && (
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                            {sub.mcScore}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{maxMC}</span>
                          </td>
                        )}
                        {selectedExam.format !== 'PG_ONLY' && (
                          <td style={{ textAlign: 'center' }}>
                            {gradingStatus === 'PENDING'
                              ? <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>Belum dinilai</span>
                              : gradingStatus === 'PARTIAL'
                              ? <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>Dinilai sebagian</span>
                              : <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{essayTotal}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{maxEssay}</span></span>
                            }
                          </td>
                        )}
                        <td style={{ textAlign: 'center' }}>
                          {isFinal && total != null ? (
                            <>
                              <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--success)', lineHeight: 1.1 }}>
                                {toPercent(total)}<span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-muted)' }}>/100</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{total}/{maxTotal} poin</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: sub.isReturned ? 'var(--danger)' : 'var(--warning)' }}>
                                {sub.isReturned ? 'Dikembalikan' : 'Belum final'}
                              </div>
                              {!sub.isReturned && needsGrading && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>sementara {provisional}/{maxTotal} poin</div>}
                            </>
                          )}
                        </td>

                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {sub.submittedAt ? formatDateTime(sub.submittedAt) : '—'}
                          {(sub.antiCheatEvents?.length ?? 0) > 0 && <div style={{ color: 'var(--danger)', marginTop: 3 }}>{sub.antiCheatEvents!.length} pelanggaran</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm results-analysis-action" type="button" aria-label={`Analisis ${sub.studentName}`} title={`Analisis ${sub.studentName}`} onClick={() => { setDetailSub(sub); setGradingMode(false); setAnalysisFilter('ALL'); }}>
                              <BarChart2 size={14} aria-hidden="true" />
                              <span>Analisis</span>
                            </button>
                            {selectedExam.format !== 'PG_ONLY' && (
                              <button className="btn btn-ghost btn-sm btn-icon" type="button" aria-label="Nilai Essay" title="Nilai Essay" onClick={() => startGrading(sub)}
                                style={{ color: needsGrading ? 'var(--warning)' : 'var(--text-muted)' }}>
                                <Edit2 size={14} aria-hidden="true" />
                              </button>
                            )}
                            <button className="btn btn-ghost btn-sm" type="button" aria-label={`Tambah satu kesempatan untuk ${sub.studentName}`} title="Tambah 1 kesempatan" onClick={() => setAttemptTarget(sub)}>
                              +1 <span className="results-analysis-action">Kesempatan</span>
                            </button>
                            <button
                              className="btn btn-ghost btn-sm btn-icon"
                              type="button"
                              aria-label={`Hapus submission ${sub.studentName}`}
                              title="Hapus submission"
                              onClick={() => void handleDeleteSubmission(sub)}
                              disabled={deletingSubmissionId === sub.id}
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Analytics */}
          {questionAnalytics.length > 0 && (
            <>
              <SectionHeader title="Analitik Soal PG" subtitle="Persentase murid yang menjawab benar per soal" />
              <div className="card">
                {(questionAnalytics as NonNullable<typeof questionAnalytics[0]>[]).map((item, i) => (
                  <div key={item!.question.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: i < questionAnalytics.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                        {item!.question.text}
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item!.pct}%`, background: item!.pct >= 70 ? 'var(--success)' : item!.pct >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 'var(--r-full)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0, color: item!.pct >= 70 ? 'var(--success)' : item!.pct >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                      {item!.pct}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {item!.correct}/{item!.answered}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Detail / Grading Modal */}
      <Modal
        open={!!attemptTarget}
        onClose={() => !grantingAttempt && setAttemptTarget(null)}
        title={`Tambah kesempatan untuk ${attemptTarget?.studentName ?? ''}`}
        subtitle="Perubahan ini hanya berlaku untuk peserta ini."
        footer={<><button className="btn btn-secondary" disabled={grantingAttempt} onClick={() => setAttemptTarget(null)}>Batal</button><button className="btn btn-primary" disabled={grantingAttempt} onClick={() => void grantExtraAttempt()}>{grantingAttempt ? 'Menambahkan...' : 'Tambah Kesempatan'}</button></>}
      >
        {attemptTarget && <div style={{ padding: '0 var(--sp-6) var(--sp-2)' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Saat ini peserta sudah memakai <strong>{attemptTarget.attemptNumber}</strong> percobaan pada submission ini.</p>
          <p style={{ margin: 'var(--sp-3) 0 0', color: 'var(--text-secondary)' }}>Setelah ditambah, batas efektifnya menjadi <strong>{(selectedExam?.settings.maxAttempts ?? 1) + 1}</strong> atau lebih jika sebelumnya sudah pernah diberi tambahan.</p>
        </div>}
      </Modal>
      <Modal open={!!detailSub} onClose={() => { void discardAiSuggestions(); setDetailSub(null); setGradingMode(false); setAnalysisFilter('ALL'); }}
        title={gradingMode ? `Nilai Essay — ${detailSub?.studentName}` : `Analisis — ${detailSub?.studentName}`}
        size="xl"
        footer={gradingMode ? (
          <>
            <button className="btn btn-secondary" onClick={() => { void discardAiSuggestions(); setGradingMode(false); setAnalysisFilter('ALL'); }}>Batal</button>
            <button className="btn btn-secondary" onClick={requestAiSuggestions} disabled={aiLoading || !allEssayGuidesAvailable} title={allEssayGuidesAvailable ? 'Buat saran nilai untuk seluruh essay siswa ini' : 'Lengkapi panduan jawaban pada setiap soal essay terlebih dahulu'}>
              <Sparkles size={15} /> {aiLoading ? 'Meminta saran...' : 'Nilai dengan AI'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => detailSub && handleReturn(detailSub)}>
              <RotateCcw size={13} /> Kembalikan Revisi
            </button>
            <button className="btn btn-primary" onClick={saveGrading}>Simpan Nilai</button>
          </>
        ) : (
          <>
            <button className="btn btn-secondary" onClick={() => { setDetailSub(null); setGradingMode(false); setAnalysisFilter('ALL'); }}>Tutup</button>
            <button className="btn btn-secondary btn-sm" onClick={() => detailSub && handleReturn(detailSub)}>
              <RotateCcw size={13} /> Kembalikan Revisi
            </button>
          </>
        )}>
        {detailSub && selectedExam && detailAnalysis && (
          <div className="results-detail-modal-body">
            {!gradingMode && (
              <>
                <section className="student-analysis-summary" aria-label={`Ringkasan nilai ${detailSub.studentName}`}>
                  <div className="student-analysis-identity">
                    <div>
                      <strong>{detailSub.studentName}</strong>
                      <span>Percobaan {detailSub.attemptNumber}</span>
                    </div>
                    {detailSub.isReturned && <span className="student-analysis-returned">Dikembalikan untuk revisi</span>}
                  </div>
                  <div className="student-analysis-score-row">
                    <div className={`student-analysis-main-score ${isFinalSubmission(detailSub) ? 'is-final' : 'is-pending'}`}>
                      <span>Nilai</span>
                      {isFinalSubmission(detailSub) && detailSub.totalScore != null ? (
                        <>
                          <strong>{toPercent(detailSub.totalScore)} <small>/ 100</small></strong>
                          <p>{detailSub.totalScore} / {maxTotal} poin</p>
                        </>
                      ) : (
                        <>
                          <strong className="student-analysis-pending-label">Belum final</strong>
                          <p>Skor sementara <b>{detailAnalysis.provisionalScore} / {maxTotal}</b> poin</p>
                        </>
                      )}
                    </div>
                    <div className="student-analysis-score-breakdown">
                      {maxMC > 0 && (
                        <div>
                          <span>PG</span>
                          <strong>{detailSub.mcScore} / {maxMC}</strong>
                        </div>
                      )}
                      {maxEssay > 0 && (
                        <div>
                          <span>Essay · {detailAnalysis.essayGradedCount}/{detailAnalysis.essayCount} dinilai</span>
                          <strong>{detailAnalysis.essayScore} / {maxEssay}</strong>
                          <small>
                            {detailAnalysis.essayPendingCount > 0
                              ? `${detailAnalysis.essayPendingCount} jawaban menunggu koreksi`
                              : 'Semua jawaban essay sudah dinilai'}
                          </small>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={`student-analysis-counts ${detailAnalysis.essayCount > 0 ? 'has-essay' : ''}`} aria-label="Ringkasan jawaban">
                    <div className="student-analysis-count is-correct">
                      <span>Soal otomatis</span>
                      <strong>{detailAnalysis.correctCount} benar</strong>
                    </div>
                    <div className="student-analysis-count is-wrong">
                      <span>Soal otomatis</span>
                      <strong>{detailAnalysis.wrongCount} salah</strong>
                    </div>
                    {detailAnalysis.essayCount > 0 && (
                      <div className="student-analysis-count is-essay">
                        <span>Jawaban essay</span>
                        <strong>{detailAnalysis.essayGradedCount}/{detailAnalysis.essayCount} dinilai</strong>
                        <small>
                          {detailAnalysis.essayPendingCount > 0
                            ? `${detailAnalysis.essayPendingCount} menunggu koreksi`
                            : 'Koreksi selesai'}
                        </small>
                      </div>
                    )}
                  </div>
                </section>

                <div className="student-analysis-filters" role="group" aria-label="Filter analisis jawaban">
                  {ANALYSIS_FILTERS.map(filter => (
                    <button
                      key={filter.value}
                      type="button"
                      className={`student-analysis-filter ${analysisFilter === filter.value ? 'is-active' : ''}`}
                      aria-pressed={analysisFilter === filter.value}
                      onClick={() => setAnalysisFilter(filter.value)}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <div className="student-analysis-question-list">
            {visibleDetailQuestions.map(({ question: q, questionNumber, answer, isCorrect }) => {
              const savedGrade = detailSub.essayScores.find(g => g.questionId === q.id);
              const grade = gradingMode ? (gradingScores[q.id] ?? savedGrade) : savedGrade;

              return (
                <article key={q.id} className="student-analysis-question-card">
                  <div className="student-analysis-question-heading">
                    <span>Soal {questionNumber}</span>
                    {q.type !== 'ESSAY' && (
                      <span className={`student-analysis-result ${isCorrect ? 'is-correct' : 'is-wrong'}`}>
                        {isCorrect ? <CheckCircle2 size={15} aria-hidden="true" /> : <XCircle size={15} aria-hidden="true" />}
                        {isCorrect ? 'Benar' : 'Salah'}
                      </span>
                    )}
                  </div>
                  <div className="student-analysis-question-text">{q.text}</div>

                      {q.type === 'MULTIPLE_CHOICE' && (
                        <div className="student-analysis-answer-grid">
                          <div className="student-analysis-answer-block">
                            <span>Jawaban murid</span>
                            <p>{answer?.selectedOptionId
                              ? q.options?.find(option => option.id === answer.selectedOptionId)?.text ?? '—'
                              : <em>Tidak dijawab</em>}</p>
                          </div>
                          <div className="student-analysis-answer-block is-key">
                            <span>Kunci</span>
                            <p>{q.options?.find(option => option.id === q.correctOptionId)?.text ?? '—'}</p>
                          </div>
                          <div className="student-analysis-points">{isCorrect ? q.weight : 0} / {q.weight} poin</div>
                        </div>
                      )}

                      {q.type === 'SHORT_ANSWER' && (
                        <div className="student-analysis-answer-grid">
                          <div className="student-analysis-answer-block">
                            <span>Jawaban murid</span>
                            <p>{answer?.shortAnswer || <em>Tidak dijawab</em>}</p>
                          </div>
                          <div className="student-analysis-answer-block is-key">
                            <span>Jawaban diterima</span>
                            <p>{(q.acceptedAnswers ?? []).join(', ') || '—'}</p>
                          </div>
                          <div className="student-analysis-points">{isCorrect ? q.weight : 0} / {q.weight} poin</div>
                        </div>
                      )}

                      {q.type === 'ESSAY' && (
                        <div className="student-analysis-essay">
                          <div className="student-analysis-answer-block">
                            <span>Jawaban murid</span>
                            <p className="student-analysis-long-answer">
                            {answer?.essayText || <em style={{ color: 'var(--text-muted)' }}>Tidak dijawab</em>}
                            </p>
                          </div>
                          <div className="student-analysis-answer-block is-guide">
                            <span>Panduan jawaban</span>
                            <p>{q.answerGuide || <em>Belum ada panduan jawaban.</em>}</p>
                          </div>
                          {gradingMode && (
                            <>
                            {aiSuggestions[q.id] && (
                              <div style={{ marginBottom: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--primary-light)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', fontSize: '0.8rem' }}>
                                <strong style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--primary)' }}><Sparkles size={14} /> Saran AI: {aiSuggestions[q.id].suggestedScore}/{q.weight} poin</strong>
                                <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{aiSuggestions[q.id].reason}</p>
                              </div>
                            )}
                            <div className="grading-input-row" style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div className="form-group" style={{ width: 120 }}>
                                <label className="form-label">Nilai (maks. {q.weight})</label>
                                <NumericInput className="form-input" min={0} max={q.weight} step="any" inputMode="decimal" fallbackValue={0}
                                  value={gradingScores[q.id]?.score}
                                  onValueChange={score => {
                                    if (score == null) return;
                                    setGradingScores(prev => ({ ...prev, [q.id]: { ...prev[q.id], score } }));
                                  }} />
                              </div>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Komentar (opsional)</label>
                                <input type="text" className="form-input" placeholder="Komentar untuk murid..."
                                  value={gradingScores[q.id]?.comment ?? ''}
                                  onChange={e => setGradingScores(prev => ({ ...prev, [q.id]: { ...prev[q.id], comment: e.target.value } }))} />
                              </div>
                            </div>
                            </>
                          )}
                          {!gradingMode && (
                            <div className={`student-analysis-essay-grade ${grade ? 'is-graded' : 'is-pending'}`}>
                              <div>
                                <span>Nilai</span>
                                <strong>{grade ? `${grade.score} / ${q.weight} poin` : 'Belum dinilai'}</strong>
                                {!grade && <small>0 / {q.weight} poin</small>}
                              </div>
                              {grade?.comment?.trim() && (
                                <div className="student-analysis-teacher-comment">
                                  <span>Komentar guru</span>
                                  <p>{grade.comment}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                </article>
              );
            })}
            {!visibleDetailQuestions.length && (
              <div className="student-analysis-empty" role="status">
                {gradingMode ? 'Tidak ada soal essay.' : getEmptyAnalysisMessage(analysisFilter)}
              </div>
            )}
            </div>
            {(detailSub.antiCheatEvents?.length ?? 0) > 0 && (
              <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--danger-light)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.8rem' }}>
                <strong>Log Anti-cheat:</strong>{' '}
                {detailSub.antiCheatEvents!.map(e => `${formatDateTime(e.timestamp)} (pelanggaran ${e.count})`).join(', ')}
              </div>
            )}
            {gradingMode && (
              <>
              {!allEssayGuidesAvailable && <p style={{ marginTop: 'var(--sp-4)', color: 'var(--warning)', fontSize: '.84rem' }}>Lengkapi panduan jawaban di setiap soal essay untuk memakai saran AI.</p>}
              <div className="form-group" style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)', background: 'var(--primary-light)', borderRadius: 'var(--r-md)', border: '1px solid rgba(37,99,235,0.15)' }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <MessageSquare size={14} /> Feedback / Komentar Umum untuk Murid
                </label>
                <textarea className="form-textarea" rows={2} placeholder="Komentar ini akan tampil di halaman hasil murid..."
                  value={feedbackText} onChange={e => setFeedbackText(e.target.value)} />
              </div>
              <p style={{ marginTop: 'var(--sp-3)', fontSize: '.78rem', color: 'var(--text-muted)' }}>AI hanya memberi saran. Nilai baru tersimpan setelah Anda meninjau dan menekan Simpan Nilai.</p>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={quickMode && !!quickTarget}
        onClose={closeQuickGrading}
        title={quickTarget ? `Koreksi Cepat — ${quickTarget.submission.studentName}` : 'Koreksi Cepat'}
        size="default"
        footer={<>
          <button className="btn btn-secondary" onClick={closeQuickGrading}>Tutup</button>
          <button className="btn btn-ghost" disabled={quickIndex === 0} onClick={() => setQuickIndex(index => Math.max(0, index - 1))}><ArrowLeft size={14} /> Sebelumnya</button>
          <button className="btn btn-ghost" disabled={quickIndex >= quickTargets.length - 1} onClick={() => setQuickIndex(index => Math.min(quickTargets.length - 1, index + 1))}>Berikutnya <ArrowRight size={14} /></button>
        </>}
      >
        {quickTarget && (
          <div className="quick-grading-panel">
            <div className="quick-grading-progress">
              <span>Soal {quickTarget.question.order + 1}/{selectedExam?.questions.length ?? 0}</span>
              <span>Murid {examSubs.findIndex(sub => sub.id === quickTarget.submission.id) + 1}/{examSubs.length}</span>
              <strong>{quickGradedCount}/{quickTargets.length} jawaban essay selesai dinilai</strong>
            </div>
            <div className="quick-grading-question">{quickTarget.question.text}</div>
            <div className="quick-grading-answer">
              {quickTarget.submission.answers.find(answer => answer.questionId === quickTarget.question.id)?.essayText || <em>Murid tidak mengisi jawaban.</em>}
            </div>
            {quickTarget.question.answerGuide && (
              <div className="quick-grading-guide"><strong>Panduan Jawaban:</strong> {quickTarget.question.answerGuide}</div>
            )}
            <div className="quick-grading-score-label">Pilih skor (maks. {quickTarget.question.weight})</div>
            <div className="quick-grading-score-grid">
              {Array.from({ length: Math.floor(quickTarget.question.weight) + 1 }, (_, score) => (
                <button key={score} type="button" className={`quick-grading-score ${quickScore === score ? 'is-selected' : ''}`} onClick={() => void saveQuickGrade(score)}>{score}</button>
              ))}
            </div>
            <label className="form-label" htmlFor="quick-grade-comment">Komentar (opsional)</label>
            <textarea id="quick-grade-comment" className="form-textarea" rows={2} value={quickComment} onChange={event => setQuickComment(event.target.value)} placeholder="Catatan untuk murid..." />
            <p className="quick-grading-hint">Klik skor atau tekan 0–9 untuk menyimpan dan lanjut. Enter mengulangi skor terakhir.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
