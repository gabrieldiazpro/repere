import { NextResponse } from 'next/server';
import { z } from 'zod';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { sendGuideEmail } from '@/lib/newsletter/emails';
import { recordDownload, requestSubscription } from '@/lib/newsletter/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.email({ error: 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.' }).max(200),
  resource: z.literal('guide-2027'),
  /** Consentement à l'envoi du guide par e-mail (obligatoire pour ce service). */
  consentGuide: z.literal(true, { error: 'Cochez la case pour recevoir le guide par e-mail.' }),
  /** Consentement distinct et facultatif à la lettre mensuelle. */
  newsletter: z.boolean().default(false),
  page: z.string().max(200).regex(/^\/[^\s]*$/).optional(),
  hp: z.string().optional(),
});

/**
 * POST /api/newsletter/ressource — demande du guide 2027 contre e-mail. Le lien d'accès (signé) part par e-mail.
 * Si la case « lettre » est cochée, l'inscription reste en attente jusqu'au clic de confirmation (double opt-in).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' }, { status: 400 });
  const b = parsed.data;
  if (b.hp) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const rl = await rateLimit('ressource', getClientIp(req), 6, HOUR_MS);
  if (!rl.ok) return NextResponse.json({ error: 'Trop de demandes, réessayez plus tard.' }, { status: 429 });
  try {
    await recordDownload({ email: b.email, resource: b.resource, newsletter: b.newsletter, page: b.page });
    let newsletter = false;
    if (b.newsletter) newsletter = (await requestSubscription(b.email, 'ressource', b.page)).sendConfirmation;
    const r = await sendGuideEmail(b.email, { newsletter });
    if (r.status === 'error') {
      console.error('[api/newsletter/ressource] envoi', r.error);
      return NextResponse.json({ error: "L'e-mail n'a pas pu partir. Réessayez dans quelques minutes." }, { status: 502 });
    }
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (e) {
    console.error('[api/newsletter/ressource]', e);
    return NextResponse.json({ error: 'Envoi impossible pour le moment. Réessayez dans quelques minutes.' }, { status: 500 });
  }
}
