/**
 * Orchestration d'un audit : requêtes × exécutions × IA, concurrence limitée, garde-fou budget,
 * extraction, détection, score, extraits pour le rapport et actions gratuites.
 */
import { topActions as computeTopActions } from './actions';
import {
  buildVariants,
  canonicalizeCompetitors,
  detectMention,
  extractEntities,
  extractHeuristic,
  geoContext,
  type Extraction,
} from './detect';
import { checkClaims } from './factcheck';
import { buildBenchmark, buildGaps } from './insights';
import { buildPerception, buildPerceptionHeuristic } from './perception';
import {
  createMockFacts,
  defaultSeed,
  getExtractor,
  getProvider,
  mockAnswerV2,
  selectedProviders,
  type EngineProvider,
  type Extractor,
} from './providers';
import { templateOf, zoneInfo } from './queries';
import { buildBrandQueries, isBrandQuery, segmentOf } from './queries-v2';
import { resolveAuditQueries, withTheme } from './queries-v3';
import { computeMargins, buildVoiceMatrix } from './analytics';
import { auditCounts, reconcilePerception } from './coherence';
import { computeScore } from './scoring';
import { analyzeSources, type SourcesAnalysis } from './sources';
import { verifyPresence, type PresenceVerdict } from './sources/presence';
import type {
  AuditInput,
  AuditResult,
  Excerpt,
  MentionResult,
  ProviderAnswer,
  ProviderId,
  QuerySpec,
  RunAuditOptions,
} from './types';
import type { BrandFactField, BrandFacts, PerceptionReport } from './types-v2';
import type { CustomQuery } from './types-v3';
import { env, newId, shortHash } from './util';

const DEFAULT_COUNTRY = 'FR';

