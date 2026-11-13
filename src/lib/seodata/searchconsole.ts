/**
 * Search Console : client API (searchanalytics.query paginé, sitemaps, URL Inspection), import des 16 mois et
 * synchronisation quotidienne. Données stockées par compte :
 *  - `seodata.gsc.daily`  (id = businessId)            : totaux par jour sur 16 mois ;
 *  - `seodata.gsc.month`  (id = businessId:AAAA-MM)    : top requêtes et pages du mois ;
 *  - `seodata.gsc.recent` (id = businessId)            : 28 derniers jours et 28 précédents (requêtes, pages, appareils,
 *    pays, requête × page pour les suggestions), sitemaps.
 * Dates Search Console : heure du Pacifique ; les 2–3 derniers jours peuvent manquer (données « final »).
 */
import { deleteDoc, getDoc, listDocs, putDoc } from '@/lib/store';
import { accessToken, getConnection, saveConnection } from './google-oauth';
import { SeoDataError, addDays, day, endpoints, requestJson } from './http';
import type { GscInspection, GscQuery, GscRow, GscSitemap, GscSite, SearchConsoleProvider } from './types';

export const DAILY = 'seodata.gsc.daily';
export const MONTH = 'seodata.gsc.month';
export const RECENT = 'seodata.gsc.recent';
export const INSPECT = 'seodata.gsc.inspect';
export const MAX_ROWS_PER_CALL = 25_000;
export const HISTORY_MONTHS = 16;
const TOP_PER_MONTH = 250;

// ---------------------------------------------------------------------------
// Client API
// ---------------------------------------------------------------------------

export class GoogleSearchConsole implements SearchConsoleProvider {
  readonly name = 'google-search-console';
  readonly demo = false;
  constructor(private token: () => Promise<string>) {}

  private async call<T>(url: string, json?: unknown): Promise<T> {
    const t = await this.token();
    return requestJson<T>(url, { provider: 'Search Console', headers: { authorization: `Bearer ${t}` }, ...(json !== undefined ? { json } : {}) });
  }

  async listSites(): Promise<GscSite[]> {
    const r = await this.call<{ siteEntry?: GscSite[] }>(`${endpoints().webmasters}/sites`);
    return (r.siteEntry ?? []).map((s) => ({ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel }));
  }

  async query(siteUrl: string, q: GscQuery, maxRows = MAX_ROWS_PER_CALL): Promise<GscRow[]> {
    const out: GscRow[] = [];
    let startRow = q.startRow ?? 0;
    const pageSize = Math.min(MAX_ROWS_PER_CALL, q.rowLimit ?? MAX_ROWS_PER_CALL, maxRows);
    for (let guard = 0; guard < 40; guard++) {
      const body: Record<string, unknown> = {
        startDate: q.startDate,
        endDate: q.endDate,
        dimensions: q.dimensions ?? [],
        type: q.type ?? 'web',
        dataState: q.dataState ?? 'final',
        rowLimit: Math.min(pageSize, maxRows - out.length),
        startRow,
      };
      if (q.filters?.length) body.dimensionFilterGroups = [{ groupType: 'and', filters: q.filters.map((f) => ({ dimension: f.dimension, operator: f.operator ?? 'equals', expression: f.expression })) }];
      const r = await this.call<{ rows?: GscRow[] }>(`${endpoints().webmasters}/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`, body);
      const rows = (r.rows ?? []).map((x) => ({ keys: x.keys ?? [], clicks: x.clicks ?? 0, impressions: x.impressions ?? 0, ctr: x.ctr ?? 0, position: x.position ?? 0 }));
      out.push(...rows);
      if (rows.length < (body.rowLimit as number) || out.length >= maxRows) break;
      startRow += rows.length;
    }
    return out;
  }

  async sitemaps(siteUrl: string): Promise<GscSitemap[]> {
    const r = await this.call<{ sitemap?: Record<string, unknown>[] }>(`${endpoints().webmasters}/sites/${encodeURIComponent(siteUrl)}/sitemaps`);
    return (r.sitemap ?? []).map((s) => ({
      path: String(s.path ?? ''),
      lastSubmitted: s.lastSubmitted as string | undefined,
      lastDownloaded: s.lastDownloaded as string | undefined,
      isPending: Boolean(s.isPending),
      isSitemapsIndex: Boolean(s.isSitemapsIndex),
      warnings: Number(s.warnings ?? 0),
      errors: Number(s.errors ?? 0),
      contents: ((s.contents as Record<string, unknown>[]) ?? []).map((c) => ({ type: String(c.type ?? ''), submitted: Number(c.submitted ?? 0), indexed: c.indexed === undefined ? null : Number(c.indexed) })),
    }));
  }

