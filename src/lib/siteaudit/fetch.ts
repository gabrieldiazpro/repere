/**
 * Récupération d'URL sûre (anti-SSRF) pour les outils et l'audit de site.
 *
 * - Schémas http/https uniquement, ports 80 et 443 uniquement, pas d'identifiants dans l'URL.
 * - Résolution DNS par nos soins : TOUTES les adresses doivent être publiques (refus des IP privées, de bouclage,
 *   de lien local dont 169.254.169.254, CGNAT, multicast, réservées, IPv6 ULA/lien local, IPv4 mappée ou NAT64
 *   vers une adresse privée). La connexion se fait sur l'adresse validée (épinglage) : un DNS qui change de
 *   réponse entre la vérification et la connexion (DNS rebinding) n'a aucun effet.
 * - Redirections suivies à la main (5 au plus), chaque saut est revalidé (schéma, port, DNS, robots.txt).
 * - Délai global de 8 s, corps limité à 2 Mo APRÈS décompression (bombe gzip), user-agent identifiable.
 * - robots.txt de la cible respecté pour notre robot (groupe RepereBot, sinon « * »).
 * - Cache mémoire de 10 minutes.
 *
 * Le transport et le résolveur sont injectables : les tests ne sortent jamais sur Internet.
 */
import { lookup as dnsLookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { isAllowed, parseRobots } from './robots';

export const USER_AGENT = 'RepereBot/1.0 (+https://repere-ia.fr/methode/robot)';
export const BOT_TOKEN = 'RepereBot';
export const TIMEOUT_MS = 8_000;
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_REDIRECTS = 5;
export const CACHE_TTL_MS = 10 * 60 * 1000;

export type SafeFetchErrorCode =
  | 'invalid_url'
  | 'blocked_scheme'
  | 'blocked_port'
  | 'blocked_credentials'
  | 'blocked_host'
  | 'blocked_ip'
  | 'dns'
  | 'timeout'
  | 'too_many_redirects'
  | 'robots_disallowed'
  | 'tls'
  | 'firewall'
  | 'rate_limited'
  | 'network';

const MESSAGES: Record<SafeFetchErrorCode, string> = {
  invalid_url: 'Adresse invalide.',
  blocked_scheme: 'Seules les adresses http et https sont acceptées.',
  blocked_port: 'Seuls les ports 80 et 443 sont acceptés.',
  blocked_credentials: 'Les adresses avec identifiants ne sont pas acceptées.',
  blocked_host: 'Cette adresse ne pointe pas vers un site public.',
  blocked_ip: 'Cette adresse ne pointe pas vers un site public.',
  dns: 'Nom de domaine introuvable.',
  timeout: 'Le site n’a pas répondu dans les 8 secondes.',
  too_many_redirects: 'Trop de redirections.',
  robots_disallowed: 'Le robots.txt du site interdit l’accès à notre robot (RepereBot) : nous respectons ce choix.',
  tls: 'Le certificat HTTPS du site n’est pas valide (expiré, auto-signé ou délivré pour un autre domaine) : les navigateurs affichent une alerte de sécurité.',
  firewall: 'Le site refuse notre robot (protection anti-robots) : la page n’a pas pu être lue, aucun résultat n’est calculé. Googlebot peut être autorisé, lui : vérifiez avec l’outil d’inspection d’URL de la Search Console.',
  rate_limited: 'Le site limite les visites de notre robot (erreur 429) : réessayez dans quelques minutes.',
  network: 'Le site est injoignable.',
};

/**
 * Erreur de certificat ou de négociation TLS (codes Node.js). TESTS-REELS (nov. 2026) : un vrai site de cuisiniste
 * présentait le certificat d'un autre domaine ; le message générique « Le site est injoignable » ne disait pas quoi faire.
 */
export function isTlsError(e: unknown): boolean {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const msg = String((e as Error | null)?.message ?? '');
  return /^(?:CERT_|ERR_TLS_|ERR_SSL_|UNABLE_TO_|DEPTH_ZERO_SELF_SIGNED_CERT|SELF_SIGNED_CERT_IN_CHAIN|HOSTNAME_MISMATCH)/.test(code) || /certificate|self[- ]signed|altnames|ssl3?_|tlsv1 alert|wrong version number/i.test(msg);
}

export class SafeFetchError extends Error {
  code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, detail?: string) {
    super(detail ? `${MESSAGES[code]} (${detail})` : MESSAGES[code]);
    this.code = code;
    this.name = 'SafeFetchError';
  }
  /** Message destiné à l'utilisateur (sans détail technique). */
  get publicMessage(): string {
    return MESSAGES[this.code];
  }
}

