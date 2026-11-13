/**
 * crawlSite : exploration réelle et polie d'un site → `SiteCrawl`.
 *
 * Étapes : URL d'entrée normalisée (schéma, slash final ; repli http et www si l'hôte ne répond pas) → page d'accueil
 * avec redirections suivies (http→https, www) → robots.txt de l'origine finale (RepereBot) → sitemaps (index, gzip,
 * plafonds) → file en largeur depuis l'accueil, entrelacée avec un échantillon équilibré par section des URL des
 * sitemaps → extraction de chaque page → graphe de liens et profondeur de clic → (option) état des liens sortants et
 * des images. Budgets de pages et de temps : le résultat est alors partiel (`truncated`), jamais un échec.
 * Annulation par `signal` : résultat partiel avec `aborted`.
 */
import { SafeFetchError, normalizeInputUrl } from '@/lib/siteaudit/fetch';
import { CrawlFetcher, decodeBody, type HopResult } from './fetcher';
import { extractPage, hasNoindex } from './extract';
import { readSitemaps } from './sitemap';
import type { CrawledPage, CrawlOptions, CrawlProgress, SiteCrawl } from './types';
import { balancedSample, isInternal, looksLikeHtmlUrl, normalizeStartUrl, normalizeUrl } from './url';

export const DEFAULT_MAX_PAGES = 60;
export const MAX_PAGES_LIMIT = 2_000;
export const DEFAULT_TIME_BUDGET_MS = 45_000;
export const DEFAULT_CONCURRENCY = 4;
export const MAX_CONCURRENCY = 6;
export const DEFAULT_DELAY_MS = 100;
export const MAX_LINKS = 50_000;
export const MAX_ERRORS = 500;
export const MAX_SITEMAP_URLS_KEPT = 10_000;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));
const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((ok) => {
    if (ms <= 0 || signal?.aborted) return ok();
    const t = setTimeout(done, ms);
    function done() {
      clearTimeout(t);
      signal?.removeEventListener('abort', done);
      ok();
    }
    signal?.addEventListener('abort', done);
  });

function isHtmlType(contentType: string | undefined, body: Buffer): boolean {
  if (contentType) return /text\/html|application\/xhtml\+xml/i.test(contentType);
  return /^\s*</.test(body.subarray(0, 256).toString('latin1'));
}

interface QueueItem {
  url: string;
  depth: number;
}

/** Page minimale (bloquée, erreur, redirection hors site, contenu non HTML). */
function emptyPage(item: QueueItem, r: HopResult | null): CrawledPage {
  return {
    url: item.url,
    finalUrl: r?.finalUrl ?? item.url,
    status: r?.status ?? 0,
    redirectChain: r?.chain ?? [],
    depth: item.depth,
    contentType: r?.headers['content-type'],
    bytes: r?.body.length ?? 0,
    fetchMs: r?.fetchMs ?? 0,
    headers: r?.headers ?? {},
    hreflang: [],
    h1: [],
    headings: [],
    wordCount: 0,
    textHash: '',
    images: [],
    jsonLd: [],
    jsonLdErrors: [],
    openGraph: {},
    internalLinks: 0,
    externalLinks: 0,
    isIndexable: false,
    renderHints: { scriptsCount: 0, textToHtmlRatio: 0, likelyClientRendered: false },
  };
}

