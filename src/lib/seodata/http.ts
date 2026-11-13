/**
 * Appels HTTP des fournisseurs SEO (hôtes fixes et officiels : Google, DataForSEO, Bing — jamais une URL saisie par un
 * client, d'où un fetch direct plutôt que safeFetch). Erreurs classées pour la file de tâches et l'interface.
 * Les URL de base sont remplaçables par le code seulement (tests sur faux serveurs locaux), jamais par l'environnement.
 */
import { PermanentJobError } from '@/lib/jobs/types';

export type SeoDataErrorCode = 'not_configured' | 'not_connected' | 'auth' | 'quota' | 'budget' | 'bad_request' | 'not_found' | 'upstream' | 'timeout' | 'demo_read_only';

export class SeoDataError extends Error {
  constructor(public code: SeoDataErrorCode, message: string, public status?: number) {
    super(message);
    this.name = 'SeoDataError';
  }
  /** vrai si une nouvelle tentative a un sens (quota, panne amont, délai) */
  get retryable(): boolean {
    return this.code === 'quota' || this.code === 'upstream' || this.code === 'timeout';
  }
  /** statut HTTP à renvoyer par nos routes */
  get httpStatus(): number {
    switch (this.code) {
      case 'not_configured':
        return 503;
      case 'not_connected':
        return 409;
      case 'auth':
        return 401;
      case 'quota':
        return 429;
      case 'budget':
        return 402;
      case 'bad_request':
        return 400;
      case 'not_found':
        return 404;
      case 'demo_read_only':
        return 403;
      default:
        return 502;
    }
  }
}

/** Erreur à lever dans un gestionnaire de tâche : définitive (pas de reprise) ou ordinaire (reprise avec backoff). */
export function toJobError(e: unknown): Error {
  if (e instanceof SeoDataError && !e.retryable) return new PermanentJobError(`${e.code}: ${e.message}`);
  return e instanceof Error ? e : new Error(String(e));
}

export const DEFAULT_ENDPOINTS = {
  googleAuth: 'https://accounts.google.com/o/oauth2/v2/auth',
  googleToken: 'https://oauth2.googleapis.com/token',
  googleRevoke: 'https://oauth2.googleapis.com/revoke',
  webmasters: 'https://www.googleapis.com/webmasters/v3',
  searchconsole: 'https://searchconsole.googleapis.com/v1',
  pagespeed: 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
  crux: 'https://chromeuxreport.googleapis.com/v1/records:queryRecord',
  dataforseo: 'https://api.dataforseo.com/v3',
  bing: 'https://ssl.bing.com/webmaster/api.svc/json',
};
export type Endpoints = typeof DEFAULT_ENDPOINTS;

const g = globalThis as unknown as { __repereSeoEndpoints?: Endpoints };

export function endpoints(): Endpoints {
  return g.__repereSeoEndpoints ?? DEFAULT_ENDPOINTS;
}

/** Tests : remplace des URL de base (faux serveurs locaux). `null` rétablit les URL officielles. */
export function setSeoDataEndpoints(patch: Partial<Endpoints> | null): void {
  if (patch && process.env.NODE_ENV === 'production') throw new Error('Option réservée aux tests : interdite en production.');
  g.__repereSeoEndpoints = patch ? { ...DEFAULT_ENDPOINTS, ...patch } : undefined;
}

export const HTTP_TIMEOUT_MS = 30_000;

export interface JsonRequest {
  method?: 'GET' | 'POST' | 'DELETE';
  headers?: Record<string, string>;
  json?: unknown;
  form?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** nom du fournisseur, pour les messages */
  provider: string;
}

/** Appel JSON avec classement des erreurs (401/403 → auth, 429 → quota, 5xx → upstream, 404 → not_found). */
export async function requestJson<T>(url: string, r: JsonRequest): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', 'user-agent': 'Repere-SeoData/1.0', ...(r.headers ?? {}) };
  let body: string | undefined;
  if (r.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(r.json);
  } else if (r.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(r.form).toString();
  }
  const timeout = AbortSignal.timeout(r.timeoutMs ?? HTTP_TIMEOUT_MS);
  const signal = r.signal ? AbortSignal.any([r.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, { method: r.method ?? (body ? 'POST' : 'GET'), headers, body, signal, redirect: 'error' });
  } catch (e) {
    const name = e instanceof Error ? e.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new SeoDataError('timeout', `${r.provider} : délai dépassé.`);
    throw new SeoDataError('upstream', `${r.provider} injoignable.`);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (res.ok) {
    if (data === null && text) throw new SeoDataError('upstream', `${r.provider} : réponse illisible.`, res.status);
    return data as T;
  }
  const detail = errorMessage(data);
  const msg = `${r.provider} : ${detail || `erreur ${res.status}`}`;
  if (res.status === 401 || res.status === 403) {
    // Google renvoie 403 pour un quota dépassé (rateLimitExceeded / quotaExceeded) : à reprendre plus tard.
    if (/quota|rate ?limit/i.test(detail)) throw new SeoDataError('quota', msg, res.status);
    throw new SeoDataError('auth', msg, res.status);
  }
  if (res.status === 429) throw new SeoDataError('quota', msg, res.status);
  if (res.status === 404) throw new SeoDataError('not_found', msg, res.status);
  if (res.status >= 500 || res.status === 408) throw new SeoDataError('upstream', msg, res.status);
  throw new SeoDataError('bad_request', msg, res.status);
}

function errorMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const d = data as Record<string, unknown>;
  const err = d.error;
  if (typeof err === 'string') return String(d.error_description ?? err).slice(0, 200);
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const reason = Array.isArray(e.errors) ? String((e.errors[0] as Record<string, unknown>)?.reason ?? '') : '';
    return `${String(e.message ?? e.status ?? '')}${reason ? ` (${reason})` : ''}`.slice(0, 200);
  }
  if (typeof d.status_message === 'string') return d.status_message.slice(0, 200);
  if (typeof d.Message === 'string') return d.Message.slice(0, 200);
  return '';
}

/** Lecture d'une variable d'environnement (chaîne vide = absente). */
export function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export const iso = (d: Date = new Date()) => d.toISOString();
export const day = (d: Date) => d.toISOString().slice(0, 10);
export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
export function monthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}
/** Semaine ISO « 2026-W46 » (relevés hebdomadaires). */
export function weekKey(d: Date = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** Domaine enregistrable simplifié pour comparer des domaines de SERP (www. retiré, minuscules). */
export function hostOf(urlOrDomain: string): string {
  const s = urlOrDomain.trim().toLowerCase();
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : `https://${s}`);
    return u.hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return s.replace(/^www\./, '');
  }
}

/** Même site : égalité, ou sous-domaine de l'autre. */
export function sameSite(a: string, b: string): boolean {
  const x = hostOf(a);
  const y = hostOf(b);
  return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
}
