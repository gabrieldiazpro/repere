import { NextResponse } from 'next/server';
import { unsubscribe } from '@/lib/newsletter/store';
import { verifyToken } from '@/lib/newsletter/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  if (!email || !verifyToken('nl-unsub', email, url.searchParams.get('t'))) return false;
  await unsubscribe(email);
  return true;
}

/**
 * Désinscription de la lettre en un clic.
 * - GET : lien du pied de la lettre → désinscription immédiate (aucune confirmation demandée), puis page /veille/lettre.
 * - POST : RFC 8058 (List-Unsubscribe-Post), serveur à serveur.
 * Les en-têtes List-Unsubscribe posés par sendEmail pointent vers /api/unsubscribe (liste d'opposition générale).
 */
export async function GET(req: Request) {
  const back = new URL('/veille/lettre', req.url);
  try {
    back.searchParams.set('etat', (await handle(req)) ? 'desinscrit' : 'lien-invalide');
  } catch (e) {
    console.error('[api/newsletter/unsubscribe]', e);
    back.searchParams.set('etat', 'erreur');
  }
  return NextResponse.redirect(back, 303);
}

export async function POST(req: Request) {
  try {
    const ok = await handle(req);
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  } catch (e) {
    console.error('[api/newsletter/unsubscribe]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
