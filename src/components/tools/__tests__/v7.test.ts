import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setFetchDeps, type Resolver, type Transport } from '@/lib/siteaudit/fetch';
import { resetRateLimit } from '@/lib/ratelimit';
import { POST } from '@/app/outils/api/[outil]/route';
import { GUIDES } from '@/lib/seo/guides';
import { TOOLS } from '../registry';
import { HUB_GROUPS, TOOL_ICON } from '../hub';
import type { PageFetch } from '../v6/analyze';
import { V7_SLUGS, V7_TOOLS } from '../v7/registry';
import { accessFor } from '../v7/access';
import { altKind, analyzeDuplicate, analyzeFreshness, analyzeHeadings, analyzeHttps, analyzeMobile, analyzeRich, mixedContent, pageResources } from '../v7/analyze';
import { UTM_PRESETS, buildFacts, buildUtm, ga4Channel, napConsistency, normAddress, normPhoneFr, parseJsonLdInput, richResults, sharedSentences, similarity } from '../v7/pure';
import * as EX from '../v7/examples';

const page = (url: string, html: string, headers: Record<string, string> = {}, extra: Partial<PageFetch> = {}): PageFetch => ({
  requestedUrl: url,
  finalUrl: url,
  status: 200,
  chain: [],
  headers: { 'content-type': 'text/html; charset=utf-8', ...headers },
  html,
  fetchMs: 10,
  ...extra,
});
const ids = (r: { checks: { id: string }[] }) => r.checks.map((c) => c.id);

/* ------------------------------------------------------------------ */
/* Calculs du navigateur                                               */
/* ------------------------------------------------------------------ */

describe('résultats enrichis Google', () => {
  it('prix mal formé, image absente, FAQ retirée, fil d’Ariane correct', () => {
    const r = richResults([
      { '@context': 'https://schema.org', '@type': 'Product', name: 'Théière', offers: { '@type': 'Offer', price: '59,00 €', priceCurrency: 'EUR' } },
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q ?', acceptedAnswer: { '@type': 'Answer', text: 'R.' } }] },
      { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://a.example/' }, { '@type': 'ListItem', position: 2, name: 'Théières' }] },
    ]);
    const by = Object.fromEntries(r.items.map((i) => [i.type, i]));
    expect(by.Product.status).toBe('incomplete');
    expect(by.Product.required).toContain('image');
    expect(by.Offer.status).toBe('invalid');
    expect(by.FAQPage.status).toBe('deprecated');
    expect(by.BreadcrumbList.status).toBe('eligible');
    expect(r.verdict.tone).toBe('fail');
  });
  it('sous-type local (Plumber) jugé avec les règles LocalBusiness ; avis sur sa propre fiche signalés', () => {
    const r = richResults([{ '@context': 'https://schema.org', '@type': 'Plumber', name: 'Martin', address: { '@type': 'PostalAddress', streetAddress: '1 rue', addressLocality: 'Lyon', postalCode: '69003' }, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.8, ratingCount: 12 } }]);
    expect(r.items[0].type).toMatch(/Plumber \(règles LocalBusiness\)/);
    expect(r.items[0].status).toBe('eligible');
    expect(ids(r).some((i) => i.endsWith('.self'))).toBe(true);
  });
  it('aucun bloc : ambre ; bloc illisible : rouge', () => {
    expect(richResults([]).verdict.tone).toBe('warn');
    expect(richResults([], ['Bloc n° 1 illisible']).verdict.tone).toBe('fail');
  });
  it('lit un bloc <script> collé, du JSON brut, et signale un texte sans JSON-LD', () => {
    expect(parseJsonLdInput(EX.RICH_SAMPLE).values).toHaveLength(1);
    expect(parseJsonLdInput('{"@type":"Thing"}').values).toHaveLength(1);
    expect(parseJsonLdInput('{"@type":').errors[0]).toMatch(/illisible/);
    expect(parseJsonLdInput('bonjour').errors[0]).toMatch(/Aucun JSON-LD/);
  });
});

