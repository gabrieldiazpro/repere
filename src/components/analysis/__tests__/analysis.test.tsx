import { describe, expect, it, vi } from 'vitest';
vi.mock('../analysis.module.css', () => ({ default: new Proxy({}, { get: (_t, k) => String(k) }) }));
import { renderToStaticMarkup } from 'react-dom/server';
import type { Finding } from '@/lib/crawl/types';
import type { FullAnalysis } from '@/lib/analysis/types';
import { initialLive, readNdjson, reduceLive, startAnalysis, waitLabel, type RouteLine } from '../stream';
import { diagnose, hasAutoFix, partialNotes, scoreTone, seconds, clock, signupHref, sortedSections } from '../format';
import { layoutMap } from '../mapLayout';
import { resolveAnalysisPrefill } from '../prefill';
import { AnalysisReport } from '../AnalysisReport';
import { LiveAnalysis } from '../LiveAnalysis';
import { AnalysisApp } from '../AnalysisApp';
import { QuickAuditForm } from '@/components/motion/QuickAuditForm';

const finding = (id: string, over: Partial<Finding> = {}): Finding => ({
  id,
  category: 'contenu',
  severity: 'high',
  title: `Constat ${id}`,
  why: 'Parce que.',
  fix: 'Faites ceci.',
  affected: [{ url: 'https://ex.test/a' }, { url: 'https://ex.test/b' }],
  affectedCount: 2,
  impact: 3,
  effort: 1,
  ...over,
});

function fixture(over: Partial<FullAnalysis> = {}): FullAnalysis {
  const f1 = finding('seo.title.missing', { title: '5 pages n’ont pas de titre' });
  const f2 = finding('geo.entite.no_contact', { title: 'Aucun téléphone lisible', severity: 'medium' });
  return {
    id: 'an_test123',
    version: 1,
    input: { url: 'https://ex.test/' },
    detected: { brand: 'Atelier Test', siteType: 'local', city: 'Nantes', sources: { brand: 'JSON-LD', siteType: 'JSON-LD' } },
    createdAt: '2026-11-13T10:00:00.000Z',
    durationMs: 41_200,
    crawl: { startUrl: 'https://ex.test/', finalOrigin: 'https://ex.test', pagesFetched: 30, pagesIndexable: 28, sitemapUrls: 30, robotsFound: true, durationMs: 20_000, truncated: false, errors: 0 },
    seo: { score: 55, sections: [{ id: 'contenu', label: 'Balises et contenu', score: 45, findings: [f1] }, { id: 'liens', label: 'Liens', score: 100, findings: [] }], topFixes: [f1] },
    geo: { score: 70, sections: [{ id: 'entite', label: 'Identité', score: 54, findings: [f2] }], topFixes: [f2] },
    data: { pagespeed: null, note: 'Mesure de vitesse non disponible : le fournisseur PageSpeed n’est pas configuré. Aucune valeur n’est estimée.' },
    ai: {
      demo: true,
      providers: ['chatgpt', 'gemini'],
      questions: [{ id: 'q1', text: 'Quel luminaire à Nantes ?', asked: 6, mentioned: 1, competitors: ['Maison A', 'Maison B'] }],
      score: 44,
      range: { low: 34, high: 53 },
      mentionRate: 0.3,
      calls: 0,
      topCompetitors: ['Maison A'],
      note: 'Démonstration : aucune IA n’est configurée sur ce serveur, ces réponses sont simulées et ne mesurent rien.',
    },
    verdict: 'Atelier Test : un socle correct mais perfectible (62/100).',
    scores: { seo: 55, geo: 70, global: 62 },
    priorities: [
      { ...f1, source: 'seo', priority: 9 },
      { ...f2, source: 'geo', priority: 6 },
    ],
    autoFixes: [{ findingId: 'seo.title.missing', kind: 'meta.title', title: f1.title, source: 'seo' }],
    modules: {
      detect: { status: 'ok', ms: 300 },
      crawl: { status: 'ok', ms: 20_000 },
      seo: { status: 'ok', ms: 200 },
      geo: { status: 'ok', ms: 200 },
      data: { status: 'skipped', ms: 100, error: 'non configuré' },
      ai: { status: 'ok', ms: 900 },
    },
    partial: false,
    demo: true,
    ...over,
  };
}

