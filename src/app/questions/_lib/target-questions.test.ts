import { describe, expect, it } from 'vitest';
import { pageExists } from '@/lib/seo/routes';
import { GUIDES } from '@/lib/seo/guides';
import { COMPETITORS } from '@/lib/seo/competitors';
import { TOOLS } from '@/components/tools/registry';
import { STUDIES } from '@/lib/studies';
import { TARGET_QUESTIONS, type Block } from './target-questions';
import { GEO_SRC } from './sources';
import { hasSource, refKeys, refResolver } from './refs';
import { plain } from './render';
import { BRAND_STUDY_QA, BRAND_STUDY_SLUG, BRAND_STUDY_SOURCES } from '../../etudes/[slug]/marque-citee';

const words = (s: string) => plain(s).split(/\s+/).filter(Boolean).length;
const blockTexts = (b: Block): string[] =>
  'p' in b ? [b.p] : 'ul' in b ? b.ul : 'ol' in b ? b.ol : [...b.table.head, ...b.table.rows.flat(), b.table.caption ?? ''];
const allTexts = () =>
  TARGET_QUESTIONS.flatMap((x) => [
    x.q,
    x.answer,
    x.description,
    ...x.takeaways,
    ...x.faq.flatMap((f) => [f.q, f.a]),
    ...x.sections.flatMap((s) => [s.q, s.answer, ...(s.blocks ?? []).flatMap(blockTexts)]),
  ]);

/** Chemins internes existants : pages littérales + familles à registre. */
function internalExists(href: string): boolean {
  const path = href.split('#')[0];
  const [, family, slug] = path.split('/');
  if (slug) {
    if (family === 'guides') return GUIDES.some((g) => g.slug === slug);
    if (family === 'comparatif') return COMPETITORS.some((c) => c.slug === slug);
    if (family === 'outils') return TOOLS.some((t) => t.slug === slug);
    if (family === 'questions') return TARGET_QUESTIONS.some((t) => t.slug === slug);
    if (family === 'etudes') return STUDIES.some((s) => s.slug === slug);
  }
  return pageExists(path);
}

describe('pages « grandes questions »', () => {
  it('slugs uniques, au format URL', () => {
    const slugs = TARGET_QUESTIONS.map((x) => x.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('title SEO de 30 à 60 caractères, description de 110 à 200', () => {
    for (const x of TARGET_QUESTIONS) {
      expect(x.seoTitle.length, x.seoTitle).toBeGreaterThanOrEqual(30);
      expect(x.seoTitle.length, x.seoTitle).toBeLessThanOrEqual(60);
      expect(x.description.length, x.slug).toBeGreaterThanOrEqual(110);
      expect(x.description.length, x.slug).toBeLessThanOrEqual(200);
    }
  });

  it('réponse directe en tête : 40 à 90 mots ; réponses de section : 20 à 75 mots', () => {
    for (const x of TARGET_QUESTIONS) {
      expect(words(x.answer), x.slug).toBeGreaterThanOrEqual(40);
      expect(words(x.answer), x.slug).toBeLessThanOrEqual(90);
      for (const s of x.sections) {
        expect(words(s.answer), s.id).toBeGreaterThanOrEqual(20);
        expect(words(s.answer), s.id).toBeLessThanOrEqual(75);
      }
    }
  });

  it('chaque renvoi [@clé] pointe vers une source connue', () => {
    for (const t of allTexts()) for (const k of refKeys(t)) expect(hasSource(k), k).toBe(true);
    expect(() => refResolver().t('x [@inconnue]')).toThrow(/Source inconnue/);
  });

  it('les FAQ (reprises en JSON-LD) ne contiennent ni renvoi ni lien', () => {
    for (const x of TARGET_QUESTIONS) for (const f of x.faq) expect(f.a).not.toMatch(/\[@|\]\(\//);
  });

  it('chaque lien interne mène à une page existante', () => {
    const hrefs = [
      ...allTexts().flatMap((t) => [...t.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1])),
      ...TARGET_QUESTIONS.flatMap((x) => x.related.map((r) => r.href)),
    ];
    expect(hrefs.length).toBeGreaterThan(10);
    for (const h of hrefs) expect(internalExists(h), h).toBe(true);
  });

  it('aucune promesse de résultat ni superlatif interdit', () => {
    for (const t of allTexts()) {
      expect(t).not.toMatch(/n°\s?1|numéro 1|explosez|garanti(e|s)?\s(d|un|votre)|en \d+ jours/i);
    }
  });

  it('Repéré n’est jamais en tête d’un tableau d’outils', () => {
    for (const x of TARGET_QUESTIONS)
      for (const s of x.sections)
        for (const b of s.blocks ?? []) {
          if (!('table' in b) || b.table.rows.length < 3) continue;
          const first = b.table.rows.map((r) => r[0]);
          if (first.some((c) => c.startsWith('Repéré'))) expect(first[0].startsWith('Repéré'), `${x.slug}#${s.id}`).toBe(false);
        }
  });

  it('chaque page cite au moins 3 sources, toutes en https avec une note', () => {
    for (const x of TARGET_QUESTIONS) {
      const { t, sources } = refResolver();
      [x.answer, ...x.takeaways, ...x.sections.flatMap((s) => [s.answer, ...(s.blocks ?? []).flatMap(blockTexts)])].forEach(t);
      expect(sources().length, x.slug).toBeGreaterThanOrEqual(3);
    }
    for (const s of Object.values(GEO_SRC)) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(s.note.length).toBeGreaterThan(5);
    }
  });

  it('plain() retire liens et renvois', () => {
    expect(plain('Voir [le guide](/guides/x) [3] et [@kdd2024].')).toBe('Voir le guide et.');
  });
});

describe('étude « pourquoi une IA recommande une marque »', () => {
  it('est au catalogue des études', () => expect(STUDIES.map((s) => s.slug)).toContain(BRAND_STUDY_SLUG));
  it('cite au moins 15 sources, sans doublon', () => {
    expect(BRAND_STUDY_SOURCES.length).toBeGreaterThanOrEqual(15);
    expect(new Set(BRAND_STUDY_SOURCES.map((s) => s.url)).size).toBe(BRAND_STUDY_SOURCES.length);
  });
  it('FAQ en texte brut', () => {
    for (const f of BRAND_STUDY_QA) expect(f.a).not.toMatch(/\[@|\[\d+\]/);
  });
});

describe('questions suivies par le compte maison (docs/visibilite-repere/questions-suivies.csv)', () => {
  it('30 questions uniques, importables par l’import de l’app, avec thème et intention', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { parseImport } = await import('@/lib/prompts/io');
    const csv = fs.readFileSync(path.resolve(__dirname, '../../../../../docs/visibilite-repere/questions-suivies.csv'), 'utf8');
    const rows = parseImport(csv);
    expect(rows).toHaveLength(30);
    expect(new Set(rows.map((r) => r.text)).size).toBe(30);
    for (const r of rows) {
      expect(r.theme, r.text).toBeTruthy();
      expect(r.intent, r.text).toBeTruthy();
    }
  });
});
