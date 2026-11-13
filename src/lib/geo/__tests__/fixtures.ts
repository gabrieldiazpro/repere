/**
 * Faux `SiteCrawl` pour les tests GEO : constructeur de pages à partir de HTML + 3 sites témoins exemplaires
 * (artisan, PME, boutique) sur lesquels l'audit ne doit relever AUCUN défaut (hors constats informatifs).
 */
import type { CrawledPage, SiteCrawl } from '@/lib/crawl/types';
import { parseHtml, wordCount } from '@/lib/siteaudit/html';

export interface PageSpec {
  path: string;
  html: string;
  depth?: number;
  status?: number;
  headers?: Record<string, string>;
  scripts?: number;
  clientRendered?: boolean;
}

/** Page explorée construite à partir de son HTML (mêmes champs que CRAWL). */
export function crawledPage(origin: string, spec: PageSpec): CrawledPage {
  const url = new URL(spec.path, origin).toString();
  const p = parseHtml(spec.html);
  const jsonLd: unknown[] = [];
  const jsonLdErrors: string[] = [];
  for (const raw of p.jsonLdRaw) {
    try {
      jsonLd.push(JSON.parse(raw));
    } catch (e) {
      jsonLdErrors.push((e as Error).message);
    }
  }
  const words = wordCount(p.bodyText);
  return {
    url,
    finalUrl: url,
    status: spec.status ?? 200,
    redirectChain: [],
    depth: spec.depth ?? (spec.path === '/' ? 0 : 1),
    contentType: 'text/html; charset=utf-8',
    bytes: spec.html.length,
    fetchMs: 20,
    headers: { 'content-type': 'text/html; charset=utf-8', ...(spec.headers ?? {}) },
    html: spec.html,
    title: p.title,
    metaDescription: p.metaDescription ?? undefined,
    metaRobots: p.metaRobots ?? undefined,
    canonical: p.canonical ?? undefined,
    lang: p.lang ?? undefined,
    hreflang: [],
    h1: p.headings.filter((h) => h.level === 1).map((h) => h.text),
    headings: p.headings,
    wordCount: words,
    textHash: String(p.bodyText.length),
    images: [],
    jsonLd,
    jsonLdErrors,
    openGraph: p.og,
    internalLinks: p.links.filter((l) => l.href.startsWith('/')).length,
    externalLinks: p.links.filter((l) => /^https?:/.test(l.href)).length,
    isIndexable: (spec.status ?? 200) === 200 && !/noindex/i.test(p.metaRobots ?? ''),
    renderHints: { scriptsCount: spec.scripts ?? p.scriptsCount, textToHtmlRatio: 0.3, likelyClientRendered: spec.clientRendered ?? false },
  };
}

export function makeCrawl(origin: string, pages: PageSpec[], robots: SiteCrawl['robots'] | 'default' = 'default'): SiteCrawl {
  return {
    startUrl: `${origin}/`,
    origin,
    finalOrigin: origin,
    startedAt: '2026-11-13T09:00:00.000Z',
    durationMs: 1200,
    truncated: false,
    robots: robots === 'default' ? { url: `${origin}/robots.txt`, status: 200, text: `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`, sitemaps: [`${origin}/sitemap.xml`] } : robots,
    sitemaps: [{ url: `${origin}/sitemap.xml`, status: 200, urlCount: pages.length, errors: [] }],
    sitemapUrls: pages.map((p) => new URL(p.path, origin).toString()),
    pages: pages.map((p) => crawledPage(origin, p)),
    links: [],
    errors: [],
  };
}

/* ------------------------------------------------------------------ */
/* Gabarit HTML                                                        */
/* ------------------------------------------------------------------ */

