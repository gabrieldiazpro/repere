import { NextResponse } from 'next/server';
import { confirmSubscription } from '@/lib/newsletter/store';
import { verifyToken } from '@/lib/newsletter/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/newsletter/confirm?e=&t= — lien de l'e-mail de confirmation (double opt-in), puis page /veille/lettre. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t');
  const back = new URL('/veille/lettre', req.url);
  if (!email || !verifyToken('nl-confirm', email, token)) {
    back.searchParams.set('etat', 'lien-invalide');
    return NextResponse.redirect(back, 303);
  }
  try {
    const r = await confirmSubscription(email);
    back.searchParams.set('etat', r === 'confirmed' ? 'confirme' : r === 'already' ? 'deja-inscrit' : 'lien-expire');
  } catch (e) {
    console.error('[api/newsletter/confirm]', e);
    back.searchParams.set('etat', 'erreur');
  }
  return NextResponse.redirect(back, 303);
}
