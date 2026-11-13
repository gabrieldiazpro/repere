/**
 * Audit SEO V5 : `auditSeo(crawl, opts)` → `SeoReport`. Fonction pure (aucun réseau).
 *
 * Score (docs/v5/seo-controles.md, « Pondération ») :
 *  - chaque constat retire un pourcentage de la note de sa section : section = 100 × Π (1 − part) ;
 *    part = poids(sévérité) × étendue ; poids : critique 0,60, élevée 0,35, moyenne 0,15, faible 0,04, info 0 ;
 *    étendue = 1 pour un constat global, sinon 0,35 + 0,65 × min(1, part de pages concernées / 50 %) ;
 *  - global = 100 × Π (1 − part × ½ × poids de la section / poids moyen des sections applicables) : chaque
 *    problème retire aussi un pourcentage de la note globale, d'autant plus que sa section pèse (tableau SECTIONS) ;
 *    les sections sans problème ne « diluent » donc pas les points noirs ;
 *    plafonnée à 40 en présence d'un constat critique global ou touchant au moins 50 % des pages ;
 *  - tout est arrondi à 5 points : un audit automatique n'a pas la précision d'une note au point près.
 * topFixes : (rang de sévérité × impact) / effort, puis nombre de pages concernées ; 10 premiers, hors « info ».
 */
import { guessSiteName } from './autofix';
import { DONNEES, isLocalType } from './checks/donnees';
import { CONTENU } from './checks/contenu';
import { DOUBLONS } from './checks/doublons';
import { ECOMMERCE } from './checks/ecommerce';
import { IMAGES } from './checks/images';
import { INDEXATION } from './checks/indexation';
import { INTERNATIONAL, intlApplicable } from './checks/international';
import { LIENS, MAILLAGE } from './checks/liens';
import { LOCAL } from './checks/local';
import { PERFORMANCE } from './checks/performance';
import { TECHNIQUE } from './checks/technique';
import { normalizePerf } from './perf';
import type { AuditCtx, CheckDef, PerfData, CrawledPage, Finding, SectionId, SeoAuditOptions, SeoReport, Severity, SiteCrawl, SiteType } from './types';
import { addressesIn, allNodes, hostOf, isHtml, norm, phonesIn, textOf, typesOf } from './util';

export type { PerfData, PerfMetrics, SeoReport, SiteType, SeoAuditOptions } from './types';
export { fromSeoDataPerf } from './perf';

export const CHECKS: CheckDef[] = [...INDEXATION, ...TECHNIQUE, ...CONTENU, ...DOUBLONS, ...MAILLAGE, ...LIENS, ...INTERNATIONAL, ...IMAGES, ...DONNEES, ...PERFORMANCE, ...ECOMMERCE, ...LOCAL];

export const SECTIONS: { id: SectionId; label: string; weight: number }[] = [
  { id: 'indexation', label: 'Indexation et exploration', weight: 20 },
  { id: 'technique', label: 'Technique et redirections', weight: 14 },
  { id: 'contenu', label: 'Balises et contenu', weight: 16 },
  { id: 'doublons', label: 'Doublons et cannibalisation', weight: 8 },
  { id: 'maillage', label: 'Maillage interne et pages orphelines', weight: 7 },
  { id: 'liens', label: 'Liens cassés', weight: 8 },
  { id: 'international', label: 'International', weight: 4 },
  { id: 'images', label: 'Images', weight: 5 },
  { id: 'donnees', label: 'Données structurées', weight: 7 },
  { id: 'performance', label: 'Mobile et performance', weight: 11 },
  { id: 'ecommerce', label: 'E-commerce', weight: 12 },
  { id: 'local', label: 'Référencement local', weight: 14 },
];

const SEV_SHARE: Record<Severity, number> = { critical: 0.6, high: 0.35, medium: 0.15, low: 0.04, info: 0 };
const SEV_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
const MAX_AFFECTED = 200;
const ADD_TO_CART = /(ajouter au panier|add to cart|add-to-cart|addtocart|ajout-panier|btn-cart|product-form__submit|single_add_to_cart_button)/i;

