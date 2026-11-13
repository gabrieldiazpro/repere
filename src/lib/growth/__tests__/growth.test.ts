import { beforeEach, describe, expect, it, vi } from 'vitest';

// Store en mémoire, isolé.
const mem = new Map<string, Map<string, { id: string; businessId: string | null; data: unknown }>>();
vi.mock('@/lib/store', () => {
  const col = (c: string) => mem.get(c) ?? mem.set(c, new Map()).get(c)!;
  return {
    putDoc: async (c: string, id: string, data: unknown, businessId: string | null = null) => {
      col(c).set(id, { id, businessId, data });
      return { id, data };
    },
    getDoc: async (c: string, id: string) => col(c).get(id) ?? null,
    listDocs: async (c: string, o: { businessId?: string; limit?: number } = {}) =>
      [...col(c).values()].filter((d) => !o.businessId || d.businessId === o.businessId).slice(0, o.limit ?? 100),
    deleteDoc: async (c: string, id: string) => void col(c).delete(id),
  };
});

const audits = new Map<string, { audit: Record<string, unknown>; businessId: string }>();
const businesses = new Map<string, Record<string, unknown>>();
vi.mock('@/lib/db', () => ({
  isDemoBusinessId: (id: string) => id.startsWith('demo'),
  getAudit: async (id: string) => audits.get(id)?.audit ?? null,
  getAuditBusinessId: async (id: string) => audits.get(id)?.businessId ?? null,
  getLatestAuditForBusiness: async (bid: string) => [...audits.values()].filter((a) => a.businessId === bid).map((a) => a.audit).pop() ?? null,
  getBusinessRecord: async (id: string) => businesses.get(id) ?? null,
  listSubscriptionsByCustomer: async () => [],
}));
vi.mock('@/lib/house', () => ({ isHouseBusinessId: (id: string) => id.startsWith('house') }));
vi.mock('@/lib/stripe', () => ({ getStripe: () => null }));

import { generateToken, verifyToken, generateReferralCode, REFERRAL_CODE_RE, slugify } from '../tokens';
import { badgeState, renderBadgeSvg, badgeViewForBusiness, setBadgeSettings, embedCode } from '../badge';
import { rankEntries, rankingState, buildRanking, setRankingOptIn } from '../ranking';
import { enableCard, disableCard, cardView } from '../cards';
import {
  attributeReferral, getOrCreateCode, getRewardConfig, DEFAULT_REWARD, isSelfReferral,
  monthsGrantedInLastYear, referrerMonthsAllowed, onReferredFirstPayment, type Referral,
} from '../referral';
import { BADGE_MAX_AGE_DAYS, RANKING_MIN_ENTRIES } from '../constants';

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const NOW = new Date('2026-11-09T12:00:00Z');

function mkAudit(id: string, over: Record<string, unknown> = {}) {
  return {
    id, demo: false, score: 62, avgRank: 2.1, confidence: 'moyenne', measuredAt: daysAgo(3), createdAt: daysAgo(3),
    range: { low: 55, high: 70 }, margins: { score: { low: 57, high: 68 } },
    input: { businessName: 'Chez Marie', trade: 'Boulangerie', city: 'Lyon', district: '' },
    mentions: [], answers: [], providersUsed: ['chatgpt'], ...over,
  };
}

beforeEach(() => {
  mem.clear(); audits.clear(); businesses.clear();
});

describe('jetons', () => {
  it('génère des jetons uniques, valides et vérifiables', () => {
    const a = generateToken(), b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(24);
    expect(verifyToken(a, a)).toBe(true);
    expect(verifyToken(a, b)).toBe(false);
  });
  it('refuse les jetons vides ou mal formés', () => {
    const a = generateToken();
    expect(verifyToken(a, '')).toBe(false);
    expect(verifyToken(a, null)).toBe(false);
    expect(verifyToken(null, a)).toBe(false);
    expect(verifyToken(a, 'court')).toBe(false);
    expect(verifyToken(a, a + '!')).toBe(false);
  });
  it('code de parrainage au bon format, slug sans accents', () => {
    for (let i = 0; i < 50; i++) expect(generateReferralCode()).toMatch(REFERRAL_CODE_RE);
    expect(slugify('Pâtisserie d’Éric')).toBe('patisserie-deric');
  });
});

