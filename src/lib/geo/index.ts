/**
 * Module GEO-OPT (V5) : optimisation de la visibilité dans les réponses des IA (ChatGPT, Perplexity, Gemini, Claude,
 * Copilot, Mistral, aperçus IA de Google), fondée sur des preuves (docs/v5/geo-methode.md).
 *
 * - `auditGeo(crawl, ctx)` : pur, synchrone, sans réseau → `GeoReport`.
 * - `runGeo(crawl, ctx, { llm })` : appelle d'abord le fournisseur d'IA configuré (sous-questions, réécritures des
 *   passages prioritaires) puis `auditGeo`. Sans clé : gabarits et règles, rapport marqué `demo`.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import { registrableDomain } from '@/lib/engine/detect';
import { auditAccess } from './access';
import { auditEntity, collectEntity, isLocalType } from './entity';
import { auditQuestions, defaultSeeds, generateFanOut, templateFanOut } from './fanout';
import { auditFreshness } from './freshness';
import { auditLlms } from './llmstxt';
import { defaultGeoLlm, type GeoLlm } from './llm';
import { auditOffsite } from './offsite';
import { auditPassages, extractPassages, scorePassage, REWRITE_MAX } from './passages';
import { deterministicRewrite, rewritePassage } from './rewrite';
import { auditStructured, isProductPage } from './structured';
import type { GeoContext, GeoFinding, GeoReport, GeoSiteType, PassageRewrite } from './types';
import { byPriority, geoPages, homePage, isExternal, type GeoPage } from './util';
import { typesOf } from '@/lib/siteaudit/jsonld';

export * from './types';
export { rewritePassage, deterministicRewrite, inventedFacts, relevantFacts, type RewriteContext } from './rewrite';
export { generateFanOut, templateFanOut, coverageOf, defaultSeeds, guessFacet } from './fanout';
export { extractPassages, scorePassage, CRITERIA_POINTS, CRITERIA_LABELS } from './passages';
export { defaultGeoLlm, type GeoLlm } from './llm';
export { aggregateSources } from './offsite';
export { proposeLlmsTxt } from './llmstxt';

export const GEO_METHOD = 'repere-geo-v5.0';

export const GEO_LIMITS = [
  'Les règles appliquées viennent de la documentation des opérateurs et d’études publiées (docs/v5/geo-methode.md) ; aucune ne garantit une citation.',
  'Notre robot (RepereBot) n’est pas un robot d’IA : un blocage par pare-feu propre aux robots d’IA n’est visible que dans vos journaux serveur ou votre CDN.',
  'Le rendu est jugé sur le HTML envoyé par le serveur, sans exécuter le JavaScript (comme les robots d’OpenAI, d’Anthropic et de Perplexity).',
  'Les scores de passage et de couverture sont des heuristiques de rédaction, pas une mesure de ce que citent les IA ; la mesure réelle est l’audit IA.',
];

const SECTION_ORDER = ['acces', 'entite', 'passages', 'questions', 'fraicheur', 'donnees', 'hors_site', 'llms'];

/** Type de site : fourni, sinon déduit (Product → boutique ; LocalBusiness ou adresse + téléphone → local ; sinon PME). */
export function detectSiteType(pages: GeoPage[], hint?: GeoContext['siteType']): GeoSiteType {
  if (hint === 'artisan' || hint === 'local') return 'local';
  if (hint === 'boutique' || hint === 'ecommerce') return 'ecommerce';
  if (hint === 'pme') return 'pme';
  const products = pages.filter(isProductPage).length;
  if (products >= 2 || pages.some((p) => p.nodes.some((n) => typesOf(n).some((t) => t === 'OnlineStore')))) return 'ecommerce';
  if (pages.some((p) => p.nodes.some((n) => isLocalType(typesOf(n))))) return 'local';
  const e = collectEntity(pages);
  if (e.phones.length && e.postcodes.length && pages.length <= 40) return 'local';
  return 'pme';
}

function linkedDomains(pages: GeoPage[]): string[] {
  const out = new Set<string>();
  for (const p of pages) for (const l of p.parsed?.links ?? []) if (isExternal(l.href, p.url)) out.add(registrableDomain(l.href));
  for (const p of pages) for (const n of p.nodes) for (const s of ([] as unknown[]).concat(n.sameAs ?? [])) if (typeof s === 'string') out.add(registrableDomain(s));
  return [...out];
}

function brandOf(pages: GeoPage[], ctx: GeoContext): string | null {
  return collectEntity(pages, ctx.brand).name;
}

