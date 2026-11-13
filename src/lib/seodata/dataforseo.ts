/**
 * DataForSEO (paiement à l'appel) : volumes Google Ads, positions Google (SERP), Labs (mots-clés positionnés,
 * concurrents, difficulté) et liens entrants. Authentification HTTP Basic (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD).
 * Chaque appel passe par un compteur (`Meter`) : réservation sur le plafond mensuel du compte AVANT l'appel, puis
 * ajustement au coût réel renvoyé (`cost`). Tarifs et sources : docs/v5/donnees-seo.md.
 */
import { SeoDataError, endpoints, env, hostOf, requestJson } from './http';
import { PRICES_USD, backlinksCostUsd, labsCostUsd, serpCostUsd } from './limits';
import type {
  BacklinksProvider, BacklinksSummary, Device, KeywordLocation, KeywordMetrics, KeywordsProvider, SerpOrganic, SerpProvider, SerpRequest, SerpResult,
} from './types';

export const FRANCE = { code: 2250, language: 'fr' } as const;

/** Réserve `estimateUsd` pour `op` ; renvoie la fonction d'ajustement au coût réel. Lève SeoDataError('budget'). */
export type Meter = (op: string, estimateUsd: number) => Promise<(actualUsd?: number | null) => Promise<void>>;

export const dataForSeoConfigured = () => Boolean(env('DATAFORSEO_LOGIN') && env('DATAFORSEO_PASSWORD'));

interface DfsTask<R> { id?: string; status_code?: number; status_message?: string; cost?: number; result?: R[] | null; data?: Record<string, unknown> }
interface DfsEnvelope<R> { status_code?: number; status_message?: string; cost?: number; tasks?: DfsTask<R>[] }

/** Codes d'état DataForSEO → erreurs typées (https://docs.dataforseo.com/v3/appendix/errors/). */
export function dfsError(code: number | undefined, message: string | undefined): SeoDataError | null {
  if (code === undefined || code === 20000 || code === 20100) return null;
  const msg = `DataForSEO : ${message ?? `code ${code}`}`;
  if (code === 40100 || code === 40101 || code === 40104) return new SeoDataError('auth', msg);
  if (code >= 40200 && code < 40300) {
    if (code === 40202) return new SeoDataError('quota', msg); // trop de requêtes par minute
    return new SeoDataError('budget', `${msg} (crédit DataForSEO de la plateforme insuffisant)`);
  }
  if (code === 40102) return new SeoDataError('not_found', msg); // aucun résultat
  if (code === 40601 || code === 40602) return new SeoDataError('upstream', msg); // tâche pas encore prête
  if (code >= 50000) return new SeoDataError('upstream', msg);
  return new SeoDataError('bad_request', msg);
}

function locFields(loc: KeywordLocation): Record<string, unknown> {
  return { ...(loc.code ? { location_code: loc.code } : loc.name ? { location_name: loc.name } : { location_code: FRANCE.code }), language_code: loc.language || FRANCE.language };
}

export class DataForSeoClient {
  readonly name = 'dataforseo';
  readonly demo = false;
  private auth: string;
  constructor(private meter?: Meter, creds = { login: env('DATAFORSEO_LOGIN'), password: env('DATAFORSEO_PASSWORD') }) {
    if (!creds.login || !creds.password) throw new SeoDataError('not_configured', 'DataForSEO non configuré : ajoutez DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD.');
    this.auth = `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString('base64')}`;
  }

  /** Un appel « une tâche » : POST [task] → tasks[0]. */
  async post<R>(path: string, task: Record<string, unknown> | Record<string, unknown>[], op: string, estimateUsd: number): Promise<DfsTask<R>[]> {
    const settle = this.meter ? await this.meter(op, estimateUsd) : null;
    let env_: DfsEnvelope<R>;
    try {
      env_ = await requestJson<DfsEnvelope<R>>(`${endpoints().dataforseo}${path}`, { provider: 'DataForSEO', headers: { authorization: this.auth }, json: Array.isArray(task) ? task : [task] });
    } catch (e) {
      // Appel refusé avant facturation (réseau, 401, 5xx) : la réservation est rendue.
      if (settle) await settle(0);
      throw e;
    }
    const top = dfsError(env_.status_code, env_.status_message);
    if (settle) await settle(typeof env_.cost === 'number' ? env_.cost : top ? 0 : null);
    if (top) throw top;
    return env_.tasks ?? [];
  }

