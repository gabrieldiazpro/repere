/** Point d'entrée du moteur d'audit (contrat 00b-CONTRATS-MODULES.md). */
import type { ScoreBand } from './types';

export * from './types';
export * from './types-v2';
export { runAudit, createMockAudit, buildExcerpts } from './audit';
export { buildActionPlan, topActions, evaluateTrigger, ACTIONS, type PlanContext } from './actions';
export { buildQueries, resolveTrade, tradeFamily, zoneInfo, TRADES } from './queries';
export { computeScore, citationStats, METHOD_VERSION, W as SCORE_WEIGHTS } from './scoring';
export { detectMention, norm, registrableDomain, buildVariants } from './detect';
export { selectedProviders, DEFAULT_PROVIDERS, createMockFacts, DEMO_ERROR_FIELD, DEMO_ERROR_PROVIDER } from './providers';

// ---- V2 (docs/v2/08-CONTRATS-V2.md) ----
export {
  buildSegmentQueries,
  buildBrandQueries,
  buildAuditQueries,
  buildPmeQueries,
  buildEcomQueries,
  isBrandQuery,
  segmentOf,
} from './queries-v2';
export {
  buildSourcesReport,
  analyzeSources,
  classifyDomain,
  normalizeUrl,
  domainFromPlatformLabel,
  scoreOpportunity,
  pickTop10,
  howToFor,
  CATEGORY_LABEL as SOURCE_CATEGORY_LABEL,
  CATEGORY_ACTIONS,
  CATEGORY_WEIGHT,
  type CollectedCitation,
  type DomainClass,
  type SourcesContext,
  type SourcesAnalysis,
} from './sources';
export { verifyPresence, robotsAllows, NO_FETCH } from './sources/presence';
export { buildPerception, buildPerceptionHeuristic, brandPassages, parsePerception, sentimentOf, type PerceptionRun } from './perception';
export { factCheck, checkClaims, compareFact, normalizePhone, normalizeAddress, parseTimeRanges, parsePrices } from './factcheck';
export { buildGaps, buildBenchmark, cohortLabel, ordinalSup } from './insights';

// ---- V3 (docs/v3/12-CONTRATS-V3.md, ligne MOTEUR) ----
export * from './types-v3';
export { resolveAuditQueries, normalizeCustomQuery, withTheme, themeOf, angleOf, inferAngle, THEME_LABEL } from './queries-v3';
export { computeMargins, buildVoiceMatrix, mergeUrlHistory } from './analytics';
export { auditCounts, queryCounts, scoredMentions, sentimentShares, reconcilePerception, auditDate } from './coherence';
export { explainChange, changeConfidence, type ExplainSource } from './explain';
export { buildContentBrief, queryGaps, isQueryGap, isCompetitorGap, type BriefTarget, type BriefContext } from './brief';
export { aggregateUrls } from './sources';
export { mistralModel, MISTRAL_COST_PER_CALL_EUR } from './providers';
export type { MockAuditOptions } from './audit';

export const SCORE_BANDS: ScoreBand[] = [
  { min: 0, max: 39, label: 'Invisible', color: '#B91C1C', bg: '#FCEAEA', ink: '#991B1B' },
  { min: 40, max: 69, label: 'Peu visible', color: '#B45309', bg: '#FDF1E3', ink: '#92400E' },
  { min: 70, max: 100, label: 'Bien recommandé', color: '#15803D', bg: '#E7F5EC', ink: '#166534' },
];

/** Bande de lecture du score (jauge 0–39 / 40–69 / 70–100). */
export function scoreBand(score: number): ScoreBand {
  const s = Math.max(0, Math.min(100, Math.round(Number.isFinite(score) ? score : 0)));
  return SCORE_BANDS.find((b) => s >= b.min && s <= b.max) ?? SCORE_BANDS[0];
}
