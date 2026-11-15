import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES, guideWordCount } from '../guides';
import { GUIDES_V6, GUIDE_V6_FIGURES } from '../guides-v6';
import { pageExists } from '../routes';
import { TOOLS } from '@/components/tools/registry';

const APP = path.resolve(__dirname, '../../../app');
const PUBLIC = path.resolve(__dirname, '../../../../public');
const TOOL_PATHS = new Set(TOOLS.map((t) => `/outils/${t.slug}`));

/** Une route interne est valide si sa page existe dans src/app ou si c'est un outil du registre. */
function routeExists(href: string): boolean {
  const p = href.split(/[?#]/)[0];
  if (p.startsWith('/outils/')) return TOOL_PATHS.has(p);
  if (p.startsWith('/guides/')) return GUIDES.some((g) => `/guides/${g.slug}` === p);
  return pageExists(p, APP);
}

const texts = (g: (typeof GUIDES_V6)[number]) => [
  ...g.intro,
  ...g.sections.flatMap((s) => [...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? [])]),
];

describe('guides V6', () => {
  it('20 guides, au catalogue, slugs uniques et sans doublon de titre', () => {
    expect(GUIDES_V6).toHaveLength(20);
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES_V6) expect(slugs).toContain(g.slug);
    const titles = GUIDES.map((g) => g.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    for (const g of GUIDES_V6) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(GUIDES_V6.map((g) => [g.slug, g] as const))('%s : titre ≤ 60, description 120–160, 1 500 à 2 500 mots', (_s, g) => {
    expect(g.title.length).toBeLessThanOrEqual(60);
    expect((g.seoTitle ?? g.title).length).toBeLessThanOrEqual(60);
    expect(g.description.length).toBeGreaterThanOrEqual(120);
    expect(g.description.length).toBeLessThanOrEqual(160);
    const n = guideWordCount(g);
    expect(n).toBeGreaterThanOrEqual(1500);
    expect(n).toBeLessThanOrEqual(2500);
    expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.faq?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it.each(GUIDES_V6.map((g) => [g.slug, g] as const))('%s : sources non vides, toutes citées, renvois [n] valides', (_s, g) => {
    expect(g.sources.length).toBeGreaterThan(0);
    const used = new Set([...texts(g).join(' ').matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
    for (const n of used) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n, `renvoi [${n}] sans source`).toBeLessThanOrEqual(g.sources.length);
    }
    for (let i = 1; i <= g.sources.length; i++) expect(used.has(i), `source ${i} jamais citée`).toBe(true);
    for (const s of g.sources) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.note ?? '', `${s.url} : date de consultation manquante`).toMatch(/consulté le \d{1,2} \w+\.? \d{4}/);
    }
    expect(new Set(g.sources.map((s) => s.url)).size).toBe(g.sources.length);
  });

  it.each(GUIDES_V6.map((g) => [g.slug, g] as const))('%s : liens internes valides (guides liés, appel à l’action)', (_s, g) => {
    expect(g.related.length).toBeGreaterThanOrEqual(2);
    expect(g.related.length).toBeLessThanOrEqual(4);
    expect(g.related).not.toContain(g.slug);
    for (const r of g.related) expect(GUIDES.some((x) => x.slug === r), `guide lié absent : ${r}`).toBe(true);
    expect(g.cta.href.startsWith('/')).toBe(true);
    expect(routeExists(g.cta.href), `route absente : ${g.cta.href}`).toBe(true);
  });

  it('chaque guide V6 est relié à au moins un autre guide V6 ou pilier existant', () => {
    const v6 = new Set(GUIDES_V6.map((g) => g.slug));
    const older = new Set(GUIDES.filter((g) => !v6.has(g.slug)).map((g) => g.slug));
    for (const g of GUIDES_V6) expect(g.related.some((r) => older.has(r)), `${g.slug} : aucun lien vers un guide existant`).toBe(true);
  });

  it('schémas : fichier SVG présent, section valide, texte alternatif', () => {
    for (const [slug, f] of Object.entries(GUIDE_V6_FIGURES)) {
      const g = GUIDES_V6.find((x) => x.slug === slug);
      expect(g, slug).toBeDefined();
      expect(f.section).toBeLessThan(g!.sections.length);
      expect(f.src).toMatch(/^\/guides\/v6\/[a-z0-9-]+\.svg$/);
      const file = path.join(PUBLIC, f.src);
      expect(fs.existsSync(file), file).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(svg).toMatch(/<title[^>]*>[^<]+<\/title>/);
      expect(svg).not.toMatch(/<script|href="http/i);
      expect(f.alt.length).toBeGreaterThan(30);
    }
  });

  it('aucune promesse de résultat', () => {
    const all = JSON.stringify(GUIDES_V6);
    expect(all).not.toMatch(/garanti(t|ssons)? (d'|d’|de )?(être|une première|la première)/i);
    expect(all).not.toMatch(/premi(er|ère) place garantie|n° ?1 sur google|explose[zr]/i);
  });
});
