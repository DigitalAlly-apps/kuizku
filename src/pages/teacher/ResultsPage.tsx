import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Download, ChevronDown, CheckCircle, Clock, User, Edit2, BarChart2 } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, FormatBadge, StatusBadge, SectionHeader, Modal } from '../../components/ui';
import { calcMaxMCScore, calcMaxEssayScore, calcMaxTotalScore, formatDateTime } from '../../utils/helpers';
import * as XLSX from 'xlsx';
import type { Exam, Submission } from '../../types';

const optLetters = 'ABCDEF';

export default function ResultsPage() {
  const { currentTeacher, exams, submissions, gradeEssay } = useApp();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const myExams = useMemo(() => exams.filter(e => e.teacherId === currentTeacher?.id && e.status !== 'DRAFT'), [exams, currentTeacher]);
  const [selectedExamId, setSelectedExamId] = useState<string>(searchParams.get('exam') ?? (myExams[0]?.id ?? ''));
  const [detailSub, setDetailSub] = useState<Submission | null>(null);
  const [gradingMode, setGradingMode] = useState(false);
  const [gradingScores, setGradingScores] = useState<Record<string, { score: number; comment: string }>>({});

  const selectedExam = useMemo(() => myExams.find(e => e.id === selectedExamId), [myExams, selectedExamId]);
  const examSubs = useMemo(() => submissions.filter(s => s.examId === selectedExamId && s.isComplete), [submissions, selectedExamId]);

  const maxMC = selectedExam ? calcMaxMCScore(selectedExam) : 0;
  const maxEssay = selectedExam ? calcMaxEssayScore(selectedExam) : 0;
  const maxTotal = maxMC + maxEssay;

  const avgTotal = useMemo(() => {
    if (!examSubs.length) return 0;
    const total = examSubs.reduce((s, sub) => {
      const essayTotal = sub.essayScores.reduce((a, g) => a + g.score, 0);
      return s + sub.mcScore + essayTotal;
    }, 0);
    return Math.round(total / examSubs.length);
  }, [examSubs]);

  const startGrading = (sub: Submission) => {
    setDetailSub(sub);
    const init: Record<string, { score: number; comment: string }> = {};
    sub.essayScores.forEach(g => { init[g.questionId] = { score: g.score, comment: g.comment ?? '' }; });
    setGradingScores(init);
    setGradingMode(true);
  };

  const saveGrading = () => {
    if (!detailSub) return;
    Object.entries(gradingScores).forEach(([qId, { score, comment }]) => {
      gradeEssay(detailSub.id, qId, score, comment);
    });
    addToast({ type: 'success', title: 'Nilai essay disimpan!' });
    setGradingMode(false);
    setDetailSub(null);
  };

  const exportExcel = () => {
    if (!selectedExam) return;
    const rows = examSubs.map((s, i) => {
      const essayTotal = s.essayScores.reduce((a, g) => a + g.score, 0);
      return [i + 1, s.studentName, s.nis, s.attemptNumber, s.submittedAt ? formatDateTime(s.submittedAt) : '-', s.mcScore, essayTotal, s.mcScore + essayTotal, maxMC, maxEssay, maxTotal];
    });
    const ws = XLSX.utils.aoa_to_sheet([
      ['No','Nama','NIS','Percobaan','Waktu Submit','Skor PG','Skor Essay','Total','Maks PG','Maks Essay','Maks Total'],
      ...rows,
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap');
    XLSX.writeFile(wb, `rekap_${selectedExam.title.replace(/\s+/g, '_')}.xlsx`);
    addToast({ type: 'success', title: 'Rekap diexport ke Excel!' });
  };

  // Question analytics
  const questionAnalytics = useMemo(() => {
    if (!selectedExam) return [];
    return selectedExam.questions.map(q => {
      if (q.type !== 'MULTIPLE_CHOICE') return null;
      const answered = examSubs.filter(s => s.answers.some(a => a.questionId === q.id));
      const correct = examSubs.filter(s => s.answers.some(a => a.questionId === q.id && a.selectedOptionId === q.correctOptionId));
      const pct = answered.length ? Math.round((correct.length / answered.length) * 100) : 0;
      return { question: q, answered: answered.length, correct: correct.length, pct };
    }).filter(Boolean);
  }, [selectedExam, examSubs]);

  if (myExams.length === 0) {
    return (
      <div className="page-content">
        <div className="page-header"><h1>Hasil & Nilai</h1></div>
        <div className="card">
          <EmptyState icon={<BarChart2 size={48} />} title="Belum ada ujian yang selesai"
            description="Publikasikan ujian dan tunggu murid mengerjakan untuk melihat hasil." />
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 'var(--sp-6)' }}>
        <h1>Hasil & Nilai</h1>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center' }}>
          <select className="form-select" value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} id="result-exam-select" style={{ minWidth: 280 }}>
            {myExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {examSubs.length > 0 && (
            <button className="btn btn-secondary" onClick={exportExcel}><Download size={15} /> Export Excel</button>
          )}
        </div>
      </div>

      {selectedExam && (
        <>
          {/* Exam info */}
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
            <FormatBadge format={selectedExam.format} />
            <StatusBadge status={selectedExam.status} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{selectedExam.questions.length} soal • Maks. {maxTotal} poin</span>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-8)' }}>
            {[
              { label: 'Total Peserta', value: examSubs.length, color: 'var(--primary)' },
              { label: 'Rata-rata Nilai', value: avgTotal || '—', color: 'var(--success)' },
              { label: 'Maks. Poin', value: maxTotal, color: 'var(--accent)' },
              { label: 'Essay Dinilai', value: `${examSubs.filter(s => s.essayScores.length > 0).length}/${examSubs.length}`, color: 'var(--warning)' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                <div className="stat-card-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Participant Table */}
          <SectionHeader title="Daftar Peserta" subtitle={`${examSubs.length} jawaban masuk`} />
          {examSubs.length === 0 ? (
            <div className="card">
              <EmptyState icon={<User size={48} />} title="Belum ada peserta" description="Bagikan kode ujian ke murid agar mereka bisa mengerjakan." />
            </div>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 'var(--sp-8)' }}>
              <table>
                <thead>
                  <tr>
                    <th>No</th><th>Nama</th><th>NIS</th><th>Percobaan</th>
                    {selectedExam.format !== 'ESSAY_ONLY' && <th>Skor PG</th>}
                    {selectedExam.format !== 'PG_ONLY' && <th>Skor Essay</th>}
                    <th>Total</th><th>Waktu Submit</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {examSubs.map((sub, i) => {
                    const essayTotal = sub.essayScores.reduce((a, g) => a + g.score, 0);
                    const total = sub.mcScore + essayTotal;
                    const needsGrading = selectedExam.format !== 'PG_ONLY' &&
                      sub.essayScores.length < selectedExam.questions.filter(q => q.type === 'ESSAY').length;
                    return (
                      <tr key={sub.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600 }}>{sub.studentName}</td>
                        <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{sub.nis}</td>
                        <td style={{ textAlign: 'center' }}>{sub.attemptNumber}</td>
                        {selectedExam.format !== 'ESSAY_ONLY' && (
                          <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--primary)' }}>
                            {sub.mcScore}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{maxMC}</span>
                          </td>
                        )}
                        {selectedExam.format !== 'PG_ONLY' && (
                          <td style={{ textAlign: 'center' }}>
                            {needsGrading
                              ? <span style={{ color: 'var(--warning)', fontSize: '0.78rem' }}>Belum dinilai</span>
                              : <span style={{ fontWeight: 600, color: 'var(--secondary)' }}>{essayTotal}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/{maxEssay}</span></span>
                            }
                          </td>
                        )}
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>
                          {total}<span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.8rem' }}>/{maxTotal}</span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {sub.submittedAt ? formatDateTime(sub.submittedAt) : '—'}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-ghost btn-sm btn-icon" title="Detail" onClick={() => { setDetailSub(sub); setGradingMode(false); }}>
                              <BarChart2 size={14} />
                            </button>
                            {selectedExam.format !== 'PG_ONLY' && (
                              <button className="btn btn-ghost btn-sm btn-icon" title="Nilai Essay" onClick={() => startGrading(sub)}
                                style={{ color: needsGrading ? 'var(--warning)' : 'var(--text-muted)' }}>
                                <Edit2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Analytics */}
          {questionAnalytics.length > 0 && (
            <>
              <SectionHeader title="Analitik Soal PG" subtitle="Persentase murid yang menjawab benar per soal" />
              <div className="card">
                {(questionAnalytics as NonNullable<typeof questionAnalytics[0]>[]).map((item, i) => (
                  <div key={item!.question.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) 0', borderBottom: i < questionAnalytics.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 28, textAlign: 'right', flexShrink: 0 }}>{i + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>
                        {item!.question.text}
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-2)', borderRadius: 'var(--r-full)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item!.pct}%`, background: item!.pct >= 70 ? 'var(--success)' : item!.pct >= 40 ? 'var(--warning)' : 'var(--danger)', borderRadius: 'var(--r-full)', transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700, width: 50, textAlign: 'right', flexShrink: 0, color: item!.pct >= 70 ? 'var(--success)' : item!.pct >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
                      {item!.pct}%
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {item!.correct}/{item!.answered}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* Detail / Grading Modal */}
      <Modal open={!!detailSub} onClose={() => { setDetailSub(null); setGradingMode(false); }}
        title={gradingMode ? `Nilai Essay — ${detailSub?.studentName}` : `Detail Jawaban — ${detailSub?.studentName}`}
        size="xl"
        footer={gradingMode ? (
          <><button className="btn btn-secondary" onClick={() => setGradingMode(false)}>Batal</button>
            <button className="btn btn-primary" onClick={saveGrading}>Simpan Nilai</button></>
        ) : undefined}>
        {detailSub && selectedExam && (
          <div>
            {selectedExam.questions.map((q, idx) => {
              const answer = detailSub.answers.find(a => a.questionId === q.id);
              const grade = gradingScores[q.id] ?? detailSub.essayScores.find(g => g.questionId === q.id);
              const isCorrect = q.type === 'MULTIPLE_CHOICE' && answer?.selectedOptionId === q.correctOptionId;

              if (gradingMode && q.type !== 'ESSAY') return null;

              return (
                <div key={q.id} style={{ padding: 'var(--sp-4) 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', paddingTop: 3, flexShrink: 0 }}>{idx + 1}.</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: 'var(--sp-2)' }}>{q.text}</div>

                      {q.type === 'MULTIPLE_CHOICE' && (
                        <>
                          <div style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Jawaban: </span>
                            {answer?.selectedOptionId
                              ? q.options?.find(o => o.id === answer.selectedOptionId)?.text ?? '—'
                              : <em style={{ color: 'var(--text-muted)' }}>Tidak dijawab</em>}
                          </div>
                          <div style={{ fontSize: '0.8rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Kunci: </span>
                            {q.options?.find(o => o.id === q.correctOptionId)?.text}
                          </div>
                          <div style={{ marginTop: 4 }}>
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--r-full)', background: isCorrect ? 'var(--success-light)' : 'var(--danger-light)', color: isCorrect ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                              {isCorrect ? '✓ Benar' : '✗ Salah'} ({isCorrect ? q.weight : 0}/{q.weight} poin)
                            </span>
                          </div>
                        </>
                      )}

                      {q.type === 'ESSAY' && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>Jawaban Murid:</div>
                          <div style={{ padding: 'var(--sp-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', fontSize: '0.875rem', color: 'var(--text-primary)', minHeight: 60, marginBottom: 'var(--sp-3)' }}>
                            {answer?.essayText || <em style={{ color: 'var(--text-muted)' }}>Tidak dijawab</em>}
                          </div>
                          {q.answerGuide && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)', padding: '6px 10px', background: 'var(--primary-light)', borderRadius: 'var(--r-sm)' }}>
                              <strong>Panduan:</strong> {q.answerGuide}
                            </div>
                          )}
                          {gradingMode && (
                            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div className="form-group" style={{ width: 120 }}>
                                <label className="form-label">Nilai (maks. {q.weight})</label>
                                <input type="number" className="form-input" min={0} max={q.weight}
                                  value={gradingScores[q.id]?.score ?? 0}
                                  onChange={e => setGradingScores(prev => ({ ...prev, [q.id]: { ...prev[q.id], score: parseFloat(e.target.value) || 0 } }))} />
                              </div>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Komentar (opsional)</label>
                                <input type="text" className="form-input" placeholder="Komentar untuk murid..."
                                  value={gradingScores[q.id]?.comment ?? ''}
                                  onChange={e => setGradingScores(prev => ({ ...prev, [q.id]: { ...prev[q.id], comment: e.target.value } }))} />
                              </div>
                            </div>
                          )}
                          {!gradingMode && grade && 'score' in grade && (
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 'var(--r-full)', background: 'var(--secondary-light)', color: 'var(--secondary)', fontWeight: 600 }}>
                              Nilai: {grade.score}/{q.weight} poin
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
