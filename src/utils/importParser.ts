// ============================================================
// Kuizku — File Import Parser (Excel / CSV / Word)
// ============================================================
// Supports: .xlsx, .xls, .csv, .docx

import * as XLSX from 'xlsx';
import type { Question, QuestionType, ImportResult, ImportRow } from '../types';
import { generateId } from './helpers';

// ---- Word (.docx) Parser ----
// Format yang didukung dalam file Word:
// Setiap soal dipisahkan oleh baris kosong atau nomor (1. 2. dst)
// Kunci jawaban ditandai: *A atau Kunci: A
// Essay ditandai: [Essay] di depan soal

export async function parseWordFile(file: File): Promise<ImportResult> {
  // @ts-ignore — mammoth is installed but might not have types
  const mammoth = await import('mammoth');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const result = await mammoth.extractRawText({ arrayBuffer });
        resolve(parseWordText(result.value as string));
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
    const isEssay = /^\[?essay\]?/i.test(lines[0]) || (lines.length <= 2 && !/^\*?[A-F][\.\)]/i.test(lines[1] ?? ''));
    const rawQ = lines[0].replace(/^\[?essay\]?\s*/i, '').replace(/^\d+[\.\)]\s*/, '').trim();
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

    const optionLines = lines.slice(1).filter(l => /^\*?[A-F][\.\)]/i.test(l));
    const optionsWithLetters = optionLines.map(l => ({
      id: generateId(),
      letter: l.replace(/^\*/, '').charAt(0).toUpperCase(),
      text: l.replace(/^\*?[A-F][\.\)]\s*/i, '').trim(),
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

export async function parseExcelFile(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target?.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
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
        const workbook = XLSX.read(e.target?.result as string, { type: 'string' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
        resolve(parseRows(rows));
      } catch (err) {
        reject(new Error('Gagal membaca file CSV: ' + String(err)));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsText(file, 'UTF-8');
  });
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

function parseRows(rows: Record<string, string>[]): ImportResult {
  const valid: ImportRow[] = [];
  const invalid: ImportRow[] = [];

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2;
    const errors: string[] = [];
    const tipeRaw = findValue(row, 'Tipe', 'type').toUpperCase();
    const questionText = findValue(row, 'Pertanyaan', 'Soal', 'Question');
    const bobotRaw = findValue(row, 'Bobot', 'Nilai', 'Weight', 'Points');
    const tagRaw = findValue(row, 'Tag', 'Tags', 'Kategori');
    const kunciRaw = findValue(row, 'Kunci', 'Jawaban Benar', 'jawaban_benar', 'Kunci Jawaban', 'Answer').toUpperCase();
    const answerGuide = findValue(row, 'Panduan Jawaban', 'panduan_jawaban', 'Kunci Essay', 'Guide');

    let type: QuestionType = 'MULTIPLE_CHOICE';
    if (tipeRaw === 'ESSAY' || tipeRaw === 'E' || tipeRaw === 'URAIAN') type = 'ESSAY';
    else if (tipeRaw === 'PG' || tipeRaw === 'MC' || tipeRaw === 'PILIHAN_GANDA' || tipeRaw === 'MULTIPLE_CHOICE' || tipeRaw === '') type = 'MULTIPLE_CHOICE';
    else errors.push(`Tipe soal tidak valid: "${tipeRaw}". Gunakan "PG" atau "Essay"`);

    if (!questionText) errors.push('Teks pertanyaan kosong');

    // Kosong = default 1. Hanya nilai yang diisi tetapi tidak valid yang ditolak.
    const parsedWeight = bobotRaw === '' ? 1 : parseFloat(bobotRaw);
    const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1;
    if (bobotRaw !== '' && (!Number.isFinite(parsedWeight) || parsedWeight <= 0)) {
      errors.push(`Bobot nilai tidak valid: "${bobotRaw}". Harus berupa angka positif`);
    }

    const tags = tagRaw ? tagRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];
    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    const optionsWithLetters = optionLetters.map(letter => ({
      id: generateId(),
      letter,
      text: findValue(row, `Opsi ${letter}`, `opsi_${letter.toLowerCase()}`, `Option ${letter}`, letter),
    })).filter(o => o.text !== '');

    let correctOptionId: string | undefined;
    if (type === 'MULTIPLE_CHOICE') {
      if (optionsWithLetters.length < 2) errors.push('Minimal 2 opsi jawaban untuk soal Pilihan Ganda');
      if (!kunciRaw) {
        errors.push('Kunci jawaban tidak ditemukan');
      } else {
        const correctOpt = optionsWithLetters.find(o => o.letter === kunciRaw);
        if (!correctOpt) errors.push(`Kunci jawaban "${kunciRaw}" tidak valid atau opsi tidak ada`);
        else correctOptionId = correctOpt.id;
      }
    }

    const question: Partial<Question> = {
      id: generateId(),
      type,
      text: questionText,
      weight,
      tags,
      order: rowIndex - 1,
      ...(type === 'MULTIPLE_CHOICE'
        ? { options: optionsWithLetters.map(({ id, text }) => ({ id, text })), correctOptionId }
        : { answerGuide }),
    };

    const importRow: ImportRow = { rowIndex, question, errors, isValid: errors.length === 0 };
    (importRow.isValid ? valid : invalid).push(importRow);
  });

  return { valid, invalid, totalRows: rows.length };
}

