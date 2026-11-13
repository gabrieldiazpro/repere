/**
 * Questions suivies : CRUD persisté dans le store (collection `prompts.items`), quotas via getEntitlements.
 * Comptes démo : questions calculées en mémoire (demo.ts), jamais écrites.
 */
import { randomUUID } from 'node:crypto';
import type { Business } from '@/lib/db';
import { getLatestAuditForBusiness } from '@/lib/db';
import { DEMO_READ_ONLY, isDemoBusinessId } from '@/lib/demo-v2';
import { ALL_PROVIDERS, type ProviderId } from '@/lib/engine/types';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import { getEntitlements, HttpError } from './adapters';
import { demandIndex, type DemandContext } from './demand';
import { demoPrompts, findDemoPrompt } from './demo';
import { intentOfQuery } from './engine';
import { classifyIntent, cleanTags, cleanTheme, findDuplicate, isIntent, tagsForIntent, validateText } from './text';
import { INTENT_LABEL, INTENT_STAGE, type PromptInput, type PromptPatch, type PromptView, type TrackedPrompt } from './types';

export const COLLECTION = 'prompts.items';
export const META_COLLECTION = 'prompts.meta';
const MAX_LIST = 2000;

export function newPromptId(): string {
  return `p_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

export const PROMPT_ID_RE = /^[A-Za-z0-9_-]{1,100}$/;

function assertWritable(businessId: string) {
  if (isDemoBusinessId(businessId)) throw new HttpError(403, DEMO_READ_ONLY);
}

function cleanProviders(raw: unknown): ProviderId[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw.filter((p): p is ProviderId => (ALL_PROVIDERS as string[]).includes(p as string) || p === 'mistral');
  return out.length ? [...new Set(out)] : undefined;
}

/** Contexte de l'indice de demande pour un commerce. */
export function demandContext(business: Pick<Business, 'name' | 'city' | 'district'>, competitors: string[] = []): DemandContext {
  return { city: business.city, district: business.district, names: [business.name, ...competitors].filter(Boolean) };
}

export function toView(p: TrackedPrompt, ctx: DemandContext = {}): PromptView {
  return {
    ...p,
    intentLabel: INTENT_LABEL[p.intent],
    stage: INTENT_STAGE[p.intent],
    demand: demandIndex(p.text, p.intent, ctx),
    ...(isDemoBusinessId(p.businessId) ? { demo: true } : {}),
  };
}

export interface ListFilter {
  active?: boolean;
  tag?: string;
  intent?: string;
  theme?: string;
}

export async function listPrompts(businessId: string, filter: ListFilter = {}): Promise<TrackedPrompt[]> {
  const all = isDemoBusinessId(businessId)
    ? demoPrompts(businessId)
    : (await listDocs<TrackedPrompt>(COLLECTION, { businessId, limit: MAX_LIST })).map((d) => d.data);
  return all
    .filter((p) => filter.active === undefined || p.active === filter.active)
    .filter((p) => !filter.tag || p.tags.includes(filter.tag.toLowerCase()))
    .filter((p) => !filter.intent || p.intent === filter.intent)
    .filter((p) => !filter.theme || p.theme.toLowerCase() === filter.theme.toLowerCase())
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

export async function getPrompt(id: string): Promise<TrackedPrompt | null> {
  if (!PROMPT_ID_RE.test(id)) return null;
  const demo = findDemoPrompt(id);
  if (demo) return demo;
  const doc = await getDoc<TrackedPrompt>(COLLECTION, id);
  return doc?.data ?? null;
}

export interface Quota {
  limit: number;
  used: number;
  remaining: number;
}

export async function quotaOf(business: Business, prompts?: TrackedPrompt[]): Promise<Quota> {
  const limit = getEntitlements(business).prompts;
  const list = prompts ?? (await listPrompts(business.id));
  const used = list.filter((p) => p.active).length;
  return { limit, used, remaining: Math.max(0, limit - used) };
}

/** Construit (sans l'écrire) une question valide, ou lève HttpError(400). */
export function buildPrompt(business: Pick<Business, 'id' | 'name'>, input: PromptInput, now = new Date()): TrackedPrompt {
  const v = validateText(input.text);
  if (!v.ok) throw new HttpError(400, v.error);
  const intent = isIntent(input.intent) ? input.intent : classifyIntent(v.text, [business.name]);
  const tags = cleanTags(input.tags ?? tagsForIntent(intent));
  return {
    id: newPromptId(),
    businessId: business.id,
    text: v.text,
    theme: cleanTheme(input.theme) ?? INTENT_LABEL[intent],
    tags,
    intent,
    origin: input.origin === 'gabarit' || input.origin === 'suggestion' ? input.origin : 'client',
    active: input.active !== false,
    createdAt: now.toISOString(),
    ...(input.queryId && /^[A-Za-z0-9_-]{1,40}$/.test(input.queryId) ? { queryId: input.queryId } : {}),
    ...(cleanProviders(input.providers) ? { providers: cleanProviders(input.providers) } : {}),
  };
}

/**
 * Crée une question. Refus : doublon (409, avec la question existante), quota de questions actives atteint (402).
 */
export async function createPrompt(business: Business, input: PromptInput): Promise<TrackedPrompt> {
  assertWritable(business.id);
  const p = buildPrompt(business, input);
  const existing = await listPrompts(business.id);
  const dup = findDuplicate(p.text, existing);
  if (dup) throw Object.assign(new HttpError(409, 'Cette question est déjà suivie (ou très proche d\'une question suivie).'), { duplicateOf: dup.id });
  if (p.active) {
    const q = await quotaOf(business, existing);
    if (q.remaining <= 0) throw new HttpError(402, `Quota atteint : ${q.limit} questions actives dans votre offre. Mettez une question en pause ou changez d'offre.`);
  }
  await putDoc(COLLECTION, p.id, p, business.id);
  return p;
}