/* ------------------------------------------------------------------ */
/* Adresses IP                                                         */
/* ------------------------------------------------------------------ */

function v4ToInt(ip: string): number {
  return ip.split('.').reduce((a, o) => (a << 8) + Number(o), 0) >>> 0;
}
function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const n = Number(bits);
  const mask = n === 0 ? 0 : (~0 << (32 - n)) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
}

const V4_BLOCKED = [
  '0.0.0.0/8', // « ce réseau »
  '10.0.0.0/8',
  '100.64.0.0/10', // CGNAT
  '127.0.0.0/8',
  '169.254.0.0/16', // lien local, métadonnées cloud (169.254.169.254)
  '172.16.0.0/12',
  '192.0.0.0/24', // IETF (dont 192.0.0.192 métadonnées Oracle)
  '192.0.2.0/24', // documentation
  '192.88.99.0/24', // relais 6to4
  '192.168.0.0/16',
  '198.18.0.0/15', // bancs de test
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // réservé + diffusion
];

/** Développe une IPv6 en 8 groupes de 16 bits (null si invalide). Gère la forme IPv4 finale. */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/%.*$/, '');
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    if (!net.isIPv4(v4[1])) return null;
    const n = v4ToInt(v4[1]);
    s = s.slice(0, v4.index) + `${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0) return null;
  const all = [...head, ...Array(fill).fill('0'), ...tail];
  if (all.length !== 8) return null;
  const out = all.map((h) => parseInt(h || '0', 16));
  return out.some((x) => Number.isNaN(x) || x < 0 || x > 0xffff) ? null : out;
}

/** Adresse non routable publiquement (ou invalide) : à refuser. */
export function isBlockedIp(ip: string): boolean {
  const raw = ip.replace(/^\[|\]$/g, '');
  if (net.isIPv4(raw)) return V4_BLOCKED.some((c) => inV4(raw, c));
  if (!net.isIPv6(raw)) return true;
  const g = expandV6(raw);
  if (!g) return true;
  const embedded = (hi: number, lo: number) => `${hi >>> 8}.${hi & 0xff}.${lo >>> 8}.${lo & 0xff}`;
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  // IPv4 mappée (::ffff:a.b.c.d) ou compatible (::a.b.c.d) : on juge l'IPv4 incluse.
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return isBlockedIp(embedded(g[6], g[7]));
  // NAT64 (64:ff9b::/96) : on juge l'IPv4 incluse.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedIp(embedded(g[6], g[7]));
  if (g[0] === 0x2002) return isBlockedIp(embedded(g[1], g[2])); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA (dont fd00:ec2::254 métadonnées AWS)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 lien local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site local (obsolète)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 rejet
  return (g[0] & 0xe000) !== 0x2000; // hors 2000::/3 (unicast global) : refusé
}

const BLOCKED_HOSTS = /^(localhost|metadata|metadata\.google\.internal|instance-data)$|\.(localhost|local|internal|intranet|lan|home|corp|localdomain|home\.arpa)$/i;

/* ------------------------------------------------------------------ */
/* Dépendances injectables                                            */
/* ------------------------------------------------------------------ */

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}
export type Resolver = (host: string) => Promise<ResolvedAddress[]>;

export interface TransportRequest {
  url: URL;
  /** Adresse IP validée sur laquelle se connecter (épinglage). */
  address: ResolvedAddress;
  headers: Record<string, string>;
  signal: AbortSignal;
  maxBytes: number;
  /** Méthode HTTP (défaut GET). HEAD : en-têtes seuls, sans corps (vérification d'état des liens, V5 CRAWL). */
  method?: 'GET' | 'HEAD';
}
export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
}
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export const systemResolver: Resolver = async (host) => {
  const all = await dnsLookup(host, { all: true, verbatim: true });
  return all.map((a) => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
};

/**
 * Transport réel : node:http(s) avec `lookup` forcé sur l'adresse validée, décompression bornée.
 * ROBUSTESSE (V6) : la promesse se règle TOUJOURS — annulation, coupure en plein corps (y compris derrière un flux
 * gzip, dont les erreurs ne remontaient pas), corps au compte-gouttes : un site lent ne peut plus bloquer un crawl.
 * Les en-têtes Set-Cookie multiples sont joints par « \n » (une date d'expiration contient une virgule).
 */
export const nodeTransport: Transport = (req) =>
  new Promise<TransportResponse>((resolve, reject) => {
    const mod = req.url.protocol === 'https:' ? https : http;
    const pinned: net.LookupFunction = (_host, opts, cb) => {
      const o = opts as { all?: boolean };
      if (o && o.all) (cb as unknown as (e: null, a: { address: string; family: number }[]) => void)(null, [{ address: req.address.address, family: req.address.family }]);
      else cb(null, req.address.address, req.address.family);
    };
    let settled = false;
    const ok = (v: TransportResponse) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      reject(e instanceof Error ? e : new Error(String(e)));
    };
    if (req.signal.aborted) return fail(new Error('aborted'));
    const r = mod.request(
      req.url,
      { method: req.method ?? 'GET', headers: req.headers, lookup: pinned, signal: req.signal, agent: false },
      (res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) if (v !== undefined) headers[k.toLowerCase()] = Array.isArray(v) ? v.join(k.toLowerCase() === 'set-cookie' ? '\n' : ', ') : String(v);
        const status = res.statusCode ?? 0;
        if ((status >= 300 && status < 400) || req.method === 'HEAD') {
          res.resume();
          ok({ status, headers, body: Buffer.alloc(0), truncated: false });
          return;
        }
        const enc = (headers['content-encoding'] || '').toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        let decoder: zlib.Gunzip | zlib.BrotliDecompress | zlib.Inflate | null = null;
        if (enc.includes('gzip')) decoder = zlib.createGunzip();
        else if (enc.includes('br')) decoder = zlib.createBrotliDecompress();
        else if (enc.includes('deflate')) decoder = zlib.createInflate();
        if (decoder) stream = res.pipe(decoder);
        const chunks: Buffer[] = [];
        let size = 0;
        const finish = (truncated: boolean) => {
          ok({ status, headers, body: Buffer.concat(chunks).subarray(0, req.maxBytes), truncated });
          res.destroy();
          decoder?.destroy();
        };
        stream.on('data', (c: Buffer) => {
          if (settled) return;
          chunks.push(c);
          size += c.length;
          if (size >= req.maxBytes) finish(true);
        });
        stream.on('end', () => finish(false));
        stream.on('error', (e) => {
          // Corps illisible après coup (gzip tronqué…) : on garde ce qui a été reçu s'il y en a.
          if (chunks.length && !req.signal.aborted) finish(true);
          else fail(e);
        });
        // Erreurs et coupures côté réponse : elles ne traversent pas pipe() jusqu'au décodeur.
        res.on('error', (e) => fail(e));
        res.on('aborted', () => fail(new Error('connexion interrompue')));
        res.on('close', () => {
          if (!settled && !res.complete) fail(new Error(req.signal.aborted ? 'aborted' : 'connexion interrompue'));
        });
      },
    );
    r.on('error', fail);
    r.on('close', () => {
      if (!settled && req.signal.aborted) fail(new Error('aborted'));
    });
    req.signal.addEventListener('abort', () => {
      r.destroy();
      fail(new Error('aborted'));
    }, { once: true });
    r.end();
  });

export interface SafeFetchOptions {
  /** Respecter le robots.txt de la cible pour RepereBot (défaut : true). */
  respectRobots?: boolean;
  accept?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  /** Utiliser le cache de 10 minutes (défaut : true). */
  cache?: boolean;
  resolver?: Resolver;
  transport?: Transport;
}

export interface SafeResponse {
  url: string;
  finalUrl: string;
  status: number;
  headers: Record<string, string>;
  contentType: string;
  body: string;
  bytes: number;
  truncated: boolean;
  elapsedMs: number;
  /** Durée des seuls échanges HTTP avec la page (hors robots.txt et DNS), redirections comprises. */
  transportMs: number;
  redirects: string[];
  fromCache: boolean;
}

/* ------------------------------------------------------------------ */
/* Valeurs par défaut (surchargeables pour les tests et le mode démo)  */
/* ------------------------------------------------------------------ */

const g = globalThis as unknown as {
  __repereSiteauditDeps?: { resolver: Resolver; transport: Transport };
  __repereSiteauditCache?: Map<string, { at: number; res: SafeResponse }>;
};
const defaults = (g.__repereSiteauditDeps ??= { resolver: systemResolver, transport: nodeTransport });
const cache = (g.__repereSiteauditCache ??= new Map());

/** Remplace le résolveur et/ou le transport par défaut (tests, mode démo). Renvoie une fonction de restauration. */
export function setFetchDeps(deps: Partial<{ resolver: Resolver; transport: Transport }>): () => void {
  const prev = { ...defaults };
  Object.assign(defaults, deps);
  resetFetchState();
  return () => {
    Object.assign(defaults, prev);
    resetFetchState();
  };
}

/** Résolveur et transport actuellement en vigueur (le crawl V5 suit lui-même les redirections, saut par saut). */
export function getFetchDeps(): { resolver: Resolver; transport: Transport } {
  return { resolver: defaults.resolver, transport: defaults.transport };
}

/** Bornes mémoire des caches (M5 de qa/v3/securite-v3.md) : petites réponses seulement, budget global en caractères. */
const CACHE_MAX_ENTRY_CHARS = 512 * 1024;
const CACHE_MAX_TOTAL_CHARS = 32 * 1024 * 1024;
const CACHE_MAX_ENTRIES = 100;
const ROBOTS_MAX_CHARS = 512 * 1024; // minimum de lecture exigé par la RFC 9309
const ROBOTS_MAX_ENTRIES = 500;
let cacheChars = 0;

export function clearFetchCache(): void {
  cache.clear();
  cacheChars = 0;
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

/** Normalise une saisie utilisateur (« exemple.fr » → https://exemple.fr/). Lève SafeFetchError si invalide. */
export function normalizeInputUrl(input: string): URL {
  const s = String(input ?? '').trim();
  if (!s || s.length > 2048) throw new SafeFetchError('invalid_url');
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s.replace(/^\/+/, '')}`;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new SafeFetchError('invalid_url');
  }
  checkUrlShape(u);
  return u;
}

