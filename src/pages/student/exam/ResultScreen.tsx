// ResultScreen — shown after student submits
import { CheckCircle, Clock, BookOpen, Home } from 'lucide-react';
import { formatDateTime, calcMaxMCScore, calcMaxEssayScore } from '../../../utils/helpers';
import type { Exam, Submission } from '../../../types';

interface Props {
  exam: Exam;
  submission: Submission;
  studentName: string;
}

export default function ResultScreen({ exam, submission, studentName }: Props) {
  const showScore = exam.settings.showScoreAfterSubmit;
  const hasEssay = exam.format !== 'PG_ONLY';
  const maxMC = calcMaxMCScore(exam);
  const maxEssay = calcMaxEssayScore(exam);
  const maxTotal = maxMC + maxEssay;

  const mcPct = maxMC > 0 ? Math.round((submission.mcScore / maxMC) * 100) : 0;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--sp-4)' }}>
      <div style={{ maxWidth: 500, width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {/* Success card */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border-strong)',
          borderRadius: 'var(--r-xl)', padding: 'var(--sp-10)', textAlign: 'center',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'var(--success-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--sp-4)',
            border: '2px solid rgba(16,185,129,0.3)',
          }}>
            <CheckCircle size={36} style={{ color: 'var(--success)' }} />
          </div>

          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Jawaban Terkumpul!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)', fontSize: '0.875rem' }}>
            Ujian <strong style={{ color: 'var(--text-primary)' }}>{exam.title}</strong> telah berhasil dikumpulkan.
          </p>

          {/* Student info */}
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-6)', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>Nama</span>
              <span style={{ fontWeight: 600 }}>{studentName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>NIS</span>
              <span style={{ fontFamily: 'monospace' }}>{submission.nis}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Waktu Kumpul</span>
              <span>{submission.submittedAt ? formatDateTime(submission.submittedAt) : '—'}</span>
            </div>
          </div>

          {/* Score display */}
          {showScore ? (
            <div>
              {exam.format !== 'ESSAY_ONLY' && (
                <div style={{ marginBottom: 'var(--sp-4)' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Skor Pilihan Ganda
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                    {submission.mcScore}
                    <span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}>/{maxMC}</span>
                  </div>
                  {/* Score bar */}
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden', marginTop: 'var(--sp-3)' }}>
                    <div style={{
                      height: '100%', width: `${mcPct}%`,
                      background: `linear-gradient(90deg, ${mcPct >= 70 ? 'var(--success)' : mcPct >= 40 ? 'var(--warning)' : 'var(--danger)'}, var(--primary))`,
                      borderRadius: 'var(--r-full)',
                      transition: 'width 1s ease',
                    }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>{mcPct}% benar</div>
                </div>
              )}

              {hasEssay && (
                <div style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  background: 'var(--secondary-light)',
                  border: '1px solid rgba(124,58,237,0.2)',
                  borderRadius: 'var(--r-md)', fontSize: '0.875rem',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <BookOpen size={16} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Soal essay akan dinilai oleh guru secara manual. Nilai essay akan muncul setelah guru menyelesaikan penilaian.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: 'var(--sp-4)',
              background: 'var(--surface-2)', borderRadius: 'var(--r-md)',
              fontSize: '0.875rem', color: 'var(--text-muted)',
            }}>
              <Clock size={16} style={{ display: 'inline', marginRight: 6 }} />
              Nilai akan diumumkan oleh guru.
            </div>
          )}
        </div>

        {/* Back button */}
        <button
          className="btn btn-secondary w-full"
          style={{ justifyContent: 'center' }}
          onClick={() => window.location.href = '/ujian'}
        >
          <Home size={16} /> Selesai
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Terima kasih sudah mengerjakan ujian ini. 🎉
        </p>
      </div>
    </div>
  );
}
