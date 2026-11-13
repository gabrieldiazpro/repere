/**
 * GET ?businessId= (session, rôle admin) → { url } vers l'écran de consentement Google (Search Console, lecture seule).
 * Pose le cookie HttpOnly du nonce : le retour n'est accepté que dans ce navigateur (anti-CSRF de liaison).
 */
import { HttpError } from '@/lib/auth';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { buildAuthUrl, gscEnabled, newNonce, nonceCookie } from '@/lib/seodata/google-oauth';
import { access, businessIdOf, errorResponse, json } from '../../../seodata/_shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    if (!gscEnabled()) return json({ enabled: false, error: 'Connexion Google non configurée.', code: 'not_configured' }, 503);
    const businessId = businessIdOf(new URL(req.url).searchParams.get('businessId'));
    if (isDemoBusinessId(businessId)) throw new HttpError(403, 'Compte de démonstration : aucune connexion.', 'demo_read_only');
    await access(req, businessId, { write: true, minRole: 'admin' });
    const nonce = newNonce();
    return json({ enabled: true, url: buildAuthUrl(businessId, nonce) }, 200, { 'set-cookie': nonceCookie(nonce) });
  } catch (e) {
    return errorResponse(e, 'connect.google.start');
  }
}
