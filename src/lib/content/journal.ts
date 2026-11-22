/**
 * Journal immuable de l'agent de contenu (même principe que publish.journal : une entrée par événement, chaînée par
 * SHA-256, jamais modifiée). Collection `content.journal`, sujet = identifiant du brouillon ou `mn_…` (mention).
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import type { Actor } from './types';

export const CONTENT_JOURNAL = 'content.journal';

export { CONTENT_ACTION_LABEL, type ContentAction } from './journal-labels';
import type { ContentAction } from './journal-labels';

export interface ContentJournalEntry {
  id: string;
  businessId: string;
  subject: string;
  seq: number;
  at: string;
  actor: Actor;
  action: ContentAction;
  detail?: string;
  prevHash: string;
  hash: string;
}

const g = globalThis as unknown as { __repereContentJournalLocks?: Map<string, Promise<unknown>> };
const locks = (g.__repereContentJournalLocks ??= new Map());

function hashOf(e: Omit<ContentJournalEntry, 'hash'>): string {
  return crypto.createHash('sha256').update(JSON.stringify([e.id, e.businessId, e.subject, e.seq, e.at, e.actor.id, e.action, e.detail ?? null, e.prevHash])).digest('hex');
}

const entryId = (businessId: string, subject: string, seq: number) => `${businessId}.${subject}.${String(seq).padStart(5, '0')}`;

async function lastEntry(businessId: string, subject: string): Promise<ContentJournalEntry | null> {
  let last: ContentJournalEntry | null = null;
  for (let seq = 1; ; seq++) {
    const d = await getDoc<ContentJournalEntry>(CONTENT_JOURNAL, entryId(businessId, subject, seq));
    if (!d) return last;
    last = d.data;
  }
}

export function appendContentJournal(businessId: string, subject: string, actor: Actor, action: ContentAction, detail?: string, now: Date = new Date()): Promise<ContentJournalEntry> {
  const key = `${businessId}:${subject}`;
  const prev = locks.get(key) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(async () => {
    const last = await lastEntry(businessId, subject);
    const seq = (last?.seq ?? 0) + 1;
    const base: Omit<ContentJournalEntry, 'hash'> = {
      id: entryId(businessId, subject, seq),
      businessId,
      subject,
      seq,
      at: now.toISOString(),
      actor: { id: actor.id, ...(actor.email ? { email: actor.email } : {}), ...(actor.role ? { role: actor.role } : {}) },
      action,
      ...(detail ? { detail: detail.slice(0, 500) } : {}),
      prevHash: last?.hash ?? 'genesis',
    };
    const entry: ContentJournalEntry = { ...base, hash: hashOf(base) };
    await putDoc<ContentJournalEntry>(CONTENT_JOURNAL, entry.id, entry, businessId);
    return entry;
  });
  const tail = run.catch(() => undefined);
  locks.set(key, tail);
  void tail.then(() => {
    if (locks.get(key) === tail) locks.delete(key);
  });
  return run;
}

export async function readContentJournal(businessId: string, subject: string): Promise<ContentJournalEntry[]> {
  const out: ContentJournalEntry[] = [];
  for (let seq = 1; ; seq++) {
    const d = await getDoc<ContentJournalEntry>(CONTENT_JOURNAL, entryId(businessId, subject, seq));
    if (!d) break;
    out.push(d.data);
  }
  return out;
}

export async function listContentJournal(businessId: string, limit = 200): Promise<ContentJournalEntry[]> {
  const docs = await listDocs<ContentJournalEntry>(CONTENT_JOURNAL, { businessId, limit });
  return docs.map((d) => d.data).filter((e) => e.businessId === businessId).sort((a, b) => b.at.localeCompare(a.at) || b.seq - a.seq);
}

export function verifyContentJournal(entries: ContentJournalEntry[]): { ok: boolean; brokenAt?: number } {
  let prev = 'genesis';
  for (const [i, e] of entries.entries()) {
    const { hash, ...base } = e;
    if (e.seq !== i + 1 || e.prevHash !== prev || hashOf(base) !== hash) return { ok: false, brokenAt: e.seq };
    prev = hash;
  }
  return { ok: true };
}
