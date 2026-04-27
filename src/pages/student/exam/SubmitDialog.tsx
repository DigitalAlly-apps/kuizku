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

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel()}>
      <div className="modal-box" style={{ maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
          {allAnswered
            ? <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-3)' }} />
            : <AlertTriangle size={48} style={{ color: 'var(--warning)', margin: '0 auto var(--sp-3)' }} />
          }
          <h2 style={{ marginBottom: 8 }}>
            {allAnswered ? 'Semua soal sudah dijawab!' : 'Ada soal yang belum dijawab'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {allAnswered
              ? 'Pastikan Anda sudah yakin dengan semua jawaban sebelum mengumpulkan.'
              : `${unanswered.length} soal belum Anda jawab. Jawaban kosong tidak mendapat poin.`
            }
          </p>
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
              Soal yang belum dijawab:
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
          display: 'flex', justifyContent: 'space-between',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
          marginBottom: 'var(--sp-5)', fontSize: '0.875rem',
        }}>
          <span style={{ color: 'var(--text-muted)' }}>Total soal dijawab:</span>
          <span style={{ fontWeight: 700 }}>
            <span style={{ color: 'var(--success)' }}>{answeredIds.size}</span>
            <span style={{ color: 'var(--text-muted)' }}> / {questions.length}</span>
          </span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
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
