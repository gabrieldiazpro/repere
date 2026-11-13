// Données de la partie SEO de l'app (serveur uniquement) — agent APP-SEO (V5 vague B).
// Démo : explorations de démonstration (src/lib/seoaudit/demo-crawl.ts) + fournisseurs démo de SEO-DATA, étiquetés.
// Comptes réels : explorations enregistrées par l'action « Relancer l'exploration » (collection `appseo.run`) ;
// sans exploration ni connexion : états vides utiles, jamais de chiffre inventé.
import { cache } from 'react';
import { listDocs } from '@/lib/store';
import type { SiteCrawl } from '@/lib/crawl/types';
import { auditSeo } from '@/lib/seoaudit';
import type { SeoReport } from '@/lib/seoaudit/types';
import { auditGeo, type GeoReport, type FactsInput } from '@/lib/geo';
import { DEMO_CRAWL_STAGES, demoSiteCrawl, demoStageDate } from '@/lib/seoaudit/demo-crawl';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { providersForBusiness, type ProviderSet, type SeoDataContext } from '@/lib/seodata/providers';
import { statusView, type StatusView } from '@/lib/seodata/service';
import type { PerfData } from '@/lib/seodata/types';
import { loadWorkspace, type Workspace } from '@/components/app/workspace';
import { loadEntitlements } from '@/components/app/shell/server';
import { crawlRights, summarizeCrawl, type CrawlRights, type PageRow, type SeoRun } from './model';

export const RUN_COLLECTION = 'appseo.run';

const segToType = (s: string) => (s === 'ecommerce' ? 'ecommerce' : s === 'pme' ? 'pme' : 'local') as 'local' | 'pme' | 'ecommerce';

/** Audit SEO + GEO d'une exploration (pur, sans réseau). */
export function auditBoth(crawl: SiteCrawl, ws: Pick<Workspace, 'segment' | 'business' | 'facts' | 'latest'>, perf?: PerfData | PerfData[]): { seo: SeoReport; geo: GeoReport; pages: PageRow[] } {
  const siteType = segToType(ws.segment);
  const seo = auditSeo(crawl, { siteType, ...(perf ? { perf } : {}) });
  const geo = auditGeo(crawl, {
    brand: ws.business.name,
    siteType,
    trade: (ws.business.descriptor || '').split(' · ')[0] || undefined,
    facts: ws.facts.facts as FactsInput,
    aiAnswers: ws.latest?.answers ?? [],
    now: crawl.startedAt,
  });
  return { seo, geo, pages: summarizeCrawl(crawl) };
}

export interface SeoSuite {
  ws: Workspace;
  demo: boolean;
  tier: string;
  rights: CrawlRights;
  website: string;
  /** du plus ancien au plus récent */
  runs: SeoRun[];
  latest: SeoRun | null;
  previous: SeoRun | null;
  status: StatusView | null;
  ctx: SeoDataContext | null;
  p: ProviderSet | null;
}

const demoRuns = cache(async (ws: Workspace): Promise<SeoRun[]> => {
  const id = ws.business.id;
  if (!isDemoBusinessId(id)) return [];
  const { ctx, p } = await providersForBusiness(id);
  const perf = p.perf && ctx.domain ? await p.perf.measure(`https://${id === 'demo-ecom' ? 'www.' : ''}${ctx.domain}/`).catch(() => undefined) : undefined;
  const out: SeoRun[] = [];
  for (let s = 0; s < DEMO_CRAWL_STAGES; s++) {
    const crawl = demoSiteCrawl(id, s);
    const r = auditBoth(crawl, ws, perf);
    out.push({ id: `${id}:demo:${s}`, businessId: id, at: demoStageDate(s), demo: true, url: crawl.startUrl, pagesCrawled: crawl.pages.length, truncated: false, durationMs: crawl.durationMs, seo: r.seo, geo: r.geo, pages: r.pages, trigger: 'demo' });
  }
  return out;
});

export async function listRealRuns(businessId: string, limit = 12): Promise<SeoRun[]> {
  const docs = await listDocs<SeoRun>(RUN_COLLECTION, { businessId, limit: limit + 4 }).catch(() => []);
  return docs
    .map((d) => d.data)
    .filter((r) => r && r.businessId === businessId && r.seo && r.geo)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-limit);
}

export const loadSeoSuite = cache(async (): Promise<SeoSuite> => {
  const ws = await loadWorkspace();
  const ent = await loadEntitlements().catch(() => null);
  const tier = ws.demo ? 'demo' : (ent?.tier ?? 'decouverte');
  const runs = ws.demo ? await demoRuns(ws) : await listRealRuns(ws.business.id);
  let status: StatusView | null = null;
  let ctx: SeoDataContext | null = null;
  let p: ProviderSet | null = null;
  try {
    const r = await providersForBusiness(ws.business.id);
    ctx = r.ctx;
    p = r.p;
    status = await statusView(ctx, p);
  } catch {
    status = null;
  }
  const website = ws.business.website ? (/^https?:\/\//.test(ws.business.website) ? ws.business.website : `https://${ws.business.website}`) : '';
  return {
    ws,
    demo: ws.demo,
    tier,
    rights: crawlRights(tier),
    website,
    runs,
    latest: runs.at(-1) ?? null,
    previous: runs.at(-2) ?? null,
    status,
    ctx,
    p,
  };
});

// ---------------------------------------------------------------------------
// Données externes (SEO-DATA) prêtes pour les écrans
// ---------------------------------------------------------------------------

export const loadGsc = cache(async () => {
  const s = await loadSeoSuite();
  if (!s.ctx || !s.p) return null;
  const { gscOverviewView } = await import('@/lib/seodata/service');
  return gscOverviewView(s.ctx, s.p).catch(() => null);
});

export const loadRanks = cache(async () => {
  const s = await loadSeoSuite();
  if (!s.ctx || !s.p) return null;
  const { buildReport, getRankConfig, rankHistory, suggestKeywords } = await import('@/lib/seodata/rank');
  try {
    const [config, history] = await Promise.all([getRankConfig(s.ctx), rankHistory(s.ctx, s.p, 12)]);
    const report = buildReport(s.ctx, config, history);
    const sugg = await suggestKeywords(s.ctx, s.p).catch(() => ({ suggestions: [], sources: [] as string[] }));
    return { config, history, report, suggestions: sugg.suggestions, suggestionSources: sugg.sources, serp: s.p.statuses.find((x) => x.kind === 'serp') ?? null, limit: s.ctx.limits.keywords };
  } catch {
    return null;
  }
});
