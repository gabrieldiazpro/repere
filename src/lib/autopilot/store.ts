/**
 * Pilote automatique — stockage : mandat en cours (`autopilot.mandates`, id = businessId), état du pilote
 * (`autopilot.state`, id = businessId) et journal chaîné immuable (`autopilot.journal` : chaque entrée porte l'empreinte
 * de la précédente ; `verifyAutopilotJournal` détecte toute retouche). Rien n'est supprimé : un mandat révoqué reste
 * conservé avec sa preuve.
 */
import crypto from 'node:crypto';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import {
  MANDATE_VERSION,
  mandateText,
  sanitizeCategories,
  type Mandate,
  type MandateCategory,
  type MandateSigner,
} from './mandate';

export const MANDATES = 'autopilot.mandates';
export const STATE = 'autopilot.state';
export const JOURNAL = 'autopilot.journal';

export class AutopilotError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AutopilotError';
  }
}

const DEMO_MSG = 'Compte de démonstration : rien n’est enregistré, aucune modification réelle.';
function assertNotDemo(businessId: string) {
  if (isDemoBusinessId(businessId)) throw new AutopilotError(403, DEMO_MSG, 'demo_read_only');
}

// ---------------------------------------------------------------------------
// Journal chaîné
// ---------------------------------------------------------------------------

export type AutopilotAction =
  | 'mandate.signed'
  | 'mandate.paused'
  | 'mandate.resumed'
  | 'mandate.revoked'
  | 'mandate.guard_stop'
  | 'series.applied'
  | 'series.skipped'
  | 'series.failed'
  | 'series.undone'
  | 'content.scheduled'
  | 'content.blocked'
  | 'content.published'
  | 'content.failed'
  | 'recap.sent';

export interface AutopilotJournalEntry {
  id: string;
  businessId: string;
  seq: number;
  at: string;
  actor: { id: string; email?: string; role?: string };
  action: AutopilotAction;
  /** série (cs_…), contenu (ct_…) ou mandat (mdt_…) concerné */
  ref?: string;
  detail?: string;
  prevHash: string;
  hash: string;
}

const hashOf = (e: Omit<AutopilotJournalEntry, 'hash'>) =>
  crypto.createHash('sha256').update(JSON.stringify([e.id, e.businessId, e.seq, e.at, e.actor.id, e.action, e.ref ?? null, e.detail ?? null, e.prevHash])).digest('hex');

const g = globalThis as unknown as { __repereAutopilotLocks?: Map<string, Promise<unknown>> };
const locks = (g.__repereAutopilotLocks ??= new Map());
export function withAutopilotLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

export async function listAutopilotJournal(businessId: string, limit = 500): Promise<AutopilotJournalEntry[]> {
  const docs = await listDocs<AutopilotJournalEntry>(JOURNAL, { businessId, limit: 5000 });
  return docs
    .map((d) => d.data)
    .filter((e) => e.businessId === businessId)
    .sort((a, b) => a.seq - b.seq)
    .slice(-limit);
}

export function appendAutopilotJournal(
  businessId: string,
  actor: AutopilotJournalEntry['actor'],
  action: AutopilotAction,
  o: { ref?: string; detail?: string } = {},
  now = new Date(),
): Promise<AutopilotJournalEntry> {
  return withAutopilotLock(`journal:${businessId}`, async () => {
    const all = await listAutopilotJournal(businessId, 1);
    const last = all.at(-1) ?? null;
    const base: Omit<AutopilotJournalEntry, 'hash'> = {
      id: `apj_${crypto.randomBytes(8).toString('hex')}`,
      businessId,
      seq: (last?.seq ?? 0) + 1,
      at: now.toISOString(),
      actor: { id: actor.id, ...(actor.email ? { email: actor.email } : {}), ...(actor.role ? { role: actor.role } : {}) },
      action,
      ...(o.ref ? { ref: o.ref } : {}),
      ...(o.detail ? { detail: o.detail.slice(0, 600) } : {}),
      prevHash: last?.hash ?? 'genesis',
    };
    const entry = { ...base, hash: hashOf(base) };
    await putDoc(JOURNAL, entry.id, entry, businessId);
    return entry;
  });
}

