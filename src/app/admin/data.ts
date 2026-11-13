import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { isAdminToken } from '@/lib/adminAuth';

/** Jeton admin valide (ADMIN_TOKEN). */
export const isAdmin = isAdminToken;

export type Row = Record<string, string>;

function parseCsv(text: string): Row[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  if (!head) return [];
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

function readAll(prefix: string): Row[] {
  const dir = join(process.cwd(), '.data');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.csv'))
    .flatMap((f) => parseCsv(readFileSync(join(dir, f), 'utf8')));
}

/** Leads : audited-*.csv prime sur leads-*.csv (même SIRET). */
export function loadLeads(): Row[] {
  const map = new Map<string, Row>();
  for (const r of readAll('leads-')) map.set(r.siret || r.nom, r);
  for (const r of readAll('audited-')) map.set(r.siret || r.nom, r);
  return [...map.values()];
}

export function funnel(rows: Row[]) {
  const emails = readAll('emails-');
  const audited = rows.filter((r) => r.audit_id);
  const scores = audited.map((r) => Number(r.score)).filter((n) => !Number.isNaN(n));
  return {
    leads: rows.length,
    withEmail: rows.filter((r) => r.email_generique).length,
    audited: audited.length,
    emailsPrepared: emails.length,
    avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
  };
}

export function toCsv(rows: Row[]): string {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  // Neutralise les formules (=, +, -, @) à l'ouverture dans Excel (qa/securite.md F4).
  const cell = (raw: string) => {
    const v = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c] ?? '')).join(','))].join('\n') + '\n';
}
