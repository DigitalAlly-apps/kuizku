// ============================================================
// ExamTakingPage — Core student exam experience
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { storage } from '../../utils/storage';
import {
  loadSession, upsertAnswer, updateTimer,
  updateCurrentIndex, buildSubmission, createSession,
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
  const [submittedData, setSubmittedData] = useState<ReturnType<typeof buildSubmission> | null>(null);
  const [error] = useState('');
  const submitRef = useRef(false);

  // ---- Bootstrap — query Supabase langsung, tidak butuh auth guru ----
  useEffect(() => {
    if (!state?.examId || !code) { navigate('/ujian'); return; }

    storage.getExamByCode(code).then(async found => {
      if (!found || found.id !== state.examId) { navigate('/ujian'); return; }

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
        const subs = await storage.getSubmissionsByExam(found.id);
        const prevComplete = subs.filter(s => s.nis === state.nis && s.isComplete).length;
        const newSession = createSession(found, state.studentName, state.nis, prevComplete + 1);
        setSession(newSession);
        setCurrentIdx(0);
      }
    });
  }, []);

  // ---- Submit logic ----
  const handleSubmit = useCallback((_autoSubmit = false) => {
    if (submitRef.current || !session || !exam) return;
    submitRef.current = true;

    const sub = buildSubmission(session, exam);
    setSubmittedData(sub);

    // Persist to Supabase
    storage.saveSubmission(sub);

    setSubmitted(true);
    setShowSubmit(false);
  }, [session, exam]);

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
  const perQSeconds = currentQ?.timerSeconds ?? 60;

  const goNext = useCallback(() => {
    const next = Math.min(currentIdx + 1, questions.length - 1);
    setCurrentIdx(next);
    setSession(s => s ? updateCurrentIndex(s, next) : s);
  }, [currentIdx, questions.length]);

  const perQTimer = useCountdown({
    initialSeconds: perQSeconds,
    autoStart: perQEnabled && !!session && !submitted,
    onExpire: useCallback(() => {
      if (currentIdx < questions.length - 1) goNext();
      else handleSubmit(true);
    }, [currentIdx, questions.length, goNext, handleSubmit]),
  });

  // Reset per-Q timer when question changes
  useEffect(() => {
    if (perQEnabled && currentQ?.timerSeconds) {
      perQTimer.reset(currentQ.timerSeconds);
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

  const answeredIds = new Set(session.answers.map(a => a.questionId));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
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
        onSubmitClick={() => setShowSubmit(true)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Main question area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--sp-6)' }}>
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
                <button className="btn btn-success" onClick={() => setShowSubmit(true)}>
                  ✓ Kumpulkan Jawaban
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
          onSubmit={() => setShowSubmit(true)}
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
