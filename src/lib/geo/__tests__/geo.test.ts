import { describe, expect, it } from 'vitest';
import type { ProviderAnswer } from '@/lib/engine/types';
import { auditGeo, detectSiteType, type GeoFinding, type GeoReport } from '../index';
import { geoPages } from '../util';
import { extractPassages, scorePassage } from '../passages';
import { ARTISAN_LLMS, ARTISAN_ORIGIN, artisanSite, doc, makeCrawl, pmeSite, shopSite, type PageSpec } from './fixtures';

const NOW = '2026-11-13T00:00:00Z';
const ids = (r: GeoReport) => r.sections.flatMap((s) => s.findings).map((f) => f.id);
const get = (r: GeoReport, id: string): GeoFinding => {
  const f = r.sections.flatMap((s) => s.findings).find((x) => x.id === id);
  if (!f) throw new Error(`constat absent : ${id} (présents : ${ids(r).join(', ')})`);
  return f;
};
const O = 'https://exemple-artisan.fr';
const page = (path: string, html: string, extra: Partial<PageSpec> = {}): PageSpec => ({ path, html, ...extra });
const simple = (title: string, paras: string[], extra: Parameters<typeof doc>[0] extends infer D ? Partial<D> : never = {}) => doc({ title, h1: title, intro: paras, ...extra });

describe('sites témoins exemplaires : aucun faux positif', () => {
  const cases = [
    ['artisan', artisanSite(), 'local'],
    ['PME', pmeSite(), 'pme'],
    ['boutique', shopSite(), 'ecommerce'],
  ] as const;
  for (const [name, crawl, type] of cases) {
    it(`${name} : aucun constat hors informatif, score 100`, () => {
      const r = auditGeo(crawl, { siteType: type, llmsTxt: { status: 200, text: ARTISAN_LLMS }, now: NOW });
      const real = r.sections.flatMap((s) => s.findings).filter((f) => f.severity !== 'info');
      expect(real.map((f) => `${f.id} : ${f.title}`)).toEqual([]);
      expect(r.score).toBe(100);
      expect(r.siteType).toBe(type);
      expect(r.fanOut.missing).toBe(0);
      expect(r.topFixes).toEqual([]);
      // Hors site non mesuré sans réponses d'IA : pas de liste générique.
      const off = r.sections.find((s) => s.id === 'hors_site')!;
      expect(off.measured).toBe(false);
      expect(off.findings).toEqual([]);
      expect(r.demo).toBe(true); // sous-questions par gabarits
    });
  }

  it('type de site déduit sans indication', () => {
    expect(detectSiteType(geoPages(shopSite()))).toBe('ecommerce');
    expect(detectSiteType(geoPages(artisanSite()))).toBe('local');
    expect(auditGeo(artisanSite(), { now: NOW }).brand).toBe('Plomberie Martin');
  });

  it('sections ordonnées, poids, llms.txt informatif (poids 0)', () => {
    const r = auditGeo(artisanSite(), { now: NOW });
    expect(r.sections.map((s) => s.id)).toEqual(['acces', 'entite', 'passages', 'questions', 'fraicheur', 'donnees', 'hors_site', 'llms']);
    const llms = r.sections.find((s) => s.id === 'llms')!;
    expect(llms.weight).toBe(0);
    expect(llms.findings[0]).toMatchObject({ id: 'geo.llms.unchecked', severity: 'info', autoFix: { kind: 'llms.txt' } });
    expect(r.sections.flatMap((s) => s.findings).every((f) => ['demontre', 'probable', 'hypothese'].includes(f.evidenceLevel))).toBe(true);
  });
});

