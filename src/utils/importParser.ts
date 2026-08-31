// ============================================================
// Kuizku — File Import Parser (Excel / CSV / Word)
// ============================================================
// Supports: .xlsx, .xls, .csv, .docx

import * as XLSX from 'xlsx';
import type { Question, QuestionType, ImportResult, ImportRow } from '../types';
import { formatDateTime, generateId } from './helpers';

// ---- Word (.docx) Parser ----
// Format yang didukung dalam file Word:
// Setiap soal dipisahkan oleh baris kosong atau nomor (1. 2. dst)
// Kunci jawaban ditandai: *A atau Kunci: A
// Essay ditandai: [Essay] di depan soal

export async function parseWordFile(file: File): Promise<ImportResult> {
  const mammoth = await import('mammoth');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return parseWordText(result.value as string);
  } catch (err) {
    throw new Error('Gagal membaca file Word: ' + String(err));
  }
}

function parseWordText(text: string): ImportResult {
  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];
  const rawBlocks = text
    .split(/\n{2,}|\r\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean);

  let rowIndex = 1;

  for (const block of rawBlocks) {
    const lines = block.split(/\n|\r\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    rowIndex++;
    const errors: string[] = [];
    const isEssay = /^\[?essay\]?/i.test(lines[0]) || (lines.length <= 2 && !/^\*?[A-F][.)]/i.test(lines[1] ?? ''));
    const rawQ = lines[0].replace(/^\[?essay\]?\s*/i, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!rawQ) errors.push('Teks soal kosong');

    const bobotLine = lines.find(l => /^bobot\s*:/i.test(l));
    const bobotRaw = bobotLine ? bobotLine.replace(/^bobot\s*:/i, '').trim() : '';
    const parsedWeight = bobotRaw === '' ? 1 : parseFloat(bobotRaw);
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
    if (bobotRaw !== '' && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      errors.push(`Bobot nilai tidak valid: "${bobotRaw}". Harus berupa angka positif`);
    }

    const tagLine = lines.find(l => /^tag\s*:/i.test(l));
    const tags = tagLine ? tagLine.replace(/^tag\s*:/i, '').split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

    if (isEssay) {
      const guideLines = lines.filter(l => !/^bobot\s*:/i.test(l) && !/^tag\s*:/i.test(l) && l !== lines[0]);
      const question: Partial<Question> = {
        id: generateId(),
        type: 'ESSAY',
        text: rawQ,
        weight,
        tags,
        order: rowIndex,
        answerGuide: guideLines.join(' ').trim() || undefined,
      };
      const importRow: ImportRow = { rowIndex, question, errors, isValid: errors.length === 0 };
      (importRow.isValid ? valid : invalid).push(importRow);
      continue;
    }

    const optionLines = lines.slice(1).filter(l => /^\*?[A-F][.)]/i.test(l));
    const optionsWithLetters = optionLines.map(l => ({
      id: generateId(),
      letter: l.replace(/^\*/, '').charAt(0).toUpperCase(),
      text: l.replace(/^\*?[A-F][.)]\s*/i, '').trim(),
      isCorrect: l.startsWith('*'),
    })).filter(o => o.text !== '');

    if (optionsWithLetters.length < 2) errors.push('Minimal 2 opsi jawaban ditemukan');

    let correctOptionId: string | undefined;
    const kunciLine = lines.find(l => /^kunci\s*:/i.test(l));
    if (kunciLine) {
      const kunciLetter = kunciLine.replace(/^kunci\s*:/i, '').trim().toUpperCase();
      const correctOpt = optionsWithLetters.find(o => o.letter === kunciLetter);
      if (correctOpt) correctOptionId = correctOpt.id;
      else errors.push(`Kunci jawaban "${kunciLetter}" tidak valid atau opsi tidak ada`);
    } else {
      const correctOpt = optionsWithLetters.find(o => o.isCorrect);
      if (correctOpt) correctOptionId = correctOpt.id;
      else errors.push('Kunci jawaban tidak ditemukan. Tandai dengan * di depan opsi. Contoh: *A. Jakarta');
    }

    const question: Partial<Question> = {
      id: generateId(),
      type: 'MULTIPLE_CHOICE',
      text: rawQ,
      weight,
      tags,
      order: rowIndex,
      options: optionsWithLetters.map(({ id, text }) => ({ id, text })),
      correctOptionId,
    };
    const importRow: ImportRow = { rowIndex, question, errors, isValid: errors.length === 0 };
    (importRow.isValid ? valid : invalid).push(importRow);
  }

  return { valid, invalid, totalRows: rowIndex - 1 };
}

