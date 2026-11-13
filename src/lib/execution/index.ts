/**
 * Module EXÉCUTION — « on le fait pour vous » (docs/v2/04-execution.md, contrat 08-CONTRATS-V2.md).
 * Serveur uniquement (store, fetch LLM).
 */
import type { BrandFactField, ExecTask, FactCheckItem } from '@/lib/engine/types-v2';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { loadExecContext } from './context';
import { seedDemoExec } from './demo';
import { buildFaq, buildJsonLd } from './jsonld';
import { listStoredTasks, putTask, saveGeneratedTasks, saveSettings, weeklyFromStore } from './repo';
import { buildCtx, buildDrafts, generateTasksAsync } from './tasks';
import type { StoredTask } from './types';
import { shortHash } from './util';

export { generateTasks, generateTasksAsync, officialDescription, priority, GBP_DESCRIPTION_MAX } from './tasks';
export { buildJsonLd, buildFaq, jsonLdScriptTag, jsonLdString, validateJsonLd, schemaTypeFor, parseOpeningHours, toFactsMap } from './jsonld';
export { reviewKit, draftReviewReply, draftReviewReplyAsync, googleReviewUrl, REVIEW_RULES } from './reviews';
export { qrSvg, qrServiceUrl, encodeQr } from './qr';
export { seedDemoExec, withDemoV2 } from './demo';
export { pickWeekly } from './weekly';
export { updateTaskStatus, getSettings, saveSettings, findBusinessIdBySlug, SlugTakenError, TASKS_COLLECTION, SETTINGS_COLLECTION } from './repo';
export { loadExecContext, type ExecContext } from './context';
export { llmAvailable } from './llm';
export type * from './types';

/** Contrat : toutes les tâches du commerce (amorce la démo si besoin). */
export async function listTasks(businessId: string): Promise<ExecTask[]> {
  // Démo : (ré)amorcée si vide ou si les gabarits ont changé (version dans seedDemoExec).
  if (isDemoBusinessId(businessId)) await seedDemoExec(businessId);
  const tasks = await listStoredTasks(businessId);
  return tasks.filter((t) => t.status !== 'skipped' || t.key?.startsWith('custom:'));
}

/** Contrat : les 3 tâches de la semaine (stables sur la semaine). */
export async function weeklyTasks(businessId: string, now: Date = new Date()): Promise<ExecTask[]> {
  if (isDemoBusinessId(businessId)) await seedDemoExec(businessId);
  return weeklyFromStore(businessId, now);
}

/** Régénère les tâches depuis le dernier audit (LLM si clé disponible), en conservant les statuts. */
export async function regenerateTasks(businessId: string): Promise<{ tasks: ExecTask[]; llm: boolean } | null> {
  const ctx = await loadExecContext(businessId);
  if (!ctx) return null;
  if (!ctx.audit) return { tasks: await listTasks(businessId), llm: false };
  const settings = await saveSettings(businessId, { segment: ctx.segment }); // fige le slug de la page hébergée
  const generated = await generateTasksAsync(ctx.audit, ctx.facts, { businessId, segment: ctx.segment, settings });
  const saved = await saveGeneratedTasks(businessId, generated);
  return { tasks: saved.filter((t) => t.status !== 'skipped'), llm: generated.some((t) => t.llm) };
}

