/**
 * Synthèse : 3 scores (SEO, GEO, global), 5 priorités mélangées SEO + GEO (impact × effort), corrections
 * automatiques disponibles, verdict en une phrase et comparaison avant / après. Fonctions pures.
 */
import type { Finding, Severity } from '@/lib/crawl/types';
import type { AiCheckSummary, AnalysisComparison, FullAnalysis, ModuleReport, PriorityItem } from './types';

const SEV_RANK: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

export function allFindings(r: ModuleReport | null | undefined): Finding[] {
  if (!r) return [];
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of [...(r.topFixes ?? []), ...(r.sections ?? []).flatMap((s) => s.findings ?? [])]) {
    if (!f || seen.has(f.id)) continue;
    seen.add(f.id);
    out.push(f);
  }
  return out;
}

/** Priorité = impact × (4 − effort) : un correctif fort et facile (3 × 3 = 9) passe avant un fort et lourd (3 × 1). */
export function priorityOf(f: Pick<Finding, 'impact' | 'effort'>): number {
  return f.impact * (4 - f.effort);
}

/**
 * Les `n` priorités, SEO et GEO mélangées : tri par priorité, puis gravité, puis nombre de pages touchées.
 * Les constats « info » sont exclus. Alternance garantie : si les deux modules ont des constats, aucun ne prend
 * plus de n − 1 places.
 */
export function mergePriorities(seo: ModuleReport | null, geo: ModuleReport | null, n = 5): PriorityItem[] {
  const pool: PriorityItem[] = [
    ...allFindings(seo).map((f) => ({ ...f, source: 'seo' as const, priority: priorityOf(f) })),
    ...allFindings(geo).map((f) => ({ ...f, source: 'geo' as const, priority: priorityOf(f) })),
  ].filter((f) => f.severity !== 'info');
  pool.sort(
    (a, b) =>
      b.priority - a.priority ||
      SEV_RANK[b.severity] - SEV_RANK[a.severity] ||
      b.affectedCount - a.affectedCount ||
      a.id.localeCompare(b.id),
  );
  const out = pool.slice(0, n);
  const hasSeo = pool.some((f) => f.source === 'seo');
  const hasGeo = pool.some((f) => f.source === 'geo');
  if (hasSeo && hasGeo && n > 1) {
    for (const missing of ['seo', 'geo'] as const) {
      if (!out.some((f) => f.source === missing)) {
        const best = pool.find((f) => f.source === missing)!;
        out[out.length - 1] = best;
        out.sort((a, b) => b.priority - a.priority || SEV_RANK[b.severity] - SEV_RANK[a.severity]);
      }
    }
  }
  return out;
}

export function autoFixesOf(seo: ModuleReport | null, geo: ModuleReport | null): FullAnalysis['autoFixes'] {
  const out: FullAnalysis['autoFixes'] = [];
  for (const [src, r] of [['seo', seo], ['geo', geo]] as const)
    for (const f of allFindings(r)) if (f.autoFix?.kind) out.push({ findingId: f.id, kind: f.autoFix.kind, title: f.title, source: src });
  return out;
}

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

/**
 * Global = 50 % SEO + 50 % GEO ; le contrôle IA rapide (s'il est réel, pas démo) pèse 20 % du GEO :
 * c'est une mesure sur peu de questions, sa marge d'erreur est large.
 */
export function computeScores(seo: ModuleReport | null, geo: ModuleReport | null, ai?: AiCheckSummary | null): FullAnalysis['scores'] {
  const s = seo ? clamp(seo.score) : null;
  let g = geo ? clamp(geo.score) : null;
  if (g !== null && ai && !ai.demo && ai.calls > 0) g = clamp(g * 0.8 + ai.score * 0.2);
  const parts = [s, g].filter((x): x is number => x !== null);
  return { seo: s, geo: g, global: parts.length ? clamp(parts.reduce((a, b) => a + b, 0) / parts.length) : null };
}

function band(score: number): string {
  if (score >= 75) return 'solide';
  if (score >= 50) return 'correct mais perfectible';
  if (score >= 30) return 'fragile';
  return 'très insuffisant';
}

/** Verdict en une phrase, sans promesse de résultat. */
export function buildVerdict(a: Pick<FullAnalysis, 'scores' | 'priorities' | 'detected' | 'ai' | 'partial' | 'crawl'>): string {
  const { seo, geo, global } = a.scores;
  const name = a.detected.brand;
  if (global === null) return `Nous n'avons pas pu analyser le site de ${name} : la page d'accueil n'a pas répondu à notre robot.`;
  const first = a.priorities[0];
  const weakest = seo !== null && geo !== null ? (seo <= geo ? 'Google' : 'les IA') : null;
  const ai =
    a.ai && !a.ai.demo && a.ai.calls > 0
      ? a.ai.mentionRate > 0
        ? `, cité dans ${Math.round(a.ai.mentionRate * 100)} % des réponses d'IA testées`
        : ', absent des réponses d’IA testées'
      : '';
  const lead = `${name} : un socle ${band(global)} (${global}/100${weakest ? `, plus faible côté ${weakest}` : ''})${ai}`;
  const tail = first ? ` ; premier chantier (${first.source === 'seo' ? 'Google' : 'IA'}) : ${lowerFirst(first.title)}.` : '.';
  return `${lead}${tail}${a.partial ? ' (Analyse partielle : un module n’a pas pu aboutir.)' : ''}`;
}

function lowerFirst(s: string): string {
  const t = s.replace(/[.\s]+$/, '');
  return /^[A-ZÉÈ][a-zéèàù]/.test(t) ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

/** Avant / après : scores et constats disparus / apparus (même domaine). */
export function compareAnalyses(prev: FullAnalysis, next: Pick<FullAnalysis, 'seo' | 'geo' | 'scores'>): AnalysisComparison {
  const ids = (x: Pick<FullAnalysis, 'seo' | 'geo'>) =>
    new Set([...allFindings(x.seo), ...allFindings(x.geo)].filter((f) => f.severity !== 'info').map((f) => f.id));
  const before = ids(prev);
  const after = ids(next);
  const d = (a: number | null, b: number | null) => (a === null || b === null ? null : b - a);
  return {
    previousId: prev.id,
    previousAt: prev.createdAt,
    scores: { seo: d(prev.scores.seo, next.scores.seo), geo: d(prev.scores.geo, next.scores.geo), global: d(prev.scores.global, next.scores.global) },
    fixed: [...before].filter((x) => !after.has(x)).sort(),
    appeared: [...after].filter((x) => !before.has(x)).sort(),
  };
}
