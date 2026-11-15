/**
 * Source unique de l'identité publique de Repéré : URL canonique, marque, descripteur, entité légale,
 * dates de mise à jour des pages. Aucun import interne : ce module peut être lu partout (layout, sitemap,
 * JSON-LD, llms.txt, images OG) sans risque de dépendance circulaire.
 */

/* ------------------------------------------------------------------ */
/* URL canonique                                                       */
/* ------------------------------------------------------------------ */

/** Domaine de production. Jamais localhost : un canonical vers localhost désindexe le site. */
export const PRODUCTION_URL = 'https://repere-ia.fr';

function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  // Une valeur vide, invalide ou locale retombe sur le domaine de production.
  if (!raw) return PRODUCTION_URL;
  try {
    const u = new URL(raw);
    if (process.env.NODE_ENV === 'production' && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(u.hostname)) return PRODUCTION_URL;
    return `${u.protocol}//${u.host}`;
  } catch {
    return PRODUCTION_URL;
  }
}

/** Origine canonique, sans barre finale (ex. https://repere-ia.fr). */
export const SITE_URL = resolveSiteUrl();

/** URL absolue d'un chemin. La racine s'écrit toujours `${SITE_URL}/` (même forme partout : canonical, sitemap, JSON-LD). */
export const abs = (path: string) => (path === '/' || path === '' ? `${SITE_URL}/` : `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`);

/* ------------------------------------------------------------------ */
/* Marque et descripteur (une seule formulation partout)               */
/* ------------------------------------------------------------------ */

export const BRAND = 'Repéré';
export const DESCRIPTOR = 'le référencement SEO et IA (GEO) des entreprises françaises';
export const TAGLINE = 'On mesure. On explique. On le fait.';
/** Phrase d'identité, reprise mot pour mot : /a-propos, accueil, llms.txt, JSON-LD Organization. */
export const ONE_LINER =
  'Repéré est un service français de référencement SEO et IA (GEO) : il analyse un site pour de vrai, mesure si Google, ChatGPT, Gemini, Perplexity et Claude recommandent l’entreprise, explique pourquoi ses concurrents sont cités et réalise les corrections, validées par le client avant publication.';
/** Version courte (≤ 160 caractères) : meta descriptions, profils externes (docs/visibilite-repere/01-textes-identite.md). */
export const SHORT_DESCRIPTION =
  'Repéré analyse votre site, mesure si Google, ChatGPT, Gemini et Perplexity recommandent votre entreprise, et réalise les corrections avec vous.';
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@repere-ia.fr';

/** Compte « maison » de dogfooding (tracking t.js, page officielle /p/repere, /api/schema/repere). */
export const HOUSE_BUSINESS_ID = 'repere';
export const HOUSE_PAGE_PATH = '/p/repere';

/* ------------------------------------------------------------------ */
/* Entité légale et fondateur                                          */
/* ------------------------------------------------------------------ */

const env = (k: string) => (process.env[k] ?? '').trim();

/**
 * Renseignés UNIQUEMENT par variables d'environnement (NEXT_PUBLIC_FOUNDER_*, NEXT_PUBLIC_LEGAL_*), jamais en dur :
 * voir docs/MISE-EN-LIGNE.md et `node scripts/ops/check-env.mjs --prod`. Lues au build : redéployer après un changement.
 * Tant qu'un champ obligatoire est vide, ENTITY_READY vaut false :
 *  - /a-propos reste en noindex et hors du sitemap et de llms.txt ;
 *  - le JSON-LD ne publie ni Person, ni SIREN, ni adresse (aucune donnée fictive) ; sameAs ne reprend que les profils
 *    de marque réellement renseignés (voir SAME_AS).
 * Dès que tout est rempli, tout s'active sans autre modification.
 */
export const FOUNDER = {
  name: env('NEXT_PUBLIC_FOUNDER_NAME'), // obligatoire
  jobTitle: env('NEXT_PUBLIC_FOUNDER_TITLE') || 'Fondateur',
  /** 2 ou 3 phrases, parcours vérifiable. Obligatoire. */
  bio: env('NEXT_PUBLIC_FOUNDER_BIO'),
  linkedin: env('NEXT_PUBLIC_FOUNDER_LINKEDIN'),
  image: env('NEXT_PUBLIC_FOUNDER_IMAGE'),
};

