/**
 * Sélecteur multi-commerces.
 * GET  /api/account/businesses → espaces de l'utilisateur (rôle, offre, parcours) + espace courant.
 * POST /api/account/businesses { businessId } → choisit l'espace courant (cookie rp_business).
 * POST /api/account/businesses { create: { name, segment, website?, trade?, city? } } → crée un espace (/bienvenue).
 * POST /api/account/businesses { setup: { businessId, name, website?, city? } } → complète un espace payé « à compléter ».
 * POST /api/account/businesses { profile: { businessId, trade, city, district? } } → Réglages : métier et ville
 *   (renvoie `changed` et l'aperçu `proposal` des questions qu'une régénération ajouterait).
 * POST /api/account/businesses { regenerate: { businessId } } → régénération des questions acceptée.
 */
import { requireBusiness, requireSession, toResponse } from '@/lib/auth';
import { completeBusinessSetup, createAccountBusiness, listAccountBusinesses, regenerateBusinessQuestions, updateBusinessProfile } from '@/lib/auth/businesses';
import { COOKIES, cookieOptions, parseCookieHeader } from '@/lib/auth/cookies';
import { assertSameOrigin, json, limit, readJson } from '@/lib/auth/http';
import { HttpError } from '@/lib/auth/roles';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const YEAR = 365 * 86_400;

export async function GET(req: Request) {
  try {
    const session = await requireSession(req);
    const businesses = await listAccountBusinesses(session);
    const wanted = parseCookieHeader(req.headers.get('cookie')).get(COOKIES.business);
    const current = businesses.find((b) => b.id === wanted)?.id ?? businesses[0]?.id ?? null;
    return json({ businesses, current });
  } catch (e) {
    return toResponse(e, 'api/account/businesses');
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const session = await requireSession(req);
    const body = await readJson(req);
    if (body.create && typeof body.create === 'object') {
      await limit(req, 'account-create-business', 10);
      const b = await createAccountBusiness(session, body.create as Record<string, unknown>);
      return json(
        { ok: true, business: b },
        {
          status: 201,
          cookies: [
            { name: COOKIES.business, value: b.id, options: cookieOptions(YEAR, { httpOnly: false }) },
            { name: COOKIES.workspace, value: session.userId, options: cookieOptions(12 * 3600) },
            { name: COOKIES.demo, value: '', options: cookieOptions(0, { httpOnly: false }) },
          ],
        },
      );
    }
    if (body.setup && typeof body.setup === 'object') {
      const b = await completeBusinessSetup(session, body.setup as Record<string, unknown>);
      return json({ ok: true, business: b }, { cookies: [{ name: COOKIES.business, value: b.id, options: cookieOptions(YEAR, { httpOnly: false }) }] });
    }
    if (body.profile && typeof body.profile === 'object') {
      await limit(req, 'account-profile', 20);
      return json({ ok: true, profile: await updateBusinessProfile(session, body.profile as Record<string, unknown>) });
    }
    if (body.regenerate && typeof body.regenerate === 'object') {
      await limit(req, 'account-regenerate', 5);
      return json({ ok: true, result: await regenerateBusinessQuestions(session, body.regenerate as Record<string, unknown>) });
    }
    if (typeof body.businessId !== 'string') throw new HttpError(400, 'Espace inconnu.');
    const { business } = await requireBusiness(req, body.businessId, { session });
    return json({ ok: true, current: business.id }, { cookies: [{ name: COOKIES.business, value: business.id, options: cookieOptions(YEAR, { httpOnly: false }) }] });
  } catch (e) {
    return toResponse(e, 'api/account/businesses');
  }
}
