/**
 * Retour Google : vérifie l'état signé + le nonce du navigateur, échange le code, chiffre les jetons, liste les
 * propriétés ; lance l'import des 16 mois si la propriété est connue. Redirige vers l'app (jamais de jeton dans l'URL).
 */
import { appUrl } from '@/lib/email';
import { log } from '@/lib/log';
import { clearNonceCookie, connectWithCode, gscEnabled, readNonce, verifyState } from '@/lib/seodata/google-oauth';
import { dispatch } from '@/lib/seodata/jobs';
import { listSitesWithToken } from '@/lib/seodata/searchconsole';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function back(status: string): Response {
  return new Response(null, { status: 303, headers: { location: `${appUrl()}/app/seo?gsc=${status}`, 'set-cookie': clearNonceCookie(), 'cache-control': 'no-store' } });
}

export async function GET(req: Request) {
  if (!gscEnabled()) return back('not_configured');
  const q = new URL(req.url).searchParams;
  const businessId = verifyState(q.get('state') ?? '', readNonce(req));
  const code = q.get('code');
  if (!businessId) return back('invalid_state');
  if (q.get('error') || !code) return back(q.get('error') === 'access_denied' ? 'denied' : 'error');
  try {
    const c = await connectWithCode(businessId, code, listSitesWithToken);
    if (c.siteUrl) {
      await dispatch('seodata.gsc.sync', { businessId, mode: 'import' }, { dedupeKey: `gsc-import:${businessId}:${c.connectedAt}` }).catch((e) =>
        log.warn('seodata.import_dispatch_failed', { businessId, error: e instanceof Error ? e.message : String(e) }),
      );
      return back('connected');
    }
    return back(c.sites.length ? 'choose_property' : 'no_property');
  } catch (e) {
    log.warn('seodata.oauth_callback_failed', { businessId, error: e instanceof Error ? e.message : String(e) });
    return back('error');
  }
}
