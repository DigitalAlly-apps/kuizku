// ============================================================
// Ujianly — File Import Parser (Excel / CSV / Word)
// ============================================================
// Supports: .xlsx, .xls, .csv, .docx

import * as XLSX from 'xlsx';
import type { Question, QuestionType, ImportResult, ImportRow } from '../types';
import { generateId } from './helpers';

// ---- Word (.docx) Parser ----
// Format yang didukung dalam file Word:
// Setiap soal dipisahkan oleh baris kosong atau nomor (1. 2. dst)
// Kunci jawaban ditandai: *A atau (A)
// Essay ditandai: [Essay] di depan soal
// Contoh:
//   1. Ibukota Indonesia?
//   A. Jakarta
//   *B. Jakarta (jika kunci)
//   C. Bandung
//   Bobot: 1
//
//   [Essay] Jelaskan fotosintesis!
//   Bobot: 5

export async function parseWordFile(file: File): Promise<ImportResult> {
  // @ts-ignore — mammoth is installed but might not have types
  const mammoth = await import('mammoth');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value as string;
        resolve(parseWordText(text));
      } catch (err) {
        reject(new Error('Gagal membaca file Word: ' + String(err)));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsArrayBuffer(file);
  });
}

function parseWordText(text: string): ImportResult {
  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];
  
  // Split by double newline or numbered patterns (1. 2. etc.)
  const rawBlocks = text
    .split(/\n{2,}|\r\n{2,}/)
    .map(b => b.trim())
    .filter(b => b.length > 0);

  let rowIndex = 1;
  const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

  for (const block of rawBlocks) {
    const lines = block.split(/\n|\r\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) continue;

    rowIndex++;
    const errors: string[] = [];

    // Detect essay
    const isEssay = /^\[?essay\]?/i.test(lines[0]) || (lines.length <= 2 && !/^[A-F]\./i.test(lines[1] ?? ''));

    // Clean question text (remove prefix like "1." "[Essay]")
    const rawQ = lines[0].replace(/^\[?essay\]?\s*/i, '').replace(/^\d+[\.\)]\s*/, '').trim();
    if (!rawQ) { errors.push('Teks soal kosong'); }

    // Bobot
    const bobotLine = lines.find(l => /^bobot\s*:/i.test(l));
    const bobotRaw = bobotLine ? bobotLine.replace(/^bobot\s*:/i, '').trim() : '1';
    const weight = parseFloat(bobotRaw) || 1;

    // Tag
    const tagLine = lines.find(l => /^tag\s*:/i.test(l));
    const tags = tagLine ? tagLine.replace(/^tag\s*:/i, '').split(/[,;]/).map(t => t.trim()).filter(Boolean) : [];

    if (isEssay) {
      // Essay
      const guideLines = lines.filter(l => !/^bobot\s*:/i.test(l) && !/^tag\s*:/i.test(l) && l !== lines[0]);
      const answerGuide = guideLines.join(' ').trim();

      const question: Partial<Question> = {
        id: generateId(), type: 'ESSAY',
        text: rawQ, weight, tags, order: rowIndex,
        answerGuide: answerGuide || undefined,
      };

      const importRow: ImportRow = { rowIndex, question, errors, isValid: errors.length === 0 };
      if (importRow.isValid) valid.push(importRow); else invalid.push(importRow);
    } else {
      // Multiple Choice — parse option lines
      const optionLines = lines.slice(1).filter(l =>
        /^[A-F][\.\)]/i.test(l) || /^\*[A-F][\.\)]/i.test(l)
      );

      const options = optionLines.map(l => ({
        id: generateId(),
        text: l.replace(/^\*?[A-F][\.\)]\s*/i, '').trim(),
        isCorrect: l.startsWith('*'),
      }));

      if (options.length < 2) errors.push('Minimal 2 opsi jawaban ditemukan');

      // Detect kunci from * or explicit "Kunci: A" line
      let correctOptionId: string | undefined;
      const kunciLine = lines.find(l => /^kunci\s*:/i.test(l));
      if (kunciLine) {
        const kunciLetter = kunciLine.replace(/^kunci\s*:/i, '').trim().toUpperCase();
        const kunciIdx = OPTION_LETTERS.indexOf(kunciLetter);
        if (kunciIdx >= 0 && options[kunciIdx]) {
          correctOptionId = options[kunciIdx].id;
        } else {
          errors.push(`Kunci jawaban "${kunciLetter}" tidak valid`);
        }
      } else {
        const correctOpt = options.find(o => o.isCorrect);
        if (correctOpt) {
          correctOptionId = correctOpt.id;
        } else {
          errors.push('Kunci jawaban tidak ditemukan. Tandai dengan * di depan opsi. Contoh: *A. Jakarta');
        }
      }

      const cleanOptions = options.map(({ id, text }) => ({ id, text }));

      const question: Partial<Question> = {
        id: generateId(), type: 'MULTIPLE_CHOICE',
        text: rawQ, weight, tags, order: rowIndex,
        options: cleanOptions, correctOptionId,
      };

      const importRow: ImportRow = { rowIndex, question, errors, isValid: errors.length === 0 };
      if (importRow.isValid) valid.push(importRow); else invalid.push(importRow);
    }
  }

  return { valid, invalid, totalRows: rowIndex - 1 };
}

// ---- Excel / CSV Parser ----
// Expected columns (case-insensitive): Tipe, Pertanyaan, Opsi A, Opsi B, Opsi C, Opsi D, Opsi E, Opsi F, Kunci, Bobot, Tag
// Tipe: "PG" | "Essay"
// Kunci: "A" | "B" | "C" | ... (for PG)

export async function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: '',
          raw: false,
        });
        resolve(parseRows(rows));
      } catch (err) {
        reject(new Error('Gagal membaca file Excel: ' + String(err)));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsBinaryString(file);
  });
}

