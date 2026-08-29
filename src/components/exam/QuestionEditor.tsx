// ============================================================
// Question Editor — PG & Essay editor with real-time preview
// ============================================================
import { useState } from 'react';
import { Plus, Trash2, CheckCircle } from 'lucide-react';
import { TagInput } from '../ui';
import NumericInput from '../ui/NumericInput';
import { generateId, validateQuestion } from '../../utils/helpers';
import type { Question, QuestionType, ExamFormat } from '../../types';

interface Props {
  format: ExamFormat;
  initial?: Partial<Question>;
  onSave: (q: Question) => void;
  onCancel: () => void;
}

const DEFAULT_PG: Partial<Question> = { type: 'MULTIPLE_CHOICE', text: '', options: [{ id: generateId(), text: '' }, { id: generateId(), text: '' }], correctOptionId: '', weight: 1, tags: [] };
const DEFAULT_ESSAY: Partial<Question> = { type: 'ESSAY', text: '', answerGuide: '', weight: 5, tags: [] };
const DEFAULT_SHORT: Partial<Question> = { type: 'SHORT_ANSWER', text: '', acceptedAnswers: [], weight: 1, tags: [] };

export default function QuestionEditor({ format, initial, onSave, onCancel }: Props) {
  const canPG = format === 'PG_ONLY' || format === 'COMBINATION';


  const defaultType: QuestionType = canPG ? 'MULTIPLE_CHOICE' : 'ESSAY';
  const [q, setQ] = useState<Partial<Question>>(initial ?? (defaultType === 'MULTIPLE_CHOICE' ? { ...DEFAULT_PG, options: [{ id: generateId(), text: '' }, { id: generateId(), text: '' }] } : { ...DEFAULT_ESSAY }));
  const [errors, setErrors] = useState<string[]>([]);

  const difficulty = (q.tags ?? []).find(t => t.startsWith('difficulty:'))?.replace('difficulty:', '') ?? '';

  const setField = (k: keyof Question, v: unknown) => setQ(prev => ({ ...prev, [k]: v }));

  const switchType = (t: QuestionType) => {
    setQ(t === 'MULTIPLE_CHOICE'
      ? { ...DEFAULT_PG, options: [{ id: generateId(), text: '' }, { id: generateId(), text: '' }] }
      : t === 'SHORT_ANSWER' ? { ...DEFAULT_SHORT } : { ...DEFAULT_ESSAY });
    setErrors([]);
  };

  const addOption = () => {
    if ((q.options?.length ?? 0) >= 6) return;
    setField('options', [...(q.options ?? []), { id: generateId(), text: '' }]);
  };

  const removeOption = (id: string) => {
    const opts = (q.options ?? []).filter(o => o.id !== id);
    setField('options', opts);
    if (q.correctOptionId === id) setField('correctOptionId', '');
  };

  const updateOption = (id: string, text: string) => {
    setField('options', (q.options ?? []).map(o => o.id === id ? { ...o, text } : o));
  };

  const handleSave = () => {
    const errs = validateQuestion(q);
    if (errs.length) { setErrors(errs); return; }
    onSave({
      id: initial?.id ?? generateId(),
      type: q.type!,
      text: q.text!,
      options: q.options,
      correctOptionId: q.correctOptionId,
      acceptedAnswers: q.acceptedAnswers,
      answerGuide: q.answerGuide,
      weight: q.weight ?? 1,
      tags: q.tags ?? [],
      order: initial?.order ?? 0,
      timerSeconds: q.timerSeconds,
    });
  };

  const optionLetters = 'ABCDEF';

  return (
    <div>
      {/* Type switcher (only in COMBINATION mode) */}
      {format !== 'ESSAY_ONLY' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--sp-5)' }}>
          <button className={`btn btn-sm ${q.type === 'MULTIPLE_CHOICE' ? 'btn-primary' : 'btn-secondary'}`}
            type="button" onClick={() => switchType('MULTIPLE_CHOICE')}>
            Pilihan Ganda
          </button>
          <button className={`btn btn-sm ${q.type === 'ESSAY' ? 'btn-primary' : 'btn-secondary'}`}
            type="button" onClick={() => switchType('ESSAY')}>
            Essay
          </button>
          <button className={`btn btn-sm ${q.type === 'SHORT_ANSWER' ? 'btn-primary' : 'btn-secondary'}`}
            type="button" onClick={() => switchType('SHORT_ANSWER')}>
            Jawaban Singkat
          </button>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{ marginBottom: 'var(--sp-4)', padding: '10px 14px', background: 'var(--danger-light)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--r-md)' }}>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {errors.map((e, i) => <li key={i} style={{ color: 'var(--danger)', fontSize: '0.8rem' }}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Teks Soal */}
      <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
        <label className="form-label">Teks Soal <span style={{ color: 'var(--danger)' }}>*</span></label>
        <textarea className="form-textarea" rows={4} placeholder="Tulis pertanyaan di sini..."
          value={q.text ?? ''} onChange={e => setField('text', e.target.value)} id="q-text" />
      </div>

      {/* Multiple Choice Options */}
      {q.type === 'MULTIPLE_CHOICE' && (
        <div style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="form-label" style={{ marginBottom: 'var(--sp-3)', display: 'block' }}>
            Pilihan Jawaban <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {(q.options ?? []).map((opt, idx) => (
              <div key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                {/* Correct answer radio */}
                <button type="button"
                  style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: `2px solid ${q.correctOptionId === opt.id ? 'var(--success)' : 'var(--border-strong)'}`,
                    background: q.correctOptionId === opt.id ? 'var(--success-light)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s ease',
                  }}
                  onClick={() => setField('correctOptionId', opt.id)}
                  title="Tandai sebagai jawaban benar">
                  {q.correctOptionId === opt.id && <CheckCircle size={14} color="var(--success)" />}
                </button>
                <span style={{ fontWeight: 700, width: 20, color: 'var(--text-muted)', flexShrink: 0, fontSize: '0.875rem' }}>
                  {optionLetters[idx]}.
                </span>
                <input className="form-input" style={{ flex: 1 }}
                  placeholder={`Opsi ${optionLetters[idx]}`}
                  value={opt.text} onChange={e => updateOption(opt.id, e.target.value)}
                  id={`option-${opt.id}`} />
                {(q.options?.length ?? 0) > 2 && (
                  <button type="button" className="btn btn-ghost btn-icon" onClick={() => removeOption(opt.id)}>
                    <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {(q.options?.length ?? 0) < 6 && (
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 'var(--sp-2)' }} onClick={addOption}>
              <Plus size={14} /> Tambah Opsi
            </button>
          )}
          <p className="form-hint" style={{ marginTop: 'var(--sp-2)' }}>
            Klik lingkaran di kiri opsi untuk menandai jawaban yang benar.
          </p>
        </div>
      )}

      {/* Essay Guide */}
      {q.type === 'SHORT_ANSWER' && (
        <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="form-label">Jawaban yang Diterima <span style={{ color: 'var(--danger)' }}>*</span></label>
          <textarea className="form-textarea" rows={4} placeholder="Satu jawaban per baris, contoh:\nAbu Bakar\nAbu Bakar Ash-Shiddiq\nAbu Bakr"
            value={(q.acceptedAnswers ?? []).join('\n')}
            onChange={e => setField('acceptedAnswers', e.target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))} />
          <span className="form-hint">Perbandingan otomatis memakai huruf kecil, trim, dan spasi berulang yang dirapikan.</span>
        </div>
      )}

      {/* Essay Guide */}
      {q.type === 'ESSAY' && (
        <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
          <label className="form-label">Panduan/Rubrik Penilaian <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>(hanya terlihat guru)</span></label>
          <textarea className="form-textarea" rows={3} placeholder="Contoh: 2 poin definisi tepat, 2 poin contoh benar, 1 poin struktur jawaban..."
            value={q.answerGuide ?? ''} onChange={e => setField('answerGuide', e.target.value)} id="q-guide" />
        </div>
      )}

      {/* Weight & Timer */}
      <div className="form-row form-row-2" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="q-weight">Bobot Nilai <span style={{ color: 'var(--danger)' }}>*</span></label>
          <NumericInput id="q-weight" className="form-input" min={1} max={100} inputMode="numeric" integer fallbackValue={1}
            value={q.weight} onValueChange={value => setField('weight', value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="q-timer">Timer per Soal (detik, opsional)</label>
          <NumericInput id="q-timer" className="form-input" min={0} inputMode="numeric" integer placeholder="0 = tidak ada"
            value={q.timerSeconds} onValueChange={value => setField('timerSeconds', value)} />
          <span className="form-hint">Kosongkan untuk memakai default timer ujian.</span>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 'var(--sp-4)' }}>
        <label className="form-label" htmlFor="q-difficulty">Tingkat Kesulitan</label>
        <select id="q-difficulty" className="form-select" value={difficulty}
          onChange={e => {
            const cleanTags = (q.tags ?? []).filter(t => !t.startsWith('difficulty:'));
            setField('tags', e.target.value ? [...cleanTags, `difficulty:${e.target.value}`] : cleanTags);
          }}>
          <option value="">Belum ditentukan</option>
          <option value="easy">Mudah</option>
          <option value="medium">Sedang</option>
          <option value="hard">Sulit</option>
        </select>
      </div>

      {/* Tags */}
      <div className="form-group" style={{ marginBottom: 'var(--sp-6)' }}>
        <label className="form-label">Tag Kategori</label>
        <TagInput tags={q.tags ?? []} onChange={tags => setField('tags', tags)}
          placeholder="Contoh: Aljabar, Kelas 10... tekan Enter" />
        <span className="form-hint">Tekan Enter atau koma untuk menambah tag.</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Batal</button>
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          {initial ? 'Simpan Perubahan' : 'Tambah Soal'}
        </button>
      </div>
    </div>
  );
}
