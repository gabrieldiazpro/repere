/**
 * Vues prêtes pour les routes /api/v5/seodata/** (et pour l'app en vague B). Chaque vue porte sa `source`
 * (fournisseur réel ou démo) ou un statut « non configuré » explicite, jamais de chiffre inventé.
 */
import { getDoc, putDoc } from '@/lib/store';
import { bingFor } from './bing';
import { budgetView, type BudgetView } from './cost';
import { DEMO_NOTE, DEMO_SPECS, DemoBing } from './demo';
import { connectionView, getConnection, gscEnabled, type GscConnectionView } from './google-oauth';
import { SeoDataError, addDays, day, monthKey, sameSite } from './http';
import { estimateMonthlyEur } from './limits';
import type { ProviderSet, SeoDataContext } from './providers';
import { collect, loadStored, overviewOf, type GscOverview } from './searchconsole';
import type { BacklinksSummary, DataSource, Device, PerfData, ProviderStatus } from './types';

const src = (provider: string, demo: boolean, note?: string): DataSource => ({ provider, demo, fetchedAt: new Date().toISOString(), ...(note ? { note } : demo ? { note: DEMO_NOTE } : {}) });

export interface StatusView {
  businessId: string;
  demo: boolean;
  domain: string | null;
  providers: ProviderStatus[];
  searchConsole: GscConnectionView & { enabled: boolean };
  limits: SeoDataContext['limits'] & { estimatedMonthlyEur: number };
  budget: BudgetView;
}

export async function statusView(ctx: SeoDataContext, p: ProviderSet): Promise<StatusView> {
  const conn = ctx.demoId
    ? { connected: true, status: 'active' as const, siteUrl: DEMO_SPECS[ctx.demoId].site, sites: [{ siteUrl: DEMO_SPECS[ctx.demoId].site, permissionLevel: 'siteOwner' }], connectedAt: null, importedAt: null, lastSyncAt: null, lastError: null }
    : connectionView(await getConnection(ctx.businessId));
  return {
    businessId: ctx.businessId,
    demo: Boolean(ctx.demoId),
    domain: ctx.domain,
    providers: p.statuses,
    searchConsole: { ...conn, enabled: Boolean(ctx.demoId) || gscEnabled() },
    limits: { ...ctx.limits, estimatedMonthlyEur: estimateMonthlyEur(ctx.limits) },
    budget: await budgetView(ctx.businessId, ctx.limits.monthlyBudgetEur),
  };
}

// ---------------------------------------------------------------------------
// Search Console
// ---------------------------------------------------------------------------

export type Unavailable = { available: false; reason: string; state: ProviderStatus['state'] };
const unavailable = (p: ProviderSet, kind: ProviderStatus['kind']): Unavailable => {
  const s = p.statuses.find((x) => x.kind === kind);
  return { available: false, reason: s?.reason ?? 'Non configuré.', state: s?.state ?? 'off' };
};

const demoGscCache = new Map<string, { at: number; data: GscOverview }>();

