import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDES, guideWordCount } from '../guides';
import { GUIDES_V6 } from '../guides-v6';
import { GUIDES_V7, GUIDE_V7_FIGURES } from '../guides-v7';
import { pageExists } from '../routes';
import { TOOLS } from '@/components/tools/registry';

const APP = path.resolve(__dirname, '../../../app');
const PUBLIC = path.resolve(__dirname, '../../../../public');
const TOOL_PATHS = new Set(TOOLS.map((t) => `/outils/${t.slug}`));

/** Une route interne est valide si sa page existe dans src/app, si c'est un guide du catalogue ou un outil du registre. */
function routeExists(href: string): boolean {
  const p = href.split(/[?#]/)[0];
  if (p.startsWith('/outils/')) return TOOL_PATHS.has(p);
  if (p.startsWith('/guides/')) return GUIDES.some((g) => `/guides/${g.slug}` === p);
  return pageExists(p, APP);
}

type G = (typeof GUIDES_V7)[number];
const texts = (g: G) => [...g.intro, ...g.sections.flatMap((s) => [...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? [])])];
/** Liens internes écrits dans le corps au format [texte](/chemin), rendus par la page /guides/[slug]. */
const bodyLinks = (g: G) => [...texts(g).join('\n').matchAll(/\[([^\]\n]+)\]\((\/[^)\s]*)\)/g)].map((m) => m[2]);

describe('guides V7', () => {
  it('20 guides, au catalogue (53 au total), slugs et titres uniques', () => {
    expect(GUIDES_V7).toHaveLength(20);
    expect(GUIDES).toHaveLength(53);
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const g of GUIDES_V7) expect(slugs).toContain(g.slug);
    const titles = GUIDES.map((g) => g.title.toLowerCase());
    expect(new Set(titles).size).toBe(titles.length);
    const seo = GUIDES.map((g) => (g.seoTitle ?? g.title).toLowerCase());
    expect(new Set(seo).size).toBe(seo.length);
    for (const g of GUIDES_V7) expect(g.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(GUIDES_V7.map((g) => [g.slug, g] as const))('%s : titre ≤ 60, description 120–160, 1 800 à 2 800 mots, FAQ', (_s, g) => {
    expect(g.title.length).toBeLessThanOrEqual(60);
    expect((g.seoTitle ?? g.title).length).toBeLessThanOrEqual(60);
    expect(g.description.length).toBeGreaterThanOrEqual(120);
    expect(g.description.length).toBeLessThanOrEqual(160);
    const n = guideWordCount(g);
    expect(n).toBeGreaterThanOrEqual(1800);
    expect(n).toBeLessThanOrEqual(2800);
    expect(g.updated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.faq?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it.each(GUIDES_V7.map((g) => [g.slug, g] as const))('%s : sources non vides, toutes citées, datées, renvois [n] valides', (_s, g) => {
    expect(g.sources.length).toBeGreaterThan(1);
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

  it.each(GUIDES_V7.map((g) => [g.slug, g] as const))('%s : liens du corps valides, 3 à 5 guides et au moins un outil', (_s, g) => {
    const links = bodyLinks(g);
    for (const l of links) expect(routeExists(l), `route absente : ${l}`).toBe(true);
    const guides = new Set(links.filter((l) => l.startsWith('/guides/')));
    expect(guides.has(`/guides/${g.slug}`), 'lien vers soi-même').toBe(false);
    expect(guides.size).toBeGreaterThanOrEqual(3);
    expect(guides.size).toBeLessThanOrEqual(5);
    expect(links.some((l) => l.startsWith('/outils/'))).toBe(true);
  });

  it.each(GUIDES_V7.map((g) => [g.slug, g] as const))('%s : guides liés et appel à l’action valides', (_s, g) => {
    expect(g.related.length).toBeGreaterThanOrEqual(2);
    expect(g.related.length).toBeLessThanOrEqual(4);
    expect(g.related).not.toContain(g.slug);
    for (const r of g.related) expect(GUIDES.some((x) => x.slug === r), `guide lié absent : ${r}`).toBe(true);
    expect(g.cta.href.startsWith('/')).toBe(true);
    expect(routeExists(g.cta.href), `route absente : ${g.cta.href}`).toBe(true);
  });

  it('chaque guide V7 est relié à au moins un guide antérieur (V2 à V6)', () => {
    const v7 = new Set(GUIDES_V7.map((g) => g.slug));
    const older = new Set(GUIDES.filter((g) => !v7.has(g.slug)).map((g) => g.slug));
    for (const g of GUIDES_V7) expect(g.related.some((r) => older.has(r)), `${g.slug} : aucun lien vers un guide existant`).toBe(true);
  });

  it('pas de sujet en double avec les guides V6 (slugs distincts, mots du titre peu recouvrants)', () => {
    const words = (t: string) => new Set(t.toLowerCase().split(/[^a-zà-ÿ0-9]+/).filter((w) => w.length > 3));
    for (const a of GUIDES_V7) {
      for (const b of GUIDES_V6) {
        const wa = words(a.title);
        const wb = words(b.title);
        const common = [...wa].filter((w) => wb.has(w)).length;
        expect(common / Math.max(1, Math.min(wa.size, wb.size)), `${a.slug} ~ ${b.slug}`).toBeLessThan(0.75);
      }
    }
  });

  it('schémas : au moins 6, fichier SVG présent, section valide, titre et texte alternatif', () => {
    expect(Object.keys(GUIDE_V7_FIGURES).length).toBeGreaterThanOrEqual(6);
    for (const [slug, f] of Object.entries(GUIDE_V7_FIGURES)) {
      const g = GUIDES_V7.find((x) => x.slug === slug);
      expect(g, slug).toBeDefined();
      expect(f.section).toBeLessThan(g!.sections.length);
      expect(f.src).toMatch(/^\/guides\/v7\/[a-z0-9-]+\.svg$/);
      const file = path.join(PUBLIC, f.src);
      expect(fs.existsSync(file), file).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(svg).toMatch(/viewBox="0 0 \d+ \d+"/);
      expect(svg).toMatch(/<title[^>]*>[^<]+<\/title>/);
      expect(svg).not.toMatch(/<script|href="http/i);
      expect(f.alt.length).toBeGreaterThan(30);
      expect(f.caption.length).toBeGreaterThan(10);
    }
  });

  it('aucune promesse de résultat', () => {
    const all = JSON.stringify(GUIDES_V7);
    expect(all).not.toMatch(/garanti(t|ssons)? (d'|d’|de )?(être|une première|la première)/i);
    expect(all).not.toMatch(/premi(er|ère) place garantie|n° ?1 sur google|explose[zr]/i);
  });

  it('exemples présentés comme fictifs', () => {
    for (const g of GUIDES_V7) expect(texts(g).join(' '), g.slug).toMatch(/fictif|fictive|fictifs/);
  });
});
