import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Clock, FileText, BookOpen, AlertTriangle, Play, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatExamFormat } from '../../utils/helpers';
import { createSession } from '../../utils/examSession';
import type { Exam } from '../../types';

interface LocationState {
  examId: string;
  studentName: string;
  nis: string;
  attemptNumber: number;
}

export default function InstructionsPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { exams } = useApp();

  const state = location.state as LocationState | null;
  const [exam, setExam] = useState<Exam | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!state?.examId) { navigate('/ujian'); return; }
    const found = exams.find(e => e.id === state.examId);
    if (!found) { navigate('/ujian'); return; }
    setExam(found);
  }, [state, exams, navigate]);

  if (!exam || !state) return null;

  const pgCount = exam.questions.filter(q => q.type === 'MULTIPLE_CHOICE').length;
  const essayCount = exam.questions.filter(q => q.type === 'ESSAY').length;
  const _totalPts = exam.questions.reduce((s, q) => s + q.weight, 0);
  const totalMins = exam.settings.timerMode === 'WHOLE_EXAM'
    ? Math.ceil((exam.settings.wholExamTimerSeconds ?? 3600) / 60)
    : null;

  const handleStart = () => {
    setStarting(true);
    // Create session in localStorage
    createSession(exam, state.studentName, state.nis, state.attemptNumber);
    navigate(`/ujian/${code}/kerjakan`, {
      state: { examId: exam.id, studentName: state.studentName, nis: state.nis, resume: false }
    });
  };

  return (
    <div style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.card}>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <span className={`badge ${exam.format === 'PG_ONLY' ? 'badge-pg' : exam.format === 'ESSAY_ONLY' ? 'badge-essay' : 'badge-combo'}`}>
              {formatExamFormat(exam.format)}
            </span>
            <span style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700, fontSize: '0.875rem' }}>#{exam.code}</span>
          </div>

          <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>{exam.title}</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-4)' }}>{exam.subject}</p>

          {exam.description && (
            <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
              {exam.description}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--primary-light)', borderRadius: 'var(--r-md)', border: '1px solid rgba(79,110,247,0.2)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Peserta:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{state.studentName}</strong>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>NIS: {state.nis}</span>
            {state.attemptNumber > 1 && (
              <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--warning)' }}>Percobaan ke-{state.attemptNumber}</span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)', width: '100%' }}>
          {[
            { icon: <FileText size={20} />, label: 'Total Soal', value: `${exam.questions.length} soal`, color: 'var(--primary)', bg: 'var(--primary-light)' },
            { icon: <Clock size={20} />, label: 'Waktu', value: totalMins ? `${totalMins} menit` : (exam.settings.timerMode === 'PER_QUESTION' ? 'Per soal' : 'Tidak terbatas'), color: 'var(--warning)', bg: 'var(--warning-light)' },
            ...(pgCount > 0 ? [{ icon: <span style={{ fontWeight: 800 }}>PG</span>, label: 'Pilihan Ganda', value: `${pgCount} soal (otomatis)`, color: 'var(--accent)', bg: 'var(--accent-light)' }] : []),
            ...(essayCount > 0 ? [{ icon: <BookOpen size={20} />, label: 'Essay', value: `${essayCount} soal (manual)`, color: 'var(--secondary)', bg: 'var(--secondary-light)' }] : []),
          ].map((item, i) => (
            <div key={i} style={{ ...styles.infoCard, borderLeft: `3px solid ${item.color}` }}>
              <div style={{ color: item.color, marginBottom: 4, display: 'flex', alignItems: 'center' }}>{item.icon}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={styles.card}>
          <h3 style={{ marginBottom: 'var(--sp-4)' }}>📋 Instruksi Ujian</h3>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {[
              'Pastikan koneksi internet Anda stabil sebelum memulai.',
              'Jawaban tersimpan otomatis setiap kali Anda menjawab.',
              ...(exam.settings.timerMode === 'WHOLE_EXAM' ? [`Waktu ujian ${totalMins} menit. Ujian otomatis dikumpul saat waktu habis.`] : []),
              ...(exam.settings.timerMode === 'PER_QUESTION' ? ['Setiap soal memiliki batas waktu. Soal otomatis berpindah saat waktu habis.'] : []),
              ...(exam.settings.shuffleQuestions ? ['Urutan soal diacak — berbeda tiap peserta.'] : []),
              ...(essayCount > 0 ? ['Soal essay dinilai oleh guru secara manual setelah ujian selesai.'] : []),
              `Anda memiliki ${exam.settings.maxAttempts === 0 ? 'percobaan tidak terbatas' : `maksimal ${exam.settings.maxAttempts}x percobaan`}.`,
              'Pastikan nama dan NIS Anda sudah benar sebelum mulai.',
            ].map((inst, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <ChevronRight size={15} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
                {inst}
              </li>
            ))}
          </ul>
        </div>

        {/* Warning for essay */}
        {essayCount > 0 && (
          <div style={styles.warningBox}>
            <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Ujian ini memiliki soal <strong>essay</strong>. Nilai essay akan diberikan oleh guru secara manual — skor Anda mungkin belum lengkap langsung setelah submit.
            </p>
          </div>
        )}

        {/* Start Button */}
        <button className="btn btn-success btn-lg w-full" style={{ justifyContent: 'center', fontSize: '1.05rem' }}
          onClick={handleStart} disabled={starting}>
          {starting ? 'Memulai...' : <><Play size={18} /> Mulai Ujian Sekarang</>}
        </button>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Dengan memulai ujian, Anda menyatakan akan mengerjakan secara mandiri dan jujur.
        </p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg)', padding: 'var(--sp-6) var(--sp-4)', position: 'relative' },
  bg: { position: 'fixed', inset: 0, background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(79,110,247,0.1), transparent)', zIndex: 0, pointerEvents: 'none' },
  container: { position: 'relative', zIndex: 1, maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-6)', boxShadow: 'var(--shadow-sm)' },
  infoCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-4)' },
  warningBox: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 'var(--sp-4)', background: 'var(--warning-light)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 'var(--r-lg)' },
};
