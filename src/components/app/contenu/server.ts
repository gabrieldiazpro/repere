// Données de l'agent de contenu, côté serveur uniquement (pages /app/contenu/** et actions).
// Compte réel : mesures IA (dernier audit), Search Console (si connectée), dernière exploration SEO/GEO, brouillons
// enregistrés. Compte démo : mêmes calculs sur les données de démonstration, brouillons fictifs étiquetés.
import { cache } from 'react';
import { requireBusiness } from '@/lib/auth';
import {
  buildDemoContent,
  detectOpportunities,
  ESSENTIAL_FACTS,
  listContentJournal,
  mentionTargets,
  mergeFacts,
  quotaView,
  type ContentDraft,
  type ContentJournalEntry,
  type ContentOpportunity,
  type ContentSettings,
  type DraftContext,
  type EffectInputs,
  type FactKey,
  type FactSheet,
  type MentionTarget,
  type MentionTracking,
  type QuotaView,
  type SitePage,
} from '@/lib/content';
import { getFacts, getSettings, listDismissed, listDrafts, listMentionTracking, refreshEffects } from '@/lib/content/service';
import type { EntitlementTier } from '@/lib/entitlements';
import type { OfficialBlocks } from '@/lib/content';
import { listConnections } from '@/lib/publish/connections';
import { canCreate } from '@/lib/publish/pages';
import type { Platform } from '@/lib/publish/types';
import { DEMO_CRAWL_STAGES, demoSiteCrawl } from '@/lib/seoaudit/demo-crawl';
import { parseHtml } from '@/lib/siteaudit/html';
import { htmlBlocksToMarkdown } from '@/lib/content/markdown';
import { loadWorkspace, type Workspace } from '../workspace';
import { loadEntitlements } from '../shell/server';
import { loadGsc, loadSeoSuite } from '../seo/data';
import type { ViewerRole } from '../agent/model';

export interface ContentData {
  businessId: string;
  demo: boolean;
  role: ViewerRole;
  name: string;
  site: string;
  segment: 'local' | 'pme' | 'ecommerce';
  tier: EntitlementTier;
  quota: QuotaView;
  facts: FactSheet;
  clientFacts: Partial<Record<FactKey, string>>;
  essential: FactKey[];
  opportunities: ContentOpportunity[];
  drafts: ContentDraft[];
  mentions: MentionTarget[];
  tracking: MentionTracking[];
  journal: ContentJournalEntry[];
  settings: ContentSettings;
  /** plateformes connectées (test réussi) et ce qu'elles savent créer */
  platforms: { platform: Platform; page: boolean; article: boolean }[];
  sources: { audit: string | null; gsc: string | null; crawl: string | null; gscConnected: boolean };
  loadError: boolean;
}

export interface ContentContext {
  ws: Workspace;
  data: ContentData;
  draftCtx: Omit<DraftContext, 'businessId' | 'now'>;
  effectInputs: Omit<EffectInputs, 'at'>;
}

/** Démo : texte actuel des pages, tiré de l'exploration de démonstration (réécritures avec avant / après). */
function demoExisting(businessId: string): (url: string) => { url: string; title?: string; text: string } | undefined {
  let crawl: ReturnType<typeof demoSiteCrawl> | null = null;
  try {
    crawl = demoSiteCrawl(businessId as Parameters<typeof demoSiteCrawl>[0], DEMO_CRAWL_STAGES - 1);
  } catch {
    crawl = null;
  }
  return (url) => {
    const pg = crawl?.pages.find((p) => p.url === url || p.finalUrl === url);
    if (!pg?.html) return undefined;
    const parsed = parseHtml(pg.html);
    const text = htmlBlocksToMarkdown(parsed.blocks);
    return text ? { url, title: parsed.title || undefined, text } : undefined;
  };
}

const segOf = (s: string) => (s === 'ecommerce' ? 'ecommerce' : s === 'pme' ? 'pme' : 'local') as ContentData['segment'];

function cityOf(ws: Workspace): string | undefined {
  const d = ws.business.descriptor.split(' · ')[1];
  return d?.trim() || undefined;
}

async function roleOf(businessId: string): Promise<ViewerRole> {
  try {
    return (await requireBusiness(null, businessId)).role as ViewerRole;
  } catch {
    return 'viewer';
  }
}

/**
 * V9 : blocs « À propos » et « Contact » de la fiche officielle (export de l'agent de publication), repris comme
 * squelette des pages de ce type. Seulement s'ils contiennent des faits (pas la seule ligne de source).
 */
async function officialBlocks(businessId: string): Promise<OfficialBlocks | null> {
  try {
    const { loadPublicFicheByBusiness, publicationExport } = await import('@/lib/execution/fiche');
    const p = await loadPublicFicheByBusiness(businessId);
    if (!p) return null;
    const ex = publicationExport(p.view, p.name, p.pageUrl, null);
    // Markdown restreint de l'agent : pas de gras.
    const plain = (md: string) => md.replace(/\*\*([^*]+)\*\*/g, '$1');
    const substantial = (md: string) => md.split('\n').filter((l) => l.trim()).length > 1;
    const out: OfficialBlocks = {};
    if (substantial(ex.about.markdown)) out.about = { title: ex.about.title, markdown: plain(ex.about.markdown) };
    if (/^- /m.test(ex.contact.markdown)) out.contact = { title: ex.contact.title, markdown: plain(ex.contact.markdown) };
    return out.about || out.contact ? out : null;
  } catch {
    return null;
  }
}

