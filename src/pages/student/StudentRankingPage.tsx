import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, History, Search, Trophy, User } from 'lucide-react';
import { APP_CONFIG } from '../../lib/appConfig';
import { storage } from '../../utils/storage';
import type { StudentRanking } from '../../types';

type LocationState = { studentName?: string; nis?: string };

const reasonMessage: Record<string, string> = {
  IDENTITY_REQUIRED: 'Ujian ini memakai daftar peserta. Isi nama dan NIS/nomor absen Anda untuk melihat ranking.',
  STUDENT_NOT_REGISTERED: 'Nama atau NIS/ID tidak ditemukan dalam daftar peserta.',
  NOT_RELEASED: 'Ranking belum dirilis oleh guru.',
  ESSAY_PENDING: 'Ranking belum tersedia karena penilaian essay masih berlangsung.',
  NOT_FOUND: 'Ujian tidak ditemukan atau belum dapat menampilkan ranking.',
  UNAVAILABLE: 'Ranking belum dapat dimuat. Silakan coba lagi.',
};

export default function StudentRankingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { code = '' } = useParams<{ code: string }>();
  const initial = (location.state ?? {}) as LocationState;
  const [name, setName] = useState(initial.studentName ?? '');
  const [nis, setNis] = useState(initial.nis ?? '');
  const [ranking, setRanking] = useState<StudentRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [needsIdentity, setNeedsIdentity] = useState(false);

  const loadRanking = async (studentName = name, identifier = nis) => {
    setLoading(true);
    setError('');
    const result = await storage.getStudentRankingVisitor(code, studentName.trim(), identifier.trim());
    setLoading(false);
    setRanking(result);
    if (result.available) {
      setNeedsIdentity(false);
      return;
    }
    const reason = result.reason ?? 'UNAVAILABLE';
    setNeedsIdentity(reason === 'IDENTITY_REQUIRED' || reason === 'STUDENT_NOT_REGISTERED');
    setError(reasonMessage[reason] ?? 'Ranking belum tersedia untuk ujian ini.');
  };

  useEffect(() => {
    if (code.length === 6) void loadRanking(initial.studentName ?? '', initial.nis ?? '');
  }, [code]);

  const submitIdentity = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Nama lengkap wajib diisi untuk ujian dengan daftar peserta.');
      return;
    }
    void loadRanking();
  };

  const visibleEntries = ranking?.entries ?? [];
  const currentEntry = visibleEntries.find(entry => entry.isCurrent);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 'var(--sp-4)' }}>
      <main style={{ maxWidth: 620, margin: '0 auto', padding: 'var(--sp-4) 0 var(--sp-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--sp-6)' }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/ujian/${code}`)}><ArrowLeft size={15} /> Kembali</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}><span style={{ fontSize: '1.2rem' }}>{APP_CONFIG.icon}</span>{APP_CONFIG.name}</div>
        </div>

        <section className="card" style={{ padding: 'var(--sp-6)', marginBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'var(--warning-light)', color: 'var(--warning)', flexShrink: 0 }}><Trophy size={23} /></div>
            <div>
              <div className="student-page-kicker">Ranking Ujian</div>
              <h1 style={{ fontSize: '1.45rem', margin: '2px 0 4px' }}>Peringkat Peserta</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>Kode ujian: <strong>#{code.toUpperCase()}</strong>. Membuka halaman ini tidak memulai ujian.</p>
            </div>
          </div>
        </section>

        {loading && <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 'var(--sp-8)' }}>Memuat ranking…</div>}

        {!loading && needsIdentity && (
          <form className="card" onSubmit={submitIdentity} style={{ padding: 'var(--sp-6)' }}>
            <h2 style={{ fontSize: '1.05rem', marginBottom: 4 }}>Verifikasi Peserta</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 'var(--sp-4)' }}>Data ini hanya dipakai untuk mengecek akses dan menandai posisi Anda, bukan untuk memulai ujian.</p>
            <label className="form-label" htmlFor="ranking-name">Nama lengkap</label>
            <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input id="ranking-name" className="form-input" value={name} onChange={event => setName(event.target.value)} placeholder="Nama sesuai absen" style={{ paddingLeft: 40 }} autoFocus />
            </div>
            <label className="form-label" htmlFor="ranking-nis">NIS/NISN/nomor absen <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(bila ada)</span></label>
            <input id="ranking-nis" className="form-input" value={nis} onChange={event => setNis(event.target.value)} placeholder="Contoh: 15" inputMode="numeric" />
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', margin: 'var(--sp-3) 0 0' }}>{error}</p>}
            <button type="submit" className="btn btn-primary w-full" style={{ justifyContent: 'center', marginTop: 'var(--sp-4)' }}><Search size={16} /> Lihat Ranking</button>
          </form>
        )}

        {!loading && !needsIdentity && ranking?.available && (
          <section className="student-ranking-card">
            <div className="student-ranking-header">
              <div>
                <div className="student-ranking-eyebrow"><Trophy size={15} /> Ranking Kelas</div>
                <h2>{currentEntry ? `Posisi Anda #${ranking.currentRank}` : 'Daftar Peringkat'}</h2>
                <p>{ranking.totalParticipants ?? 0} peserta • skor terbaik per murid</p>
              </div>
              <div className="student-ranking-medal">🏆</div>
            </div>
            <div className="student-ranking-list">
              {visibleEntries.slice(0, 10).map(entry => <div key={`${entry.rank}-${entry.studentName}`} className={`student-ranking-row ${entry.isCurrent ? 'is-you' : ''}`}>
                <span className="student-ranking-rank">{entry.rank}</span>
                <span className="student-ranking-name">{entry.studentName}{entry.isCurrent && ' (Anda)'}</span>
                <strong>{entry.score}/{entry.maxScore}</strong>
              </div>)}
              {currentEntry && ranking.currentRank && ranking.currentRank > 10 && <><div className="student-ranking-more">•••</div><div className="student-ranking-row is-you"><span className="student-ranking-rank">{currentEntry.rank}</span><span className="student-ranking-name">{currentEntry.studentName} (Anda)</span><strong>{currentEntry.score}/{currentEntry.maxScore}</strong></div></>}
            </div>
            {!currentEntry && <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 'var(--sp-4) 0 0' }}>Ingin posisi Anda ditandai? Masukkan identitas saat membuka ranking dari riwayat ujian.</p>}
          </section>
        )}

        {!loading && !needsIdentity && !ranking?.available && <div className="card" style={{ padding: 'var(--sp-6)', textAlign: 'center' }}><AlertCircle size={22} style={{ color: 'var(--warning)', marginBottom: 8 }} /><p style={{ margin: 0, color: 'var(--text-muted)' }}>{error}</p></div>}

        <button type="button" className="btn btn-secondary w-full" style={{ justifyContent: 'center', marginTop: 'var(--sp-4)' }} onClick={() => navigate('/riwayat')}><History size={16} /> Riwayat Saya</button>
      </main>
    </div>
  );
}
