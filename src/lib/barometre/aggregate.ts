/**
 * Agrégation d'un baromètre : réponses brutes + entreprises extraites → édition mensuelle (classement, marges, sources,
 * évolution). Fonctions pures et déterministes (graine fixe pour le bootstrap).
 *
 * Indicateurs (pour chaque entreprise publiée) :
 *  - taux de citation = réponses valides qui la citent / réponses valides ;
 *  - part de voix = ses citations / toutes les citations d'entreprises (y compris les noms non publiés) ;
 *  - intervalle à 90 % par bootstrap PAR QUESTION (on rééchantillonne les questions avec toutes leurs réponses :
 *    les passages d'une même question ne sont pas indépendants), 500 tirages.
 */
import { classifyDomain, normalizeUrl, isGeminiRedirect } from '../engine/sources/classify';
import { extractInlineUrls } from '../engine/sources';
import type { ProviderId } from '../engine/types';
import { seededRandom } from '../engine/util';
import type { AnswerExtraction } from './extract';
import { coreOf, isGenericName, isVerifiable, looksLikePersonName, mergeNames, nameContext, nameKey, withdrawalKey, type NameObservation } from './names';
import {
  BAROMETRE_METHOD,
  type BarometreDef,
  type BarometreEdition,
  type CompanyStat,
  type RawAnswerRecord,
  type RawRun,
  type SourceStat,
} from './types';

export const BOOTSTRAP_B = 500;
/** Part minimale de réponses valides (sur le plan) pour qu'une édition soit « complète » (publiable). */
export const MIN_COMPLETION = 0.9;
/** Lignes publiées au maximum (le CSV contient toutes les lignes publiées). */
export const MAX_RANKING = 50;

export interface AggregateOptions {
  previous?: BarometreEdition | null;
  /** clés de retrait (withdrawalKey) des entreprises ayant demandé à ne pas figurer */
  withdrawn?: Set<string>;
  now?: string;
  version?: number;
  B?: number;
}

const akey = (a: Pick<RawAnswerRecord, 'provider' | 'questionId' | 'run'>) => `${a.provider}|${a.questionId}|${a.run}`;

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

