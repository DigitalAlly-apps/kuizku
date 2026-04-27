// Step 2 — Format Selection
import { useState } from 'react';
import type { ExamFormat } from '../../../types';

interface Props {
  current: ExamFormat;
  onNext: (format: ExamFormat) => void;
  onBack: () => void;
}

const FORMATS: { value: ExamFormat; icon: string; title: string; desc: string; scoring: string; best: string; color: string }[] = [
  {
    value: 'PG_ONLY', icon: '🔵', title: 'Pilihan Ganda',
    desc: 'Semua soal adalah pilihan ganda. Skor dihitung otomatis oleh sistem.',
    scoring: '✅ Otomatis', best: 'Ulangan harian, pretest, kuis cepat',
    color: 'var(--primary)',
  },
  {
    value: 'ESSAY_ONLY', icon: '🟣', title: 'Essay / Uraian',
    desc: 'Semua soal adalah essay. Guru menilai jawaban secara manual.',
    scoring: '📝 Manual guru', best: 'UTS, UAS, ujian analisis mendalam',
    color: 'var(--secondary)',
  },
  {
    value: 'COMBINATION', icon: '🟡', title: 'Kombinasi (PG + Essay)',
    desc: 'Gabungkan soal PG dan essay dalam satu ujian. PG dinilai otomatis, essay dinilai manual.',
    scoring: '✅ Otomatis (PG) + 📝 Manual (Essay)', best: 'Ujian komprehensif, ujian akhir semester',
    color: 'var(--warning)',
  },
];

export default function Step2Format({ current, onNext, onBack }: Props) {
  const [selected, setSelected] = useState<ExamFormat>(current);

  return (
    <div>
      <h2 style={{ marginBottom: 'var(--sp-2)' }}>Pilih Format Ujian</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>
        Format ini menentukan jenis soal yang bisa ditambahkan dan cara penilaiannya.
        Format <strong style={{ color: 'var(--text-primary)' }}>tidak bisa diubah</strong> setelah soal ditambahkan (tanpa menghapus soal yang tidak sesuai).
      </p>

      <div className="radio-card-group radio-card-group-3">
        {FORMATS.map(f => (
          <label key={f.value} className={`radio-card ${selected === f.value ? 'selected' : ''}`}
            style={{ borderColor: selected === f.value ? f.color : undefined,
              background: selected === f.value ? `${f.color}12` : undefined,
              boxShadow: selected === f.value ? `0 0 0 1px ${f.color}` : undefined }}>
            <input type="radio" name="format" value={f.value}
              checked={selected === f.value} onChange={() => setSelected(f.value)} />
            <div className="radio-card-check" style={selected === f.value ? { background: f.color, borderColor: f.color } : {}}>
              {selected === f.value && <span style={{ color: 'white', fontSize: '0.65rem', fontWeight: 900 }}>✓</span>}
            </div>
            <div className="radio-card-icon">{f.icon}</div>
            <div className="radio-card-title" style={{ color: selected === f.value ? f.color : undefined }}>{f.title}</div>
            <div className="radio-card-desc" style={{ marginBottom: 'var(--sp-3)' }}>{f.desc}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 'var(--sp-2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>🎯 Cocok: {f.best}</span>
              <span>📊 Penilaian: {f.scoring}</span>
            </div>
          </label>
        ))}
      </div>

      {/* Info table */}
      <div style={{ marginTop: 'var(--sp-6)', padding: 'var(--sp-4)', background: 'var(--surface-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)' }}>
        <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--sp-3)' }}>Aturan format yang dipilih:</p>
        <div style={{ overflow: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Kondisi', 'PG Saja', 'Essay Saja', 'Kombinasi'].map(h => (
                  <th key={h} style={{ padding: '6px 12px', textAlign: 'left', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Bisa tambah soal PG', '✅', '❌', '✅'],
                ['Bisa tambah soal Essay', '❌', '✅', '✅'],
                ['Skor PG otomatis', '✅', '—', '✅'],
                ['Perlu nilai manual', '❌', '✅', '✅ (essay)'],
              ].map(([cond, pg, es, co]) => (
                <tr key={cond} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{cond}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: selected === 'PG_ONLY' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: selected === 'PG_ONLY' ? 700 : 400 }}>{pg}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: selected === 'ESSAY_ONLY' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: selected === 'ESSAY_ONLY' ? 700 : 400 }}>{es}</td>
                  <td style={{ padding: '6px 12px', textAlign: 'center', color: selected === 'COMBINATION' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: selected === 'COMBINATION' ? 700 : 400 }}>{co}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-8)' }}>
        <button className="btn btn-secondary" onClick={onBack}>← Kembali</button>
        <button className="btn btn-primary btn-lg" onClick={() => onNext(selected)}>Lanjut: Input Soal →</button>
      </div>
    </div>
  );
}
