/**
 * RGPD technique : export complet (portabilité, art. 20) et suppression en cascade (effacement, art. 17) d'un commerce.
 *
 * Export : fiche du commerce, audits, alertes, membres et invitations en attente (sans jeton), abonnements (références
 * Stripe), tous les documents des modules (store `documents`, toutes collections), tâches de la file.
 * Les secrets techniques (empreintes de jetons, clés de signature) sont masqués : ils ne servent à rien hors de Repéré.
 *
 * Suppression : refusée tant qu'un abonnement est actif (il faut d'abord le résilier : obligations comptables, et
 * Stripe garde le client et les factures). Supprime documents, tâches, puis le commerce (cascade SQL : audits,
 * alertes, cases cochées, adhésions, invitations ; abonnements et prospects détachés). L'adresse de contact est
 * ajoutée à la liste d'opposition (plus aucun e-mail).
 */
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BusinessRecord } from '@/lib/db';
import { deleteJobsForBusiness, listJobsForBusiness } from '@/lib/jobs';
import { log } from '@/lib/log';

export const EXPORT_FORMAT = 'repere.export.v1';

const SECRET_FIELD = /(secret|token_?hash|tokenhash|password|passwordhash|signing_?key|api_?key|access_?token|refresh_?token)/i;

/** Masque les champs techniques sensibles (copie profonde bornée). */
export function maskSecrets(v: unknown, depth = 0): unknown {
  if (depth > 12) return v;
  if (Array.isArray(v)) return v.map((x) => maskSecrets(x, depth + 1));
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SECRET_FIELD.test(k) && x != null && x !== '' ? '[masqué]' : maskSecrets(x, depth + 1);
    }
    return out;
  }
  return v;
}

function supabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

// ---------------------------------------------------------------------------
// Documents (store générique) : toutes collections
// ---------------------------------------------------------------------------

interface DocLite {
  collection: string;
  id: string;
  data: unknown;
  createdAt: string;
  updatedAt: string;
}

function docsDir(): string {
  const g = globalThis as unknown as { __repereDocsDir?: string };
  return g.__repereDocsDir || process.env.DATA_DIR || path.join(process.cwd(), '.data');
}

/** Collections connues en mode fichier : chargées en mémoire + fichiers `.data/doc-*.json`. */
async function memoryCollections(): Promise<string[]> {
  const g = globalThis as unknown as { __repereDocs?: Map<string, unknown> };
  const names = new Set<string>(g.__repereDocs ? [...g.__repereDocs.keys()] : []);
  for (const dir of new Set([docsDir(), path.join(os.tmpdir(), 'repere-data')])) {
    try {
      for (const f of await fs.readdir(dir)) {
        const m = /^doc-(.+)\.json$/.exec(f);
        if (m) names.add(m[1]);
      }
    } catch {
      /* dossier absent */
    }
  }
  return [...names].sort();
}

export async function listBusinessDocuments(businessId: string): Promise<DocLite[]> {
  const sb = supabase();
  if (sb) {
    const out: DocLite[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb
        .from('documents')
        .select('collection,id,data,created_at,updated_at')
        .eq('business_id', businessId)
        .order('collection')
        .range(from, from + 999);
      if (error) throw new Error(`[rgpd] documents : ${error.message}`);
      const rows = (data ?? []) as { collection: string; id: string; data: unknown; created_at: string; updated_at: string }[];
      out.push(...rows.map((r) => ({ collection: r.collection, id: r.id, data: r.data, createdAt: r.created_at, updatedAt: r.updated_at })));
      if (rows.length < 1000) break;
    }
    return out;
  }
  const { listDocs } = await import('@/lib/store');
  const out: DocLite[] = [];
  for (const c of await memoryCollections()) {
    for (const d of await listDocs(c, { businessId, limit: 100_000 })) {
      out.push({ collection: d.collection, id: d.id, data: d.data, createdAt: d.createdAt, updatedAt: d.updatedAt });
    }
  }
  return out;
}

