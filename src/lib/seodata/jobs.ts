/**
 * Tâches de fond SEO-DATA (file src/lib/jobs) :
 *  - `seodata.gsc.sync`     { businessId, mode: 'import' | 'daily' } : import 16 mois puis synchronisation quotidienne ;
 *  - `seodata.rank.weekly`  { businessId }                            : relevé hebdomadaire des positions (dépôt) ;
 *  - `seodata.rank.collect` { businessId, week, round }               : collecte des relevés déposés.
 *
 * Ces types doivent être ajoutés à JOB_TYPES / DEFAULT_PRIORITY (src/lib/jobs/types.ts, orchestrateur). Tant qu'ils
 * n'y sont pas, `dispatch` exécute la tâche immédiate en ligne et ignore les tâches différées : le balayage quotidien
 * `scheduleSeoData` (à brancher sur un cron) reprend alors les collectes en attente.
 */
import { enqueue, isJobType, registerHandler, type JobType } from '@/lib/jobs';
import { listDocs } from '@/lib/store';
import { log } from '@/lib/log';
import { CONN, type GscConnection } from './google-oauth';
import { SeoDataError, toJobError, weekKey } from './http';
import { contextFor, providersFor } from './providers';
import { RANK_CONFIG, RANK_SNAP, collectWeekly, refreshVolumes, runWeekly, type RankConfig, type RankSnapshot } from './rank';
import { syncSearchConsole } from './searchconsole';

export const SEODATA_JOB_TYPES = ['seodata.gsc.sync', 'seodata.rank.weekly', 'seodata.rank.collect'] as const;
export type SeoDataJobType = (typeof SEODATA_JOB_TYPES)[number];
/** Priorités proposées pour DEFAULT_PRIORITY (1 = urgent). */
export const SEODATA_PRIORITY: Record<SeoDataJobType, number> = { 'seodata.gsc.sync': 5, 'seodata.rank.weekly': 6, 'seodata.rank.collect': 6 };
export const COLLECT_DELAY_MS = 20 * 60_000;
export const MAX_COLLECT_ROUNDS = 48;

type Handler = (payload: Record<string, unknown>) => Promise<void | Record<string, unknown>>;

const bid = (p: Record<string, unknown>) => {
  const b = String(p.businessId ?? '');
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(b)) throw new SeoDataError('bad_request', 'businessId invalide');
  return b;
};

export const handlers: Record<SeoDataJobType, Handler> = {
  async 'seodata.gsc.sync'(p) {
    try {
      const r = await syncSearchConsole(bid(p), p.mode === 'import' ? 'import' : 'daily');
      return { ...r };
    } catch (e) {
      throw toJobError(e);
    }
  },
  async 'seodata.rank.weekly'(p) {
    try {
      const ctx = await contextFor(bid(p));
      if (ctx.demoId) return { skipped: 'demo' };
      const ps = await providersFor(ctx);
      if (ps.keywords) await refreshVolumes(ctx, ps.keywords).catch((e) => log.warn('seodata.volumes_failed', { businessId: ctx.businessId, error: String(e) }));
      const snap = await runWeekly(ctx, ps.serp);
      if (snap.status === 'pending') {
        await dispatch('seodata.rank.collect', { businessId: ctx.businessId, week: snap.week, round: 1 }, { runAt: new Date(Date.now() + COLLECT_DELAY_MS), dedupeKey: `rank-collect:${ctx.businessId}:${snap.week}:1` });
      }
      return { week: snap.week, status: snap.status, pending: snap.pending.length, results: snap.results.length };
    } catch (e) {
      throw toJobError(e);
    }
  },
  async 'seodata.rank.collect'(p) {
    try {
      const ctx = await contextFor(bid(p));
      const week = String(p.week ?? '');
      if (!/^\d{4}-W\d{2}$/.test(week)) throw new SeoDataError('bad_request', 'semaine invalide');
      const round = Math.max(1, Number(p.round) || 1);
      const ps = await providersFor(ctx);
      const snap = await collectWeekly(ctx, ps.serp, week);
      if (snap?.status === 'pending' && round < MAX_COLLECT_ROUNDS) {
        await dispatch('seodata.rank.collect', { businessId: ctx.businessId, week, round: round + 1 }, { runAt: new Date(Date.now() + COLLECT_DELAY_MS), dedupeKey: `rank-collect:${ctx.businessId}:${week}:${round + 1}` });
      }
      return { week, status: snap?.status ?? 'absent', pending: snap?.pending.length ?? 0 };
    } catch (e) {
      throw toJobError(e);
    }
  },
};

