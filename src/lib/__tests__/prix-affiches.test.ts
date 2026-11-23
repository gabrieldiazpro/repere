/**
 * V10 : aucun prix contradictoire nulle part. Compare les prix affichés (tableau « Tous les prix », comparatif, CGV,
 * llms.txt, JSON-LD Offer, pages du site) aux offres de src/lib/plans.ts, seule source des prix.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { PLANS, PLAN_ADDONS, formatPrice, getAddon, getPlan, type Plan } from '@/lib/plans';
import { PriceTable } from '@/components/site/PriceTable';
import { softwareAppLd } from '@/lib/seo/jsonld';
import { allCompareRows } from '@/components/pages/pricing-data';

const ROOT = path.resolve(__dirname, '../../..');
const euros = (cents: number) => Math.round(cents) / 100;
const sp = (t: string) => t.replace(/[\s\u00a0\u202f]+/g, ' ');
const live = PLANS.filter((p) => !p.legacy);

/** Montants autorisés pour chaque nom d'offre (tous parcours confondus), en euros. */
function allowedFor(name: string): Set<number> {
  const byName = (re: RegExp) => live.filter((p) => re.test(p.name)).map((p) => euros(p.priceCents));
  const sets: Record<string, number[]> = {
    Essentiel: byName(/^Essentiel/),
    Accompagné: [...byName(/^Accompagné/), euros(getAddon('option_more_ai').priceCents)],
    Agence: [...byName(/^Agence|^Exécution/), ...PLAN_ADDONS.filter((a) => a.unit === 'client').map((a) => euros(a.priceCents))],
    Réseau: byName(/^Réseau/),
    // V10 (PILOTE-AUTO) : « Tout fait pour vous, sans rendez-vous »
    'Pilote automatique': byName(/^Pilote automatique/),
    Audit: byName(/^Audit/),
    Découverte: [0],
  };
  return new Set(sets[name] ?? []);
}

const NAME_RE = /(Essentiel|Accompagné|Agence|Réseau|Pilote automatique|Audit(?: approfondi| catalogue| \+ plan)|Découverte)([^.\n;]{0,60}?)(\d{1,3}(?: \d{3})*)(?:,\d{2})? ?€/g;

function amountsByOffer(text: string): { offer: string; amount: number; ctx: string }[] {
  const out: { offer: string; amount: number; ctx: string }[] = [];
  for (const m of text.matchAll(NAME_RE)) {
    // Un autre nom d'offre entre le nom et le montant : le montant appartient à ce dernier (repris par la boucle).
    if (/(Essentiel|Accompagné|Agence|Réseau|Pilote automatique|Audit|Découverte)/.test(m[2])) continue;
    const offer = m[1].startsWith('Audit') ? 'Audit' : m[1];
    out.push({ offer, amount: Number(m[3].replace(/ /g, '')), ctx: m[0] });
  }
  return out;
}

function contradictions(where: string, text: string): string[] {
  const flat = sp(text).replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#x27;|&#39;/g, (x) => (x === '&nbsp;' ? ' ' : "'")).replace(/\s+/g, ' ');
  const out: string[] = [];
  for (const a of amountsByOffer(flat)) if (!allowedFor(a.offer).has(a.amount)) out.push(`${where} : « ${a.ctx} » (${a.amount} € pour ${a.offer})`);
  for (const m of flat.matchAll(/.{0,40}(20 clients en Essentiel|\+ ?6 ?€\/mois par client).{0,20}/g)) out.push(`${where} : ancienne offre Agence « ${m[0]} »`);
  // « Test gratuit » comme nom d'offre (les commentaires qui citent l'ancien nom entre guillemets sont permis).
  for (const m of flat.matchAll(/.{0,30}(?<!« ?)Test gratuit(?! :).{0,30}/g)) out.push(`${where} : « ${m[0]} »`);
  return out;
}

