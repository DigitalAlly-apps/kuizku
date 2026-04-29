// Step 1 — General Settings
import { useState } from 'react';
import { Toggle } from '../../../components/ui';
import type { ExamSettings, ExamType } from '../../../types';

const SUBJECTS = [
  'Aqidah Akhlaq', 'Fiqih', 'Qur\'an Hadits', 'Sejarah Kebudayaan Islam (SKI)', 'Bahasa Arab',
  'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'IPA', 'IPS', 
  'Fisika', 'Kimia', 'Biologi', 'Geografi', 'Sejarah', 'PKn', 
  'Seni Budaya', 'PJOK', 'Prakarya', 'Ekonomi', 'Sosiologi', 'Lainnya'
];

interface Props {
  initial: {
    title: string; description: string; subject: string; className?: string;
    activeFrom: string; activeTo: string; settings: ExamSettings; examType: ExamType;
  };
  onNext: (data: Props['initial']) => void;
}

export default function Step1Setup({ initial, onNext }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [subject, setSubject] = useState(initial.subject);
  const [className, setClassName] = useState(initial.className || '');
  const [activeFrom, setActiveFrom] = useState(initial.activeFrom);
  const [activeTo, setActiveTo] = useState(initial.activeTo);
  const [settings, setSettings] = useState<ExamSettings>(initial.settings);
  const [examType, setExamType] = useState<ExamType>(initial.examType);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setSetting = <K extends keyof ExamSettings>(k: K, v: ExamSettings[K]) =>
    setSettings(s => ({ ...s, [k]: v }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Judul ujian wajib diisi';
    if (!subject) e.subject = 'Mata pelajaran wajib dipilih';
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext({ title, description, subject, className, activeFrom, activeTo, settings, examType });
  };

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--sp-2)' }}>Pengaturan Ujian</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>Isi informasi dasar dan tipe kegiatan ini.</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        {/* Tipe Kegiatan */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Tipe Kegiatan <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {([
              ['UJIAN', '📝 Ujian', 'var(--danger)', 'var(--danger-light)'],
              ['TUGAS', '📋 Tugas', 'var(--warning)', 'var(--warning-light)'],
              ['LATIHAN', '🎯 Latihan', 'var(--success)', 'var(--success-light)'],
            ] as const).map(([v, label, color, bg]) => (
              <button key={v} type="button"
                style={{
                  padding: '10px 18px', borderRadius: 'var(--r-md)', border: `2px solid ${examType === v ? color : 'var(--border-strong)'}`,
                  background: examType === v ? bg : 'var(--surface-2)', color: examType === v ? color : 'var(--text-muted)',
                  fontWeight: examType === v ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '0.875rem',
                }}
                onClick={() => setExamType(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="s1-title">Judul Ujian <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="s1-title" className={`form-input ${errors.title ? 'error' : ''}`} placeholder="Contoh: UTS Matematika Kelas X Semester 1"
            value={title} onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: '' })); }} autoFocus />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="s1-desc">Deskripsi (opsional)</label>
          <textarea id="s1-desc" className="form-textarea" rows={2} placeholder="Instruksi umum atau deskripsi singkat ujian..."
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="s1-subject">Mata Pelajaran <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input list="subjects-list" id="s1-subject" className={`form-input ${errors.subject ? 'error' : ''}`}
              placeholder="Contoh: Bahasa Arab, Fiqih..."
              value={subject} onChange={e => { setSubject(e.target.value); setErrors(er => ({ ...er, subject: '' })); }} />
            <datalist id="subjects-list">
              {SUBJECTS.map(s => <option key={s} value={s} />)}
            </datalist>
            {errors.subject && <span className="form-error">{errors.subject}</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="s1-class">Kelas (opsional)</label>
            <input id="s1-class" className="form-input" placeholder="Contoh: Kelas 10A, Kelas 12 IPA..."
              value={className} onChange={e => setClassName(e.target.value)} />
          </div>
        </div>
        
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label" htmlFor="s1-from">Aktif Mulai (opsional)</label>
            <input id="s1-from" type="datetime-local" className="form-input" value={activeFrom} onChange={e => setActiveFrom(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="s1-to">Aktif Hingga (opsional)</label>
            <input id="s1-to" type="datetime-local" className="form-input" value={activeTo} onChange={e => setActiveTo(e.target.value)} />
          </div>
        </div>

        {/* Timer Mode */}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Mode Timer</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
            {([['NONE', 'Tanpa Timer'], ['WHOLE_EXAM', 'Keseluruhan Ujian'], ['PER_QUESTION', 'Per Soal']] as const).map(([v, l]) => (
              <button key={v} type="button"
                className={`btn btn-sm ${settings.timerMode === v ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSetting('timerMode', v)}>
                {l}
              </button>
            ))}
          </div>
          {settings.timerMode === 'WHOLE_EXAM' && (
            <div className="form-group" style={{ marginTop: 'var(--sp-3)', maxWidth: 200 }}>
              <label className="form-label" htmlFor="s1-timer">Durasi Total (menit)</label>
              <input id="s1-timer" type="number" className="form-input" min={5} max={300}
                value={Math.round((settings.wholExamTimerSeconds ?? 3600) / 60)}
                onChange={e => setSetting('wholExamTimerSeconds', parseInt(e.target.value) * 60)} />
            </div>
          )}
        </div>

        {/* Max Attempts */}
        <div className="form-group" style={{ maxWidth: 240 }}>
          <label className="form-label" htmlFor="s1-attempts">Maks. Percobaan</label>
          <select id="s1-attempts" className="form-select" value={settings.maxAttempts}
            onChange={e => setSetting('maxAttempts', parseInt(e.target.value))}>
            <option value={1}>1x (default)</option>
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={0}>Tidak Terbatas</option>
          </select>
        </div>

        {/* Toggles */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
          <Toggle id="t-score" label="Tampilkan Skor Setelah Submit"
            hint="Murid bisa melihat skor segera setelah selesai mengerjakan."
            checked={settings.showScoreAfterSubmit} onChange={v => setSetting('showScoreAfterSubmit', v)} />
          <Toggle id="t-key" label="Tampilkan Kunci Jawaban Setelah Ujian"
            hint="Murid bisa melihat kunci jawaban PG setelah ujian ditutup."
            checked={settings.showAnswerKeyAfterSubmit} onChange={v => setSetting('showAnswerKeyAfterSubmit', v)} />
          <Toggle id="t-shuffle-q" label="Acak Urutan Soal"
            checked={settings.shuffleQuestions} onChange={v => setSetting('shuffleQuestions', v)} />
          <Toggle id="t-shuffle-o" label="Acak Urutan Pilihan Jawaban (PG)"
            hint="Setiap murid mendapatkan urutan pilihan yang berbeda."
            checked={settings.shuffleOptions} onChange={v => setSetting('shuffleOptions', v)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-8)' }}>
        <button className="btn btn-primary btn-lg" onClick={handleNext}>Lanjut: Pilih Format →</button>
      </div>
    </div>
  );
}
