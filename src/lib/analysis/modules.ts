/**
 * Branchement des modules orchestrés. Chaque entrée est remplaçable (tests).
 * État (INTEGRATION-V5, 13 nov. 2026) : CRAWL `crawlSite`, SEO-AUDIT `auditSeo`, GEO-OPT `runGeo` (IA si configurée,
 * sinon `auditGeo` pur), SEO-DATA `GooglePerfProvider` (PageSpeed + CrUX, mobile) — tous réels. Les audits reçoivent
 * le crawl COMPLET (HTML compris) : `publicCrawl()` ne s'applique qu'à ce qui sort vers le client.
 */
import { runQuickAiCheck } from './aicheck';
import type { AnalysisModules, PagespeedResult, RunAnalysisOptions } from './types';

/** Délai maximal d'un appel IA de GEO-OPT dans l'analyse publique (sous-questions, réécritures). */
const GEO_LLM_TIMEOUT_MS = 12_000;
/** Réécritures IA de passages dans l'analyse publique (coût maîtrisé ; l'app en fait davantage). */
const GEO_REWRITES = 3;

/**
 * PageSpeed mobile de la page d'accueil (SEO-DATA). null sans PAGESPEED_API_KEY / CRUX_API_KEY : rien n'est estimé.
 * Renvoie le résumé public ET la mesure brute `PerfData` (transmise à `auditSeo`, jamais stockée telle quelle).
 */
export async function measureHomePerf(url: string, signal?: AbortSignal): Promise<PagespeedResult | null> {
  const { perfConfigured, GooglePerfProvider } = await import('@/lib/seodata/perf');
  if (!perfConfigured()) return null;
  const perf = await new GooglePerfProvider().measure(url, { devices: ['mobile'], signal });
  const m = perf.devices.mobile;
  if (!m) return null;
  return {
    strategy: 'mobile',
    url,
    performance: m.lab?.performance ?? null,
    lcpMs: m.field?.lcpMs ?? m.lab?.lcpMs ?? null,
    cls: m.field?.cls ?? m.lab?.cls ?? null,
    inpMs: m.field?.inpMs ?? null,
    field: Boolean(m.field),
    source: m.field?.source === 'crux' ? 'PageSpeed Insights + CrUX' : 'PageSpeed Insights',
    perf,
  };
}

export function defaultModules(): AnalysisModules {
  return {
    async crawl(url, opts) {
      const { crawlSite } = await import('@/lib/crawl/crawl');
      return crawlSite(url, opts);
    },
    async seo(crawl, opts) {
      const { auditSeo } = await import('@/lib/seoaudit');
      return auditSeo(crawl, { siteType: opts?.siteType, ...(opts?.perf ? { perf: opts.perf } : {}) });
    },
    async geo(crawl, ctx) {
      const { runGeo, auditGeo } = await import('@/lib/geo');
      const geoCtx = { brand: ctx.brand, siteType: ctx.siteType, city: ctx.city, ...(ctx.activity ? { trade: ctx.activity } : {}) };
      try {
        return await runGeo(crawl, geoCtx, { timeoutMs: GEO_LLM_TIMEOUT_MS, rewriteCount: GEO_REWRITES });
      } catch {
        // Panne du fournisseur d'IA : audit déterministe (aucune réécriture IA, rien d'inventé).
        return auditGeo(crawl, geoCtx);
      }
    },
    pagespeed: (url, signal) => measureHomePerf(url, signal),
    aiCheck: (ctx) => runQuickAiCheck(ctx),
  };
}

export function resolveModules(over?: Partial<AnalysisModules>): AnalysisModules {
  const base = defaultModules();
  if (!over) return base;
  const provisional = { ...base.provisional };
  for (const k of ['seo', 'geo'] as const) if (over[k]) delete provisional[k];
  return { ...base, ...over, provisional: over.provisional ?? provisional };
}

/**
 * Surcharges des options de la route publique (tests de bout en bout uniquement : modules injectés, budgets courts).
 * Jamais alimentées par la requête HTTP.
 */
const g = globalThis as unknown as { __repereAnalysisRouteOpts?: Partial<RunAnalysisOptions> };
export function setAnalysisRouteOverrides(o: Partial<RunAnalysisOptions> | undefined): void {
  g.__repereAnalysisRouteOpts = o;
}
export function analysisRouteOverrides(): Partial<RunAnalysisOptions> {
  return g.__repereAnalysisRouteOpts ?? {};
}
