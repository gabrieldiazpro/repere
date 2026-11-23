import { NextResponse } from 'next/server';
import { HOUR_MS, DAY_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { assertSameOrigin } from '@/lib/auth/http';
import { log } from '@/lib/log';
import { partnerFieldsFrom, validatePartner } from '@/lib/partners/validate';
import { buildPartner, savePartnerApplication, setPartnerNotified } from '@/lib/partners/store';
import { notifyFounderOfPartner } from '@/lib/partners/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /partenaires/candidature — candidature au programme partenaires.
 * Protections reprises du formulaire pilote : même origine, champ piège `hp`, débit par IP (5 par heure, 20 par
 * jour), consentement obligatoire, validation stricte, doublons (même e-mail + même domaine sous 30 jours) non
 * recréés, une seule notification au fondateur.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const hp = (body as Record<string, unknown>).hp;
  if (typeof hp === 'string' && hp.trim() !== '') return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const ip = getClientIp(req);
  const hour = await rateLimit('partners', ip, 5, HOUR_MS);
  const day = hour.ok ? await rateLimit('partners-day', ip, 20, DAY_MS) : hour;
  if (!hour.ok || !day.ok) {
    return NextResponse.json(
      { error: 'Trop de candidatures depuis cette connexion. Réessayez plus tard ou écrivez-nous.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(hour.retryAfter, day.retryAfter)) } },
    );
  }

  const fields = partnerFieldsFrom(body);
  const errors = validatePartner(fields);
  const first = Object.values(errors)[0];
  if (first) return NextResponse.json({ error: first, errors }, { status: 400 });

  try {
    const rec = buildPartner(fields);
    const { id, duplicate } = await savePartnerApplication(rec);
    if (!duplicate) {
      const r = await notifyFounderOfPartner(id, rec);
      await setPartnerNotified(id, r.status);
      if (r.status === 'error') log.warn('partners.notify_failed', { id, error: r.error });
    }
    return NextResponse.json({ id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    log.error('partners.save_failed', e);
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
  }
}
