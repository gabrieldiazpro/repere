/** GET ?businessId= → fournisseurs (réel / démo / non configuré), connexion Search Console, limites et budget du mois. */
import { statusView } from '@/lib/seodata/service';
import { access, businessIdOf, errorResponse, json } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    return json(await statusView(ctx, p));
  } catch (e) {
    return errorResponse(e, 'seodata.status');
  }
}