function checkUrlShape(u: URL): void {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new SafeFetchError('blocked_scheme');
  if (u.username || u.password) throw new SafeFetchError('blocked_credentials');
  if (u.port && u.port !== '80' && u.port !== '443') throw new SafeFetchError('blocked_port');
  const host = u.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) throw new SafeFetchError('invalid_url');
  if (BLOCKED_HOSTS.test(host)) throw new SafeFetchError('blocked_host', host);
  if (net.isIP(host) && isBlockedIp(host)) throw new SafeFetchError('blocked_ip', host);
  // Formes numériques détournées (« 2130706433 », « 0x7f.1 », « 0177.0.0.1 ») : WHATWG les normalise déjà en IPv4,
  // le contrôle ci-dessus s'applique. Un nom d'hôte purement numérique restant est refusé.
  if (/^[0-9.]+$/.test(host) && !net.isIPv4(host)) throw new SafeFetchError('invalid_url');
}

/**
 * Résout et valide l'hôte : toutes les adresses doivent être publiques. Renvoie les adresses à épingler, IPv4
 * d'abord (ROBUSTESSE V6 : beaucoup d'hébergeurs, dont des fonctions serverless, n'ont pas de sortie IPv6 ; un site
 * qui publie un AAAA en premier était « injoignable »).
 */
