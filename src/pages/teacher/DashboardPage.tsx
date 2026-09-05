import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Users, TrendingUp, Clock, CheckCircle, ChevronRight, MessageSquareWarning } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatCard, FormatBadge, StatusBadge, ExamTypeBadge, EmptyState, SectionHeader } from '../../components/ui';
import { formatRelative } from '../../utils/helpers';
import { matchRosterToCompletedSubmissions } from '../../utils/participantAttendance';

export default function DashboardPage() {
  const { currentTeacher, exams, submissions } = useApp();
  const navigate = useNavigate();

  const myExams = useMemo(() => exams.filter(e => e.teacherId === currentTeacher?.id), [exams, currentTeacher]);

  const stats = useMemo(() => {
    const now = Date.now();
    const activeCount = myExams.filter(e => e.status === 'ACTIVE' && (!e.activeTo || new Date(e.activeTo).getTime() >= now)).length;
    const endedCount = myExams.filter(e => e.status === 'ENDED' || (e.status === 'ACTIVE' && e.activeTo && new Date(e.activeTo).getTime() < now)).length;
    return {
      total: myExams.length,
      active: activeCount,
      ended: endedCount,
      draft: myExams.filter(e => e.status === 'DRAFT').length,
      todaySubmissions: submissions.filter(s => {
        const today = new Date().toDateString();
        return s.submittedAt && new Date(s.submittedAt).toDateString() === today &&
          myExams.some(e => e.id === s.examId);
      }).length,
    };
  }, [myExams, submissions]);

  const recentExams = useMemo(() => [...myExams].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5), [myExams]);

  const actionStats = useMemo(() => {
    const now = Date.now();
    const activeExamIds = new Set(myExams.filter(e => e.status === 'ACTIVE' && (!e.activeTo || new Date(e.activeTo).getTime() >= now)).map(e => e.id));
    const activeSubmissions = submissions.filter(s => activeExamIds.has(s.examId) && s.isComplete);
    const essayPending = submissions.filter(s => {
      const exam = myExams.find(e => e.id === s.examId);
      if (!exam || !s.isComplete || exam.format === 'PG_ONLY') return false;
      const essayCount = exam.questions.filter(q => q.type === 'ESSAY').length;
      return s.essayScores.length < essayCount;
    }).length;
    const notSubmitted = myExams.reduce((sum, exam) => {
      const preloaded = exam.preloadedStudents?.length ?? 0;
      const isExpired = exam.activeTo && new Date(exam.activeTo).getTime() < now;
      if (!preloaded || exam.status !== 'ACTIVE' || isExpired) return sum;
      const submitted = matchRosterToCompletedSubmissions(
        exam.preloadedStudents,
        submissions.filter(submission => submission.examId === exam.id),
      ).filter(Boolean).length;
      return sum + Math.max(0, preloaded - submitted);
    }, 0);
    return { activeSubmissions: activeSubmissions.length, essayPending, notSubmitted };
  }, [myExams, submissions]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  return (
    <div className="page-content">
      {/* Header */}
      <div className="dashboard-intro">
        <div><span>RINGKASAN HARI INI</span><h1>{greeting}, {currentTeacher?.name.split(' ')[0]}</h1><p>Kelola ujian dan pantau aktivitas murid dari satu tempat.</p></div>
        <button className="btn btn-primary" onClick={() => navigate('/guru/ujian/baru')}><Plus size={16} /> Buat Ujian</button>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Ujian" value={stats.total} icon={<FileText size={20} />}
          color="var(--primary)" bg="var(--primary-light)" />
        <StatCard label="Ujian Aktif" value={stats.active} icon={<TrendingUp size={20} />}
          color="var(--success)" bg="var(--success-light)" />
        <StatCard label="Selesai" value={stats.ended} icon={<CheckCircle size={20} />}
          color="var(--accent)" bg="var(--accent-light)" />
        <StatCard label="Pengerjaan Hari Ini" value={stats.todaySubmissions} icon={<Users size={20} />}
          color="var(--warning)" bg="var(--warning-light)" />
      </div>

      <div className="dashboard-attention">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquareWarning size={18} style={{ color: 'var(--warning)' }} />
            <h3 style={{ margin: 0 }}>Perlu Perhatian</h3>
          </div>
          <ActionRow label="Peserta sudah mengumpulkan di ujian aktif" value={actionStats.activeSubmissions} color="var(--success)" onClick={() => navigate('/guru/ujian?status=ACTIVE')} />
          <ActionRow label="Peserta terdaftar belum mengerjakan" value={actionStats.notSubmitted} color="var(--warning)" onClick={() => navigate('/guru/ujian?status=ACTIVE')} />
          <ActionRow label="Jawaban essay belum dinilai" value={actionStats.essayPending} color="var(--secondary)" onClick={() => navigate('/guru/hasil')} />
        </div>
      </div>

      {/* Recent Exams */}
      <SectionHeader title="Ujian Terbaru"
        action={<button className="btn btn-ghost btn-sm" onClick={() => navigate('/guru/ujian')}>Lihat Semua →</button>} />

      {recentExams.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FileText size={48} />}
            title="Belum ada ujian"
            description="Mulai buat ujian pertama Anda dan bagikan ke murid."
            action={<button className="btn btn-primary" onClick={() => navigate('/guru/ujian/baru')}><Plus size={16} /> Buat Ujian</button>}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {recentExams.map(exam => {
            const examSubs = submissions.filter(s => s.examId === exam.id);
            return (
              <button type="button" key={exam.id} className="exam-card dashboard-exam-card" onClick={() => navigate(`/guru/ujian/${exam.id}`)}>
                <div className="exam-card-header">
                  <div className="exam-card-badges">
                    <ExamTypeBadge examType={exam.examType} />
                    <FormatBadge format={exam.format} />
                    <StatusBadge status={exam.status} activeTo={exam.activeTo} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {formatRelative(exam.updatedAt)}
                  </span>
                </div>
                <div>
                  <div className="exam-card-title">{exam.title}</div>
                  <div className="exam-card-subject">{exam.subject}</div>
                </div>
                <div className="exam-card-meta">
                  <span className="exam-card-meta-item"><FileText size={13} /> {exam.questions.length} soal</span>
                  <span className="exam-card-meta-item"><Users size={13} /> {examSubs.length} peserta</span>
                  <span className="exam-card-meta-item" style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>
                    # {exam.code}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Draft reminder */}
      {stats.draft > 0 && (
        <div style={styles.draftBanner}>
          <Clock size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>
              {stats.draft} ujian masih dalam Draft
            </strong>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
              Selesaikan dan publikasikan agar murid bisa mengerjakan.
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/guru/ujian?status=DRAFT')}>
            Lihat Draft
          </button>
        </div>
      )}
    </div>
  );
}

function ActionRow({ label, value, color, onClick }: { label: string; value: number; color: string; onClick: () => void }) {
  return (
    <button type="button" className="dashboard-action-row" onClick={onClick}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{label}</span>
      <span className="dashboard-action-row-value"><strong style={{ color }}>{value}</strong><ChevronRight size={16} /></span>
    </button>
  );
}

const styles: Record<string, React.CSSProperties> = {
  draftBanner: {
    marginTop: 'var(--sp-6)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--sp-4)',
    padding: 'var(--sp-4) var(--sp-5)',
    background: 'var(--warning-light)',
    border: '1px solid rgba(245,158,11,0.25)',
    borderRadius: 'var(--r-lg)',
  },
};
