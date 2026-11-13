/**
 * Branchement des modules V2 réels (seul fichier qui les importe).
 * Une entrée absente = module non livré au moment de la vérification : adapters.ts utilise alors le repli démo.
 */
import type { Segment } from '@/lib/engine/types-v2';
import { getDemoWorkspace } from '@/lib/demo-v2';
import { listTasks, weeklyTasks } from '@/lib/execution';
import { getAiTraffic, snippetFor } from '@/lib/tracking';
import { getFacts } from '@/lib/facts';
import { buildWeeklyDigest } from '@/lib/digest';

type Fn<A extends unknown[]> = (...args: A) => unknown;

export const REAL: {
  getDemoWorkspace?: Fn<[Segment]>;
  listTasks?: Fn<[string]>;
  weeklyTasks?: Fn<[string]>;
  getAiTraffic?: Fn<[string, number]>;
  snippetFor?: (businessId: string) => unknown;
  getFacts?: Fn<[string]>;
  buildWeeklyDigest?: Fn<[string]>;
} = {
  getDemoWorkspace: (s) => getDemoWorkspace(s),
  listTasks: (id) => listTasks(id),
  weeklyTasks: (id) => weeklyTasks(id),
  getAiTraffic: (id, days) => getAiTraffic(id, days),
  snippetFor,
  getFacts: (id) => getFacts(id),
  buildWeeklyDigest: (id) => buildWeeklyDigest(id),
};