// ---- Excel / CSV Parser ----
// Header resmi: Tipe, Pertanyaan, Opsi A-F, Kunci, Bobot, Tag, Panduan Jawaban
// Bobot boleh kosong dan otomatis bernilai 1.

export type ImportParseStage = 'ARRAY_BUFFER_START' | 'ARRAY_BUFFER_READY' | 'XLSX_READ_START' | 'XLSX_READ_SUCCESS' | 'SHEET_FOUND' | 'PARSE_SUCCESS';

export async function parseExcelFile(file: File, onProgress?: (stage: ImportParseStage) => void): Promise<ImportResult> {
  try {
    onProgress?.('ARRAY_BUFFER_START');
    const arrayBuffer = await file.arrayBuffer();
    onProgress?.('ARRAY_BUFFER_READY');

    onProgress?.('XLSX_READ_START');
    const workbook = XLSX.read(arrayBuffer, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
    });
    onProgress?.('XLSX_READ_SUCCESS');

    // Template resmi menggunakan sheet SOAL. Tetap gunakan sheet pertama bila
    // pengguna membuat file sederhana tanpa nama sheet tersebut.
    const sheetName = workbook.SheetNames.find(name => name.trim().toLowerCase() === 'soal') ?? workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet) throw new Error('Format Excel tidak dikenali. Sheet soal tidak ditemukan.');
    onProgress?.('SHEET_FOUND');

    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: '',
      raw: false,
    });
    validateSpreadsheetHeaders(rows);
    const result = parseSpreadsheetRows(rows);
    onProgress?.('PARSE_SUCCESS');
    return result;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Format Excel tidak dikenali')) throw err;
    throw new Error('Gagal membaca file Excel: ' + String(err));
  }
}

export async function parseCSVFile(file: File): Promise<ImportResult> {
  try {
    const text = await file.text();
    const workbook = XLSX.read(text, { type: 'string' });
    const sheetName = workbook.SheetNames[0];
    const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
    if (!sheet) throw new Error('Format Excel tidak dikenali. Sheet soal tidak ditemukan.');
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
      defval: '',
      raw: false,
    });
    validateSpreadsheetHeaders(rows);
    return parseSpreadsheetRows(rows);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Format Excel tidak dikenali')) throw err;
    throw new Error('Gagal membaca file CSV: ' + String(err));
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function findValue(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const v = row[c] ?? row[c.toLowerCase()] ?? row[c.toUpperCase()] ?? '';
    if (v !== '') return String(v).trim();
  }
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) norm[normalizeKey(k)] = v;
  for (const c of candidates) {
    const v = norm[normalizeKey(c)];
    if (v !== undefined && v !== '') return String(v).trim();
  }
  return '';
}

function hasColumn(headers: string[], ...candidates: string[]): boolean {
  return candidates.some(candidate =>
    headers.some(header => normalizeKey(header) === normalizeKey(candidate))
  );
}

function validateSpreadsheetHeaders(rows: Record<string, string>[]): void {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const hasQuestion = hasColumn(headers, 'Pertanyaan', 'Soal', 'Question');
  const hasType = hasColumn(headers, 'Tipe', 'Type');
  const hasOptionA = hasColumn(headers, 'Opsi A', 'Option A', 'A');
  const hasOptionB = hasColumn(headers, 'Opsi B', 'Option B', 'B');
  const hasAnswerKey = hasColumn(headers, 'Kunci', 'Jawaban Benar', 'Kunci Jawaban', 'Answer');

  if (!hasQuestion || (!hasType && (!hasOptionA || !hasOptionB || !hasAnswerKey))) {
    throw new Error(
      'Format Excel tidak dikenali. Gunakan header Pertanyaan/Soal. Untuk soal PG tanpa kolom Tipe, sertakan Opsi A, Opsi B, dan Kunci.'
    );
  }
}