// ---- Excel Template Generator ----
export function downloadExcelTemplate(): void {
  const soalSheet = XLSX.utils.aoa_to_sheet([
    ['Tipe', 'Pertanyaan', 'Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E', 'Opsi F', 'Kunci', 'Bobot', 'Tag', 'Panduan Jawaban'],
    ['PG', 'Siapa khalifah pertama setelah Rasulullah?', 'Abu Bakar', 'Umar bin Khattab', 'Utsman bin Affan', 'Ali bin Abi Thalib', '', '', 'A', '1', 'PAI', ''],
    ['PG', 'Jumlah rukun Islam adalah...', '4', '5', '6', '7', '', '', 'B', '', 'PAI', ''],
    ['Essay', 'Sebutkan lima rukun Islam!', '', '', '', '', '', '', '', '5', 'PAI', 'Syahadat, shalat, zakat, puasa Ramadan, dan haji bagi yang mampu.'],
  ]);
  soalSheet['!cols'] = [
    { wch: 10 }, { wch: 52 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 48 },
  ];
  soalSheet['!autofilter'] = { ref: 'A1:L4' };

  const petunjukSheet = XLSX.utils.aoa_to_sheet([
    ['PETUNJUK IMPORT SOAL KUIZKU'],
    ['Kolom', 'Aturan'],
    ['Tipe', 'Isi PG atau Essay. Jika kosong, dianggap PG.'],
    ['Pertanyaan', 'Wajib diisi. Bisa juga memakai header Soal/Question.'],
    ['Opsi A-F', 'Untuk PG minimal 2 opsi. Isi berurutan A, B, C, D, dst.'],
    ['Kunci', 'Untuk PG wajib huruf A-F dan harus menunjuk opsi yang tersedia.'],
    ['Bobot', 'Boleh kosong; otomatis bernilai 1. Jika diisi harus angka positif.'],
    ['Tag', 'Opsional. Pisahkan beberapa tag dengan koma, titik koma, atau |.'],
    ['Panduan Jawaban', 'Opsional untuk Essay.'],
    ['Tips', 'Jangan ubah nama sheet SOAL dan jangan taruh baris judul tambahan di atas header.'],
    ['Sebelum import', 'Kuizku akan menampilkan preview: soal valid dan baris yang perlu diperbaiki.'],
  ]);
  petunjukSheet['!cols'] = [{ wch: 22 }, { wch: 90 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, soalSheet, 'SOAL');
  XLSX.utils.book_append_sheet(wb, petunjukSheet, 'PETUNJUK');
  XLSX.writeFile(wb, 'template_soal_kuizku.xlsx');
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
