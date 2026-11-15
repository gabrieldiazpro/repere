/**
 * POST /api/ops/errors — erreurs du navigateur (src/lib/ops/client.ts). Public, borné : 30 rapports par heure et
 * par IP, corps ≤ 8 Ko, champs tronqués, aucune donnée personnelle attendue (adresses et jetons masqués à
 * l'écriture). Réponse 204 dans tous les cas (rien à apprendre pour un curieux).
 * Journalise via captureError (→ Sentry si SENTRY_DSN) ; le stockage interne la regroupe par signature.
 *
 * GET /api/ops/errors — groupes d'erreurs (admin ou Bearer CRON_SECRET).
 */
import { NextResponse } from 'next/server';
import { captureError } from '@/lib/log';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { listErrorGroups, opsAuthorized, recordError } from '@/lib/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 8 * 1024;
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined);

export async function POST(req: Request) {
  const done = new Response(null, { status: 204 });
  const rl = await rateLimit('ops-client-errors', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return done;
  try {
    const text = (await req.text()).slice(0, MAX + 1);
    if (text.length > MAX) return done;
    const o = JSON.parse(text) as Record<string, unknown>;
    const message = s(o.message, 500);
    if (!message) return done;
    let route: string | undefined;
    try {
      const u = new URL(s(o.url, 300) ?? '');
      route = u.pathname; // l'origine et la requête ne sont pas gardées
    } catch {
      route = undefined;
    }
    const err = new Error(message);
    err.name = s(o.name, 100) ?? 'Error';
    err.stack = s(o.stack, 3000);
    const kind = s(o.kind, 20) ?? 'boundary';
    captureError(err, { event: `client.${kind}`, route, digest: s(o.digest, 64), boundary: s(o.boundary, 80) });
    // Si l'observation de console n'est pas installée (tests, scripts), enregistrement direct.
    await recordError({ source: 'client', name: err.name, message, stack: err.stack, route, event: `client.${kind}`, digest: s(o.digest, 64) });
  } catch {
    /* rapport illisible : ignoré */
  }
  return done;
}

export async function GET(req: Request) {
  if (!opsAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const limit = Math.min(200, Math.max(1, Number(new URL(req.url).searchParams.get('limit')) || 50));
  return NextResponse.json({ groups: await listErrorGroups(limit) }, { headers: { 'cache-control': 'no-store' } });
}
