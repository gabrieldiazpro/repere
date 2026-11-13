import { NextResponse } from 'next/server';
import { z } from 'zod';
import { saveLead } from '@/lib/db';
import { putDoc } from '@/lib/store';
import { isAdminToken } from '@/lib/adminAuth';
import { HOUR_MS, getClientIp, rateLimit } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const emptyToUndef = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

const Body = z
  .object({
    email: z.email({ error: 'Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr.' }).max(200),
    businessName: z.preprocess(emptyToUndef, z.string().trim().min(1).max(120).optional()),
    trade: z.preprocess(emptyToUndef, z.string().trim().min(2).max(80).optional()),
    city: z.preprocess(emptyToUndef, z.string().trim().min(2).max(80).optional()),
    district: z.preprocess(emptyToUndef, z.string().trim().max(80).optional()),
    auditId: z.preprocess(emptyToUndef, z.string().max(100).optional()),
    consent: z.boolean().default(false),
    /**
     * `prospection` est réservé aux scripts serveur (en-tête x-admin-token) ; `waitlist` = liste d'attente Pro / Agence
     * (/tarifs) ; `tool` = résultat d'un outil gratuit (/outils) ; `contact` = formulaire /contact.
     */
    source: z.enum(['site', 'prospection', 'waitlist', 'tool', 'contact']).default('site'),
    /** Liste d'attente : offre attendue. */
    interest: z.enum(['pro', 'agency']).optional(),
    /** Formulaire /contact : conservés avec le lead pour pouvoir répondre. */
    name: z.preprocess(emptyToUndef, z.string().trim().max(120).optional()),
    subject: z.preprocess(emptyToUndef, z.string().trim().max(60).optional()),
    message: z.preprocess(emptyToUndef, z.string().trim().max(4000).optional()),
    hp: z.string().optional(),
  })
  .superRefine((b, ctx) => {
    // Liste d'attente, outils gratuits et contact : l'e-mail suffit. Ailleurs, le commerce doit être identifié.
    if (b.source === 'waitlist' || b.source === 'tool' || b.source === 'contact') return;
    if (!b.businessName) ctx.addIssue({ code: 'custom', path: ['businessName'], message: 'Indiquez le nom de votre commerce.' });
    if (!b.trade) ctx.addIssue({ code: 'custom', path: ['trade'], message: 'Indiquez votre métier.' });
    if (!b.city) ctx.addIssue({ code: 'custom', path: ['city'], message: 'Indiquez votre ville.' });
  });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Requête invalide.' }, { status: 400 });
  }
  const body = parsed.data;
  if (body.hp) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  if (body.source === 'prospection') {
    if (!isAdminToken(req.headers.get('x-admin-token'))) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
    }
  } else {
    const rl = await rateLimit('leads', getClientIp(req), 10, HOUR_MS);
    if (!rl.ok) return NextResponse.json({ error: 'Trop de demandes, réessayez plus tard.' }, { status: 429 });
  }

  try {
    const { id } = await saveLead({
      email: body.email,
      businessName: body.businessName,
      trade: body.trade,
      city: body.city,
      district: body.district,
      auditId: body.auditId,
      consent: body.consent,
      source: body.source,
      interest: body.source === 'waitlist' ? body.interest : undefined,
    });
    if (body.source === 'contact' && body.message) {
      // Le message est stocké à part (collection `contact.messages`) : la table des leads ne porte que l'identité.
      await putDoc('contact.messages', id, {
        email: body.email.trim().toLowerCase(),
        name: body.name ?? null,
        company: body.businessName ?? null,
        subject: body.subject ?? null,
        message: body.message,
        receivedAt: new Date().toISOString(),
        answered: false,
      });
    }
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    console.error('[api/leads]', e);
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
  }
}
