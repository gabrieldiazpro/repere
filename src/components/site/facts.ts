/**
 * Chiffres publics utilisables sur le site, avec leur source (docs/v2/01, 02, 06, 07).
 * Règle : aucun chiffre sans source affichée ; les études étrangères sont présentées comme telles.
 */
export type Fact = {
  id: string;
  figure: string;
  text: string;
  source: string;
  href: string;
};

export const FACTS = {
  weeklyUse: {
    id: "weeklyUse",
    figure: "1 sur 2",
    text: "Un Français sur deux utilise une IA générative au moins une fois par semaine.",
    source: "Observatoire Eskimoz × Ipsos, mai 2026, 1 000 personnes",
    href: "https://www.cbnews.fr/etudes/ia-fragmente-les-reflexes-recherche-francais",
  },
  credoc: {
    id: "credoc",
    figure: "48 %",
    text: "des Français de 12 ans et plus ont déjà utilisé une IA générative comme ChatGPT.",
    source: "Crédoc pour l'Arcep, Baromètre du numérique 2026",
    href: "https://www.credoc.fr/download/pdf/Sou/Sou2026-5064.pdf",
  },
  parisConversational: {
    id: "parisConversational",
    figure: "43 %",
    text: "des Parisiens utilisent la recherche conversationnelle, contre 24 % ailleurs en France.",
    source: "Observatoire Eskimoz × Ipsos, 2026",
    href: "https://www.cbnews.fr/etudes/ia-fragmente-les-reflexes-recherche-francais",
  },
  g2Start: {
    id: "g2Start",
    figure: "51 %",
    text: "des acheteurs de logiciels B2B commencent leur recherche plus souvent dans un chatbot que sur Google.",
    source: "G2, AI Search Insight Report, mars 2026, 1 076 décideurs (G2 vend de la visibilité)",
    href: "https://learn.g2.com/g2-2026-ai-search-insight-report",
  },
  g2Switch: {
    id: "g2Switch",
    figure: "69 %",
    text: "des acheteurs B2B disent qu'une IA leur a fait choisir un autre fournisseur que prévu.",
    source: "G2, AI Search Insight Report, mars 2026",
    href: "https://learn.g2.com/g2-2026-ai-search-insight-report",
  },
  sixsense: {
    id: "sixsense",
    figure: "94 %",
    text: "des groupes d'achat B2B ont classé leurs fournisseurs favoris avant le premier contact commercial.",
    source: "6sense, Buyer Experience Report 2025, plus de 4 000 acheteurs",
    href: "https://www.businesswire.com/news/home/20251112018032/en",
  },
  orbit: {
    id: "orbit",
    figure: "× 3",
    text: "Le trafic venu des IA convertit environ trois fois mieux en demandes de contact que le trafic organique.",
    source: "Orbit Media, 97 sites B2B, 29 M de sessions, 2025-2026",
    href: "https://www.orbitmedia.com/blog/conversion-rates-ai-search/",
  },
  valiuz: {
    id: "valiuz",
    figure: "9 sur 10",
    text: "En France, 9 visiteurs venus d'une IA sur 10 arrivent directement sur une fiche produit ; plus de 90 % de ce trafic vient de ChatGPT.",
    source: "Baromètre Valiuz, The Media Leader, février 2026",
    href: "https://fr.themedialeader.com/?p=210038",
  },
  adobe: {
    id: "adobe",
    figure: "+60 %",
    text: "de conversion pour le trafic venu des IA face aux autres visites, chez les e-commerçants américains en juillet 2026.",
    source: "Adobe Analytics, août 2026 (États-Unis)",
    href: "https://www.digitalcommerce360.com/2026/08/19/adobe-ai-referral-traffic-data-july-2026/",
  },
  insites: {
    id: "insites",
    figure: "30 %",
    text: "des commerces testés ont un mauvais numéro de téléphone dans les réponses de ChatGPT. Seuls 56 % ont toutes leurs informations exactes.",
    source: "Insites, 10 000 commerces américains, 2026",
    href: "https://insites.com/blog/does-chatgpt-hallucinate-local-businesses-the-data-on-ai-accuracy/",
  },
  searchable: {
    id: "searchable",
    figure: "64 %",
    text: "des commerces ont au moins une information fausse dans les réponses des IA. Les petits sont plus touchés que les grandes marques.",
    source: "Searchable, juillet 2026, 72 000 questions, commerces britanniques",
    href: "https://retailtechinnovationhub.com/home/2026/7/15/many-uk-high-street-retailers-are-suffering-from-ai-chatbot-inaccuracies-searchable-research-finds",
  },
  trust: {
    id: "trust",
    figure: "58 %",
    text: "des acheteurs perdent confiance dans une marque quand une IA leur donne une mauvaise information sur un produit.",
    source: "Searchable, juillet 2026, consommateurs britanniques",
    href: "https://retailtechinnovationhub.com/home/2026/7/15/many-uk-high-street-retailers-are-suffering-from-ai-chatbot-inaccuracies-searchable-research-finds",
  },
} satisfies Record<string, Fact>;

/** Prix du marché constatés publiquement (docs/v2/07-positionnement.md § 0). */
export const MARKET_SOURCES = [
  { label: "La Fabrique du Net, outils GEO (relevé oct. 2026)", href: "https://www.lafabriquedunet.fr/logiciels/marketing-digital/outils-geo" },
  { label: "La Fabrique du Net, tarifs des prestations GEO 2026", href: "https://www.lafabriquedunet.fr/agences/pages/agences-geo/tarifs" },
  { label: "geotoolbox, guide des agences GEO, nov. 2026", href: "https://geotoolbox.ai/fr/blog/agence-geo" },
];
