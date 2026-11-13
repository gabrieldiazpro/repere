/**
 * runFullAnalysis : l'analyse publique en 60 s (SEO + GEO + contrôle IA rapide), en flux d'événements.
 *
 * Déroulé : page d'accueil → détection (marque, type, ville, activité) → en parallèle, sous budget :
 *   exploration (60 pages, 45 s) puis audit SEO + audit GEO sur l'exploration ; PageSpeed mobile (si SEO-DATA est
 *   configuré) ; contrôle IA rapide (3 à 6 questions, plafond d'appels). Un module en échec ou hors délai donne un
 *   résultat PARTIEL (jamais d'échec global, sauf adresse refusée).
 * Les événements sont numérotés (`seq`) et horodatés (`t`, ms depuis le début) pour une interface vivante.
 */
import crypto from 'node:crypto';
import type { SiteCrawl } from '@/lib/crawl/types';
import { SafeFetchError, normalizeInputUrl, safeFetch } from '@/lib/siteaudit/fetch';
import { maxAiCallsFromEnv } from './aicheck';
import { detectSite, homeSignals } from './detect';
import { resolveModules } from './modules';
import { autoFixesOf, buildVerdict, compareAnalyses, computeScores, mergePriorities } from './prioritize';
import type {
  AiCheckSummary,
  AnalysisEvent,
  AnalysisEventBody,
  AnalysisInput,
  CrawlSummary,
  DataSummary,
  Detection,
  FullAnalysis,
  ModuleId,
  ModuleReport,
  ModuleStatus,
  PagespeedResult,
  RunAnalysisOptions,
} from './types';
import type { PerfData as SeoDataPerfData } from '@/lib/seodata/types';

export const DEFAULT_BUDGET_MS = 58_000;
export const CRAWL_MAX_PAGES = 60;
export const CRAWL_BUDGET_MS = 45_000;
/** Attente maximale de PageSpeed après l'exploration, avant l'audit SEO. */
export const PERF_WAIT_MS = 3_000;

/* ------------------------------------------------------------------ */
/* File d'événements → AsyncIterable                                   */
/* ------------------------------------------------------------------ */

class Channel<T> implements AsyncIterable<T> {
  private items: T[] = [];
  private waiters: ((r: IteratorResult<T>) => void)[] = [];
  private closed = false;
  push(v: T) {
    if (this.closed) return;
    const w = this.waiters.shift();
    if (w) w({ value: v, done: false });
    else this.items.push(v);
  }
  close() {
    this.closed = true;
    for (const w of this.waiters.splice(0)) w({ value: undefined as never, done: true });
  }
  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.items.length) return Promise.resolve({ value: this.items.shift() as T, done: false });
        if (this.closed) return Promise.resolve({ value: undefined as never, done: true });
        return new Promise((r) => this.waiters.push(r));
      },
      return: () => {
        this.close();
        return Promise.resolve({ value: undefined as never, done: true });
      },
    };
  }
}

class TimeoutError extends Error {
  constructor() {
    super('délai dépassé');
  }
}

/** Exécute `fn` avec un délai et un signal d'annulation lié au signal parent. */
async function bounded<T>(ms: number, parent: AbortSignal, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  parent.addEventListener('abort', onAbort);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      fn(ac.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ac.abort();
          reject(new TimeoutError());
        }, Math.max(1, ms));
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    parent.removeEventListener('abort', onAbort);
  }
}

export function summarizeCrawl(c: SiteCrawl): CrawlSummary {
  return {
    startUrl: c.startUrl,
    finalOrigin: c.finalOrigin,
    pagesFetched: c.pages.length,
    pagesIndexable: c.pages.filter((p) => p.isIndexable).length,
    sitemapUrls: c.sitemapUrls.length,
    robotsFound: !!c.robots && c.robots.status >= 200 && c.robots.status < 300,
    durationMs: c.durationMs,
    truncated: c.truncated,
    errors: c.errors.length,
  };
}

const SEV_ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 } as const;
const LABEL: Record<ModuleId, string> = {
  detect: 'Lecture de la page d’accueil',
  crawl: 'Exploration du site',
  seo: 'Audit SEO (Google)',
  geo: 'Audit GEO (IA)',
  data: 'Vitesse mobile (PageSpeed)',
  ai: 'Contrôle rapide auprès des IA',
};

