// ResultScreen — shown after student submits
import { useEffect, useState } from 'react';
import { CheckCircle, Clock, BookOpen, Home, History, Trophy } from 'lucide-react';
import { formatDateTime, calcMaxMCScore } from '../../../utils/helpers';
import { storage } from '../../../utils/storage';
import type { Exam, Submission, StudentRanking } from '../../../types';
import { studentSubmissionMessages } from '../../../utils/studentMessages';

interface Props {
  exam: Exam;
  submission: Submission;
  studentName: string;
}

const HISTORY_KEY = 'kuizku_student_history';

export default function ResultScreen({ exam, submission, studentName }: Props) {
  const hasEssay      = exam.format !== 'PG_ONLY';
  const finalReleased = !exam.settings.releaseResultsAfterGrading || exam.status === 'ENDED' || !hasEssay;
  const showScore     = exam.settings.showScoreAfterSubmit && finalReleased;
  const showAnswerKey = exam.settings.showAnswerKeyAfterSubmit && exam.status === 'ENDED';
  const maxMC         = calcMaxMCScore(exam);
  const hasShortAnswer = exam.questions.some(question => question.type === 'SHORT_ANSWER');
  const mcPct         = maxMC > 0 ? Math.round((submission.mcScore / maxMC) * 100) : 0;
  const [ranking, setRanking] = useState<StudentRanking | null>(null);

  useEffect(() => {
    if (!showScore) return;
    let cancelled = false;
    const loadRanking = () => storage.getStudentRanking(exam.code, submission.id, submission.nis).then(result => {
      if (!cancelled) setRanking(result);
    });

    // Essay scores may be completed after this page is opened. Refresh the
    // small ranking payload periodically without exposing it while grading is pending.
    void loadRanking();
    const refreshId = window.setInterval(() => { void loadRanking(); }, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, [exam.code, submission.id, submission.nis, showScore]);

  // ---- Save local student history ----
  useEffect(() => {
    // Riwayat murid adalah data perangkat ini. Submission dan nilai tetap
    // tersimpan aman di server melalui alur submit, bukan tabel riwayat publik.
    try {
      const existing = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      const localEntry = {
        id: submission.id,
        examId: exam.id,
        examTitle: exam.title,
        examSubject: exam.subject,
        examCode: exam.code,
        examType: exam.examType,
        studentName,
        nis: submission.nis,
        submittedAt: submission.submittedAt,
        mcScore: submission.mcScore,
        totalScore: submission.totalScore,
        maxMC,
      };
      const filtered = existing.filter((h: { id: string }) => h.id !== submission.id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify([localEntry, ...filtered].slice(0, 50)));
    } catch { /* ignore */ }
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 'var(--sp-4)', paddingTop: 'var(--sp-8)' }}>
      <div style={{ maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>

        {/* ---- Success Card ---- */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-8)', textAlign: 'center', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--sp-4)', border: '2px solid rgba(16,185,129,0.3)' }}>
            <CheckCircle size={36} style={{ color: 'var(--success)' }} />
          </div>

          <h1 style={{ fontSize: '1.5rem', marginBottom: 4 }}>Jawaban Terkumpul!</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)', fontSize: '0.875rem' }}>
            Ujian <strong style={{ color: 'var(--text-primary)' }}>{exam.title}</strong> telah berhasil dikumpulkan.
          </p>

          {/* Student info */}
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-6)', fontSize: '0.875rem', textAlign: 'left' }}>
            {[['Nama', studentName], ['NIS', submission.nis || '—'], ['Waktu Kumpul', submission.submittedAt ? formatDateTime(submission.submittedAt) : '—']].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          {/* Score */}
          {showScore ? (
            <div>
              {exam.format !== 'ESSAY_ONLY' && (
                <div style={{ marginBottom: 'var(--sp-4)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{hasShortAnswer ? 'Skor Otomatis' : 'Skor Pilihan Ganda'}</div>
                  <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
                    {submission.mcScore}<span style={{ fontSize: '1.2rem', color: 'var(--text-muted)', fontWeight: 400 }}>/{maxMC}</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden', margin: 'var(--sp-3) 0 var(--sp-1)' }}>
                    <div style={{ height: '100%', width: `${mcPct}%`, background: `linear-gradient(90deg, ${mcPct >= 70 ? 'var(--success)' : mcPct >= 40 ? 'var(--warning)' : 'var(--danger)'}, var(--primary))`, borderRadius: 'var(--r-full)', transition: 'width 1s ease' }} />
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{mcPct}% benar</div>
                </div>
              )}
              {hasEssay && (
                <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--secondary-light)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 'var(--r-md)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BookOpen size={16} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>{studentSubmissionMessages.essayPending}</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              <Clock size={16} style={{ display: 'inline', marginRight: 6 }} />
              {hasEssay ? studentSubmissionMessages.essayPending : finalReleased ? 'Nilai akan diumumkan oleh guru.' : 'Nilai final ditahan sampai guru menutup ujian.'}
            </div>
          )}

          {/* Teacher feedback */}
          {submission.teacherFeedback && (
            <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--primary-light)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 'var(--r-md)', textAlign: 'left' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>💬 Komentar Guru</div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0 }}>{submission.teacherFeedback}</p>
            </div>
          )}
        </div>

        {showScore && ranking?.available && (
          <div className="student-ranking-card">
            <div className="student-ranking-header">
              <div>
                <div className="student-ranking-eyebrow"><Trophy size={15} /> Ranking Kelas</div>
                <h2>Posisi Anda #{ranking.currentRank ?? '—'}</h2>
                <p>{ranking.totalParticipants ?? 0} peserta • peringkat berdasarkan hasil akhir</p>
              </div>
              <div className="student-ranking-medal">🏆</div>
            </div>
            <div className="student-ranking-list">
              {ranking.entries.slice(0, 10).map(entry => (
                <div key={`${entry.rank}-${entry.studentName}`} className={`student-ranking-row ${entry.isCurrent ? 'is-you' : ''}`}>
                  <span className="student-ranking-rank">{entry.rank}</span>
                  <span className="student-ranking-name">{entry.studentName}{entry.isCurrent && ' (Anda)'}</span>
                </div>
              ))}
              {ranking.currentRank != null && ranking.currentRank > 10 && (() => {
                const current = ranking.entries.find(entry => entry.isCurrent);
                return current ? <>
                  <div className="student-ranking-more">•••</div>
                  <div className="student-ranking-row is-you">
                    <span className="student-ranking-rank">{current.rank}</span>
                    <span className="student-ranking-name">{current.studentName} (Anda)</span>
                  </div>
                </> : null;
              })()}
            </div>
          </div>
        )}

        {showScore && ranking && !ranking.available && (
          <div className="student-ranking-unavailable">
            <Trophy size={18} /> Ranking belum tersedia untuk ujian ini.
          </div>
        )}

        {/* ---- Answer Review ---- */}
        {showAnswerKey && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-6)', boxShadow: 'var(--shadow-md)' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Review Jawaban
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              {exam.questions.map((q, idx) => {
                const ans = submission.answers.find(a => a.questionId === q.id);
                const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
                const isCorrect = q.type === 'MULTIPLE_CHOICE'
                  ? ans?.selectedOptionId === q.correctOptionId
                  : q.type === 'SHORT_ANSWER' && !!ans?.shortAnswer && (q.acceptedAnswers ?? []).some(value => normalize(value) === normalize(ans.shortAnswer!));
                const essayGrade = submission.essayScores.find(g => g.questionId === q.id);
                const borderColor = q.type === 'ESSAY' ? 'var(--secondary)' : isCorrect ? 'var(--success)' : 'var(--danger)';

                return (
                  <div key={q.id} style={{ padding: 'var(--sp-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', borderLeft: `3px solid ${borderColor}` }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                      Soal {idx + 1} · {q.weight} poin {q.type === 'ESSAY' ? '(Essay)' : q.type === 'SHORT_ANSWER' ? '(Jawaban Singkat)' : ''}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 'var(--sp-2)' }}>{q.text}</div>

                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)' }}>Jawaban Anda: </span>
                          <span style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>
                            {ans?.selectedOptionId ? q.options?.find(o => o.id === ans.selectedOptionId)?.text ?? '—' : <em>Tidak dijawab</em>}
                            {' '}{isCorrect ? '✓' : '✗'}
                          </span>
                        </div>
                        {!isCorrect && (
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Jawaban benar: </span>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                              {q.options?.find(o => o.id === q.correctOptionId)?.text ?? '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {q.type === 'SHORT_ANSWER' && (
                      <div style={{ fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Jawaban Anda: </span>
                        <span style={{ fontWeight: 600, color: isCorrect ? 'var(--success)' : 'var(--danger)' }}>{ans?.shortAnswer || '—'} {isCorrect ? '✓' : '✗'}</span>
                      </div>
                    )}

                    {q.type === 'ESSAY' && (
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>Jawaban Anda:</div>
                        <div style={{ padding: '6px 10px', background: 'var(--surface)', borderRadius: 'var(--r-sm)', color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                          {ans?.essayText || <em style={{ color: 'var(--text-muted)' }}>Tidak dijawab</em>}
                        </div>
                        {essayGrade && (
                          <div style={{ marginTop: 6 }}>
                            <span style={{ padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--secondary-light)', color: 'var(--secondary)', fontWeight: 600, fontSize: '0.75rem' }}>
                              Nilai: {essayGrade.score}/{q.weight}
                            </span>
                            {essayGrade.comment && <span style={{ marginLeft: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>{essayGrade.comment}</span>}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---- Actions ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <button className="btn btn-secondary w-full" style={{ justifyContent: 'center' }} onClick={() => window.location.href = '/ujian'}>
            <Home size={16} /> Selesai
          </button>
          <button className="btn btn-ghost w-full" style={{ justifyContent: 'center', fontSize: '0.8rem' }} onClick={() => window.location.href = '/riwayat'}>
            <History size={15} /> Lihat Riwayat Ujian Saya
          </button>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Terima kasih sudah mengerjakan ujian ini. 🎉
        </p>
      </div>
    </div>
  );
}