  async inspect(siteUrl: string, url: string): Promise<GscInspection> {
    const r = await this.call<{ inspectionResult?: { inspectionResultLink?: string; indexStatusResult?: Record<string, unknown> } }>(
      `${endpoints().searchconsole}/urlInspection/index:inspect`,
      { inspectionUrl: url, siteUrl, languageCode: 'fr' },
    );
    const s = r.inspectionResult?.indexStatusResult ?? {};
    return {
      url,
      verdict: String(s.verdict ?? 'VERDICT_UNSPECIFIED'),
      coverageState: s.coverageState as string | undefined,
      indexingState: s.indexingState as string | undefined,
      robotsTxtState: s.robotsTxtState as string | undefined,
      pageFetchState: s.pageFetchState as string | undefined,
      lastCrawlTime: s.lastCrawlTime as string | undefined,
      googleCanonical: s.googleCanonical as string | undefined,
      userCanonical: s.userCanonical as string | undefined,
      crawledAs: s.crawledAs as string | undefined,
      link: r.inspectionResult?.inspectionResultLink,
    };
  }
}

/** Client pour un compte connecté (jetons rafraîchis à la demande). */
export function searchConsoleFor(businessId: string): GoogleSearchConsole {
  return new GoogleSearchConsole(() => accessToken(businessId));
}

/** Liste des propriétés avec un jeton d'accès brut (retour OAuth). */
export function listSitesWithToken(token: string): Promise<GscSite[]> {
  return new GoogleSearchConsole(async () => token).listSites();
}

// ---------------------------------------------------------------------------
// Données agrégées
// ---------------------------------------------------------------------------

export interface DayRow { date: string; clicks: number; impressions: number; ctr: number; position: number }
export interface TopRow { key: string; clicks: number; impressions: number; ctr: number; position: number }

export interface GscDaily { businessId: string; siteUrl: string; days: DayRow[]; updatedAt: string }
export interface GscMonth { businessId: string; siteUrl: string; month: string; queries: TopRow[]; pages: TopRow[]; updatedAt: string }
export interface GscRecent {
  businessId: string;
  siteUrl: string;
  range: { start: string; end: string };
  prevRange: { start: string; end: string };
  queries: TopRow[];
  prevQueries: TopRow[];
  pages: TopRow[];
  devices: TopRow[];
  countries: TopRow[];
  /** requête × page (28 jours) pour les suggestions et la cannibalisation */
  queryPages: { query: string; page: string; clicks: number; impressions: number; position: number }[];
  sitemaps: GscSitemap[];
  updatedAt: string;
}

const r4 = (n: number) => Math.round(n * 10_000) / 10_000;
const toTop = (rows: GscRow[]): TopRow[] => rows.map((r) => ({ key: r.keys[0] ?? '', clicks: r.clicks, impressions: r.impressions, ctr: r4(r.ctr), position: Math.round(r.position * 10) / 10 }));

/** Dernier jour complet probable (données « final ») : J-2. */
export const lastFullDay = (now: Date) => addDays(now, -2);

function monthsBack(now: Date, n: number): { month: string; start: string; end: string }[] {
  const out: { month: string; start: string; end: string }[] = [];
  const last = lastFullDay(now);
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - i, 1));
    const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
    out.push({ month: day(s).slice(0, 7), start: day(s), end: day(e.getTime() > last.getTime() ? last : e) });
  }
  return out;
}

export interface CollectOptions {
  /** mois de top requêtes/pages à (re)charger, du plus ancien au plus récent */
  months: number;
  /** jours de totaux quotidiens à (re)charger */
  days: number;
}

