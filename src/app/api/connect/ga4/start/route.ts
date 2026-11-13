import { DEMO_BUSINESS_ID } from '@/lib/db';
import { HttpError, requireBusiness } from '@/lib/auth';
import { buildAuthUrl, ga4Enabled, newNonce, nonceCookie } from '@/lib/tracking/ga4';
import { isDemoTrackId } from '@/lib/tracking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET ?businessId=… (session cookie ou Bearer) -> { url } : l'app redirige ensuite le navigateur vers Google. */
export async function GET(req: Request) {
  if (!ga4Enabled()) return Response.json({ enabled: false, error: 'Connecteur GA4 non configuré.' }, { status: 503 });
  const businessId = new URL(req.url).searchParams.get('businessId') || '';
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(businessId)) return Response.json({ error: 'businessId invalide.' }, { status: 400 });
  if (businessId === DEMO_BUSINESS_ID || isDemoTrackId(businessId)) return Response.json({ error: 'Indisponible sur un compte démo.' }, { status: 403 });
  try {
    // Connecter une source de données : réglage du commerce (admin au moins).
    await requireBusiness(req, businessId, { write: true, minRole: 'admin' });
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: 'Accès refusé.' }, { status: e.status });
    throw e;
  }
  // Nonce posé par la réponse de ce fetch same-origin : le retour Google n'est accepté que dans CE navigateur (M1).
  const nonce = newNonce();
  const res = Response.json({ enabled: true, url: buildAuthUrl(businessId, nonce) });
  res.headers.append('set-cookie', nonceCookie(nonce));
  return res;
}
