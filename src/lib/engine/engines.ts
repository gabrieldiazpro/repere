/**
 * V8 : fiche de mesure par IA (`AuditResult.engines`) — ce qui diffère d'une IA à l'autre, exposé honnêtement :
 * API officielle ou page de résultats, modèle, date, recherche web, pays / langue / appareil, échantillons,
 * taux d'affichage (aperçus IA), taux de mention et sa marge (Wilson à 90 %, mêmes réponses que le score).
 */
import { providerMethod, methodNote } from './providers/methods';
import { isBrandQuery } from './queries-v2';
import { validMentions, wilson } from './scoring';
import { PROVIDER_LABELS, type AuditResult, type EngineMeasure } from './types';

type Src = Pick<AuditResult, 'answers' | 'mentions' | 'queries' | 'providersUsed' | 'measuredAt' | 'details'>;

const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function buildEngineMeasures(r: Src): EngineMeasure[] {
  const qById = new Map(r.queries.map((q) => [q.id, q]));
  const reco = (id: string) => !isBrandQuery(qById.get(id) ?? { id });
  const ids = [...new Set([...(r.providersUsed ?? []), ...r.answers.map((a) => a.provider)])];
  const valid = validMentions(r.answers, r.mentions);
  return ids.map((p) => {
    const as = r.answers.filter((a) => a.provider === p && reco(a.queryId));
    const ok = as.filter((a) => !a.error);
    const vm = valid.filter((m) => m.provider === p && reco(m.queryId));
    const k = vm.filter((m) => m.mentioned).length;
    const n = vm.length;
    const [lo, hi] = n ? wilson(k, n) : [0, 0];
    const runs = new Map<string, number>();
    for (const a of as) runs.set(a.queryId, Math.max(runs.get(a.queryId) ?? 0, a.run));
    const m = providerMethod(p);
    const demo = as.length > 0 && as.every((a) => a.demo);
    const model = r.details?.models?.[p] ?? as.find((a) => a.model)?.model ?? '';
    const times = ok.map((a) => a.at).filter((x): x is string => !!x).sort();
    const serpLike = m.via === 'serp';
    const shown = ok.filter((a) => !a.absent).length;
    const out: EngineMeasure = {
      provider: p,
      label: PROVIDER_LABELS[p] ?? p,
      via: m.via,
      vendor: m.vendor,
      model,
      measuredAt: times[times.length - 1] ?? r.measuredAt,
      webSearch: m.webSearch,
      country: 'FR',
      language: 'fr',
      ...(m.device ? { device: m.device } : {}),
      runsPerQuestion: runs.size ? Math.max(...runs.values()) : 0,
      questions: runs.size,
      answers: ok.length,
      valid: n,
      errors: as.length - ok.length,
      ...(serpLike || ok.some((a) => a.absent) ? { displayed: { shown, total: ok.length } } : {}),
      mentionRate: n ? r3(k / n) : null,
      mentionLow: n ? r3(lo) : null,
      mentionHigh: n ? r3(hi) : null,
      marginPts: n ? Math.round(((hi - lo) / 2) * 1000) / 10 : null,
      demo,
      note: methodNote(p, { model: model && model !== 'demo-mock' ? model : undefined, demo }),
    };
    return out;
  });
}
