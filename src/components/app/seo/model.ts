// Calculs purs de la partie SEO de l'app (APP-SEO) : testables sans serveur.
import type { SiteCrawl, Finding, Severity } from '@/lib/crawl/types';
import type { SeoReport } from '@/lib/seoaudit/types';
import type { GeoReport } from '@/lib/geo';
import type { Rating } from '@/lib/seodata/types';

/** Ligne de page conservée avec chaque exploration (sans HTML). */
export interface PageRow {
  url: string;
  status: number;
  depth: number;
  title: string | null;
  indexable: boolean;
  inlinks: number;
  outlinks: number;
  words: number;
  bytes: number;
  fetchMs: number;
  images: number;
  imagesNoDim: number;
  imagesNoAlt: number;
  scripts: number;
  template: string;
  inSitemap: boolean;
  clientRendered: boolean;
}

export interface SeoRun {
  id: string;
  businessId: string;
  at: string;
  demo: boolean;
  url: string;
  pagesCrawled: number;
  truncated: boolean;
  durationMs: number;
  seo: SeoReport;
  geo: GeoReport;
  pages: PageRow[];
  trigger: 'demo' | 'manual' | 'scheduled';
}

// ---------------------------------------------------------------------------
// Droits d'exploration par offre : table unique dans src/lib/recrawl-rights.ts (reprise par entitlements.ts, `recrawl`)
// ---------------------------------------------------------------------------

export { CRAWL_RIGHTS, crawlRights, type CrawlRights } from '@/lib/recrawl-rights';
import type { CrawlRights } from '@/lib/recrawl-rights';

/** Prochaine exploration possible (null = maintenant). */
export function nextCrawlAllowed(rights: CrawlRights, manualRunsAt: string[], now = new Date()): Date | null {
  if (rights.perPeriod <= 0) return new Date(8.64e15);
  const from = now.getTime() - rights.periodDays * 86_400_000;
  const inWindow = manualRunsAt.map((a) => Date.parse(a)).filter((t) => t > from).sort((a, b) => a - b);
  if (inWindow.length < rights.perPeriod) return null;
  return new Date(inWindow[inWindow.length - rights.perPeriod] + rights.periodDays * 86_400_000);
}

// ---------------------------------------------------------------------------
// Résumé d'exploration
// ---------------------------------------------------------------------------

const norm = (u: string) => {
  try {
    const x = new URL(u);
    x.hash = '';
    return x.toString().replace(/\/$/, '');
  } catch {
    return u;
  }
};

/** Modèle de page : premier segment de chemin (« /produits/x » → « produits »), accueil à part. */
export function templateOf(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean);
    if (!seg.length) return u.search ? 'accueil (paramètres)' : 'accueil';
    if (seg.length === 1) return u.search ? `${seg[0]} (paramètres)` : 'pages principales';
    return seg[0];
  } catch {
    return 'autre';
  }
}

export function summarizeCrawl(c: SiteCrawl): PageRow[] {
  const inl = new Map<string, number>();
  for (const l of c.links) if (l.internal && l.from !== l.to) inl.set(norm(l.to), (inl.get(norm(l.to)) ?? 0) + 1);
  const sm = new Set(c.sitemapUrls.map(norm));
  return c.pages.slice(0, 2000).map((p) => ({
    url: p.finalUrl || p.url,
    status: p.status,
    depth: p.depth,
    title: p.title ?? null,
    indexable: p.isIndexable,
    inlinks: inl.get(norm(p.finalUrl || p.url)) ?? 0,
    outlinks: p.internalLinks,
    words: p.wordCount,
    bytes: p.bytes,
    fetchMs: p.fetchMs,
    images: p.images.length,
    imagesNoDim: p.images.filter((i) => !i.width || !i.height).length,
    imagesNoAlt: p.images.filter((i) => i.alt === undefined).length,
    scripts: p.renderHints?.scriptsCount ?? 0,
    template: templateOf(p.finalUrl || p.url),
    inSitemap: sm.has(norm(p.finalUrl || p.url)) || sm.has(norm(p.url)),
    clientRendered: Boolean(p.renderHints?.likelyClientRendered),
  }));
}

// ---------------------------------------------------------------------------
// Constats, priorités, évolution
// ---------------------------------------------------------------------------

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Bloquant', high: 'Important', medium: 'Moyen', low: 'Mineur', info: 'Info' };
export const SEVERITY_TONE: Record<Severity, 'down' | 'warn' | 'neutral' | 'brand'> = { critical: 'down', high: 'down', medium: 'warn', low: 'neutral', info: 'neutral' };
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

