/**
 * Données du comparatif (publicité comparative) : une seule source pour /comparatif et /comparatif/[concurrent].
 * Règles : faits publics, vérifiables et datés ; chaque prix renvoie à une source ; ce qui n'a pas été lu sur la page
 * officielle de l'éditeur est marqué « non vérifié » ; aucun jugement de valeur sur un concurrent.
 * Relevé : docs/v3/01 à 03 (teardowns du 9 novembre 2026). À refaire avant toute republication.
 *
 * Les textes portent des renvois nommés `[@clé]` ; `makeRefs()` les transforme en `[n]` dans l'ordre d'apparition.
 */
import type { Source } from './editorial';

/** Date du relevé des prix et des fonctions des concurrents. */
export const COMPARE_CHECKED = '2026-11-09';
/** Date du relevé des suites SEO (Semrush, Ahrefs, Screaming Frog), ajoutées en V5. */
export const COMPARE_CHECKED_SEO = '2026-11-13';

export const SRC = {
  peec: { label: 'Peec AI, page Pricing', url: 'https://peec.ai/pricing', note: 'lue le 9 novembre 2026 ; prix en dollars' },
  peecAgencies: { label: 'Peec AI, offre agences', url: 'https://peec.ai/for-agencies', note: 'lue le 9 novembre 2026' },
  peecActions: { label: 'Peec AI, blog : introduction des Actions', url: 'https://peec.ai/blog/introducing-actions', note: 'éditeur, 2026' },
  peecAgent: {
    label: 'TechIntelPro, lancement de Peec Agent (23 octobre 2026)',
    url: 'https://techintelpro.com/news/marketing/ai/peec-ai-launches-peec-agent-expanding-actions-for-ai-search-optimization',
    note: 'source tierce, non vérifiée auprès de l’éditeur',
  },
  pricingsaasPeec: { label: 'PricingSaaS, historique des prix de Peec', url: 'https://pricingsaas.com/companies/peec', note: 'source tierce, consultée le 9 novembre 2026' },
  g2Peec: { label: 'G2, avis sur Peec AI', url: 'https://www.g2.com/products/peec-ai/reviews_and_filters', note: 'lue le 9 novembre 2026' },
  otterlyHelp: { label: 'Otterly.AI, aide : prix et quotas', url: 'https://help.otterly.ai/pricing-of-otterlyai', note: 'éditeur ; quotas lus, prix confirmés par source tierce' },
  otterlyFeatures: { label: 'Otterly.AI, page Features', url: 'https://webflow.otterly.ai/features', note: 'éditeur' },
  seVisibleOtterly: {
    label: 'SE Visible, revue d’Otterly.AI (26 août 2026)',
    url: 'https://visible.seranking.com/blog/otterly-ai-review/',
    note: 'éditeur d’un outil concurrent ; prix des options de moteurs',
  },
  g2Otterly: { label: 'G2, avis sur Otterly.AI', url: 'https://g2.com/products/otterlyai/reviews', note: 'note seule lue' },
  profound: { label: 'Profound, page Pricing', url: 'https://www.tryprofound.com/pricing', note: 'lue le 9 novembre 2026 ; offre payante sur devis' },
  profoundHome: { label: 'Profound, page d’accueil', url: 'https://www.tryprofound.com', note: 'lue le 9 novembre 2026 ; chiffres clients déclarés par l’éditeur' },
  pricingsaasProfound: { label: 'PricingSaaS, historique des prix de Profound', url: 'https://pricingsaas.com/companies/tryprofound', note: 'source tierce' },
  geotoolboxProfound: { label: 'geotoolbox, prix de Profound', url: 'https://geotoolbox.ai/blog/profound-pricing.md', note: 'éditeur d’un outil concurrent ; estimation non vérifiée' },
  g2Profound: { label: 'G2, avis sur Profound', url: 'https://www.g2.com/products/profound/reviews', note: 'lue le 9 novembre 2026' },
  lfdn: {
    label: 'La Fabrique du Net, outils GEO',
    url: 'https://www.lafabriquedunet.fr/logiciels/marketing-digital/outils-geo',
    note: 'mis à jour le 27 octobre 2026, prix relevés le 6 octobre 2026 ; annuaire rémunéré par les éditeurs',
  },
  digitiz: { label: 'Digitiz, logiciels GEO', url: 'https://digitiz.fr/logiciels-geo/', note: 'consultée le 8 novembre 2026 ; source tierce' },
  codeurQwairy: {
    label: 'Codeur, fiche Qwairy',
    url: 'https://www.codeur.com/comparatif/outil-geo/qwairy',
    note: 'juin 2026 ; test réalisé à la demande de Qwairy',
  },
  g2Qwairy: { label: 'G2, page Qwairy', url: 'https://www.g2.com/products/qwairy/discuss', note: 'note et nombre d’avis seulement' },
  hubspotMeteoria: {
    label: 'HubSpot, alternatives à Meteoria',
    url: 'https://blog.hubspot.fr/marketing/alternatives-meteoria',
    note: 'mis à jour le 5 octobre 2026 ; éditeur d’un outil concurrent',
  },
  bdmMeteoria: { label: 'Blog du Modérateur, fiche Meteoria', url: 'https://www.blogdumoderateur.com/tools/meteoria/', note: 'visuels datés d’août 2026' },
  lfdnAgences: {
    label: 'La Fabrique du Net, tarifs des prestations GEO en 2026',
    url: 'https://www.lafabriquedunet.fr/agences/pages/agences-geo/tarifs',
    note: '345 budgets, calcul du 9 novembre 2026 ; annuaire rémunéré par les agences',
  },
  semrushAi: { label: 'Semrush, page de prix de l’AI Visibility Toolkit', url: 'https://www.semrush.com/pricing/ai/', note: 'lue le 13 novembre 2026 ; prix en dollars, facturation annuelle' },
  semrushAiKb: { label: 'Semrush, aide : AI Visibility Toolkit et Semrush One', url: 'https://www.semrush.com/kb/1493-ai-visibility-toolkit', note: 'lue le 13 novembre 2026' },
  docketSemrush: { label: 'Docket, prix et limites de Semrush', url: 'https://docket.io/resources/research/semrush-pricing', note: 'source tierce, vérifiée en avril 2026 ; la page officielle n’a pas pu être lue depuis notre environnement' },
  styleSemrushOne: { label: 'Style Factory, revue de Semrush One', url: 'https://www.stylefactoryproductions.com/blog/semrush-one-review', note: 'source tierce, mise à jour 2026' },
  ahrefsPricing: { label: 'Ahrefs, page Plans & pricing', url: 'https://ahrefs.com/pricing', note: 'lue le 13 novembre 2026 ; prix en dollars hors taxes' },
  pricingsaasAhrefs: { label: 'PricingSaaS, historique des prix d’Ahrefs', url: 'https://pricingsaas.com/companies/ahrefs', note: 'source tierce, consultée le 13 novembre 2026' },
  ahrefsFree: { label: 'Ahrefs, aide : ce qui est gratuit', url: 'https://help.ahrefs.com/en/articles/13002606-what-can-i-use-for-free-in-ahrefs', note: 'lue le 13 novembre 2026' },
  sfPricing: { label: 'Screaming Frog, page de prix du SEO Spider', url: 'https://www.screamingfrog.co.uk/seo-spider/pricing/', note: 'lue le 13 novembre 2026 ; prix en euros' },
  sfIssues: { label: 'Screaming Frog, liste des problèmes détectés', url: 'https://www.screamingfrog.co.uk/seo-spider/issues/', note: 'éditeur' },
  blckAlpaca: {
    label: 'Blck Alpaca, « Prix du GEO : combien coûte vraiment l’optimisation GEO pour une PME »',
    url: 'https://blckalpaca.at/fr/blog/prix-du-geo-combien-coute-vraiment-loptimisation-geo-pour-une-pme',
    note: 'agence ; estimation à visée commerciale',
  },
} as const satisfies Record<string, Source>;

