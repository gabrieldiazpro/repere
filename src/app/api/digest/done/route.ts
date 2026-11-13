/**
 * « C'est fait » depuis l'e-mail du lundi (lien signé HMAC valable 14 jours, src/lib/digest/sign.ts).
 * - GET /api/digest/done?token=… : page de confirmation SANS effet de bord (un antivirus ou un aperçu de lien
 *   ouvre les liens des e-mails) ; elle porte un bouton qui envoie le POST.
 * - POST /api/digest/done (formulaire, champ `token`) : marque la tâche via updateTaskStatus (module EXECUTION).
 * Idempotent : un second envoi confirme simplement que la tâche est déjà faite.
 */
import { verifyDoneToken } from '@/lib/digest';
import { listTasks, updateTaskStatus } from '@/lib/digest/deps';
import { appUrl, esc } from '@/lib/email';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { onTaskDone } from '@/lib/measure';
import { getClientIp, HOUR_MS, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
};

function page(status: number, title: string, message: string, form?: { token: string; label: string }): Response {
  const app = `${appUrl()}/app`;
  const action = form
    ? `<form method="post" action="/api/digest/done" style="margin:0 0 14px"><input type="hidden" name="token" value="${esc(form.token)}"><button type="submit" style="padding:11px 18px;border:0;border-radius:10px;background:#3730A3;color:#fff;font:inherit;font-weight:600;cursor:pointer">${esc(form.label)}</button></form>
<a href="${esc(app)}" style="color:#3730A3">Ouvrir mon espace</a>`
    : `<a href="${esc(app)}" style="display:inline-block;padding:11px 18px;border-radius:10px;background:#3730A3;color:#fff;text-decoration:none;font-weight:600">Ouvrir mon espace</a>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;background:#F6F7FB;font-family:Inter,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#1B1F2E">
<main style="max-width:480px;margin:12vh auto;padding:28px;background:#fff;border:1px solid #D5D9E4;border-radius:14px">
<p style="margin:0 0 6px;font-weight:700;color:#3730A3">Repéré</p>
<h1 style="margin:0 0 10px;font-size:22px">${esc(title)}</h1>
<p style="margin:0 0 20px;line-height:1.55">${esc(message)}</p>
${action}
</main></body></html>`;
  return new Response(html, { status, headers: HEADERS });
}

const INVALID = (): Response =>
  page(400, 'Lien expiré ou invalide', 'Ce lien n’est plus valable (il expire au bout de 14 jours). Vous pouvez cocher la tâche directement dans votre espace.');

/** Confirmation : n'écrit rien. */
export async function GET(req: Request) {
  const rl = await rateLimit('digest-done', getClientIp(req), 120, HOUR_MS);
  if (!rl.ok) return page(429, 'Trop de tentatives', 'Réessayez dans quelques minutes.');
  const token = new URL(req.url).searchParams.get('token');
  const payload = verifyDoneToken(token);
  if (!payload || !token) return INVALID();
  const task = (await listTasks(payload.businessId).catch(() => [])).find((t) => t.id === payload.taskId);
  if (task?.status === 'done') return page(200, 'Déjà fait', `« ${task.title} » est déjà marquée comme faite. Merci !`);
  const what = task ? `« ${task.title} »` : 'cette tâche';
  return page(200, 'Confirmer la tâche', `Confirmez-vous avoir fait ${what} ?`, { token, label: 'Oui, c’est fait' });
}

/** Enregistrement (bouton de la page de confirmation). */
export async function POST(req: Request) {
  const rl = await rateLimit('digest-done', getClientIp(req), 120, HOUR_MS);
  if (!rl.ok) return page(429, 'Trop de tentatives', 'Réessayez dans quelques minutes.');
  let token: string | null = null;
  const type = req.headers.get('content-type') ?? '';
  try {
    if (type.includes('application/json')) token = ((await req.json()) as { token?: unknown }).token as string;
    else token = String((await req.formData()).get('token') ?? '');
  } catch {
    token = null;
  }
  const payload = verifyDoneToken(typeof token === 'string' ? token : null);
  if (!payload) return INVALID();
  // Comptes démo publics : lecture seule (E1).
  if (isDemoBusinessId(payload.businessId)) {
    return page(403, 'Compte de démonstration', 'Les comptes de démonstration ne sont pas modifiables. Dans votre espace, ce bouton marque la tâche comme faite.');
  }
  try {
    const task = await updateTaskStatus(payload.businessId, payload.taskId, 'done');
    if (!task) return page(404, 'Tâche introuvable', 'Cette tâche a peut-être été remplacée par une nouvelle. Retrouvez vos tâches dans votre espace.');
    await onTaskDone(payload.businessId, task).catch((e) => console.warn('[api/digest/done] mesure', e));
    return page(200, 'C’est noté, merci !', `« ${task.title} » est marquée comme faite. Nous mesurerons son effet lors des prochains passages auprès des IA (sans garantie de résultat).`);
  } catch (e) {
    console.error('[api/digest/done]', e);
    return page(500, 'Enregistrement impossible', 'Un incident nous empêche d’enregistrer la tâche. Réessayez plus tard ou cochez-la dans votre espace.');
  }
}
