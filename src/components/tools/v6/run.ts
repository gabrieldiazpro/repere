/**
 * Récupération réseau des outils V6 (serveur seulement). Tout passe par CrawlFetcher (src/lib/crawl/fetcher.ts),
 * lui-même bâti sur l'anti-SSRF de src/lib/siteaudit/fetch.ts : forme d'URL et DNS revalidés à chaque saut,
 * adresse épinglée, robots.txt de RepereBot respecté, 8 s par requête, 2 Mo au plus. Les tests remplacent le
 * transport et le résolveur par setFetchDeps : aucune sortie sur Internet.
 */
import { CrawlFetcher, decodeBody, maybeGunzip, type HopResult } from '@/lib/crawl/fetcher';
import { SafeFetchError, normalizeInputUrl, type SafeFetchErrorCode } from '@/lib/siteaudit/fetch';
import {
  analyzeHeaders,
  analyzeHreflang,
  analyzeIndex,
  analyzeLinks,
  analyzeMeta,
  analyzeOg,
  analyzeRedirects,
  analyzeSitemap,
  hreflangOf,
  linksToCheck,
  pageLinks,
  sitemapEntries,
  urlVariants,
  type AlternatePage,
  type ChainResult,
  type PageFetch,
  type SitemapFetch,
} from './analyze';
import { parseSitemap } from '@/lib/crawl/sitemap';
import { firewallOf } from '@/lib/crawl/diagnose';
import type { HeadersReport, HreflangReport, IndexReport, LinksReport, MetaReport, OgReport, RedirectReport, SitemapReport } from './types';

/** Budget total d'un outil (la route a 30 s au plus). */
export const TOOL_BUDGET_MS = 20_000;
const KNOWN: SafeFetchErrorCode[] = ['invalid_url', 'blocked_scheme', 'blocked_port', 'blocked_credentials', 'blocked_host', 'blocked_ip', 'dns', 'timeout', 'too_many_redirects', 'robots_disallowed', 'tls', 'firewall', 'rate_limited', 'network'];

/** Décompresse un sitemap .gz (10 Mo au plus) ; illisible : vide. */
function gunz(b: Buffer): Buffer {
  try {
    return maybeGunzip(b, 10 * 1024 * 1024);
  } catch {
    return Buffer.alloc(0);
  }
}

const fetcher = () => new CrawlFetcher({ deadline: Date.now() + TOOL_BUDGET_MS });

/** Valide l'adresse saisie (lève SafeFetchError : la route renvoie 400). */
function start(input: string): string {
  return normalizeInputUrl(input).toString();
}

function toError(r: HopResult): SafeFetchError {
  const code = (KNOWN as string[]).includes(r.errorCode ?? '') ? (r.errorCode as SafeFetchErrorCode) : r.errorCode === 'redirect_loop' ? 'too_many_redirects' : 'network';
  return new SafeFetchError(code, r.error);
}

function toPage(r: HopResult): PageFetch {
  const ct = r.headers['content-type'] ?? '';
  const textual = !ct || /html|xml|text/i.test(ct);
  return {
    requestedUrl: r.requestedUrl,
    finalUrl: r.finalUrl,
    status: r.status,
    chain: r.chain,
    headers: r.headers,
    html: textual ? decodeBody(r.body, ct) : null,
    fetchMs: r.fetchMs,
  };
}

/** Récupère une page HTML ; lève si elle est injoignable. */
export async function fetchPage(input: string, f = fetcher()): Promise<PageFetch> {
  const r = await f.fetch(start(input));
  if (r.error) throw toError(r);
  blockedOrThrow(r);
  return toPage(r);
}

/**
 * Réponse d'un pare-feu (DataDome, Cloudflare…) ou d'une limitation : rien à analyser. Cas réel (TESTS-REELS) : un
 * site protégé par DataDome obtenait « Google ne peut pas indexer cette page : elle répond 403 », alors que c'est notre
 * robot, pas Googlebot, qui était refusé.
 */
function blockedOrThrow(r: HopResult): void {
  if (r.status === 429) throw new SafeFetchError('rate_limited');
  if ([401, 403, 503].includes(r.status) || (r.status === 200 && r.body.length < 40_000)) {
    const fw = firewallOf(r.status, r.headers, r.body.length ? decodeBody(r.body, r.headers['content-type']) : '');
    if (fw) throw new SafeFetchError('firewall', fw);
  }
}

/** Exécute des tâches avec au plus `n` en parallèle. */
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