function errMsg(e: unknown): string {
  if (e instanceof TimeoutError) return 'délai dépassé';
  if (e instanceof SafeFetchError) return e.message || e.code;
  return e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200);
}

/** Domaine canonique (clé de cache / limite de débit) : hôte sans www, en minuscules. */
export function analysisDomain(url: string): string {
  return normalizeInputUrl(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function runFullAnalysis(input: AnalysisInput, opts: RunAnalysisOptions = {}): AsyncIterable<AnalysisEvent> {
  const ch = new Channel<AnalysisEvent>();
  void orchestrate(input, opts, ch).finally(() => ch.close());
  return ch;
}

async function orchestrate(input: AnalysisInput, opts: RunAnalysisOptions, ch: Channel<AnalysisEvent>): Promise<void> {
  const t0 = Date.now();
  let seq = 0;
  const emit = (e: AnalysisEventBody) => ch.push({ ...e, seq: ++seq, t: Date.now() - t0 } as AnalysisEvent);
  const budgetMs = opts.budgetMs ?? DEFAULT_BUDGET_MS;
  const deadline = t0 + budgetMs;
  const left = (reserve = 0) => Math.max(1, deadline - Date.now() - reserve);
  const root = new AbortController();
  opts.signal?.addEventListener('abort', () => root.abort());
  const mods = resolveModules(opts.modules);
  const id = opts.id ?? `an_${crypto.randomBytes(12).toString('base64url')}`;
  const status = {} as FullAnalysis['modules'];
  const setStatus = (m: ModuleId, s: ModuleStatus, ms: number, error?: string) => {
    status[m] = { status: s, ms, ...(error ? { error } : {}), ...(mods.provisional?.[m] ? { provisional: true } : {}) };
    emit({ type: 'step', step: m, status: s, label: LABEL[m], ms, ...(error ? { error } : {}) });
  };

  let startUrl: string;
  try {
    startUrl = normalizeInputUrl(input.url).toString();
  } catch (e) {
    emit({ type: 'error', message: e instanceof SafeFetchError ? e.message : 'Adresse de site invalide.' });
    return;
  }
  emit({ type: 'start', id, url: startUrl, budgetMs });

  // ---- 1. Page d'accueil + détection ----
  emit({ type: 'step', step: 'detect', status: 'running', label: LABEL.detect });
  const tm = Date.now();
  let home: { finalUrl: string; html: string } | null = null;
  try {
    home = await bounded(Math.min(10_000, Math.max(2_000, left() * 0.25)), root.signal, async () => {
      if (opts.fetchHome) return opts.fetchHome(startUrl);
      const r = await safeFetch(startUrl, { timeoutMs: 8_000, maxBytes: 1_500_000, accept: 'text/html' });
      return r.status < 400 && /html/i.test(r.contentType || 'text/html') ? { finalUrl: r.finalUrl, html: r.body } : null;
    });
  } catch (e) {
    // Adresse refusée (réseau interne, port, schéma…) : on s'arrête là, rien n'est exploré.
    if (e instanceof SafeFetchError && (e.code.startsWith('blocked') || e.code === 'invalid_url')) {
      setStatus('detect', 'failed', Date.now() - tm, e.message);
      emit({ type: 'error', message: e.message || 'Cette adresse ne peut pas être analysée.' });
      return;
    }
    home = null;
  }
  const detected: Detection = detectSite(input, home?.html ?? null, home?.finalUrl);
  setStatus('detect', home ? 'ok' : 'failed', Date.now() - tm, home ? undefined : 'page d’accueil injoignable');
  emit({ type: 'detected', detection: detected });
  if (home) {
    // Premiers constats immédiats (page d'accueil seule), avant la fin de l'exploration.
    const sig = homeSignals(home.html);
    if (!sig.page.title) emit({ type: 'finding', source: 'seo', id: 'seo.title.missing', title: 'La page d’accueil n’a pas de titre', severity: 'high' });
    if (!sig.page.metaDescription) emit({ type: 'finding', source: 'seo', id: 'seo.meta.missing', title: 'La page d’accueil n’a pas de meta description', severity: 'medium' });
    if (!sig.nodes.length) emit({ type: 'finding', source: 'geo', id: 'geo.entity.missing', title: 'Aucune donnée structurée (JSON-LD) sur la page d’accueil', severity: 'high' });
  }
  const ctx = { brand: detected.brand, siteType: detected.siteType, city: detected.city, ...(detected.activity ? { activity: detected.activity } : {}) };

  // ---- 2. En parallèle : exploration → SEO + GEO ; PageSpeed ; IA ----
  // Porteur unique (évite le rétrécissement de type des variables affectées dans les branches asynchrones).
  const out: { crawl: SiteCrawl | null; seo: ModuleReport | null; geo: ModuleReport | null; data?: DataSummary; ai?: AiCheckSummary; perf?: SeoDataPerfData } = {
    crawl: null,
    seo: null,
    geo: null,
  };

  const dataBranch = (async () => {
    const ts = Date.now();
    try {
      const ps = await bounded(Math.min(30_000, left(4_000)), root.signal, (signal) => mods.pagespeed(home?.finalUrl ?? startUrl, signal));
      if (ps) {
        // La mesure brute (PerfData) part vers l'audit SEO ; seul le résumé est gardé dans l'analyse.
        const { perf, ...summary } = ps as PagespeedResult;
        if (perf) out.perf = perf;
        out.data = { pagespeed: summary };
        setStatus('data', 'ok', Date.now() - ts);
      } else {
        out.data = { pagespeed: null, note: 'Mesure de vitesse non disponible : le fournisseur PageSpeed n’est pas configuré. Aucune valeur n’est estimée.' };
        setStatus('data', 'skipped', Date.now() - ts, 'non configuré');
      }
    } catch (e) {
      out.data = { pagespeed: null, note: 'La mesure PageSpeed n’a pas abouti.' };
      setStatus('data', e instanceof TimeoutError ? 'timeout' : 'failed', Date.now() - ts, errMsg(e));
    }
  })();

  const crawlBranch = (async () => {
    emit({ type: 'step', step: 'crawl', status: 'running', label: LABEL.crawl });
    const crawlStart = Date.now();
    let lastEmit = 0;
    let lastPhase = '';
    const seenUrls = new Set<string>();
    const pendingUrls: string[] = [];
    const crawlBudget = Math.min(opts.crawlBudgetMs ?? CRAWL_BUDGET_MS, left(6_000));
    try {
      const crawl = await bounded(crawlBudget + 4_000, root.signal, (signal) =>
        mods.crawl(home?.finalUrl ?? startUrl, {
          maxPages: opts.maxPages ?? CRAWL_MAX_PAGES,
          timeBudgetMs: crawlBudget,
          signal,
          onProgress: (p) => {
            const now = Date.now();
            // Toutes les pages lues entre deux événements (la carte en direct ne voyait qu'un échantillon).
            if (p.currentUrl && p.phase === 'pages' && seenUrls.size < 2_000 && !seenUrls.has(p.currentUrl)) {
              seenUrls.add(p.currentUrl);
              pendingUrls.push(p.currentUrl);
            }
            if (p.phase !== lastPhase || now - lastEmit >= 150 || p.phase === 'done') {
              lastEmit = now;
              lastPhase = p.phase;
              const urls = pendingUrls.splice(0, pendingUrls.length).slice(-20);
              emit({
                type: 'crawl',
                phase: p.phase,
                fetched: p.fetched,
                queued: p.queued,
                ...(p.currentUrl ? { currentUrl: p.currentUrl } : {}),
                ...(urls.length ? { urls } : {}),
              });
            }
          },
        }),
      );
      out.crawl = crawl;
      setStatus('crawl', crawl.pages.length ? 'ok' : 'failed', Date.now() - crawlStart, crawl.pages.length ? undefined : 'aucune page récupérée');
    } catch (e) {
      setStatus('crawl', e instanceof TimeoutError ? 'timeout' : 'failed', Date.now() - crawlStart, errMsg(e));
    }
    const c = out.crawl;
    for (const m of ['seo', 'geo'] as const) {
      if (!c || !c.pages.length) {
        setStatus(m, 'skipped', 0, 'exploration indisponible');
        continue;
      }
      if (m === 'seo' && !out.data) {
        // PageSpeed presque fini ? On l'attend brièvement pour nourrir les contrôles de performance.
        await Promise.race([dataBranch, new Promise((r) => setTimeout(r, Math.min(PERF_WAIT_MS, left(2_000))))]);
      }
      emit({ type: 'step', step: m, status: 'running', label: LABEL[m] });
      const ts = Date.now();
      try {
        // Crawl COMPLET (HTML compris) : les audits doivent tourner AVANT tout publicCrawl().
        const r = await bounded(left(1_000), root.signal, async () =>
          m === 'seo' ? mods.seo(c, { siteType: detected.siteType, ...(out.perf ? { perf: out.perf } : {}) }) : mods.geo(c, ctx),
        );
        out[m] = r;
        const top = [...(r.topFixes ?? [])].sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]).slice(0, 3);
        for (const f of top) emit({ type: 'finding', source: m, id: f.id, title: f.title, severity: f.severity });
        emit({ type: 'score', module: m, score: Math.round(r.score) });
        setStatus(m, 'ok', Date.now() - ts);
      } catch (e) {
        setStatus(m, e instanceof TimeoutError ? 'timeout' : 'failed', Date.now() - ts, errMsg(e));
      }
    }
  })();

  const aiBranch = (async () => {
    emit({ type: 'step', step: 'ai', status: 'running', label: LABEL.ai });
    const ts = Date.now();
    try {
      const r = await bounded(left(3_000), root.signal, (signal) =>
        mods.aiCheck({
          url: home?.finalUrl ?? startUrl,
          brand: detected.brand,
          siteType: detected.siteType,
          city: detected.city,
          activity: detected.activity,
          maxCalls: opts.maxAiCalls ?? maxAiCallsFromEnv(),
          signal,
          onProgress: (done, total, provider) => emit({ type: 'ai', done, total, ...(provider ? { provider } : {}) }),
        }),
      );
      if (r) {
        out.ai = r;
        emit({ type: 'score', module: 'ai', score: r.score });
        const cited = r.questions.filter((q) => q.mentioned > 0).length;
        emit({
          type: 'finding',
          source: 'ai',
          id: 'ai.quick.mentions',
          title: r.demo
            ? 'Démonstration : aucune IA configurée, réponses simulées'
            : `${detected.brand} est cité sur ${cited} question(s) sur ${r.questions.length}`,
          severity: r.demo ? 'info' : cited === 0 ? 'high' : cited < r.questions.length / 2 ? 'medium' : 'low',
        });
        setStatus('ai', 'ok', Date.now() - ts);
      } else setStatus('ai', 'skipped', Date.now() - ts, 'activité non couverte ou plafond d’appels nul');
    } catch (e) {
      setStatus('ai', e instanceof TimeoutError ? 'timeout' : 'failed', Date.now() - ts, errMsg(e));
    }
  })();

  await Promise.all([crawlBranch, dataBranch, aiBranch]);
  root.abort(); // plus aucun appel (payant ou non) après l'assemblage

  // ---- 3. Synthèse ----
  const { seo, geo, data, ai } = out;
  const scores = computeScores(seo, geo, ai);
  const priorities = mergePriorities(seo, geo, 5);
  const partial = Object.values(status).some((s) => s.status === 'failed' || s.status === 'timeout');
  const c = out.crawl;
  const base: FullAnalysis = {
    id,
    version: 1,
    input: { url: startUrl, ...(input.brand ? { brand: input.brand } : {}), ...(input.siteType ? { siteType: input.siteType } : {}), ...(input.city ? { city: input.city } : {}) },
    detected,
    createdAt: new Date(t0).toISOString(),
    durationMs: Date.now() - t0,
    crawl: c ? summarizeCrawl(c) : null,
    seo,
    geo,
    ...(data ? { data } : {}),
    ...(ai ? { ai } : {}),
    verdict: '',
    scores,
    priorities,
    autoFixes: autoFixesOf(seo, geo),
    modules: status,
    partial,
    demo: !!ai?.demo,
  };
  base.verdict = buildVerdict(base);
  if (opts.previous) {
    base.previousId = opts.previous.id;
    base.comparison = compareAnalyses(opts.previous, base);
  }
  emit({ type: 'result', analysis: base });
}

/** Consomme le flux et renvoie l'analyse finale (ou null si erreur). Pratique pour les tâches de fond et les tests. */
export async function collectAnalysis(it: AsyncIterable<AnalysisEvent>, onEvent?: (e: AnalysisEvent) => void): Promise<FullAnalysis | null> {
  let out: FullAnalysis | null = null;
  for await (const e of it) {
    onEvent?.(e);
    if (e.type === 'result') out = e.analysis;
  }
  return out;
}