export async function resolvePublicAll(host: string, resolver: Resolver = defaults.resolver): Promise<ResolvedAddress[]> {
  const h = host.replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (net.isIP(h)) {
    if (isBlockedIp(h)) throw new SafeFetchError('blocked_ip', h);
    return [{ address: h, family: net.isIPv6(h) ? 6 : 4 }];
  }
  let addrs: ResolvedAddress[];
  try {
    addrs = await resolver(h);
  } catch {
    throw new SafeFetchError('dns', h);
  }
  if (!addrs.length) throw new SafeFetchError('dns', h);
  for (const a of addrs) if (isBlockedIp(a.address)) throw new SafeFetchError('blocked_ip', `${h} → ${a.address}`);
  return [...addrs.filter((a) => a.family === 4), ...addrs.filter((a) => a.family !== 4)];
}

/** Première adresse publique validée (IPv4 de préférence). */
export async function resolvePublic(host: string, resolver: Resolver = defaults.resolver): Promise<ResolvedAddress> {
  return (await resolvePublicAll(host, resolver))[0];
}

/* ------------------------------------------------------------------ */
/* robots.txt pour notre robot                                         */
/* ------------------------------------------------------------------ */

const robotsCache: Map<string, { at: number; body: string | null; status: number | null }> = new Map<string, { at: number; body: string | null; status: number | null }>();

