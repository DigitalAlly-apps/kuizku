// Step 1 — General Settings
import { useState } from 'react';
import { Toggle } from '../../../components/ui';
import DateTime24Input from '../../../components/ui/DateTime24Input';
import type { ExamSettings, ExamType, PreloadedStudent } from '../../../types';

interface Props {
  initial: {
    title: string; description: string; subject: string; className?: string;
    activeFrom: string; activeTo: string; settings: ExamSettings; examType: ExamType;
    preloadedStudents: PreloadedStudent[];
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
  const [studentList, setStudentList] = useState(initial.preloadedStudents.map(s => `${s.name}, ${s.nis}`).join('\n'));
  const [accessMode, setAccessMode] = useState<'OPEN' | 'LIST'>(initial.preloadedStudents.length > 0 ? 'LIST' : 'OPEN');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const setSetting = <K extends keyof ExamSettings>(k: K, v: ExamSettings[K]) => {
    setSettings(s => ({ ...s, [k]: v }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Judul ujian wajib diisi';
    if (!subject) e.subject = 'Mata pelajaran wajib dipilih';
    if (activeFrom && activeTo && new Date(activeFrom).getTime() >= new Date(activeTo).getTime()) {
      e.schedule = 'Waktu selesai harus lebih akhir dari waktu mulai. Jika selesai pukul 00.00 malam berikutnya, ubah tanggal selesai ke hari berikutnya.';
    }
    const students = parseStudents(studentList);
    if (accessMode === 'LIST' && students.students.length === 0) e.students = 'Tambahkan minimal satu peserta atau pilih akses terbuka.';
    if (accessMode === 'LIST' && students.duplicates.length > 0) e.students = `NIS/ID duplikat: ${students.duplicates.join(', ')}`;
    const passingScore = Number(settings.passingScore ?? 70);
    if (!Number.isFinite(passingScore) || passingScore < 0 || passingScore > 100) e.passingScore = 'KKM harus bernilai 0 sampai 100.';
    return e;
  };

  const handleNext = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onNext({ title, description, subject, className, activeFrom, activeTo, settings, examType, preloadedStudents: accessMode === 'LIST' ? parseStudents(studentList).students : [] });
  };

  const parseStudents = (raw: string): { students: PreloadedStudent[]; duplicates: string[] } => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    const students = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
      const [nameRaw, nisRaw] = line.split(/[,;\t]/).map(part => part.trim());
      const name = nameRaw || '';
      const nis = nisRaw || name;
      if (seen.has(nis)) duplicates.add(nis);
      seen.add(nis);
      return { name, nis };
    }).filter(s => s.name);
    return { students, duplicates: [...duplicates] };
  };

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--sp-2)' }}>Pengaturan Ujian</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>Isi informasi dasar dan tipe kegiatan ini.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Tipe Kegiatan <span style={{ color: 'var(--danger)' }}>*</span></label>
          <div className="wizard-choice-row" style={{ display: 'flex', gap: 'var(--sp-2)' }}>
            {([
              ['UJIAN', '📝 Ujian', 'var(--danger)', 'var(--danger-light)'],
              ['TUGAS', '📋 Tugas', 'var(--warning)', 'var(--warning-light)'],
              ['LATIHAN', '🎯 Latihan', 'var(--success)', 'var(--success-light)'],
            ] as const).map(([v, label, color, bg]) => (
              <button key={v} type="button"
                style={{ padding: '10px 18px', borderRadius: 'var(--r-md)', border: `2px solid ${examType === v ? color : 'var(--border-strong)'}`, background: examType === v ? bg : 'var(--surface-2)', color: examType === v ? color : 'var(--text-muted)', fontWeight: examType === v ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s ease', fontSize: '0.875rem' }}
                onClick={() => setExamType(v)}>{label}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="s1-title">Judul Ujian <span style={{ color: 'var(--danger)' }}>*</span></label>
          <input id="s1-title" className={`form-input ${errors.title ? 'error' : ''}`} placeholder="Contoh: UTS Matematika Kelas X Semester 1" value={title} onChange={e => { setTitle(e.target.value); setErrors(er => ({ ...er, title: '' })); }} autoFocus />
          {errors.title && <span className="form-error">{errors.title}</span>}
        </div>
        <div className="form-group"><label className="form-label" htmlFor="s1-desc">Deskripsi (opsional)</label><textarea id="s1-desc" className="form-textarea" rows={2} placeholder="Instruksi umum atau deskripsi singkat ujian..." value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label" htmlFor="s1-subject">Mata Pelajaran <span style={{ color: 'var(--danger)' }}>*</span></label><input id="s1-subject" className={`form-input ${errors.subject ? 'error' : ''}`} placeholder="Contoh: Matematika, Bahasa Indonesia..." value={subject} onChange={e => { setSubject(e.target.value); setErrors(er => ({ ...er, subject: '' })); }} />{errors.subject && <span className="form-error">{errors.subject}</span>}</div>
          <div className="form-group"><label className="form-label" htmlFor="s1-class">Kelas (opsional)</label><input id="s1-class" className="form-input" placeholder="Contoh: Kelas 10A, Kelas 12 IPA..." value={className} onChange={e => setClassName(e.target.value)} /></div>
        </div>
        <div className="form-group">
          <label className="form-label">Akses Peserta</label>
          <div className="student-access-choice" role="radiogroup" aria-label="Akses peserta ujian">
            <button type="button" role="radio" aria-checked={accessMode === 'OPEN'} className={accessMode === 'OPEN' ? 'is-active' : ''} onClick={() => { setAccessMode('OPEN'); setErrors(er => ({ ...er, students: '' })); }}><strong>Terbuka untuk semua</strong><span>Siapa pun yang punya kode dapat masuk.</span></button>
            <button type="button" role="radio" aria-checked={accessMode === 'LIST'} className={accessMode === 'LIST' ? 'is-active' : ''} onClick={() => setAccessMode('LIST')}><strong>Hanya daftar peserta</strong><span>Nama atau NIS/ID harus cocok dengan daftar guru.</span></button>
          </div>
          {accessMode === 'LIST' && <><label className="form-label" htmlFor="s1-students" style={{ marginTop: 'var(--sp-3)' }}>Daftar Peserta</label><textarea id="s1-students" className={`form-textarea ${errors.students ? 'error' : ''}`} rows={5} placeholder={'Satu peserta per baris. Format: Nama, NIS\nContoh:\nAhmad Fauzi, 1001\nSiti Aminah, 1002'} value={studentList} onChange={e => { setStudentList(e.target.value); setErrors(er => ({ ...er, students: '' })); }} />{errors.students && <span className="form-error">{errors.students}</span>}<span className="form-hint">Bisa paste dari CSV/Excel. Murid boleh masuk menggunakan nama yang cocok atau NIS/ID yang cocok.</span></>}
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label className="form-label" htmlFor="s1-from">Aktif Mulai (opsional)</label><DateTime24Input id="s1-from" value={activeFrom} onChange={value => { setActiveFrom(value); setErrors(er => ({ ...er, schedule: '' })); }} /><span className="form-hint">Gunakan format 24 jam, misalnya 16:30.</span></div>
          <div className="form-group"><label className="form-label" htmlFor="s1-to">Aktif Hingga (opsional)</label><DateTime24Input id="s1-to" value={activeTo} onChange={value => { setActiveTo(value); setErrors(er => ({ ...er, schedule: '' })); }} /><span className="form-hint">Gunakan format 24 jam, misalnya 16:30. Pukul 00.00 adalah awal hari, jadi untuk tengah malam setelah ujian pilih tanggal berikutnya.</span></div>
        </div>
        {errors.schedule && <div className="form-error" role="alert">{errors.schedule}</div>}
        <div>
          <label className="form-label" style={{ display: 'block', marginBottom: 'var(--sp-2)' }}>Mode Timer</label>
          <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>{([['NONE', 'Tanpa Timer'], ['WHOLE_EXAM', 'Keseluruhan Ujian'], ['PER_QUESTION', 'Per Soal']] as const).map(([v, l]) => (<button key={v} type="button" className={`btn btn-sm ${settings.timerMode === v ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSetting('timerMode', v)}>{l}</button>))}</div>
          {settings.timerMode === 'WHOLE_EXAM' && <div className="form-group compact-form-group" style={{ marginTop: 'var(--sp-3)', maxWidth: 200 }}><label className="form-label" htmlFor="s1-timer">Durasi Total (menit)</label><input id="s1-timer" type="number" className="form-input" min={5} max={300} value={Math.round((settings.wholExamTimerSeconds ?? 3600) / 60)} onChange={e => setSetting('wholExamTimerSeconds', parseInt(e.target.value) * 60)} /></div>}
          {settings.timerMode === 'PER_QUESTION' && <div className="form-group compact-form-group" style={{ marginTop: 'var(--sp-3)', maxWidth: 240 }}><label className="form-label" htmlFor="s1-perq-timer">Default Timer per Soal (detik)</label><input id="s1-perq-timer" type="number" className="form-input" min={10} max={3600} value={settings.perQuestionDefaultSeconds ?? 60} onChange={e => setSetting('perQuestionDefaultSeconds', parseInt(e.target.value) || 60)} /><span className="form-hint">Dipakai jika soal tidak punya timer khusus.</span></div>}
        </div>
        <section className="card" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-3)' }}>Waktu &amp; Percobaan</h3>
          <div className="form-group compact-form-group" style={{ maxWidth: 240 }}><label className="form-label" htmlFor="s1-attempts">Maks. Percobaan</label><select id="s1-attempts" className="form-select" value={settings.maxAttempts} onChange={e => setSetting('maxAttempts', parseInt(e.target.value))}><option value={1}>1x (default)</option><option value={2}>2x</option><option value={3}>3x</option><option value={0}>Tidak Terbatas</option></select><span className="form-hint">Guru dapat menambah satu kesempatan khusus untuk peserta tertentu di halaman Hasil.</span></div>
        </section>
        <section className="card" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-2)' }}>Cara Mengerjakan</h3>
          <p className="form-hint" style={{ marginTop: 0 }}>Pilih cara peserta berpindah antarsoal.</p>
          <div className="student-access-choice" role="radiogroup" aria-label="Navigasi soal">
            <button type="button" role="radio" aria-checked={(settings.navigationMode ?? 'FREE') === 'FREE'} className={(settings.navigationMode ?? 'FREE') === 'FREE' ? 'is-active' : ''} onClick={() => setSetting('navigationMode', 'FREE')}><strong>Bebas</strong><span>Peserta dapat membuka soal mana pun.</span></button>
            <button type="button" role="radio" aria-checked={settings.navigationMode === 'SEQUENTIAL'} className={settings.navigationMode === 'SEQUENTIAL' ? 'is-active' : ''} onClick={() => setSetting('navigationMode', 'SEQUENTIAL')}><strong>Berurutan</strong><span>Soal berikutnya terbuka melalui tombol Berikutnya.</span></button>
          </div>
          <Toggle id="t-shuffle-q" label="Acak Urutan Soal" checked={settings.shuffleQuestions} onChange={v => setSetting('shuffleQuestions', v)} />
          <Toggle id="t-shuffle-o" label="Acak Urutan Pilihan Jawaban (PG)" hint="Setiap murid mendapatkan urutan pilihan yang berbeda." checked={settings.shuffleOptions} onChange={v => setSetting('shuffleOptions', v)} />
        </section>
        <section className="card" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-3)' }}>Penilaian</h3>
          <div className="form-group compact-form-group" style={{ maxWidth: 240 }}><label className="form-label" htmlFor="s1-passing-score">Batas Ketuntasan / KKM</label><input id="s1-passing-score" type="number" min={0} max={100} inputMode="numeric" className={`form-input ${errors.passingScore ? 'error' : ''}`} value={settings.passingScore ?? 70} onChange={e => setSetting('passingScore', Number(e.target.value))} /><span className="form-hint">Nilai minimum agar peserta dinyatakan tuntas.</span>{errors.passingScore && <span className="form-error">{errors.passingScore}</span>}</div>
        </section>
        <section className="card" style={{ padding: 'var(--sp-4)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--sp-3)' }}>Setelah Mengumpulkan</h3>
          <div className="form-group"><label className="form-label" htmlFor="s1-score-release">Nilai</label><select id="s1-score-release" className="form-select" value={settings.scoreReleaseMode ?? 'IMMEDIATE'} onChange={e => setSetting('scoreReleaseMode', e.target.value as ExamSettings['scoreReleaseMode'])}><option value="IMMEDIATE">Langsung</option><option value="AFTER_EXAM_END">Setelah ujian berakhir</option><option value="AFTER_GRADING">Setelah penilaian selesai</option><option value="NEVER">Jangan tampilkan</option></select></div>
          <div className="form-group"><label className="form-label" htmlFor="s1-key-release">Kunci Jawaban</label><select id="s1-key-release" className="form-select" value={settings.answerKeyReleaseMode ?? 'NEVER'} onChange={e => setSetting('answerKeyReleaseMode', e.target.value as ExamSettings['answerKeyReleaseMode'])}><option value="IMMEDIATE">Langsung</option><option value="AFTER_EXAM_END">Setelah ujian berakhir</option><option value="NEVER">Jangan tampilkan</option></select><span className="form-hint">Kunci hanya akan dimuat ketika aturan rilis terpenuhi.</span></div>
          <div className="form-group"><label className="form-label" htmlFor="s1-explanation-release">Pembahasan</label><select id="s1-explanation-release" className="form-select" value={settings.explanationReleaseMode ?? 'NEVER'} onChange={e => setSetting('explanationReleaseMode', e.target.value as ExamSettings['explanationReleaseMode'])}><option value="IMMEDIATE">Langsung</option><option value="AFTER_EXAM_END">Setelah ujian berakhir</option><option value="NEVER">Jangan tampilkan</option></select><span className="form-hint">Pembahasan soal belum tersedia pada versi ini.</span></div>
          <Toggle id="t-ranking" label="Tampilkan Ranking" hint="Peserta dapat melihat posisi setelah hasil tersedia." checked={settings.showRankingAfterSubmit ?? false} onChange={v => setSetting('showRankingAfterSubmit', v)} />
        </section>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-4)' }}>
          {settings.timerMode === 'WHOLE_EXAM' && <Toggle id="t-auto-submit" label="Kumpulkan otomatis saat waktu habis" hint="Jika dimatikan, jawaban dikunci dan murid diminta mengumpulkan sendiri." checked={settings.autoSubmitOnTimeUp !== false} onChange={v => setSetting('autoSubmitOnTimeUp', v)} />}
          <div className="form-group compact-form-group" style={{ marginTop: 'var(--sp-4)', maxWidth: 260 }}><label className="form-label" htmlFor="s1-anticheat">Sensitivitas Anti-cheat</label><select id="s1-anticheat" className="form-select" value={settings.antiCheatSensitivity ?? 'MEDIUM'} onChange={e => setSetting('antiCheatSensitivity', e.target.value as ExamSettings['antiCheatSensitivity'])}><option value="OFF">Nonaktif</option><option value="LOW">Rendah (5 pelanggaran)</option><option value="MEDIUM">Sedang (3 pelanggaran)</option><option value="HIGH">Tinggi (1 pelanggaran)</option></select></div>
        </div>
      </div>
      <div className="wizard-nav-row" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-8)' }}><button className="btn btn-primary btn-lg" onClick={handleNext}>Lanjut: Pilih Format →</button></div>
    </div>
  );
}
