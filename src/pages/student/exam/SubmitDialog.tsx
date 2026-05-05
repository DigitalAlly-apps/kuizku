// SubmitDialog — confirmation modal before submitting
import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { Question } from '../../../types';

interface Props {
  open: boolean;
  questions: Question[];
  answeredIds: Set<string>;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function SubmitDialog({ open, questions, answeredIds, onConfirm, onCancel }: Props) {
  if (!open) return null;

  const unanswered = questions.filter(q => !answeredIds.has(q.id));
  const allAnswered = unanswered.length === 0;
  const answeredPct = Math.round((answeredIds.size / questions.length) * 100);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box submit-dialog-box" style={{ maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          {allAnswered
            ? <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-3)' }} />
            : <AlertTriangle size={48} style={{ color: 'var(--warning)', margin: '0 auto var(--sp-3)' }} />
          }
          <h2 style={{ marginBottom: 8 }}>
            {allAnswered ? 'Siap dikumpulkan?' : 'Periksa lagi sebelum kumpulkan'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {allAnswered
              ? 'Semua soal sudah terisi. Setelah dikumpulkan, jawaban tidak bisa diubah.'
              : `${unanswered.length} soal masih kosong. Anda tetap bisa mengumpulkan, tetapi jawaban kosong tidak mendapat poin.`
            }
          </p>
        </div>

        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.8rem', fontWeight: 700 }}>
            <span style={{ color: 'var(--text-muted)' }}>Progres jawaban</span>
            <span style={{ color: allAnswered ? 'var(--success)' : 'var(--warning)' }}>{answeredPct}%</span>
          </div>
          <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${answeredPct}%`,
              background: allAnswered ? 'var(--success)' : 'linear-gradient(90deg, var(--warning), var(--primary))',
              borderRadius: 'var(--r-full)', transition: 'width 0.25s ease',
            }} />
          </div>
        </div>

        {/* Unanswered list */}
        {!allAnswered && (
          <div style={{
            maxHeight: 160, overflowY: 'auto',
            background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
            padding: 'var(--sp-3) var(--sp-4)', marginBottom: 'var(--sp-5)',
            border: '1px solid var(--border)',
          }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
              Soal kosong:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {questions.map((q, idx) => !answeredIds.has(q.id) && (
                <span key={q.id} style={{
                  padding: '2px 10px', borderRadius: 'var(--r-full)',
                  background: 'var(--warning-light)', color: 'var(--warning)',
                  fontSize: '0.78rem', fontWeight: 700,
                  border: '1px solid rgba(245,158,11,0.3)',
                }}>
                  Soal {idx + 1}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
          marginBottom: 'var(--sp-5)', fontSize: '0.875rem',
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Dijawab</div>
            <div style={{ color: 'var(--success)', fontWeight: 800 }}>{answeredIds.size} soal</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Kosong</div>
            <div style={{ color: allAnswered ? 'var(--success)' : 'var(--warning)', fontWeight: 800 }}>{unanswered.length} soal</div>
          </div>
        </div>

        <div className="submit-dialog-actions" style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>
            Kembali Periksa
          </button>
          <button className="btn btn-success" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm}>
            ✓ Kumpulkan Sekarang
          </button>
        </div>
      </div>
    </div>
  );
}