export function aggregateEdition(def: BarometreDef, raw: RawRun, extractions: Record<string, AnswerExtraction>, opts: AggregateOptions = {}): BarometreEdition {
  const ctx = nameContext(def);
  const answers = Object.values(raw.answers);
  const valid = answers.filter((a) => !a.error && a.text);
  const answersError = answers.filter((a) => a.error).length;
  const planned = raw.questions.length * raw.providers.length * raw.runs;

  // 1. Observations (une par entreprise et par réponse, première position retenue).
  const obs: (NameObservation & { answer: string; provider: ProviderId; question: string; position: number })[] = [];
  for (const a of valid) {
    const ex = extractions[a.key];
    if (!ex) continue;
    const seen = new Set<string>();
    for (const c of ex.companies) {
      const k = nameKey(c.name, ctx);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      obs.push({ name: c.name, domain: c.domain, answer: a.key, provider: a.provider, question: a.questionId, position: c.position });
    }
  }
  const clusters = mergeNames(obs, ctx);

  // 2. Statistiques brutes par entreprise.
  type Agg = { cluster: (typeof clusters)[number]; answers: Map<string, number>; providers: Set<ProviderId>; questions: Set<string> };
  const aggs: Agg[] = clusters
    .filter((c) => !isGenericName(c.key, ctx))
    .map((c) => {
      const ans = new Map<string, number>();
      const providers = new Set<ProviderId>();
      const questions = new Set<string>();
      for (const i of c.members) {
        const o = obs[i];
        ans.set(o.answer, Math.min(ans.get(o.answer) ?? Infinity, o.position));
        providers.add(o.provider);
        questions.add(o.question);
      }
      return { cluster: c, answers: ans, providers, questions };
    });

  const withdrawn = opts.withdrawn ?? new Set<string>();
  let unverifiedCount = 0;
  let withdrawnCount = 0;
  const published: Agg[] = [];
  for (const g of aggs) {
    const isWithdrawn = [g.cluster.label, ...g.cluster.variants].some((v) => withdrawn.has(withdrawalKey(v)));
    if (isWithdrawn) {
      withdrawnCount++;
      continue;
    }
    if (looksLikePersonName(g.cluster.label, ctx) || !isVerifiable({ providers: g.providers.size, answers: g.answers.size, domain: g.cluster.domain })) {
      unverifiedCount++;
      continue;
    }
    published.push(g);
  }

  // 3. Points et intervalles (bootstrap par question).
  const qids = raw.questions.map((q) => q.id);
  const validByQ = new Map<string, number>(qids.map((q) => [q, 0]));
  for (const a of valid) validByQ.set(a.questionId, (validByQ.get(a.questionId) ?? 0) + 1);
  const citesByQ = new Map<string, number>(qids.map((q) => [q, 0]));
  for (const g of aggs) for (const k of g.answers.keys()) {
    const q = k.split('|')[1];
    citesByQ.set(q, (citesByQ.get(q) ?? 0) + 1);
  }
  const compByQ = published.map((g) => {
    const m = new Map<string, number>();
    for (const k of g.answers.keys()) {
      const q = k.split('|')[1];
      m.set(q, (m.get(q) ?? 0) + 1);
    }
    return m;
  });
  const totalValid = valid.length;
  const totalCites = [...citesByQ.values()].reduce((x, y) => x + y, 0);
  const B = opts.B ?? BOOTSTRAP_B;
  const rnd = seededRandom(`barometre|${def.slug}|${raw.period}`);
  const rateSamples: number[][] = published.map(() => []);
  const sovSamples: number[][] = published.map(() => []);
  const activeQ = qids.filter((q) => (validByQ.get(q) ?? 0) > 0);
  if (activeQ.length) {
    for (let b = 0; b < B; b++) {
      const sample = Array.from({ length: activeQ.length }, () => activeQ[Math.floor(rnd() * activeQ.length)]);
      let v = 0;
      let c = 0;
      for (const q of sample) {
        v += validByQ.get(q) ?? 0;
        c += citesByQ.get(q) ?? 0;
      }
      published.forEach((_, i) => {
        let k = 0;
        for (const q of sample) k += compByQ[i].get(q) ?? 0;
        rateSamples[i].push(v ? k / v : 0);
        sovSamples[i].push(c ? k / c : 0);
      });
    }
  }

  const validByProvider = new Map<ProviderId, number>();
  for (const a of valid) validByProvider.set(a.provider, (validByProvider.get(a.provider) ?? 0) + 1);

  let ranking: CompanyStat[] = published.map((g, i) => {
    const k = g.answers.size;
    const rs = [...rateSamples[i]].sort((x, y) => x - y);
    const ss = [...sovSamples[i]].sort((x, y) => x - y);
    const rate = totalValid ? k / totalValid : 0;
    const sov = totalCites ? k / totalCites : 0;
    const byProvider: CompanyStat['byProvider'] = {};
    for (const p of raw.providers) {
      const cited = [...g.answers.keys()].filter((x) => x.startsWith(`${p}|`)).length;
      byProvider[p] = { cited, answers: validByProvider.get(p) ?? 0 };
    }
    const positions = [...g.answers.values()];
    return {
      id: g.cluster.id,
      name: g.cluster.label,
      variants: g.cluster.variants,
      domain: g.cluster.domain,
      citedAnswers: k,
      rate,
      rateLow: rs.length ? Math.min(rate, percentile(rs, 0.05)) : rate,
      rateHigh: rs.length ? Math.max(rate, percentile(rs, 0.95)) : rate,
      sov,
      sovLow: ss.length ? Math.min(sov, percentile(ss, 0.05)) : sov,
      sovHigh: ss.length ? Math.max(sov, percentile(ss, 0.95)) : sov,
      byProvider,
      questions: g.questions.size,
      avgPosition: positions.length ? Math.round((positions.reduce((x, y) => x + y, 0) / positions.length) * 10) / 10 : null,
      rank: 0,
      tiedWithPrevious: false,
    };
  });
  ranking.sort((a, b) => b.rate - a.rate || b.sov - a.sov || (a.avgPosition ?? 99) - (b.avgPosition ?? 99) || a.name.localeCompare(b.name, 'fr'));
  ranking = ranking.slice(0, MAX_RANKING);
  ranking.forEach((r, i) => {
    r.rank = i + 1;
    r.tiedWithPrevious = i > 0 && ranking[i - 1].rateLow <= r.rateHigh;
  });

  // 4. Évolution.
  let evolution: BarometreEdition['evolution'];
  const prev = opts.previous && !opts.previous.demo ? opts.previous : null;
  if (prev) {
    const prevMatched = new Set<string>();
    for (const r of ranking) {
      const p = matchPrevious(r, prev.ranking, ctx);
      if (!p) {
        r.change = { kind: 'new' };
        continue;
      }
      prevMatched.add(p.id);
      const significant = r.rateLow > p.rateHigh || r.rateHigh < p.rateLow;
      r.change = { kind: 'delta', previousRate: p.rate, deltaPts: Math.round((r.rate - p.rate) * 1000) / 10, significant };
    }
    evolution = {
      previousPeriod: prev.period,
      entered: ranking.filter((r) => r.change?.kind === 'new').map((r) => r.name),
      exited: prev.ranking.filter((p) => !prevMatched.has(p.id)).map((p) => p.name),
    };
  }

  // 5. Sources citées (hors Gemini : ses liens de redirection ne désignent pas la source, et ses conditions l'excluent).
  const companyDomains = new Map<string, string>();
  for (const r of ranking) if (r.domain) companyDomains.set(r.name, r.domain);
  const { sources, answersWithSources } = aggregateSources(valid, companyDomains);

  const times = answers.map((a) => a.at).filter(Boolean).sort();
  const models: BarometreEdition['models'] = {};
  for (const a of valid) models[a.provider] ??= a.model;
  const complete = raw.status === 'collected' && planned > 0 && valid.length >= MIN_COMPLETION * planned;
  return {
    slug: def.slug,
    period: raw.period,
    version: opts.version ?? 1,
    def: {
      slug: def.slug,
      segment: def.segment,
      title: def.title,
      subject: def.subject,
      ...(def.trade ? { trade: def.trade } : {}),
      ...(def.city ? { city: def.city } : {}),
      ...(def.category ? { category: def.category } : {}),
      ...(def.productCategory ? { productCategory: def.productCategory } : {}),
    },
    demo: raw.demo || answers.some((a) => a.demo),
    status: complete ? 'complete' : 'incomplete',
    measuredFrom: times[0] ?? raw.startedAt,
    measuredTo: times[times.length - 1] ?? raw.updatedAt,
    aggregatedAt: opts.now ?? new Date().toISOString(),
    methodVersion: BAROMETRE_METHOD,
    providers: raw.providers,
    models,
    questions: raw.questions,
    runs: raw.runs,
    answersPlanned: planned,
    answersValid: valid.length,
    answersError,
    answersWithRecommendation: valid.filter((a) => (extractions[a.key]?.companies.length ?? 0) > 0).length,
    answersWithSources,
    ranking,
    unverifiedCount,
    withdrawnCount,
    sources,
    ...(evolution ? { evolution } : {}),
    costEur: Math.round(raw.spentEur * 100) / 100,
  };
}