const round5 = (x: number) => Math.max(0, Math.min(100, Math.round(x / 5) * 5));

/** Contexte précalculé. */
export function buildCtx(crawl: SiteCrawl, siteType: SiteType = 'pme', perf?: PerfData): AuditCtx {
  const origin = (() => {
    try {
      return new URL(crawl.finalOrigin || crawl.origin).origin;
    } catch {
      return crawl.finalOrigin || crawl.origin;
    }
  })();
  // Redirections que CRAWL n'a pas gardées comme pages (cible déjà explorée) : pages synthétiques « redirigées ».
  const realPages = crawl.pages;
  const known = new Set(realPages.map((p) => norm(p.url)));
  const finals = new Map(realPages.map((p) => [norm(p.finalUrl), p] as const));
  const synthetic = new Set<CrawledPage>();
  for (const r of crawl.redirects ?? []) {
    if (known.has(norm(r.from))) continue;
    const target = finals.get(norm(r.to));
    const last = r.chain[r.chain.length - 1];
    const sp: CrawledPage = target
      ? { ...target, url: r.from, redirectChain: r.chain, depth: target.depth }
      : { url: r.from, finalUrl: r.to, status: r.error ? last?.status ?? 0 : 0, redirectChain: r.chain, depth: -1, bytes: 0, fetchMs: 0, headers: {}, hreflang: [], h1: [], headings: [], wordCount: 0, textHash: '', images: [], jsonLd: [], jsonLdErrors: [], openGraph: {}, internalLinks: 0, externalLinks: 0, isIndexable: false, renderHints: { scriptsCount: 0, textToHtmlRatio: 0, likelyClientRendered: false } };
    synthetic.add(sp);
    known.add(norm(r.from));
  }
  const pages = [...realPages, ...synthetic];
  const byUrl = new Map<string, CrawledPage>();
  // l'URL finale prime (une page redirigée ne masque pas sa destination)
  for (const p of pages) {
    const u = norm(p.url);
    if (u && !byUrl.has(u)) byUrl.set(u, p);
  }
  for (const p of pages) {
    const f = norm(p.finalUrl);
    if (f && (p.redirectChain.length === 0 || !byUrl.has(f))) byUrl.set(f, p);
  }
  const html = realPages.filter((p) => p.status === 200 && !p.blockedByRobots && isHtml(p));
  const linkChecks = new Map<string, NonNullable<SiteCrawl['linkChecks']>[number]>();
  for (const c of crawl.linkChecks ?? []) {
    const k = norm(c.url);
    if (k) linkChecks.set(k, c);
  }
  const internalLinks = crawl.links.filter((l) => l.internal);
  const inlinks = new Map<string, { from: string; anchor: string; rel: string[] }[]>();
  for (const l of internalLinks) {
    const k = norm(l.to);
    if (!k) continue;
    const arr = inlinks.get(k) ?? [];
    arr.push({ from: l.from, anchor: l.anchor, rel: l.rel });
    inlinks.set(k, arr);
  }
  const sitemapSet = new Set(crawl.sitemapUrls.map((u) => norm(u)).filter((u): u is string => !!u));
  const home0 = byUrl.get(norm(crawl.startUrl) ?? '') ?? byUrl.get(`${origin}/`) ?? realPages.find((p) => p.depth === 0);
  const home = home0 && synthetic.has(home0) ? finals.get(norm(home0.finalUrl)) ?? home0 : home0;
  const textCache = new WeakMap<CrawledPage, string>();
  const nodeCache = new WeakMap<CrawledPage, Record<string, unknown>[]>();
  const ctx: AuditCtx = {
    crawl,
    siteType,
    perf,
    origin,
    host: hostOf(origin),
    https: origin.startsWith('https:'),
    pages,
    html,
    indexable: html.filter((p) => p.isIndexable),
    home,
    byUrl,
    inlinks,
    internalLinks,
    sitemapSet,
    siteName: '',
    text(p) {
      let t = textCache.get(p);
      if (t === undefined) {
        t = p.html ? textOf(p.html) : '';
        textCache.set(p, t);
      }
      return t;
    },
    nodes(p) {
      let n = nodeCache.get(p);
      if (!n) {
        n = p.jsonLd.flatMap((b) => allNodes(b));
        nodeCache.set(p, n);
      }
      return n;
    },
    linkChecks,
    imageBytes(src, own) {
      if (own !== undefined) return own;
      const c = linkChecks.get(norm(src) ?? src);
      return c?.kind === 'image' ? c.bytes : undefined;
    },
    isProduct(p) {
      if (ctx.nodes(p).some((n) => typesOf(n).some((t) => t === 'Product' || t === 'ProductGroup'))) {
        // une page liste (ItemList) contenant des produits n'est pas une fiche
        return !ctx.nodes(p).some((n) => typesOf(n).includes('ItemList') || typesOf(n).includes('CollectionPage'));
      }
      if ((p.openGraph['og:type'] ?? '').toLowerCase().includes('product')) return true;
      return /\/(produits?|products?|p|article|fiche)\/[^/]+\/?$/i.test(new URL(p.finalUrl).pathname) && ADD_TO_CART.test(p.html ?? '');
    },
  };
  ctx.siteName = guessSiteName(html, ctx.home);
  return ctx;
}

