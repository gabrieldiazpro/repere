import { NextResponse } from 'next/server';
import { NONCE_COOKIE, connectWithCode, ga4Enabled, readNonce, siteBase, verifyState } from '@/lib/tracking/ga4';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!ga4Enabled()) return Response.json({ enabled: false, error: 'Connecteur GA4 non configuré.' }, { status: 503 });
  const q = new URL(req.url).searchParams;
  const back = (status: string) => {
    const r = NextResponse.redirect(`${siteBase()}/app/trafic?ga4=${status}`);
    r.cookies.set(NONCE_COOKIE, '', { path: '/api/connect/ga4', maxAge: 0 }); // usage unique
    return r;
  };
  const businessId = verifyState(q.get('state') || '', readNonce(req));
  const code = q.get('code');
  if (!businessId || q.get('error') || !code) return back('error');
  try {
    const { propertyId } = await connectWithCode(businessId, code);
    return back(propertyId ? 'connected' : 'choose_property');
  } catch (e) {
    console.error('[ga4/callback]', (e as Error).message);
    return back('error');
  }
}