/** Statut d'une adresse : HEAD, puis GET léger si le serveur refuse HEAD. Ne suit pas les redirections. */
async function statusOf(f: CrawlFetcher, url: string): Promise<{ status: number; finalUrl?: string; error?: string }> {
  let r = await f.fetch(url, { method: 'HEAD', followTo: () => false });
  if (!r.error && [403, 405, 501].includes(r.status)) r = await f.fetch(url, { maxBytes: 16 * 1024, followTo: () => false });
  if (r.blockedByRobots) return { status: 0, error: 'non vérifié (robots.txt)' };
  if (r.error) return { status: 0, error: r.error };
  // Réponse d'un pare-feu ou d'une limitation (cas réels : Cloudflare, DataDome, 429) : le lien n'est pas « cassé »,
  // il n'a pas pu être vérifié (TESTS-REELS, nov. 2026).
  if (r.status === 429) return { status: 429, error: 'non vérifié (trop de requêtes)' };
  if ([401, 403, 503].includes(r.status) && firewallOf(r.status, r.headers, r.body?.length ? decodeBody(r.body, r.headers['content-type']) : '')) return { status: r.status, error: 'non vérifié (protection anti-robots)' };
  return { status: r.chain.length ? r.chain[0].status : r.status, ...(r.chain.length ? { finalUrl: r.finalUrl } : {}) };
}

/* ------------------------------------------------------------------ */

export async function runMeta(url: string): Promise<MetaReport> {
  return analyzeMeta(await fetchPage(url));
}

export async function runIndex(url: string): Promise<IndexReport> {
  const f = fetcher();
  const page = await fetchPage(url, f);
  const origin = new URL(page.finalUrl).origin;
  const rob = await f.robotsFor(origin);
  return analyzeIndex(page, rob.status ? { url: rob.url, status: rob.status, text: rob.text } : null);
}

async function chainOf(f: CrawlFetcher, url: string, main = false): Promise<ChainResult> {
  const r = await f.fetch(url, { maxBytes: 16 * 1024 });
  if (main && !r.error) blockedOrThrow(r);
  const final = { url: r.finalUrl, status: r.status };
  return { start: url, chain: r.chain, final, ...(r.error ? { error: r.error, errorCode: r.errorCode } : {}) };
}

export async function runRedirects(url: string, variants = true): Promise<RedirectReport> {
  const f = fetcher();
  const u = start(url);
  const main = await chainOf(f, u, true);
  if (main.errorCode && !['redirect_loop', 'too_many_redirects'].includes(main.errorCode) && main.chain.length === 0) throw new SafeFetchError((KNOWN as string[]).includes(main.errorCode) ? (main.errorCode as SafeFetchErrorCode) : 'network', main.error);
  const vs = variants ? await pool(urlVariants(u), 2, (v) => chainOf(f, v)) : [];
  return analyzeRedirects(main, vs);
}

export async function runHeaders(url: string): Promise<HeadersReport> {
  return analyzeHeaders(await fetchPage(url));
}

