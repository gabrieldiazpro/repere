import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES, guideWordCount } from '../guides';
import { GUIDES_V3 } from '../guides-v3';
import { CELLS, COMPETITORS, FEATURES, makeRefs, SRC } from '../competitors';
import { METHOD_VERSION } from '../index';
import { isNoindexSource, literalChildren, pageExists, v3Routes } from '../routes';
import { CITABILITY_RULES, CITABILITY_TOTAL } from '../../../app/methode/rules';
import { CITABILITY_WEIGHTS } from '@/lib/siteaudit/citability';

const ROOT = path.resolve(__dirname, '../../../app');
const src = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('guides V3', () => {
  it('sont au catalogue, avec des slugs uniques', () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES_V3) expect(slugs).toContain(g.slug);
    expect(GUIDES_V3.map((g) => g.slug)).toEqual(['robots-ia-robots-txt', 'page-que-les-ia-citent', 'fiche-produit-et-ia', 'suivre-ses-questions-chatgpt']);
  });

  it.each(GUIDES_V3.map((g) => [g.slug, g] as const))('%s : 1 000 à 1 400 mots', (_s, g) => {
    const n = guideWordCount(g);
    expect(n).toBeGreaterThanOrEqual(1000);
    expect(n).toBeLessThanOrEqual(1400);
  });

  it.each(GUIDES_V3.map((g) => [g.slug, g] as const))('%s : renvois [n] cohérents avec les sources', (_s, g) => {
    const text = [...g.intro, ...g.sections.flatMap((s) => [...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? [])])].join(' ');
    const used = new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    for (const n of used) expect(n).toBeGreaterThanOrEqual(1), expect(n).toBeLessThanOrEqual(g.sources.length);
    for (let i = 1; i <= g.sources.length; i++) expect(used.has(i), `source ${i} jamais citée`).toBe(true);
    for (const s of g.sources) expect(s.url).toMatch(/^https:\/\//);
    for (const r of g.related) expect(GUIDES.some((x) => x.slug === r), `guide lié absent : ${r}`).toBe(true);
  });

  it('aucune promesse de résultat', () => {
    const all = JSON.stringify(GUIDES_V3);
    expect(all).not.toMatch(/garanti(t|ssons)? (d'|de )?(être|une première)/i);
    expect(all).not.toMatch(/\bpremier(e)? place garantie/i);
  });
});

describe('règles de citabilité publiées', () => {
  it('reprennent exactement les poids de l’audit de page', () => {
    expect(Object.fromEntries(CITABILITY_RULES.map((r) => [r.id, r.points]))).toEqual(CITABILITY_WEIGHTS);
    expect(CITABILITY_RULES).toHaveLength(20);
    expect(CITABILITY_TOTAL).toBe(100);
  });
});

