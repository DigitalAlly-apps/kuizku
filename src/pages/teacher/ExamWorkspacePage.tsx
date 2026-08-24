import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart2, BookOpen, ClipboardList, Copy, Edit2, Eye, Settings, Users } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, SectionHeader, StatusBadge } from '../../components/ui';
import { calcMaxMCScore, calcMaxEssayScore, formatDateTime } from '../../utils/helpers';
import type { Submission } from '../../types';

type WorkspaceTab = 'ringkasan' | 'soal' | 'peserta' | 'hasil' | 'pengaturan';

function getTab(pathname: string): WorkspaceTab {
  const value = pathname.split('/').pop();
  return value === 'soal' || value === 'peserta' || value === 'hasil' || value === 'pengaturan' ? value : 'ringkasan';
}

function essayStatus(submission: Submission, essayCount: number): 'FINAL' | 'PARTIAL' | 'PENDING' | 'NONE' {
  if (essayCount === 0) return 'NONE';
  const count = submission.essayScores.length;
  if (count === 0) return 'PENDING';
  return count >= essayCount && submission.totalScore != null ? 'FINAL' : 'PARTIAL';
}

export default function ExamWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { exams, submissions, updateExam } = useApp();
  const { addToast } = useToast();
  const exam = exams.find(item => item.id === id);
  const tab = getTab(location.pathname);
  const examSubmissions = useMemo(() => submissions.filter(item => item.examId === id && item.isComplete), [submissions, id]);
  const essayCount = exam?.questions.filter(question => question.type === 'ESSAY').length ?? 0;
  const finalCount = examSubmissions.filter(item => essayStatus(item, essayCount) === 'FINAL' || essayStatus(item, essayCount) === 'NONE').length;
  const [attemptOverride, setAttemptOverride] = useState<number | null>(null);
  const [savingAttempts, setSavingAttempts] = useState(false);

  if (!exam) {
    return <div className="page-content"><EmptyState icon={<ClipboardList size={48} />} title="Ujian tidak ditemukan" description="Ujian mungkin sudah dihapus atau tidak dapat dimuat." /></div>;
  }

  const openTab = (nextTab: WorkspaceTab) => navigate(nextTab === 'ringkasan' ? `/guru/ujian/${exam.id}` : `/guru/ujian/${exam.id}/${nextTab}`);
  const copyCode = async () => {
    await navigator.clipboard.writeText(exam.code);
    addToast({ type: 'success', title: 'Kode ujian disalin' });
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/ujian/${exam.code}`);
    addToast({ type: 'success', title: 'Link ujian disalin' });
  };
  const maxAttempts = attemptOverride ?? exam.settings.maxAttempts ?? 1;
  const saveAttemptLimit = async () => {
    setSavingAttempts(true);
    const result = await updateExam(exam.id, { settings: { ...exam.settings, maxAttempts } });
    setSavingAttempts(false);
    if (result.error) {
      addToast({ type: 'error', title: 'Batas percobaan belum tersimpan', message: result.error });
      return;
    }
    setAttemptOverride(null);
    addToast({ type: 'success', title: 'Batas percobaan diperbarui', message: maxAttempts === 0 ? 'Murid sekarang boleh mengerjakan tanpa batas percobaan.' : `Maksimal ${maxAttempts} percobaan per murid.` });
  };

  return (
    <div className="page-content exam-workspace">
      <div className="exam-workspace-header">
        <div>
          <Link to="/guru/ujian" className="workspace-back-link">← Ujian Saya</Link>
          <div className="workspace-title-row"><h1>{exam.title}</h1><StatusBadge status={exam.status} /></div>
          <p>{exam.subject}{exam.className ? ` · ${exam.className}` : ''}</p>
        </div>
        <div className="exam-workspace-actions">
          <button className="btn btn-secondary" onClick={() => void copyCode()}><Copy size={15} /> Salin Kode</button>
          {exam.status === 'ACTIVE' && <button className="btn btn-primary" onClick={() => void copyLink()}><Users size={15} /> Bagikan</button>}
          <button className="btn btn-ghost" onClick={() => navigate(`/guru/ujian/${exam.id}/preview`)}><Eye size={15} /> Preview</button>
        </div>
      </div>

      <div className="workspace-code-strip"><span>Kode ujian</span><strong>{exam.code}</strong><button className="btn btn-ghost btn-sm" onClick={() => void copyCode()}><Copy size={14} /></button></div>

      <nav className="workspace-tabs" aria-label="Menu ujian">
        {([
          ['ringkasan', ClipboardList, 'Ringkasan'], ['soal', BookOpen, 'Soal'], ['peserta', Users, 'Peserta'], ['hasil', BarChart2, 'Hasil'], ['pengaturan', Settings, 'Pengaturan'],
        ] as const).map(([value, Icon, label]) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => openTab(value)}><Icon size={16} /> {label}</button>)}
      </nav>

      {tab === 'ringkasan' && <SummaryTab exam={exam} submissions={examSubmissions} finalCount={finalCount} essayCount={essayCount} onOpenTab={openTab} />}
      {tab === 'soal' && <QuestionsTab exam={exam} onEdit={() => navigate(`/guru/ujian/${exam.id}/edit-soal`)} onPreview={() => navigate(`/guru/ujian/${exam.id}/preview`)} />}
      {tab === 'peserta' && <ParticipantsTab submissions={examSubmissions} essayCount={essayCount} />}
      {tab === 'hasil' && <ResultsTab exam={exam} submissions={examSubmissions} essayCount={essayCount} onGrade={() => navigate(`/guru/hasil?exam=${exam.id}`)} />}
      {tab === 'pengaturan' && (
        <section className="card">
          <SectionHeader title="Pengaturan pengerjaan" subtitle="Pengaturan ini boleh diubah meskipun ujian sedang aktif." />
          <div className="form-group" style={{ maxWidth: 360 }}>
            <label className="form-label" htmlFor="workspace-max-attempts">Maksimal percobaan per murid</label>
            <select id="workspace-max-attempts" className="form-select" value={maxAttempts} onChange={event => setAttemptOverride(Number(event.target.value))}>
              <option value={1}>1 kali</option>
              <option value={2}>2 kali</option>
              <option value={3}>3 kali</option>
              <option value={5}>5 kali</option>
              <option value={0}>Tidak terbatas</option>
            </select>
            <span className="form-hint">Hanya submission yang berhasil dikumpulkan yang menghabiskan jatah. Draft/autosave dan submit gagal tidak dihitung sebagai percobaan selesai.</span>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={savingAttempts || maxAttempts === (exam.settings.maxAttempts ?? 1)} onClick={() => void saveAttemptLimit()}>
              {savingAttempts ? 'Menyimpan...' : 'Simpan Batas Percobaan'}
            </button>
            <button className="btn btn-secondary" onClick={() => navigate(`/guru/ujian/${exam.id}/edit-soal`)}>Edit Soal</button>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryTab({ exam, submissions, finalCount, essayCount, onOpenTab }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; submissions: Submission[]; finalCount: number; essayCount: number; onOpenTab: (tab: WorkspaceTab) => void }) {
  return <>
    <div className="workspace-summary-grid">
      <div><span>Soal</span><strong>{exam.questions.length}</strong></div>
      <div><span>Peserta masuk</span><strong>{submissions.length}</strong></div>
      <div><span>Selesai dinilai</span><strong>{finalCount}</strong></div>
      <div><span>Nilai maksimal</span><strong>{exam.questions.reduce((sum, q) => sum + q.weight, 0)}</strong></div>
    </div>
    <div className="workspace-section-grid">
      <section className="card"><SectionHeader title="Progress peserta" subtitle="Data berdasarkan jawaban yang sudah tersimpan di server." />
        <div className="workspace-progress-row"><strong>{submissions.length}</strong><span>jawaban masuk</span></div>
        <div className="workspace-progress-bar"><span style={{ width: submissions.length ? '100%' : '0%' }} /></div>
        <p className="workspace-muted">{essayCount > 0 ? `${submissions.filter(s => essayStatus(s, essayCount) !== 'FINAL').length} peserta masih menunggu koreksi essay.` : 'Ujian ini dinilai otomatis.'}</p>
      </section>
      <section className="card"><SectionHeader title="Aksi utama" subtitle="Pilih pekerjaan yang ingin dilakukan." />
        <div className="workspace-action-list"><button onClick={() => onOpenTab('soal')}><BookOpen size={18} /> Kelola soal</button><button onClick={() => onOpenTab('peserta')}><Users size={18} /> Lihat peserta</button><button onClick={() => onOpenTab('hasil')}><BarChart2 size={18} /> Buka hasil</button></div>
      </section>
    </div>
  </>;
}

function QuestionsTab({ exam, onEdit, onPreview }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; onEdit: () => void; onPreview: () => void }) {
  return <section className="card"><SectionHeader title="Soal ujian" subtitle={`${exam.questions.length} soal · Maks. ${exam.questions.reduce((sum, q) => sum + q.weight, 0)} poin`} action={<div className="workspace-tab-actions"><button className="btn btn-secondary" onClick={onPreview}><Eye size={14} /> Preview</button><button className="btn btn-primary" onClick={onEdit}><Edit2 size={14} /> Edit Soal</button></div>} />
    <div className="workspace-question-list">{exam.questions.map((question, index) => <div className="workspace-question-row" key={question.id}><strong>{index + 1}</strong><span className={`badge ${question.type === 'ESSAY' ? 'badge-essay' : 'badge-pg'}`}>{question.type === 'MULTIPLE_CHOICE' ? 'PG' : question.type === 'SHORT_ANSWER' ? 'Jawaban Singkat' : 'Essay'}</span><p>{question.text}</p><span>{question.weight} poin</span><button className="btn btn-ghost btn-icon" onClick={onEdit} aria-label={`Edit soal ${index + 1}`}><Edit2 size={14} /></button></div>)}</div>
  </section>;
}

function ParticipantsTab({ submissions, essayCount }: { submissions: Submission[]; essayCount: number }) {
  return <section className="card"><SectionHeader title="Peserta" subtitle={`${submissions.length} jawaban yang sudah masuk`} /><div className="workspace-participant-list">{submissions.length === 0 ? <EmptyState icon={<Users size={40} />} title="Belum ada peserta" description="Bagikan kode ujian kepada murid." /> : submissions.map(sub => <div className="workspace-participant-row" key={sub.id}><div><strong>{sub.studentName}</strong><span>NIS {sub.nis} · Percobaan ke-{sub.attemptNumber}</span></div><span className={`workspace-status status-${essayStatus(sub, essayCount).toLowerCase()}`}>{essayStatus(sub, essayCount) === 'NONE' ? 'Nilai Final' : essayStatus(sub, essayCount) === 'FINAL' ? 'Nilai Final' : essayStatus(sub, essayCount) === 'PARTIAL' ? 'Dinilai Sebagian' : 'Menunggu Koreksi'}</span><span>{sub.submittedAt ? formatDateTime(sub.submittedAt) : '—'}</span></div>)}</div></section>;
}

function ResultsTab({ exam, submissions, essayCount, onGrade }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; submissions: Submission[]; essayCount: number; onGrade: () => void }) {
  const maxAuto = calcMaxMCScore(exam); const maxEssay = calcMaxEssayScore(exam);
  return <section className="card"><SectionHeader title="Hasil ujian" subtitle="Nilai sementara tidak ditampilkan sebagai nilai final." action={essayCount > 0 ? <button className="btn btn-primary" onClick={onGrade}><Edit2 size={14} /> Koreksi Essay</button> : undefined} /><div className="workspace-results-list">{submissions.map(sub => { const status = essayStatus(sub, essayCount); return <div className="workspace-result-row" key={sub.id}><strong>{sub.studentName}</strong><span>{sub.mcScore}/{maxAuto} PG</span><span>{essayCount ? `${sub.essayScores.reduce((sum, grade) => sum + grade.score, 0)}/${maxEssay} Essay` : '—'}</span><strong>{status === 'FINAL' || status === 'NONE' ? `${sub.totalScore ?? 0}/${maxAuto + maxEssay}` : 'Belum final'}</strong><span className={`workspace-status status-${status.toLowerCase()}`}>{status === 'FINAL' || status === 'NONE' ? 'FINAL' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING ESSAY'}</span></div>; })}</div></section>;
}