export type SrcKey = keyof typeof SRC;

/** Convertit les renvois `[@clé]` en `[n]` (ordre d'apparition) et fournit la liste des sources utilisées. */
export function makeRefs() {
  const order: SrcKey[] = [];
  const t = (s: string): string =>
    s.replace(/\[@(\w+)\]/g, (_m, k: string) => {
      const key = k as SrcKey;
      if (!(key in SRC)) throw new Error(`Source inconnue : ${k}`);
      let i = order.indexOf(key);
      if (i < 0) {
        order.push(key);
        i = order.length - 1;
      }
      return `[${i + 1}]`;
    });
  return { t, sources: (): Source[] => order.map((k) => SRC[k]) };
}

/* ------------------------------------------------------------------ */
/* Lignes du tableau fonctionnalité par fonctionnalité                  */
/* ------------------------------------------------------------------ */

export const FEATURES = [
  { id: 'questions', label: 'Questions suivies' },
  { id: 'frequence', label: 'Fréquence de mesure' },
  { id: 'ia', label: 'IA suivies' },
  { id: 'sources', label: 'Sources citées par les IA' },
  { id: 'faits', label: 'Vérification des faits dits par les IA' },
  { id: 'execution', label: 'Exécution des actions' },
  { id: 'trafic', label: 'Trafic venu des IA' },
  { id: 'audit', label: 'Audit de site ou de page' },
  { id: 'seo', label: 'SEO classique (technique, mots-clés, liens)' },
  { id: 'positions', label: 'Positions Google et Search Console' },
  { id: 'gratuit', label: 'Gratuit et outils gratuits' },
  { id: 'prix', label: 'Prix d’entrée et grille' },
  { id: 'integrations', label: 'Exports, API et intégrations' },
  { id: 'langue', label: 'Langue' },
  { id: 'cible', label: 'Cible annoncée' },
  { id: 'engagement', label: 'Engagement' },
  { id: 'preuves', label: 'Preuves publiques (avis)' },
] as const;
export type FeatureId = (typeof FEATURES)[number]['id'];

export type CompetitorSlug = 'peec' | 'otterly' | 'profound' | 'meteoria' | 'qwairy' | 'agence-geo' | 'semrush' | 'ahrefs' | 'screaming-frog';
export type ColumnId = 'repere' | CompetitorSlug;