function normalizeQuestionType(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function parseSpreadsheetRows(rows: Record<string, string>[]): ImportResult {
  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const tipeRaw = normalizeQuestionType(findValue(row, 'Tipe', 'tipe', 'type', 'Type'));
    const questionText = findValue(row, 'Pertanyaan', 'pertanyaan', 'Soal', 'soal', 'Question', 'question');
    const bobotRaw = findValue(row, 'Bobot', 'bobot', 'Nilai', 'nilai', 'Weight', 'weight', 'Points', 'points');
    const tagRaw = findValue(row, 'Tag', 'tag', 'Tags', 'tags', 'Kategori', 'kategori');
    const kunciRaw = findValue(row, 'Kunci', 'kunci', 'Jawaban Benar', 'jawaban_benar', 'Kunci Jawaban', 'Answer', 'answer').toUpperCase();
    const acceptedRaw = findValue(row, 'Jawaban Diterima', 'jawaban_diterima', 'Accepted Answers', 'accepted_answers', 'Jawaban Singkat');
    const answerGuide = findValue(row, 'Panduan Jawaban', 'panduan_jawaban', 'Kunci Essay', 'Guide');

    let type: QuestionType = 'MULTIPLE_CHOICE';
    if (tipeRaw === 'ESSAY' || tipeRaw === 'E' || tipeRaw === 'URAIAN') type = 'ESSAY';
    else if (tipeRaw === 'SHORT_ANSWER' || tipeRaw === 'SHORT' || tipeRaw === 'ISIAN' || tipeRaw === 'JAWABAN_SINGKAT') type = 'SHORT_ANSWER';
    else if (tipeRaw === 'PG' || tipeRaw === 'MC' || tipeRaw === 'PILIHAN_GANDA' || tipeRaw === 'MULTIPLE_CHOICE' || tipeRaw === '') type = 'MULTIPLE_CHOICE';
    else errors.push(`Tipe soal tidak valid: "${tipeRaw}". Gunakan "PG" atau "Essay"`);

    if (!questionText) errors.push('Teks pertanyaan kosong');

    const weight = bobotRaw === '' ? 1 : Number(bobotRaw);
    if (bobotRaw === '') {
      warnings.push('Bobot kosong otomatis diisi 1.');
    } else if (isNaN(weight) || weight <= 0) {
      errors.push(`Bobot nilai tidak valid: "${bobotRaw}". Harus berupa angka positif`);
    }

    const tags = tagRaw ? tagRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];
    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const optionValues = optionLetters
      .map(l => ({
        id: generateId(),
        text: findValue(row, `Opsi ${l}`, `opsi_${l.toLowerCase()}`, `Option ${l}`, l),
      }));
    const lastOptionIndex = optionValues.reduce((last, option, index) => option.text ? index : last, -1);
    const gapIndex = lastOptionIndex >= 0
      ? optionValues.slice(0, lastOptionIndex).findIndex(option => !option.text)
      : -1;
    if (gapIndex >= 0) {
      const missing = optionLetters[gapIndex];
      const later = optionLetters[gapIndex + 1];
      errors.push(`Opsi harus berurutan. Jangan kosongkan Opsi ${missing} jika Opsi ${later} diisi.`);
    }
    const options = optionValues.filter(option => option.text !== '');

    let correctOptionId: string | undefined;
    if (type === 'MULTIPLE_CHOICE') {
      if (options.length < 2) errors.push('Minimal 2 opsi jawaban untuk soal Pilihan Ganda');
      if (!kunciRaw) {
        errors.push('Kunci jawaban tidak ditemukan');
      } else {
        const kunciIndex = optionLetters.indexOf(kunciRaw);
        if (kunciIndex === -1 || !optionValues[kunciIndex]?.text) {
          errors.push(`Kunci jawaban "${kunciRaw}" tidak valid atau opsi tidak ada`);
        } else {
          correctOptionId = optionValues[kunciIndex].id;
        }
      }
    }

    const acceptedAnswers = type === 'SHORT_ANSWER'
      ? (acceptedRaw || kunciRaw).split(/[|;]/).map(value => value.trim()).filter(Boolean)
      : [];
    if (type === 'SHORT_ANSWER' && acceptedAnswers.length === 0) errors.push('Isi minimal 1 Jawaban Diterima, pisahkan dengan | atau ;');

    const question: Partial<Question> = {
      id: generateId(),
      type,
      text: questionText,
      weight,
      tags,
      order: rowIndex - 1,
      ...(type === 'MULTIPLE_CHOICE'
        ? { options, correctOptionId }
        : type === 'SHORT_ANSWER' ? { acceptedAnswers } : { answerGuide }),
    };

    const importRow: ImportRow = {
      rowIndex,
      question,
      errors,
      warnings,
      sourceRow: row,
      isValid: errors.length === 0,
    };

    if (importRow.isValid) {
      valid.push(importRow);
    } else {
      invalid.push(importRow);
    }
  });

  return { valid, invalid, totalRows: rows.length };
}

