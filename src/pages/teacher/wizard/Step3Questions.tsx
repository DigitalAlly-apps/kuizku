// Step 3 — Input Soal (4 jalur: Manual, Import, Bank Soal, Duplikasi)
import { useState } from 'react';
import { Plus, Upload, BookOpen, Copy, Edit2, Trash2, GripVertical, Save } from 'lucide-react';
import QuestionEditor from '../../../components/exam/QuestionEditor';
import ImportModal from '../../../components/exam/ImportModal';
import BankModal from '../../../components/exam/BankModal';
import { Modal, ConfirmDialog, FormatBadge } from '../../../components/ui';
import { useApp, useToast } from '../../../context/AppContext';
import { generateId, reorderQuestions } from '../../../utils/helpers';
import type { Question, ExamFormat } from '../../../types';

interface Props {
  format: ExamFormat;
  subject: string;
  initial: Question[];
  onNext: (questions: Question[]) => void;
  onBack: () => void;
}

type ActiveModal = 'manual' | 'import' | 'bank' | 'edit' | null;

export default function Step3Questions({ format, subject, initial, onNext, onBack }: Props) {
  const { addToBankFromQuestion } = useApp();
  const { addToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>(initial);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [editTarget, setEditTarget] = useState<Question | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dupDialogId, setDupDialogId] = useState<string | null>(null);

  const addQuestions = (qs: Question[]) => {
    const merged = reorderQuestions([...questions, ...qs.map(q => ({ ...q, id: generateId() }))]);
    setQuestions(merged);
    addToast({ type: 'success', title: `${qs.length} soal ditambahkan!` });
  };

  const handleManualSave = (q: Question) => {
    let updated: Question[];
    if (editTarget) {
      updated = reorderQuestions(questions.map(x => x.id === editTarget.id ? { ...q, id: editTarget.id } : x));
    } else {
      updated = reorderQuestions([...questions, q]);
      // Auto-save to bank
      addToBankFromQuestion(q, subject);
    }
    setQuestions(updated);
    setActiveModal(null);
    setEditTarget(null);
    addToast({ type: 'success', title: editTarget ? 'Soal diperbarui' : 'Soal ditambahkan & disimpan ke bank soal' });
  };

  const handleEdit = (q: Question) => {
    setEditTarget(q);
    setActiveModal('edit');
  };

  const handleDelete = () => {
    if (!deleteId) return;
    setQuestions(reorderQuestions(questions.filter(q => q.id !== deleteId)));
    setDeleteId(null);
    addToast({ type: 'info', title: 'Soal dihapus' });
  };

  const handleDuplicate = (id: string) => {
    const orig = questions.find(q => q.id === id);
    if (!orig) return;
    const copy: Question = { ...orig, id: generateId(), text: `${orig.text} (Salinan)`, order: 0 };
    const idx = questions.findIndex(q => q.id === id);
    const inserted = [...questions.slice(0, idx + 1), copy, ...questions.slice(idx + 1)];
    setQuestions(reorderQuestions(inserted));
    setDupDialogId(null);
    addToast({ type: 'success', title: 'Soal diduplikasi', message: 'Edit soal salinan sesuai kebutuhan.' });
  };

  const formatBtnLabel = (f: ExamFormat) => {
    if (f === 'PG_ONLY') return 'Soal Pilihan Ganda';
    if (f === 'ESSAY_ONLY') return 'Soal Essay';
    return 'Soal Baru';
  };

  const pgCount = questions.filter(q => q.type === 'MULTIPLE_CHOICE').length;
  const essayCount = questions.filter(q => q.type === 'ESSAY').length;
  const totalWeight = questions.reduce((s, q) => s + q.weight, 0);

  const handleNext = () => {
    if (questions.length === 0) {
      addToast({ type: 'error', title: 'Tambahkan minimal 1 soal terlebih dahulu' });
      return;
    }
    onNext(questions);
  };

  const optLetters = 'ABCDEF';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 'var(--sp-4)' }}>
        <div>
          <h2>Input Soal</h2>
          <p style={{ color: 'var(--text-muted)' }}>Tambahkan soal melalui salah satu jalur di bawah ini.</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{questions.length} soal</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>•</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{totalWeight} poin</span>
        </div>
      </div>

      {/* 4 input paths */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
        {[
          { key: 'manual', icon: <Plus size={20} />, label: 'Input Manual', hint: 'Tulis soal baru', color: 'var(--primary)', bg: 'var(--primary-light)' },
          { key: 'import', icon: <Upload size={20} />, label: 'Import File', hint: 'Excel / CSV', color: 'var(--success)', bg: 'var(--success-light)' },
          { key: 'bank', icon: <BookOpen size={20} />, label: 'Bank Soal', hint: 'Pakai soal lama', color: 'var(--secondary)', bg: 'var(--secondary-light)' },
        ].map(btn => (
          <button key={btn.key} className="card" style={{ border: `1px solid ${btn.color}30`, background: btn.bg, cursor: 'pointer', textAlign: 'center', padding: 'var(--sp-4)', transition: 'all 0.15s ease' }}
            onClick={() => setActiveModal(btn.key as ActiveModal)}
            onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => (e.currentTarget.style.transform = '')}>
            <div style={{ color: btn.color, marginBottom: 6 }}>{btn.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: btn.color }}>{btn.label}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{btn.hint}</div>
          </button>
        ))}
        {/* Format info card */}
        <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-4)', background: 'var(--surface-2)' }}>
          <div style={{ marginBottom: 8 }}>
            {format === 'PG_ONLY' && <span className="badge badge-pg">PG</span>}
            {format === 'ESSAY_ONLY' && <span className="badge badge-essay">Essay</span>}
            {format === 'COMBINATION' && <><span className="badge badge-pg">PG</span><span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>+</span><span className="badge badge-essay">Essay</span></>}
          </div>
          {format === 'COMBINATION' && (
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              PG: {pgCount} • Essay: {essayCount}
            </div>
          )}
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4 }}>Format ujian</div>
        </div>
      </div>

      {/* Question list */}
      {questions.length === 0 ? (
        <div className="card" style={{ padding: 'var(--sp-10)', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', opacity: 0.4, marginBottom: 'var(--sp-3)' }}>📋</div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Belum ada soal. Gunakan salah satu jalur di atas untuk menambahkan.</p>
        </div>
      ) : (
        <div className="question-list">
          {questions.map((q, idx) => (
            <div key={q.id} className="question-item">
              <div className="question-item-drag"><GripVertical size={16} /></div>
              <div className="question-item-num">{idx + 1}</div>
              <div className="question-item-body">
                <div className="question-item-text" style={{ fontWeight: 500 }}>{q.text}</div>
                {q.type === 'MULTIPLE_CHOICE' && q.options && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {q.options.slice(0, 4).map((opt, i) => (
                      <div key={opt.id} style={{ fontSize: '0.78rem', color: opt.id === q.correctOptionId ? 'var(--success)' : 'var(--text-muted)', fontWeight: opt.id === q.correctOptionId ? 600 : 400 }}>
                        {optLetters[i]}. {opt.text} {opt.id === q.correctOptionId && '✓'}
                      </div>
                    ))}
                    {(q.options.length > 4) && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+{q.options.length - 4} opsi lagi</div>}
                  </div>
                )}
                <div className="question-item-meta">
                  <span className={`badge ${q.type === 'MULTIPLE_CHOICE' ? 'badge-pg' : 'badge-essay'}`} style={{ fontSize: '0.68rem' }}>
                    {q.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Bobot: {q.weight}</span>
                  {q.timerSeconds && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱ {q.timerSeconds}s</span>}
                  {q.tags.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <div className="question-item-actions">
                <button className="btn btn-ghost btn-icon" title="Edit" onClick={() => handleEdit(q)}><Edit2 size={14} /></button>
                <button className="btn btn-ghost btn-icon" title="Duplikasi" onClick={() => setDupDialogId(q.id)}><Copy size={14} /></button>
                <button className="btn btn-ghost btn-icon" title="Hapus" onClick={() => setDeleteId(q.id)}><Trash2 size={14} style={{ color: 'var(--danger)' }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={activeModal === 'manual'} onClose={() => setActiveModal(null)} size="lg"
        title="Tambah Soal Baru" subtitle={`Format: ${format === 'PG_ONLY' ? 'Pilihan Ganda' : format === 'ESSAY_ONLY' ? 'Essay' : 'PG atau Essay'}`}>
        <QuestionEditor format={format} onSave={handleManualSave} onCancel={() => setActiveModal(null)} />
      </Modal>

      <Modal open={activeModal === 'edit' && !!editTarget} onClose={() => { setActiveModal(null); setEditTarget(null); }} size="lg"
        title="Edit Soal">
        {editTarget && (
          <QuestionEditor format={format} initial={editTarget}
            onSave={handleManualSave} onCancel={() => { setActiveModal(null); setEditTarget(null); }} />
        )}
      </Modal>

      <ImportModal open={activeModal === 'import'} format={format}
        onImport={addQuestions} onClose={() => setActiveModal(null)} />

      <BankModal open={activeModal === 'bank'} format={format}
        existingIds={questions.map(q => q.id)}
        onAdd={addQuestions} onClose={() => setActiveModal(null)} />

      <ConfirmDialog open={!!deleteId} title="Hapus Soal?"
        message="Soal ini akan dihapus dari daftar ujian." confirmLabel="Hapus" danger
        onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />

      <ConfirmDialog open={!!dupDialogId} title="Duplikasi Soal?"
        message="Salinan soal akan muncul tepat di bawah soal ini. Anda bisa mengeditnya segera."
        confirmLabel="Duplikasi"
        onConfirm={() => dupDialogId && handleDuplicate(dupDialogId)}
        onCancel={() => setDupDialogId(null)} />

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-8)', paddingTop: 'var(--sp-6)', borderTop: '1px solid var(--border)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Kembali</button>
        <button className="btn btn-primary btn-lg" onClick={handleNext} disabled={questions.length === 0}>
          Lanjut: Review ({questions.length} soal) →
        </button>
      </div>
    </div>
  );
}