export interface DocSpec {
  title: string;
  h1: string;
  intro?: string[];
  sections?: [string, string | string[]][];
  jsonLd?: unknown[];
  /** FAQPage automatique à partir des sections-questions. */
  faqLd?: boolean;
  head?: string;
  footer?: string;
  nav?: string;
  siteName?: string;
  ogType?: string;
  extraMain?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

export function doc(d: DocSpec): string {
  const sections = d.sections ?? [];
  const faq = d.faqLd
    ? [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: sections.filter(([q]) => q.endsWith('?')).map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: Array.isArray(a) ? a.join(' ') : a } })),
        },
      ]
    : [];
  const ld = [...(d.jsonLd ?? []), ...faq].map((x) => `<script type="application/ld+json">${JSON.stringify(x)}</script>`).join('\n');
  const body = sections.map(([h, a]) => `<h2>${esc(h)}</h2>\n${(Array.isArray(a) ? a : [a]).map((x) => (x.startsWith('<') ? x : `<p>${x}</p>`)).join('\n')}`).join('\n');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(d.title)}</title>
<meta name="description" content="${esc(d.title)}">
${d.siteName ? `<meta property="og:site_name" content="${esc(d.siteName)}">` : ''}
${d.ogType ? `<meta property="og:type" content="${d.ogType}">` : ''}
${d.head ?? ''}
${ld}
</head><body>
<header><nav>${d.nav ?? '<a href="/">Accueil</a>'}</nav></header>
<main>
<h1>${esc(d.h1)}</h1>
${(d.intro ?? []).map((p) => (p.startsWith('<') ? p : `<p>${p}</p>`)).join('\n')}
${body}
${d.extraMain ?? ''}
</main>
<footer>${d.footer ?? ''}</footer>
</body></html>`;
}

/* ------------------------------------------------------------------ */
/* Témoin 1 : artisan (plombier à Lyon)                                */
/* ------------------------------------------------------------------ */

export const ARTISAN_ORIGIN = 'https://plomberie-martin.fr';
const A_NAV = '<a href="/">Accueil</a><a href="/tarifs">Tarifs</a><a href="/a-propos">À propos</a><a href="/contact">Contact</a><a href="/blog/detartrer-chauffe-eau">Conseils</a>';
const A_FOOT =
  'Plomberie Martin — 12 rue Paul Bert, 69003 Lyon — <a href="tel:+33478123456">04 78 12 34 56</a> — <a href="mailto:contact@plomberie-martin.fr">contact@plomberie-martin.fr</a> — <a href="https://www.facebook.com/plomberiemartin">Facebook</a> <a href="https://www.pagesjaunes.fr/pros/123">PagesJaunes</a>';
const A_ORG = {
  '@context': 'https://schema.org',
  '@type': 'Plumber',
  name: 'Plomberie Martin',
  url: `${ARTISAN_ORIGIN}/`,
  telephone: '+33 4 78 12 34 56',
  email: 'contact@plomberie-martin.fr',
  address: { '@type': 'PostalAddress', streetAddress: '12 rue Paul Bert', postalCode: '69003', addressLocality: 'Lyon', addressCountry: 'FR' },
  openingHours: 'Mo-Fr 08:00-19:00',
  sameAs: ['https://www.facebook.com/plomberiemartin', 'https://www.pagesjaunes.fr/pros/123'],
};

export function artisanSite(): SiteCrawl {
  const common = { nav: A_NAV, footer: A_FOOT, siteName: 'Plomberie Martin' };
  return makeCrawl(ARTISAN_ORIGIN, [
    {
      path: '/',
      html: doc({
        ...common,
        title: 'Plombier à Lyon 3e | Plomberie Martin',
        h1: 'Plomberie Martin, plombier à Lyon 3e',
        jsonLd: [A_ORG],
        faqLd: true,
        intro: [
          'Plomberie Martin est une entreprise de plomberie installée à Lyon 3e depuis 2009. Julien Martin et ses 4 techniciens interviennent sous 2 heures pour les fuites, les débouchages et les pannes de chauffe-eau dans 25 communes du Grand Lyon, avec un devis gratuit avant toute intervention.',
        ],
        sections: [
          ['Combien coûte l’intervention d’un plombier à Lyon ?', 'Comptez 90 € TTC chez Plomberie Martin pour le déplacement et la première heure de main-d’œuvre, puis 55 € TTC par heure supplémentaire. Le remplacement d’un chauffe-eau de 200 litres coûte entre 1 200 € et 1 800 € TTC, pose comprise, selon notre grille mise à jour le 2 septembre 2026.'],
          ['Quel est le délai d’intervention de Plomberie Martin ?', 'Plomberie Martin intervient sous 2 heures en moyenne à Lyon et à Villeurbanne, et sous 4 heures dans le reste du Grand Lyon. En 2025, 92 % de nos 1 340 interventions ont commencé dans le délai annoncé au téléphone.'],
          ['Dans quelles communes intervenez-vous ?', 'Nous intervenons dans 25 communes du Grand Lyon : Lyon (69001 à 69009), Villeurbanne, Bron, Vénissieux, Caluire-et-Cuire, Écully, Oullins et Saint-Fons. Le déplacement est inclus dans le forfait de 90 € TTC pour toutes ces communes.'],
          ['Plomberie Martin intervient-il en urgence le week-end ?', 'Oui, Plomberie Martin assure les urgences 7 jours sur 7, y compris le dimanche et les jours fériés, de 7 h à 22 h. La majoration d’urgence du week-end est de 30 € TTC, annoncée avant le départ du technicien.'],
          ['Quels sont vos horaires d’ouverture ?', 'Le bureau de Plomberie Martin est ouvert du lundi au vendredi de 8 h à 19 h et le samedi de 9 h à 13 h. En dehors de ces horaires, la ligne d’urgence au 04 78 12 34 56 reste joignable de 7 h à 22 h.'],
          ['Comment contacter Plomberie Martin ?', 'Appelez Plomberie Martin au 04 78 12 34 56 ou écrivez à contact@plomberie-martin.fr : un technicien vous rappelle en moins de 15 minutes pendant les horaires d’ouverture, avec une estimation du prix avant déplacement.'],
          ['Plomberie Martin est-il assuré et certifié ?', 'Oui, Plomberie Martin est assuré en garantie décennale auprès de la MAAF (contrat n° 4521) et certifié RGE Qualibat depuis 2018 pour l’installation de chauffe-eau thermodynamiques. Les attestations sont envoyées avec chaque devis.'],
          ['Que disent les avis clients sur Plomberie Martin ?', 'Plomberie Martin obtient 4,8/5 sur 312 avis Google au 1er novembre 2026. Les clients citent surtout la ponctualité et le prix annoncé avant l’intervention, selon l’analyse de nos avis publiée sur cette page.'],
          ['Comment choisir un plombier à Lyon ?', 'Pour bien choisir un plombier à Lyon, vérifiez 3 critères : une assurance décennale valide, un devis écrit avant travaux et des avis récents. Selon la DGCCRF, le devis est obligatoire au-delà de 150 € TTC pour les travaux de dépannage à domicile.'],
          ['Comment se déroule une intervention ?', 'Une intervention de Plomberie Martin se déroule en 4 étapes : diagnostic au téléphone, devis écrit sur place, réparation, puis facture détaillée envoyée le jour même. La durée moyenne d’un dépannage est de 1 heure et 20 minutes.'],
        ],
      }),
    },
    {
      path: '/tarifs',
      html: doc({
        ...common,
        title: 'Tarifs plomberie 2026 à Lyon | Plomberie Martin',
        h1: 'Tarifs de Plomberie Martin',
        intro: [
          'Les tarifs 2026 de Plomberie Martin sont fixes et affichés avant chaque intervention à Lyon : 90 € TTC pour le déplacement et la première heure, 55 € TTC par heure supplémentaire, et un débouchage simple facturé 120 € TTC. Grille mise à jour le 2 septembre 2026.',
          'Le remplacement d’un chauffe-eau électrique de 200 litres par Plomberie Martin coûte entre 1 200 € et 1 800 € TTC selon le modèle, pose et évacuation de l’ancien appareil comprises. Le taux de TVA réduit de 10 % s’applique aux logements de plus de 2 ans, selon service-public.fr.',
        ],
      }),
    },
    {
      path: '/a-propos',
      html: doc({
        ...common,
        title: 'À propos de Plomberie Martin',
        h1: 'À propos de Plomberie Martin',
        intro: [
          'Plomberie Martin est une entreprise artisanale fondée en 2009 par Julien Martin, plombier chauffagiste diplômé d’un brevet professionnel. L’équipe compte 5 personnes à Lyon 3e et a réalisé plus de 9 000 interventions dans le Grand Lyon depuis sa création.',
        ],
      }),
    },
    {
      path: '/contact',
      html: doc({ ...common, title: 'Contact | Plomberie Martin', h1: 'Contacter Plomberie Martin', intro: ['Téléphone : 04 78 12 34 56. Adresse : 12 rue Paul Bert, 69003 Lyon.'] }),
    },
    {
      path: '/blog/detartrer-chauffe-eau',
      depth: 1,
      html: doc({
        ...common,
        title: 'Faut-il détartrer son chauffe-eau ? | Plomberie Martin',
        h1: 'Faut-il détartrer son chauffe-eau ?',
        ogType: 'article',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: 'Faut-il détartrer son chauffe-eau ?',
            author: { '@type': 'Person', name: 'Julien Martin' },
            datePublished: '2026-03-03',
            dateModified: '2026-09-02',
          },
        ],
        intro: ['<p class="byline">Par Julien Martin, plombier chauffagiste — publié le 3 mars 2026, mis à jour le 2 septembre 2026</p>'],
        sections: [
          ['Tous les combien faut-il détartrer un chauffe-eau ?', 'Comptez un détartrage tous les 2 ans à Lyon, où l’eau est dure (environ 30 °f selon la Métropole de Lyon). Un détartrage par Plomberie Martin coûte 150 € TTC et dure 1 heure 30 en moyenne.'],
          ['Pourquoi détartrer son chauffe-eau ?', 'Le tartre augmente la consommation électrique d’un chauffe-eau : selon l’ADEME, 1 mm de tartre sur la résistance accroît la consommation d’environ 10 %. Détartrer prolonge aussi la durée de vie de l’appareil, estimée à 10 à 15 ans.'],
        ],
      }),
    },
  ]);
}

export const ARTISAN_LLMS = `# Plomberie Martin\n\n> Plombier à Lyon 3e depuis 2009 : dépannage, chauffe-eau, débouchage.\n\n## Pages principales\n\n- [Tarifs](${ARTISAN_ORIGIN}/tarifs): grille 2026\n`;

