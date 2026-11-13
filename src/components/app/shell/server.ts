// Données de la coquille, côté serveur uniquement : droits, thème, commerces, index de recherche, signaux de démarrage.
import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { listAccountBusinesses } from '@/lib/auth/businesses';
import { getEntitlements, type Entitlements } from '@/lib/entitlements';
import { listNotifications } from '@/lib/notify';
import { listPrompts } from '@/lib/prompts';
import { adaptTasks, adaptTraffic } from '../adapters';
import { loadDashboard } from '../data';
import { loadWorkspace } from '../workspace';
import type { Signaux } from './demarrage';
import type { SearchIndex } from './palette';

export type ThemePref = 'system' | 'light' | 'dark';

export async function themePref(): Promise<ThemePref> {
  const v = (await cookies()).get('rp_theme')?.value;
  return v === 'light' || v === 'dark' ? v : 'system';
}

/** Droits de l'espace courant (démo : tout, en lecture seule). */
export const loadEntitlements = cache(async (): Promise<Entitlements> => {
  const [ws, d] = await Promise.all([loadWorkspace(), loadDashboard()]);
  if (ws.demo) return getEntitlements({ id: ws.business.id, plan: d.business.plan, segment: ws.segment, planId: d.business.planId });
  return getEntitlements(d.business);
});

export interface BusinessOption {
  id: string;
  name: string;
}

export const loadBusinessOptions = cache(async (): Promise<BusinessOption[]> => {
  const d = await loadDashboard();
  return d.demo ? [] : d.businesses.map((b) => ({ id: b.id, name: b.name }));
});

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try {
    return await p;
  } catch {
    return fallback;
  }
}

export const loadUnread = cache(async (businessId: string): Promise<number> => {
  const r = await safe(listNotifications(businessId, { unreadOnly: true, limit: 1 }), { items: [], unread: 0 });
  return r.unread;
});

/** Index de recherche : libellés seulement (questions, concurrents, tâches). */
export const loadSearchIndex = cache(async (): Promise<SearchIndex> => {
  const ws = await loadWorkspace();
  const [prompts, tasks] = await Promise.all([safe(listPrompts(ws.business.id), []), safe(adaptTasks(ws.business.id, ws.fb), [])]);
  const competitors = [...new Set((ws.latest?.competitors ?? []).map((c) => c.name))].slice(0, 40);
  return {
    questions: prompts.filter((p) => p.active).slice(0, 200).map((p) => ({ id: p.id, text: p.text })),
    competitors,
    tasks: tasks.slice(0, 100).map((t) => ({ id: t.id, title: t.title, done: t.status === 'done' })),
  };
});

/** Signaux de la liste « Bien démarrer ». */
export const loadSignaux = cache(async (): Promise<Signaux> => {
  const ws = await loadWorkspace();
  const [prompts, tasks, traffic] = await Promise.all([
    safe(listPrompts(ws.business.id), []),
    safe(adaptTasks(ws.business.id, ws.fb), []),
    safe(adaptTraffic(ws.business.id, 30, ws.fb), null),
  ]);
  return {
    website: ws.business.website,
    questions: prompts.filter((p) => p.active).length,
    audits: ws.audits.length,
    facts: Object.values(ws.facts.facts ?? {}).filter((v) => v !== undefined && v !== null && String(v).trim() !== '').length,
    trafficHits: traffic ? (traffic.installed ? Math.max(1, traffic.totals.aiVisits) : traffic.totals.aiVisits) : 0,
    tasksDone: tasks.filter((t) => t.status === 'done').length,
  };
});

/** Rôle de l'utilisateur sur l'espace courant ('demo' sur un compte démo). */
export const loadRole = cache(async (): Promise<'owner' | 'admin' | 'member' | 'viewer' | 'demo'> => {
  const ws = await loadWorkspace();
  if (ws.demo) return 'demo';
  const session = await getSession();
  if (!session) return 'viewer';
  const list = await safe(listAccountBusinesses(session), []);
  return list.find((b) => b.id === ws.business.id)?.role ?? 'viewer';
});