describe('similarité de textes', () => {
  const a = 'Plomberie Martin intervient à Lyon pour tous vos travaux de plomberie et de chauffage. Devis écrit avant chaque intervention et pièces garanties deux ans.';
  it('identique : 100 ; sans rapport : 0 ; phrases communes repérées', () => {
    expect(similarity(a, a)).toBe(100);
    expect(similarity(a, 'Le salon de thé ouvre le dimanche matin avec des pâtisseries maison et du thé vert.')).toBe(0);
    expect(sharedSentences(a, `Autre début. ${a.split('. ')[1]}`)).toHaveLength(1);
  });
});

describe('cohérence NAP', () => {
  it('normalise abréviations, formes juridiques et +33', () => {
    expect(normAddress('12 Bd des Belges, 69006 Lyon')).toBe(normAddress('12 boulevard des Belges 69006 LYON'));
    expect(normPhoneFr('+33 (0)4 78 00 00 00')).toBe('0478000000');
  });
  it('exemple : numéro de rue et téléphone différents, nom en variante', () => {
    const r = napConsistency(EX.NAP_EXAMPLE.reference, EX.NAP_EXAMPLE.others);
    const by = Object.fromEntries(r.rows.map((x) => [x.source, x]));
    expect(by['Fiche Google']).toMatchObject({ name: 'same', address: 'same', phone: 'same' });
    expect(by['Pages Jaunes']).toMatchObject({ name: 'same', address: 'different' });
    expect(by['Pages Jaunes'].notes.join(' ')).toMatch(/numéro 21 au lieu de 12/);
    expect(by.Facebook).toMatchObject({ name: 'variant', phone: 'different' });
    expect(r.verdict.tone).toBe('fail');
  });
  it('fiches identiques : vert ; aucune fiche : ambre', () => {
    const ref = EX.NAP_EXAMPLE.reference;
    expect(napConsistency(ref, [{ ...ref, source: 'Google' }]).verdict.tone).toBe('ok');
    expect(napConsistency(ref, []).verdict.tone).toBe('warn');
  });
});

describe('générateur UTM', () => {
  it('construit le lien, garde les autres paramètres, remplace les utm_ existants', () => {
    const r = buildUtm({ url: 'https://a.example/contact?ref=x&utm_source=old#form', source: 'Google', medium: 'organic', campaign: 'fiche google' });
    expect(r.link).toBe('https://a.example/contact?ref=x&utm_source=google&utm_medium=organic&utm_campaign=fiche-google#form');
    expect(r.warnings.join(' ')).toMatch(/majuscules/);
    expect(r.warnings.join(' ')).toMatch(/espaces/);
    expect(r.warnings.join(' ')).toMatch(/déjà des paramètres/);
    expect(r.channel).toMatch(/Organic Search/);
  });
  it('erreurs : adresse invalide, source ou support absents', () => {
    const r = buildUtm({ url: 'pas une adresse', source: '', medium: '', campaign: '' });
    expect(r.link).toBeNull();
    expect(r.errors.length).toBeGreaterThanOrEqual(3);
    expect(r.verdict.tone).toBe('fail');
  });
  it('canaux GA4 estimés', () => {
    expect(ga4Channel('google', 'cpc')).toMatch(/Paid Search/);
    expect(ga4Channel('newsletter', 'email')).toMatch(/Email/);
    expect(ga4Channel('facebook', 'social')).toMatch(/Organic Social/);
    expect(ga4Channel('qr-code', 'print')).toMatch(/Unassigned/);
    expect(ga4Channel('annuaire', 'referral')).toMatch(/Referral/);
  });
  it('les modèles produisent tous un lien valide', () => {
    for (const p of UTM_PRESETS) expect(buildUtm({ url: 'https://a.example/', source: p.source, medium: p.medium, campaign: p.campaign }).link, p.id).toMatch(/utm_source=/);
  });
});

