/**
 * GET ?businessId=&weeks=26 → rapport de positions (variations, visibilité, part de visibilité, concurrents, aperçu IA).
 * POST { businessId } → lance le relevé de la semaine s'il n'existe pas encore (admin ; idempotent par semaine).
 */
import { dispatch } from '@/lib/seodata/jobs';
import { weekKey } from '@/lib/seodata/http';
import { buildReport, getRankConfig, rankHistory } from '@/lib/seodata/rank';
import { access, businessIdOf, errorResponse, json, readBody } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const { ctx, p } = await access(req, businessIdOf(q.get('businessId')));
    const weeks = Math.min(104, Math.max(2, Number(q.get('weeks')) || 26));
    const [config, history] = await Promise.all([getRankConfig(ctx), rankHistory(ctx, p, weeks)]);
    const serp = p.statuses.find((s) => s.kind === 'serp');
    return json({ provider: serp, report: buildReport(ctx, config, history), weeks: history.map((h) => ({ week: h.week, status: h.status, takenAt: h.takenAt })) });
  } catch (e) {
    return errorResponse(e, 'seodata.rankings');
  }
}

export async function POST(req: Request) {
  try {
    const body = await readBody(req);
    const businessId = businessIdOf(body.businessId);
    const { p } = await access(req, businessId, { write: true, minRole: 'admin' });
    const serp = p.statuses.find((s) => s.kind === 'serp');
    if (serp?.state !== 'live') return json({ error: serp?.reason ?? 'Non configuré.', code: 'not_configured' }, 503);
    const mode = await dispatch('seodata.rank.weekly', { businessId }, { dedupeKey: `rank:${businessId}:${weekKey()}` });
    return json({ ok: true, mode, week: weekKey() }, 202);
  } catch (e) {
    return errorResponse(e, 'seodata.rankings');
  }
}
