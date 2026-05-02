// StudentHistoryPage — Riwayat ujian murid (dari localStorage)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, FileText, Award, BookOpen, History, ArrowRight, Trash2, RotateCcw, Search } from 'lucide-react';
import { storage } from '../../utils/storage';
import { calcMaxMCScore } from '../../utils/helpers';

interface HistoryEntry {
  id: string;
  examTitle: string;
  examSubject: string;
  examCode: string;
  examType?: string;
  studentName: string;
  nis: string;
  submittedAt?: string;
  mcScore: number;
  totalScore?: number;
  maxMC: number;
}

const HISTORY_KEY = 'kuizku_student_history';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getScoreColor(score: number, max: number) {
  if (max === 0) return 'var(--text-muted)';
  const pct = (score / max) * 100;
  if (pct >= 70) return 'var(--success)';
  if (pct >= 40) return 'var(--warning)';
  return 'var(--danger)';
}

function TypeBadge({ type }: { type?: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    UJIAN:   { label: '📝 Ujian',   color: 'var(--danger)',  bg: 'var(--danger-light)' },
    TUGAS:   { label: '📋 Tugas',   color: 'var(--warning)', bg: 'var(--warning-light)' },
    LATIHAN: { label: '🎯 Latihan', color: 'var(--success)', bg: 'var(--success-light)' },
  };
  const c = map[type ?? 'UJIAN'] ?? map['UJIAN'];
  return (
    <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: c.bg, color: c.color, fontWeight: 700 }}>
      {c.label}
    </span>
  );
}

export default function StudentHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [onlineHistory, setOnlineHistory] = useState<HistoryEntry[]>([]);
  const [name, setName] = useState('');
  const [lookupCode, setLookupCode] = useState('');
  const [lookupNis, setLookupNis] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') as HistoryEntry[];
      setHistory(h);
      if (h.length > 0) setName(h[0].studentName);
    } catch {}
  }, []);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const loadOnlineHistory = async () => {
    setLookupError('');
    const code = lookupCode.trim().toUpperCase();
    const nis = lookupNis.trim();
    if (code.length !== 6 || !nis) { setLookupError('Masukkan kode ujian 6 karakter dan NIS/ID.'); return; }
    setLookupLoading(true);
    const exam = await storage.getExamByCode(code);
    if (!exam) {
      setLookupLoading(false);
      setLookupError('Kode ujian tidak ditemukan.');
      return;
    }
    const subs = (await storage.getSubmissionsByExam(exam.id)).filter(s => s.nis === nis && s.isComplete);
    setOnlineHistory(subs.map(s => ({
      id: s.id,
      examTitle: exam.title,
      examSubject: exam.subject,
      examCode: exam.code,
      examType: exam.examType,
      studentName: s.studentName,
      nis: s.nis,
      submittedAt: s.submittedAt,
      mcScore: s.mcScore,
      totalScore: s.totalScore,
      maxMC: calcMaxMCScore(exam),
    })));
    setName(subs[0]?.studentName ?? name);
    setLookupLoading(false);
    if (subs.length === 0) setLookupError('Belum ada hasil online untuk NIS/ID ini.');
  };

  const visibleHistory = onlineHistory.length > 0 ? onlineHistory : history;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: 'var(--sp-4) var(--sp-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg, var(--primary), var(--secondary))', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>⚡</div>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: '1.2rem', background: 'linear-gradient(135deg, var(--primary), var(--secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>KuizKu</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => navigate('/ujian')}>
          <ArrowRight size={14} /> Kerjakan Ujian
        </button>
      </div>

      <div style={{ maxWidth: 600, width: '100%', margin: '0 auto', padding: 'var(--sp-6) var(--sp-4)' }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-6)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={22} style={{ color: 'var(--primary)', flexShrink: 0 }} /> Riwayat Ujian
            </h1>
            {name && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Sebagai: <strong style={{ color: 'var(--text-primary)' }}>{name}</strong>
              </p>
            )}
          </div>
          {history.length > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearHistory} style={{ color: 'var(--danger)', flexShrink: 0 }}>
              <Trash2 size={14} /> Hapus
            </button>
          )}
        </div>

        <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-3)' }}>Cari Riwayat Online</h3>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
            <input className="form-input" style={{ flex: '1 1 140px' }} placeholder="Kode ujian" maxLength={6}
              value={lookupCode} onChange={e => setLookupCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} />
            <input className="form-input" style={{ flex: '1 1 180px' }} placeholder="NIS/NISN/ID" value={lookupNis} onChange={e => setLookupNis(e.target.value)} />
            <button className="btn btn-primary" onClick={loadOnlineHistory} disabled={lookupLoading}>
              <Search size={14} /> {lookupLoading ? 'Mencari...' : 'Cari'}
            </button>
          </div>
          {lookupError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: 8 }}>{lookupError}</p>}
        </div>

        {visibleHistory.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-4)' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 'var(--sp-4)' }}>📚</div>
            <h3 style={{ marginBottom: 8 }}>Belum ada riwayat</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--sp-5)' }}>
              Riwayat ujian yang Anda kerjakan akan muncul di sini secara otomatis setelah mengumpulkan jawaban.
            </p>
            <button className="btn btn-primary" onClick={() => navigate('/ujian')}>
              <ArrowRight size={16} /> Kerjakan Ujian Sekarang
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {visibleHistory.map(entry => {
              const scoreColor = getScoreColor(entry.mcScore, entry.maxMC);
              const pct = entry.maxMC > 0 ? Math.round((entry.mcScore / entry.maxMC) * 100) : null;
              return (
                <div key={entry.id} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-lg)', padding: 'var(--sp-4) var(--sp-5)',
                  transition: 'box-shadow 0.2s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 'var(--sp-3)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <TypeBadge type={entry.examType} />
                        <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>#{entry.examCode}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.examTitle}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.examSubject}</div>
                    </div>
                    {pct !== null && (
                      <div style={{ textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{pct}%</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>skor PG</div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', fontSize: '0.78rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Award size={13} style={{ color: scoreColor }} />
                      <span style={{ color: scoreColor, fontWeight: 600 }}>{entry.mcScore}</span>/{entry.maxMC} poin PG
                    </span>
                    {entry.totalScore !== undefined && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <BookOpen size={13} /> Total: {entry.totalScore}
                      </span>
                    )}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={13} /> {formatDate(entry.submittedAt)}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
                      <FileText size={13} /> {entry.nis || entry.studentName}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Back button */}
            <button className="btn btn-secondary" style={{ justifyContent: 'center', marginTop: 'var(--sp-2)' }} onClick={() => navigate('/ujian')}>
              <RotateCcw size={15} /> Kerjakan Ujian Lagi
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
