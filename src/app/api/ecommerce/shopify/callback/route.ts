/**
 * GET /api/ecommerce/shopify/callback?code&hmac&shop&state&timestamp
 * Vérifie le HMAC Shopify, l'état signé (commerce + boutique + nonce du navigateur, 10 min), l'hôte de la boutique,
 * échange le code contre un jeton hors ligne expirant (chiffré au repos), puis redirige vers l'app.
 */
import { NextResponse } from 'next/server';
import { connectWithCode, NONCE_COOKIE, normalizeShop, readNonce, shopifyEnabled, verifyCallbackHmac, verifyState } from '@/lib/ecommerce/shopify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const base = () => (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export async function GET(req: Request) {
  if (!shopifyEnabled()) return Response.json({ ok: false, enabled: false, error: 'Connecteur Shopify non configuré.' }, { status: 503 });
  const q = new URL(req.url).searchParams;
  const back = (status: string) => {
    const r = NextResponse.redirect(`${base()}/app/produits/shopify?shopify=${status}`);
    r.cookies.set(NONCE_COOKIE, '', { path: '/api/ecommerce/shopify', maxAge: 0 }); // usage unique
    return r;
  };
  const shop = normalizeShop(q.get('shop') ?? '');
  const st = verifyState(q.get('state') ?? '', readNonce(req));
  const code = q.get('code');
  if (!shop || !st || st.shop !== shop || !code || q.get('error') || !verifyCallbackHmac(q)) return back('error');
  const ts = Number(q.get('timestamp'));
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 600) return back('error');
  try {
    await connectWithCode(st.businessId, shop, code);
    return back('connected');
  } catch (e) {
    console.error('[ecommerce/shopify/callback]', (e as Error).message);
    return back('error');
  }
}
