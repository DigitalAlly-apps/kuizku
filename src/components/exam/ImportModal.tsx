// ============================================================
// Import File Modal — supports Excel, CSV, Word (.docx)
// ============================================================
import { useState, useRef } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, FileSpreadsheet, Eye, Info } from 'lucide-react';
import { Modal } from '../ui';
import type { ImportResult, ExamFormat, Question } from '../../types';

interface Props {
  open: boolean;
  format: ExamFormat;
  onImport: (questions: Question[]) => void;
  onBeforeImport?: () => void;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'done';
const IMPORT_SESSION_KEY = 'kuizku_import_in_progress';
const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

function logImport(event: string, detail?: Record<string, unknown>) {
  console.info(`[Kuizku import] ${event}`, detail ?? '');
}

function describeImportError(value: unknown): string {
  const message = value instanceof Error ? value.message : String(value ?? '');
  const normalized = message.toLowerCase();
  if (normalized.includes('format excel tidak dikenali')) return message;
  if (normalized.includes('abort')) return 'Pemilihan file dibatalkan. Anda tetap berada di halaman soal.';
  if (normalized.includes('memory') || normalized.includes('allocation') || normalized.includes('array buffer')) {
    return 'File Excel terlalu besar untuk diproses di perangkat ini. Kurangi ukuran file atau gunakan komputer.';
  }
  return 'File tidak dapat dibaca. Pastikan file tidak rusak dan gunakan format Excel/CSV/Word yang didukung.';
}

function safeSessionStorage(action: 'set' | 'remove'): void {
  try {
    if (action === 'set') sessionStorage.setItem(IMPORT_SESSION_KEY, '1');
    else sessionStorage.removeItem(IMPORT_SESSION_KEY);
  } catch {
    // Private mode/PWA tertentu dapat memblokir sessionStorage. Import tetap boleh berjalan.
  }
}

export default function ImportModal({ open, format, onImport, onBeforeImport, onClose }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFormat, setShowFormat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  const clearImportSession = () => safeSessionStorage('remove');
  const reset = () => { clearImportSession(); setStep('upload'); setResult(null); setError(''); setShowFormat(false); };
  const handleClose = () => { reset(); onClose(); };

  const openFilePicker = () => {
    if (processingRef.current) return;
    onBeforeImport?.();
    logImport('FILE_PICKER_OPEN');
    fileRef.current?.click();
  };

  const processFile = async (file: File) => {
    if (processingRef.current) {
      logImport('DUPLICATE_FILE_EVENT_IGNORED', { name: file.name });
      return;
    }
    processingRef.current = true;
    setLoading(true);
    setError('');
    let openedPreview = false;
    const nameExtension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
    const mimeExtensions: Record<string, string> = {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-excel': 'xls',
      'text/csv': 'csv',
      'application/csv': 'csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    };
    const extension = nameExtension || mimeExtensions[file.type.toLowerCase()] || '';
    logImport('IMPORT_START');
    logImport('FILE_SELECTED', { name: file.name, size: file.size, type: file.type || 'unknown', extension });
    try {
      safeSessionStorage('set');
      if (file.size === 0) {
        setError('File kosong dan tidak dapat diimport. Pilih file Excel yang berisi soal.');
        return;
      }
      if (file.size > MAX_IMPORT_FILE_SIZE) {
        setError('File Excel terlalu besar untuk diproses di perangkat ini. Maksimal 5 MB. Kurangi ukuran file atau gunakan komputer.');
        return;
      }

      // Muat parser setelah Android mengembalikan file. Ini mengurangi tekanan
      // memori saat browser berpindah sementara ke aplikasi Files/Excel.
      const { parseExcelFile, parseCSVFile, parseWordFile } = await import('../../utils/importParser');
      let res: ImportResult;
      if (extension === 'csv') res = await parseCSVFile(file);
      else if (extension === 'xlsx' || extension === 'xls') res = await parseExcelFile(file, stage => logImport(stage));
      else if (extension === 'docx') res = await parseWordFile(file);
      else { setError('Format file tidak didukung. Gunakan .xlsx, .xls, .csv, atau .docx.'); return; }

      if (res.totalRows > 200) {
        setError(`File berisi ${res.totalRows} soal. Maksimal 200 soal per import.`);
        return;
      }

      const filtered = filterByFormat(res, format);
      setResult(filtered);
      setStep('preview');
      openedPreview = true;
      logImport('PARSE_SUCCESS', { totalRows: filtered.totalRows, validRows: filtered.valid.length, invalidRows: filtered.invalid.length });
    } catch (e) {
      logImport('IMPORT_ERROR', { message: e instanceof Error ? e.message : String(e) });
      setError(describeImportError(e));
    } finally {
      if (!openedPreview) safeSessionStorage('remove');
      processingRef.current = false;
      setLoading(false);
    }
  };

  const filterByFormat = (res: ImportResult, fmt: ExamFormat): ImportResult => {
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
      const moved = res.valid.filter(r => r.question.type !== 'ESSAY').map(r => ({
        ...r, isValid: false, errors: [...r.errors, 'Format ujian ini hanya mendukung soal Essay'],
      }));
      return {
        valid: res.valid.filter(r => r.question.type === 'ESSAY'),
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
    clearImportSession();
    logImport('IMPORT_SUCCESS', { importedRows: questions.length });
    setStep('done');
  };

  const warningCount = result
    ? [...result.valid, ...result.invalid].reduce((count, row) => count + (row.warnings?.length ?? 0), 0)
    : 0;

  const dropHandler = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      onBeforeImport?.();
      void processFile(file);
    }
  };

  const handleTemplateDownload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setShowFormat(false);
    const { downloadExcelTemplate } = await import('../../utils/importParser');
    downloadExcelTemplate();
  };

