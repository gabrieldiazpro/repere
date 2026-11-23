import { describe, expect, it } from 'vitest';
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';
import { extractPage } from '@/lib/crawl/extract';
import { applyFinding, replacePassage, setImgAlt, setMetaName, setTitle } from '../apply';

function page(url: string, html: string): CrawledPage {
  const { links: _l, baseUrl: _b, ...x } = extractPage(html, url);
  void _l;
  void _b;
  return { url, finalUrl: url, status: 200, redirectChain: [], depth: 0, contentType: 'text/html', bytes: html.length, fetchMs: 10, headers: {}, internalLinks: 0, externalLinks: 0, isIndexable: true, ...x };
}
function crawl(pages: CrawledPage[]): SiteCrawl {
  return { startUrl: 'https://ex.fr/', origin: 'https://ex.fr', finalOrigin: 'https://ex.fr', startedAt: '2026-11-01T00:00:00Z', durationMs: 1, truncated: false, robots: { url: 'https://ex.fr/robots.txt', status: 200, text: 'User-agent: *\nAllow: /', sitemaps: [] }, sitemaps: [], sitemapUrls: [], pages, links: [], errors: [] };
}
const HTML = '<html><head><title>Vieux</title></head><body><main><h1>Plombier</h1><p>Nous intervenons <b>vite</b> à Lyon.</p><img src="/a.jpg"><a href="/x">x</a></main></body></html>';

describe('éditions HTML', () => {
  it('titre, description, alt, passage', () => {
    expect(extractPage(setTitle(HTML, 'Neuf & bon'), 'https://ex.fr/').title).toBe('Neuf & bon');
    expect(extractPage(setMetaName(HTML, 'description', 'Desc "ok"'), 'https://ex.fr/').metaDescription).toBe('Desc "ok"');
    const [h, n] = setImgAlt(HTML, 'https://ex.fr/', 'https://ex.fr/a.jpg', 'Une photo');
    expect(n).toBe(1);
    expect(extractPage(h, 'https://ex.fr/').images[0].alt).toBe('Une photo');
    const [h2, ok] = replacePassage(HTML, 'Nous intervenons vite à Lyon.', 'Nous intervenons en 2 h à Lyon.');
    expect(ok).toBe(true);
    expect(h2).toContain('en 2 h');
  });

  it('relit la page avec l’extracteur du robot (indexabilité recalculée)', () => {
    const c = crawl([page('https://ex.fr/', HTML)]);
    const r = applyFinding(c, { id: 'x', autoFix: { kind: 'meta.robots', payload: { items: [{ url: 'https://ex.fr/', value: 'noindex, follow' }] } } });
    expect(r.ok).toBe(true);
    expect(c.pages[0].metaRobots).toBe('noindex, follow');
    expect(c.pages[0].isIndexable).toBe(false);
  });

  it('robots.txt : les adresses interdites ne sont plus lues ; pages déjà bloquées = non simulable', () => {
    const c = crawl([page('https://ex.fr/', HTML), page('https://ex.fr/recherche?q=a', HTML)]);
    const r = applyFinding(c, { id: 'r', autoFix: { kind: 'robots', payload: { text: 'User-agent: *\nDisallow: /recherche\nSitemap: https://ex.fr/sitemap.xml\n' } } });
    expect(r.ok).toBe(true);
    expect(c.robots?.sitemaps).toEqual(['https://ex.fr/sitemap.xml']);
    expect(c.pages[1].blockedByRobots).toBe(true);
    const r2 = applyFinding(c, { id: 'r', autoFix: { kind: 'robots', payload: { text: 'User-agent: *\nAllow: /' } } });
    expect(r2.ok).toBe(false);
    expect(r2.reason).toMatch(/jamais été lues/);
  });

  it('redirection vers une page non lue : non simulable', () => {
    const c = crawl([page('https://ex.fr/', HTML)]);
    const r = applyFinding(c, { id: 'd', autoFix: { kind: 'redirect', payload: { items: [{ from: '/vieux', to: '/absente', status: 301 }] } } });
    expect(r.ok).toBe(false);
  });

  it('FAQ sans réponse connue : exclue ; llms.txt : informatif', () => {
    const c = crawl([page('https://ex.fr/', HTML)]);
    expect(applyFinding(c, { id: 'f', autoFix: { kind: 'faq', payload: { url: 'https://ex.fr/', value: [{ question: 'Prix ?', answer: '', from: 'a_completer' }] } } }).ok).toBe(false);
    expect(applyFinding(c, { id: 'l', autoFix: { kind: 'llms.txt', payload: {} } }).reason).toMatch(/informatif/);
  });
});