describe('badge', () => {
  it('valable moins de 45 jours, expiré ensuite ou sans mesure', () => {
    expect(badgeState(daysAgo(BADGE_MAX_AGE_DAYS - 1), NOW)).toBe('valid');
    expect(badgeState(new Date(NOW.getTime() - 44 * 86_400_000).toISOString(), NOW)).toBe('valid');
    expect(badgeState(new Date(NOW.getTime() - 45 * 86_400_000).toISOString(), NOW)).toBe('expired');
    expect(badgeState(null, NOW)).toBe('expired');
    expect(badgeState('pas une date', NOW)).toBe('expired');
  });
  it('SVG : texte exact, note facultative, jamais « recommandé »', () => {
    const ok = renderBadgeSvg({ state: 'valid', measuredAt: '2026-11-05T10:00:00Z' });
    expect(ok).toContain('Visibilité IA mesurée par Repéré');
    expect(ok).toContain('novembre 2026');
    expect(ok).not.toContain('/100');
    expect(renderBadgeSvg({ state: 'valid', measuredAt: '2026-11-05T10:00:00Z', score: 62 })).toContain('62');
    const exp = renderBadgeSvg({ state: 'expired', score: 62 });
    expect(exp).toContain('Mesure expirée');
    expect(exp).not.toContain('/100');
    for (const s of [ok, exp, embedCode('b1', 'https://x.fr/p/a')]) expect(s.toLowerCase()).not.toMatch(/recommand|chatgpt/);
  });
  it('vue publique : 404 si non activé, expiré si mesure ancienne, démo jamais valide', async () => {
    businesses.set('b1', { id: 'b1' });
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1') });
    expect(await badgeViewForBusiness('b1')).toBeNull();
    await setBadgeSettings('b1', { enabled: true });
    expect((await badgeViewForBusiness('b1'))?.state).toBe('valid');
    expect((await badgeViewForBusiness('b1'))?.score).toBeUndefined();
    await setBadgeSettings('b1', { enabled: true, showScore: true });
    expect((await badgeViewForBusiness('b1'))?.score).toBe(62);
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1', { measuredAt: daysAgo(60) }) });
    expect(await badgeViewForBusiness('b1')).toEqual({ state: 'expired' });
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1', { demo: true }) });
    expect(await badgeViewForBusiness('b1')).toEqual({ state: 'expired' });
  });
});

describe('carte de score', () => {
  it('privée par défaut, jeton requis, marge d’erreur du moteur, retrait immédiat', async () => {
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1') });
    expect(await cardView('a1', 'x'.repeat(24))).toBeNull();
    const rec = await enableCard('b1', 'a1');
    expect((await enableCard('b1', 'a1')).token).toBe(rec.token);
    expect(await cardView('a1', 'x'.repeat(24))).toBeNull();
    const v = await cardView('a1', rec.token);
    expect(v).toMatchObject({ score: 62, rangeLow: 57, rangeHigh: 68, name: 'Chez Marie' });
    expect(await disableCard('b1', 'a1')).toBe(true);
    expect(await cardView('a1', rec.token)).toBeNull();
  });
  it('refuse démo, simulation et audit d’un autre commerce', async () => {
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1') });
    audits.set('a2', { businessId: 'b1', audit: mkAudit('a2', { demo: true }) });
    await expect(enableCard('demo', 'a1')).rejects.toMatchObject({ status: 403 });
    await expect(enableCard('b2', 'a1')).rejects.toMatchObject({ status: 404 });
    await expect(enableCard('b1', 'a2')).rejects.toMatchObject({ status: 422 });
    await expect(enableCard('b1', '../x')).rejects.toMatchObject({ status: 400 });
  });
});

