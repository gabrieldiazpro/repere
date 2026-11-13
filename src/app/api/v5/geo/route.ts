/**
 * POST /api/v5/geo — audit GEO d'un site exploré (module src/lib/geo).
 * Corps : { crawl: SiteCrawl } (exploration déjà faite, HTML compris) OU { url } (exploration publique : 60 pages, 45 s),
 * + contexte facultatif { brand, siteType, trade, city, questions, facts, engineSources, aiAnswers, llmsTxt, ai }.
 * `ai` (défaut true) : sous-questions et réécritures par le fournisseur d'IA configuré ; sans clé ou `ai:false`, gabarits
 * et règles (rapport marqué `demo`). Réponse : { ok, data: GeoReport }. Limite : 10 analyses par heure et par IP.
 */
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { handleError, jsonError, jsonOk } from '@/lib/siteaudit/api';
import { crawlSite } from '@/lib/crawl/crawl';
import type { SiteCrawl } from '@/lib/crawl/types';
import type { ProviderAnswer } from '@/lib/engine/types';
import { runGeo, type GeoContext } from '@/lib/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_BODY = 25 * 1024 * 1024; // une exploration de 60 pages avec HTML

const Page = z
  .object({
    url: z.string(),
    finalUrl: z.string(),
    status: z.number(),
    depth: z.number(),
    headers: z.record(z.string(), z.string()),
    jsonLd: z.array(z.unknown()),
    jsonLdErrors: z.array(z.string()),
    h1: z.array(z.string()),
    headings: z.array(z.object({ level: z.number(), text: z.string() })),
    renderHints: z.object({ scriptsCount: z.number(), textToHtmlRatio: z.number(), likelyClientRendered: z.boolean() }),
  })
  .passthrough();

const Crawl = z
  .object({
    startUrl: z.string(),
    origin: z.string().url(),
    finalOrigin: z.string().url(),
    robots: z.object({ url: z.string(), status: z.number(), text: z.string().optional(), sitemaps: z.array(z.string()) }).nullable(),
    pages: z.array(Page).max(2000),
  })
  .passthrough();

const Body = z
  .object({
    crawl: Crawl.optional(),
    url: z.string().trim().min(1).max(2048).optional(),
    brand: z.string().trim().max(200).optional(),
    siteType: z.enum(['local', 'pme', 'ecommerce', 'artisan', 'boutique']).optional(),
    trade: z.string().trim().max(120).optional(),
    city: z.string().trim().max(120).optional(),
    questions: z.array(z.string().trim().min(3).max(300)).max(10).optional(),
    facts: z.record(z.string(), z.string().max(2000)).optional(),
    engineSources: z
      .array(
        z.object({
          url: z.string().max(2048).optional(),
          domain: z.string().max(255).optional(),
          title: z.string().max(500).optional(),
          count: z.number().int().min(0).max(100_000).optional(),
          providers: z.array(z.string().max(40)).max(10).optional(),
          clientPresent: z.boolean().nullable().optional(),
        }),
      )
      .max(2000)
      .optional(),
    aiAnswers: z.array(z.object({ provider: z.string(), queryId: z.string(), run: z.number(), text: z.string(), citations: z.array(z.string()), demo: z.boolean() }).passthrough()).max(500).optional(),
    llmsTxt: z.object({ status: z.number(), text: z.string().max(500_000).optional() }).nullable().optional(),
    ai: z.boolean().optional(),
  })
  .refine((b) => !!b.crawl || !!b.url, { message: 'crawl ou url requis' });

export async function POST(req: Request): Promise<Response> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) return jsonError(413, 'Requête trop volumineuse.', 'too_large');
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
  const rl = await rateLimit('v5-geo', getClientIp(req), 10, HOUR_MS, { failClosed: true });
  if (!rl.ok) return jsonError(429, 'Trop d’analyses depuis votre connexion : réessayez dans une heure.', 'rate_limited', { 'Retry-After': String(rl.retryAfter) });
  try {
    const crawl = (b.crawl as unknown as SiteCrawl | undefined) ?? (await crawlSite(b.url as string, { maxPages: 60, timeBudgetMs: 40_000, concurrency: 4 }));
    const ctx: GeoContext = {
      brand: b.brand,
      siteType: b.siteType,
      trade: b.trade,
      city: b.city,
      questions: b.questions,
      facts: b.facts as GeoContext['facts'],
      engineSources: b.engineSources,
      aiAnswers: b.aiAnswers as unknown as ProviderAnswer[] | undefined,
      llmsTxt: b.llmsTxt,
    };
    const report = await runGeo(crawl, ctx, b.ai === false ? { llm: null } : { timeoutMs: 15_000 });
    return jsonOk(report);
  } catch (e) {
    return handleError(e, 'v5-geo');
  }
}
