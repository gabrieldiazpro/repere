/**
 * POST /api/v5/roi/hit { p, r?, u? } — visite d'une page /barometre/** (ROI des baromètres, /admin/roi).
 * p = chemin, r = referrer (seul le domaine est gardé), u = utm_source. Même règles que la mesure d'audience du site :
 * aucun cookie, aucun identifiant, IP utilisée seulement pour un compteur anti-abus en mémoire (hachée), totaux par mois.
 * Origine étrangère ou chemin hors baromètres : ignoré (204, rien n'est écrit).
 */
import { trackRateLimit } from '@/lib/tracking/handlers';
import { recordBarometreVisit } from '@/lib/roi/visits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 1024;
const none = (status = 204) => new Response(null, { status, headers: { 'cache-control': 'no-store' } });

function sameOrigin(req: Request): string | null {
  const origin = req.headers.get('origin');
  if (!origin) return null;
  try {
    const o = new URL(origin);
    const self = new URL(req.url);
    const app = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '';
    const allowed = [self.host, app ? new URL(app).host : ''].filter(Boolean);
    return allowed.includes(o.host) ? o.hostname : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request): Promise<Response> {
  if (!trackRateLimit(req, 'roi-hit', 60)) return none(429);
  if (Number(req.headers.get('content-length') || 0) > MAX) return none(413);
  const selfHost = sameOrigin(req);
  if (!selfHost) return none();
  let o: Record<string, unknown>;
  try {
    const text = await req.text();
    if (text.length > MAX) return none(413);
    o = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return none(400);
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return none(400);
  const s = (v: unknown, n: number) => (typeof v === 'string' ? v.slice(0, n) : '');
  try {
    await recordBarometreVisit({ path: s(o.p, 200), referrer: s(o.r, 300) || null, utmSource: s(o.u, 60) || null, selfHost });
  } catch (e) {
    console.error('[api/v5/roi/hit]', (e as Error).message);
  }
  return none();
}
