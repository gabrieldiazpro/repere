/**
 * GET ?businessId= → mots-clés suivis (volumes, difficulté) et concurrents choisis.
 * POST { businessId, action: 'add' | 'remove', keywords: string[] } ou { action: 'competitors', domains: string[] }.
 */
import { HttpError } from '@/lib/auth';
import { addKeywords, getRankConfig, removeKeywords, setCompetitors } from '@/lib/seodata/rank';
import { access, businessIdOf, errorResponse, json, readBody, stringList } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { ctx, p } = await access(req, businessIdOf(new URL(req.url).searchParams.get('businessId')));
    const config = await getRankConfig(ctx);
    const kw = p.statuses.find((s) => s.kind === 'keywords');
    return json({ demo: Boolean(ctx.demoId), limit: ctx.limits.keywords, keywords: config.keywords, competitors: config.competitors, volumes: kw });
  } catch (e) {
    return errorResponse(e, 'seodata.keywords');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const { ctx, p } = await access(req, businessIdOf(body.businessId), { write: true });
    switch (body.action) {
      case 'add': {
        const r = await addKeywords(ctx, stringList(body.keywords, 500), body.source === 'search-console' || body.source === 'labs' ? body.source : 'manual', p.keywords);
        return json({ added: r.added, skipped: r.skipped, keywords: r.config.keywords, limit: ctx.limits.keywords });
      }
      case 'remove':
        return json({ keywords: (await removeKeywords(ctx, stringList(body.keywords, 2000))).keywords });
      case 'competitors':
        return json({ competitors: (await setCompetitors(ctx, stringList(body.domains, 20))).competitors });
      default:
        throw new HttpError(400, 'Action inconnue.');
    }
  } catch (e) {
    return errorResponse(e, 'seodata.keywords');
  }
}
