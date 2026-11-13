import { describe, expect, it } from 'vitest';
import { buildDemoAgent } from '../demo';
import { effectHeadline, rate } from '../effect';
import {
  agentKindForTask,
  blockers,
  canEdit,
  canPublish,
  cleanTitle,
  diffStats,
  diffWords,
  originOf,
  sanitizeSettings,
  simApply,
  simEdit,
  simRevert,
  simValidate,
  sortChangeSets,
  type ChangeSet,
  type Seg,
} from '../model';
import { connectBody, fieldErrors, GUIDES } from '../platforms';

const side = (segs: Seg[], s: 'before' | 'after') => segs.filter((x) => x.t === 'same' || x.t === (s === 'before' ? 'del' : 'add')).map((x) => x.s).join('');

const NOW = new Date('2026-11-13T10:00:00Z');
const demo = (segment: 'local' | 'pme' | 'ecommerce' = 'local') =>
  buildDemoAgent({
    businessId: 'demo',
    segment,
    name: 'Plomberie Martin',
    website: 'plomberie-martin.fr',
    facts: { horaires: 'Du lundi au vendredi 8 h – 19 h', prix: 'Déplacement 49 € ; intervention à partir de 89 € TTC', creation: '2009' },
    tasks: [
      { id: 'demo-t3', kind: 'schema', deliverable: [{ type: 'jsonld', content: '{"@type":"Plumber"}' }] },
      { id: 'demo-t4', kind: 'faq_page' },
      { id: 'demo-t1', kind: 'fact_fix' },
    ],
    scores: [18, 27, 33, 42, 52, 61],
    now: NOW,
  });

describe('diffWords', () => {
  it('reconstitue exactement l’avant et l’après', () => {
    const cases: [string | null, string | null][] = [
      ['Accueil - Plomberie Martin', 'Plombier à Paris 11ᵉ | Plomberie Martin'],
      ['', 'Nouveau texte'],
      ['Ancien', null],
      ['a b c d e', 'a x c d y e'],
      ['ligne 1\nligne 2\n', 'ligne 1\nligne 2 modifiée\nligne 3\n'],
      ['même', 'même'],
    ];
    for (const [a, b] of cases) {
      const d = diffWords(a, b);
      expect(side(d, 'before')).toBe(a ?? '');
      expect(side(d, 'after')).toBe(b ?? '');
    }
  });

  it('isole le mot changé', () => {
    const d = diffWords('Le plombier du 11e', 'Le plombier du 12e');
    expect(d.filter((x) => x.t === 'del').map((x) => x.s.trim())).toEqual(['11e']);
    expect(d.filter((x) => x.t === 'add').map((x) => x.s.trim())).toEqual(['12e']);
    expect(diffStats(d)).toEqual({ added: 1, removed: 1 });
  });

  it('se replie proprement sur un très long texte', () => {
    const a = Array.from({ length: 900 }, (_, i) => `mot${i}`).join(' ');
    const b = Array.from({ length: 900 }, (_, i) => `autre${i}`).join(' ');
    const d = diffWords(a, b, 1000);
    expect(side(d, 'before')).toBe(a);
    expect(side(d, 'after')).toBe(b);
  });
});

describe('droits', () => {
  it('valider : administrateur et plus (la démo simule un propriétaire)', () => {
    expect(canPublish('viewer')).toBe(false);
    expect(canPublish('member')).toBe(false);
    expect(canPublish('admin')).toBe(true);
    expect(canPublish('owner')).toBe(true);
    expect(canPublish('demo')).toBe(true);
    expect(canEdit('member')).toBe(true);
    expect(canEdit('viewer')).toBe(false);
  });
});

describe('parcours démo simulé', () => {
  it('est étiqueté démo et cohérent avec les actions du Centre d’actions', () => {
    const d = demo();
    expect(d.changeSets.every((c) => c.demo)).toBe(true);
    expect(d.taskLinks['demo-t3']).toBe('cs_demo_jsonld');
    expect(d.taskLinks['demo-t4']).toBe('cs_demo_faq');
    expect(d.changeSets.find((c) => c.id === 'cs_demo_jsonld')!.changes[0].after).toContain('"@type":"Plumber"');
    expect(new Set(d.changeSets.map((c) => c.status))).toEqual(new Set(['proposed', 'verified', 'reverted']));
    expect(d.journal.length).toBeGreaterThan(10);
    // journal du plus récent au plus ancien
    expect(d.journal[0].at >= d.journal[d.journal.length - 1].at).toBe(true);
  });

  it('Shopify : le JSON-LD passe par l’export (thème)', () => {
    const d = demo('ecommerce');
    expect(d.connections[0].platform).toBe('shopify');
    expect(d.changeSets.find((c) => c.id === 'cs_demo_jsonld')!.platform).toBe('export');
  });

  it('« [à compléter] » bloque la validation jusqu’à complétion ou exclusion', () => {
    const faq = demo().changeSets.find((c) => c.id === 'cs_demo_faq')!;
    expect(blockers(faq)).toHaveLength(1);
    expect(simValidate(faq, new Set(), NOW).status).toBe('proposed');
    const fixed = simEdit(faq, 'ch_demo_faq', faq.changes[0].after!.replaceAll('[à compléter]', 'Oui, dans tout le 20ᵉ.'), NOW);
    expect(blockers(fixed)).toHaveLength(0);
    const v = simValidate(fixed, new Set(), NOW);
    expect(v.status).toBe('validated');
    expect(v.validation?.by.id).toBe('demo');
  });

  it('valider → appliquer → vérifié → annuler, sans muter l’original', () => {
    const cs = demo().changeSets.find((c) => c.id === 'cs_demo_meta_home')!;
    const v = simValidate(cs, new Set(['ch_demo_desc']), NOW);
    expect(v.changes.find((c) => c.id === 'ch_demo_desc')!.status).toBe('skipped');
    const a = simApply(v, NOW);
    expect(a.status).toBe('verified');
    expect(a.changes.find((c) => c.id === 'ch_demo_title')!.verification?.every((x) => x.ok)).toBe(true);
    const r = simRevert(a, NOW);
    expect(r.status).toBe('reverted');
    expect(cs.status).toBe('proposed');
    // une modification après validation fait retomber la validation
    expect(simEdit(v, 'ch_demo_title', 'Autre titre', NOW).status).toBe('proposed');
  });

  it('appliquer exige une validation', () => {
    const cs = demo().changeSets.find((c) => c.id === 'cs_demo_meta_home')!;
    expect(simApply(cs, NOW).status).toBe('proposed');
  });
});