  const handleInvalidRowsDownload = async () => {
    if (!result?.invalid.length) return;
    const { downloadInvalidRows } = await import('../../utils/importParser');
    downloadInvalidRows(result.invalid);
  };

  return (
    <>
    <Modal open={open} onClose={handleClose} title="Import Soal dari File" size="xl"
      subtitle="Upload file Excel, CSV, atau Word (.docx) berisi daftar soal Anda">
      {step === 'upload' && (
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.docx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style={{ display: 'none' }}
            onClick={event => event.stopPropagation()}
            onChange={event => {
              const file = event.target.files?.[0];
              const input = event.currentTarget;
              if (file) {
                void processFile(file).finally(() => { input.value = ''; });
              } else {
                input.value = '';
                logImport('FILE_PICKER_CANCELLED');
              }
            }} />
          {/* Template download */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--primary-light)', border: '1px solid rgba(79,110,247,0.2)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-4)' }}>
            <FileSpreadsheet size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Download Template Excel</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Format paling aman: Tipe | Pertanyaan | Opsi A–D | Kunci | Bobot. Template resmi berisi sheet SOAL dan PETUNJUK.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFormat(true)}><Info size={14} /> Lihat Format Excel</button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={handleTemplateDownload}><Download size={14} /> Template</button>
            </div>
          </div>

          {/* Quick Excel rules */}
          <div style={{ padding: '12px 16px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', marginBottom: 'var(--sp-5)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.84rem', marginBottom: 8 }}>Excel aman kalau:</div>
            <div style={{ display: 'grid', gap: 5, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>Pertanyaan</strong> wajib diisi.</div>
              <div>• PG minimal punya <strong style={{ color: 'var(--text-primary)' }}>2 opsi</strong> dan <strong style={{ color: 'var(--text-primary)' }}>Kunci A–F</strong>.</div>
              <div>• <strong style={{ color: 'var(--text-primary)' }}>Bobot boleh kosong</strong> — otomatis jadi 1.</div>
              <div>• Setelah upload, Kuizku akan <strong style={{ color: 'var(--text-primary)' }}>cek tiap baris dulu</strong>. Soal error tidak akan ikut diimport.</div>
            </div>
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
            onClick={openFilePicker}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openFilePicker();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Pilih file Excel, CSV, atau Word untuk diimport"
            aria-busy={loading}>
            <Upload size={32} style={{ color: 'var(--primary)', margin: '0 auto var(--sp-3)' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {loading ? 'Memproses file...' : 'Drag & drop file atau klik untuk pilih'}
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Format: .xlsx, .xls, .csv, .docx — Maks. 5 MB, 200 soal
            </p>
          </div>

          {error && (
            <div style={{ marginTop: 'var(--sp-4)', padding: '10px 14px', background: 'var(--danger-light)', borderRadius: 'var(--r-md)', color: 'var(--danger)', fontSize: '0.875rem', display: 'flex', gap: 8 }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <div><div>{error}</div><button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={handleTemplateDownload}><Download size={14} /> Unduh Template Kuizku</button></div>
            </div>
          )}
        </div>
      )}

      {step === 'preview' && result && (
        <div>
          {/* Ready/not-ready indicator */}
          <div style={{
            padding: '12px 16px', marginBottom: 'var(--sp-4)', borderRadius: 'var(--r-md)',
            background: result.invalid.length === 0 ? 'var(--success-light)' : 'var(--warning-light)',
            border: `1px solid ${result.invalid.length === 0 ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
          }}>
            <div style={{ fontWeight: 700, color: result.invalid.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
              {result.invalid.length === 0
                ? `✓ File siap diimport — ${result.valid.length}/${result.totalRows} soal valid`
                : `${result.valid.length}/${result.totalRows} soal siap diimport — ${result.invalid.length} baris perlu diperbaiki`}
            </div>
            {result.invalid.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Anda tetap bisa mengimport soal yang valid. Baris bermasalah tidak akan ikut masuk.
              </div>
            )}
          </div>

          {/* Summary bar */}
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 16px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileSpreadsheet size={15} style={{ color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700 }}>{result.totalRows}</span><span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>soal ditemukan</span>
            </div>
            <div style={{ padding: '8px 16px', background: 'var(--success-light)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} style={{ color: 'var(--success)' }} />
              <span style={{ fontWeight: 700, color: 'var(--success)' }}>{result.valid.length}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>siap diimpor</span>
            </div>
            {result.invalid.length > 0 && (
              <div style={{ padding: '8px 16px', background: 'var(--danger-light)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={15} style={{ color: 'var(--danger)' }} />
                <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{result.invalid.length}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>soal error (tidak diimport)</span>
              </div>
            )}
            {warningCount > 0 && (
              <div style={{ padding: '8px 16px', background: 'var(--warning-light)', borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={15} style={{ color: 'var(--warning)' }} />
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{warningCount}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>warning otomatis</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: 'var(--sp-4)', padding: '10px 14px', background: result.invalid.length ? 'var(--warning-light)' : 'var(--success-light)', borderRadius: 'var(--r-md)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {result.invalid.length ? '⚠️ Ada soal yang perlu diperbaiki. Soal valid tetap bisa diimpor.' : '✅ File siap diimpor.'}
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
                    <td style={td}>{row.question.type === 'MULTIPLE_CHOICE' ? 'PG' : row.question.type === 'SHORT_ANSWER' ? 'Short' : 'Essay'}</td>
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
                      {row.warnings?.map((warning, i) => (
                        <div key={`warning-${i}`} style={{ color: 'var(--warning)', fontSize: '0.75rem' }}>• {warning}</div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.valid.length > 0 && (
            <details style={{ marginTop: 'var(--sp-5)' }}>
              <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={16} /> Preview soal seperti murid ({result.valid.length})</summary>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-3)', maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {result.valid.map((row, index) => {
                  const q = row.question;
                  const correct = q.options?.findIndex(option => option.id === q.correctOptionId) ?? -1;
                  return <div key={row.rowIndex} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 'var(--sp-3)', background: 'var(--surface-2)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700, marginBottom: 5 }}>SOAL {index + 1} · {q.type === 'ESSAY' ? 'ESSAY' : q.type === 'SHORT_ANSWER' ? 'JAWABAN SINGKAT' : 'PILIHAN GANDA'}</div>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{q.text}</div>
                    {q.type === 'MULTIPLE_CHOICE' && q.options?.map((option, optionIndex) => <div key={option.id} style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 3 }}>{String.fromCharCode(65 + optionIndex)}. {option.text}</div>)}
                    {q.type === 'SHORT_ANSWER' && <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Jawaban diterima: {(q.acceptedAnswers ?? []).join(', ')}</div>}
                    <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {q.type === 'MULTIPLE_CHOICE' && <>Kunci: <strong style={{ color: 'var(--success)' }}>{correct >= 0 ? String.fromCharCode(65 + correct) : '—'}</strong> · </>}
                      Bobot: {q.weight} {q.tags?.length ? `· Tag: ${q.tags.join(', ')}` : ''}
                    </div>
                    {q.type === 'ESSAY' && q.answerGuide && <div style={{ marginTop: 6, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Panduan jawaban: {q.answerGuide}</div>}
                  </div>;
                })}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--sp-5)', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={reset}>Perbaiki File Dulu</button>
              {result.invalid.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => void handleInvalidRowsDownload()}><Download size={14} /> Download Soal Bermasalah</button>}
            </div>
            <button type="button" className="btn btn-primary" disabled={result.valid.length === 0} onClick={handleConfirmImport}>Import {result.valid.length} Soal Valid</button>
          </div>
        </div>
      )}

      {step === 'done' && result && (
        <div style={{ textAlign: 'center', padding: 'var(--sp-8) 0' }}>
          <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)' }} />
          <h3 style={{ marginBottom: 8 }}>{result.valid.length} soal berhasil diimport!</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--sp-6)' }}>
            Anda bisa mengecek dan mengedit soal yang diimport sebelum melanjutkan.
          </p>
          <button type="button" className="btn btn-primary" onClick={handleClose}>Selesai</button>
        </div>
      )}
    </Modal>

    <Modal open={showFormat} onClose={() => setShowFormat(false)} title="Format Excel Kuizku">
      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
        <p style={{ marginBottom: 10 }}>Gunakan baris pertama sebagai header berikut:</p>
        <div style={{ padding: 10, borderRadius: 'var(--r-sm)', background: 'var(--surface-2)', fontFamily: 'monospace', fontSize: '0.75rem', overflowX: 'auto', marginBottom: 12 }}>Tipe | Pertanyaan | Opsi A | Opsi B | Opsi C | Opsi D | Kunci | Bobot | Tag</div>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>PG: minimal opsi A dan B, lalu isi berurutan sampai F bila perlu.</li>
          <li>Essay: isi Tipe = Essay; opsi dan kunci boleh kosong.</li>
          <li>Bobot boleh kosong dan otomatis bernilai 1.</li>
          <li>Tag boleh dipisahkan dengan koma, titik koma, atau tanda <code>|</code>.</li>
        </ul>
        <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={handleTemplateDownload}><Download size={14} /> Download Template</button>
      </div>
    </Modal>
    </>
  );
}

const th: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '8px 12px', verticalAlign: 'middle' };
