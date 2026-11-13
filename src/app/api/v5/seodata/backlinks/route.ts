/** GET ?businessId= → liens entrants (résumé, domaines référents, ancres, nouveaux / perdus sur 12 mois ; cache mensuel). */
import { backlinksView } from '@/lib/seodata/service';
import { access, businessIdOf, errorResponse, json } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    return json(await backlinksView(ctx, p));
  } catch (e) {
    return errorResponse(e, 'seodata.backlinks');
  }
}
