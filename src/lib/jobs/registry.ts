import { JOB_TYPES, type JobHandler, type JobType } from './types';

const g = globalThis as unknown as { __repereJobHandlers?: Map<JobType, JobHandler> };
const handlers = (g.__repereJobHandlers ??= new Map());

export function isJobType(t: unknown): t is JobType {
  return typeof t === 'string' && (JOB_TYPES as readonly string[]).includes(t);
}

/** Enregistre (ou remplace) le gestionnaire d'un type de tâche. */
export function registerHandler(type: JobType, handler: (payload: Record<string, unknown>) => Promise<void | Record<string, unknown>>): void {
  if (!isJobType(type)) throw new Error(`[jobs] type inconnu : ${String(type)}`);
  handlers.set(type, handler);
}

export function getHandler(type: JobType): JobHandler | undefined {
  return handlers.get(type);
}

export function registeredTypes(): JobType[] {
  return [...handlers.keys()];
}

/** Tests : retire un gestionnaire (ou tous). */
export function unregisterHandler(type?: JobType): void {
  if (type) handlers.delete(type);
  else handlers.clear();
}
