import { useState, useMemo } from 'react';
import { Search, BookOpen, Trash2, Edit2, ChevronDown, ChevronRight, Share2, Download, LibraryBig, FolderPlus, CheckSquare, Square, Loader2 } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, ConfirmDialog, Modal } from '../../components/ui';
import QuestionEditor from '../../components/exam/QuestionEditor';
import type { BankQuestion } from '../../types';
import { storage } from '../../utils/storage';

const optLetters = 'ABCDEF';

export default function QuestionBankPage() {
  const { currentTeacher, bankQuestions, questionCollections, createQuestionCollection, deleteBankQuestion, updateBankQuestion, exams, refreshExams } = useApp();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MULTIPLE_CHOICE' | 'SHORT_ANSWER' | 'ESSAY'>('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [collectionFilter, setCollectionFilter] = useState('ALL');
  const [newCollectionName, setNewCollectionName] = useState('');
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [savingCollection, setSavingCollection] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [editQ, setEditQ] = useState<BankQuestion | null>(null);
  const [preview, setPreview] = useState<BankQuestion | null>(null);
  const [groupBy, setGroupBy] = useState<'kelas' | 'mapel' | 'none'>('kelas');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedPayload, setSharedPayload] = useState('');

  const myBank = useMemo(() =>
    bankQuestions.filter(bq => bq.teacherId === currentTeacher?.id), [bankQuestions, currentTeacher]);

  const allTags = useMemo(() =>
    [...new Set(myBank.flatMap(bq => bq.tags))].sort(), [myBank]);

  const filtered = useMemo(() => {
    return myBank.filter(bq => {
      if (typeFilter !== 'ALL' && bq.type !== typeFilter) return false;
      if (collectionFilter !== 'ALL' && bq.collectionId !== collectionFilter) return false;
      if (tagFilter && !bq.tags.includes(tagFilter)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return bq.text.toLowerCase().includes(s) ||
          bq.subject.toLowerCase().includes(s) ||
          (bq.className || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [myBank, typeFilter, tagFilter, collectionFilter, search]);

  const collectionNames = useMemo(() => new Map(questionCollections.map(c => [c.id, c.name])), [questionCollections]);
  const selectedFilteredCount = filtered.filter(question => selectedIds.has(question.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedFilteredCount === filtered.length;

  const toggleSelection = (id: string) => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds(previous => {
      const next = new Set(previous);
      if (allFilteredSelected) filtered.forEach(question => next.delete(question.id));
      else filtered.forEach(question => next.add(question.id));
      return next;
    });
  };

  const handleCreateCollection = async () => {
    setSavingCollection(true);
    const result = await createQuestionCollection(newCollectionName);
    setSavingCollection(false);
    if (!result.success || !result.collection) {
      addToast({ type: 'error', title: 'Kategori belum dibuat', message: result.error });
      return;
    }
    setCollectionFilter(result.collection.id);
    setNewCollectionName('');
    setCollectionModalOpen(false);
    addToast({ type: 'success', title: 'Kategori dibuat', message: result.collection.name });
  };

  // Grouping
  const grouped = useMemo(() => {
    if (groupBy === 'none') return [{ key: 'Semua Soal', questions: filtered }];
    const map = new Map<string, BankQuestion[]>();
    filtered.forEach(bq => {
      const key = groupBy === 'kelas'
        ? (bq.className || '— Tanpa Kelas —')
        : (bq.subject || '— Tanpa Mapel —');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(bq);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, questions]) => ({ key, questions }));
  }, [filtered, groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const result = await deleteBankQuestion(deleteId);
    if (result.error) {
      addToast({ type: 'error', title: 'Soal gagal dihapus', message: result.error });
      return;
    }
    if (preview?.id === deleteId) setPreview(null);
    setSelectedIds(previous => {
      const next = new Set(previous);
      next.delete(deleteId);
      return next;
    });
    setDeleteId(null);
    addToast({ type: 'success', title: 'Soal dihapus dari bank soal.' });
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds).filter(id => myBank.some(question => question.id === id));
    if (ids.length === 0) {
      setBulkDeleteOpen(false);
      return;
    }
    setBulkDeleting(true);
    let deletedCount = 0;
    let failedCount = 0;
    for (const id of ids) {
      const result = await deleteBankQuestion(id);
      if (result.error) failedCount += 1;
      else deletedCount += 1;
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelectedIds(new Set());
    if (preview && ids.includes(preview.id)) setPreview(null);
    if (failedCount > 0) {
      addToast({ type: 'error', title: `${deletedCount} soal terhapus`, message: `${failedCount} soal gagal dihapus. Coba lagi untuk soal yang tersisa.` });
    } else {
      addToast({ type: 'success', title: `${deletedCount} soal dihapus`, message: 'Soal dihapus dari bank soal. Soal di ujian yang sudah dibuat tetap aman.' });
    }
  };

  const handleEditSave = async (q: import('../../types').Question) => {
    if (!editQ) return;
    const updateResult = await updateBankQuestion(editQ.id, { ...q });
    if (!updateResult.success) {
      addToast({ type: 'error', title: 'Soal belum tersimpan', message: updateResult.error });
      return;
    }
    setEditQ(null);

    // #10: Cek apakah soal ini dipakai di exam, tawarkan propagasi
    const usedIn = editQ.usedInExamIds || [];
    if (usedIn.length > 0) {
      const shouldPropagate = window.confirm(
        `Soal ini dipakai di ${usedIn.length} ujian. Perbarui juga di ujian tersebut?`
      );
      if (shouldPropagate) {
        let updatedExamCount = 0;
        let skippedAmbiguousCount = 0;
        for (const examId of usedIn) {
          const exam = exams.find(e => e.id === examId);
          if (!exam) continue;
          const matchingQuestions = exam.questions.filter(question => question.text === editQ.text);
          // The legacy relationship records only an exam ID, not a source
          // question ID. Do not guess when the same text appears twice.
          if (matchingQuestions.length !== 1) {
            skippedAmbiguousCount += 1;
            continue;
          }
          const targetId = matchingQuestions[0].id;
          const updatedQuestions = exam.questions.map(question =>
            question.id === targetId ? { ...question, ...q, id: question.id } : question
          );
          if (updatedQuestions.some((question, index) => question !== exam.questions[index])) {
            await storage.saveExam({ ...exam, questions: updatedQuestions });
            updatedExamCount += 1;
          }
        }
        await refreshExams();
        addToast({
          type: skippedAmbiguousCount > 0 ? 'warning' : 'success',
          title: 'Soal diperbarui di bank soal.',
          message: skippedAmbiguousCount > 0
            ? `${updatedExamCount} ujian diperbarui; ${skippedAmbiguousCount} dilewati karena teks soal tidak unik.`
            : `${updatedExamCount} ujian terkait diperbarui.`,
        });
        return;
      }
    }
    addToast({ type: 'success', title: 'Soal diperbarui di bank soal.' });
  };

  const handleShare = async (q: BankQuestion) => {
    const payload = JSON.stringify({
      subject: q.subject,
      className: q.className,
      question: {
        type: q.type,
        text: q.text,
        options: q.options,
        correctOptionId: q.correctOptionId,
        answerGuide: q.answerGuide,
        weight: q.weight,
        timerSeconds: q.timerSeconds,
        tags: q.tags,
        order: 0,
      },
    }, null, 2);
    await navigator.clipboard.writeText(payload);
    addToast({ type: 'success', title: 'Soal siap dibagikan', message: 'Payload JSON soal disalin ke clipboard.' });
  };

  const handleImportShared = async () => {
    if (!currentTeacher) return;
    try {
      const parsed = JSON.parse(sharedPayload);
      const q = parsed.question;
      const now = new Date().toISOString();
      await storage.saveBankQuestion({
        id: crypto.randomUUID(),
        teacherId: currentTeacher.id,
        subject: parsed.subject || currentTeacher.subject || 'Umum',
        className: parsed.className,
        usedInExamIds: [],
        createdAt: now,
        updatedAt: now,
        type: q.type,
        text: q.text,
        imageUrl: q.imageUrl,
        options: q.options,
        correctOptionId: q.correctOptionId,
        answerGuide: q.answerGuide,
        weight: q.weight,
        timerSeconds: q.timerSeconds,
        tags: q.tags || [],
        order: 0,
      });
      setShareOpen(false);
      setSharedPayload('');
      addToast({ type: 'success', title: 'Soal bersama berhasil diimport' });
      location.reload();
    } catch {
      addToast({ type: 'error', title: 'Format soal bersama tidak valid' });
    }
  };

  return (
    <div className="page-content">
      <div className="page-header bank-page-header">
        <div className="bank-page-heading">
          <div className="bank-page-heading-icon"><LibraryBig size={21} /></div>
          <div>
            <h1>Bank Soal</h1>
            <p>Repositori soal pribadi Anda · {myBank.length} soal tersimpan.</p>
          </div>
        </div>
        <div className="bank-page-actions">
          <button className="btn btn-primary btn-sm" onClick={() => setCollectionModalOpen(true)}>
            <FolderPlus size={14} /> Buat Kategori
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShareOpen(true)}>
            <Download size={14} /> Import Soal Bersama
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar bank-filter-toolbar">
        <div className="bank-filter-search-row">
          <div className="search-input-wrap">
            <Search size={15} />
            <input id="bank-page-search" className="form-input search-input" placeholder="Cari soal, mapel, atau kelas..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <span className="bank-filter-result-count">{filtered.length} dari {myBank.length} soal</span>
          {filtered.length > 0 && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={toggleSelectAllFiltered} style={{ marginLeft: 'auto' }}>
              {allFilteredSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              {allFilteredSelected ? 'Batal pilih semua' : 'Pilih semua hasil'}
            </button>
          )}
        </div>
        <div className="bank-filter-select-row">
          <label>
            <span>Jenis soal</span>
            <select className="form-select" value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}>
              <option value="ALL">Semua jenis</option>
              <option value="MULTIPLE_CHOICE">Pilihan ganda</option>
              <option value="SHORT_ANSWER">Jawaban singkat</option>
              <option value="ESSAY">Essay</option>
            </select>
          </label>
          <label>
            <span>Kategori</span>
            <select className="form-select" value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}>
              <option value="ALL">Semua kategori</option>
              {questionCollections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {allTags.length > 0 && (
            <label>
              <span>Tag</span>
              <select className="form-select" value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
                <option value="">Semua tag</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          )}
          <label>
            <span>Kelompokkan menurut</span>
            <select className="form-select" value={groupBy} onChange={e => setGroupBy(e.target.value as typeof groupBy)}>
              <option value="kelas">Kelas</option>
              <option value="mapel">Mata pelajaran</option>
              <option value="none">Tanpa kelompok</option>
            </select>
          </label>
          {(search || typeFilter !== 'ALL' || collectionFilter !== 'ALL' || tagFilter || groupBy !== 'kelas') && (
            <button className="btn btn-ghost btn-sm bank-filter-reset" onClick={() => { setSearch(''); setTypeFilter('ALL'); setCollectionFilter('ALL'); setTagFilter(''); setGroupBy('kelas'); }}>
              Reset filter
            </button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--sp-3)', flexWrap: 'wrap', margin: 'var(--sp-4) 0', padding: 'var(--sp-3) var(--sp-4)', border: '1px solid var(--primary)', borderRadius: 'var(--r-md)', background: 'var(--primary-light)' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedIds.size} soal dipilih</span>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>Batal pilih</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => setBulkDeleteOpen(true)} disabled={bulkDeleting}>
              <Trash2 size={14} /> Hapus yang dipilih
            </button>
          </div>
      </div>
      )}

      <div className="bank-page-layout" style={{ display: 'flex', gap: 'var(--sp-5)' }}>
        {/* Question List Grouped */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {filtered.length === 0 ? (
            <EmptyState icon={<BookOpen size={48} />}
              title={myBank.length === 0 ? 'Bank soal masih kosong' : 'Tidak ada hasil'}
              description={myBank.length === 0 ? 'Soal yang Anda buat di editor akan otomatis masuk bank soal.' : 'Coba ubah filter pencarian.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              {grouped.map(({ key, questions }) => {
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
                        {isCollapsed
                          ? <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                          : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                        }
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{key}</span>
                        <span style={{
                          fontSize: '0.72rem', padding: '2px 8px', borderRadius: 'var(--r-sm)',
                          background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)',
                        }}>{questions.length} soal</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)', marginLeft: 8 }} />
                      </button>
                    )}

                    {!isCollapsed && (
                      <>
                        {groupBy === 'none' && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 'var(--sp-3)' }}>
                            Menampilkan {filtered.length} dari {myBank.length} soal
                          </div>
                        )}
                        <div className="bank-grid bank-question-grid">
                          {questions.map(bq => (
                            <div key={bq.id} className={`bank-card ${preview?.id === bq.id ? 'selected' : ''}`}
                              onClick={() => setPreview(bq)}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                                <button type="button" aria-label={`${selectedIds.has(bq.id) ? 'Batalkan pilihan' : 'Pilih'} soal`} onClick={event => { event.stopPropagation(); toggleSelection(bq.id); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, padding: 0, border: 0, borderRadius: 'var(--r-sm)', background: 'transparent', color: selectedIds.has(bq.id) ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}>
                                  {selectedIds.has(bq.id) ? <CheckSquare size={17} /> : <Square size={17} />}
                                </button>
                                <span className={`badge ${bq.type === 'MULTIPLE_CHOICE' || bq.type === 'SHORT_ANSWER' ? 'badge-pg' : 'badge-essay'}`}>
                                  {bq.type === 'MULTIPLE_CHOICE' ? 'PG' : bq.type === 'SHORT_ANSWER' ? 'Short' : 'Essay'}
                                </span>
                                {bq.tags.slice(0, 2).map(t => <span key={t} className="tag">{t}</span>)}
                              </div>
                              <div className="bank-card-text">{bq.text}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                {bq.collectionId && <span>{collectionNames.get(bq.collectionId) || 'Kategori'}</span>}
                                {bq.collectionId && ' · '}
                                {bq.subject}
                                {bq.className && <span> · <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{bq.className}</span></span>}
                                {' '}· Bobot: {bq.weight} · Dipakai: {bq.usedInExamIds.length}x
                              </div>
                              {/* Actions */}
                              <div className="bank-card-actions" style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}
                                onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => setEditQ(bq)}>
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Hapus" onClick={() => setDeleteId(bq.id)}>
                                  <Trash2 size={13} style={{ color: 'var(--danger)' }} />
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Bagikan" onClick={() => handleShare(bq)}>
                                  <Share2 size={13} style={{ color: 'var(--primary)' }} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Preview Panel */}
        {preview && (
          <div className="bank-preview-panel" style={{ width: 300, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', height: 'fit-content', position: 'sticky', top: 100 }}>
            <div className="bank-preview-title"><BookOpen size={16} /> Preview Soal</div>
            <span className={`badge ${preview.type === 'MULTIPLE_CHOICE' || preview.type === 'SHORT_ANSWER' ? 'badge-pg' : 'badge-essay'}`} style={{ marginBottom: 'var(--sp-3)', display: 'inline-flex' }}>
              {preview.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : preview.type === 'SHORT_ANSWER' ? 'Jawaban Singkat' : 'Essay'}
            </span>
            {preview.className && (
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                {preview.className} · {preview.subject}
              </div>
            )}
            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 'var(--sp-3)' }}>{preview.text}</p>
            {preview.type === 'MULTIPLE_CHOICE' && preview.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {preview.options.map((opt, i) => (
                  <div key={opt.id} style={{
                    padding: '5px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8rem',
                    background: opt.id === preview.correctOptionId ? 'var(--success-light)' : 'var(--surface-2)',
                    color: opt.id === preview.correctOptionId ? 'var(--success)' : 'var(--text-secondary)',
                    border: `1px solid ${opt.id === preview.correctOptionId ? 'var(--success)' : 'var(--border)'}`,
                    fontWeight: opt.id === preview.correctOptionId ? 600 : 400,
                  }}>
                    {optLetters[i]}. {opt.text}
                  </div>
                ))}
              </div>
            )}
            {preview.type === 'ESSAY' && preview.answerGuide && (
              <div style={{ marginTop: 'var(--sp-3)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem' }}>
                <strong style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Panduan Jawaban:</strong>
                <span style={{ color: 'var(--text-secondary)' }}>{preview.answerGuide}</span>
              </div>
            )}
            {preview.type === 'SHORT_ANSWER' && (
              <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><strong>Jawaban diterima:</strong> {(preview.acceptedAnswers ?? []).join(', ')}</div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--sp-3)' }}>
              {preview.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
              Bobot: {preview.weight} poin · Dipakai: {preview.usedInExamIds.length}x
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-3)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleShare(preview)}>
                <Share2 size={13} /> Bagikan JSON
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editQ} onClose={() => setEditQ(null)} size="lg" title="Edit Soal di Bank">
        {editQ && (
          <QuestionEditor
            format={editQ.type === 'ESSAY' ? 'ESSAY_ONLY' : 'PG_ONLY'}
            initial={editQ}
            onSave={handleEditSave}
            onCancel={() => setEditQ(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Hapus dari Bank Soal?"
        message="Soal ini akan dihapus dari bank soal. Soal di ujian yang sudah dibuat tidak terpengaruh."
        confirmLabel="Hapus" danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      <Modal open={bulkDeleteOpen} onClose={() => { if (!bulkDeleting) setBulkDeleteOpen(false); }} title="Hapus banyak soal?"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Batal</button>
            <button type="button" className="btn btn-danger" onClick={() => void handleBulkDelete()} disabled={bulkDeleting}>
              {bulkDeleting ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Menghapus...</> : <><Trash2 size={15} /> Hapus {selectedIds.size} soal</>}
            </button>
          </>
        }>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {selectedIds.size} soal akan dihapus dari bank soal. Soal yang sudah tersalin ke ujian dan jawaban siswa tidak ikut terhapus.
        </p>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Import Soal Bersama" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tempel payload JSON soal yang dibagikan guru lain, lalu import ke bank soal Anda.</p>
          <textarea className="form-textarea" rows={10} placeholder="Paste JSON soal di sini..." value={sharedPayload} onChange={e => setSharedPayload(e.target.value)} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)' }}>
            <button className="btn btn-secondary" onClick={() => setShareOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleImportShared}>Import</button>
          </div>
        </div>
      </Modal>

      <Modal open={collectionModalOpen} onClose={() => setCollectionModalOpen(false)} title="Buat Kategori Bank Soal">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>Gunakan kategori untuk mengelompokkan soal, misalnya “Akidah Kelas 7” atau “PTS Semester 1”.</p>
          <div className="form-group">
            <label className="form-label" htmlFor="collection-name">Nama kategori</label>
            <input id="collection-name" className="form-input" value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} autoFocus placeholder="Contoh: Akidah Kelas 7" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)' }}>
            <button className="btn btn-secondary" onClick={() => setCollectionModalOpen(false)}>Batal</button>
            <button className="btn btn-primary" onClick={handleCreateCollection} disabled={savingCollection || !newCollectionName.trim()}>{savingCollection ? 'Membuat...' : 'Buat Kategori'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