/** Collecte brute (fournisseur réel ou démo) — pure vis-à-vis du stockage. */
export async function collect(p: SearchConsoleProvider, siteUrl: string, now: Date, o: CollectOptions): Promise<{ days: DayRow[]; months: Omit<GscMonth, 'businessId' | 'siteUrl' | 'updatedAt'>[]; recent: Omit<GscRecent, 'businessId' | 'siteUrl' | 'updatedAt'> }> {
  const end = lastFullDay(now);
  const dailyRows = await p.query(siteUrl, { startDate: day(addDays(end, -(o.days - 1))), endDate: day(end), dimensions: ['date'] }, 1000);
  const days = dailyRows.map((r) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r4(r.ctr), position: Math.round(r.position * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date));
  const months: Omit<GscMonth, 'businessId' | 'siteUrl' | 'updatedAt'>[] = [];
  for (const m of monthsBack(now, o.months)) {
    const [queries, pages] = await Promise.all([
      p.query(siteUrl, { startDate: m.start, endDate: m.end, dimensions: ['query'] }, TOP_PER_MONTH),
      p.query(siteUrl, { startDate: m.start, endDate: m.end, dimensions: ['page'] }, TOP_PER_MONTH),
    ]);
    months.push({ month: m.month, queries: toTop(queries), pages: toTop(pages) });
  }
  const range = { start: day(addDays(end, -27)), end: day(end) };
  const prevRange = { start: day(addDays(end, -55)), end: day(addDays(end, -28)) };
  const [queries, prevQueries, pages, devices, countries, qp, sitemaps] = await Promise.all([
    p.query(siteUrl, { startDate: range.start, endDate: range.end, dimensions: ['query'] }, 1000),
    p.query(siteUrl, { startDate: prevRange.start, endDate: prevRange.end, dimensions: ['query'] }, 1000),
    p.query(siteUrl, { startDate: range.start, endDate: range.end, dimensions: ['page'] }, 1000),
    p.query(siteUrl, { startDate: range.start, endDate: range.end, dimensions: ['device'] }, 10),
    p.query(siteUrl, { startDate: range.start, endDate: range.end, dimensions: ['country'] }, 30),
    p.query(siteUrl, { startDate: range.start, endDate: range.end, dimensions: ['query', 'page'] }, 2000),
    p.sitemaps(siteUrl).catch(() => [] as GscSitemap[]),
  ]);
  return {
    days,
    months,
    recent: {
      range,
      prevRange,
      queries: toTop(queries),
      prevQueries: toTop(prevQueries),
      pages: toTop(pages),
      devices: toTop(devices),
      countries: toTop(countries),
      queryPages: qp.map((r) => ({ query: r.keys[0] ?? '', page: r.keys[1] ?? '', clicks: r.clicks, impressions: r.impressions, position: Math.round(r.position * 10) / 10 })),
      sitemaps,
    },
  };
}

/**
 * Import (16 mois) ou synchronisation quotidienne (10 derniers jours + 2 derniers mois + 28 jours) d'un compte
 * connecté. Idempotent (réécrit les mêmes documents). Le fournisseur est injectable (tests).
 */
export async function syncSearchConsole(businessId: string, mode: 'import' | 'daily', now = new Date(), provider?: SearchConsoleProvider): Promise<{ siteUrl: string; days: number; months: number }> {
  const c = await getConnection(businessId);
  if (!c || c.status !== 'active') throw new SeoDataError('not_connected', 'Search Console n’est pas connecté.');
  if (!c.siteUrl) throw new SeoDataError('bad_request', 'Choisissez d’abord la propriété Search Console.');
  const p = provider ?? searchConsoleFor(businessId);
  const full = mode === 'import' || !c.importedAt;
  try {
    const data = await collect(p, c.siteUrl, now, full ? { months: HISTORY_MONTHS, days: 16 * 31 } : { months: 2, days: 10 });
    const at = now.toISOString();
    const prev = (await getDoc<GscDaily>(DAILY, businessId))?.data;
    const merged = new Map<string, DayRow>((prev && prev.siteUrl === c.siteUrl ? prev.days : []).map((d) => [d.date, d]));
    for (const d of data.days) merged.set(d.date, d);
    const minDate = day(addDays(now, -(HISTORY_MONTHS * 31 + 31)));
    const days = [...merged.values()].filter((d) => d.date >= minDate).sort((a, b) => a.date.localeCompare(b.date));
    await putDoc<GscDaily>(DAILY, businessId, { businessId, siteUrl: c.siteUrl, days, updatedAt: at }, businessId);
    for (const m of data.months) await putDoc<GscMonth>(MONTH, `${businessId}:${m.month}`, { businessId, siteUrl: c.siteUrl, ...m, updatedAt: at }, businessId);
    await putDoc<GscRecent>(RECENT, businessId, { businessId, siteUrl: c.siteUrl, ...data.recent, updatedAt: at }, businessId);
    const fresh = await getConnection(businessId);
    if (fresh) await saveConnection({ ...fresh, importedAt: full ? at : fresh.importedAt, lastSyncAt: at, lastError: null });
    return { siteUrl: c.siteUrl, days: days.length, months: data.months.length };
  } catch (e) {
    const fresh = await getConnection(businessId);
    if (fresh && fresh.status === 'active') await saveConnection({ ...fresh, lastError: e instanceof Error ? e.message.slice(0, 200) : 'erreur' });
    throw e;
  }
}