async function ourRobotsAllow(u: URL, opts: SafeFetchOptions, deadline: number): Promise<boolean> {
  if (u.pathname === '/robots.txt') return true;
  const origin = u.origin;
  const useCache = opts.cache !== false && !opts.transport && !opts.resolver;
  let entry = useCache ? robotsCache.get(origin) : undefined;
  if (!entry || Date.now() - entry.at > CACHE_TTL_MS) {
    try {
      const r = await doFetch(new URL('/robots.txt', origin), { ...opts, respectRobots: false, accept: 'text/plain' }, deadline, MAX_REDIRECTS);
      entry = { at: Date.now(), body: r.status >= 200 && r.status < 300 ? r.body.slice(0, ROBOTS_MAX_CHARS) : null, status: r.status };
    } catch (e) {
      if (e instanceof SafeFetchError && (e.code === 'timeout' || e.code.startsWith('blocked'))) throw e;
      entry = { at: Date.now(), body: null, status: null };
    }
    if (useCache) {
      robotsCache.delete(origin);
      robotsCache.set(origin, entry);
      if (robotsCache.size > ROBOTS_MAX_ENTRIES) robotsCache.delete(robotsCache.keys().next().value as string);
    }
  }
  // 4xx : aucun robots.txt, tout est permis. 5xx/injoignable : RFC 9309 demande de tout considérer interdit ;
  // pour un audit ponctuel demandé par l'utilisateur, nous lisons quand même la page (une requête) et le signalons.
  if (!entry.body) return true;
  return isAllowed(parseRobots(entry.body), BOT_TOKEN, u.pathname + u.search);
}

/* ------------------------------------------------------------------ */
/* Récupération                                                        */
/* ------------------------------------------------------------------ */

/**
 * Décode un corps texte comme un navigateur (ROBUSTESSE V6) : BOM (UTF-8, UTF-16) > charset de l'en-tête >
 * <meta charset> ou http-equiv dans les 8 premiers Ko > UTF-8 s'il est valide > windows-1252 (pages anciennes en
 * ISO-8859-1 sans déclaration). Un charset inconnu se replie sur la détection.
 */
export function decodeText(buf: Buffer, contentType = ''): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder('utf-8').decode(buf.subarray(3));
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf.subarray(2));
  const cs = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  const head = buf.subarray(0, 8192).toString('latin1');
  const meta = /<meta\b[^>]*charset\s*=\s*["']?([\w.:-]+)/i.exec(head)?.[1]?.toLowerCase();
  for (const c of [cs, meta]) {
    if (!c) continue;
    const label = c === 'iso-8859-1' || c === 'latin1' || c === 'latin-1' ? 'windows-1252' : c;
    try {
      return new TextDecoder(label, { fatal: false }).decode(buf);
    } catch {
      /* charset inconnu : on essaie la source suivante */
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // UTF-8 invalide : soit une page tronquée au milieu d'un caractère, soit une page en latin-1 non déclarée.
    const loose = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const bad = (loose.match(/\uFFFD/g) ?? []).length;
    return bad > 2 ? new TextDecoder('windows-1252').decode(buf) : loose;
  }
}

/** Contenu binaire (image, archive…) servi comme du texte : beaucoup d'octets de contrôle au début. */
export function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 4096);
  if (n < 32) return false;
  if ((buf[0] === 0xff && buf[1] === 0xfe) || (buf[0] === 0xfe && buf[1] === 0xff)) return false; // UTF-16
  let ctrl = 0;
  for (let i = 0; i < n; i++) {
    const c = buf[i];
    if (c === 0 || (c < 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12)) ctrl++;
  }
  return ctrl / n > 0.05;
}

