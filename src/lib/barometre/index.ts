/** Baromètres publics « Qui les IA recommandent » (V5). Voir docs/v5/barometres.md. */
export * from './types';
export { CATALOG, LAUNCH_ORDER, DEFAULT_MAX_BAROMETRES, barometreMax, launchCatalog, getDef, questionsFor, providersFor, runsFor, validateCatalog, defaultProviders, engineInput, slugify } from './catalog';
export { COST_PER_CALL_EUR, EXTRACT_COST_EUR, estimateCost, estimateMonthly, monthlyBudget, planWithinBudget } from './cost';
export { mergeNames, nameContext, nameKey, cleanName, isVerifiable, looksLikePersonName, withdrawalKey } from './names';
export { aggregateEdition, aggregateSources, MIN_COMPLETION, BOOTSTRAP_B } from './aggregate';
export { createSimulatedProvider, simulatedAnswer, SIMULATION_MODEL } from './simulate';
export { runBarometre, runMonthly, answerKey, type RunOptions, type RunResult } from './pipeline';
export {
  COLL,
  isPublishable,
  saveEdition,
  getEdition,
  listEditions,
  addWithdrawal,
  withdrawnKeys,
  loadBudget,
  BudgetLedger,
  DemoPublicationError,
  currentPeriod,
  previousPeriod,
  MIN_VALID_ANSWERS,
  MIN_RANKED,
} from './storage';
export {
  getPublicEdition,
  getPageData,
  listPublished,
  publishedEntries,
  editionToCsv,
  demoPreviewAllowed,
  applyWithdrawals,
  barometrePath,
  csvPath,
  pct,
  periodLabel,
  providerList,
  BAROMETRE_BASE,
} from './public';
export { barometreJobHandler, registerBarometreJob, BAROMETRE_JOB } from './job';
