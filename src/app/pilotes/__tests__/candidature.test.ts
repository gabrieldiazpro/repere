/** Route POST /pilotes/candidature : protections du formulaire (piège, débit, consentement, origine), stockage, notification. */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-pilotes-route-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY']) delete process.env[k];
process.env.PILOTS_NOTIFY_EMAIL = 'fondateur@exemple.fr';

const route = await import('../candidature/route');
const { resetRateLimit } = await import('@/lib/ratelimit');
const { listPilots } = await import('@/lib/pilots/store');

let ipSeq = 0;
function req(body: unknown, opts: { ip?: string; origin?: string } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json', host: 'localhost:3000', 'x-forwarded-for': opts.ip ?? `10.9.0.${++ipSeq}` };
  if (opts.origin) headers.origin = opts.origin;
  return new Request('http://localhost:3000/pilotes/candidature', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
}
const body = (over: Record<string, unknown> = {}) => ({
  name: 'Paul Durand',
  email: `paul${++ipSeq}@exemple-pme.fr`,
  company: 'Exemple PME',
  website: 'exemple-pme.fr',
  segment: 'pme',
  city: '',
  role: 'Directeur',
  motivation: 'Nos acheteurs comparent dans les IA et nous ne sommes jamais cités.',
  publishOk: false,
  consent: true,
  hp: '',
  ...over,
});

beforeEach(() => {
  resetRateLimit('pilots');
  resetRateLimit('pilots-day');
});

describe('POST /pilotes/candidature', () => {
  it('enregistre la candidature et notifie le fondateur une seule fois', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const b = body();
    const res = await route.POST(req(b, { origin: 'http://localhost:3000' }));
    expect(res.status).toBe(201);
    const { id, duplicate } = await res.json();
    expect(duplicate).toBe(false);
    const row = (await listPilots()).find((r) => r.id === id);
    expect(row?.company).toBe('Exemple PME');
    expect(row?.notified).toBe('logged');
    expect(info.mock.calls.some((c) => String(c[0]).includes('à=fondateur@exemple.fr') && String(c[0]).includes('Candidature pilote : Exemple PME'))).toBe(true);
    // Doublon : même e-mail et même domaine → 200, pas de seconde notification.
    info.mockClear();
    const again = await route.POST(req(b));
    expect(again.status).toBe(200);
    expect((await again.json()).id).toBe(id);
    expect(info).not.toHaveBeenCalled();
    info.mockRestore();
  });

  it('refuse sans consentement, avec les erreurs par champ', async () => {
    const res = await route.POST(req(body({ consent: false, website: 'localhost' })));
    expect(res.status).toBe(400);
    const j = await res.json();
    expect(Object.keys(j.errors).sort()).toEqual(['consent', 'website']);
  });

  it('rejette le champ piège rempli et un corps invalide', async () => {
    expect((await route.POST(req(body({ hp: 'http://spam.example' })))).status).toBe(400);
    expect((await route.POST(req('pas du json'))).status).toBe(400);
    expect((await route.POST(req([1, 2]))).status).toBe(400);
  });

  it('refuse une autre origine', async () => {
    expect((await route.POST(req(body(), { origin: 'https://malveillant.example' }))).status).toBe(403);
  });

  it('limite à 5 candidatures par heure et par connexion', async () => {
    const ip = '10.77.0.1';
    for (let i = 0; i < 5; i++) {
      const r = await route.POST(req(body({ consent: false }), { ip }));
      expect(r.status).toBe(400);
    }
    const blocked = await route.POST(req(body(), { ip }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('retry-after')).toBeTruthy();
  });
});