  async get<R>(path: string): Promise<DfsTask<R>[]> {
    const e = await requestJson<DfsEnvelope<R>>(`${endpoints().dataforseo}${path}`, { provider: 'DataForSEO', headers: { authorization: this.auth } });
    const top = dfsError(e.status_code, e.status_message);
    if (top) throw top;
    return e.tasks ?? [];
  }

  static first<R>(tasks: DfsTask<R>[]): R | null {
    const t = tasks[0];
    if (!t) throw new SeoDataError('upstream', 'DataForSEO : réponse vide.');
    const err = dfsError(t.status_code, t.status_message);
    if (err) {
      if (err.code === 'not_found') return null;
      throw err;
    }
    return t.result?.[0] ?? null;
  }
}

// ---------------------------------------------------------------------------
// Mots-clés
// ---------------------------------------------------------------------------

interface AdsVolume { keyword: string; search_volume: number | null; competition: string | null; cpc: number | null; monthly_searches?: { year: number; month: number; search_volume: number }[] | null }

export class DataForSeoKeywords implements KeywordsProvider {
  readonly name = 'dataforseo';
  readonly demo = false;
  constructor(private c: DataForSeoClient, private usdToEur = 0.92) {}

  async volumes(keywords: string[], loc: KeywordLocation): Promise<KeywordMetrics[]> {
    const clean = [...new Set(keywords.map((k) => k.trim().toLowerCase()).filter((k) => k && k.length <= 80 && k.split(/\s+/).length <= 10))];
    const out: KeywordMetrics[] = [];
    for (let i = 0; i < clean.length; i += 1000) {
      const batch = clean.slice(i, i + 1000);
      const tasks = await this.c.post<AdsVolume>('/keywords_data/google_ads/search_volume/live', { keywords: batch, ...locFields(loc) }, 'keywords.volume', PRICES_USD.keywordsTaskLive);
      const t = tasks[0];
      const err = t ? dfsError(t.status_code, t.status_message) : null;
      if (err && err.code !== 'not_found') throw err;
      const rows = (t?.result ?? []) as AdsVolume[];
      const by = new Map(rows.map((r) => [r.keyword.toLowerCase(), r]));
      for (const k of batch) {
        const r = by.get(k);
        out.push({
          keyword: k,
          volume: r?.search_volume ?? null,
          cpcEur: typeof r?.cpc === 'number' ? Math.round(r.cpc * this.usdToEur * 100) / 100 : null,
          competition: r?.competition === 'LOW' || r?.competition === 'MEDIUM' || r?.competition === 'HIGH' ? r.competition : null,
          trend: (r?.monthly_searches ?? []).map((m) => ({ month: `${m.year}-${String(m.month).padStart(2, '0')}`, volume: m.search_volume })).sort((a, b) => a.month.localeCompare(b.month)),
        });
      }
    }
    return out;
  }

  async difficulty(keywords: string[], loc: KeywordLocation): Promise<Record<string, number | null>> {
    const out: Record<string, number | null> = {};
    for (let i = 0; i < keywords.length; i += 1000) {
      const batch = keywords.slice(i, i + 1000);
      const r = DataForSeoClient.first<{ items?: { keyword: string; keyword_difficulty: number | null }[] }>(
        await this.c.post('/dataforseo_labs/google/bulk_keyword_difficulty/live', { keywords: batch, ...locFields(loc) }, 'labs.difficulty', labsCostUsd(batch.length)),
      );
      for (const k of batch) out[k] = null;
      for (const it of r?.items ?? []) out[it.keyword] = it.keyword_difficulty ?? null;
    }
    return out;
  }

  async rankedKeywords(domain: string, loc: KeywordLocation, limit: number) {
    type Item = {
      keyword_data?: { keyword?: string; keyword_info?: { search_volume?: number | null }; keyword_properties?: { keyword_difficulty?: number | null } };
      keyword_properties?: { keyword_difficulty?: number | null };
      ranked_serp_element?: { serp_item?: { rank_group?: number; url?: string; type?: string } };
    };
    const n = Math.min(1000, Math.max(1, limit));
    const r = DataForSeoClient.first<{ items?: Item[] }>(
      await this.c.post('/dataforseo_labs/google/ranked_keywords/live', { target: hostOf(domain), ...locFields(loc), limit: n, order_by: ['keyword_data.keyword_info.search_volume,desc'] }, 'labs.ranked', labsCostUsd(n)),
    );
    return (r?.items ?? [])
      .filter((it) => it.keyword_data?.keyword && it.ranked_serp_element?.serp_item?.rank_group)
      .map((it) => ({
        keyword: String(it.keyword_data!.keyword),
        position: Number(it.ranked_serp_element!.serp_item!.rank_group),
        url: String(it.ranked_serp_element!.serp_item!.url ?? ''),
        volume: it.keyword_data?.keyword_info?.search_volume ?? null,
        difficulty: it.keyword_data?.keyword_properties?.keyword_difficulty ?? it.keyword_properties?.keyword_difficulty ?? null,
      }));
  }

