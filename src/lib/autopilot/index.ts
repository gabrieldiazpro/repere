/**
 * @/lib/autopilot — offre « Pilote automatique » (tout fait pour vous, sans rendez-vous). Journal :
 * docs/v10/progress/PILOTE-AUTO.md.
 *
 *   signMandate(businessId, { categories, accepted: true, signer, … })   // accord écrit, une fois, par catégorie
 *   runAutopilot(businessId, { trigger: 'analysis', findings, crawl, site, analysis })  // après chaque analyse
 *   sweepAutopilot(now)                                                   // chaque jour : contenus à 72 h, récap du lundi
 *   undoSeries / blockContent / pauseMandate / revokeMandate              // le client garde la main, en un clic
 */
export * from './mandate';
export * from './policy';
export { buildRecap, recapEmail, isRecapDue, type Recap, type EffectLine } from './recap';
export {
  AutopilotError,
  getMandate,
  signMandate,
  pauseMandate,
  resumeMandate,
  revokeMandate,
  getState,
  listAutopilotJournal,
  verifyAutopilotJournal,
  type AutopilotState,
  type SeriesRecord,
  type ContentSchedule,
  type AutopilotJournalEntry,
} from './store';
export { runAutopilot, sweepAutopilot, sweepBusiness, type AutopilotDeps, type RunResult } from './runner';
export { undoSeries, blockContent, pauseFromLink } from './actions';
export { signActionToken, verifyActionToken, actionUrl } from './tokens';
export { demoAutopilot, type AutopilotView } from './demo';
