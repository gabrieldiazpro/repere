/**
 * Journal immuable des publications : une entrée par événement (création, proposition, validation, application,
 * vérification, échec, annulation…). Jamais modifié ni supprimé : chaque entrée porte l'empreinte de la précédente
 * (chaîne SHA-256) ; `verifyJournal` détecte toute retouche. Collection `publish.journal`.
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import type { Actor } from './types';

export const JOURNAL = 'publish.journal';

export type JournalAction =
  | 'created'
  | 'proposed'
  | 'edited'
  | 'validated'
  | 'rejected'
  | 'apply.started'
  | 'change.applied'
  | 'change.unchanged'
  | 'change.failed'
  | 'change.verified'
  | 'change.unverified'
  | 'change.reverted'
  | 'change.revert_failed'
  | 'applied'
  | 'verified'
  | 'reverted'
  | 'remeasure.scheduled'
  | 'connection.added'
  | 'connection.tested'
  | 'connection.removed';

export interface JournalEntry {
  id: string;
  businessId: string;
  /** ChangeSet concerné, ou `conn:<plateforme>` pour les connexions */
  subject: string;
  seq: number;
  at: string;
  actor: Actor;
  action: JournalAction;
  changeId?: string;
  /** détail lisible (jamais de secret) */
  detail?: string;
  /** valeurs avant/après pour les écritures réelles */
  before?: string | null;
  after?: string | null;
  prevHash: string;
  hash: string;
}

const g = globalThis as unknown as { __reperePublishJournalLocks?: Map<string, Promise<unknown>> };
const locks = (g.__reperePublishJournalLocks ??= new Map());

function hashOf(e: Omit<JournalEntry, 'hash'>): string {
  const { id, businessId, subject, seq, at, actor, action, changeId, detail, before, after, prevHash } = e;
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([id, businessId, subject, seq, at, actor.id, action, changeId ?? null, detail ?? null, before ?? null, after ?? null, prevHash]))
    .digest('hex');
}

const entryId = (subject: string, seq: number) => `${subject}.${String(seq).padStart(5, '0')}`;

async function lastEntry(subject: string): Promise<JournalEntry | null> {
  // Recherche séquentielle par identifiant (pas de liste complète à chaque ajout).
  let seq = 0;
  let last: JournalEntry | null = null;
  for (;;) {
    const d = await getDoc<JournalEntry>(JOURNAL, entryId(subject, seq + 1));
    if (!d) return last;
    last = d.data;
    seq++;
  }
}

/** Ajoute une entrée (sérialisé par sujet). */
export function appendJournal(
  businessId: string,
  subject: string,
  actor: Actor,
  action: JournalAction,
  extra: { changeId?: string; detail?: string; before?: string | null; after?: string | null } = {},
  now: Date = new Date(),
): Promise<JournalEntry> {
  const key = `${businessId}:${subject}`;
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(async () => {
    const last = await lastEntry(subject);
    const seq = (last?.seq ?? 0) + 1;
    const base: Omit<JournalEntry, 'hash'> = {
      id: entryId(subject, seq),
      businessId,
      subject,
      seq,
      at: now.toISOString(),
      actor: { id: actor.id, ...(actor.email ? { email: actor.email } : {}), ...(actor.role ? { role: actor.role } : {}) },
      action,
      ...(extra.changeId ? { changeId: extra.changeId } : {}),
      ...(extra.detail ? { detail: extra.detail.slice(0, 500) } : {}),
      ...(extra.before !== undefined ? { before: extra.before } : {}),
      ...(extra.after !== undefined ? { after: extra.after } : {}),
      prevHash: last?.hash ?? 'genesis',
    };
    const entry: JournalEntry = { ...base, hash: hashOf(base) };
    if (await getDoc(JOURNAL, entry.id)) throw new Error('journal : entrée déjà écrite');
    await putDoc<JournalEntry>(JOURNAL, entry.id, entry, businessId);
    return entry;
  });
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

export async function readJournal(businessId: string, subject: string): Promise<JournalEntry[]> {
  const out: JournalEntry[] = [];
  for (let seq = 1; ; seq++) {
    const d = await getDoc<JournalEntry>(JOURNAL, entryId(subject, seq));
    if (!d) break;
    if (d.data.businessId === businessId) out.push(d.data);
  }
  return out;
}

export async function listJournal(businessId: string, limit = 200): Promise<JournalEntry[]> {
  const docs = await listDocs<JournalEntry>(JOURNAL, { businessId, limit });
  return docs.map((d) => d.data).filter((e) => e.businessId === businessId).sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq);
}

/** Vérifie la chaîne d'un sujet : `ok` faux si une entrée a été modifiée, retirée ou insérée. */
export function verifyJournal(entries: JournalEntry[]): { ok: boolean; brokenAt?: number } {
  let prev = 'genesis';
  for (const [i, e] of entries.entries()) {
    const { hash, ...base } = e;
    if (e.seq !== i + 1 || e.prevHash !== prev || hashOf(base) !== hash) return { ok: false, brokenAt: e.seq };
    prev = hash;
  }
  return { ok: true };
}
