// QuestionNav — sidebar desktop and bottom sheet mobile
import { useEffect } from 'react';
import { Lock, X } from 'lucide-react';
import type { Question } from '../../../types';

interface Props {
  questions: Question[];
  currentIdx: number;
  answeredIds: Set<string>;
  maxAvailableIdx?: number;
  onGoTo: (idx: number) => void;
  onReview: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function QuestionGrid({ questions, currentIdx, answeredIds, maxAvailableIdx = questions.length - 1, onGoTo, onPick }: {
  questions: Question[]; currentIdx: number; answeredIds: Set<string>;
  maxAvailableIdx?: number;
  onGoTo: (idx: number) => void; onPick?: () => void;
}) {
  return <div className="question-nav-grid">
    {questions.map((q, idx) => {
      const isAnswered = answeredIds.has(q.id);
      const isCurrent = idx === currentIdx;
      const isLocked = idx > maxAvailableIdx;
      return <button key={q.id} type="button" disabled={isLocked} onClick={() => { onGoTo(idx); onPick?.(); }}
        title={`Soal ${idx + 1}${isLocked ? ' (terkunci)' : isAnswered ? ' (sudah dijawab)' : ' (belum dijawab)'}`}
        aria-label={`Soal ${idx + 1}, ${isLocked ? 'terkunci' : isCurrent ? 'sedang dibuka' : isAnswered ? 'sudah dijawab' : 'belum dijawab'}`}
        className={`question-nav-number ${isCurrent ? 'is-current' : ''} ${isAnswered ? 'is-answered' : ''} ${isLocked ? 'is-locked' : ''}`}>
        <span>{idx + 1}</span>
        {isLocked && <Lock aria-hidden="true" className="question-nav-lock" size={12} />}
        {isAnswered && <span aria-hidden="true" className="question-nav-check">✓</span>}
        {isCurrent && <span aria-hidden="true" className="question-nav-current-dot" />}
      </button>;
    })}
  </div>;
}

function QuestionNavContent({ questions, currentIdx, answeredIds, maxAvailableIdx, onGoTo, onPick, onReview }: Props & { onPick?: () => void }) {
  const answered = answeredIds.size;
  const unanswered = questions.length - answered;
  return <>
    <div className="question-nav-heading">Navigasi Soal</div>
    <div className="question-nav-legend">
      <span><i className="legend-dot answered" /> Dijawab</span>
      <span><i className="legend-dot unanswered" /> Belum</span>
      <span><i className="legend-dot current" /> Aktif</span>
    </div>
    {maxAvailableIdx != null && maxAvailableIdx < questions.length - 1 && <p className="form-hint" style={{ margin: '0 0 var(--sp-3)' }}>Ujian ini menggunakan navigasi berurutan.</p>}
    <QuestionGrid questions={questions} currentIdx={currentIdx} answeredIds={answeredIds} maxAvailableIdx={maxAvailableIdx} onGoTo={onGoTo} onPick={onPick} />
    <div className="question-nav-summary">
      <div><span>Dijawab</span><strong className="answered-text">{answered}</strong></div>
      <div><span>Belum</span><strong className={unanswered > 0 ? 'unanswered-text' : 'answered-text'}>{unanswered}</strong></div>
    </div>
    {currentIdx === questions.length - 1 && <button type="button" className="btn btn-secondary btn-sm question-nav-submit" onClick={onReview}>
      Selesai &amp; Periksa Jawaban
    </button>}
  </>;
}

export default function QuestionNav(props: Props) {
  const { mobileOpen, onCloseMobile } = props;

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseMobile(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return <>
    <aside className="question-nav-panel"><QuestionNavContent {...props} /></aside>
    {mobileOpen && <div className="question-nav-mobile-overlay" role="presentation"
      onClick={event => { if (event.target === event.currentTarget) onCloseMobile(); }}>
      <section className="question-nav-mobile-sheet" role="dialog" aria-modal="true" aria-label="Daftar soal">
        <div className="question-nav-mobile-header">
          <div><strong>Daftar Soal</strong><span>Pilih soal yang ingin dibuka</span></div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onCloseMobile} aria-label="Tutup daftar soal"><X size={20} /></button>
        </div>
        <QuestionNavContent {...props} onPick={onCloseMobile} />
      </section>
    </div>}
  </>;
}
