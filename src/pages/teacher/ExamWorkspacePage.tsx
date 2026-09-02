import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { BarChart2, BookOpen, ClipboardList, Copy, Edit2, Eye, Settings, Users } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, SectionHeader, StatusBadge } from '../../components/ui';
import { calcMaxMCScore, calcMaxEssayScore, formatDateTime } from '../../utils/helpers';
import { matchRosterToCompletedSubmissions } from '../../utils/participantAttendance';
import Step1Setup from './wizard/Step1Setup';
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
  const [savingSettings, setSavingSettings] = useState(false);

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
  const saveFullSettings = async (next: {
    title: string;
    description: string;
    subject: string;
    className?: string;
    activeFrom: string;
    activeTo: string;
    settings: typeof exam.settings;
    examType: typeof exam.examType;
    preloadedStudents: typeof exam.preloadedStudents;
  }) => {
    setSavingSettings(true);
    const result = await updateExam(exam.id, {
      title: next.title.trim(),
      description: next.description,
      subject: next.subject.trim(),
      className: next.className,
      examType: next.examType,
      activeFrom: next.activeFrom,
      activeTo: next.activeTo,
      settings: next.settings,
      preloadedStudents: next.preloadedStudents,
    });
    setSavingSettings(false);
    if (result.error) {
      addToast({ type: 'error', title: 'Pengaturan belum tersimpan', message: result.error });
      return;
    }
    setAttemptOverride(null);
    addToast({ type: 'success', title: 'Pengaturan ujian diperbarui', message: 'Judul, jadwal, peserta, dan pengaturan pengerjaan sudah disimpan.' });
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

      {tab === 'ringkasan' && <SummaryTab exam={exam} submissions={examSubmissions} finalCount={finalCount} essayCount={essayCount} onOpenTab={openTab} maxAttempts={maxAttempts} savingAttempts={savingAttempts} onChangeAttempts={setAttemptOverride} onSaveAttempts={saveAttemptLimit} />}
      {tab === 'soal' && <QuestionsTab exam={exam} onEdit={() => navigate(`/guru/ujian/${exam.id}/edit-soal`)} onPreview={() => navigate(`/guru/ujian/${exam.id}/preview`)} />}
      {tab === 'peserta' && <ParticipantsTab exam={exam} submissions={examSubmissions} essayCount={essayCount} />}
      {tab === 'hasil' && <ResultsTab exam={exam} submissions={examSubmissions} essayCount={essayCount} onGrade={() => navigate(`/guru/hasil?exam=${exam.id}`)} />}
      {tab === 'pengaturan' && (
        <section className="card">
          {examSubmissions.length > 0 && (
            <div className="alert alert-warning" style={{ marginBottom: 'var(--sp-5)' }}>
              Ujian ini sudah memiliki jawaban masuk. Perubahan jadwal, timer, peserta, atau aturan pengerjaan akan berlaku untuk akses berikutnya. Jawaban yang sudah terkumpul tidak dihapus.
            </div>
          )}
          <Step1Setup
            key={`${exam.id}-${exam.updatedAt}`}
            initial={{
              title: exam.title,
              description: exam.description,
              subject: exam.subject,
              className: exam.className,
              examType: exam.examType,
              activeFrom: exam.activeFrom,
              activeTo: exam.activeTo,
              settings: exam.settings,
              preloadedStudents: exam.preloadedStudents,
            }}
            onNext={data => void saveFullSettings(data)}
            submitLabel={savingSettings ? 'Menyimpan...' : 'Simpan Perubahan'}
            heading="Edit Pengaturan Ujian"
            intro="Ubah judul, jadwal, peserta, timer, percobaan, penilaian, hasil, dan keamanan tanpa membuat ujian baru."
          />
          <div style={{ marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-5)', borderTop: '1px solid var(--border)' }}>
            <button className="btn btn-secondary" onClick={() => navigate(`/guru/ujian/${exam.id}/edit-soal`)}>Edit Soal</button>
          </div>
        </section>
      )}
    </div>
  );
}

function AttemptLimitControl({ currentValue, value, saving, onChange, onSave }: { currentValue: number; value: number; saving: boolean; onChange: (value: number) => void; onSave: () => Promise<void> }) {
  return <div className="form-group" style={{ maxWidth: 420 }}>
    <label className="form-label" htmlFor="workspace-max-attempts">Maksimal percobaan per murid</label>
    <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <select id="workspace-max-attempts" className="form-select" style={{ flex: '1 1 180px' }} value={value} onChange={event => onChange(Number(event.target.value))}>
        <option value={1}>1 kali</option>
        <option value={2}>2 kali</option>
        <option value={3}>3 kali</option>
        <option value={5}>5 kali</option>
        <option value={0}>Tidak terbatas</option>
      </select>
      <button className="btn btn-primary" disabled={saving || value === currentValue} onClick={() => void onSave()}>{saving ? 'Menyimpan...' : 'Simpan'}</button>
    </div>
    <span className="form-hint">Hanya jawaban yang berhasil dikumpulkan yang memakai jatah. Draft, autosave, dan submit gagal tidak dihitung.</span>
  </div>;
}