describe('fiche faits clés', () => {
  it('exemple : superlatif signalé, HTML échappé, Markdown structuré, date en français', () => {
    const r = buildFacts({ ...EX.FACTS_EXAMPLE, activity: 'Plombier <chauffagiste>' });
    expect(ids(r)).toContain('facts.superlative');
    expect(r.html).toContain('Plombier &lt;chauffagiste&gt;');
    expect(r.html).toContain('<time datetime="2026-11-15">15 novembre 2026</time>');
    expect(r.markdown).toContain('## Faits vérifiables');
    expect(r.verdict.tone).toBe('warn');
  });
  it('sans nom ni activité : rouge ; seuls les champs remplis apparaissent', () => {
    const empty = { name: '', activity: '', area: '', address: '', phone: '', hours: '', since: '', prices: '', facts: '', updated: '', site: '' };
    expect(buildFacts(empty).verdict.tone).toBe('fail');
    const r = buildFacts({ ...empty, name: 'Atelier', activity: 'Reliure' });
    expect(r.html).not.toContain('Horaires');
    expect(r.markdown).not.toContain('Téléphone');
  });
});

/* ------------------------------------------------------------------ */
/* Analyses sur pages fictives                                         */
/* ------------------------------------------------------------------ */

describe('analyses (sans réseau)', () => {
  it('structure des titres : H1 absent, saut de niveau, titre vide, répétition', () => {
    const r = analyzeHeadings(page('https://a.example/', '<body><h2>Nos services</h2><h4>Détail</h4><h2></h2><h2>Nos services</h2></body>'));
    expect(ids(r)).toEqual(expect.arrayContaining(['h1.missing', 'skip', 'empty', 'dup']));
    expect(r.verdict.tone).toBe('fail');
    const ok = analyzeHeadings(page('https://a.example/', '<title>X</title><body><h1>Plombier à Lyon</h1><h2>Combien coûte une fuite ?</h2><h3>Détail</h3><h2>Zone</h2></body>'));
    expect(ok.verdict.tone).toBe('ok');
    expect(ok.headings.some((h) => h.question)).toBe(true);
  });
  it('texte alternatif : absent, vide, nom de fichier, générique', () => {
    expect(altKind(undefined)).toBe('missing');
    expect(altKind('')).toBe('empty');
    expect(altKind('IMG_2034.jpg')).toBe('filename');
    expect(altKind('Photo')).toBe('generic');
    expect(altKind('Chauffe-eau posé dans un garage')).toBe('ok');
    const r = EX.exampleImages();
    expect(ids(r)).toEqual(expect.arrayContaining(['alt.missing', 'alt.link', 'alt.weak', 'broken']));
    expect(r.broken).toBe(1);
  });
  it('poids : image de plus de 1 Mo en rouge, ressources relevées sans doublon', () => {
    const r = EX.exampleWeight();
    expect(ids(r)).toContain('img.huge');
    expect(r.verdict.tone).toBe('fail');
    const rows = pageResources(page('https://a.example/', '<link rel="stylesheet" href="/a.css"><script src="/a.js"></script><script src="/a.js"></script><img src="data:image/png;base64,xx"><img src="/b.webp">'));
    expect(rows.map((x) => x.kind)).toEqual(['style', 'script', 'image']);
  });
  it('mobile : viewport absent en rouge ; exemple avec zoom bloqué, tableau large, numéro non cliquable', () => {
    expect(analyzeMobile(page('https://a.example/', '<html><head></head><body><p>x</p></body></html>')).verdict.tone).toBe('fail');
    const r = EX.exampleMobile();
    expect(ids(r)).toEqual(expect.arrayContaining(['viewport.ok', 'viewport.zoom', 'wide', 'tel', 'inputs', 'tap']));
  });
  it('HTTPS : contenu actif bloqué, passif signalé, http seul en rouge', () => {
    const mixed = mixedContent('<script src="http://x.example/a.js"></script><img src="http://x.example/a.png"><link rel="stylesheet" href="http://x.example/a.css">');
    expect(mixed.filter((m) => m.active)).toHaveLength(2);
    const r = EX.exampleHttps();
    expect(ids(r)).toEqual(expect.arrayContaining(['mixed.active', 'mixed.passive', 'http.redirect', 'hsts']));
    expect(analyzeHttps(page('http://a.example/', '<p>x</p>')).verdict.tone).toBe('fail');
  });
  it('doublons : pages ville presque identiques ; canonical commun adoucit', () => {
    const r = EX.exampleDuplicate();
    expect(r.similarity).toBeGreaterThanOrEqual(50);
    expect(r.shared.length).toBeGreaterThan(0);
    const t = '<main><p>' + 'Un texte assez long pour être comparé avec soin et sans hâte. '.repeat(12) + '</p></main>';
    const d = analyzeDuplicate(page('https://a.example/x', t), page('https://a.example/y', `<link rel="canonical" href="https://a.example/x">${t}`));
    expect(d.identical).toBe(true);
    expect(d.checks.find((c) => c.id === 'text.dup')?.status).toBe('warn');
  });
  it('fraîcheur : dates contradictoires, pied de page figé, tarifs d’une année passée, date future', () => {
    const r = EX.exampleFreshness();
    expect(ids(r)).toEqual(expect.arrayContaining(['mismatch', 'copyright', 'stale', 'lastmod.now', 'visible.ok']));
    const now = Date.parse('2026-11-15T00:00:00Z');
    const f = analyzeFreshness(page('https://a.example/', '<script type="application/ld+json">{"@type":"Article","dateModified":"2027-05-01"}</script><p>x</p>'), null, now);
    expect(f.verdict.tone).toBe('fail');
    expect(analyzeFreshness(page('https://a.example/', '<p>Sans date.</p>'), null, now).verdict.title).toMatch(/Rien n’indique/);
  });
  it('résultats enrichis sur une page', () => {
    const r = EX.exampleRich();
    expect(r.blocks).toBe(3);
    expect(r.items.find((i) => i.type === 'Offer')?.status).toBe('invalid');
    expect(analyzeRich(page('https://a.example/', '<div itemscope itemtype="https://schema.org/Restaurant"></div>')).microdata).toEqual(['Restaurant']);
  });
});

