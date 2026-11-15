/**
 * V6 (SITE-SEO-90) : règles de maillage, robots, sitemap et identité appliquées à notre propre site.
 */
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { CITIES, TRADES, isIndexable, publishedPairs } from '@/lib/seo';
import { CATEGORIES, categoryPath } from '@/lib/seo/segments';
import { categoryH1 } from '@/lib/seo/segment-pages';
import { DESCRIPTOR, ONE_LINER, SAME_AS, SHORT_DESCRIPTION, abs } from '@/lib/seo/site';
import { TARGET_QUESTIONS, targetQuestionPath } from '@/app/questions/_lib/target-questions';
import { FOOTER_COLUMNS, FOOTER_GUIDES_MAX, RESOURCES } from '@/components/site/nav';
import { DEMO_ACCOUNT, demoEntryHref } from '@/components/site/DemoEntry';
import { GUIDES } from '@/lib/seo/guides';

describe('maillage métier × ville', () => {
  it('aucune page sans statistiques publiées n’est liée (règle du sitemap)', async () => {
    const pairs = TRADES.slice(0, 3).flatMap((t) => CITIES.slice(0, 5).map((c) => ({ t, c })));
    const out = await publishedPairs(pairs);
    expect(isIndexable(null)).toBe(false);
    expect(out).toEqual([]); // aucune donnée en mode démo / tests
  });
});

describe('catégories PME / e-commerce', () => {
  it('H1 ≤ 80 caractères pour toutes les catégories', () => {
    for (const c of CATEGORIES) expect(categoryH1(c.name).length, c.name).toBeLessThanOrEqual(80);
  });
});

describe('robots.txt', () => {
  it('ferme /app (y compris /app?…) et /api/, mais ouvre /api/schema/ (balisage fait pour les robots)', () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules : [r.rules];
    for (const rule of rules) {
      expect(rule.disallow).toContain('/app');
      expect(rule.disallow).toContain('/api/');
      expect(rule.allow).toContain('/api/schema/');
    }
  });
});

describe('sitemap', () => {
  it('liste les catégories éditoriales, les réponses aux questions clés et les pages V6, jamais une page métier × ville sans données', async () => {
    const urls = (await sitemap()).map((e) => e.url);
    for (const c of CATEGORIES) expect(urls).toContain(abs(categoryPath(c)));
    for (const x of TARGET_QUESTIONS) expect(urls).toContain(abs(targetQuestionPath(x)));
    for (const p of ['/pilotes', '/presse', '/statut']) expect(urls).toContain(abs(p));
    expect(urls.some((u) => /\/visibilite-ia\/[^/]+\/[^/]+$/.test(u) && !/\/(pme|e-commerce)\//.test(u))).toBe(false);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe('identité', () => {
  it('SEO + GEO dans la phrase d’identité, version courte ≤ 160 caractères, aucun sameAs inventé', () => {
    expect(DESCRIPTOR).toContain('SEO et IA');
    expect(ONE_LINER).toMatch(/^Repéré est un service français de référencement SEO et IA \(GEO\)/);
    expect(SHORT_DESCRIPTION.length).toBeLessThanOrEqual(160);
    for (const u of SAME_AS) expect(u).toMatch(/^https:\/\//); // vide sans variables d'environnement
  });
});

describe('navigation', () => {
  it('pilotes dans Ressources, presse et statut dans le pied de page, une seule fois chacun', () => {
    expect(RESOURCES.some((r) => r.href === '/pilotes')).toBe(true);
    const footer = FOOTER_COLUMNS.flatMap((c) => c.links.map((l) => l.href));
    expect(footer.filter((h) => h === '/statut')).toHaveLength(1);
    expect(footer).not.toContain('/pilotes'); // dans la colonne « Repéré » du composant Footer
  });
  it('le pied de page ne liste qu’une sélection de guides, plus « Tous les guides »', () => {
    const col = FOOTER_COLUMNS.find((c) => c.title === 'Guides')!;
    expect(col.links.length).toBeLessThanOrEqual(FOOTER_GUIDES_MAX + 1);
    expect(col.links.at(-1)).toEqual({ href: '/guides', label: `Tous les guides (${GUIDES.length})` });
  });
  it('entrée démo : toujours avec le compte (sinon /app renvoie vers la connexion)', () => {
    expect(demoEntryHref('local')).toBe(`/app?compte=${DEMO_ACCOUNT.local}&visite=1&segment=local`);
    expect(demoEntryHref('pme')).toContain('compte=demo-pme');
    expect(demoEntryHref('ecommerce')).toContain('compte=demo-ecom');
  });
});
