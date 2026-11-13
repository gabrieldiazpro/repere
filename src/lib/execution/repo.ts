/**
 * Persistance des tâches (collection `exec.tasks`, id = id de tâche) et des réglages (`exec.settings`).
 */
import type { ExecTask, TaskStatus } from '@/lib/engine/types-v2';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import type { ExecSettings, StoredTask } from './types';
import { pickWeekly } from './weekly';
import { priority } from './tasks';
import { isoMonday, slugify } from './util';

export const TASKS_COLLECTION = 'exec.tasks';
export const SETTINGS_COLLECTION = 'exec.settings';
/** Index d'unicité des pages hébergées : id = slug → { businessId } (clé primaire, E5). */
export const SLUGS_COLLECTION = 'exec.slugs';

const STATUS_ORDER: Record<TaskStatus, number> = { in_progress: 0, todo: 1, done: 2, skipped: 3 };

export async function listStoredTasks(businessId: string): Promise<StoredTask[]> {
  const docs = await listDocs<StoredTask>(TASKS_COLLECTION, { businessId, limit: 1000 });
  return docs
    .map((d) => d.data)
    .filter((t) => t && t.businessId === businessId)
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || priority(b) - priority(a) || a.id.localeCompare(b.id));
}

/**
 * Enregistre des tâches générées en conservant l'état de celles qui existent déjà
 * (statut, semaine, report). Les tâches « à faire » non planifiées absentes de la nouvelle génération
 * sont retirées (l'audit a changé) ; les tâches faites, planifiées ou manuelles restent.
 */
export async function saveGeneratedTasks(businessId: string, generated: StoredTask[]): Promise<StoredTask[]> {
  const existing = await listStoredTasks(businessId);
  const byId = new Map(existing.map((t) => [t.id, t]));
  const ids = new Set(generated.map((t) => t.id));
  const out: StoredTask[] = [];
  for (const g of generated) {
    const prev = byId.get(g.id);
    const next: StoredTask = prev
      ? { ...g, status: prev.status, week: prev.week, carried: prev.carried, snoozedUntil: prev.snoozedUntil, doneAt: prev.doneAt, createdAt: prev.createdAt }
      : g;
    await putDoc(TASKS_COLLECTION, next.id, next, businessId);
    out.push(next);
  }
  for (const t of existing) {
    if (ids.has(t.id)) continue;
    const keep = t.status !== 'todo' || !!t.week || t.key?.startsWith('custom:');
    if (keep) out.push(t);
    else await putDoc(TASKS_COLLECTION, t.id, { ...t, status: 'skipped' as const }, businessId);
  }
  return out;
}

export async function putTask(task: StoredTask): Promise<StoredTask> {
  await putDoc(TASKS_COLLECTION, task.id, task, task.businessId);
  return task;
}

/** Contrat : met à jour le statut d'une tâche du commerce. Renvoie null si introuvable. */
export async function updateTaskStatus(businessId: string, taskId: string, status: TaskStatus): Promise<ExecTask | null> {
  const doc = await getDoc<StoredTask>(TASKS_COLLECTION, taskId);
  if (!doc || doc.data.businessId !== businessId) return null;
  const next: StoredTask = { ...doc.data, status };
  if (status === 'done') next.doneAt = new Date().toISOString();
  else delete next.doneAt;
  if (status === 'skipped') next.week = undefined;
  await putDoc(TASKS_COLLECTION, taskId, next, businessId);
  return next;
}

/** 3 tâches de la semaine, persistées (la sélection reste stable toute la semaine). */
export async function weeklyFromStore(businessId: string, now: Date = new Date()): Promise<StoredTask[]> {
  const all = await listStoredTasks(businessId);
  const { tasks, changed } = pickWeekly(all, isoMonday(now));
  for (const t of changed) await putDoc(TASKS_COLLECTION, t.id, t, businessId);
  return tasks;
}

// ---------------------------------------------------------------------------
// Réglages
// ---------------------------------------------------------------------------
const DEMO_SLUGS: Record<string, string> = { demo: 'plomberie-martin', 'demo-pme': 'paysia', 'demo-ecom': 'maison-sora', repere: 'repere' };