describe('site illisible (accessReport)', () => {
  const base = { requestedUrl: 'https://a.example/tarifs', finalUrl: 'https://a.example/tarifs', chain: [], fetchMs: 5 };
  it('page normale : aucun état', () => {
    expect(accessFor({ ...base, status: 200, headers: { 'content-type': 'text/html' }, html: '<title>T</title><body><h1>Tarifs</h1><p>Un texte lisible et assez long pour la page.</p></body>' })).toBeNull();
  });
  it('pare-feu Cloudflare : bloqué, marche à suivre, « la page » et non « la page d’accueil »', () => {
    const a = accessFor({ ...base, status: 403, headers: { 'content-type': 'text/html', server: 'cloudflare' }, html: '<title>Just a moment...</title>' })!;
    expect(a.state).toBe('blocked_firewall');
    expect(a.blocked).toBe(true);
    expect(a.howTo.join(' ')).toMatch(/Cloudflare/);
    expect(a.message).not.toMatch(/page d’accueil/);
  });
  it('robots.txt, délai, erreur serveur', () => {
    expect(accessFor({ ...base, status: 0, headers: {}, html: null, blockedByRobots: true, errorCode: 'robots_disallowed', robots: { url: 'https://a.example/robots.txt', status: 200, text: 'User-agent: *\nDisallow: /' } })!.state).toBe('blocked_robots');
    expect(accessFor({ ...base, status: 0, headers: {}, html: null, errorCode: 'timeout', error: 'délai dépassé' })!.state).toBe('timeout');
    expect(accessFor({ ...base, status: 500, headers: { 'content-type': 'text/html' }, html: '<p>Erreur</p>' })!.state).toBe('server_error');
  });
  it('un analyseur ne calcule rien sur une page bloquée', () => {
    const a = accessFor({ ...base, status: 503, headers: { 'content-type': 'text/html', 'retry-after': '120' }, html: '<title>Site en maintenance</title>' })!;
    const r = analyzeHeadings(page(base.requestedUrl, '', {}, { status: 503 }), a);
    expect(r.access?.blocked).toBe(true);
    expect(r.headings).toHaveLength(0);
    expect(r.checks).toHaveLength(1);
    expect(r.verdict.tone).toBe('fail');
  });
});

/* ------------------------------------------------------------------ */
/* Réseau simulé : aucune sortie sur Internet                          */
/* ------------------------------------------------------------------ */

