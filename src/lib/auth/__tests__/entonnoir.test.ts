/**
 * Entonnoir gratuit (qa/v3/regard-client-v3.md, B1, B2, B3, B10) : l'espace créé depuis le rapport gratuit reprend
 * l'audit d'origine ; /bienvenue dit juste ; jamais de « +N points » entre un audit gratuit et la première mesure.
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });
process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-entonnoir-'));
for (const k of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RESEND_API_KEY']) delete process.env[k];

// La file de tâches n'est pas exécutée ici : on vérifie ce qui est mis en file et les questions semées.
const enqueued: Record<string, unknown>[] = [];
vi.mock('@/lib/jobs', () => ({ enqueue: vi.fn(async (_t: string, p: Record<string, unknown>) => (enqueued.push(p), { id: 'j' })) }));

const { resolveSignupProfile, missingSetupFields, setupIntro, tradeOfAudit } = await import('@/lib/auth/profile');
const { pickOnboardingQuestions } = await import('@/lib/auth/onboarding');
const claims = await import('@/lib/auth/claims');
const { listAccountBusinesses } = await import('@/lib/auth/businesses');
const db = await import('@/lib/db');
const { createMockAudit } = await import('@/lib/engine');
const { listPrompts } = await import('@/lib/prompts/repo');

let n = 0;
/** Audit gratuit tel que /api/audit l'enregistre (identifiant réel, jamais « demo-… »). */
const freeAudit = (input: Record<string, unknown>) => ({ ...createMockAudit(input as never), id: `aud_${Date.now()}_${++n}` });
const session = () => ({ userId: `u-${Date.now()}-${++n}`, email: `e${n}-${Date.now()}@exemple.fr` });

const KARIM = { segment: 'local', businessName: 'Plomberie Karim', trade: 'plombier', city: 'Paris', district: '11e', website: 'https://plomberie-karim.fr' };
const CLAIRE = { segment: 'pme', businessName: 'Paie Lumen', trade: 'logiciel de paie pour PME', city: 'France', category: 'logiciel de paie pour PME', market: 'France', knownCompetitors: ['PayFit', 'Silae'] };
const INES = { segment: 'ecommerce', businessName: 'Bulle d’Argile', trade: 'shampoing solide', city: 'France', productCategories: ['shampoing solide', 'déodorant solide'], knownCompetitors: ['Lamazuna', 'Respire'], market: 'France' };

describe('profil repris de l’audit d’origine (pur)', () => {
  it('local : métier, ville et arrondissement', () => {
    const p = resolveSignupProfile({ name: 'Plomberie Karim', segment: 'local' }, KARIM);
    expect(p).toMatchObject({ trade: 'plombier', city: 'Paris', district: '11e', needsSetup: false, fromOrigin: true });
    expect(p.auditInput).toMatchObject({ trade: 'plombier', city: 'Paris', district: '11e' });
  });
  it('PME : secteur et concurrents connus, jamais « entreprise »', () => {
    const p = resolveSignupProfile({ name: 'Paie Lumen', segment: 'pme' }, CLAIRE);
    expect(p.trade).toBe('logiciel de paie pour PME');
    expect(p.auditInput).toMatchObject({ category: 'logiciel de paie pour PME', knownCompetitors: ['PayFit', 'Silae'], market: 'France' });
  });
  it('e-commerce : catégories produits, jamais « boutique en ligne »', () => {
    const p = resolveSignupProfile({ name: 'Bulle d’Argile', segment: 'ecommerce' }, INES);
    expect(p.trade).toBe('shampoing solide');
    expect(p.auditInput).toMatchObject({ productCategories: ['shampoing solide', 'déodorant solide'], knownCompetitors: ['Lamazuna', 'Respire'] });
  });
  it('ville changée à l’inscription : l’arrondissement de l’audit n’est pas gardé', () => {
    expect(resolveSignupProfile({ name: 'K', segment: 'local', city: 'Lyon' }, KARIM).district).toBeUndefined();
  });
  it('parcours différent de l’audit : rien n’est repris ; sans métier, espace à compléter', () => {
    const p = resolveSignupProfile({ name: 'K', segment: 'pme' }, KARIM);
    expect(p).toMatchObject({ trade: '', needsSetup: true, fromOrigin: false });
    expect(resolveSignupProfile({ name: 'K', segment: 'local', trade: 'plombier' }, null)).toMatchObject({ needsSetup: true });
    expect(tradeOfAudit(INES)).toBe('shampoing solide');
  });
  it('/bienvenue : gratuit ≠ payé, et on ne nomme que ce qui manque', () => {
    expect(setupIntro({ free: true, segment: 'local', prefill: { name: 'Plomberie Karim', trade: 'plombier', city: '' } })).toBe(
      'Votre compte gratuit est créé. Il manque votre ville pour lancer votre première mesure.',
    );
    expect(setupIntro({ free: false, segment: 'pme', prefill: { name: '', trade: '', city: '' } })).toMatch(/^Votre paiement est bien enregistré\. Il manque le nom de votre entreprise et votre secteur/);
    expect(missingSetupFields({ segment: 'ecommerce', name: 'X Y', trade: 'savon', city: '' })).toEqual([]);
  });
  it('questions de départ : recommandation d’abord, dans la limite de l’offre', () => {
    const qs = [
      { id: 'B1', text: 'Que savez-vous de X ?', kind: 'brand' as const },
      ...Array.from({ length: 8 }, (_, i) => ({ id: `Q${i}`, text: `Question ${i}`, kind: 'reco' as const })),
      { id: 'Q9', text: 'question 0', kind: 'reco' as const },
    ];
    const picked = pickOnboardingQuestions(qs, 5);
    expect(picked.filter((p) => p.active).map((p) => p.query.id)).toEqual(['Q0', 'Q1', 'Q2', 'Q3', 'Q4']);
    expect(picked.at(-1)?.query.id).toBe('B1');
    expect(picked).toHaveLength(9); // doublon de texte retiré
  });
});

