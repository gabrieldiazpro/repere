/** Socle commun des providers : erreurs, POST JSON avec timeout + retry, nettoyage des URL. */
import type { ProviderId, RawSource } from '../types';
import { env, sleep } from '../util';

export type Vendor = 'openai' | 'perplexity' | 'gemini' | 'anthropic' | 'mistral';

export class ProviderError extends Error {
  constructor(
    public vendor: Vendor,
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(`[${vendor}] ${message}`);
    this.name = 'ProviderError';
  }
}

export interface AskContext {
  city?: string;
  country?: string;
  queryId: string;
  run: number;
}

export interface AskResult {
  text: string;
  citations: string[];
  /** V2 : sources structurées (titre, extrait, position dans le texte) */
  sources?: RawSource[];
}

/** Retire les paramètres utm_* (même règle que uniqueUrls) ; null si l'URL est invalide. */
export function cleanUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = new URL(raw.trim());
    for (const k of [...parsed.searchParams.keys()]) if (k.startsWith('utm_')) parsed.searchParams.delete(k);
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Dédoublonne des RawSource par URL nettoyée (garde la première occurrence, numérote `order`). */
export function uniqueSources(xs: RawSource[]): RawSource[] {
  const seen = new Map<string, RawSource>();
  for (const x of xs) {
    const u = cleanUrl(x.url);
    if (!u) continue;
    const prev = seen.get(u);
    if (prev) {
      if (prev.kind === 'retrieved' && x.kind === 'cited') prev.kind = 'cited';
      prev.title ??= x.title;
      prev.snippet ??= x.snippet;
      if (prev.startIndex == null && x.startIndex != null) prev.startIndex = x.startIndex;
      continue;
    }
    seen.set(u, { ...x, url: u });
  }
  let i = 0;
  return [...seen.values()].map((s) => ({ ...s, order: s.kind === 'retrieved' ? undefined : ++i }));
}

/** IA interrogée pour l'audit. */
export interface EngineProvider {
  id: ProviderId;
  model: string;
  demo: boolean;
  /** coût estimé d'un appel, en euros (pire cas, méthode § 3.2) */
  costPerCallEur: number;
  ask(query: string, ctx: AskContext): Promise<AskResult>;
}

/** LLM bon marché utilisé pour l'extraction JSON des entités (méthode § 4.6). */
export interface Extractor {
  vendor: Vendor;
  model: string;
  costPerCallEur: number;
  completeJson(system: string, user: string): Promise<string>;
}

export const USD_TO_EUR = 0.92;

export function defaultTimeoutMs(): number {
  const v = Number(env('AUDIT_TIMEOUT_MS'));
  return Number.isFinite(v) && v > 0 ? v : 60_000;
}

function maxAttempts(): number {
  const v = Number(env('AUDIT_RETRIES'));
  return Number.isFinite(v) && v >= 0 ? Math.min(4, Math.floor(v)) + 1 : 2;
}

const COUNTRY_CODES: Record<string, string> = {
  france: 'FR', belgique: 'BE', belgium: 'BE', suisse: 'CH', switzerland: 'CH', luxembourg: 'LU',
  canada: 'CA', monaco: 'MC', 'royaume-uni': 'GB', 'united kingdom': 'GB', espagne: 'ES', italie: 'IT',
  allemagne: 'DE', 'etats-unis': 'US', 'états-unis': 'US', usa: 'US',
};

export function toIsoCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const c = country.trim();
  if (/^[a-z]{2}$/i.test(c)) return c.toUpperCase();
  return COUNTRY_CODES[c.toLowerCase()];
}

export function uniqueUrls(urls: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue;
    let u = raw.trim();
    try {
      const parsed = new URL(u);
      for (const k of [...parsed.searchParams.keys()]) if (k.startsWith('utm_')) parsed.searchParams.delete(k);
      u = parsed.toString();
    } catch {
      continue;
    }
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;

/**
 * POST JSON avec timeout (AbortController) et nouvelles tentatives sur 429, 5xx, timeout ou erreur réseau
 * (2 tentatives par défaut, AUDIT_RETRIES pour changer). Lève ProviderError avec un extrait du corps.
 */
export async function postJson(
  vendor: Vendor,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = defaultTimeoutMs(),
): Promise<Json> {
  const attempts = maxAttempts();
  let lastErr: ProviderError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await postOnce(vendor, url, headers, body, timeoutMs);
    } catch (e) {
      const err = e instanceof ProviderError ? e : new ProviderError(vendor, String(e));
      lastErr = err;
      if (!err.retryable || attempt === attempts) throw err;
      const wait = (err as ProviderError & { waitMs?: number }).waitMs ?? 1_000 * 2 ** (attempt - 1);
      await sleep(Math.min(wait, 10_000));
    }
  }
  throw lastErr ?? new ProviderError(vendor, 'échec inconnu');
}

async function postOnce(
  vendor: Vendor,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs: number,
): Promise<Json> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const e = err as { name?: string; message?: string };
    if (e?.name === 'AbortError') throw new ProviderError(vendor, `délai dépassé (${timeoutMs} ms)`, undefined, true);
    throw new ProviderError(vendor, `erreur réseau : ${e?.message ?? String(err)}`, undefined, true);
  }
  let raw: string;
  try {
    raw = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    let msg = raw.slice(0, 300);
    try {
      const j = JSON.parse(raw);
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch {
      /* corps non JSON */
    }
    const err = new ProviderError(vendor, `HTTP ${res.status} : ${msg}`, res.status, retryable) as ProviderError & {
      waitMs?: number;
    };
    const ra = Number(res.headers.get('retry-after'));
    if (Number.isFinite(ra) && ra > 0) err.waitMs = ra * 1000;
    throw err;
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderError(vendor, 'réponse non JSON', res.status);
  }
}
