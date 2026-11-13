import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRealProvider, getExtractor } from '../../engine/providers';
import { ALL_PROVIDERS } from '../../engine/types';
import { CATALOG, defaultProviders, questionsFor, validateCatalog } from '../catalog';
import { COST_PER_CALL_EUR, EXTRACT_COST_EUR, estimateCost, estimateMonthly, planWithinBudget } from '../cost';
import { cleanName, isVerifiable, looksLikePersonName, mergeNames, nameContext, nameKey } from '../names';
import type { BarometreDef } from '../types';

const lyon = CATALOG.find((d) => d.slug === 'plombiers-lyon')!;
const paie = CATALOG.find((d) => d.slug === 'logiciels-de-paie-pour-pme')!;

describe('catalogue', () => {
  it('50 baromètres valides (8 à 20 questions, slugs uniques, aucune profession réglementée)', () => {
    expect(CATALOG).toHaveLength(50);
    expect(validateCatalog()).toEqual([]);
    expect(CATALOG.filter((d) => d.segment === 'local')).toHaveLength(40);
    expect(lyon).toBeDefined();
    expect(paie).toBeDefined();
    expect(CATALOG.find((d) => d.slug === 'marques-de-cosmetiques-solides')).toBeDefined();
  });
  it('refuse une profession réglementée et un nombre de questions hors bornes', () => {
    const bad: BarometreDef[] = [
      { slug: 'dentistes-lyon', segment: 'local', title: 'Dentistes à Lyon', subject: 'dentistes', trade: 'dentiste', city: 'Lyon' },
      { slug: 'trop-court', segment: 'pme', title: 'X', subject: 'x', category: 'crm', questions: ['a ?', 'b ?'] },
    ];
    const errs = validateCatalog(bad);
    expect(errs.some((e) => e.includes('réglementée'))).toBe(true);
    expect(errs.some((e) => e.includes('2 questions'))).toBe(true);
  });
  it('questions réalistes, stables, sans aucun nom d’entreprise', () => {
    const q = questionsFor(lyon);
    expect(q.length).toBe(12);
    expect(q[0].text).toMatch(/plombier à Lyon/);
    expect(questionsFor(lyon)).toEqual(q);
    const p = questionsFor(paie);
    expect(p.length).toBe(12);
    expect(p.some((x) => /logiciel de paie/.test(x.text))).toBe(true);
  });
  it('IA par défaut : 4 IA, Mistral si la clé est là, surcharge par BAROMETRE_PROVIDERS', () => {
    expect(defaultProviders({})).toEqual(['chatgpt', 'perplexity', 'gemini', 'claude']);
    expect(defaultProviders({ MISTRAL_API_KEY: 'x' })).toContain('mistral');
    expect(defaultProviders({ BAROMETRE_PROVIDERS: 'perplexity, chatgpt, inconnu' })).toEqual(['perplexity', 'chatgpt']);
  });
});

describe('coûts', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('la table recopie exactement les coûts déclarés par les fournisseurs du moteur', () => {
    for (const k of ['OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY']) vi.stubEnv(k, 'cle-de-test');
    vi.stubEnv('AUDIT_EXTRACTOR', '');
    for (const id of ALL_PROVIDERS) expect(createRealProvider(id)!.costPerCallEur).toBeCloseTo(COST_PER_CALL_EUR[id], 10);
    expect(getExtractor()!.costPerCallEur).toBeCloseTo(EXTRACT_COST_EUR, 10);
  });
  it('estimation par baromètre et pour 50 baromètres', () => {
    const e = estimateCost(lyon, {});
    expect(e.calls).toBe(12 * 4 * 3);
    const perRound = COST_PER_CALL_EUR.chatgpt + COST_PER_CALL_EUR.perplexity + COST_PER_CALL_EUR.gemini + COST_PER_CALL_EUR.claude + 4 * EXTRACT_COST_EUR;
    expect(e.costEur).toBeCloseTo(36 * perRound, 2);
    const m = estimateMonthly(CATALOG, {});
    expect(m.count).toBe(50);
    expect(m.calls).toBe(50 * 144);
    expect(m.costEur).toBeGreaterThan(90);
    expect(m.costEur).toBeLessThan(100);
  });
  it('le plan respecte le budget et la priorité', () => {
    const p = planWithinBudget(CATALOG, 10, {});
    expect(p.selected.length).toBe(5);
    expect(p.selected[0].slug).toBe(CATALOG[0].slug);
    expect(p.selected.reduce((a, x) => a + x.costEur, 0)).toBeLessThanOrEqual(10);
    expect(p.skipped.length).toBe(45);
  });
});

describe('noms : nettoyage, fusion, publication', () => {
  const ctx = nameContext(lyon);
  it('nettoie et normalise (markdown, forme juridique, ville, arrondissement)', () => {
    expect(cleanName('**Plomberie Martin** – dépannage 24 h')).toBe('Plomberie Martin');
    expect(nameKey('Plomberie Martin SARL', ctx)).toBe(nameKey('plomberie martin', ctx));
    expect(nameKey('Plomberie Martin Lyon', ctx)).toBe('plomberie martin');
    expect(nameKey('Plomberie Martin Lyon 3e', ctx)).toBe('plomberie martin');
  });
  it('fusionne les variantes d’un même nom', () => {
    const obs = ['Plomberie Martin', 'Plomberie Martin', 'PLOMBERIE MARTIN', 'Plomberie Martin SARL', 'Martin Plomberie', 'Plomberie Martín Lyon', 'Plomberie Martinn'].map((name) => ({ name }));
    const cl = mergeNames(obs, ctx);
    expect(cl).toHaveLength(1);
    expect(cl[0].label).toBe('Plomberie Martin');
    expect(cl[0].variants.length).toBeGreaterThan(3);
  });
  it('ne fusionne pas des entreprises différentes', () => {
    const cl = mergeNames([{ name: 'Plomberie Dupont' }, { name: 'Plomberie Durand' }, { name: 'Martin' }, { name: 'Martin Frères' }], ctx);
    expect(cl).toHaveLength(4);
  });
  it('fusionne par site commun et par alias manuel', () => {
    const bySite = mergeNames([{ name: 'ABC Dépannage', domain: 'abc-depannage.fr' }, { name: 'Allo Bricolage Clément', domain: 'abc-depannage.fr' }], ctx);
    expect(bySite).toHaveLength(1);
    const withAlias = nameContext({ ...lyon, aliases: { 'Plomberie Rhône Services': ['PRS'] } });
    expect(mergeNames([{ name: 'Plomberie Rhône Services' }, { name: 'PRS' }], withAlias)).toHaveLength(1);
  });
  it('personnes physiques et noms non vérifiables jamais publiés', () => {
    expect(looksLikePersonName('Jean Dupont', ctx)).toBe(true);
    expect(looksLikePersonName('Plomberie Jean Dupont', ctx)).toBe(false);
    expect(looksLikePersonName('Dupont et Fils', ctx)).toBe(false);
    expect(isVerifiable({ providers: 1, answers: 1 })).toBe(false);
    expect(isVerifiable({ providers: 1, answers: 5 })).toBe(false);
    expect(isVerifiable({ providers: 1, answers: 2, domain: 'x.fr' })).toBe(true);
    expect(isVerifiable({ providers: 2, answers: 2 })).toBe(true);
    expect(isVerifiable({ providers: 3, answers: 1 })).toBe(false);
  });
});
