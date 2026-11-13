/**
 * Limitation de débit (fenêtre glissante) — qa/securite.md C1.
 * - Avec Supabase : fonction SQL atomique `rate_hit` (verrou par clé, voir supabase/schema.sql),
 *   partagée entre toutes les instances serverless.
 * - Sinon (démo / dev) : mémoire du processus, persistée dans `<DATA_DIR>/ratelimit.json`
 *   pour que les plafonds survivent à un redémarrage.
 * Les IP ne sont jamais stockées en clair : hash SHA-256 salé (RATE_LIMIT_SALT). IPv6 regroupée par /64.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Secondes avant de pouvoir réessayer (si ok = false). */
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Opérations coûteuses : refuser si la base est indisponible (au lieu du repli mémoire). */
  failClosed?: boolean;
}

function supabaseConfig() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    key: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  };
}

let _sb: SupabaseClient | null = null;
function sb(): SupabaseClient | null {
  const { url, key } = supabaseConfig();
  if (!url || !key) return null;
  if (!_sb) _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

/* ---------- Store mémoire (+ fichier en démo) ---------- */

const g = globalThis as unknown as { __repereRate?: Map<string, number[]>; __repereRateLoaded?: boolean };
const memHits: Map<string, number[]> = g.__repereRate ?? (g.__repereRate = new Map());

function rateFile(): string {
  return path.join(process.env.DATA_DIR || path.join(process.cwd(), '.data'), 'ratelimit.json');
}
function filePersistence(): boolean {
  return !process.env.VITEST && process.env.RATE_LIMIT_PERSIST !== '0';
}
function loadOnce() {
  if (g.__repereRateLoaded) return;
  g.__repereRateLoaded = true;
  if (!filePersistence()) return;
  try {
    const raw = JSON.parse(fs.readFileSync(rateFile(), 'utf8')) as Record<string, number[]>;
    for (const [k, v] of Object.entries(raw)) if (!memHits.has(k) && Array.isArray(v)) memHits.set(k, v);
  } catch {
    /* absent ou illisible : on part de zéro */
  }
}
function save() {
  if (!filePersistence()) return;
  try {
    fs.mkdirSync(path.dirname(rateFile()), { recursive: true });
    // Écriture atomique (temporaire + rename) : jamais de fichier tronqué lu par un autre processus.
    const tmp = `${rateFile()}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(memHits)));
    fs.renameSync(tmp, rateFile());
  } catch {
    /* lecture seule (serverless) : mémoire seulement */
  }
}

/* ---------- Identifiants ---------- */

const PROCESS_SALT = crypto.randomBytes(16).toString('hex');
let warnedSalt = false;

/**
 * Sel des identifiants hachés. Jamais d'erreur (les endpoints publics doivent se dégrader proprement) :
 * RATE_LIMIT_SALT, sinon dérivé d'AUDIT_SIGNING_SECRET, sinon sel aléatoire propre au processus (limites par instance).
 */
export function rateLimitSalt(): string {
  if (process.env.RATE_LIMIT_SALT) return process.env.RATE_LIMIT_SALT;
  if (process.env.AUDIT_SIGNING_SECRET) return crypto.createHash('sha256').update(`rate-limit:${process.env.AUDIT_SIGNING_SECRET}`).digest('hex');
  if (process.env.NODE_ENV !== 'production') return 'repere-dev-salt';
  if (!warnedSalt) {
    warnedSalt = true;
    console.warn('[ratelimit] RATE_LIMIT_SALT absent : sel aléatoire par processus (limites non partagées entre instances).');
  }
  return PROCESS_SALT;
}

export function hashKey(raw: string): string {
  const salt = rateLimitSalt();
  return crypto.createHash('sha256').update(`${salt}:${raw}`).digest('hex').slice(0, 32);
}

/** Regroupe une IPv6 par préfixe /64 (un client en possède au moins 2^64). */
export function ipBucket(ip: string): string {
  if (!ip.includes(':')) return ip;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(ip); // ::ffff:1.2.3.4
  if (v4) return v4[1];
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const full = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return `${full
    .slice(0, 4)
    .map((x) => x.toLowerCase().replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/**
 * IP du client. Sur Vercel, les en-têtes sont posés par la plateforme.
 * Ailleurs, X-Forwarded-For n'est lu que si TRUST_PROXY=1 ou hors production (sinon il est falsifiable).
 */
export function getClientIp(req: Request): string {
  const h = req.headers;
  let ip = '';
  if (process.env.VERCEL) {
    ip = (h.get('x-vercel-forwarded-for') || h.get('x-real-ip') || h.get('x-forwarded-for') || '').split(',')[0].trim();
  } else if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV !== 'production') {
    ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim();
  }
  return ipBucket(ip || '0.0.0.0');
}

/* ---------- Limite ---------- */

/**
 * Compte un appel pour `bucket:identifier` et indique s'il est autorisé.
 * @param limit nombre d'appels autorisés dans la fenêtre
 * @param windowMs durée de la fenêtre en millisecondes
 */
export async function rateLimit(
  bucket: string,
  identifier: string,
  limit: number,
  windowMs: number,
  opts: RateLimitOptions = {},
): Promise<RateLimitResult> {
  const key = `${bucket}:${hashKey(identifier)}`;
  const client = sb();

  if (client) {
    try {
      const { data, error } = await client.rpc('rate_hit', { p_key: key, p_limit: limit, p_window_ms: windowMs });
      if (error) throw error;
      const remaining = Number(data);
      if (remaining < 0) return { ok: false, remaining: 0, retryAfter: Math.ceil(windowMs / 1000) };
      return { ok: true, remaining, retryAfter: 0 };
    } catch (e) {
      console.warn('[ratelimit] Supabase indisponible', e);
      // Opérations coûteuses : on refuse plutôt que d'ouvrir les vannes.
      if (opts.failClosed) return { ok: false, remaining: 0, retryAfter: 60 };
    }
  }

  loadOnce();
  const now = Date.now();
  const since = now - windowMs;
  const hits = (memHits.get(key) ?? []).filter((t) => t > since);
  if (hits.length >= limit) {
    memHits.set(key, hits);
    return { ok: false, remaining: 0, retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  memHits.set(key, hits);
  if (memHits.size > 10_000) {
    for (const [k, v] of memHits) if (!v.some((t) => t > now - DAY_MS)) memHits.delete(k);
  }
  save();
  return { ok: true, remaining: limit - hits.length, retryAfter: 0 };
}

/**
 * Vide le compteur mémoire/fichier (tests et dev : DELETE /api/dev/ratelimit). N'affecte pas la table Supabase.
 * @returns nombre de clés supprimées
 */
export function resetRateLimit(bucket?: string): number {
  loadOnce();
  let n = 0;
  for (const k of [...memHits.keys()]) {
    if (!bucket || k.startsWith(`${bucket}:`)) {
      memHits.delete(k);
      n++;
    }
  }
  save();
  return n;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