describe('libellés et tri', () => {
  it('origine et titres', () => {
    expect(originOf({ origin: { findingId: 'geo.llms.missing' } }).kind).toBe('geo');
    expect(originOf({ origin: { findingId: 'seo.title.missing' } }).kind).toBe('seo');
    expect(cleanTitle('[Démo] Titre')).toBe('Titre');
  });
  it('à valider en premier', () => {
    const list = sortChangeSets(demo().changeSets);
    expect(list[0].status).toBe('proposed');
    expect(list.at(-1)!.status).toBe('reverted');
  });
  it('Centre d’actions : seules les actions avec correction automatique ont le bouton', () => {
    expect(agentKindForTask('schema')).toBe('jsonld');
    expect(agentKindForTask('faq_page')).toBe('faq');
    expect(agentKindForTask('review_request')).toBeNull();
  });
});

describe('réglages', () => {
  it('nettoie la saisie', () => {
    const s = sanitizeSettings({ kinds: ['meta.title', 'n_importe', 'meta.title'], frequency: 'hourly', notify: 'app' });
    expect(s.kinds).toEqual(['meta.title']);
    expect(s.frequency).toBe('weekly');
    expect(s.notify).toBe('app');
  });
});

describe('assistant de connexion', () => {
  const wp = GUIDES.find((g) => g.id === 'wordpress')!;
  it('contrôle la saisie et sépare config / secrets', () => {
    expect(Object.keys(fieldErrors(wp, {}))).toEqual(['siteUrl', 'username', 'password']);
    expect(fieldErrors(wp, { siteUrl: 'http://site.fr', username: 'a', password: 'abcd efgh ijkl mnop' }).siteUrl).toBeTruthy();
    const ok = { siteUrl: 'https://www.site.fr', username: 'editeur', password: 'abcd efgh ijkl mnop qrst uvwx' };
    expect(fieldErrors(wp, ok)).toEqual({});
    expect(connectBody(wp, ok)).toEqual({ platform: 'wordpress', config: { siteUrl: 'https://www.site.fr' }, credentials: { username: 'editeur', password: 'abcd efgh ijkl mnop qrst uvwx' } });
  });
  it('la fiche Google est « bientôt » (aucun champ)', () => {
    expect(GUIDES.find((g) => g.id === 'gbp')!.fields).toHaveLength(0);
  });
});

describe('effet mesuré', () => {
  it('donne la marge d’erreur, sans promesse', () => {
    const e = demo().effects.cs_demo_robots;
    expect(rate(e.ai!.before)).toBe(8);
    e.ai!.result = { delta: 8.3, margin: 20.3, verdict: 'stable' };
    expect(effectHeadline(e)).toContain('marge');
    expect(effectHeadline({ ...e, status: 'scheduled' })).toBe('Remesure prévue');
  });
});

// garde de type : ChangeSet reste importable depuis le modèle
export type _T = ChangeSet;

describe('Centre d’actions → proposition réelle (RACCORDS-FINAUX)', () => {
  it('relie par type à la proposition ouverte la plus récente', async () => {
    const { linkTasksToChangeSets } = await import('../model');
    const ch = (kind: string) => ({ kind }) as never;
    const links = linkTasksToChangeSets(
      [
        { id: 't-schema', kind: 'schema' },
        { id: 't-faq', kind: 'faq_page' },
        { id: 't-autre', kind: 'review_reply' as never },
      ],
      [
        { id: 'cs-old', status: 'proposed', createdAt: '2026-11-01T00:00:00Z', changes: [ch('jsonld')] },
        { id: 'cs-new', status: 'draft', createdAt: '2026-11-10T00:00:00Z', changes: [ch('jsonld')] },
        { id: 'cs-faq-fini', status: 'verified', createdAt: '2026-11-12T00:00:00Z', changes: [ch('faq')] },
      ],
    );
    expect(links).toEqual({ 't-schema': 'cs-new' });
  });
});
