import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Hash, User, CreditCard, Search, AlertCircle, ArrowRight, Clock, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { validateExamAccess, clearSession } from '../../utils/examSession';
import { formatExamFormat, formatTimerMode } from '../../utils/helpers';
import { Spinner } from '../../components/ui';
import type { Exam } from '../../types';

type Step = 'code' | 'identity' | 'resume';

export default function JoinExamPage() {
  const { exams, submissions } = useApp();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nis, setNis] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundExam, setFoundExam] = useState<Exam | null>(null);
  const [_hasResume, setHasResume] = useState(false);

  // Format kode saat mengetik
  const handleCodeInput = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(clean);
    setError('');
  };

  const handleFindExam = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (code.length !== 6) { setError('Kode ujian harus 6 karakter'); return; }

    const exam = exams.find(ex => ex.code === code);
    if (!exam) { setError(`Kode "${code}" tidak ditemukan. Periksa kembali kode dari guru Anda.`); return; }
    if (exam.status !== 'ACTIVE') {
      const msg = exam.status === 'DRAFT' ? 'Ujian ini belum dipublikasikan.' :
                  exam.status === 'ENDED' ? 'Ujian ini sudah ditutup.' : 'Ujian ini sudah diarsipkan.';
      setError(msg); return;
    }

    setFoundExam(exam);
    setStep('identity');
  };

  const handleIdentitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Nama lengkap wajib diisi'); return; }
    if (!nis.trim()) { setError('NIS wajib diisi'); return; }
    if (!foundExam) return;

    setLoading(true);
    const access = validateExamAccess(foundExam, nis.trim(), submissions);
    setLoading(false);

    if (!access.allowed) { setError(access.reason ?? 'Akses ditolak'); return; }

    if (access.existingSession) {
      setHasResume(true);
      setStep('resume');
    } else {
      navigate(`/ujian/${foundExam.code}/instruksi`, {
        state: { examId: foundExam.id, studentName: name.trim(), nis: nis.trim(), attemptNumber: access.attemptNumber }
      });
    }
  };

  const handleResume = () => {
    navigate(`/ujian/${foundExam!.code}/kerjakan`, {
      state: { examId: foundExam!.id, studentName: name.trim(), nis: nis.trim(), resume: true }
    });
  };

  const handleStartFresh = () => {
    clearSession(foundExam!.code, nis.trim());
    navigate(`/ujian/${foundExam!.code}/instruksi`, {
      state: { examId: foundExam!.id, studentName: name.trim(), nis: nis.trim(), attemptNumber: 1 }
    });
  };

  const totalQ = foundExam?.questions.length ?? 0;
  const totalPts = foundExam?.questions.reduce((s, q) => s + q.weight, 0) ?? 0;

  return (
    <div style={styles.page}>
      <div style={styles.bg} />

      <div style={styles.container}>
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>⚡</div>
          <span style={styles.logoText}>KuizKu</span>
        </div>

        {/* Step: Enter Code */}
        {step === 'code' && (
          <div style={styles.card}>
            <h1 style={styles.title}>Masuk ke Ujian</h1>
            <p style={styles.subtitle}>Masukkan kode ujian dari guru Anda</p>

            <form onSubmit={handleFindExam}>
              <div style={styles.codeInputWrap}>
                <input
                  id="exam-code-input"
                  className="form-input"
                  value={code}
                  onChange={e => handleCodeInput(e.target.value)}
                  placeholder="ABC123"
                  maxLength={6}
                  autoFocus
                  autoComplete="off"
                  style={{
                    textAlign: 'center',
                    fontSize: '2rem',
                    fontWeight: 800,
                    letterSpacing: '0.3em',
                    padding: '16px 20px',
                    fontFamily: 'monospace',
                    color: code.length === 6 ? 'var(--primary)' : 'var(--text-primary)',
                    background: 'var(--surface-2)',
                    border: `2px solid ${code.length === 6 ? 'var(--primary)' : 'var(--border-strong)'}`,
                    borderRadius: 'var(--r-lg)',
                    width: '100%',
                    transition: 'all 0.2s ease',
                  }}
                />
                {/* Character indicator */}
                <div style={styles.codeIndicator}>
                  {[...Array(6)].map((_, i) => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: i < code.length ? 'var(--primary)' : 'var(--border-strong)',
                      transition: 'background 0.15s ease',
                    }} />
                  ))}
                </div>
              </div>

              {error && (
                <div style={styles.errorBox}><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
              )}

              <button type="submit" className="btn btn-primary btn-lg w-full" style={{ justifyContent: 'center', marginTop: 'var(--sp-4)' }}
                disabled={code.length !== 6}>
                <Search size={16} /> Cari Ujian
              </button>
            </form>

            <p style={styles.hint}>Kode ujian terdiri dari 6 huruf/angka, diberikan oleh guru Anda.</p>
          </div>
        )}

        {/* Step: Identity */}
        {step === 'identity' && foundExam && (
          <div style={styles.card}>
            {/* Exam preview */}
            <div style={styles.examPreview}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>#{foundExam.code}</span>
                <span className={`badge ${foundExam.format === 'PG_ONLY' ? 'badge-pg' : foundExam.format === 'ESSAY_ONLY' ? 'badge-essay' : 'badge-combo'}`}>
                  {formatExamFormat(foundExam.format)}
                </span>
              </div>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 4 }}>{foundExam.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{foundExam.subject}</p>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 8, flexWrap: 'wrap' }}>
                <span style={styles.metaItem}><FileText size={13} /> {totalQ} soal</span>
                <span style={styles.metaItem}><Hash size={13} /> {totalPts} poin</span>
                <span style={styles.metaItem}><Clock size={13} /> {formatTimerMode(foundExam.settings.timerMode)}</span>
              </div>
            </div>

            <h2 style={{ marginBottom: 4, fontSize: '1.2rem' }}>Data Diri</h2>
            <p style={styles.subtitle}>Isi nama dan NIS Anda dengan benar</p>

            <form onSubmit={handleIdentitySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="student-name">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={iconStyle} />
                  <input id="student-name" className="form-input" placeholder="Nama sesuai absen..."
                    style={{ paddingLeft: 40 }} value={name} onChange={e => { setName(e.target.value); setError(''); }} autoFocus />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="student-nis">NIS (Nomor Induk Siswa) <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <CreditCard size={16} style={iconStyle} />
                  <input id="student-nis" className="form-input" placeholder="Contoh: 20240001"
                    style={{ paddingLeft: 40 }} value={nis} onChange={e => { setNis(e.target.value.replace(/\D/g, '')); setError(''); }} />
                </div>
                <span className="form-hint">NIS digunakan untuk identifikasi jawaban Anda.</span>
              </div>

              {/* Pre-loaded student list */}
              {foundExam.preloadedStudents.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Atau pilih nama dari daftar:</p>
                  <div style={{ maxHeight: 140, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                    {foundExam.preloadedStudents.map(s => (
                      <button key={s.nis} type="button"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', width: '100%', background: nis === s.nis ? 'var(--primary-light)' : 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', fontSize: '0.875rem', borderBottom: '1px solid var(--border)', textAlign: 'left' }}
                        onClick={() => { setName(s.name); setNis(s.nis); setError(''); }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ flex: 1 }}>{s.name}</span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.nis}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div style={styles.errorBox}><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>
              )}

              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setStep('code'); setError(''); }}>← Kembali</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
                  {loading ? <Spinner /> : <><ArrowRight size={16} /> Lihat Instruksi</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Resume? */}
        {step === 'resume' && foundExam && (
          <div style={styles.card}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
              <div style={{ fontSize: '3rem', marginBottom: 'var(--sp-3)' }}>⚡</div>
              <h2>Ada Sesi Tersimpan</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                Anda pernah mengerjakan ujian <strong style={{ color: 'var(--text-primary)' }}>{foundExam.title}</strong> sebelumnya dan belum selesai. Ingin melanjutkan?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }} onClick={handleResume}>
                ▶ Lanjutkan dari Sesi Sebelumnya
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={handleStartFresh}>
                Mulai Ulang dari Awal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const iconStyle: React.CSSProperties = {
  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-muted)', pointerEvents: 'none',
};

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)', position: 'relative', background: 'var(--bg)' },
  bg: { position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(79,110,247,0.12), transparent)', zIndex: 0 },
  container: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-6)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 36, height: 36, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' },
  logoText: { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.3rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' },
  card: { background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-8)', width: '100%', boxShadow: 'var(--shadow-lg)' },
  title: { textAlign: 'center', fontSize: '1.5rem', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' },
  codeInputWrap: { marginBottom: 'var(--sp-3)' },
  codeIndicator: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 },
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.875rem', marginTop: 'var(--sp-3)' },
  hint: { textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-5)' },
  examPreview: { padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-5)', border: '1px solid var(--border)' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' },
};