export const loadContentContext = cache(async (): Promise<ContentContext> => {
  const ws = await loadWorkspace();
  const businessId = ws.business.id;
  const segment = segOf(ws.segment);
  const site = ws.business.website ? `https://${ws.business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
  const city = cityOf(ws);
  const now = new Date();
  let loadError = false;
  const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => {
    try {
      return await p;
    } catch {
      loadError = true;
      return fb;
    }
  };
  const [suite, gscView, ent] = await Promise.all([safe(loadSeoSuite(), null), loadGsc().catch(() => null), loadEntitlements().catch(() => null)]);
  const run = suite?.latest ?? null;
  const pages: (SitePage & { indexable: boolean; depth: number })[] = (run?.pages ?? []).filter((p) => p.status === 200).map((p) => ({ url: p.url, title: p.title, words: p.words, indexable: p.indexable, depth: p.depth }));
  const geo = run ? { generatedAt: run.geo.generatedAt, findingIds: run.geo.sections.flatMap((s) => s.findings.map((f) => f.id)), fanOut: run.geo.fanOut.items } : null;
  const latest = ws.latest;
  const audit = latest ? { measuredAt: latest.measuredAt ?? latest.createdAt, queries: latest.queries, mentions: latest.mentions } : null;
  const gsc = gscView && 'available' in gscView && gscView.available && 'topQueries' in gscView ? { updatedAt: gscView.updatedAt, topQueries: gscView.topQueries.map((q) => ({ key: q.key, impressions: q.impressions, clicks: q.clicks, position: q.position })) } : null;
  const tier: EntitlementTier = ws.demo ? 'demo' : (ent?.tier ?? 'decouverte');
  const voiceSample = '';

  const stored = ws.demo ? null : await safe(getFacts(businessId), null);
  const facts = mergeFacts(stored?.facts ?? {}, (ws.facts.facts ?? {}) as Record<string, string>, stored?.updatedAt);
  const official = await officialBlocks(businessId);
  const draftCtx: ContentContext['draftCtx'] = { name: ws.business.name, site, segment, city, facts, pages, urls: latest?.sources?.urls, voiceSample, demo: ws.demo, ...(official ? { official } : {}) };
  const effectInputs: ContentContext['effectInputs'] = { audit: audit ? { measuredAt: audit.measuredAt, mentions: audit.mentions } : null, gsc };
  const sources = { audit: audit?.measuredAt ?? null, gsc: gsc?.updatedAt ?? null, crawl: run?.at ?? null, gscConnected: !!gsc };

  if (ws.demo) {
    const prev = ws.previous;
    const demo = await buildDemoContent({
      businessId,
      name: ws.business.name,
      site: site || 'https://exemple-demo.fr',
      segment,
      city,
      facts,
      latest: latest ? { measuredAt: audit!.measuredAt, queries: latest.queries, mentions: latest.mentions, domains: latest.sources?.domains ?? [], urls: latest.sources?.urls } : null,
      previous: prev ? { measuredAt: prev.measuredAt ?? prev.createdAt, mentions: prev.mentions } : null,
      pages,
      geo,
      crawledAt: run?.at,
      existing: demoExisting(businessId),
      now,
    });
    const data: ContentData = {
      businessId,
      demo: true,
      role: 'demo',
      name: ws.business.name,
      site: site || 'https://exemple-demo.fr',
      segment,
      tier,
      quota: quotaView(tier, demo.drafts, now),
      facts,
      clientFacts: {},
      essential: ESSENTIAL_FACTS[segment],
      opportunities: demo.opportunities,
      drafts: demo.drafts,
      mentions: demo.mentions,
      tracking: demo.tracking,
      journal: [],
      settings: {},
      platforms: [{ platform: segment === 'ecommerce' ? 'shopify' : 'wordpress', page: true, article: true }],
      sources,
      loadError,
    };
    return { ws, data, draftCtx, effectInputs };
  }

  const [role, dismissed, settings, conns, tracking] = await Promise.all([
    roleOf(businessId),
    safe(listDismissed(businessId), []),
    safe(getSettings(businessId), {}),
    safe(listConnections(businessId), []),
    safe(listMentionTracking(businessId), []),
  ]);
  await refreshEffects(businessId, effectInputs, now).catch(() => 0);
  const [drafts, journal] = await Promise.all([safe(listDrafts(businessId), []), safe(listContentJournal(businessId, 200), [])]);
  const taken = drafts.filter((d) => d.status !== 'rejected' && d.opportunityId).map((d) => d.opportunityId!);
  const opportunities = detectOpportunities({ businessName: ws.business.name, segment, city, audit, gsc, geo, pages, crawledAt: run?.at, taken, dismissed });
  const mentions = latest?.sources?.domains ? mentionTargets({ name: ws.business.name, site, segment, city, facts, domains: latest.sources.domains, measuredAt: audit?.measuredAt }) : [];
  const data: ContentData = {
    businessId,
    demo: false,
    role,
    name: ws.business.name,
    site,
    segment,
    tier,
    quota: quotaView(tier, drafts, now),
    facts,
    clientFacts: stored?.facts ?? {},
    essential: ESSENTIAL_FACTS[segment],
    opportunities,
    drafts,
    mentions,
    tracking,
    journal,
    settings,
    platforms: conns.filter((c) => c.lastTest?.ok).map((c) => ({ platform: c.platform, page: canCreate(c.platform, 'page'), article: canCreate(c.platform, 'article') })).filter((p) => p.page || p.article),
    sources,
    loadError,
  };
  return { ws, data, draftCtx, effectInputs };
});

export async function loadContent(): Promise<ContentData> {
  return (await loadContentContext()).data;
}
