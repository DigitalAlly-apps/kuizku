// Preview Ujian — tampilkan ujian seperti yang dilihat murid (read-only)
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Eye } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PageLoader } from '../../components/ui';
import type { Question } from '../../types';

const OPTION_LETTERS = 'ABCDEF';

export default function PreviewExamPage() {
  const { id } = useParams<{ id: string }>();
  const { exams } = useApp();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  const exam = exams.find(e => e.id === id);

  useEffect(() => {
    if (!exam && exams.length > 0) navigate('/guru/ujian');
    else if (exam) setReady(true);
  }, [exam, exams]);

  if (!ready || !exam) return <PageLoader />;

  return (
    <div className="page-content" style={{ maxWidth: 720 }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/guru/ujian')}>
          <ArrowLeft size={18} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={20} style={{ color: 'var(--primary)' }} /> Preview — {exam.title}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Tampilan ini mirip dengan yang dilihat murid saat mengerjakan.</p>
        </div>
      </div>

      {/* Exam info card */}
      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap', fontSize: '0.85rem' }}>
          <div><strong>Mapel:</strong> {exam.subject}</div>
          {exam.className && <div><strong>Kelas:</strong> {exam.className}</div>}
          <div><strong>Soal:</strong> {exam.questions.length}</div>
          <div><strong>Timer:</strong> {exam.settings.timerMode === 'NONE' ? 'Tanpa timer' : exam.settings.timerMode === 'WHOLE_EXAM' ? `${Math.round((exam.settings.wholExamTimerSeconds ?? 3600) / 60)} menit` : 'Per soal'}</div>
          <div><strong>Kode:</strong> <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>{exam.code}</span></div>
        </div>
        {exam.description && <p style={{ marginTop: 'var(--sp-3)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{exam.description}</p>}
      </div>

      {/* Questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {exam.questions.map((q, idx) => (
          <QuestionPreview key={q.id} question={q} number={idx + 1} />
        ))}
      </div>

      {exam.questions.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-muted)' }}>
          Ujian ini belum memiliki soal.
        </div>
      )}

      <div style={{ marginTop: 'var(--sp-6)', display: 'flex', gap: 'var(--sp-3)' }}>
        <button className="btn btn-secondary" onClick={() => navigate('/guru/ujian')}>← Kembali ke Daftar</button>
        <button className="btn btn-primary" onClick={() => navigate(`/guru/ujian/${exam.id}/edit-soal`)}>Edit Soal</button>
      </div>
    </div>
  );
}

function QuestionPreview({ question, number }: { question: Question; number: number }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${question.type === 'ESSAY' ? 'var(--secondary)' : 'var(--primary)'}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--sp-3)' }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '0.78rem', color: 'white', flexShrink: 0,
        }}>
          {number}
        </div>
        <span className={`badge ${question.type === 'ESSAY' ? 'badge-essay' : 'badge-pg'}`}>
          {question.type === 'MULTIPLE_CHOICE' ? 'PG' : question.type === 'SHORT_ANSWER' ? 'Short' : 'Essay'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{question.weight} poin</span>
      </div>

      <p style={{ fontSize: '0.95rem', lineHeight: 1.7, marginBottom: 'var(--sp-3)' }}>{question.text}</p>

      {question.type === 'MULTIPLE_CHOICE' && question.options && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          {question.options.map((opt, i) => (
            <div key={opt.id} style={{
              padding: '8px 12px', borderRadius: 'var(--r-md)', fontSize: '0.85rem',
              background: opt.id === question.correctOptionId ? 'var(--success-light)' : 'var(--surface-2)',
              border: `1px solid ${opt.id === question.correctOptionId ? 'var(--success)' : 'var(--border)'}`,
              color: opt.id === question.correctOptionId ? 'var(--success)' : 'var(--text-secondary)',
              fontWeight: opt.id === question.correctOptionId ? 600 : 400,
            }}>
              {OPTION_LETTERS[i]}. {opt.text}
              {opt.id === question.correctOptionId && ' ✓'}
            </div>
          ))}
        </div>
      )}

      {question.type === 'ESSAY' && question.answerGuide && (
        <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
          <strong>Panduan jawaban:</strong> {question.answerGuide}
        </div>
      )}
      {question.type === 'SHORT_ANSWER' && (
        <div style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 'var(--sp-2)' }}>
          <strong>Jawaban diterima:</strong> {(question.acceptedAnswers ?? []).join(', ')}
        </div>
      )}

      {question.tags.length > 0 && (
        <div style={{ marginTop: 'var(--sp-2)', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {question.tags.map(t => <span key={t} className="tag">{t}</span>)}
        </div>
      )}
    </div>
  );
}
