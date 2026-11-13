import { NextResponse } from 'next/server';
import { addSuppression } from '@/lib/db';
import { BRAND, appUrl, esc, verifyUnsubscribeToken } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Désinscription en un clic (docs/06-juridique.md, E6/E7).
 * - GET  : lien cliqué dans l'e-mail → inscription sur la liste d'opposition + page de confirmation.
 * - POST : « List-Unsubscribe-Post: List-Unsubscribe=One-Click » (Gmail, Yahoo…).
 * L'adresse est stockée hachée (SHA-256), la liste n'est jamais vidée.
 */
async function handle(req: Request): Promise<{ ok: boolean; email: string }> {
  const url = new URL(req.url);
  const email = (url.searchParams.get('e') || '').trim().toLowerCase();
  const token = url.searchParams.get('t') || '';
  if (!email || !verifyUnsubscribeToken(email, token)) return { ok: false, email };
  await addSuppression(email);
  return { ok: true, email };
}

function page(title: string, text: string, status: number) {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · ${esc(BRAND)}</title></head>
<body style="margin:0;background:#F6F7FB;font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1B1F2E">
<main style="max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<p style="margin:0 0 12px;font-weight:700;color:#3730A3">${esc(BRAND)}</p>
<h1 style="margin:0 0 12px;font-size:22px">${esc(title)}</h1>
<p style="margin:0 0 20px;line-height:1.6">${esc(text)}</p>
<a href="${esc(appUrl())}" style="color:#3730A3">Retour au site</a>
</main></body></html>`;
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function GET(req: Request) {
  try {
    const { ok } = await handle(req);
    if (!ok) return page('Lien invalide', 'Ce lien de désinscription est incomplet. Répondez « STOP » à notre e-mail : nous vous retirerons à la main.', 400);
    return page(
      'Vous êtes désinscrit',
      'Vous ne recevrez plus nos e-mails de conseils. Si vous êtes abonné, vos alertes mensuelles sont aussi arrêtées : pour les conserver, écrivez-nous. Les messages strictement liés à un paiement en cours peuvent encore vous parvenir.',
      200,
    );
  } catch (e) {
    console.error('[api/unsubscribe]', e);
    return page('Erreur temporaire', 'Réessayez dans un instant, ou répondez « STOP » à notre e-mail.', 500);
  }
}

export async function POST(req: Request) {
  try {
    const { ok } = await handle(req);
    return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
  } catch (e) {
    console.error('[api/unsubscribe]', e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
