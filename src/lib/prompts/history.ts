/**
 * Historique d'une question suivie, par IA, à partir des audits enregistrés (prépare l'écran « Réponses ») :
 * - série : une entrée par audit × IA (date, cité ou non, meilleur rang, concurrents cités) ;
 * - réponses brutes avec positions de surlignage (client, concurrents, sources), calculées sur le texte tel quel.
 * Une question est rattachée à une requête d'audit par son identifiant de requête, sinon par son texte normalisé.
 */
import type { AuditResult, ProviderAnswer, ProviderId, QuerySpec } from '@/lib/engine/types';
import { queryIdOf } from './engine';
import { fold, normalizeQuestion } from './text';
import type { TrackedPrompt } from './types';

export type HighlightKind = 'client' | 'concurrent' | 'source';

export interface Highlight {
  /** index de début (inclus) dans `text`, en unités UTF-16 (compatible `String.prototype.slice`) */
  start: number;
  /** index de fin (exclu) */
  end: number;
  kind: HighlightKind;
  /** nom du client / du concurrent, ou domaine de la source */
  label: string;
}

export interface HistoryPoint {
  auditId: string;
  date: string;
  provider: ProviderId;
  queryId: string;
  /** cité dans au moins une des exécutions */
  cited: boolean;
  /** meilleur rang obtenu (1 = premier cité), null si non cité ou rang inconnu */
  rank: number | null;
  /** concurrents cités (union des exécutions), dans l'ordre d'apparition */
  competitors: string[];
  runs: number;
  /** réponse sans aucune recommandation */
  noRec: boolean;
  demo: boolean;
}

export interface HistorySource {
  url: string;
  domain: string;
  title?: string;
  kind?: 'cited' | 'retrieved' | 'inline';
}

export interface HistoryAnswer {
  auditId: string;
  date: string;
  provider: ProviderId;
  queryId: string;
  run: number;
  text: string;
  highlights: Highlight[];
  sources: HistorySource[];
  model?: string;
  error?: string;
  demo: boolean;
}

export interface ProviderSummary {
  provider: ProviderId;
  measures: number;
  cited: number;
  /** dernier état connu */
  lastCited: boolean | null;
  lastRank: number | null;
}

export interface PromptHistory {
  promptId: string;
  text: string;
  queryIds: string[];
  providers: ProviderId[];
  series: HistoryPoint[];
  answers: HistoryAnswer[];
  summary: ProviderSummary[];
  /** nombre d'audits où la question a été mesurée */
  audits: number;
}

// ---------------------------------------------------------------------------
// Surlignage
// ---------------------------------------------------------------------------

/** Texte replié (minuscules, sans accents) de MÊME longueur que l'original : les index restent valides. */
export function foldAligned(s: string): string {
  let out = '';
  for (const ch of s) {
    const f = fold(ch).toLowerCase();
    const keep = f.length === ch.length ? f : ch.toLowerCase().length === ch.length ? ch.toLowerCase() : ch;
    out += keep;
  }
  return out;
}

const WORD = /[\p{L}\p{N}]/u;

/** Occurrences (mot entier, sans tenir compte de la casse ni des accents) de `needle` dans `text`. */
export function findAll(text: string, needle: string): { start: number; end: number }[] {
  const n = foldAligned(needle.trim());
  if (n.length < 2) return [];
  const h = foldAligned(text);
  const out: { start: number; end: number }[] = [];
  let i = h.indexOf(n);
  while (i !== -1) {
    const before = i > 0 ? h[i - 1] : '';
    const after = h[i + n.length] ?? '';
    const okBefore = !before || !WORD.test(before) || !WORD.test(n[0]);
    const okAfter = !after || !WORD.test(after) || !WORD.test(n[n.length - 1]);
    if (okBefore && okAfter) out.push({ start: i, end: i + n.length });
    i = h.indexOf(n, i + 1);
  }
  return out;
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].toLowerCase();
  }
}

export interface HighlightTargets {
  client: string[];
  competitors: string[];
  sources: string[];
}

/**
 * Positions de surlignage, triées, sans chevauchement (en cas de chevauchement : la plus longue gagne,
 * puis client > concurrent > source). Les sources sont repérées par leur URL complète puis par leur domaine.
 */
export function highlightText(text: string, targets: HighlightTargets): Highlight[] {
  const raw: Highlight[] = [];
  const add = (label: string, needle: string, kind: HighlightKind) => {
    for (const r of findAll(text, needle)) raw.push({ ...r, kind, label });
  };
  for (const c of new Set(targets.client.filter(Boolean))) add(c, c, 'client');
  for (const c of new Set(targets.competitors.filter(Boolean))) add(c, c, 'concurrent');
  for (const url of new Set(targets.sources.filter(Boolean))) {
    const d = domainOf(url);
    add(d, url, 'source');
    if (d.includes('.')) add(d, d, 'source');
  }
  const prio: Record<HighlightKind, number> = { client: 0, concurrent: 1, source: 2 };
  raw.sort((a, b) => b.end - b.start - (a.end - a.start) || prio[a.kind] - prio[b.kind] || a.start - b.start);
  const kept: Highlight[] = [];
  for (const r of raw) if (!kept.some((k) => r.start < k.end && k.start < r.end)) kept.push(r);
  return kept.sort((a, b) => a.start - b.start);
}