describe('espace créé depuis le rapport gratuit (intégration, mode mémoire)', () => {
  it('Karim : plombier dans le 11e, 5 questions de son audit, jamais « commerce »', async () => {
    const origin = freeAudit({ ...KARIM });
    await db.saveAudit(origin, { trigger: 'free' });
    const s = session();
    const b = await claims.createOwnedBusiness(s, { name: 'Plomberie Karim', segment: 'local', audit: origin.id });
    expect(b).toMatchObject({ trade: 'plombier', city: 'Paris', district: '11e', needsSetup: false });
    expect(enqueued.some((p) => p.businessId === b.id)).toBe(true);
    const prompts = await listPrompts(b.id);
    const active = prompts.filter((p) => p.active);
    expect(active).toHaveLength(5);
    const originTexts = new Set(origin.queries.map((q) => q.text));
    expect(active.every((p) => originTexts.has(p.text))).toBe(true);
    expect(active.some((p) => /plombier/i.test(p.text))).toBe(true);
    expect(prompts.some((p) => /commerce/i.test(p.text) && !/plombier/i.test(p.text))).toBe(false);
  });

  it('Claire (PME) et Inès (e-commerce) : catégorie reprise', async () => {
    for (const [input, name, word] of [
      [CLAIRE, 'Paie Lumen', /paie/i],
      [INES, 'Bulle d’Argile', /shampoing|déodorant/i],
    ] as const) {
      const origin = freeAudit({ ...input });
      await db.saveAudit(origin, { trigger: 'free' });
      const b = await claims.createOwnedBusiness(session(), { name, segment: input.segment as 'pme' | 'ecommerce', audit: origin.id });
      expect(b.needsSetup).toBe(false);
      expect(b.trade).not.toMatch(/^(entreprise|boutique en ligne)$/);
      const active = (await listPrompts(b.id)).filter((p) => p.active);
      expect(active.length).toBeLessThanOrEqual(5);
      expect(active.some((p) => word.test(p.text))).toBe(true);
    }
  });

  it('inscription sans audit ni métier : espace à compléter, texte « compte gratuit », aucun audit lancé', async () => {
    const s = session();
    const before = enqueued.length;
    const b = await claims.createOwnedBusiness(s, { name: 'Atelier Lune', segment: 'ecommerce' });
    expect(b.needsSetup).toBe(true);
    expect(enqueued.length).toBe(before);
    const [acc] = await listAccountBusinesses(s);
    expect(acc).toMatchObject({ needsSetup: true, free: true, prefill: { name: 'Atelier Lune', trade: '' } });
    expect(setupIntro(acc)).toBe('Votre compte gratuit est créé. Il manque votre catégorie de produits pour lancer votre première mesure.');
  });

  it('accueil : audit gratuit rattaché + première mesure le même jour → aucune comparaison (B2)', async () => {
    const origin = freeAudit({ ...KARIM, businessName: 'Plomberie Delta' });
    await db.saveAudit(origin, { trigger: 'free' });
    const b = await claims.createOwnedBusiness(session(), { name: 'Plomberie Delta', segment: 'local', audit: origin.id });
    await db.linkAuditToBusiness(origin.id, b.id);
    const { promptsToQueries } = await import('@/lib/prompts/engine');
    const queries = promptsToQueries(await listPrompts(b.id, { active: true }));
    const first = { ...createMockAudit({ ...KARIM, businessName: 'Plomberie Delta' } as never, 'autre', { queries, measuredAt: new Date(Date.now() + 60_000).toISOString() }), id: `aud_first_${++n}` };
    expect(queries).toHaveLength(5);
    await db.saveAudit(first, { businessId: b.id, trigger: 'manual' });
    const { buildWeeklyDigest } = await import('@/lib/digest');
    const d = await buildWeeklyDigest(b.id);
    expect(d.scoreDelta).toBeNull();
    expect(d.rankDelta).toBeNull();
    expect(d.rankMove ?? null).toBeNull();
    expect(d.calm).toBe(false);
    expect(d.firstMeasure).toBe(true);
    expect(`${d.headline} ${d.secondLine ?? ''}`).not.toMatch(/Semaine calme/);
    if (!d.factErrorItems.length) expect(d.headline).toMatch(/Première mesure : voici votre point de départ\. Prochaine mesure vers le/);
    // « questions sur N » : jamais plus que les 5 questions de l'offre Découverte
    const m = `${d.headline} ${d.secondLine ?? ''}`.match(/sur (\d+)/);
    if (m) expect(Number(m[1])).toBeLessThanOrEqual(5);
  });
});
