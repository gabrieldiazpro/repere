/** GET ?businessId= → mots-clés à suivre (Search Console « à portée de main » + mots-clés positionnés Labs). */
import { suggestKeywords } from '@/lib/seodata/rank';
import { access, businessIdOf, errorResponse, json } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    return json({ demo: Boolean(ctx.demoId), ...(await suggestKeywords(ctx, p)) });
  } catch (e) {
    return errorResponse(e, 'seodata.suggestions');
  }
}
