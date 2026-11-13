/**
 * POST /api/account/portal { businessId } — portail de facturation Stripe (propriétaire uniquement), retour sur
 * /app/reglages (corrige A9 : /app/compte n'existait pas).
 */
import { requireBusiness, toResponse } from '@/lib/auth';
import { assertSameOrigin, json, readJson } from '@/lib/auth/http';
import { HttpError } from '@/lib/auth/roles';
import { listSubscriptionsByCustomer } from '@/lib/db';
import { PORTAL_RETURN_PATH, createPortalUrl, isStripeEnabled } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = await readJson(req);
    const { business, role } = await requireBusiness(req, String(body.businessId ?? ''), { minRole: 'owner' });
    if (role === 'demo') throw new HttpError(403, 'Compte de démonstration : pas de facturation.', 'demo_read_only');
    if (!isStripeEnabled()) return json({ url: null, demo: true, message: 'Paiement non configuré dans cet environnement.' });
    const customer = business.stripeCustomerId;
    if (!customer || customer.startsWith('guest_') || !(await listSubscriptionsByCustomer(customer)).length) {
      throw new HttpError(404, 'Aucun abonnement payant n’est rattaché à cet espace.', 'no_subscription');
    }
    const url = await createPortalUrl(customer, PORTAL_RETURN_PATH);
    if (!url) throw new HttpError(503);
    return json({ url });
  } catch (e) {
    return toResponse(e, 'api/account/portal');
  }
}