export const CELLS: Record<ColumnId, Record<FeatureId, string>> = {
  repere: {
    questions: 'Découverte : 5. Local : 20 à 30. PME et e-commerce : 50 à 100, selon l’offre. Questions personnalisables.',
    frequence: 'Mensuelle (Découverte, Local), hebdomadaire (PME, e-commerce). Chaque question est répétée ; marge d’erreur affichée.',
    ia: 'ChatGPT, Perplexity, Gemini, Claude ; Mistral (Le Chat) en option. 3 IA en Découverte. Pas de suivi des AI Overviews ni de l’AI Mode.',
    sources: 'Oui, page par page pour ChatGPT, Perplexity et Claude, classées par opportunité. Pas pour Gemini (limite de ses conditions d’utilisation).',
    faits: 'Oui : fiche de vérité ; chaque affirmation contredite devient une tâche de correction.',
    execution: 'Agent de publication : corrections appliquées sur WordPress, Shopify, Webflow ou PrestaShop après votre validation, annulables ; export pour les autres sites. Accompagné : nous pilotons le travail.',
    trafic: 'Script sans cookie et lecture de Google Analytics 4. Un plancher mesuré, jamais un total.',
    audit: 'Exploration réelle du site (60 pages en analyse gratuite, 500 à 2 000 selon l’offre), 185 contrôles SEO et audit GEO en 8 familles avec niveau de preuve.',
    seo: '185 contrôles SEO en 12 familles, adaptés au type de site ; pas d’index de liens propre (liens entrants via un fournisseur de données).',
    positions: 'Search Console (16 mois), PageSpeed et CrUX ; 20 à 300 mots-clés suivis chaque semaine selon l’offre (fournisseur DataForSEO).',
    gratuit: 'Analyse du site en 60 secondes sans compte ; offre Découverte permanente (1 marque, 5 questions, 1 mesure par mois, 3 IA) et outils gratuits.',
    prix: '0 € (Découverte). Essentiel dès 29 €/mois (local), 79 € (e-commerce), 99 € (PME). Accompagné dès 99 €/mois.',
    integrations: 'Search Console, PageSpeed, Bing Webmaster Tools ; publication WordPress, Shopify, Webflow, PrestaShop ; exports CSV, lien de partage, Slack, webhook signé. Pas de Looker Studio ni de serveur MCP.',
    langue: 'Français natif, vocabulaire sans jargon.',
    cible: 'TPE, PME, commerces locaux, e-commerces.',
    engagement: 'Essentiel sans engagement ; Accompagné : 3 mois minimum.',
    preuves: 'Aucun avis tiers ni client nommé à ce jour.',
  },
  peec: {
    questions: '50 (Starter), 150 (Pro), 350 (Advanced). [@peec]',
    frequence: 'Quotidien ou hebdomadaire en Enterprise ; rythme des autres offres non vérifié. [@peec]',
    ia: '3 au choix parmi 6 (ChatGPT, AI Mode, AI Overviews, Copilot, Gemini, Naver). Claude, Mistral, Perplexity et d’autres en Enterprise. [@peec]',
    sources: 'Oui : domaines, URL et types de pages. [@peec]',
    faits: 'Corrections d’affirmations fausses parmi les actions étendues d’octobre 2026 (source tierce). [@peecAgent]',
    execution: 'Actions suivies avec impact, puis Peec Agent : briefs, suggestions d’édition, connecteurs avec approbation. Crédits d’agent plafonnés. [@peecAgent]',
    trafic: 'Visites des robots d’IA sur le site. Attribution du trafic humain : non relevée. [@peec]',
    audit: 'Non relevé dans nos sources ; un utilisateur le demande sur G2. [@g2Peec]',
    seo: 'Non relevé dans nos sources.',
    positions: 'Non relevé dans nos sources.',
    gratuit: 'Essai gratuit annoncé, durée non vérifiée.',
    prix: 'Starter 95 $/mois ; Pro 245 $ ; Advanced 495 $ ; Enterprise sur devis. [@peec]',
    integrations: 'CSV partout, API dès Pro, MCP partout, Looker Studio avec Advanced. [@peec]',
    langue: 'Langue de l’interface non vérifiée.',
    cible: 'Équipes marketing et agences. [@peecAgencies]',
    engagement: '−15 % en paiement annuel ; engagement mensuel non vérifié. [@peec]',
    preuves: 'G2 : 4,7/5 sur 21 avis (lu le 9 novembre 2026). [@g2Peec]',
  },
  otterly: {
    questions: '15 (Lite), 100 (Standard), 400 (Premium). [@otterlyHelp]',
    frequence: 'Suivi quotidien. [@otterlyHelp]',
    ia: 'ChatGPT, AI Overviews, Perplexity, Copilot inclus. Gemini, AI Mode et Claude en options payantes. [@otterlyHelp][@seVisibleOtterly]',
    sources: 'Oui : citations par domaine et catégorie. [@otterlyHelp]',
    faits: 'Non relevé dans nos sources.',
    execution: 'Recommandations et audit ; pas d’exécution relevée. [@otterlyFeatures]',
    trafic: 'Analyse des visites de robots d’IA dès Standard. [@otterlyHelp]',
    audit: 'Oui : audit GEO (accès d’une vingtaine de robots d’IA, rendu statique ou dynamique, données structurées). [@seVisibleOtterly]',
    seo: 'Non relevé au-delà de l’audit GEO.',
    positions: 'Non relevé dans nos sources.',
    gratuit: 'Essai sans carte bancaire, durée non précisée. [@otterlyHelp]',
    prix: 'Lite 29 $/mois ; Standard 189 $ ; Premium 489 $ ; Enterprise dès 1 000 $. [@seVisibleOtterly]',
    integrations: 'Exports CSV ; API, MCP et Looker Studio dès Standard. [@otterlyHelp]',
    langue: 'Langue de l’interface non vérifiée.',
    cible: 'Équipes marketing et agences (espaces de travail par client). [@otterlyHelp]',
    engagement: '−15 % en paiement annuel. [@seVisibleOtterly]',
    preuves: 'G2 : 4,7/5 sur 54 avis. [@g2Otterly]',
  },
  profound: {
    questions: 'Plan de prompts sur mesure en Enterprise ; essai : 50 prompts imposés pendant 7 jours. [@profound]',
    frequence: 'Quotidienne. [@profound]',
    ia: 'Jusqu’à 9 en Enterprise (dont ChatGPT, Perplexity, AI Mode, Gemini, Claude, AI Overviews). Essai : ChatGPT, Gemini, AI Overviews. [@profound]',
    sources: 'Oui, par moteur, avec les sous-requêtes générées par les moteurs. [@profound]',
    faits: 'Non relevé dans nos lectures de l’offre.',
    execution: 'Agents et « AI Marketer » (contenus, tâches), avec crédits. [@profound]',
    trafic: 'Agent Analytics : visites des robots d’IA, via journaux serveur ou CDN. [@profound]',
    audit: 'Non relevé comme audit de page.',
    seo: 'Non relevé dans nos sources.',
    positions: 'Non relevé dans nos sources.',
    gratuit: 'Essai gratuit de 7 jours. [@profound]',
    prix: 'Offre payante sur devis. Estimation tierce de 2 000 à 5 000 $/mois, non vérifiée. [@profound][@geotoolboxProfound]',
    integrations: 'CSV et JSON, API, SSO et SAML en Enterprise. [@profound]',
    langue: 'Site en anglais ; langue de l’interface non vérifiée.',
    cible: 'Grandes entreprises ; l’éditeur revendique un tiers du Fortune 100. [@profoundHome]',
    engagement: 'Sur devis.',
    preuves: 'G2 : 4,5/5 sur 1 133 avis. [@g2Profound]',
  },
  meteoria: {
    questions: '25 (Starter), 100, 300 prompts. [@lfdn]',
    frequence: 'Interrogation quotidienne. [@bdmMeteoria]',
    ia: '3 au choix parmi 7 (ChatGPT, Perplexity, Gemini, Grok, Copilot, AI Overviews, AI Mode). Claude non suivi. [@lfdn][@digitiz]',
    sources: 'Oui : sentiment relié à ses sources, filtres par domaine. [@bdmMeteoria]',
    faits: 'Non relevé dans nos sources.',
    execution: 'Recommandations « LLM-friendly » ; un « Action Engine » est annoncé. [@bdmMeteoria]',
    trafic: 'Google Analytics et Matomo dès Starter. [@lfdn]',
    audit: 'Non relevé dans nos sources.',
    gratuit: 'Essai de 7 jours. [@lfdn]',
    seo: 'Non relevé dans nos sources.',
    positions: 'Non relevé dans nos sources.',
    prix: 'Starter 75 €/mois ; 175 € ; 420 € ; Enterprise environ 700 €. HT ou TTC non précisé. [@lfdn]',
    integrations: 'Export CSV et JSON ; API, MCP et SSO en Enterprise. [@bdmMeteoria]',
    langue: 'Éditeur français ; langue de l’interface non vérifiée.',
    cible: 'Grands comptes et mid-market selon HubSpot, PME et e-commerce selon Digitiz : sources divergentes. [@hubspotMeteoria][@digitiz]',
    engagement: 'Deux mois offerts en paiement annuel ; engagement mensuel non vérifié. [@lfdn]',
    preuves: 'Aucune note publique relevée.',
  },
  qwairy: {
    questions: '100 prompts et 1 300 crédits (Starter) ; les crédits limitent le nombre d’IA suivies en même temps. [@lfdn]',
    frequence: 'Non vérifié.',
    ia: '12 à 18 selon les sources ; Mistral sur devis. [@lfdn][@digitiz]',
    sources: 'Oui, avec des prix indicatifs de places de marché françaises pour les liens. [@codeurQwairy]',
    faits: 'Non relevé dans nos sources.',
    execution: 'Content Studio (rédaction assistée) et pistes de liens ; la publication reste à votre charge. [@codeurQwairy]',
    trafic: 'Activité des robots d’IA, Search Console, Bing, Google Analytics, Looker Studio. [@codeurQwairy]',
    audit: 'Diagnostic de contenu à partir du sitemap. [@codeurQwairy]',
    seo: 'Non relevé au-delà du diagnostic de contenu.',
    positions: 'Search Console et Bing Webmaster Tools connectés. [@codeurQwairy]',
    gratuit: '120 crédits offerts. [@lfdn]',
    prix: 'Starter 79 € HT/mois ; Growth 199 € ; Business 449 € ; Enterprise sur devis. [@lfdn]',
    integrations: 'Search Console, Bing, Google Analytics, Looker Studio, WordPress, API, serveur MCP dès Starter. [@codeurQwairy]',
    langue: 'Interface entièrement en anglais selon Codeur (juin 2026). [@codeurQwairy]',
    cible: 'Agences, responsables SEO, marques B2B. [@codeurQwairy]',
    engagement: 'Non vérifié.',
    preuves: 'G2 : 4,7/5 sur 54 avis, NPS 83 ; « 2 000+ marques » revendiquées par l’éditeur. [@g2Qwairy]',
  },
  'agence-geo': {
    questions: 'Selon le périmètre du contrat.',
    frequence: 'Selon le contrat.',
    ia: 'Selon l’outil de l’agence.',
    sources: 'Variable selon l’agence.',
    faits: 'Variable selon l’agence.',
    execution: 'Oui, sur mesure : c’est le cœur de l’offre.',
    trafic: 'Variable selon l’agence.',
    audit: 'Oui : audit initial de 1 500 à 3 000 €. [@lfdnAgences]',
    seo: 'Souvent inclus, selon l’agence.',
    positions: 'Selon l’outil de l’agence.',
    gratuit: 'Parfois un premier audit offert, selon l’agence.',
    prix: 'Forfaits dès 800 €/mois ; 1 500 à 2 500 €/mois pour une ambition nationale ; budget médian de 5 000 € par prestation. [@lfdnAgences][@blckAlpaca]',
    integrations: 'Variable selon l’agence.',
    langue: 'Français en général.',
    cible: 'Entreprises avec un budget dédié, de la PME à la grande marque.',
    engagement: 'Sur devis.',
    preuves: 'Variables ; l’annuaire de référence est rémunéré par les agences. [@lfdnAgences]',
  },
  semrush: {
    questions: 'AI Visibility Toolkit : 25 prompts suivis ; 50, 100 ou 200 dans les offres Semrush One. [@semrushAi][@semrushAiKb]',
    frequence: 'Suivi quotidien des prompts ; mises à jour quotidiennes, hebdomadaires ou mensuelles selon les rapports. [@semrushAi]',
    ia: 'Suivi des prompts : ChatGPT et AI Mode de Google ; mentions relevées aussi dans Gemini, Perplexity et les réponses IA de Google. [@semrushAiKb][@semrushAi]',
    sources: 'Analyse de la marque face aux concurrents, part de voix, sentiment et récits dans les réponses. [@semrushAiKb]',
    faits: 'Non relevé dans nos sources.',
    execution: 'Recommandations générées par IA ; publication sur votre site non relevée. [@semrushAiKb]',
    trafic: 'Non relevé dans nos sources.',
    audit: 'Site Audit : 100 000 pages par audit (Pro), 300 000 (Guru), 1 000 000 (Business) ; audit d’accès des robots d’IA (100 pages dans l’offre de base). [@docketSemrush][@semrushAiKb]',
    seo: 'Suite complète : recherche de mots-clés, positions, analyse des concurrents, liens, publicité, contenu. [@docketSemrush]',
    positions: 'Oui : suivi de positions dans les offres SEO. [@docketSemrush]',
    gratuit: 'Pas d’essai gratuit pour l’AI Visibility Toolkit. [@semrushAiKb]',
    prix: 'Pro 139,95 $/mois, Guru 249,95 $, Business 499,95 $ (relevé tiers d’avril 2026) ; AI Visibility Toolkit 99 $/mois par domaine en annuel ; Semrush One 199 $, 299 $ et 549 $/mois (relevé tiers). [@docketSemrush][@semrushAi][@styleSemrushOne]',
    integrations: 'API dans l’offre Semrush One Advanced (relevé tiers) ; utilisateurs supplémentaires dès 45 $/mois. [@styleSemrushOne][@semrushAi]',
    langue: 'Langue de l’interface non vérifiée.',
    cible: 'Équipes marketing et SEO, agences.',
    engagement: 'Remise en paiement annuel (Pro à 117,33 $/mois). [@docketSemrush]',
    preuves: 'Non relevé dans nos sources.',
  },
  ahrefs: {
    questions: 'Brand Radar : 150 (Lite) à 600 (Advanced) vérifications de prompts par mois ; packs de 2 500 à 25 000 vérifications de 50 à 250 $/mois. [@ahrefsPricing]',
    frequence: 'Non relevé dans nos sources.',
    ia: 'Brand Radar AI ; liste des moteurs couverts non relevée sur la page de prix. [@ahrefsPricing]',
    sources: 'Non relevé dans nos sources.',
    faits: 'Non relevé dans nos sources.',
    execution: 'Non relevé dans nos sources.',
    trafic: 'Non relevé dans nos sources.',
    audit: 'Site Audit dans toutes les offres : 100 000 crédits d’exploration par mois en Lite (25 000 pages par projet), jusqu’à 1,5 million en Advanced ; audit permanent. [@ahrefsPricing]',
    seo: 'Index de liens et de mots-clés de référence, Site Explorer, recherche de mots-clés. [@ahrefsPricing]',
    positions: 'Oui : 750 (Lite) à 5 000 (Advanced) mots-clés suivis. [@ahrefsPricing]',
    gratuit: 'Compte gratuit pour un site vérifié : Site Audit (5 000 crédits par mois et par projet) et Site Explorer limité. [@ahrefsFree]',
    prix: 'Lite 129 $/mois, Standard 249 $, Advanced 449 $, Enterprise sur devis ; Brand Radar AI dès 199 $/mois. [@ahrefsPricing][@pricingsaasAhrefs]',
    integrations: 'Utilisateurs supplémentaires de 40 à 80 $/mois selon l’offre. [@ahrefsPricing]',
    langue: 'Langue de l’interface non vérifiée.',
    cible: 'Spécialistes SEO, équipes marketing, agences.',
    engagement: 'Jusqu’à 17 % de remise en paiement annuel. [@ahrefsPricing]',
    preuves: 'Non relevé dans nos sources.',
  },
  'screaming-frog': {
    questions: 'Sans objet : robot d’exploration, pas de suivi des réponses des IA.',
    frequence: 'Explorations lancées à la demande (planification possible, non relevée sur la page de prix).',
    ia: 'Intégrations OpenAI, Gemini, Anthropic et Ollama pour analyser les pages explorées, pas pour mesurer les réponses des IA. [@sfPricing]',
    sources: 'Sans objet.',
    faits: 'Sans objet.',
    execution: 'Sans objet : un outil d’analyse.',
    trafic: 'Sans objet.',
    audit: 'Exploration complète depuis votre ordinateur : illimitée en version payante (selon mémoire et stockage), 500 URL en version gratuite. [@sfPricing]',
    seo: 'Audit technique de référence : codes de réponse, titres, directives, canonical, hreflang, JavaScript, données structurées… [@sfIssues]',
    positions: 'Non relevé dans nos sources.',
    gratuit: 'Version gratuite limitée à 500 URL. [@sfPricing]',
    prix: '245 € par an et par licence (1 à 4 licences), 209 € dès 20 licences. [@sfPricing]',
    integrations: 'Serveur MCP et intégrations IA, y compris en version gratuite. [@sfPricing]',
    langue: 'Langue de l’interface non vérifiée.',
    cible: 'Spécialistes SEO techniques et agences.',
    engagement: 'Licence annuelle. [@sfPricing]',
    preuves: 'Non relevé dans nos sources.',
  },
};

