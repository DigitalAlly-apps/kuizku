// Riwayat murid disimpan pada perangkat/browser ini. Data submission asli
// tetap berada di server dan tidak pernah dihapus dari halaman ini.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, BookOpen, Clock, FileText, History, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { clearSessionBySubmissionId } from '../../utils/examSession';
import { formatDateTime } from '../../utils/helpers';
import { APP_CONFIG } from '../../lib/appConfig';

interface HistoryEntry {
  id: string;
  examId?: string;
  examTitle: string;
  examSubject: string;
  examCode: string;
  examType?: string;
  studentName: string;
  participantId?: string;
  submittedAt?: string;
  mcScore: number;
  totalScore?: number;
  maxMC: number;
}

const HISTORY_KEY = 'kuizku_student_history';

function readHistory(): HistoryEntry[] {
  try {
    const entries = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function TypeBadge({ type }: { type?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    UJIAN: { label: '📝 Ujian', color: 'var(--danger)', bg: 'var(--danger-light)' },
    TUGAS: { label: '📋 Tugas', color: 'var(--warning)', bg: 'var(--warning-light)' },
    LATIHAN: { label: '🎯 Latihan', color: 'var(--success)', bg: 'var(--success-light)' },
  };
  const item = map[type ?? 'UJIAN'] ?? map.UJIAN;
  return <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: item.bg, color: item.color, fontWeight: 700 }}>{item.label}</span>;
}

export default function StudentHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>(readHistory);

  useEffect(() => {
    const sync = () => setHistory(readHistory());
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const persist = (entries: HistoryEntry[]) => {
    setHistory(entries);
    if (entries.length) localStorage.setItem(HISTORY_KEY, JSON.stringify(entries));
    else localStorage.removeItem(HISTORY_KEY);
  };

  const removeEntry = (entry: HistoryEntry) => {
    if (!window.confirm(`Hapus riwayat “${entry.examTitle}” dari perangkat ini? Nilai dan jawaban di server tidak akan dihapus.`)) return;
    clearSessionBySubmissionId(entry.id);
    persist(history.filter(item => item.id !== entry.id));
  };

  const clearAll = () => {
    if (!window.confirm('Hapus semua riwayat dari perangkat ini? Nilai, jawaban, dan ranking di server tetap aman.')) return;
    history.forEach(entry => clearSessionBySubmissionId(entry.id));
    persist([]);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: 'var(--sp-4) var(--sp-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: 10, display: 'grid', placeItems: 'center' }}>{APP_CONFIG.icon}</div><strong style={{ fontSize: '1.15rem' }}>{APP_CONFIG.name}</strong></div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/ujian')}>Masuk Ujian</button>
      </header>

      <main style={{ maxWidth: 640, width: '100%', margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--sp-4)' }}>
          <div><h1 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><History size={22} style={{ color: 'var(--primary)' }} /> Riwayat Saya</h1><p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: '6px 0 0' }}>Tersimpan di perangkat/browser ini. Menghapusnya tidak menghapus hasil ujian dari guru.</p></div>
          {history.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: 'var(--danger)', flexShrink: 0 }}><Trash2 size={14} /> Hapus Semua</button>}
        </div>

        {history.length === 0 ? <section className="card" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-4)' }}><div style={{ fontSize: '3rem', marginBottom: 10 }}>📚</div><h2 style={{ fontSize: '1.08rem', marginBottom: 6 }}>Belum ada riwayat di perangkat ini</h2><p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-5)' }}>Riwayat akan muncul setelah jawaban berhasil dikumpulkan di browser ini.</p><button type="button" className="btn btn-primary" onClick={() => navigate('/ujian')}>Masuk dengan Kode Ujian</button></section> : <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {history.map(entry => {
            const displayScore = entry.totalScore ?? entry.mcScore;
            const maxScore = entry.maxMC;
            return <article key={entry.id} className="card" style={{ padding: 'var(--sp-4)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}><TypeBadge type={entry.examType} /><span style={{ fontFamily: 'monospace', fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)' }}>#{entry.examCode}</span></div><h2 style={{ fontSize: '1rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.examTitle}</h2><p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0' }}>{entry.examSubject || 'Ujian'}</p></div>
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Hapus riwayat ${entry.examTitle}`} onClick={() => removeEntry(entry)} style={{ color: 'var(--danger)', padding: 6 }}><Trash2 size={15} /></button>
              </div>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', color: 'var(--text-muted)', fontSize: '0.78rem', margin: 'var(--sp-3) 0' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Award size={13} /> Skor: {displayScore}/{maxScore}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> {entry.submittedAt ? formatDateTime(entry.submittedAt) : '—'}</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><FileText size={13} /> {entry.studentName}</span>{entry.totalScore != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BookOpen size={13} /> Nilai final</span>}</div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/ujian/${entry.examCode}/ranking`, { state: { studentName: entry.studentName, participantId: entry.participantId } })}><Trophy size={14} /> Lihat Ranking</button>
            </article>;
          })}
          <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={() => navigate('/ujian')}><RotateCcw size={15} /> Gunakan Kode Ujian Lain</button>
        </div>}
      </main>
    </div>
  );
}
