// ============================================================
// Bank Soal Panel — select questions from personal bank
// ============================================================
import { useState, useMemo } from 'react';
import { Search, CheckSquare, Square, Plus, BookOpen } from 'lucide-react';
import { Modal, EmptyState } from '../ui';
import { useBank } from '../../context/AppContext';
import type { ExamFormat, Question, BankQuestion } from '../../types';

interface Props {
  open: boolean;
  format: ExamFormat;
  existingIds: string[];
  onAdd: (questions: Question[]) => void;
  onClose: () => void;
}

export default function BankModal({ open, format, onAdd, onClose }: Props) {
  const { bankQuestions } = useBank();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'MULTIPLE_CHOICE' | 'ESSAY'>('ALL');
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'easy' | 'medium' | 'hard'>('ALL');
  const [randomCount, setRandomCount] = useState(5);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<BankQuestion | null>(null);

  const eligible = useMemo(() => {
    return bankQuestions.filter(bq => {
      if (format === 'PG_ONLY' && bq.type !== 'MULTIPLE_CHOICE') return false;
      if (format === 'ESSAY_ONLY' && bq.type !== 'ESSAY') return false;
      return true;
    });
  }, [bankQuestions, format]);

  const filtered = useMemo(() => {
    return eligible.filter(bq => {
      if (typeFilter !== 'ALL' && bq.type !== typeFilter) return false;
      if (difficultyFilter !== 'ALL' && !bq.tags.includes(`difficulty:${difficultyFilter}`)) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return bq.text.toLowerCase().includes(s) || bq.subject.toLowerCase().includes(s) || bq.tags.some(t => t.toLowerCase().includes(s));
      }
      return true;
    });
  }, [eligible, typeFilter, difficultyFilter, search]);

  const selectRandom = () => {
    const shuffled = [...filtered].sort(() => Math.random() - 0.5).slice(0, Math.max(1, randomCount));
    setSelected(new Set(shuffled.map(q => q.id)));
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(b => b.id)));
  };

  const handleAdd = () => {
    const qs: Question[] = filtered
      .filter(bq => selected.has(bq.id))
      .map(bq => ({
        id: crypto.randomUUID(),
        type: bq.type,
        text: bq.text,
        options: bq.options,
        correctOptionId: bq.correctOptionId,
        answerGuide: bq.answerGuide,
        weight: bq.weight,
        tags: bq.tags,
        order: 0,
        timerSeconds: bq.timerSeconds,
      }));
    onAdd(qs);
    setSelected(new Set());
    onClose();
  };

  const optLetters = 'ABCDEF';

  return (
    <Modal open={open} onClose={onClose} title="Pilih dari Bank Soal" size="xl"
      subtitle={`${eligible.length} soal tersedia di bank soal Anda`}>
      <div style={{ display: 'flex', gap: 'var(--sp-5)', height: 500 }}>
        {/* Left — list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', minWidth: 0 }}>
          {/* Search & filter */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" style={{ paddingLeft: 34, fontSize: '0.8rem' }}
                placeholder="Cari soal..." value={search} onChange={e => setSearch(e.target.value)} id="bank-search" />
            </div>
            {['ALL', 'MULTIPLE_CHOICE', 'ESSAY'].map(f => (
              <button key={f} className={`btn btn-sm ${typeFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTypeFilter(f as typeof typeFilter)}>
                {f === 'ALL' ? 'Semua' : f === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
              </button>
            ))}
            <select className="form-select" style={{ width: 130, fontSize: '0.8rem' }} value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value as typeof difficultyFilter)}>
              <option value="ALL">Semua Level</option>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input className="form-input" type="number" min={1} max={filtered.length || 1} style={{ width: 90, fontSize: '0.8rem' }}
              value={randomCount} onChange={e => setRandomCount(parseInt(e.target.value) || 1)} />
            <button className="btn btn-secondary btn-sm" disabled={filtered.length === 0} onClick={selectRandom}>Pilih Acak dari Filter</button>
          </div>

          {/* Select all */}
          {filtered.length > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={toggleAll}>
              {selected.size === filtered.length ? <CheckSquare size={14} /> : <Square size={14} />}
              {selected.size === filtered.length ? 'Batalkan Semua' : `Pilih Semua (${filtered.length})`}
            </button>
          )}

          {/* Question list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {filtered.length === 0 ? (
              <EmptyState icon={<BookOpen size={36} />} title="Tidak ada soal" description="Belum ada soal di bank soal atau tidak cocok dengan filter." />
            ) : (
              filtered.map(bq => (
                <div key={bq.id}
                  className={`bank-card ${selected.has(bq.id) ? 'selected' : ''}`}
                  onClick={() => { toggle(bq.id); setPreview(bq); }}>
                  <div className="bank-card-checkbox" onClick={e => { e.stopPropagation(); toggle(bq.id); }}>
                    {selected.has(bq.id) ? <CheckSquare size={18} style={{ color: 'var(--primary)' }} /> : <Square size={18} style={{ color: 'var(--text-muted)' }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <span className={`badge ${bq.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`}>
                      {bq.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                    </span>
                    {bq.tags.slice(0, 2).map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                  <div className="bank-card-text">{bq.text}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Bobot: {bq.weight} • {bq.subject} • Dipakai: {bq.usedInExamIds.length}x
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right — preview */}
        <div style={{ width: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', paddingLeft: 'var(--sp-5)', overflowY: 'auto' }}>
          {preview ? (
            <div>
              <div style={{ fontWeight: 700, marginBottom: 'var(--sp-3)', fontSize: '0.875rem' }}>Preview Soal</div>
              <div className={`badge ${preview.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`} style={{ marginBottom: 'var(--sp-3)' }}>
                {preview.type === 'MULTIPLE_CHOICE' ? 'Pilihan Ganda' : 'Essay'}
              </div>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: 'var(--sp-3)' }}>{preview.text}</p>
              {preview.type === 'MULTIPLE_CHOICE' && preview.options && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {preview.options.map((opt, i) => (
                    <div key={opt.id} style={{
                      padding: '6px 10px', borderRadius: 'var(--r-sm)', fontSize: '0.8rem',
                      background: opt.id === preview.correctOptionId ? 'var(--success-light)' : 'var(--surface-2)',
                      border: `1px solid ${opt.id === preview.correctOptionId ? 'var(--success)' : 'var(--border)'}`,
                      color: opt.id === preview.correctOptionId ? 'var(--success)' : 'var(--text-secondary)',
                      fontWeight: opt.id === preview.correctOptionId ? 600 : 400,
                    }}>
                      {optLetters[i]}. {opt.text}
                    </div>
                  ))}
                </div>
              )}
              {preview.type === 'ESSAY' && preview.answerGuide && (
                <div style={{ marginTop: 'var(--sp-3)', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <strong>Panduan:</strong> {preview.answerGuide}
                </div>
              )}
              <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Bobot: {preview.weight} poin
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 'var(--sp-4)' }}>
              Klik soal untuk melihat preview.
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-5)', paddingTop: 'var(--sp-5)', borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          {selected.size} soal dipilih
        </span>
        <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={handleAdd}>
            <Plus size={14} /> Tambahkan ke Ujian
          </button>
        </div>
      </div>
    </Modal>
  );
}