/* ------------------------------------------------------------------ */
/* Témoin 2 : PME B2B (logiciel de planning)                           */
/* ------------------------------------------------------------------ */

export const PME_ORIGIN = 'https://planiflow.fr';
const P_NAV = '<a href="/">Accueil</a><a href="/tarifs">Tarifs</a><a href="/a-propos">Qui sommes-nous</a><a href="/blog/planning-equipes-terrain">Blog</a>';
const P_FOOT = 'Planiflow SAS — 8 quai de la Fosse, 44000 Nantes — 02 40 11 22 33 — <a href="https://www.linkedin.com/company/planiflow">LinkedIn</a>';
const P_ORG = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Planiflow',
  url: `${PME_ORIGIN}/`,
  telephone: '+33 2 40 11 22 33',
  address: { '@type': 'PostalAddress', streetAddress: '8 quai de la Fosse', postalCode: '44000', addressLocality: 'Nantes', addressCountry: 'FR' },
  foundingDate: '2016',
  sameAs: ['https://www.linkedin.com/company/planiflow', 'https://www.capterra.fr/software/123/planiflow'],
};

export function pmeSite(): SiteCrawl {
  const common = { nav: P_NAV, footer: P_FOOT, siteName: 'Planiflow' };
  return makeCrawl(PME_ORIGIN, [
    {
      path: '/',
      html: doc({
        ...common,
        title: 'Logiciel de planning pour équipes terrain | Planiflow',
        h1: 'Planiflow, le logiciel de planning des équipes terrain',
        jsonLd: [P_ORG],
        faqLd: true,
        intro: [
          'Planiflow est un logiciel de planning en ligne conçu à Nantes depuis 2016 pour les PME de 10 à 500 salariés qui gèrent des équipes terrain : maintenance, nettoyage, aide à domicile. Plus de 1 200 entreprises françaises l’utilisent pour planifier 85 000 interventions par semaine.',
        ],
        sections: [
          ['Combien coûte Planiflow ?', 'Planiflow coûte 9 € HT par utilisateur et par mois en formule Essentiel, et 15 € HT en formule Pro avec la géolocalisation et les rapports d’intervention. L’essai est gratuit pendant 30 jours, sans carte bancaire, selon la grille publiée le 1er octobre 2026.'],
          ['À quelles entreprises s’adresse Planiflow ?', 'Planiflow s’adresse aux PME et ETI de 10 à 500 salariés dont les équipes interviennent chez des clients : entreprises de propreté, de maintenance, de sécurité et services d’aide à domicile. 70 % de nos clients ont entre 20 et 150 salariés.'],
          ['Quelles références clients Planiflow peut-il citer ?', 'Planiflow compte parmi ses clients Net’Ouest Propreté (320 salariés), Atlantique Maintenance et l’ADMR de Loire-Atlantique, qui planifie 2 400 visites par semaine avec Planiflow depuis 2021. Les études de cas sont publiées sur notre site.'],
          ['Comment se déroule la mise en place de Planiflow ?', 'La mise en place de Planiflow se déroule en 3 étapes : import de vos salariés et clients depuis un fichier Excel, paramétrage des tournées avec un chef de projet, puis formation de 2 heures à distance pour les planificateurs.'],
          ['Quels sont les délais de mise en place ?', 'Comptez 2 semaines en moyenne entre la signature et le premier planning publié avec Planiflow ; 10 jours ouvrés pour les entreprises de moins de 50 salariés. Le chef de projet fixe la date de démarrage dès la signature.'],
          ['Quelles différences entre Planiflow et un tableur ?', 'Contrairement à un tableur, Planiflow envoie le planning sur le téléphone de chaque intervenant, détecte les conflits d’horaires et calcule les temps de trajet. Selon une enquête menée auprès de 214 clients en 2025, la planification prend 3 heures de moins par semaine.'],
          ['Planiflow est-il certifié ?', 'Oui, Planiflow est certifié ISO 27001 depuis 2022 et héberge les données en France chez OVHcloud, à Roubaix. Le contrat comprend une garantie de disponibilité de 99,9 % et un accord de traitement des données conforme au RGPD.'],
          ['Où est basé Planiflow ?', 'Planiflow est basé à Nantes (44000) et accompagne des clients dans toute la France métropolitaine, en Belgique et en Suisse. L’équipe support de 12 personnes répond en français du lundi au vendredi de 8 h 30 à 18 h.'],
          ['Que disent les clients de Planiflow ?', 'Planiflow obtient 4,7/5 sur 186 avis Capterra au 1er novembre 2026. Les avis citent la simplicité de l’application mobile et la réactivité du support, qui répond en 2 heures en moyenne selon nos statistiques de 2025.'],
          ['Comment obtenir une démonstration de Planiflow ?', 'Demandez une démonstration de 30 minutes en ligne sur planiflow.fr ou appelez le 02 40 11 22 33 : un conseiller vous contacte sous 24 heures ouvrées pour présenter Planiflow avec vos propres données.'],
        ],
      }),
    },
    {
      path: '/tarifs',
      html: doc({
        ...common,
        title: 'Tarifs | Planiflow',
        h1: 'Tarifs de Planiflow',
        intro: [
          'Planiflow facture 9 € HT par utilisateur et par mois en formule Essentiel et 15 € HT en formule Pro, sans engagement de durée, selon la grille publiée le 1er octobre 2026. Au-delà de 200 utilisateurs, un tarif dégressif de 20 % s’applique sur devis.',
        ],
      }),
    },
    {
      path: '/a-propos',
      html: doc({
        ...common,
        title: 'Qui sommes-nous | Planiflow',
        h1: 'Qui sommes-nous',
        intro: [
          'Planiflow est une société par actions simplifiée fondée à Nantes en 2016 par Claire Robin et Malik Diallo, anciens responsables d’exploitation dans la propreté. L’entreprise emploie 38 salariés en 2026 et a été lauréate du réseau Initiative Nantes en 2017.',
        ],
      }),
    },
    {
      path: '/blog/planning-equipes-terrain',
      html: doc({
        ...common,
        title: 'Planifier des équipes terrain : 5 règles | Planiflow',
        h1: 'Planifier des équipes terrain : 5 règles',
        ogType: 'article',
        jsonLd: [{ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: 'Planifier des équipes terrain', author: { '@type': 'Person', name: 'Claire Robin' }, datePublished: '2026-05-12', dateModified: '2026-10-01' }],
        intro: ['<p>Par Claire Robin, cofondatrice de Planiflow — publié le 12 mai 2026, mis à jour le 1er octobre 2026</p>'],
        sections: [
          ['Combien de temps prévoir entre deux interventions ?', 'Comptez 15 à 20 minutes de trajet entre deux interventions en ville, selon les données de 85 000 interventions hebdomadaires planifiées avec Planiflow en 2025. En zone rurale, la médiane monte à 32 minutes.'],
          ['Quelle règle légale pour les temps de repos ?', 'Le Code du travail impose 11 heures de repos quotidien consécutif entre deux journées de travail (article L3131-1, sur legifrance.gouv.fr). Planiflow bloque automatiquement toute affectation qui ne respecte pas ce minimum.'],
        ],
      }),
    },
  ]);
}

