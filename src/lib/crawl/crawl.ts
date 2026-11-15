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
import { SafeFetchError, looksBinary, normalizeInputUrl } from '@/lib/siteaudit/fetch';
import { diagnoseCrawl, firewallOf, type CrawlSignals } from './diagnose';
import { CrawlFetcher, decodeBody, type HopResult } from './fetcher';
import { extractPage, hasNoindex } from './extract';
import { detectPlatform } from './platform';
import { renderConfig, renderPages } from './render';
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
/** Mémoire : HTML brut gardé pour les audits, au total (au-delà, `html` reste vide pour les pages suivantes). */
export const MAX_TOTAL_HTML_CHARS = 40_000_000;

/** Pièges à URL (calendriers, filtres à facettes, liens relatifs récursifs, identifiants de session). */
export const MAX_QUERY_VARIANTS = 5;
export const MAX_URL_LENGTH = 400;
const MAX_PATH_SEGMENTS = 12;
/** Limitation (429/503) : une seule pause courte si le site la demande, puis arrêt poli. */
const MAX_RETRY_AFTER_MS = 3_000;
const STOP_AFTER_LIMITS = 3;
const STOP_AFTER_CHALLENGES = 2;

/** Raison de ne pas suivre une URL (piège à robots), ou null. `variants` compte les variantes par chemin. */
export function trapReason(url: string, variants: Map<string, number>): string | null {
  if (url.length > MAX_URL_LENGTH) return 'adresse trop longue';
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 'adresse invalide';
  }
  const segs = u.pathname.split('/').filter(Boolean);
  if (segs.length > MAX_PATH_SEGMENTS) return 'chemin trop profond';
  for (let i = 2; i < segs.length; i++) if (segs[i] === segs[i - 1] && segs[i] === segs[i - 2]) return 'segment répété (lien relatif récursif)';
  if (u.search) {
    if ([...u.searchParams.keys()].length > 5) return 'trop de paramètres';
    const k = `${u.host}${u.pathname}`;
    const n = (variants.get(k) ?? 0) + 1;
    if (n > MAX_QUERY_VARIANTS) return 'trop de variantes de paramètres (filtres, calendrier…)';
    variants.set(k, n);
  }
  return null;
}

const retryAfterMs = (h: Record<string, string>): number | undefined => {
  const v = h['retry-after'];
  if (!v) return undefined;
  const n = Number(v);
  if (Number.isFinite(n) && n >= 0) return n * 1000;
  const d = Date.parse(v);
  return Number.isFinite(d) ? Math.max(0, d - Date.now()) : undefined;
};