export async function gscOverviewView(ctx: SeoDataContext, p: ProviderSet, now = new Date()): Promise<({ available: true; source: DataSource } & GscOverview) | Unavailable | { available: false; reason: string; state: 'live'; pending: true }> {
  if (!p.searchConsole) return unavailable(p, 'searchConsole');
  if (ctx.demoId) {
    const k = `${ctx.demoId}:${day(now)}`;
    let hit = demoGscCache.get(k);
    if (!hit) {
      const site = DEMO_SPECS[ctx.demoId].site;
      const d = await collect(p.searchConsole, site, now, { months: 16, days: 16 * 31 });
      const at = now.toISOString();
      const data = overviewOf(
        { daily: { businessId: ctx.businessId, siteUrl: site, days: d.days, updatedAt: at }, recent: { businessId: ctx.businessId, siteUrl: site, ...d.recent, updatedAt: at }, months: d.months.map((m) => ({ businessId: ctx.businessId, siteUrl: site, ...m, updatedAt: at })) },
        site,
      )!;
      hit = { at: Date.now(), data };
      demoGscCache.set(k, hit);
    }
    return { available: true, source: src('demo', true), ...hit.data };
  }
  const conn = await getConnection(ctx.businessId);
  const stored = await loadStored(ctx.businessId);
  const o = overviewOf(stored, conn?.siteUrl ?? '');
  if (!o) return { available: false, reason: 'Import Search Console en cours : les 16 derniers mois arrivent dans quelques minutes.', state: 'live', pending: true };
  return { available: true, source: src('google-search-console', false, 'Dates en heure du Pacifique ; les 2 à 3 derniers jours ne sont pas encore consolidés par Google.'), ...o };
}

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export async function perfView(ctx: SeoDataContext, p: ProviderSet, url: string | null, devices?: Device[]): Promise<({ available: true; source: DataSource } & PerfData) | Unavailable> {
  if (!p.perf) return unavailable(p, 'perf');
  const target = url ?? (ctx.domain ? `https://${ctx.demoId === 'demo-ecom' ? 'www.' : ''}${ctx.domain}/` : null);
  if (!target) throw new SeoDataError('bad_request', 'Renseignez l’adresse du site.');
  let u: URL;
  try {
    u = new URL(target);
  } catch {
    throw new SeoDataError('bad_request', 'Adresse invalide.');
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new SeoDataError('bad_request', 'Adresse invalide.');
  // Seulement les pages du site du compte (pas un service de mesure ouvert à tous les sites).
  if (!ctx.domain || !sameSite(u.hostname, ctx.domain)) throw new SeoDataError('bad_request', 'Seules les pages de votre site peuvent être mesurées ici.');
  const data = await p.perf.measure(u.toString(), { devices });
  return { available: true, source: src(data.demo ? 'demo' : data.sources.join('+') || 'pagespeed-insights', data.demo), ...data };
}

// ---------------------------------------------------------------------------
// Liens entrants (payant : cache mensuel)
// ---------------------------------------------------------------------------

export const BACKLINKS_CACHE = 'seodata.backlinks';

export interface BacklinksView {
  summary: BacklinksSummary;
  referringDomains: { domain: string; backlinks: number; rank: number | null; firstSeen: string | null }[];
  anchors: { anchor: string; backlinks: number; referringDomains: number }[];
  newLost: { date: string; newBacklinks: number; lostBacklinks: number; newDomains: number; lostDomains: number }[];
  month: string;
  at: string;
}

export async function backlinksView(ctx: SeoDataContext, p: ProviderSet, now = new Date()): Promise<({ available: true; source: DataSource } & BacklinksView) | Unavailable> {
  if (!p.backlinks) return unavailable(p, 'backlinks');
  if (!ctx.domain) throw new SeoDataError('bad_request', 'Renseignez l’adresse du site.');
  const id = `${ctx.businessId}:${monthKey(now)}`;
  if (!ctx.demoId) {
    const hit = (await getDoc<BacklinksView>(BACKLINKS_CACHE, id))?.data;
    if (hit) return { available: true, source: { ...src('dataforseo', false), fetchedAt: hit.at }, ...hit };
  }
  const b = p.backlinks;
  const from = day(addDays(now, -365));
  const [summary, referringDomains, anchors, newLost] = await Promise.all([b.summary(ctx.domain), b.referringDomains(ctx.domain, 100), b.anchors(ctx.domain, 100), b.newLost(ctx.domain, from)]);
  const v: BacklinksView = { summary, referringDomains, anchors, newLost, month: monthKey(now), at: now.toISOString() };
  if (!ctx.demoId) await putDoc(BACKLINKS_CACHE, id, v, ctx.businessId);
  return { available: true, source: src(b.demo ? 'demo' : 'dataforseo', b.demo), ...v };
}

// ---------------------------------------------------------------------------
// Bing
// ---------------------------------------------------------------------------

export async function bingView(ctx: SeoDataContext, p: ProviderSet, now = new Date()) {
  if (ctx.demoId) {
    const b = new DemoBing(ctx.demoId, now);
    const site = (await b.sites())[0];
    return { available: true as const, source: src('demo', true), siteUrl: site, queries: await b.queryStats(), traffic: await b.trafficStats() };
  }
  const c = await bingFor(ctx.businessId);
  if (!c) return unavailable(p, 'bing');
  const [queries, traffic] = await Promise.all([c.provider.queryStats(c.siteUrl), c.provider.trafficStats(c.siteUrl)]);
  return { available: true as const, source: src('bing-webmaster', false, 'Bing regroupe ses données par semaine.'), siteUrl: c.siteUrl, queries: queries.sort((a, b) => b.clicks - a.clicks).slice(0, 200), traffic };
}

// ---------------------------------------------------------------------------
// Inspection d'URL (quota Google : 2 000/jour/site ; plafond par offre `inspectionsPerDay`)
// ---------------------------------------------------------------------------

export const INSPECT_COUNT = 'seodata.gsc.inspectcount';

export async function inspectView(ctx: SeoDataContext, p: ProviderSet, url: string, now = new Date()) {
  if (!p.searchConsole) return unavailable(p, 'searchConsole');
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new SeoDataError('bad_request', 'Adresse invalide.');
  }
  if (!ctx.domain || !sameSite(u.hostname, ctx.domain)) throw new SeoDataError('bad_request', 'Seules les pages de votre site peuvent être inspectées.');
  const siteUrl = ctx.demoId ? DEMO_SPECS[ctx.demoId].site : (await getConnection(ctx.businessId))?.siteUrl;
  if (!siteUrl) throw new SeoDataError('not_connected', 'Choisissez la propriété Search Console.');
  if (!ctx.demoId) {
    const id = `${ctx.businessId}:${day(now)}`;
    const n = (await getDoc<{ count: number }>(INSPECT_COUNT, id))?.data.count ?? 0;
    if (n >= ctx.limits.inspectionsPerDay) throw new SeoDataError('quota', `Limite de ${ctx.limits.inspectionsPerDay} inspections par jour atteinte.`);
    await putDoc(INSPECT_COUNT, id, { count: n + 1 }, ctx.businessId);
  }
  const r = await p.searchConsole.inspect(siteUrl, u.toString());
  return { available: true as const, source: src(ctx.demoId ? 'demo' : 'google-search-console', Boolean(ctx.demoId)), ...r };
}
