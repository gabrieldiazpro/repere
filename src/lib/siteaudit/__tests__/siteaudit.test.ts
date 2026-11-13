import { afterEach, describe, expect, it } from 'vitest';
import { decide, parseRobots, patternMatches } from '../robots';
import { robotsReportFromText, analyzeRobots } from '../robotsAudit';
import { USER_AGENT, SafeFetchError, isBlockedIp, normalizeInputUrl, resetFetchState, safeFetch, setFetchDeps } from '../fetch';
import { auditReadiness, readinessFromSnapshot } from '../readiness';
import { citabilityFromHtml } from '../citability';
import { productFromHtml } from '../product';
import { generateJsonLd, validateJsonLdText, validateJsonLdValue } from '../jsonld';
import { buildLlmsTxt, generateLlms, validateLlmsTxt } from '../llms';
import { compareSites } from '../compare';
import { buildReviewLink, extractPlaceId } from '../reviewLink';
import { BAD_PAGE, GOOD_PAGE, PRODUCT_FULL, PRODUCT_POOR, ROBOTS_BLOCK_SEARCH, ROBOTS_OPEN, SITEMAP, SPA_PAGE, fakeNet } from './fixtures';

const SITE = 'https://plomberie-exemple.fr';

afterEach(() => resetFetchState());

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof SafeFetchError ? e.code : `autre:${(e as Error).message}`;
  }
};

