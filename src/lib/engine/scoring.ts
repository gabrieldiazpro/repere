/**
 * Score /100 (méthode 03 § 5–6) : Score = round(100 × (0,45·M + 0,20·R + 0,20·V + 0,15·C)),
 * fourchette par bootstrap sur les requêtes (graine = id d'audit), agreement entre exécutions, confiance.
 */
import { NO_REC_SNIPPET, normName, norm } from './detect';
import {
  ALL_PROVIDERS,
  CORE_PROVIDERS,
  type AuditResult,
  type CompetitorStat,
  type MentionResult,
  type ProviderAnswer,
  type ProviderId,
  type ScoreDetails,
} from './types';
import { groupBy, seededRandom } from './util';

export const METHOD_VERSION = 'repere-score-v1.0' as const;
export const W = { M: 0.45, R: 0.2, V: 0.2, C: 0.15 } as const;
export const SOV_TARGET = 0.25;
export const COVER_MIN = 0.125;
export const BOOTSTRAP_B = 500;

export interface Components {
  M: number;
  R: number;
  V: number;
  C: number;
  k: number;
  n: number;
  avgRank: number | null;
  sov: number;
  competitors: CompetitorStat[];
}

export type Scored = Pick<
  AuditResult,
  'score' | 'subScores' | 'mentionRate' | 'avgRank' | 'shareOfVoice' | 'competitors' | 'confidence' | 'range' | 'agreement'
> & { details: ScoreDetails; validCount: number };

export function isNoRec(m: MentionResult): boolean {
  return !!m.noRec || m.snippet === NO_REC_SNIPPET;
}

const key = (x: { provider: string; queryId: string; run: number }) => `${x.provider}|${x.queryId}|${x.run}`;

/**
 * Réponses valides : ni erreur, ni noRec, ni démo — sauf en mode démo intégral (aucune réponse réelle),
 * où les réponses démo sont scorées pour produire un rapport d'exemple cohérent.
 */
export function validMentions(answers: ProviderAnswer[], mentions: MentionResult[]): MentionResult[] {
  const byKey = new Map(answers.map((a) => [key(a), a]));
  const allDemo = !answers.some((a) => !a.demo && !a.error);
  return mentions.filter((m) => {
    const a = byKey.get(key(m));
    if (!a || a.error) return false;
    if (a.demo && !allDemo) return false;
    return !isNoRec(m);
  });
}

/**
 * « Cité dans X réponses sur N » : mêmes réponses que le score (hors erreurs et « pas de recommandation »),
 * donc X/N = mentionRate. À utiliser partout (rapport, PDF, e-mails) pour des chiffres identiques.
 */
export function citationStats(r: Pick<AuditResult, 'answers' | 'mentions'>): { cited: number; total: number } {
  const ms = r.answers?.length ? validMentions(r.answers, r.mentions) : r.mentions.filter((m) => !isNoRec(m));
  return { cited: ms.filter((m) => m.mentioned).length, total: ms.length };
}

/** Qualité de rang q(r) = max(0, 1 − (r−1)/5). */
export function rankQuality(r: number): number {
  return Math.max(0, 1 - (r - 1) / 5);
}

export function components(ms: MentionResult[], used: ProviderId[]): Components {
  const n = ms.length;
  const hits = ms.filter((m) => m.mentioned);
  const k = hits.length;
  const M = n ? k / n : 0;
  const ranks = hits.map((m) => m.rank).filter((r): r is number => r != null && r > 0);
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  const q = ranks.length ? ranks.map(rankQuality).reduce((a, b) => a + b, 0) / ranks.length : 0;
  const R = k ? q * (k / (k + 2)) : 0;

  const counts = new Map<string, { name: string; n: number }>();
  for (const m of ms) {
    const seen = new Set<string>();
    for (const c of m.competitors) {
      const ck = normName(c) || norm(c);
      if (!ck || seen.has(ck)) continue;
      seen.add(ck);
      const prev = counts.get(ck);
      counts.set(ck, { name: prev?.name ?? c, n: (prev?.n ?? 0) + 1 });
    }
  }
  let compTotal = 0;
  for (const c of counts.values()) compTotal += c.n;
  const total = k + compTotal;
  const sov = total ? k / total : 0;
  const V = Math.min(1, sov / SOV_TARGET);

  const C = used.length
    ? used.filter((p) => {
        const mp = ms.filter((m) => m.provider === p);
        return mp.length > 0 && mp.filter((m) => m.mentioned).length / mp.length >= COVER_MIN;
      }).length / used.length
    : 0;

  const competitors: CompetitorStat[] = [...counts.values()]
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((c) => ({ name: c.name, mentions: c.n, share: total ? c.n / total : 0 }));
  return { M, R, V, C, k, n, avgRank, sov, competitors };
}

export function formula(c: Pick<Components, 'M' | 'R' | 'V' | 'C'>): number {
  return 100 * (W.M * c.M + W.R * c.R + W.V * c.V + W.C * c.C);
}

/** agreement : part des couples (requête, IA) à ≥ 2 exécutions dont `mentioned` est identique partout. */
export function runAgreement(ms: MentionResult[]): number {
  const groups = groupBy(ms, (m) => `${m.provider}|${m.queryId}`);
  const multi = [...groups.values()].filter((g) => g.length >= 2);
  if (!multi.length) return 0;
  return multi.filter((g) => g.every((m) => m.mentioned === g[0].mentioned)).length / multi.length;
}

