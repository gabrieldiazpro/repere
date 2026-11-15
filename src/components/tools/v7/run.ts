/**
 * Récupération réseau des outils V7 (serveur seulement), sur le modèle de v6/run.ts : tout passe par CrawlFetcher
 * (anti-SSRF de src/lib/siteaudit/fetch.ts, DNS revalidé à chaque saut, robots.txt de RepereBot respecté, 8 s par
 * requête, 2 Mo au plus). Une page illisible (pare-feu, robots.txt, erreur, délai…) ne lève pas d'erreur : elle donne un
 * rapport `access` (src/lib/analysis/access.ts) avec la marche à suivre. Seules les adresses refusées (forme, réseau
 * privé) restent des erreurs 400. Les tests remplacent le transport par setFetchDeps : aucune sortie sur Internet.
 */
import { CrawlFetcher, decodeBody, type HopResult } from '@/lib/crawl/fetcher';
import { SafeFetchError, normalizeInputUrl, type SafeFetchErrorCode } from '@/lib/siteaudit/fetch';
import type { PageFetch } from '../v6/analyze';
import { accessFor } from './access';
import {
  analyzeDuplicate,
  analyzeFreshness,
  analyzeHeadings,
  analyzeHttps,
  analyzeImages,
  analyzeMobile,
  analyzeRich,
  analyzeWeight,
  imagesToCheck,
  pageImages,
  pageResources,
  resourcesToCheck,
} from './analyze';
import type { AccessInfo, DuplicateReport, FreshnessReport, HeadingsReport, HttpsReport, ImagesReport, MobileReport, RichReport, WeightReport } from './types';

export const TOOL_BUDGET_MS = 20_000;
const fetcher = () => new CrawlFetcher({ deadline: Date.now() + TOOL_BUDGET_MS });
const INPUT_ERRORS = ['invalid_url', 'blocked_scheme', 'blocked_port', 'blocked_credentials', 'blocked_host', 'blocked_ip'];

function toPage(r: HopResult): PageFetch {
  const ct = r.headers['content-type'] ?? '';
  const textual = !ct || /html|xml|text/i.test(ct);
  return {
    requestedUrl: r.requestedUrl,
    finalUrl: r.finalUrl || r.requestedUrl,
    status: r.status,
    chain: r.chain,
    headers: r.headers,
    html: textual ? decodeBody(r.body, ct) : null,
    fetchMs: r.fetchMs,
    ...(r.error ? { error: r.error, errorCode: r.errorCode } : {}),
  };
}

export interface ReadResult {
  page: PageFetch;
  access: AccessInfo | null;
  bytes: number;
}

/** Lit une page et son état d'accès. Lève seulement pour une adresse refusée (400). */
export async function readPage(input: string, f = fetcher()): Promise<ReadResult> {
  const u = normalizeInputUrl(input).toString();
  const r = await f.fetch(u);
  if (r.error && INPUT_ERRORS.includes(r.errorCode ?? '')) throw new SafeFetchError(r.errorCode as SafeFetchErrorCode, r.error);
  let robots: { url: string; status: number; text?: string } | null = null;
  if (r.blockedByRobots) {
    const rob = await f.robotsFor(new URL(u).origin);
    robots = { url: rob.url, status: rob.status, ...(rob.text !== undefined ? { text: rob.text } : {}) };
  }
  const page = toPage(r);
  const access = accessFor({ ...page, bytes: r.body.length, blockedByRobots: r.blockedByRobots, errorCode: r.errorCode, error: r.error, robots });
  return { page, access, bytes: r.body.length };
}

async function pool<T, R>(items: T[], n: number, task: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await task(items[k]);
      }
    }),
  );
  return out;
}