/* ------------------------------------------------------------------ */
describe('robots.txt (RFC 9309)', () => {
  it('fusionne les groupes, applique la règle la plus longue et Allow à égalité', () => {
    const p = parseRobots('User-agent: a\nDisallow: /x\n\nUser-agent: b\nUser-agent: a\nAllow: /x/ok\n\nUser-agent: *\nDisallow: /\n');
    expect(decide(p, 'a', '/x/ok/page').allowed).toBe(true);
    expect(decide(p, 'a', '/x/no').allowed).toBe(false);
    expect(decide(p, 'b', '/x/no').allowed).toBe(true); // b n'a que Allow
    expect(decide(p, 'zz', '/').allowed).toBe(false); // groupe *
    const t = parseRobots('User-agent: *\nDisallow: /page\nAllow: /page\n');
    expect(decide(t, 'x', '/page').allowed).toBe(true);
  });
  it('gère les jokers * et $, et /robots.txt toujours permis', () => {
    expect(patternMatches('/*.pdf$', '/docs/a.pdf')).toBe(true);
    expect(patternMatches('/*.pdf$', '/docs/a.pdf?x=1')).toBe(false);
    expect(patternMatches('/fish*', '/fishheads')).toBe(true);
    expect(patternMatches('/fish', '/Fish')).toBe(false);
    const p = parseRobots('User-agent: *\nDisallow: /\n');
    expect(decide(p, 'GPTBot', '/robots.txt').allowed).toBe(true);
  });
  it('jeton produit insensible à la casse et version ignorée', () => {
    const p = parseRobots('User-agent: gptbot/1.1\nDisallow: /\n');
    expect(decide(p, 'GPTBot', '/').allowed).toBe(false);
  });
  it('verdicts par robot : recherche bloquée = critique, entraînement bloqué = choix légitime', () => {
    const r = robotsReportFromText(`${SITE}/`, ROBOTS_BLOCK_SEARCH, 200, ['/', '/admin/x']);
    const by = (t: string) => r.bots.find((b) => b.token === t)!;
    expect(by('OAI-SearchBot').status).toBe('blocked');
    expect(by('OAI-SearchBot').severity).toBe('critical');
    expect(by('OAI-SearchBot').line).toBe(2);
    expect(by('GPTBot').severity).toBe('info');
    expect(by('CCBot').status).toBe('blocked');
    expect(by('PerplexityBot').status).toBe('not_mentioned');
    expect(by('PerplexityBot').blockedPaths).toContain('/admin/');
    expect(r.summary.searchBlocked).toEqual(['OAI-SearchBot']);
    expect(r.sitemaps).toEqual([`${SITE}/sitemap.xml`]);
    expect(r.recommended.citeNoTraining).toContain('User-agent: GPTBot\n');
  });
  it('robots.txt en erreur 5xx : tout est considéré interdit', () => {
    const r = robotsReportFromText(`${SITE}/`, null, 503);
    expect(r.unreachable).toBe(true);
    expect(r.bots.every((b) => b.status === 'blocked')).toBe(true);
  });
  it('robots.txt absent (404) : tout est permis', () => {
    const r = robotsReportFromText(`${SITE}/`, null, 404);
    expect(r.bots.every((b) => b.status === 'not_mentioned')).toBe(true);
  });
  it('analyzeRobots traite une page HTML servie à la place du fichier comme une absence', async () => {
    const net = fakeNet({ [`${SITE}/robots.txt`]: { body: '<!doctype html><html><body>Accueil</body></html>' } });
    const r = await analyzeRobots(SITE, net);
    expect(r.found).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
describe('anti-SSRF', () => {
  it('refuse les adresses privées, de bouclage, lien local, métadonnées, IPv6 internes', () => {
    for (const ip of ['10.0.0.1', '127.0.0.1', '169.254.169.254', '172.16.5.4', '192.168.1.1', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00:ec2::254', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:a9fe:a9fe', '64:ff9b::a9fe:a9fe', '2002:7f00:1::1', 'ff02::1', '2001:db8::1', 'abc'])
      expect([ip, isBlockedIp(ip)]).toEqual([ip, true]);
    for (const ip of ['93.184.216.34', '8.8.8.8', '2606:4700:4700::1111', '::ffff:93.184.216.34']) expect([ip, isBlockedIp(ip)]).toEqual([ip, false]);
  });
  it('refuse schémas, ports, identifiants, hôtes internes et formes numériques détournées', () => {
    const c = (u: string) => {
      try {
        normalizeInputUrl(u);
        return 'ok';
      } catch (e) {
        return (e as SafeFetchError).code;
      }
    };
    expect(c('ftp://exemple.fr')).toBe('blocked_scheme');
    expect(c('file:///etc/passwd')).toBe('blocked_scheme');
    expect(c('https://exemple.fr:8080/')).toBe('blocked_port');
    expect(c('https://u:p@exemple.fr/')).toBe('blocked_credentials');
    expect(c('http://localhost/')).toBe('blocked_host');
    expect(c('http://metadata.google.internal/')).toBe('blocked_host');
    expect(c('http://2130706433/')).toBe('blocked_ip');
    expect(c('http://0x7f.1/')).toBe('blocked_ip');
    expect(c('http://[::1]/')).toBe('blocked_ip');
    expect(c('http://[::ffff:169.254.169.254]/')).toBe('blocked_ip');
    expect(c('exemple.fr')).toBe('ok');
    expect(normalizeInputUrl('exemple.fr').toString()).toBe('https://exemple.fr/');
  });
  it('refuse un nom de domaine qui résout vers une IP privée (même une seule des adresses)', async () => {
    const net = fakeNet({}, { 'interne.test': '10.1.2.3', 'mixte.test': ['93.184.216.34', '192.168.0.10'] });
    expect(await code(safeFetch('https://interne.test/', net))).toBe('blocked_ip');
    expect(await code(safeFetch('https://mixte.test/', net))).toBe('blocked_ip');
  });
  it('revalide chaque redirection : vers 169.254.169.254, vers un hôte privé, vers un port interdit', async () => {
    const net = fakeNet(
      {
        'https://a.test/': { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } },
        'https://b.test/': { status: 301, headers: { location: 'https://interne.test/' } },
        'https://c.test/': { status: 302, headers: { location: 'http://c.test:6379/' } },
        'https://d.test/': { status: 302, headers: { location: 'http://[::1]/' } },
      },
      { 'interne.test': '127.0.0.1' },
    );
    expect(await code(safeFetch('https://a.test/', net))).toBe('blocked_ip');
    expect(await code(safeFetch('https://b.test/', net))).toBe('blocked_ip');
    expect(await code(safeFetch('https://c.test/', net))).toBe('blocked_port');
    expect(await code(safeFetch('https://d.test/', net))).toBe('blocked_ip');
    expect(net.calls.some((c) => c.address.address === '169.254.169.254' || c.address.address === '127.0.0.1')).toBe(false);
  });
  it('DNS rebinding simulé : la connexion se fait sur l’adresse validée (épinglage)', async () => {
    let n = 0;
    const net = fakeNet({ 'https://rebind.test/': { body: '<html><body>ok</body></html>' } });
    const resolver = async () => {
      n++;
      return [{ address: n === 1 ? '93.184.216.34' : '127.0.0.1', family: 4 as const }];
    };
    const res = await safeFetch('https://rebind.test/', { transport: net.transport, resolver, respectRobots: false });
    expect(res.status).toBe(200);
    expect(n).toBe(1);
    expect(net.calls[0].address.address).toBe('93.184.216.34');
  });
  it('limite les redirections, le délai et la taille', async () => {
    const loop: Record<string, { status: number; headers: Record<string, string> }> = {};
    for (let i = 0; i < 8; i++) loop[`https://loop.test/${i}`] = { status: 302, headers: { location: `/${i + 1}` } };
    const net = fakeNet({ ...loop, 'https://lent.test/': { hang: true }, 'https://gros.test/': { body: 'x'.repeat(3 * 1024 * 1024) } });
    expect(await code(safeFetch('https://loop.test/0', { ...net, respectRobots: false }))).toBe('too_many_redirects');
    expect(await code(safeFetch('https://lent.test/', { ...net, respectRobots: false, timeoutMs: 50 }))).toBe('timeout');
    const big = await safeFetch('https://gros.test/', { ...net, respectRobots: false });
    expect(big.truncated).toBe(true);
    expect(big.bytes).toBe(2 * 1024 * 1024);
  });
  it('un seul user agent, identique pour l’audit de site et la présence, et qui pointe vers /methode/robot', async () => {
    const { UA } = await import('../../engine/sources/presence');
    expect(UA).toBe(USER_AGENT);
    expect(USER_AGENT).toBe('RepereBot/1.0 (+https://repere-ia.fr/methode/robot)');
  });

  it('respecte le robots.txt du site pour RepereBot et envoie le user agent déclaré', async () => {
    const net = fakeNet({
      'https://prive.test/robots.txt': { body: 'User-agent: RepereBot\nDisallow: /\n', headers: { 'content-type': 'text/plain' } },
      'https://prive.test/page': { body: 'secret' },
    });
    expect(await code(safeFetch('https://prive.test/page', net))).toBe('robots_disallowed');
    expect(net.calls[0].headers['User-Agent']).toBe('RepereBot/1.0 (+https://repere-ia.fr/methode/robot)');
  });
  it('met en cache 10 minutes (dépendances par défaut)', async () => {
    const net = fakeNet({ 'https://cache.test/': { body: '<html><body>v1</body></html>' } });
    const restore = setFetchDeps({ resolver: net.resolver, transport: net.transport });
    try {
      const a = await safeFetch('https://cache.test/');
      const b = await safeFetch('https://cache.test/');
      expect(a.fromCache).toBe(false);
      expect(b.fromCache).toBe(true);
      expect(net.calls.filter((c) => c.url.pathname === '/').length).toBe(1);
    } finally {
      restore();
    }
  });
});

/* ------------------------------------------------------------------ */
const extras = { robots: robotsReportFromText(`${SITE}/`, ROBOTS_OPEN, 200), sitemap: { found: true, url: `${SITE}/sitemap.xml` }, llms: { found: false, url: `${SITE}/llms.txt` } };
const snap = (body: string, over: Partial<{ status: number; responseMs: number; url: string; headers: Record<string, string> }> = {}) => ({
  url: over.url ?? `${SITE}/`,
  finalUrl: over.url ?? `${SITE}/`,
  status: over.status ?? 200,
  headers: over.headers ?? {},
  body,
  bytes: Buffer.byteLength(body),
  truncated: false,
  responseMs: over.responseMs ?? 300,
});

describe('readiness', () => {
  it('bonne page : score élevé, contrôles au format du contrat', () => {
    const r = readinessFromSnapshot(snap(GOOD_PAGE), extras);
    expect(r.score).toBeGreaterThanOrEqual(85);
    for (const c of r.checks) {
      expect(['ok', 'warn', 'fail']).toContain(c.status);
      expect(typeof c.id).toBe('string');
      expect(typeof c.label).toBe('string');
      expect(typeof c.detail).toBe('string');
      expect(typeof c.fix).toBe('string');
    }
    expect(r.checks.find((c) => c.id === 'llms_txt')!.points).toBe(0);
    expect(r.render.verdict).toBe('lisible');
    expect(r.jsonLdTypes).toContain('Plumber');
  });
  it('SPA vide : rendu quasi vide détecté', () => {
    const r = readinessFromSnapshot(snap(SPA_PAGE), extras);
    expect(r.render.verdict).toBe('quasi_vide');
    expect(r.render.emptyRoot).toContain('React');
    expect(r.checks.find((c) => c.id === 'render')!.status).toBe('fail');
    expect(r.score).toBeLessThanOrEqual(40);
    expect(r.cap).toMatch(/plafonné/);
  });
  it('mauvaise page + robots qui bloque la recherche + noindex : score bas et correctifs', () => {
    const bad = { ...extras, robots: robotsReportFromText(`${SITE}/`, ROBOTS_BLOCK_SEARCH, 200), sitemap: { found: false, url: null } };
    const r = readinessFromSnapshot(snap(BAD_PAGE, { url: 'http://plomberie-exemple.fr/', headers: { 'x-robots-tag': 'noindex' }, responseMs: 2600 }), bad);
    expect(r.checks.find((c) => c.id === 'robots')!.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'https')!.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'indexable')!.status).toBe('fail');
    expect(r.checks.find((c) => c.id === 'response_time')!.status).toBe('fail');
    expect(r.score).toBeLessThan(40);
    expect(r.fixes[0].impact).toBeGreaterThanOrEqual(r.fixes[r.fixes.length - 1].impact);
  });
  it('audit réseau complet avec faux site (robots, sitemap, llms.txt)', async () => {
    const net = fakeNet({
      [`${SITE}/`]: { body: GOOD_PAGE },
      [`${SITE}/robots.txt`]: { body: ROBOTS_OPEN, headers: { 'content-type': 'text/plain' } },
      [`${SITE}/sitemap.xml`]: { body: SITEMAP, headers: { 'content-type': 'application/xml' } },
      [`${SITE}/llms.txt`]: { body: '# Plomberie Exemple\n> Plombier à Lyon\n', headers: { 'content-type': 'text/plain' } },
    });
    const r = await auditReadiness('plomberie-exemple.fr', net);
    expect(r.sitemap.found).toBe(true);
    expect(r.llmsTxt.found).toBe(true);
    expect(r.robots?.found).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(85);
  });
});

/* ------------------------------------------------------------------ */
describe('citabilité', () => {
  it('bonne page mieux notée que la mauvaise, avec extraits citables', () => {
    const good = citabilityFromHtml(GOOD_PAGE, { url: `${SITE}/`, question: 'plombier Lyon 3' });
    const bad = citabilityFromHtml(BAD_PAGE, { url: `${SITE}/` });
    expect(good.total).toBe(20);
    expect(good.score).toBeGreaterThanOrEqual(80);
    expect(bad.score).toBeLessThan(35);
    expect(good.extracts.length).toBeGreaterThan(0);
    expect(good.extracts[0].text.length).toBeGreaterThan(20);
    const byId = (r: typeof good, id: string) => r.checks.find((c) => c.id === id)!.status;
    expect(byId(good, 'question_headings')).toBe('ok');
    expect(byId(good, 'sourced')).toBe('ok');
    expect(byId(good, 'date')).toBe('ok');
    expect(byId(good, 'author')).toBe('ok');
    expect(byId(good, 'faq')).toBe('ok');
    expect(byId(bad, 'direct_answer')).toBe('warn');
    expect(byId(bad, 'faq')).toBe('fail');
    expect(bad.suggestions.some((s) => s.rule === 'direct_answer')).toBe(true);
    expect(good.disclaimer).toMatch(/pas une mesure/);
    expect(good.aiRewrite).toBeNull();
  });
  it('accepte du HTML collé sans URL', () => {
    const r = citabilityFromHtml(GOOD_PAGE);
    expect(r.url).toBeNull();
    expect(r.checks).toHaveLength(20);
  });
});

/* ------------------------------------------------------------------ */
describe('fiche produit', () => {
  it('fiche complète : score élevé, rien d’essentiel manquant', () => {
    const r = productFromHtml(PRODUCT_FULL, 'https://maison-exemple.fr/theiere');
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.product.gtin).toBe('3760000000017');
    expect(r.product.price).toBe('89.00');
    expect(r.product.conflicts).toEqual([]);
    expect(r.missing).not.toContain('prix et devise');
  });
  it('fiche pauvre : attributs manquants, conflit de prix, balisage proposé sans valeur inventée', () => {
    const r = productFromHtml(PRODUCT_POOR, 'https://maison-exemple.fr/t');
    expect(r.score).toBeLessThan(50);
    expect(r.missing).toEqual(expect.arrayContaining(['marque', 'GTIN ou MPN', 'disponibilité']));
    expect(r.product.conflicts.join(' ')).toMatch(/Prix différent/);
    expect(r.checks.find((c) => c.id === 'consistency')!.status).toBe('fail');
    const s = JSON.stringify(r.suggestedJsonLd);
    expect(s).toContain('[à compléter');
    expect(s).not.toContain('aggregateRating');
  });
});

