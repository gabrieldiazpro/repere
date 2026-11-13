/**
 * Questions suivies (agent QUESTIONS) : point d'entrée public.
 * Écran « Questions » et « Réponses » (vague 2b) : passer par ces fonctions ou par /api/prompts.
 */
export * from './types';
export { normalizeQuestion, isDuplicate, dedupeTexts, classifyIntent, validateText, cleanTags, SUGGESTED_TAGS, SIMILARITY_THRESHOLD } from './text';
export { demandIndex, DEMAND_LABEL, type DemandContext } from './demand';
export {
  COLLECTION,
  listPrompts,
  getPrompt,
  createPrompt,
  updatePrompt,
  deletePrompt,
  quotaOf,
  buildPrompt,
  ensureInitialPrompts,
  toView,
  demandContext,
  type Quota,
  type ListFilter,
} from './repo';
export { suggestPrompts, matchesSuggestion, SUGGESTION_COUNT, type SuggestContext } from './suggest';
export { parseImport, planImport, exportCsv, MAX_IMPORT_LINES, MAX_IMPORT_BYTES, type ImportPlan, type ImportRejection } from './io';
export { buildHistory, highlightText, findAll, type PromptHistory, type HistoryPoint, type HistoryAnswer, type Highlight } from './history';
export { promptsToQueries, promptToQuery, queryIdOf, intentOfQuery } from './engine';
export { demoPrompts, findDemoPrompt } from './demo';
export { importPrompts, suggestForBusiness, historyForPrompt, type ImportResult } from './service';
