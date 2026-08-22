// ============================================================
// ExamTakingPage — Core student exam experience
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { storage } from '../../utils/storage';
import {
  loadSession, upsertAnswer, updateTimer,
  updateCurrentIndex, buildSubmission, buildDraftSubmission, createSession, clearSession,
  type ExamSession,
} from '../../utils/examSession';

import { useCountdown } from '../../hooks/useCountdown';
import type { Exam, Question, StudentAnswer } from '../../types';

// Sub-components
import ExamHeader from './exam/ExamHeader';
import QuestionView from './exam/QuestionView';
import QuestionNav from './exam/QuestionNav';
import SubmitDialog from './exam/SubmitDialog';
import ResultScreen from './exam/ResultScreen';

interface LocationState {
  examId: string;
  studentName: string;
  nis: string;
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
  const [submitted, setSubmitted] = useState(false);
  const [submitPending, setSubmitPending] = useState(false);
  const [submittedData, setSubmittedData] = useState<ReturnType<typeof buildSubmission> | null>(null);
  const [error] = useState('');
  const submitRef = useRef(false);

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

    storage.getStudentExamByCode(code, state.studentName, state.nis).then(async ({ exam: found, error: lookupError, attemptNumber }) => {
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

      // Shuffle if enabled
      let qs = [...found.questions].sort((a, b) => a.order - b.order);
      if (found.settings.shuffleQuestions) {
        qs = qs.sort(() => Math.random() - 0.5);
      }
      if (found.settings.shuffleOptions) {
        qs = qs.map(q => ({
          ...q,
          options: q.options ? [...q.options].sort(() => Math.random() - 0.5) : q.options,
        }));
      }
      setQuestions(qs);
      setExam(found);

      // Load or create session
      const existing = loadSession(code, state.nis);
      if (existing && state.resume) {
        setSession(existing);
        setCurrentIdx(existing.currentQuestionIndex);
      } else {
        // Fetch completed submissions for this student to determine attempt number
        const newSession = createSession(found, state.studentName, state.nis, attemptNumber ?? 1);
        setSession(newSession);
        setCurrentIdx(0);
      }
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLoadError(`Gagal memuat ujian: ${msg}`);
    });
  }, []);

  const handleSubmit = useCallback(async (_autoSubmit = false) => {
    if (submitRef.current || !session || !exam) return;
    submitRef.current = true;

    const latestLookup = code ? await storage.getStudentExamByCode(code, session.studentName, session.nis) : { exam: null };
    const latestExam = latestLookup.exam;
    const isUnavailable = latestLookup.error?.type === 'NETWORK_ERROR' || latestLookup.error?.type === 'BACKEND_UNAVAILABLE';
    if (!latestExam && isUnavailable) {
      const sub = { ...buildSubmission(session, exam), antiCheatEvents: antiCheatEventsRef.current };
      setSubmittedData(sub);
      const saveResult = await storage.saveSubmission(sub);
      submitRef.current = false;
      setShowSubmit(false);
      if (saveResult.queued) setSubmitPending(true);
      else setLoadError('Jawaban belum dapat disimpan. Silakan coba lagi.');
      return;
    }
    if (!latestExam || latestExam.id !== exam.id || latestExam.status !== 'ACTIVE') {
      submitRef.current = false;
      setLoadError(latestLookup.error?.type === 'PERMISSION_ERROR' ? 'Ujian tidak dapat diakses.' : 'Ujian sudah ditutup.');
      return;
    }

    const now = Date.now();
    if (latestExam.activeFrom && new Date(latestExam.activeFrom).getTime() > now) {
      submitRef.current = false;
      setLoadError('Ujian belum dibuka. Jawaban tidak dapat dikumpulkan.');
      return;
    }
    if (latestExam.activeTo && new Date(latestExam.activeTo).getTime() < now) {
      submitRef.current = false;
      setLoadError('Deadline ujian sudah lewat. Jawaban tidak dapat dikumpulkan.');
      return;
    }

    const sub = { ...buildSubmission(session, latestExam), antiCheatEvents: antiCheatEventsRef.current };
    setSubmittedData(sub);

    // Jangan clear session sampai server mengonfirmasi submission final tersimpan.
    const saveResult = await storage.saveSubmission(sub);
    if (saveResult.saved) {
      clearSession(session.examCode, session.nis);
    } else {
      submitRef.current = false;
      setShowSubmit(false);
      setSubmitPending(true);
      return;
    }

    setSubmitted(true);
    setShowSubmit(false);
  }, [session, exam, code]);

  // Server-side autosave draft. LocalStorage remains for instant resume on the
  // same device, while Supabase keeps a recoverable draft copy of answers.
  useEffect(() => {
    if (!session || !exam || submitted || session.answers.length === 0) return;
    const id = setInterval(() => {
      void storage.saveSubmission({ ...buildDraftSubmission(session, exam), antiCheatEvents: antiCheatEventsRef.current });
    }, 5000);
    return () => clearInterval(id);
  }, [session, exam, submitted]);

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
            setTimeout(() => handleSubmit(true), 3000);
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
  const initialWholeSeconds = session?.remainingSeconds ?? (exam?.settings.wholExamTimerSeconds ?? 3600);

  const wholeTimer = useCountdown({
    initialSeconds: initialWholeSeconds,
    autoStart: wholeTimerEnabled && !!session && !submitted,
    onExpire: useCallback(() => handleSubmit(true), [handleSubmit]),
  });

  // Persist remaining time every 5 seconds
  useEffect(() => {
    if (!wholeTimerEnabled || !session) return;
    const id = setInterval(() => {
      if (session) setSession(s => s ? updateTimer(s, wholeTimer.remaining) : s);
    }, 5000);
    return () => clearInterval(id);
  }, [wholeTimerEnabled, wholeTimer.remaining, session]);

  // Stop whole timer on submit
  useEffect(() => {
    if (submitted) wholeTimer.stop();
  }, [submitted]);

  // ---- Per-question timer ----
  const perQEnabled = exam?.settings.timerMode === 'PER_QUESTION';
  const currentQ = questions[currentIdx];
  const perQSeconds = currentQ?.timerSeconds ?? exam?.settings.perQuestionDefaultSeconds ?? 60;

  // Fix #3: Track waktu tersisa per soal agar tidak reset saat back-and-forth
  const perQRemainingRef = useRef<Record<number, number>>({});

  const goNext = useCallback(() => {
    const next = Math.min(currentIdx + 1, questions.length - 1);
    setCurrentIdx(next);
    setSession(s => s ? updateCurrentIndex(s, next) : s);
  }, [currentIdx, questions.length]);

  const perQTimer = useCountdown({
    initialSeconds: perQRemainingRef.current[currentIdx] ?? perQSeconds,
    autoStart: perQEnabled && !!session && !submitted,
    onExpire: useCallback(() => {
      if (currentIdx < questions.length - 1) goNext();
      else handleSubmit(true);
    }, [currentIdx, questions.length, goNext, handleSubmit]),
  });
  const perQProgressPct = perQEnabled && perQSeconds > 0
    ? Math.max(0, Math.min(100, Math.round((perQTimer.remaining / perQSeconds) * 100)))
    : undefined;

  // Simpan sisa waktu soal saat pindah, lalu reset timer ke sisa waktu soal tujuan
  useEffect(() => {
    if (!perQEnabled) return;
    // Simpan remaining soal sebelumnya (via ref, bukan state, agar tidak trigger re-render)
    return () => {
      perQRemainingRef.current[currentIdx] = perQTimer.remaining;
    };
  }, [currentIdx, perQEnabled]);

  useEffect(() => {
    if (perQEnabled) {
      const saved = perQRemainingRef.current[currentIdx];
      const target = saved !== undefined ? saved : (questions[currentIdx]?.timerSeconds ?? exam?.settings.perQuestionDefaultSeconds ?? 60);
      perQTimer.reset(target);
    }
  }, [currentIdx]);

  // ---- Answer handler (autosave) ----
  const handleAnswer = useCallback((answer: StudentAnswer) => {
    setSession(prev => {
      if (!prev) return prev;
      return upsertAnswer(prev, answer);
    });
  }, []);

  // ---- Navigation ----
  const goTo = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setSession(s => s ? updateCurrentIndex(s, idx) : s);
    if (perQEnabled && questions[idx]?.timerSeconds) {
      perQTimer.reset(questions[idx].timerSeconds!);
    }
  }, [perQEnabled, questions]);

  const goPrev = () => goTo(Math.max(currentIdx - 1, 0));
  const goNextBtn = () => goTo(Math.min(currentIdx + 1, questions.length - 1));

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
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <p style={{ color: 'var(--danger)' }}>{error}</p>
        <button className="btn btn-secondary" onClick={() => navigate('/ujian')}>Kembali</button>
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
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Jawaban Anda sudah tersimpan aman di perangkat. Sambungkan internet untuk mengirim jawaban ke server.</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setSubmitPending(false); void handleSubmit(false); }}>Coba Kirim Sekarang</button>
        </div>
      </div>
    );
  }

  const answeredIds = new Set(session.answers.map(a => a.questionId));

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
      />

      {/* Anti-cheat warning banner */}
      {showViolationWarning && (
        <div style={{ background: 'var(--danger)', color: 'white', padding: '10px var(--sp-6)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, animation: 'fadeIn 0.2s ease' }}>
          Tetap di halaman ujian. Perpindahan aplikasi/tab tercatat ({violations}/{exam.settings.antiCheatSensitivity === 'HIGH' ? 1 : exam.settings.antiCheatSensitivity === 'LOW' ? 5 : 3}).
        </div>
      )}

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
              perQRemaining={perQEnabled ? perQTimer.remaining : undefined}
              perQUrgency={perQTimer.urgency}
            />

            {/* Navigation buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-6)', gap: 'var(--sp-3)' }}>
              <button className="btn btn-secondary" onClick={goPrev} disabled={currentIdx === 0}>
                ← Sebelumnya
              </button>
              {currentIdx < questions.length - 1 ? (
                <button className="btn btn-primary" onClick={goNextBtn}>
                  Berikutnya →
                </button>
              ) : (
                <button className="btn btn-secondary" onClick={() => setShowSubmit(true)}>
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
          onGoTo={goTo}
          onReview={() => setShowSubmit(true)}
        />
      </div>

      {/* Submit confirmation dialog */}
      <SubmitDialog
        open={showSubmit}
        questions={questions}
        answeredIds={answeredIds}
        onConfirm={() => handleSubmit(false)}
        onCancel={() => setShowSubmit(false)}
      />
    </div>
  );
}
