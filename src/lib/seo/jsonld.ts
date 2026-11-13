/**
 * Helpers JSON-LD du site Repéré, avec des @id stables et cohérents entre les pages.
 *
 * - Organisation : `${SITE_URL}/#organization` (une seule entité, référencée partout par son @id).
 * - Site : `${SITE_URL}/#website`.
 * - Page : `${url}#webpage`, article : `${url}#article`, FAQ : `${url}#faq`, fil d'Ariane : `${url}#breadcrumb`.
 *
 * Rendu : passer l'objet à `<JsonLd data={...} />` (src/lib/seo/shell.tsx).
 * Pour regrouper plusieurs nœuds dans un seul script, utiliser `graph([...])`.
 * Réutilisable par toutes les pages (aucun texte de page ici).
 */
import { BRAND, CONTACT_EMAIL, ENTITY_READY, FOUNDER, LEGAL, ONE_LINER, SAME_AS, SITE_URL, TAGLINE, abs } from './site';
import { SITE_PLANS, type SitePlan, type SiteSegment } from '@/components/site/plans-v2';

export { FOUNDER, SAME_AS, ENTITY_READY } from './site';

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;
export const FOUNDER_ID = `${SITE_URL}/a-propos#founder`;
export const LOGO_URL = `${SITE_URL}/icons/icon-512.png`;

/** Identifiants dérivés d'un chemin de page (ex. '/geo'). */
export const pageIds = (path: string) => {
  const url = abs(path);
  return {
    url,
    webpage: `${url}#webpage`,
    article: `${url}#article`,
    faq: `${url}#faq`,
    breadcrumb: `${url}#breadcrumb`,
    terms: `${url}#terms`,
    dataset: `${url}#dataset`,
    service: `${url}#service`,
    list: `${url}#list`,
  };
};

/** Référence courte vers l'organisation (à utiliser dans author/publisher/provider). */
export const orgRef = () => ({ '@id': ORG_ID });

export function founderLd() {
  if (!ENTITY_READY) return null;
  return {
    '@type': 'Person',
    '@id': FOUNDER_ID,
    name: FOUNDER.name,
    jobTitle: FOUNDER.jobTitle,
    worksFor: orgRef(),
    ...(FOUNDER.linkedin ? { sameAs: [FOUNDER.linkedin] } : {}),
    ...(FOUNDER.image ? { image: FOUNDER.image } : {}),
    ...(FOUNDER.bio ? { description: FOUNDER.bio } : {}),
  };
}

/** Nœud Organization complet (à publier une fois par page au plus, idéalement sur / et /a-propos). */
export function organizationLd(opts: { withContext?: boolean } = {}) {
  const founder = founderLd();
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'Organization',
    '@id': ORG_ID,
    name: BRAND,
    alternateName: 'Repéré IA',
    // Même forme que /api/schema/repere (module execution) : origine sans barre finale.
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: LOGO_URL },
    description: ONE_LINER,
    slogan: TAGLINE,
    areaServed: { '@type': 'Country', name: 'France' },
    knowsLanguage: 'fr-FR',
    knowsAbout: [
      'Référencement naturel (SEO)',
      'SEO technique',
      'SEO local',
      'SEO e-commerce',
      'Generative Engine Optimization (GEO)',
      'Référencement IA',
      'Visibilité dans ChatGPT',
      'Google AI Overviews',
      'Google Search Console',
      'Core Web Vitals',
      'Données structurées schema.org',
    ],
    email: CONTACT_EMAIL,
    contactPoint: [
      { '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT_EMAIL, availableLanguage: ['French'] },
    ],
    ...(founder ? { founder: { '@id': founder['@id'] } } : {}),
    ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
    // Identité légale : publiée uniquement quand ENTITY_READY (src/lib/seo/site.ts).
    ...(ENTITY_READY && LEGAL.name ? { legalName: LEGAL.name } : {}),
    ...(ENTITY_READY
      ? {
          identifier: { '@type': 'PropertyValue', propertyID: 'SIREN', value: LEGAL.siren },
          taxID: LEGAL.siren,
          address: {
            '@type': 'PostalAddress',
            streetAddress: LEGAL.street,
            ...(LEGAL.postalCode ? { postalCode: LEGAL.postalCode } : {}),
            addressLocality: LEGAL.city,
            addressCountry: 'FR',
          },
        }
      : {}),
    ...(ENTITY_READY && LEGAL.foundingDate ? { foundingDate: LEGAL.foundingDate } : {}),
  };
}

export function websiteLd(opts: { withContext?: boolean } = {}) {
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: SITE_URL,
    name: BRAND,
    inLanguage: 'fr-FR',
    publisher: orgRef(),
  };
}

