/**
 * Client HTTP des connecteurs de publication.
 *
 * Les hôtes WordPress et PrestaShop sont saisis par le client : chaque appel est épinglé sur une IP publique validée
 * (`resolvePublic` de src/lib/siteaudit/fetch.ts, pas de seconde résolution DNS), https seulement, port 443, aucune
 * redirection suivie (un 3xx est renvoyé tel quel : les identifiants ne partent jamais vers un autre hôte), réponse
 * bornée à 5 Mo, délai 15 s. Les tests remplacent le client par `setPublishHttp` (refusé en production).
 */
import http from 'node:http';
import https from 'node:https';
import { resolvePublic, type ResolvedAddress, type Resolver } from '@/lib/siteaudit/fetch';
import { PublishError, type HttpClient, type HttpRequest, type HttpResponse } from './types';

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 15_000;
export const USER_AGENT = 'Repere-Publication/1.0 (+https://repere-ia.fr/methode/agent)';

/** Contrôle statique d'une URL d'API : https, pas d'identifiants, port standard, pas d'hôte interne. */
export function checkApiUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new PublishError(400, 'Adresse invalide.');
  }
  if (u.protocol !== 'https:') throw new PublishError(400, 'L’adresse doit commencer par https://.');
  if (u.username || u.password) throw new PublishError(400, 'Retirez les identifiants de l’adresse.');
  if (u.port && u.port !== '443') throw new PublishError(400, 'Seul le port 443 est accepté.');
  const host = u.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/, '').toLowerCase();
  if (!host || /^(localhost|.*\.local|.*\.internal|.*\.localhost)$/.test(host)) throw new PublishError(400, 'Adresse interne refusée.');
  return u;
}

/** Normalise l'adresse d'un site saisie (« exemple.fr » → https://exemple.fr). */
export function normalizeSiteUrl(raw: string): string {
  let s = String(raw ?? '').trim();
  if (!s) throw new PublishError(400, 'Adresse du site manquante.');
  if (!/^[a-z]+:\/\//i.test(s)) s = `https://${s}`;
  const u = checkApiUrl(s);
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

function pinnedRequest(u: URL, address: ResolvedAddress, req: HttpRequest): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const lookup = ((_h: string, opts: { all?: boolean }, cb: (...a: unknown[]) => void) =>
      opts && opts.all ? cb(null, [{ address: address.address, family: address.family }]) : cb(null, address.address, address.family)) as never;
    const headers: Record<string, string> = { 'user-agent': USER_AGENT, accept: 'application/json', ...(req.headers ?? {}) };
    if (req.body !== undefined) headers['content-length'] = String(Buffer.byteLength(req.body));
    const mod = u.protocol === 'http:' ? http : https;
    const r = mod.request(u, { method: req.method, headers, agent: false, lookup, signal: AbortSignal.timeout(req.timeoutMs ?? DEFAULT_TIMEOUT_MS) }, (res) => {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
      const chunks: Buffer[] = [];
      let size = 0;
      res.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_RESPONSE_BYTES) {
          res.destroy();
          reject(new PublishError(502, 'Réponse trop volumineuse.'));
          return;
        }
        chunks.push(c);
      });
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: out, text: Buffer.concat(chunks).toString('utf8') }));
      res.on('error', reject);
    });
    r.on('error', reject);
    r.end(req.body);
  });
}

/** Client de production : épinglage DNS + règles ci-dessus. */
export function createSafeHttp(opts: { resolver?: Resolver } = {}): HttpClient {
  return async (req) => {
    const u = checkApiUrl(req.url);
    const host = u.hostname.replace(/^\[|\]$/g, '');
    let address: ResolvedAddress;
    try {
      address = await resolvePublic(host, opts.resolver);
    } catch {
      throw new PublishError(400, 'Adresse injoignable ou refusée.');
    }
    try {
      return await pinnedRequest(u, address, req);
    } catch (e) {
      if (e instanceof PublishError) throw e;
      throw new PublishError(502, 'Le site n’a pas répondu.');
    }
  };
}

let override: HttpClient | null = null;
const prod: HttpClient = createSafeHttp();

/** Tests : remplace le client (faux serveur local). Interdit en production. */
export function setPublishHttp(client: HttpClient | null): void {
  if (client && process.env.NODE_ENV === 'production') throw new Error('Option réservée aux tests : interdite en production.');
  override = client;
}

export function publishHttp(): HttpClient {
  return override ?? prod;
}

// ---------------------------------------------------------------------------
// Aides communes aux connecteurs
// ---------------------------------------------------------------------------
export function basicAuth(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

export function parseJson<T>(res: HttpResponse, what: string): T {
  try {
    return JSON.parse(res.text) as T;
  } catch {
    throw new PublishError(502, `${what} : réponse illisible.`);
  }
}

/** Erreur lisible selon le statut (sans recopier le corps de la réponse, qui peut contenir des données). */
export function statusError(res: HttpResponse, what: string): PublishError {
  if (res.status === 401) return new PublishError(401, `${what} : identifiants refusés.`, 'auth');
  if (res.status === 403) return new PublishError(403, `${what} : droits insuffisants.`, 'forbidden');
  if (res.status === 404) return new PublishError(404, `${what} : introuvable.`, 'not_found');
  if (res.status === 429) return new PublishError(429, `${what} : trop de requêtes, réessayez plus tard.`, 'rate_limited');
  if (res.status >= 300 && res.status < 400) return new PublishError(502, `${what} : redirection inattendue (vérifiez l’adresse du site).`, 'redirect');
  return new PublishError(502, `${what} : erreur ${res.status}.`, 'upstream');
}

export async function requestJson<T>(client: HttpClient, req: HttpRequest, what: string, okStatuses: number[] = [200, 201]): Promise<T> {
  const res = await client(req);
  if (!okStatuses.includes(res.status)) throw statusError(res, what);
  return res.text ? parseJson<T>(res, what) : (undefined as T);
}