/** Réglages par défaut des comptes démo (couleurs, produits structurés). */
const DEMO_SETTINGS: Record<string, Partial<ExecSettings>> = {
  demo: { brandColor: '#1D4ED8', schemaType: 'Plumber' },
  'demo-pme': { brandColor: '#0F766E', segment: 'pme' },
  // Compte maison (dogfooding) : src/lib/house.ts
  repere: { brandColor: '#3730A3', segment: 'pme', schemaType: 'Organization' },
  'demo-ecom': {
    brandColor: '#9D174D',
    segment: 'ecommerce',
    products: [
      { name: 'Shampoing solide cheveux normaux', price: 12.9, currency: 'EUR', availability: 'InStock', category: 'Shampoing solide' },
      { name: 'Déodorant solide sans bicarbonate', price: 9.9, currency: 'EUR', availability: 'InStock', category: 'Déodorant solide' },
    ],
  },
};

export function defaultSlug(businessId: string, name: string): string {
  return DEMO_SLUGS[businessId] ?? (slugify(name) || businessId.slice(0, 12));
}

export async function getSettings(businessId: string, name = ''): Promise<ExecSettings> {
  const doc = await getDoc<ExecSettings>(SETTINGS_COLLECTION, businessId);
  const base: ExecSettings = { businessId, slug: defaultSlug(businessId, name), published: true, ...(DEMO_SETTINGS[businessId] ?? {}), ...(doc?.data ?? {}) };
  if (!(businessId in DEMO_SLUGS)) {
    if (!doc && name) {
      // Réservation du slug par défaut dès la première lecture : personne ne peut le prendre avant le client (E5).
      base.slug = await claimSlug(businessId, base.slug, false);
      await putDoc(SETTINGS_COLLECTION, businessId, { ...base, updatedAt: new Date().toISOString() }, businessId);
    } else if (doc && !(await getDoc(SLUGS_COLLECTION, base.slug))) {
      // Migration paresseuse des réglages antérieurs à l'index.
      await putDoc(SLUGS_COLLECTION, base.slug, { businessId }, businessId);
    }
  }
  return base;
}

export class SlugTakenError extends Error {}

async function slugOwner(slug: string): Promise<string | null> {
  const doc = await getDoc<{ businessId: string }>(SLUGS_COLLECTION, slug);
  if (doc) return doc.data.businessId;
  const demo = Object.entries(DEMO_SLUGS).find(([, s]) => s === slug);
  return demo ? demo[0] : null;
}

/** Réserve un slug libre pour le commerce (suffixe -2, -3… si pris ; `strict` : erreur au lieu du suffixe). */
async function claimSlug(businessId: string, wanted: string, strict: boolean): Promise<string> {
  const base = slugify(wanted) || businessId.slice(0, 12).toLowerCase();
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? base : `${base.slice(0, 56)}-${i}`;
    const owner = await slugOwner(slug);
    if (owner === businessId) return slug;
    if (!owner) {
      await putDoc(SLUGS_COLLECTION, slug, { businessId }, businessId);
      return slug;
    }
    if (strict) throw new SlugTakenError(`Adresse « ${slug} » déjà utilisée.`);
  }
  throw new SlugTakenError('Aucune adresse disponible.');
}

export async function saveSettings(businessId: string, patch: Partial<ExecSettings>): Promise<ExecSettings> {
  const prev = await getSettings(businessId);
  if (patch.slug && !(businessId in DEMO_SLUGS)) {
    const slug = await claimSlug(businessId, patch.slug, true);
    if (prev.slug && prev.slug !== slug && (await slugOwner(prev.slug)) === businessId) {
      await deleteDoc(SLUGS_COLLECTION, prev.slug).catch(() => undefined);
    }
    patch = { ...patch, slug };
  } else if (patch.slug) {
    patch = { ...patch, slug: prev.slug }; // slug des comptes démo figé
  }
  const next: ExecSettings = { ...prev, ...patch, businessId, updatedAt: new Date().toISOString() };
  await putDoc(SETTINGS_COLLECTION, businessId, next, businessId);
  return next;
}

/** Retrouve le commerce d'une page hébergée. */
export async function findBusinessIdBySlug(slug: string): Promise<string | null> {
  return slugOwner(slug);
}