export interface CrumbItem {
  name: string;
  path: string;
}

export function breadcrumbListLd(path: string, items: CrumbItem[], opts: { withContext?: boolean } = {}) {
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'BreadcrumbList',
    '@id': pageIds(path).breadcrumb,
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
}

export interface ArticleInput {
  path: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  /** type schema.org (Article par défaut) */
  type?: 'Article' | 'TechArticle' | 'Report';
  wordCount?: number;
  about?: string[];
  /** URL des sources citées */
  citation?: string[];
  /** URL absolue de l'image (OG) */
  image?: string;
  /** version (TechArticle de méthode) */
  version?: string;
  withContext?: boolean;
}

/** Article dont l'auteur est l'organisation (« L'équipe Repéré »), et le fondateur s'il est renseigné. */
export function articleLd(a: ArticleInput) {
  const ids = pageIds(a.path);
  const founder = founderLd();
  return {
    ...(a.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': a.type ?? 'Article',
    '@id': ids.article,
    headline: a.headline,
    description: a.description,
    inLanguage: 'fr-FR',
    datePublished: a.datePublished,
    dateModified: a.dateModified,
    mainEntityOfPage: { '@id': ids.webpage },
    isPartOf: { '@id': WEBSITE_ID },
    author: founder ? [orgRef(), { '@id': founder['@id'] }] : [orgRef()],
    publisher: orgRef(),
    ...(a.wordCount ? { wordCount: a.wordCount } : {}),
    ...(a.about?.length ? { about: a.about.map((name) => ({ '@type': 'Thing', name })) } : {}),
    ...(a.citation?.length ? { citation: a.citation } : {}),
    ...(a.image ? { image: a.image } : {}),
    ...(a.version ? { version: a.version } : {}),
  };
}

export interface QA {
  q: string;
  a: string;
}

export function faqPageLd(path: string, items: QA[], opts: { withContext?: boolean } = {}) {
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'FAQPage',
    '@id': pageIds(path).faq,
    url: abs(path),
    inLanguage: 'fr-FR',
    publisher: orgRef(),
    mainEntity: items.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

export interface TermInput {
  slug: string;
  name: string;
  definition: string;
  alternateName?: string[];
}

export function definedTermSetLd(path: string, name: string, terms: TermInput[], opts: { withContext?: boolean } = {}) {
  const ids = pageIds(path);
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'DefinedTermSet',
    '@id': ids.terms,
    name,
    url: ids.url,
    inLanguage: 'fr-FR',
    publisher: orgRef(),
    hasDefinedTerm: terms.map((t) => ({
      '@type': 'DefinedTerm',
      '@id': `${ids.url}#${t.slug}`,
      name: t.name,
      description: t.definition,
      url: `${ids.url}#${t.slug}`,
      inDefinedTermSet: { '@id': ids.terms },
      ...(t.alternateName?.length ? { alternateName: t.alternateName } : {}),
    })),
  };
}

export function webPageLd(
  path: string,
  p: {
    name: string;
    description: string;
    type?: 'WebPage' | 'AboutPage' | 'CollectionPage' | 'FAQPage' | 'ContactPage';
    dateModified?: string;
    datePublished?: string;
    /** false quand la page ne publie pas de BreadcrumbList (accueil) : pas de référence dans le vide. */
    breadcrumb?: boolean;
    about?: string;
    mainEntity?: string;
  },
  opts: { withContext?: boolean } = {},
) {
  const ids = pageIds(path);
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': p.type ?? 'WebPage',
    '@id': ids.webpage,
    url: ids.url,
    name: p.name,
    description: p.description,
    inLanguage: 'fr-FR',
    isPartOf: { '@id': WEBSITE_ID },
    ...(p.breadcrumb === false ? {} : { breadcrumb: { '@id': ids.breadcrumb } }),
    ...(p.datePublished ? { datePublished: p.datePublished } : {}),
    ...(p.dateModified ? { dateModified: p.dateModified } : {}),
    ...(p.about ? { about: { '@id': p.about } } : {}),
    ...(p.mainEntity ? { mainEntity: { '@id': p.mainEntity } } : {}),
  };
}

/** Regroupe des nœuds (créés avec `withContext: false`) dans un seul @graph. */
export function graph(nodes: (Record<string, unknown> | null | undefined)[]) {
  return { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) };
}

/* ------------------------------------------------------------------ */
/* Logiciel et offres (à partir de la grille affichée : SITE_PLANS)     */
/* ------------------------------------------------------------------ */

