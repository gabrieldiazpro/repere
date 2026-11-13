/**
 * Accès du module LOCAL : délègue à `@/lib/auth` (agent COMPTES) et `@/lib/entitlements`.
 */
import { NextResponse } from 'next/server';
import { HttpError, requireBusiness, type Role } from '@/lib/auth';
import { getEntitlements, type EntitlementTier } from '@/lib/entitlements';
import type { Business } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';

export { HttpError, requireBusiness, type Role };

/** Réponse JSON d'erreur homogène pour les routes /api/local/* (`{ ok: false, error, code? }`). */
export function errorResponse(e: unknown, tag: string): NextResponse {
  if (e instanceof HttpError) {
    return NextResponse.json(
      { ok: false, error: e.message, ...(e.code ? { code: e.code } : {}), ...(e.code === 'demo_read_only' ? { demo: true } : {}) },
      { status: e.status, headers: { 'cache-control': 'no-store' } },
    );
  }
  console.error(`[api/local/${tag}]`, e);
  return NextResponse.json({ ok: false, error: 'Une erreur est survenue. Réessayez dans un instant.' }, { status: 500 });
}

export type LocalTier = EntitlementTier;

/** Palier d'offre du commerce (getEntitlements). */
export function localTier(business: Pick<Business, 'id' | 'plan' | 'segment' | 'planId'> & { isActive?: boolean }): LocalTier {
  if (isDemoBusinessId(business.id)) return 'demo';
  return getEntitlements(business).tier;
}
