// ============================================================
// Import File Modal — supports Excel, CSV, Word (.docx)
// ============================================================
import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, FileText } from 'lucide-react';
import { Modal } from '../ui';
import { parseExcelFile, parseCSVFile, parseWordFile, downloadExcelTemplate } from '../../utils/importParser';
import type { ImportResult, ExamFormat, Question } from '../../types';

interface Props {
  open: boolean;
  format: ExamFormat;
  onImport: (questions: Question[]) => void;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'done';

export default function ImportModal({ open, format, onImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setStep('upload'); setResult(null); setError(''); };
  const handleClose = () => { reset(); onClose(); };

  const processFile = async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let res: ImportResult;
      if (ext === 'csv') res = await parseCSVFile(file);
      else if (ext === 'xlsx' || ext === 'xls') res = await parseExcelFile(file);
      else { setError('Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv'); setLoading(false); return; }

      // Filter by exam format
      const filtered = filterByFormat(res, format);
      setResult(filtered);
      setStep('preview');
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  };

  const filterByFormat = (res: ImportResult, fmt: ExamFormat): ImportResult => {
    // If PG only, flag essay as invalid
    if (fmt === 'PG_ONLY') {
      const moved = res.valid.filter(r => r.question.type === 'ESSAY').map(r => ({
        ...r, isValid: false, errors: [...r.errors, 'Format ujian ini hanya mendukung soal Pilihan Ganda'],
      }));
      return {
        valid: res.valid.filter(r => r.question.type !== 'ESSAY'),
        invalid: [...res.invalid, ...moved],
        totalRows: res.totalRows,
      };
    }
    if (fmt === 'ESSAY_ONLY') {
      const moved = res.valid.filter(r => r.question.type === 'MULTIPLE_CHOICE').map(r => ({
        ...r, isValid: false, errors: [...r.errors, 'Format ujian ini hanya mendukung soal Essay'],
      }));
      return {
        valid: res.valid.filter(r => r.question.type !== 'MULTIPLE_CHOICE'),
        invalid: [...res.invalid, ...moved],
        totalRows: res.totalRows,
      };
    }
    return res;
  };

  const handleConfirmImport = () => {
    if (!result) return;
    const questions = result.valid.map((r, i) => ({ ...(r.question as Question), order: i + 1 }));
    onImport(questions);
    setStep('done');
  };

  const dropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const optionLetters = 'ABCDEF';

  return (
    <Modal open={open} onClose={handleClose} title="Import Soal dari File" size="xl"
      subtitle="Upload file Excel atau CSV berisi daftar soal Anda">
      {step === 'upload' && (
        <div>
          {/* Template download */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', border: '1px solid rgba(79,110,247,0.2)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-5)' }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Download Template Excel</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Isi template ini lalu upload kembali. Kolom: Tipe, Pertanyaan, Opsi A–F, Kunci, Bobot, Tag.</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={downloadExcelTemplate}>
              <Download size={14} /> Template
            </button>
          </div>

          {/* Drop zone */}
          <div
            style={{
              border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--border-strong)'}`,
              borderRadius: 'var(--r-lg)', padding: 'var(--sp-12)',
              textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'var(--primary-light)' : 'var(--surface-2)',
              transition: 'all 0.15s ease',
            }}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={dropHandler}
            onClick={() => fileRef.current?.click()}>
            <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto var(--sp-3)' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {loading ? 'Memproses file...' : 'Drag & drop file atau klik untuk pilih'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Format: .xlsx, .xls, .csv — Maks. 5 MB, 200 soal
            </p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
              onChange={e => e.target.files?.[0] && processFile(e.target.files[0])} />
          </div>

          {error && (
            <div style={{ marginTop: 'var(--sp-4)', padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.875rem', display: 'flex', gap: 8 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />{error}
            </div>
          )}
        </div>
      )}

      {step === 'preview' && result && (
        <div>
          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 16px', background: 'var(--success-light)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} style={{ color: 'var(--success)' }} />
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>{result.valid.length}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>soal valid</span>
            </div>
            {result.invalid.length > 0 && (
              <div style={{ padding: '8px 16px', background: 'var(--danger-light)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{result.invalid.length}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>soal error (tidak diimport)</span>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', position: 'sticky', top: 0 }}>
                  <th style={th}>Baris</th><th style={th}>Status</th>
                  <th style={th}>Tipe</th><th style={th}>Pertanyaan</th>
                  <th style={th}>Bobot</th><th style={th}>Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {[...result.valid, ...result.invalid].sort((a, b) => a.rowIndex - b.rowIndex).map(row => (
                  <tr key={row.rowIndex} style={{ borderBottom: '1px solid var(--border)', background: row.isValid ? 'transparent' : 'rgba(239,68,68,0.04)' }}>
                    <td style={td}>{row.rowIndex}</td>
                    <td style={td}>
                      {row.isValid
                        ? <CheckCircle size={14} style={{ color: 'var(--success)' }} />
                        : <AlertCircle size={14} style={{ color: 'var(--danger)' }} />}
                    </td>
                    <td style={td}>{row.question.type === 'MULTIPLE_CHOICE' ? 'PG' : 'Essay'}</td>
                    <td style={{ ...td, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.question.text || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>}
                      </div>
                    </td>
                    <td style={td}>{row.question.weight}</td>
                    <td style={td}>
                      {!row.isValid && row.errors.map((e, i) => (
                        <div key={i} style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>• {e}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-5)' }}>
            <button className="btn btn-secondary" onClick={reset}>← Upload Ulang</button>
            <button className="btn btn-primary" disabled={result.valid.length === 0} onClick={handleConfirmImport}>
              Import {result.valid.length} Soal Valid
            </button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)' }} />
          <h3 style={{ marginBottom: 8 }}>{result.valid.length} soal berhasil diimport!</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>
            Anda bisa mengedit soal yang diimport di langkah berikutnya.
          </p>
          <button className="btn btn-primary" onClick={handleClose}>Selesai</button>
        </div>
      )}
    </Modal>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'middle' };
