import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Copy, Edit2, Trash2, BarChart2, Archive, Play, MoreVertical, FileText, Users, ChevronDown, ChevronRight, CheckCircle2, Clock, X, Save, Loader2, Calendar, Share2, QrCode } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { FormatBadge, ExamTypeBadge, EmptyState, ConfirmDialog, Modal } from '../../components/ui';
import DateTime24Input from '../../components/ui/DateTime24Input';
import { formatDateTime, formatRelative, isoToLocalDateTimeInput } from '../../utils/helpers';
import type { Exam, ExamType } from '../../types';
import { usePersonalExam } from '../../features/personal-exam/PersonalExamContext';
import { PersonalDataModal } from '../../features/personal-exam/PersonalDataModal';

type ExamAvailability = 'DRAFT' | 'UPCOMING' | 'ACTIVE' | 'FINISHED' | 'ARCHIVED';

const STATUS_FILTERS: { label: string; value: ExamAvailability | 'ALL' }[] = [
  { label: 'Semua', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Akan Datang', value: 'UPCOMING' },
  { label: 'Aktif', value: 'ACTIVE' },
  { label: 'Selesai', value: 'FINISHED' },
  { label: 'Diarsipkan', value: 'ARCHIVED' },
];

const TYPE_FILTERS: { label: string; value: ExamType | 'ALL' }[] = [
  { label: 'Semua Tipe', value: 'ALL' },
  { label: 'Ujian', value: 'UJIAN' },
  { label: 'Tugas', value: 'TUGAS' },
  { label: 'Latihan', value: 'LATIHAN' },
];

function getAvailability(exam: Exam, now = Date.now()): ExamAvailability {
  if (exam.status === 'DRAFT') return 'DRAFT';
  if (exam.status === 'ARCHIVED') return 'ARCHIVED';
  if (exam.status === 'ENDED') return 'FINISHED';
  if (exam.activeTo && new Date(exam.activeTo).getTime() < now) return 'FINISHED';
  if (exam.activeFrom && new Date(exam.activeFrom).getTime() > now) return 'UPCOMING';
  return 'ACTIVE';
}

function formatSchedule(exam: Exam): string {
  if (!exam.activeFrom && !exam.activeTo) return 'Mulai setelah dipublikasikan • tanpa batas waktu';
  if (!exam.activeFrom) return `Mulai setelah dipublikasikan • berakhir ${formatDateTime(exam.activeTo!)}`;
  if (!exam.activeTo) return `Mulai ${formatDateTime(exam.activeFrom!)} • tanpa batas waktu`;
  const from = new Date(exam.activeFrom);
  const to = new Date(exam.activeTo);
  const sameDay = from.toDateString() === to.toDateString();
  if (sameDay) return `${from.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} • ${from.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}–${to.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  return `${formatDateTime(exam.activeFrom)} → ${formatDateTime(exam.activeTo)}`;
}

export default function ExamListPage() {
  const { currentTeacher, exams, questionCollections, copyExamQuestionsToBank, updateExam, deleteExam, duplicateExam, publishExam, archiveExam, endExam, submissions } = useApp();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const { enabled: personalExamEnabled } = usePersonalExam();
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamAvailability | 'ALL'>((searchParams.get('status') as ExamAvailability) ?? 'ALL');
  const [typeFilter, setTypeFilter] = useState<ExamType | 'ALL'>('ALL');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const activeMenuRef = useRef<HTMLDivElement | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'kelas' | 'mapel' | 'tipe' | 'none'>('kelas');
  const [qrExam, setQrExam] = useState<{ code: string; title: string } | null>(null);
  const [copyExam, setCopyExam] = useState<Exam | null>(null);
  const [copyCollectionId, setCopyCollectionId] = useState('');
  const [copyingToBank, setCopyingToBank] = useState(false);

  // Edit modal state
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [editClass, setEditClass] = useState('');
  const [editType, setEditType] = useState<ExamType>('UJIAN');
  const [editFrom, setEditFrom] = useState('');
  const [editTo, setEditTo] = useState('');
  const [editStudents, setEditStudents] = useState('');
  const [editAccessMode, setEditAccessMode] = useState<'OPEN' | 'LIST'>('OPEN');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (!openMenuId) return;

    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!activeMenuRef.current?.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };

    document.addEventListener('pointerdown', closeOnOutsidePress);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMenuId]);

  const myExams = useMemo(() =>
    exams.filter(e => e.teacherId === currentTeacher?.id), [exams, currentTeacher]);

  const filtered = useMemo(() => {
    let list = myExams;
    if (statusFilter !== 'ALL') list = list.filter(e => getAvailability(e) === statusFilter);
    if (typeFilter !== 'ALL') list = list.filter(e => (e.examType ?? 'UJIAN') === typeFilter);
    if (search.trim()) list = list.filter(e =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.subject.toLowerCase().includes(search.toLowerCase()) ||
      (e.className || '').toLowerCase().includes(search.toLowerCase()) ||
      e.code.includes(search.toUpperCase())
    );
    const priority: Record<ExamAvailability, number> = { ACTIVE: 0, UPCOMING: 1, DRAFT: 2, FINISHED: 3, ARCHIVED: 4 };
    return [...list].sort((a, b) => priority[getAvailability(a)] - priority[getAvailability(b)] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
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
    setEditFrom(isoToLocalDateTimeInput(exam.activeFrom));
    setEditTo(isoToLocalDateTimeInput(exam.activeTo));
    setEditStudents((exam.preloadedStudents || []).map(s => s.name).join('\n'));
    setEditAccessMode((exam.preloadedStudents || []).length > 0 ? 'LIST' : 'OPEN');
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!editExam) return;
    if (!editTitle.trim()) { addToast({ type: 'error', title: 'Judul tidak boleh kosong' }); return; }
    setEditSaving(true);
    // Parse daftar peserta dari textarea
    const parsedStudents = editStudents.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const [nameRaw] = line.split(/[,;\t]/).map(p => p.trim());
      return { name: nameRaw || '', nis: String(index + 1), attendanceNo: index + 1 };
    }).filter(s => s.name);
    if (editAccessMode === 'LIST' && parsedStudents.length === 0) {
      addToast({ type: 'error', title: 'Daftar peserta masih kosong', message: 'Tambahkan peserta atau pilih akses terbuka.' });
      setEditSaving(false);
      return;
    }

    const res = await updateExam(editExam.id, {
      title: editTitle.trim(),
      description: editDesc,
      subject: editSubject,
      className: editClass,
      examType: editType,
      activeFrom: editFrom || undefined,
      activeTo: editTo || undefined,
      preloadedStudents: editAccessMode === 'LIST' ? parsedStudents : [],
    });
    setEditSaving(false);
    if (res?.error) {
      addToast({ type: 'error', title: 'Gagal memperbarui ujian', message: res.error });
    } else {
      setEditExam(null);
      addToast({ type: 'success', title: 'Ujian berhasil diperbarui!' });
    }
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

  const shareWhatsApp = (code: string, title: string) => {
    const url = `${window.location.origin}/ujian/${code}`;
    const text = encodeURIComponent(`📝 *${title}*\n\nKode: *${code}*\nLink: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
    setOpenMenuId(null);
  };

  const handleDuplicate = async (id: string) => {
    const result = await duplicateExam(id);
    if (!result.success || !result.exam) {
      addToast({ type: 'error', title: 'Gagal menduplikasi ujian', message: result.error });
      return;
    }
    addToast({ type: 'success', title: 'Ujian diduplikasi', message: `"${result.exam.title}" berhasil dibuat.` });
    setOpenMenuId(null);
  };

  const openCopyToBank = (exam: Exam) => {
    setCopyExam(exam);
    setCopyCollectionId(questionCollections[0]?.id ?? '');
    setOpenMenuId(null);
  };

  const handleCopyToBank = async () => {
    if (!copyExam) return;
    setCopyingToBank(true);
    const result = await copyExamQuestionsToBank(copyExam, copyCollectionId);
    setCopyingToBank(false);
    if (!result.success) {
      addToast({ type: 'error', title: 'Soal belum disalin', message: result.error });
      return;
    }
    setCopyExam(null);
    addToast({ type: 'success', title: 'Soal disalin ke Bank Soal', message: `${result.count} soal dari “${copyExam.title}” tersimpan sebagai salinan.` });
  };

  const getPublishError = (exam: Exam): string | null => {
    if (exam.questions.length === 0) return 'Tambahkan minimal 1 soal sebelum publish.';
    if (exam.activeTo && new Date(exam.activeTo).getTime() <= Date.now()) return 'Deadline ujian sudah lewat. Perbarui "Aktif Hingga" sebelum publish.';
    if (exam.activeFrom && exam.activeTo && new Date(exam.activeFrom).getTime() >= new Date(exam.activeTo).getTime()) return 'Waktu mulai harus lebih awal dari deadline.';
    if (exam.settings.timerMode === 'WHOLE_EXAM' && (!exam.settings.wholExamTimerSeconds || exam.settings.wholExamTimerSeconds <= 0)) return 'Durasi timer keseluruhan harus lebih dari 0.';
    if (exam.settings.timerMode === 'PER_QUESTION' && (!exam.settings.perQuestionDefaultSeconds || exam.settings.perQuestionDefaultSeconds <= 0) && exam.questions.some(q => !q.timerSeconds || q.timerSeconds <= 0)) return 'Isi default timer per soal atau timer khusus pada setiap soal.';
    return null;
  };

  const handlePublish = async (id: string) => {
    const exam = exams.find(e => e.id === id);
    if (!exam) return;
    const error = getPublishError(exam);
    if (error) {
      addToast({ type: 'error', title: 'Ujian belum siap dipublish', message: error });
      setOpenMenuId(null);
      return;
    }
    const res = await publishExam(id);
    if (res?.error) {
      addToast({ type: 'error', title: 'Gagal mempublikasikan ujian', message: res.error });
    } else {
      addToast({ type: 'success', title: 'Ujian dipublikasikan!', message: 'Murid sekarang bisa mengerjakan ujian.' });
    }
    setOpenMenuId(null);
  };

  const handleEnd = async (id: string) => {
    const res = await endExam(id);
    if (res?.error) {
      addToast({ type: 'error', title: 'Gagal menutup ujian', message: res.error });
    } else {
      addToast({ type: 'info', title: 'Ujian ditutup', message: 'Murid tidak bisa mengerjakan lagi.' });
    }
    setOpenMenuId(null);
  };

  const handleArchive = async (id: string) => {
    const res = await archiveExam(id);
    if (res?.error) {
      addToast({ type: 'error', title: 'Gagal mengarsipkan ujian', message: res.error });
    } else {
      addToast({ type: 'info', title: 'Ujian diarsipkan.' });
    }
    setOpenMenuId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteExam(deleteId);
    if (!result.success) {
      addToast({ type: 'error', title: 'Gagal menghapus ujian', message: result.error });
      return;
    }
    addToast({ type: 'success', title: 'Ujian dihapus.' });
    setDeleteId(null);
  };

  const ExamCard = ({ exam }: { exam: Exam }) => {
    const examSubs = submissions.filter(s => s.examId === exam.id && s.isComplete);
    const preloadedCount = exam.preloadedStudents?.length ?? 0;
    const submittedCount = examSubs.length;
    const notSubmitted = preloadedCount > 0 ? preloadedCount - submittedCount : null;
    const availability = getAvailability(exam);
    const isDraftPastStart = availability === 'DRAFT' && !!exam.activeFrom && new Date(exam.activeFrom).getTime() < Date.now();
    const availabilityStyle: Record<ExamAvailability, { label: string; color: string; bg: string }> = {
      DRAFT: { label: 'DRAFT', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
      UPCOMING: { label: 'BELUM DIMULAI', color: 'var(--warning)', bg: 'var(--warning-light)' },
      ACTIVE: { label: 'AKTIF', color: 'var(--success)', bg: 'var(--success-light)' },
      FINISHED: { label: 'SELESAI', color: 'var(--danger)', bg: 'var(--danger-light)' },
      ARCHIVED: { label: 'ARSIP', color: 'var(--text-muted)', bg: 'var(--surface-2)' },
    };
    const status = availabilityStyle[availability];

    return (
      <div key={exam.id} className="exam-card" style={{ position: 'relative', zIndex: openMenuId === exam.id ? 10 : undefined }}
        onClick={() => navigate(`/guru/ujian/${exam.id}`)}>
        <div className="exam-card-header">
          <div className="exam-card-badges">
            <ExamTypeBadge examType={exam.examType} />
            <FormatBadge format={exam.format} />
            <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', color: status.color, background: status.bg, fontWeight: 800 }}>{status.label}</span>
            {exam.className && (
              <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)', background: 'var(--primary-light)', color: 'var(--primary)', fontWeight: 600 }}>
                {exam.className}
              </span>
            )}
          </div>
          <div className="exam-card-actions" onClick={e => e.stopPropagation()}>
            <button className="btn btn-ghost btn-sm btn-icon" title="Salin kode" onClick={() => copyCode(exam.code)}>
              <Copy size={14} />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={e => { e.stopPropagation(); openEdit(exam); }}>
              <Edit2 size={14} />
            </button>
            {exam.status !== 'ARCHIVED' && (
              <div
                ref={openMenuId === exam.id ? activeMenuRef : undefined}
                style={{ position: 'relative' }}
                onClick={e => e.stopPropagation()}
              >
                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  aria-label="Buka menu aksi ujian"
                  aria-expanded={openMenuId === exam.id}
                  onClick={e => {
                    e.stopPropagation();
                    setOpenMenuId(current => current === exam.id ? null : exam.id);
                  }}
                >
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
                    <button style={menuItemStyle} onClick={() => { navigate(`/guru/hasil?exam=${exam.id}`); setOpenMenuId(null); }}>
                      <BarChart2 size={14} /> Lihat Hasil
                    </button>
                    <button style={menuItemStyle} onClick={() => { navigate(`/guru/ujian/${exam.id}/edit-soal`); setOpenMenuId(null); }}>
                      <Edit2 size={14} style={{ color: 'var(--primary)' }} /> Edit Soal
                    </button>
                    <button style={menuItemStyle} onClick={() => { navigate(`/guru/ujian/${exam.id}/preview`); setOpenMenuId(null); }}>
                      <FileText size={14} style={{ color: 'var(--secondary)' }} /> Preview
                    </button>
                    <button style={menuItemStyle} onClick={() => { copyLink(exam.code); setOpenMenuId(null); }}>
                      <Copy size={14} /> Salin Link
                    </button>
                    <button style={menuItemStyle} onClick={() => shareWhatsApp(exam.code, exam.title)}>
                      <Share2 size={14} style={{ color: '#25D366' }} /> Share WhatsApp
                    </button>
                    <button style={menuItemStyle} onClick={() => { setQrExam({ code: exam.code, title: exam.title }); setOpenMenuId(null); }}>
                      <QrCode size={14} style={{ color: 'var(--secondary)' }} /> QR Code
                    </button>
                    <button style={menuItemStyle} onClick={() => handleDuplicate(exam.id)}>
                      <FileText size={14} /> Duplikasi
                    </button>
                    <button style={menuItemStyle} onClick={() => openCopyToBank(exam)}>
                      <Copy size={14} /> Simpan soal ke Bank Soal
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
          <span className="exam-card-meta-item"><Calendar size={13} /> {formatSchedule(exam)}</span>
          <span className="exam-card-meta-item" style={{ fontFamily: 'monospace', color: 'var(--primary)', fontWeight: 700 }}>#{exam.code}</span>
          <span className="exam-card-meta-item" style={{ marginLeft: 'auto' }}>{formatRelative(exam.updatedAt)}</span>
        </div>
        {isDraftPastStart && <div style={{ marginTop: 8, fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>Jadwal mulai sudah lewat. Ujian tetap belum dapat diakses karena belum dipublikasikan.</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-3)', flexWrap: 'wrap' }} onClick={event => event.stopPropagation()}>
          {availability === 'DRAFT' && <button className="btn btn-primary btn-sm" onClick={() => handlePublish(exam.id)}><Play size={14} /> {isDraftPastStart ? 'Publikasikan Sekarang' : 'Publikasikan'}</button>}
          {availability === 'ACTIVE' && <><button className="btn btn-primary btn-sm" onClick={() => navigate(`/guru/ujian/${exam.id}`)}>Buka Ujian</button><button className="btn btn-secondary btn-sm" onClick={() => shareWhatsApp(exam.code, exam.title)}><Share2 size={14} /> Bagikan</button></>}
          {availability === 'UPCOMING' && <button className="btn btn-secondary btn-sm" onClick={() => copyLink(exam.code)}><Share2 size={14} /> Bagikan</button>}
          {availability === 'FINISHED' && <button className="btn btn-primary btn-sm" onClick={() => navigate(`/guru/hasil?exam=${exam.id}`)}><BarChart2 size={14} /> Lihat Hasil</button>}
        </div>
      </div>
    );
  };

  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h1>Ujian Saya</h1>
          <p style={{ color: 'var(--text-muted)' }}>{myExams.length} item terdaftar</p>
        </div>
        <div className="section-header-action">
          <button className="btn btn-primary w-full" onClick={() => navigate('/guru/ujian/baru')}>
            <Plus size={16} /> Buat Ujian/Tugas
          </button>
        </div>
      </div>
      {personalExamEnabled && <button className="btn btn-secondary" style={{ position: 'fixed', right: 24, bottom: 24, zIndex: 10 }} onClick={() => setShowPersonalData(true)}><Users size={16} /> Kelola murid & mapel</button>}
      {showPersonalData && <PersonalDataModal onClose={() => setShowPersonalData(false)} />}

      {/* Filters */}
      <div className="filter-bar exam-filter-panel">
        <div className="exam-filter-search-row">
          <div className="search-input-wrap">
          <Search size={15} />
          <input className="form-input search-input" placeholder="Cari judul, mapel, kelas, atau kode..."
            value={search} onChange={e => setSearch(e.target.value)} id="exam-search" />
          </div>
          <span className="exam-filter-result-count">{filtered.length} dari {myExams.length} item</span>
        </div>

        <div className="exam-filter-status">
          <span className="exam-filter-label">Status</span>
          <div className="exam-filter-chips" role="group" aria-label="Filter status ujian">
          {STATUS_FILTERS.map(f => (
            <button key={f.value}
              className={`exam-filter-chip ${statusFilter === f.value ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </button>
          ))}
          </div>
        </div>

        <div className="exam-filter-select-row">
          <label>
            <span>Jenis kegiatan</span>
            <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as ExamType | 'ALL')}>
              {TYPE_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </label>
          <label>
            <span>Kelompokkan menurut</span>
            <select className="form-select" value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)}>
              <option value="kelas">Kelas</option>
              <option value="mapel">Mata pelajaran</option>
              <option value="tipe">Jenis kegiatan</option>
              <option value="none">Tanpa kelompok</option>
            </select>
          </label>
          {(search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || groupBy !== 'kelas') && (
            <button className="btn btn-ghost btn-sm exam-filter-reset" onClick={() => { setSearch(''); setStatusFilter('ALL'); setTypeFilter('ALL'); setGroupBy('kelas'); }}>
              Reset filter
            </button>
          )}
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
            <div className="exam-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
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
            {/* Jadwal akses */}
            <div>
              <div className="form-label" style={{ marginBottom: 4 }}>Jadwal Akses</div>
              <p className="form-hint" style={{ margin: 0 }}>Murid hanya dapat mengakses ujian selama periode ini setelah ujian dipublikasikan.</p>
            </div>
            <div className="exam-edit-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)' }}>
              <div className="form-group">
                <label className="form-label">Mulai</label>
                <DateTime24Input id="edit-active-from" value={editFrom} onChange={setEditFrom} />
              </div>
              <div className="form-group">
                <label className="form-label">Berakhir</label>
                <DateTime24Input id="edit-active-to" value={editTo} onChange={setEditTo} />
              </div>
            </div>
            {/* Akses Peserta */}
            <div className="form-group">
              <label className="form-label">Akses Peserta</label>
              <div className="student-access-choice" role="radiogroup" aria-label="Akses peserta ujian">
                <button type="button" role="radio" aria-checked={editAccessMode === 'OPEN'} className={editAccessMode === 'OPEN' ? 'is-active' : ''} onClick={() => setEditAccessMode('OPEN')}>
                  <strong>Terbuka untuk semua</strong><span>Siapa pun yang punya kode dapat masuk.</span>
                </button>
                <button type="button" role="radio" aria-checked={editAccessMode === 'LIST'} className={editAccessMode === 'LIST' ? 'is-active' : ''} onClick={() => setEditAccessMode('LIST')}>
                  <strong>Hanya daftar peserta</strong><span>Peserta memilih namanya dari daftar guru.</span>
                </button>
              </div>
              {editAccessMode === 'LIST' && <>
                <textarea className="form-textarea" rows={4} style={{ marginTop: 'var(--sp-3)' }}
                  placeholder={'Satu nama per baris. Nomor absen dibuat otomatis sesuai urutan.'}
                  value={editStudents} onChange={e => setEditStudents(e.target.value)} />
                <span className="form-hint">Bisa paste satu kolom nama dari Excel. Nomor absen mengikuti urutan baris.</span>
              </>}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!copyExam} onClose={() => !copyingToBank && setCopyExam(null)} title="Simpan Soal ke Bank Soal"
        subtitle={copyExam ? `${copyExam.questions.length} soal dari “${copyExam.title}” akan disalin.` : undefined}
        footer={<>
          <button className="btn btn-secondary" onClick={() => setCopyExam(null)} disabled={copyingToBank}>Batal</button>
          <button className="btn btn-primary" onClick={handleCopyToBank} disabled={!copyCollectionId || copyingToBank}>{copyingToBank ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Menyimpan...</> : <><Copy size={15} /> Simpan Salinan</>}</button>
        </>}>
        {questionCollections.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Belum ada kategori. Buat kategori terlebih dahulu dari halaman Bank Soal.</p>
        ) : (
          <div className="form-group">
            <label className="form-label" htmlFor="copy-to-collection">Simpan ke kategori</label>
            <select id="copy-to-collection" className="form-select" value={copyCollectionId} onChange={e => setCopyCollectionId(e.target.value)}>
              {questionCollections.map(collection => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </select>
            <span className="form-hint">Soal disimpan sebagai salinan. Mengubahnya di Bank Soal tidak akan mengubah ujian ini.</span>
          </div>
        )}
      </Modal>

      {/* QR Code Modal */}
      <Modal open={!!qrExam} onClose={() => setQrExam(null)} title={`QR Code — ${qrExam?.title ?? ''}`}>
        {qrExam && (() => {
          const url = `${window.location.origin}/ujian/${qrExam.code}`;
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}&margin=10`;
          return (
            <div style={{ textAlign: 'center', padding: 'var(--sp-4) 0' }}>
              <img src={qrSrc} alt="QR Code" style={{ borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', marginBottom: 'var(--sp-4)' }} />
              <p style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.1rem', color: 'var(--primary)', marginBottom: 8 }}>{qrExam.code}</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)', wordBreak: 'break-all' }}>{url}</p>
              <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => copyLink(qrExam.code)}>
                  <Copy size={13} /> Salin Link
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => shareWhatsApp(qrExam.code, qrExam.title)} style={{ color: '#25D366' }}>
                  <Share2 size={13} /> Share WA
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Hapus Ujian?"
        message="Semua data ujian ini akan dihapus permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Hapus" danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}

const menuStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', right: 0, zIndex: 20, pointerEvents: 'auto',
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
