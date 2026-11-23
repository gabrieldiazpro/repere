/**
 * @/lib/scenarios — simulateur « Et si je corrigeais ces points ? » (V9, docs/v9/00-BRIEF-V9.md).
 *
 *   const auditor = (c) => auditBoth(c, ws, perf);                 // la fonction d'audit de l'app, telle quelle
 *   const base = auditor(crawl);
 *   const ranked = rankCandidates(crawl, auditor, base);
 *   const scenarios = buildScenarios(crawl, auditor, base, ranked);
 *   const custom = simulate(crawl, auditor, base, keys);
 *   await launchScenario({ … });                                     // brouillons + tâches, rien de publié
 */
export * from './types';
export { HONESTY, METHOD, MINUTES, WHO_LABEL, WHO_HINT, MAX_ALONE, whoOf, minutesOf, keyOf, locate, candidatesOf, simulate, lean, rankCandidates, gainOf, buildScenarios } from './engine';
export { applyFinding, unsimulableReason, cloneCrawl } from './apply';
export { followUp, nextRunAfter } from './follow';
