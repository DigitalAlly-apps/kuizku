import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Clock, FileText, BookOpen, AlertTriangle, Play, ChevronDown, Check, Calendar } from 'lucide-react';
import { storage } from '../../utils/storage';
import { formatDateTime, formatExamFormat } from '../../utils/helpers';
import { createSession } from '../../utils/examSession';
import type { Exam } from '../../types';

interface LocationState {
  examId: string;
  studentName: string;
  participantId: string;
  attemptNumber: number;
}

export default function InstructionsPage() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as LocationState | null;
  const [exam, setExam] = useState<Exam | null>(null);
  const [starting, setStarting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (!state?.examId || !code) { navigate('/ujian'); return; }

    // Query langsung ke Supabase by code — murid tidak butuh login
    storage.getStudentExamByCode(code, state.studentName, state.participantId).then(({ exam: found }) => {
      if (!found || found.id !== state.examId) { navigate('/ujian'); return; }
      setExam(found);
    });
  }, [state, code, navigate]);

  if (!exam || !state) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spinner spinner-lg" />
    </div>
  );

  const essayCount = exam.questions.filter(q => q.type === 'ESSAY').length;

  const totalMins = exam.settings.timerMode === 'WHOLE_EXAM'
    ? Math.ceil((exam.settings.wholExamTimerSeconds ?? 3600) / 60)
    : null;

  const handleStart = () => {
    setStarting(true);
    createSession(exam, state.studentName, state.participantId, state.attemptNumber);
    navigate(`/ujian/${code}/kerjakan`, {
      state: { examId: exam.id, studentName: state.studentName, participantId: state.participantId, resume: false }
    });
  };

  return (
    <div className="student-instructions-page" style={styles.page}>
      <div style={styles.bg} />
      <div style={styles.container}>
        <div className="student-instructions-brand">Kuizku · Persiapan Ujian</div>

        <section className="student-instructions-hero" style={styles.card}>
          <span className={`badge ${exam.format === 'PG_ONLY' ? 'badge-pg' : exam.format === 'ESSAY_ONLY' ? 'badge-essay' : 'badge-combo'}`}>{formatExamFormat(exam.format)}</span>
          <h1>{exam.title}</h1>
          <p className="student-instructions-subject">{exam.subject}</p>
          <div className="student-exam-summary">
            <span><FileText size={18} /> {exam.questions.length} soal</span>
            <span><Clock size={18} /> {totalMins ? `${totalMins} menit` : exam.settings.timerMode === 'PER_QUESTION' ? 'Per soal' : 'Tanpa batas waktu'}</span>
          </div>
        </section>

        <section className="student-identity-summary" aria-label="Identitas peserta">
          <div><span>Peserta</span><strong>{state.studentName}</strong></div>
          <div><span>Percobaan</span><strong>{state.attemptNumber} dari {exam.settings.maxAttempts === 0 ? '∞' : exam.settings.maxAttempts}</strong></div>
        </section>

        <section className="student-before-start" style={styles.card}>
          <div className="student-section-heading"><div><span className="student-section-eyebrow">Sebelum mulai</span><h2>Siap mengerjakan?</h2></div><Check size={22} /></div>
          <ul>
            <li><Check size={17} /> Jawaban tersimpan otomatis setiap kali Anda menjawab.</li>
            {exam.settings.timerMode !== 'NONE' && <li><Check size={17} /> Timer mulai setelah tombol mulai ditekan.</li>}
            <li><Check size={17} /> Tetap di halaman ujian sampai selesai.</li>
            {exam.settings.timerMode !== 'NONE' && <li><Check size={17} /> Ujian otomatis terkumpul saat waktu habis.</li>}
          </ul>
          <button type="button" className="student-details-toggle" onClick={() => setShowDetails(v => !v)} aria-expanded={showDetails}>
            Lihat aturan lengkap <ChevronDown size={16} className={showDetails ? 'is-open' : ''} />
          </button>
          {showDetails && <div className="student-extra-rules">
            {exam.description && <p>{exam.description}</p>}
            {exam.settings.shuffleQuestions && <p>Urutan soal diacak dan dapat berbeda dari peserta lain.</p>}
            {essayCount > 0 && <p>Soal essay dinilai manual oleh guru. Nilai akhir mungkin belum tersedia langsung setelah dikumpulkan.</p>}
            <p>{exam.settings.maxAttempts === 0 ? 'Percobaan tidak terbatas.' : `Maksimal ${exam.settings.maxAttempts}x percobaan.`}</p>
            {exam.activeTo && <p><Calendar size={15} /> Batas waktu: {formatDateTime(exam.activeTo)}</p>}
            <p><AlertTriangle size={15} /> Pastikan nama dan identitas Anda sudah benar.</p>
          </div>}
        </section>

        {essayCount > 0 && <div className="student-note"><BookOpen size={17} /><span>Ada {essayCount} soal essay. Guru akan menilai jawabannya setelah ujian.</span></div>}

        <button className="btn btn-success btn-lg student-start-button" style={{ justifyContent: 'center', fontSize: '1.05rem' }} onClick={handleStart} disabled={starting}>
          {starting ? 'Memulai...' : <><Play size={18} /> Mulai Ujian</>}
        </button>
        <button type="button" className="student-back-link" onClick={() => navigate('/ujian')}>Kembali ke beranda</button>
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