function SummaryTab({ exam, submissions, finalCount, essayCount, onOpenTab, maxAttempts, savingAttempts, onChangeAttempts, onSaveAttempts }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; submissions: Submission[]; finalCount: number; essayCount: number; onOpenTab: (tab: WorkspaceTab) => void; maxAttempts: number; savingAttempts: boolean; onChangeAttempts: (value: number) => void; onSaveAttempts: () => Promise<void> }) {
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
      <section className="card"><SectionHeader title="Pengaturan cepat" subtitle="Atur jatah pengerjaan tanpa mencari menu lain." />
        <AttemptLimitControl currentValue={exam.settings.maxAttempts ?? 1} value={maxAttempts} saving={savingAttempts} onChange={onChangeAttempts} onSave={onSaveAttempts} />
        <div className="workspace-action-list" style={{ marginTop: 'var(--sp-4)' }}><button onClick={() => onOpenTab('soal')}><BookOpen size={18} /> Kelola soal</button><button onClick={() => onOpenTab('peserta')}><Users size={18} /> Lihat peserta</button><button onClick={() => onOpenTab('hasil')}><BarChart2 size={18} /> Buka hasil</button></div>
      </section>
    </div>
  </>;
}

function QuestionsTab({ exam, onEdit, onPreview }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; onEdit: () => void; onPreview: () => void }) {
  return <section className="card"><SectionHeader title="Soal ujian" subtitle={`${exam.questions.length} soal · Maks. ${exam.questions.reduce((sum, q) => sum + q.weight, 0)} poin`} action={<div className="workspace-tab-actions"><button className="btn btn-secondary" onClick={onPreview}><Eye size={14} /> Preview</button><button className="btn btn-primary" onClick={onEdit}><Edit2 size={14} /> Edit Soal</button></div>} />
    <div className="workspace-question-list">{exam.questions.map((question, index) => <div className="workspace-question-row" key={question.id}><strong>{index + 1}</strong><span className={`badge ${question.type === 'ESSAY' ? 'badge-essay' : 'badge-pg'}`}>{question.type === 'MULTIPLE_CHOICE' ? 'PG' : question.type === 'SHORT_ANSWER' ? 'Jawaban Singkat' : 'Essay'}</span><p>{question.text}</p><span>{question.weight} poin</span><button className="btn btn-ghost btn-icon" onClick={onEdit} aria-label={`Edit soal ${index + 1}`}><Edit2 size={14} /></button></div>)}</div>
  </section>;
}

function ParticipantsTab({ exam, submissions, essayCount }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; submissions: Submission[]; essayCount: number }) {
  const personalRoster = exam.settings.participantMode === 'PERSONAL_ROSTER';
  if (personalRoster) {
    const matchedSubmissions = matchRosterToCompletedSubmissions(exam.preloadedStudents, submissions);
    const submittedCount = matchedSubmissions.filter(Boolean).length;
    return <section className="card"><SectionHeader title="Peserta" subtitle={`${submittedCount}/${exam.preloadedStudents.length} jawaban terkumpul`} /><div className="workspace-participant-list">{exam.preloadedStudents.map((student, index) => { const submission = matchedSubmissions[index]; return <div className="workspace-participant-row" key={student.participantId ?? student.nis ?? `${student.name}-${index}`}><div><strong>{student.name}</strong><span>{submission ? `Dikumpulkan ${submission.submittedAt ? formatDateTime(submission.submittedAt) : ''}` : 'Belum mengumpulkan'}</span></div><span className={`workspace-status ${submission ? 'status-final' : 'status-pending'}`}>{submission ? 'Terkumpul' : 'Belum mengumpulkan'}</span><span>{submission ? (essayStatus(submission, essayCount) === 'PENDING' ? 'Menunggu koreksi' : `${submission.totalScore ?? 0} poin`) : '—'}</span></div>; })}</div></section>;
  }
  return <section className="card"><SectionHeader title="Peserta" subtitle={`${submissions.length} jawaban yang sudah masuk`} /><div className="workspace-participant-list">{submissions.length === 0 ? <EmptyState icon={<Users size={40} />} title="Belum ada peserta" description="Bagikan kode ujian kepada murid." /> : submissions.map(sub => <div className="workspace-participant-row" key={sub.id}><div><strong>{sub.studentName}</strong><span>Percobaan ke-{sub.attemptNumber}</span></div><span className={`workspace-status status-${essayStatus(sub, essayCount).toLowerCase()}`}>{essayStatus(sub, essayCount) === 'NONE' ? 'Nilai Final' : essayStatus(sub, essayCount) === 'FINAL' ? 'Nilai Final' : essayStatus(sub, essayCount) === 'PARTIAL' ? 'Dinilai Sebagian' : 'Menunggu Koreksi'}</span><span>{sub.submittedAt ? formatDateTime(sub.submittedAt) : '—'}</span></div>)}</div></section>;
}

function ResultsTab({ exam, submissions, essayCount, onGrade }: { exam: NonNullable<ReturnType<typeof useApp>['exams']>[number]; submissions: Submission[]; essayCount: number; onGrade: () => void }) {
  const maxAuto = calcMaxMCScore(exam); const maxEssay = calcMaxEssayScore(exam);
  return <section className="card"><SectionHeader title="Hasil ujian" subtitle="Nilai sementara tidak ditampilkan sebagai nilai final." action={essayCount > 0 ? <button className="btn btn-primary" onClick={onGrade}><Edit2 size={14} /> Koreksi Essay</button> : undefined} /><div className="workspace-results-list">{submissions.map(sub => { const status = essayStatus(sub, essayCount); return <div className="workspace-result-row" key={sub.id}><strong>{sub.studentName}</strong><span>{sub.mcScore}/{maxAuto} PG</span><span>{essayCount ? `${sub.essayScores.reduce((sum, grade) => sum + grade.score, 0)}/${maxEssay} Essay` : '—'}</span><strong>{status === 'FINAL' || status === 'NONE' ? `${sub.totalScore ?? 0}/${maxAuto + maxEssay}` : 'Belum final'}</strong><span className={`workspace-status status-${status.toLowerCase()}`}>{status === 'FINAL' || status === 'NONE' ? 'FINAL' : status === 'PARTIAL' ? 'PARTIAL' : 'PENDING ESSAY'}</span></div>; })}</div></section>;
}
