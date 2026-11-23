/**
 * @/lib/content — agent de contenu V8 (docs/v8/00-BRIEF-V8.md ; journal docs/v8/progress/AGENT-CONTENU.md).
 *
 *   const ops = detectOpportunities({ audit, gsc, geo, pages, … });        // pages manquantes, preuves à l'appui
 *   const d = await createDraft(businessId, ops[0], ctx, actor);            // faits du client seulement
 *   await editDraft(…); await validateDraft(businessId, d.id, admin);       // « [à compléter] » bloque
 *   await pushDraft(businessId, d.id, admin, { tier, author });             // brouillon chez le client (quota)
 *   await publishDraft(…); await unpublishDraft(…); await removeDraft(…);   // en ligne / retour arrière
 *   mentionTargets({ domains, facts, … });                                  // mentions à obtenir (rien n'est envoyé)
 */
export * from './types';
export { FACT_LABEL, ESSENTIAL_FACTS, mergeFacts, sanitizeFacts, factValue, factLines, completeness } from './facts';
export { detectOpportunities, guessPageType, PAGE_TYPE_LABEL, MIN_GSC_IMPRESSIONS, THIN_WORDS, type DetectInput, type DetectPage } from './detect';
export { parseBody, bodyToHtml, bodyToText, todosOf, slugify, wordsOf, TODO_TEST, TODO_SPLIT, todo } from './markdown';
export { buildTemplate } from './templates';
export { citabilityOf, cannibalization, internalLinks, buildJsonLd, publicSourcesFor, structureChecks, faqPairs, type SitePage } from './checks';
export { buildDraft, finalizeDraft, acceptRewrite, defaultContentWriter, writerFromExtractor, type ContentWriter, type DraftContext, officialBlockFor, type OfficialBlocks } from './draft';
export { MONTHLY_QUOTA, QUOTA_NOTE, quotaView, usedThisMonth, type QuotaView } from './quota';
export { mentionTargets } from './mentions';
export { snapshot, startEffect, refreshEffect, compareEffect, EFFECT_DAYS, type EffectInputs, type EffectDelta } from './effect';
export { appendContentJournal, readContentJournal, listContentJournal, verifyContentJournal, CONTENT_ACTION_LABEL, type ContentJournalEntry, type ContentAction } from './journal';
export { buildDemoContent, type DemoContent, type DemoInput } from './demo';
