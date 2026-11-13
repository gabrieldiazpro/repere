import { describe, expect, it } from 'vitest';
import { buildQueries, resolveTrade, zoneInfo } from '../queries';
import { ACTIONS, buildActionPlan, evaluateTrigger, topActions } from '../actions';
import { createMockAudit, scoreBand } from '../index';

describe('buildQueries', () => {
  const input = { businessName: 'Plomberie Dupont', trade: 'Plombier', city: 'Paris', district: '11' };

  it('8 requêtes pour l’audit gratuit, intentions réparties', () => {
    const qs = buildQueries(input);
    expect(qs).toHaveLength(8);
    const count = (i: string) => qs.filter((q) => q.intent === i).length;
    expect([count('best'), count('nearby'), count('urgent'), count('specific'), count('review')]).toEqual([2, 2, 1, 2, 1]);
    expect(qs[0].text).toBe('Quel est le meilleur plombier à Paris 11e ?');
    expect(qs[0].id).toMatch(/^T1-[0-9a-f]{4}$/);
    expect(qs.find((q) => q.intent === 'urgent')?.text).toContain("fuite d'eau");
    expect(qs.find((q) => q.id.startsWith('T7'))?.text).toBe('Qui fait de la recherche de fuite à Paris 11e ?');
    // Jamais le nom du commerce
    for (const q of qs) expect(q.text.toLowerCase()).not.toContain('dupont');
  });

  it('identifiants stables', () => {
    expect(buildQueries(input).map((q) => q.id)).toEqual(buildQueries(input).map((q) => q.id));
  });

  it('12 requêtes pour le suivi', () => {
    const qs = buildQueries({ ...input, district: 'Bastille' }, 12);
    expect(qs).toHaveLength(12);
    expect(new Set(qs.map((q) => q.text)).size).toBe(12);
  });

  it('restaurants : T5 = « Où manger … ce soir »', () => {
    const qs = buildQueries({ businessName: 'Da Marco', trade: 'restaurant italien', city: 'Paris', district: 'Bastille' });
    expect(qs.find((q) => q.intent === 'urgent')?.text).toBe('Où manger italien ce soir près de Bastille ?');
    expect(qs[0].text).toBe('Quel est le meilleur restaurant italien à Bastille à Paris ?');
  });

  it('accord au féminin et métier inconnu', () => {
    expect(buildQueries({ businessName: 'X', trade: 'agence immobilière', city: 'Lyon' })[0].text).toBe(
      'Quelle est la meilleure agence immobilière à Lyon ?',
    );
    expect(resolveTrade('sophrologue').family).toBe('autre');
    expect(buildQueries({ businessName: 'X', trade: 'sophrologue', city: 'Nantes' })).toHaveLength(8);
  });

  it('zones : code postal et arrondissement', () => {
    expect(zoneInfo({ city: 'Paris', district: '75011' }).zone).toBe('Paris 11e');
    expect(zoneInfo({ city: 'Paris', district: '1er' }).zone).toBe('Paris 1er');
    expect(zoneInfo({ city: 'Paris', district: 'Bastille' }).zone).toBe('Bastille à Paris');
  });
});

describe('déclencheurs et plan d’action', () => {
  it('grammaire', () => {
    const ctx = { score: 35, sub: { chatgpt: null, perplexity: 10 }, trade_family: 'btp', declared: {}, site: { has_website: true } };
    expect(evaluateTrigger('always', ctx)).toBe(true);
    expect(evaluateTrigger('score < 50', ctx)).toBe(true);
    expect(evaluateTrigger('declared.gbp_claimed != true', ctx)).toBe(true);
    expect(evaluateTrigger('declared.google_reviews < 30', ctx)).toBe(false);
    expect(evaluateTrigger('sub.chatgpt < 25', ctx)).toBe(false);
    expect(evaluateTrigger("trade_family in ['restauration','btp'] and score < 60", ctx)).toBe(true);
    expect(evaluateTrigger('site.has_website == true and (sub.perplexity < 20 or score > 90)', ctx)).toBe(true);
    expect(evaluateTrigger('not score < 10', ctx)).toBe(true);
  });

  it('tous les déclencheurs du JSON se parsent', () => {
    expect(ACTIONS).toHaveLength(35);
    for (const a of ACTIONS) expect(() => evaluateTrigger(a.trigger, {})).not.toThrow();
  });

  it('plan : 10 à 14 actions, triées, filtrées par métier', () => {
    const r = createMockAudit({ businessName: 'Plomberie Dupont', trade: 'plombier', city: 'Paris', district: '11' }, 'x');
    const plan = buildActionPlan(r);
    expect(plan.length).toBeGreaterThanOrEqual(10);
    expect(plan.length).toBeLessThanOrEqual(14);
    expect(plan.some((a) => a.id === 'A13')).toBe(false); // TripAdvisor : restauration seulement
    expect(plan.some((a) => a.id === 'A21')).toBe(true); // pas de site → site vitrine
    expect(topActions(r)).toHaveLength(3);
    const withSite = buildActionPlan({ ...r, input: { ...r.input, website: 'dupont.fr' } }, { declared: { gbp_claimed: true } });
    expect(withSite.some((a) => a.id === 'A21')).toBe(false);
    expect(withSite.some((a) => a.id === 'A01')).toBe(false);
  });

  it('scoreBand', () => {
    expect(scoreBand(0).label).toBe('Invisible');
    expect(scoreBand(39).label).toBe('Invisible');
    expect(scoreBand(40).label).toBe('Peu visible');
    expect(scoreBand(69.4).label).toBe('Peu visible');
    expect(scoreBand(70).color).toBe('#15803D');
    expect(scoreBand(150).label).toBe('Bien recommandé');
  });
});
