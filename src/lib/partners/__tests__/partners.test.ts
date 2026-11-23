import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), 'repere-partners-'));
for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'RESEND_API_KEY']) delete process.env[k];

const core = await import('@/lib/roi/core');
const roi = await import('@/lib/roi/attribution');
const p = await import('..');
const { computeCommission, acceptedWindows } = await import('../commission');

const fields = (over: Partial<import('../validate').PartnerFields> = {}): import('../validate').PartnerFields => ({
  ...p.EMPTY_PARTNER,
  family: 'agence',
  company: 'Agence Étoile & Fils',
  website: 'www.agence-etoile.fr',
  name: 'Lina Morel',
  email: 'Lina@Agence-Etoile.fr',
  message: 'Nous refaisons une quinzaine de sites d’artisans par an.',
  consent: true,
  ...over,
});

describe('programme', () => {
  it('quatre familles ; plateformes sans commission ni mention « partenaire officiel »', () => {
    expect(p.PARTNER_FAMILIES).toEqual(['agence', 'plateforme', 'prescripteur', 'formation']);
    expect(p.FAMILIES.plateforme.commission).toBeNull();
    expect(p.COMPATIBILITY_NOTE).toMatch(/pas des partenaires officiels/);
    const all = JSON.stringify(p.FAMILIES);
    expect(all).not.toMatch(/partenaire officiel de/i);
  });
  it('la commission agence reste celle publiée sur /agences (30 % pendant 12 mois)', () => {
    expect(p.FAMILIES.agence.commission).toEqual({ rate: 0.3, months: 12 });
    expect(p.commissionLabel(p.FAMILIES.agence.commission)).toBe('30 % pendant 12 mois');
  });
});

describe('codes et liens', () => {
  it('propose un code lisible, sans accents, et unique', () => {
    expect(p.suggestCode('Agence Étoile & Fils')).toBe('agence-etoile-et-fils');
    expect(p.suggestCode('A')).toBe('a-pro');
    expect(p.suggestCode('REP agence')).toBe('p-rep-agence');
    expect(p.uniqueCode('studio', ['studio', 'studio-2'])).toBe('studio-3');
  });
  it('construit le lien ?ref= vers n’importe quelle page', () => {
    expect(p.referralLink('https://repere-ia.fr/', 'studio')).toBe('https://repere-ia.fr/?ref=studio');
    expect(p.referralLink('https://repere-ia.fr', 'studio', '/analyse?segment=pme')).toBe('https://repere-ia.fr/analyse?segment=pme&ref=studio');
  });
  it('lit ?ref= comme une campagne partenaire, sans écraser de vrais UTM ni prendre un code de parrainage', () => {
    const a = core.attributionFromLocation({ href: 'https://repere-ia.fr/tarifs?ref=studio-nord', referrer: 'https://www.google.com/' });
    expect(a).toMatchObject({ utmSource: 'partenaire', utmMedium: 'partenaire', utmCampaign: 'studio-nord', landing: '/tarifs', referrerHost: 'google.com' });
    expect(core.partnerCodeOf(a)).toBe('studio-nord');
    const utm = core.attributionFromLocation({ href: 'https://repere-ia.fr/?ref=studio&utm_source=newsletter' });
    expect(utm?.utmSource).toBe('newsletter');
    expect(core.partnerCodeOf(utm)).toBeNull();
    expect(core.partnerCodeOf(core.attributionFromLocation({ href: 'https://repere-ia.fr/inscription?ref=REP-BCDFGHJK' }))).toBeNull();
    expect(core.partnerRefOf('<script>')).toBeUndefined();
    // l'origine envoyée par le formulaire survit à la validation serveur
    expect(core.partnerCodeOf(core.sanitizeAttribution(a))).toBe('studio-nord');
  });
});

describe('validation', () => {
  it('accepte une candidature complète et exige le consentement', () => {
    expect(p.validatePartner(fields())).toEqual({});
    expect(Object.keys(p.validatePartner({ ...p.EMPTY_PARTNER })).sort()).toEqual(['company', 'consent', 'email', 'family', 'message', 'name', 'website'].sort());
  });
  it('ne fait pas confiance aux types reçus', () => {
    const f = p.partnerFieldsFrom({ family: 'pirate', consent: 'true', listOk: true, audience: 'x' });
    expect(f.family).toBe('');
    expect(f.consent).toBe(false);
    expect(f.listOk).toBe(true);
    expect(f.audience).toBe('');
  });
});

