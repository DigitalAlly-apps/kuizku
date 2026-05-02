// Step 4 — Review & Reorder
import { useState } from 'react';
import { GripVertical, AlertCircle } from 'lucide-react';
import { FormatBadge } from '../../../components/ui';
import { formatTimerMode } from '../../../utils/helpers';
import type { Question, ExamFormat, ExamSettings } from '../../../types';

interface Props {
  data: { title: string; subject: string; format: ExamFormat; settings: ExamSettings; questions: Question[] };
  onNext: (questions: Question[]) => void;
  onBack: () => void;
}

const optLetters = 'ABCDEF';

export default function Step4Review({ data, onNext, onBack }: Props) {
  const [questions, setQuestions] = useState<Question[]>(data.questions);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const totalPts = questions.reduce((s, q) => s + q.weight, 0);
  const pgCount = questions.filter(q => q.type === 'MULTIPLE_CHOICE').length;
  const essayCount = questions.filter(q => q.type === 'ESSAY').length;

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newQ = [...questions];
    const [moved] = newQ.splice(dragIdx, 1);
    newQ.splice(idx, 0, moved);
    setQuestions(newQ.map((q, i) => ({ ...q, order: i + 1 })));
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--sp-2)' }}>Review & Urutkan</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>Periksa soal dan urutkan dengan drag-and-drop.</p>

      {/* Summary */}
      <div className="review-summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {[
          { label: 'Judul', value: data.title },
          { label: 'Mata Pelajaran', value: data.subject },
          { label: 'Format', value: null, badge: <FormatBadge format={data.format} /> },
          { label: 'Total Soal', value: `${questions.length} soal` },
          { label: 'Total Poin', value: `${totalPts} poin` },
          { label: 'Timer', value: formatTimerMode(data.settings.timerMode) },
          ...(data.format !== 'ESSAY_ONLY' ? [{ label: 'Soal PG', value: `${pgCount} soal (otomatis)` }] : []),
          ...(data.format !== 'PG_ONLY' ? [{ label: 'Soal Essay', value: `${essayCount} soal (manual)` }] : []),
        ].map((item, i) => (
          <div key={i} style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{item.label}</div>
            {item.badge ?? <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{item.value}</div>}
          </div>
        ))}
      </div>

      {/* Question list */}
      <div style={{ marginBottom: 'var(--sp-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <GripVertical size={14} style={{ color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Drag soal untuk mengubah urutan</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
        {questions.map((q, idx) => (
          <div key={q.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className="question-item"
            style={{ opacity: dragIdx === idx ? 0.5 : 1, cursor: 'grab', userSelect: 'none' }}>
            <div className="question-item-drag"><GripVertical size={16} /></div>
            <div className="question-item-num">{idx + 1}</div>
            <div className="question-item-body">
              <div className="question-item-text">{q.text}</div>
              {q.type === 'MULTIPLE_CHOICE' && q.options && (
                <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {q.options.map((opt, i) => (
                    <span key={opt.id} style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-full)', background: opt.id === q.correctOptionId ? 'var(--success-light)' : 'var(--surface-2)', color: opt.id === q.correctOptionId ? 'var(--success)' : 'var(--text-muted)', border: `1px solid ${opt.id === q.correctOptionId ? 'var(--success)' : 'var(--border)'}`, fontWeight: opt.id === q.correctOptionId ? 700 : 400 }}>
                      {optLetters[i]}. {opt.text.length > 20 ? opt.text.slice(0, 20) + '…' : opt.text}
                    </span>
                  ))}
                </div>
              )}
              <div className="question-item-meta">
                <span className={`badge ${q.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`} style={{ fontSize: '0.68rem' }}>
                  {q.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{q.weight} poin</span>
                {q.tags.length > 0 && q.tags.slice(0, 2).map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {questions.length === 0 && (
        <div style={{ padding: 'var(--sp-6)', textAlign: 'center', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <AlertCircle size={16} /> Tidak ada soal. Kembali dan tambahkan soal.
        </div>
      )}

      <div className="wizard-nav-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-8)', paddingTop: 'var(--sp-6)', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Kembali</button>
        <button className="btn btn-success btn-lg" onClick={() => onNext(questions)} disabled={questions.length === 0}>
          ✓ Simpan & Publikasikan
        </button>
      </div>
    </div>
  );
}
