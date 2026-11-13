// État des tâches du mode démo, propre à cet appareil (aucune écriture serveur : les comptes démo sont en lecture seule).
// Écrit par le navigateur (localStorage + cookie lisible par le rendu serveur), relu ici par le serveur et le client,
// pour que « C'est fait » (et sa date) se voie aussi sur l'accueil et dans « Effet de vos actions » après rechargement.
import type { ExecTask, TaskStatus } from '@/lib/engine/types-v2';

export const DEMO_TASKS_COOKIE = 'rp_demo_tasks';
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'skipped'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ID = /^[A-Za-z0-9:_.-]{1,80}$/;
const MAX = 40;

/** id de tâche → [statut, date « fait » ISO éventuelle] */
export type DemoTaskState = Record<string, { status: TaskStatus; doneAt?: string }>;

/** Lecture tolérante (cookie modifiable par l'utilisateur) : tout ce qui n'est pas valide est ignoré. */
export function parseDemoTaskState(raw: string | null | undefined): DemoTaskState {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw.trimStart().startsWith('{') ? raw : decodeURIComponent(raw));
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out: DemoTaskState = {};
  for (const [id, v] of Object.entries(data as Record<string, unknown>).slice(0, MAX)) {
    if (!ID.test(id) || !Array.isArray(v)) continue;
    const [status, doneAt] = v as unknown[];
    if (!STATUSES.includes(status as TaskStatus)) continue;
    out[id] = { status: status as TaskStatus, ...(status === 'done' && typeof doneAt === 'string' && ISO.test(doneAt) ? { doneAt } : {}) };
  }
  return out;
}

export function serializeDemoTaskState(s: DemoTaskState): string {
  const entries = Object.entries(s).slice(-MAX).map(([id, v]) => [id, v.doneAt ? [v.status, v.doneAt] : [v.status]]);
  return encodeURIComponent(JSON.stringify(Object.fromEntries(entries)));
}

/** Applique l'état local aux tâches : statut et date « fait » (une tâche faite sans date garde celle du serveur). */
export function applyDemoTaskState<T extends Pick<ExecTask, 'id' | 'status' | 'doneAt'>>(tasks: T[], s: DemoTaskState): T[] {
  if (!Object.keys(s).length) return tasks;
  return tasks.map((t) => {
    const v = s[t.id];
    if (!v) return t;
    if (v.status !== 'done') return { ...t, status: v.status, doneAt: undefined };
    return { ...t, status: 'done', doneAt: v.doneAt ?? t.doneAt };
  });
}