describe('commission', () => {
  const history = [
    { at: '2026-12-01T00:00:00Z', status: 'a_etudier' },
    { at: '2026-12-02T00:00:00Z', status: 'accepte' },
  ];
  const pay = (over: Partial<import('../commission').PaymentRow>): import('../commission').PaymentRow => ({
    invoiceId: `in_${Math.random().toString(36).slice(2)}`,
    businessId: 'b1',
    partnerCode: 'studio',
    amountPaidCents: 11880,
    amountExclTaxCents: 9900,
    currency: 'eur',
    paidAt: '2027-01-10T10:00:00Z',
    ...over,
  });
  it('calcule sur le HT des paiements réels, dans la fenêtre de 12 mois du premier paiement', () => {
    const s = computeCommission({
      terms: { rate: 0.3, months: 12 },
      history,
      payments: [pay({}), pay({ paidAt: '2027-12-01T10:00:00Z' }), pay({ paidAt: '2028-01-11T10:00:00Z' })],
      payouts: [{ cents: 1000 }],
      now: new Date('2028-02-01T00:00:00Z'),
    });
    expect(s.lines.filter((l) => l.eligible)).toHaveLength(2);
    expect(s.earnedCents).toBe(2 * 2970);
    expect(s.paidOutCents).toBe(1000);
    expect(s.dueCents).toBe(5940 - 1000);
    expect(s.lines.find((l) => !l.eligible)?.reason).toMatch(/12 mois/);
    expect(s.payingClients).toBe(1);
  });
  it('écarte : avant acceptation, pendant une suspension, autre devise, auto-parrainage', () => {
    const h = [...history, { at: '2027-03-01T00:00:00Z', status: 'suspendu' }];
    const s = computeCommission({
      terms: { rate: 0.2, months: 12 },
      history: h,
      payments: [
        pay({ paidAt: '2026-11-20T00:00:00Z', businessId: 'b0' }),
        pay({ paidAt: '2027-04-01T00:00:00Z', businessId: 'b2' }),
        pay({ currency: 'usd', businessId: 'b3' }),
        pay({ businessId: 'b4' }),
      ],
      payouts: [],
      partnerDomain: 'studio.fr',
      contactEmails: { b4: 'moi@studio.fr' },
      now: new Date('2027-06-01T00:00:00Z'),
    });
    expect(s.earnedCents).toBe(0);
    expect(s.lines.map((l) => l.reason).join(' | ')).toMatch(/hors période.*|USD|auto-parrainage/);
    expect(acceptedWindows(h)).toHaveLength(1);
  });
  it('sans conditions : rien de dû ; le dû n’est jamais négatif', () => {
    const s = computeCommission({ terms: null, history, payments: [pay({})], payouts: [{ cents: 5000 }] });
    expect(s.earnedCents).toBe(0);
    expect(s.dueCents).toBe(0);
  });
  it('montant HT borné au payé', () => {
    expect(p.exclTax({ amountPaid: 11880, totalExcludingTax: 9900 })).toBe(9900);
    expect(p.exclTax({ amountPaid: 11880, tax: 1980 })).toBe(9900);
    expect(p.exclTax({ amountPaid: 1000, totalExcludingTax: 5000 })).toBe(1000);
    expect(p.exclTax({ amountPaid: 1000 })).toBe(1000);
  });
});