const ev = (seq: number, t: number, body: Record<string, unknown>) => ({ seq, t, ...body }) as unknown as RouteLine;

describe('flux de l’analyse', () => {
  it('reconstitue l’état vivant à partir des vrais événements', () => {
    const a = fixture();
    const lines: RouteLine[] = [
      ev(1, 1, { type: 'start', id: a.id, url: 'https://ex.test/', budgetMs: 58_000 }),
      ev(2, 300, { type: 'detected', detection: a.detected }),
      ev(3, 310, { type: 'step', step: 'crawl', status: 'running', label: 'Exploration du site' }),
      ev(4, 500, { type: 'crawl', phase: 'pages', fetched: 3, queued: 9, currentUrl: 'https://ex.test/produits/a' }),
      ev(5, 700, { type: 'crawl', phase: 'pages', fetched: 6, queued: 6, currentUrl: 'https://ex.test/blog/b', urls: ['https://ex.test/contact', 'https://ex.test/produits/a', 'https://ex.test/blog/b'] }),
      ev(6, 800, { type: 'finding', source: 'seo', id: 'seo.title.missing', title: '5 pages sans titre', severity: 'high' }),
      ev(7, 810, { type: 'finding', source: 'seo', id: 'seo.title.missing', title: 'doublon ignoré', severity: 'high' }),
      ev(8, 900, { type: 'ai', done: 2, total: 12, provider: 'chatgpt' }),
      ev(9, 950, { type: 'score', module: 'seo', score: 55 }),
      ev(10, 41_200, { type: 'result', analysis: a }),
      { type: 'saved', id: a.id, url: 'http://x/analyse/an_test123?t=abc', token: 'abc' },
    ];
    const s = lines.reduce(reduceLive, initialLive());
    expect(s.phase).toBe('done');
    expect(s.detection?.brand).toBe('Atelier Test');
    expect(s.crawl.fetched).toBe(6);
    expect(s.crawl.urls).toEqual(['https://ex.test/', 'https://ex.test/produits/a', 'https://ex.test/contact', 'https://ex.test/blog/b']);
    expect(s.findings).toHaveLength(1);
    expect(s.ai).toMatchObject({ done: 2, total: 12, providers: ['chatgpt'] });
    expect(s.scores.seo).toBe(55);
    expect(s.saved).toEqual({ id: a.id, token: 'abc' });
    expect(s.t).toBe(41_200);
  });

  it('une erreur avant le résultat arrête l’analyse ; après, le rapport reste', () => {
    const before = reduceLive(initialLive(), { type: 'error', message: 'Adresse invalide.' });
    expect(before.phase).toBe('error');
    const after = reduceLive(reduceLive(initialLive(), ev(1, 5, { type: 'result', analysis: fixture() })), { type: 'error', message: 'Lien non enregistré.' });
    expect(after.phase).toBe('done');
    expect(after.error).toBe('Lien non enregistré.');
  });

  it('lit le NDJSON même découpé au milieu des lignes', async () => {
    const enc = new TextEncoder();
    const chunks = ['{"type":"start","id":"x","url":"https://a.test/","budgetMs":1,"seq":1,"t":0}\n{"type":"cra', 'wl","fetched":2,"queued":1,"phase":"pages","seq":2,"t":5}\nnon json\n', '{"type":"cached","id":"x","at":"2026-11-13"}'];
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        for (const x of chunks) c.enqueue(enc.encode(x));
        c.close();
      },
    });
    const out: string[] = [];
    for await (const l of readNdjson(body)) out.push(l.type);
    expect(out).toEqual(['start', 'crawl', 'cached']);
  });

  it('limite de débit : message lisible et délai d’attente', async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ error: 'Vous avez lancé plusieurs analyses récemment. Réessayez un peu plus tard.' }), {
        status: 429,
        headers: { 'content-type': 'application/json', 'retry-after': '1500' },
      })) as unknown as typeof fetch;
    const r = await startAnalysis({ url: 'a.fr', pro: true }, () => {}, { fetchImpl: fake });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(429);
      expect(r.retryAfterS).toBe(1500);
      expect(waitLabel(r.retryAfterS!)).toBe('dans 25 min');
    }
  });

  it('erreur de champ (400) : renvoie les champs fautifs', async () => {
    const fake = (async () => Response.json({ error: 'Repéré est réservé aux professionnels', fields: { pro: 'Repéré est réservé aux professionnels' } }, { status: 400 })) as unknown as typeof fetch;
    const r = await startAnalysis({ url: 'a.fr', pro: true }, () => {}, { fetchImpl: fake });
    expect(r.ok === false && r.fields?.pro).toBeTruthy();
  });

  it('flux réussi : chaque ligne est transmise', async () => {
    const body = ['{"type":"start","id":"x","url":"https://a.test/","budgetMs":1,"seq":1,"t":0}', '{"type":"saved","id":"x","url":"u","token":"t"}'].join('\n') + '\n';
    const fake = (async () => new Response(body, { status: 200, headers: { 'content-type': 'application/x-ndjson; charset=utf-8' } })) as unknown as typeof fetch;
    const got: string[] = [];
    const r = await startAnalysis({ url: 'a.fr', pro: true }, (l) => got.push(l.type), { fetchImpl: fake });
    expect(r.ok).toBe(true);
    expect(got).toEqual(['start', 'saved']);
  });
});

