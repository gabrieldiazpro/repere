/**
 * Pipeline mensuel d'un baromètre : collecte (questions × IA × passages) avec budget et reprise, extraction des
 * entreprises, agrégation, versionnage, stockage.
 *
 * - Reprise : la collecte est un document (barometre.raw, `slug:AAAA-MM`) sauvegardé tous les `checkpointEvery`
 *   appels ; une relance ne repose que les questions manquantes ou en erreur.
 * - Budget : chaque appel réserve son coût (IA + extraction) dans le registre du mois AVANT d'être lancé ; s'il ne
 *   tient pas, la collecte s'arrête (`stopped_budget`) et l'édition reste incomplète, donc non publiée.
 * - Réel ou simulé : en mode réel, seules les IA configurées (clé présente) sont interrogées et on ne retombe JAMAIS
 *   sur le simulé ; en mode `demo`, tout est simulé et rangé à part.
 */
import { createRealProvider, getExtractor } from '../engine/providers';
import type { EngineProvider, Extractor } from '../engine/providers/http';
import type { ProviderId } from '../engine/types';
import { aggregateEdition } from './aggregate';
import { CATALOG, engineInput, getDef, providersFor, questionsFor, runsFor } from './catalog';
import { monthlyBudget, planWithinBudget, round2 } from './cost';
import { extractCompanies } from './extract';
import { createSimulatedProvider } from './simulate';
import { BudgetLedger, currentPeriod, isPublishable, loadBudget, loadRaw, previousPublishable, saveEdition, saveRaw, withdrawnKeys } from './storage';
import type { BarometreDef, BarometreEdition, RawAnswerRecord, RawRun } from './types';

export interface RunOptions {
  period?: string;
  /** tout simuler (jamais publié) */
  demo?: boolean;
  /** fabrique de fournisseurs (tests) ; sinon réel (mode réel) ou simulé (mode démo) */
  providerFactory?: (id: ProviderId, def: BarometreDef) => EngineProvider | null;
  /** extracteur (tests) ; défaut : extracteur du moteur en réel, aucun en démo */
  extractor?: Extractor | null;
  budget?: BudgetLedger;
  concurrency?: number;
  checkpointEvery?: number;
  signal?: AbortSignal;
  now?: () => string;
  log?: (msg: string) => void;
}

export interface RunResult {
  slug: string;
  period: string;
  demo: boolean;
  status: RawRun['status'] | 'aborted';
  calls: number;
  spentEur: number;
  edition: BarometreEdition | null;
  publishable: boolean;
}

export const answerKey = (provider: ProviderId, questionId: string, run: number) => `${provider}|${questionId}|${run}`;

function resolveProviders(def: BarometreDef, opts: RunOptions): EngineProvider[] {
  const ids = providersFor(def);
  const make = opts.providerFactory ?? ((id: ProviderId) => (opts.demo ? createSimulatedProvider(id, def) : createRealProvider(id)));
  const out = ids.map((id) => make(id, def)).filter((p): p is EngineProvider => !!p);
  if (!opts.demo && out.some((p) => p.demo)) throw new Error('[barometre] un fournisseur simulé ne peut pas servir à une mesure réelle');
  if (!out.length) throw new Error(`[barometre] aucune IA configurée pour ${def.slug} (clés absentes) : utilisez --demo pour simuler`);
  return out;
}

