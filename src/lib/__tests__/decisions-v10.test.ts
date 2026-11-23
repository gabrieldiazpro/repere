/**
 * V10 (docs/v10/DECISIONS.md) : offres, rythmes, budgets, quotas, partenaires, pilotes. Les marges sont recalculées à
 * partir de la table des droits et de la grille : si un volume ou un prix change, ce test dit si la marge tient.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  CONTENTS_PER_MONTH,
  assertWithinPublishQuota,
  getEntitlements,
  withOfferOptions,
  type Entitlements,
} from '@/lib/entitlements';
import { AGENCY_INCLUDED_CLIENTS, DECOUVERTE_PLANS, V2_PLANS, getAddon, getPlan, plansForSegment, type PlanId } from '@/lib/plans';
import { grossMargin, measureCostEur } from '@/lib/economics';
import { paidBudgetForPlan } from '@/lib/engine/audit';
import { MONTHLY_QUOTA } from '@/lib/content/quota';
import { appliedThisMonth } from '@/lib/publish/service';
import { computeCommission, netBase } from '@/lib/partners/commission';
import { defaultTermsFor, isConsularChamber, quarterOf } from '@/lib/partners/terms';
import { FAMILIES } from '@/lib/partners/program';
import { refundExclTax } from '@/lib/partners/payments';
import { PILOT_MONTHS, PILOT_SLOTS, PILOT_SLOTS_BY_SEGMENT, PILOT_TIER } from '@/lib/pilots/validate';
import { seatsBySegment } from '@/lib/pilots/store';

type Seg = 'local' | 'pme' | 'ecommerce';
const SEGS: Seg[] = ['local', 'pme', 'ecommerce'];
const ent = (plan: string, segment: Seg = 'local'): Entitlements => getEntitlements({ id: `t-${plan}-${segment}`, plan: plan as never, segment, planId: null, isActive: true });
const price = (id: PlanId) => getPlan(id).priceCents / 100;
const pre = (seg: Seg) => (seg === 'ecommerce' ? 'ecom' : seg);

describe('V10 — une seule offre gratuite, 3 paliers par parcours', () => {
  it('la grille de chaque parcours ne contient plus de « Test gratuit » et commence par Découverte', () => {
    for (const seg of SEGS) {
      const list = plansForSegment(seg);
      expect(list.some((p) => /_audit_free$/.test(p.id))).toBe(false);
      expect(list.filter((p) => p.priceCents === 0)).toHaveLength(0); // Découverte est dans DECOUVERTE_PLANS
      expect(DECOUVERTE_PLANS.find((p) => p.segment === seg)?.name).toBe('Découverte');
    }
    for (const p of V2_PLANS) expect(p.name).not.toMatch(/test gratuit/i);
    for (const p of DECOUVERTE_PLANS) expect(p.features.join(' ')).toMatch(/60 secondes et test de marque/);
  });
});

describe('V10 — rythmes, passages et IA', () => {
  it('Découverte : 5 questions, chaque mois, 3 IA, sans IA de Google', () => {
    const e = ent('free');
    expect([e.prompts, e.frequency, e.runs, e.engines.length]).toEqual([5, 'monthly', 3, 3]);
  });
  it('Essentiel chaque mois (3 passages), Accompagné chaque semaine (2 passages), Agence chaque mois', () => {
    for (const seg of SEGS) {
      expect([ent('essentiel', seg).frequency, ent('essentiel', seg).runs]).toEqual(['monthly', 3]);
      expect([ent('accompagne', seg).frequency, ent('accompagne', seg).runs]).toEqual(['weekly', 2]);
    }
    const a = ent('agency');
    expect([a.prompts, a.frequency, a.runs, a.engines.length]).toEqual([30, 'monthly', 3, 6]);
    expect(a.agency.includedClients).toBe(AGENCY_INCLUDED_CLIENTS);
  });
  it('options : Copilot/DeepSeek ajoutés seulement si l’offre les permet ; client Agence hebdomadaire = 2 passages', () => {
    const acc = withOfferOptions(ent('accompagne', 'pme'), { engines: ['copilot', 'deepseek', 'grok'] });
    expect(acc.engines).toContain('copilot');
    expect(acc.engines).toContain('deepseek');
    expect(acc.engines).not.toContain('grok');
    expect(withOfferOptions(ent('essentiel', 'pme'), { engines: ['copilot'] }).engines).not.toContain('copilot');
    const weekly = withOfferOptions(ent('agency'), { weekly: true });
    expect([weekly.frequency, weekly.runs]).toEqual(['weekly', 2]);
    expect(withOfferOptions(ent('essentiel'), { weekly: true }).frequency).toBe('monthly');
  });
});

describe('V10 — marge brute ≥ 70 % (hors travail humain)', () => {
  it('Essentiel (mensuel et annuel) et Accompagné, dans les 3 parcours, options comprises', () => {
    for (const seg of SEGS) {
      const ess = ent('essentiel', seg);
      expect(grossMargin(price(`${pre(seg)}_essentiel_month` as PlanId), ess).rate, `${seg} Essentiel`).toBeGreaterThanOrEqual(0.7);
      expect(grossMargin(price(`${pre(seg)}_essentiel_year` as PlanId) / 12, ess).rate, `${seg} Essentiel annuel`).toBeGreaterThanOrEqual(0.7);
      const acc = ent('accompagne', seg);
      const accPrice = price(`${pre(seg)}_accompagne_month` as PlanId);
      expect(grossMargin(accPrice, acc).rate, `${seg} Accompagné`).toBeGreaterThanOrEqual(0.7);
      const withOpt = withOfferOptions(acc, { engines: ['copilot', 'deepseek'] });
      expect(grossMargin(accPrice + getAddon('option_more_ai').priceCents / 100, withOpt).rate, `${seg} Accompagné + option`).toBeGreaterThanOrEqual(0.7);
    }
    // Réseau : 5 établissements en Essentiel local.
    expect(grossMargin(price('local_reseau_month'), ent('essentiel', 'local'), 5).rate).toBeGreaterThanOrEqual(0.7);
  });
  it('Agence : 30 à 45 % pour 10 clients (décision : ≈ 34 %) ; chaque option reste rentable', () => {
    const a = ent('agency');
    const m = grossMargin(price('agency_month'), a, AGENCY_INCLUDED_CLIENTS);
    expect(m.rate).toBeGreaterThan(0.3);
    expect(m.rate).toBeLessThan(0.45);
    const perClient = measureCostEur(a);
    expect(getAddon('agency_extra_client').priceCents / 100).toBeGreaterThan(perClient + a.seoData.monthlyBudgetEur);
    const weekly = withOfferOptions(a, { weekly: true });
    const extraWeekly = grossMargin(0, weekly).aiEur - grossMargin(0, a).aiEur;
    expect(1 - extraWeekly / (getAddon('agency_weekly_client').priceCents / 100)).toBeGreaterThanOrEqual(0.7);
  });
});

describe('V10 — budget par mesure calé sur l’offre (défaut), plafond 25 €', () => {
  afterEach(() => {
    delete process.env.AUDIT_BUDGET_PAID_MODE;
    delete process.env.AUDIT_BUDGET_PAID_MAX_EUR;
  });
  it('défaut = offre : budget = coût prévu + 10 %, jamais au-delà de 25 €', () => {
    expect(paidBudgetForPlan('paid', 10, 2.7)).toBeCloseTo(11, 5);
    expect(paidBudgetForPlan('paid', 40, 2.7)).toBe(25);
    expect(paidBudgetForPlan('free', 10, 0.6)).toBe(0.6);
    process.env.AUDIT_BUDGET_PAID_MODE = 'fixe';
    expect(paidBudgetForPlan('paid', 10, 2.7)).toBe(2.7);
  });
  it('la mesure la plus chère (Accompagné PME + options) tient sous le plafond : aucun appel retiré', () => {
    for (const seg of SEGS) {
      const e = withOfferOptions(ent('accompagne', seg), { engines: ['copilot', 'deepseek'] });
      expect(measureCostEur(e) * 1.1).toBeLessThanOrEqual(25);
    }
  });
});

describe('V10 — quotas : contenus 0/2/6/6, corrections 20/100/200', () => {
  it('contenus', () => {
    expect([CONTENTS_PER_MONTH.decouverte, CONTENTS_PER_MONTH.essentiel, CONTENTS_PER_MONTH.accompagne, CONTENTS_PER_MONTH.agence]).toEqual([0, 2, 6, 6]);
    expect(MONTHLY_QUOTA).toBe(CONTENTS_PER_MONTH);
    expect([ent('free').contentsPerMonth, ent('essentiel').contentsPerMonth, ent('accompagne').contentsPerMonth, ent('agency').contentsPerMonth]).toEqual([0, 2, 6, 6]);
  });
  it('corrections : plafond appliqué par l’API de publication', () => {
    expect([ent('free'), ent('essentiel'), ent('accompagne'), ent('agency')].map((e) => e.publish.changeSetsPerMonth)).toEqual([0, 20, 100, 200]);
    const now = new Date('2026-11-23T10:00:00Z');
    const list = [
      ...Array.from({ length: 20 }, () => ({ platform: 'wordpress' as const, appliedAt: '2026-11-05T10:00:00Z' })),
      { platform: 'export' as const, appliedAt: '2026-11-06T10:00:00Z' },
      { platform: 'wordpress' as const, appliedAt: '2026-10-30T10:00:00Z' },
      { platform: 'wordpress' as const, appliedAt: undefined },
    ];
    expect(appliedThisMonth(list as never, now)).toBe(20);
    expect(() => assertWithinPublishQuota(ent('essentiel'), 20)).toThrow(/20 séries/);
    expect(() => assertWithinPublishQuota(ent('essentiel'), 19)).not.toThrow();
    expect(() => assertWithinPublishQuota(ent('accompagne'), 99)).not.toThrow();
    expect(() => assertWithinPublishQuota(ent('free'), 0)).toThrow();
  });
});

describe('V10 — partenaires', () => {
  it('conditions décidées par famille ; CCI et chambres : atelier, pas de commission', () => {
    expect(FAMILIES.agence.commission).toEqual({ rate: 0.3, months: 12 });
    expect(FAMILIES.prescripteur.commission).toEqual({ rate: 0.2, months: 12 });
    expect(FAMILIES.formation.commission).toEqual({ rate: 0.2, months: 12 });
    expect(FAMILIES.plateforme.commission).toBeNull();
    expect(isConsularChamber('CCI Lyon Métropole')).toBe(true);
    expect(isConsularChamber('Chambre de métiers et de l’artisanat du Rhône')).toBe(true);
    expect(isConsularChamber('Cabinet Durand, expertise comptable')).toBe(false);
    expect(defaultTermsFor('prescripteur', 'CCI Nantes')).toBeNull();
    expect(defaultTermsFor('prescripteur', 'Fédération des artisans')).toEqual({ rate: 0.2, months: 12 });
  });
  it('remboursements déduits, trop-versé signalé, commission par trimestre', () => {
    const accepted = [{ at: '2026-01-01T00:00:00Z', status: 'accepte' }];
    const pay = (id: string, paidAt: string, refunded = 0) => {
      const row = { invoiceId: id, businessId: 'b1', partnerCode: 'X', amountPaidCents: 10_000, amountExclTaxCents: 10_000, currency: 'eur', paidAt };
      return { ...row, refundedCents: refunded, refundedExclTaxCents: refundExclTax(row, refunded) };
    };
    const s = computeCommission({
      terms: { rate: 0.3, months: 12 },
      history: accepted,
      payments: [pay('in_1', '2026-02-10T00:00:00Z'), pay('in_2', '2026-04-10T00:00:00Z', 4_000), pay('in_3', '2026-05-10T00:00:00Z', 10_000)],
      payouts: [{ cents: 9_000 }],
      now: new Date('2026-06-01T00:00:00Z'),
    });
    expect(s.earnedCents).toBe(3_000 + 1_800);
    expect(s.refundedExclTaxCents).toBe(14_000);
    expect(s.lines.find((l) => l.invoiceId === 'in_3')?.reason).toBe('Remboursé intégralement.');
    expect(s.dueCents).toBe(0);
    expect(s.clawbackCents).toBe(9_000 - 4_800);
    expect(s.byQuarter).toEqual({ '2026-T1': 3_000, '2026-T2': 1_800 });
    expect(quarterOf('2026-12-31T23:00:00Z')).toBe('2026-T4');
    expect(netBase({ amountExclTaxCents: 8_333, amountPaidCents: 10_000, refundedExclTaxCents: 9_999 })).toBe(0);
    // Remboursement partiel TTC → part HT au prorata.
    expect(refundExclTax({ amountPaidCents: 12_000, amountExclTaxCents: 10_000 }, 6_000)).toBe(5_000);
  });
});

describe('V10 — offre pilote', () => {
  it('3 mois d’Accompagné, 10 places : 4 local, 3 PME, 3 e-commerce', () => {
    expect([PILOT_MONTHS, PILOT_TIER, PILOT_SLOTS]).toEqual([3, 'accompagne', 10]);
    expect(PILOT_SLOTS_BY_SEGMENT).toEqual({ local: 4, pme: 3, ecommerce: 3 });
    const rows = [
      ...Array.from({ length: 5 }, () => ({ status: 'retenue' as const, segment: 'local' as const })),
      { status: 'active' as const, segment: 'pme' as const },
      { status: 'refusee' as const, segment: 'pme' as const },
    ];
    const s = seatsBySegment(rows as never);
    expect(s.local).toEqual({ slots: 4, taken: 4, left: 0 });
    expect(s.pme).toEqual({ slots: 3, taken: 1, left: 2 });
    expect(s.ecommerce.left).toBe(3);
  });
});
