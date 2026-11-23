/**
 * Récupération pour le crawl, saut par saut, sur les briques sûres de src/lib/siteaudit/fetch.ts :
 * forme de l'URL (schéma, port, identifiants, hôtes internes) revalidée à chaque saut, DNS validé et épinglé
 * (anti-SSRF), transport injectable (setFetchDeps dans les tests), robots.txt de RepereBot respecté pour chaque
 * origine visitée. On suit les redirections nous-mêmes pour garder le statut de chaque saut et détecter les boucles.
 *
 * ROBUSTESSE (V6) : délai garanti même si le transport ne rend jamais la main ; robots.txt borné à 4 s ; jusqu'à
 * 10 redirections (comme Googlebot) ; redirections « molles » (meta refresh, JavaScript) sur demande ; cookies
 * gardés le temps du crawl (sites qui posent un cookie puis redirigent sur eux-mêmes) ; IPv4 d'abord, autre adresse
 * validée en cas d'échec réseau.
 */
import { gunzipSync } from 'node:zlib';
import { BOT_TOKEN, USER_AGENT, SafeFetchError, decodeText, getFetchDeps, isTlsError, normalizeInputUrl, resolvePublicAll } from '@/lib/siteaudit/fetch';
import { isAllowed, parseRobots, productToken, type ParsedRobots } from '@/lib/siteaudit/robots';
import { baseHost } from './url';

export const PAGE_TIMEOUT_MS = 8_000;
export const ROBOTS_TIMEOUT_MS = 4_000;
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_HOPS = 10;
/** Taille maximale d'un sitemap .gz une fois décompressé. */
export const MAX_GUNZIP_BYTES = 10 * 1024 * 1024;

/** Saut non HTTP : meta refresh, JavaScript, ou nouvelle requête avec le cookie que le site vient de poser. */
export type HopVia = 'meta-refresh' | 'js' | 'cookie';

export interface HopResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: { url: string; status: number; via?: HopVia }[];
  headers: Record<string, string>;
  body: Buffer;
  truncated: boolean;
  fetchMs: number;
  /** La redirection quitte le périmètre autorisé : non suivie (finalUrl = cible annoncée). */
  leftScope?: boolean;
  blockedByRobots?: boolean;
  error?: string;
  errorCode?: string;
}

export interface RobotsEntry {
  url: string;
  status: number;
  text?: string;
  parsed: ParsedRobots | null;
  crawlDelayMs: number;
  /** robots.txt injoignable (délai, réseau…) : code et message. */
  errorCode?: string;
  error?: string;
  /** Le serveur renvoie une page HTML à la place du robots.txt. */
  isHtml?: boolean;
}

/** Délai de robots.txt (crawl-delay) applicable à notre robot, en ms (0 si absent). */
export function crawlDelayFor(text: string, bot = BOT_TOKEN): number {
  const token = productToken(bot);
  let agents: string[] = [];
  let inAgents = false;
  let specific: number | null = null;
  let star: number | null = null;
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const k = m[1].toLowerCase();
    const v = m[2].trim();
    if (k === 'user-agent') {
      if (!inAgents) agents = [];
      agents.push(productToken(v));
      inAgents = true;
      continue;
    }
    inAgents = false;
    if (k === 'crawl-delay') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) continue;
      if (agents.includes(token)) specific = n;
      else if (agents.includes('*')) star = n;
    }
  }
  const d = specific ?? star ?? 0;
  return Math.round(d * 1000);
}

/** Décode un corps texte (BOM, en-tête, méta, UTF-8 valide, sinon windows-1252) : voir siteaudit/fetch.ts. */
export function decodeBody(buf: Buffer, contentType = ''): string {
  return decodeText(buf, contentType);
}

/** Décompresse un fichier gzip (sitemap .xml.gz) en bornant la taille ; renvoie le tampon tel quel s'il n'est pas gzip. */
export function maybeGunzip(buf: Buffer, maxBytes = MAX_GUNZIP_BYTES): Buffer {
  if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  return gunzipSync(buf, { maxOutputLength: maxBytes });
}

/**
 * Redirection « molle » d'une page HTML : meta refresh immédiat (≤ 5 s, que Google traite comme une redirection),
 * ou, si `js`, redirection JavaScript évidente d'une page presque vide. Renvoie l'URL cible absolue ou null.
 */
