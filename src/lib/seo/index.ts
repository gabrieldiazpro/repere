import raw from './data.json';

export interface Trade {
  slug: string;
  nom: string;
  nom_pluriel: string;
  requetes_types: string[];
  ia_les_plus_utilisees: string[];
  regulated: boolean;
  priority: boolean;
}
export interface City {
  slug: string;
  nom: string;
  type: 'arrondissement' | 'ville';
  code_postal?: string;
  parent: string | null;
  quartiers: string[];
}

import { abs } from './site';
import { breadcrumbListLd, faqPageLd, orgRef, pageIds } from './jsonld';

/** Marque, URL canonique (repli https://repere-ia.fr, jamais localhost) : voir ./site.ts. */
export { BRAND, SITE_URL, abs } from './site';
/** Version de la méthode de score (docs/03-methode-score.md). */
export const METHOD_VERSION = 'v3.0';

const ALL_TRADES = raw.trades as Trade[];
export const CITIES = raw.cities as City[];

/** Métiers publics : les métiers réglementés (santé, avocats, comptables) sont exclus (docs/12 §6). */
export const TRADES: Trade[] = ALL_TRADES.filter((t) => !t.regulated);
export const PRIORITY_TRADES: Trade[] = TRADES.filter((t) => t.priority);
export const ARRONDISSEMENTS = CITIES.filter((c) => c.type === 'arrondissement');
export const VILLES = CITIES.filter((c) => c.type === 'ville');

export const getTrade = (slug: string) => TRADES.find((t) => t.slug === slug);
export const getCity = (slug: string) => CITIES.find((c) => c.slug === slug);

/** Préposition + nom : « à Paris 11e », « à Lyon ». */
export const inCity = (c: City) => `à ${c.nom}`;

export const tradeLower = (t: Trade) => t.nom.toLowerCase();
const startsVowel = (s: string) => /^[aeiouyhéèêàâîôû]/i.test(s);
/** « un plombier » / « une agence immobilière » / « un électricien ». */
export function withArticle(t: Trade): string {
  const feminine = ['agence-immobiliere', 'auto-ecole', 'institut-de-beaute'].includes(t.slug);
  return `${feminine ? 'une' : 'un'} ${tradeLower(t)}`;
}
export { startsVowel };

/* ------------------------------------------------------------------ */
/* Requêtes réelles qu'un client poserait                              */
/* ------------------------------------------------------------------ */

/** Requêtes types de docs/12 pour les 3 verticales prioritaires ({zone} = « Paris 11e », « Lyon »...). */
const PRIORITY_QUERIES: Record<string, string[]> = {
  plombier: [
    'Plombier d\'urgence à {zone} maintenant',
    'Meilleur plombier {zone}, avis clients',
    'Plombier pas cher pour une fuite d\'eau à {zone}',
    'Plombier disponible un dimanche à {zone}',
    'Plombier fiable à {zone} pour une rénovation de salle de bain',
    'Plombier-chauffagiste pour une panne de chaudière à {zone}',
  ],
  demenageur: [
    'Quel est le meilleur déménageur à {zone} ?',
    'Déménageur pas cher {zone} pour un studio',
    'Déménageur fiable avec assurance {zone}, avis clients',
    'Déménageur {zone} pour un week-end ou à la dernière minute',
    'Déménagement avec monte-meuble {zone}, quelle société ?',
    'Déménageur sérieux à {zone}, comment éviter les arnaques ?',
  ],
  'agence-immobiliere': [
    'Meilleure agence immobilière à {zone} pour vendre un appartement',
    'Agence immobilière fiable pour estimer mon appartement à {zone}',
    'Quelle agence a les honoraires les plus bas à {zone} ?',
    'Meilleure agence de gestion locative à {zone}',
    'Agence immobilière avec bons avis pour acheter à {zone}',
    'Agence immobilière indépendante recommandée à {zone}',
  ],
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface QueryItem {
  text: string;
  kind: 'meilleur' | 'quartier' | 'precis' | 'urgence' | 'avis';
}

/** Requêtes affichées sur une page métier × ville, selon le métier et le quartier. */
export function buildQueries(t: Trade, c: City): QueryItem[] {
  const out: QueryItem[] = [];
  const zone = c.nom;
  const pre = PRIORITY_QUERIES[t.slug];
  if (pre) {
    for (const q of pre) out.push({ text: q.replaceAll('{zone}', zone), kind: 'meilleur' });
  } else {
    out.push({ text: `Quel est le meilleur ${tradeLower(t)} à ${zone} ?`, kind: 'meilleur' });
    for (const q of t.requetes_types) out.push({ text: cap(q.replaceAll('{ville}', zone)), kind: 'precis' });
    out.push({ text: `Quel ${tradeLower(t)} à ${zone} a les meilleurs avis ?`, kind: 'avis' });
  }
  for (const qt of c.quartiers.slice(0, 3)) {
    out.push({ text: `${cap(tradeLower(t))} près de ${qt}, lequel choisir ?`, kind: 'quartier' });
  }
  // dédoublonnage
  const seen = new Set<string>();
  return out.filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true)));
}

