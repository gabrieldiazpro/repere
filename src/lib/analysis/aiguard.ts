/**
 * V8 (TEST-MARQUE) — garde-fous du test de marque public (appels payants aux IA) :
 *
 * | garde-fou                  | règle                                                                      | variable                          |
 * |----------------------------|----------------------------------------------------------------------------|-----------------------------------|
 * | cache 24 h par domaine     | même domaine + même marque/ville/type/activité : résultat repris, 0 appel   | ANALYSIS_BRAND_CACHE_HOURS (24)   |
 * | limite par domaine et jour | au-delà, résultat en cache s'il existe, sinon test non lancé                | ANALYSIS_AI_PER_DOMAIN_PER_DAY (3)|
 * | plafond quotidien (euros)  | estimation prudente avant appel ; au-delà, test non lancé jusqu'à minuit    | ANALYSIS_AI_DAILY_CAP_EUR (5)     |
 * | pause OPS                  | plafond global OPS_DAILY_COST_CAP_EUR dépassé (src/lib/ops/guard.ts)        | —                                 |
 *
 * En démonstration (aucune clé), aucun appel payant : aucun garde-fou de coût ne s'applique et rien n'est mis en cache.
 * Jamais bloquant : un store illisible n'empêche pas l'analyse (le test est alors lancé sans cache).
 */
import crypto from 'node:crypto';
import { DAY_MS, rateLimit } from '@/lib/ratelimit';
import { getDoc, incrDoc, putDoc } from '@/lib/store';
import { availableProviders, maxAiCallsFromEnv, planCalls, plannedCostEur, runQuickAiCheck } from './aicheck';
import type { AiCheckContext, AiCheckSummary } from './types';

export const BRAND_CACHE = 'analysis.brandtests';
export const BRAND_SPEND = 'analysis.brandspend';

const num = (k: string, d: number) => {
  const n = Number(String(process.env[k] ?? '').replace(',', '.'));
  return process.env[k] != null && process.env[k] !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};
export const brandLimits = () => ({
  cacheMs: num('ANALYSIS_BRAND_CACHE_HOURS', 24) * 3_600_000,
  perDomainDay: num('ANALYSIS_AI_PER_DOMAIN_PER_DAY', 3),
  dailyCapEur: num('ANALYSIS_AI_DAILY_CAP_EUR', 5),
});

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });
const parisDay = (d: Date) => dayFmt.format(d);

/** Clé de cache : domaine + ce qui change les questions (marque, ville, type, activité). */
export function brandCacheKey(domain: string, ctx: Pick<AiCheckContext, 'brand' | 'city' | 'siteType' | 'activity'>): string {
  const f = (s?: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return crypto.createHash('sha256').update(['brand-v1', f(domain), f(ctx.brand), f(ctx.city), ctx.siteType, f(ctx.activity)].join('|')).digest('hex').slice(0, 40);
}

interface CachedBrand {
  at: string;
  domain: string;
  summary: AiCheckSummary;
}

export async function cachedBrandTest(key: string, now: Date = new Date()): Promise<CachedBrand | null> {
  try {
    const d = await getDoc<CachedBrand>(BRAND_CACHE, key);
    if (!d || now.getTime() - Date.parse(d.data.at) > brandLimits().cacheMs) return null;
    return d.data;
  } catch {
    return null;
  }
}

async function spentToday(now: Date): Promise<number> {
  try {
    return ((await getDoc<{ milliEur?: number }>(BRAND_SPEND, parisDay(now)))?.data.milliEur ?? 0) / 1000;
  } catch {
    return 0;
  }
}

async function opsPaused(now: Date): Promise<boolean> {
  try {
    const { isCostPaused } = await import('@/lib/ops/guard');
    return await isCostPaused(now);
  } catch {
    return false;
  }
}

/**
 * Test de marque avec garde-fous. `domain` : domaine analysé (clé de cache et de limite).
 * `run` : remplaçable (tests). Renvoie null si le test n'est pas lancé (`ctx.onSkip` dit pourquoi).
 */
export async function guardedBrandTest(
  ctx: AiCheckContext,
  domain: string,
  deps: { run?: (c: AiCheckContext) => Promise<AiCheckSummary | null>; now?: Date } = {},
): Promise<AiCheckSummary | null> {
  const run = deps.run ?? runQuickAiCheck;
  const now = deps.now ?? new Date();
  const real = availableProviders();
  if (!real.length) return run(ctx); // démonstration : aucun coût, rien à garder
  const L = brandLimits();
  const key = brandCacheKey(domain, ctx);
  const hit = await cachedBrandTest(key, now);
  const reuse = (c: CachedBrand): AiCheckSummary => {
    const s: AiCheckSummary = { ...c.summary };
    if (s.test) {
      s.test = { ...s.test, reused: { at: c.at } };
      ctx.onPlan?.({ demo: false, questions: s.test.questions.map((q) => ({ id: q.id, text: q.text })), providers: s.test.providers.map((p) => ({ id: p.id, label: p.label })) });
    }
    return s;
  };
  if (hit) return reuse(hit);
  const quota = await rateLimit('analysis-ai-domain-d', domain, Math.max(1, L.perDomainDay), DAY_MS, { failClosed: true }).catch(() => ({ ok: true }));
  if (!quota.ok) {
    ctx.onSkip?.({ reason: 'domain_limit', message: 'Les IA ont déjà été interrogées plusieurs fois aujourd’hui pour ce site : le test de marque reprendra demain. L’analyse du site, elle, est complète.' });
    return null;
  }
  const plan = planCalls(real, ctx.maxCalls ?? maxAiCallsFromEnv());
  const estimate = plan.questions ? plannedCostEur(plan.providers, Math.min(5, plan.questions)) : 0;
  if ((await opsPaused(now)) || (L.dailyCapEur > 0 && (await spentToday(now)) + estimate > L.dailyCapEur)) {
    ctx.onSkip?.({ reason: 'cost_cap', message: 'Le budget quotidien du test de marque gratuit est atteint : il reprendra demain. L’analyse du site, elle, est complète.' });
    return null;
  }
  // Réserve l'estimation avant les appels (plusieurs analyses simultanées ne dépassent pas le plafond).
  try {
    await incrDoc(BRAND_SPEND, parisDay(now), { milliEur: Math.round(estimate * 1000) });
  } catch {
    /* compteur indicatif */
  }
  const r = await run(ctx);
  if (r?.test && !r.demo && r.test.questions.some((q) => q.cells.some((c) => c.status !== 'error'))) {
    try {
      await putDoc<CachedBrand>(BRAND_CACHE, key, { at: now.toISOString(), domain, summary: r });
    } catch {
      /* cache facultatif */
    }
  }
  return r;
}
