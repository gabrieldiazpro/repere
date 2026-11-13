/**
 * INTEGRATION-V5 — inscription depuis une analyse 60 s : l'espace reprend site, marque, type et ville, et l'analyse
 * est rattachée — seulement si elle a été demandée avec la même adresse (même règle que l'audit gratuit).
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-analyse-inscription-'));
for (const k of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']) delete process.env[k];
vi.mock('@/lib/jobs', () => ({ enqueue: vi.fn(async () => ({ id: 'j' })) }));

const claims = await import('@/lib/auth/claims');
const { saveAnalysis, getStoredAnalysis } = await import('@/lib/analysis/store');
const { readClaim } = claims;
type FA = import('@/lib/analysis/types').FullAnalysis;

let n = 0;
const session = (email: string) => ({ userId: `u-${Date.now()}-${++n}`, email });
function analysis(id: string): FA {
  return {
    id,
    version: 1,
    input: { url: 'https://boulangerie-dupont.fr/' },
    detected: { brand: 'Boulangerie Dupont', siteType: 'local', city: 'Lyon', activity: 'boulangerie', sources: { brand: 'jsonld', siteType: 'jsonld', city: 'jsonld' } },
    createdAt: new Date().toISOString(),
    durationMs: 1000,
    crawl: { startUrl: 'https://boulangerie-dupont.fr/', finalOrigin: 'https://www.boulangerie-dupont.fr', pagesFetched: 4, pagesIndexable: 4, sitemapUrls: 4, robotsFound: true, durationMs: 500, truncated: false, errors: 0 },
    seo: null,
    geo: null,
    verdict: '',
    scores: { seo: null, geo: null, global: null },
    priorities: [],
    autoFixes: [],
    modules: {} as FA['modules'],
    partial: false,
    demo: false,
  };
}

describe('inscription depuis une analyse 60 s', () => {
  it('jeton : identifiant d’analyse gardé seulement s’il est bien formé', () => {
    const ok = readClaim(claims.signupClaimToken({ email: 'a@exemple.fr', name: 'X', segment: 'local', analysis: 'an_abcDEF123' }));
    expect(ok && ok.k === 'signup' && ok.analysis).toBe('an_abcDEF123');
    const bad = readClaim(claims.signupClaimToken({ email: 'a@exemple.fr', name: 'X', segment: 'local', analysis: '../x' }));
    expect(bad && bad.k === 'signup' && bad.analysis).toBeUndefined();
  });

  it('même adresse : espace prérempli (site, marque, type, ville, métier) et analyse rattachée', async () => {
    const id = `an_test${Date.now()}`;
    await saveAnalysis(analysis(id), { domain: 'boulangerie-dupont.fr', email: 'Gerant@Exemple.fr' });
    const d = await claims.analysisSignupDefaults(id, 'gerant@exemple.fr');
    expect(d).toEqual({ name: 'Boulangerie Dupont', segment: 'local', website: 'https://www.boulangerie-dupont.fr/', trade: 'boulangerie', city: 'Lyon' });

    const s = session('gerant@exemple.fr');
    const b = await claims.createOwnedBusiness(s, { name: '', segment: 'local', analysis: id });
    expect(b).toMatchObject({ name: 'Boulangerie Dupont', website: 'https://www.boulangerie-dupont.fr/', trade: 'boulangerie', city: 'Lyon', segment: 'local' });

    // Parcours complet : connexion avec le jeton d'inscription → rattachement.
    const s2 = session(`gerant2-${Date.now()}@exemple.fr`);
    const id2 = `an_test2${Date.now()}`;
    await saveAnalysis(analysis(id2), { domain: 'boulangerie-dupont.fr', email: s2.email });
    const claim = claims.signupClaimToken({ email: s2.email, name: 'Boulangerie Dupont', segment: 'local', analysis: id2 });
    const fx = await claims.applyLoginEffects(s2, { claim });
    expect(fx.selectBusinessId).toBeTruthy();
    expect((await getStoredAnalysis(id2))?.businessId).toBe(fx.selectBusinessId);
  });

  it('autre adresse : rien n’est repris ni rattaché', async () => {
    const id = `an_autre${Date.now()}`;
    await saveAnalysis(analysis(id), { domain: 'boulangerie-dupont.fr', email: 'gerant@exemple.fr' });
    expect(await claims.analysisSignupDefaults(id, 'intrus@exemple.fr')).toBeNull();
    const s = session(`intrus-${Date.now()}@exemple.fr`);
    const claim = claims.signupClaimToken({ email: s.email, name: 'Intrus', segment: 'local', city: 'Paris', trade: 'fleuriste', analysis: id });
    const fx = await claims.applyLoginEffects(s, { claim });
    expect(fx.selectBusinessId).toBeTruthy();
    expect((await getStoredAnalysis(id))?.businessId ?? null).toBeNull();
  });
});
