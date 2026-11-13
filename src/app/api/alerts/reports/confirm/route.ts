/** /api/alerts/reports/confirm?token= — confirmation d'un destinataire (double opt-in). Page HTML simple. */
import { confirmRecipient } from '@/lib/notify';
import { esc } from '@/lib/email';
import { getClientIp, rateLimit, HOUR_MS } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function page(title: string, text: string, status = 200): Response {
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F6F7FB;color:#1B1F2E"><main style="max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<h1 style="font-size:22px;margin:0 0 12px">${esc(title)}</h1><p style="font-size:16px;line-height:1.6;margin:0">${esc(text)}</p></main></body></html>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

/**
 * GET : n'écrit rien (les antivirus de messagerie ouvrent les liens : M3 de qa/v3/securite-v3.md), affiche un bouton.
 * POST (formulaire) : confirme le destinataire.
 */
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').slice(0, 1000);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Confirmer votre adresse</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#F6F7FB;color:#1B1F2E"><main style="max-width:520px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<h1 style="font-size:22px;margin:0 0 12px">Recevoir les rapports ?</h1><p style="font-size:16px;line-height:1.6;margin:0 0 18px">Confirmez que vous souhaitez recevoir les rapports de visibilité dans les IA envoyés par Repéré. Vous pourrez vous désinscrire à tout moment.</p>
<form method="post"><input type="hidden" name="token" value="${esc(token)}"><button type="submit" style="font-size:16px;padding:10px 16px;border-radius:10px;border:0;background:#1B1F2E;color:#fff;cursor:pointer">Oui, je confirme mon adresse</button></form></main></body></html>`;
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}

export async function POST(req: Request) {
  const rl = await rateLimit('report-confirm', getClientIp(req), 30, HOUR_MS);
  if (!rl.ok) return page('Trop de tentatives', 'Réessayez dans une heure.', 429);
  const form = await req.formData().catch(() => null);
  const token = String(form?.get('token') ?? '').slice(0, 1000);
  const r = await confirmRecipient(token).catch(() => ({ ok: false as const, businessName: undefined }));
  if (!r.ok) return page('Lien invalide', 'Ce lien de confirmation est invalide, expiré, ou l’adresse a été retirée des destinataires.', 400);
  return page('Adresse confirmée', `Vous recevrez désormais les rapports de visibilité dans les IA${r.businessName ? ` de ${r.businessName}` : ''}. Chaque e-mail contient un lien de désinscription.`);
}
