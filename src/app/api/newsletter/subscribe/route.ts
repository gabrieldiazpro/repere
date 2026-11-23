import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { sendConfirmEmail } from '@/lib/newsletter/emails';
import { SOURCES, requestSubscription } from '@/lib/newsletter/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.email({ error: 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.' }).max(200),
  /** Consentement explicite : la case doit être cochée (jamais pré-cochée). */
  consent: z.literal(true, { error: 'Cochez la case pour confirmer que vous voulez recevoir la lettre.' }),
  source: z.enum(SOURCES as [string, ...string[]]).default('site'),
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  hp: z.string().optional(),
});

/**
 * POST /api/newsletter/subscribe — inscription à la lettre mensuelle (double opt-in).
 * Réponse identique que l'adresse soit nouvelle, en attente ou déjà inscrite (on ne révèle pas qui est abonné).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' }, { status: 400 });
  const b = parsed.data;
  if (b.hp) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('newsletter', getClientIp(req), 8, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de demandes, réessayez plus tard.' }, { status: 429 });
  try {
    const { sendConfirmation } = await requestSubscription(b.email, b.source as never, b.page);
    if (sendConfirmation) {
      const r = await sendConfirmEmail(b.email);
      if (r.status === 'error') console.error('[api/newsletter/subscribe] envoi', r.error);
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (e) {
    console.error('[api/newsletter/subscribe]', e);
    return NextResponse.json({ error: 'Inscription impossible pour le moment. Réessayez dans quelques minutes.' }, { status: 500 });
  }
}