/** Requêtes de niveau national pour la page métier (zone générique « {ville} » remplacée par un exemple). */
export function buildTradeQueries(t: Trade): string[] {
  const pre = PRIORITY_QUERIES[t.slug];
  if (pre) return pre.map((q) => q.replaceAll('{zone}', 'votre ville'));
  return [
    `Quel est le meilleur ${tradeLower(t)} dans votre ville ?`,
    ...t.requetes_types.map((q) => cap(q.replaceAll('{ville}', 'votre ville'))),
    `${cap(tradeLower(t))} près de chez moi, lequel choisir ?`,
  ];
}

/* ------------------------------------------------------------------ */
/* Annuaires et sources clés du métier                                  */
/* ------------------------------------------------------------------ */

export interface Directory {
  name: string;
  note: string;
}
const GBP: Directory = { name: 'Google Business Profile', note: 'Fiche Google : horaires, catégories, avis, photos à jour.' };
const PJ: Directory = { name: 'PagesJaunes', note: 'Annuaire historique, désormais aussi accessible depuis ChatGPT (application lancée en juin 2026).' };
const TP: Directory = { name: 'Trustpilot', note: 'Avis publics souvent repris dans les réponses.' };

const DIRECTORIES: Record<string, Directory[]> = {
  plombier: [GBP, PJ, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }, { name: 'Habitatpresto', note: 'Mise en relation artisans.' }, { name: 'Annuaires CAPEB / Qualibat', note: 'Qualifications professionnelles.' }],
  demenageur: [GBP, PJ, TP, { name: 'Avis Vérifiés', note: 'Avis vérifiés.' }, { name: 'Plateformes de devis déménagement', note: 'À lister après mesure sur de vraies requêtes.' }],
  'agence-immobiliere': [GBP, PJ, { name: 'SeLoger', note: 'Portail annonces.' }, { name: "Bien'ici", note: 'Portail annonces.' }, { name: 'MeilleursAgents', note: 'Avis et estimations.' }, { name: 'Annuaires FNAIM / UNIS', note: 'Membres des syndicats professionnels.' }],
  electricien: [GBP, PJ, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }, { name: 'Annuaires CAPEB / Qualifelec', note: 'Qualifications professionnelles.' }],
  serrurier: [GBP, PJ, { name: 'MesDépanneurs.fr', note: 'Comparateur de dépannage.' }],
  chauffagiste: [GBP, PJ, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }, { name: 'Annuaires Qualibat / Qualit\'EnR', note: 'Qualifications professionnelles.' }],
  couvreur: [GBP, PJ, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }, { name: 'Annuaires CAPEB / Qualibat', note: 'Qualifications professionnelles.' }],
  'peintre-en-batiment': [GBP, PJ, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }, { name: 'Houzz', note: 'Réalisations et avis.' }],
  menuisier: [GBP, PJ, { name: 'Houzz', note: 'Réalisations et avis.' }, { name: 'Travaux.com', note: 'Plateforme de devis travaux.' }],
  restaurant: [GBP, { name: 'TheFork', note: 'Réservation et avis.' }, { name: 'TripAdvisor', note: 'Avis voyageurs.' }, { name: 'Guide Michelin / Gault&Millau', note: 'Guides gastronomiques.' }, { name: 'Presse locale et blogs food', note: 'Articles régulièrement cités.' }],
  coiffeur: [GBP, { name: 'Planity', note: 'Réservation en ligne.' }, { name: 'Treatwell', note: 'Réservation en ligne.' }, PJ, { name: 'Instagram', note: 'Vitrine de réalisations.' }],
  'institut-de-beaute': [GBP, { name: 'Planity', note: 'Réservation en ligne.' }, { name: 'Treatwell', note: 'Réservation en ligne.' }, PJ],
  'garage-automobile': [GBP, PJ, { name: 'Vroomly', note: 'Comparateur de garages.' }, TP],
  fleuriste: [GBP, PJ, { name: 'Instagram', note: 'Vitrine de réalisations.' }],
  photographe: [GBP, { name: 'Instagram', note: 'Portfolio.' }, { name: 'Mariages.net', note: 'Annuaire mariage.' }],
  'auto-ecole': [GBP, PJ, { name: 'Annuaires de comparateurs d\'auto-écoles', note: 'Taux de réussite et avis.' }],
};
export const directoriesFor = (t: Trade): Directory[] => DIRECTORIES[t.slug] ?? [GBP, PJ, TP];

