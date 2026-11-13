import { describe, expect, it } from 'vitest';
import { getEntitlements } from '@/lib/entitlements';
import { activeItem, allNav, isActive, navGroups, shortcutMap, TAB_HREFS } from '../../nav';
import { etapeAssistant, etapesDemarrage, normaliserSite, parseDemarrage, progression, type Signaux } from '../demarrage';
import { buildItems, isTypingTarget, matchScore, normalize, search } from '../palette';
import { quota, verrou } from '../verrou';
import { CIBLES, DEMO_ACCOUNT, etapesVisite, parseVisite } from '../visite';

const biz = (plan: string, segment: 'local' | 'pme' | 'ecommerce' = 'pme') => ({ id: 'b-1', plan: plan as never, segment, planId: null as never });

describe('navigation V3', () => {
  it('regroupe Lundi · Mesurer · Comprendre · Agir · Prouver · métier · Copilote', () => {
    expect(navGroups('local').map((g) => g.id)).toEqual(['lundi', 'mesurer', 'comprendre', 'agir', 'prouver', 'local', 'copilote']);
    expect(navGroups('ecommerce').map((g) => g.id)).toContain('ecommerce');
    expect(navGroups('pme').map((g) => g.id)).not.toContain('local');
  });
  it('prévoit toutes les routes de la mission', () => {
    const hrefs = allNav('local').map((n) => n.href).concat(allNav('ecommerce').map((n) => n.href));
    for (const r of ['/app/questions', '/app/reponses', '/app/sources', '/app/concurrents', '/app/ia', '/app/verite', '/app/actions', '/app/pages', '/app/technique', '/app/trafic', '/app/rapports', '/app/copilote', '/app/local', '/app/produits'])
      expect(hrefs).toContain(r);
  });
  it('active l’entrée la plus précise', () => {
    const nav = allNav('local');
    expect(activeItem(nav, '/app/local/carte')?.href).toBe('/app/local/carte');
    expect(activeItem(nav, '/app/local')?.href).toBe('/app/local');
    expect(activeItem(nav, '/app/citations/x')?.href).toBe('/app/sources');
    expect(activeItem(nav, '/app/taches')?.href).toBe('/app/actions');
    expect(isActive('/app', '/app/questions')).toBe(false);
  });
  it('5 onglets mobile au plus (4 + Plus)', () => {
    expect(TAB_HREFS.length).toBe(4);
    for (const h of TAB_HREFS) expect(allNav('pme').some((n) => n.href === h)).toBe(true);
  });
  it('raccourcis uniques g + lettre', () => {
    const m = shortcutMap('local');
    expect(m.l).toBe('/app');
    expect(m.q).toBe('/app/questions');
    expect(new Set(Object.values(m)).size).toBe(Object.values(m).length);
  });
});

