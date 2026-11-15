import { z } from 'zod';
import { jsonError, toolHandler } from '@/lib/siteaudit/api';
import { runHeaders, runHreflang, runIndex, runLinks, runMeta, runOg, runRedirects, runSitemap } from '@/components/tools/v6/run';
import { runDuplicate, runFreshness, runHeadings, runHttps, runImages, runMobile, runRich, runWeight } from '@/components/tools/v7/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const Url = z.object({ url: z.string().trim().min(1).max(2048) });
const TwoUrls = z.object({ url: z.string().trim().min(1).max(2048), url2: z.string().trim().min(1).max(2048) });

/**
 * POST /outils/api/<outil> — outils gratuits V6 (SEO Google). Même enveloppe que /api/tools/* (src/lib/siteaudit/api.ts) :
 * JSON validé par zod, limite par IP et par heure, réponse `{ ok, data | error, code }`. Récupération anti-SSRF via
 * CrawlFetcher (src/components/tools/v6/run.ts, v7/run.ts). Les outils sans réseau (aperçu Google, lisibilité, robots.txt) n'ont
 * pas d'endpoint : ils calculent dans le navigateur.
 */
const HANDLERS: Record<string, (req: Request) => Promise<Response>> = {
  meta: toolHandler(Url, { bucket: 'tools-v6-meta', perHour: 30 }, (b) => runMeta(b.url)),
  indexabilite: toolHandler(Url, { bucket: 'tools-v6-index', perHour: 30 }, (b) => runIndex(b.url)),
  redirections: toolHandler(Url, { bucket: 'tools-v6-redirects', perHour: 20 }, (b) => runRedirects(b.url)),
  'en-tetes': toolHandler(Url, { bucket: 'tools-v6-headers', perHour: 30 }, (b) => runHeaders(b.url)),
  hreflang: toolHandler(Url, { bucket: 'tools-v6-hreflang', perHour: 15 }, (b) => runHreflang(b.url)),
  'open-graph': toolHandler(Url, { bucket: 'tools-v6-og', perHour: 30 }, (b) => runOg(b.url)),
  liens: toolHandler(Url, { bucket: 'tools-v6-links', perHour: 10 }, (b) => runLinks(b.url)),
  sitemap: toolHandler(Url, { bucket: 'tools-v6-sitemap', perHour: 10 }, (b) => runSitemap(b.url)),
  /* V7 (OUTILS-2) : une page illisible renvoie un rapport `access` (marche à suivre), pas une erreur. */
  titres: toolHandler(Url, { bucket: 'tools-v7-headings', perHour: 30 }, (b) => runHeadings(b.url)),
  images: toolHandler(Url, { bucket: 'tools-v7-images', perHour: 15 }, (b) => runImages(b.url)),
  poids: toolHandler(Url, { bucket: 'tools-v7-weight', perHour: 15 }, (b) => runWeight(b.url)),
  mobile: toolHandler(Url, { bucket: 'tools-v7-mobile', perHour: 30 }, (b) => runMobile(b.url)),
  https: toolHandler(Url, { bucket: 'tools-v7-https', perHour: 20 }, (b) => runHttps(b.url)),
  doublons: toolHandler(TwoUrls, { bucket: 'tools-v7-duplicate', perHour: 10 }, (b) => runDuplicate(b.url, b.url2)),
  fraicheur: toolHandler(Url, { bucket: 'tools-v7-freshness', perHour: 30 }, (b) => runFreshness(b.url)),
  'resultats-enrichis': toolHandler(Url, { bucket: 'tools-v7-rich', perHour: 30 }, (b) => runRich(b.url)),
};

export async function POST(req: Request, ctx: { params: Promise<{ outil: string }> }): Promise<Response> {
  const { outil } = await ctx.params;
  const h = Object.prototype.hasOwnProperty.call(HANDLERS, outil) ? HANDLERS[outil] : undefined;
  if (!h) return jsonError(404, 'Outil inconnu.', 'not_found');
  return h(req);
}
