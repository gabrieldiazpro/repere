import type { AuditResult, ProviderId } from '@/lib/engine';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', claude: 'Claude', mistral: 'Mistral (Le Chat)',
};

/** Accepte une part en fraction (0-1) ou en pourcentage (0-100). */
export function pct(x: number | null | undefined): number {
  if (x == null || Number.isNaN(x)) return 0;
  const v = x > 0 && x <= 1 ? x * 100 : x;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function providersOf(r: AuditResult): ProviderId[] {
  const fromResult = (r.providersUsed ?? []).filter(Boolean);
  if (fromResult.length) return fromResult;
  return (Object.keys(r.subScores) as ProviderId[]).filter((p) => r.subScores[p] != null);
}

export interface Cell { mentioned: boolean; bestRank: number | null; k: number; n: number }

/** Cellule requête × IA, agrégée sur les exécutions. null = non testé. */
export function queryMatrix(r: AuditResult, providers: ProviderId[]): Map<string, Map<ProviderId, Cell>> {
  const out = new Map<string, Map<ProviderId, Cell>>();
  for (const q of r.queries) {
    const row = new Map<ProviderId, Cell>();
    for (const p of providers) {
      const ms = r.mentions.filter((m) => m.queryId === q.id && m.provider === p);
      if (!ms.length) continue;
      const k = ms.filter((m) => m.mentioned).length;
      const ranks = ms.map((m) => m.rank).filter((x): x is number => typeof x === 'number');
      row.set(p, { mentioned: k > 0, bestRank: ranks.length ? Math.min(...ranks) : null, k, n: ms.length });
    }
    out.set(q.id, row);
  }
  return out;
}

export function byProvider(r: AuditResult, p: ProviderId) {
  const ms = r.mentions.filter((m) => m.provider === p);
  const cited = ms.filter((m) => m.mentioned);
  const ranks = cited.map((m) => m.rank).filter((x): x is number => typeof x === 'number');
  return {
    total: ms.length,
    cited: cited.length,
    avgRank: ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null,
  };
}

const DIRECTORIES = /^(pages ?jaunes|google( maps)?|yelp|tripadvisor|doctolib|facebook|instagram|mappy|trustpilot|ubereats|uber eats|deliveroo|the ?fork|lafourchette)\b/i;
export function isDirectory(name: string): boolean {
  return DIRECTORIES.test(name.trim());
}

export type Seg = { text: string; hl: boolean };

/** Découpe un texte en segments, en marquant les noms à surligner. Aucune injection : on ne produit que des chaînes. */
export function highlightSegments(text: string, terms: string[]): Seg[] {
  const clean = Array.from(new Set(terms.map((t) => t.trim()).filter((t) => t.length > 1))).sort((a, b) => b.length - a.length);
  if (!clean.length) return [{ text, hl: false }];
  const re = new RegExp(`(${clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const segs: Seg[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) segs.push({ text: text.slice(last, i), hl: false });
    segs.push({ text: m[0], hl: true });
    last = i + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last), hl: false });
  return segs;
}

/** Tronque à `max` caractères autour de la première mise en avant, sans couper un mot. */
export function excerptAround(text: string, terms: string[], max = 280): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const lower = t.toLowerCase();
  let anchor = 0;
  for (const term of terms) {
    const i = lower.indexOf(term.toLowerCase());
    if (i >= 0) { anchor = i; break; }
  }
  let start = Math.max(0, anchor - Math.floor(max / 3));
  let end = Math.min(t.length, start + max);
  start = Math.max(0, end - max);
  if (start > 0) { const sp = t.indexOf(' ', start); if (sp >= 0 && sp < anchor) start = sp + 1; }
  if (end < t.length) { const sp = t.lastIndexOf(' ', end); if (sp > start + 20 && sp > anchor) end = sp; }
  return `${start > 0 ? '… ' : ''}${t.slice(start, end).trim()}${end < t.length ? ' …' : ''}`;
}

export function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'commerce';
}

export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://repere-ia.fr').replace(/\/+$/, '');
}