export async function parseCSVFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const workbook = XLSX.read(text, { type: 'string' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: '',
          raw: false,
        });
        resolve(parseRows(rows));
      } catch (err) {
        reject(new Error('Gagal membaca file CSV: ' + String(err)));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file, 'UTF-8');
  });
}

// Normalize column header keys
function normalizeKey(key: string): string {
  return key.toLowerCase().trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

function findValue(row: Record<string, string>, ...candidates: string[]): string {
  for (const c of candidates) {
    const v = row[c] ?? row[c.toLowerCase()] ?? row[c.toUpperCase()] ?? '';
    if (v !== '') return String(v).trim();
  }
  // Try normalized
  const norm: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) norm[normalizeKey(k)] = v;
  for (const c of candidates) {
    const v = norm[normalizeKey(c)];
    if (v !== undefined && v !== '') return v.trim();
  }
  return '';
}

function parseRows(rows: Record<string, string>[]): ImportResult {
  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2; // 1-indexed, row 1 = header
    const errors: string[] = [];

    const tipeRaw = findValue(row, 'Tipe', 'tipe', 'type', 'Type').toUpperCase();
    const questionText = findValue(row, 'Pertanyaan', 'pertanyaan', 'Soal', 'soal', 'Question', 'question');
    const bobotRaw = findValue(row, 'Bobot', 'bobot', 'Nilai', 'nilai', 'Weight', 'weight', 'Points', 'points');
    const tagRaw = findValue(row, 'Tag', 'tag', 'Tags', 'tags', 'Kategori', 'kategori');
    const kunciRaw = findValue(row, 'Kunci', 'kunci', 'Jawaban Benar', 'jawaban_benar', 'Kunci Jawaban', 'Answer', 'answer').toUpperCase();
    const answerGuide = findValue(row, 'Panduan Jawaban', 'panduan_jawaban', 'Kunci Essay', 'Guide');

    // Tipe
    let type: QuestionType = 'MULTIPLE_CHOICE';
    if (tipeRaw === 'ESSAY' || tipeRaw === 'E' || tipeRaw === 'URAIAN') {
      type = 'ESSAY';
    } else if (tipeRaw === 'PG' || tipeRaw === 'MC' || tipeRaw === 'PILIHAN_GANDA' || tipeRaw === 'MULTIPLE_CHOICE') {
      type = 'MULTIPLE_CHOICE';
    } else if (tipeRaw === '') {
      type = 'MULTIPLE_CHOICE'; // default
    } else {
      errors.push(`Tipe soal tidak valid: "${tipeRaw}". Gunakan "PG" atau "Essay"`);
    }

    // Question text
    if (!questionText) errors.push('Teks pertanyaan kosong');

    // Weight
    const weight = parseFloat(bobotRaw);
    if (isNaN(weight) || weight <= 0) {
      errors.push(`Bobot nilai tidak valid: "${bobotRaw}". Harus berupa angka positif`);
    }

    // Tags
    const tags = tagRaw ? tagRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];

    // MC-specific
    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const options = optionLetters
      .map(l => ({
        id: generateId(),
        text: findValue(row, `Opsi ${l}`, `opsi_${l.toLowerCase()}`, `Option ${l}`, l),
      }))
      .filter(o => o.text !== '');

    let correctOptionId: string | undefined;

    if (type === 'MULTIPLE_CHOICE') {
      if (options.length < 2) {
        errors.push('Minimal 2 opsi jawaban untuk soal Pilihan Ganda');
      }
      if (!kunciRaw) {
        errors.push('Kunci jawaban tidak ditemukan');
      } else {
        const kunciIndex = optionLetters.indexOf(kunciRaw);
        if (kunciIndex === -1 || kunciIndex >= options.length) {
          errors.push(`Kunci jawaban "${kunciRaw}" tidak valid atau opsi tidak ada`);
        } else {
          correctOptionId = options[kunciIndex].id;
        }
      }
    }

    const question: Partial<Question> = {
      id: generateId(),
      type,
      text: questionText,
      weight: isNaN(weight) ? 1 : weight,
      tags,
      order: rowIndex - 1,
      ...(type === 'MULTIPLE_CHOICE' ? { options, correctOptionId } : { answerGuide }),
    };

    const importRow: ImportRow = {
      rowIndex,
      question,
      errors,
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
  const ws = XLSX.utils.aoa_to_sheet([
    ['Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Opsi F', 'Kunci', 'Bobot', 'Tag', 'Panduan Jawaban'],
    ['PG', 'Manakah yang merupakan bilangan prima?', '2', '4', '6', '8', '', '', 'A', '1', 'Matematika', ''],
    ['PG', 'Ibukota Indonesia adalah...', 'Surabaya', 'Bandung', 'Jakarta', 'Medan', '', '', 'C', '1', 'IPS,Geografi', ''],
    ['Essay', 'Jelaskan pengertian fotosintesis!', '', '', '', '', '', '', '', '5', 'IPA,Biologi', 'Fotosintesis adalah proses pembuatan makanan oleh tumbuhan menggunakan cahaya matahari.'],
  ]);

  // Set column widths
  ws['!cols'] = [
    { wch: 8 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 8 }, { wch: 8 },
    { wch: 20 }, { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Soal');
  XLSX.writeFile(wb, 'template_soal_ujianly.xlsx');
}

// ---- Export Results ----
export function exportResultsToExcel(
  examTitle: string,
  submissions: import('../types').Submission[],
  exam: import('../types').Exam,
): void {
  const headers = [
    'No', 'Nama', 'NIS', 'Percobaan', 'Waktu Submit',
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
      s.submittedAt ? new Date(s.submittedAt).toLocaleString('id-ID') : '-',
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
