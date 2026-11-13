/**
 * Réanalyse SEO + GEO d'un espace par la file de tâches (INTEGRATION-V5).
 *
 * | type                | charge utile                                  | effet |
 * |---------------------|-----------------------------------------------|-------|
 * | analysis.rerun      | businessId, reason?, changeSetId?             | analyse complète du site de l'espace (pages selon l'offre), comparée à la précédente, rattachée à l'espace |
 * | analysis.scheduled  | now? (ISO)                                    | balaye les espaces actifs avec un site et enfile `analysis.rerun` selon le rythme de l'offre |
 *
 * Le contrôle IA rapide n'est PAS relancé ici (aucun appel payant) : la visibilité dans les IA est mesurée par
 * `audit.run`. GEO-OPT peut appeler l'IA configurée (réécritures) sauf GEO_LLM=off.
 * Idempotent : l'identifiant de l'analyse dérive de celui de la tâche (une reprise relit l'analyse déjà faite).
 */
import { log } from '@/lib/log';
import type { JobContext } from '@/lib/jobs/types';
import { PermanentJobError } from '@/lib/jobs/types';
import { collectAnalysis, runFullAnalysis, analysisDomain } from './run';
import { domainHistory, getStoredAnalysis, previousAnalysis, saveAnalysis } from './store';
import { allFindings } from './prioritize';
import type { SiteType } from './types';
import type { SiteCrawl } from '@/lib/crawl/types';

const DAY = 86_400_000;
const MIN_INTERVAL = { monthly: 27 * DAY, weekly: 6 * DAY } as const;
/** Marge laissée sous le délai par tâche (JOBS_TIMEOUT_MS) : synthèse, enregistrement. */
const JOB_MARGIN_MS = 25_000;

function jobTimeoutMs(): number {
  const n = Number(process.env.JOBS_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 90_000;
}

/** Budgets d'une réanalyse : ceux de l'offre, bornés par le délai par tâche de la file. */
export function rerunBudgets(limits: { maxPages: number; crawlBudgetMs: number }, timeoutMs = jobTimeoutMs()): { maxPages: number; crawlBudgetMs: number; budgetMs: number } {
  const crawlBudgetMs = Math.max(10_000, Math.min(limits.crawlBudgetMs, timeoutMs - JOB_MARGIN_MS - 10_000));
  return { maxPages: limits.maxPages, crawlBudgetMs, budgetMs: crawlBudgetMs + 10_000 };
}

export async function handleAnalysisRerun(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const businessId = typeof p.businessId === 'string' ? p.businessId : '';
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(businessId)) throw new PermanentJobError('businessId manquant ou invalide');
  const { isDemoBusinessId } = await import('@/lib/demo-v2');
  if (isDemoBusinessId(businessId)) return { skipped: 'compte de démonstration (lecture seule)' };
  const db = await import('@/lib/db');
  const b = await db.getBusinessRecord(businessId);
  if (!b) throw new PermanentJobError('commerce introuvable');
  if (!b.website) return { skipped: 'aucun site renseigné' };
  const { getEntitlements } = await import('@/lib/entitlements');
  const ent = getEntitlements(b);
  const job = (p._job as JobContext | undefined) ?? null;
  const id = job?.id ? `an_r_${job.id.replace(/[^A-Za-z0-9]/g, '').slice(0, 40)}` : undefined;
  if (id) {
    const done = await getStoredAnalysis(id);
    if (done) return { analysisId: id, reused: true, global: done.analysis.scores.global };
  }
  let domain: string;
  try {
    domain = analysisDomain(b.website);
  } catch {
    throw new PermanentJobError('adresse du site invalide');
  }
  const previous = await previousAnalysis(domain).catch(() => null);
  const budgets = rerunBudgets(ent.analysis);
  const siteType: SiteType = b.segment === 'pme' || b.segment === 'ecommerce' ? b.segment : 'local';
  // L'exploration complète (HTML) est gardée en mémoire pour l'agent de publication (base factuelle des propositions).
  const { defaultModules } = await import('./modules');
  const base = defaultModules();
  const captured: { crawl?: SiteCrawl } = {};
  const a = await collectAnalysis(
    runFullAnalysis(
      { url: b.website, brand: b.name, siteType, ...(b.city && b.city !== 'France' ? { city: b.city } : {}) },
      {
        ...budgets,
        maxAiCalls: 0,
        modules: {
          aiCheck: async () => null,
          crawl: async (u, o) => (captured.crawl = await base.crawl(u, o)),
        },
        previous,
        ...(id ? { id } : {}),
        ...(job?.signal ? { signal: job.signal } : {}),
      },
    ),
  );
  if (!a) throw new PermanentJobError('adresse refusée (réseau interne, port ou schéma non autorisé)');
  await saveAnalysis(a, { domain, businessId });
  // Agent de publication : brouillons à valider selon les réglages du client (jamais d'application ici).
  let agent: Record<string, unknown> | undefined;
  const crawl = captured.crawl;
  if (crawl) {
    const { runPublishAgent } = await import('@/lib/publish/agent');
    const r = await runPublishAgent(businessId, { findings: [...allFindings(a.seo), ...allFindings(a.geo)], crawl, name: b.name, ...(b.city ? { city: b.city } : {}), trigger: p.reason === 'scheduled' ? 'scheduled' : 'analysis' });
    agent = r.status === 'created' ? { created: r.created, proposed: r.proposed } : { skipped: r.reason };
  }
  log.info('job.analysis.rerun', { businessId, analysisId: a.id, global: a.scores.global, partial: a.partial, reason: String(p.reason ?? '') });
  return {
    analysisId: a.id,
    pages: a.crawl?.pagesFetched ?? 0,
    scores: a.scores,
    partial: a.partial,
    ...(agent ? { agent } : {}),
    ...(a.comparison ? { fixed: a.comparison.fixed.length, appeared: a.comparison.appeared.length } : {}),
  };
}

