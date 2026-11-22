/** V8 — POST /api/v5/analysis/[id]/claim : l'adresse n'est ajoutée qu'avec le jeton du lien signé ; même origine. */
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { analysisRequestedBy, saveAnalysis } from '@/lib/analysis/store';
import type { FullAnalysis } from '@/lib/analysis/types';
import { POST } from '../[id]/claim/route';

beforeAll(async () => {
  process.env.DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'repere-claim-'));
  resetRateLimit();
});

const call = (id: string, body: unknown, origin?: string) =>
  POST(new Request(`http://localhost/api/v5/analysis/${id}/claim`, { method: 'POST', headers: { 'content-type': 'application/json', host: 'localhost', ...(origin ? { origin } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe('POST /api/v5/analysis/[id]/claim', () => {
  it('jeton valide : adresse ajoutée ; sinon rien, même réponse générique', async () => {
    const id = `an_claim${Date.now()}`;
    const a = { id, version: 1, input: { url: 'https://x.fr/' }, detected: { brand: 'X', siteType: 'local', sources: { brand: 's', siteType: 's' } }, createdAt: new Date().toISOString(), durationMs: 1, crawl: null, seo: null, geo: null, verdict: '', scores: { seo: null, geo: null, global: null }, priorities: [], autoFixes: [], modules: {}, partial: false, demo: true } as unknown as FullAnalysis;
    const { token } = await saveAnalysis(a, { domain: 'x.fr' });
    const bad = await call(id, { t: 'x'.repeat(43), email: 'gerant@exemple.fr' });
    expect(bad.status).toBe(200);
    expect(await bad.json()).toEqual({ ok: true });
    expect(await analysisRequestedBy(id, 'gerant@exemple.fr')).toBeNull();
    const ok = await call(id, { t: token, email: 'gerant@exemple.fr' });
    expect(await ok.json()).toEqual({ ok: true, linked: true });
    expect(await analysisRequestedBy(id, 'gerant@exemple.fr')).not.toBeNull();
    expect((await call(id, { t: token, email: 'pas-un-email' })).status).toBe(400);
    expect((await call(id, { t: token, email: 'a@b.fr' }, 'https://evil.test')).status).toBe(403);
  });
});