/* ------------------------------------------------------------------ */
/* Témoin 3 : boutique en ligne (savonnerie)                           */
/* ------------------------------------------------------------------ */

export const SHOP_ORIGIN = 'https://savonnerie-du-lac.fr';
const S_NAV = '<a href="/">Accueil</a><a href="/produits/savon-lavande">Savon lavande</a><a href="/produits/savon-miel">Savon miel</a><a href="/a-propos">Notre histoire</a>';
const S_FOOT = 'Savonnerie du Lac — 4 chemin des Pêcheurs, 74000 Annecy — 04 50 22 33 44 — <a href="https://www.instagram.com/savonneriedulac">Instagram</a>';
const S_ORG = {
  '@context': 'https://schema.org',
  '@type': 'OnlineStore',
  name: 'Savonnerie du Lac',
  url: `${SHOP_ORIGIN}/`,
  telephone: '+33 4 50 22 33 44',
  address: { '@type': 'PostalAddress', streetAddress: '4 chemin des Pêcheurs', postalCode: '74000', addressLocality: 'Annecy', addressCountry: 'FR' },
  sameAs: ['https://www.instagram.com/savonneriedulac'],
};

function product(slug: string, name: string, price: string, gtin: string, desc: string): PageSpec {
  return {
    path: `/produits/${slug}`,
    html: doc({
      nav: S_NAV,
      footer: S_FOOT,
      siteName: 'Savonnerie du Lac',
      title: `${name} | Savonnerie du Lac`,
      h1: name,
      ogType: 'product',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name,
          brand: { '@type': 'Brand', name: 'Savonnerie du Lac' },
          gtin13: gtin,
          image: `${SHOP_ORIGIN}/img/${slug}.jpg`,
          offers: { '@type': 'Offer', price, priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
        },
      ],
      intro: [`${desc} Prix : ${price.replace('.', ',')} € TTC le savon de 100 g, en stock, expédié sous 48 heures.`],
    }),
  };
}