describe('diagnostics et libellés', () => {
  it('site injoignable, robots.txt bloquant, ou rien', () => {
    expect(diagnose(fixture())).toBeNull();
    const down = fixture({
      crawl: { ...fixture().crawl!, pagesFetched: 0, pagesIndexable: 0, robotsFound: false },
      modules: { ...fixture().modules, detect: { status: 'failed', ms: 1, error: 'page d’accueil injoignable' }, crawl: { status: 'failed', ms: 1, error: 'aucune page récupérée' } },
      seo: null,
      geo: null,
    });
    expect(diagnose(down)).toEqual({ kind: 'unreachable', host: 'ex.test' });
    const blocked = fixture({
      crawl: { ...fixture().crawl!, pagesFetched: 1, pagesIndexable: 0 },
      modules: { ...fixture().modules, detect: { status: 'failed', ms: 1, error: 'page d’accueil injoignable' } },
    });
    expect(diagnose(blocked)?.kind).toBe('robots');
  });

  it('résultat partiel expliqué', () => {
    const a = fixture({ partial: true, crawl: { ...fixture().crawl!, truncated: true }, modules: { ...fixture().modules, geo: { status: 'timeout', ms: 5, error: 'délai dépassé' } } });
    const notes = partialNotes(a);
    expect(notes.some((n) => /audit IA/.test(n))).toBe(true);
    expect(notes.some((n) => /30 premières pages/.test(n))).toBe(true);
  });

  it('tons, durées, sections, correction automatique, inscription', () => {
    expect([scoreTone(20), scoreTone(55), scoreTone(80), scoreTone(null)]).toEqual(['down', 'warn', 'up', 'neutral']);
    expect(seconds(41_200)).toBe('41 s');
    expect(seconds(64_000)).toBe('1 min 04 s');
    expect(clock(23_900)).toBe('00:23');
    const a = fixture();
    expect(sortedSections(a.seo)[0].id).toBe('contenu');
    expect(hasAutoFix(a, a.priorities[0])).toBe(true);
    expect(hasAutoFix(a, a.priorities[1])).toBe(false);
    expect(signupHref(a)).toBe('/inscription?parcours=local&analyse=an_test123&site=https%3A%2F%2Fex.test&nom=Atelier+Test');
  });

  it('carte du site : un point placé ne bouge plus quand d’autres arrivent', () => {
    const u = (p: string) => `https://ex.test${p}`;
    const a = layoutMap([u('/'), u('/produits/a'), u('/blog/x')]);
    const b = layoutMap([u('/'), u('/produits/a'), u('/blog/x'), u('/produits/b'), u('/contact'), u('/blog/y')]);
    for (const n of a) expect(b.find((m) => m.id === n.id)).toEqual(n);
    expect(b.filter((n) => n.level === 1).map((n) => n.id)).toEqual(['/produits', '/blog', '/contact']);
    for (const n of b) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(0);
    }
  });

  it('pré-remplissage depuis l’accueil', () => {
    expect(resolveAnalysisPrefill({ site: 'maboutique.fr', segment: 'e-commerce' })).toEqual({ site: 'maboutique.fr', siteType: 'ecommerce' });
    expect(resolveAnalysisPrefill({ nom: 'Plomberie Martin', segment: 'local', ville: 'Lyon' })).toEqual({ name: 'Plomberie Martin', siteType: 'local', city: 'Lyon' });
  });
});

