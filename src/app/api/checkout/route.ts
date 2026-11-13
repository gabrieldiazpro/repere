import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CheckoutConfigError, createCheckoutUrl } from '@/lib/stripe';
import { PLAN_IDS, commitmentMonths, isPlanAvailable, type PlanId } from '@/lib/plans';
import { createCommitmentCheckoutUrl } from './commitment';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { HttpError, getSession, requireBusiness } from '@/lib/auth';
import { isDemoBusinessId } from '@/lib/demo-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const Body = z.object({
  planId: z.enum(PLAN_IDS as [PlanId, ...PlanId[]], { error: 'Offre inconnue.' }),
  // Identifiants d'audit : UUID, ou « demo-* » (rapports d'exemple). businessId n'est JAMAIS accepté du client (E1).
  auditId: z.preprocess(emptyToUndef, z.string().regex(/^(?:[0-9a-f-]{36}|demo-[A-Za-z0-9_-]{1,40})$/i, { error: 'Audit inconnu.' }).optional()),
  email: z.preprocess(emptyToUndef, z.email({ error: 'Adresse e-mail invalide.' }).optional()),
  // Espace à faire monter en gamme : accepté UNIQUEMENT si la session en est propriétaire (vérifié ci-dessous).
  businessId: z.preprocess(emptyToUndef, z.string().max(100).optional()),
  // Case « j'agis pour mon activité professionnelle » cochée sur notre site (facultatif : la page Stripe la redemande).
  pro: z.boolean().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' }, { status: 400 });
  }

  // Pro (V1) et Agence (marque blanche non livrée) : liste d'attente, jamais vendus.
  if (!isPlanAvailable(parsed.data.planId)) {
    return NextResponse.json(
      { error: 'Cette offre n’est pas encore disponible. Inscrivez-vous à la liste d’attente sur la page Tarifs.' },
      { status: 400 },
    );
  }

  const rl = await rateLimit('checkout', getClientIp(req), 20, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de tentatives, réessayez plus tard.' }, { status: 429 });

  try {
    // businessId : jamais cru sur parole (E1). Seul le propriétaire connecté de cet espace peut le désigner ; il est alors
    // écrit dans la metadata Stripe par NOTRE serveur et relu par le webhook (montée en gamme, 2ᵉ achat).
    const args: { planId: PlanId; auditId?: string; email?: string; businessId?: string; customerId?: string; proDeclaredAt?: string } = {
      planId: parsed.data.planId,
      auditId: parsed.data.auditId,
      email: parsed.data.email,
      // Horodatage SERVEUR (jamais celui du client) : preuve de la déclaration, reprise en metadata Stripe.
      ...(parsed.data.pro === true ? { proDeclaredAt: new Date().toISOString() } : {}),
    };
    const session = await getSession(req);
    if (parsed.data.businessId && !isDemoBusinessId(parsed.data.businessId)) {
      // Sans session propriétaire : identifiant ignoré (jamais d'erreur qui révèlerait l'existence de l'espace).
      const access = await requireBusiness(req, parsed.data.businessId, { minRole: 'owner', session }).catch((e) => {
        if (e instanceof HttpError) return null;
        throw e;
      });
      if (access && access.role !== 'demo') {
        args.businessId = access.business.id;
        const c = access.business.stripeCustomerId;
        if (c && !c.startsWith('guest_')) args.customerId = c;
      }
    }
    if (session && !args.email && !args.customerId) args.email = session.email;
    // Accompagné : engagement de 3 mois (metadata + mention sur la page Stripe).
    const url = commitmentMonths(args.planId) > 0 ? await createCommitmentCheckoutUrl(args) : await createCheckoutUrl(args);
    return NextResponse.json({ url });
  } catch (e) {
    if (e instanceof CheckoutConfigError) {
      console.error('[api/checkout] configuration', e.message);
      // Pas de nom de variable d'environnement côté client (F6) ; l'audit gratuit garde son message.
      const publicMsg = e.message.startsWith('Prix Stripe') ? 'Cette offre n’est pas encore disponible au paiement.' : e.message;
      return NextResponse.json({ error: publicMsg }, { status: 400 });
    }
    console.error('[api/checkout]', e);
    return NextResponse.json(
      { error: 'Le paiement est momentanément indisponible. Réessayez dans quelques minutes.' },
      { status: 502 },
    );
  }
}