export function verifyAutopilotJournal(entries: AutopilotJournalEntry[]): { ok: boolean; brokenAt?: number } {
  let prev = 'genesis';
  for (let i = 0; i < entries.length; i++) {
    const { hash, ...rest } = entries[i];
    if (rest.prevHash !== prev || hashOf(rest) !== hash) return { ok: false, brokenAt: i };
    prev = hash;
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Mandat
// ---------------------------------------------------------------------------

export async function getMandate(businessId: string): Promise<Mandate | null> {
  if (isDemoBusinessId(businessId)) return null;
  const d = await getDoc<Mandate>(MANDATES, businessId);
  return d?.data?.businessId === businessId ? d.data : null;
}

const ipHash = (ip: string | null | undefined) =>
  ip ? crypto.createHash('sha256').update(`repere-mandat|${process.env.AUDIT_SIGNING_SECRET ?? 'dev'}|${ip}`).digest('hex').slice(0, 32) : undefined;

export interface SignInput {
  categories: unknown;
  /** case « J'ai lu et j'accepte ce mandat » cochée */
  accepted: unknown;
  signer: MandateSigner;
  businessName: string;
  site: string;
  regulated: boolean;
  limits: { series: number; contents: number };
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Signature (ou nouvelle signature après changement des catégories) : texte exact, empreinte SHA-256, horodatage
 * serveur, signataire, empreinte de l'IP. Le mandat précédent est remplacé (sa signature reste au journal).
 */
export async function signMandate(businessId: string, input: SignInput, now = new Date()): Promise<Mandate> {
  assertNotDemo(businessId);
  if (input.accepted !== true) throw new AutopilotError(400, 'Cochez « J’ai lu et j’accepte ce mandat » pour l’activer.', 'not_accepted');
  const categories: MandateCategory[] = sanitizeCategories(input.categories, input.regulated);
  if (!categories.length) throw new AutopilotError(400, 'Cochez au moins une catégorie, ou laissez le pilote en pause.', 'empty');
  if (!input.signer?.userId || !input.signer.email) throw new AutopilotError(403, 'Le mandat doit être signé par une personne connectée.', 'human_required');
  const at = now.toISOString();
  const text = mandateText({ businessName: input.businessName, site: input.site, categories, signerEmail: input.signer.email, at, limits: input.limits });
  const m: Mandate = {
    id: `mdt_${crypto.randomBytes(9).toString('base64url')}`,
    businessId,
    categories,
    status: 'active',
    signedAt: at,
    signedBy: { userId: input.signer.userId, email: input.signer.email },
    proof: {
      version: MANDATE_VERSION,
      textHash: crypto.createHash('sha256').update(text).digest('hex'),
      serverAt: at,
      ...(ipHash(input.ip) ? { ipHash: ipHash(input.ip) } : {}),
      ...(input.userAgent ? { userAgent: String(input.userAgent).slice(0, 200) } : {}),
    },
    text,
    updatedAt: at,
  };
  await putDoc(MANDATES, businessId, m, businessId);
  await appendAutopilotJournal(businessId, { id: input.signer.userId, email: input.signer.email }, 'mandate.signed', { ref: m.id, detail: `Catégories : ${categories.join(', ')} · empreinte ${m.proof.textHash.slice(0, 16)}… · ${MANDATE_VERSION}` }, now);
  return m;
}

type Who = { id: string; email?: string; role?: string };

export async function pauseMandate(businessId: string, who: Who, o: { reason: 'client' | 'guard'; detail?: string }, now = new Date()): Promise<Mandate> {
  assertNotDemo(businessId);
  const m = await getMandate(businessId);
  if (!m || m.status === 'revoked') throw new AutopilotError(404, 'Aucun mandat actif.', 'no_mandate');
  if (m.status === 'paused') return m;
  const next: Mandate = { ...m, status: 'paused', pausedAt: now.toISOString(), pauseReason: o.reason, ...(o.detail ? { pauseDetail: o.detail.slice(0, 400) } : {}), updatedAt: now.toISOString() };
  await putDoc(MANDATES, businessId, next, businessId);
  await appendAutopilotJournal(businessId, who, o.reason === 'guard' ? 'mandate.guard_stop' : 'mandate.paused', { ref: m.id, detail: o.detail }, now);
  return next;
}

export async function resumeMandate(businessId: string, who: Who, now = new Date()): Promise<Mandate> {
  assertNotDemo(businessId);
  const m = await getMandate(businessId);
  if (!m || m.status === 'revoked') throw new AutopilotError(404, 'Aucun mandat : signez-en un pour démarrer le pilote.', 'no_mandate');
  if (m.status === 'active') return m;
  const next: Mandate = { ...m, status: 'active', updatedAt: now.toISOString() };
  delete next.pausedAt;
  delete next.pauseReason;
  delete next.pauseDetail;
  await putDoc(MANDATES, businessId, next, businessId);
  await appendAutopilotJournal(businessId, who, 'mandate.resumed', { ref: m.id }, now);
  return next;
}

export async function revokeMandate(businessId: string, who: Who, now = new Date()): Promise<Mandate> {
  assertNotDemo(businessId);
  const m = await getMandate(businessId);
  if (!m) throw new AutopilotError(404, 'Aucun mandat à révoquer.', 'no_mandate');
  if (m.status === 'revoked') return m;
  const next: Mandate = { ...m, status: 'revoked', revokedAt: now.toISOString(), updatedAt: now.toISOString() };
  await putDoc(MANDATES, businessId, next, businessId);
  await appendAutopilotJournal(businessId, who, 'mandate.revoked', { ref: m.id, detail: 'Révocation immédiate ; les modifications déjà faites restent annulables une par une.' }, now);
  return next;
}

// ---------------------------------------------------------------------------
// État du pilote
// ---------------------------------------------------------------------------

export interface SeriesRecord {
  csId: string;
  title: string;
  kinds: string[];
  pages: number;
  appliedAt: string;
  status: 'applied' | 'verified' | 'undone' | 'failed';
  /** scores SEO / GEO de l'analyse au moment de la série (arrêt automatique) */
  baseline: { seo: number | null; geo: number | null; analysisId?: string } | null;
  /** la comparaison après la série a été faite (analyse suivante) */
  checkedAt?: string;
  /** scores de l'analyse suivante (effet mesuré, comparé avec la marge) */
  after?: { seo: number | null; geo: number | null };
  undoneAt?: string;
}

export interface ContentSchedule {
  draftId: string;
  title: string;
  scheduledAt: string;
  publishAt: string;
  status: 'scheduled' | 'blocked' | 'published' | 'failed';
  blockedAt?: string;
  publishedAt?: string;
  liveUrl?: string;
  error?: string;
}

export interface AutopilotState {
  businessId: string;
  series: SeriesRecord[];
  contents: ContentSchedule[];
  lastRunAt?: string;
  lastRecapAt?: string;
  guard?: { trippedAt: string; detail: string; seriesIds: string[] } | null;
  updatedAt: string;
}

export async function getState(businessId: string): Promise<AutopilotState> {
  const d = await getDoc<AutopilotState>(STATE, businessId);
  return d?.data?.businessId === businessId ? d.data : { businessId, series: [], contents: [], updatedAt: new Date(0).toISOString() };
}

export async function saveState(s: AutopilotState, now = new Date()): Promise<AutopilotState> {
  const next = { ...s, series: s.series.slice(-200), contents: s.contents.slice(-100), updatedAt: now.toISOString() };
  await putDoc(STATE, s.businessId, next, s.businessId);
  return next;
}

/** Espaces dont le pilote a un état (balayage quotidien). */
export async function listAutopilotBusinesses(limit = 2000): Promise<string[]> {
  const docs = await listDocs<Mandate>(MANDATES, { limit });
  return docs.map((d) => d.data).filter((m) => m && m.status !== 'revoked').map((m) => m.businessId);
}
