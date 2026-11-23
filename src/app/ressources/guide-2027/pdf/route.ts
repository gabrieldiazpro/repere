import { verifyToken } from '@/lib/newsletter/tokens';
import { renderGuide2027Pdf } from '@/lib/veille/guide2027-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /ressources/guide-2027/pdf?e=&t= — PDF du guide (lien signé reçu par e-mail). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  if (!email || !verifyToken('res-guide-2027', email, url.searchParams.get('t'))) {
    return new Response('Lien incomplet : demandez le guide sur /ressources/guide-2027.', { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
  try {
    const pdf = await renderGuide2027Pdf(email);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="repere-guide-2027.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch (e) {
    console.error('[ressources/guide-2027/pdf]', e);
    return new Response('Le PDF n’a pas pu être généré. Réessayez, ou utilisez la version à imprimer.', { status: 500, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}