/** Suppression des données importées (révocation, suppression de compte). */
export async function dropSearchConsoleData(businessId: string): Promise<void> {
  await deleteDoc(DAILY, businessId);
  await deleteDoc(RECENT, businessId);
  await deleteDoc(INSPECT, businessId);
  for (const d of await listDocs<GscMonth>(MONTH, { businessId, limit: 100 })) {
    if (d.data?.businessId === businessId) await deleteDoc(MONTH, d.id);
  }
}

export interface GscStored { daily: GscDaily | null; recent: GscRecent | null; months: GscMonth[] }

export async function loadStored(businessId: string): Promise<GscStored> {
  const [daily, recent, months] = await Promise.all([
    getDoc<GscDaily>(DAILY, businessId),
    getDoc<GscRecent>(RECENT, businessId),
    listDocs<GscMonth>(MONTH, { businessId, limit: 40 }),
  ]);
  return {
    daily: daily?.data ?? null,
    recent: recent?.data ?? null,
    months: months.map((m) => m.data).filter((m) => m.businessId === businessId).sort((a, b) => a.month.localeCompare(b.month)),
  };
}

// ---------------------------------------------------------------------------
// Vue d'ensemble (calculs purs)
// ---------------------------------------------------------------------------

export interface Totals { clicks: number; impressions: number; ctr: number; position: number | null }

export function totalsOf(days: DayRow[]): Totals {
  const clicks = days.reduce((s, d) => s + d.clicks, 0);
  const impressions = days.reduce((s, d) => s + d.impressions, 0);
  // position moyenne pondérée par les impressions (comme l'interface Search Console)
  const pos = impressions > 0 ? days.reduce((s, d) => s + d.position * d.impressions, 0) / impressions : null;
  return { clicks, impressions, ctr: impressions ? r4(clicks / impressions) : 0, position: pos === null ? null : Math.round(pos * 10) / 10 };
}

export interface GscOverview {
  siteUrl: string;
  range: { start: string; end: string };
  totals: Totals;
  previous: Totals;
  /** variation relative des clics (‑1 à +∞), null si pas de base */
  clicksChange: number | null;
  series: DayRow[];
  topQueries: (TopRow & { previousPosition: number | null })[];
  topPages: TopRow[];
  devices: TopRow[];
  countries: TopRow[];
  sitemaps: GscSitemap[];
  monthly: { month: string; clicks: number; impressions: number }[];
  updatedAt: string | null;
}

export function overviewOf(s: GscStored, siteUrl: string, periodDays = 28): GscOverview | null {
  if (!s.daily || s.daily.days.length === 0) return null;
  const days = s.daily.days;
  const cur = days.slice(-periodDays);
  const prev = days.slice(-2 * periodDays, -periodDays);
  const totals = totalsOf(cur);
  const previous = totalsOf(prev);
  const prevPos = new Map((s.recent?.prevQueries ?? []).map((q) => [q.key, q.position]));
  const monthly = new Map<string, { clicks: number; impressions: number }>();
  for (const d of days) {
    const m = monthly.get(d.date.slice(0, 7)) ?? { clicks: 0, impressions: 0 };
    m.clicks += d.clicks;
    m.impressions += d.impressions;
    monthly.set(d.date.slice(0, 7), m);
  }
  return {
    siteUrl,
    range: { start: cur[0].date, end: cur[cur.length - 1].date },
    totals,
    previous,
    clicksChange: previous.clicks > 0 ? r4((totals.clicks - previous.clicks) / previous.clicks) : null,
    series: cur,
    topQueries: (s.recent?.queries ?? []).slice(0, 50).map((q) => ({ ...q, previousPosition: prevPos.get(q.key) ?? null })),
    topPages: (s.recent?.pages ?? []).slice(0, 50),
    devices: s.recent?.devices ?? [],
    countries: (s.recent?.countries ?? []).slice(0, 10),
    sitemaps: s.recent?.sitemaps ?? [],
    monthly: [...monthly.entries()].map(([month, v]) => ({ month, ...v })),
    updatedAt: s.daily.updatedAt,
  };
}