describe('classement', () => {
  it('seuil de 10 : préparation en dessous, publié à partir de 10', () => {
    expect(rankingState(0)).toBe('preparation');
    expect(rankingState(RANKING_MIN_ENTRIES - 1)).toBe('preparation');
    expect(rankingState(RANKING_MIN_ENTRIES)).toBe('published');
  });
  it('rang dense, égalités regroupées', () => {
    const r = rankEntries([
      { name: 'B', citationRate: 50, cited: 5, total: 10, measuredAt: '' },
      { name: 'A', citationRate: 80, cited: 8, total: 10, measuredAt: '' },
      { name: 'C', citationRate: 50, cited: 5, total: 10, measuredAt: '' },
    ]);
    expect(r.map((x) => [x.name, x.rank])).toEqual([['A', 1], ['B', 2], ['C', 2]]);
  });
  async function enroll(n: number) {
    for (let i = 0; i < n; i++) {
      const id = `b${i}`;
      const b = { id, name: `Commerce ${i}`, trade: 'Boulangerie', city: 'Lyon' };
      businesses.set(id, { id, plan: 'essentiel', isActive: true, stripeCustomerId: `cus_${id}` });
      audits.set(`a${i}`, {
        businessId: id,
        audit: mkAudit(`a${i}`, {
          measuredAt: daysAgo(2),
          answers: [], mentions: [{ providerId: 'chatgpt', mentioned: true, queryId: 'q1' }],
        }),
      });
      await setRankingOptIn(b, true);
    }
  }
  it('9 inscrits réels : en préparation, aucun nom exposé ; 10 : publié', async () => {
    await enroll(9);
    const p9 = await buildRanking('boulangerie', 'lyon');
    expect(p9).toMatchObject({ state: 'preparation', count: 9, entries: [] });
    await enroll(10);
    const p10 = await buildRanking('boulangerie', 'lyon');
    expect(p10).toMatchObject({ state: 'published', count: 10 });
    expect(p10.entries).toHaveLength(10);
  });
  it('les espaces gratuits ou sans client Stripe ne comptent pas, un seul espace par client (QA-FONCTIONNEL, M8)', async () => {
    await enroll(10);
    businesses.set('b1', { id: 'b1', plan: 'free', isActive: true, stripeCustomerId: null });
    businesses.set('b2', { id: 'b2', plan: 'essentiel', isActive: true, stripeCustomerId: 'cus_b3' });
    expect(await buildRanking('boulangerie', 'lyon')).toMatchObject({ state: 'preparation', count: 8 });
  });
  it('ignore retraits (opt-out), mesures périmées et démo ; la révocation fait repasser sous le seuil', async () => {
    await enroll(10);
    expect((await buildRanking('boulangerie', 'lyon')).state).toBe('published');
    await setRankingOptIn({ id: 'b0', name: 'Commerce 0', trade: 'Boulangerie', city: 'Lyon' }, false);
    const p = await buildRanking('boulangerie', 'lyon');
    expect(p).toMatchObject({ state: 'preparation', count: 9, entries: [] });
    audits.set('a1', { businessId: 'b1', audit: mkAudit('a1', { measuredAt: daysAgo(90), mentions: [{ providerId: 'chatgpt', mentioned: true, queryId: 'q1' }], answers: [] }) });
    expect((await buildRanking('boulangerie', 'lyon')).count).toBe(8);
    await expect(setRankingOptIn({ id: 'demo', name: 'D', trade: 'x', city: 'y' }, true)).rejects.toThrow();
  });
});