export const LEGAL = {
  /** Nom et prénom de l'entrepreneur individuel, ou dénomination de la société (ex. « Repéré SAS »). */
  name: env('NEXT_PUBLIC_LEGAL_NAME'),
  /** Forme juridique (ex. « entrepreneur individuel (micro-entrepreneur) », « SAS au capital de 1 000 € »). */
  form: env('NEXT_PUBLIC_LEGAL_FORM'),
  siren: env('NEXT_PUBLIC_LEGAL_SIREN').replace(/\s/g, ''), // obligatoire
  siret: env('NEXT_PUBLIC_LEGAL_SIRET').replace(/\s/g, ''),
  /** Ville du greffe du RCS (société) ; vide pour un entrepreneur individuel non inscrit. */
  rcsCity: env('NEXT_PUBLIC_LEGAL_RCS_CITY'),
  street: env('NEXT_PUBLIC_LEGAL_STREET'), // obligatoire
  postalCode: env('NEXT_PUBLIC_LEGAL_POSTAL_CODE'),
  city: env('NEXT_PUBLIC_LEGAL_CITY'), // obligatoire
  /** E-mail de l'éditeur (mentions légales, exercice des droits RGPD). */
  email: env('NEXT_PUBLIC_LEGAL_EMAIL'),
  phone: env('NEXT_PUBLIC_LEGAL_PHONE'),
  /** Directeur de la publication (Prénom NOM, qualité). */
  publicationDirector: env('NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR'),
  /** AAAA ou AAAA-MM-JJ */
  foundingDate: env('NEXT_PUBLIC_LEGAL_FOUNDING_DATE'),
};

/** Adresse sur une ligne (« 12 rue X, 75001 Paris »), vide si incomplète. */
export const LEGAL_ADDRESS = LEGAL.street && LEGAL.city ? [LEGAL.street, [LEGAL.postalCode, LEGAL.city].filter(Boolean).join(' ')].join(', ') : '';

/**
 * Champs d'identité obligatoires des pages légales (mentions légales, CGV, confidentialité). En production,
 * `node scripts/ops/check-env.mjs --prod` échoue tant que l'un d'eux manque : aucun « [À COMPLÉTER] » d'identité
 * n'est alors visible en ligne.
 */
export const LEGAL_REQUIRED_ENV = {
  NEXT_PUBLIC_LEGAL_NAME: LEGAL.name,
  NEXT_PUBLIC_LEGAL_FORM: LEGAL.form,
  NEXT_PUBLIC_LEGAL_SIREN: LEGAL.siren,
  NEXT_PUBLIC_LEGAL_STREET: LEGAL.street,
  NEXT_PUBLIC_LEGAL_POSTAL_CODE: LEGAL.postalCode,
  NEXT_PUBLIC_LEGAL_CITY: LEGAL.city,
  NEXT_PUBLIC_LEGAL_EMAIL: LEGAL.email,
  NEXT_PUBLIC_LEGAL_PHONE: LEGAL.phone,
  NEXT_PUBLIC_LEGAL_PUBLICATION_DIRECTOR: LEGAL.publicationDirector,
} as const;

/** SIREN lisible (« 123 456 782 »), vide si absent. */
export const SIREN_DISPLAY = LEGAL.siren ? LEGAL.siren.replace(/^(\d{3})(\d{3})(\d{3})$/, '$1 $2 $3') : '';

/** Variables d'identité légale manquantes (noms seulement). */
export const LEGAL_MISSING: string[] = Object.entries(LEGAL_REQUIRED_ENV).filter(([, v]) => !v).map(([k]) => k);

/** Vrai quand toute l'identité des pages légales est renseignée. */
export const LEGAL_READY = LEGAL_MISSING.length === 0;

/** Valeur, ou repère visible « [À COMPLÉTER : …] » tant qu'elle n'est pas renseignée (jamais de donnée inventée). */
export const orTodo = (value: string, label: string): string => value || `[À COMPLÉTER : ${label}]`;

/**
 * Profils officiels de la MARQUE (pages publiques réelles, https uniquement, vides ignorées) : liste libre
 * NEXT_PUBLIC_SAME_AS (séparée par des virgules) + une variable nommée par plateforme (GEO-MARQUE, V6).
 */