type Fake = { status: number; headers?: Record<string, string>; body?: string };
let restore: () => void = () => {};
const seen: string[] = [];
function fakeWeb(routes: Record<string, Fake>) {
  const resolver: Resolver = async (h) => (h.endsWith('.prive.example') ? [{ address: '10.0.0.5', family: 4 }] : [{ address: '93.184.216.34', family: 4 }]);
  const transport: Transport = async (req) => {
    const key = req.url.toString();
    seen.push(`${req.method ?? 'GET'} ${key}`);
    const r = routes[key] ?? { status: 404, body: 'introuvable' };
    return { status: r.status, headers: { 'content-type': 'text/html; charset=utf-8', ...(r.headers ?? {}) }, body: Buffer.from(req.method === 'HEAD' ? '' : (r.body ?? '')), truncated: false };
  };
  restore = setFetchDeps({ resolver, transport });
}
const call = (outil: string, body: unknown, ip = '198.51.100.77') =>
  POST(new Request(`http://localhost/outils/api/${outil}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }), { params: Promise.resolve({ outil }) });

describe('endpoints V7 (réseau simulé)', () => {
  beforeEach(() => {
    seen.length = 0;
    resetRateLimit();
  });
  afterEach(() => restore());
  const HOME = '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Accueil</title></head><body><main><h1>Plombier à Lyon</h1><p>Un texte de présentation assez long pour être lu.</p><img src="/a.jpg" alt="Chantier"><img src="/b.jpg"></main></body></html>';

  it('titres, mobile, fraîcheur, résultats enrichis : 200 avec un verdict', async () => {
    fakeWeb({ 'https://v.example/': { status: 200, body: HOME } });
    for (const o of ['titres', 'mobile', 'fraicheur', 'resultats-enrichis']) {
      const res = await call(o, { url: 'v.example' });
      expect(res.status, o).toBe(200);
      const j = (await res.json()) as { data: { verdict: { tone: string }; access?: unknown } };
      expect(j.data.verdict.tone, o).toMatch(/ok|warn|fail/);
      expect(j.data.access, o).toBeUndefined();
    }
  });
  it('images : HEAD sur chaque image, image 404 comptée cassée', async () => {
    fakeWeb({ 'https://v.example/': { status: 200, body: HOME }, 'https://v.example/a.jpg': { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': '1200' } } });
    const j = (await (await call('images', { url: 'https://v.example/' })).json()) as { data: { broken: number; missing: number; checked: number } };
    expect(j.data).toMatchObject({ broken: 1, missing: 1, checked: 2 });
    expect(seen).toContain('HEAD https://v.example/a.jpg');
  });
  it('poids : taille annoncée par Content-Length', async () => {
    fakeWeb({ 'https://v.example/': { status: 200, body: HOME }, 'https://v.example/a.jpg': { status: 200, headers: { 'content-type': 'image/jpeg', 'content-length': String(1_500_000) } } });
    const j = (await (await call('poids', { url: 'https://v.example/' })).json()) as { data: { totalKnown: number; checks: { id: string }[] } };
    expect(j.data.totalKnown).toBeGreaterThan(1_500_000);
    expect(j.data.checks.map((c) => c.id)).toContain('img.huge');
  });
  it('HTTPS : la version http redirige vers https', async () => {
    fakeWeb({ 'https://v.example/': { status: 200, body: HOME, headers: { 'strict-transport-security': 'max-age=31536000' } }, 'http://v.example/': { status: 301, headers: { location: 'https://v.example/' } } });
    const j = (await (await call('https', { url: 'https://v.example/' })).json()) as { data: { httpRedirect: { toHttps: boolean }; hsts: string } };
    expect(j.data.httpRedirect.toHttps).toBe(true);
    expect(j.data.hsts).toMatch(/max-age/);
  });
  it('doublons : deux adresses, corps sans url2 refusé', async () => {
    fakeWeb({ 'https://v.example/a': { status: 200, body: HOME }, 'https://v.example/b': { status: 200, body: HOME } });
    const j = (await (await call('doublons', { url: 'https://v.example/a', url2: 'https://v.example/b' })).json()) as { data: { identical: boolean; similarity: number } };
    expect(j.data).toMatchObject({ identical: true, similarity: 100 });
    expect((await call('doublons', { url: 'https://v.example/a' })).status).toBe(400);
  });
  it('site qui bloque RepereBot (robots.txt) : rapport d’accès, pas d’erreur', async () => {
    fakeWeb({ 'https://w.example/robots.txt': { status: 200, headers: { 'content-type': 'text/plain' }, body: 'User-agent: RepereBot\nDisallow: /\n' }, 'https://w.example/': { status: 200, body: HOME } });
    const res = await call('titres', { url: 'https://w.example/' });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data: { access: { state: string; blocked: boolean; howTo: string[] }; headings: unknown[] } };
    expect(j.data.access).toMatchObject({ state: 'blocked_robots', blocked: true });
    expect(j.data.access.howTo.join(' ')).toMatch(/RepereBot/);
    expect(j.data.headings).toHaveLength(0);
    expect(seen).not.toContain('GET https://w.example/');
  });
  it('pare-feu (403 Cloudflare) : rapport d’accès bloqué', async () => {
    fakeWeb({ 'https://x.example/': { status: 403, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' }, body: '<title>Just a moment...</title>' } });
    const j = (await (await call('mobile', { url: 'https://x.example/' })).json()) as { data: { access: { state: string } } };
    expect(j.data.access.state).toBe('blocked_firewall');
  });
  it('adresse privée : 400 (anti-SSRF) ; limite par IP : 429 au-delà de 10 doublons par heure', async () => {
    fakeWeb({ 'https://v.example/a': { status: 200, body: HOME }, 'https://v.example/b': { status: 200, body: HOME } });
    const priv = await call('titres', { url: 'https://site.prive.example/' });
    expect(priv.status).toBe(400);
    for (let i = 0; i < 10; i++) expect((await call('doublons', { url: 'https://v.example/a', url2: 'https://v.example/b' }, '203.0.113.71')).status).toBe(200);
    expect((await call('doublons', { url: 'https://v.example/a', url2: 'https://v.example/b' }, '203.0.113.71')).status).toBe(429);
  });
});

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

describe('catalogue V7', () => {
  it('11 outils, contenu complet, 2 guides existants au moins, lien vers /analyse, rangés dans le hub', () => {
    expect(V7_SLUGS).toHaveLength(11);
    expect(V7_TOOLS.map((t) => t.slug)).toEqual([...V7_SLUGS]);
    const guides = new Set(GUIDES.map((g) => `/guides/${g.slug}`));
    const grouped = HUB_GROUPS.flatMap((g) => g.slugs);
    expect(new Set(grouped)).toEqual(new Set(TOOLS.map((t) => t.slug)));
    expect(grouped).toHaveLength(TOOLS.length);
    for (const t of V7_TOOLS) {
      expect(t.faq.length, t.slug).toBeGreaterThanOrEqual(4);
      expect(t.howItWorks.length, t.slug).toBe(3);
      expect(t.sources.length, t.slug).toBeGreaterThan(0);
      expect(t.related.some((r) => r.href === '/analyse'), t.slug).toBe(true);
      const g = t.related.filter((r) => r.href.startsWith('/guides/'));
      expect(g.length, t.slug).toBeGreaterThanOrEqual(2);
      for (const r of g) expect(guides.has(r.href), r.href).toBe(true);
      expect(t.metaTitle.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.description.length, t.slug).toBeLessThanOrEqual(200);
      expect(TOOL_ICON[t.slug], t.slug).toBeTruthy();
      expect(`${t.h1} ${t.lead}`).not.toMatch(/garanti|n° ?1|explosez|boostez/i);
    }
  });
  it('exemples calculés sur des domaines fictifs (.example), à date fixe', () => {
    const all = [EX.exampleHeadings(), EX.exampleImages(), EX.exampleWeight(), EX.exampleMobile(), EX.exampleHttps(), EX.exampleFreshness(), EX.exampleRich(), EX.exampleDuplicate()];
    for (const r of all) {
      expect(r.url).toMatch(/\.example\//);
      expect(r.verdict.title.length).toBeGreaterThan(10);
      expect(r.checks.length).toBeGreaterThan(0);
      expect(r.checkedAt).toBe('2026-11-15T09:00:00.000Z');
    }
    for (const e of [EX.NAP_EXAMPLE.reference, ...EX.NAP_EXAMPLE.others]) expect(e.name).toMatch(/Martin/);
    expect(EX.UTM_EXAMPLE.url).toMatch(/\.example\//);
    expect(EX.FACTS_EXAMPLE.site).toMatch(/\.example\//);
  });
});