export const COLUMN_LABELS: Record<ColumnId, string> = {
  repere: 'Repéré',
  peec: 'Peec AI',
  otterly: 'Otterly.AI',
  profound: 'Profound',
  meteoria: 'Meteoria',
  qwairy: 'Qwairy',
  'agence-geo': 'Agence GEO',
  semrush: 'Semrush',
  ahrefs: 'Ahrefs',
  'screaming-frog': 'Screaming Frog',
};

/* ------------------------------------------------------------------ */
/* Fiches des 6 concurrents principaux                                  */
/* ------------------------------------------------------------------ */

export interface Competitor {
  slug: CompetitorSlug;
  name: string;
  /** Pays et statut. */
  origin: string;
  /** Une phrase neutre qui dit ce qu'est l'outil. */
  what: string;
  /** Réponse directe de la page « Repéré ou X ? ». */
  answer: string;
  /** Intro détaillée (2 à 3 phrases). */
  intro: string;
  /** Où le concurrent est meilleur ou plus complet que Repéré (faits, avec renvois). */
  strengths: string[];
  /** Prix : statut de la vérification. */
  priceStatus: string;
  chooseThem: string[];
  chooseUs: string[];
  /** Limites de Repéré à dire honnêtement sur cette comparaison. */
  ourLimits: string[];
  faq: { q: string; a: string }[];
  description: string;
  /** Famille d'outil (V5) : mesure des IA, agence, ou suite SEO. */
  family?: 'geo' | 'agence' | 'seo';
  /** Date du relevé, si différente de COMPARE_CHECKED. */
  checked?: string;
}

