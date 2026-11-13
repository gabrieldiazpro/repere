/**
 * Annotations datées sur les courbes (docs/v3/09-audit-app.md n° 14).
 * - `manual` : repère saisi par le client (« article paru dans la presse locale ») ;
 * - `action` : tâche faite (créée à la complétion, et dérivée des tâches faites pour l'historique) ;
 * - `external` : événement extérieur publié par Repéré (liste maintenue à la main, vide tant qu'aucun n'est vérifié).
 * Collection `annotations.items`. Comptes démo : lecture seule (repères dérivés des tâches démo).
 */
import crypto from 'node:crypto';
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { ExecTask } from '@/lib/engine/types-v2';

export const ANNOTATIONS = 'annotations.items';

export const ANNOTATION_KINDS = ['manual', 'action', 'external'] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];
export const SERIES = ['all', 'score', 'sov', 'traffic', 'citations'] as const;
export type Series = (typeof SERIES)[number];

export interface Annotation {
  id: string;
  businessId: string | null;
  /** AAAA-MM-JJ */
  date: string;
  label: string;
  kind: AnnotationKind;
  series: Series;
  taskId?: string | null;
  href?: string | null;
  createdAt: string;
  demo?: boolean;
}

/**
 * Événements extérieurs (pannes, changements de modèle) : n'y ajouter que des faits vérifiés et datés,
 * avec leur source. Volontairement vide en V3.
 */
export const EXTERNAL_EVENTS: Omit<Annotation, 'businessId' | 'createdAt'>[] = [];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const LABEL_MAX = 80;

export class AnnotationError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function cleanLabel(s: unknown): string {
  return String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, LABEL_MAX);
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Repère « action » dérivé d'une tâche faite. */
export function annotationOfTask(t: Pick<ExecTask, 'id' | 'title' | 'doneAt' | 'businessId'>, demo = false): Annotation | null {
  if (!t.doneAt) return null;
  return {
    id: `an_task_${t.id}`,
    businessId: t.businessId,
    date: t.doneAt.slice(0, 10),
    label: cleanLabel(`Fait : ${t.title}`),
    kind: 'action',
    series: 'all',
    taskId: t.id,
    href: '/app/taches',
    createdAt: t.doneAt,
    ...(demo ? { demo: true } : {}),
  };
}

/** Fusionne stockées + dérivées des tâches + extérieures, sans doublon (une tâche = un repère), triées par date. */
export function mergeAnnotations(stored: Annotation[], tasks: Pick<ExecTask, 'id' | 'title' | 'doneAt' | 'businessId' | 'status'>[], opts: { from?: string; to?: string; series?: Series; demo?: boolean } = {}): Annotation[] {
  const byTask = new Set(stored.filter((a) => a.taskId).map((a) => a.taskId));
  const derived = tasks.filter((t) => t.status === 'done' && !byTask.has(t.id)).map((t) => annotationOfTask(t, opts.demo)).filter((a): a is Annotation => !!a);
  const ext = EXTERNAL_EVENTS.map((e) => ({ ...e, businessId: null, createdAt: `${e.date}T00:00:00.000Z` }));
  return [...stored, ...derived, ...ext]
    .filter((a) => (!opts.from || a.date >= opts.from) && (!opts.to || a.date <= opts.to))
    .filter((a) => !opts.series || opts.series === 'all' || a.series === 'all' || a.series === opts.series)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
}

export async function listStoredAnnotations(businessId: string): Promise<Annotation[]> {
  if (isDemoBusinessId(businessId)) return [];
  const docs = await listDocs<Annotation>(ANNOTATIONS, { businessId, limit: 1000 });
  return docs.map((d) => d.data).filter((a) => a.businessId === businessId);
}

export async function listAnnotations(businessId: string, opts: { from?: string; to?: string; series?: Series } = {}): Promise<Annotation[]> {
  const { listTasks } = await import('@/lib/execution');
  const [stored, tasks] = await Promise.all([listStoredAnnotations(businessId), listTasks(businessId).catch(() => [] as ExecTask[])]);
  return mergeAnnotations(stored, tasks, { ...opts, demo: isDemoBusinessId(businessId) });
}

export interface AnnotationInput {
  date: string;
  label: string;
  series?: Series;
  kind?: AnnotationKind;
  taskId?: string | null;
}

export async function addAnnotation(businessId: string, input: AnnotationInput, now: Date = new Date()): Promise<Annotation> {
  if (isDemoBusinessId(businessId)) throw new AnnotationError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.');
  if (!isValidDate(input.date)) throw new AnnotationError(400, 'Date invalide (AAAA-MM-JJ).');
  const max = new Date(now.getTime() + 366 * 86_400_000).toISOString().slice(0, 10);
  if (input.date < '2020-01-01' || input.date > max) throw new AnnotationError(400, 'Date hors période.');
  const label = cleanLabel(input.label);
  if (!label) throw new AnnotationError(400, 'Texte du repère manquant.');
  const kind: AnnotationKind = input.kind === 'action' ? 'action' : 'manual'; // « external » réservé à Repéré
  const series: Series = (SERIES as readonly string[]).includes(input.series ?? '') ? (input.series as Series) : 'all';
  const id = input.taskId ? `an_task_${input.taskId}` : `an_${crypto.randomBytes(8).toString('base64url')}`;
  const a: Annotation = { id, businessId, date: input.date, label, kind, series, taskId: input.taskId ?? null, href: input.taskId ? '/app/taches' : null, createdAt: now.toISOString() };
  await putDoc<Annotation>(ANNOTATIONS, id, a, businessId);
  return a;
}

export async function deleteAnnotation(businessId: string, id: string): Promise<boolean> {
  if (isDemoBusinessId(businessId)) throw new AnnotationError(403, 'Compte de démonstration : les modifications ne sont pas enregistrées.');
  const doc = await getDoc<Annotation>(ANNOTATIONS, id);
  if (!doc || doc.data.businessId !== businessId) return false;
  await deleteDoc(ANNOTATIONS, id);
  return true;
}

/** Appelé à la complétion d'une tâche (idempotent : même id). */
export async function annotateTaskDone(businessId: string, task: Pick<ExecTask, 'id' | 'title' | 'doneAt'>, now: Date = new Date()): Promise<Annotation | null> {
  if (isDemoBusinessId(businessId)) return null;
  return addAnnotation(businessId, { date: (task.doneAt ?? now.toISOString()).slice(0, 10), label: `Fait : ${task.title}`, kind: 'action', taskId: task.id }, now);
}