function canonicalFromLink(link: string | undefined, base: string): string | undefined {
  if (!link) return undefined;
  for (const part of link.split(/,(?=\s*<)/)) {
    const m = /<([^>]+)>\s*;(.*)$/.exec(part.trim());
    if (m && /\brel\s*=\s*"?canonical"?/i.test(m[2])) return normalizeUrl(m[1], base) ?? undefined;
  }
  return undefined;
}

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
  return /^(\uFEFF|\xEF\xBB\xBF)?\s*</.test(body.subarray(0, 256).toString('latin1'));
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
  let politeStop = false;
  const stopped = () => !!signal?.aborted || timeOver() || politeStop;
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
  let sig: CrawlSignals = {};
  const finish = (): SiteCrawl => {
    result.durationMs = Date.now() - t0;
    if (signal?.aborted) {
      result.aborted = true;
      result.truncated = true;
    }
    try {
      const home = result.pages[0];
      result.platform = detectPlatform([
        { html: home?.html ?? sig.entryBody, headers: { ...(sig.entryHeaders ?? {}), ...(home?.headers ?? {}) } },
        ...result.pages.slice(1, 5).map((p) => ({ html: p.html, headers: p.headers })),
      ]);
      if (sig.robots && result.robots?.text && result.pages.some((p) => p.blockedByRobots)) sig.robots.blocksSome = true;
      result.diagnosis = diagnoseCrawl(result, sig);
    } catch {
      /* diagnostic best effort : ne fait jamais échouer l'exploration */
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
    entry = await fetcher.fetch(c, { followTo: () => true, soft: 'meta+js' });
    if (entry.status === 429) {
      // Limitation dès l'accueil : une seule nouvelle tentative si le site annonce une attente courte.
      const wait = retryAfterMs(entry.headers);
      if (wait !== undefined && wait <= MAX_RETRY_AFTER_MS && Date.now() + wait < deadline - 2_000) {
        await sleep(wait, signal);
        entry = await fetcher.fetch(c, { followTo: () => true, soft: 'meta+js' });
      }
    }
    if (!entry.error || !['dns', 'network', 'timeout'].includes(entry.errorCode ?? '') || stopped()) break;
  }
  fetched = 1;
  if (!entry) return finish();
  if (entry.errorCode === 'blocked_ip' || entry.errorCode === 'blocked_host') throw new SafeFetchError(entry.errorCode);
  sig = {
    entryErrorCode: entry.errorCode,
    entryError: entry.error,
    entryHeaders: entry.headers,
    entryStatus: entry.status,
    entryBody: entry.body.length ? decodeBody(entry.body.subarray(0, 200_000), entry.headers['content-type']) : undefined,
  };
  const finalUrl = entry.status ? entry.finalUrl : start.url;
  const finalOrigin = new URL(finalUrl).origin;
  const siteHost = new URL(finalUrl).hostname;
  result.finalOrigin = finalOrigin;
  const internal = (u: string) => isInternal(u, siteHost, includeSubdomains);

  /* ---------- 2. robots.txt ---------- */
  const robots = await fetcher.robotsFor(finalOrigin);
  sig.robots = { status: robots.status, ...(robots.errorCode ? { errorCode: robots.errorCode } : {}), ...(robots.isHtml ? { isHtml: true } : {}) };
  if (robots.status) result.robots = { url: robots.url, status: robots.status, ...(robots.text !== undefined ? { text: robots.text } : {}), sitemaps: robots.parsed?.sitemaps ?? [] };
  if (robots.crawlDelayMs > 0 && opts.respectRobots !== false) {
    concurrency = 1;
    delayMs = Math.max(delayMs, Math.min(robots.crawlDelayMs, 2_000));
  }

  // Accueil refusé (pare-feu, limitation, authentification) : inutile d'insister ailleurs sur le site.
  const homeRefused =
    entry.status === 429 || entry.status === 401 || entry.status === 407 || (entry.status >= 400 && !!firewallOf(entry.status, entry.headers, sig.entryBody));

  /* ---------- 3. Sitemaps ---------- */
  if (!stopped() && !homeRefused && !entry.blockedByRobots) {
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
  const variants = new Map<string, number>();
  let trapSkipped = 0;
  let stopReason: 'rate_limited' | 'firewall' | null = null;
  let limited = 0;
  let consecutiveLimits = 0;
  let challenges = 0;
  let consecutiveChallenges = 0;
  let lastRetryAfterS: number | undefined;
  let binaryPages = 0;
  let hugePages = 0;
  let slowPages = 0;
  const retried = new Set<string>();
  let keptHtml = 0;

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
      if (trapReason(l.to, variants)) {
        trapSkipped++;
        continue;
      }
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
    if (looksBinary(r.body)) {
      binaryPages++;
      addError(item.url, 'Contenu binaire (image, archive…) servi comme une page HTML : non analysé.');
      return;
    }
    if (r.fetchMs > 5_000) slowPages++;
    const html = decodeBody(r.body, page.contentType);
    const x = extractPage(html, finalKey);
    const { links, baseUrl: _base, ...fields } = x;
    void _base;
    Object.assign(page, fields);
    if (page.html) {
      keptHtml += page.html.length;
      if (keptHtml > MAX_TOTAL_HTML_CHARS) page.html = undefined;
    }
    const headerCanonical = canonicalFromLink(page.headers.link, finalKey);
    if (headerCanonical) page.canonicalHeader = headerCanonical;
    const noindex = hasNoindex(page.metaRobots, page.headers['x-robots-tag']);
    const canonicalKey = page.canonical ? normalizeUrl(page.canonical) : null;
    page.isIndexable = page.status === 200 && !noindex && (!page.canonical || canonicalKey === finalKey);
    const nofollowPage = /\b(nofollow|none)\b/i.test(page.metaRobots ?? '');
    // On ne suit que les liens des pages en succès (les liens d'une page 404 du site sont souvent un gabarit).
    addLinks(page, links, !nofollowPage && page.status < 300, item.depth);
    if (r.truncated) {
      hugePages++;
      addError(item.url, 'Page de plus de 2 Mo : seule la première partie est analysée.');
    }
  };

  // Entrée : la page d'accueil, déjà récupérée.
  if (entry.blockedByRobots || entry.status || !entry.error) processResult({ url: start.url, depth: 0 }, entry);
  else addError(start.url, entry.error ?? 'Site injoignable.');

  if (result.pages.length && !result.pages[0].blockedByRobots && !homeRefused && result.pages[0].status < 400) {
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

  const worker = async (id: number) => {
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
        const r = await fetcher.fetch(item.url, { followTo: internal, soft: 'meta' });
        if (r.errorCode === 'aborted') return;
        if (r.errorCode === 'timeout' && timeOver()) result.truncated = true;
        else if (r.status === 429 || (r.status === 503 && r.headers['retry-after'])) {
          // Le site demande de ralentir : une pause courte s'il l'annonce, sinon arrêt poli (pas de page « cassée »).
          limited++;
          consecutiveLimits++;
          concurrency = 1; // ralentir tout de suite : les autres fils s'arrêtent après leur requête en cours
          const wait = retryAfterMs(r.headers);
          if (wait !== undefined) lastRetryAfterS = Math.round(wait / 1000);
          if (wait !== undefined && wait <= MAX_RETRY_AFTER_MS && !retried.has(item.url) && Date.now() + wait < deadline - 1_000) {
            retried.add(item.url);
            await sleep(wait, signal);
            linkQueue.unshift(item);
            fetched--;
          } else {
            addError(item.url, `Le site limite nos requêtes (HTTP ${r.status}${wait !== undefined ? `, réessayer dans ${Math.round(wait / 1000)} s` : ''}).`);
          }
          if (consecutiveLimits >= STOP_AFTER_LIMITS) {
            stopReason = 'rate_limited';
            politeStop = true;
            result.truncated = true;
          }
        } else {
          consecutiveLimits = 0;
          const fw = r.status >= 400 ? firewallOf(r.status, r.headers, r.body.subarray(0, 30_000).toString('latin1')) : null;
          if (fw) {
            challenges++;
            consecutiveChallenges++;
            addError(item.url, `Page refusée par un pare-feu anti-robots (${fw}, HTTP ${r.status}).`);
            sig.firewall = { name: fw, count: challenges, stopped: false };
            if (consecutiveChallenges >= STOP_AFTER_CHALLENGES) {
              stopReason = 'firewall';
              politeStop = true;
              result.truncated = true;
            }
          } else {
            consecutiveChallenges = 0;
            processResult(item, r);
          }
        }
      } catch (e) {
        addError(item.url, (e as Error).message);
      } finally {
        inflight--;
        notify();
      }
      emit({ phase: 'pages', queued: linkQueue.length + sitemapQueue.length, total: maxPages });
      if (id >= concurrency) return; // concurrence réduite (limitation) : ce fil s'arrête
      await sleep(delayMs, signal);
    }
  };
  if (result.pages.length && !stopped() && !homeRefused) await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  notify();

  /* ---------- 4 bis. (option CRAWL_RENDER) rendu JavaScript des pages vides côté serveur ---------- */
  const rcfg = renderConfig();
  if (rcfg.enabled && !signal?.aborted && deadline - Date.now() > 3_000) {
    const targets = result.pages
      .filter((p) => p.status === 200 && !p.blockedByRobots && p.renderHints.likelyClientRendered && !p.rendered)
      .sort((a, b) => (a.depth === 0 ? -1 : b.depth === 0 ? 1 : 0))
      .slice(0, rcfg.maxPages);
    if (targets.length) {
      emit({ phase: 'pages', queued: linkQueue.length + sitemapQueue.length, total: maxPages, currentUrl: targets[0].finalUrl });
      const fetchSub = (url: string, accept: string) => fetcher.fetch(url, { accept, followTo: () => true, timeoutMs: 5_000 });
      const r = await renderPages(
        targets.map((p) => p.finalUrl),
        fetchSub,
        { cfg: rcfg, deadline: deadline - 300, signal },
      );
      result.render = { enabled: true, attempted: targets.length, rendered: [], ms: r.ms, ...(r.error ? { error: r.error } : {}) };
      for (const o of r.outcomes) {
        const page = targets.find((p) => p.finalUrl === o.url);
        if (!page) continue;
        if (!o.html) {
          addError(o.url, `Rendu JavaScript impossible : ${o.error ?? 'raison inconnue'}.`);
          continue;
        }
        // Champs = DOM rendu (ce que voit Google, qui exécute JavaScript) ; `html` et `renderHints` restent ceux du
        // serveur (ce que voient la plupart des robots d'IA, qui ne l'exécutent pas).
        const x = extractPage(o.html, page.finalUrl);
        const { links, baseUrl: _b, html: _h, renderHints: _r, htmlTruncated: _t, ...fields } = x;
        void _b;
        void _h;
        void _r;
        void _t;
        Object.assign(page, fields, { rendered: true });
        const noindex = hasNoindex(page.metaRobots, page.headers['x-robots-tag']);
        const key = normalizeUrl(page.finalUrl) ?? page.finalUrl;
        page.isIndexable = page.status === 200 && !noindex && (!page.canonical || normalizeUrl(page.canonical) === key);
        addLinks(page, links, !/\b(nofollow|none)\b/i.test(page.metaRobots ?? ''), Math.max(0, page.depth));
        result.render.rendered.push(page.finalUrl);
      }
      // Liens découverts après rendu : seconde passe, dans ce qui reste du budget.
      if (linkQueue.length && !stopped() && budgetLeft()) {
        await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
        notify();
      }
    } else result.render = { enabled: true, attempted: 0, rendered: [], ms: 0 };
  }
  if (linkQueue.length + sitemapQueue.length > 0 && (timeOver() || !budgetLeft())) result.truncated = true;
  if (limited) sig.rateLimited = { count: limited, ...(lastRetryAfterS !== undefined ? { retryAfterS: lastRetryAfterS } : {}), stopped: stopReason === 'rate_limited' };
  if (sig.firewall) sig.firewall.stopped = stopReason === 'firewall';
  if (binaryPages) sig.binaryPages = binaryPages;
  if (hugePages) sig.hugePages = hugePages;
  if (trapSkipped) sig.trapSkipped = trapSkipped;
  if (slowPages) sig.slowPages = slowPages;
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
        // 400 aussi (ROBUSTESSE V6) : l'optimiseur d'images de Next.js répond 400 à un HEAD non mis en cache, 200 en GET.
        if (!r.error && (r.status === 405 || r.status === 501 || r.status === 403 || r.status === 400)) r = await fetcher.fetch(job.url, { timeoutMs: 5_000, accept: '*/*', maxBytes: 1 });
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