describe('palette', () => {
  const index = { questions: [{ id: 'p1', text: 'Plombier urgence Paris 11' }], competitors: ['Dépannage Éclair'], tasks: [{ id: 't1', title: 'Corriger vos horaires sur Gemini' }] };
  const items = buildItems('local', index, { demo: true });
  it('normalise accents et apostrophes', () => {
    expect(normalize('  Centre d’Actions ')).toBe('centre d actions');
  });
  it('trouve sans accents et classe le début de libellé en premier', () => {
    expect(matchScore('depannage', { label: 'Dépannage Éclair' })).toBeGreaterThan(matchScore('eclair', { label: 'Dépannage Éclair' }));
    const g = search(items, 'eclair');
    expect(g[0].kind).toBe('concurrent');
  });
  it('sans requête : actions et pages seulement', () => {
    const kinds = search(items, '').map((g) => g.kind);
    expect(kinds).toEqual(['action', 'page']);
  });
  it('liens profonds vers les écrans', () => {
    const q = items.find((i) => i.kind === 'question');
    expect(q?.href).toBe('/app/questions?q=p1');
    expect(items.find((i) => i.kind === 'tache')?.href).toBe('/app/actions?t=t1');
    expect(items.find((i) => i.command === 'measure')?.hint).toMatch(/démo/);
  });
  it('aucune correspondance → vide', () => {
    expect(search(items, 'zzzzzzzzzz')).toEqual([]);
  });
  it('ignore les raccourcis dans un champ', () => {
    expect(isTypingTarget({ tagName: 'INPUT' } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: false } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('verrou', () => {
  it('Découverte : exports et exécution verrouillés, offre et lien', () => {
    const e = getEntitlements(biz('free'));
    const v = verrou(e, 'exports');
    expect(v.locked).toBe(true);
    expect(v.offre).toBe('Essentiel');
    expect(v.href).toBe('/tarifs?depuis=app&fonction=exports');
    expect(verrou(e, 'execution').locked).toBe(true);
    expect(verrou(e, 'team').locked).toBe(true);
  });
  it('Essentiel local : exports ouverts, intégrations et Claude fermés ; PME : hebdo', () => {
    const e = getEntitlements(biz('essentiel', 'local'));
    expect(verrou(e, 'exports').locked).toBe(false);
    expect(verrou(e, 'integrations').locked).toBe(true);
    expect(verrou(e, 'claude').locked).toBe(true);
    expect(verrou(getEntitlements(biz('essentiel', 'pme')), 'weekly').locked).toBe(false);
  });
  it('démo : rien de verrouillé ; droits inconnus : pas de faux verrou', () => {
    const d = getEntitlements({ id: 'demo', plan: 'free' as never, segment: 'local', planId: null as never });
    expect(verrou(d, 'whiteLabel').locked).toBe(false);
    expect(verrou(null, 'exports').locked).toBe(false);
  });
  it('quota', () => {
    expect(quota(3, 5)).toMatchObject({ ratio: 0.6, full: false, label: '3 sur 5' });
    expect(quota(6, 5).full).toBe(true);
    expect(quota(0, 0).ratio).toBe(1);
  });
});

describe('visite guidée', () => {
  it('8 étapes dans chaque parcours, avec l’étape métier', () => {
    for (const s of ['local', 'pme', 'ecommerce'] as const) expect(etapesVisite(s)).toHaveLength(8);
    expect(etapesVisite('local').map((e) => e.cible)).toContain(CIBLES.local);
    expect(etapesVisite('ecommerce').map((e) => e.cible)).toContain(CIBLES.produits);
    expect(etapesVisite('pme').map((e) => e.cible)).toContain(CIBLES.reponses);
  });
  it('commence au Lundi et finit au copilote ; la preuve suit l’étape métier', () => {
    const l = etapesVisite('local');
    expect(l[0].page).toBe('/app');
    expect(l.at(-1)?.cible).toBe(CIBLES.copilote);
    expect(l.findIndex((e) => e.cible === CIBLES.local)).toBe(l.findIndex((e) => e.cible === CIBLES.trafic) - 1);
  });
  it('état mémorisé tolérant', () => {
    expect(parseVisite('{"segment":"pme","step":3}')).toEqual({ segment: 'pme', step: 3, done: false });
    expect(parseVisite('{"step":-1}')).toBeNull();
    expect(parseVisite('pas du json')).toBeNull();
    expect(DEMO_ACCOUNT.ecommerce).toBe('demo-ecom');
  });
});

describe('bien démarrer', () => {
  const base: Signaux = { website: '', questions: 0, audits: 0, facts: 0, trafficHits: 0, tasksDone: 0 };
  it('tout à faire au départ ; la suivante est le site', () => {
    const e = etapesDemarrage(base);
    const p = progression(e);
    expect(p.faites).toBe(0);
    expect(p.suivante?.id).toBe('site');
    expect(p.label).toBe('0 sur 6');
  });
  it('déduit les étapes faites des données, et des coches manuelles', () => {
    const e = etapesDemarrage({ ...base, website: 'https://a.fr', questions: 8, audits: 1, facts: 3 }, new Set(['trafic'] as const));
    const p = progression(e);
    expect(p.faites).toBe(5);
    expect(p.suivante?.id).toBe('action');
    expect(etapesDemarrage({ ...base, facts: 2 }).find((x) => x.id === 'verite')?.done).toBe(false);
  });
  it('assistant : étape demandée ou première non faite', () => {
    const e = etapesDemarrage({ ...base, website: 'a.fr' });
    expect(etapeAssistant(null, e)).toBe('questions');
    expect(etapeAssistant('site', e)).toBe('site');
    expect(etapeAssistant('verite', e)).toBe('questions');
  });
  it('état local tolérant', () => {
    expect(parseDemarrage('{"manual":["site","bidon"],"hidden":true}')).toEqual({ manual: ['site'], hidden: true });
    expect(parseDemarrage(null)).toEqual({ manual: [], hidden: false });
  });
  it('normalise l’adresse du site', () => {
    expect(normaliserSite('plomberie-martin.fr')).toBe('https://plomberie-martin.fr');
    expect(normaliserSite('http://www.exemple.com/')).toBe('http://www.exemple.com');
    expect(normaliserSite('pas un site')).toBeNull();
    expect(normaliserSite('')).toBeNull();
  });
});