/** Correspondance avec le mois précédent : même identifiant, même site, même cœur de nom ou variante commune. */
function matchPrevious(r: CompanyStat, prev: CompanyStat[], ctx: ReturnType<typeof nameContext>): CompanyStat | undefined {
  const core = coreOf(nameKey(r.name, ctx), ctx);
  const vk = new Set(r.variants.map((v) => nameKey(v, ctx)));
  return (
    prev.find((p) => p.id === r.id) ??
    prev.find((p) => !!r.domain && p.domain === r.domain) ??
    prev.find((p) => p.variants.some((v) => vk.has(nameKey(v, ctx)))) ??
    prev.find((p) => core.length >= 5 && coreOf(nameKey(p.name, ctx), ctx) === core)
  );
}

export function aggregateSources(valid: RawAnswerRecord[], companyDomains: Map<string, string>): { sources: SourceStat[]; answersWithSources: number } {
  const byDomain = new Map<string, { label: string; category: SourceStat['category']; urls: Map<string, number>; answers: Set<string>; providers: Set<ProviderId>; citations: number }>();
  let answersWithSources = 0;
  for (const a of valid) {
    if (a.provider === 'gemini') continue;
    const raws = [
      ...(a.sources.length ? a.sources.filter((s) => s.kind !== 'retrieved').map((s) => s.url) : a.citations),
      ...extractInlineUrls(a.text),
    ];
    const seen = new Set<string>();
    for (const u of raws) {
      if (isGeminiRedirect(u)) continue;
      const n = normalizeUrl(u);
      if (!n || seen.has(n.urlNorm)) continue;
      seen.add(n.urlNorm);
      const cls = classifyDomain(u, { competitorDomains: companyDomains });
      let e = byDomain.get(n.domain);
      if (!e) {
        e = { label: cls.label, category: cls.category, urls: new Map(), answers: new Set(), providers: new Set(), citations: 0 };
        byDomain.set(n.domain, e);
      }
      e.citations++;
      e.answers.add(akey(a));
      e.providers.add(a.provider);
      e.urls.set(n.urlNorm, (e.urls.get(n.urlNorm) ?? 0) + 1);
    }
    if (seen.size) answersWithSources++;
  }
  const sources: SourceStat[] = [...byDomain.entries()]
    .map(([domain, e]) => ({
      domain,
      label: e.label,
      category: e.category,
      citations: e.citations,
      answers: e.answers.size,
      answerShare: answersWithSources ? e.answers.size / answersWithSources : 0,
      providers: [...e.providers],
      sampleUrls: [...e.urls.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([u]) => u),
    }))
    .sort((x, y) => y.answers - x.answers || y.citations - x.citations || x.domain.localeCompare(y.domain))
    .slice(0, 20);
  return { sources, answersWithSources };
}
