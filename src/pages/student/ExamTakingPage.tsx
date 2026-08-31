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
  const [timeExpired, setTimeExpired] = useState(false);
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
      const existing = loadSession(code, state.participantId);
      if (existing && state.resume) {
        setSession(existing);
        setCurrentIdx(existing.currentQuestionIndex);
      } else {
        // Attempt number berasal dari submission COMPLETE di server. Draft/autosave tidak memakan jatah.
        const newSession = createSession(found, state.studentName, state.participantId, attemptNumber ?? 1);
        setSession(newSession);
        setCurrentIdx(0);
      }
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setLoadError(`Gagal memuat ujian: ${msg}`);
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submitRef.current || !session || !exam) return;
    submitRef.current = true;

    // Final submit langsung menuju RPC save_student_submission.
    // RPC adalah sumber kebenaran dan sudah memvalidasi status ujian, jadwal,
    // daftar peserta, ownership submission, serta batas percobaan secara atomik.
    // Menghindari lookup kedua di sini mencegah final submit kandas karena
    // request validasi terpisah gagal sesaat sebelum jawaban dikirim.
    const sub = { ...buildSubmission(session, exam), antiCheatEvents: antiCheatEventsRef.current };
    const saveResult = await storage.saveSubmission(sub);

    if (saveResult.saved) {
      // Session baru dihapus setelah server mengonfirmasi submission COMPLETE.
      clearSession(session.examCode, session.participantId);
      setSubmittedData({ ...sub, mcScore: saveResult.mcScore ?? sub.mcScore, totalScore: saveResult.totalScore });
      setSubmitted(true);
      setSubmitPending(false);
      setShowSubmit(false);
      return;
    }

    submitRef.current = false;
    setShowSubmit(false);
    setSubmittedData(sub);
    if (saveResult.queued) {
      // Jika koneksi putus, submission final tetap berada di queue lokal dan
      // memakai ID yang sama. Retry aman/idempotent dan tidak menambah attempt.
      setSubmitPending(true);
    } else {
      setLoadError(saveResult.error ?? 'Jawaban belum dapat disimpan. Silakan coba lagi.');
    }
  }, [session, exam]);

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
  const perQRemainingRef = useRef<Record<number, number>>({});

  const goNext = useCallback(() => {
    const next = Math.min(currentIdx + 1, questions.length - 1);
    setCurrentIdx(next);
    setSession(s => s ? updateCurrentIndex(s, next, true) : s);
  }, [currentIdx, questions.length]);

  const perQTimer = useCountdown({
    initialSeconds: perQRemainingRef.current[currentIdx] ?? perQSeconds,
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

  // Simpan sisa waktu soal saat pindah, lalu reset timer ke sisa waktu soal tujuan
  useEffect(() => {
    if (!perQEnabled) return;
    // Simpan remaining soal sebelumnya (via ref, bukan state, agar tidak trigger re-render)
    return () => {
      perQRemainingRef.current[currentIdx] = perQCurrentRemainingRef.current;
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
    if (timeExpired) return;
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
    if (perQEnabled && questions[idx]?.timerSeconds) {
      perQTimer.reset(questions[idx].timerSeconds!);
    }
  }, [perQEnabled, questions, sequential, maxAvailableIdx]);

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
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{studentSubmissionMessages.offline}</p>
          <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => { setSubmitPending(false); void handleSubmit(); }}>Coba Kirim Sekarang</button>
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
              perQRemaining={perQEnabled ? perQTimer.remaining : undefined}
              perQUrgency={perQTimer.urgency}
            />

            {/* Navigation buttons */}
            <div className="exam-inline-navigation" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-6)', gap: 'var(--sp-3)' }}>
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
          maxAvailableIdx={maxAvailableIdx}
          onGoTo={goTo}
          onReview={() => setShowSubmit(true)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
        />
      </div>

      <div className="exam-mobile-navigation">
        <button type="button" className="btn btn-secondary" onClick={goPrev} disabled={currentIdx === 0}>
          ← Sebelumnya
        </button>
        {currentIdx < questions.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={goNextBtn}>
            Berikutnya →
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setShowSubmit(true)}>
            Periksa Jawaban →
          </button>
        )}
      </div>

      {/* Submit confirmation dialog */}
      <SubmitDialog
        open={showSubmit}
        questions={questions}
        answeredIds={answeredIds}
        onConfirm={() => handleSubmit()}
        onCancel={() => { if (!timeExpired) setShowSubmit(false); }}
      />
    </div>
  );
}
