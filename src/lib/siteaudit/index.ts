/**
 * Module AUDIT-SITE : fonctions serveur équivalentes aux endpoints /api/tools/* (contrat docs/v3/12-CONTRATS-V3.md).
 * Aucune clé d'IA nécessaire (sauf le mode facultatif « avec IA » de la citabilité).
 */
export * from './types';
export { AI_BOTS, BOTS_VERSION, ROLE_LABELS, SEARCH_CRITICAL } from './bots';
export {
  safeFetch,
  tryFetch,
  normalizeInputUrl,
  resolvePublic,
  isBlockedIp,
  setFetchDeps,
  clearFetchCache,
  resetFetchState,
  SafeFetchError,
  USER_AGENT,
  BOT_TOKEN,
  TIMEOUT_MS,
  MAX_BYTES,
  CACHE_TTL_MS,
  type SafeFetchOptions,
  type SafeResponse,
  type SafeFetchErrorCode,
  type Resolver,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from './fetch';
export { parseRobots, decide, isAllowed, groupsFor, patternMatches, disallowedPaths, type ParsedRobots, type RobotsGroup, type RobotsRule } from './robots';
export { analyzeRobots, robotsReportFromText, verdictsFor, recommendedRobots, ROBOTS_LIMITS } from './robotsAudit';
export { parseHtml, stripTags, wordCount, type ParsedPage } from './html';
export {
  auditReadiness,
  auditPage,
  readinessFromSnapshot,
  renderReport,
  fetchPageSnapshot,
  findSitemap,
  findLlmsTxt,
  READINESS_LIMITS,
  LLMS_NOTE,
  WEIGHTS as READINESS_WEIGHTS,
  type PageSnapshot,
  type ReadinessExtras,
} from './readiness';
export { auditCitability, citabilityFromHtml, citableExtracts, withAiRewrite, CITABILITY_DISCLAIMER, CITABILITY_WEIGHTS, type CitabilityOptions } from './citability';
export { auditProduct, productFromHtml, extractProduct, suggestedProductJsonLd, PRODUCT_WEIGHTS } from './product';
export { compareSites, compareSides, COMPARE_DISCLAIMER } from './compare';
export {
  generateJsonLd,
  validateJsonLdText,
  validateJsonLdValue,
  validateJsonLdUrl,
  validateBlocks,
  microdataTypes,
  GENERATE_TYPES,
  JSONLD_NOTE,
  type GenerateType,
  type GenerateFields,
  type GenerateResult,
} from './jsonld';
export { generateLlms, buildLlmsTxt, validateLlmsTxt, LLMS_HONEST, LLMS_INSTRUCTIONS, type LlmsResult, type LlmsPage } from './llms';
export { buildReviewLink, extractPlaceId, PLACE_ID_FINDER, REVIEW_LINK_NOTE, type ReviewLinkInput, type ReviewLinkResult } from './reviewLink';
export { runSiteAudit, listRuns, getRun, runSiteAuditJob, RUNS_COLLECTION, type SiteAuditRun, type RunKind, type RunOptions } from './runs';
