/** Routes POST /partenaires/candidature et /rendez-vous/demande : protections (piège, débit, consentement, origine), stockage, e-mails. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-partenaires-routes-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY', 'NEXT_PUBLIC_BOOKING_URL']) delete process.env[k];
process.env.PARTNERS_NOTIFY_EMAIL = 'fondateur@exemple.fr';
process.env.MEETINGS_NOTIFY_EMAIL = 'fondateur@exemple.fr';

const partners = await import('../candidature/route');
const meetings = await import('../../rendez-vous/demande/route');
const { resetRateLimit } = await import('@/lib/ratelimit');
const { listPartners } = await import('@/lib/partners/store');
const { listMeetings } = await import('@/lib/meetings/store');
const { slotBounds } = await import('@/lib/meetings/validate');

let seq = 0;
function req(url: string, body: unknown, opts: { ip?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', host: 'localhost:3000', 'x-forwarded-for': opts.ip ?? `10.8.0.${++seq}` };
  if (opts.origin !== undefined) headers.origin = opts.origin;
  return new Request(`http://localhost:3000${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
}
const O = { origin: 'http://localhost:3000' };
const partnerBody = (over: Record<string, unknown> = {}) => ({
  family: 'prescripteur',
  company: 'Cabinet Exemple',
  website: 'cabinet-exemple.fr',
  name: 'Anne Roux',
  email: `anne${++seq}@cabinet-exemple.fr`,
  message: 'Nos clients artisans nous demandent comment apparaître dans les IA.',
  consent: true,
  hp: '',
  ...over,
});
/** Prochain jour ouvré dans les bornes. */
function weekday(): string {
  const d = new Date(`${slotBounds().min}T12:00:00Z`);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
const meetingBody = (over: Record<string, unknown> = {}) => ({
  offer: 'agence',
  company: 'Studio Nord',
  website: 'studio-nord.fr',
  size: 'c6-20',
  need: 'Voir la marque blanche et la validation client.',
  slots: [{ date: weekday(), period: 'apres-midi' }],
  name: 'Marc Petit',
  email: `marc${++seq}@studio-nord.fr`,
  consent: true,
  attribution: { utmSource: 'partenaire', utmMedium: 'partenaire', utmCampaign: 'studio', landing: '/agences', evil: '<x>' },
  hp: '',
  ...over,
});

beforeEach(() => {
  for (const b of ['partners', 'partners-day', 'meetings', 'meetings-day']) resetRateLimit(b);
});

describe('POST /partenaires/candidature', () => {
  it('enregistre la candidature et notifie le fondateur une seule fois', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const b = partnerBody();
    const res = await partners.POST(req('/partenaires/candidature', b, O));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const row = (await listPartners()).find((r) => r.id === id);
    expect(row?.status).toBe('a_etudier');
    expect(row?.code).toBeNull();
    expect(row?.notified).toBe('logged');
    expect(row?.consent.text).toMatch(/J’accepte/);
    const again = await partners.POST(req('/partenaires/candidature', b, O));
    expect((await again.json()).duplicate).toBe(true);
    expect(info.mock.calls.filter((c) => String(c[0]).includes('Candidature partenaire'))).toHaveLength(1);
    info.mockRestore();
  });
  it('refuse : autre origine, champ piège, sans consentement, débit dépassé', async () => {
    expect((await partners.POST(req('/partenaires/candidature', partnerBody(), { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await partners.POST(req('/partenaires/candidature', partnerBody({ hp: 'x' }), O))).status).toBe(400);
    const r = await partners.POST(req('/partenaires/candidature', partnerBody({ consent: false }), O));
    expect(r.status).toBe(400);
    expect((await r.json()).errors.consent).toBeDefined();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const codes: number[] = [];
    for (let i = 0; i < 6; i++) codes.push((await partners.POST(req('/partenaires/candidature', partnerBody(), { ...O, ip: '10.99.0.1' }))).status);
    expect(codes.slice(0, 5).every((c) => c === 201)).toBe(true);
    expect(codes[5]).toBe(429);
    vi.restoreAllMocks();
  });
});

describe('POST /rendez-vous/demande', () => {
  it('enregistre la demande, garde l’origine validée, envoie notification et réponse automatique', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const b = meetingBody();
    const res = await meetings.POST(req('/rendez-vous/demande', b, O));
    expect(res.status).toBe(201);
    const { id } = await res.json();
    const row = (await listMeetings()).find((r) => r.id === id)!;
    expect(row.attribution).toEqual({ utmSource: 'partenaire', utmMedium: 'partenaire', utmCampaign: 'studio', landing: '/agences' });
    expect(row.notified).toBe('logged');
    expect(row.acknowledged).toBe('logged');
    const logs = info.mock.calls.map((c) => String(c[0]));
    expect(logs.some((l) => l.includes('fondateur@exemple.fr') && l.includes('Demande de démo'))).toBe(true);
    expect(logs.some((l) => l.includes(b.email as string) && l.includes('sous 1 jour ouvré'))).toBe(true);
    // doublon sous 24 h : aucun nouvel e-mail
    info.mockClear();
    const again = await meetings.POST(req('/rendez-vous/demande', b, O));
    expect((await again.json()).duplicate).toBe(true);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });
  it('refuse : autre origine, champ piège, créneau un samedi, sans consentement', async () => {
    expect((await meetings.POST(req('/rendez-vous/demande', meetingBody(), { origin: 'https://evil.example' }))).status).toBe(403);
    expect((await meetings.POST(req('/rendez-vous/demande', meetingBody({ hp: 'x' }), O))).status).toBe(400);
    const sat = new Date(`${weekday()}T12:00:00Z`);
    while (sat.getUTCDay() !== 6) sat.setUTCDate(sat.getUTCDate() + 1);
    const r = await meetings.POST(req('/rendez-vous/demande', meetingBody({ slots: [{ date: sat.toISOString().slice(0, 10), period: 'matin' }] }), O));
    expect(r.status).toBe(400);
    expect((await r.json()).errors.slots).toMatch(/lundi au vendredi/);
    expect((await meetings.POST(req('/rendez-vous/demande', meetingBody({ consent: false }), O))).status).toBe(400);
  });
});
