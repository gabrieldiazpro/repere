import { NextResponse } from 'next/server';
import { HOUR_MS, DAY_MS, getClientIp, rateLimit } from '@/lib/ratelimit';
import { assertSameOrigin } from '@/lib/auth/http';
import { log } from '@/lib/log';
import { pilotFieldsFrom, validatePilot } from '@/lib/pilots/validate';
import { buildApplication, savePilotApplication, setNotified } from '@/lib/pilots/store';
import { notifyFounder } from '@/lib/pilots/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /pilotes/candidature — candidature au programme « entreprises pilotes ».
 * Mêmes protections que le formulaire de contact (POST /api/leads) : champ piège `hp`, limitation de débit par IP
 * (5 par heure, 20 par jour), consentement obligatoire, validation stricte ; en plus : même origine, doublons
 * (même e-mail + même domaine sous 30 jours) non recréés et notification unique au fondateur.
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
  const hour = await rateLimit('pilots', ip, 5, HOUR_MS);
  const day = hour.ok ? await rateLimit('pilots-day', ip, 20, DAY_MS) : hour;
  if (!hour.ok || !day.ok) {
    return NextResponse.json({ error: 'Trop de candidatures depuis cette connexion. Réessayez plus tard ou écrivez-nous.' }, { status: 429, headers: { 'Retry-After': String(Math.max(hour.retryAfter, day.retryAfter)) } });
  }

  const fields = pilotFieldsFrom(body);
  const errors = validatePilot(fields);
  const first = Object.values(errors)[0];
  if (first) return NextResponse.json({ error: first, errors }, { status: 400 });

  try {
    const app = buildApplication(fields);
    const { id, duplicate } = await savePilotApplication(app);
    if (!duplicate) {
      const r = await notifyFounder(id, app);
      await setNotified(id, r.status);
      if (r.status === 'error') log.warn('pilots.notify_failed', { id, error: r.error });
    }
    return NextResponse.json({ id, duplicate }, { status: duplicate ? 200 : 201 });
  } catch (e) {
    log.error('pilots.save_failed', e);
    return NextResponse.json({ error: 'Enregistrement impossible, réessayez.' }, { status: 500 });
  }
}
