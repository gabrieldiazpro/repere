/**
 * Suivi avant / après des pilotes : scores à J0, J30 et J90 tirés des VRAIES mesures de l'espace Repéré.
 *
 * Sources (aucune valeur saisie à la main, aucune estimation) :
 * - analyses du site rattachées à l'espace (collection `analysis.runs`, champ businessId) → notes SEO, GEO, globale ;
 * - audits de visibilité IA de l'espace (src/lib/db listAuditsForBusiness) → score IA et sa fourchette.
 *
 * Règle de rapprochement : pour chaque jalon, la mesure la plus proche de la date cible dans une fenêtre
 * (J0 : de 14 jours avant à 7 jours après le début ; J30 : ± 10 jours ; J90 : ± 15 jours). Sans mesure dans la
 * fenêtre : « à venir » si la fenêtre n'est pas close, sinon « manquante ». Jamais d'interpolation.
 */
import { listDocs } from '@/lib/store';
import { listAuditsForBusiness } from '@/lib/db';
import type { StoredAnalysis } from '@/lib/analysis/store';

const DAY = 86_400_000;

export interface SitePoint {
  at: string;
  seo: number | null;
  geo: number | null;
  global: number | null;
}
export interface AiPoint {
  at: string;
  score: number;
  low: number | null;
  high: number | null;
  demo: boolean;
}

export type MilestoneId = 'j0' | 'j30' | 'j90';
export const MILESTONES: { id: MilestoneId; label: string; day: number; before: number; after: number }[] = [
  { id: 'j0', label: 'J0', day: 0, before: 14, after: 7 },
  { id: 'j30', label: 'J30', day: 30, before: 10, after: 10 },
  { id: 'j90', label: 'J90', day: 90, before: 15, after: 15 },
];

export interface Milestone {
  id: MilestoneId;
  label: string;
  target: string;
  site: SitePoint | null;
  ai: AiPoint | null;
  state: 'mesure' | 'a_venir' | 'manquante';
}

export interface PilotTracking {
  milestones: Milestone[];
  /** Écart J0 → dernier jalon mesuré (seulement entre deux vraies mesures). */
  delta: { from: MilestoneId; to: MilestoneId; global: number | null; ai: number | null; /** vrai si les fourchettes IA ne se recouvrent pas */ aiBeyondMargin: boolean | null } | null;
  siteCount: number;
  aiCount: number;
}

function closest<T extends { at: string }>(points: T[], target: number, before: number, after: number): T | null {
  let best: T | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    const t = Date.parse(p.at);
    if (!Number.isFinite(t)) continue;
    if (t < target - before * DAY || t > target + after * DAY) continue;
    const gap = Math.abs(t - target);
    if (gap < bestGap) {
      best = p;
      bestGap = gap;
    }
  }
  return best;
}

/** Calcule les jalons à partir des mesures. Pur. */
export function computeTracking(startedAt: string, site: SitePoint[], ai: AiPoint[], now: Date = new Date()): PilotTracking {
  const start = Date.parse(startedAt);
  const milestones: Milestone[] = MILESTONES.map((m) => {
    const target = start + m.day * DAY;
    const s = closest(site, target, m.before, m.after);
    const a = closest(ai, target, m.before, m.after);
    const windowOpen = now.getTime() <= target + m.after * DAY;
    return {
      id: m.id,
      label: m.label,
      target: new Date(target).toISOString(),
      site: s,
      ai: a,
      state: s || a ? 'mesure' : windowOpen ? 'a_venir' : 'manquante',
    };
  });
  const j0 = milestones[0];
  const last = [...milestones].reverse().find((m) => m.id !== 'j0' && m.state === 'mesure');
  const delta =
    j0.state === 'mesure' && last
      ? {
          from: j0.id,
          to: last.id,
          global: j0.site?.global != null && last.site?.global != null ? last.site.global - j0.site.global : null,
          ai: j0.ai && last.ai ? last.ai.score - j0.ai.score : null,
          aiBeyondMargin:
            j0.ai && last.ai && j0.ai.low !== null && j0.ai.high !== null && last.ai.low !== null && last.ai.high !== null
              ? last.ai.low > j0.ai.high || last.ai.high < j0.ai.low
              : null,
        }
      : null;
  return { milestones, delta, siteCount: site.length, aiCount: ai.length };
}

/** Lit les mesures réelles d'un espace. */
export async function loadMeasures(businessId: string): Promise<{ site: SitePoint[]; ai: AiPoint[] }> {
  const [runs, audits] = await Promise.all([
    listDocs<StoredAnalysis>('analysis.runs', { businessId, limit: 200, order: 'asc' }).catch(() => []),
    listAuditsForBusiness(businessId).catch(() => []),
  ]);
  const site: SitePoint[] = runs
    .filter((d) => d.data?.analysis?.scores && !d.data.analysis.partial)
    .map((d) => ({ at: d.data.analysis.createdAt, seo: d.data.analysis.scores.seo, geo: d.data.analysis.scores.geo, global: d.data.analysis.scores.global }));
  const ai: AiPoint[] = audits.map((a) => ({
    at: a.measuredAt || a.createdAt,
    score: a.score,
    low: a.range?.low ?? null,
    high: a.range?.high ?? null,
    demo: a.demo === true,
  }));
  return { site, ai };
}

export async function trackingFor(businessId: string | null, startedAt: string | null, now: Date = new Date()): Promise<PilotTracking | null> {
  if (!businessId || !startedAt) return null;
  const { site, ai } = await loadMeasures(businessId);
  return computeTracking(startedAt, site, ai, now);
}
