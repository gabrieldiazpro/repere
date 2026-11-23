/**
 * Moteur de scénarios (SCENARIOS, V9). Pur et synchrone : aucune écriture, aucun réseau.
 *
 *   const base = auditor(crawl);                                   // = scores réels de la dernière exploration
 *   const cands = rankCandidates(crawl, auditor, base);            // constats + effet de chacun, seul
 *   const s = simulate(crawl, auditor, base, ['seo:seo.title.missing', …]);
 *   const list = buildScenarios(crawl, auditor, base, cands);      // 3 corrections, Repéré seul, 30 minutes
 *
 * Exactitude : `auditor` est la fonction d'audit de l'app (auditBoth) ; les corrections sont appliquées à une copie
 * de l'exploration (apply.ts) puis TOUT l'audit est relancé. Aucune formule parallèle, aucun coefficient estimé.
 */
import type { Finding, SiteCrawl } from '@/lib/crawl/types';
import { expandAutoFix } from '@/lib/publish/autofix';
import { applyFinding, cloneCrawl, unsimulableReason } from './apply';
import type { Auditor, Candidate, Origin, Reports, Scenario, SectionDelta, SimResult, Who } from './types';

export const HONESTY =
  'Ce score mesure l’état de votre site selon nos contrôles. Il ne prédit ni vos positions Google ni vos citations par les IA.';

export const METHOD =
  'Repéré applique les corrections choisies à une copie de votre dernière exploration, puis relance exactement les mêmes contrôles. Les corrections qui ne peuvent pas être rejouées ainsi sont exclues et signalées.';

const SEV_RANK = { critical: 4, high: 3, medium: 2, low: 1, info: 0 } as const;

/** Corrections que l'agent applique telles quelles (après votre validation) : pas de texte rédigé à relire. */
const AUTO_KINDS = new Set(['canonical', 'meta.canonical', 'meta.robots', 'redirect', 'link.update', 'sitemap', 'sitemap.xml', 'robots', 'robots.txt']);

/** Temps estimé de VOTRE côté, en minutes, d'après l'effort du contrôle (1 rapide, 2 moyen, 3 long). */
export const MINUTES: Record<Who, Record<1 | 2 | 3, number>> = {
  auto: { 1: 5, 2: 5, 3: 10 },
  guide: { 1: 10, 2: 20, 3: 30 },
  vous: { 1: 20, 2: 60, 3: 180 },
};

export const WHO_LABEL: Record<Who, string> = {
  auto: 'Repéré automatiquement',
  guide: 'Repéré en guidé',
  vous: 'Vous',
};

export const WHO_HINT: Record<Who, string> = {
  auto: 'L’agent prépare la modification ; vous la validez avant publication.',
  guide: 'L’agent rédige une proposition ; vous la relisez, la modifiez si besoin, puis la validez.',
  vous: 'Une tâche dans votre Centre d’actions, avec la marche à suivre.',
};

export function whoOf(f: Pick<Finding, 'autoFix'>): Who {
  const k = f.autoFix?.kind;
  if (!k) return 'vous';
  if (expandAutoFix(f) === null) return 'vous';
  if (AUTO_KINDS.has(k)) return 'auto';
  if (k === 'jsonld') {
    const p = f.autoFix!.payload as Record<string, unknown> | null;
    const items = Array.isArray(p?.items) ? (p!.items as Record<string, unknown>[]) : [];
    const review = !!(p && (p.notes || p.note || p.merge)) || items.some((i) => i && (i.review || i.notes));
    return review ? 'guide' : 'auto';
  }
  return 'guide';
}

export function minutesOf(f: Pick<Finding, 'autoFix' | 'effort'>): number {
  return MINUTES[whoOf(f)][f.effort] ?? 60;
}

export const keyOf = (origin: Origin, id: string) => `${origin}:${id}`;

interface Located {
  key: string;
  origin: Origin;
  section: string;
  sectionLabel: string;
  f: Finding;
}

/** Tous les constats d'un audit, avec leur section ; premier gardé en cas d'identifiant répété. */
export function locate(r: Reports): Map<string, Located> {
  const out = new Map<string, Located>();
  for (const s of r.seo.sections) {
    if ('applicable' in s && s.applicable === false) continue;
    for (const f of s.findings) {
      const k = keyOf('seo', f.id);
      if (!out.has(k)) out.set(k, { key: k, origin: 'seo', section: s.id, sectionLabel: s.label, f });
    }
  }
  for (const s of r.geo.sections)
    for (const f of s.findings) {
      const k = keyOf('geo', f.id);
      if (!out.has(k)) out.set(k, { key: k, origin: 'geo', section: s.id, sectionLabel: s.label, f });
    }
  return out;
}

