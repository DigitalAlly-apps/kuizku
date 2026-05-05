// QuestionNav — sidebar panel of numbered question buttons
import type { Question } from '../../../types';

interface Props {
  questions: Question[];
  currentIdx: number;
  answeredIds: Set<string>;
  onGoTo: (idx: number) => void;
  onSubmit: () => void;
}

export default function QuestionNav({ questions, currentIdx, answeredIds, onGoTo, onSubmit }: Props) {
  const answered = answeredIds.size;
  const unanswered = questions.length - answered;

  return (
    <aside className="question-nav-panel" style={{
      width: 220, flexShrink: 0,
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: 'var(--sp-4)',
      overflowY: 'auto',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--sp-3)' }}>
        Navigasi Soal
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
          Dijawab
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--border-strong)', display: 'inline-block' }} />
          Belum
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
          Aktif
        </span>
      </div>

      {/* Number grid */}
      <div className="question-nav-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
        {questions.map((q, idx) => {
          const isAnswered = answeredIds.has(q.id);
          const isCurrent = idx === currentIdx;
          return (
              <button
                key={q.id}
                onClick={() => onGoTo(idx)}
                title={`Soal ${idx + 1}${isAnswered ? ' (sudah dijawab)' : ' (belum dijawab)'}`}
                aria-label={`Soal ${idx + 1}, ${isCurrent ? 'sedang dibuka' : isAnswered ? 'sudah dijawab' : 'belum dijawab'}`}
                style={{
                  position: 'relative',
                  width: '100%', aspectRatio: '1',
                  borderRadius: 'var(--r-sm)',
                  border: `2px solid ${isCurrent ? 'var(--primary)' : isAnswered ? 'var(--success)' : 'var(--border-strong)'}`,
                background: isCurrent ? 'var(--primary)' : isAnswered ? 'var(--success-light)' : 'var(--surface-2)',
                color: isCurrent ? 'white' : isAnswered ? 'var(--success)' : 'var(--text-muted)',
                fontWeight: isCurrent || isAnswered ? 700 : 400,
                fontSize: '0.8rem',
                cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isCurrent ? '0 0 0 2px var(--primary-light)' : 'none',
                }}
              >
                <span>{idx + 1}</span>
                {isAnswered && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', right: 2, bottom: 1,
                    fontSize: '0.58rem', lineHeight: 1, fontWeight: 900,
                    color: isCurrent ? 'white' : 'var(--success)',
                  }}>✓</span>
                )}
                {isCurrent && (
                  <span aria-hidden="true" style={{
                    position: 'absolute', left: 3, top: 3,
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'currentColor', opacity: 0.9,
                  }} />
                )}
              </button>
            );
          })}
      </div>

      {/* Summary */}
      <div style={{ padding: 'var(--sp-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-4)', fontSize: '0.78rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
          <span style={{ color: 'var(--text-muted)' }}>Dijawab</span>
          <span style={{ color: 'var(--success)', fontWeight: 700 }}>{answered}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)' }}>Belum</span>
          <span style={{ color: unanswered > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>{unanswered}</span>
        </div>
      </div>

      {/* Submit button */}
      <button className="btn btn-success btn-sm w-full question-nav-submit" style={{ justifyContent: 'center', marginTop: 'auto' }} onClick={onSubmit}>
        ✓ Kumpulkan
      </button>
    </aside>
  );
}