export const COMPETITORS: Competitor[] = [
  {
    slug: 'peec',
    name: 'Peec AI',
    origin: 'Berlin, Allemagne',
    what: 'Peec AI est un outil de mesure de la visibilité dans les IA, avec des actions recommandées et un agent, vendu en dollars.',
    answer:
      'Choisissez Peec si une équipe marketing veut piloter elle-même des centaines de questions, des intégrations (API, MCP, Looker Studio) et plusieurs pays ; choisissez Repéré si vous voulez un outil en français, un prix d’entrée bas et, au besoin, l’exécution faite pour vous.',
    intro:
      'Peec AI propose quatre niveaux de prix publics (de 95 à 495 dollars par mois) et une offre Enterprise sur devis. Il suit trois IA au choix sur six et ajoute d’autres moteurs sur devis. Depuis octobre 2026, il propose aussi des actions étendues et un agent.',
    strengths: [
      'Plus de questions suivies dans les offres publiques : 50, 150 ou 350, contre 50 à 100 chez Repéré (offres PME et e-commerce) [@peec].',
      'Intégrations plus étendues : API dès l’offre Pro, serveur MCP dans toutes les offres, Looker Studio avec l’offre Advanced [@peec].',
      'Suivi de plusieurs pays (jusqu’à 3 avec l’offre Pro) et des AI Overviews et de l’AI Mode de Google, que Repéré ne mesure pas [@peec].',
      'Un agent conversationnel et des actions avec mesure d’impact, lancés le 23 octobre 2026 [@peecAgent].',
      'Une note publique (G2 : 4,7/5 sur 21 avis) que Repéré n’a pas encore [@g2Peec].',
    ],
    priceStatus: 'Prix lus sur la page officielle de l’éditeur le 9 novembre 2026 ; en dollars, non convertis.',
    chooseThem: [
      'Votre équipe marketing a le temps d’exploiter un tableau de bord chaque semaine.',
      'Vous voulez suivre plus de 100 questions, plusieurs pays ou les AI Overviews de Google.',
      'Vous avez besoin d’API, de MCP ou de Looker Studio pour vos rapports.',
      'Vous êtes une agence et voulez des projets de démonstration pour vos prospects.',
    ],
    chooseUs: [
      'Vous voulez un outil et un support en français, avec un vocabulaire sans jargon.',
      'Vous partez de zéro : l’offre Découverte est gratuite sans limite de durée, et Essentiel démarre à 29 € par mois.',
      'Vous voulez que les corrections soient faites pour vous (offre Accompagné), après votre validation.',
      'Vous voulez vérifier ce que les IA affirment sur votre entreprise, avec votre fiche de vérité.',
    ],
    ourLimits: [
      'Repéré suit 4 IA (ChatGPT, Perplexity, Gemini, Claude), plus Mistral en option : pas les AI Overviews ni l’AI Mode.',
      'Pas d’API publique, de serveur MCP ni de Looker Studio à ce jour.',
    ],
    faq: [
      {
        q: 'Peec AI ou Repéré : lequel est le moins cher ?',
        a: 'À l’entrée, Repéré : une offre gratuite et Essentiel dès 29 € par mois, contre 95 $ par mois pour Peec Starter. Les périmètres diffèrent (50 questions et 3 IA au choix chez Peec Starter) : comparez à usage égal avant de décider.',
      },
      {
        q: 'Peec AI fait-il le travail à ma place ?',
        a: 'Peec propose des actions et, depuis octobre 2026, un agent qui prépare des briefs et des suggestions d’édition avec votre approbation, dans la limite de crédits mensuels. Repéré réalise en plus les prestations de l’offre Accompagné, après validation.',
      },
    ],
    description:
      'Repéré ou Peec AI : prix publics datés, IA suivies, intégrations, exécution. Un comparatif factuel, y compris là où Peec est plus complet.',
  },
  {
    slug: 'otterly',
    name: 'Otterly.AI',
    origin: 'Vienne, Autriche',
    what: 'Otterly.AI est un outil de suivi de la visibilité dans les IA, avec un audit GEO intégré, au prix d’entrée bas.',
    answer:
      'Choisissez Otterly pour un suivi quotidien de peu de questions à 29 $ par mois et un audit GEO intégré ; choisissez Repéré si vous voulez la vérification des faits, un plan d’action en français et la possibilité de déléguer l’exécution.',
    intro:
      'Otterly.AI affiche trois niveaux (29, 189 et 489 dollars par mois) et une offre Enterprise dès 1 000 dollars. ChatGPT, AI Overviews, Perplexity et Copilot sont inclus ; Gemini, AI Mode et Claude sont des options payantes.',
    strengths: [
      'Prix d’entrée en dollars proche du nôtre (29 $ pour 15 questions) avec suivi quotidien [@otterlyHelp].',
      'Un audit GEO intégré : accès d’une vingtaine de robots d’IA, rendu statique ou dynamique, données structurées [@seVisibleOtterly].',
      'Les AI Overviews font partie des moteurs inclus, ce que Repéré ne mesure pas [@otterlyHelp].',
      'Espaces de travail multiples, membres illimités, Looker Studio, API et MCP dès l’offre Standard [@otterlyHelp].',
      'Une note publique (G2 : 4,7/5 sur 54 avis) [@g2Otterly].',
    ],
    priceStatus:
      'Quotas lus sur l’aide de l’éditeur ; prix et options de moteurs relevés auprès d’une source tierce (éditeur d’un outil concurrent), à reconfirmer sur la page officielle.',
    chooseThem: [
      'Vous voulez un suivi quotidien et un audit GEO de vos pages dans le même outil.',
      'Vous gérez plusieurs marques ou clients (espaces de travail).',
      'Vous voulez suivre les AI Overviews de Google.',
      'Vous acceptez de payer les moteurs additionnels à la carte.',
    ],
    chooseUs: [
      'Vous voulez Claude, ChatGPT, Perplexity et Gemini sans options à ajouter, avec un prix lisible.',
      'Vous voulez vérifier les affirmations fausses des IA sur votre entreprise.',
      'Vous voulez des textes prêts à copier, ou l’exécution faite pour vous.',
      'Vous voulez une interface et une méthode en français, avec marge d’erreur affichée.',
    ],
    ourLimits: [
      'Notre audit vérifie l’accès des principaux robots de recherche des IA (robots.txt, en-têtes, réponses servies à notre robot) ; il ne teste pas le pare-feu robot par robot.',
      'Pas de suivi quotidien en Local ni de suivi des AI Overviews.',
    ],
    faq: [
      {
        q: 'Otterly.AI ou Repéré : quelle différence de prix ?',
        a: 'À l’entrée, les deux sont proches : 29 $ par mois pour 15 questions chez Otterly Lite, 29 € par mois pour 20 questions en Local chez Repéré. Gemini, AI Mode et Claude sont des options payantes chez Otterly, les IA suivies par Repéré sont comprises dans l’offre.',
      },
      {
        q: 'Otterly.AI audite-t-il mon site ?',
        a: 'Oui, d’après les sources consultées : il vérifie l’accès des robots d’IA, le rendu et les données structurées. Repéré propose un audit « prêt pour les IA » et un score de citabilité d’une page, avec règles publiées.',
      },
    ],
    description:
      'Repéré ou Otterly.AI : prix datés, options de moteurs, audit GEO, vérification des faits. Comparatif factuel, avec les cas où Otterly est le meilleur choix.',
  },
  {
    slug: 'profound',
    name: 'Profound',
    origin: 'New York, États-Unis',
    what: 'Profound est une plateforme de marketing pour IA destinée aux grandes entreprises, vendue sur devis.',
    answer:
      'Choisissez Profound si vous êtes une grande entreprise qui a besoin de neuf moteurs, d’analyse des robots d’IA, de SSO et d’un contrat sur devis ; Repéré est conçu pour des TPE, PME et e-commerces qui veulent un prix public et une prise en main simple.',
    intro:
      'Profound propose un essai gratuit de 7 jours et une offre payante sur devis. Les offres Starter à 99 $ et Growth à 399 $, publiées en juin 2026, ont été retirées le 21 septembre 2026 selon une source tierce.',
    strengths: [
      'Jusqu’à neuf moteurs en Enterprise, dont les AI Overviews et l’AI Mode de Google, que Repéré ne mesure pas [@profound].',
      'Analyse des visites des robots d’IA à partir des journaux serveur ou du CDN, avec domaines illimités [@profound].',
      'Des fonctions d’entreprise : SSO et SAML, API, historique complet, SOC 2 [@profound].',
      'Des références clients déclarées (un tiers du Fortune 100) et 1 133 avis G2 (4,5/5) [@profoundHome][@g2Profound].',
    ],
    priceStatus:
      'Page de prix de l’éditeur lue le 9 novembre 2026 : l’offre payante est sur devis, aucun prix public. L’estimation de 2 000 à 5 000 $ par mois vient d’un concurrent et n’est pas vérifiée.',
    chooseThem: [
      'Vous êtes une grande entreprise ou une marque multi-pays.',
      'Vous exigez SSO, SOC 2, API et un interlocuteur dédié.',
      'Vous voulez suivre neuf moteurs, dont les AI Overviews.',
      'Votre budget se compte en milliers d’euros par mois.',
    ],
    chooseUs: [
      'Vous voulez connaître le prix avant de parler à quelqu’un : tous nos prix sont publics.',
      'Vous êtes une TPE, une PME ou un e-commerce et vous voulez commencer gratuitement.',
      'Vous voulez un outil en français et un accompagnement concret.',
      'Vous voulez vérifier ce que les IA disent de votre entreprise avec une fiche de vérité.',
    ],
    ourLimits: [
      'Repéré ne couvre ni les neuf moteurs de Profound ni les fonctions d’entreprise (SSO, SOC 2).',
      'Pas d’analyse des journaux serveur : notre trafic IA est un plancher mesuré par script sans cookie.',
    ],
    faq: [
      {
        q: 'Combien coûte Profound ?',
        a: 'L’éditeur ne publie pas de prix pour l’offre payante : elle est sur devis. Un essai gratuit de 7 jours est affiché. Une estimation tierce de 2 000 à 5 000 $ par mois circule, mais elle n’est pas vérifiée.',
      },
      {
        q: 'Profound est-il adapté à une PME ?',
        a: 'L’éditeur cible des grandes entreprises. Une PME peut le tester pendant 7 jours, mais Repéré, Peec, Otterly ou Meteoria sont conçus pour des budgets plus modestes.',
      },
    ],
    description:
      'Repéré ou Profound : prix (sur devis), moteurs, fonctions d’entreprise, cible. Un comparatif factuel pour savoir quand une plateforme d’entreprise se justifie.',
  },
  {
    slug: 'meteoria',
    name: 'Meteoria',
    origin: 'Paris, France',
    what: 'Meteoria est un outil français de suivi de la visibilité dans les IA, lancé en octobre 2025.',
    answer:
      'Choisissez Meteoria pour un suivi quotidien de 3 moteurs au choix parmi 7, avec un éditeur français et des intégrations Google Analytics et Matomo ; choisissez Repéré si vous voulez Claude et la vérification des faits, un parcours local, PME ou e-commerce, et l’exécution possible.',
    intro:
      'Meteoria affiche des prix à partir de 75 € par mois pour 25 prompts, jusqu’à 420 € et un palier Enterprise d’environ 700 €. Il suit trois moteurs choisis parmi sept. Les prix ci-dessous viennent d’un annuaire, la page tarifs de l’éditeur n’ayant pas pu être lue.',
    strengths: [
      'Plus de moteurs différents au choix, dont les AI Overviews, l’AI Mode, Copilot et Grok, que Repéré ne suit pas [@lfdn].',
      'Suivi quotidien et cartographie des sous-requêtes générées par les IA [@bdmMeteoria].',
      'Connexion à Google Analytics et Matomo dès l’offre Starter ; API, MCP et SSO en Enterprise [@lfdn][@bdmMeteoria].',
      'Un éditeur français avec une feuille de route annoncée (copilote, alertes en temps réel) [@bdmMeteoria].',
    ],
    priceStatus:
      'Non vérifié sur le site de l’éditeur (inaccessible lors du relevé). Prix de l’annuaire La Fabrique du Net, relevés le 6 octobre 2026 ; HT ou TTC non précisé.',
    chooseThem: [
      'Vous voulez un suivi quotidien de quelques questions avec un éditeur français.',
      'Vous voulez suivre les AI Overviews ou l’AI Mode de Google.',
      'Vous utilisez Matomo ou Google Analytics et voulez les relier à l’outil.',
      'Vous avez une équipe qui exploite le tableau de bord.',
    ],
    chooseUs: [
      'Vous voulez suivre Claude, que Meteoria ne suit pas selon Digitiz [@digitiz].',
      'Vous voulez une offre gratuite permanente avant de payer.',
      'Vous voulez la vérification des faits dits par les IA et un plan d’action pour non-experts.',
      'Vous voulez déléguer les corrections à l’offre Accompagné.',
    ],
    ourLimits: [
      'Repéré ne suit pas les AI Overviews, l’AI Mode, Copilot ni Grok.',
      'Pas d’intégration Matomo ; Google Analytics 4 en lecture seulement.',
    ],
    faq: [
      {
        q: 'Meteoria ou Repéré : lequel choisir pour une PME française ?',
        a: 'Les deux sont français. Meteoria est un outil de suivi sur trois moteurs au choix ; Repéré ajoute la vérification des faits, l’exécution en option et une offre gratuite. Selon HubSpot, Meteoria cible les grands comptes et le mid-market ; selon Digitiz, les PME et l’e-commerce : les sources divergent.',
      },
      {
        q: 'Meteoria suit-il Claude ?',
        a: 'Non, selon Digitiz (consulté le 8 novembre 2026) : Claude n’est pas parmi les sept moteurs proposés. À reconfirmer sur le site de l’éditeur.',
      },
    ],
    description:
      'Repéré ou Meteoria : prix datés (non vérifiés), moteurs suivis, Claude, intégrations. Comparatif factuel entre deux outils français.',
  },
  {
    slug: 'qwairy',
    name: 'Qwairy',
    origin: 'Paris, France',
    what: 'Qwairy est une plateforme française de suivi et d’optimisation GEO, lancée en mai 2025, orientée agences et marques B2B.',
    answer:
      'Choisissez Qwairy si vous êtes une agence ou une équipe SEO qui veut beaucoup de moteurs, de connecteurs (Search Console, Looker Studio, MCP) et un studio de rédaction ; choisissez Repéré si vous voulez une interface française, un prix d’entrée plus bas et des corrections faites pour vous.',
    intro:
      'Qwairy affiche trois paliers (79, 199 et 449 € par mois, HT) et un palier Enterprise. L’éditeur revendique plus de 2 000 marques. Les prix viennent d’un annuaire ; la page tarifs de l’éditeur n’a pas pu être lue.',
    strengths: [
      'Beaucoup de moteurs (12 à 18 selon les sources) et un cockpit avec grille thème par IA et comparaison jusqu’à 10 concurrents [@lfdn][@digitiz].',
      'Connecteurs : Search Console, Bing Webmaster Tools, Google Analytics, Looker Studio, WordPress, API et serveur MCP dès l’offre Starter [@codeurQwairy].',
      'Content Studio (rédaction assistée) et pistes de liens avec prix de places de marché françaises [@codeurQwairy].',
      'Un espace pour agences qui génère des audits de prospection [@codeurQwairy].',
      'Une note publique (G2 : 4,7/5 sur 54 avis, NPS 83) [@g2Qwairy].',
    ],
    priceStatus:
      'Non vérifié sur le site de l’éditeur (inaccessible lors du relevé). Prix de La Fabrique du Net, relevés le 6 octobre 2026, hors taxes.',
    chooseThem: [
      'Vous êtes une agence, un responsable SEO ou une marque B2B avec une équipe dédiée.',
      'Vous voulez relier Search Console, Looker Studio ou un serveur MCP.',
      'Vous voulez un studio de rédaction assistée et des pistes de liens chiffrées.',
      'L’interface en anglais ne vous gêne pas.',
    ],
    chooseUs: [
      'Vous voulez une interface entièrement en français : celle de Qwairy est en anglais selon Codeur (juin 2026) [@codeurQwairy].',
      'Vous voulez commencer gratuitement et sans engagement, avec un prix d’entrée de 29 €.',
      'Vous voulez des corrections réalisées pour vous, après validation.',
      'Vous voulez Mistral inclus en option, là où il est sur devis chez Qwairy [@digitiz].',
    ],
    ourLimits: [
      'Moins de moteurs (4, plus Mistral en option) et moins de connecteurs que Qwairy.',
      'Pas d’espace dédié aux agences en achat libre à ce jour : l’offre Agence est en liste d’attente.',
    ],
    faq: [
      {
        q: 'Qwairy ou Repéré : lequel est le plus complet ?',
        a: 'Qwairy est plus complet sur la mesure : plus de moteurs, de connecteurs et de vues d’analyse. Repéré est plus simple, en français, moins cher à l’entrée, et réalise le travail dans l’offre Accompagné.',
      },
      {
        q: 'L’interface de Qwairy est-elle en français ?',
        a: 'Selon le test publié par Codeur en juin 2026, l’interface est entièrement en anglais. Le test a été réalisé à la demande de Qwairy ; à vérifier sur le produit actuel.',
      },
    ],
    description:
      'Repéré ou Qwairy : prix datés (non vérifiés), moteurs, connecteurs, langue de l’interface, exécution. Comparatif factuel entre deux outils français.',
  },
  {
    slug: 'agence-geo',
    name: 'Agence GEO',
    origin: 'France',
    what: 'Une agence GEO vend un audit, une stratégie et une exécution sur mesure, facturés à la prestation ou au forfait mensuel.',
    answer:
      'Choisissez une agence si vous voulez déléguer entièrement, avec un conseil sur mesure et un budget de plusieurs centaines d’euros par mois ; choisissez Repéré si vous voulez un périmètre précis à un prix de logiciel, ou mesurer d’abord par vous-même.',
    intro:
      'Les agences GEO facturent un budget médian de 5 000 € par prestation selon La Fabrique du Net (345 budgets). Un audit coûte de 1 500 à 3 000 €, les forfaits mensuels démarrent vers 800 €.',
    strengths: [
      'Un accompagnement sur mesure, humain, qui peut inclure la refonte de pages, du SEO lourd et des relations presse, ce que Repéré ne fait pas.',
      'Une stratégie multi-canal et multi-pays selon l’agence.',
      'Un interlocuteur unique pour les projets complexes (site, contenu, marque).',
    ],
    priceStatus:
      'Fourchettes issues d’un annuaire rémunéré par les agences et de l’estimation d’une agence : ordres de grandeur, non des tarifs officiels.',
    chooseThem: [
      'Vous voulez déléguer entièrement et avez le budget.',
      'Votre besoin dépasse le GEO : refonte de site, relations presse, SEO complet.',
      'Vous êtes une grande marque ou une entreprise multi-pays.',
      'Vous préférez un interlocuteur humain dédié à un outil.',
    ],
    chooseUs: [
      'Vous voulez un prix mensuel de logiciel, public, sans devis.',
      'Vous voulez mesurer vous-même, d’abord gratuitement, avant de payer une prestation.',
      'Vous voulez un périmètre précis (fiches, pages, sources) avec validation avant chaque publication.',
      'Vous voulez une méthode publiée et une marge d’erreur affichée.',
    ],
    ourLimits: [
      'Repéré ne refait pas de site, ne mène pas de campagne de relations presse et ne vend pas de conseil stratégique sur mesure.',
      'Le périmètre mensuel de l’offre Accompagné est fixe, par construction.',
    ],
    faq: [
      {
        q: 'Combien coûte une agence GEO en 2026 ?',
        a: 'Le budget médian est de 5 000 € par prestation selon La Fabrique du Net (345 budgets, calcul du 9 novembre 2026). Un audit coûte de 1 500 à 3 000 € et un forfait mensuel démarre vers 800 €. Ces chiffres viennent d’un annuaire rémunéré par les agences.',
      },
      {
        q: 'Peut-on faire du GEO sans agence ?',
        a: 'Oui, en grande partie : vérifier le robots.txt, compléter ses fiches, demander des avis et rédiger des pages claires ne demande pas de compétence technique. Nos guides sont gratuits ; la mesure demande de la méthode.',
      },
    ],
    description:
      'Repéré ou une agence GEO : budgets publics sourcés, périmètre, exécution. Un comparatif honnête, avec les cas où une agence est le bon choix.',
  },
  {
    slug: 'semrush',
    family: 'seo',
    checked: COMPARE_CHECKED_SEO,
    name: 'Semrush',
    origin: 'Boston, États-Unis (société cotée)',
    what: 'Semrush est une suite de marketing en ligne très complète (SEO, publicité, contenu, réseaux), qui ajoute depuis 2025 une boîte à outils de visibilité dans les IA.',
    answer:
      'Choisissez Semrush si une personne de votre équipe fait du SEO à plein temps et veut la recherche de mots-clés, l’analyse des concurrents et la publicité dans un seul outil ; choisissez Repéré si vous voulez un audit expliqué en français, la mesure de quatre IA avec marge d’erreur et des corrections appliquées sur votre site.',
    intro:
      'Semrush vend ses offres SEO de 139,95 à 499,95 dollars par mois (relevé tiers d’avril 2026), une boîte à outils « AI Visibility » à 99 dollars par mois et par domaine en paiement annuel, et des offres combinées Semrush One de 199 à 549 dollars par mois.',
    strengths: [
      'Une base de mots-clés, de concurrents et de liens que Repéré n’a pas : recherche de mots-clés, analyse de domaines concurrents, publicité [@docketSemrush].',
      'Un audit technique qui explore jusqu’à 100 000 pages par audit dès l’offre Pro, 1 000 000 en Business, contre 2 000 pages au plus chez Repéré [@docketSemrush].',
      'Un suivi quotidien de prompts dans ChatGPT et l’AI Mode de Google, que Repéré ne mesure pas pour l’AI Mode [@semrushAiKb].',
      'Une gamme d’outils annexes (contenu, réseaux sociaux, génération de prospects) en options [@semrushAi].',
    ],
    priceStatus: 'Prix de l’AI Visibility Toolkit lus sur la page officielle le 13 novembre 2026 ; prix des offres SEO et de Semrush One relevés auprès de sources tierces (la page officielle n’a pas pu être lue depuis notre environnement).',
    chooseThem: [
      'Vous avez un spécialiste SEO ou une agence qui exploite l’outil chaque jour.',
      'Vous avez besoin de recherche de mots-clés à grande échelle et d’analyse des concurrents.',
      'Votre site dépasse quelques milliers de pages.',
      'Vous faites aussi de la publicité sur Google et voulez tout au même endroit.',
    ],
    chooseUs: [
      'Vous êtes dirigeant ou petite équipe : vous voulez 5 priorités expliquées, pas 300 alertes.',
      'Vous voulez suivre ChatGPT, Perplexity, Gemini et Claude, avec une marge d’erreur affichée.',
      'Vous voulez que les corrections soient appliquées sur votre site après votre validation.',
      'Vous voulez commencer gratuitement, puis payer de 29 à 99 € par mois.',
    ],
    ourLimits: [
      'Repéré n’a pas d’index de mots-clés ni de liens propre : les positions et liens viennent d’un fournisseur de données, dans des limites par offre.',
      'Repéré explore au plus 2 000 pages par analyse.',
      'Repéré ne mesure pas l’AI Mode ni les aperçus IA de Google ; la Search Console en compte les clics.',
    ],
    faq: [
      { q: 'Repéré remplace-t-il Semrush ?', a: 'Pour un spécialiste SEO, non : Semrush est plus complet sur les mots-clés, les concurrents et la publicité. Pour un dirigeant qui veut un site sain, des priorités claires, la mesure des IA et des corrections faites, Repéré couvre l’essentiel pour moins cher.' },
      { q: 'Semrush mesure-t-il la visibilité dans les IA ?', a: 'Oui, avec l’AI Visibility Toolkit (99 $/mois par domaine en annuel) ou les offres Semrush One. Selon son aide, le suivi de prompts couvre ChatGPT et l’AI Mode de Google.' },
    ],
    description:
      'Repéré ou Semrush : prix datés, audit SEO, suivi des IA, corrections. Un comparatif factuel, y compris là où Semrush est bien plus complet.',
  },
  {
    slug: 'ahrefs',
    family: 'seo',
    checked: COMPARE_CHECKED_SEO,
    name: 'Ahrefs',
    origin: 'Singapour',
    what: 'Ahrefs est une suite SEO réputée pour son index de liens et de mots-clés, avec un audit de site et, en option, Brand Radar pour la visibilité dans les IA.',
    answer:
      'Choisissez Ahrefs si vous avez besoin d’analyser des liens, des mots-clés et des concurrents à grande échelle ; choisissez Repéré si vous voulez un audit SEO et GEO expliqué en français, la mesure des IA avec marge d’erreur et des corrections appliquées sur votre site.',
    intro:
      'Ahrefs affiche trois offres publiques (129, 249 et 449 dollars par mois) et une offre Enterprise sur devis. Brand Radar AI démarre à 199 dollars par mois, avec des packs de prompts de 50 à 250 dollars. Un compte gratuit donne accès à l’audit d’un site vérifié.',
    strengths: [
      'Un index de liens et de mots-clés de référence, que Repéré n’a pas [@ahrefsPricing].',
      'Un audit permanent avec 100 000 à 1 500 000 crédits d’exploration par mois [@ahrefsPricing].',
      'Un compte gratuit avec Site Audit pour un site dont vous prouvez la propriété [@ahrefsFree].',
      'Le suivi de 750 à 5 000 mots-clés selon l’offre [@ahrefsPricing].',
    ],
    priceStatus: 'Prix lus sur la page officielle de l’éditeur le 13 novembre 2026, en dollars hors taxes ; Brand Radar recoupé avec PricingSaaS.',
    chooseThem: [
      'Vous faites du netlinking ou de l’analyse de liens.',
      'Vous suivez des milliers de mots-clés ou de nombreux concurrents.',
      'Vous avez un spécialiste SEO qui exploite l’outil chaque semaine.',
    ],
    chooseUs: [
      'Vous voulez savoir quoi corriger en premier, expliqué en français, et le faire appliquer.',
      'Vous voulez mesurer ChatGPT, Perplexity, Gemini et Claude sur vos questions clients.',
      'Vous voulez un prix d’entrée de 0 €, puis de 29 à 99 € par mois.',
    ],
    ourLimits: [
      'Pas d’index de liens propre : les liens entrants viennent d’un fournisseur, seulement dans certaines offres.',
      'Moins de mots-clés suivis : 20 à 300 selon l’offre.',
    ],
    faq: [
      { q: 'Le compte gratuit d’Ahrefs suffit-il ?', a: 'Pour auditer un site vérifié, il est utile : 5 000 crédits d’exploration par mois et par projet. Il ne mesure pas les réponses des IA et ne corrige rien.' },
      { q: 'Ahrefs ou Repéré pour une PME ?', a: 'Si vous n’avez personne pour exploiter un outil d’expert, Repéré ; si votre équipe fait du SEO avancé, Ahrefs, éventuellement avec Repéré pour les IA et les corrections.' },
    ],
    description:
      'Repéré ou Ahrefs : prix datés, audit, liens, mots-clés, visibilité IA. Un comparatif factuel, y compris là où Ahrefs est bien plus complet.',
  },
  {
    slug: 'screaming-frog',
    family: 'seo',
    checked: COMPARE_CHECKED_SEO,
    name: 'Screaming Frog',
    origin: 'Henley-on-Thames, Royaume-Uni',
    what: 'Screaming Frog SEO Spider est un logiciel de bureau qui explore un site comme un moteur de recherche et liste ses problèmes techniques.',
    answer:
      'Choisissez Screaming Frog si vous êtes à l’aise avec un outil technique installé sur votre ordinateur et voulez explorer de très grands sites ; choisissez Repéré si vous voulez un service en ligne qui explique, priorise, suit dans le temps, mesure les IA et applique les corrections.',
    intro:
      'Le SEO Spider coûte 245 € par an et par licence (209 € dès 20 licences). La version gratuite explore 500 URL. Il intègre des services d’IA (OpenAI, Gemini, Anthropic, Ollama) et un serveur MCP pour analyser les pages explorées.',
    strengths: [
      'Une exploration sans limite de pages en version payante, selon la mémoire de votre ordinateur [@sfPricing].',
      'Une liste de contrôles techniques très détaillée, référence des spécialistes [@sfIssues].',
      'Un prix annuel bas pour un usage expert : 245 € par an [@sfPricing].',
      'Une version gratuite jusqu’à 500 URL [@sfPricing].',
    ],
    priceStatus: 'Prix lus sur la page officielle de l’éditeur le 13 novembre 2026, en euros.',
    chooseThem: [
      'Vous êtes consultant ou spécialiste SEO technique.',
      'Vous devez explorer des dizaines de milliers de pages.',
      'Vous préférez un logiciel installé à un service en ligne.',
    ],
    chooseUs: [
      'Vous ne voulez pas installer ni paramétrer un logiciel technique.',
      'Vous voulez un suivi dans le temps, la Search Console et les réponses des IA au même endroit.',
      'Vous voulez des corrections appliquées, pas une liste à exporter.',
    ],
    ourLimits: [
      'Repéré explore au plus 2 000 pages par analyse et ne propose pas d’extraction personnalisée.',
      'Repéré est moins détaillé sur certains contrôles très techniques destinés aux spécialistes.',
    ],
    faq: [
      { q: 'Screaming Frog mesure-t-il la visibilité dans les IA ?', a: 'Non : ses intégrations d’IA servent à analyser les pages explorées. Il ne pose pas de questions aux assistants et ne mesure pas leurs réponses.' },
      { q: 'Puis-je utiliser les deux ?', a: 'Oui. Un consultant utilise souvent Screaming Frog pour un audit ponctuel en profondeur, et un outil de suivi pour les données dans le temps.' },
    ],
    description:
      'Repéré ou Screaming Frog : prix datés, exploration, suivi, IA, corrections. Un comparatif factuel entre un service en ligne et un logiciel d’expert.',
  },
];

