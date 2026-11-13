/**
 * Un test par contrôle important : on part d'un site propre, on introduit UN défaut, on attend LE constat.
 */
import { describe, expect, it } from 'vitest';
import { auditSeo } from '..';
import type { CrawledPage, Finding, PerfData, SiteCrawl, SiteType } from '../types';
import { cleanLocal, cleanPme, cleanShop, clone, mkPage, ORIGIN, page, PLUMBER_LD, productLd } from './fixtures';

type Mut = (s: SiteCrawl) => void;

function run(base: () => SiteCrawl, mut: Mut, type: SiteType, perf?: PerfData) {
  const s = clone(base());
  mut(s);
  return auditSeo(s, { siteType: type, perf });
}
function find(r: ReturnType<typeof auditSeo>, id: string): Finding | undefined {
  return r.sections.flatMap((x) => x.findings).find((f) => f.id === id);
}
const add = (s: SiteCrawl, p: CrawledPage, linkFromHome = true) => {
  s.pages.push(p);
  if (linkFromHome) s.links.push({ from: `${ORIGIN}/`, to: p.url, anchor: p.h1[0] ?? 'lien', rel: [], internal: true });
};
const setHtml = (p: CrawledPage, f: (h: string) => string) => {
  p.html = f(p.html ?? '');
};

const PME = cleanPme;
const LOC = cleanLocal;
const SHOP = cleanShop;