describe('accès des robots d’IA', () => {
  const site = (robots: string | null, status = 200) => {
    const c = artisanSite();
    c.robots = { url: `${ARTISAN_ORIGIN}/robots.txt`, status, text: robots ?? undefined, sitemaps: [] };
    return c;
  };

  it('robots de recherche bloqués : critique, score plafonné, robots.txt proposé', () => {
    const r = auditGeo(site('User-agent: OAI-SearchBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n'), { now: NOW });
    const f = get(r, 'geo.acces.search_blocked');
    expect(f.severity).toBe('critical');
    expect(f.affected.map((a) => a.detail).join(' ')).toMatch(/OAI-SearchBot.*ligne 2/);
    expect(r.score).toBeLessThanOrEqual(35);
    expect(r.stats.searchBotsBlocked).toEqual(['OAI-SearchBot', 'PerplexityBot']);
    const payload = f.autoFix!.payload as { value: string };
    expect(f.autoFix!.kind).toBe('robots.txt');
    expect(payload.value).toMatch(/User-agent: OAI-SearchBot[\s\S]*Allow: \//);
    expect(payload.value).toMatch(/User-agent: GPTBot[\s\S]*Disallow: \//);
  });

  it('robots.txt en erreur 5xx : tout est interdit', () => {
    const r = auditGeo(site(null, 503), { now: NOW });
    expect(get(r, 'geo.acces.robots_unreachable').severity).toBe('critical');
  });

  it('bloquer seulement l’entraînement : informatif, sans pénalité', () => {
    const r = auditGeo(site('User-agent: GPTBot\nDisallow: /\n\nUser-agent: ClaudeBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n'), { now: NOW, llmsTxt: { status: 200, text: ARTISAN_LLMS } });
    const acc = r.sections.find((s) => s.id === 'acces')!;
    expect(acc.findings.map((f) => [f.id, f.severity])).toEqual([['geo.acces.training_blocked', 'info']]);
    expect(acc.score).toBe(100);
  });

  it('robots de lecture à la demande bloqués, pages partiellement interdites', () => {
    const r = auditGeo(site('User-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: *\nDisallow: /tarifs\n'), { now: NOW });
    expect(get(r, 'geo.acces.user_blocked').severity).toBe('medium');
    const p = get(r, 'geo.acces.partial_block');
    expect(p.affected.map((a) => a.url)).toEqual([`${ARTISAN_ORIGIN}/tarifs`]);
  });

  it('pare-feu : page de vérification anti-robot servie à notre robot', () => {
    const c = makeCrawl(O, [
      page('/', '<html><head><title>Just a moment...</title></head><body><div id="cf-chl-widget"></div></body></html>', { status: 403, headers: { server: 'cloudflare', 'cf-mitigated': 'challenge' } }),
    ]);
    const r = auditGeo(c, { now: NOW });
    const f = get(r, 'geo.acces.firewall');
    expect(f.severity).toBe('high');
    expect(f.evidenceLevel).toBe('probable');
    expect(f.evidence).toMatch(/RepereBot/);
  });

  it('Cloudflare sans blocage : simple vérification conseillée', () => {
    const c = artisanSite();
    c.pages[0].headers.server = 'cloudflare';
    const r = auditGeo(c, { now: NOW });
    expect(get(r, 'geo.acces.cdn_check').severity).toBe('info');
    expect(ids(r)).not.toContain('geo.acces.firewall');
  });

  it('rendu côté client : contenu illisible sans JavaScript', () => {
    const c = makeCrawl(O, [page('/', '<html><head><title>App</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>', { clientRendered: true, scripts: 12 })]);
    const r = auditGeo(c, { now: NOW });
    expect(get(r, 'geo.acces.client_rendered').severity).toBe('critical');
    expect(r.score).toBeLessThanOrEqual(35);
  });

  it('nosnippet / noarchive en en-tête ou méta', () => {
    const c = artisanSite();
    c.pages[1].headers['x-robots-tag'] = 'noarchive';
    c.pages[2].metaRobots = 'index, nosnippet';
    const f = get(auditGeo(c, { now: NOW }), 'geo.acces.snippet_controls');
    expect(f.affectedCount).toBe(2);
    expect(f.severity).toBe('high');
  });
});

describe('entité', () => {
  const foot = 'Plomberie Dupont — 5 rue Victor Hugo, 38000 Grenoble — 04 76 00 11 22';
  const body = ['Plomberie Dupont est un plombier installé à Grenoble depuis 2012. Nous intervenons sous 3 heures dans 18 communes de l’agglomération grenobloise pour les fuites, les chauffe-eau et les débouchages, avec un devis gratuit.'];

  it('sans JSON-LD : bloc LocalBusiness proposé avec les seules valeurs trouvées', () => {
    const c = makeCrawl(O, [page('/', simple('Plomberie Dupont', body, { footer: foot, siteName: 'Plomberie Dupont' })), page('/contact', simple('Contact', ['Appelez le 04 76 00 11 22.'], { footer: foot }))]);
    const r = auditGeo(c, { siteType: 'artisan', now: NOW });
    const f = get(r, 'geo.entite.no_jsonld');
    expect(f.severity).toBe('high');
    const v = (f.autoFix!.payload as { value: Record<string, unknown> }).value;
    const s = JSON.stringify(v);
    expect(s).toContain('Plomberie Dupont');
    expect(s).toContain('+33 4 76 00 11 22');
    expect(s).not.toMatch(/openingHours|foundingDate|priceRange/); // rien d'inventé
  });

  it('téléphone balisé absent du site, fiche de vérité contradictoire, noms divergents', () => {
    const ld = { '@context': 'https://schema.org', '@type': 'Plumber', name: 'SARL Dupont & Fils Chauffage', telephone: '+33 4 76 99 99 99', address: { '@type': 'PostalAddress', postalCode: '38100', addressLocality: 'Grenoble' }, sameAs: ['https://www.facebook.com/x'] };
    const c = makeCrawl(O, [page('/', simple('Plomberie Dupont', body, { footer: foot, siteName: 'Plomberie Dupont', jsonLd: [ld] }))]);
    const r = auditGeo(c, { siteType: 'local', facts: { telephone: '04 76 55 55 55', adresse: '9 avenue Alsace-Lorraine, 38000 Grenoble' }, now: NOW });
    expect(get(r, 'geo.entite.phone_mismatch').severity).toBe('high');
    expect(get(r, 'geo.entite.facts_phone').title).toContain('04 76 55 55 55');
    expect(get(r, 'geo.entite.address_mismatch').affected[0].detail).toContain('38100');
    expect(get(r, 'geo.entite.name_inconsistent').evidence).toContain('Plomberie Dupont');
  });

  it('sameAs manquant (avec profils liés), pas de page à propos, articles sans auteur', () => {
    const ld = { '@context': 'https://schema.org', '@type': 'Organization', name: 'Planiflow', telephone: '+33 2 40 11 22 33' };
    const c = makeCrawl('https://pme.fr', [
      page('/', simple('Planiflow', ['Planiflow est un logiciel de planning pour les PME de 10 à 500 salariés, édité à Nantes depuis 2016 et utilisé par 1 200 entreprises. Téléphone : 02 40 11 22 33.'], { jsonLd: [ld], footer: '<a href="https://www.linkedin.com/company/planiflow">LinkedIn</a>' })),
      page('/blog/a', simple('Article A', ['Le planning des équipes terrain demande de prévoir 15 à 20 minutes de trajet entre deux interventions en ville, selon nos données de 2025 portant sur 85 000 interventions.'])),
      page('/blog/b', simple('Article B', ['Le Code du travail impose 11 heures de repos quotidien entre deux journées de travail, ce qui contraint fortement les plannings des équipes d’intervention.'])),
    ]);
    const r = auditGeo(c, { siteType: 'pme', now: NOW });
    const sa = get(r, 'geo.entite.no_sameas');
    expect((sa.autoFix!.payload as { merge: { sameAs: string[] } }).merge.sameAs).toEqual(['https://www.linkedin.com/company/planiflow']);
    expect(get(r, 'geo.entite.no_about').severity).toBe('medium');
    expect(get(r, 'geo.entite.no_author').affectedCount).toBe(2);
  });
});

describe('passages', () => {
  it('découpe par section titrée, notation des critères', () => {
    const ps = geoPages(artisanSite()).flatMap(extractPassages).map((p) => scorePassage(p, 'Plomberie Martin'));
    const prix = ps.find((p) => p.heading?.startsWith('Combien coûte'))!;
    expect(prix.headingIsQuestion).toBe(true);
    expect(prix.criteria).toMatchObject({ chiffre: true, date: true, reponse: true, autonome: true });
    expect(prix.score).toBeGreaterThanOrEqual(70);
  });

  it('passages faibles : constat avec réécritures déterministes sans fait inventé', () => {
    const weak = [
      'Il est vraiment très important de faire appel à un professionnel sérieux et compétent pour tous vos travaux de plomberie et de chauffage, car cela vous évitera bien des soucis et des désagréments par la suite dans votre maison ou votre appartement.',
      'Bienvenue sur notre site. Nous sommes une équipe passionnée qui met tout son savoir-faire à votre service avec sérieux, écoute et professionnalisme pour répondre à toutes vos attentes au quotidien, que vous soyez un particulier ou un professionnel du secteur du bâtiment.',
      'Cela fait partie de nos valeurs essentielles : la qualité du travail bien fait, le respect des délais et la satisfaction de nos clients sont au cœur de notre démarche depuis toujours, chez nous comme chez vous, sur chaque chantier que nous menons.',
    ];
    const c = makeCrawl(O, [page('/', doc({ title: 'Plomberie Dupont', h1: 'Plomberie Dupont', sections: [['Nos services', weak[0]], ['Notre équipe', weak[1]], ['Nos valeurs', weak[2]]] }))]);
    const r = auditGeo(c, { brand: 'Plomberie Dupont', now: NOW });
    const f = get(r, 'geo.passages.weak');
    expect(f.autoFix!.kind).toBe('rewrite');
    const items = (f.autoFix!.payload as { items: { before: string; value: string; mode: string }[] }).items;
    expect(items).toHaveLength(3);
    expect(items.every((i) => i.mode === 'deterministe')).toBe(true);
    const first = items.find((i) => i.before.startsWith('Il est'))!;
    expect(first.value.startsWith('Il est vraiment très important')).toBe(true); // tournure impersonnelle : pronom gardé
    expect(first.value).toContain('[à compléter');
    expect(items.find((i) => i.before.startsWith('Bienvenue'))!.value).not.toMatch(/^Bienvenue/);
    for (const i of items) expect(i.value.match(/\d/g) ?? []).toEqual([]); // aucun chiffre inventé
    expect(r.passages.toRewrite).toHaveLength(3);
  });

  it('aucun texte exploitable', () => {
    const c = makeCrawl(O, [page('/', simple('Accueil', ['Bienvenue !']))]);
    expect(get(auditGeo(c, { now: NOW }), 'geo.passages.none').severity).toBe('high');
  });

  it('peu de chiffres et réponses indirectes aux questions', () => {
    const qa: [string, string][] = [
      ['Pourquoi nous choisir ?', 'Notre entreprise familiale met un point d’honneur à satisfaire chaque client avec sérieux et réactivité, dans le respect des règles de l’art et avec une écoute attentive de vos besoins.'],
      ['Comment travaillons-nous ?', 'Notre équipe se déplace chez vous pour comprendre votre besoin, puis vous propose la solution la plus adaptée, toujours avec transparence et dans un esprit de confiance réciproque.'],
      ['Quels services proposons-nous ?', 'Notre savoir-faire couvre de nombreux domaines de la plomberie et du chauffage, pour les particuliers comme pour les professionnels de la région, avec le même niveau d’exigence.'],
      ['Que faire en cas de fuite ?', 'Gardez votre calme et contactez-nous rapidement afin que notre équipe puisse vous aider au mieux selon la situation que vous rencontrez chez vous, à toute heure de la journée.'],
      ['Quelle est notre philosophie ?', 'Notre philosophie repose sur la confiance, la proximité et le travail soigné : chaque chantier compte et chaque client mérite toute notre attention, quelle que soit la taille du projet.'],
    ];
    const c = makeCrawl(O, [page('/', doc({ title: 'Plomberie', h1: 'Plomberie', sections: qa }))]);
    const r = auditGeo(c, { now: NOW });
    expect(get(r, 'geo.passages.no_numbers').severity).toBe('medium');
    expect(get(r, 'geo.passages.indirect_answers').affectedCount).toBeGreaterThanOrEqual(3);
  });
});

describe('couverture des questions (fan-out)', () => {
  it('sous-questions sans réponse : FAQ proposée, réponses tirées de la fiche ou à compléter', () => {
    const c = makeCrawl(O, [page('/', simple('Plomberie Dupont', ['Plomberie Dupont est un plombier installé à Grenoble depuis 2012 qui réalise des installations de salles de bains complètes pour les particuliers et les copropriétés.']))]);
    const r = auditGeo(c, { siteType: 'local', brand: 'Plomberie Dupont', trade: 'plombier', city: 'Grenoble', facts: { prix: 'Déplacement 80 € TTC', zone: 'Grenoble et 18 communes' }, now: NOW });
    expect(r.fanOut.source).toBe('modele');
    expect(r.fanOut.items[0].question).toBe('Combien coûte l’intervention d’un plombier à Grenoble ?');
    const f = get(r, 'geo.questions.uncovered');
    expect(f.severity).toBe('high');
    const p = f.autoFix!.payload as { value: { question: string; answer: string; from: string }[]; jsonld?: { mainEntity: unknown[] } };
    expect(f.autoFix!.kind).toBe('faq');
    expect(p.value.find((x) => x.question.startsWith('Combien'))).toMatchObject({ answer: 'Déplacement 80 € TTC', from: 'fiche' });
    expect(p.value.filter((x) => x.from === 'a_completer').every((x) => x.answer === '[à compléter]')).toBe(true);
    expect(p.value.filter((x) => x.from === 'a_completer').length).toBeGreaterThan(3);
    expect(p.jsonld!.mainEntity).toHaveLength(2); // seules les réponses de la fiche sont balisées
  });

  it('sous-questions fournies par l’IA (précalculées)', () => {
    const r = auditGeo(artisanSite(), {
      now: NOW,
      fanOut: [
        { id: 'a', question: 'Quel est le prix du remplacement d’un chauffe-eau de 200 litres à Lyon ?', facet: 'prix', seed: 's', source: 'ia' },
        { id: 'b', question: 'Plomberie Martin répare-t-il les piscines enterrées ?', facet: 'autre', seed: 's', source: 'ia' },
      ],
    });
    expect(r.fanOut.source).toBe('ia');
    expect(r.fanOut.items.map((i) => i.status)).toEqual(['couverte', 'absente']);
    expect(r.demo).toBe(false);
  });
});

describe('fraîcheur et données structurées', () => {
  it('article sans date, date future, tarifs datés', () => {
    const c = makeCrawl(O, [
      page('/', simple('Accueil', ['Plomberie Dupont publie ses tarifs 2022 pour le dépannage à Grenoble : 80 € le déplacement et 50 € de l’heure, pour 18 communes.'])),
      page('/blog/conseils-fuite', simple('Que faire en cas de fuite ?', ['Coupez l’arrivée d’eau au compteur, puis appelez un plombier : une fuite de 1 litre par heure représente 8 760 litres par an.'], { ogType: 'article' })),
      page('/blog/autre', simple('Autre article', ['Le chauffe-eau thermodynamique consomme 3 fois moins qu’un chauffe-eau électrique classique, selon l’ADEME, pour un coût d’achat de 2 500 € environ.'], { jsonLd: [{ '@type': 'BlogPosting', headline: 'x', datePublished: '2027-05-01', author: 'X' }] })),
    ]);
    const r = auditGeo(c, { now: NOW });
    expect(get(r, 'geo.fraicheur.no_visible_date').affectedCount).toBe(2);
    expect(get(r, 'geo.fraicheur.future_date').affected[0].url).toContain('/blog/autre');
    expect(get(r, 'geo.fraicheur.stale_prices').affected[0].detail).toBe('tarifs 2022');
    expect(get(r, 'geo.fraicheur.no_datemodified').affectedCount).toBe(1);
  });

  it('fiches produit sans balisage, prix balisé faux, FAQ balisée invisible, JSON-LD illisible', () => {
    const prod = (slug: string, ld?: unknown) =>
      page(`/produits/${slug}`, simple(`Savon ${slug}`, [`Le savon ${slug} de la Savonnerie contient 5 % d’huile essentielle. Prix : 8,90 € TTC. Ajouter au panier, en stock.`], { ogType: 'product', jsonLd: ld ? [ld] : [] }));
    const c = makeCrawl('https://boutique.fr', [
      page('/', simple('Boutique', ['La Savonnerie fabrique 14 savons à Annecy depuis 2018.'], { jsonLd: [{ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'Livrez-vous en Belgique ?', acceptedAnswer: { '@type': 'Answer', text: 'Oui' } }] }], head: '<script type="application/ld+json">{ "@type": "Organization", </script>' })),
      prod('lavande'),
      prod('miel', { '@type': 'Product', name: 'Savon miel', offers: { '@type': 'Offer', price: '12.50', priceCurrency: 'EUR' } }),
    ]);
    const r = auditGeo(c, { now: NOW });
    expect(r.siteType).toBe('ecommerce');
    const p = get(r, 'geo.donnees.product');
    expect(p.severity).toBe('high');
    expect(p.affected.map((a) => a.url)).toEqual(['https://boutique.fr/produits/lavande']);
    expect(get(r, 'geo.donnees.price_mismatch').affected[0].detail).toContain('12.50');
    expect(get(r, 'geo.donnees.faq_not_visible').severity).toBe('medium');
    expect(get(r, 'geo.donnees.syntax').affectedCount).toBe(1);
  });
});