export async function updatePrompt(business: Business, id: string, patch: PromptPatch): Promise<TrackedPrompt> {
  assertWritable(business.id);
  const prev = await getPrompt(id);
  if (!prev || prev.businessId !== business.id) throw new HttpError(404, 'Question introuvable.');
  const next: TrackedPrompt = { ...prev };
  const others = (await listPrompts(business.id)).filter((p) => p.id !== id);
  if (patch.text !== undefined) {
    const v = validateText(patch.text);
    if (!v.ok) throw new HttpError(400, v.error);
    if (v.text !== prev.text) {
      const dup = findDuplicate(v.text, others);
      if (dup) throw Object.assign(new HttpError(409, 'Une question très proche est déjà suivie.'), { duplicateOf: dup.id });
      next.text = v.text;
      // Nouveau texte = nouvelle série : l'identifiant de gabarit ne s'applique plus.
      delete next.queryId;
    }
  }
  if (patch.intent !== undefined) {
    if (!isIntent(patch.intent)) throw new HttpError(400, 'Intention inconnue.');
    next.intent = patch.intent;
  }
  if (patch.theme !== undefined) next.theme = cleanTheme(patch.theme) ?? INTENT_LABEL[next.intent];
  if (patch.tags !== undefined) next.tags = cleanTags(patch.tags);
  if (patch.providers !== undefined) {
    const pr = cleanProviders(patch.providers);
    if (pr) next.providers = pr;
    else delete next.providers;
  }
  if (patch.active !== undefined) {
    next.active = patch.active === true;
    if (next.active && !prev.active) {
      const q = await quotaOf(business, others);
      if (q.remaining <= 0) throw new HttpError(402, `Quota atteint : ${q.limit} questions actives dans votre offre.`);
    }
  }
  next.updatedAt = new Date().toISOString();
  await putDoc(COLLECTION, id, next, business.id);
  return next;
}

/** Suppression définitive (la désactivation, elle, conserve la question et son historique). */
export async function deletePrompt(business: Business, id: string): Promise<void> {
  assertWritable(business.id);
  const prev = await getPrompt(id);
  if (!prev || prev.businessId !== business.id) throw new HttpError(404, 'Question introuvable.');
  await deleteDoc(COLLECTION, id);
}

/**
 * Premier chargement d'un commerce réel sans question : on reprend les questions de son dernier audit
 * (origine « gabarit », identifiant de requête conservé pour la continuité de l'historique), dans la limite du quota.
 * Une seule fois par commerce (marqueur `prompts.meta`), même si le client supprime ensuite tout.
 */
export async function ensureInitialPrompts(business: Business): Promise<TrackedPrompt[]> {
  if (isDemoBusinessId(business.id)) return demoPrompts(business.id);
  const existing = await listPrompts(business.id);
  if (existing.length) return existing;
  const meta = await getDoc<{ seededAt?: string }>(META_COLLECTION, business.id);
  if (meta?.data?.seededAt) return existing;
  const audit = await getLatestAuditForBusiness(business.id).catch(() => null);
  // Sans audit : rien à semer, et surtout pas de marqueur (sinon le premier audit ne sèmerait jamais les questions).
  if (!audit) return existing;
  await putDoc(META_COLLECTION, business.id, { seededAt: new Date().toISOString(), fromAudit: audit.id }, business.id);
  const limit = getEntitlements(business).prompts;
  const out: TrackedPrompt[] = [];
  for (const q of audit.queries) {
    const intent = intentOfQuery(q);
    if (findDuplicate(q.text, out)) continue;
    const p = buildPrompt(business, { text: q.text, intent, origin: 'gabarit', queryId: q.id, active: out.filter((x) => x.active).length < limit });
    out.push(p);
    await putDoc(COLLECTION, p.id, p, business.id);
  }
  return listPrompts(business.id);
}