// ---------------------------------------------------------------------------
// Historique
// ---------------------------------------------------------------------------

/** Requête d'un audit correspondant à la question (identifiant, sinon texte normalisé). */
export function matchQuery(prompt: Pick<TrackedPrompt, 'text' | 'queryId' | 'intent'>, audit: Pick<AuditResult, 'queries'>): QuerySpec | null {
  const id = queryIdOf(prompt);
  const byId = audit.queries.find((q) => q.id === id || (prompt.queryId && q.id === prompt.queryId));
  if (byId) return byId;
  const n = normalizeQuestion(prompt.text);
  return audit.queries.find((q) => normalizeQuestion(q.text) === n) ?? null;
}

function sourcesOf(a: ProviderAnswer): HistorySource[] {
  const seen = new Set<string>();
  const out: HistorySource[] = [];
  for (const s of a.sources ?? []) {
    if (!s?.url || seen.has(s.url)) continue;
    seen.add(s.url);
    out.push({ url: s.url, domain: domainOf(s.url), ...(s.title ? { title: s.title } : {}), kind: s.kind });
  }
  for (const url of a.citations ?? []) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({ url, domain: domainOf(url), kind: 'cited' });
  }
  return out;
}

export interface HistoryOptions {
  provider?: ProviderId;
  /** ne garder que les audits à partir de cette date (ISO) — limite d'historique de l'offre */
  since?: string;
  /** inclure les réponses brutes (défaut : oui) */
  answers?: boolean;
  /** nombre maximal de réponses brutes renvoyées (les plus récentes d'abord ; défaut 60) */
  maxAnswers?: number;
}

/** Historique d'une question à travers des audits (du plus ancien au plus récent). */
export function buildHistory(prompt: TrackedPrompt, audits: readonly AuditResult[], opts: HistoryOptions = {}): PromptHistory {
  const series: HistoryPoint[] = [];
  const answers: HistoryAnswer[] = [];
  const queryIds = new Set<string>();
  const providers = new Set<ProviderId>();
  let measured = 0;
  const sorted = [...audits].sort((a, b) => (a.measuredAt || a.createdAt).localeCompare(b.measuredAt || b.createdAt));
  for (const audit of sorted) {
    const date = audit.measuredAt || audit.createdAt;
    if (opts.since && date < opts.since) continue;
    const q = matchQuery(prompt, audit);
    if (!q) continue;
    queryIds.add(q.id);
    const ms = audit.mentions.filter((m) => m.queryId === q.id && (!opts.provider || m.provider === opts.provider));
    const byProvider = new Map<ProviderId, typeof ms>();
    for (const m of ms) byProvider.set(m.provider, [...(byProvider.get(m.provider) ?? []), m]);
    if (byProvider.size) measured++;
    for (const [provider, list] of byProvider) {
      providers.add(provider);
      const ranks = list.filter((m) => m.mentioned && m.rank != null).map((m) => m.rank as number);
      const comps: string[] = [];
      for (const m of list) for (const c of m.competitors) if (!comps.includes(c)) comps.push(c);
      series.push({
        auditId: audit.id,
        date,
        provider,
        queryId: q.id,
        cited: list.some((m) => m.mentioned),
        rank: ranks.length ? Math.min(...ranks) : null,
        competitors: comps,
        runs: list.length,
        noRec: list.every((m) => m.noRec === true),
        demo: Boolean(audit.demo),
      });
    }
    if (opts.answers === false) continue;
    const client = [audit.input.businessName].filter(Boolean);
    const allCompetitors = [...new Set([...audit.competitors.map((c) => c.name), ...ms.flatMap((m) => m.competitors)])];
    for (const a of audit.answers) {
      if (a.queryId !== q.id || (opts.provider && a.provider !== opts.provider)) continue;
      const sources = sourcesOf(a);
      answers.push({
        auditId: audit.id,
        date: a.at || date,
        provider: a.provider,
        queryId: q.id,
        run: a.run,
        text: a.text,
        highlights: highlightText(a.text ?? '', { client, competitors: allCompetitors, sources: sources.map((s) => s.url) }),
        sources,
        ...(a.model ? { model: a.model } : {}),
        ...(a.error ? { error: a.error } : {}),
        demo: Boolean(a.demo || audit.demo),
      });
    }
  }
  const summary: ProviderSummary[] = [...providers].map((provider) => {
    const pts = series.filter((s) => s.provider === provider);
    const last = pts[pts.length - 1];
    return { provider, measures: pts.length, cited: pts.filter((p) => p.cited).length, lastCited: last ? last.cited : null, lastRank: last ? last.rank : null };
  });
  const maxAnswers = Math.max(0, Math.min(opts.maxAnswers ?? 60, 500));
  const recentAnswers = answers.slice(-maxAnswers).reverse();
  return {
    promptId: prompt.id,
    text: prompt.text,
    queryIds: [...queryIds],
    providers: [...providers],
    series,
    answers: recentAnswers,
    summary,
    audits: measured,
  };
}