/** Enregistre les gestionnaires dont le type est connu de la file. Renvoie les types enregistrés. */
export function registerSeoDataJobs(): SeoDataJobType[] {
  const done: SeoDataJobType[] = [];
  for (const t of SEODATA_JOB_TYPES) {
    if (isJobType(t)) {
      registerHandler(t as JobType, handlers[t]);
      done.push(t);
    }
  }
  return done;
}

/**
 * Met en file si le type est connu ; sinon exécute en ligne une tâche immédiate (et ignore une tâche différée,
 * reprise par `scheduleSeoData`). Renvoie le mode employé.
 */
export async function dispatch(type: SeoDataJobType, payload: Record<string, unknown>, opts: { runAt?: Date; dedupeKey?: string } = {}): Promise<'queued' | 'inline' | 'deferred'> {
  if (isJobType(type as string)) {
    registerSeoDataJobs();
    await enqueue(type as JobType, payload, { ...opts, businessId: String(payload.businessId ?? ''), priority: SEODATA_PRIORITY[type] });
    return 'queued';
  }
  if (opts.runAt && opts.runAt.getTime() > Date.now() + 1000) return 'deferred';
  log.info('seodata.job_inline', { type, businessId: String(payload.businessId ?? '') });
  await handlers[type](payload);
  return 'inline';
}

/**
 * Balayage (cron quotidien) : synchronisation Search Console des comptes connectés, relevé hebdomadaire le lundi
 * (ou si la semaine n'a pas encore de relevé), collecte des relevés en attente. Idempotent (clés d'unicité).
 */
export async function scheduleSeoData(now: Date = new Date()): Promise<{ gsc: number; ranks: number; collects: number; errors: number }> {
  const out = { gsc: 0, ranks: 0, collects: 0, errors: 0 };
  const today = now.toISOString().slice(0, 10);
  const week = weekKey(now);
  const run = async (type: SeoDataJobType, payload: Record<string, unknown>, dedupeKey: string) => {
    try {
      await dispatch(type, payload, { dedupeKey });
      return true;
    } catch (e) {
      out.errors++;
      log.warn('seodata.schedule_failed', { type, businessId: String(payload.businessId), error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };
  for (const d of await listDocs<GscConnection>(CONN, { limit: 5000 })) {
    const c = d.data;
    if (!c || c.status !== 'active' || !c.siteUrl) continue;
    if (await run('seodata.gsc.sync', { businessId: c.businessId, mode: c.importedAt ? 'daily' : 'import' }, `gsc:${c.businessId}:${today}`)) out.gsc++;
  }
  const snaps = new Map<string, RankSnapshot>();
  for (const d of await listDocs<RankSnapshot>(RANK_SNAP, { limit: 5000 })) if (d.data?.week === week) snaps.set(d.data.businessId, d.data);
  for (const d of await listDocs<RankConfig>(RANK_CONFIG, { limit: 5000 })) {
    const c = d.data;
    if (!c || c.keywords.length === 0) continue;
    const s = snaps.get(c.businessId);
    if (!s) {
      if (await run('seodata.rank.weekly', { businessId: c.businessId }, `rank:${c.businessId}:${week}`)) out.ranks++;
    } else if (s.status === 'pending') {
      if (await run('seodata.rank.collect', { businessId: c.businessId, week, round: 1 }, `rank-collect:${c.businessId}:${week}:sweep:${today}`)) out.collects++;
    }
  }
  return out;
}

registerSeoDataJobs();