export function softRedirectTarget(html: string, pageUrl: string, js: boolean): { url: string; via: HopVia } | null {
  const head = html.slice(0, 20_000);
  const meta = /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/i.exec(head)?.[0];
  if (meta) {
    const content = /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(meta);
    const c = (content?.[1] ?? content?.[2] ?? content?.[3] ?? '').trim();
    const m = /^(\d+(?:\.\d+)?)\s*[;,]?\s*(?:url\s*=\s*)?["']?([^"']*)["']?\s*$/i.exec(c);
    if (m && Number(m[1]) <= 5 && m[2].trim()) {
      try {
        const u = new URL(m[2].trim(), pageUrl);
        if (u.protocol === 'http:' || u.protocol === 'https:') return { url: u.toString().replace(/#.*$/, ''), via: 'meta-refresh' };
      } catch {
        /* cible invalide */
      }
    }
  }
  if (!js || html.length > 30_000) return null;
  const text = html.replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').trim();
  if (text.split(/\s+/).filter(Boolean).length > 40) return null;
  const m =
    /(?:window\.|document\.|top\.|self\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/.exec(html) ??
    /location\.(?:replace|assign)\(\s*["']([^"']+)["']\s*\)/.exec(html);
  if (!m) return null;
  try {
    const u = new URL(m[1], pageUrl);
    return u.protocol === 'http:' || u.protocol === 'https:' ? { url: u.toString().replace(/#.*$/, ''), via: 'js' } : null;
  } catch {
    return null;
  }
}

export interface FetcherOptions {
  userAgent?: string;
  respectRobots?: boolean;
  signal?: AbortSignal;
  /** Échéance absolue (Date.now()) au-delà de laquelle on ne lance plus rien. */
  deadline?: number;
}

export interface FetchOneOptions {
  method?: 'GET' | 'HEAD';
  accept?: string;
  maxBytes?: number;
  timeoutMs?: number;
  /** Peut-on suivre une redirection vers cette URL ? (défaut : oui). */
  followTo?: (url: string) => boolean;
  /** Ignorer robots.txt pour cette requête (robots.txt lui-même). */
  skipRobots?: boolean;
  /** Suivre aussi les redirections meta refresh (« meta ») et JavaScript évidentes (« meta+js »). */
  soft?: 'meta' | 'meta+js';
}

const MAX_COOKIES = 30;

/** Bocal à cookies minimal, propre à un crawl : nom=valeur par site (hôte sans www), sans attributs. */
class CookieJar {
  private jar = new Map<string, Map<string, string>>();
  store(host: string, setCookie: string | undefined): void {
    if (!setCookie) return;
    const site = baseHost(host);
    let m = this.jar.get(site);
    for (const line of setCookie.split('\n')) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!/^[\w!#$%&'*+.^`|~-]{1,128}$/.test(name) || value.length > 1024) continue;
      const expired = attrs.some((a) => /^\s*max-age\s*=\s*(0|-\d+)\s*$/i.test(a));
      if (!m) this.jar.set(site, (m = new Map()));
      if (expired) m.delete(name);
      else if (m.size < MAX_COOKIES || m.has(name)) m.set(name, value);
    }
  }
  header(host: string): string | undefined {
    const m = this.jar.get(baseHost(host));
    return m && m.size ? [...m].map(([k, v]) => `${k}=${v}`).join('; ') : undefined;
  }
}

export class CrawlFetcher {
  private robots = new Map<string, Promise<RobotsEntry>>();
  private cookies = new CookieJar();
  constructor(private opts: FetcherOptions = {}) {}

  get userAgent(): string {
    return this.opts.userAgent || USER_AGENT;
  }

  private botToken(): string {
    return this.opts.userAgent ? productToken(this.opts.userAgent) : BOT_TOKEN;
  }

  /** robots.txt d'une origine (une seule requête par origine et par crawl, 4 s au plus). */
  robotsFor(origin: string): Promise<RobotsEntry> {
    let p = this.robots.get(origin);
    if (!p) {
      const url = `${origin}/robots.txt`;
      p = this.fetch(url, {
        accept: 'text/plain',
        skipRobots: true,
        maxBytes: 512 * 1024,
        timeoutMs: ROBOTS_TIMEOUT_MS,
        followTo: (u) => new URL(u).hostname === new URL(origin).hostname || new URL(u).pathname === '/robots.txt',
      }).then((r): RobotsEntry => {
        if (r.error && !r.status) return { url, status: 0, parsed: null, crawlDelayMs: 0, error: r.error, errorCode: r.errorCode };
        if (r.error) return { url, status: r.status, parsed: null, crawlDelayMs: 0, error: r.error, errorCode: r.errorCode };
        const ok = r.status >= 200 && r.status < 300;
        const text = ok ? decodeBody(r.body, r.headers['content-type']) : undefined;
        const isHtml = ok && (/text\/html/i.test(r.headers['content-type'] ?? '') || /^\s*(<!doctype|<html|<head|<body)/i.test(text ?? ''));
        return {
          url,
          status: r.status,
          text,
          // Une page HTML n'est pas un robots.txt : aucune règle (tout est permis), signalé à part.
          parsed: text !== undefined ? parseRobots(isHtml ? '' : text) : null,
          crawlDelayMs: text && !isHtml ? crawlDelayFor(text, this.botToken()) : 0,
          ...(isHtml ? { isHtml: true } : {}),
        };
      });
      this.robots.set(origin, p);
    }
    return p;
  }

  async allowed(url: string): Promise<boolean> {
    if (this.opts.respectRobots === false) return true;
    const u = new URL(url);
    if (u.pathname === '/robots.txt') return true;
    const r = await this.robotsFor(u.origin);
    // 4xx / injoignable : aucune restriction connue (voir la note de siteaudit/fetch.ts).
    if (!r.parsed) return true;
    return isAllowed(r.parsed, this.botToken(), u.pathname + u.search);
  }

  /** Récupère une URL en suivant les redirections saut par saut. Ne lève jamais : erreur dans `error`. */
  async fetch(url: string, o: FetchOneOptions = {}): Promise<HopResult> {
    const t0 = Date.now();
    const chain: HopResult['chain'] = [];
    const base = (extra: Partial<HopResult>): HopResult => ({
      requestedUrl: url,
      finalUrl: current,
      status: 0,
      chain,
      headers: {},
      body: Buffer.alloc(0),
      truncated: false,
      fetchMs: Date.now() - t0,
      ...extra,
    });
    let current = url;
    const { resolver, transport } = getFetchDeps();
    const hop = (next: string, status: number, headers: Record<string, string>, via?: HopVia): HopResult | null => {
      chain.push({ url: current, status, ...(via ? { via } : {}) });
      if (chain.some((c) => c.url === next) || next === current) {
        current = next;
        return base({ status, headers, error: 'Boucle de redirection.', errorCode: 'redirect_loop' });
      }
      if (chain.length > MAX_HOPS) {
        current = next;
        return base({ status, headers, error: `Trop de redirections (plus de ${MAX_HOPS}).`, errorCode: 'too_many_redirects' });
      }
      if (o.followTo && !o.followTo(next)) {
        current = next;
        return base({ status, headers, leftScope: true });
      }
      current = next;
      return null;
    };
    for (;;) {
      if (this.opts.signal?.aborted) return base({ error: 'Exploration annulée.', errorCode: 'aborted' });
      let u: URL;
      try {
        u = normalizeInputUrl(current);
      } catch (e) {
        return base({ error: e instanceof SafeFetchError ? e.publicMessage : 'Adresse invalide.', errorCode: e instanceof SafeFetchError ? e.code : 'invalid_url' });
      }
      if (!o.skipRobots && !(await this.allowed(u.toString()))) return base({ blockedByRobots: true, error: 'Bloqué par robots.txt pour RepereBot.', errorCode: 'robots_disallowed' });
      let addresses;
      try {
        addresses = await resolvePublicAll(u.hostname, resolver);
      } catch (e) {
        return base({ error: e instanceof SafeFetchError ? e.publicMessage : 'Nom de domaine introuvable.', errorCode: e instanceof SafeFetchError ? e.code : 'dns' });
      }
      const timeoutMs = Math.min(o.timeoutMs ?? PAGE_TIMEOUT_MS, PAGE_TIMEOUT_MS, this.opts.deadline ? Math.max(0, this.opts.deadline - Date.now()) : Infinity);
      if (timeoutMs <= 0) return base({ error: 'Budget de temps épuisé.', errorCode: 'timeout' });
      const cookie = this.cookies.header(u.hostname);
      let res;
      let lastErr: unknown = null;
      let timedOut = false;
      // Au plus deux adresses validées : la seconde seulement après un échec réseau (pas après un délai dépassé).
      for (const address of addresses.slice(0, 2)) {
        const controller = new AbortController();
        const onAbort = () => controller.abort();
        this.opts.signal?.addEventListener('abort', onAbort);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let guard: ReturnType<typeof setTimeout> | undefined;
        try {
          res = await Promise.race([
            transport({
              url: u,
              address,
              headers: {
                'User-Agent': this.userAgent,
                Accept: o.accept ?? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
                'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                ...(cookie ? { Cookie: cookie } : {}),
              },
              signal: controller.signal,
              maxBytes: Math.min(o.maxBytes ?? MAX_BYTES, MAX_BYTES),
              method: o.method,
            }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => controller.abort(), timeoutMs);
              // Filet : un transport qui ne rend pas la main malgré l'annulation ne bloque pas le crawl.
              guard = setTimeout(() => reject(new Error('aborted')), timeoutMs + 1_000);
            }),
          ]);
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          timedOut = controller.signal.aborted;
          if (timedOut || this.opts.signal?.aborted) break;
        } finally {
          clearTimeout(timer);
          clearTimeout(guard);
          this.opts.signal?.removeEventListener('abort', onAbort);
        }
      }
      if (!res) {
        const cancelled = this.opts.signal?.aborted;
        return base({
          error: cancelled ? 'Exploration annulée.' : timedOut ? `Pas de réponse en ${Math.round(timeoutMs / 1000)} s.` : isTlsError(lastErr) ? `Certificat HTTPS invalide (${(lastErr as Error)?.message ?? 'TLS'}).` : `Site injoignable (${(lastErr as Error)?.message ?? 'erreur réseau'}).`,
          errorCode: cancelled ? 'aborted' : timedOut ? 'timeout' : isTlsError(lastErr) ? 'tls' : 'network',
        });
      }
      this.cookies.store(u.hostname, res.headers['set-cookie']);
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        let next: string;
        try {
          next = new URL(res.headers.location, u).toString().replace(/#.*$/, '');
        } catch {
          return base({ status: res.status, headers: res.headers, error: 'Redirection invalide.', errorCode: 'invalid_redirect' });
        }
        // Boucle apparente sur la même URL alors qu'un cookie vient d'être posé : on retente une fois avec le cookie.
        if (next === u.toString() && res.headers['set-cookie'] && !chain.some((c) => c.url === u.toString()) && this.cookies.header(u.hostname) !== cookie) {
          chain.push({ url: u.toString(), status: res.status, via: 'cookie' });
          continue;
        }
        const stop = hop(next, res.status, res.headers);
        if (stop) return stop;
        continue;
      }
      current = u.toString();
      if (o.soft && res.status === 200 && o.method !== 'HEAD' && /html/i.test(res.headers['content-type'] ?? 'text/html') && res.body.length < 200_000) {
        const soft = softRedirectTarget(decodeBody(res.body, res.headers['content-type']), current, o.soft === 'meta+js');
        // Une redirection JavaScript n'est suivie que sur le même site (une page de parking ou de publicité redirige
        // souvent ailleurs en JavaScript : on analyserait le site d'un tiers).
        const sameSite = (a: string, b: string) => {
          try {
            const x = baseHost(new URL(a).hostname);
            const y = baseHost(new URL(b).hostname);
            return x === y || x.endsWith(`.${y}`) || y.endsWith(`.${x}`);
          } catch {
            return false;
          }
        };
        if (soft && soft.url !== current && (soft.via !== 'js' || sameSite(soft.url, current))) {
          const stop = hop(soft.url, res.status, res.headers, soft.via);
          if (stop) return stop;
          continue;
        }
      }
      return base({ status: res.status, headers: res.headers, body: res.body, truncated: res.truncated });
    }
  }
}