export const SEGMENT_LABEL: Record<SiteSegment, string> = {
  local: 'Commerce local',
  pme: 'PME et services B2B',
  ecommerce: 'E-commerce',
  agence: 'Agences',
};

const price = (cents: number) => (cents / 100).toFixed(2);

/** Une Offer par palier affiché (mensuel et ponctuel ; jamais d'avis ni de note inventés). */
export function offerLd(p: SitePlan) {
  const monthly = p.interval === 'month';
  const yearly = p.interval === 'year';
  return {
    '@type': 'Offer',
    '@id': `${SITE_URL}/tarifs#offer-${p.id}`,
    name: `${p.name} (${SEGMENT_LABEL[p.segment]})`,
    price: price(p.priceCents),
    priceCurrency: 'EUR',
    ...(monthly || yearly
      ? {
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: price(p.priceCents),
            priceCurrency: 'EUR',
            unitCode: monthly ? 'MON' : 'ANN',
            referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode: monthly ? 'MON' : 'ANN' },
            valueAddedTaxIncluded: false,
          },
        }
      : {}),
    category: p.priceCents === 0 ? 'Gratuit' : monthly ? 'Abonnement mensuel' : yearly ? 'Abonnement annuel' : 'Paiement unique',
    url: abs('/tarifs'),
    availability: p.available ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder',
    eligibleRegion: { '@type': 'Country', name: 'FR' },
    seller: orgRef(),
  };
}

/** Fonctions du logiciel (V5), reprises dans le JSON-LD SoftwareApplication et llms.txt. */
export const SOFTWARE_FEATURES: string[] = [
  'Analyse SEO et IA d’un site en 60 secondes, par exploration réelle des pages',
  'Audit SEO de 185 contrôles en 12 familles (indexation, technique, contenu, doublons, maillage, liens, international, images, données structurées, performance, e-commerce, local)',
  'Audit GEO en 8 familles avec niveau de preuve (accès des robots d’IA, contenu citable, identité, couverture des questions, présence hors site, données structurées, fraîcheur, llms.txt)',
  'Search Console, PageSpeed Insights et CrUX connectés ; positions Google suivies chaque semaine',
  'Mesure des réponses de ChatGPT, Perplexity, Gemini et Claude (Mistral en option), avec marge d’erreur',
  'Sources citées par les IA, vérification des faits, part de voix face aux concurrents',
  'Agent de publication : corrections appliquées sur WordPress, Shopify, Webflow ou PrestaShop après validation, journalisées et annulables',
  'Baromètres mensuels de la visibilité dans les IA par métier et par ville, publiés seulement après une mesure réelle',
];

/** Paliers affichés pour un parcours : test, audit approfondi, Essentiel mensuel, Accompagné (et Réseau en local). */
export function displayedPlans(segment: SiteSegment): SitePlan[] {
  const list = SITE_PLANS.filter((p) => p.segment === segment);
  if (segment === 'agence') return list.filter((p) => p.interval !== 'year');
  return list.filter((p) => /_(audit_free|audit_deep|essentiel_month|accompagne_month|reseau_month)$/.test(p.id));
}

/**
 * Le service Repéré (@id stable). `segments` = parcours dont les offres sont visibles sur la page.
 * V5 : typé `Service` (ce que nous vendons : un service en ligne, logiciel compris) et non plus `SoftwareApplication`,
 * dont le résultat enrichi exige une note ou des avis (developers.google.com/search/docs/appearance/structured-data/software-app) :
 * nous n'avons pas encore d'avis publics et nous n'en inventons pas. Les fonctions sont décrites dans un catalogue.
 */
export function softwareAppLd(pagePath: string, segments: SiteSegment[], opts: { withContext?: boolean } = {}) {
  return {
    ...(opts.withContext === false ? {} : { '@context': 'https://schema.org' }),
    '@type': 'Service',
    '@id': SOFTWARE_ID,
    name: BRAND,
    description: ONE_LINER,
    serviceType: 'SEO et référencement IA (GEO)',
    category: 'Logiciel en ligne de SEO et de référencement IA',
    areaServed: { '@type': 'Country', name: 'France' },
    availableLanguage: 'fr-FR',
    audience: { '@type': 'BusinessAudience', audienceType: 'Commerces locaux, PME et services B2B, e-commerce' },
    provider: orgRef(),
    url: abs(pagePath),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: `Fonctions de ${BRAND}`,
      itemListElement: SOFTWARE_FEATURES.map((f) => ({ '@type': 'Service', name: f })),
    },
    offers: segments.flatMap((s) => displayedPlans(s)).map((p) => offerLd(p)),
  };
}