/** Réanalyse due ? (rythme de l'offre, dernière analyse du domaine) */
export function isReanalysisDue(freq: 'none' | 'monthly' | 'weekly', lastAt: string | null | undefined, now: Date): boolean {
  if (freq === 'none') return false;
  if (!lastAt) return true;
  const t = Date.parse(lastAt);
  return !Number.isFinite(t) || now.getTime() - t >= MIN_INTERVAL[freq];
}

export async function handleAnalysisScheduled(p: Record<string, unknown>): Promise<Record<string, unknown>> {
  const now = typeof p.now === 'string' && !Number.isNaN(Date.parse(p.now)) ? new Date(p.now) : new Date();
  const db = await import('@/lib/db');
  const { getEntitlements } = await import('@/lib/entitlements');
  const { enqueue } = await import('@/lib/jobs');
  const { periodKey } = await import('@/lib/jobs/platform');
  const candidates = await db.listBusinessesDueForAudit(0, 500);
  const jobIds: string[] = [];
  let notDue = 0;
  let noSite = 0;
  for (const b of candidates) {
    if (!b.website) {
      noSite++;
      continue;
    }
    const freq = getEntitlements(b).analysis.reanalysis;
    let last: string | undefined;
    try {
      last = (await domainHistory(analysisDomain(b.website)))[0]?.at;
    } catch {
      noSite++;
      continue;
    }
    if (freq === 'none' || !isReanalysisDue(freq, last, now)) {
      notDue++;
      continue;
    }
    const { id } = await enqueue('analysis.rerun', { businessId: b.id, reason: 'scheduled' }, { businessId: b.id, dedupeKey: `analysis.rerun:${b.id}:${periodKey(freq, now)}` });
    jobIds.push(id);
  }
  return { candidates: candidates.length, queued: jobIds.length, notDue, noSite, jobIds };
}
