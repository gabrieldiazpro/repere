import { NextResponse } from 'next/server';
import { HOUR_MS, DAY_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { assertSameOrigin } from '@/lib/auth/http';
import { log } from '@/lib/log';
import { sanitizeAttribution } from '@/lib/roi/core';
import { meetingFieldsFrom, validateMeeting } from '@/lib/meetings/validate';
import { buildMeeting, saveMeeting, setMeetingEmails } from '@/lib/meetings/store';
import { notifyMeeting } from '@/lib/meetings/notify';
import { bookingUrl } from '@/lib/meetings/booking';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /rendez-vous/demande — demande de démo (Accompagné, Agence).
 * Protections reprises du formulaire pilote : même origine, champ piège `hp`, débit par IP (5 par heure, 20 par
 * jour), consentement obligatoire, validation stricte. Doublon (même e-mail, même offre sous 24 h) : rien de recréé,
 * aucun nouvel e-mail (évite d'utiliser le formulaire pour envoyer des réponses automatiques en boucle).
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return NextResponse.json({ error: 'Origine refusée.' }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  const raw = body as Record<string, unknown>;
  if (typeof raw.hp === 'string' && raw.hp.trim() !== '') return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });

  const ip = getClientIp(req);
  const hour = await rateLimit('meetings', ip, 5, HOUR_MS);
  const day = hour.ok ? await rateLimit('meetings-day', ip, 20, DAY_MS) : hour;
  if (!hour.ok || !day.ok) {
    return NextResponse.json(
      { error: 'Trop de demandes depuis cette connexion. Réessayez plus tard ou écrivez-nous.' },
      { status: 429, headers: { 'Retry-After': String(Math.max(hour.retryAfter, day.retryAfter)) } },
    );
  }

  const fields = meetingFieldsFrom(body);
  const errors = validateMeeting(fields);
  const first = Object.values(errors)[0];
  if (first) return NextResponse.json({ error: first, errors }, { status: 400 });

  try {
    const m = buildMeeting(fields, sanitizeAttribution(raw.attribution));
    const { id, duplicate } = await saveMeeting(m);
    if (!duplicate) {
      const r = await notifyMeeting(id, m, { bookingUrl: bookingUrl() });
      await setMeetingEmails(id, { notified: r.notified.status, acknowledged: r.acknowledged.status });
      if (r.notified.status === 'error' || r.acknowledged.status === 'error') log.warn('meetings.email_failed', { id, notified: r.notified.error, ack: r.acknowledged.error });
    }
    return NextResponse.json({ id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    log.error('meetings.save_failed', e);
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
  }
}