export async function runHreflang(url: string): Promise<HreflangReport> {
  const f = fetcher();
  const page = await fetchPage(url, f);
  const decl = hreflangOf(page.html ?? '', page.finalUrl).filter((h) => /^https?:\/\//.test(h.href) && h.href !== page.finalUrl);
  const targets = [...new Set(decl.map((d) => d.href))].slice(0, 8);
  const alternates: AlternatePage[] = (
    await pool(targets, 3, async (href) => {
      const r = await f.fetch(href, { followTo: () => false });
      if (r.error && !r.chain.length) return null;
      const status = r.chain.length ? r.chain[0].status : r.status;
      const html = status >= 200 && status < 300 ? decodeBody(r.body, r.headers['content-type']) : '';
      return { href, status, hreflang: html ? hreflangOf(html, r.finalUrl) : [] };
    })
  ).filter((x): x is AlternatePage => !!x);
  return analyzeHreflang(page, alternates);
}

export async function runOg(url: string): Promise<OgReport> {
  const f = fetcher();
  const page = await fetchPage(url, f);
  const first = analyzeOg(page);
  if (!first.preview.image || !/^https?:\/\//.test(first.preview.image) || !first.og['og:image']) return first;
  const r = await f.fetch(first.preview.image, { method: 'HEAD' });
  let img = r;
  if (!r.error && [403, 405, 501].includes(r.status)) img = await f.fetch(first.preview.image, { maxBytes: 16 * 1024 });
  return analyzeOg(page, {
    url: first.preview.image,
    status: img.status,
    contentType: img.headers['content-type'] ?? null,
    ...(img.error ? { error: img.blockedByRobots ? 'bloquée par robots.txt' : img.error } : {}),
  });
}

export async function runLinks(url: string): Promise<LinksReport> {
  const f = fetcher();
  const page = await fetchPage(url, f);
  const rows = pageLinks(page);
  const targets = linksToCheck(rows, 30);
  // Sites externes : 10 origines au plus (chacune coûte une lecture de robots.txt).
  const origins = new Set<string>();
  const kept = targets.filter((t) => {
    const o = new URL(t).origin;
    if (o === new URL(page.finalUrl).origin) return true;
    if (origins.has(o)) return true;
    if (origins.size >= 10) return false;
    origins.add(o);
    return true;
  });
  const results = await pool(kept, 4, async (t) => [t, await statusOf(f, t)] as const);
  return analyzeLinks(page, rows, new Map(results));
}

/** Le sitemap : adresse donnée, sinon ceux déclarés dans le robots.txt, sinon /sitemap.xml puis /sitemap_index.xml. */
/** Erreurs qui disent que le site entier est injoignable (et pas seulement son sitemap). */
const SITE_LEVEL = ['dns', 'tls', 'network', 'blocked_host', 'blocked_ip', 'blocked_port'];
const sameHost = (a: string, u: URL) => {
  try {
    return new URL(a).hostname === u.hostname;
  } catch {
    return false;
  }
};

export async function runSitemap(input: string): Promise<SitemapReport> {
  const f = fetcher();
  const u = new URL(start(input));
  const rob = await f.robotsFor(u.origin);
  const declared = rob.parsed ? rob.parsed.sitemaps : [];
  const given = /sitemap|\.xml(\.gz)?$|\.txt$/i.test(u.pathname) && u.pathname !== '/';
  const candidates: { url: string; source: SitemapReport['source'] }[] = given
    ? [{ url: u.toString(), source: 'given' }]
    : declared.length
      ? declared.slice(0, 1).map((d) => ({ url: d, source: 'robots' as const }))
      : [`${u.origin}/sitemap.xml`, `${u.origin}/sitemap_index.xml`].map((x) => ({ url: x, source: 'default' as const }));
  let fetched: SitemapFetch | null = null;
  let lastHostError: HopResult | null = null;
  for (const c of candidates) {
    const r = await f.fetch(c.url, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
    lastHostError = r.error && sameHost(c.url, u) ? r : null;
    const body = r.error ? Buffer.alloc(0) : gunz(r.body);
    fetched = {
      url: c.url,
      source: c.source,
      status: r.status,
      contentType: r.headers['content-type'] ?? '',
      text: body.length ? decodeBody(body, r.headers['content-type']) : '',
      bytes: body.length,
      truncated: r.truncated,
      declaredInRobots: declared.some((d) => d === c.url),
      ...(r.error ? { error: r.error } : {}),
    };
    if (!r.error && r.status >= 200 && r.status < 300) break;
  }
  const fx = fetched!;
  // Site lui-même injoignable (domaine inexistant, connexion refusée, adresse bloquée) : même erreur que les autres
  // outils (« Nom de domaine introuvable »), et non « Aucun sitemap trouvé » (TESTS-REELS, nov. 2026).
  if (fx.error && lastHostError && SITE_LEVEL.includes(lastHostError.errorCode ?? '')) throw toError(lastHostError);
  if (fx.error || fx.status < 200 || fx.status >= 300) return analyzeSitemap(fx);
  const parsed = parseSitemap(fx.text);
  let children: SitemapReport['children'] = [];
  let sampleUrls: string[] = [];
  if (parsed.kind === 'index') {
    const list = parsed.locs.slice(0, 50);
    const read = await pool(list.slice(0, 3), 2, async (c) => {
      const r = await f.fetch(c, { accept: 'application/xml,text/xml;q=0.9,*/*;q=0.5' });
      const text = r.error ? '' : decodeBody(gunz(r.body), r.headers['content-type']);
      const locs = text ? parseSitemap(text).locs : [];
      return { url: c, status: r.status, urlCount: locs.length, locs };
    });
    children = list.map((c) => {
      const got = read.find((x) => x.url === c);
      return got ? { url: c, status: got.status, urlCount: got.urlCount } : { url: c };
    });
    sampleUrls = read.flatMap((x) => x.locs).slice(0, 10);
  } else {
    sampleUrls = (parsed.kind === 'text' ? parsed.locs : sitemapEntries(fx.text).map((e) => e.loc)).filter((l) => /^https?:\/\//.test(l)).slice(0, 10);
  }
  const sample = await pool(sampleUrls, 4, async (s) => ({ url: s, ...(await statusOf(f, s)) }));
  return analyzeSitemap(fx, sample, children);
}
