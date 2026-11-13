/**
 * File Postgres (Supabase, clé service_role) : table `jobs` et fonctions `jobs_claim` / `jobs_stats`
 * (supabase/migrations/0004_jobs.sql). Réservation par `for update skip locked`.
 * Toute écriture d'état (fin, reprise, abandon) est conditionnée au verrou du worker : un worker dont le bail a
 * expiré et dont la tâche a été reprise ailleurs ne peut plus écraser l'état.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Job, JobBackend, JobStats, NewJob } from './types';

interface Row {
  id: string;
  type: Job['type'];
  payload: Record<string, unknown> | null;
  business_id: string | null;
  dedupe_key: string | null;
  status: Job['status'];
  priority: number;
  attempts: number;
  max_attempts: number;
  run_at: string;
  locked_by: string | null;
  lock_expires_at: string | null;
  last_error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

export function rowToJob(r: Row): Job {
  return {
    id: r.id,
    type: r.type,
    payload: r.payload ?? {},
    businessId: r.business_id,
    dedupeKey: r.dedupe_key,
    status: r.status,
    priority: r.priority,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    runAt: r.run_at,
    lockedBy: r.locked_by,
    lockExpiresAt: r.lock_expires_at,
    lastError: r.last_error,
    result: r.result,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    finishedAt: r.finished_at,
  };
}

function fail(where: string, error: { message: string } | null): void {
  if (error) throw new Error(`[jobs] ${where} : ${error.message}`);
}

export function createSupabaseBackend(url: string, key: string): JobBackend {
  let client: SupabaseClient | null = null;
  const sb = () => (client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
  const now = () => new Date().toISOString();

  return {
    kind: 'supabase',
    async insert(n: NewJob) {
      const row = {
        type: n.type,
        payload: n.payload,
        business_id: n.businessId,
        dedupe_key: n.dedupeKey,
        priority: n.priority,
        max_attempts: n.maxAttempts,
        run_at: n.runAt.toISOString(),
      };
      if (!n.dedupeKey) {
        const { data, error } = await sb().from('jobs').insert(row).select('*').single();
        fail('insert', error);
        return { job: rowToJob(data as Row), created: true };
      }
      // insert … on conflict (dedupe_key) do nothing, puis lecture de la tâche existante.
      const { data, error } = await sb().from('jobs').upsert(row, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('*');
      fail('insert', error);
      const created = (data as Row[] | null)?.[0];
      if (created) return { job: rowToJob(created), created: true };
      const { data: existing, error: e2 } = await sb().from('jobs').select('*').eq('dedupe_key', n.dedupeKey).single();
      fail('insert.dedupe', e2);
      return { job: rowToJob(existing as Row), created: false };
    },
    async claim(workerId, limit, leaseMs) {
      const { data, error } = await sb().rpc('jobs_claim', { p_worker: workerId, p_limit: limit, p_lease_ms: Math.round(leaseMs) });
      fail('claim', error);
      return ((data as Row[] | null) ?? []).map(rowToJob);
    },
    async complete(id, workerId, result) {
      const t = now();
      const { error } = await sb()
        .from('jobs')
        .update({ status: 'done', result, last_error: null, locked_by: null, lock_expires_at: null, updated_at: t, finished_at: t })
        .eq('id', id)
        .eq('status', 'running')
        .eq('locked_by', workerId);
      fail('complete', error);
    },
    async retry(id, workerId, message, runAt) {
      const { error } = await sb()
        .from('jobs')
        .update({ status: 'queued', last_error: message, run_at: runAt.toISOString(), locked_by: null, lock_expires_at: null, updated_at: now() })
        .eq('id', id)
        .eq('status', 'running')
        .eq('locked_by', workerId);
      fail('retry', error);
    },
    async kill(id, workerId, message) {
      const t = now();
      const { error } = await sb()
        .from('jobs')
        .update({ status: 'dead', last_error: message, locked_by: null, lock_expires_at: null, updated_at: t, finished_at: t })
        .eq('id', id)
        .eq('status', 'running')
        .eq('locked_by', workerId);
      fail('kill', error);
    },
    async get(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
      const { data, error } = await sb().from('jobs').select('*').eq('id', id).maybeSingle();
      fail('get', error);
      return data ? rowToJob(data as Row) : null;
    },
    async stats(): Promise<JobStats> {
      const { data, error } = await sb().rpc('jobs_stats');
      fail('stats', error);
      const r = ((data as Record<string, unknown>[] | null) ?? [])[0] ?? {};
      const n = (k: string) => Number(r[k] ?? 0);
      return {
        queued: n('queued'),
        running: n('running'),
        done: n('done'),
        dead: n('dead'),
        oldestQueuedMin: r.oldest_queued_min == null ? null : Number(r.oldest_queued_min),
        backend: 'supabase',
      };
    },
    async listByBusiness(businessId, limit = 500) {
      const { data, error } = await sb().from('jobs').select('*').eq('business_id', businessId).order('created_at', { ascending: false }).limit(limit);
      fail('listByBusiness', error);
      return ((data as Row[] | null) ?? []).map(rowToJob);
    },
    async deleteByBusiness(businessId) {
      const { data, error } = await sb().from('jobs').delete().eq('business_id', businessId).select('id');
      fail('deleteByBusiness', error);
      return (data as unknown[] | null)?.length ?? 0;
    },
  };
}