  async competitors(domain: string, loc: KeywordLocation, limit: number) {
    const n = Math.min(100, Math.max(1, limit));
    const r = DataForSeoClient.first<{ items?: { domain: string; avg_position?: number | null; intersections?: number }[] }>(
      await this.c.post('/dataforseo_labs/google/competitors_domain/live', { target: hostOf(domain), ...locFields(loc), limit: n + 1 }, 'labs.competitors', labsCostUsd(n + 1)),
    );
    return (r?.items ?? [])
      .filter((it) => hostOf(it.domain) !== hostOf(domain))
      .slice(0, n)
      .map((it) => ({ domain: it.domain, commonKeywords: it.intersections ?? 0, avgPosition: typeof it.avg_position === 'number' ? Math.round(it.avg_position * 10) / 10 : null }));
  }
}

// ---------------------------------------------------------------------------
// SERP
// ---------------------------------------------------------------------------

interface DfsSerpItem {
  type: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
  title?: string;
  references?: { domain?: string; url?: string }[] | null;
  items?: DfsSerpItem[] | null;
}
interface DfsSerpResult { keyword: string; check_url?: string; datetime?: string; item_types?: string[]; items?: DfsSerpItem[] | null }

/** « 2026-11-10 08:31:12 +00:00 » → ISO ; date du jour si illisible. */
export function dfsDate(v?: string): string {
  const t = v ? Date.parse(v.replace(/ \+00:00$/, 'Z').replace(' ', 'T')) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : new Date().toISOString();
}

/** Analyse d'une SERP DataForSEO (pure, testée sur réponses enregistrées). */
export function parseSerp(r: DfsSerpResult, req: SerpRequest, costUsd?: number): SerpResult {
  const items = r.items ?? [];
  const organic: SerpOrganic[] = items
    .filter((i) => i.type === 'organic' && typeof i.rank_group === 'number' && i.url)
    .map((i) => ({ position: i.rank_group!, domain: hostOf(i.domain || i.url!), url: i.url!, ...(i.title ? { title: i.title } : {}) }))
    .sort((a, b) => a.position - b.position);
  const features = [...new Set((r.item_types ?? items.map((i) => i.type)).filter((t) => t !== 'organic'))];
  const aio = items.find((i) => i.type === 'ai_overview');
  const refs = [...(aio?.references ?? []), ...(aio?.items ?? []).flatMap((x) => x.references ?? [])];
  return {
    keyword: req.keyword,
    device: req.device,
    checkedAt: dfsDate(r.datetime),
    features,
    // Aperçu IA : connu seulement si on l'a demandé (chargement asynchrone) ou s'il apparaît dans la SERP.
    aiOverview: aio || features.includes('ai_overview') ? true : req.aiOverview ? false : null,
    aiOverviewDomains: [...new Set(refs.map((x) => hostOf(x.domain || x.url || '')).filter(Boolean))],
    organic,
    ...(r.check_url ? { checkUrl: r.check_url } : {}),
    ...(costUsd !== undefined ? { costUsd } : {}),
  };
}

function serpTask(req: SerpRequest, tag?: string): Record<string, unknown> {
  return {
    keyword: req.keyword,
    ...locFields(req.location),
    device: req.device,
    os: req.device === 'mobile' ? 'android' : 'windows',
    depth: req.depth,
    ...(req.aiOverview ? { load_async_ai_overview: true } : {}),
    ...(tag ? { tag } : {}),
  };
}

export class DataForSeoSerp implements SerpProvider {
  readonly name = 'dataforseo';
  readonly demo = false;
  constructor(private c: DataForSeoClient) {}

  async live(req: SerpRequest): Promise<SerpResult> {
    const tasks = await this.c.post<DfsSerpResult>('/serp/google/organic/live/advanced', serpTask(req), 'serp.live', serpCostUsd(req.depth, req.aiOverview, 'live'));
    const r = DataForSeoClient.first(tasks);
    return parseSerp(r ?? { keyword: req.keyword, items: [] }, req, tasks[0]?.cost);
  }