/** Type de site déduit du crawl (si l'appelant ne le fournit pas). */
export function detectSiteType(crawl: SiteCrawl): SiteType {
  const ctx = buildCtx(crawl);
  const products = ctx.html.filter((p) => ctx.isProduct(p)).length;
  const shopSignals = ctx.html.some((p) => /cdn\.shopify\.com|woocommerce|prestashop|wc-add-to-cart|magento/i.test(p.html ?? ''));
  if (products >= 2 || (products >= 1 && shopSignals) || (shopSignals && ctx.html.some((p) => ADD_TO_CART.test(p.html ?? '')))) return 'ecommerce';
  const types = new Set(ctx.html.flatMap((p) => ctx.nodes(p).flatMap(typesOf)));
  if ([...types].some(isLocalType)) return 'local';
  const sample = ctx.html.slice(0, 20).map((p) => ctx.text(p)).join('\n');
  const local = addressesIn(sample).length > 0 && phonesIn(sample).length > 0 && ctx.html.length <= 60 && /(horaires|ouvert|lundi|mardi|samedi|itin[ée]raire|nous trouver|zone d['’]intervention|devis gratuit)/i.test(sample);
  return local ? 'local' : 'pme';
}

function toFinding(def: CheckDef, hit: NonNullable<ReturnType<CheckDef['run']>>): Finding {
  const items = hit.items;
  const severity = hit.severity ?? def.severity;
  const f: Finding = {
    id: def.id,
    category: def.category,
    severity,
    title: hit.title ?? def.title(items.length),
    why: def.why,
    fix: def.fix,
    affected: items.slice(0, MAX_AFFECTED),
    affectedCount: items.length,
    impact: def.impact,
    effort: def.effort,
  };
  if (hit.autoFix) f.autoFix = hit.autoFix;
  if (hit.evidence) f.evidence = hit.evidence;
  return f;
}

function spread(def: CheckDef, hit: NonNullable<ReturnType<CheckDef['run']>>, ctx: AuditCtx): number {
  if (def.scope === 'site' && hit.base === undefined) return 1;
  const base = hit.base ?? Math.max(1, ctx.html.length);
  const ratio = Math.min(1, hit.items.length / base);
  return 0.35 + 0.65 * Math.min(1, ratio / 0.5);
}

export function priorityOf(f: Finding): number {
  return (SEV_RANK[f.severity] * f.impact) / f.effort;
}

/** Audit SEO complet d'un crawl. */
export function auditSeo(crawl: SiteCrawl, opts: SeoAuditOptions = {}): SeoReport {
  const detected = !opts.siteType;
  const siteType = opts.siteType ?? detectSiteType(crawl);
  const perf = normalizePerf(opts.perf);
  const ctx = buildCtx(crawl, siteType, perf);
  const intl = intlApplicable(ctx);

  const applicable = (s: SectionId) => (s === 'ecommerce' ? siteType === 'ecommerce' : s === 'local' ? siteType === 'local' : s === 'international' ? intl : true);

  const bySection = new Map<SectionId, { finding: Finding; penalty: number; critical: boolean }[]>();
  let checksRun = 0;
  let checksApplicable = 0;
  for (const def of CHECKS) {
    if (!applicable(def.section)) continue;
    if (def.types && !def.types.includes(siteType)) continue;
    checksApplicable++;
    let hit: ReturnType<CheckDef['run']> = null;
    try {
      hit = def.run(ctx);
      checksRun++;
    } catch (e) {
      console.error(`[seoaudit] contrôle ${def.id} en échec`, e);
      continue;
    }
    if (!hit || !hit.items.length) continue;
    const finding = toFinding(def, hit);
    const sp = spread(def, hit, ctx);
    const arr = bySection.get(def.section) ?? [];
    arr.push({ finding, penalty: SEV_SHARE[finding.severity] * sp, critical: finding.severity === 'critical' && sp >= 0.999 });
    bySection.set(def.section, arr);
  }

  const sections = SECTIONS.map((s) => {
    const list = bySection.get(s.id) ?? [];
    const raw = 100 * list.reduce((a, x) => a * (1 - x.penalty), 1);
    const findings = list.map((x) => x.finding).sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.affectedCount - a.affectedCount);
    return { id: s.id, label: s.label, score: round5(raw), findings, weight: s.weight, applicable: applicable(s.id) };
  });

  const app = sections.filter((s) => s.applicable);
  const meanW = app.reduce((a, x) => a + x.weight, 0) / Math.max(1, app.length);
  let global = 100;
  for (const sec of app) for (const x of bySection.get(sec.id) ?? []) global *= 1 - x.penalty * 0.5 * (sec.weight / meanW);
  const hardCritical = [...bySection.values()].flat().some((x) => x.critical);
  if (hardCritical) global = Math.min(global, 40);
  const score = round5(global);

  const all = sections.flatMap((s) => s.findings);
  const topFixes = all
    .filter((f) => f.severity !== 'info')
    .sort((a, b) => priorityOf(b) - priorityOf(a) || SEV_RANK[b.severity] - SEV_RANK[a.severity] || b.affectedCount - a.affectedCount)
    .slice(0, 10);

  const count: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of all) count[f.severity]++;

  return {
    score,
    grade: score >= 80 ? 'bon' : score >= 55 ? 'moyen' : 'faible',
    sections,
    topFixes,
    stats: {
      pagesCrawled: crawl.pages.length,
      htmlPages: ctx.html.length,
      indexablePages: ctx.indexable.length,
      sitemapUrls: crawl.sitemapUrls.length,
      internalLinks: ctx.internalLinks.length,
      checksRun,
      checksApplicable,
      findings: count,
      truncated: crawl.truncated,
      siteType,
      siteTypeDetected: detected,
      perfData: !!perf,
      pagesWithHtml: ctx.html.filter((p) => !!p.html).length,
    },
    method:
      'Chaque problème retire un pourcentage de la note de sa section et de la note globale, selon sa gravité, le nombre de pages touchées et le poids de la section ; les notes sont arrondies à 5 points, la note globale plafonnée à 40 en cas de blocage majeur. Elles mesurent l’état technique et éditorial du site, pas une position dans Google.',
  };
}
