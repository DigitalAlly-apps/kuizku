import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Copy, Edit2, Trash2, BarChart2, Archive, Play, MoreVertical, FileText, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, X, Save, Loader2, Calendar } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { FormatBadge, StatusBadge, ExamTypeBadge, EmptyState, ConfirmDialog, Modal } from '../../components/ui';
import { formatRelative } from '../../utils/helpers';
import type { Exam, ExamStatus, ExamType } from '../../types';

const STATUS_FILTERS: { label: string; value: ExamStatus | 'ALL' }[] = [
  { label: 'Semua', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Selesai', value: 'ENDED' },
  { label: 'Diarsipkan', value: 'ARCHIVED' },
];

const TYPE_FILTERS: { label: string; value: ExamType | 'ALL' }[] = [
  { label: 'Semua Tipe', value: 'ALL' },
  { label: '📝 Ujian', value: 'UJIAN' },
  { label: '📋 Tugas', value: 'TUGAS' },
  { label: '🎯 Latihan', value: 'LATIHAN' },
];

function formatDeadline(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ExamListPage() {
  const { currentTeacher, exams, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, submissions } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'ALL'>((searchParams.get('status') as ExamStatus) ?? 'ALL');
  const [typeFilter, setTypeFilter] = useState<ExamType | 'ALL'>('ALL');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'kelas' | 'mapel' | 'tipe' | 'none'>('kelas');

  // Edit modal state
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editType, setEditType] = useState<ExamType>('UJIAN');
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const myExams = useMemo(() =>
    exams.filter(e => e.teacherId === currentTeacher?.id), [exams, currentTeacher]);

  const filtered = useMemo(() => {
    let list = myExams;
    if (statusFilter !== 'ALL') list = list.filter(e => e.status === statusFilter);
    if (typeFilter !== 'ALL') list = list.filter(e => (e.examType ?? 'UJIAN') === typeFilter);
    if (search.trim()) list = list.filter(e =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      (e.className || '').toLowerCase().includes(search.toLowerCase()) ||
      e.code.includes(search.toUpperCase())
    );
    return [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [myExams, statusFilter, typeFilter, search]);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'Semua Ujian', exams: filtered }];
    const map = new Map<string, Exam[]>();
    filtered.forEach(exam => {
      const key = groupBy === 'kelas'
        ? (exam.className || '— Tanpa Kelas —')
        : groupBy === 'mapel'
        ? (exam.subject || '— Tanpa Mapel —')
        : (exam.examType ?? 'UJIAN');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exam);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, exams]) => ({ key, exams }));
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const openEdit = (exam: Exam) => {
    setEditExam(exam);
    setEditTitle(exam.title);
    setEditDesc(exam.description || '');
    setEditSubject(exam.subject);
    setEditClass(exam.className || '');
    setEditType(exam.examType ?? 'UJIAN');
    setEditFrom(exam.activeFrom ? exam.activeFrom.slice(0, 16) : '');
    setEditTo(exam.activeTo ? exam.activeTo.slice(0, 16) : '');
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editExam) return;
    if (!editTitle.trim()) { addToast({ type: 'error', title: 'Judul tidak boleh kosong' }); return; }
    setEditSaving(true);
    await updateExam(editExam.id, {
      title: editTitle.trim(),
      description: editDesc,
      subject: editSubject,
      className: editClass,
      examType: editType,
      activeFrom: editFrom || undefined,
      activeTo: editTo || undefined,
    });
    setEditSaving(false);
    setEditExam(null);
    addToast({ type: 'success', title: 'Ujian berhasil diperbarui!' });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    addToast({ type: 'success', title: 'Kode disalin!', message: `Kode ujian: ${code}` });
  };

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/ujian/${code}`;
    navigator.clipboard.writeText(url);
    addToast({ type: 'success', title: 'Link disalin!', message: url });
  };

  const handleDuplicate = async (id: string) => {
    const copy = await duplicateExam(id);
    addToast({ type: 'success', title: 'Ujian diduplikasi', message: `"${copy.title}" berhasil dibuat.` });
    setOpenMenuId(null);
  };

  const handlePublish = (id: string) => {
    publishExam(id);
    addToast({ type: 'success', title: 'Ujian dipublikasikan!', message: 'Murid sekarang bisa mengerjakan ujian.' });
    setOpenMenuId(null);
  };

  const handleEnd = (id: string) => {
    endExam(id);
    addToast({ type: 'info', title: 'Ujian ditutup', message: 'Murid tidak bisa mengerjakan lagi.' });
    setOpenMenuId(null);
  };

  const handleArchive = (id: string) => {
    archiveExam(id);
    addToast({ type: 'info', title: 'Ujian diarsipkan.' });
    setOpenMenuId(null);
  };

  const handleDelete = () => {
    if (deleteId) { deleteExam(deleteId); addToast({ type: 'success', title: 'Ujian dihapus.' }); setDeleteId(null); }
  };

  const ExamCard = ({ exam }: { exam: Exam }) => {
    const examSubs = submissions.filter(s => s.examId === exam.id && s.isComplete);
    const preloadedCount = exam.preloadedStudents?.length ?? 0;
    const submittedCount = examSubs.length;
    const notSubmitted = preloadedCount > 0 ? preloadedCount - submittedCount : null;
    const hasDeadline = !!exam.activeTo;
    const isPastDeadline = hasDeadline && new Date(exam.activeTo!) < new Date();

    return (
      <div key={exam.id} className="exam-card" style={{ position: 'relative' }}
        onClick={() => navigate(exam.status === 'DRAFT' ? '/guru/ujian?status=DRAFT' : `/guru/hasil?exam=${exam.id}`)}>
        <div className="exam-card-header">
          <div className="exam-card-badges">
            <ExamTypeBadge examType={exam.examType} />
            <FormatBadge format={exam.format} />
            <StatusBadge status={exam.status} />
            {exam.className && (
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}>
                {exam.className}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm btn-icon" title="Salin kode" onClick={() => copyCode(exam.code)}>
              <Copy size={14} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={e => { e.stopPropagation(); openEdit(exam); }}>
              <Edit2 size={14} />
            </button>
            {exam.status !== 'ARCHIVED' && (
              <div style={{ position: 'relative' }}>
                <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setOpenMenuId(openMenuId === exam.id ? null : exam.id)}>
                  <MoreVertical size={14} />
                </button>
                {openMenuId === exam.id && (
                  <div style={menuStyle}>
                    {exam.status === 'DRAFT' && (
                      <button style={menuItemStyle} onClick={() => handlePublish(exam.id)}>
                        <Play size={14} style={{ color: 'var(--success)' }} /> Publikasikan
                      </button>
                    )}
                    {exam.status === 'ACTIVE' && (
                      <button style={menuItemStyle} onClick={() => handleEnd(exam.id)}>
                        <Archive size={14} /> Tutup Ujian
                      </button>
                    )}
                    <button style={menuItemStyle} onClick={() => navigate(`/guru/hasil?exam=${exam.id}`)}>
                      <BarChart2 size={14} /> Lihat Hasil
                    </button>
                    <button style={menuItemStyle} onClick={() => copyLink(exam.code)}>
                      <Copy size={14} /> Salin Link
                    </button>
                    <button style={menuItemStyle} onClick={() => handleDuplicate(exam.id)}>
                      <FileText size={14} /> Duplikasi
                    </button>
                    {exam.status !== 'DRAFT' && (
                      <button style={menuItemStyle} onClick={() => handleArchive(exam.id)}>
                        <Archive size={14} /> Arsipkan
                      </button>
                    )}
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                    <button style={{ ...menuItemStyle, color: 'var(--danger)' }} onClick={() => { setDeleteId(exam.id); setOpenMenuId(null); }}>
                      <Trash2 size={14} /> Hapus
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="exam-card-title">{exam.title}</div>
          <div className="exam-card-subject">{exam.subject}</div>
        </div>

        <div className="exam-card-meta">
          <span className="exam-card-meta-item"><FileText size={13} /> {exam.questions.length} soal</span>
          <span className="exam-card-meta-item"><Users size={13} /> {submittedCount} dikumpul</span>
          {notSubmitted !== null && notSubmitted > 0 && (
            <span className="exam-card-meta-item" style={{ color: 'var(--warning)', fontWeight: 600 }}>
              <Clock size={13} /> {notSubmitted} belum
            </span>
          )}
          {notSubmitted !== null && notSubmitted === 0 && (
            <span className="exam-card-meta-item" style={{ color: 'var(--success)', fontWeight: 600 }}>
              <CheckCircle2 size={13} /> Semua selesai
            </span>
          )}
          {hasDeadline && (
            <span className="exam-card-meta-item" style={{ color: isPastDeadline ? 'var(--danger)' : 'var(--text-muted)' }}>
              <Calendar size={13} /> {formatDeadline(exam.activeTo)}
            </span>
          )}
          <span className="exam-card-meta-item" style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>#{exam.code}</span>
          <span className="exam-card-meta-item" style={{ marginLeft: 'auto' }}>{formatRelative(exam.updatedAt)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 'var(--sp-6)' }}>
        <div>
          <h1>Ujian Saya</h1>
          <p style={{ color: 'var(--text-muted)' }}>{myExams.length} item terdaftar</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/guru/ujian/baru')}>
          <Plus size={16} /> Buat Ujian/Tugas
        </button>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div className="search-input-wrap" style={{ flex: '1 1 200px' }}>
          <Search size={15} />
          <input className="form-input search-input" placeholder="Cari judul, mapel, kelas, atau kode..."
            value={search} onChange={e => setSearch(e.target.value)} id="exam-search" />
        </div>
        {/* Status filter */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map(f => (
            <button key={f.value}
              className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Type filter */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {TYPE_FILTERS.map(f => (
            <button key={f.value}
              className={`btn btn-sm ${typeFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTypeFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        {/* Group by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Kelompokkan:</span>
          {(['kelas', 'mapel', 'tipe', 'none'] as const).map(g => (
            <button key={g} className={`btn btn-sm ${groupBy === g ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupBy(g)}>
              {g === 'kelas' ? 'Kelas' : g === 'mapel' ? 'Mapel' : g === 'tipe' ? 'Tipe' : 'Tidak'}
            </button>
          ))}
        </div>
      </div>

      {/* Exam list grouped */}
      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FileText size={48} />}
            title={search ? 'Tidak ada hasil pencarian' : 'Belum ada ujian/tugas'}
            description={search ? `Tidak ditemukan untuk "${search}"` : 'Klik "Buat Ujian/Tugas" untuk memulai.'}
            action={!search ? <button className="btn btn-primary" onClick={() => navigate('/guru/ujian/baru')}><Plus size={16} /> Buat Ujian/Tugas</button> : undefined}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          {grouped.map(({ key, exams: groupExams }) => {
            const isCollapsed = collapsedGroups.has(key);
            const isGrouped = groupBy !== 'none';
            return (
              <div key={key}>
                {isGrouped && (
                  <button
                    onClick={() => toggleGroup(key)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                      padding: '6px 0', marginBottom: 'var(--sp-2)', textAlign: 'left',
                    }}>
                    {isCollapsed ? <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{key}</span>
                    <span style={{
                      fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)',
                      background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                    }}>{groupExams.length} item</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 8 }} />
                  </button>
                )}
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                    {groupExams.map(exam => <ExamCard key={exam.id} exam={exam} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      <Modal open={!!editExam} onClose={() => setEditExam(null)} title={`Edit — ${editExam?.title ?? ''}`} size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditExam(null)}><X size={15} /> Batal</button>
            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={editSaving}>
              {editSaving ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</> : <><Save size={15} /> Simpan</>}
            </button>
          </>
        }>
        {editExam && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            {/* Tipe */}
            <div>
              <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>Tipe Kegiatan</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['UJIAN', '📝 Ujian', 'var(--danger)', 'var(--danger-light)'],
                   ['TUGAS', '📋 Tugas', 'var(--warning)', 'var(--warning-light)'],
                   ['LATIHAN', '🎯 Latihan', 'var(--success)', 'var(--success-light)']] as const).map(([v, label, color, bg]) => (
                  <button key={v} type="button"
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--r-md)',
                      border: `2px solid ${editType === v ? color : 'var(--border-strong)'}`,
                      background: editType === v ? bg : 'var(--surface-2)',
                      color: editType === v ? color : 'var(--text-muted)',
                      fontWeight: editType === v ? 700 : 500, cursor: 'pointer', fontSize: '0.82rem',
                    }}
                    onClick={() => setEditType(v)}>{label}
                  </button>
                ))}
              </div>
            </div>
            {/* Title */}
            <div className="form-group">
              <label className="form-label">Judul <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            {/* Subject + Class */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div className="form-group">
                <label className="form-label">Mata Pelajaran</label>
                <input className="form-input" value={editSubject} onChange={e => setEditSubject(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Kelas</label>
                <input className="form-input" placeholder="Contoh: Kelas 10A" value={editClass} onChange={e => setEditClass(e.target.value)} />
              </div>
            </div>
            {/* Description */}
            <div className="form-group">
              <label className="form-label">Deskripsi</label>
              <textarea className="form-textarea" rows={2} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </div>
            {/* Deadline */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div className="form-group">
                <label className="form-label">Aktif Mulai</label>
                <input type="datetime-local" className="form-input" value={editFrom} onChange={e => setEditFrom(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Deadline / Aktif Hingga</label>
                <input type="datetime-local" className="form-input" value={editTo} onChange={e => setEditTo(e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Hapus Ujian?"
        message="Semua data ujian ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus" danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

const menuStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, zIndex: 20,
  background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
  borderRadius: 'var(--r-md)', padding: '4px', minWidth: 180,
  boxShadow: 'var(--shadow-lg)', animation: 'fadeIn 0.1s ease',
};

const menuItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '8px 12px', width: '100%', textAlign: 'left',
  background: 'none', border: 'none', color: 'var(--text-secondary)',
  fontSize: '0.8rem', borderRadius: 'var(--r-sm)', cursor: 'pointer',
  fontFamily: 'inherit',
};