async function deleteBusinessDocuments(businessId: string): Promise<number> {
  const sb = supabase();
  if (sb) {
    const { data, error } = await sb.from('documents').delete().eq('business_id', businessId).select('id');
    if (error) throw new Error(`[rgpd] suppression documents : ${error.message}`);
    return data?.length ?? 0;
  }
  const { deleteDoc } = await import('@/lib/store');
  const docs = await listBusinessDocuments(businessId);
  for (const d of docs) await deleteDoc(d.collection, d.id);
  return docs.length;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export async function exportBusinessData(business: BusinessRecord, requestedBy: { userId?: string; email?: string } = {}) {
  const db = await import('@/lib/db');
  const [audits, alerts, members, invitations, subscriptions, documents, jobs] = await Promise.all([
    db.listAuditsForBusiness(business.id),
    db.listAlerts(business.id, 10_000),
    db.listMembers(business.id).catch(() => []),
    db.listPendingInvitations(business.id).catch(() => []),
    business.stripeCustomerId ? db.listSubscriptionsByCustomer(business.stripeCustomerId).catch(() => []) : Promise.resolve([]),
    listBusinessDocuments(business.id),
    listJobsForBusiness(business.id, 1000).catch(() => []),
  ]);
  const byCollection: Record<string, Omit<DocLite, 'collection'>[]> = {};
  for (const d of documents) {
    // Parrainages : rangés sous le parrain mais décrivent l'espace du filleul (M7) ; compteurs seulement dans l'app.
    if (d.collection === 'growth.referrals') continue;
    (byCollection[d.collection] ??= []).push({ id: d.id, data: d.data, createdAt: d.createdAt, updatedAt: d.updatedAt });
  }
  return maskSecrets({
    format: EXPORT_FORMAT,
    exportedAt: new Date().toISOString(),
    requestedBy,
    notice:
      'Export de vos données Repéré (RGPD, droit d’accès et de portabilité). Les secrets techniques sont masqués. ' +
      'Les factures et moyens de paiement sont chez Stripe (portail de facturation).',
    business,
    audits,
    alerts,
    members,
    invitations: invitations.map((i) => ({ ...i, tokenHash: undefined })),
    subscriptions: subscriptions.filter((s) => !s.businessId || s.businessId === business.id),
    documents: byCollection,
    jobs: jobs.map((j) => ({ id: j.id, type: j.type, status: j.status, attempts: j.attempts, createdAt: j.createdAt, finishedAt: j.finishedAt, result: j.result })),
  }) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------

export class DeletionBlockedError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = 'DeletionBlockedError';
  }
}

const ACTIVE = new Set(['active', 'trialing', 'past_due', 'incomplete', 'unpaid']);

/** Normalise pour comparer la confirmation saisie au nom du commerce. */
export function normalizeConfirm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function confirmationMatches(business: Pick<BusinessRecord, 'name'>, confirm: unknown): boolean {
  return typeof confirm === 'string' && confirm.length <= 300 && normalizeConfirm(confirm) === normalizeConfirm(business.name) && normalizeConfirm(business.name) !== '';
}

export interface DeletionReport {
  businessId: string;
  documents: number;
  jobs: number;
  business: boolean;
  suppressed: boolean;
}