/** Bouton « Corriger » de l'onglet Vérité : crée (ou met à jour) la tâche fact_fix correspondante. */
export async function createFactFixTask(
  businessId: string,
  item: Pick<FactCheckItem, 'field' | 'expected' | 'stated' | 'provider'> & Partial<Pick<FactCheckItem, 'quote' | 'severity'>>,
): Promise<ExecTask | null> {
  const ctx = await loadExecContext(businessId);
  if (!ctx) return null;
  const full: FactCheckItem = { quote: item.stated, severity: 'haute', verdict: 'faux', ...item };
  const base = ctx.audit ?? ({ input: { businessName: ctx.business.name, trade: ctx.business.trade, city: ctx.business.city, district: ctx.business.district, website: ctx.business.website }, queries: [], competitors: [], score: 0 } as unknown as NonNullable<typeof ctx.audit>);
  const audit = { ...base, factCheck: { checkedAt: new Date().toISOString(), items: [full], errors: 1 } };
  const c = buildCtx(audit, ctx.facts, { businessId, segment: ctx.segment, settings: ctx.settings });
  const draft = buildDrafts(c).find((d) => d.kind === 'fact_fix');
  if (!draft) return null;
  const existing = (await listStoredTasks(businessId)).find((t) => t.key === draft.key && t.status !== 'done');
  const task: StoredTask = {
    id: existing?.id ?? `t_${shortHash(`${businessId}:${draft.key}`, 12)}`,
    businessId,
    kind: 'fact_fix',
    title: draft.title,
    why: draft.why,
    automation: draft.automation,
    minutes: draft.minutes,
    impact: draft.impact,
    status: existing?.status ?? 'todo',
    deliverable: draft.deliverable,
    steps: draft.steps,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    key: draft.key,
    event: true,
    week: existing?.week,
  };
  return putTask(task);
}

/** Tâche libre ajoutée par le client (POST /api/exec/tasks). */
export async function createCustomTask(businessId: string, t: { title: string; why?: string; minutes?: number; impact?: 1 | 2 | 3; steps?: string[] }): Promise<ExecTask> {
  const now = new Date().toISOString();
  const key = `custom:${shortHash(`${t.title}:${now}`, 8)}`;
  return putTask({
    id: `t_${shortHash(`${businessId}:${key}`, 12)}`,
    businessId,
    kind: 'other',
    title: t.title,
    why: t.why ?? '',
    automation: 'guide',
    minutes: t.minutes ?? 15,
    impact: t.impact ?? 1,
    status: 'todo',
    steps: t.steps ?? [],
    createdAt: now,
    key,
  });
}

// ---------------------------------------------------------------------------
// JSON-LD servi côté serveur (cache mémoire 10 min)
// ---------------------------------------------------------------------------
const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://repere-ia.fr').replace(/\/$/, '');
const schemaCache = new Map<string, { at: number; data: Record<string, unknown> }>();
const SCHEMA_TTL_MS = 10 * 60 * 1000;

export function hostedPageUrl(slug: string): string {
  return `${SITE}/p/${slug}`;
}

/** JSON-LD complet d'un commerce (Organization/LocalBusiness/Product + FAQPage de la page hébergée). */
export async function schemaForBusiness(businessId: string, opts: { withFaq?: boolean; fresh?: boolean } = {}): Promise<Record<string, unknown> | null> {
  const key = `${businessId}:${opts.withFaq ? 1 : 0}`;
  const hit = schemaCache.get(key);
  if (hit && !opts.fresh && Date.now() - hit.at < SCHEMA_TTL_MS) return hit.data;
  const ctx = await loadExecContext(businessId);
  if (!ctx || ctx.settings.published === false) return null;
  const faq = opts.withFaq ? buildFaq(ctx.audit ?? { input: { businessName: ctx.business.name, trade: ctx.business.trade, city: ctx.business.city, segment: ctx.segment } }, ctx.facts, ctx.business) : [];
  const data = buildJsonLd(ctx.business, ctx.facts, ctx.segment, {
    settings: ctx.settings,
    faq,
    pageUrl: opts.withFaq ? hostedPageUrl(ctx.settings.slug) : undefined,
  });
  schemaCache.set(key, { at: Date.now(), data });
  return data;
}

export function clearSchemaCache(businessId?: string): void {
  for (const k of schemaCache.keys()) if (!businessId || k.startsWith(`${businessId}:`)) schemaCache.delete(k);
}

export type { BrandFactField };
