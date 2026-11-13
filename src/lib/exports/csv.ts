/**
 * CSV compatible Excel français : BOM UTF-8, séparateur « ; », fins de ligne CRLF, virgule décimale,
 * dates ISO, protection contre l'injection de formules (cellule texte commençant par = + - @ tabulation).
 */
export const BOM = '﻿';
export const SEP = ';';
const EOL = '\r\n';

export type CsvValue = string | number | boolean | null | undefined | Date | string[];

export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => CsvValue;
}

/** Nombre au format français (virgule décimale, pas de séparateur de milliers, au plus `digits` décimales). */
export function frNumber(n: number, digits = 4): string {
  if (!Number.isFinite(n)) return '';
  const s = Number.isInteger(n) ? String(n) : String(Number(n.toFixed(digits)));
  return s.replace('.', ',');
}

export function csvCell(v: CsvValue): string {
  if (v === null || v === undefined) return '';
  let s: string;
  if (typeof v === 'number') return frNumber(v);
  if (typeof v === 'boolean') s = v ? 'oui' : 'non';
  else if (v instanceof Date) s = Number.isNaN(v.getTime()) ? '' : v.toISOString();
  else if (Array.isArray(v)) s = v.join(', ');
  else s = String(v);
  // Injection de formule (CSV injection) : neutralisée par une apostrophe.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[], opts: { bom?: boolean } = {}): string {
  const head = columns.map((c) => csvCell(c.label)).join(SEP);
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(SEP));
  return (opts.bom === false ? '' : BOM) + [head, ...body].join(EOL) + EOL;
}

/** Lecture inverse (tests, import) : gère guillemets, « ; » et sauts de ligne dans les cellules. */
export function parseCsv(text: string): string[][] {
  const src = text.startsWith(BOM) ? text.slice(1) : text;
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === SEP) {
      row.push(cell);
      cell = '';
    } else if (ch === '\r' && src[i + 1] === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n') {
      row.push(cell);
      out.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

/** Nom de fichier sûr : « repere-sources-plomberie-martin-2026-11-09.csv ». */
export function csvFilename(kind: string, name: string, date: Date = new Date()): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'export';
  return `repere-${kind}-${slug}-${date.toISOString().slice(0, 10)}.csv`;
}
