import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimit } from '@/lib/ratelimit';
import { POST as reviewLink } from '@/app/api/tools/review-link/route';
import { POST as readiness } from '@/app/api/tools/readiness/route';
import { POST as jsonldGenerate } from '@/app/api/tools/jsonld/generate/route';
import {
  callTool,
  highlight,
  htmlToText,
  kindFrom,
  normalizeUrl,
  readShareParams,
  scoreBand,
  shareHref,
  sortChecks,
  textToHtml,
  toolError,
} from '../api';
import { TOOLS, getTool, toolPath } from '../registry';
import {
  CITABILITY_SAMPLE_HTML,
  EXAMPLE_PLACE_ID,
  exampleCitability,
  exampleCompare,
  exampleLlms,
  exampleProduct,
  exampleReadiness,
  exampleReviewLink,
  exampleRobots,
} from '../examples';

describe('normalizeUrl', () => {
  it('ajoute https et accepte un domaine nu', () => {
    expect(normalizeUrl('votre-commerce.fr')).toEqual({ ok: true, url: 'https://votre-commerce.fr/' });
    expect(normalizeUrl(' http://a.fr/page#x ')).toEqual({ ok: true, url: 'http://a.fr/page' });
  });
  it('refuse vide, espaces, schéma exotique, hôte sans extension, adresses privées', () => {
    for (const bad of ['', 'mon site.fr', 'ftp://a.fr', 'javascript:alert(1)', 'localhost', 'http://192.168.1.1', 'http://10.0.0.1/x', 'intranet']) {
      expect(normalizeUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe('erreurs', () => {
  it('classe les codes réels de l’API', () => {
    expect(kindFrom(429, 'rate_limited')).toBe('limit');
    expect(kindFrom(403, 'robots_disallowed')).toBe('blocked');
    expect(kindFrom(504, 'timeout')).toBe('unreachable');
    expect(kindFrom(502, 'dns')).toBe('unreachable');
    expect(kindFrom(400, 'blocked_ip')).toBe('invalid');
    expect(kindFrom(400, 'bad_request')).toBe('invalid');
    expect(kindFrom(500, 'internal')).toBe('unknown');
  });
  it('garde le message serveur français, sauf les messages de validation techniques', () => {
    expect(toolError(502, 'dns', 'Nom de domaine introuvable.').message).toBe('Nom de domaine introuvable.');
    expect(toolError(400, 'bad_request', 'Requête invalide (url : trop court).').message).not.toMatch(/Requête invalide/);
    expect(toolError(429, 'rate_limited', '').hint).toMatch(/heure/);
  });
});

describe('callTool sur les vraies routes', () => {
  beforeEach(() => resetRateLimit());
  afterEach(() => vi.unstubAllGlobals());
  const stub = (handler: (req: Request) => Promise<Response>) =>
    vi.stubGlobal('fetch', async (path: string, init: RequestInit) =>
      handler(new Request(`http://localhost${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), 'x-forwarded-for': '198.51.100.7' } })),
    );

  it('review-link : { ok, data } typé, QR SVG présent', async () => {
    stub(reviewLink);
    const out = await callTool('/api/tools/review-link', { placeId: EXAMPLE_PLACE_ID, name: 'Test' });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.reviewUrl).toContain(EXAMPLE_PLACE_ID);
      expect(out.data.qrSvg).toMatch(/^<svg/);
    }
  });

  it('jsonld/generate : script prêt à coller', async () => {
    stub(jsonldGenerate);
    const out = await callTool('/api/tools/jsonld/generate', { type: 'FAQPage', fields: { faq: [{ q: 'Quels horaires ?', a: 'Du lundi au samedi.' }] } });
    expect(out.ok && out.data.script).toMatch(/application\/ld\+json/);
  });

  it('adresse privée : erreur « invalid » avec message en français', async () => {
    stub(readiness);
    const out = await callTool('/api/tools/readiness', { url: 'http://127.0.0.1/' });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.error.kind).toBe('invalid');
      expect(out.error.message.length).toBeGreaterThan(5);
    }
  });

  it('limite atteinte : erreur « limit »', async () => {
    stub(reviewLink);
    let last: Awaited<ReturnType<typeof callTool>> | null = null;
    for (let i = 0; i < 62; i++) last = await callTool('/api/tools/review-link', { placeId: EXAMPLE_PLACE_ID });
    expect(last && !last.ok && last.error.kind).toBe('limit');
  });

  it('réseau coupé : erreur « network »', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    const out = await callTool('/api/tools/robots', { url: 'https://a.fr' });
    expect(!out.ok && out.error.kind).toBe('network');
  });
});

describe('partage et surlignage', () => {
  it('lit et écrit les paramètres ?url=', () => {
    expect(readShareParams('?url=https%3A%2F%2Fa.fr&concurrent=b.fr&x=1')).toEqual({ url: 'https://a.fr', concurrent: 'b.fr' });
    expect(shareHref('https://repere.fr', '/outils/robots-ia', { url: 'https://a.fr/', vide: undefined })).toBe('https://repere.fr/outils/robots-ia?url=https%3A%2F%2Fa.fr%2F');
  });
  it('surligne les extraits sans chevauchement', () => {
    const text = 'Intro. Le déplacement coûte 49 € à Lyon. Fin du texte ici.';
    const seg = highlight(text, ['Le déplacement coûte 49 € à Lyon.', 'coûte 49 € à Lyon.', 'court']);
    expect(seg.filter((s) => s.mark).map((s) => s.text)).toEqual(['Le déplacement coûte 49 € à Lyon.']);
    expect(seg.map((s) => s.text).join('')).toBe(text);
  });
  it('convertit un texte collé en HTML et retour', () => {
    const html = textToHtml('Combien coûte une fuite ?\n\nUn dépannage coûte 49 €, déplacement compris.\n\n- Lyon\n- Villeurbanne');
    expect(html).toContain('<h1>Combien coûte une fuite ?</h1>');
    expect(html).toContain('<ul><li>Lyon</li><li>Villeurbanne</li></ul>');
    expect(textToHtml('<p>déjà <b>html</b></p>')).toBe('<p>déjà <b>html</b></p>');
    expect(textToHtml('a < b et c > d, voilà une phrase.')).toContain('&lt;');
    expect(htmlToText('<h1>Titre</h1><p>Prix&nbsp;: 49&#8239;€ l&rsquo;heure</p><script>x()</script>')).toBe('Titre\nPrix : 49 € l’heure');
  });
  it('trie les contrôles : à corriger d’abord, puis par points perdus', () => {
    const s = sortChecks([
      { id: 'a', status: 'ok' as const, points: 5, maxPoints: 5 },
      { id: 'b', status: 'warn' as const, points: 2, maxPoints: 4 },
      { id: 'c', status: 'fail' as const, points: 0, maxPoints: 3 },
      { id: 'd', status: 'fail' as const, points: 0, maxPoints: 10 },
    ]);
    expect(s.map((c) => c.id)).toEqual(['d', 'c', 'b', 'a']);
    expect(scoreBand(70).tone).toBe('ok');
    expect(scoreBand(39).tone).toBe('fail');
  });
});

describe('catalogue', () => {
  it('9 outils, slugs uniques, contenu SEO complet', () => {
    expect(TOOLS).toHaveLength(9);
    expect(new Set(TOOLS.map((t) => t.slug)).size).toBe(9);
    for (const t of TOOLS) {
      expect(t.faq.length, t.slug).toBe(5);
      expect(t.howItWorks.length).toBeGreaterThanOrEqual(3);
      expect(t.limits.length).toBeGreaterThan(0);
      expect(t.sources.every((s) => s.url.startsWith('https://'))).toBe(true);
      expect(t.metaTitle.length).toBeLessThanOrEqual(75);
      expect(t.description.length).toBeLessThanOrEqual(200);
      expect(toolPath(t.slug)).toBe(`/outils/${t.slug}`);
    }
    expect(() => getTool('inconnu' as never)).toThrow();
  });
  it('liens internes vers des outils existants', () => {
    const slugs = new Set(TOOLS.map((t) => toolPath(t.slug)));
    for (const t of TOOLS) for (const r of t.related) if (r.href.startsWith('/outils/')) expect(slugs.has(r.href), r.href).toBe(true);
  });
  it('pas de promesse de résultat', () => {
    const all = JSON.stringify(TOOLS).toLowerCase();
    for (const w of ['garanti d’être cité', 'première position', '100 % de réussite', 'boostez']) expect(all).not.toContain(w);
  });
});

describe('exemples fictifs (vraies fonctions d’analyse)', () => {
  it('readiness : score /100, contrôles, rendu, plafond éventuel', () => {
    const r = exampleReadiness();
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.checks.length).toBeGreaterThan(5);
    expect(r.render.words).toBeGreaterThan(20);
    expect(r.finalUrl).toContain('.example');
    expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  });
  it('robots : GPTBot bloqué (entraînement), recherche autorisée', () => {
    const r = exampleRobots();
    expect(r.bots.find((b) => b.token === 'GPTBot')?.status).toBe('blocked');
    expect(r.summary.searchBlocked).toEqual([]);
    expect(r.recommended.citeNoTraining).toContain('GPTBot');
  });
  it('citabilité : passed/total et disclaimer', () => {
    const r = exampleCitability();
    expect(r.total).toBeGreaterThan(0);
    expect(r.passed).toBeLessThanOrEqual(r.total);
    expect(r.disclaimer).toMatch(/pas une mesure/);
    expect(htmlToText(CITABILITY_SAMPLE_HTML)).toContain('Paysia');
  });
  it('comparateur, llms.txt, fiche produit, lien d’avis', () => {
    const c = exampleCompare();
    expect(c.rows.length).toBeGreaterThan(5);
    expect(c.disclaimer.length).toBeGreaterThan(10);
    const l = exampleLlms();
    expect(l.llmsTxt).toMatch(/^# Plomberie Martin/);
    expect(l.honest.points.length).toBeGreaterThan(2);
    const p = exampleProduct();
    expect(p.product.name).toBe('Shampoing solide « Onde »');
    expect(p.url).toContain('maison-sora.example');
    expect(p.product.price).toBe('12.90');
    expect(p.score).toBeLessThan(100);
    const rl = exampleReviewLink();
    expect(rl.reviewUrl).toContain(EXAMPLE_PLACE_ID);
  });
});