function numEnv(k: string): number | undefined {
  const v = env(k);
  if (v == null || v === '') return undefined;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

interface Task {
  query: QuerySpec;
  run: number;
  provider: EngineProvider;
  cost: number;
}

/**
 * Garde-fou budget (méthode § 3.3) : si le coût estimé dépasse le budget, on retire la dernière exécution
 * de T8, puis de T4, puis des autres gabarits (en gardant toujours la première exécution de chaque requête).
 */
export function applyBudget(tasks: Task[], budgetEur: number): { kept: Task[]; skipped: number } {
  const total = (ts: Task[]) => ts.reduce((a, t) => a + t.cost, 0);
  if (total(tasks) <= budgetEur + 1e-9) return { kept: tasks, skipped: 0 };
  const order = ['T8', 'T4', 'T10', 'T7', 'T3', 'T2', 'T9', 'T6', 'T5', 'T1', 'T1g', 'T9g'];
  const maxRun = Math.max(...tasks.map((t) => t.run));
  let kept = [...tasks];
  let skipped = 0;
  for (let run = maxRun; run >= 2; run--) {
    const tpls = [...order, ...new Set(kept.map((t) => templateOf(t.query.id)))];
    for (const tpl of tpls) {
      if (total(kept) <= budgetEur + 1e-9) return { kept, skipped };
      const drop = kept.filter((t) => t.run === run && templateOf(t.query.id) === tpl && t.cost > 0);
      if (!drop.length) continue;
      kept = kept.filter((t) => !drop.includes(t));
      skipped += drop.length;
    }
  }
  // Dernier recours : on retire des IA payantes les requêtes restantes, en partant de la fin.
  while (total(kept) > budgetEur + 1e-9) {
    const idx = [...kept].reverse().findIndex((t) => t.cost > 0);
    if (idx < 0) break;
    kept.splice(kept.length - 1 - idx, 1);
    skipped++;
  }
  return { kept, skipped };
}

async function pool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

/* ------------------------------------------------------------------ */
/* Extraits pour le rapport                                            */
/* ------------------------------------------------------------------ */

function clip(text: string, max = 700): string {
  const t = text.replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (t.length <= max) return t;
  const cut = t.lastIndexOf('\n', max);
  const end = cut > max * 0.5 ? cut : t.lastIndexOf(' ', max);
  return `${t.slice(0, end > 0 ? end : max).trim()} […]`;
}

export function buildExcerpts(
  queries: QuerySpec[],
  answers: ProviderAnswer[],
  mentions: MentionResult[],
  topCompetitors: string[],
): Excerpt[] {
  const qText = new Map(queries.map((q) => [q.id, q.text]));
  const k = (x: { provider: string; queryId: string; run: number }) => `${x.provider}|${x.queryId}|${x.run}`;
  const byKey = new Map(mentions.map((m) => [k(m), m]));
  const allDemo = !answers.some((a) => !a.demo && !a.error);
  const pool = answers
    .filter((a) => !a.error && a.text && (allDemo || !a.demo))
    .map((a) => ({ a, m: byKey.get(k(a)) }))
    .filter((x): x is { a: ProviderAnswer; m: MentionResult } => !!x.m && !x.m.noRec);

  const chosen: { a: ProviderAnswer; m: MentionResult }[] = [];
  const usedProviders = new Set<ProviderId>();
  const usedQueries = new Set<string>();
  const take = (x: { a: ProviderAnswer; m: MentionResult }) => {
    chosen.push(x);
    usedProviders.add(x.a.provider);
    usedQueries.add(x.a.queryId);
  };

  // 1. Une réponse qui cite le commerce (meilleur rang).
  const hits = pool.filter((x) => x.m.mentioned).sort((x, y) => (x.m.rank ?? 99) - (y.m.rank ?? 99));
  if (hits[0]) take(hits[0]);

  // 2. Des réponses où les concurrents sont cités à sa place, de préférence sur d'autres IA et requêtes.
  const top = new Set(topCompetitors.slice(0, 3));
  const misses = pool
    .filter((x) => !x.m.mentioned && x.m.competitors.length > 0)
    .sort(
      (x, y) =>
        y.m.competitors.filter((c) => top.has(c)).length - x.m.competitors.filter((c) => top.has(c)).length ||
        y.m.competitors.length - x.m.competitors.length ||
        x.a.queryId.localeCompare(y.a.queryId) ||
        x.a.run - y.a.run,
    );
  const target = hits.length ? 3 : 3;
  for (const pass of [0, 1, 2]) {
    for (const x of misses) {
      if (chosen.length >= target) break;
      if (chosen.includes(x)) continue;
      if (pass === 0 && (usedProviders.has(x.a.provider) || usedQueries.has(x.a.queryId))) continue;
      if (pass === 1 && usedQueries.has(x.a.queryId)) continue;
      take(x);
    }
  }
  // 3. Compléter (au moins 2 si possible) avec d'autres réponses citant le commerce.
  for (const x of hits) {
    if (chosen.length >= 2) break;
    if (!chosen.includes(x)) take(x);
  }
  return chosen.slice(0, 4).map(({ a, m }) => ({
    provider: a.provider,
    query: qText.get(a.queryId) ?? '',
    text: clip(a.text),
    competitorsHighlighted: m.competitors.slice(0, 6),
    mentioned: m.mentioned,
  }));
}

/* ------------------------------------------------------------------ */
/* Assemblage                                                          */
/* ------------------------------------------------------------------ */

interface AssembleArgs {
  id: string;
  input: AuditInput;
  queries: QuerySpec[];
  providerIds: ProviderId[];
  answers: ProviderAnswer[];
  extractions: (Extraction | null)[];
  models: Partial<Record<ProviderId, string>>;
  estimatedCostEur: number;
  skippedForBudget: number;
  /** V2 : perception déjà calculée (sinon heuristique) */
  perception?: PerceptionReport;
  facts?: BrandFacts | Partial<Record<BrandFactField, string>>;
  presenceOverrides?: Map<string, PresenceVerdict>;
  /** V3 : date de mesure imposée (sinon heure de la dernière réponse) */
  measuredAt?: string;
}

/** Contexte de détection : hors local, pas de contre-preuve géographique (une marque nationale n'a pas de « zone »). */
function detectionGeo(input: AuditInput) {
  const g = geoContext(input);
  if (segmentOf(input) === 'local') return g;
  return { ...g, otherPlaces: [] };
}

/** Tous les concurrents cités (noms canoniques), du plus au moins cité, 30 au plus. */
function allCompetitorNames(mentions: MentionResult[]): string[] {
  const n = new Map<string, number>();
  for (const m of mentions) for (const c of new Set(m.competitors)) n.set(c, (n.get(c) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 30).map(([k]) => k);
}

function sourcesFor(a: AssembleArgs, result: AuditResult): SourcesAnalysis {
  const competitorDomains = new Map<string, string>();
  a.extractions.forEach((ex) => ex?.entities.forEach((e) => e.url && competitorDomains.set(e.name, e.url)));
  return analyzeSources(a.answers, a.input, {
    segment: segmentOf(a.input),
    queries: a.queries,
    competitors: allCompetitorNames(result.mentions),
    competitorDomains,
    measuredAt: result.measuredAt,
    presenceOverrides: a.presenceOverrides,
  });
}

function assemble(a: AssembleArgs): AuditResult {
  const variants = buildVariants(a.input);
  const geo = detectionGeo(a.input);
  const segment = segmentOf(a.input);
  const qById = new Map(a.queries.map((q) => [q.id, q]));
  // Les requêtes de marque nourrissent la perception et la vérité, PAS le score de recommandation.
  const recoIdx = a.answers.map((_, i) => i).filter((i) => !isBrandQuery(qById.get(a.answers[i].queryId) ?? { id: a.answers[i].queryId }));
  const recoAnswers = recoIdx.map((i) => a.answers[i]);
  const recoQueries = a.queries.filter((q) => !isBrandQuery(q));
  let disagreements = 0;
  const rawMentions = recoIdx.map((i) => {
    const ans = a.answers[i];
    const ex = a.extractions[i];
    const m = detectMention(ans, a.input, ex?.entities ?? [], { variants, geo });
    if (ex?.llmTarget != null && ex.llmTarget !== m.mentioned) disagreements++;
    return m;
  });
  const mentions = canonicalizeCompetitors(rawMentions);
  const s = computeScore(recoAnswers, mentions, a.providerIds, a.id, { models: a.models });
  const providersUsed = a.providerIds.filter((p) => a.answers.some((x) => x.provider === p && !x.error));
  const times = a.answers.map((x) => x.at).filter((x): x is string => !!x).sort();
  const now = new Date().toISOString();
  const measuredAt = a.measuredAt ?? times[times.length - 1] ?? now;

  const result: AuditResult = {
    id: a.id,
    input: a.input,
    createdAt: now,
    score: s.score,
    subScores: s.subScores,
    mentionRate: s.mentionRate,
    avgRank: s.avgRank,
    shareOfVoice: s.shareOfVoice,
    competitors: s.competitors,
    queries: a.queries,
    mentions,
    answers: a.answers,
    confidence: s.confidence,
    demo: a.answers.some((x) => x.demo),
    range: s.range,
    agreement: s.agreement,
    measuredAt,
    providersUsed,
    excerpts: buildExcerpts(recoQueries, recoAnswers, mentions, s.competitors.map((c) => c.name)),
    topActions: [],
    details: {
      ...s.details,
      disagreements,
      estimatedCostEur: Math.round(a.estimatedCostEur * 10000) / 10000,
      skippedForBudget: a.skippedForBudget,
    },
  };
  result.topActions = computeTopActions(result);
  // ---- V2 : parcours, sources, perception, vérité, pourquoi, benchmark ----
  result.segment = segment;
  const src = sourcesFor(a, result);
  result.sources = src.report;
  const perception = a.perception ?? buildPerceptionHeuristic(a.answers, a.queries, a.input);
  // V3 (cohérence D3/D4) : vérification datée de la mesure ; verbatims faux comptés en négatif.
  if (a.facts) result.factCheck = { ...checkClaims(perception.claims, a.facts), checkedAt: measuredAt };
  result.perception = reconcilePerception(perception, result.factCheck, measuredAt, a.answers, a.queries);
  result.gaps = buildGaps(result, { sources: src.report, citations: src.citations });
  result.benchmark = buildBenchmark(result);
  // ---- V3 : comptages (source unique), marges d'erreur, part de voix thème × IA ----
  result.counts = auditCounts(result);
  result.margins = computeMargins(result);
  result.voice = buildVoiceMatrix(result);
  return result;
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */

export async function runAudit(input: AuditInput, opts: RunAuditOptions = {}): Promise<AuditResult> {
  const mode = opts.mode ?? 'free';
  const id = newId();
  const seed = opts.seed ?? defaultSeed(input);
  const segment = segmentOf(input);
  const providerIds = opts.providers?.length ? [...new Set(opts.providers)] : selectedProviders(mode);
  const providers = providerIds.map((p) => getProvider(p, input, seed, opts.forceMock));
  const queries = resolveAuditQueries(input, mode, opts.queries, opts.queriesMode);
  const runs = mode === 'paid' ? 3 : 2;
  const extractor: Extractor | null = !opts.forceMock && providers.some((p) => !p.demo) ? getExtractor() : null;
  // Budget : PME / e-commerce ajoutent 2 requêtes de marque (1 exécution) et l'extraction de perception (≈ +0,07 €).
  const defaultFree = segment === 'local' ? 0.6 : 0.7;
  const defaultPaid = segment === 'local' ? 2.5 : 2.7;
  const budget =
    opts.budgetEur ??
    (mode === 'paid' ? numEnv('AUDIT_BUDGET_PAID_EUR') ?? defaultPaid : numEnv('AUDIT_BUDGET_EUR') ?? defaultFree);
  const concurrency = Math.max(1, opts.concurrency ?? numEnv('AUDIT_CONCURRENCY') ?? 6);

  const all: Task[] = [];
  for (const query of queries) {
    const brand = isBrandQuery(query);
    // Requêtes de marque : 1 seule exécution ; l'extraction (perception + claims) est comptée dans le coût.
    for (let run = 1; run <= (brand ? 1 : runs); run++)
      for (const provider of providers)
        all.push({ query, run, provider, cost: provider.demo ? 0 : provider.costPerCallEur + (extractor?.costPerCallEur ?? 0) });
  }
  const { kept, skipped } = applyBudget(all, budget);

  const zi = zoneInfo(input);
  const answers: ProviderAnswer[] = new Array(kept.length);
  const extractions: (Extraction | null)[] = new Array(kept.length);
  let spent = 0;
  let skippedRuntime = 0;
  let done = 0;

  await pool(kept, concurrency, async (task, i) => {
    const base = { provider: task.provider.id, queryId: task.query.id, run: task.run, demo: task.provider.demo, model: task.provider.model };
    if (opts.signal?.aborted || spent + task.cost > budget + 1e-9) {
      skippedRuntime++;
      answers[i] = { ...base, text: '', citations: [], error: 'budget dépassé : appel non effectué', at: new Date().toISOString() };
      extractions[i] = null;
    } else {
      spent += task.cost;
      try {
        const r = await task.provider.ask(task.query.text, { city: zi.city, country: DEFAULT_COUNTRY, queryId: task.query.id, run: task.run });
        // Gemini sans ancrage (ou ancré, CGU) : aucune source conservée pour le pilier Sources.
        const sources = task.provider.id === 'gemini' ? undefined : r.sources;
        answers[i] = { ...base, text: r.text, citations: r.citations, ...(sources?.length ? { sources } : {}), at: new Date().toISOString() };
      } catch (e) {
        answers[i] = { ...base, text: '', citations: [], error: e instanceof Error ? e.message : String(e), at: new Date().toISOString() };
      }
      extractions[i] =
        answers[i].error || isBrandQuery(task.query) ? null : await extractEntities(answers[i], input, task.query.text, extractor);
    }
    done++;
    opts.onProgress?.({ done, total: kept.length, provider: task.provider.id });
  });

  const models: Partial<Record<ProviderId, string>> = {};
  for (const p of providers) models[p.id] = p.model;
  // Les réponses en budget dépassé à l'exécution sont retirées (non mesurées), comme les appels sautés au plan.
  const keepIdx = answers.map((a, i) => i).filter((i) => answers[i].error !== 'budget dépassé : appel non effectué');
  const kAnswers = keepIdx.map((i) => answers[i]);
  // Perception + claims : 1 appel JSON par réponse de marque, 1 par lot de 8 passages (extracteur le moins cher).
  // Les appels des réponses de marque sont déjà budgétés ; les lots de passages coûtent ≈ 0,0003 € chacun.
  const perception = await buildPerception(kAnswers, queries, input, extractor, { maxCalls: 12 });
  const args: AssembleArgs = {
    id,
    input,
    queries,
    providerIds,
    answers: kAnswers,
    extractions: keepIdx.map((i) => extractions[i]),
    models,
    estimatedCostEur: spent + perception.costEur,
    skippedForBudget: skipped + skippedRuntime,
    perception: perception.report,
    facts: opts.facts,
    measuredAt: opts.measuredAt,
  };
  let result = assemble(args);
  if (opts.verifyPresence && result.sources) {
    // Niveau 2 (optionnel) : une requête HTTP par source prioritaire dont la présence est inconnue.
    const overrides = await verifyTopSources(result, 10);
    if (overrides.size) result = { ...assemble({ ...args, presenceOverrides: overrides }), id };
  }
  return result;
}

async function verifyTopSources(result: AuditResult, max: number): Promise<Map<string, PresenceVerdict>> {
  const out = new Map<string, PresenceVerdict>();
  const variants = buildVariants(result.input);
  const comps = result.competitors.map((c) => c.name);
  const byDomain = new Map((result.sources?.domains ?? []).map((d) => [d.domain, d]));
  for (const o of (result.sources?.opportunities ?? []).slice(0, max)) {
    const d = byDomain.get(o.domain);
    if (!d || d.clientPresence !== 'unknown' || !d.sampleUrls[0]) continue;
    try {
      const v = await verifyPresence(d.sampleUrls[0], variants, comps);
      if (v.client !== 'unknown') out.set(o.domain, v);
    } catch {
      /* présence inconnue */
    }
  }
  return out;
}

/**
 * Audit de démonstration synchrone et déterministe (demo:true), sans aucun appel réseau, pour les 3 parcours :
 * sources structurées, perception, fiche de vérité démo (1 affirmation fausse), pourquoi, benchmark.
 */
export interface MockAuditOptions {
  /** questions personnalisées ou figées (mêmes règles que `runAudit`) */
  queries?: (QuerySpec | CustomQuery)[];
  queriesMode?: 'replace' | 'append';
  /** IA simulées (défaut : celles de l'offre gratuite) */
  providers?: ProviderId[];
  /** date de la mesure (défaut : maintenant) ; date aussi chaque réponse */
  measuredAt?: string;
  /**
   * Réécriture des réponses de recommandation AVANT détection (comptes démo façonnés : nom injecté ou retiré).
   * « Cité » et le rang restent dérivés du texte final, jamais imposés.
   */
  rewrite?: (answer: ProviderAnswer, query: QuerySpec) => ProviderAnswer;
}

export function createMockAudit(input: AuditInput, seed?: string, opts: MockAuditOptions = {}): AuditResult {
  const s = seed ?? defaultSeed(input);
  const providerIds = opts.providers?.length ? [...new Set(opts.providers)] : selectedProviders('free');
  const segment = segmentOf(input);
  // Démo locale : on ajoute la requête de faits (normalement réservée au suivi) pour illustrer la vérité.
  const resolved = resolveAuditQueries(input, 'free', opts.queries, opts.queriesMode);
  const extraBrand =
    segment === 'local' && !opts.queries?.length ? buildBrandQueries(input, 'paid').map((q) => withTheme(q, input)) : [];
  const queries = [...resolved, ...extraBrand.filter((b) => !resolved.some((q) => q.id === b.id))];
  const answers: ProviderAnswer[] = [];
  const at = opts.measuredAt ?? new Date().toISOString();
  for (const q of queries) {
    const runs = isBrandQuery(q) ? 1 : 2;
    for (let run = 1; run <= runs; run++)
      for (const p of providerIds) {
        const r = mockAnswerV2(input, p, q, run, s);
        const ans: ProviderAnswer = {
          provider: p,
          queryId: q.id,
          run,
          text: r.text,
          citations: r.citations,
          ...(r.sources?.length ? { sources: r.sources } : {}),
          demo: true,
          model: 'demo-mock',
          at,
        };
        answers.push(opts.rewrite && !isBrandQuery(q) ? { ...opts.rewrite(ans, q), at } : ans);
      }
  }
  const qById = new Map(queries.map((q) => [q.id, q]));
  const extractions: (Extraction | null)[] = answers.map((a) => {
    if (isBrandQuery(qById.get(a.queryId))) return null;
    const entities = extractHeuristic(a.text, input);
    return { entities, recommends: entities.length > 0, via: 'heuristic', llmTarget: null };
  });
  const models: Partial<Record<ProviderId, string>> = {};
  for (const p of providerIds) models[p] = 'demo-mock';
  return assemble({
    id: `demo-${shortHash(`${s}|${input.businessName}|${input.trade}|${input.city}|${input.district ?? ''}${segment === 'local' ? '' : `|${segment}`}`, 8)}`,
    input,
    queries,
    providerIds,
    answers,
    extractions,
    models,
    estimatedCostEur: 0,
    skippedForBudget: 0,
    facts: createMockFacts(input),
    measuredAt: at,
  });
}
