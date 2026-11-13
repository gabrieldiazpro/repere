/**
 * Choix du fournisseur pour un compte : réel (clés présentes, inclus dans l'offre), DÉMO (comptes démo uniquement)
 * ou « non configuré » explicite (aucun chiffre). Les fournisseurs payants passent par le plafond de coût du compte.
 */
import { getBusinessRecord, type BusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { isDemoBusinessId, type DemoId } from '@/lib/demo-v2';
import { reserve } from './cost';
import { DataForSeoBacklinks, DataForSeoClient, DataForSeoKeywords, DataForSeoSerp, FRANCE, dataForSeoConfigured, type Meter } from './dataforseo';
import { DEMO_SPECS, DemoBacklinks, DemoKeywords, DemoPerf, DemoSearchConsole, DemoSerp } from './demo';
import { getBingConnection } from './bing';
import { getConnection, gscEnabled } from './google-oauth';
import { SeoDataError, hostOf } from './http';
import { eurPerUsd, limitsFor, type SeoDataLimits } from './limits';
import { GooglePerfProvider, perfConfigured, type PerfProvider } from './perf';
import { searchConsoleFor } from './searchconsole';
import type { BacklinksProvider, KeywordLocation, KeywordsProvider, ProviderKind, ProviderStatus, SearchConsoleProvider, SerpProvider } from './types';

export interface SeoDataContext {
  businessId: string;
  demoId: DemoId | null;
  /** domaine du site (sans www.) ou null s'il n'est pas renseigné */
  domain: string | null;
  segment: 'local' | 'pme' | 'ecommerce';
  city: string | null;
  limits: SeoDataLimits;
  tier: string;
}

export async function contextFor(businessId: string, record?: BusinessRecord | null): Promise<SeoDataContext> {
  const b = record ?? (await getBusinessRecord(businessId));
  if (!b) throw new SeoDataError('not_found', 'Espace introuvable.');
  const e = getEntitlements(b);
  const demoId = isDemoBusinessId(businessId) ? businessId : null;
  const segment = b.segment === 'pme' || b.segment === 'ecommerce' ? b.segment : 'local';
  const website = demoId ? DEMO_SPECS[demoId].domain : b.website ?? null;
  return {
    businessId,
    demoId,
    domain: website ? hostOf(website) : null,
    segment,
    city: b.city || null,
    // Droits par offre : `seoData` (src/lib/entitlements.ts, même table que limits.ts).
    limits: e.seoData ? { ...e.seoData } : limitsFor(e, segment),
    tier: e.tier,
  };
}

/** Localisation Google : France entière, ou la ville pour un commerce local (positions de proximité). */
export function locationFor(ctx: SeoDataContext): KeywordLocation {
  if (ctx.demoId) return { name: DEMO_SPECS[ctx.demoId].location || undefined, code: DEMO_SPECS[ctx.demoId].location ? undefined : FRANCE.code, language: 'fr' };
  if (ctx.segment === 'local' && ctx.city) return { name: `${ctx.city},France`, language: 'fr' };
  return { code: FRANCE.code, language: 'fr' };
}

export function meterFor(ctx: SeoDataContext): Meter {
  return (op, usd) => reserve(ctx.businessId, op, usd, ctx.limits.monthlyBudgetEur);
}

const off = (kind: ProviderKind, reason: string): ProviderStatus => ({ kind, state: 'off', provider: null, reason });

export interface ProviderSet {
  statuses: ProviderStatus[];
  searchConsole: SearchConsoleProvider | null;
  perf: PerfProvider | null;
  keywords: KeywordsProvider | null;
  serp: SerpProvider | null;
  backlinks: BacklinksProvider | null;
}

export async function providersFor(ctx: SeoDataContext, now: Date = new Date()): Promise<ProviderSet> {
  if (ctx.demoId) {
    const id = ctx.demoId;
    const kinds: ProviderKind[] = ['searchConsole', 'perf', 'keywords', 'serp', 'backlinks', 'bing'];
    return {
      statuses: kinds.map((kind) => ({ kind, state: 'demo', provider: 'demo', reason: 'Données de démonstration.' })),
      searchConsole: new DemoSearchConsole(id, now),
      perf: new DemoPerf(id),
      keywords: new DemoKeywords(id),
      serp: new DemoSerp(id, now),
      backlinks: new DemoBacklinks(id, now),
    };
  }
  const statuses: ProviderStatus[] = [];
  let searchConsole: SearchConsoleProvider | null = null;
  if (!gscEnabled()) statuses.push(off('searchConsole', 'Connexion Google non configurée sur la plateforme (GOOGLE_CLIENT_ID).'));
  else {
    const c = await getConnection(ctx.businessId);
    if (!c || c.status !== 'active') statuses.push(off('searchConsole', c?.status === 'revoked' ? 'Accès Google révoqué : reconnectez Search Console.' : 'Search Console n’est pas connecté.'));
    else if (!c.siteUrl) statuses.push(off('searchConsole', 'Choisissez la propriété Search Console.'));
    else {
      searchConsole = searchConsoleFor(ctx.businessId);
      statuses.push({ kind: 'searchConsole', state: 'live', provider: 'google-search-console' });
    }
  }
  let perf: PerfProvider | null = null;
  if (perfConfigured()) {
    perf = new GooglePerfProvider();
    statuses.push({ kind: 'perf', state: 'live', provider: 'pagespeed-insights' });
  } else statuses.push(off('perf', 'PageSpeed Insights non configuré (PAGESPEED_API_KEY).'));

  let keywords: KeywordsProvider | null = null;
  let serp: SerpProvider | null = null;
  let backlinks: BacklinksProvider | null = null;
  if (!dataForSeoConfigured()) {
    for (const k of ['keywords', 'serp', 'backlinks'] as const) statuses.push(off(k, 'Fournisseur de données (DataForSEO) non configuré : aucun volume ni position n’est affiché.'));
  } else if (ctx.limits.monthlyBudgetEur <= 0) {
    for (const k of ['keywords', 'serp', 'backlinks'] as const) statuses.push(off(k, 'Non inclus dans votre offre (positions, volumes et liens à partir d’Essentiel).'));
  } else {
    const client = new DataForSeoClient(meterFor(ctx));
    keywords = new DataForSeoKeywords(client, eurPerUsd());
    serp = new DataForSeoSerp(client);
    statuses.push({ kind: 'keywords', state: 'live', provider: 'dataforseo' }, { kind: 'serp', state: 'live', provider: 'dataforseo' });
    if (ctx.limits.backlinks) {
      backlinks = new DataForSeoBacklinks(client);
      statuses.push({ kind: 'backlinks', state: 'live', provider: 'dataforseo' });
    } else statuses.push(off('backlinks', 'Liens entrants non inclus dans votre offre.'));
  }
  const bing = await getBingConnection(ctx.businessId).catch(() => null);
  statuses.push(bing ? { kind: 'bing', state: 'live', provider: 'bing-webmaster' } : off('bing', 'Ajoutez votre clé API Bing Webmaster Tools pour importer vos données Bing.'));
  return { statuses, searchConsole, perf, keywords, serp, backlinks };
}

/** Raccourci pour les routes : fournisseurs d'un compte. */
export async function providersForBusiness(businessId: string, now?: Date): Promise<{ ctx: SeoDataContext; p: ProviderSet }> {
  const ctx = await contextFor(businessId);
  return { ctx, p: await providersFor(ctx, now) };
}