describe('comparatif', () => {
  it('tous les renvois [@clé] existent et chaque fonction est renseignée pour chaque colonne', () => {
    const R = makeRefs();
    for (const col of Object.values(CELLS)) for (const f of FEATURES) expect(typeof col[f.id]).toBe('string'), R.t(col[f.id]);
    for (const c of COMPETITORS) {
      for (const s of [c.answer, c.intro, ...c.strengths, ...c.chooseThem, ...c.chooseUs, ...c.faq.flatMap((f) => [f.q, f.a])]) R.t(s);
      expect(CELLS[c.slug]).toBeDefined();
    }
    expect(COMPETITORS.map((c) => c.slug)).toEqual(['peec', 'otterly', 'profound', 'meteoria', 'qwairy', 'agence-geo', 'semrush', 'ahrefs', 'screaming-frog']);
    for (const s of Object.values(SRC)) expect(s.url).toMatch(/^https:\/\//);
  });
  it('aucun prix n’est donné sans source ou sans mention « non vérifié »', () => {
    for (const c of COMPETITORS.filter((x) => x.slug !== 'agence-geo')) {
      const price = CELLS[c.slug].prix;
      expect(/\[@\w+\]|non vérifié/i.test(price), `${c.slug} : prix sans source`).toBe(true);
    }
  });
});

describe('méthode et glossaire', () => {
  it('version de la méthode V3', () => expect(METHOD_VERSION).toBe('v3.0'));
  it('compteurs affichés = contenu réel', () => {
    expect(src('glossaire/page.tsx').match(/^\s+slug: '/gm)).toHaveLength(36);
    expect(src('questions/page.tsx').match(/^\s+id: '/gm)).toHaveLength(30);
  });
  it('réponses de la page Questions : 40 à 60 mots', () => {
    const answers = [...src('questions/page.tsx').matchAll(/\n\s+a: "((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
    expect(answers).toHaveLength(30);
    for (const a of answers) {
      const n = a.split(/\s+/).length;
      expect(n, a.slice(0, 40)).toBeGreaterThanOrEqual(38);
      expect(n, a.slice(0, 40)).toBeLessThanOrEqual(62);
    }
  });
});

describe('routes du sitemap et de llms.txt', () => {
  function tree(files: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repere-routes-'));
    for (const [p, c] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, p)), { recursive: true });
      fs.writeFileSync(path.join(root, p), c);
    }
    return root;
  }

  it('ne liste pas une page absente ni une page en noindex', () => {
    const root = tree({
      'demo/page.tsx': 'export default 1',
      'contact/page.tsx': "export const metadata = { robots: { index: false } }",
      'securite/page.tsx': "pageMeta({ noindex: true })",
      'cas-usage/page.tsx': 'x',
      'cas-usage/plombier/page.tsx': 'x',
      'cas-usage/[slug]/page.tsx': 'x',
      'cas-usage/_ebauche/page.tsx': 'x',
    });
    const paths = v3Routes(root).map((r) => r.path);
    expect(paths).toContain('/demo');
    expect(paths).toContain('/cas-usage');
    expect(paths).toContain('/cas-usage/plombier');
    expect(paths).not.toContain('/contact');
    expect(paths).not.toContain('/securite');
    expect(paths).not.toContain('/nouveautes');
    expect(paths.some((p) => p.includes('['))).toBe(false);
    expect(paths.some((p) => p.includes('_ebauche'))).toBe(false);
    // comparatifs par concurrent : toujours listés (ce module les possède)
    expect(paths).toContain('/comparatif/peec');
  });

  it('pageExists / isNoindexSource / literalChildren', () => {
    const root = tree({ 'a/page.tsx': 'x', 'b/page.tsx': 'index: false', 'a/c/page.tsx': 'x', 'a/[id]/page.tsx': 'x' });
    expect(pageExists('/a', root)).toBe(true);
    expect(pageExists('/z', root)).toBe(false);
    expect(isNoindexSource('/b', root)).toBe(true);
    expect(isNoindexSource('/a', root)).toBe(false);
    expect(literalChildren('/a', root)).toEqual(['/a/c']);
  });

  it('sur le vrai dossier src/app : jamais de page absente', () => {
    for (const r of v3Routes(ROOT)) {
      const concrete = r.path.startsWith('/outils/') || r.path.startsWith('/fonctionnalites/') || r.path.startsWith('/comparatif/') || r.path.startsWith('/cas-usage/') || r.path.startsWith('/aide/');
      if (concrete) continue; // pages dynamiques : couvertes par leur registre
      expect(pageExists(r.path, ROOT), r.path).toBe(true);
    }
  });

  it('sur le vrai dossier src/app : outils, fonctionnalités, cas d’usage, aide et robot sont listés', () => {
    const paths = v3Routes(ROOT).map((r) => r.path);
    for (const p of ['/outils', '/fonctionnalites', '/demo', '/nouveautes', '/securite', '/integrations', '/contact', '/aide', '/cas-usage', '/inscription', '/badge', '/parrainage', '/methode/robot']) {
      expect(paths, p).toContain(p);
    }
    expect(paths.filter((p) => p.startsWith('/outils/'))).toHaveLength(9);
    expect(paths.filter((p) => p.startsWith('/fonctionnalites/'))).toHaveLength(17);
    expect(paths.filter((p) => p.startsWith('/cas-usage/'))).toHaveLength(6);
    expect(paths.filter((p) => p.startsWith('/aide/')).length).toBeGreaterThan(0);
    for (const noindex of ['/classement', '/carte', '/r', '/connexion', '/bienvenue']) expect(paths).not.toContain(noindex);
  });
});
