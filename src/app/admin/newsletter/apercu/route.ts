import { issueDeadlines, resolveEntries, todayParis } from '@/lib/newsletter/issue';
import { renderIssueEmail } from '@/lib/newsletter/emails';
import { getIssue } from '@/lib/newsletter/store';
import { adminFromRequest } from '../_auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /admin/newsletter/apercu?id= — aperçu HTML exact d'un numéro (destinataire fictif). */
export async function GET(req: Request) {
  if (!adminFromRequest(req)) return new Response('Non autorisé', { status: 401 });
  const id = new URL(req.url).searchParams.get('id') || '';
  const issue = await getIssue(id);
  if (!issue) return new Response('Numéro introuvable', { status: 404 });
  const { html } = renderIssueEmail({ issue, entries: resolveEntries(issue.entrySlugs), deadlines: issueDeadlines(todayParis()), to: 'apercu@exemple.fr' });
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src data:" },
  });
}