/* ------------------------------------------------------------------ */
/* FAQ propre au métier                                                */
/* ------------------------------------------------------------------ */

export interface Faq {
  q: string;
  a: string;
}

export function buildFaq(t: Trade, c: City | null, stats: SeoStats | null): Faq[] {
  const where = c ? `à ${c.nom}` : 'dans votre ville';
  const dirs = directoriesFor(t).slice(0, 4).map((d) => d.name).join(', ');
  const queries = (c ? buildQueries(t, c) : buildTradeQueries(t).map((text) => ({ text })))
    .slice(0, 2)
    .map((q) => `« ${q.text} »`)
    .join(' ou ');
  const faq: Faq[] = [];
  if (stats) {
    faq.push({
      q: `Les ${t.nom_pluriel.toLowerCase()} ${where} apparaissent-ils sur ChatGPT ?`,
      a: `Sur ${stats.auditCount} audits réalisés du ${fmtDate(stats.periodStart)} au ${fmtDate(stats.periodEnd)}, ${Math.round(100 - stats.zeroVisibilityShare * 100)} % des établissements audités ont été cités au moins une fois par une IA. Cet échantillon ne couvre que les établissements qui ont voulu se tester.`,
    });
  }
  faq.push(
    {
      q: `Comment un ${tradeLower(t)} peut-il être recommandé par ChatGPT ${where} ?`,
      a: `Les assistants IA s'appuient sur des sources publiques. Pour ce métier, les plus probables sont : ${dirs}. Les actions de base : une fiche Google complète, des informations (nom, adresse, téléphone, horaires) identiques partout, des avis récents, et un site qui décrit clairement vos services et votre zone. Aucun résultat n'est promis.`,
    },
    {
      q: `Quelles questions posent les clients aux IA pour trouver ${withArticle(t)} ${where} ?`,
      a: `Par exemple ${queries}. Nous testons ces formulations, et d'autres, auprès de ChatGPT, Gemini et Perplexity : la liste complète figure plus haut sur cette page.`,
    },
    {
      q: 'Comment est calculé le score ?',
      a: `Le score sur 100 combine le taux de mention, le rang, la part des recommandations et la couverture des IA, à partir de 8 requêtes posées 2 fois à 3 IA. Il est toujours donné avec une fourchette. Détails sur la page Méthode.`,
    },
    {
      q: `Ces données concernent-elles tous les ${t.nom_pluriel.toLowerCase()} ${where} ?`,
      a: stats
        ? `Non. Elles portent sur les établissements audités par nos soins, pas sur l'ensemble du marché, et ne constituent pas un classement de qualité.`
        : `Pas encore de données : nous n'avons pas assez d'audits pour publier des statistiques pour ce métier ${where}. Nous préférons l'écrire plutôt que d'afficher des chiffres inventés.`,
    },
  );
  return faq;
}

/* ------------------------------------------------------------------ */
/* Statistiques agrégées (remplies plus tard par les audits réels)      */
/* ------------------------------------------------------------------ */

export interface SeoStats {
  auditCount: number;
  avgScore: number;
  medianScore: number;
  /** 0–1 */
  zeroVisibilityShare: number;
  harshestProvider: { id: string; avgScore: number } | null;
  friendliestProvider: { id: string; avgScore: number } | null;
  deltaVsNational: number | null;
  topCompetitors: { name: string; auditsCiting: number }[];
  byProvider: { id: string; avgScore: number }[];
  distinctQueries: number;
  periodStart: string;
  periodEnd: string;
  lastUpdated: string;
}