describe('rendu', () => {
  it('rapport : verdict, scores, priorités avec pourquoi / quoi faire, badge Repéré, démo étiquetée, appel principal', () => {
    const html = renderToStaticMarkup(<AnalysisReport analysis={fixture()} shareUrl="/analyse/an_test123?t=abc" />);
    expect(html).toContain('<h1 id="verdict"');
    expect(html).toContain('Atelier Test : un socle correct');
    expect(html).toContain('Google : 55 sur 100');
    expect(html).toContain('Global : 62 sur 100');
    expect(html).toContain('Pourquoi c’est important');
    expect(html).toContain('Quoi faire');
    expect(html.match(/Repéré peut le faire pour vous/g)?.length).toBe(2); // priorité + détail
    expect(html).toContain('Démonstration');
    expect(html).toContain('Corriger avec Repéré');
    expect(html).toContain('href="/inscription?parcours=local&amp;analyse=an_test123');
    expect(html).toContain('Partager le rapport');
    expect(html).toContain('PageSpeed n’est pas configuré');
    expect(html).toContain('Quel luminaire à Nantes ?');
  });

  it('rapport : robots.txt bloquant → explique comment autoriser RepereBot', () => {
    const blocked = fixture({ crawl: { ...fixture().crawl!, pagesFetched: 1, pagesIndexable: 0 }, modules: { ...fixture().modules, detect: { status: 'failed', ms: 1, error: 'page d’accueil injoignable' } } });
    const html = renderToStaticMarkup(<AnalysisReport analysis={blocked} />);
    expect(html).toContain('User-agent: RepereBot');
    expect(html).not.toContain('Partager le rapport');
  });

  it('écran vivant : compteur, constats, IA, étapes', () => {
    let s = initialLive();
    for (const l of [
      ev(1, 1, { type: 'start', id: 'x', url: 'https://ex.test/', budgetMs: 58_000 }),
      ev(2, 2, { type: 'detected', detection: fixture().detected }),
      ev(3, 3, { type: 'crawl', phase: 'pages', fetched: 12, queued: 4, currentUrl: 'https://ex.test/produits/a' }),
      ev(4, 4, { type: 'finding', source: 'geo', id: 'geo.acces.gptbot', title: 'GPTBot bloqué', severity: 'medium' }),
      ev(5, 5, { type: 'ai', done: 3, total: 12, provider: 'perplexity' }),
    ])
      s = reduceLive(s, l);
    const html = renderToStaticMarkup(<LiveAnalysis live={s} elapsedMs={23_400} onCorrect={() => {}} onCancel={() => {}} />);
    expect(html).toContain('Analyse de ex.test');
    expect(html).toContain('>12<');
    expect(html).toContain('GPTBot bloqué');
    expect(html).toContain('00:23');
    expect(html).toContain('Perplexity');
    expect(html).toContain('Atelier Test');
  });

  it('formulaire : un champ, case professionnelle obligatoire, e-mail facultatif', () => {
    const html = renderToStaticMarkup(<AnalysisApp prefill={{ site: 'maboutique.fr' }} />);
    expect(html).toContain('<h1');
    expect(html).toContain('value="maboutique.fr"');
    expect(html).toContain('J’agis pour les besoins de mon activité professionnelle');
    expect(html).toContain('type="email"');
  });

  it('formulaire de l’accueil : sans JavaScript, part vers /audit par nom', () => {
    const html = renderToStaticMarkup(<QuickAuditForm segment="local" idPrefix="t" />);
    expect(html).toContain('action="/audit"');
    expect(html).toContain('name="nom"');
  });
});