  /** File standard (0,0006 $ la page) : jusqu'à 100 tâches par appel. */
  async submit(reqs: SerpRequest[]): Promise<{ taskId: string; req: SerpRequest }[]> {
    const out: { taskId: string; req: SerpRequest }[] = [];
    for (let i = 0; i < reqs.length; i += 100) {
      const batch = reqs.slice(i, i + 100);
      const est = batch.reduce((s, r) => s + serpCostUsd(r.depth, r.aiOverview, 'standard'), 0);
      const tasks = await this.c.post('/serp/google/organic/task_post', batch.map((r, j) => serpTask(r, String(i + j))), 'serp.standard', est);
      tasks.forEach((t, j) => {
        const err = dfsError(t.status_code, t.status_message);
        if (!err && t.id) out.push({ taskId: t.id, req: batch[j] });
      });
    }
    return out;
  }

  /** null si la tâche n'est pas encore prête. */
  async collect(taskId: string, req: SerpRequest): Promise<SerpResult | null> {
    if (!/^[A-Za-z0-9-]{8,64}$/.test(taskId)) throw new SeoDataError('bad_request', 'Identifiant de tâche invalide.');
    const tasks = await this.c.get<DfsSerpResult>(`/serp/google/organic/task_get/advanced/${taskId}`);
    const t = tasks[0];
    if (!t) return null;
    if (t.status_code === 40601 || t.status_code === 40602) return null;
    const r = DataForSeoClient.first(tasks);
    return parseSerp(r ?? { keyword: req.keyword, items: [] }, req);
  }
}

// ---------------------------------------------------------------------------
// Liens entrants
// ---------------------------------------------------------------------------

export class DataForSeoBacklinks implements BacklinksProvider {
  readonly name = 'dataforseo';
  readonly demo = false;
  constructor(private c: DataForSeoClient) {}

  async summary(target: string): Promise<BacklinksSummary> {
    const r = DataForSeoClient.first<Record<string, unknown>>(await this.c.post('/backlinks/summary/live', { target: hostOf(target), include_subdomains: true }, 'backlinks.summary', backlinksCostUsd(1)));
    return {
      target: hostOf(target),
      backlinks: Number(r?.backlinks ?? 0),
      referringDomains: Number(r?.referring_domains ?? 0),
      referringMainDomains: Number(r?.referring_main_domains ?? 0),
      rank: typeof r?.rank === 'number' ? r.rank : null,
      brokenBacklinks: Number(r?.broken_backlinks ?? 0),
    };
  }

  async referringDomains(target: string, limit: number) {
    const n = Math.min(1000, Math.max(1, limit));
    const r = DataForSeoClient.first<{ items?: { domain: string; backlinks?: number; rank?: number; first_seen?: string | null }[] }>(
      await this.c.post('/backlinks/referring_domains/live', { target: hostOf(target), limit: n, order_by: ['rank,desc'] }, 'backlinks.domains', backlinksCostUsd(n)),
    );
    return (r?.items ?? []).map((i) => ({ domain: i.domain, backlinks: i.backlinks ?? 0, rank: i.rank ?? null, firstSeen: i.first_seen ?? null }));
  }

  async anchors(target: string, limit: number) {
    const n = Math.min(1000, Math.max(1, limit));
    const r = DataForSeoClient.first<{ items?: { anchor: string; backlinks?: number; referring_domains?: number }[] }>(
      await this.c.post('/backlinks/anchors/live', { target: hostOf(target), limit: n, order_by: ['backlinks,desc'] }, 'backlinks.anchors', backlinksCostUsd(n)),
    );
    return (r?.items ?? []).map((i) => ({ anchor: i.anchor ?? '', backlinks: i.backlinks ?? 0, referringDomains: i.referring_domains ?? 0 }));
  }

  async newLost(target: string, from: string) {
    const r = DataForSeoClient.first<{ items?: { date: string; new_backlinks?: number; lost_backlinks?: number; new_referring_domains?: number; lost_referring_domains?: number }[] }>(
      await this.c.post('/backlinks/timeseries_new_lost_summary/live', { target: hostOf(target), date_from: from, group_range: 'month' }, 'backlinks.newlost', backlinksCostUsd(12)),
    );
    return (r?.items ?? []).map((i) => ({
      date: String(i.date).slice(0, 10),
      newBacklinks: i.new_backlinks ?? 0,
      lostBacklinks: i.lost_backlinks ?? 0,
      newDomains: i.new_referring_domains ?? 0,
      lostDomains: i.lost_referring_domains ?? 0,
    }));
  }
}

export type { Device };
