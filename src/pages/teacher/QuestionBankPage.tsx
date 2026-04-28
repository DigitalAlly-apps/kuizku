import { useState, useMemo } from 'react';
import { Search, BookOpen, Trash2, Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { useApp, useToast } from '../../context/AppContext';
import { EmptyState, ConfirmDialog, Modal } from '../../components/ui';
import QuestionEditor from '../../components/exam/QuestionEditor';
import type { BankQuestion } from '../../types';

const optLetters = 'ABCDEF';

export default function QuestionBankPage() {
  const { currentTeacher, bankQuestions, deleteBankQuestion, updateBankQuestion } = useApp();
  const { addToast } = useToast();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MULTIPLE_CHOICE' | 'ESSAY'>('ALL');
  const [tagFilter, setTagFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState<BankQuestion | null>(null);
  const [preview, setPreview] = useState<BankQuestion | null>(null);
  const [groupBy, setGroupBy] = useState<'kelas' | 'mapel' | 'none'>('kelas');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const myBank = useMemo(() =>
    bankQuestions.filter(bq => bq.teacherId === currentTeacher?.id), [bankQuestions, currentTeacher]);

  const allTags = useMemo(() =>
    [...new Set(myBank.flatMap(bq => bq.tags))].sort(), [myBank]);

  const filtered = useMemo(() => {
    return myBank.filter(bq => {
      if (typeFilter !== 'ALL' && bq.type !== typeFilter) return false;
      if (tagFilter && !bq.tags.includes(tagFilter)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return bq.text.toLowerCase().includes(s) ||
          bq.subject.toLowerCase().includes(s) ||
          (bq.className || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [myBank, typeFilter, tagFilter, search]);

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

  const handleDelete = () => {
    if (!deleteId) return;
    deleteBankQuestion(deleteId);
    if (preview?.id === deleteId) setPreview(null);
    setDeleteId(null);
    addToast({ type: 'success', title: 'Soal dihapus dari bank soal.' });
  };

  const handleEditSave = (q: import('../../types').Question) => {
    if (!editQ) return;
    updateBankQuestion(editQ.id, { ...q });
    setEditQ(null);
    addToast({ type: 'success', title: 'Soal diperbarui.' });
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Bank Soal</h1>
        <p>Repositori soal pribadi Anda — {myBank.length} soal tersimpan.</p>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar" style={{ flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        <div className="search-input-wrap" style={{ flex: '1 1 200px' }}>
          <Search size={15} />
          <input id="bank-page-search" className="form-input search-input" placeholder="Cari soal, mapel, atau kelas..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {(['ALL', 'MULTIPLE_CHOICE', 'ESSAY'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setTypeFilter(t)}>
              {t === 'ALL' ? 'Semua' : t === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <select className="form-select" style={{ width: 160, fontSize: '0.8rem' }}
            value={tagFilter} onChange={e => setTagFilter(e.target.value)}>
            <option value="">Semua Tag</option>
            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        {/* Group by */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Kelompokkan:</span>
          {(['kelas', 'mapel', 'none'] as const).map(g => (
            <button key={g} className={`btn btn-sm ${groupBy === g ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setGroupBy(g)}>
              {g === 'kelas' ? 'Kelas' : g === 'mapel' ? 'Mapel' : 'Tidak'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--sp-5)' }}>
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
                        <div className="bank-grid">
                          {questions.map(bq => (
                            <div key={bq.id} className={`bank-card ${preview?.id === bq.id ? 'selected' : ''}`}
                              onClick={() => setPreview(bq)}>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
                                <span className={`badge ${bq.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`}>
                                  {bq.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                                </span>
                                {bq.tags.slice(0, 2).map(t => <span key={t} className="tag">{t}</span>)}
                              </div>
                              <div className="bank-card-text">{bq.text}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 6 }}>
                                {bq.subject}
                                {bq.className && <span> · <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{bq.className}</span></span>}
                                {' '}· Bobot: {bq.weight} · Dipakai: {bq.usedInExamIds.length}x
                              </div>
                              {/* Actions */}
                              <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}
                                onClick={e => e.stopPropagation()}>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Edit" onClick={() => setEditQ(bq)}>
                                  <Edit2 size={13} />
                                </button>
                                <button className="btn btn-ghost btn-sm btn-icon" title="Hapus" onClick={() => setDeleteId(bq.id)}>
                                  <Trash2 size={13} style={{ color: 'var(--danger)' }} />
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
          <div style={{ width: 300, flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-5)', height: 'fit-content', position: 'sticky', top: 100 }}>
            <div style={{ fontWeight: 700, marginBottom: 'var(--sp-3)' }}>Preview Soal</div>
            <span className={`badge ${preview.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`} style={{ marginBottom: 'var(--sp-3)', display: 'inline-flex' }}>
              {preview.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
            </span>
            {preview.className && (
              <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
                📚 {preview.className} · {preview.subject}
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 'var(--sp-3)' }}>
              {preview.tags.map(t => <span key={t} className="tag">{t}</span>)}
            </div>
            <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
              Bobot: {preview.weight} poin · Dipakai: {preview.usedInExamIds.length}x
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Modal open={!!editQ} onClose={() => setEditQ(null)} size="lg" title="Edit Soal di Bank">
        {editQ && (
          <QuestionEditor
            format={editQ.type === 'MULTIPLE_CHOICE' ? 'PG_ONLY' : 'ESSAY_ONLY'}
            initial={editQ}
            onSave={handleEditSave}
            onCancel={() => setEditQ(null)}
          />
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} title="Hapus dari Bank Soal?"
        message="Soal ini akan dihapus dari bank soal. Soal di ujian yang sudah dibuat tidak terpengaruh."
        confirmLabel="Hapus" danger onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
    </div>
  );
}
