/**
 * Démo cohérente de l'agent de contenu (comptes demo, demo-pme, demo-ecom) : propositions détectées sur les
 * mesures et l'exploration de DÉMONSTRATION, brouillons rédigés par le modèle structuré avec les faits de démo,
 * un contenu « en ligne » dont l'effet est calculé à partir des mesures de démo (précédente → dernière). Tout est
 * étiqueté « exemple fictif » ; aucune écriture serveur (la simulation se fait dans le navigateur).
 */
import type { MentionResult, QuerySpec } from '@/lib/engine/types';
import type { DomainStat } from '@/lib/engine/types-v2';
import type { UrlStat } from '@/lib/engine/types-v3';
import type { SubQuestionCoverage } from '@/lib/geo/types';
import { buildDraft } from './draft';
import { detectOpportunities, type DetectPage } from './detect';
import { snapshot } from './effect';
import type { SitePage } from './checks';
import { mentionTargets } from './mentions';
import type { ContentDraft, ContentOpportunity, FactSheet, MentionTarget, MentionTracking } from './types';

export interface DemoInput {
  businessId: string;
  name: string;
  site: string;
  segment: 'local' | 'pme' | 'ecommerce';
  city?: string;
  facts: FactSheet;
  latest: { measuredAt: string; queries: QuerySpec[]; mentions: MentionResult[]; domains: DomainStat[]; urls?: UrlStat[] } | null;
  previous: { measuredAt: string; mentions: MentionResult[] } | null;
  pages: (DetectPage & SitePage)[];
  geo: { generatedAt?: string; findingIds: string[]; fanOut?: SubQuestionCoverage[] } | null;
  crawledAt?: string;
  /** texte actuel d'une page (réécriture), tiré de l'exploration de démonstration */
  existing?: (url: string) => { url: string; title?: string; text: string } | undefined;
  now: Date;
}

export interface DemoContent {
  opportunities: ContentOpportunity[];
  drafts: ContentDraft[];
  mentions: MentionTarget[];
  tracking: MentionTracking[];
}

const days = (n: number, from: Date) => new Date(from.getTime() - n * 86_400_000);

export async function buildDemoContent(i: DemoInput): Promise<DemoContent> {
  const all = detectOpportunities({
    businessName: i.name,
    segment: i.segment,
    city: i.city,
    audit: i.latest,
    geo: i.geo,
    pages: i.pages,
    crawledAt: i.crawledAt,
  }).map((o) => ({ ...o, demo: true }));

  const ctx = { businessId: i.businessId, name: i.name, site: i.site, segment: i.segment, city: i.city, facts: i.facts, pages: i.pages, urls: i.latest?.urls, writer: null, demo: true } as const;
  const drafts: ContentDraft[] = [];
  // 1. Un contenu en ligne depuis la mesure précédente (effet calculé sur les mesures de démo).
  const live = all.find((o) => o.questionIds.length) ?? all[0];
  if (live) {
    const at = i.previous ? new Date(i.previous.measuredAt) : days(35, i.now);
    const existing = live.action === 'rewrite' && live.existingUrl ? i.existing?.(live.existingUrl) : undefined;
    const d = await buildDraft(live, { ...ctx, existing, now: at, id: `ct_demo_live_${i.businessId}` });
    const body = d.body.replace(/\[\s*à compléter[^\]]*\]/gi, 'Information fournie par l’entreprise (exemple fictif)');
    const done: ContentDraft = {
      ...d,
      body,
      missing: [],
      checks: d.checks.map((c) => (c.id === 'todo' ? { ...c, ok: true, detail: 'Toutes les informations viennent des faits (démo).' } : c)),
      status: 'published',
      platform: i.segment === 'ecommerce' ? 'shopify' : 'wordpress',
      remote: { platform: i.segment === 'ecommerce' ? 'shopify' : 'wordpress', format: d.format, id: 'demo-1', status: 'published', url: `${i.site.replace(/\/$/, '')}/${d.slug}` },
      liveUrl: `${i.site.replace(/\/$/, '')}/${d.slug}`,
      validation: { by: { id: 'demo', email: 'vous (démo)', role: 'owner' }, at: at.toISOString() },
      publishedAt: at.toISOString(),
      consumedAt: at.toISOString(),
      effect: {
        publishedAt: at.toISOString(),
        baseline: snapshot(d, { at: at.toISOString(), audit: i.previous }),
        ...(i.latest && i.previous ? { d30: snapshot(d, { at: i.latest.measuredAt, audit: i.latest }) } : {}),
      },
      opportunityId: live.id,
    };
    drafts.push(done);
  }
  // 2. Un brouillon prêt à valider (faits complets) et 3. un brouillon qui attend des faits.
  // Un brouillon de création et, si possible, une réécriture (avant / après sur la page de démo).
  const rest = all.filter((o) => o.id !== live?.id);
  const picks = [rest.find((o) => o.action === 'create'), rest.find((o) => o.action === 'rewrite' && o.existingUrl && i.existing?.(o.existingUrl))].filter((o): o is (typeof rest)[number] => !!o);
  for (const [n, op] of picks.entries()) {
    const existing = op.action === 'rewrite' && op.existingUrl ? i.existing?.(op.existingUrl) : undefined;
    const d = await buildDraft(op, { ...ctx, existing, now: days(n + 1, i.now), id: `ct_demo_${n}_${i.businessId}` });
    drafts.push(d);
  }
  const taken = new Set(drafts.map((d) => d.opportunityId));
  const opportunities = all.filter((o) => !taken.has(o.id));

  const mentions = i.latest ? mentionTargets({ name: i.name, site: i.site, segment: i.segment, city: i.city, facts: i.facts, domains: i.latest.domains, measuredAt: i.latest.measuredAt, demo: true }) : [];
  const tracking: MentionTracking[] = mentions.slice(0, 2).map((m, k) => ({
    id: m.id,
    businessId: i.businessId,
    status: k === 0 ? 'obtenu' : 'demande',
    requestedAt: days(20 - k * 8, i.now).toISOString(),
    ...(k === 0 ? { obtainedAt: days(6, i.now).toISOString(), url: `https://${m.domain}/` } : {}),
    note: 'Exemple fictif',
    updatedAt: days(6, i.now).toISOString(),
  }));
  return { opportunities, drafts, mentions, tracking };
}