describe('parrainage', () => {
  const biz = (id: string, over: Record<string, unknown> = {}) =>
    businesses.set(id, { id, ownerId: `u-${id}`, contactEmail: `${id}@ex.fr`, stripeCustomerId: null, createdAt: new Date().toISOString(), ...over });

  it('récompense par défaut : 1 mois chacun, paramétrable et bornée', () => {
    expect(getRewardConfig({})).toEqual(DEFAULT_REWARD);
    expect(getRewardConfig({ GROWTH_REFERRAL_REWARD: '{"referrerMonths":2,"refereeMonths":3}' })).toMatchObject({ referrerMonths: 2, refereeMonths: 3 });
    expect(getRewardConfig({ GROWTH_REFERRAL_REWARD: '{"referrerMonths":99}' }).referrerMonths).toBe(1);
    expect(getRewardConfig({ GROWTH_REFERRAL_REWARD: 'pas du json' })).toEqual(DEFAULT_REWARD);
  });
  it('code stable par compte', async () => {
    const a = await getOrCreateCode('b1');
    expect((await getOrCreateCode('b1')).code).toBe(a.code);
    expect((await getOrCreateCode('b2')).code).not.toBe(a.code);
  });
  it('attribution : valide, code inconnu, double parrain, auto-parrainage', async () => {
    biz('p'); biz('f'); biz('f2'); biz('same', { ownerId: 'u-p' }); biz('mail', { contactEmail: 'P@ex.fr' });
    const { code } = await getOrCreateCode('p');
    expect(await attributeReferral({ code: 'REP-NOPE', refereeBusinessId: 'f' })).toMatchObject({ ok: false, reason: 'invalid_code' });
    expect(await attributeReferral({ code, refereeBusinessId: 'p' })).toMatchObject({ ok: false, reason: 'self_referral' });
    expect(await attributeReferral({ code, refereeBusinessId: 'same' })).toMatchObject({ ok: false, reason: 'self_referral' });
    expect(await attributeReferral({ code, refereeBusinessId: 'mail' })).toMatchObject({ ok: false, reason: 'self_referral' });
    expect(await attributeReferral({ code, refereeBusinessId: 'ghost' })).toMatchObject({ ok: false, reason: 'referee_unknown' });
    const ok = await attributeReferral({ code: code.toLowerCase(), refereeBusinessId: 'f' });
    expect(ok).toMatchObject({ ok: true, referral: { status: 'pending', referrerBusinessId: 'p' } });
    expect(await attributeReferral({ code, refereeBusinessId: 'f' })).toMatchObject({ ok: false, reason: 'already_referred' });
    const { code: c2 } = await getOrCreateCode('f2');
    expect(await attributeReferral({ code: c2, refereeBusinessId: 'f' })).toMatchObject({ ok: false, reason: 'already_referred' });
  });
  it('isSelfReferral : même client Stripe', () => {
    expect(isSelfReferral({ id: 'a', ownerId: 'x', contactEmail: 'a@a', stripeCustomerId: 'cus_1' }, { id: 'b', ownerId: 'y', contactEmail: 'b@b', stripeCustomerId: 'cus_1' })).toBe(true);
    expect(isSelfReferral({ id: 'a', ownerId: 'x', contactEmail: 'a@a', stripeCustomerId: undefined }, { id: 'b', ownerId: 'y', contactEmail: 'b@b', stripeCustomerId: undefined })).toBe(false);
  });
  it('plafond annuel', () => {
    const r = (m: number, d: number): Referral => ({ refereeBusinessId: 'x', referrerBusinessId: 'p', code: 'c', status: 'rewarded', createdAt: '', qualifiedAt: daysAgo(d), referrerMonths: m });
    expect(monthsGrantedInLastYear([r(2, 10), r(3, 400)], NOW)).toBeGreaterThanOrEqual(0);
    expect(monthsGrantedInLastYear([r(2, 10), r(3, 400)])).toBe(2);
    expect(referrerMonthsAllowed(0, DEFAULT_REWARD)).toBe(1);
    expect(referrerMonthsAllowed(6, DEFAULT_REWARD)).toBe(0);
    expect(referrerMonthsAllowed(5, { ...DEFAULT_REWARD, referrerMonths: 3 })).toBe(1);
  });
  it('premier paiement : ne qualifie ni un montant nul ni un filleul sans parrain, et n’est accordé qu’une fois', async () => {
    biz('p'); biz('f');
    expect((await onReferredFirstPayment({ refereeBusinessId: 'f', amountPaidCents: 2900 })).status).toBe('no_referral');
    const { code } = await getOrCreateCode('p');
    await attributeReferral({ code, refereeBusinessId: 'f' });
    expect((await onReferredFirstPayment({ refereeBusinessId: 'f', amountPaidCents: 0 })).status).toBe('not_paid');
    const first = await onReferredFirstPayment({ refereeBusinessId: 'f', amountPaidCents: 2900, now: NOW });
    expect(first.status).toBe('rewarded');
    expect(first.referral?.stripe?.applied).toBe(false); // sans clé Stripe : rien n'est appliqué, rien n'est prétendu
    expect((await onReferredFirstPayment({ refereeBusinessId: 'f', amountPaidCents: 2900 })).status).toBe('not_pending');
  });
});

describe('parrainage : mois accordés (QA-FONCTIONNEL)', () => {
  it('ne compte pas les mois du parrain qui n’ont pas été appliqués par Stripe', () => {
    const at = new Date().toISOString();
    const base = { refereeBusinessId: 'x', referrerBusinessId: 'p', code: 'c', status: 'rewarded' as const, createdAt: at, qualifiedAt: at, referrerMonths: 1 };
    expect(monthsGrantedInLastYear([{ ...base, stripe: { referrerCoupon: null, refereeCoupon: null, applied: false } }])).toBe(0);
    expect(monthsGrantedInLastYear([{ ...base, stripe: { referrerCoupon: null, refereeCoupon: 'c2', applied: true, referrerApplied: false } }])).toBe(0);
    expect(monthsGrantedInLastYear([{ ...base, stripe: { referrerCoupon: 'c1', refereeCoupon: null, applied: true, referrerApplied: true } }])).toBe(1);
  });
});