export type Origin = 'seo' | 'geo';
export interface RankedFix extends Finding {
  origin: Origin;
  section: string;
  sectionLabel: string;
  priority: number;
}

export function allFindings(seo: SeoReport | null, geo: GeoReport | null): RankedFix[] {
  const out: RankedFix[] = [];
  for (const s of seo?.sections ?? []) for (const f of s.findings) out.push({ ...f, origin: 'seo', section: s.id, sectionLabel: s.label, priority: priorityOf(f) });
  for (const s of geo?.sections ?? []) for (const f of s.findings) out.push({ ...f, origin: 'geo', section: s.id, sectionLabel: s.label, priority: priorityOf(f) });
  return out;
}

export function priorityOf(f: Pick<Finding, 'severity' | 'impact' | 'effort'>): number {
  return Math.round(((SEV_RANK[f.severity] * f.impact) / f.effort) * 100) / 100;
}

/** Les N corrections prioritaires, SEO et GEO mélangés (hors « info »). */
export function topFixes(seo: SeoReport | null, geo: GeoReport | null, n = 5): RankedFix[] {
  return allFindings(seo, geo)
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => b.priority - a.priority || b.affectedCount - a.affectedCount)
    .slice(0, n);
}

export function canAutoFix(f: Finding): boolean {
  return Boolean(f.autoFix?.kind);
}

export interface RunDiff {
  resolved: RankedFix[];
  appeared: RankedFix[];
  worse: { f: RankedFix; before: number }[];
  better: { f: RankedFix; before: number }[];
  seoDelta: number | null;
  geoDelta: number | null;
}

export function diffRuns(prev: SeoRun | null, cur: SeoRun | null): RunDiff {
  const empty: RunDiff = { resolved: [], appeared: [], worse: [], better: [], seoDelta: null, geoDelta: null };
  if (!cur || !prev) return empty;
  const key = (f: RankedFix) => `${f.origin}:${f.id}`;
  const a = new Map(allFindings(prev.seo, prev.geo).filter((f) => f.severity !== 'info').map((f) => [key(f), f]));
  const b = new Map(allFindings(cur.seo, cur.geo).filter((f) => f.severity !== 'info').map((f) => [key(f), f]));
  const out: RunDiff = { ...empty, seoDelta: cur.seo.score - prev.seo.score, geoDelta: cur.geo.score - prev.geo.score };
  for (const [k, f] of a) if (!b.has(k)) out.resolved.push(f);
  for (const [k, f] of b) {
    const old = a.get(k);
    if (!old) out.appeared.push(f);
    else if (f.affectedCount > old.affectedCount) out.worse.push({ f, before: old.affectedCount });
    else if (f.affectedCount < old.affectedCount) out.better.push({ f, before: old.affectedCount });
  }
  const bySev = (x: RankedFix, y: RankedFix) => y.priority - x.priority;
  out.resolved.sort(bySev);
  out.appeared.sort(bySev);
  return out;
}

