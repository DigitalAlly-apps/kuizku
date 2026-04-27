// Step 5 — Publish & Share
import { useState } from 'react';
import { CheckCircle, Copy, Share2, ExternalLink, Eye } from 'lucide-react';
import { useApp, useToast } from '../../../context/AppContext';
import type { Exam } from '../../../types';

interface Props {
  exam: Exam;
  onFinish: () => void;
}

export default function Step5Publish({ exam, onFinish }: Props) {
  const { publishExam } = useApp();
  const { addToast } = useToast();
  const [published, setPublished] = useState(false);

  const examUrl = `${window.location.origin}/ujian/${exam.code}`;

  const copyCode = () => {
    navigator.clipboard.writeText(exam.code);
    addToast({ type: 'success', title: 'Kode disalin!', message: `Kode ujian: ${exam.code}` });
  };

  const copyLink = () => {
    navigator.clipboard.writeText(examUrl);
    addToast({ type: 'success', title: 'Link disalin!' });
  };

  const handlePublish = () => {
    publishExam(exam.id);
    setPublished(true);
    addToast({ type: 'success', title: '🎉 Ujian dipublikasikan!', message: 'Murid sekarang bisa mengerjakan dengan kode di atas.' });
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--sp-4)' }}>
          <CheckCircle size={32} style={{ color: 'var(--success)' }} />
        </div>
        <h2>Ujian Berhasil Dibuat!</h2>
        <p style={{ color: 'var(--text-muted)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>{exam.title}</strong> — {exam.questions.length} soal, format{' '}
          {exam.format === 'PG_ONLY' ? 'Pilihan Ganda' : exam.format === 'ESSAY_ONLY' ? 'Essay' : 'PG + Essay'}
        </p>
      </div>

      {/* Exam code */}
      <div style={{ maxWidth: 360, margin: '0 auto var(--sp-6)' }}>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-2)' }}>Kode Ujian untuk Murid:</p>
        <div className="exam-code-display">
          <div className="exam-code-text">{exam.code}</div>
          <button className="btn btn-ghost btn-icon" onClick={copyCode} title="Salin kode">
            <Copy size={18} />
          </button>
        </div>
      </div>

      {/* Link */}
      <div style={{ maxWidth: 480, margin: '0 auto var(--sp-6)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {examUrl}
        </span>
        <button className="btn btn-secondary btn-sm" onClick={copyLink}><Copy size={13} /> Salin</button>
      </div>

      {/* Share tips */}
      <div style={{ maxWidth: 420, margin: '0 auto var(--sp-8)', padding: 'var(--sp-4)', background: 'var(--primary-light)', borderRadius: 'var(--r-lg)', border: '1px solid rgba(79,110,247,0.2)', textAlign: 'left' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--primary)', marginBottom: 'var(--sp-2)' }}>💡 Tips Berbagi ke Murid</p>
        <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {['Bagikan kode 6 digit via WhatsApp atau papan tulis', 'Atau bagikan link di atas langsung ke murid', 'Murid tidak perlu daftar akun — cukup input nama & NIS'].map(tip => (
            <li key={tip} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{tip}</li>
          ))}
        </ul>
      </div>

      {/* Publish button */}
      {!published ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <button className="btn btn-success btn-lg" onClick={handlePublish}>
            <Share2 size={16} /> Publikasikan Sekarang
          </button>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Ujian masih Draft. Publikasikan agar murid bisa mengerjakan.
          </p>
          <button className="btn btn-ghost" onClick={onFinish}>Simpan sebagai Draft, nanti dipublikasikan</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <div style={{ padding: '10px 20px', background: 'var(--success-light)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--r-lg)', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} /> Ujian Aktif — Murid bisa mengerjakan sekarang!
          </div>
          <button className="btn btn-primary btn-lg" onClick={onFinish}>
            Kembali ke Daftar Ujian
          </button>
        </div>
      )}
    </div>
  );
}
