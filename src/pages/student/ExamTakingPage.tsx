// ============================================================
// ExamTakingPage — Core student exam experience
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { storage } from '../../utils/storage';
import {
  loadSession, upsertAnswer, updateTimer,
  updateCurrentIndex, buildSubmission, buildDraftSubmission, createSession, clearSession, savePerQuestionTimer, isAnswerFilled, saveSession,
  type ExamSession,
} from '../../utils/examSession';

import { useCountdown } from '../../hooks/useCountdown';
import type { Exam, Question, StudentAnswer } from '../../types';
import { studentSubmissionMessages } from '../../utils/studentMessages';
import { getNavigationMode, shouldAutoSubmitOnTimeUp } from '../../utils/examSettings';

// Sub-components
import ExamHeader from './exam/ExamHeader';
import QuestionView from './exam/QuestionView';
import QuestionNav from './exam/QuestionNav';
import SubmitDialog from './exam/SubmitDialog';
import ResultScreen from './exam/ResultScreen';

interface LocationState {
  examId: string;
  studentName: string;
  participantId: string;
  resume?: boolean;
}

export default function ExamTakingPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | null;

  // ---- State ----
  const [exam, setExam] = useState<Exam | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showSubmit, setShowSubmit] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'local' | 'syncing' | 'synced' | 'failed'>('local');
  const [timeExpired, setTimeExpired] = useState(false);
  const [submittedData, setSubmittedData] = useState<ReturnType<typeof buildSubmission> | null>(null);
  const [error, setError] = useState('');
  const submitRef = useRef(false);
  const sessionRef = useRef<ExamSession | null>(null);
  const draftSavingRef = useRef(false);
  const draftDirtyRef = useRef(false);
  sessionRef.current = session;

  // ---- Anti-cheat ----
  const [violations, setViolations] = useState(0);
  const [showViolationWarning, setShowViolationWarning] = useState(false);
  const antiCheatEventsRef = useRef<import('../../types').AntiCheatEvent[]>([]);

  const [loadError, setLoadError] = useState('');
  const bootstrapRef = useRef(false); // guard agar bootstrap tidak jalan 2x (StrictMode)

  // ---- Bootstrap — query Supabase langsung, tidak butuh auth guru ----
  useEffect(() => {
    if (bootstrapRef.current) return;
    bootstrapRef.current = true;

    if (!state?.examId || !code) { navigate('/ujian'); return; }

    storage.getStudentExamByCode(code, state.studentName, state.participantId).then(async ({ exam: found, error: lookupError, attemptNumber }) => {
      if (!found && lookupError?.type !== 'NOT_FOUND') {
        setLoadError(lookupError?.message ?? 'Ujian belum dapat dimuat. Silakan coba lagi.');
        return;
      }
      if (!found || found.id !== state.examId) { navigate('/ujian'); return; }

      // Guard: exam harus punya soal
      if (found.questions.length === 0) {
        setLoadError('Ujian ini belum memiliki soal. Hubungi guru Anda.');
        return;
      }

      // Restore the existing session even after a browser refresh. Presentation
      // order is persisted so a shuffled exam never changes midway through.
      const existing = loadSession(code, state.participantId);
      const ordered = [...found.questions].sort((a, b) => a.order - b.order);
      let qs: Question[];
      if (existing && !existing.isSubmitted) {
        const byId = new Map(ordered.map(question => [question.id, question]));
        const questionOrder = existing.questionOrder?.filter(id => byId.has(id));
        const stableQuestions = questionOrder?.length === ordered.length
          ? questionOrder.map(id => byId.get(id)!)
          : ordered;
        qs = stableQuestions.map(question => {
          const optionOrder = existing.optionOrderByQuestion?.[question.id];
          if (!question.options || !optionOrder?.length) return question;
          const optionsById = new Map(question.options.map(option => [option.id, option]));
          const options = optionOrder.map(id => optionsById.get(id)).filter(Boolean) as NonNullable<Question['options']>;
          return options.length === question.options.length ? { ...question, options } : question;
        });
        // Sessions created before stable ordering existed migrate once to a
        // deterministic order and keep that order on every later resume.
        const restoredSession = existing.questionOrder ? existing : {
          ...existing,
          questionOrder: qs.map(question => question.id),
          optionOrderByQuestion: Object.fromEntries(qs.filter(question => question.options).map(question => [question.id, question.options!.map(option => option.id)])),
        };
        if (restoredSession !== existing) saveSession(restoredSession);
        setSession(restoredSession);
        setCurrentIdx(Math.min(restoredSession.currentQuestionIndex, qs.length - 1));
      } else {
        qs = found.settings.shuffleQuestions ? [...ordered].sort(() => Math.random() - 0.5) : ordered;
        if (found.settings.shuffleOptions) {
          qs = qs.map(question => ({ ...question, options: question.options ? [...question.options].sort(() => Math.random() - 0.5) : question.options }));
        }
        // Attempt number berasal dari submission COMPLETE di server. Draft/autosave tidak memakan jatah.
        const newSession = createSession(
          found, state.studentName, state.participantId, attemptNumber ?? 1,
          qs.map(question => question.id),
          Object.fromEntries(qs.filter(question => question.options).map(question => [question.id, question.options!.map(option => option.id)])),
        );
        setSession(newSession);
        setCurrentIdx(0);
      }
      setQuestions(qs);
      setExam(found);
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLoadError(`Gagal memuat ujian: ${msg}`);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitRef.current || !session || !exam) return;
    submitRef.current = true;
    setIsSubmitting(true);

    // Final submit langsung menuju RPC save_student_submission.
    // RPC adalah sumber kebenaran dan sudah memvalidasi status ujian, jadwal,
    // daftar peserta, ownership submission, serta batas percobaan secara atomik.
    // Menghindari lookup kedua di sini mencegah final submit kandas karena
    // request validasi terpisah gagal sesaat sebelum jawaban dikirim.
    const sub = { ...buildSubmission(session, exam), antiCheatEvents: antiCheatEventsRef.current };
    let saveResult: Awaited<ReturnType<typeof storage.saveSubmission>>;
    try {
      saveResult = await storage.saveSubmission(sub);
    } catch {
      saveResult = { saved: false, queued: false, error: 'Jawaban belum dapat dikirim. Periksa koneksi lalu coba lagi.' };
    }

    if (saveResult.saved) {
      // Session baru dihapus setelah server mengonfirmasi submission COMPLETE.
      clearSession(session.examCode, session.participantId);
      setSubmittedData({ ...sub, mcScore: saveResult.mcScore ?? sub.mcScore, totalScore: saveResult.totalScore });
      setSubmitted(true);
      setSubmitPending(false);
      setShowSubmit(false);
      setIsSubmitting(false);
      return;
    }

    submitRef.current = false;
    setIsSubmitting(false);
    setShowSubmit(false);
    setSubmittedData(sub);
    if (saveResult.queued) {
      // Jika koneksi putus, submission final tetap berada di queue lokal dan
      // memakai ID yang sama. Retry aman/idempotent dan tidak menambah attempt.
      setSubmitPending(true);
    } else {
      // Jangan alihkan ke error pemuatan: ujian dan jawaban yang sudah
      // dikerjakan masih tersedia, sehingga siswa harus dapat mencoba kirim
      // ulang tanpa kehilangan pekerjaannya.
      setError(saveResult.error ?? 'Jawaban belum dapat disimpan. Silakan coba lagi.');
    }
  }, [session, exam]);

  // Keep a recoverable server draft without recreating the interval for every
  // keystroke or sending overlapping requests.
  useEffect(() => {
    if (!exam || submitted) return;
    const id = setInterval(() => {
      const latest = sessionRef.current;
      if (!latest || latest.answers.length === 0 || !draftDirtyRef.current || draftSavingRef.current) return;
      draftSavingRef.current = true;
      setSyncStatus('syncing');
      void storage.saveSubmission({ ...buildDraftSubmission(latest, exam), antiCheatEvents: antiCheatEventsRef.current }).then(result => {
        if (result.saved) {
          draftDirtyRef.current = false;
          setSyncStatus('synced');
        } else {
          setSyncStatus('failed');
        }
      }).catch(() => setSyncStatus('failed')).finally(() => { draftSavingRef.current = false; });
    }, 5000);
    return () => clearInterval(id);
  }, [exam, submitted]);

  // ---- Anti-cheat: visibilitychange listener (after handleSubmit) ----
  useEffect(() => {
    if (submitted || (exam?.settings.antiCheatSensitivity ?? 'MEDIUM') === 'OFF') return;
    const maxViolations = exam?.settings.antiCheatSensitivity === 'HIGH' ? 1 : exam?.settings.antiCheatSensitivity === 'LOW' ? 5 : 3;
    const handleVisibility = () => {
      if (document.hidden) {
        setViolations(prev => {
          const next = prev + 1;
          antiCheatEventsRef.current = [...antiCheatEventsRef.current, { type: 'TAB_HIDDEN', timestamp: new Date().toISOString(), count: next }];
          setShowViolationWarning(true);
          setTimeout(() => setShowViolationWarning(false), 5000);
          // Fix #2: Kasih warning 3 detik sebelum auto-submit agar murid tahu
          if (next >= maxViolations) {
            setTimeout(() => handleSubmit(), 3000);
          }
          return next;
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [submitted, handleSubmit, exam]);

  // ---- Whole-exam timer ----
  const wholeTimerEnabled = exam?.settings.timerMode === 'WHOLE_EXAM';
  const wholeDurationSeconds = exam?.settings.wholExamTimerSeconds ?? 3600;
  const elapsedWholeSeconds = session
    ? Math.max(0, Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000))
    : 0;
  const remainingFromStart = Math.max(0, wholeDurationSeconds - elapsedWholeSeconds);
  const initialWholeSeconds = session
    ? Math.min(session.remainingSeconds ?? wholeDurationSeconds, remainingFromStart)
    : wholeDurationSeconds;

  const wholeTimer = useCountdown({
    initialSeconds: initialWholeSeconds,
    autoStart: wholeTimerEnabled && !!session && !submitted,
    onExpire: useCallback(() => {
      if (exam && shouldAutoSubmitOnTimeUp(exam.settings)) void handleSubmit();
      else {
        setTimeExpired(true);
        setShowSubmit(true);
      }
    }, [exam, handleSubmit]),
  });
  const wholeRemainingRef = useRef(wholeTimer.remaining);
  wholeRemainingRef.current = wholeTimer.remaining;

  // Persist remaining time every 5 seconds
  useEffect(() => {
    if (!wholeTimerEnabled || !session) return;
    const id = setInterval(() => {
      setSession(current => current ? updateTimer(current, wholeRemainingRef.current) : current);
    }, 5000);
    return () => clearInterval(id);
  }, [wholeTimerEnabled, !!session]);

  // Stop whole timer on submit
  useEffect(() => {
    if (submitted) wholeTimer.stop();
  }, [submitted]);

  // ---- Per-question timer ----
  const perQEnabled = exam?.settings.timerMode === 'PER_QUESTION';
  const currentQ = questions[currentIdx];
  const perQSeconds = currentQ?.timerSeconds ?? exam?.settings.perQuestionDefaultSeconds ?? 60;

  // Fix #3: Track waktu tersisa per soal agar tidak reset saat back-and-forth
  const perQRemainingRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (session?.perQuestionRemainingSeconds) {
      perQRemainingRef.current = { ...session.perQuestionRemainingSeconds };
    }
  }, [session?.submissionId]);

  const goNext = useCallback(() => {
    const next = Math.min(currentIdx + 1, questions.length - 1);
    setCurrentIdx(next);
    setSession(s => s ? updateCurrentIndex(s, next, true) : s);
  }, [currentIdx, questions.length]);

  const perQTimer = useCountdown({
    initialSeconds: session?.perQuestionRemainingSeconds?.[currentQ?.id ?? ''] ?? perQSeconds,
    autoStart: perQEnabled && !!session && !submitted,
    onExpire: useCallback(() => {
      if (currentIdx < questions.length - 1) goNext();
      else handleSubmit();
    }, [currentIdx, questions.length, goNext, handleSubmit]),
  });
  const perQCurrentRemainingRef = useRef(perQTimer.remaining);
  perQCurrentRemainingRef.current = perQTimer.remaining;
  const perQProgressPct = perQEnabled && perQSeconds > 0
    ? Math.max(0, Math.min(100, Math.round((perQTimer.remaining / perQSeconds) * 100)))
    : undefined;

  // Simpan sisa waktu menurut ID soal, bukan index, agar refresh tidak memberi
  // durasi baru dan perubahan urutan soal tidak salah memasangkan timer.
  useEffect(() => {
    if (!perQEnabled || !session || !currentQ) return;
    return () => {
      perQRemainingRef.current[currentQ.id] = perQCurrentRemainingRef.current;
      savePerQuestionTimer(session.examCode, session.participantId, currentQ.id, perQCurrentRemainingRef.current);
    };
  }, [currentIdx, currentQ?.id, perQEnabled, session?.submissionId]);

  useEffect(() => {
    if (!perQEnabled || !session || !currentQ || submitted) return;
    const id = window.setInterval(() => {
      savePerQuestionTimer(session.examCode, session.participantId, currentQ.id, perQCurrentRemainingRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [perQEnabled, session?.submissionId, currentQ?.id, submitted]);

  useEffect(() => {
    if (perQEnabled && session && currentQ) {
      const saved = perQRemainingRef.current[currentQ.id] ?? session.perQuestionRemainingSeconds?.[currentQ.id];
      const target = saved ?? (currentQ.timerSeconds ?? exam?.settings.perQuestionDefaultSeconds ?? 60);
      perQTimer.reset(target);
    }
  }, [currentIdx, currentQ?.id]);

  // ---- Answer handler (autosave) ----
  const handleAnswer = useCallback((answer: StudentAnswer) => {
    if (timeExpired) return;
    draftDirtyRef.current = true;
    setSyncStatus('local');
    setSession(prev => {
      if (!prev) return prev;
      return upsertAnswer(prev, answer);
    });
  }, [timeExpired]);

  // ---- Navigation ----
  const sequential = exam ? getNavigationMode(exam.settings) === 'SEQUENTIAL' : false;
  const maxAvailableIdx = sequential ? Math.max(session?.highestUnlockedIndex ?? session?.currentQuestionIndex ?? 0, currentIdx) : questions.length - 1;

  const goTo = useCallback((idx: number) => {
    if (sequential && idx > maxAvailableIdx) return;
    setCurrentIdx(idx);
    setSession(s => s ? updateCurrentIndex(s, idx) : s);
  }, [sequential, maxAvailableIdx]);

  const goPrev = () => goTo(Math.max(currentIdx - 1, 0));
  const goNextBtn = () => goNext();

  // ---- Error state ----
  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 'var(--sp-6)' }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <p style={{ color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>{loadError}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/ujian')}>← Kembali</button>
      </div>
    );
  }

  // ---- Loading state ----
  if (!exam || !session || questions.length === 0) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner spinner-lg" style={{ display: 'block', margin: '0 auto var(--sp-4)' }} />
          <p style={{ color: 'var(--text-muted)' }}>Memuat ujian...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" aria-live="assertive" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 'var(--sp-6)' }}>
        <p style={{ color: 'var(--danger)', fontWeight: 600, textAlign: 'center' }}>{error}</p>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => { setError(''); void handleSubmit(); }}>Coba kirim lagi</button>
          <button className="btn btn-secondary" onClick={() => setError('')}>Kembali ke ujian</button>
        </div>
      </div>
    );
  }

  if (submitted && submittedData) {
    return <ResultScreen exam={exam} submission={submittedData} studentName={session.studentName} />;
  }

  if (submitPending) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-6)' }}>
        <div style={{ maxWidth: 480, textAlign: 'center', background: 'var(--surface)', border: '1px solid var(--warning)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-8)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📥</div>
          <h1 style={{ marginBottom: 8 }}>Jawaban Belum Terkirim</h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{studentSubmissionMessages.offline}</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setSubmitPending(false); void handleSubmit(); }}>Coba Kirim Sekarang</button>
        </div>
      </div>
    );
  }

  const answeredIds = new Set(session.answers.filter(isAnswerFilled).map(answer => answer.questionId));

  return (
    <div className="exam-taking-shell" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header with timer */}
      <ExamHeader
        examTitle={exam.title}
        studentName={session.studentName}
        currentIdx={currentIdx}
        total={questions.length}
        answeredCount={answeredIds.size}
        timerMode={exam.settings.timerMode}
        wholeRemaining={wholeTimerEnabled ? wholeTimer.remaining : undefined}
        wholeUrgency={wholeTimer.urgency}
        perQRemaining={perQEnabled ? perQTimer.remaining : undefined}
        perQUrgency={perQTimer.urgency}
        perQProgressPct={perQProgressPct}
        syncStatus={syncStatus}
        onOpenQuestionList={() => setMobileNavOpen(true)}
      />

      {/* Anti-cheat warning banner */}
      {showViolationWarning && (
        <div style={{ background: 'var(--danger)', color: 'white', padding: '10px var(--sp-6)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'fadeIn 0.2s ease' }}>
          Tetap di halaman ujian. Perpindahan aplikasi/tab tercatat ({violations}/{exam.settings.antiCheatSensitivity === 'HIGH' ? 1 : exam.settings.antiCheatSensitivity === 'LOW' ? 5 : 3}).
        </div>
      )}
      {timeExpired && <div role="alert" style={{ background: 'var(--warning)', color: 'var(--text-primary)', padding: '10px var(--sp-6)', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>Waktu habis. Jawaban dikunci; silakan kumpulkan jawaban Anda.</div>}

      <div className="exam-taking-body" style={{ flex: 1, display: 'flex' }}>
        {/* Main question area */}
        <div className="exam-question-scroll" style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <QuestionView
              question={currentQ}
              questionNumber={currentIdx + 1}
              totalQuestions={questions.length}
              currentAnswer={session.answers.find(a => a.questionId === currentQ.id)}
              onAnswer={handleAnswer}
              disabled={timeExpired || isSubmitting}
              perQRemaining={perQEnabled ? perQTimer.remaining : undefined}
              perQUrgency={perQTimer.urgency}
            />

            {/* Navigation buttons */}
            <div className="exam-inline-navigation" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-6)', gap: 'var(--sp-3)' }}>
              <button className="btn btn-secondary" onClick={goPrev} disabled={currentIdx === 0 || isSubmitting}>
                ← Sebelumnya
              </button>
              {currentIdx < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={goNextBtn} disabled={isSubmitting}>
                  Berikutnya →
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => setShowSubmit(true)} disabled={isSubmitting}>
                  Selesai &amp; Periksa Jawaban →
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Question navigation sidebar */}
        <QuestionNav
          questions={questions}
          currentIdx={currentIdx}
          answeredIds={answeredIds}
          maxAvailableIdx={maxAvailableIdx}
          onGoTo={goTo}
          onReview={() => setShowSubmit(true)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="exam-mobile-navigation">
        <button type="button" className="btn btn-secondary" onClick={goPrev} disabled={currentIdx === 0 || isSubmitting}>
          ← Sebelumnya
        </button>
        {currentIdx < questions.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={goNextBtn} disabled={isSubmitting}>
            Berikutnya →
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setShowSubmit(true)} disabled={isSubmitting}>
            Periksa Jawaban →
          </button>
        )}
      </div>

      {/* Submit confirmation dialog */}
      <SubmitDialog
        open={showSubmit}
        questions={questions}
        answeredIds={answeredIds}
        submitting={isSubmitting}
        onConfirm={() => handleSubmit()}
        onCancel={() => { if (!timeExpired) setShowSubmit(false); }}
      />
    </div>
  );
}