// ---- Excel Template Generator ----
export function downloadExcelTemplate(): void {
  const soalSheet = XLSX.utils.aoa_to_sheet([
    ['Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Opsi F', 'Kunci', 'Jawaban Diterima', 'Bobot', 'Tag', 'Panduan Jawaban'],
    ['PG', 'Manakah yang merupakan bilangan prima?', '2', '4', '6', '8', '', '', 'A', '1', 'Matematika', ''],
    ['PG', 'Pilih huruf vokal.', 'B', 'C', 'D', 'F', 'A', 'E', 'E', '', 'Bahasa Indonesia;LCC', ''],
    ['Essay', 'Jelaskan pengertian fotosintesis!', '', '', '', '', '', '', '', '', '5', 'IPA,Biologi', 'Fotosintesis adalah proses pembuatan makanan oleh tumbuhan menggunakan cahaya matahari.'],
    ['Short', 'Siapa khalifah pertama?', '', '', '', '', '', '', '', 'Abu Bakar|Abu Bakar Ash-Shiddiq|Abu Bakr', '1', 'PAI', ''],
  ]);

  // Set column widths
  soalSheet['!cols'] = [
    { wch: 8 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 8 },
    { wch: 20 }, { wch: 40 },
  ];
  soalSheet['!autofilter'] = { ref: 'A1:M5' };

  const petunjukSheet = XLSX.utils.aoa_to_sheet([
    ['PETUNJUK IMPORT SOAL KUIZKU'],
    ['Gunakan sheet SOAL untuk mengisi soal. Jangan mengubah nama header pada baris pertama.'],
    [''],
    ['Kolom', 'Aturan'],
    ['Tipe', 'Isi PG, Short, atau Essay. Bisa juga: Pilihan Ganda, Isian, Uraian, E. Jika kosong, dianggap PG.'],
    ['Pertanyaan', 'Wajib diisi untuk setiap soal.'],
    ['Opsi A–F', 'Khusus PG: minimal 2 opsi, isi berurutan mulai A. Jangan kosongkan C lalu mengisi D.'],
    ['Kunci', 'Khusus PG: isi A sampai F dan harus sesuai dengan opsi yang tersedia.'],
    ['Jawaban Diterima', 'Khusus Short: isi beberapa jawaban yang benar, pisahkan dengan tanda | atau titik koma.'],
    ['Bobot', 'Opsional. Jika kosong otomatis bernilai 1. Jika diisi, harus angka positif.'],
    ['Tag', 'Opsional. Pisahkan beberapa tag dengan koma, titik koma, atau garis tegak. Contoh: PAI,Sirah atau PAI;Sirah.'],
    ['Panduan Jawaban', 'Khusus Essay, opsional. Isi pedoman jawaban untuk guru.'],
    ['Tips', 'Jangan ubah nama sheet SOAL dan jangan taruh baris judul tambahan di atas header.'],
    [''],
    ['CONTOH BENAR', 'PG | Soal | A | B | C | D | Kunci D | Bobot 1'],
    ['CONTOH SALAH', 'PG | Soal | A | B | (Opsi C kosong) | D — tidak boleh ada opsi yang terlewat.'],
  ]);
  petunjukSheet['!cols'] = [{ wch: 22 }, { wch: 105 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, soalSheet, 'SOAL');
  XLSX.utils.book_append_sheet(wb, petunjukSheet, 'PETUNJUK');
  XLSX.writeFile(wb, 'template_soal_kuizku.xlsx');
}

export function downloadInvalidRows(rows: ImportRow[]): void {
  const headers = ['Baris', 'Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Opsi F', 'Kunci', 'Bobot', 'Tag', 'Panduan Jawaban', 'Masalah'];
  const data = rows.map(row => {
    const question = row.question;
    const options = question.options ?? [];
    const optionAt = (index: number) => options[index]?.text ?? '';
    const correctIndex = options.findIndex(option => option.id === question.correctOptionId);
    const source = row.sourceRow;
    return [
      row.rowIndex,
      source ? findValue(source, 'Tipe', 'Type') : question.type === 'ESSAY' ? 'Essay' : 'PG',
      source ? findValue(source, 'Pertanyaan', 'Soal', 'Question') : question.text ?? '',
      source ? findValue(source, 'Opsi A', 'Option A', 'A') : optionAt(0),
      source ? findValue(source, 'Opsi B', 'Option B', 'B') : optionAt(1),
      source ? findValue(source, 'Opsi C', 'Option C', 'C') : optionAt(2),
      source ? findValue(source, 'Opsi D', 'Option D', 'D') : optionAt(3),
      source ? findValue(source, 'Opsi E', 'Option E', 'E') : optionAt(4),
      source ? findValue(source, 'Opsi F', 'Option F', 'F') : optionAt(5),
      source ? findValue(source, 'Kunci', 'Jawaban Benar', 'Kunci Jawaban', 'Answer') : correctIndex >= 0 ? String.fromCharCode(65 + correctIndex) : '',
      source ? findValue(source, 'Bobot', 'Nilai', 'Weight', 'Points') : question.weight ?? '',
      source ? findValue(source, 'Tag', 'Tags', 'Kategori') : question.tags?.join(',') ?? '',
      source ? findValue(source, 'Panduan Jawaban', 'Kunci Essay', 'Guide') : question.answerGuide ?? '',
      row.errors.join(' | '),
    ];
  });
  const sheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  sheet['!cols'] = headers.map((header, index) => ({ wch: index === 2 || index === 13 ? 55 : Math.max(12, header.length + 2) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Soal Bermasalah');
  XLSX.writeFile(workbook, 'soal_bermasalah_kuizku.xlsx');
}

// ---- Export Results ----
export function exportResultsToExcel(
  examTitle: string,
  submissions: import('../types').Submission[],
  exam: import('../types').Exam,
): void {
  const headers = [
    'No', 'Nama', 'No. Absen', 'Percobaan', 'Waktu Submit',
    'Skor PG (Otomatis)', 'Skor Essay (Manual)', 'Total Skor',
    'Skor Maks PG', 'Skor Maks Essay', 'Skor Maks Total',
  ];

  const maxMC = exam.questions.filter(q => q.type === 'MULTIPLE_CHOICE').reduce((s, q) => s + q.weight, 0);
  const maxEssay = exam.questions.filter(q => q.type === 'ESSAY').reduce((s, q) => s + q.weight, 0);
  const maxTotal = maxMC + maxEssay;

  const rows = submissions.map((s, i) => {
    const essayTotal = s.essayScores.reduce((sum, g) => sum + g.score, 0);
    const total = s.mcScore + essayTotal;
    return [
      i + 1,
      s.studentName,
      s.nis,
      s.attemptNumber,
      s.submittedAt ? formatDateTime(s.submittedAt) : '-',
      s.mcScore,
      essayTotal,
      total,
      maxMC,
      maxEssay,
      maxTotal,
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Nilai');
  XLSX.writeFile(wb, `rekap_${examTitle.replace(/\s+/g, '_')}.xlsx`);
}
