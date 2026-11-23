import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { GUIDES } from '@/lib/seo/guides';
import {
  AUDIENCES,
  CONSULTED,
  THEMES,
  VEILLE_ENTRIES,
  entryProblems,
  facetCounts,
  filterEntries,
  frDate,
  getEntry,
  sortedEntries,
  timeline,
  timelineByYear,
  upcoming,
  veilleRss,
} from '@/lib/veille';

const guideSlugs = new Set(GUIDES.map((g) => g.slug));

/** Une route interne existe-t-elle dans src/app ? (pages statiques, guides, outils) */
function routeExists(href: string): boolean {
  const p = href.split(/[?#]/)[0];
  if (/^\/guides\/[^/]+$/.test(p)) return guideSlugs.has(p.split('/')[2]);
  if (/^\/outils\/[^/]+$/.test(p)) return existsSync(path.join(process.cwd(), 'src/app/outils/[slug]/page.tsx'));
  return existsSync(path.join(process.cwd(), 'src/app', p, 'page.tsx'));
}

describe('fiches de veille', () => {
  it('compte 20 fiches aux slugs uniques', () => {
    expect(VEILLE_ENTRIES).toHaveLength(20);
    expect(new Set(VEILLE_ENTRIES.map((e) => e.slug)).size).toBe(20);
  });

  it.each(VEILLE_ENTRIES.map((e) => [e.slug, e] as const))('%s est complète et cohérente', (_s, e) => {
    expect(entryProblems(e, guideSlugs)).toEqual([]);
    for (const s of e.sources) expect(s.consulted).toBe(CONSULTED);
    for (const t of e.tools) expect(routeExists(t.href), t.href).toBe(true);
    expect(e.guides.length).toBeGreaterThan(0);
  });

  it('couvre chaque thème et chaque cible', () => {
    const c = facetCounts();
    for (const t of THEMES) expect(c.themes[t]).toBeGreaterThan(0);
    for (const a of AUDIENCES) expect(c.audiences[a]).toBeGreaterThan(0);
  });

  it('ne promet aucun résultat', () => {
    const text = JSON.stringify(VEILLE_ENTRIES).toLowerCase();
    for (const bad of ['garanti en', 'nous garantissons', 'résultat garanti', 'première position assurée']) expect(text).not.toContain(bad);
  });

  it('trie, filtre et retrouve', () => {
    const s = sortedEntries();
    for (let i = 1; i < s.length; i++) expect(s[i - 1].eventDate >= s[i].eventDate).toBe(true);
    expect(getEntry('ai-act-article-50-transparence')?.status).toBe('en-vigueur');
    expect(getEntry('inexistante')).toBeUndefined();
    const local = filterEntries(VEILLE_ENTRIES, { audience: 'local' });
    expect(local.every((e) => e.audiences.includes('local'))).toBe(true);
    const both = filterEntries(VEILLE_ENTRIES, { audience: 'ecommerce', theme: 'commerce' });
    expect(both.every((e) => e.audiences.includes('ecommerce') && e.themes.includes('commerce'))).toBe(true);
    expect(filterEntries(VEILLE_ENTRIES, {})).toHaveLength(20);
  });

  it('construit une frise chronologique avec passé et avenir', () => {
    const t = timeline(VEILLE_ENTRIES, '2026-11-23');
    for (let i = 1; i < t.length; i++) expect(t[i - 1].date <= t[i].date).toBe(true);
    const next = upcoming(VEILLE_ENTRIES, '2026-11-23');
    expect(next.map((x) => x.date)).toEqual(expect.arrayContaining(['2026-12-02', '2027-01-31']));
    expect(next.every((x) => x.date > '2026-11-23')).toBe(true);
    const years = timelineByYear(t).map((y) => y.year);
    expect(years).toEqual([...years].sort());
  });

  it('formate les dates en français', () => {
    expect(frDate('2026-07-22')).toBe('22 juillet 2026');
    expect(frDate('2026-08-01')).toBe('1er août 2026');
    expect(frDate('2026-08')).toBe('août 2026');
  });
});

describe('flux RSS', () => {
  const xml = veilleRss('https://repere.example/');
  it('liste toutes les fiches avec des liens absolus', () => {
    expect(xml.startsWith('<?xml')).toBe(true);
    expect(xml.match(/<item>/g)).toHaveLength(20);
    expect(xml).toContain('<link>https://repere.example/veille/apercus-ia-mode-ia-france</link>');
    expect(xml).toContain('rel="self"');
  });
  it('échappe le XML', () => {
    expect(xml).not.toMatch(/<description>[^<]*[&](?!amp;|lt;|gt;|quot;|apos;)/);
    expect(xml).toContain('&apos;');
  });
});
