/**
 * GET ?businessId= → état de la connexion et propriétés accordées (sans jeton).
 * POST { businessId, siteUrl } (admin) → choix de la propriété, puis import des 16 mois.
 */
import { HttpError } from '@/lib/auth';
import { chooseProperty, connectionView, getConnection } from '@/lib/seodata/google-oauth';
import { dispatch } from '@/lib/seodata/jobs';
import { access, businessIdOf, errorResponse, json, readBody } from '../../../seodata/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    await access(req, businessId);
    return json(connectionView(await getConnection(businessId)));
  } catch (e) {
    return errorResponse(e, 'connect.google.properties');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const businessId = businessIdOf(body.businessId);
    await access(req, businessId, { write: true, minRole: 'admin' });
    if (typeof body.siteUrl !== 'string' || body.siteUrl.length > 300) throw new HttpError(400, 'siteUrl attendu.');
    const c = await chooseProperty(businessId, body.siteUrl);
    const mode = c.importedAt ? 'none' : await dispatch('seodata.gsc.sync', { businessId, mode: 'import' }, { dedupeKey: `gsc-import:${businessId}:${c.siteUrl}:${c.connectedAt}` });
    return json({ ...connectionView(c), import: mode });
  } catch (e) {
    return errorResponse(e, 'connect.google.properties');
  }
}