describe('stockage, annuaire, paiements et suivi', () => {
  it('accepter attribue un code unique et les conditions de la famille ; l’annuaire exige l’accord', async () => {
    const now = new Date('2026-12-01T10:00:00Z');
    const a = await p.savePartnerApplication(p.buildPartner(fields(), now), now);
    expect(a.duplicate).toBe(false);
    expect((await p.savePartnerApplication(p.buildPartner(fields(), now), now)).duplicate).toBe(true);
    const b = await p.savePartnerApplication(p.buildPartner(fields({ email: 'autre@etoile.fr', website: 'etoile-2.fr', listOk: true }), now), now);

    const ra = await p.setPartnerStatus(a.id, 'accepte', new Date('2026-12-02T00:00:00Z'));
    const rb = await p.setPartnerStatus(b.id, 'accepte', new Date('2026-12-02T00:00:00Z'));
    expect(ra?.code).toBe('agence-etoile-et-fils');
    expect(rb?.code).toBe('agence-etoile-et-fils-2');
    expect(ra?.commission).toEqual({ rate: 0.3, months: 12 });

    expect(p.publicDirectory(await p.listPartners())).toEqual([]); // personne n'est publié d'office
    expect(await p.setPartnerListed(a.id, true)).toBeNull(); // pas d'accord
    expect(await p.setPartnerListed(b.id, true)).not.toBeNull();
    const dir = p.publicDirectory(await p.listPartners());
    expect(dir.map((d) => d.id)).toEqual([b.id]);
    await p.withdrawListing(b.id);
    expect(p.publicDirectory(await p.listPartners())).toEqual([]);

    expect(await p.setPartnerCode(a.id, 'agence-etoile-et-fils-2')).toBeNull(); // déjà pris
    expect(await p.setPartnerCode(a.id, 'Rep-x')).toBeNull();
    expect((await p.setPartnerCode(a.id, 'etoile'))?.code).toBe('etoile');
    expect(await p.setPartnerTerms(a.id, 80, 12)).toBeNull();
    expect((await p.setPartnerTerms(a.id, 25, 6))?.commission).toEqual({ rate: 0.25, months: 6 });
    expect(await p.addPartnerPayout(a.id, -3, '')).toBeNull();
    expect((await p.addPartnerPayout(a.id, 10.5, 'FA-001'))?.payouts[0].cents).toBe(1050);

    // Espace inscrit par le lien, puis facture payée enregistrée par le webhook
    await roi.recordAttribution('business', 'biz-1', core.attributionFromLocation({ href: 'https://repere-ia.fr/?ref=etoile' }), { now: new Date('2026-12-05T00:00:00Z') });
    await roi.recordAttribution('analysis', 'an-1', core.attributionFromLocation({ href: 'https://repere-ia.fr/analyse?ref=etoile' }));
    const rec = await p.recordPartnerPayment({ invoiceId: 'in_test_1', businessId: 'biz-1', subscriptionId: 'sub_1', amountPaidCents: 11880, amountExclTaxCents: 9900, currency: 'eur', paidAt: '2026-12-06T00:00:00Z' });
    expect(rec?.partnerCode).toBe('etoile');
    await p.recordPartnerPayment({ invoiceId: 'in_test_1', businessId: 'biz-1', subscriptionId: 'sub_1', amountPaidCents: 99999, amountExclTaxCents: 99999, currency: 'eur' });
    expect(await p.recordPartnerPayment({ invoiceId: 'in_test_2', businessId: 'biz-sans-origine', subscriptionId: null, amountPaidCents: 1000, amountExclTaxCents: 1000, currency: 'eur' })).toBeNull();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const inputs = await p.loadTrackingInputs();
    const row = (await p.listPartners()).find((r) => r.id === a.id)!;
    const t = await p.trackPartner(row, inputs, new Date('2027-01-01T00:00:00Z'));
    warn.mockRestore();
    expect(t?.signups.map((s) => s.businessId)).toEqual(['biz-1']);
    expect(t?.analyses).toBe(1);
    expect(t?.commission.lines).toHaveLength(1); // idempotent : la facture rejouée n'est pas comptée deux fois
    expect(t?.commission.earnedCents).toBe(Math.round(9900 * 0.25));
    expect(t?.commission.dueCents).toBe(Math.round(9900 * 0.25) - 1050);
  });

  it('notification au fondateur : contenu échappé, lien admin', () => {
    const rec = p.buildPartner(fields({ company: '<b>Agence</b>' }));
    const n = p.renderPartnerNotification('prt_abcdefgh', rec, 'https://repere-ia.fr');
    expect(n.subject).toContain('Agence');
    expect(n.html).not.toContain('<b>Agence</b>');
    expect(n.text).toContain('https://repere-ia.fr/admin/partenaires#prt_abcdefgh');
    expect(p.partnersNotifyAddress({ PARTNERS_NOTIFY_EMAIL: 'a@b.fr' })).toBe('a@b.fr');
  });
});
