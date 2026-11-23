import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { GUIDES } from '@/lib/seo/guides';
import { GUIDE_2027_CHAPTERS, GUIDE_2027_SOURCES, guide2027Links, guide2027Refs, guide2027WordCount } from '@/lib/veille/guide2027';
import { plain, renderGuide2027Pdf } from '@/lib/veille/guide2027-pdf';

describe('guide 2027', () => {
  it('a la longueur d’un guide de 20 pages et plus', () => {
    expect(guide2027WordCount()).toBeGreaterThan(5000);
    expect(GUIDE_2027_CHAPTERS.length).toBeGreaterThanOrEqual(14);
  });

  it('cite chaque source, et seulement des sources existantes', () => {
    const refs = guide2027Refs();
    expect(Math.max(...refs)).toBeLessThanOrEqual(GUIDE_2027_SOURCES.length);
    expect(refs).toEqual(GUIDE_2027_SOURCES.map((_, i) => i + 1));
    for (const s of GUIDE_2027_SOURCES) expect(s.url).toMatch(/^https:\/\//);
  });

  it('ne lie que des pages internes existantes', () => {
    const slugs = new Set(GUIDES.map((g) => g.slug));
    for (const l of guide2027Links()) {
      if (l.startsWith('/guides/')) expect(slugs.has(l.slice(8)), l).toBe(true);
      else if (l.startsWith('/outils/')) expect(existsSync(path.join(process.cwd(), 'src/app/outils/[slug]/page.tsx'))).toBe(true);
      else expect(existsSync(path.join(process.cwd(), 'src/app', l, 'page.tsx')), l).toBe(true);
    }
  });

  it('retire la syntaxe des liens pour le PDF', () => {
    expect(plain('voir [la veille](/veille) [3]')).toBe('voir la veille [3]');
  });

  it('produit un PDF A4 de 20 pages ou plus', async () => {
    const buf = await renderGuide2027Pdf('test@exemple.fr');
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBeGreaterThanOrEqual(20);
  }, 60_000);
});
