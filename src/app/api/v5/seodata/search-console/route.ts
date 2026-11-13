/**
 * GET ?businessId= → vue d'ensemble Search Console (28 jours vs 28 précédents, 16 mois mensuels, top requêtes/pages,
 * appareils, pays, sitemaps).
 * POST { businessId, action: 'sync' } → synchronisation immédiate (admin) ; { action: 'inspect', url } → inspection.
 */
import { HttpError } from '@/lib/auth';
import { dispatch } from '@/lib/seodata/jobs';
import { gscOverviewView, inspectView } from '@/lib/seodata/service';
import { access, businessIdOf, errorResponse, json, readBody } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    return json(await gscOverviewView(ctx, p));
  } catch (e) {
    return errorResponse(e, 'seodata.gsc');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const businessId = businessIdOf(body.businessId);
    if (body.action === 'inspect') {
      const { ctx, p } = await access(req, businessId);
      if (typeof body.url !== 'string') throw new HttpError(400, 'url attendue.');
      return json(await inspectView(ctx, p, body.url));
    }
    if (body.action === 'sync') {
      await access(req, businessId, { write: true, minRole: 'admin' });
      const mode = await dispatch('seodata.gsc.sync', { businessId, mode: 'daily' }, { dedupeKey: `gsc-manual:${businessId}:${new Date().toISOString().slice(0, 13)}` });
      return json({ ok: true, mode }, 202);
    }
    throw new HttpError(400, 'Action inconnue.');
  } catch (e) {
    return errorResponse(e, 'seodata.gsc');
  }
}