/* ------------------------------------------------------------------ */
describe('JSON-LD', () => {
  it('valide : JSON invalide, propriétés requises, FAQ incomplète, virgule finale', () => {
    expect(validateJsonLdText('{"@context": "https://schema.org", "@type": ').errors[0]).toMatch(/JSON invalide/);
    const lb = validateJsonLdValue({ '@context': 'https://schema.org', '@type': 'LocalBusiness', name: 'X', telephone: 'abc' });
    expect(lb.errors.join(' ')).toMatch(/address/);
    expect(lb.warnings.join(' ')).toMatch(/téléphone/);
    const faq = validateJsonLdValue({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q ?' }] });
    expect(faq.errors.join(' ')).toMatch(/question 1/);
    const trailing = validateJsonLdText('{"@context":"https://schema.org","@type":"Organization","name":"A","url":"https://a.fr",}');
    expect(trailing.blocks[0].data).not.toBeNull();
    expect(trailing.warnings.join(' ')).toMatch(/virgule/);
  });
  it('extrait les blocs d’une page HTML collée', () => {
    const v = validateJsonLdText(GOOD_PAGE);
    expect(v.blocks).toHaveLength(2);
    expect(v.errors).toEqual([]);
  });
  it('génère LocalBusiness (sous-type par métier, horaires), Product, FAQPage valides', () => {
    const lb = generateJsonLd('LocalBusiness', { name: 'Plomberie Exemple', trade: 'plombier', city: 'Lyon', address: '12 rue Exemple, 69003 Lyon', telephone: '04 78 00 00 00', openingHours: 'Lun-ven 8h-19h', url: 'https://plomberie-exemple.fr' });
    const node = (lb.jsonld['@graph'] as Record<string, unknown>[])[0];
    expect(node['@type']).toBe('Plumber');
    expect(node.openingHoursSpecification).toBeTruthy();
    expect(lb.script).toContain('application/ld+json');
    expect(lb.validation.errors).toEqual([]);
    const p = generateJsonLd('Product', { name: 'Théière', brand: 'Maison', price: '89,00', availability: 'InStock' });
    expect((p.jsonld.offers as Record<string, unknown>).price).toBe('89.00');
    expect(p.validation.errors).toEqual([]);
    const f = generateJsonLd('FAQPage', { faq: [{ q: 'Livrez-vous ?', a: 'Oui, en 48 h.' }] });
    expect(f.jsonld['@type']).toBe('FAQPage');
    expect(f.validation.errors).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
describe('llms.txt', () => {
  it('construit et valide le fichier', () => {
    const t = buildLlmsTxt({ name: 'Plomberie Exemple', summary: 'Plombier à Lyon 3.' }, [
      { url: `${SITE}/`, title: 'Accueil' },
      { url: `${SITE}/services/debouchage`, title: 'Débouchage', description: 'Canalisations' },
    ]);
    expect(t).toMatch(/^# Plomberie Exemple\n\n> Plombier à Lyon 3\./);
    expect(t).toContain('## Services');
    expect(validateLlmsTxt(t)).toEqual([]);
    expect(validateLlmsTxt('<html>').length).toBeGreaterThan(0);
  });
  it('génère depuis le sitemap, sans pages techniques, avec la mention honnête', async () => {
    const net = fakeNet({
      [`${SITE}/`]: { body: GOOD_PAGE },
      [`${SITE}/robots.txt`]: { body: ROBOTS_OPEN, headers: { 'content-type': 'text/plain' } },
      [`${SITE}/sitemap.xml`]: { body: SITEMAP, headers: { 'content-type': 'application/xml' } },
      [`${SITE}/tarifs`]: { body: '<html><head><title>Tarifs | Plomberie Exemple</title><meta name="description" content="Nos prix"></head><body></body></html>' },
    });
    const r = await generateLlms(SITE, net);
    expect(r.sitemapUrl).toBe(`${SITE}/sitemap.xml`);
    expect(r.llmsTxt).toContain('[Tarifs](https://plomberie-exemple.fr/tarifs): Nos prix');
    expect(r.llmsTxt).not.toContain('/panier');
    expect(r.honest.points.join(' ')).toMatch(/Google/);
  });
});

/* ------------------------------------------------------------------ */
describe('comparateur', () => {
  it('compare deux sites et propose au plus 3 écarts', async () => {
    const net = fakeNet({
      [`${SITE}/`]: { body: GOOD_PAGE },
      [`${SITE}/robots.txt`]: { body: ROBOTS_OPEN, headers: { 'content-type': 'text/plain' } },
      [`${SITE}/sitemap.xml`]: { body: SITEMAP, headers: { 'content-type': 'application/xml' } },
      'https://concurrent.test/': { body: BAD_PAGE },
    });
    const r = await compareSites('concurrent.test', SITE, net);
    expect(r.mine.readiness).not.toBeNull();
    expect(r.theirs.readiness!).toBeGreaterThan(r.mine.readiness!);
    expect(r.rows.find((x) => x.id === 'jsonld')!.edge).toBe('theirs');
    expect(r.gaps.length).toBeGreaterThan(0);
    expect(r.gaps.length).toBeLessThanOrEqual(3);
  });
  it('refuse immédiatement une adresse interne', async () => {
    expect(await code(compareSites('http://127.0.0.1/', SITE))).toBe('blocked_ip');
  });
});

/* ------------------------------------------------------------------ */
describe('lien d’avis', () => {
  it('extrait le Place ID d’un lien Maps et produit lien + QR', () => {
    expect(extractPlaceId('https://www.google.com/maps/search/?api=1&query=x&query_place_id=ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    const r = buildReviewLink({ placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', name: 'Plomberie Exemple' });
    expect(r.reviewUrl).toBe('https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(r.qrSvg ?? r.qrServiceUrl).toBeTruthy();
    expect(r.limit).toBeNull();
  });
  it('sans Place ID : dit la limite et guide', () => {
    const r = buildReviewLink({ name: 'Plomberie Exemple', city: 'Lyon' });
    expect(r.reviewUrl).toBeNull();
    expect(r.limit).toMatch(/Place ID/);
    expect(r.mapsSearchUrl).toContain('Plomberie%20Exemple%20Lyon');
  });
});