export async function runBarometre(def: BarometreDef, opts: RunOptions = {}): Promise<RunResult> {
  const now = opts.now ?? (() => new Date().toISOString());
  const period = opts.period ?? currentPeriod();
  const demo = !!opts.demo;
  const log = opts.log ?? (() => undefined);
  const providers = resolveProviders(def, opts);
  const budget = opts.budget ?? (await loadBudget(period, monthlyBudget(), demo));
  const extractor = opts.extractor !== undefined ? opts.extractor : demo ? null : getExtractor();
  const extractCost = extractor?.costPerCallEur ?? 0;

  let raw = await loadRaw(def.slug, period, demo);
  if (!raw) {
    raw = {
      slug: def.slug,
      period,
      demo,
      startedAt: now(),
      updatedAt: now(),
      questions: questionsFor(def),
      providers: providers.map((p) => p.id),
      runs: runsFor(def),
      answers: {},
      spentEur: 0,
      status: 'collecting',
    };
  } else {
    // Les questions et passages restent ceux du début du mois (comparabilité) ; on peut ajouter une IA configurée depuis.
    raw.providers = [...new Set([...raw.providers, ...providers.map((p) => p.id)])].filter((id) => providers.some((p) => p.id === id));
    raw.status = 'collecting';
  }
  const r = raw;
  const byId = new Map(providers.map((p) => [p.id, p]));
  const tasks: { provider: EngineProvider; q: RawRun['questions'][number]; run: number }[] = [];
  for (let run = 1; run <= r.runs; run++)
    for (const q of r.questions)
      for (const pid of r.providers) {
        const prev = r.answers[answerKey(pid, q.id, run)];
        if (!prev || prev.error) tasks.push({ provider: byId.get(pid)!, q, run });
      }
  log(`${def.slug} ${period} : ${tasks.length} appels à faire (${Object.keys(r.answers).length} déjà en base)`);

  let calls = 0;
  let sinceCheckpoint = 0;
  let stopped: 'budget' | 'aborted' | null = null;
  const every = Math.max(1, opts.checkpointEvery ?? 12);
  const checkpoint = async (force = false) => {
    if (!force && sinceCheckpoint < every) return;
    sinceCheckpoint = 0;
    r.updatedAt = now();
    await saveRaw(r);
    await budget.persist();
  };

  let next = 0;
  const worker = async () => {
    while (!stopped) {
      if (opts.signal?.aborted) {
        stopped = 'aborted';
        return;
      }
      const t = tasks[next++];
      if (!t) return;
      const cost = t.provider.demo ? t.provider.costPerCallEur : t.provider.costPerCallEur + extractCost;
      if (!budget.tryReserve(def.slug, cost)) {
        stopped = 'budget';
        return;
      }
      const key = answerKey(t.provider.id, t.q.id, t.run);
      const city = def.segment === 'local' ? def.city : undefined;
      let rec: RawAnswerRecord;
      try {
        const res = await t.provider.ask(t.q.text, { city, country: 'FR', queryId: t.q.id, run: t.run });
        rec = { key, provider: t.provider.id, questionId: t.q.id, run: t.run, text: res.text, citations: res.citations, sources: res.sources ?? [], model: t.provider.model, demo: t.provider.demo, at: now(), costEur: cost };
      } catch (e) {
        rec = { key, provider: t.provider.id, questionId: t.q.id, run: t.run, text: '', citations: [], sources: [], model: t.provider.model, demo: t.provider.demo, error: e instanceof Error ? e.message.slice(0, 300) : String(e), at: now(), costEur: cost };
      }
      r.answers[key] = rec;
      if (r.extractions) delete r.extractions[key];
      r.spentEur += cost;
      calls++;
      sinceCheckpoint++;
      await checkpoint();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.concurrency ?? 4, 8)) }, worker));

  if (stopped === 'aborted') {
    await checkpoint(true);
    return { slug: def.slug, period, demo, status: 'aborted', calls, spentEur: round2(r.spentEur), edition: null, publishable: false };
  }
  const missing = r.runs * r.questions.length * r.providers.length - Object.keys(r.answers).length;
  r.status = stopped === 'budget' || missing > 0 ? 'stopped_budget' : 'collected';
  await checkpoint(true);

  // Extraction (gardée dans le document de collecte : pas de second paiement à la reprise).
  r.extractions ??= {};
  const input = engineInput(def);
  const qText = new Map(r.questions.map((q) => [q.id, q.text]));
  for (const a of Object.values(r.answers)) {
    if (a.error || r.extractions[a.key]) continue;
    r.extractions[a.key] = await extractCompanies(a, qText.get(a.questionId) ?? '', def.subject, input, extractor);
  }
  r.updatedAt = now();
  await saveRaw(r);

  const [previous, withdrawn] = await Promise.all([demo ? Promise.resolve(null) : previousPublishable(def.slug, period), withdrawnKeys(def.slug)]);
  const edition = aggregateEdition(def, r, r.extractions, { previous, withdrawn, now: now() });
  // Collecte inachevée (budget) : l'édition n'est pas enregistrée (elle ne remplace jamais une version complète).
  if (r.status !== 'collected') {
    log(`${def.slug} ${period} : collecte inachevée (budget), édition non enregistrée`);
    return { slug: def.slug, period, demo, status: r.status, calls, spentEur: round2(r.spentEur), edition, publishable: false };
  }
  const stored = await saveEdition(edition);
  log(`${def.slug} ${period} : ${stored.status}, ${stored.answersValid}/${stored.answersPlanned} réponses, ${stored.ranking.length} entreprises, ${round2(r.spentEur)} €`);
  return { slug: def.slug, period, demo, status: r.status, calls, spentEur: round2(r.spentEur), edition: stored, publishable: isPublishable(stored) };
}

export interface MonthlyOptions extends RunOptions {
  slugs?: string[];
  catalog?: BarometreDef[];
  budgetEur?: number;
}

/** Passe mensuelle : baromètres du catalogue par priorité, dans la limite du budget restant du mois. */
export async function runMonthly(opts: MonthlyOptions = {}) {
  const period = opts.period ?? currentPeriod();
  const catalog = opts.catalog ?? CATALOG;
  const defs = opts.slugs?.length ? opts.slugs.map((s) => getDef(s, catalog)).filter((d): d is BarometreDef => !!d) : catalog;
  const budget = opts.budget ?? (await loadBudget(period, opts.budgetEur ?? monthlyBudget(), !!opts.demo));
  const plan = opts.demo ? { selected: defs.map((d) => ({ slug: d.slug })), skipped: [] as { slug: string }[] } : planWithinBudget(defs, budget.remaining());
  const results: RunResult[] = [];
  for (const { slug } of plan.selected) {
    if (opts.signal?.aborted) break;
    const def = getDef(slug, catalog)!;
    results.push(await runBarometre(def, { ...opts, period, budget }));
  }
  return { period, results, skippedForBudget: plan.skipped.map((s) => s.slug), spentEur: round2(budget.spentEur), limitEur: budget.limitEur };
}