function priority(f: Finding): number {
  return (SEV_RANK[f.severity] * f.impact) / f.effort;
}

/** Constats proposables (hors « info »), dans l'ordre de priorité de l'app. */
export function candidatesOf(base: Reports): Candidate[] {
  return [...locate(base).values()]
    .filter((x) => x.f.severity !== 'info')
    .sort((a, b) => priority(b.f) - priority(a.f) || b.f.affectedCount - a.f.affectedCount)
    .map(({ key, origin, section, sectionLabel, f }) => ({
      key,
      origin,
      id: f.id,
      title: f.title,
      fix: f.fix,
      why: f.why,
      section,
      sectionLabel,
      severity: f.severity,
      impact: f.impact,
      effort: f.effort,
      affectedCount: f.affectedCount,
      pages: f.affected.slice(0, 5).map((a) => a.url),
      who: whoOf(f),
      minutes: minutesOf(f),
      ...(f.autoFix?.kind ? { autoFixKind: f.autoFix.kind } : {}),
      unsimulable: unsimulableReason(f),
    }));
}

/** Scores de section affichés : SEO applicables, GEO mesurées et comptées dans le score. */
function sectionScores(r: Reports): SectionDelta[] {
  const out: SectionDelta[] = [];
  for (const s of r.seo.sections) if (s.applicable) out.push({ origin: 'seo', id: s.id, label: s.label, before: s.score, after: s.score });
  for (const s of r.geo.sections) if (s.measured && s.weight > 0) out.push({ origin: 'geo', id: s.id, label: s.label, before: s.score, after: s.score });
  return out;
}

/** Ordre d'application : éditions de pages, liens, puis fichiers du site, redirections en dernier. */
const ORDER: Record<string, number> = { 'link.update': 1, robots: 2, 'robots.txt': 2, sitemap: 3, 'sitemap.xml': 3, redirect: 4 };

/**
 * Simule un ensemble de corrections. `base` = audit de `crawl` par `auditor` (fourni pour ne pas le recalculer).
 * Avec 0 correction, l'exploration est quand même rejouée : le score « après » est alors celui de `auditor(crawl)`.
 */
export function simulate(crawl: SiteCrawl, auditor: Auditor, base: Reports, selection: string[]): SimResult & { reports: Reports } {
  const found = locate(base);
  const keys = [...new Set(selection)].filter((k) => found.has(k));
  const chosen = keys.map((k) => found.get(k)!).sort((a, b) => (ORDER[a.f.autoFix?.kind ?? ''] ?? 0) - (ORDER[b.f.autoFix?.kind ?? ''] ?? 0));
  const copy = cloneCrawl(crawl);
  const applied: SimResult['applied'] = [];
  const excluded: SimResult['excluded'] = [];
  for (const x of chosen) {
    const r = applyFinding(copy, x.f);
    if (r.ok) applied.push({ key: x.key, title: x.f.title, items: r.applied, notes: r.notes, skipped: r.skipped.slice(0, 5) });
    else excluded.push({ key: x.key, title: x.f.title, reason: r.reason ?? 'Non simulable.', who: whoOf(x.f) });
  }
  const after = auditor(copy);
  const afterFound = locate(after);

  const beforeSec = sectionScores(base);
  const afterSec = new Map(sectionScores(after).map((s) => [`${s.origin}:${s.id}`, s.before]));
  const sections = beforeSec.map((s) => ({ ...s, after: afterSec.get(`${s.origin}:${s.id}`) ?? s.before }));

  const resolved: string[] = [];
  const remaining: SimResult['remaining'] = [];
  for (const a of applied) {
    const now = afterFound.get(a.key);
    const was = found.get(a.key)!.f.affectedCount;
    if (!now) resolved.push(a.key);
    else remaining.push({ key: a.key, title: a.title, before: was, after: now.f.affectedCount });
  }
  const appeared: SimResult['appeared'] = [];
  for (const [k, x] of afterFound) {
    if (x.f.severity === 'info') continue;
    const old = found.get(k);
    if (!old || x.f.affectedCount > old.f.affectedCount || SEV_RANK[x.f.severity] > SEV_RANK[old.f.severity]) appeared.push({ key: k, title: x.f.title });
  }

  const pages = new Set<string>();
  const who: Record<Who, number> = { auto: 0, guide: 0, vous: 0 };
  let minutes = 0;
  for (const x of chosen) {
    for (const a of x.f.affected) pages.add(a.url);
    const w = whoOf(x.f);
    who[w]++;
    minutes += minutesOf(x.f);
  }

  return {
    selection: keys,
    applied,
    excluded,
    before: { seo: base.seo.score, geo: base.geo.score },
    after: { seo: after.seo.score, geo: after.geo.score },
    sections,
    resolved,
    remaining,
    appeared,
    pages: pages.size,
    minutes,
    who,
    reports: after,
  };
}

