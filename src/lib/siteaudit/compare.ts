/**
 * Comparateur « mon site vs un concurrent » : readiness + citabilité des deux pages, côte à côte.
 * On compare des signaux techniques, pas des recommandations réelles des IA (l'audit Repéré mesure l'écart réel).
 */
import { citabilityFromHtml } from './citability';
import { SafeFetchError, normalizeInputUrl, type SafeFetchOptions } from './fetch';
import { auditPage } from './readiness';
import type { Check, CheckStatus, CitabilityReport, CompareReport, CompareRow, ReadinessReport } from './types';

export const COMPARE_DISCLAIMER =
  'Comparaison de signaux techniques lus dans le HTML des deux pages, pas de ce que répondent les IA. L’audit Repéré mesure qui est réellement cité.';
export const COMPARE_BUDGET_MS = 15_000;

const ROWS: { id: string; label: string }[] = [
  { id: 'robots', label: 'Accès des robots IA' },
  { id: 'render', label: 'Lisible sans JavaScript' },
  { id: 'jsonld', label: 'Données structurées (JSON-LD)' },
  { id: 'citability', label: 'Citabilité de la page' },
  { id: 'sitemap', label: 'Sitemap' },
  { id: 'https', label: 'HTTPS' },
  { id: 'response_time', label: 'Vitesse du HTML initial' },
  { id: 'title', label: 'Balise title' },
  { id: 'meta_description', label: 'Meta description' },
  { id: 'h1', label: 'Titre H1' },
  { id: 'indexable', label: 'Page indexable' },
  { id: 'open_graph', label: 'Open Graph' },
  { id: 'llms_txt', label: 'llms.txt (information)' },
];

const RANK: Record<CheckStatus | 'n/a', number> = { ok: 2, warn: 1, fail: 0, 'n/a': -1 };

export interface Side {
  url: string;
  readiness: ReadinessReport | null;
  citability: CitabilityReport | null;
  error?: string;
}

function cell(side: Side, id: string): { status: CheckStatus | 'n/a'; detail: string; check?: Check } {
  if (id === 'citability') {
    const c = side.citability;
    if (!c) return { status: 'n/a', detail: side.error ?? 'Non analysé.' };
    return { status: c.score >= 70 ? 'ok' : c.score >= 40 ? 'warn' : 'fail', detail: `${c.score}/100 (${c.passed} contrôles sur ${c.total} réussis).` };
  }
  const ch = side.readiness?.checks.find((c) => c.id === id);
  if (!ch) return { status: 'n/a', detail: side.error ?? 'Non analysé.' };
  return { status: ch.status, detail: ch.detail, check: ch };
}

/** Tableau comparatif (pur). */
export function compareSides(mine: Side, theirs: Side): CompareReport {
  const rows: CompareRow[] = ROWS.map(({ id, label }) => {
    const a = cell(mine, id);
    const b = cell(theirs, id);
    let edge: CompareRow['edge'] = RANK[a.status] > RANK[b.status] ? 'mine' : RANK[a.status] < RANK[b.status] ? 'theirs' : 'equal';
    if (edge === 'equal' && id === 'response_time' && mine.readiness && theirs.readiness) {
      const ma = mine.readiness.elapsedMs;
      const mb = theirs.readiness.elapsedMs;
      if (Math.abs(ma - mb) > 300) edge = ma < mb ? 'mine' : 'theirs';
    }
    if (edge === 'equal' && id === 'citability' && mine.citability && theirs.citability && Math.abs(mine.citability.score - theirs.citability.score) >= 10)
      edge = mine.citability.score > theirs.citability.score ? 'mine' : 'theirs';
    return { id, label, mine: { status: a.status, detail: a.detail }, theirs: { status: b.status, detail: b.detail }, edge };
  });
  // Écarts à combler : là où le concurrent fait mieux (hors information), sinon vos points faibles.
  const fixFor = (id: string): string => {
    if (id === 'citability') return mine.citability?.fixes[0]?.fix ?? 'Structurez la page en questions-réponses avec des faits précis.';
    return mine.readiness?.checks.find((c) => c.id === id)?.fix || '';
  };
  const behind = rows.filter((r) => r.edge === 'theirs' && r.id !== 'llms_txt').map((r) => ({ id: r.id, label: r.label, fix: fixFor(r.id) })).filter((g) => g.fix);
  const weak = (mine.readiness?.fixes ?? []).filter((f) => !behind.some((b) => b.id === f.id)).map((f) => ({ id: f.id, label: f.label, fix: f.fix }));
  return {
    mine: { url: mine.url, readiness: mine.readiness?.score ?? null, citability: mine.citability?.score ?? null, ...(mine.error ? { error: mine.error } : {}) },
    theirs: { url: theirs.url, readiness: theirs.readiness?.score ?? null, citability: theirs.citability?.score ?? null, ...(theirs.error ? { error: theirs.error } : {}) },
    rows,
    gaps: [...behind, ...weak].slice(0, 3),
    disclaimer: COMPARE_DISCLAIMER,
  };
}

async function side(url: string, opts: SafeFetchOptions, budgetMs: number): Promise<Side> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = auditPage(url, opts).then(({ readiness, html, finalUrl }) => ({ url, readiness, citability: citabilityFromHtml(html, { url: finalUrl }) }));
    const timeout = new Promise<never>((_, rej) => (timer = setTimeout(() => rej(new SafeFetchError('timeout')), budgetMs)));
    return await Promise.race([run, timeout]);
  } catch (e) {
    return { url, readiness: null, citability: null, error: e instanceof SafeFetchError ? e.publicMessage : 'Analyse impossible.' };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Compare deux URL en parallèle (budget global 15 s). Une adresse refusée (SSRF) lève une erreur. */
export async function compareSites(url: string, competitorUrl: string, opts: SafeFetchOptions & { budgetMs?: number } = {}): Promise<CompareReport> {
  const budget = Math.min(opts.budgetMs ?? COMPARE_BUDGET_MS, COMPARE_BUDGET_MS);
  normalizeInputUrl(url); // adresse invalide ou manifestement privée : erreur immédiate
  normalizeInputUrl(competitorUrl);
  const [a, b] = await Promise.all([side(url, opts, budget), side(competitorUrl, opts, budget)]);
  return compareSides(a, b);
}