const CASES: [string, () => SiteCrawl, SiteType, Mut, string][] = [
  // Indexation
  ['robots bloque tout', PME, 'pme', (s) => { s.robots!.text = 'User-agent: *\nDisallow: /\n'; }, 'seo.robots.blocks_all'],
  ['robots 5xx', PME, 'pme', (s) => { s.robots = { url: `${ORIGIN}/robots.txt`, status: 503, sitemaps: [] }; }, 'seo.robots.server_error'],
  ['robots absent', PME, 'pme', (s) => { s.robots = { url: `${ORIGIN}/robots.txt`, status: 404, sitemaps: [] }; }, 'seo.robots.missing'],
  ['robots sans sitemap', PME, 'pme', (s) => { s.robots!.text = 'User-agent: *\nAllow: /\n'; s.robots!.sitemaps = []; }, 'seo.robots.no_sitemap'],
  ['robots bloque CSS/JS', PME, 'pme', (s) => { s.robots!.text = `User-agent: *\nDisallow: /wp-includes/\nSitemap: ${ORIGIN}/sitemap.xml`; }, 'seo.robots.blocks_resources'],
  ['pas de sitemap', PME, 'pme', (s) => { s.sitemaps = []; s.sitemapUrls = []; }, 'seo.sitemap.missing'],
  ['sitemap en 404', PME, 'pme', (s) => { s.sitemaps[0].status = 404; }, 'seo.sitemap.error'],
  ['sitemap > 50 000', PME, 'pme', (s) => { s.sitemaps[0].urlCount = 60_000; }, 'seo.sitemap.too_big'],
  ['sitemap : page noindex', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.metaRobots = 'noindex'; p.isIndexable = false; }, 'seo.sitemap.non_indexable'],
  ['sitemap : page 404', PME, 'pme', (s) => { const p = mkPage({ path: '/ancienne/', title: 'x', h1: 'x' }); p.status = 404; s.pages.push(p); s.sitemapUrls.push(p.url); }, 'seo.sitemap.broken'],
  ['sitemap : redirigée', PME, 'pme', (s) => { const p = clone(page(s, '/expertises/')); p.url = `${ORIGIN}/expertise`; p.redirectChain = [{ url: p.url, status: 301 }]; s.pages.push(p); s.sitemapUrls.push(p.url); }, 'seo.sitemap.redirects'],
  ['sitemap : autre domaine', PME, 'pme', (s) => { s.sitemapUrls.push('http://exemple.fr/page'); }, 'seo.sitemap.other_host'],
  ['page hors sitemap', PME, 'pme', (s) => { s.sitemapUrls = s.sitemapUrls.filter((u) => !u.endsWith('/qui-sommes-nous/')); }, 'seo.sitemap.missing_pages'],
  ['accueil noindex', PME, 'pme', (s) => { const p = page(s, '/'); p.metaRobots = 'noindex, follow'; p.isIndexable = false; }, 'seo.index.home_noindex'],
  ['page noindex', PME, 'pme', (s) => { const p = page(s, '/qui-sommes-nous/'); p.metaRobots = 'noindex'; p.isIndexable = false; }, 'seo.index.noindex'],
  ['X-Robots-Tag noindex', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.headers['x-robots-tag'] = 'noindex'; p.isIndexable = false; }, 'seo.index.xrobots_noindex'],
  ['nofollow', PME, 'pme', (s) => { page(s, '/expertises/').metaRobots = 'index, nofollow'; }, 'seo.index.nofollow'],
  ['nosnippet', PME, 'pme', (s) => { page(s, '/expertises/').metaRobots = 'max-snippet:0'; }, 'seo.index.nosnippet'],
  ['unavailable_after', PME, 'pme', (s) => { page(s, '/expertises/').metaRobots = 'unavailable_after: 2027-01-01'; }, 'seo.index.unavailable_after'],
  ['sitemap bloqué robots', PME, 'pme', (s) => { const p = page(s, '/qui-sommes-nous/'); p.blockedByRobots = true; p.status = 0; p.html = undefined; }, 'seo.index.blocked_in_sitemap'],
  ['rendu JavaScript', PME, 'pme', (s) => { page(s, '/expertises/').renderHints.likelyClientRendered = true; }, 'seo.index.client_rendered'],
  ['page profonde', PME, 'pme', (s) => { page(s, '/expertises/transport/').depth = 5; }, 'seo.index.deep_pages'],
  ['erreurs de crawl', PME, 'pme', (s) => { s.errors.push({ url: `${ORIGIN}/lente`, error: 'timeout' }); }, 'seo.index.crawl_errors'],
  ['crawl tronqué', PME, 'pme', (s) => { s.truncated = true; }, 'seo.index.truncated'],
  ['accueil 500', PME, 'pme', (s) => { page(s, '/').status = 500; }, 'seo.index.home_unreachable'],
  // Technique
  ['site en http', PME, 'pme', (s) => { s.finalOrigin = 'http://www.exemple.fr'; }, 'seo.https.not_https'],
  ['page en http', PME, 'pme', (s) => { const p = clone(page(s, '/expertises/')); p.url = p.finalUrl = 'http://www.exemple.fr/vieux'; p.textHash = 'zz'; s.pages.push(p); }, 'seo.https.http_pages'],
  ['contenu mixte', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</main>', '<img src="http://cdn.exemple.fr/a.jpg"></main>')), 'seo.https.mixed_content'],
  ['sans HSTS', PME, 'pme', (s) => { delete page(s, '/').headers['strict-transport-security']; }, 'seo.https.hsts'],
  ['liens internes http', PME, 'pme', (s) => { s.links.push({ from: `${ORIGIN}/`, to: 'http://www.exemple.fr/contact/', anchor: 'Contact', rel: [], internal: true }); }, 'seo.https.http_links'],
  ['www et sans www', PME, 'pme', (s) => { const p = clone(page(s, '/')); p.url = p.finalUrl = 'https://exemple.fr/'; s.pages.push(p); }, 'seo.host.duplicate'],
  ['erreur 500', PME, 'pme', (s) => { page(s, '/expertises/transport/').status = 500; }, 'seo.status.5xx'],
  ['soft 404', PME, 'pme', (s) => { const p = page(s, '/expertises/transport/'); p.title = 'Page introuvable'; p.wordCount = 40; }, 'seo.status.soft404'],
  ['chaîne de redirections', PME, 'pme', (s) => { const p = clone(page(s, '/contact/')); p.url = `${ORIGIN}/nous-contacter`; p.redirectChain = [{ url: p.url, status: 301 }, { url: `${ORIGIN}/contact`, status: 301 }]; s.pages.push(p); }, 'seo.redirect.chain'],
  ['boucle de redirection', PME, 'pme', (s) => { const p = mkPage({ path: '/boucle', title: 'b', h1: 'b' }); p.status = 301; p.redirectChain = [{ url: `${ORIGIN}/boucle`, status: 301 }, { url: `${ORIGIN}/boucle/`, status: 301 }, { url: `${ORIGIN}/boucle`, status: 301 }]; s.pages.push(p); }, 'seo.redirect.loop'],
  ['redirection 302', PME, 'pme', (s) => { const p = clone(page(s, '/contact/')); p.url = `${ORIGIN}/contact-us`; p.redirectChain = [{ url: p.url, status: 302 }]; s.pages.push(p); }, 'seo.redirect.temporary'],
  ['lien vers redirection', PME, 'pme', (s) => { const p = clone(page(s, '/contact/')); p.url = `${ORIGIN}/contact-us`; p.redirectChain = [{ url: p.url, status: 301 }]; s.pages.push(p); s.links.push({ from: `${ORIGIN}/`, to: p.url, anchor: 'Contact', rel: [], internal: true }); }, 'seo.redirect.internal_links'],
  ['meta refresh', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('<head>', '<head><meta http-equiv="refresh" content="0; url=/autre">')), 'seo.redirect.meta_refresh'],
  ['identifiant de session', PME, 'pme', (s) => { const p = clone(page(s, '/expertises/')); p.url = `${ORIGIN}/expertises/?PHPSESSID=abc`; s.pages.push(p); }, 'seo.url.session_id'],
  ['utm interne', PME, 'pme', (s) => setHtml(page(s, '/'), (h) => h.replace('</main>', '<a href="/contact/?utm_source=menu">Contact</a></main>')), 'seo.url.tracking_internal'],
  ['redirections CRAWL (chaîne)', PME, 'pme', (s) => { s.redirects = [{ from: `${ORIGIN}/old`, to: `${ORIGIN}/contact/`, chain: [{ url: `${ORIGIN}/old`, status: 301 }, { url: `${ORIGIN}/old/`, status: 301 }] }]; }, 'seo.redirect.chain'],
  ['redirections CRAWL (302 liée)', PME, 'pme', (s) => { s.redirects = [{ from: `${ORIGIN}/promo`, to: `${ORIGIN}/contact/`, chain: [{ url: `${ORIGIN}/promo`, status: 302 }] }]; s.links.push({ from: `${ORIGIN}/`, to: `${ORIGIN}/promo`, anchor: 'Promo', rel: [], internal: true }); }, 'seo.redirect.internal_links'],
  ['orpheline (depth -1, crawl tronqué)', PME, 'pme', (s) => { s.truncated = true; page(s, '/qui-sommes-nous/').depth = -1; }, 'seo.link.orphans'],
  ['image cassée (linkChecks)', PME, 'pme', (s) => { s.linkChecks = [{ url: page(s, '/expertises/').images[0].src, kind: 'image', status: 404 }]; }, 'seo.img.broken'],
  ['image lourde (linkChecks)', PME, 'pme', (s) => { const i = page(s, '/expertises/').images[0]; i.bytes = undefined; s.linkChecks = [{ url: i.src, kind: 'image', status: 200, bytes: 700_000 }]; }, 'seo.img.heavy'],
  ['lien externe cassé', PME, 'pme', (s) => { s.linkChecks = [{ url: 'https://www.facebook.com/exemple', kind: 'link', status: 404 }]; }, 'seo.broken.external'],
  ['majuscules', PME, 'pme', (s) => add(s, mkPage({ path: '/Offres-Speciales/', title: 'Nos offres spéciales du moment | Exemple', h1: 'Offres spéciales' })), 'seo.url.uppercase'],
  ['tiret bas', PME, 'pme', (s) => add(s, mkPage({ path: '/nos_offres/', title: 'Toutes nos offres d’accompagnement | Exemple', h1: 'Nos offres' })), 'seo.url.underscore'],
  ['URL longue', PME, 'pme', (s) => add(s, mkPage({ path: `/${'tres-longue-adresse-'.repeat(6)}/`, title: 'Une page à l’adresse interminable | Exemple', h1: 'Adresse longue' })), 'seo.url.too_long'],
  ['URL double barre', PME, 'pme', (s) => add(s, mkPage({ path: '/expertises//doublon/', title: 'Page à double barre oblique ici | Exemple', h1: 'Double barre' })), 'seo.url.malformed'],
  ['sans charset', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.contentType = 'text/html'; p.headers['content-type'] = 'text/html'; setHtml(p, (h) => h.replace('<meta charset="utf-8">', '')); }, 'seo.html.charset'],
  ['sans doctype', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('<!DOCTYPE html>', '')), 'seo.html.doctype'],
  ['base href étrangère', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('<head>', '<head><base href="https://staging.autre.fr/">')), 'seo.html.base_href'],
  // Contenu
  ['titre absent', PME, 'pme', (s) => { page(s, '/expertises/').title = undefined; }, 'seo.title.missing'],
  ['titre long', PME, 'pme', (s) => { page(s, '/expertises/').title = 'Nos expertises en logistique : entrepôt, transport, achats, supply chain et plus | Exemple'; }, 'seo.title.too_long'],
  ['titre court', PME, 'pme', (s) => { page(s, '/expertises/').title = 'Expertises'; }, 'seo.title.too_short'],
  ['titre générique', PME, 'pme', (s) => { page(s, '/').title = 'Accueil'; }, 'seo.title.generic'],
  ['deux balises title', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</head>', '<title>Autre</title></head>')), 'seo.title.multiple'],
  ['meta absente', PME, 'pme', (s) => { page(s, '/expertises/').metaDescription = undefined; }, 'seo.meta.missing'],
  ['meta longue', PME, 'pme', (s) => { page(s, '/expertises/').metaDescription = 'x'.repeat(200); }, 'seo.meta.too_long'],
  ['meta courte', PME, 'pme', (s) => { page(s, '/expertises/').metaDescription = 'Nos expertises.'; }, 'seo.meta.too_short'],
  ['H1 absent', PME, 'pme', (s) => { page(s, '/expertises/').h1 = []; }, 'seo.h1.missing'],
  ['H1 vide', PME, 'pme', (s) => { page(s, '/expertises/').h1 = ['']; }, 'seo.h1.empty'],
  ['plusieurs H1', PME, 'pme', (s) => { page(s, '/expertises/').h1 = ['Nos expertises', 'Contact']; }, 'seo.h1.multiple'],
  ['H1 long', PME, 'pme', (s) => { page(s, '/expertises/').h1 = ['N'.repeat(90)]; }, 'seo.h1.too_long'],
  ['saut H2→H4', PME, 'pme', (s) => { page(s, '/expertises/').headings.push({ level: 4, text: 'Détail' }); }, 'seo.headings.skip'],
  ['long texte sans H2', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.headings = [{ level: 1, text: 'Nos expertises' }]; p.wordCount = 900; }, 'seo.headings.no_h2'],
  ['page pauvre', PME, 'pme', (s) => { page(s, '/expertises/transport/').wordCount = 90; }, 'seo.content.thin'],
  ['accueil pauvre', PME, 'pme', (s) => { page(s, '/').wordCount = 80; }, 'seo.content.home_thin'],
  ['lorem ipsum', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</main>', '<p>Lorem ipsum dolor sit amet.</p></main>')), 'seo.content.lorem'],
  ['ratio texte/code', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.renderHints.textToHtmlRatio = 0.01; p.bytes = 300_000; }, 'seo.content.text_ratio'],
  ['langue absente', PME, 'pme', (s) => { page(s, '/expertises/').lang = undefined; }, 'seo.lang.missing'],
  ['open graph absent', PME, 'pme', (s) => { page(s, '/expertises/').openGraph = {}; }, 'seo.og.missing'],
  ['og:image absente', PME, 'pme', (s) => { delete page(s, '/expertises/').openGraph['og:image']; }, 'seo.og.image_missing'],
  ['meta keywords', PME, 'pme', (s) => setHtml(page(s, '/'), (h) => h.replace('</head>', '<meta name="keywords" content="a,b"></head>')), 'seo.meta.keywords'],
  ['sans mentions légales', PME, 'pme', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('mentions')); s.links = s.links.filter((l) => !l.to.includes('mentions')); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('mentions')); }, 'seo.trust.legal_missing'],
  ['sans confidentialité', PME, 'pme', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('confidentialite')); s.links = s.links.filter((l) => !l.to.includes('confidentialite') && !/confidentialit/i.test(l.anchor)); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('confidentialite')); }, 'seo.trust.privacy_missing'],
  ['sans contact', PME, 'pme', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('contact')); s.links = s.links.filter((l) => !l.to.includes('contact') && !/contact/i.test(l.anchor)); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('contact')); }, 'seo.trust.contact_missing'],
  ['sans à propos', PME, 'pme', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('qui-sommes')); s.links = s.links.filter((l) => !l.to.includes('qui-sommes') && !/qui sommes/i.test(l.anchor)); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('qui-sommes')); }, 'seo.trust.about_missing'],
  // Doublons
  ['contenu dupliqué', PME, 'pme', (s) => { page(s, '/expertises/transport/').textHash = page(s, '/expertises/audit-entrepot/').textHash; }, 'seo.dup.content'],
  ['titres dupliqués', PME, 'pme', (s) => { page(s, '/expertises/transport/').title = page(s, '/expertises/audit-entrepot/').title; }, 'seo.dup.title'],
  ['meta dupliquées', PME, 'pme', (s) => { page(s, '/expertises/transport/').metaDescription = page(s, '/expertises/audit-entrepot/').metaDescription; }, 'seo.dup.meta'],
  ['H1 dupliqués', PME, 'pme', (s) => { page(s, '/expertises/transport/').h1 = page(s, '/expertises/audit-entrepot/').h1; }, 'seo.dup.h1'],
  ['cannibalisation', PME, 'pme', (s) => { page(s, '/expertises/transport/').title = 'Audit d’entrepôt et plan d’amélioration logistique | Exemple'; }, 'seo.dup.cannibal'],
  ['slash final', PME, 'pme', (s) => { const p = clone(page(s, '/expertises/')); p.url = p.finalUrl = p.canonical = `${ORIGIN}/expertises`; p.textHash = 'q'; p.title = 'Autre titre pour le doublon de slash | Exemple'; p.h1 = ['Autre']; p.metaDescription = 'Une autre description unique et assez longue pour ne pas être signalée.'; s.pages.push(p); s.sitemapUrls.push(p.url); s.links.push({ from: `${ORIGIN}/`, to: p.url, anchor: 'Expertises', rel: [], internal: true }); }, 'seo.dup.trailing_slash'],
  ['canonical absente', PME, 'pme', (s) => { page(s, '/expertises/').canonical = undefined; }, 'seo.canonical.missing'],
  ['canonical vers 404', PME, 'pme', (s) => { const d = mkPage({ path: '/disparue/', title: 'd', h1: 'd' }); d.status = 404; s.pages.push(d); const p = page(s, '/expertises/'); p.canonical = d.url; p.isIndexable = false; }, 'seo.canonical.to_error'],
  ['canonicals multiples', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</head>', `<link rel="canonical" href="${ORIGIN}/autre"></head>`)), 'seo.canonical.multiple'],
  ['canonical relative', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace(`href="${ORIGIN}/expertises/"`, 'href="/expertises/"')), 'seo.canonical.relative'],
  ['canonical autre domaine', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.canonical = 'https://www.ancien-site.fr/expertises/'; p.isIndexable = false; }, 'seo.canonical.other_domain'],
  ['canonical http', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.canonical = 'http://www.exemple.fr/expertises/'; p.isIndexable = false; }, 'seo.canonical.http'],
  ['canonical en chaîne', PME, 'pme', (s) => { const a = page(s, '/expertises/transport/'); a.canonical = `${ORIGIN}/expertises/audit-entrepot/`; a.isIndexable = false; const b = page(s, '/expertises/audit-entrepot/'); b.canonical = `${ORIGIN}/expertises/`; b.isIndexable = false; }, 'seo.canonical.chain'],
  ['canonical avec #', PME, 'pme', (s) => { page(s, '/expertises/').canonical = `${ORIGIN}/expertises/#haut`; }, 'seo.canonical.fragment'],
  // Maillage / liens
  ['page orpheline', PME, 'pme', (s) => { s.links = s.links.filter((l) => !l.to.endsWith('/qui-sommes-nous/')); }, 'seo.link.orphans'],
  ['impasse', PME, 'pme', (s) => { page(s, '/expertises/').internalLinks = 0; }, 'seo.link.dead_end'],
  ['un seul lien entrant', PME, 'pme', (s) => { s.links = s.links.filter((l) => !(l.to.endsWith('/qui-sommes-nous/') && !l.from.endsWith('/contact/'))); }, 'seo.link.weak_inlinks'],
  ['nofollow interne', PME, 'pme', (s) => { s.links[0].rel = ['nofollow']; }, 'seo.link.nofollow_internal'],
  ['ancre vide', PME, 'pme', (s) => { s.links.push({ from: `${ORIGIN}/`, to: `${ORIGIN}/contact/`, anchor: '', rel: [], internal: true }); }, 'seo.link.empty_anchor'],
  ['ancre générique', PME, 'pme', (s) => { s.links.push({ from: `${ORIGIN}/`, to: `${ORIGIN}/contact/`, anchor: 'Cliquez ici', rel: [], internal: true }); }, 'seo.link.generic_anchor'],
  ['trop de liens', PME, 'pme', (s) => { page(s, '/').internalLinks = 400; }, 'seo.link.too_many'],
  ['trop de liens externes', PME, 'pme', (s) => { page(s, '/').externalLinks = 150; }, 'seo.link.many_external'],
  ['lien javascript', PME, 'pme', (s) => setHtml(page(s, '/'), (h) => h.replace('</main>', '<a href="javascript:goTo(3)">Suite</a></main>')), 'seo.link.javascript'],
  ['liens vers noindex', PME, 'pme', (s) => { const p = page(s, '/qui-sommes-nous/'); p.metaRobots = 'noindex'; p.isIndexable = false; }, 'seo.link.to_noindex'],
  ['lien cassé', PME, 'pme', (s) => { const d = mkPage({ path: '/expertises/ancienne/', title: 'd', h1: 'd' }); d.status = 404; s.pages.push(d); s.links.push({ from: `${ORIGIN}/`, to: d.url, anchor: 'Ancienne', rel: [], internal: true }); }, 'seo.broken.internal'],
  ['redirection vers 404', PME, 'pme', (s) => { const d = mkPage({ path: '/vieux/', title: 'd', h1: 'd' }); d.status = 404; d.finalUrl = `${ORIGIN}/vieux-2/`; d.redirectChain = [{ url: d.url, status: 301 }]; s.pages.push(d); s.links.push({ from: `${ORIGIN}/`, to: d.url, anchor: 'Vieux', rel: [], internal: true }); }, 'seo.broken.redirect_to_error'],
  ['lien localhost', PME, 'pme', (s) => { s.links.push({ from: `${ORIGIN}/`, to: 'http://localhost:8080/test', anchor: 'test', rel: [], internal: false }); }, 'seo.broken.dev_links'],
  ['href mal formé', PME, 'pme', (s) => setHtml(page(s, '/'), (h) => h.replace('</main>', '<a href="http//www.autre.fr">Autre</a></main>')), 'seo.broken.malformed_href'],
  ['lien vers 500', PME, 'pme', (s) => { page(s, '/expertises/transport/').status = 503; }, 'seo.broken.internal_5xx_linked'],
  // International
  ['hreflang invalide', PME, 'pme', (s) => { const p = page(s, '/'); p.hreflang = [{ lang: 'en-UK', href: `${ORIGIN}/en/` }, { lang: 'fr', href: `${ORIGIN}/` }, { lang: 'x-default', href: `${ORIGIN}/` }]; }, 'seo.hreflang.invalid_code'],
  ['hreflang sans retour', PME, 'pme', (s) => { const en = mkPage({ path: '/en/', title: 'Logistics consulting firm for industry | Exemple', h1: 'Logistics consulting' }); en.lang = 'en'; s.pages.push(en); page(s, '/').hreflang = [{ lang: 'fr', href: `${ORIGIN}/` }, { lang: 'en', href: en.url }, { lang: 'x-default', href: `${ORIGIN}/` }]; }, 'seo.hreflang.no_return'],
  ['hreflang sans auto-référence', PME, 'pme', (s) => { page(s, '/').hreflang = [{ lang: 'en', href: `${ORIGIN}/en/` }, { lang: 'x-default', href: `${ORIGIN}/` }]; }, 'seo.hreflang.no_self'],
  ['hreflang sans x-default', PME, 'pme', (s) => { page(s, '/').hreflang = [{ lang: 'fr', href: `${ORIGIN}/` }, { lang: 'en', href: `${ORIGIN}/en/` }]; }, 'seo.hreflang.no_xdefault'],
  ['hreflang vers 404', PME, 'pme', (s) => { const en = mkPage({ path: '/en/', title: 'e', h1: 'e' }); en.status = 404; s.pages.push(en); page(s, '/').hreflang = [{ lang: 'fr', href: `${ORIGIN}/` }, { lang: 'en', href: en.url }, { lang: 'x-default', href: `${ORIGIN}/` }]; }, 'seo.hreflang.to_error'],
  ['hreflang relatif', PME, 'pme', (s) => { const p = page(s, '/'); p.hreflang = [{ lang: 'fr', href: `${ORIGIN}/` }, { lang: 'x-default', href: `${ORIGIN}/` }]; setHtml(p, (h) => h.replace('</head>', '<link rel="alternate" hreflang="en" href="/en/"></head>')); }, 'seo.hreflang.relative'],
  ['hreflang ≠ lang', PME, 'pme', (s) => { const p = page(s, '/'); p.hreflang = [{ lang: 'en', href: `${ORIGIN}/` }, { lang: 'x-default', href: `${ORIGIN}/` }]; }, 'seo.hreflang.lang_mismatch'],
  ['plusieurs langues sans hreflang', PME, 'pme', (s) => { const en = mkPage({ path: '/en/', title: 'Logistics consulting firm for industry | Exemple', h1: 'Logistics consulting' }); en.lang = 'en'; add(s, en); s.sitemapUrls.push(en.url); }, 'seo.intl.no_hreflang'],
  // Images
  ['image sans alt', PME, 'pme', (s) => { page(s, '/expertises/').images[0].alt = undefined; }, 'seo.img.alt_missing'],
  ['alt trop long', PME, 'pme', (s) => { page(s, '/expertises/').images[0].alt = 'a'.repeat(140); }, 'seo.img.alt_too_long'],
  ['alt = fichier', PME, 'pme', (s) => { page(s, '/expertises/').images[0].alt = 'IMG_2034.jpg'; }, 'seo.img.alt_filename'],
  ['image lourde', PME, 'pme', (s) => { page(s, '/expertises/').images[0].bytes = 900_000; }, 'seo.img.heavy'],
  ['image sans dimensions', PME, 'pme', (s) => { page(s, '/expertises/').images[0].width = undefined; }, 'seo.img.no_dimensions'],
  ['image principale lazy', PME, 'pme', (s) => { page(s, '/expertises/').images[0].loading = 'lazy'; }, 'seo.img.lazy_lcp'],
  ['pas de lazy', PME, 'pme', (s) => { const p = page(s, '/expertises/'); p.images = Array.from({ length: 12 }, (_, i) => ({ src: `${ORIGIN}/img/g-${i}-chantier.webp`, alt: 'chantier', width: 400, height: 300, bytes: 30_000 })); }, 'seo.img.no_lazy'],
  ['format ancien', PME, 'pme', (s) => { const i = page(s, '/expertises/').images[0]; i.src = `${ORIGIN}/img/entrepot.png`; i.bytes = 150_000; }, 'seo.img.legacy_format'],
  ['nom de fichier générique', PME, 'pme', (s) => { page(s, '/expertises/').images[0].src = `${ORIGIN}/uploads/IMG_20240512_1034.jpg`; }, 'seo.img.generic_filename'],
  ['3 Mo d’images', PME, 'pme', (s) => { page(s, '/expertises/').images = Array.from({ length: 4 }, (_, i) => ({ src: `${ORIGIN}/img/grand-${i}.webp`, alt: 'x', width: 1, height: 600, loading: 'lazy', bytes: 900_000 })).map((x) => ({ ...x, width: 1600 })); }, 'seo.img.page_weight'],
  // Données structurées
  ['JSON-LD illisible', PME, 'pme', (s) => { page(s, '/expertises/').jsonLdErrors = ['Unexpected token } in JSON']; }, 'seo.sd.parse_errors'],
  ['aucun JSON-LD', PME, 'pme', (s) => { for (const p of s.pages) p.jsonLd = []; }, 'seo.sd.none'],
  ['pas d’Organization', PME, 'pme', (s) => { page(s, '/').jsonLd = []; }, 'seo.sd.entity_missing'],
  ['pas de LocalBusiness', LOC, 'local', (s) => { page(s, '/').jsonLd = []; }, 'seo.sd.localbusiness_missing'],
  ['propriété obligatoire', PME, 'pme', (s) => { page(s, '/expertises/').jsonLd = [{ '@context': 'https://schema.org', '@type': 'Event', name: 'Webinaire' }]; }, 'seo.sd.required_missing'],
  ['valeur invalide', PME, 'pme', (s) => { page(s, '/expertises/').jsonLd = [{ '@context': 'https://schema.org', '@type': 'Event', name: 'Webinaire', startDate: '12/03/2027', location: { '@type': 'VirtualLocation', url: `${ORIGIN}/live` }, endDate: '2027-03-12', eventStatus: 'https://schema.org/EventScheduled', image: 'x', description: 'x', offers: {}, organizer: {} }]; }, 'seo.sd.invalid_values'],
  ['@context absent', PME, 'pme', (s) => { page(s, '/expertises/').jsonLd = [{ '@type': 'WebPage', name: 'x' }]; }, 'seo.sd.context'],
  ['recommandées manquantes', PME, 'pme', (s) => { page(s, '/').jsonLd = [{ '@context': 'https://schema.org', '@type': 'Organization', name: 'Exemple', url: `${ORIGIN}/` }]; }, 'seo.sd.recommended_missing'],
  ['avis auto-attribués', LOC, 'local', (s) => { page(s, '/').jsonLd = [{ ...PLUMBER_LD, aggregateRating: { '@type': 'AggregateRating', ratingValue: 4.9, reviewCount: 87 } }]; }, 'seo.sd.self_serving_reviews'],
  ['type abandonné', PME, 'pme', (s) => { page(s, '/expertises/').jsonLd = [{ '@context': 'https://schema.org', '@type': 'HowTo', name: 'x' }]; }, 'seo.sd.deprecated'],
  ['FAQ', PME, 'pme', (s) => { page(s, '/expertises/').jsonLd = [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Q ?', acceptedAnswer: { '@type': 'Answer', text: 'R.' } }] }]; }, 'seo.sd.faq_no_rich'],
  ['SearchAction', PME, 'pme', (s) => { page(s, '/').jsonLd.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Exemple', url: `${ORIGIN}/`, potentialAction: { '@type': 'SearchAction', target: `${ORIGIN}/?s={q}` } }); }, 'seo.sd.sitelinks_searchbox'],
  ['fil d’Ariane absent', PME, 'pme', (s) => { page(s, '/expertises/transport/').jsonLd = []; }, 'seo.sd.breadcrumb_missing'],
  ['article non balisé', PME, 'pme', (s) => add(s, mkPage({ path: '/blog/reduire-ses-couts-de-transport/', title: 'Réduire ses coûts de transport en 2026 | Exemple', h1: 'Réduire ses coûts de transport', words: 1200, depth: 2, jsonLd: [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Accueil', item: `${ORIGIN}/` }, { '@type': 'ListItem', position: 2, name: 'Blog' }] }] })), 'seo.sd.article_missing'],
  ['téléphone balisé invisible', PME, 'pme', (s) => { page(s, '/').jsonLd = [{ ...(page(s, '/').jsonLd[0] as object), telephone: '+33199999999' }]; }, 'seo.sd.content_mismatch'],
  // Mobile / performance
  ['viewport absent', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace(/<meta name="viewport"[^>]*>/, '')), 'seo.mobile.viewport_missing'],
  ['zoom bloqué', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('initial-scale=1', 'initial-scale=1, maximum-scale=1, user-scalable=no')), 'seo.mobile.zoom_disabled'],
  ['flash', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</main>', '<embed src="anim.swf"></main>')), 'seo.mobile.plugins'],
  ['serveur lent', PME, 'pme', (s) => { for (const p of s.pages) p.fetchMs = 1800; }, 'seo.perf.slow_server'],
  ['page très lente', PME, 'pme', (s) => { page(s, '/expertises/').fetchMs = 4500; }, 'seo.perf.slow_pages'],
  ['HTML lourd', PME, 'pme', (s) => { page(s, '/expertises/').bytes = 900_000; }, 'seo.perf.html_heavy'],
  ['trop de scripts', PME, 'pme', (s) => { page(s, '/expertises/').renderHints.scriptsCount = 60; }, 'seo.perf.too_many_scripts'],
  ['scripts bloquants', PME, 'pme', (s) => setHtml(page(s, '/expertises/'), (h) => h.replace('</head>', '<script src="/a.js"></script><script src="/b.js"></script><script src="/c.js"></script></head>')), 'seo.perf.render_blocking'],
  ['pas de compression', PME, 'pme', (s) => { for (const p of s.pages) delete p.headers['content-encoding']; }, 'seo.perf.no_compression'],
  // E-commerce
  ['facette indexable', SHOP, 'ecommerce', (s) => add(s, mkPage({ path: '/collections/t-shirts?color=bleu', title: 'T-shirts bleus en coton biologique | Exemple', h1: 'T-shirts bleus', words: 260 })), 'seo.ecom.facets_indexable'],
  ['facettes explorables', SHOP, 'ecommerce', (s) => { for (const c of ['bleu', 'rouge', 'vert', 'noir', 'blanc', 'gris']) s.links.push({ from: `${ORIGIN}/collections/t-shirts`, to: `${ORIGIN}/collections/t-shirts?filter.color=${c}`, anchor: c, rel: [], internal: true }); }, 'seo.ecom.facets_crawlable'],
  ['pagination → page 1', SHOP, 'ecommerce', (s) => { const p = mkPage({ path: '/collections/t-shirts?page=2', title: 'T-shirts en coton bio – page 2 | Exemple', h1: 'T-shirts page 2', words: 260 }); p.canonical = `${ORIGIN}/collections/t-shirts`; p.isIndexable = false; add(s, p); }, 'seo.ecom.pagination_canonical'],
  ['pagination noindex', SHOP, 'ecommerce', (s) => { const p = mkPage({ path: '/collections/t-shirts?page=3', title: 'T-shirts en coton bio – page 3 | Exemple', h1: 'T-shirts page 3', words: 260 }); p.metaRobots = 'noindex'; p.isIndexable = false; add(s, p); }, 'seo.ecom.pagination_noindex'],
  ['variante indexable', SHOP, 'ecommerce', (s) => { const p = clone(page(s, '/products/tshirt-1')); p.url = p.finalUrl = p.canonical = `${ORIGIN}/products/tshirt-1?variant=4455`; p.textHash = 'v'; p.title = 'Variante taille M du t-shirt indigo | Exemple'; p.h1 = ['Variante M']; p.metaDescription = 'Description unique de la variante taille M, assez longue pour passer.'; add(s, p); }, 'seo.ecom.variants_indexable'],
  ['fiche sans Product', SHOP, 'ecommerce', (s) => { const p = page(s, '/products/tshirt-2'); p.jsonLd = p.jsonLd.filter((b) => (b as Record<string, unknown>)['@type'] !== 'Product'); }, 'seo.ecom.product_schema_missing'],
  ['fiche pauvre', SHOP, 'ecommerce', (s) => { page(s, '/products/tshirt-2').wordCount = 60; }, 'seo.ecom.product_thin'],
  ['descriptions recopiées', SHOP, 'ecommerce', (s) => { (page(s, '/products/tshirt-2').jsonLd[0] as Record<string, unknown>).description = (page(s, '/products/tshirt-1').jsonLd[0] as Record<string, unknown>).description; }, 'seo.ecom.product_dup_description'],
  ['fiche sans image', SHOP, 'ecommerce', (s) => { const p = page(s, '/products/tshirt-2'); p.images = []; delete (p.jsonLd[0] as Record<string, unknown>).image; }, 'seo.ecom.product_no_image'],
  ['prix invisible', SHOP, 'ecommerce', (s) => { const p = page(s, '/products/tshirt-2'); setHtml(p, (h) => h.replace('29,90 €', '')); p.jsonLd = p.jsonLd.filter((b) => (b as Record<string, unknown>)['@type'] !== 'Product'); }, 'seo.ecom.price_not_visible'],
  ['rupture', SHOP, 'ecommerce', (s) => { page(s, '/products/tshirt-2').jsonLd[0] = productLd('T-shirt col V écru', 'tshirt-2', '29.90', 'https://schema.org/OutOfStock'); }, 'seo.ecom.out_of_stock'],
  ['rupture noindex', SHOP, 'ecommerce', (s) => { const p = page(s, '/products/tshirt-2'); p.jsonLd[0] = productLd('T-shirt col V écru', 'tshirt-2', '29.90', 'https://schema.org/OutOfStock'); p.metaRobots = 'noindex'; p.isIndexable = false; }, 'seo.ecom.out_of_stock_noindex'],
  ['sans livraison/retours', SHOP, 'ecommerce', (s) => { for (const p of s.pages) for (const b of p.jsonLd) { const o = (b as Record<string, Record<string, unknown>>).offers; if (o) { delete o.shippingDetails; delete o.hasMerchantReturnPolicy; } } }, 'seo.ecom.no_return_shipping'],
  ['catégorie sans texte', SHOP, 'ecommerce', (s) => { page(s, '/collections/sweats').wordCount = 40; }, 'seo.ecom.category_thin'],
  ['recherche indexable', SHOP, 'ecommerce', (s) => add(s, mkPage({ path: '/search?q=bleu', title: 'Résultats de recherche pour bleu | Exemple', h1: 'Recherche : bleu', words: 260 })), 'seo.ecom.search_indexable'],
  ['panier indexable', SHOP, 'ecommerce', (s) => add(s, mkPage({ path: '/cart', title: 'Votre panier d’achats en cours | Exemple', h1: 'Panier', words: 260 })), 'seo.ecom.cart_indexable'],
  ['sans CGV', SHOP, 'ecommerce', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('cgv')); s.links = s.links.filter((l) => !l.to.includes('cgv') && !/conditions/i.test(l.anchor)); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('cgv')); }, 'seo.ecom.cgv_missing'],
  ['fiche sans fil d’Ariane', SHOP, 'ecommerce', (s) => { const p = page(s, '/products/tshirt-2'); p.jsonLd = p.jsonLd.filter((b) => (b as Record<string, unknown>)['@type'] !== 'BreadcrumbList'); }, 'seo.ecom.product_no_breadcrumb'],
  ['liens de tri', SHOP, 'ecommerce', (s) => { for (const o of ['price-asc', 'price-desc', 'best']) s.links.push({ from: `${ORIGIN}/collections/t-shirts`, to: `${ORIGIN}/collections/t-shirts?sort_by=${o}`, anchor: o, rel: [], internal: true }); }, 'seo.ecom.sort_links'],
  // Local
  ['sans page contact', LOC, 'local', (s) => { s.pages = s.pages.filter((p) => !p.url.includes('contact')); s.links = s.links.filter((l) => !l.to.includes('contact') && !/contact/i.test(l.anchor)); s.sitemapUrls = s.sitemapUrls.filter((u) => !u.includes('contact')); }, 'seo.local.no_contact_page'],
  ['sans téléphone', LOC, 'local', (s) => { for (const p of s.pages) setHtml(p, (h) => h.replace(/<p>Téléphone[\s\S]*?<\/p>/, '')); const ld = { ...PLUMBER_LD } as Record<string, unknown>; delete ld.telephone; page(s, '/').jsonLd = [ld]; }, 'seo.local.no_phone'],
  ['sans adresse', LOC, 'local', (s) => { for (const p of s.pages) setHtml(p, (h) => h.replace('<p>12 rue des Lilas, 44000 Nantes</p>', '')); const ld = { ...PLUMBER_LD } as Record<string, unknown>; delete ld.address; page(s, '/').jsonLd = [ld]; }, 'seo.local.no_address'],
  ['NAP incohérent', LOC, 'local', (s) => { page(s, '/').jsonLd = [{ ...PLUMBER_LD, address: { ...PLUMBER_LD.address, postalCode: '44100' } }]; }, 'seo.local.nap_inconsistent'],
  ['téléphone non cliquable', LOC, 'local', (s) => { for (const p of s.pages) setHtml(p, (h) => h.replace(/<a href="tel:[^"]+">([^<]+)<\/a>/, '$1')); }, 'seo.local.no_tel_link'],
  ['sans horaires', LOC, 'local', (s) => { const ld = { ...PLUMBER_LD } as Record<string, unknown>; delete ld.openingHoursSpecification; page(s, '/').jsonLd = [ld]; setHtml(page(s, '/'), (h) => h.replace(/<p>Horaires[^<]*<\/p>/, '')); }, 'seo.local.no_hours'],
  ['fiche Google non liée', LOC, 'local', (s) => { s.links = s.links.filter((l) => !l.to.includes('goo.gl')); page(s, '/').jsonLd = [{ ...PLUMBER_LD, sameAs: ['https://www.facebook.com/exemple'] }]; }, 'seo.local.no_gbp_link'],
  ['ville absente du titre', LOC, 'local', (s) => { page(s, '/').title = 'Plombier dépannage et rénovation | Exemple'; }, 'seo.local.city_not_in_title'],
  ['zone non précisée', LOC, 'local', (s) => { const ld = { ...PLUMBER_LD } as Record<string, unknown>; delete ld.areaServed; page(s, '/').jsonLd = [ld]; setHtml(page(s, '/'), (h) => h.replace(/<p>Nous intervenons[^<]*<\/p>/, '')); }, 'seo.local.zones'],
  ['sameAs absent', LOC, 'local', (s) => { const ld = { ...PLUMBER_LD } as Record<string, unknown>; delete ld.sameAs; page(s, '/').jsonLd = [ld]; }, 'seo.local.sameas_missing'],
  ['deux établissements', LOC, 'local', (s) => { for (const p of s.pages) setHtml(p, (h) => h.replace('<p>12 rue des Lilas, 44000 Nantes</p>', '<p>12 rue des Lilas, 44000 Nantes</p><p>3 avenue Foch, 49000 Angers</p>')); }, 'seo.local.multiple_cities_one_page'],
];

describe('un défaut → le bon constat', () => {
  it.each(CASES)('%s', (_name, base, type, mut, id) => {
    const r = run(base, mut, type);
    const f = find(r, id);
    expect(f, `constat ${id} attendu ; obtenus : ${r.sections.flatMap((s) => s.findings.map((x) => x.id)).join(', ')}`).toBeDefined();
    expect(f!.affectedCount).toBeGreaterThan(0);
    expect(f!.affected.length).toBeLessThanOrEqual(200);
    expect(f!.title).not.toMatch(/undefined|NaN/);
  });

  it('couvre plus de 150 contrôles distincts', () => {
    expect(new Set(CASES.map((c) => c[4])).size).toBeGreaterThanOrEqual(160);
  });
});

describe('performance (PerfData de SEO-DATA)', () => {
  const perf = (m: PerfData['origin']): PerfData => ({ source: 'crux', fetchedAt: '2026-11-12', origin: m });
  it('LCP mauvais → élevé ; moyen → moyen', () => {
    expect(find(run(PME, () => {}, 'pme', perf({ mobile: { lcpMs: 5200 } })), 'seo.cwv.lcp')?.severity).toBe('high');
    expect(find(run(PME, () => {}, 'pme', perf({ mobile: { lcpMs: 3000 } })), 'seo.cwv.lcp')?.severity).toBe('medium');
    expect(find(run(PME, () => {}, 'pme', perf({ mobile: { lcpMs: 1800 } })), 'seo.cwv.lcp')).toBeUndefined();
  });
  it('INP (terrain seulement), CLS, TTFB', () => {
    const r = run(PME, () => {}, 'pme', perf({ mobile: { inpMs: 650, cls: 0.3, ttfbMs: 1000 } }));
    expect(find(r, 'seo.cwv.inp')?.severity).toBe('high');
    expect(find(r, 'seo.cwv.cls')?.severity).toBe('high');
    expect(find(r, 'seo.cwv.ttfb')?.severity).toBe('medium');
    const lab: PerfData = { source: 'pagespeed', fetchedAt: '2026-11-12', pages: [{ url: `${ORIGIN}/`, strategy: 'mobile', lab: { lcpMs: 2000, inpMs: 900, performanceScore: 35 } }] };
    const r2 = run(PME, () => {}, 'pme', lab);
    expect(find(r2, 'seo.cwv.inp')).toBeUndefined(); // INP n'existe pas en laboratoire
    expect(find(r2, 'seo.cwv.lab_score')).toBeDefined();
    expect(find(r2, 'seo.cwv.no_field_data')?.severity).toBe('info');
  });
  it('bonnes mesures → aucun constat de performance', () => {
    const r = run(PME, () => {}, 'pme', perf({ mobile: { lcpMs: 1900, inpMs: 120, cls: 0.02, ttfbMs: 400 } }));
    expect(r.sections.find((s) => s.id === 'performance')?.findings).toEqual([]);
    expect(r.stats.perfData).toBe(true);
  });
});