export const SAME_AS_PROFILES = {
  linkedin: env('NEXT_PUBLIC_SAME_AS_LINKEDIN'),
  crunchbase: env('NEXT_PUBLIC_SAME_AS_CRUNCHBASE'),
  g2: env('NEXT_PUBLIC_SAME_AS_G2'),
  capterra: env('NEXT_PUBLIC_SAME_AS_CAPTERRA'),
  producthunt: env('NEXT_PUBLIC_SAME_AS_PRODUCTHUNT'),
  alternativeto: env('NEXT_PUBLIC_SAME_AS_ALTERNATIVETO'),
  youtube: env('NEXT_PUBLIC_SAME_AS_YOUTUBE'),
  wikidata: env('NEXT_PUBLIC_SAME_AS_WIKIDATA'),
};
/** Libellés des profils (bloc « Nous suivre » du pied de page). */
export const SAME_AS_LABELS: Record<keyof typeof SAME_AS_PROFILES, string> = {
  linkedin: 'LinkedIn', crunchbase: 'Crunchbase', g2: 'G2', capterra: 'Capterra', producthunt: 'Product Hunt',
  alternativeto: 'AlternativeTo', youtube: 'YouTube', wikidata: 'Wikidata',
};
const isHttps = (s: string) => /^https:\/\/[^\s]+$/.test(s);
/** Profils nommés renseignés (dans l'ordre de SAME_AS_LABELS). */
export const SAME_AS_LINKS = (Object.keys(SAME_AS_LABELS) as (keyof typeof SAME_AS_PROFILES)[])
  .filter((k) => isHttps(SAME_AS_PROFILES[k]))
  .map((k) => ({ key: k, label: SAME_AS_LABELS[k], url: SAME_AS_PROFILES[k] }));
const RAW_SAME_AS = [
  ...env('NEXT_PUBLIC_SAME_AS').split(',').map((s) => s.trim()),
  ...SAME_AS_LINKS.map((l) => l.url),
].filter(isHttps);

/** LE flag : vrai quand le fondateur a rempli les informations obligatoires. */
export const ENTITY_READY = Boolean(FOUNDER.name && FOUNDER.bio && LEGAL.siren && LEGAL.street && LEGAL.city);

/**
 * sameAs : les profils publics de la marque sont publiés dès qu'ils sont renseignés (ce sont des pages réelles, pas des
 * données d'identité légale) ; la fiche officielle de l'État (SIREN) s'ajoute quand l'entité est complète.
 */
export const SAME_AS: string[] = [
  ...new Set([...RAW_SAME_AS, ...(ENTITY_READY ? [`https://annuaire-entreprises.data.gouv.fr/entreprise/${LEGAL.siren}`] : [])]),
];

/* ------------------------------------------------------------------ */
/* Dates de dernière modification éditoriale                           */
/* ------------------------------------------------------------------ */

/**
 * Date réelle de dernière modification du contenu de chaque page statique (AAAA-MM-JJ).
 * Source unique : sitemap (lastmod), JSON-LD (dateModified), mentions « Mis à jour le ».
 * À mettre à jour à la main quand le contenu de la page change (pas à chaque build).
 */
export const PAGE_UPDATED = {
  '/': '2026-11-13',
  '/local': '2026-11-13',
  '/pme': '2026-11-13',
  '/e-commerce': '2026-11-13',
  '/audit': '2026-11-15',
  '/tarifs': '2026-11-13',
  '/methode': '2026-11-13',
  '/guides': '2026-11-15',
  '/visibilite-ia': '2026-11-15',
  '/visibilite-ia/pme': '2026-11-09',
  '/visibilite-ia/e-commerce': '2026-11-09',
  '/a-propos': '2026-11-09',
  '/geo': '2026-11-09',
  '/glossaire': '2026-11-15',
  '/questions': '2026-11-15',
  '/comparatif': '2026-11-13',
  '/etudes': '2026-11-15',
  '/cgv': '2026-11-09',
  '/mentions-legales': '2026-11-09',
  '/confidentialite': '2026-11-09',
  // V6 : pages livrées par LANCEMENT et OPS (15 nov. 2026).
  '/pilotes': '2026-11-15',
  '/presse': '2026-11-15',
  '/statut': '2026-11-15',
} as const satisfies Record<string, string>;

export type StaticPath = keyof typeof PAGE_UPDATED;
/** Date de modification des pages métier générées (gabarit + données de lib/seo/data.json). */
export const TRADE_PAGES_UPDATED = '2026-11-09';