/** Statut, taille annoncée et type d'une ressource : HEAD, puis GET léger si HEAD est refusé. */
async function sizeOf(f: CrawlFetcher, url: string): Promise<{ status: number; bytes?: number; contentType?: string; error?: string }> {
  let r = await f.fetch(url, { method: 'HEAD' });
  let viaGet = false;
  if (!r.error && [403, 405, 501].includes(r.status)) {
    r = await f.fetch(url, { maxBytes: 16 * 1024 });
    viaGet = true;
  }
  if (r.blockedByRobots) return { status: 0, error: 'non vérifié (robots.txt)' };
  if (r.error) return { status: 0, error: r.error };
  const len = Number(r.headers['content-length']);
  const bytes = Number.isFinite(len) && len >= 0 && r.headers['content-length'] !== undefined ? len : viaGet && !r.truncated ? r.body.length : undefined;
  return { status: r.status, ...(bytes !== undefined ? { bytes } : {}), ...(r.headers['content-type'] ? { contentType: r.headers['content-type'].split(';')[0].trim() } : {}) };
}

/** Garde les adresses du site et au plus `maxOrigins` autres origines (chacune coûte une lecture de robots.txt). */
function limitOrigins(urls: string[], pageUrl: string, maxOrigins = 6): string[] {
  const own = new URL(pageUrl).origin;
  const origins = new Set<string>();
  return urls.filter((t) => {
    const o = new URL(t).origin;
    if (o === own || origins.has(o)) return true;
    if (origins.size >= maxOrigins) return false;
    origins.add(o);
    return true;
  });
}

/* ------------------------------------------------------------------ */

export async function runHeadings(url: string): Promise<HeadingsReport> {
  const { page, access } = await readPage(url);
  return analyzeHeadings(page, access);
}

export async function runImages(url: string): Promise<ImagesReport> {
  const f = fetcher();
  const { page, access } = await readPage(url, f);
  if (access?.blocked) return analyzeImages(page, [], new Map(), access);
  const rows = pageImages(page);
  const targets = limitOrigins(imagesToCheck(rows, page.finalUrl, 20), page.finalUrl);
  const res = await pool(targets, 4, async (t) => [t, await sizeOf(f, t)] as const);
  return analyzeImages(page, rows, new Map(res), access);
}

export async function runWeight(url: string): Promise<WeightReport> {
  const f = fetcher();
  const { page, access, bytes } = await readPage(url, f);
  if (access?.blocked) return analyzeWeight(page, [], new Map(), access);
  const rows = pageResources(page);
  const targets = limitOrigins(resourcesToCheck(rows, 30), page.finalUrl);
  const res = await pool(targets, 4, async (t) => [t, await sizeOf(f, t)] as const);
  return analyzeWeight(page, rows, new Map(res), access, bytes);
}

export async function runMobile(url: string): Promise<MobileReport> {
  const { page, access } = await readPage(url);
  return analyzeMobile(page, access);
}

export async function runHttps(url: string): Promise<HttpsReport> {
  const f = fetcher();
  const { page, access } = await readPage(url, f);
  if (access?.blocked) return analyzeHttps(page, null, access);
  let variant: HttpsReport['httpRedirect'] = null;
  const u = new URL(page.finalUrl);
  if (u.protocol === 'https:') {
    u.protocol = 'http:';
    const start = u.toString();
    const r = await f.fetch(start, { maxBytes: 16 * 1024 });
    variant = r.error && !r.chain.length ? { start, final: start, status: 0, toHttps: false, error: r.blockedByRobots ? 'non vérifiée (robots.txt)' : r.error } : { start, final: r.finalUrl, status: r.chain.length ? r.chain[0].status : r.status, toHttps: /^https:/i.test(r.finalUrl) };
  }
  return analyzeHttps(page, variant, access);
}

export async function runDuplicate(url: string, url2: string): Promise<DuplicateReport> {
  const f = fetcher();
  const [a, b] = await Promise.all([readPage(url, f), readPage(url2, f)]);
  const blocked = a.access?.blocked ? a.access : b.access?.blocked ? { ...b.access, title: `Page 2 : ${b.access.title}` } : null;
  return analyzeDuplicate(a.page, b.page, blocked ?? a.access ?? b.access);
}

export async function runFreshness(url: string): Promise<FreshnessReport> {
  const { page, access } = await readPage(url);
  return analyzeFreshness(page, access);
}

export async function runRich(url: string): Promise<RichReport> {
  const { page, access } = await readPage(url);
  return analyzeRich(page, access);
}
