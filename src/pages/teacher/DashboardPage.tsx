import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, BookOpen, Users, TrendingUp, Clock, CheckCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatCard, FormatBadge, StatusBadge, ExamTypeBadge, EmptyState, SectionHeader } from '../../components/ui';
import { formatRelative } from '../../utils/helpers';

export default function DashboardPage() {
  const { currentTeacher, exams, submissions } = useApp();
  const navigate = useNavigate();

  const myExams = useMemo(() => exams.filter(e => e.teacherId === currentTeacher?.id), [exams, currentTeacher]);

  const stats = useMemo(() => ({
    total: myExams.length,
    active: myExams.filter(e => e.status === 'ACTIVE').length,
    ended: myExams.filter(e => e.status === 'ENDED').length,
    draft: myExams.filter(e => e.status === 'DRAFT').length,
    todaySubmissions: submissions.filter(s => {
      const today = new Date().toDateString();
      return s.submittedAt && new Date(s.submittedAt).toDateString() === today &&
        myExams.some(e => e.id === s.examId);
    }).length,
  }), [myExams, submissions]);

  const recentExams = useMemo(() => [...myExams].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5), [myExams]);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  return (
    <div className="page-content">
      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 4 }}>
          {greeting}, {currentTeacher?.name.split(' ')[0]} 👋
        </h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Kelola ujian dan pantau performa murid dari sini.
        </p>
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

      {/* Quick Actions */}
      <div style={{ marginBottom: 'var(--sp-8)' }}>
        <SectionHeader title="Aksi Cepat" />
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/guru/ujian/baru')}>
            <Plus size={16} /> Buat Ujian Baru
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/guru/bank-soal')}>
            <BookOpen size={16} /> Bank Soal
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/guru/hasil')}>
            <TrendingUp size={16} /> Lihat Hasil
          </button>
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
              <div key={exam.id} className="exam-card" onClick={() => navigate(exam.status === 'DRAFT' ? '/guru/ujian?status=DRAFT' : `/guru/hasil?exam=${exam.id}`)}>
                <div className="exam-card-header">
                  <div className="exam-card-badges">
                    <ExamTypeBadge examType={exam.examType} />
                    <FormatBadge format={exam.format} />
                    <StatusBadge status={exam.status} />
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
              </div>
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