function expectNoContradiction(where: string, text: string) {
  expect(contradictions(where, text)).toEqual([]);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) {
      if (f === '__tests__' || f === 'app' && dir.endsWith(path.join('src', 'app'))) continue; // espace client exclu
      walk(p, out);
    } else if (/\.(tsx?|md)$/.test(f)) out.push(p);
  }
  return out;
}

describe('prix affichés = src/lib/plans.ts', () => {
  it('le détecteur repère un prix contradictoire', () => {
    expect(contradictions('t', 'Essentiel à 35 €/mois')).toHaveLength(1);
    expect(contradictions('t', 'Agence : 149 €/mois, 20 clients en Essentiel')).toHaveLength(1);
    expect(contradictions('t', 'Accompagné 99 €/mois, Essentiel 29 €/mois')).toEqual([]);
    expect(contradictions('t', 'Pilote automatique : 49 €/mois')).toHaveLength(1);
    expect(contradictions('t', `Pilote automatique : ${formatPrice(getPlan('local_pilote_month').priceCents)}/mois`)).toEqual([]);
  });

  it('tableau « Tous les prix en un coup d’œil » (/tarifs)', () => {
    const html = renderToStaticMarkup(PriceTable({ updated: '2026-11-23' }));
    for (const id of ['local_essentiel_month', 'pme_essentiel_month', 'ecom_essentiel_month', 'local_pilote_month', 'pme_pilote_month', 'ecom_pilote_month', 'local_accompagne_month', 'pme_accompagne_month', 'ecom_accompagne_month', 'agency_month'] as const) {
      expect(sp(html)).toContain(sp(formatPrice(getPlan(id).priceCents)));
    }
    expectNoContradiction('PriceTable', html);
  });

  it('JSON-LD Offer de /tarifs : un prix par offre, égal à la grille', () => {
    const ld = softwareAppLd('/tarifs', ['local', 'pme', 'ecommerce', 'agence']);
    const offers = ld.offers as { '@id': string; price: string }[];
    expect(offers.length).toBeGreaterThan(10);
    for (const o of offers) {
      const id = o['@id'].split('#offer-')[1];
      const plan = PLANS.find((p) => p.id === id) as Plan | undefined;
      const cents = plan ? plan.priceCents : getAddon(id as never).priceCents;
      expect(o.price, id).toBe((cents / 100).toFixed(2));
    }
    expect(offers.some((o) => /_audit_free$/.test(o['@id']))).toBe(false);
    for (const id of ['local_pilote_month', 'pme_pilote_month', 'ecom_pilote_month']) expect(offers.some((o) => o['@id'].endsWith(`#offer-${id}`)), id).toBe(true);
  });

  it('comparatif des fonctionnalités : options au bon prix', () => {
    const rows = allCompareRows();
    for (const seg of ['local', 'pme', 'ecommerce'] as const) {
      const opt = rows[seg].find((r) => r.label === 'IA en option')!;
      expect(String(opt.accompagne)).toContain(formatPrice(getAddon('option_more_ai').priceCents));
    }
  });

  it('CGV, llms.txt et pages publiques : aucun montant contradictoire avec la grille', async () => {
    const { GET } = await import('@/app/llms.txt/route');
    const llms = await (await GET()).text();
    expectNoContradiction('llms.txt', llms);
    expect(sp(llms)).toContain(sp(`Agence (liste d'attente) : ${formatPrice(getPlan('agency_month').priceCents)}/mois pour 10 clients`));
    const files = [
      ...walk(path.join(ROOT, 'src', 'app')),
      ...walk(path.join(ROOT, 'src', 'components', 'site')),
      ...walk(path.join(ROOT, 'src', 'components', 'pages')),
      ...walk(path.join(ROOT, 'src', 'lib', 'seo')),
    ].filter((f) => !/competitors|veille|etudes|guides|glossaire|barometre/.test(f));
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap((f) => contradictions(path.relative(ROOT, f), readFileSync(f, 'utf8')))).toEqual([]);
  });
});
