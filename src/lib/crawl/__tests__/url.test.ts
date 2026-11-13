import { describe, expect, it } from 'vitest';
import { balancedSample, isInternal, normalizeStartUrl, normalizeUrl } from '../url';
import { parseSitemap } from '../sitemap';
import { hasNoindex, textHash } from '../extract';
import { crawlDelayFor } from '../fetcher';

describe('url', () => {
  it('normalise pour la déduplication', () => {
    expect(normalizeUrl('HTTPS://Exemple.FR:443/a?utm_source=x&b=2&a=1&fbclid=z#frag')).toBe('https://exemple.fr/a?a=1&b=2');
    expect(normalizeUrl('/b/', 'https://exemple.fr/a')).toBe('https://exemple.fr/b/');
    expect(normalizeUrl('mailto:x@y.fr')).toBeNull();
    expect(normalizeUrl('http://exemple.fr:80')).toBe('http://exemple.fr/');
  });
  it('normalise la saisie', () => {
    expect(normalizeStartUrl('exemple.fr')).toEqual({ url: 'https://exemple.fr/', schemeGiven: false });
    expect(normalizeStartUrl('http://www.exemple.fr/#x')).toEqual({ url: 'http://www.exemple.fr/', schemeGiven: true });
    expect(normalizeStartUrl('')).toBeNull();
  });
  it('classe interne / externe', () => {
    expect(isInternal('https://www.exemple.fr/x', 'exemple.fr')).toBe(true);
    expect(isInternal('https://blog.exemple.fr/x', 'www.exemple.fr')).toBe(false);
    expect(isInternal('https://blog.exemple.fr/x', 'www.exemple.fr', true)).toBe(true);
    expect(isInternal('https://exemple.fr.evil.com/', 'exemple.fr', true)).toBe(false);
  });
  it('échantillonne par section', () => {
    const urls = [...Array.from({ length: 50 }, (_, i) => `https://a.fr/produits/${i}`), 'https://a.fr/blog/1', 'https://a.fr/blog/2', 'https://a.fr/aide'];
    const s = balancedSample(urls, 6);
    expect(s).toHaveLength(6);
    expect(s.filter((u) => u.includes('/blog/'))).toHaveLength(2);
    expect(s).toContain('https://a.fr/aide');
  });
});

describe('divers', () => {
  it('sitemap texte et invalide', () => {
    expect(parseSitemap('https://a.fr/1\nhttps://a.fr/2\n')).toEqual({ kind: 'text', locs: ['https://a.fr/1', 'https://a.fr/2'] });
    expect(parseSitemap('<html></html>').kind).toBe('unknown');
    expect(parseSitemap('<urlset><url><loc><![CDATA[https://a.fr/?a=1&amp;b=2]]></loc></url></urlset>').locs).toEqual(['https://a.fr/?a=1&b=2']);
  });
  it('noindex', () => {
    expect(hasNoindex('NOINDEX', undefined)).toBe(true);
    expect(hasNoindex(undefined, 'otherbot: noindex')).toBe(false);
    expect(hasNoindex(undefined, 'noindex, nofollow')).toBe(true);
    expect(hasNoindex(undefined, 'unavailable_after: 2030-01-01')).toBe(false);
  });
  it('empreinte de texte insensible à la casse, aux accents et aux espaces', () => {
    expect(textHash('Été  à Lyon !')).toBe(textHash('ete a lyon'));
  });
  it('crawl-delay', () => {
    expect(crawlDelayFor('User-agent: *\nCrawl-delay: 2\n')).toBe(2000);
    expect(crawlDelayFor('User-agent: RepereBot\nCrawl-delay: 0.5\nUser-agent: *\nCrawl-delay: 9\n')).toBe(500);
  });
});
