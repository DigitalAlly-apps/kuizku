// ExamHeader — sticky top bar with timer, progress, and submit button
import { Clock, Send } from 'lucide-react';
import { formatTimer } from '../../../utils/helpers';
import type { TimerMode } from '../../../types';

interface Props {
  examTitle: string;
  studentName: string;
  currentIdx: number;
  total: number;
  answeredCount: number;
  timerMode: TimerMode;
  wholeRemaining?: number;
  wholeUrgency?: string;
  perQRemaining?: number;
  perQUrgency?: string;
  onSubmitClick: () => void;
}

export default function ExamHeader({
  examTitle, studentName, currentIdx, total, answeredCount,
  timerMode, wholeRemaining, wholeUrgency, perQRemaining, perQUrgency,
  onSubmitClick,
}: Props) {
  const urgencyColor = (u?: string) =>
    u === 'critical' ? 'var(--danger)' : u === 'warning' ? 'var(--warning)' : 'var(--text-primary)';

  const progressPct = Math.round((answeredCount / total) * 100);

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(12,14,26,0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Main bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
        padding: '0 var(--sp-6)', height: 60,
      }}>
        {/* Title + student */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {examTitle}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{studentName}</div>
        </div>

        {/* Whole-exam timer */}
        {timerMode === 'WHOLE_EXAM' && wholeRemaining !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 14px',
            background: wholeUrgency === 'critical' ? 'var(--danger-light)' : 'var(--surface-2)',
            border: `1px solid ${wholeUrgency === 'critical' ? 'rgba(239,68,68,0.3)' : 'var(--border-strong)'}`,
            borderRadius: 'var(--r-full)',
            animation: wholeUrgency === 'critical' ? 'pulse 1s infinite' : 'none',
          }}>
            <Clock size={14} style={{ color: urgencyColor(wholeUrgency) }} />
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem',
              color: urgencyColor(wholeUrgency),
            }}>
              {formatTimer(wholeRemaining)}
            </span>
          </div>
        )}

        {/* Question counter */}
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{currentIdx + 1}</span>
          <span> / {total}</span>
        </div>

        {/* Submit button */}
        <button className="btn btn-success btn-sm" onClick={onSubmitClick}
          style={{ gap: 6, flexShrink: 0 }}>
          <Send size={14} /> Kumpulkan
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--surface-2)' }}>
        <div style={{
          height: '100%',
          width: `${progressPct}%`,
          background: 'linear-gradient(90deg, var(--primary), var(--accent))',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Per-question timer bar */}
      {timerMode === 'PER_QUESTION' && perQRemaining !== undefined && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px var(--sp-6)',
          background: perQUrgency === 'critical' ? 'rgba(239,68,68,0.08)' : 'transparent',
          borderBottom: '1px solid var(--border)',
          fontSize: '0.78rem',
        }}>
          <Clock size={12} style={{ color: urgencyColor(perQUrgency) }} />
          <span style={{ color: urgencyColor(perQUrgency), fontWeight: 600 }}>
            Waktu soal ini: {formatTimer(perQRemaining)}
          </span>
          <div style={{ flex: 1, height: 4, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: urgencyColor(perQUrgency),
              borderRadius: 'var(--r-full)',
              transition: 'width 1s linear',
            }} />
          </div>
        </div>
      )}

      {/* Answered progress text */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px var(--sp-6)',
        fontSize: '0.72rem', color: 'var(--text-muted)',
        borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ color: 'var(--success)', fontWeight: 600 }}>{answeredCount}</span>
        <span>dari {total} soal dijawab</span>
        {answeredCount < total && (
          <span style={{ color: 'var(--warning)' }}>• {total - answeredCount} belum dijawab</span>
        )}
      </div>
    </header>
  );
}
