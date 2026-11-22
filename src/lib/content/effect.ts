/**
 * Mesure d'effet d'un contenu publié, liée à la page : à la mise en ligne, une photographie de référence (citations
 * des IA sur les questions visées, Search Console sur la requête visée, position du mot-clé suivi) ; à J+30 puis J+90,
 * la même photographie à partir des mesures disponibles à cette date. Pas de causalité affirmée : d'autres facteurs
 * jouent ; l'écart des citations IA est donné avec sa marge d'erreur (nombre de réponses mesurées).
 */
import type { MentionResult } from '@/lib/engine/types';
import type { ContentDraft, DraftEffect, EffectSnapshot } from './types';

export const EFFECT_DAYS = { d30: 30, d90: 90 } as const;

export interface EffectInputs {
  at: string;
  audit?: { measuredAt: string; mentions: MentionResult[] } | null;
  gsc?: { topQueries: { key: string; impressions: number; clicks: number; position: number }[] } | null;
  ranks?: { keyword: string; position: number | null }[] | null;
}

export function snapshot(d: Pick<ContentDraft, 'questionIds' | 'target'>, i: EffectInputs): EffectSnapshot {
  let ai: EffectSnapshot['ai'] = null;
  if (i.audit && d.questionIds.length) {
    const ms = i.audit.mentions.filter((m) => d.questionIds.includes(m.queryId) && !m.noRec);
    if (ms.length) ai = { questionIds: d.questionIds, cited: ms.filter((m) => m.mentioned).length, total: ms.length };
  }
  const t = d.target.toLowerCase().trim();
  const g = i.gsc?.topQueries.find((q) => q.key.toLowerCase().trim() === t);
  const r = i.ranks?.find((k) => k.keyword.toLowerCase().trim() === t);
  return {
    at: i.at,
    ai,
    gsc: g ? { query: g.key, impressions: g.impressions, clicks: g.clicks, position: Math.round(g.position * 10) / 10 } : null,
    rank: r ? { keyword: r.keyword, position: r.position } : null,
  };
}

export function startEffect(d: Pick<ContentDraft, 'questionIds' | 'target'>, i: EffectInputs): DraftEffect {
  return { publishedAt: i.at, baseline: snapshot(d, i) };
}

const days = (from: string, to: Date) => (to.getTime() - new Date(from).getTime()) / 86_400_000;

/** Complète J+30 / J+90 quand l'échéance est passée ET qu'une mesure postérieure existe. */
export function refreshEffect(d: Pick<ContentDraft, 'questionIds' | 'target' | 'effect'>, i: EffectInputs, now: Date): DraftEffect | null {
  const e = d.effect;
  if (!e) return null;
  let changed = false;
  const next: DraftEffect = { ...e };
  for (const [k, n] of Object.entries(EFFECT_DAYS) as ['d30' | 'd90', number][]) {
    if (next[k] || days(e.publishedAt, now) < n) continue;
    const due = new Date(new Date(e.publishedAt).getTime() + n * 86_400_000).toISOString();
    // La mesure IA doit être postérieure à l'échéance, sinon on attend la prochaine.
    const auditOk = !i.audit || i.audit.measuredAt >= due;
    if (!auditOk) continue;
    next[k] = snapshot(d, { ...i, at: now.toISOString() });
    changed = true;
  }
  return changed ? next : null;
}

export interface EffectDelta {
  label: string;
  before: string;
  after: string;
  tone: 'up' | 'down' | 'flat' | 'unknown';
  note?: string;
}

/** Écart lisible entre la référence et une photographie (J+30 ou J+90). */
export function compareEffect(a: EffectSnapshot, b: EffectSnapshot): EffectDelta[] {
  const out: EffectDelta[] = [];
  if (a.ai && b.ai) {
    const ra = a.ai.cited / a.ai.total;
    const rb = b.ai.cited / b.ai.total;
    // Marge d'erreur approximative (95 %) d'une différence de proportions.
    const se = Math.sqrt((ra * (1 - ra)) / a.ai.total + (rb * (1 - rb)) / b.ai.total);
    const margin = Math.round(1.96 * se * 100);
    const diff = Math.round((rb - ra) * 100);
    out.push({
      label: 'Citations par les IA (questions visées)',
      before: `${a.ai.cited}/${a.ai.total} réponses`,
      after: `${b.ai.cited}/${b.ai.total} réponses`,
      tone: Math.abs(diff) <= margin ? 'flat' : diff > 0 ? 'up' : 'down',
      note: `${diff > 0 ? '+' : ''}${diff} points, marge d’erreur ± ${margin} points${Math.abs(diff) <= margin ? ' : écart non significatif' : ''}.`,
    });
  }
  if (a.gsc || b.gsc) {
    out.push({
      label: 'Impressions Google (requête visée, 28 jours)',
      before: a.gsc ? a.gsc.impressions.toLocaleString('fr-FR') : '—',
      after: b.gsc ? b.gsc.impressions.toLocaleString('fr-FR') : '—',
      tone: a.gsc && b.gsc ? (b.gsc.impressions > a.gsc.impressions ? 'up' : b.gsc.impressions < a.gsc.impressions ? 'down' : 'flat') : 'unknown',
    });
  }
  if (a.rank || b.rank) {
    const pa = a.rank?.position ?? null;
    const pb = b.rank?.position ?? null;
    out.push({
      label: 'Position Google (mot-clé suivi)',
      before: pa ? `${pa}e` : 'hors top 100',
      after: pb ? `${pb}e` : 'hors top 100',
      tone: pa && pb ? (pb < pa ? 'up' : pb > pa ? 'down' : 'flat') : pb && !pa ? 'up' : pa && !pb ? 'down' : 'unknown',
    });
  }
  return out;
}
