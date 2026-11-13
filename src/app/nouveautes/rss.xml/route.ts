/** Flux RSS du journal des nouveautés. */
import { changelogRss } from '@/components/pages/changelog';
import { SITE_URL } from '@/lib/seo/site';

export const dynamic = 'force-static';

export function GET() {
  return new Response(changelogRss(SITE_URL.replace(/\/$/, '')), {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
