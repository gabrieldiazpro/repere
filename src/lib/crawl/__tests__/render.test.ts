/**
 * ROBUSTESSE (V6) — rendu JavaScript optionnel (CRAWL_RENDER=on) avec le Chromium déjà installé sur la machine.
 * Le navigateur n'a pas d'accès réseau : chaque requête passe par le récupérateur sûr du crawl (faux sites locaux).
 * Ignoré si aucun Chromium n'est présent. Un seul navigateur, fermé à la fin de chaque exploration.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crawlSite } from '../crawl';
import { renderConfig, resolveWsEndpoint } from '../render';
import { startFakeSites, type FakeServer } from './fakesites';

const cfg = renderConfig({ CRAWL_RENDER: 'on' });
const hasChrome = !!cfg.chromePath;

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeSites();
  process.env.CRAWL_RENDER = 'on';
});
afterAll(async () => {
  delete process.env.CRAWL_RENDER;
  await srv.close();
});

describe('renderConfig', () => {
  it('désactivé par défaut, budgets bornés', () => {
    expect(renderConfig({}).enabled).toBe(false);
    expect(renderConfig({ CRAWL_RENDER: 'off' }).enabled).toBe(false);
    const c = renderConfig({ CRAWL_RENDER: 'on', CRAWL_RENDER_MAX_PAGES: '50', CRAWL_RENDER_TIMEOUT_MS: '999999', CRAWL_RENDER_WS: 'ws://navigateur:3000' });
    expect(c).toMatchObject({ enabled: true, maxPages: 5, pageTimeoutMs: 15_000, wsEndpoint: 'ws://navigateur:3000' });
    expect(c.chromePath).toBeUndefined();
  });
});

describe('navigateur distant (CRAWL_RENDER_WS)', () => {
  it('ws:// tel quel ; http(s):// résolu par /json/version et réécrit sur l’hôte public', async () => {
    expect(await resolveWsEndpoint('wss://rendu.exemple.fr/devtools/browser/abc?token=x')).toBe('wss://rendu.exemple.fr/devtools/browser/abc?token=x');
    const http = await import('node:http');
    const s = http.createServer((req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/browser/1234-abcd', seen: req.url }));
    });
    await new Promise<void>((ok) => s.listen(0, '127.0.0.1', () => ok()));
    const port = (s.address() as { port: number }).port;
    expect(await resolveWsEndpoint(`http://127.0.0.1:${port}/cdp?token=secret`)).toBe(`ws://127.0.0.1:${port}/cdp/devtools/browser/1234-abcd?token=secret`);
    s.close();
  });
});

describe.skipIf(!hasChrome)('rendu avec Chromium', () => {
  it('SPA vide côté serveur : contenu rendu lu, liens découverts et explorés, budget tenu', async () => {
    const t = Date.now();
    const c = await crawlSite('spa-vide.test', { delayMs: 0, timeBudgetMs: 25_000 });
    const home = c.pages[0];
    expect(c.render?.rendered).toContain('https://spa-vide.test/');
    expect(home).toMatchObject({ rendered: true, title: 'Plombier Martin | Nantes' });
    expect(home.h1).toEqual(['Plombier Martin à Nantes']);
    expect(home.wordCount).toBeGreaterThan(50);
    expect(home.renderHints.likelyClientRendered).toBe(true); // HTML serveur : toujours vide pour les robots d'IA
    expect(home.html).toContain('<div id="root"></div>'); // le HTML gardé reste celui du serveur
    expect(c.pages.some((p) => p.finalUrl === 'https://spa-vide.test/services')).toBe(true);
    expect(c.diagnosis?.notes.map((n) => n.code)).toContain('rendered');
    expect(Date.now() - t).toBeLessThan(25_000);
  }, 40_000);

  it('aucune fuite réseau pendant le rendu (fetch, image, WebSocket vers 127.0.0.1 / 169.254.169.254)', async () => {
    const before = srv.hits.length;
    const c = await crawlSite('spa-ssrf.test', { delayMs: 0, timeBudgetMs: 25_000 });
    expect(c.pages[0]).toMatchObject({ rendered: true, h1: ['Rendu sûr'] });
    const hits = srv.hits.slice(before);
    expect(hits.filter((h) => /fuite|169\.254|^GET 127\.0\.0\.1/.test(h))).toEqual([]);
  }, 40_000);
});
