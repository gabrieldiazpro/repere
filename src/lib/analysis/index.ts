/** ANALYSE-60S — point d'entrée (docs/v5/00-BRIEF-V5.md). */
export * from './types';
export { runFullAnalysis, collectAnalysis, analysisDomain, summarizeCrawl, DEFAULT_BUDGET_MS, CRAWL_MAX_PAGES, CRAWL_BUDGET_MS } from './run';
export { detectSite, homeSignals, nameFromDomain, cityFromText } from './detect';
export { accessReport, accessFinding, adaptFinding, platformTip, type AccessReport, type AccessTone } from './access';
export { mergePriorities, computeScores, buildVerdict, compareAnalyses, autoFixesOf, priorityOf, allFindings } from './prioritize';
export { buildQuickQuestions, planCalls, availableProviders, runQuickAiCheck, maxAiCallsFromEnv, brandTestEngines, knownProviders, DEFAULT_MAX_AI_CALLS } from './aicheck';
export { buildBrandTest, wilson, sentenceWith, competitorSite, competitorsByQuestion, engineLabel } from './brandtest';
export { guardedBrandTest, brandCacheKey, brandLimits } from './aiguard';
export { draftWhy, finalizeWhy } from './why';
export { pageSignals, siteSignals, SIGNAL_LABEL } from './signals';
export { defaultModules, resolveModules, setAnalysisRouteOverrides, analysisRouteOverrides } from './modules';
export {
  saveAnalysis,
  getStoredAnalysis,
  tokenMatches,
  issueToken,
  cachedAnalysis,
  previousAnalysis,
  domainHistory,
  attachAnalysisToBusiness,
  analysisRequestedBy,
  listAnalysesForBusiness,
  toPublicAnalysis,
  analysisShareUrl,
  CACHE_TTL_MS,
  type StoredAnalysis,
} from './store';
