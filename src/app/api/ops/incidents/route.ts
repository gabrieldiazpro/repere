/**
 * Incidents publics (/statut), réservés à l'admin.
 *
 * GET  /api/ops/incidents                     → { incidents }
 * POST /api/ops/incidents  (formulaire ou JSON)
 *   action=create  title, impact (maintenance|mineur|majeur), services (site, analyses, paiement, emails, donnees), text
 *   action=update  id, text
 *   action=resolve id, text?
 * Un envoi de formulaire (/admin/ops) est redirigé vers /admin/ops ; un appel JSON reçoit du JSON.
 */
import { NextResponse } from 'next/server';
import { createIncident, listIncidents, opsAuthorized, sameOrigin, updateIncident } from '@/lib/ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!opsAuthorized(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  return NextResponse.json({ incidents: await listIncidents(365) }, { headers: { 'cache-control': 'no-store' } });
}

async function readBody(req: Request): Promise<{ form: boolean; get: (k: string) => string; all: (k: string) => string[] }> {
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const o = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
    return {
      form: false,
      get: (k) => (typeof o[k] === 'string' ? (o[k] as string) : ''),
      all: (k) => (Array.isArray(o[k]) ? (o[k] as unknown[]).filter((x): x is string => typeof x === 'string') : typeof o[k] === 'string' ? [o[k] as string] : []),
    };
  }
  const f = await req.formData();
  return { form: true, get: (k) => String(f.get(k) ?? ''), all: (k) => f.getAll(k).map(String) };
}

export async function POST(req: Request) {
  if (!opsAuthorized(req) || !sameOrigin(req)) return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  const b = await readBody(req);
  const back = (msg: string, status = 303) => NextResponse.redirect(new URL(`/admin/ops?${msg}#incidents`, req.url), status);
  try {
    const action = b.get('action') || 'create';
    if (action === 'create') {
      const inc = await createIncident({ title: b.get('title'), impact: b.get('impact'), services: b.all('services'), text: b.get('text') });
      return b.form ? back('incident=cree') : NextResponse.json({ incident: inc }, { status: 201 });
    }
    if (action === 'update' || action === 'resolve') {
      const inc = await updateIncident(b.get('id'), { text: b.get('text'), resolve: action === 'resolve' });
      if (!inc) return b.form ? back('incident=introuvable') : NextResponse.json({ error: 'Incident introuvable.' }, { status: 404 });
      return b.form ? back(`incident=${action === 'resolve' ? 'resolu' : 'mis-a-jour'}`) : NextResponse.json({ incident: inc });
    }
    return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erreur.';
    return b.form ? back(`incident=erreur&message=${encodeURIComponent(msg)}`) : NextResponse.json({ error: msg }, { status: 400 });
  }
}