/** Audit GEO complet (pur, sans réseau). */
export function auditGeo(crawl: SiteCrawl, ctx: GeoContext = {}): GeoReport {
  const pages = geoPages(crawl);
  const origin = crawl.finalOrigin || crawl.origin;
  const siteType = detectSiteType(pages, ctx.siteType);
  const brand = brandOf(pages, ctx);
  const home = homePage(pages);
  const homeUrl = home?.url ?? origin;
  const hasHtml = pages.some((p) => p.parsed);

  const access = auditAccess(crawl, pages);
  const { section: entitySection, entity } = auditEntity(pages, siteType, origin, ctx.facts ?? {}, ctx.brand);
  const pageText = (url: string) => pages.find((p) => p.url === url)?.parsed?.mainText ?? '';
  const passages = auditPassages(pages, brand, (p) => deterministicRewrite(p, { brand, facts: ctx.facts, pageText: pageText(p.url) }), ctx.rewrites ?? {});
  const seeds = ctx.questions?.filter((q) => q.trim()).slice(0, 5) ?? [];
  const seedCtx = { siteType, brand, trade: ctx.trade, city: ctx.city ?? entity.city ?? undefined };
  const effectiveSeeds = seeds.length ? seeds : defaultSeeds(seedCtx);
  const subs = ctx.fanOut?.length ? ctx.fanOut : templateFanOut(effectiveSeeds, seedCtx);
  const questions = auditQuestions(subs, effectiveSeeds, passages.all, { brand, facts: ctx.facts, homeUrl, hasHtml });
  const freshness = auditFreshness(pages, ctx.now);
  const structured = auditStructured(pages, siteType);
  const llms = auditLlms(crawl, pages, ctx.llmsTxt, brand, entity.description);
  const offsite = auditOffsite({ origin, brand, engineSources: ctx.engineSources, aiAnswers: ctx.aiAnswers, linkedDomains: linkedDomains(pages) });

  const sections = [access.section, entitySection, passages.section, questions.section, freshness.section, structured, offsite.section, llms].sort(
    (a, b) => SECTION_ORDER.indexOf(a.id) - SECTION_ORDER.indexOf(b.id),
  );
  const measured = sections.filter((s) => s.measured && s.weight > 0);
  const wsum = measured.reduce((s, x) => s + x.weight, 0);
  let score = wsum ? Math.round(measured.reduce((s, x) => s + x.score * x.weight, 0) / wsum) : 0;
  // Défauts bloquants : les IA ne peuvent pas lire le site.
  const blocking = access.section.findings.some((f) => f.severity === 'critical');
  if (blocking) score = Math.min(score, 35);
  if (!hasHtml) score = Math.min(score, 20);

  const all: GeoFinding[] = sections.flatMap((s) => s.findings);
  const topFixes = all.filter((f) => f.severity !== 'info').sort(byPriority).slice(0, 10);
  const avg = passages.all.length ? Math.round(passages.all.reduce((s, p) => s + p.score, 0) / passages.all.length) : 0;
  return {
    score,
    sections,
    topFixes,
    stats: {
      pagesAnalyzed: pages.length,
      pagesWithHtml: pages.filter((p) => p.parsed).length,
      passages: passages.all.length,
      citablePassages: passages.all.filter((p) => p.score >= 70).length,
      avgPassageScore: avg,
      subQuestions: questions.fanOut.items.length,
      subQuestionsCovered: questions.fanOut.covered,
      searchBotsBlocked: access.searchBlocked,
      orgJsonLd: entity.orgNodes.length > 0,
    },
    siteType,
    brand,
    passages: { top: passages.top, toRewrite: passages.toRewrite },
    fanOut: questions.fanOut,
    offsite: offsite.summary,
    demo: questions.fanOut.source === 'modele' || (!!ctx.aiAnswers?.length && ctx.aiAnswers.every((a) => a.demo)),
    method: GEO_METHOD,
    generatedAt: ctx.now ?? new Date().toISOString(),
    limits: GEO_LIMITS,
  };
}

export interface RunGeoOptions {
  /** Fournisseur d'IA : absent ⇒ configuré (src/lib/engine/providers) ; null ⇒ aucun (démo). */
  llm?: GeoLlm | null;
  /** Nombre de passages réécrits par l'IA (défaut 5, max 10). */
  rewriteCount?: number;
  timeoutMs?: number;
}

/** Audit GEO avec le fournisseur d'IA (sous-questions + réécritures), replis déterministes sinon. */
export async function runGeo(crawl: SiteCrawl, ctx: GeoContext = {}, opts: RunGeoOptions = {}): Promise<GeoReport> {
  const llm = opts.llm === undefined ? defaultGeoLlm() : opts.llm;
  if (!llm) return auditGeo(crawl, ctx);
  const pages = geoPages(crawl);
  const siteType = detectSiteType(pages, ctx.siteType);
  const entity = collectEntity(pages, ctx.brand);
  const brand = entity.name;
  const seedCtx = { siteType, brand, trade: ctx.trade, city: ctx.city ?? entity.city ?? undefined };
  const seeds = ctx.questions?.filter((q) => q.trim()).slice(0, 5) ?? [];
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const fanOutP = ctx.fanOut?.length ? Promise.resolve(ctx.fanOut) : generateFanOut(seeds, seedCtx, llm, timeoutMs);
  // Passages prioritaires à réécrire (mêmes règles que la section).
  const scored = pages.flatMap(extractPassages).map((p) => scorePassage(p, brand));
  const weak = scored.filter((p) => p.score <= REWRITE_MAX && p.words >= 40).sort((a, b) => a.depth - b.depth || a.position - b.position || a.score - b.score);
  const n = Math.max(0, Math.min(10, opts.rewriteCount ?? 5));
  const rewritesP = Promise.all(
    weak.slice(0, n).map((p) => rewritePassage(p, { brand, facts: ctx.facts, llm, timeoutMs, pageText: pages.find((x) => x.url === p.url)?.parsed?.mainText })),
  );
  const [fanOut, rewrites] = await Promise.all([fanOutP, rewritesP]);
  const byId: Record<string, PassageRewrite> = { ...(ctx.rewrites ?? {}) };
  for (const r of rewrites) byId[r.passageId] = r;
  return auditGeo(crawl, { ...ctx, fanOut, rewrites: byId });
}
