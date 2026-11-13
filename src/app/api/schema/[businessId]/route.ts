import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { jsonLdScriptTag, jsonLdString, schemaForBusiness } from '@/lib/execution';
import { BUSINESS_ID_RE } from '@/lib/execution/auth';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ businessId: string }> };

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };
const CACHE = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400';

/**
 * GET /api/schema/[businessId] — JSON-LD du commerce, rendu côté serveur, mis en cache.
 * - `?format=json` (défaut) : application/ld+json (consommé par le plugin WordPress) ;
 * - `?format=script` : bloc <script type="application/ld+json"> statique à coller dans le <head> ;
 * - `?format=js` : secours, injection par JavaScript (lue par Google, PAS par les robots IA) ;
 * - `&faq=1` : inclut la FAQPage (uniquement si la FAQ est visible sur la page qui porte le balisage).
 */
export async function GET(req: Request, { params }: Ctx) {
  const { businessId } = await params;
  if (!BUSINESS_ID_RE.test(businessId)) return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400, headers: CORS });
  const rl = await rateLimit('schema', getClientIp(req), 600, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429, headers: CORS });
  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'json';
  const withFaq = url.searchParams.get('faq') === '1';
  let data: Record<string, unknown> | null;
  try {
    data = await schemaForBusiness(businessId, { withFaq });
  } catch (e) {
    console.error('[api/schema]', e);
    return NextResponse.json({ error: 'Indisponible.' }, { status: 503, headers: CORS });
  }
  if (!data) return NextResponse.json({ error: 'Balisage introuvable.' }, { status: 404, headers: CORS });

  const json = jsonLdString(data);
  const etag = `"${crypto.createHash('sha1').update(`${format}:${json}`).digest('hex').slice(0, 20)}"`;
  const headers: Record<string, string> = { ...CORS, 'Cache-Control': CACHE, ETag: etag, 'X-Robots-Tag': 'noindex' };
  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  if (format === 'script') return new Response(jsonLdScriptTag(data), { headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  if (format === 'js') {
    const js = `/* Repéré — secours : ce balisage est lu par Google, pas par les robots IA (sans JavaScript). Préférez le bloc statique ou le plugin. */\n(function(){var s=document.createElement('script');s.type='application/ld+json';s.text=${JSON.stringify(json)};document.head.appendChild(s);})();`;
    return new Response(js, { headers: { ...headers, 'Content-Type': 'application/javascript; charset=utf-8' } });
  }
  return new Response(json, { headers: { ...headers, 'Content-Type': 'application/ld+json; charset=utf-8' } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
