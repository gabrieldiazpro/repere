/**
 * @/lib/seodata — données SEO externes de Repéré V5 (agent SEO-DATA ; recherche et coûts : docs/v5/donnees-seo.md).
 *
 *   const { ctx, p } = await providersForBusiness(businessId);   // réel / démo / non configuré
 *   await perfView(ctx, p, url)       // PageSpeed + CrUX → PerfData
 *   await gscOverviewView(ctx, p)     // Search Console (16 mois importés, synchro quotidienne)
 *   buildReport(ctx, config, await rankHistory(ctx, p))           // suivi de positions
 *   pagespeedSummary(url, signal)     // adaptateur ANALYSE-60S
 */
export * from './types';
export { SeoDataError, setSeoDataEndpoints, DEFAULT_ENDPOINTS, weekKey, hostOf, sameSite } from './http';
export { SEODATA_LIMITS, limitsFor, estimateMonthlyEur, serpCostUsd, PRICES_USD, type SeoDataLimits } from './limits';
export { reserve, budgetView, getLedger, COSTS, type CostLedger, type BudgetView } from './cost';
export { GooglePerfProvider, pagespeedSummary, perfConfigured, rate, PERF_THRESHOLDS, type PerfProvider } from './perf';
export * as googleOAuth from './google-oauth';
export { GoogleSearchConsole, syncSearchConsole, dropSearchConsoleData, overviewOf, totalsOf, searchConsoleFor, listSitesWithToken } from './searchconsole';
export { DataForSeoClient, DataForSeoKeywords, DataForSeoSerp, DataForSeoBacklinks, dataForSeoConfigured, parseSerp, FRANCE } from './dataforseo';
export { BingWebmaster, connectBing, disconnectBing, getBingConnection } from './bing';
export { DEMO_SPECS, DEMO_NOTE, ctrAt } from './demo';
export { contextFor, providersFor, providersForBusiness, locationFor, type SeoDataContext, type ProviderSet } from './providers';
export {
  getRankConfig, addKeywords, removeKeywords, setCompetitors, runWeekly, collectWeekly, rankHistory, buildReport, suggestKeywords, normalizeKeyword,
  type RankConfig, type RankSnapshot, type RankReport, type KeywordReport, type KeywordSuggestion,
} from './rank';
export { statusView, gscOverviewView, perfView, backlinksView, bingView } from './service';
export { SEODATA_JOB_TYPES, SEODATA_PRIORITY, registerSeoDataJobs, dispatch, scheduleSeoData } from './jobs';