/**
 * Point d'accès unique aux stats agrégées (vue SQL seo_stats, docs/10-seo.md §2).
 * Pas encore branché : aucun audit réel. Retourne null => état « en cours de collecte ».
 * Règle K-anonymat : à brancher en n'exposant jamais une stat calculée sur moins de 5 audits.
 */
export async function getSeoStats(_trade: string, _city: string): Promise<SeoStats | null> {
  return null;
}

export const MIN_AUDITS_FOR_INDEX = 5;
export const MAX_AGE_DAYS = 90;

/** Règle d'éligibilité à l'indexation (docs/10-seo.md §5). */
export function isIndexable(stats: SeoStats | null, now = Date.now()): boolean {
  if (!stats) return false;
  const ageDays = (now - new Date(stats.lastUpdated).getTime()) / 86_400_000;
  return stats.auditCount >= MIN_AUDITS_FOR_INDEX && stats.distinctQueries >= 3 && ageDays <= MAX_AGE_DAYS;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* URLs, maillage, JSON-LD                                              */
/* ------------------------------------------------------------------ */

export const tradePath = (t: Trade | string) => `/visibilite-ia/${typeof t === 'string' ? t : t.slug}`;
export const pairPath = (t: Trade | string, c: City | string) =>
  `${tradePath(t)}/${typeof c === 'string' ? c : c.slug}`;
export const auditHref = (t: Trade, c: City) =>
  `/audit?metier=${encodeURIComponent(t.slug)}&ville=${encodeURIComponent(c.slug)}`;

/** Métiers proches (maillage réel). */
const RELATED: Record<string, string[]> = {
  plombier: ['chauffagiste', 'electricien'],
  chauffagiste: ['plombier', 'electricien'],
  electricien: ['serrurier', 'plombier'],
  serrurier: ['electricien', 'menuisier'],
  couvreur: ['peintre-en-batiment', 'menuisier'],
  'peintre-en-batiment': ['menuisier', 'couvreur'],
  menuisier: ['peintre-en-batiment', 'serrurier'],
  demenageur: ['agence-immobiliere'],
  'agence-immobiliere': ['demenageur', 'photographe'],
  coiffeur: ['institut-de-beaute'],
  'institut-de-beaute': ['coiffeur'],
  restaurant: ['fleuriste'],
  fleuriste: ['restaurant', 'photographe'],
  photographe: ['fleuriste'],
  'garage-automobile': ['auto-ecole'],
  'auto-ecole': ['garage-automobile'],
};
export const relatedTrades = (t: Trade): Trade[] =>
  (RELATED[t.slug] ?? []).map(getTrade).filter((x): x is Trade => !!x);

/** Villes voisines pour le maillage (arrondissements voisins, sinon quelques grandes villes). */
export function neighbourCities(c: City): City[] {
  if (c.type === 'arrondissement') {
    const n = Number.parseInt(c.slug.replace('paris-', ''), 10);
    return [n - 1, n + 1]
      .filter((x) => x >= 1 && x <= 20)
      .map((x) => getCity(`paris-${x === 1 ? '1er' : x + 'e'}`))
      .filter((x): x is City => !!x);
  }
  return VILLES.filter((v) => v.slug !== c.slug).slice(0, 2);
}

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

/** Fil d'Ariane avec @id stable (le dernier élément est la page courante). */
export function breadcrumbLd(items: { name: string; path: string }[]) {
  return breadcrumbListLd(items[items.length - 1]?.path ?? '/', items);
}

export function faqLd(faq: Faq[], path: string) {
  return faqPageLd(path, faq);
}

/** Service proposé par la marque (jamais LocalBusiness / AggregateRating sur des tiers). */
export function serviceLd(t: Trade, c: City | null, path: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${pageIds(path).url}#service`,
    name: `Audit de visibilité IA pour ${t.nom_pluriel.toLowerCase()}${c ? ` à ${c.nom}` : ''}`,
    serviceType: 'Audit de visibilité sur les assistants IA',
    description: `Mesure de la fréquence à laquelle ChatGPT, Gemini et Perplexity recommandent un ${tradeLower(t)}${c ? ` à ${c.nom}` : ''}, avec score sur 100 et fourchette.`,
    url: abs(path),
    provider: orgRef(),
    areaServed: c ? { '@type': 'City', name: c.nom } : { '@type': 'Country', name: 'France' },
    audience: { '@type': 'BusinessAudience', name: t.nom_pluriel },
  };
}