// ---------------------------------------------------------------------------
// Export CSV de l'audit
// ---------------------------------------------------------------------------

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // Neutralise les formules (injection CSV dans un tableur).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV (séparateur « ; », BOM UTF-8 pour Excel) : une ligne par page concernée. */
export function findingsCsv(findings: RankedFix[]): string {
  const head = ['Section', 'Sévérité', 'Constat', 'Page', 'Détail', 'Pourquoi', 'Correction', 'Repéré peut le faire', 'Identifiant'];
  const rows: string[][] = [];
  for (const f of findings) {
    const pages = f.affected.length ? f.affected : [{ url: '', detail: f.evidence }];
    for (const a of pages) rows.push([f.sectionLabel, SEVERITY_LABEL[f.severity], f.title, a.url, a.detail ?? '', f.why, f.fix, canAutoFix(f) ? 'oui' : 'non', f.id]);
  }
  return '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

// ---------------------------------------------------------------------------
// Search Console : opportunités, progression / recul
// ---------------------------------------------------------------------------

export interface QueryRow { key: string; clicks: number; impressions: number; ctr: number; position: number; previousPosition?: number | null }

/** Requêtes en positions 4 à 15 avec des impressions : un petit gain de place rapporte des clics. */
export function opportunities(rows: QueryRow[], minImpressions = 50, n = 10): (QueryRow & { potential: number })[] {
  const ctr = (p: number) => (p <= 1 ? 0.28 : p <= 2 ? 0.15 : p <= 3 ? 0.1 : p <= 5 ? 0.06 : p <= 10 ? 0.025 : 0.01);
  return rows
    .filter((r) => r.position >= 4 && r.position <= 15 && r.impressions >= minImpressions)
    .map((r) => ({ ...r, potential: Math.max(0, Math.round(r.impressions * (ctr(3) - Math.min(ctr(r.position), r.ctr || ctr(r.position))))) }))
    .sort((a, b) => b.potential - a.potential)
    .slice(0, n);
}

/** Variation de position (positif = gain de places). */
export function movers(rows: QueryRow[], n = 5): { up: (QueryRow & { gain: number })[]; down: (QueryRow & { gain: number })[] } {
  const m = rows.filter((r) => r.previousPosition != null && r.impressions > 0).map((r) => ({ ...r, gain: Math.round(((r.previousPosition as number) - r.position) * 10) / 10 }));
  return {
    up: m.filter((r) => r.gain >= 0.5).sort((a, b) => b.gain - a.gain).slice(0, n),
    down: m.filter((r) => r.gain <= -0.5).sort((a, b) => a.gain - b.gain).slice(0, n),
  };
}

// ---------------------------------------------------------------------------
// Performance : explications simples
// ---------------------------------------------------------------------------

export const RATING_LABEL: Record<Rating, string> = { good: 'Bon', 'needs-improvement': 'À améliorer', poor: 'Lent' };
export const RATING_TONE: Record<Rating, 'up' | 'warn' | 'down'> = { good: 'up', 'needs-improvement': 'warn', poor: 'down' };

export const METRIC_EXPLAIN = {
  lcp: { name: 'Affichage du contenu principal', short: 'LCP', plain: 'Temps avant que le plus gros élément (photo, titre) s’affiche. Bon : moins de 2,5 s.' },
  inp: { name: 'Réaction aux clics', short: 'INP', plain: 'Délai entre un appui et la réaction de la page. Bon : moins de 200 ms.' },
  cls: { name: 'Stabilité de la page', short: 'CLS', plain: 'La page saute-t-elle pendant le chargement ? Bon : moins de 0,1.' },
} as const;

export function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1).replace('.', ',')} s` : `${Math.round(ms)} ms`;
}

// ---------------------------------------------------------------------------
// Maillage interne
// ---------------------------------------------------------------------------

export function linkStats(pages: PageRow[]) {
  const ok = pages.filter((p) => p.status === 200);
  const orphans = ok.filter((p) => p.depth === -1);
  const deep = ok.filter((p) => p.depth > 3);
  const byDepth = new Map<number, number>();
  for (const p of ok) if (p.depth >= 0) byDepth.set(p.depth, (byDepth.get(p.depth) ?? 0) + 1);
  const weak = ok.filter((p) => p.depth >= 0 && p.inlinks <= 1 && p.indexable);
  return {
    orphans,
    deep,
    weak,
    depth: [...byDepth.entries()].sort((a, b) => a[0] - b[0]).map(([depth, count]) => ({ depth, count })),
    broken: pages.filter((p) => p.status >= 400),
    maxDepth: Math.max(0, ...ok.map((p) => p.depth)),
  };
}

/** Regroupement par modèle de page (performance tirée de l'exploration). */
export function templates(pages: PageRow[]) {
  const by = new Map<string, PageRow[]>();
  for (const p of pages.filter((x) => x.status === 200)) by.set(p.template, [...(by.get(p.template) ?? []), p]);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);
  return [...by.entries()]
    .map(([template, ps]) => ({
      template,
      count: ps.length,
      sample: ps[0].url,
      fetchMs: avg(ps.map((p) => p.fetchMs)),
      kb: Math.round(avg(ps.map((p) => p.bytes)) / 1024),
      scripts: avg(ps.map((p) => p.scripts)),
      imagesNoDim: ps.reduce((s, p) => s + p.imagesNoDim, 0),
    }))
    .sort((a, b) => b.count - a.count);
}

export const fmtInt = (n: number) => n.toLocaleString('fr-FR');
export const fmtPct = (x: number, d = 1) => `${(x * 100).toFixed(d).replace('.', ',')} %`;
export const fmtPos = (x: number | null | undefined) => (x == null ? '—' : x.toFixed(1).replace('.', ','));
export const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  } catch {
    return url;
  }
};
