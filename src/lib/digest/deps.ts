/**
 * Adaptateur des dépendances inter-modules de RETENTION (digest, copilote, démo).
 * - TRACKING ('@/lib/tracking') : getAiTraffic, seedDemoTraffic.
 * - EXECUTION ('@/lib/execution') : weeklyTasks, listTasks, updateTaskStatus, seedDemoExec.
 * Toute erreur d'un module tiers est absorbée : le digest et le copilote restent utilisables.
 */
import type { AiTrafficSummary, ExecTask, TaskKind, TaskStatus } from '@/lib/engine/types-v2';
import type { AuditResult } from '@/lib/engine';
import * as tracking from '@/lib/tracking';
import * as execution from './execution-adapter';
import { getLatestAuditForBusiness } from '@/lib/db';
import { getDoc, putDoc } from '@/lib/store';

// ---------------------------------------------------------------------------
// Trafic IA
// ---------------------------------------------------------------------------

export async function getAiTraffic(businessId: string, days = 30): Promise<AiTrafficSummary | null> {
  try {
    return await tracking.getAiTraffic(businessId, days);
  } catch (e) {
    console.warn('[retention] getAiTraffic indisponible', e);
    return null;
  }
}

export async function seedDemoTraffic(businessId: string): Promise<void> {
  try {
    await tracking.seedDemoTraffic(businessId);
  } catch (e) {
    console.warn('[retention] seedDemoTraffic indisponible', e);
  }
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------

export async function weeklyTasks(businessId: string): Promise<ExecTask[]> {
  try {
    return (await execution.weeklyTasks(businessId)).slice(0, 3);
  } catch (e) {
    console.warn('[retention] weeklyTasks indisponible', e);
    return [];
  }
}

export async function listTasks(businessId: string): Promise<ExecTask[]> {
  try {
    const t = await execution.listTasks(businessId);
    if (t.length) return t;
  } catch (e) {
    console.warn('[retention] listTasks indisponible', e);
  }
  // Repli : tâches dérivées de l'audit (avec leur statut « C'est fait »).
  return allFallbackTasks(businessId, await getLatestAuditForBusiness(businessId).catch(() => null));
}

/** Tâche EXECUTION ; tâche de repli `act-…` (digest sans tâches EXECUTION) stockée dans `digest.tasks`. */
export async function updateTaskStatus(businessId: string, taskId: string, status: TaskStatus): Promise<ExecTask | null> {
  if (!taskId.startsWith('act-')) return execution.updateTaskStatus(businessId, taskId, status);
  const key = `${businessId}:${taskId}`;
  const prev =
    (await getDoc<ExecTask>(FALLBACK_COLL, key))?.data ??
    tasksFromAudit(businessId, await getLatestAuditForBusiness(businessId)).find((t) => t.id === taskId);
  if (!prev) return null;
  const next: ExecTask = { ...prev, status, doneAt: status === 'done' ? new Date().toISOString() : undefined };
  await putDoc(FALLBACK_COLL, key, next, businessId);
  return next;
}

const FALLBACK_COLL = 'digest.tasks';

export async function seedDemoExec(businessId: string): Promise<void> {
  try {
    await execution.seedDemoExec(businessId);
  } catch (e) {
    console.warn('[retention] seedDemoExec indisponible', e);
  }
}

// ---------------------------------------------------------------------------
// Repli : tâches dérivées des actions V1 de l'audit (si EXECUTION ne renvoie rien)
// ---------------------------------------------------------------------------

const MINUTES = { S: 10, M: 25, L: 45 } as const;

export function tasksFromAudit(businessId: string, audit: AuditResult | null, now = new Date(), max = 3): ExecTask[] {
  if (!audit) return [];
  return audit.topActions.slice(0, max).map((a) => ({
    id: `act-${a.id}`,
    businessId,
    kind: 'other' as TaskKind,
    title: a.title,
    why: a.why,
    automation: 'guide' as const,
    minutes: MINUTES[a.effort],
    impact: a.impact,
    status: 'todo' as const,
    steps: a.how,
    createdAt: now.toISOString(),
  }));
}

/** Tâches de repli avec leur statut enregistré (`digest.tasks`) : les 3 premières encore à faire. */
export async function openFallbackTasks(businessId: string, audit: AuditResult | null, now = new Date()): Promise<ExecTask[]> {
  const all = await allFallbackTasks(businessId, audit, now);
  return all.filter((t) => t.status === 'todo' || t.status === 'in_progress').slice(0, 3);
}

async function allFallbackTasks(businessId: string, audit: AuditResult | null, now = new Date()): Promise<ExecTask[]> {
  const base = tasksFromAudit(businessId, audit, now, 20);
  const stored = await Promise.all(base.map((t) => getDoc<ExecTask>(FALLBACK_COLL, `${businessId}:${t.id}`)));
  return base.map((t, i) => stored[i]?.data ?? t);
}
