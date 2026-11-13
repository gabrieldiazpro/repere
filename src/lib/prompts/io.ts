/**
 * Import (CSV ou texte, une question par ligne) et export CSV des questions suivies.
 * CSV : séparateur « ; » ou « , » détecté, guillemets doubles gérés. Colonnes reconnues (en-tête facultatif) :
 * question | texte | text | prompt, theme | thème | sujet, tags (séparés par « | »), intention | intent, actif | active.
 */
import { demandIndex, DEMAND_LABEL, type DemandContext } from './demand';
import { cleanTags, cleanTheme, findDuplicate, isIntent, validateText } from './text';
import { INTENT_LABEL, PROMPT_INTENTS, type PromptInput, type PromptIntent, type TrackedPrompt } from './types';

export const MAX_IMPORT_LINES = 500;
export const MAX_IMPORT_BYTES = 200_000;

export interface ParsedRow extends PromptInput {
  line: number;
}

export interface ImportRejection {
  line: number;
  text: string;
  reason: string;
}

/** Découpe une ligne CSV (RFC 4180 simplifié). */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"' && cur.trim() === '') {
      q = true;
      cur = '';
    } else if (ch === sep) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const HEADERS: Record<string, keyof PromptInput> = {
  question: 'text',
  questions: 'text',
  texte: 'text',
  text: 'text',
  prompt: 'text',
  theme: 'theme',
  thème: 'theme',
  sujet: 'theme',
  topic: 'theme',
  tags: 'tags',
  tag: 'tags',
  intention: 'intent',
  intent: 'intent',
  actif: 'active',
  active: 'active',
};

function intentFrom(v: string): PromptIntent | undefined {
  const n = v.trim().toLowerCase();
  if (isIntent(n)) return n;
  const byLabel = PROMPT_INTENTS.find((i) => INTENT_LABEL[i].toLowerCase() === n);
  return byLabel;
}

/**
 * Lit un contenu importé. Format CSV si un en-tête reconnu est présent ; sinon une question par ligne
 * (les lignes vides et celles commençant par « # » sont ignorées).
 */
export function parseImport(content: string): ParsedRow[] {
  const lines = content.replace(/^﻿/, '').split(/\r?\n/);
  const first = lines.find((l) => l.trim()) ?? '';
  const sep = (first.match(/;/g)?.length ?? 0) >= (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  const head = splitCsvLine(first, sep).map((h) => h.toLowerCase().replace(/^"|"$/g, '').trim());
  const isCsv = head.some((h) => HEADERS[h] === 'text');
  const rows: ParsedRow[] = [];
  if (!isCsv) {
    lines.forEach((l, i) => {
      const t = l.trim().replace(/^[-*•]\s+|^\d+[.)]\s+/, '');
      if (t && !t.startsWith('#')) rows.push({ line: i + 1, text: t });
    });
    return rows.slice(0, MAX_IMPORT_LINES);
  }
  const cols = head.map((h) => HEADERS[h]);
  const headerIdx = lines.indexOf(first);
  for (let i = headerIdx + 1; i < lines.length && rows.length < MAX_IMPORT_LINES; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCsvLine(lines[i], sep);
    const row: ParsedRow = { line: i + 1, text: '' };
    cols.forEach((c, j) => {
      const v = cells[j] ?? '';
      if (c === 'text') row.text = v;
      else if (c === 'theme') row.theme = v || undefined;
      else if (c === 'tags') row.tags = v ? v.split(/[|,]/) : [];
      else if (c === 'intent') row.intent = intentFrom(v);
      else if (c === 'active') row.active = !/^(non|no|false|0|inactif|pause)$/i.test(v.trim());
    });
    rows.push(row);
  }
  return rows;
}

export interface ImportPlan {
  accepted: PromptInput[];
  rejected: ImportRejection[];
}

/** Valide et dédoublonne (contre l'existant et dans le fichier). L'écriture et le quota sont gérés par l'appelant. */
export function planImport(rows: ParsedRow[], existing: readonly { text: string }[]): ImportPlan {
  const accepted: (PromptInput & { line: number })[] = [];
  const rejected: ImportRejection[] = [];
  for (const r of rows) {
    const v = validateText(r.text);
    if (!v.ok) {
      rejected.push({ line: r.line, text: String(r.text ?? '').slice(0, 200), reason: v.error });
      continue;
    }
    if (findDuplicate(v.text, existing)) {
      rejected.push({ line: r.line, text: v.text, reason: 'Déjà suivie (ou très proche d\'une question suivie).' });
      continue;
    }
    if (findDuplicate(v.text, accepted)) {
      rejected.push({ line: r.line, text: v.text, reason: 'Doublon dans le fichier.' });
      continue;
    }
    accepted.push({ line: r.line, text: v.text, theme: cleanTheme(r.theme), tags: r.tags ? cleanTags(r.tags) : undefined, intent: r.intent, active: r.active, origin: 'client' });
  }
  return { accepted: accepted.map(({ line: _line, ...p }) => p), rejected };
}

function csvCell(v: string): string {
  // Neutralise les formules (injection CSV) et échappe les guillemets.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel). */
export function exportCsv(prompts: readonly TrackedPrompt[], ctx: DemandContext = {}): string {
  const head = ['question', 'theme', 'tags', 'intention', 'origine', 'actif', 'cree_le', 'indice_de_demande_estimation'];
  const lines = prompts.map((p) =>
    [
      p.text,
      p.theme,
      p.tags.join('|'),
      p.intent,
      p.origin,
      p.active ? 'oui' : 'non',
      p.createdAt.slice(0, 10),
      `${DEMAND_LABEL[demandIndex(p.text, p.intent, ctx).level]} (estimation)`,
    ]
      .map(csvCell)
      .join(';'),
  );
  return `﻿${[head.join(';'), ...lines].join('\r\n')}\r\n`;
}
