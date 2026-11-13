/**
 * GET ?businessId= → requêtes et trafic Bing (clé API du client).
 * POST { businessId, apiKey } → vérifie et enregistre la clé (chiffrée). DELETE ?businessId= → déconnexion.
 */
import { HttpError } from '@/lib/auth';
import { connectBing, disconnectBing } from '@/lib/seodata/bing';
import { bingView } from '@/lib/seodata/service';
import { access, businessIdOf, errorResponse, json, readBody } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    return json(await bingView(ctx, p));
  } catch (e) {
    return errorResponse(e, 'seodata.bing');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const { ctx } = await access(req, businessIdOf(body.businessId), { write: true, minRole: 'admin' });
    if (typeof body.apiKey !== 'string' || !body.apiKey.trim()) throw new HttpError(400, 'Clé API attendue.');
    if (!ctx.domain) throw new HttpError(400, 'Renseignez d’abord l’adresse du site.');
    return json({ connected: true, ...(await connectBing(ctx.businessId, body.apiKey, ctx.domain)) });
  } catch (e) {
    return errorResponse(e, 'seodata.bing');
  }
}

export async function DELETE(req: Request) {
  try {
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    await access(req, businessId, { write: true, minRole: 'admin' });
    await disconnectBing(businessId);
    return json({ connected: false });
  } catch (e) {
    return errorResponse(e, 'seodata.bing');
  }
}