/** Retire les rapports complets (lourds) d'un résultat avant de l'envoyer à l'écran. */
export function lean(r: SimResult & { reports?: Reports }): SimResult {
  const { reports: _r, ...rest } = r;
  void _r;
  return rest;
}

/** Nombre maximal de constats dont l'effet seul est mesuré (une relance d'audit chacun). */
export const MAX_ALONE = 24;

/** Effet de chaque correction prise seule (mêmes contrôles), pour classer et pour l'affichage. */
export function rankCandidates(crawl: SiteCrawl, auditor: Auditor, base: Reports, cands = candidatesOf(base), max = MAX_ALONE): Candidate[] {
  let n = 0;
  return cands.map((c) => {
    if (c.unsimulable || n >= max) return { ...c, alone: c.unsimulable ? null : undefined };
    n++;
    const r = simulate(crawl, auditor, base, [c.key]);
    if (!r.applied.length) return { ...c, unsimulable: r.excluded[0]?.reason ?? 'Non simulable.', alone: null };
    const sections = r.sections.reduce((s, x) => s + (x.after - x.before), 0);
    return { ...c, alone: { seo: r.after.seo - r.before.seo, geo: r.after.geo - r.before.geo, sections } };
  });
}

/** Gain mesuré d'une correction seule (scores globaux d'abord, sections ensuite pour départager). */
export function gainOf(c: Candidate): number {
  if (!c.alone) return 0;
  return (c.alone.seo + c.alone.geo) * 10 + c.alone.sections / 10;
}

export interface ScenarioOptions {
  /** budget du scénario « 30 minutes » */
  budgetMinutes?: number;
}

/** Les scénarios proposés, calculés par `simulate`. */
export function buildScenarios(crawl: SiteCrawl, auditor: Auditor, base: Reports, ranked: Candidate[], opts: ScenarioOptions = {}): Scenario[] {
  const budget = opts.budgetMinutes ?? 30;
  const measured = ranked.filter((c) => c.alone && gainOf(c) > 0);
  const byRatio = [...measured].sort((a, b) => gainOf(b) / b.minutes - gainOf(a) / a.minutes || gainOf(b) - gainOf(a));

  const top3 = [...measured].sort((a, b) => gainOf(b) / Math.sqrt(b.minutes) - gainOf(a) / Math.sqrt(a.minutes) || b.impact - a.impact).slice(0, 3).map((c) => c.key);
  const repere = ranked.filter((c) => !c.unsimulable && c.who !== 'vous').map((c) => c.key);
  const thirty: string[] = [];
  let used = 0;
  for (const c of byRatio) {
    if (used + c.minutes > budget) continue;
    thirty.push(c.key);
    used += c.minutes;
  }

  const make = (id: Scenario['id'], title: string, lead: string, keys: string[]): Scenario => ({ id, title, lead, keys, result: lean(simulate(crawl, auditor, base, keys)) });
  return [
    make('rentables', 'Les 3 corrections les plus rentables', 'Les trois corrections qui font le plus progresser vos contrôles pour le temps qu’elles vous demandent.', top3),
    make('repere', 'Tout ce que Repéré peut faire seul', 'Les corrections que l’agent prépare pour vous ; vous relisez et validez avant toute publication.', repere),
    make('trente', `${budget} minutes de travail`, `Le plus d’effet mesuré possible dans ${budget} minutes estimées de votre côté.`, thirty),
  ];
}