export async function deleteBusinessData(business: BusinessRecord): Promise<DeletionReport> {
  const db = await import('@/lib/db');
  if (business.stripeCustomerId) {
    const subs = await db.listSubscriptionsByCustomer(business.stripeCustomerId);
    const live = subs.filter((s) => (!s.businessId || s.businessId === business.id) && ACTIVE.has(s.status) && !s.cancelAtPeriodEnd);
    if (live.length) {
      throw new DeletionBlockedError(
        'Un abonnement est en cours : résiliez-le d’abord depuis Réglages › Facturation, puis revenez supprimer vos données.',
      );
    }
  }
  const documents = await deleteBusinessDocuments(business.id);
  // Document de parrainage dont cet espace est le FILLEUL (rangé sous le parrain, donc non couvert ci-dessus).
  await import('@/lib/store').then(({ deleteDoc }) => deleteDoc('growth.referrals', business.id)).catch(() => undefined);
  const jobs = await deleteJobsForBusiness(business.id).catch(() => 0);
  await deleteBusinessRow(business.id);
  let suppressed = false;
  if (business.contactEmail) {
    await db.addSuppression(business.contactEmail, 'account_deleted').then(() => (suppressed = true)).catch(() => undefined);
  }
  log.info('rgpd.business_deleted', { businessId: business.id, documents, jobs });
  return { businessId: business.id, documents, jobs, business: true, suppressed };
}

/** Ligne `businesses` + données rattachées. Utilise `deleteBusiness` de @/lib/db s'il existe, sinon le fait ici. */
async function deleteBusinessRow(businessId: string): Promise<void> {
  const db = (await import('@/lib/db')) as unknown as Record<string, unknown>;
  const native = db.deleteBusiness;
  if (typeof native === 'function') {
    await (native as (id: string) => Promise<unknown>)(businessId);
    return;
  }
  const sb = supabase();
  if (sb) {
    // Cascade SQL : audits, audit_runs, actions_progress, alerts, memberships, invitations ; subscriptions → null.
    const { error } = await sb.from('businesses').delete().eq('id', businessId);
    if (error) throw new Error(`[rgpd] suppression du commerce : ${error.message}`);
    return;
  }
  await deleteFromMemoryStore(businessId);
}

/** Mode fichier (démo / développement) : même effet que la cascade SQL sur le store de src/lib/db.ts. */
async function deleteFromMemoryStore(businessId: string): Promise<void> {
  const g = globalThis as unknown as { __repereMem?: Promise<Record<string, unknown>>; __repereDataDir?: string };
  if (!g.__repereMem) {
    // Force le chargement du store (et donc l'existence du commerce) via une lecture publique.
    const { getBusinessRecord } = await import('@/lib/db');
    await getBusinessRecord(businessId);
  }
  const store = g.__repereMem ? await g.__repereMem : null;
  if (!store) return;
  const touched = new Set<string>();
  const businesses = store.businesses as Record<string, unknown> | undefined;
  if (businesses && businessId in businesses) {
    delete businesses[businessId];
    touched.add('businesses');
  }
  const audits = store.audits as Record<string, { businessId: string | null }> | undefined;
  for (const [id, a] of Object.entries(audits ?? {})) {
    if (a.businessId === businessId) {
      delete audits![id];
      touched.add('audits');
    }
  }
  const actions = store.actions as Record<string, unknown> | undefined;
  if (actions && businessId in actions) {
    delete actions[businessId];
    touched.add('actions');
  }
  if (Array.isArray(store.alerts)) {
    const before = store.alerts.length;
    store.alerts = (store.alerts as { businessId: string }[]).filter((a) => a.businessId !== businessId);
    if ((store.alerts as unknown[]).length !== before) touched.add('alerts');
  }
  for (const name of ['memberships', 'invitations'] as const) {
    const coll = store[name] as Record<string, { businessId: string }> | undefined;
    for (const [k, m] of Object.entries(coll ?? {})) {
      if (m.businessId === businessId) {
        delete coll![k];
        touched.add(name);
      }
    }
  }
  const subs = store.subscriptions as Record<string, { businessId: string | null }> | undefined;
  for (const s of Object.values(subs ?? {})) {
    if (s.businessId === businessId) {
      s.businessId = null;
      touched.add('subscriptions');
    }
  }
  const dir = g.__repereDataDir || process.env.DATA_DIR || path.join(process.cwd(), '.data');
  for (const name of touched) {
    try {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify(store[name], null, 1), 'utf8');
    } catch {
      /* lecture seule : mémoire uniquement */
    }
  }
}
