/** Flux RSS des fiches de veille. */
import { veilleRss } from '@/lib/veille';
import { SITE_URL } from '@/lib/seo/site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(veilleRss(SITE_URL), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
