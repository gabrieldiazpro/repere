/**
 * POST /api/v5/crawl — exploration publique d'un site, en flux.
 * Corps : { url, format?: 'ndjson' | 'sse', maxPages?: ≤ 60, checkLinks?: boolean }.
 * Flux : événements { type: 'progress', ... } puis { type: 'result', crawl } (HTML des pages retiré) ou { type: 'error' }.
 * Plafonds publics : 60 pages, 45 s. Limite : 10 explorations par heure et par IP.
 */
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { SafeFetchError } from '@/lib/siteaudit/fetch';
import { jsonError } from '@/lib/siteaudit/api';
import { crawlSite, publicCrawl } from '@/lib/crawl/crawl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const PUBLIC_MAX_PAGES = 60;
const PUBLIC_TIME_BUDGET_MS = 45_000;
const PUBLIC_PER_HOUR = 10;

const Body = z.object({
  url: z.string().trim().min(1).max(2048),
  format: z.enum(['ndjson', 'sse']).optional(),
  maxPages: z.number().int().min(1).max(PUBLIC_MAX_PAGES).optional(),
  checkLinks: z.boolean().optional(),
});

export async function POST(req: Request): Promise<Response> {
  const text = await req.text().catch(() => '');
  if (text.length > 10_000) return jsonError(413, 'Requête trop volumineuse.', 'too_large');
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
  const body = parsed.data;
  const rl = await rateLimit('v5-crawl', getClientIp(req), PUBLIC_PER_HOUR, HOUR_MS, { failClosed: true });
  if (!rl.ok) return jsonError(429, 'Trop d’explorations depuis votre connexion : réessayez dans une heure.', 'rate_limited', { 'Retry-After': String(rl.retryAfter) });

  const sse = body.format === 'sse';
  const enc = new TextEncoder();
  const controller = new AbortController();
  req.signal?.addEventListener('abort', () => controller.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      let closed = false;
      const send = (ev: Record<string, unknown>) => {
        if (closed) return;
        const line = JSON.stringify(ev);
        try {
          ctrl.enqueue(enc.encode(sse ? `event: ${String(ev.type)}\ndata: ${line}\n\n` : `${line}\n`));
        } catch {
          closed = true;
        }
      };
      let last = 0;
      try {
        const crawl = await crawlSite(body.url, {
          maxPages: body.maxPages ?? PUBLIC_MAX_PAGES,
          timeBudgetMs: PUBLIC_TIME_BUDGET_MS,
          concurrency: 4,
          checkLinks: body.checkLinks ?? false,
          signal: controller.signal,
          onProgress: (p) => {
            // Au plus ~10 événements par seconde (sauf changement de phase).
            const now = Date.now();
            if (p.phase === 'pages' && now - last < 100) return;
            last = now;
            send({ type: 'progress', ...p });
          },
        });
        send({ type: 'result', crawl: publicCrawl(crawl) });
      } catch (e) {
        if (e instanceof SafeFetchError) send({ type: 'error', code: e.code, error: e.publicMessage });
        else {
          console.error('[api/v5/crawl]', e);
          send({ type: 'error', code: 'internal', error: 'Exploration impossible pour le moment. Réessayez dans quelques minutes.' });
        }
      } finally {
        closed = true;
        try {
          ctrl.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
    cancel() {
      controller.abort();
    },
  });
  return new Response(stream, {
    headers: {
      'Content-Type': sse ? 'text/event-stream; charset=utf-8' : 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
}
