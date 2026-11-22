/** Simulateur « visibilité IA pour ma boutique » (V8) : calcul, fourchette, hypothèses sourcées, honnêteté du texte. */
import { describe, expect, it } from 'vitest';
import { EXAMPLE_INPUT, HYPOTHESES, SCENARIOS, defaultHypValues, euros, parseNumber, simulate, validate, type SimInput } from '../v8/simulateur';
import { V8_TOOLS } from '../v8/registry';
import { HUB_GROUPS, TOOL_ICON } from '../hub';

const base: SimInput = { ...EXAMPLE_INPUT };

describe('simulateur — calcul', () => {
  it('exemple : fourchette ordonnée basse < médiane < haute, jamais un chiffre unique', () => {
    const r = simulate(base);
    expect(r.ok).toBe(true);
    expect(r.revenue).toBeCloseTo(20_000 * 0.015 * 65);
    expect(r.googleRevenue).toBeCloseTo(r.revenue * 0.4);
    const g = SCENARIOS.map((s) => r.scenarios[s].gain);
    expect(g[0]).toBeLessThan(g[1]);
    expect(g[1]).toBeLessThan(g[2]);
    expect(r.verdict?.title).toMatch(/^Simulation : entre .* et .* \(médiane .*\)\.$/);
    expect(r.verdict?.text).toMatch(/pas une promesse/);
  });

  it('valeurs à la main (médiane de l’exemple)', () => {
    const m = simulate(base).scenarios.mediane;
    const rg = 20_000 * 0.015 * 65 * 0.4;
    expect(m.googleAvant).toBeCloseTo(rg * (1 - 0.18 * 0.47));
    expect(m.googleApres).toBeCloseTo(rg * (1 - 0.18 + 0.18 * 0.53 * 1.73));
    expect(m.aiApres).toBeCloseTo(20_000 * 0.006 * 0.015 * 1.31 * 65);
    expect(m.aiAvant).toBe(0);
    expect(m.exposed).toBeCloseTo(rg * 0.18 * 0.47);
  });

  it('plafond : une boutique citée ne gagne jamais plus de clics qu’une recherche sans aperçu IA', () => {
    const r = simulate(base);
    expect(r.scenarios.haute.capped).toBe(true);
    expect(r.scenarios.haute.googleApres).toBeLessThanOrEqual(r.googleRevenue + 1e-6);
    expect(r.notes.some((n) => /Plafond/.test(n))).toBe(true);
  });

  it('part IA déjà mesurée : le gain des assistants diminue ; au-delà de la valeur haute, il est nul', () => {
    const none = simulate(base).scenarios.mediane;
    const some = simulate({ ...base, aiShareNow: 0.4 }).scenarios.mediane;
    expect(some.aiApres - some.aiAvant).toBeLessThan(none.aiApres - none.aiAvant);
    const lots = simulate({ ...base, aiShareNow: 3 });
    for (const s of SCENARIOS) expect(lots.scenarios[s].aiApres).toBeCloseTo(lots.scenarios[s].aiAvant);
    expect(lots.notes.some((n) => /n’ajoute rien/.test(n))).toBe(true);
    expect(simulate(base).notes.some((n) => /comptée à 0/.test(n))).toBe(true);
  });

  it('hypothèses modifiables : le marchand peut tout fixer, et la fourchette reste présentée dans l’ordre', () => {
    const hv = defaultHypValues();
    hv.s = { basse: 50, mediane: 50, haute: 50 };
    hv.a = { basse: 5, mediane: 1, haute: 0 };
    const r = simulate(base, hv);
    expect(r.ok).toBe(true);
    expect(r.scenarios.mediane.exposed).toBeCloseTo(r.googleRevenue * 0.5 * 0.47);
    const [lo, hi] = [/entre ([\d\s ]+ €)/.exec(r.verdict!.title)?.[1], /et ([\d\s ]+ €)/.exec(r.verdict!.title)?.[1]];
    expect(lo && hi).toBeTruthy();
  });

  it('valeurs hors bornes ramenées dans l’intervalle de l’hypothèse', () => {
    const hv = defaultHypValues();
    hv.s.mediane = 400;
    expect(simulate(base, hv).scenarios.mediane.exposed).toBeCloseTo(simulate(base).googleRevenue * 1 * 0.47);
  });

  it('saisie invalide : erreurs par champ, aucun résultat', () => {
    const r = simulate({ ...base, visits: 0, conversion: NaN, googleShare: 120 });
    expect(r.ok).toBe(false);
    expect(Object.keys(r.errors).sort()).toEqual(['conversion', 'googleShare', 'visits']);
    expect(validate({ ...base, aiShareNow: -1 }).aiShareNow).toBeTruthy();
  });

  it('nombres saisis à la française', () => {
    expect(parseNumber('1 500')).toBe(1500);
    expect(parseNumber('1,5 %')).toBe(1.5);
    expect(parseNumber('65 €')).toBe(65);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(euros(694)).toBe('690 €');
    expect(euros(5104).replace(/\s/g, ' ')).toBe('5 100 €');
  });
});

describe('simulateur — hypothèses et page', () => {
  it('chaque hypothèse : trois valeurs, une origine par valeur, des sources https datées, une limite dite', () => {
    expect(HYPOTHESES.map((h) => h.id)).toEqual(['s', 'd', 'u', 'a', 'c']);
    for (const h of HYPOTHESES) {
      for (const s of SCENARIOS) {
        expect(Number.isFinite(h.values[s]), h.id).toBe(true);
        expect(h.origin[s].length, h.id).toBeGreaterThan(5);
      }
      expect(h.sources.length, h.id).toBeGreaterThan(0);
      for (const src of h.sources) {
        expect(src.url.startsWith('https://'), src.url).toBe(true);
        expect(src.date, src.url).toMatch(/^20(25|26)-\d\d-\d\d$/);
        expect(src.date <= '2026-11-22', src.url).toBe(true);
      }
      expect(h.gap.length, h.id).toBeGreaterThan(20);
    }
  });

  it('fiche outil : FAQ, sources, lien /analyse et /e-commerce, rangé dans le hub, pas de promesse', () => {
    const t = V8_TOOLS[0];
    expect(t.slug).toBe('simulateur-boutique');
    expect(t.faq.length).toBeGreaterThanOrEqual(4);
    expect(t.related.map((r) => r.href)).toEqual(expect.arrayContaining(['/analyse', '/e-commerce']));
    expect(t.metaTitle.length).toBeLessThanOrEqual(60);
    expect(t.description.length).toBeLessThanOrEqual(200);
    expect(HUB_GROUPS.some((g) => g.slugs.includes(t.slug))).toBe(true);
    expect(TOOL_ICON[t.slug]).toBeTruthy();
    const text = JSON.stringify(t);
    expect(text).not.toMatch(/garanti(?!r)|garantie de|n° ?1|explosez|doublez/i);
    expect(text).toMatch(/pas une promesse/);
  });
});
