/**
 * @/lib/publish — agent de publication V5 (docs/v5/publication.md, docs/v5/00-BRIEF-V5.md).
 *
 *   const plan = await createChangeSets(businessId, findings, siteFromCrawl(crawl, { businessId }), actor);
 *   await proposeChangeSet(businessId, cs.id, actor);      // lit l'état réel (avant exact)
 *   await validateChangeSet(businessId, cs.id, admin);     // validation humaine explicite
 *   await applyChangeSet(businessId, cs.id, admin);        // écrit, relit, repère, remesure J+7
 *   await revertChangeSet(businessId, cs.id, admin);       // rétablit l'avant
 */
export * from './types';
export { planChanges, siteFromCrawl, inferKind, allowBotsInRobots, buildLlmsTxt, faqBlock, jsonLdBlock, type Plan, type PlanSite, type PlanPage, type PlanTarget, type PlanOptions } from './planner';
export { rulesWriter, createAiWriter, defaultWriter, writeText, unsupportedFacts, type TextWriter, type WriteTask } from './writer';
export { computeAfter, sameValue, TRANSITIONS } from './model';
export { CONNECTORS, connectorFor, buildExportBundle } from './connectors';
export { appendJournal, readJournal, listJournal, verifyJournal, type JournalEntry } from './journal';
export { createSafeHttp, setPublishHttp, publishHttp } from './http';
export { type PublishConnectionView } from './connections';
export {
  CHANGESETS,
  REMEASURE_DELAY_DAYS,
  connectPlatform,
  testPlatform,
  disconnectPlatform,
  listConnectionViews,
  planTargets,
  getChangeSet,
  listChangeSets,
  changeSetJournal,
  createChangeSets,
  proposeChangeSet,
  editChange,
  validateChangeSet,
  rejectChangeSet,
  applyChangeSet,
  verifyChangeSet,
  revertChangeSet,
  exportChangeSet,
} from './service';
export { demoChangeSets } from './demo';