describe('llms.txt (informatif)', () => {
  it('absent : info + fichier proposé ; mal formé : info', () => {
    const miss = get(auditGeo(artisanSite(), { now: NOW, llmsTxt: { status: 404 } }), 'geo.llms.missing');
    expect(miss.severity).toBe('info');
    expect((miss.autoFix!.payload as { value: string }).value).toMatch(/^# Plomberie Martin/);
    expect(get(auditGeo(artisanSite(), { now: NOW, llmsTxt: { status: 200, text: 'bonjour' } }), 'geo.llms.invalid').severity).toBe('info');
  });
});

describe('présence hors site', () => {
  it('à partir des sources citées par les IA : catégories, part du site, présence liée / absente', () => {
    const r = auditGeo(artisanSite(), {
      now: NOW,
      engineSources: [
        { url: 'https://www.pagesjaunes.fr/annuaire/lyon/plombiers', count: 9, providers: ['chatgpt', 'perplexity'] },
        { url: 'https://www.travaux.com/plombier/lyon', count: 6, clientPresent: false },
        { url: 'https://www.reddit.com/r/lyon/comments/abc', count: 5, providers: ['perplexity'] },
        { url: 'https://fr.wikipedia.org/wiki/Plomberie', count: 1 },
        { url: `${ARTISAN_ORIGIN}/tarifs`, count: 4 },
      ],
    });
    expect(r.offsite.measured).toBe(true);
    expect(r.offsite.totalCitations).toBe(25);
    expect(r.offsite.ownShare).toBeCloseTo(0.16);
    const pj = r.offsite.domains.find((d) => d.domain === 'pagesjaunes.fr')!;
    expect(pj.clientPresence).toBe('liee'); // le site lie sa fiche PagesJaunes
    const ann = get(r, 'geo.sources.annuaires');
    expect(ann.affected.map((a) => a.url)).toEqual(['https://travaux.com']);
    expect(ann.affected[0].detail).toContain('absence vérifiée');
    expect(get(r, 'geo.sources.forums').severity).toBe('high');
    expect(get(r, 'geo.sources.wikipedia').severity).toBe('low');
    expect(ids(r)).not.toContain('geo.sources.own_never_cited');
  });

  it('réponses brutes des IA (moteur) ; site jamais cité', () => {
    const ans = (provider: ProviderAnswer['provider'], urls: string[]): ProviderAnswer => ({ provider, queryId: 'q1', run: 1, text: 'Réponse', citations: urls, demo: false });
    const r = auditGeo(artisanSite(), {
      now: NOW,
      aiAnswers: [ans('chatgpt', ['https://www.tripadvisor.fr/x', 'https://www.leprogres.fr/a']), ans('perplexity', ['https://www.tripadvisor.fr/y', 'https://www.leprogres.fr/b', 'https://www.amazon.fr/c'])],
    });
    expect(r.offsite.totalCitations).toBe(5);
    expect(get(r, 'geo.sources.avis').affected[0].detail).toContain('chatgpt, perplexity');
    expect(get(r, 'geo.sources.medias').effort).toBe(3);
    expect(get(r, 'geo.sources.own_never_cited').severity).toBe('medium');
  });
});

describe('priorités', () => {
  it('topFixes triés par sévérité puis impact/effort, sans constats informatifs', () => {
    const c = artisanSite();
    c.robots = { url: `${ARTISAN_ORIGIN}/robots.txt`, status: 200, text: 'User-agent: OAI-SearchBot\nDisallow: /\n', sitemaps: [] };
    c.pages[0].metaRobots = 'nosnippet';
    const r = auditGeo(c, { now: NOW });
    expect(r.topFixes[0].id).toBe('geo.acces.search_blocked');
    expect(r.topFixes[1].id).toBe('geo.acces.snippet_controls');
    expect(r.topFixes.every((f) => f.severity !== 'info')).toBe(true);
    for (const f of r.sections.flatMap((s) => s.findings)) {
      expect(f.affected.length).toBeLessThanOrEqual(200);
      expect(f.affectedCount).toBeGreaterThanOrEqual(f.affected.length);
    }
  });
});