export function wilson(k: number, n: number, z = 1.645): [number, number] {
  if (!n) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - r) / d), Math.min(1, (c + r) / d)];
}

/** Échantillons bootstrap des 3 indicateurs (mêmes tirages : score, taux de mention, part de voix). */
export interface BootstrapSamples {
  score: number[];
  mentionRate: number[];
  shareOfVoice: number[];
  questions: number;
}

/**
 * Bootstrap par requête : rééchantillonne les requêtes avec remise (graine = id d'audit), B tirages.
 * Source unique des marges d'erreur (fourchette du score, `margins`).
 */
export function bootstrapSamples(valid: MentionResult[], used: ProviderId[], seed: string, B = BOOTSTRAP_B): BootstrapSamples | null {
  const qIds = [...new Set(valid.map((m) => m.queryId))].sort();
  if (!qIds.length) return null;
  const byQ = groupBy(valid, (m) => m.queryId);
  const rnd = seededRandom(`bootstrap|${seed}`);
  const out: BootstrapSamples = { score: [], mentionRate: [], shareOfVoice: [], questions: qIds.length };
  for (let b = 0; b < B; b++) {
    const res: MentionResult[] = [];
    for (let i = 0; i < qIds.length; i++) res.push(...(byQ.get(qIds[Math.floor(rnd() * qIds.length)]) ?? []));
    const c = components(res, used);
    out.score.push(formula(c));
    out.mentionRate.push(c.M);
    out.shareOfVoice.push(c.sov);
  }
  return out;
}

/** Percentiles P5 / P95 d'un échantillon (non trié). */
export function p5p95(xs: number[]): [number, number] {
  const s = [...xs].sort((a, b) => a - b);
  const B = s.length;
  return [s[Math.floor(0.05 * B)], s[Math.min(B - 1, Math.floor(0.95 * B))]];
}

/** Bootstrap par requête : rééchantillonne les requêtes avec remise ; renvoie [P5, P95]. */
export function bootstrapRange(
  valid: MentionResult[],
  used: ProviderId[],
  seed: string,
  B = BOOTSTRAP_B,
): { low: number; high: number } | null {
  const bs = bootstrapSamples(valid, used, seed, B);
  if (!bs) return null;
  const [lo, hi] = p5p95(bs.score);
  return { low: Math.round(lo), high: Math.round(hi) };
}

export function computeScore(
  answers: ProviderAnswer[],
  mentions: MentionResult[],
  providers: ProviderId[],
  auditId: string,
  opts: { models?: Partial<Record<ProviderId, string>> } = {},
): Scored {
  const valid = validMentions(answers, mentions);
  const used = providers.filter((p) => valid.some((m) => m.provider === p));

  const core = components(valid, used);
  const score = clamp(Math.round(formula(core)));

  const sub = (p: ProviderId): number | null => {
    const mp = valid.filter((m) => m.provider === p);
    if (!providers.includes(p) || mp.length === 0) return null;
    const c = components(mp, [p]);
    return clamp(Math.round((100 * (W.M * c.M + W.R * c.R + W.V * c.V)) / (W.M + W.R + W.V)));
  };
  // Clés historiques toujours présentes ; Mistral seulement s'il fait partie de l'audit (ajout additif).
  const subScores = Object.fromEntries(CORE_PROVIDERS.map((p) => [p, sub(p)])) as Scored['subScores'];
  for (const p of ALL_PROVIDERS) if (!(CORE_PROVIDERS as string[]).includes(p) && providers.includes(p)) (subScores as Record<string, number | null>)[p] = sub(p);

  const boot = bootstrapRange(valid, used, auditId);
  const lo = boot ? Math.min(boot.low, score) : score;
  const hi = boot ? Math.max(boot.high, score) : score;

  const agreement = runAgreement(valid);
  const n = valid.length;
  const hw = (hi - lo) / 2;
  const badShare = answers.length ? 1 - n / answers.length : 1;
  const hasDemo = answers.some((a) => a.demo);
  const confidence: AuditResult['confidence'] =
    hasDemo || used.length < 2
      ? 'faible'
      : n >= 40 && hw <= 8 && agreement >= 0.75 && badShare <= 0.1
        ? 'bonne'
        : n >= 20 && hw <= 15 && agreement >= 0.5
          ? 'moyenne'
          : 'faible';

  const [wLo, wHi] = wilson(core.k, n);
  const answered = new Set(answers.filter((a) => !a.error).map(key));
  return {
    score,
    subScores,
    mentionRate: core.M,
    avgRank: core.avgRank,
    shareOfVoice: core.sov,
    competitors: core.competitors,
    confidence,
    range: { low: clamp(lo), high: clamp(hi) },
    agreement,
    validCount: n,
    details: {
      method: METHOD_VERSION,
      scoreLow: clamp(lo),
      scoreHigh: clamp(hi),
      mentionRateLow: wLo,
      mentionRateHigh: wHi,
      components: { M: core.M, R: core.R, V: core.V, C: core.C },
      validAnswers: n,
      agreement,
      excludedNoRec: mentions.filter((m) => isNoRec(m) && answered.has(key(m))).length,
      citedDomainCount: mentions.filter((m) => m.citedDomain && answered.has(key(m))).length,
      models: opts.models ?? {},
    },
  };
}

function clamp(x: number): number {
  return Math.max(0, Math.min(100, x));
}