export const getCompetitor = (slug: string) => COMPETITORS.find((c) => c.slug === slug);
export const competitorPath = (c: Competitor | string) => `/comparatif/${typeof c === 'string' ? c : c.slug}`;

/* ------------------------------------------------------------------ */
/* Autres outils français : relevé court                                */
/* ------------------------------------------------------------------ */

export const OTHER_FR: { name: string; price: string; engines: string; free: string }[] = [
  {
    name: 'BotRank.ai',
    price: 'Starter 89 € HT/mois (25 prompts par jour) ; Business 289 €. La même page cite aussi d’autres prix : relevé contradictoire, non vérifié. [@lfdn]',
    engines: '3 au choix parmi 9, dont Mistral et Claude [@lfdn]',
    free: 'Essai de 7 jours',
  },
  {
    name: 'GetMint',
    price: 'Starter 89 € en mensuel (50 prompts) jusqu’au printemps 2026 ; depuis octobre 2026, sur devis avec engagement de 12 mois selon Digitiz. [@lfdn][@digitiz]',
    engines: 'ChatGPT, Perplexity, Claude, Gemini, AI Overviews [@lfdn]',
    free: 'Pas d’essai depuis octobre 2026 [@digitiz]',
  },
  {
    name: 'Hikoo',
    price: 'Monitoring 69 € HT par site ; Growth 179 € ; Agent 499 €. [@lfdn]',
    engines: '2 à 9 selon l’offre ; Mistral dans l’offre Agent [@lfdn]',
    free: 'Offre gratuite permanente (10 questions, ChatGPT) [@lfdn]',
  },
  {
    name: 'Minddex',
    price: 'Audit gratuit, puis Launch 79 € HT. [@digitiz]',
    engines: 'Non vérifié',
    free: 'Audit gratuit',
  },
];
