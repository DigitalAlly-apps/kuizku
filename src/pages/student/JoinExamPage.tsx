import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Hash, User, CreditCard, ListOrdered, Search, AlertCircle, ArrowRight, Clock, FileText, Calendar, History, Trophy, Play, BookOpen, RotateCcw } from 'lucide-react';
import { storage } from '../../utils/storage';
import { loadSession } from '../../utils/examSession';
import { formatDateTime, formatExamFormat, formatTimerMode } from '../../utils/helpers';
import { Spinner } from '../../components/ui';
import type { Exam } from '../../types';

type Step = 'code' | 'actions' | 'identity' | 'resume';

export default function JoinExamPage() {
  const navigate = useNavigate();
  const { code: urlCode } = useParams<{ code?: string }>();

  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nis, setNis] = useState('');
  const [identityMode, setIdentityMode] = useState<'nisn' | 'noabsen'>('nisn');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundExam, setFoundExam] = useState<Exam | null>(null);
  const [nextAttemptNumber, setNextAttemptNumber] = useState(1);
  const [, setHasResume] = useState(false);

  // Format kode saat mengetik
  const handleCodeInput = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    setCode(clean);
    setError('');
  };

  const findExamByCode = async (examCode: string) => {
    setError('');
    setLoading(true);
    // Query langsung ke Supabase — murid tidak perlu login
    const lookup = await storage.getExamByCode(examCode);
    setLoading(false);

    if (!lookup.exam) {
      setError(lookup.error?.message ?? 'Ujian belum dapat dimuat. Silakan coba lagi.');
      return;
    }
    const exam = lookup.exam;
    if (exam.status === 'DRAFT' || exam.status === 'ARCHIVED') {
      const msg = exam.status === 'DRAFT' ? 'Ujian ini belum dipublikasikan.' : 'Ujian ini sudah diarsipkan.';
      setError(msg);
      return;
    }

    setFoundExam(exam);
    setStep('actions');
  };

  const handleFindExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) { setError('Kode ujian harus 6 karakter'); return; }
    await findExamByCode(code);
  };

  useEffect(() => {
    if (urlCode && urlCode.length === 6) {
      const upperCode = urlCode.toUpperCase();
      setCode(upperCode);
      findExamByCode(upperCode);
    }
  }, [urlCode]);

  const handleIdentitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('Nama lengkap wajib diisi'); return; }
    if (!foundExam) return;

    // Gunakan nis sebagai identifier — bisa NISN, no absen, atau fallback ke nama
    const identifier = nis.trim() || name.trim();

    setLoading(true);
    const access = await storage.getStudentExamByCode(foundExam.code, name.trim(), identifier);
    setLoading(false);

    if (!access.exam) {
      let message = access.error?.message ?? 'Akses ditolak';
      if (message.includes('belum dimulai') && foundExam.activeFrom) {
        message = `Ujian belum dimulai. Jadwal mulai: ${formatDateTime(foundExam.activeFrom)}.`;
      } else if (message.includes('sudah berakhir') && foundExam.activeTo) {
        message = `Waktu ujian sudah berakhir. Batas waktu: ${formatDateTime(foundExam.activeTo)}.`;
      }
      setError(message);
      return;
    }
    setNextAttemptNumber(access.attemptNumber ?? 1);

    if (loadSession(foundExam.code, identifier)) {
      setHasResume(true);
      setStep('resume');
    } else {
      navigate(`/ujian/${foundExam.code}/instruksi`, {
        state: { examId: access.exam.id, studentName: name.trim(), nis: identifier, attemptNumber: access.attemptNumber }
      });
    }
  };

  const handleStartExam = () => {
    if (!foundExam) return;
    const now = Date.now();
    if (foundExam.status !== 'ACTIVE') {
      setError('Ujian sudah ditutup dan tidak dapat dikerjakan. Anda masih dapat melihat ranking bila sudah dirilis.');
      return;
    }
    if (foundExam.activeFrom && new Date(foundExam.activeFrom).getTime() > now) {
      setError(`Ujian belum dimulai. Jadwal mulai: ${formatDateTime(foundExam.activeFrom)}.`);
      return;
    }
    if (foundExam.activeTo && new Date(foundExam.activeTo).getTime() < now) {
      setError(`Waktu ujian sudah berakhir. Batas waktu: ${formatDateTime(foundExam.activeTo)}.`);
      return;
    }
    setError('');
    setStep('identity');
  };

  const handleResume = () => {
    // Fix #5: Validasi exam masih aktif sebelum resume
    if (!foundExam || foundExam.status !== 'ACTIVE') {
      setError('Ujian sudah tidak aktif. Sesi tidak bisa dilanjutkan.');
      setStep('identity');
      return;
    }
    const identifier = nis.trim() || name.trim();
    navigate(`/ujian/${foundExam.code}/kerjakan`, {
      state: { examId: foundExam.id, studentName: name.trim(), nis: identifier, resume: true }
    });
  };

  const handleStartFresh = () => {
    const identifier = nis.trim() || name.trim();
    navigate(`/ujian/${foundExam!.code}/instruksi`, {
      state: { examId: foundExam!.id, studentName: name.trim(), nis: identifier, attemptNumber: nextAttemptNumber }
    });
  };

  const totalQ = foundExam?.questions.length ?? 0;
  const totalPts = foundExam?.questions.reduce((s, q) => s + q.weight, 0) ?? 0;
  const now = Date.now();
  const canStart = !!foundExam && foundExam.status === 'ACTIVE'
    && (!foundExam.activeFrom || new Date(foundExam.activeFrom).getTime() <= now)
    && (!foundExam.activeTo || new Date(foundExam.activeTo).getTime() >= now);

  return (
    <div className="student-join-page" style={styles.page}>
      <div style={styles.bg} />

      <div style={styles.container}>
        {/* Logo */}
        <div className="student-brand" style={styles.logo}>
          <div style={styles.logoIcon}><BookOpen size={19} strokeWidth={2.25} /></div>
          <span style={styles.logoText}>Kuizku</span>
        </div>

        {/* Step: Enter Code */}
        {step === 'code' && (
          <div style={styles.card}>
            <div className="student-page-kicker">Portal Murid</div>
            <h1 style={styles.title}>Masuk ke Ujian</h1>
            <p style={styles.subtitle}>Masukkan kode 6 karakter dari guru Anda.</p>

            <form onSubmit={handleFindExam}>
              <div style={styles.codeInputWrap}>
                <input
                  id="exam-code-input"
                  className="form-input student-code-input"
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
                disabled={code.length !== 6 || loading}>
                {loading ? <Spinner /> : <><Search size={16} /> Cari Ujian</>}
              </button>
            </form>

            <p style={styles.hint}>Kode terdiri dari huruf dan angka. Tidak perlu login untuk mengerjakan.</p>
            <button type="button" className="student-history-link" onClick={() => navigate('/riwayat')}>
              <History size={15} /> Riwayat Saya
            </button>
          </div>
        )}

        {/* Step: Pilih tujuan setelah kode ditemukan. Ranking tidak membuat sesi ujian. */}
        {step === 'actions' && foundExam && (
          <div style={styles.card}>
            <div style={styles.examPreview}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>#{foundExam.code}</span>
                <span className={`badge ${foundExam.format === 'PG_ONLY' ? 'badge-pg' : foundExam.format === 'ESSAY_ONLY' ? 'badge-essay' : 'badge-combo'}`}>{formatExamFormat(foundExam.format)}</span>
              </div>
              <h1 style={{ fontSize: '1.35rem', marginBottom: 4 }}>{foundExam.title}</h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>{foundExam.subject}</p>
              <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 10, flexWrap: 'wrap' }}>
                <span style={styles.metaItem}><Clock size={13} /> {formatTimerMode(foundExam.settings.timerMode)}</span>
                {foundExam.activeFrom && <span style={styles.metaItem}><Calendar size={13} /> Mulai: {formatDateTime(foundExam.activeFrom)}</span>}
                {foundExam.activeTo && <span style={styles.metaItem}><Calendar size={13} /> Batas: {formatDateTime(foundExam.activeTo)}</span>}
              </div>
            </div>

            <h2 style={{ fontSize: '1.08rem', marginBottom: 4 }}>Apa yang ingin Anda lakukan?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--sp-4)' }}>Pilih satu tujuan. Membuka ranking tidak akan memulai ujian.</p>

            {error && <div style={styles.errorBox}><AlertCircle size={15} style={{ flexShrink: 0 }} />{error}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: error ? 'var(--sp-4)' : 0 }}>
              {canStart ? <button type="button" className="btn btn-primary btn-lg w-full" style={{ justifyContent: 'center' }} onClick={handleStartExam}><Play size={17} /> Mulai Ujian</button> : <div style={{ padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{foundExam.status === 'ENDED' ? 'Ujian sudah ditutup. Pengerjaan tidak tersedia.' : foundExam.activeFrom && new Date(foundExam.activeFrom).getTime() > now ? `Ujian dapat dimulai ${formatDateTime(foundExam.activeFrom)}.` : 'Pengerjaan ujian tidak tersedia saat ini.'}</div>}
              <button type="button" className="btn btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => navigate(`/ujian/${foundExam.code}/ranking`)}><Trophy size={16} /> Lihat Ranking</button>
              <button type="button" className="btn btn-ghost w-full" style={{ justifyContent: 'center' }} onClick={() => navigate('/riwayat')}><History size={16} /> Riwayat Saya</button>
              <button type="button" className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }} onClick={() => { setStep('code'); setError(''); }}>Gunakan kode ujian lain</button>
            </div>
          </div>
        )}

        {/* Step: Identity */}
        {step === 'identity' && foundExam && (
          <div style={styles.card}>
            {/* Exam preview */}
            <div style={styles.examPreview}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--primary)', fontSize: '0.9rem' }}>#{foundExam.code}</span>
                {/* Type badge */}
                {(() => {
                  const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
                    UJIAN:   { label: 'Ujian',   color: 'var(--danger)',  bg: 'var(--danger-light)' },
                    TUGAS:   { label: 'Tugas',   color: 'var(--warning)', bg: 'var(--warning-light)' },
                    LATIHAN: { label: 'Latihan', color: 'var(--success)', bg: 'var(--success-light)' },
                  };
                  const c = typeConfig[(foundExam as any).examType ?? 'UJIAN'] ?? typeConfig['UJIAN'];
                  return <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: c.bg, color: c.color, fontWeight: 700 }}>{c.label}</span>;
                })()}
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
                {foundExam.activeTo && (
                  <span style={{ ...styles.metaItem, color: new Date(foundExam.activeTo) < new Date() ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                    <Calendar size={13} />
                    {new Date(foundExam.activeTo) < new Date()
                      ? 'Batas waktu lewat'
                      : `Deadline: ${formatDateTime(foundExam.activeTo)}`}
                  </span>
                )}
              </div>
            </div>

            <h2 style={{ marginBottom: 4, fontSize: '1.2rem' }}>Data Diri untuk Mengerjakan</h2>
            <p style={styles.subtitle}>Data ini dipakai untuk memverifikasi akses dan menyimpan jawaban Anda.</p>

            <form onSubmit={handleIdentitySubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="student-name">Nama Lengkap <span style={{ color: 'var(--danger)' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={iconStyle} />
                  <input id="student-name" className="form-input" placeholder="Nama sesuai absen..."
                    style={{ paddingLeft: 40 }} value={name} onChange={e => { setName(e.target.value); setError(''); }} autoFocus />
                </div>
              </div>

              {/* Toggle: NISN vs No Absen */}
              <div className="form-group">
                <label className="form-label">Identitas Nomor <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>(opsional)</span></label>
                <div style={styles.toggleWrap}>
                  <button
                    type="button"
                    style={{ ...styles.toggleBtn, ...(identityMode === 'nisn' ? styles.toggleBtnActive : {}) }}
                    onClick={() => { setIdentityMode('nisn'); setNis(''); setError(''); }}
                  >
                    <CreditCard size={13} /> NISN
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.toggleBtn, ...(identityMode === 'noabsen' ? styles.toggleBtnActive : {}) }}
                    onClick={() => { setIdentityMode('noabsen'); setNis(''); setError(''); }}
                  >
                    <ListOrdered size={13} /> No Absen
                  </button>
                </div>

                {identityMode === 'nisn' ? (
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <CreditCard size={16} style={iconStyle} />
                    <input
                      id="student-nis"
                      className="form-input"
                      placeholder="Contoh: 0012345678 (opsional)"
                      style={{ paddingLeft: 40 }}
                      value={nis}
                      onChange={e => { setNis(e.target.value.replace(/\D/g, '')); setError(''); }}
                    />
                  </div>
                ) : (
                  <div style={{ position: 'relative', marginTop: 8 }}>
                    <ListOrdered size={16} style={iconStyle} />
                    <input
                      id="student-noabsen"
                      className="form-input"
                      placeholder="Contoh: 15 (opsional)"
                      style={{ paddingLeft: 40 }}
                      value={nis}
                      onChange={e => { setNis(e.target.value.replace(/\D/g, '')); setError(''); }}
                    />
                  </div>
                )}
                <span className="form-hint">Jika tidak diisi, nama Anda akan digunakan sebagai identitas.</span>
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
                <button type="button" className="btn btn-secondary" onClick={() => { setStep('actions'); setError(''); }}>← Kembali</button>
                <button type="submit" className="btn btn-primary btn-lg" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
                  {loading ? <Spinner /> : <><ArrowRight size={16} /> Lanjut ke Instruksi</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step: Resume? */}
        {step === 'resume' && foundExam && (
          <div style={styles.card}>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-6)' }}>
              <div style={styles.resumeIcon}><BookOpen size={28} strokeWidth={2} /></div>
              <h2>Ada Sesi Tersimpan</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 8 }}>
                Anda pernah mengerjakan ujian <strong style={{ color: 'var(--text-primary)' }}>{foundExam.title}</strong> sebelumnya dan belum selesai. Ingin melanjutkan?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <button className="btn btn-primary btn-lg" style={{ justifyContent: 'center' }} onClick={handleResume}>
                <Play size={16} /> Lanjutkan dari Sesi Sebelumnya
              </button>
              <button className="btn btn-secondary" style={{ justifyContent: 'center' }} onClick={handleStartFresh}>
                <RotateCcw size={16} /> Mulai Ulang dari Awal
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
  bg: { display: 'none' },
  container: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-6)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: { width: 36, height: 36, background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' },
  card: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-7)', width: '100%', boxShadow: 'var(--shadow-sm)' },
  title: { textAlign: 'center', fontSize: '1.5rem', marginBottom: 4 },
  subtitle: { textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-6)' },
  codeInputWrap: { marginBottom: 'var(--sp-3)' },
  codeIndicator: { display: 'flex', justifyContent: 'center', gap: 6, marginTop: 10 },
  errorBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.875rem', marginTop: 'var(--sp-3)' },
  hint: { textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'var(--sp-5)' },
  examPreview: { padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-5)', border: '1px solid var(--border)' },
  metaItem: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: 'var(--text-muted)' },
  toggleWrap: { display: 'flex', gap: 6, marginBottom: 4 },
  toggleBtn: { display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 40, padding: '6px 14px', borderRadius: 'var(--r-md)', border: '1.5px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s ease' },
  toggleBtnActive: { borderColor: 'var(--primary)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 },
  resumeIcon: { width: 56, height: 56, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-3)' },
};
