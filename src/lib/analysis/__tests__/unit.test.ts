import { describe, expect, it } from 'vitest';
import type { Finding } from '@/lib/crawl/types';
import { detectSite, nameFromDomain } from '../detect';
import { buildVerdict, compareAnalyses, computeScores, mergePriorities } from '../prioritize';
import { buildQuickQuestions, planCalls } from '../aicheck';
import type { FullAnalysis, ModuleReport } from '../types';

const f = (id: string, impact: 1 | 2 | 3, effort: 1 | 2 | 3, severity: Finding['severity'] = 'high', autoFix?: Finding['autoFix']): Finding => ({
  id, category: 'x', severity, title: `Constat ${id}`, why: '', fix: '', affected: [], affectedCount: 1, impact, effort, ...(autoFix ? { autoFix } : {}),
});
const rep = (score: number, findings: Finding[]): ModuleReport => ({ score, sections: [{ id: 's', label: 'S', score, findings }], topFixes: findings });

describe('détection', () => {
  it('JSON-LD local : marque, type local, ville, métier', () => {
    const html = `<html><head><title>Plombier à Lyon | Plomberie Martin</title>
      <script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Plomberie Martin","telephone":"+33478000000","address":{"@type":"PostalAddress","addressLocality":"Lyon"}}</script></head><body><h1>Plombier</h1></body></html>`;
    const d = detectSite({ url: 'https://plomberie-martin.test' }, html);
    expect(d).toMatchObject({ brand: 'Plomberie Martin', siteType: 'local', city: 'Lyon', activity: 'plombier' });
    expect(d.sources.brand).toBe('JSON-LD');
  });
  it('boutique : Product ou plateforme → ecommerce ; og:site_name', () => {
    const html = `<html><head><title>Crème solaire bio – Maison Sora</title><meta property="og:site_name" content="Maison Sora">
      <script src="https://cdn.shopify.com/x.js"></script></head><body><button>Ajouter au panier</button></body></html>`;
    const d = detectSite({ url: 'https://maison-sora.test' }, html);
    expect(d.siteType).toBe('ecommerce');
    expect(d.brand).toBe('Maison Sora');
  });
  it('sans signal : PME, nom tiré du domaine ; la saisie l’emporte', () => {
    expect(detectSite({ url: 'https://acme-conseil.test' }, null)).toMatchObject({ brand: 'Acme Conseil', siteType: 'pme' });
    expect(detectSite({ url: 'https://x.test', brand: 'Mon Nom', siteType: 'local', city: 'Nantes' }, null)).toMatchObject({ brand: 'Mon Nom', siteType: 'local', city: 'Nantes' });
    expect(nameFromDomain('www.plomberie-martin.fr')).toBe('Plomberie Martin');
  });
});

describe('synthèse', () => {
  it('5 priorités mélangées SEO + GEO, triées impact × effort', () => {
    const seo = rep(60, [f('seo.a', 3, 1), f('seo.b', 3, 1), f('seo.c', 3, 1), f('seo.d', 3, 1), f('seo.e', 3, 1), f('seo.f', 1, 3)]);
    const geo = rep(40, [f('geo.a', 2, 2, 'medium', { kind: 'jsonld', payload: null }), f('geo.info', 3, 1, 'info')]);
    const p = mergePriorities(seo, geo, 5);
    expect(p).toHaveLength(5);
    expect(p.some((x) => x.source === 'geo')).toBe(true);
    expect(p.some((x) => x.id === 'geo.info')).toBe(false);
    expect(p[0].priority).toBe(9);
  });
  it('scores : global = moyenne ; IA démo ignorée ; module absent → null', () => {
    expect(computeScores(rep(80, []), rep(40, []))).toEqual({ seo: 80, geo: 40, global: 60 });
    const ai = { demo: true, providers: [], questions: [], score: 0, mentionRate: 0, calls: 0, topCompetitors: [], note: '' };
    expect(computeScores(rep(80, []), rep(40, []), ai).geo).toBe(40);
    expect(computeScores(null, rep(50, []))).toEqual({ seo: null, geo: 50, global: 50 });
    expect(computeScores(null, null).global).toBeNull();
  });
  it('verdict en une phrase, partiel signalé', () => {
    const seo = rep(70, [f('seo.a', 3, 1)]);
    const a = { scores: computeScores(seo, rep(30, [])), priorities: mergePriorities(seo, null), detected: { brand: 'Acme', siteType: 'pme' as const, sources: { brand: '', siteType: '' } }, partial: true, crawl: null };
    const v = buildVerdict(a);
    expect(v).toMatch(/^Acme : un socle/);
    expect(v).toMatch(/partielle/);
  });
  it('comparaison avant / après', () => {
    const prev = { id: 'an_prev', createdAt: '2026-11-01T00:00:00Z', seo: rep(50, [f('seo.a', 3, 1), f('seo.b', 2, 1)]), geo: null, scores: { seo: 50, geo: null, global: 50 } } as unknown as FullAnalysis;
    const c = compareAnalyses(prev, { seo: rep(70, [f('seo.b', 2, 1), f('seo.c', 1, 1)]), geo: null, scores: { seo: 70, geo: null, global: 70 } });
    expect(c).toMatchObject({ fixed: ['seo.a'], appeared: ['seo.c'], scores: { seo: 20, global: 20 } });
  });
});

describe('contrôle IA : plafond d’appels', () => {
  it('3 à 6 questions, jamais la marque dans la question', () => {
    const q = buildQuickQuestions('local', 'plombier', 'Lyon', 4);
    expect(q).toHaveLength(4);
    expect(q[0].text).toContain('plombier');
    expect(q[0].text).toContain('Lyon');
    expect(buildQuickQuestions('pme', undefined, undefined, 99)).toHaveLength(6);
    expect(buildQuickQuestions('ecommerce', 'thé vert', undefined, 1)).toHaveLength(3);
  });
  it('questions × 2 exécutions × IA ≤ plafond', () => {
    for (const cap of [6, 12, 18, 24, 60]) {
      const p = planCalls(['chatgpt', 'perplexity', 'gemini'], cap);
      expect(p.questions * 2 * p.providers.length).toBeLessThanOrEqual(cap);
      expect(p.questions).toBeGreaterThanOrEqual(3);
    }
    expect(planCalls(['chatgpt'], 5)).toEqual({ providers: [], questions: 0 });
    expect(planCalls([], 0).providers).toEqual([]); // démo : aucun coût
  });
});
