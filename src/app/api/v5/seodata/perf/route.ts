/** GET ?businessId=&url=&device=mobile|desktop → PerfData (PageSpeed Insights + CrUX), pages du site du compte seulement. */
import { perfView } from '@/lib/seodata/service';
import type { Device } from '@/lib/seodata/types';
import { access, businessIdOf, errorResponse, json } from '../_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams;
    const { ctx, p } = await access(req, businessIdOf(q.get('businessId')));
    const d = q.get('device');
    const devices: Device[] | undefined = d === 'mobile' || d === 'desktop' ? [d] : undefined;
    return json(await perfView(ctx, p, q.get('url'), devices));
  } catch (e) {
    return errorResponse(e, 'seodata.perf');
  }
}