const decodeBody = decodeText;

async function doFetch(start: URL, opts: SafeFetchOptions, deadline: number, maxRedirects: number): Promise<SafeResponse> {
  const resolver = opts.resolver ?? defaults.resolver;
  const transport = opts.transport ?? defaults.transport;
  const maxBytes = Math.min(opts.maxBytes ?? MAX_BYTES, MAX_BYTES);
  const t0 = Date.now();
  const redirects: string[] = [];
  let current = start;
  let transportMs = 0;
  for (let hop = 0; ; hop++) {
    checkUrlShape(current);
    if (opts.respectRobots !== false && !(await ourRobotsAllow(current, opts, deadline))) throw new SafeFetchError('robots_disallowed', current.hostname);
    const address = await resolvePublic(current.hostname, resolver);
    const left = deadline - Date.now();
    if (left <= 0) throw new SafeFetchError('timeout');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), left);
    let res: TransportResponse;
    const tt = Date.now();
    try {
      res = await transport({
        url: current,
        address,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: opts.accept ?? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
        },
        signal: controller.signal,
        maxBytes,
      });
    } catch (e) {
      if (e instanceof SafeFetchError) throw e;
      if (controller.signal.aborted) throw new SafeFetchError('timeout');
      if (isTlsError(e)) throw new SafeFetchError('tls', (e as Error).message);
      throw new SafeFetchError('network', (e as Error).message);
    } finally {
      clearTimeout(timer);
      transportMs += Date.now() - tt;
    }
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      if (hop >= maxRedirects) throw new SafeFetchError('too_many_redirects');
      let next: URL;
      try {
        next = new URL(res.headers.location, current);
      } catch {
        throw new SafeFetchError('invalid_url', 'redirection');
      }
      redirects.push(next.toString());
      current = next; // revalidé au tour suivant (schéma, port, hôte, DNS, robots)
      continue;
    }
    const contentType = res.headers['content-type'] ?? '';
    return {
      url: start.toString(),
      finalUrl: current.toString(),
      status: res.status,
      headers: res.headers,
      contentType,
      body: decodeBody(res.body, contentType),
      bytes: res.body.length,
      truncated: res.truncated,
      elapsedMs: Date.now() - t0,
      transportMs,
      redirects,
      fromCache: false,
    };
  }
}

/** Récupère une URL publique en toute sécurité. Lève `SafeFetchError` (message public : `publicMessage`). */
export async function safeFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeResponse> {
  const u = typeof input === 'string' ? normalizeInputUrl(input) : new URL(input.toString());
  const key = `${opts.accept ?? 'html'}|${opts.respectRobots === false ? 'norobots' : 'robots'}|${u.toString()}`;
  const useCache = opts.cache !== false && !opts.transport && !opts.resolver;
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return { ...hit.res, fromCache: true };
  }
  const deadline = Date.now() + Math.min(opts.timeoutMs ?? TIMEOUT_MS, TIMEOUT_MS);
  const res = await doFetch(u, opts, deadline, Math.min(opts.maxRedirects ?? MAX_REDIRECTS, MAX_REDIRECTS));
  if (useCache && res.status < 500 && res.body.length <= CACHE_MAX_ENTRY_CHARS) {
    const prev = cache.get(key);
    if (prev) {
      cacheChars -= prev.res.body.length;
      cache.delete(key);
    }
    cache.set(key, { at: Date.now(), res });
    cacheChars += res.body.length;
    while ((cache.size > CACHE_MAX_ENTRIES || cacheChars > CACHE_MAX_TOTAL_CHARS) && cache.size) {
      const oldest = cache.keys().next().value as string;
      cacheChars -= cache.get(oldest)?.res.body.length ?? 0;
      cache.delete(oldest);
    }
  }
  return res;
}

/** Variante qui ne lève pas : `null` si la ressource est inaccessible (utile pour sitemap, llms.txt…). */
export async function tryFetch(input: string | URL, opts: SafeFetchOptions = {}): Promise<SafeResponse | null> {
  try {
    return await safeFetch(input, opts);
  } catch {
    return null;
  }
}

/** Vide aussi le cache robots (tests). */
export function resetFetchState(): void {
  cache.clear();
  cacheChars = 0;
  robotsCache.clear();
}