export async function crawlSite(input: string, opts: CrawlOptions = {}): Promise<SiteCrawl> {
  const t0 = Date.now();
  const startedAt = new Date(t0).toISOString();
  const maxPages = clamp(opts.maxPages ?? DEFAULT_MAX_PAGES, 1, MAX_PAGES_LIMIT);
  const timeBudgetMs = clamp(opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS, 500, 15 * 60_000);
  let concurrency = clamp(opts.concurrency ?? DEFAULT_CONCURRENCY, 1, MAX_CONCURRENCY);
  let delayMs = clamp(opts.delayMs ?? DEFAULT_DELAY_MS, 0, 5_000);
  const deadline = t0 + timeBudgetMs;
  const signal = opts.signal;
  const includeSubdomains = !!opts.includeSubdomains;

  const start = normalizeStartUrl(input);
  if (!start) throw new SafeFetchError('invalid_url');
  normalizeInputUrl(start.url); // forme de l'URL (schéma, port, hôtes internes) : lève si refusée

  const fetcher = new CrawlFetcher({ userAgent: opts.userAgent, respectRobots: opts.respectRobots !== false, signal, deadline });
  const errors: SiteCrawl['errors'] = [];
  const addError = (url: string, error: string) => {
    if (errors.length < MAX_ERRORS) errors.push({ url, error });
  };
  const timeOver = () => Date.now() >= deadline - 50;
  const stopped = () => !!signal?.aborted || timeOver();
  let fetched = 0;
  const emit = (p: Omit<CrawlProgress, 'fetched'> & { fetched?: number }) => {
    try {
      opts.onProgress?.({ fetched, ...p });
    } catch {
      /* un abonné défaillant n'interrompt pas l'exploration */
    }
  };

  const result: SiteCrawl = {
    startUrl: start.url,
    origin: new URL(start.url).origin,
    finalOrigin: new URL(start.url).origin,
    startedAt,
    durationMs: 0,
    truncated: false,
    robots: null,
    sitemaps: [],
    sitemapUrls: [],
    pages: [],
    links: [],
    errors,
    redirects: [],
  };
  const finish = (): SiteCrawl => {
    result.durationMs = Date.now() - t0;
    if (signal?.aborted) {
      result.aborted = true;
      result.truncated = true;
    }
    emit({ phase: 'done', queued: 0, total: result.pages.length });
    return result;
  };

  /* ---------- 1. Page d'accueil (et repli http / www) ---------- */
  emit({ phase: 'robots', queued: 1, currentUrl: start.url });
  const candidates = [start.url];
  const su = new URL(start.url);
  if (!start.schemeGiven && su.protocol === 'https:') candidates.push(start.url.replace(/^https:/, 'http:'));
  if (!su.hostname.startsWith('www.') && su.hostname.split('.').length === 2) candidates.push(start.url.replace('://', '://www.'));
  let entry: HopResult | null = null;
  for (const c of candidates) {
    entry = await fetcher.fetch(c, { followTo: () => true });
    if (!entry.error || !['dns', 'network', 'timeout'].includes(entry.errorCode ?? '') || stopped()) break;
  }
  fetched = 1;
  if (!entry) return finish();
  if (entry.errorCode === 'blocked_ip' || entry.errorCode === 'blocked_host') throw new SafeFetchError(entry.errorCode);
  const finalUrl = entry.status ? entry.finalUrl : start.url;
  const finalOrigin = new URL(finalUrl).origin;
  const siteHost = new URL(finalUrl).hostname;
  result.finalOrigin = finalOrigin;
  const internal = (u: string) => isInternal(u, siteHost, includeSubdomains);

  /* ---------- 2. robots.txt ---------- */
  const robots = await fetcher.robotsFor(finalOrigin);
  if (robots.status) result.robots = { url: robots.url, status: robots.status, ...(robots.text !== undefined ? { text: robots.text } : {}), sitemaps: robots.parsed?.sitemaps ?? [] };
  if (robots.crawlDelayMs > 0 && opts.respectRobots !== false) {
    concurrency = 1;
    delayMs = Math.max(delayMs, Math.min(robots.crawlDelayMs, 2_000));
  }

  /* ---------- 3. Sitemaps ---------- */
  if (!stopped()) {
    emit({ phase: 'sitemaps', queued: 0 });
    const sitemapDeadline = t0 + timeBudgetMs * 0.3;
    const sm = await readSitemaps(fetcher, result.robots?.sitemaps ?? [], finalOrigin, internal, () => stopped() || Date.now() > sitemapDeadline);
    result.sitemaps = sm.sitemaps;
    const set = new Set<string>();
    for (const u of sm.urls) {
      const n = normalizeUrl(u);
      if (n && set.size < MAX_SITEMAP_URLS_KEPT) set.add(n);
    }
    result.sitemapUrls = [...set];
  }

  /* ---------- 4. Pages ---------- */
  const seen = new Set<string>();
  const pagesByUrl = new Map<string, CrawledPage>(); // clé : URL finale normalisée
  const redirectTo = new Map<string, string>(); // URL demandée → URL finale (normalisées)
  const linkQueue: QueueItem[] = [];
  let sitemapQueue: QueueItem[] = [];
  const entryKey = normalizeUrl(finalUrl) ?? finalUrl;
  seen.add(normalizeUrl(start.url) ?? start.url);
  seen.add(entryKey);
  let inflight = 0;
  let turn = 0;

  const addLinks = (page: CrawledPage, links: { to: string; anchor: string; rel: string[] }[], follow: boolean, depth: number) => {
    let inCount = 0;
    let outCount = 0;
    for (const l of links) {
      const isIn = internal(l.to);
      if (isIn) inCount++;
      else outCount++;
      if (result.links.length < MAX_LINKS) result.links.push({ from: page.finalUrl, to: l.to, anchor: l.anchor, rel: l.rel, internal: isIn });
      if (!isIn || !follow || l.rel.includes('nofollow') || seen.has(l.to) || !looksLikeHtmlUrl(l.to)) continue;
      seen.add(l.to);
      linkQueue.push({ url: l.to, depth: depth + 1 });
    }
    page.internalLinks = inCount;
    page.externalLinks = outCount;
  };

  const processResult = (item: QueueItem, r: HopResult) => {
    if (r.blockedByRobots) {
      const p = emptyPage(item, r);
      p.blockedByRobots = true;
      p.finalUrl = item.url;
      result.pages.push(p);
      return;
    }
    if (r.error && !r.status) {
      addError(item.url, r.error);
      return;
    }
    if (r.error) addError(item.url, r.error); // boucle, trop de redirections… (page gardée pour la chaîne)
    const finalKey = normalizeUrl(r.finalUrl) ?? r.finalUrl;
    const reqKey = normalizeUrl(item.url) ?? item.url;
    if (r.chain.length) {
      redirectTo.set(reqKey, finalKey);
      result.redirects!.push({ from: item.url, to: r.finalUrl, chain: r.chain, ...(r.error ? { error: r.error } : {}) });
      if (!r.error && !r.leftScope && pagesByUrl.has(finalKey)) return; // cible déjà explorée
      seen.add(finalKey);
    }
    const page = emptyPage(item, r);
    page.finalUrl = r.error || r.leftScope ? r.finalUrl : finalKey;
    if (r.error || r.leftScope || r.status < 200 || r.status === 204 || r.status === 304) {
      result.pages.push(page);
      if (!r.error && !r.leftScope) pagesByUrl.set(finalKey, page);
      return;
    }
    pagesByUrl.set(finalKey, page);
    result.pages.push(page);
    if (!isHtmlType(page.contentType, r.body)) return;
    const html = decodeBody(r.body, page.contentType);
    const x = extractPage(html, finalKey);
    const { links, baseUrl: _base, ...fields } = x;
    void _base;
    Object.assign(page, fields);
    const noindex = hasNoindex(page.metaRobots, page.headers['x-robots-tag']);
    const canonicalKey = page.canonical ? normalizeUrl(page.canonical) : null;
    page.isIndexable = page.status === 200 && !noindex && (!page.canonical || canonicalKey === finalKey);
    const nofollowPage = /\b(nofollow|none)\b/i.test(page.metaRobots ?? '');
    // On ne suit que les liens des pages en succès (les liens d'une page 404 du site sont souvent un gabarit).
    addLinks(page, links, !nofollowPage && page.status < 300, item.depth);
    if (r.truncated) addError(item.url, 'Page de plus de 2 Mo : seule la première partie est analysée.');
  };

  // Entrée : la page d'accueil, déjà récupérée.
  if (entry.blockedByRobots || entry.status || !entry.error) processResult({ url: start.url, depth: 0 }, entry);
  else addError(start.url, entry.error ?? 'Site injoignable.');

  if (result.pages.length && !result.pages[0].blockedByRobots) {
    const pending = result.sitemapUrls.filter((u) => !seen.has(u) && looksLikeHtmlUrl(u));
    sitemapQueue = balancedSample(pending, maxPages).map((url) => ({ url, depth: -1 }));
  }

  const takeNext = (): QueueItem | null => {
    // Liens d'abord ; une place sur trois pour l'échantillon des sitemaps (pages orphelines comprises).
    turn++;
    const preferSitemap = turn % 3 === 0;
    let it: QueueItem | undefined;
    if (preferSitemap) it = sitemapQueue.shift() ?? linkQueue.shift();
    else it = linkQueue.shift() ?? sitemapQueue.shift();
    while (it && it.depth === -1 && seen.has(it.url)) it = sitemapQueue.shift() ?? linkQueue.shift();
    return it ?? null;
  };

  let waiters: (() => void)[] = [];
  const notify = () => {
    const w = waiters;
    waiters = [];
    w.forEach((f) => f());
  };
  const budgetLeft = () => fetched < maxPages;

  const worker = async () => {
    for (;;) {
      if (stopped() || !budgetLeft()) return;
      const item = takeNext();
      if (!item) {
        if (inflight === 0) return;
        await new Promise<void>((ok) => waiters.push(ok));
        continue;
      }
      if (item.depth === -1) seen.add(item.url);
      inflight++;
      fetched++;
      emit({ phase: 'pages', queued: linkQueue.length + sitemapQueue.length, total: maxPages, currentUrl: item.url });
      try {
        const r = await fetcher.fetch(item.url, { followTo: internal });
        if (r.errorCode === 'aborted') return;
        if (r.errorCode === 'timeout' && timeOver()) result.truncated = true;
        else processResult(item, r);
      } catch (e) {
        addError(item.url, (e as Error).message);
      } finally {
        inflight--;
        notify();
      }
      emit({ phase: 'pages', queued: linkQueue.length + sitemapQueue.length, total: maxPages });
      await sleep(delayMs, signal);
    }
  };
  if (result.pages.length && !stopped()) await Promise.all(Array.from({ length: concurrency }, worker));
  notify();
  if (linkQueue.length + sitemapQueue.length > 0 && (timeOver() || !budgetLeft())) result.truncated = true;
  if (timeOver() && !result.truncated && inflight > 0) result.truncated = true;

  /* ---------- 5. Profondeur de clic (plus court chemin depuis l'accueil) ---------- */
  const resolve = (u: string) => redirectTo.get(u) ?? u;
  const adj = new Map<string, string[]>();
  for (const l of result.links) {
    if (!l.internal || l.rel.includes('nofollow')) continue;
    const from = l.from;
    const to = resolve(l.to);
    const list = adj.get(from);
    if (list) list.push(to);
    else adj.set(from, [to]);
  }
  const depthOf = new Map<string, number>([[entryKey, 0]]);
  const bfs = [entryKey];
  for (let i = 0; i < bfs.length; i++) {
    const d = depthOf.get(bfs[i])!;
    for (const n of adj.get(bfs[i]) ?? []) {
      if (!depthOf.has(n)) {
        depthOf.set(n, d + 1);
        bfs.push(n);
      }
    }
  }
  for (const p of result.pages) {
    const d = depthOf.get(normalizeUrl(p.finalUrl) ?? p.finalUrl) ?? depthOf.get(normalizeUrl(p.url) ?? p.url);
    // -1 : page trouvée seulement par le sitemap, non reliée depuis l'accueil (orpheline) dans ce qui a été exploré.
    p.depth = d ?? (p.depth >= 0 ? p.depth : -1);
  }

  /* ---------- 6. (option) état des liens sortants et des images ---------- */
  if (opts.checkLinks && !stopped()) {
    const max = clamp(opts.maxLinkChecks ?? 40, 1, 500);
    const external = [...new Set(result.links.filter((l) => !l.internal).map((l) => l.to))];
    const imgs = [...new Set(result.pages.flatMap((p) => p.images.map((i) => i.src)).filter((s) => /^https?:/.test(s)))];
    const half = Math.ceil(max / 2);
    const pickImg = balancedSample(imgs, Math.max(half, max - external.length));
    const pickLinks = balancedSample(external, max - Math.min(pickImg.length, max));
    const jobs: { url: string; kind: 'link' | 'image' }[] = [...pickLinks.map((url) => ({ url, kind: 'link' as const })), ...pickImg.slice(0, max - pickLinks.length).map((url) => ({ url, kind: 'image' as const }))];
    const checks: NonNullable<SiteCrawl['linkChecks']> = [];
    let idx = 0;
    const checker = async () => {
      while (idx < jobs.length && !stopped()) {
        const job = jobs[idx++];
        let r = await fetcher.fetch(job.url, { method: 'HEAD', timeoutMs: 5_000, accept: '*/*' });
        // Certains serveurs refusent HEAD : on retente en GET en ne lisant que le début.
        if (!r.error && (r.status === 405 || r.status === 501 || r.status === 403)) r = await fetcher.fetch(job.url, { timeoutMs: 5_000, accept: '*/*', maxBytes: 1 });
        const len = Number(r.headers['content-length']);
        checks.push({
          url: job.url,
          kind: job.kind,
          status: r.status,
          ...(r.chain.length ? { finalUrl: r.finalUrl } : {}),
          ...(Number.isFinite(len) && len > 0 ? { bytes: len } : {}),
          ...(r.blockedByRobots ? { blockedByRobots: true } : {}),
          ...(r.error ? { error: r.error } : {}),
        });
        await sleep(delayMs, signal);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, 4) }, checker));
    const bytesBy = new Map(checks.filter((c) => c.kind === 'image' && c.bytes).map((c) => [c.url, c.bytes!]));
    for (const p of result.pages) for (const im of p.images) if (bytesBy.has(im.src)) im.bytes = bytesBy.get(im.src);
    result.linkChecks = checks;
  }

  return finish();
}

/** Version publique du résultat : sans le HTML brut des pages (volumineux). */
export function publicCrawl(c: SiteCrawl): SiteCrawl {
  return { ...c, pages: c.pages.map(({ html: _html, ...p }) => (void _html, p)) };
}
