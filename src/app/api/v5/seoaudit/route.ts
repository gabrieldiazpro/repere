/**
 * POST /api/v5/seoaudit — audit SEO d'un site (route mince autour de `auditSeo`).
 * Corps : { url } (on explore le site avec crawlSite, plafonds publics) OU { crawl: SiteCrawl } (déjà exploré),
 *         + siteType? ('local' | 'pme' | 'ecommerce', sinon détecté) + perf? (PerfData de SEO-DATA ou forme minimale).
 * Réponse : { ok: true, data: SeoReport } ; erreurs { ok: false, error, code }.
 * Limites par IP : 10 explorations/heure (mode url), 60 audits/heure (mode crawl).
 * Note : un crawl passé par publicCrawl() n'a plus le HTML ; les contrôles qui relisent le HTML sont alors ignorés
 * (stats.pagesWithHtml le dit) — on ne signale jamais un défaut qu'on n'a pas pu vérifier.
 */
import { z } from 'zod';
import { crawlSite } from '@/lib/crawl';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { auditSeo } from '@/lib/seoaudit';
import type { SeoAuditOptions, SiteCrawl } from '@/lib/seoaudit/types';
import { handleError, jsonError, jsonOk } from '@/lib/siteaudit/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY = 12 * 1024 * 1024;
const PUBLIC_MAX_PAGES = 60;
const PUBLIC_TIME_BUDGET_MS = 45_000;

const Page = z
  .object({
    url: z.string(),
    finalUrl: z.string(),
    status: z.number(),
    redirectChain: z.array(z.object({ url: z.string(), status: z.number() })),
    depth: z.number(),
    bytes: z.number(),
    fetchMs: z.number(),
    headers: z.record(z.string(), z.string()),
    hreflang: z.array(z.object({ lang: z.string(), href: z.string() })),
    h1: z.array(z.string()),
    headings: z.array(z.object({ level: z.number(), text: z.string() })),
    wordCount: z.number(),
    textHash: z.string(),
    images: z.array(z.object({ src: z.string() }).passthrough()),
    jsonLd: z.array(z.unknown()),
    jsonLdErrors: z.array(z.string()),
    openGraph: z.record(z.string(), z.string()),
    internalLinks: z.number(),
    externalLinks: z.number(),
    isIndexable: z.boolean(),
    renderHints: z.object({ scriptsCount: z.number(), textToHtmlRatio: z.number(), likelyClientRendered: z.boolean() }),
  })
  .passthrough();

const Crawl = z
  .object({
    startUrl: z.string(),
    origin: z.string(),
    finalOrigin: z.string(),
    truncated: z.boolean(),
    robots: z.object({ url: z.string(), status: z.number(), text: z.string().optional(), sitemaps: z.array(z.string()) }).nullable(),
    sitemaps: z.array(z.object({ url: z.string(), status: z.number(), urlCount: z.number(), errors: z.array(z.string()) })),
    sitemapUrls: z.array(z.string()).max(10_000),
    pages: z.array(Page).min(1).max(2_000),
    links: z.array(z.object({ from: z.string(), to: z.string(), anchor: z.string(), rel: z.array(z.string()), internal: z.boolean() })).max(200_000),
    errors: z.array(z.object({ url: z.string(), error: z.string() })),
  })
  .passthrough();

const Body = z
  .object({
    url: z.string().trim().min(1).max(2048).optional(),
    crawl: Crawl.optional(),
    siteType: z.enum(['local', 'pme', 'ecommerce']).optional(),
    perf: z.unknown().optional(),
    checkLinks: z.boolean().optional(),
  })
  .refine((b) => !!b.url !== !!b.crawl, { message: 'indiquez soit « url », soit « crawl »' });

export async function POST(req: Request): Promise<Response> {
  const text = await req.text().catch(() => '');
  if (text.length > MAX_BODY) return jsonError(413, 'Requête trop volumineuse.', 'too_large');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return jsonError(400, 'Requête invalide : JSON attendu.', 'bad_request');
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return jsonError(400, `Requête invalide${first ? ` (${first.path.join('.') || 'corps'} : ${first.message})` : ''}.`, 'bad_request');
  }
  const b = parsed.data;
  const ip = getClientIp(req);
  const rl = b.url
    ? await rateLimit('v5-seoaudit-crawl', ip, 10, HOUR_MS, { failClosed: true })
    : await rateLimit('v5-seoaudit', ip, 60, HOUR_MS);
  if (!rl.ok) return jsonError(429, 'Trop d’audits depuis votre connexion : réessayez dans une heure.', 'rate_limited', { 'Retry-After': String(rl.retryAfter) });

  try {
    const crawl: SiteCrawl = b.crawl
      ? (b.crawl as unknown as SiteCrawl)
      : await crawlSite(b.url!, { maxPages: PUBLIC_MAX_PAGES, timeBudgetMs: PUBLIC_TIME_BUDGET_MS, concurrency: 4, checkLinks: b.checkLinks ?? false, signal: req.signal });
    const report = auditSeo(crawl, { siteType: b.siteType, perf: b.perf as SeoAuditOptions['perf'] });
    return jsonOk(report);
  } catch (e) {
    return handleError(e, 'v5/seoaudit');
  }
}
