/**
 * Récupération pour le crawl, saut par saut, sur les briques sûres de src/lib/siteaudit/fetch.ts :
 * forme de l'URL (schéma, port, identifiants, hôtes internes) revalidée à chaque saut, DNS validé et épinglé
 * (anti-SSRF), transport injectable (setFetchDeps dans les tests), robots.txt de RepereBot respecté pour chaque
 * origine visitée. On suit les redirections nous-mêmes pour garder le statut de chaque saut et détecter les boucles.
 */
import { gunzipSync } from 'node:zlib';
import { BOT_TOKEN, USER_AGENT, SafeFetchError, getFetchDeps, normalizeInputUrl, resolvePublic } from '@/lib/siteaudit/fetch';
import { isAllowed, parseRobots, productToken, type ParsedRobots } from '@/lib/siteaudit/robots';

export const PAGE_TIMEOUT_MS = 8_000;
export const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_HOPS = 5;

export interface HopResult {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  chain: { url: string; status: number }[];
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

/** Décode un corps texte (charset de l'en-tête, sinon méta, sinon UTF-8). */
export function decodeBody(buf: Buffer, contentType = ''): string {
  const cs = /charset=["']?([\w-]+)/i.exec(contentType)?.[1]?.toLowerCase();
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 2048).toString('latin1'))?.[1]?.toLowerCase();
  const charset = cs || meta || 'utf-8';
  try {
    return new TextDecoder(charset === 'iso-8859-1' || charset === 'latin1' ? 'windows-1252' : charset, { fatal: false }).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/** Décompresse un fichier gzip (sitemap .xml.gz) en bornant la taille ; renvoie le tampon tel quel s'il n'est pas gzip. */
export function maybeGunzip(buf: Buffer, maxBytes = 50 * 1024 * 1024): Buffer {
  if (buf.length < 2 || buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  return gunzipSync(buf, { maxOutputLength: maxBytes });
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
}

export class CrawlFetcher {
  private robots = new Map<string, Promise<RobotsEntry>>();
  constructor(private opts: FetcherOptions = {}) {}

  get userAgent(): string {
    return this.opts.userAgent || USER_AGENT;
  }

  private botToken(): string {
    return this.opts.userAgent ? productToken(this.opts.userAgent) : BOT_TOKEN;
  }

  /** robots.txt d'une origine (une seule requête par origine et par crawl). */
  robotsFor(origin: string): Promise<RobotsEntry> {
    let p = this.robots.get(origin);
    if (!p) {
      const url = `${origin}/robots.txt`;
      p = this.fetch(url, { accept: 'text/plain', skipRobots: true, maxBytes: 512 * 1024, followTo: (u) => new URL(u).hostname === new URL(origin).hostname || new URL(u).pathname === '/robots.txt' }).then((r) => {
        if (r.error) return { url, status: 0, parsed: null, crawlDelayMs: 0 };
        const ok = r.status >= 200 && r.status < 300;
        const text = ok ? decodeBody(r.body, r.headers['content-type']) : undefined;
        return { url, status: r.status, text, parsed: text !== undefined ? parseRobots(text) : null, crawlDelayMs: text ? crawlDelayFor(text, this.botToken()) : 0 };
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
    const chain: { url: string; status: number }[] = [];
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
    for (let hop = 0; ; hop++) {
      if (this.opts.signal?.aborted) return base({ error: 'Exploration annulée.', errorCode: 'aborted' });
      let u: URL;
      try {
        u = normalizeInputUrl(current);
      } catch (e) {
        return base({ error: e instanceof SafeFetchError ? e.publicMessage : 'Adresse invalide.', errorCode: e instanceof SafeFetchError ? e.code : 'invalid_url' });
      }
      if (!o.skipRobots && !(await this.allowed(u.toString()))) return base({ blockedByRobots: true, error: 'Bloqué par robots.txt pour RepereBot.', errorCode: 'robots_disallowed' });
      let address;
      try {
        address = await resolvePublic(u.hostname, resolver);
      } catch (e) {
        return base({ error: e instanceof SafeFetchError ? e.publicMessage : 'Nom de domaine introuvable.', errorCode: e instanceof SafeFetchError ? e.code : 'dns' });
      }
      const timeoutMs = Math.min(o.timeoutMs ?? PAGE_TIMEOUT_MS, PAGE_TIMEOUT_MS, this.opts.deadline ? Math.max(0, this.opts.deadline - Date.now()) : Infinity);
      if (timeoutMs <= 0) return base({ error: 'Budget de temps épuisé.', errorCode: 'timeout' });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const onAbort = () => controller.abort();
      this.opts.signal?.addEventListener('abort', onAbort);
      let res;
      try {
        res = await transport({
          url: u,
          address,
          headers: {
            'User-Agent': this.userAgent,
            Accept: o.accept ?? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
            'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          signal: controller.signal,
          maxBytes: Math.min(o.maxBytes ?? MAX_BYTES, MAX_BYTES),
          method: o.method,
        });
      } catch (e) {
        const aborted = controller.signal.aborted;
        const cancelled = this.opts.signal?.aborted;
        return base({
          error: cancelled ? 'Exploration annulée.' : aborted ? `Pas de réponse en ${Math.round(timeoutMs / 1000)} s.` : `Site injoignable (${(e as Error).message}).`,
          errorCode: cancelled ? 'aborted' : aborted ? 'timeout' : 'network',
        });
      } finally {
        clearTimeout(timer);
        this.opts.signal?.removeEventListener('abort', onAbort);
      }
      if (res.status >= 300 && res.status < 400 && res.headers.location) {
        let next: string;
        try {
          next = new URL(res.headers.location, u).toString().replace(/#.*$/, '');
        } catch {
          return base({ status: res.status, headers: res.headers, error: 'Redirection invalide.', errorCode: 'invalid_redirect' });
        }
        chain.push({ url: u.toString(), status: res.status });
        if (chain.some((c) => c.url === next) || next === u.toString()) {
          current = next;
          return base({ status: res.status, headers: res.headers, error: 'Boucle de redirection.', errorCode: 'redirect_loop' });
        }
        if (hop + 1 > MAX_HOPS) {
          current = next;
          return base({ status: res.status, headers: res.headers, error: 'Trop de redirections (plus de 5).', errorCode: 'too_many_redirects' });
        }
        if (o.followTo && !o.followTo(next)) {
          current = next;
          return base({ status: res.status, headers: res.headers, leftScope: true });
        }
        current = next;
        continue;
      }
      current = u.toString();
      return base({ status: res.status, headers: res.headers, body: res.body, truncated: res.truncated });
    }
  }
}