export function shopSite(): SiteCrawl {
  const common = { nav: S_NAV, footer: S_FOOT, siteName: 'Savonnerie du Lac' };
  return makeCrawl(SHOP_ORIGIN, [
    {
      path: '/',
      html: doc({
        ...common,
        title: 'Savons saponifiés à froid fabriqués à Annecy | Savonnerie du Lac',
        h1: 'Savonnerie du Lac, savons saponifiés à froid fabriqués à Annecy',
        jsonLd: [S_ORG],
        faqLd: true,
        intro: [
          'Savonnerie du Lac est une savonnerie artisanale fondée à Annecy en 2018 par Léa Perrin. Elle fabrique 14 savons saponifiés à froid à partir d’huiles biologiques certifiées par Ecocert, vendus en ligne et dans 35 boutiques de Haute-Savoie.',
        ],
        sections: [
          ['Quels sont les prix des savons de Savonnerie du Lac ?', 'Les savons de Savonnerie du Lac coûtent de 7,50 € à 12,90 € TTC le pain de 100 g. Le coffret découverte de 4 savons est vendu 34 € TTC, selon les tarifs en vigueur au 1er octobre 2026.'],
          ['Quels sont les délais et frais de livraison ?', 'Savonnerie du Lac expédie les commandes sous 48 heures ouvrées par Colissimo. La livraison coûte 4,90 € en France métropolitaine et elle est offerte dès 45 € d’achat ; comptez 2 à 3 jours de livraison après l’expédition.'],
          ['Comment retourner un produit ?', 'Vous disposez de 30 jours après réception pour retourner un savon non utilisé chez Savonnerie du Lac. Le remboursement intervient sous 7 jours après réception du colis, frais de retour à votre charge sauf produit abîmé.'],
          ['De quoi sont faits les savons de Savonnerie du Lac ?', 'Les savons de Savonnerie du Lac sont composés d’huile d’olive, d’huile de coco et de beurre de karité biologiques, avec 8 % de surgraissage. La composition INCI complète figure sur chaque fiche produit.'],
          ['Où sont fabriqués les savons ?', 'Tous les savons de Savonnerie du Lac sont fabriqués à la main dans notre atelier d’Annecy (74000), par lots de 60 pains. Chaque lot sèche 6 semaines avant la mise en vente.'],
          ['Que disent les avis clients sur Savonnerie du Lac ?', 'Savonnerie du Lac obtient 4,9/5 sur 527 avis vérifiés par Avis Vérifiés au 1er novembre 2026. Les clients citent la douceur pour les peaux sensibles et la durée d’un pain, environ 6 semaines selon les avis.'],
          ['Quels moyens de paiement acceptez-vous ?', 'Savonnerie du Lac accepte la carte bancaire (CB, Visa, Mastercard), PayPal et le paiement en 3 fois sans frais dès 60 € d’achat. Les paiements sont sécurisés par la banque Crédit Agricole des Savoie.'],
          ['Quelle garantie sur les savons ?', 'Savonnerie du Lac garantit ses savons 12 mois après fabrication : la date de lot figure sur chaque étiquette. Un savon abîmé à la livraison est remplacé gratuitement sur simple photo envoyée sous 14 jours.'],
          ['Comment choisir son savon ?', 'Pour bien choisir votre savon, partez de votre type de peau : le savon au miel convient aux peaux sèches, le savon à la lavande aux peaux mixtes. Selon la Société française de dermatologie, un savon surgras limite le dessèchement.'],
          ['Quelle différence entre un savon saponifié à froid et un savon industriel ?', 'Contrairement à un savon industriel, un savon saponifié à froid conserve la glycérine naturelle (environ 10 % du poids) et n’est pas chauffé au-delà de 40 °C, ce qui préserve les huiles. Savonnerie du Lac n’ajoute ni parfum de synthèse ni colorant.'],
        ],
      }),
    },
    product('savon-lavande', 'Savon à la lavande', '8.90', '3760123450011', 'Le savon à la lavande de Savonnerie du Lac contient 5 % d’huile essentielle de lavande fine de Haute-Provence et convient aux peaux mixtes.'),
    product('savon-miel', 'Savon au miel', '9.50', '3760123450028', 'Le savon au miel de Savonnerie du Lac contient 4 % de miel de sapin des Bauges et convient aux peaux sèches et sensibles.'),
    {
      path: '/a-propos',
      html: doc({
        ...common,
        title: 'Notre histoire | Savonnerie du Lac',
        h1: 'Notre histoire',
        intro: [
          'Savonnerie du Lac est née en 2018 dans un atelier de 40 m² à Annecy, créée par Léa Perrin, ancienne préparatrice en pharmacie. L’atelier emploie aujourd’hui 4 personnes et a produit 62 000 savons en 2025, tous certifiés Cosmos Organic par Ecocert.',
        ],
      }),
    },
  ]);
}
