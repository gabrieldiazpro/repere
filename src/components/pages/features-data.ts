/**
 * Pages /fonctionnalites : données (aucune dépendance React). Un pilier ou un module = une page.
 * Règles : rien que ce qui existe dans le produit ou dans le contrat V3 ; limites écrites en clair ; aucun chiffre promis.
 */
import { frequencySummary, v5OfferFacts } from "@/components/site/offer-facts";
import { GEO_SECTIONS, PUBLISH_PLATFORMS, SEO_CHECK_COUNT, SEO_SECTION_COUNT } from "@/components/site/v5-blocks";
import { PUBLIC_ANALYSIS_MAX_PAGES } from "@/lib/entitlements";

const ESS_LOCAL = v5OfferFacts("local", "essentiel");
const ESS_PME = v5OfferFacts("pme", "essentiel");
const ACC = v5OfferFacts("pme", "accompagne");

export type PillarId = "mesurer" | "comprendre" | "agir" | "prouver";
export type VisualId =
  | "mesurer"
  | "comprendre"
  | "agir"
  | "prouver"
  | "questions"
  | "copilote"
  | "audit-page"
  | "local"
  | "ecommerce"
  | "rapports"
  | "verite"
  | "sources"
  | "taches"
  | "trafic"
  | "analyse"
  | "seo-audit"
  | "positions"
  | "performance"
  | "geo"
  | "agent"
  | "barometres";

export interface FeatureSection {
  /** Ancre stable (liée depuis l'accueil et le hub). */
  id: string;
  title: string;
  text: string;
  points: string[];
  visual?: VisualId;
}

export interface Feature {
  slug: string;
  kind: "pilier" | "module" | "socle";
  /** Nom court (menus, cartes). */
  name: string;
  /** Résumé d'une ligne (cartes du hub, menus). */
  summary: string;
  /** H1. */
  title: string;
  /** Title SEO (≤ 60 caractères), si le H1 est plus long. */
  seoTitle?: string;
  /** Meta description (≤ 160 caractères). */
  description: string;
  lead: string;
  problem: { title: string; text: string };
  visual: VisualId;
  visualCaption: string;
  /** Étapes réelles, dans l'ordre. */
  how: { title: string; text: string }[];
  sections?: FeatureSection[];
  limits: string[];
  related: string[];
  /** Offres où la fonction est incluse (texte libre, honnête). */
  plans: string;
}

export const PILLAR_ORDER: readonly PillarId[] = ["mesurer", "comprendre", "agir", "prouver"];


/* ------------------------------------------------------------------ */
/* V5 : le socle SEO + GEO (SITE-POSITIONNEMENT)                        */
/* ------------------------------------------------------------------ */

const SOCLE: Feature[] = [
  {
    slug: "analyse-60-secondes",
    kind: "socle",
    name: "Analyse en 60 secondes",
    summary: `Votre vrai site exploré en direct : ${SEO_CHECK_COUNT} contrôles SEO, l'audit GEO, un verdict et 5 priorités. Gratuit.`,
    title: "L'analyse en 60 secondes : votre site, lu comme Google et les IA le lisent",
    seoTitle: "Comment se déroule l'exploration de votre site",
    description: `Votre site exploré pour de vrai (${PUBLIC_ANALYSIS_MAX_PAGES} pages), ${SEO_CHECK_COUNT} contrôles SEO, l'audit GEO, deux scores et vos 5 priorités. Gratuit, sans compte.`,
    lead: "Un seul champ, l'adresse de votre site. Notre robot l'explore pour de vrai, vous montre ce qu'il trouve au fil de l'eau et termine par les cinq corrections qui comptent le plus.",
    problem: {
      title: "Un audit en ligne qui ne lit que votre page d'accueil ne vous apprend rien",
      text: "Les problèmes qui coûtent cher se cachent dans les pages de service, les fiches produit, les doublons et les redirections. Il faut explorer le site, pas une page.",
    },
    visual: "analyse",
    visualCaption: "Les étapes affichées pendant l'analyse.",
    how: [
      { title: "L'adresse", text: "La marque, la ville et le type de site sont détectés sur vos pages ; vous pouvez les corriger." },
      { title: "L'exploration", text: `RepereBot lit robots.txt et sitemaps, puis jusqu'à ${PUBLIC_ANALYSIS_MAX_PAGES} pages, quatre à la fois au plus, en respectant vos interdictions.` },
      { title: "Les contrôles", text: `${SEO_CHECK_COUNT} contrôles SEO en ${SEO_SECTION_COUNT} familles, l'audit GEO en ${GEO_SECTIONS.length} familles, la vitesse via PageSpeed si elle est disponible, et quelques questions posées aux IA.` },
      { title: "Le verdict", text: "Une phrase, un score Google, un score IA, et 5 priorités classées par effet attendu et par effort." },
    ],
    limits: [
      `L'analyse gratuite s'arrête à ${PUBLIC_ANALYSIS_MAX_PAGES} pages ou 45 secondes : sur un grand site, c'est un échantillon équilibré par rubrique, signalé comme tel.`,
      "Les pages derrière une connexion et celles que votre robots.txt nous interdit ne sont pas lues.",
      "Les scores mesurent l'état de votre site, pas une position dans Google ni une citation garantie.",
    ],
    related: ["audit-seo", "geo-avance", "agent-de-publication"],
    plans: `Gratuit pour tous. En offre payante : jusqu'à ${ESS_PME.pages.toLocaleString("fr-FR")} pages en Essentiel, ${ACC.pages.toLocaleString("fr-FR")} en Accompagné, ${ACC.reanalysis.replace("réanalysé", "réanalyse")} en Accompagné.`,
  },
  {
    slug: "audit-seo",
    kind: "socle",
    name: `Audit SEO, ${SEO_CHECK_COUNT} contrôles`,
    summary: `${SEO_CHECK_COUNT} contrôles en ${SEO_SECTION_COUNT} familles, chacun relié à une règle de Google, adaptés à votre type de site.`,
    title: `L'audit SEO : ${SEO_CHECK_COUNT} contrôles, et seulement ce qui compte pour vous`,
    seoTitle: `Audit SEO : ${SEO_CHECK_COUNT} contrôles expliqués en français`,
    description: `Indexation, titres, doublons, maillage, liens cassés, images, données structurées, mobile, e-commerce, local : ${SEO_CHECK_COUNT} contrôles sourcés, expliqués en français.`,
    lead: "Indexation, titres, doublons, liens cassés, données structurées, facettes, pages locales : chaque contrôle dit ce qu'il a trouvé, pourquoi ça compte et quoi faire, sans jargon.",
    problem: {
      title: "Les outils listent des centaines d'alertes, sans dire lesquelles comptent",
      text: "Une alerte « faible » sur 3 pages et un robots.txt qui bloque Google n'ont pas le même poids. Sans tri, on corrige le facile et on oublie le grave.",
    },
    visual: "seo-audit",
    visualCaption: "Les familles de contrôles et leur nombre, lus dans le code de l'audit.",
    how: [
      { title: "Des règles sourcées", text: "Chaque contrôle renvoie à la documentation de Google ou de web.dev, à jour de 2026 (INP, fin des FAQ enrichies, types de balisage retirés)." },
      { title: "Adapté à votre site", text: "Un commerce local, une PME et une boutique n'ont pas les mêmes priorités : la sévérité change selon le type de site." },
      { title: "Une note sans fausse précision", text: "Chaque famille est notée selon la part de pages touchées, arrondie à 5 points ; un blocage critique plafonne la note." },
      { title: "Le correctif", text: "Titre, description, texte alternatif, balisage, redirection, sitemap, robots.txt : beaucoup de correctifs sont prêts pour l'agent." },
    ],
    sections: [
      { id: "francais", title: "Les obligations françaises en plus", text: "Mentions légales, CGV pour la vente en ligne, information RGPD, adresses et téléphones au format français : vérifiés comme le reste.", points: ["Mentions légales (LCEN)", "CGV si vous vendez en ligne", "Politique de confidentialité"] },
      { id: "e-commerce", title: "Les contrôles des boutiques", text: "Facettes indexables, variantes sans canonique, fiches sans prix balisé, pagination : les pièges propres au e-commerce.", points: ["Facettes et paramètres d'URL", "Product, Offer, disponibilité", "Pagination et variantes"] },
    ],
    limits: [
      "Les liens externes et images cassés ne sont vérifiés que si l'exploration a contrôlé les liens.",
      "Sans données PageSpeed, la performance se limite aux signaux de l'exploration : aucune note Core Web Vitals n'est inventée.",
      "La cannibalisation est estimée sur les titres ; elle se confirme avec les requêtes Search Console.",
    ],
    related: ["analyse-60-secondes", "positions-et-search-console", "performance"],
    plans: "Toutes les offres ; le nombre de pages explorées dépend de l'offre.",
  },
  {
    slug: "positions-et-search-console",
    kind: "socle",
    name: "Positions et Search Console",
    summary: "Vos clics, impressions et requêtes Google sur 16 mois, et les positions de vos mots-clés suivies chaque semaine.",
    title: "Positions et Search Console : ce que Google vous apporte vraiment",
    seoTitle: "Positions Google et Search Console, lues pour vous",
    description: "Search Console connectée en un clic (16 mois de requêtes), état d'indexation de vos pages, et positions Google de vos mots-clés suivies chaque semaine.",
    lead: "La Search Console dit ce que Google montre de vous et ce qui est cliqué. Nous la lisons pour vous, et nous suivons chaque semaine la position de vos mots-clés importants.",
    problem: {
      title: "La Search Console est gratuite, mais personne ne la lit",
      text: "Elle contient les requêtes qui vous amènent des clients, les pages qui décrochent et les erreurs d'indexation. Encore faut-il l'ouvrir et savoir quoi en tirer.",
    },
    visual: "positions",
    visualCaption: "Clics hebdomadaires et positions de trois requêtes, compte démo Plomberie Martin.",
    how: [
      { title: "Connexion", text: "Vous autorisez la lecture seule de votre Search Console ; nous importons 16 mois de données, puis une synchronisation quotidienne." },
      { title: "Requêtes et pages", text: "Les requêtes qui montent ou descendent, les pages qui perdent des clics, celles qui sont vues sans être cliquées." },
      { title: "Indexation", text: "L'état d'indexation de vos pages importantes, vérifié chaque jour dans les limites fixées par Google." },
      { title: "Positions suivies", text: "Vos mots-clés relevés chaque semaine sur Google France, avec la présence d'un aperçu IA dans la page de résultats." },
    ],
    limits: [
      "Les positions et les volumes de recherche viennent d'un fournisseur de données payant (DataForSEO) : tant qu'il n'est pas activé, nous l'affichons comme « non configuré » plutôt que d'inventer des chiffres.",
      "Une position est relevée à un instant donné, dans un lieu donné : la vôtre peut différer.",
      "Les données Bing nécessitent une clé que vous créez dans Bing Webmaster Tools.",
    ],
    related: ["audit-seo", "performance", "prouver"],
    plans: `Search Console dans toutes les offres. Mots-clés suivis : ${ESS_LOCAL.keywords} en Essentiel commerce local, ${ESS_PME.keywords} en Essentiel PME et e-commerce, ${ACC.keywords} en Accompagné.`,
  },
  {
    slug: "performance",
    kind: "socle",
    name: "Performance et Core Web Vitals",
    summary: "La vitesse réelle de vos pages pour vos visiteurs, avec les seuils de Google et la cause probable.",
    title: "Performance : vos pages sont-elles rapides pour vos vrais visiteurs ?",
    seoTitle: "Performance et Core Web Vitals de votre site",
    description: "LCP, INP et CLS mesurés par PageSpeed Insights et les données terrain de Chrome (CrUX), expliqués sans jargon, avec la cause probable et la correction.",
    lead: "Google mesure la vitesse sur les téléphones de vos vrais visiteurs. Nous récupérons ces mesures, les comparons aux seuils officiels et vous disons d'où vient la lenteur.",
    problem: {
      title: "Un site lent sur mobile perd des visiteurs avant même qu'ils lisent",
      text: "Une image principale trop lourde, un bandeau qui décale la page, un script qui bloque les clics : ces défauts se voient dans les données de Chrome, pas sur votre ordinateur.",
    },
    visual: "performance",
    visualCaption: "Les trois Signaux Web essentiels et leurs seuils officiels.",
    how: [
      { title: "Mesures terrain", text: "Les données Chrome (CrUX) sur 28 jours, au 75e centile, par page ou pour tout le site quand le trafic est suffisant." },
      { title: "Mesures labo", text: "PageSpeed Insights sur mobile et ordinateur, pour trouver la cause : image, police, script, serveur." },
      { title: "Signaux de l'exploration", text: "Poids des pages, images sans dimensions, scripts bloquants, compression : visibles même sans données Chrome." },
      { title: "Corrections", text: "La correction la plus rentable d'abord, expliquée pour vous ou pour votre prestataire." },
    ],
    limits: [
      "Les données terrain n'existent que pour les sites qui ont assez de visites Chrome ; sinon nous le disons.",
      "La vitesse est un critère parmi d'autres : une page rapide mais vide ne sera pas mieux classée.",
    ],
    related: ["audit-seo", "positions-et-search-console", "analyse-60-secondes"],
    plans: "Toutes les offres.",
  },
  {
    slug: "geo-avance",
    kind: "socle",
    name: "GEO avancé",
    summary: `L'audit GEO en ${GEO_SECTIONS.length} familles, chaque règle avec son niveau de preuve, et des réécritures de passages sans invention.`,
    title: "Le GEO avancé : ce qui fait qu'une IA vous lit, vous comprend et vous cite",
    seoTitle: "GEO avancé : être lu, compris et cité par les IA",
    description: "Robots d'IA, rendu sans JavaScript, identité, passages citables, sous-questions, fraîcheur, sources hors site : chaque règle GEO avec son niveau de preuve.",
    lead: "Le GEO est un domaine jeune, plein d'affirmations invérifiables. Nous séparons ce que les éditeurs d'IA documentent, ce que les études observent, et ce qui reste une hypothèse.",
    problem: {
      title: "On vous vend des recettes GEO que personne n'a mesurées",
      text: "llms.txt miracle, pages écrites « pour l'IA », mentions artificielles : certaines pratiques n'ont aucun effet démontré, d'autres sont classées comme abus par Bing.",
    },
    visual: "geo",
    visualCaption: "Les familles de l'audit GEO, leur poids et leur niveau de preuve.",
    how: [
      { title: "Accès", text: "OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot, Bingbot : autorisés ou bloqués par robots.txt, par en-tête ou par le pare-feu." },
      { title: "Lecture", text: "Le texte est-il dans le HTML ? Les robots d'OpenAI, d'Anthropic et de Perplexity n'exécutent pas le JavaScript." },
      { title: "Passages", text: "Chaque passage noté sur 100 : réponse directe, autonome, chiffrée, datée, sourcée. Les meilleurs candidats sont réécrits avec garde-fou anti-invention." },
      { title: "Hors site", text: "Les annuaires, comparatifs, forums et médias que les IA citent réellement dans votre secteur, et ceux où vous manquez." },
    ],
    sections: [
      { id: "preuves", title: "Trois niveaux de preuve, affichés", text: "Démontré : l'éditeur de l'IA le documente, ou une expérience publiée l'a mesuré. Probable : corrélation sur de grands volumes. Hypothèse : bonne pratique sans preuve d'effet.", points: ["Robots de recherche autorisés : démontré", "Réponse directe en tête : probable", "llms.txt : informatif, hors note"] },
      { id: "reecritures", title: "Des réécritures qui n'inventent rien", text: "Tout chiffre, date ou prix absent de votre page et de votre fiche de vérité fait rejeter la réécriture ; ce qui manque est marqué « à compléter ».", points: ["Fiche de vérité comme seule source", "« À compléter » bloque la validation", "Jamais de date rajeunie sans changement réel"] },
    ],
    limits: [
      "Un défi anti-robot servi à notre robot est un indice, pas une preuve, que les robots d'IA sont bloqués.",
      "Nous n'analysons pas encore les journaux de votre serveur.",
      "Aucune règle GEO ne garantit une citation : les éditeurs d'IA le disent eux-mêmes.",
    ],
    related: ["analyse-60-secondes", "comprendre", "agent-de-publication"],
    plans: "Audit GEO dans toutes les offres ; réécritures et sources hors site en Essentiel et Accompagné.",
  },
  {
    slug: "agent-de-publication",
    kind: "socle",
    name: "Agent de publication",
    summary: `Les corrections appliquées sur ${PUBLISH_PLATFORMS.join(", ")}, après votre validation, vérifiées et annulables.`,
    title: "L'agent de publication : vos corrections appliquées, avec votre accord",
    seoTitle: "Agent de publication : corrections SEO appliquées",
    description: "Titres, descriptions, balisage, redirections : l'agent prépare, vous validez, il publie sur WordPress, Shopify, Webflow ou PrestaShop et vérifie.",
    lead: "Savoir quoi corriger ne suffit pas : il faut le faire, page par page. L'agent prépare chaque correction, vous la montre avant / après, et l'applique quand vous l'avez validée.",
    problem: {
      title: "Les audits finissent dans un tiroir",
      text: "Une liste de 40 corrections, c'est une demi-journée de copier-coller dans l'administration du site. Elle n'est jamais faite, ou faite à moitié.",
    },
    visual: "agent",
    visualCaption: "Une correction en attente de validation, compte démo Plomberie Martin.",
    how: [
      { title: "Connexion", text: "WordPress par mot de passe d'application, Shopify par l'application Repéré, Webflow par jeton de site, PrestaShop par clé webservice limitée. Accès chiffrés." },
      { title: "Préparation", text: "Les correctifs viennent de l'audit SEO et de l'audit GEO ; l'agent les rédige à partir de votre site, sans inventer de chiffre." },
      { title: "Validation", text: "Avant / après page par page. Ce qui manque est marqué « à compléter » et bloque la validation. Rien ne part sans vous." },
      { title: "Application et suivi", text: "Publication, relecture de la page publique, nouvelle mesure 7 jours plus tard, et retour arrière en un clic." },
    ],
    sections: [
      { id: "plateformes", title: "Ce que l'agent sait modifier", text: "Selon la plateforme : titres et descriptions, textes alternatifs, balisage, redirections, réécriture de passages, fiches produit. Ce qu'une plateforme ne permet pas part en fichier prêt à déposer.", points: ["WordPress (Yoast ou Rank Math)", "Shopify (produits, pages, redirections)", "Webflow, PrestaShop ; export pour les autres"] },
      { id: "journal", title: "Un journal qu'on ne peut pas réécrire", text: "Chaque changement garde sa valeur d'origine exacte, qui l'a validé et quand. Le journal est chaîné : une modification après coup se verrait.", points: ["Valeur « avant » conservée", "Retour arrière par changement", "Effet mesuré sur vos courbes"] },
    ],
    limits: [
      "Wix et Bing Places ne sont pas encore connectés : vous recevez un fichier et les instructions.",
      "Sur WordPress, écrire les métas Yoast demande une petite extension ; sans elle, l'agent passe par l'export.",
      "Les fichiers du thème Shopify (robots.txt, llms.txt) demandent une autorisation spéciale de Shopify ; sinon, export.",
    ],
    related: ["audit-seo", "geo-avance", "agir"],
    plans: `Export pour tous. Application directe : ${ESS_PME.changeSets} séries de corrections par mois en Essentiel, ${ACC.changeSets} en Accompagné.`,
  },
  {
    slug: "barometres",
    kind: "socle",
    name: "Baromètres",
    summary: "Qui les IA recommandent, métier par métier et ville par ville : des mesures réelles, publiées chaque mois.",
    title: "Les baromètres : qui les IA recommandent dans votre métier",
    seoTitle: "Baromètres : qui les IA recommandent, par métier",
    description: "Plombiers à Lyon, logiciels de paie, cosmétiques solides : chaque mois, les entreprises que citent ChatGPT, Perplexity, Gemini et Claude, mesurées pour de vrai.",
    lead: "Chaque mois, nous posons les mêmes questions à quatre IA, plusieurs fois, sans citer aucune entreprise, et nous publions qui revient le plus souvent. Avec la marge d'erreur.",
    problem: {
      title: "Personne ne sait qui les IA recommandent dans son secteur",
      text: "Sans mesure répétée, on se fie à une capture d'écran prise un jour. Or les réponses changent d'un essai à l'autre.",
    },
    visual: "barometres",
    visualCaption: "La méthode d'un baromètre, identique chaque mois.",
    how: [
      { title: "Des questions neutres", text: "12 questions par baromètre, sans aucun nom d'entreprise, figées pour le mois." },
      { title: "Plusieurs IA, plusieurs passages", text: "ChatGPT, Perplexity, Gemini et Claude, trois passages par question : 144 réponses." },
      { title: "Des noms fusionnés avec prudence", text: "« Martin » et « Martin Frères » ne sont jamais confondus ; les professions réglementées sont exclues." },
      { title: "Une publication honnête", text: "Une page n'existe qu'après une vraie mesure. Pas de mesure, pas de page." },
    ],
    limits: [
      "Les premiers baromètres seront publiés après leur première mesure réelle : aucun n'est en ligne à ce jour.",
      "Une entreprise peut demander son retrait ou une rectification.",
    ],
    related: ["mesurer", "geo-avance", "comprendre"],
    plans: "Publics et gratuits.",
  },
];

const BASE_FEATURES: Feature[] = [
  {
    slug: "mesurer",
    kind: "pilier",
    name: "Mesurer",
    summary: "Ce que répondent ChatGPT, Gemini, Perplexity (et Claude selon l'offre) à vos vraies questions clients.",
    title: "Mesurer ce que les IA répondent sur vous",
    description:
      "Vos questions clients posées plusieurs fois à ChatGPT, Gemini, Perplexity (et Claude selon l'offre) : qui est cité, à quel rang, avec la marge d'erreur.",
    lead: "Nous posons vos questions clients aux IA, plusieurs fois, et nous notons qui est cité, à quel rang et sur quel ton. Chaque chiffre dit sur combien de réponses il repose.",
    problem: {
      title: "Une IA ne vous envoie aucune statistique",
      text: "Personne ne vous prévient quand ChatGPT recommande un concurrent à votre place. Et une seule question posée une seule fois ne prouve rien : les réponses varient d'un essai à l'autre.",
    },
    visual: "mesurer",
    visualCaption: "Compte démo Paysia : une question suivie, trois IA, la part de voix sur toutes les questions suivies.",
    how: [
      { title: "Vos questions", text: "Nous partons de votre métier, de votre ville ou de vos produits pour proposer les questions que posent vos clients. Vous les gardez, les retirez ou en ajoutez." },
      { title: "Plusieurs passages", text: `Chaque question est posée plusieurs fois à chaque IA (2 passages au test gratuit, 3 en suivi). Fréquence : ${frequencySummary()}.` },
      { title: "Lecture des réponses", text: "Nous repérons les entreprises citées, leur rang, le ton employé et les sites cités en appui." },
      { title: "Un chiffre avec sa marge", text: "Score, part de voix et rang sont affichés avec le nombre de réponses analysées et un niveau de confiance." },
    ],
    sections: [
      {
        id: "part-de-voix",
        title: "Part de voix face à vos concurrents",
        text: "Sur l'ensemble de vos questions, la part des citations qui vous revient, comparée aux concurrents que les IA citent vraiment.",
        points: ["Par IA et par thème de questions", "Évolution semaine après semaine", "Concurrents détectés automatiquement, modifiables"],
      },
      {
        id: "marge",
        title: "Une marge d'erreur publiée",
        text: "Les IA sont variables. Nous affichons l'intervalle autour de chaque indicateur pour que vous ne preniez pas une variation normale pour un progrès ou une chute.",
        points: ["Nombre de réponses derrière chaque chiffre", "Niveau de confiance faible, moyen ou élevé", "Méthode publique sur /methode"],
      },
    ],
    limits: [
      "Nous ne voyons pas ce que l'IA répond à une personne précise : ses réponses dépendent de l'historique et de la localisation de chacun. Nous mesurons une tendance sur des questions types.",
      "Gemini est interrogé sans recherche web (sans ancrage) : il ne renvoie pas de sources.",
      "Les AI Overviews et le mode IA de Google ne sont pas suivis : il n'existe pas d'accès officiel pour le faire proprement.",
    ],
    related: ["questions-suivies", "comprendre", "copilote"],
    plans: "Découverte (5 questions, 1 mesure par mois), Essentiel et Accompagné.",
  },
  {
    slug: "comprendre",
    kind: "pilier",
    name: "Comprendre",
    summary: "Les sites que lisent les IA, les erreurs qu'elles font sur vous, et pourquoi un concurrent passe devant.",
    title: "Comprendre pourquoi les IA citent vos concurrents",
    description:
      "Les sources que lisent les IA, votre présence sur chacune, les erreurs sur vos coordonnées ou vos prix, et la comparaison avec le concurrent qui passe devant.",
    lead: "Un score ne dit pas quoi faire. Nous montrons les sites que les IA lisent pour répondre, ce qu'elles disent de faux sur vous et ce que vos concurrents ont que vous n'avez pas.",
    problem: {
      title: "Savoir que vous êtes absent ne suffit pas",
      text: "Les IA s'appuient sur des annuaires, des comparatifs, des avis et des articles. Si vous n'y êtes pas, ou si ces pages disent des choses fausses, la réponse vous oublie ou vous dessert.",
    },
    visual: "comprendre",
    visualCaption: "Compte démo Paysia : les sources citées, classées par opportunité, et la comparaison avec le concurrent cité.",
    how: [
      { title: "Collecte des sources", text: "Pour chaque réponse qui cite des pages (ChatGPT avec recherche, Perplexity, Claude), nous relevons les adresses citées." },
      { title: "Classement", text: "Chaque site est rangé par type (annuaire, avis, comparatif, média, forum, site d'entreprise) et par opportunité pour vous." },
      { title: "Votre présence", text: "Nous vérifions si vous figurez sur chaque source, et si un concurrent cité y figure." },
      { title: "Explication", text: "Quand votre score bouge, nous indiquons ce qui a changé : nouvelles sources, concurrent apparu, réponse différente." },
    ],
    sections: [
      {
        id: "sources",
        title: "Les sources des IA",
        text: "Les pages que lisent les IA pour parler de votre métier, adresse par adresse, avec votre présence ou votre absence.",
        points: ["Plus de 400 domaines déjà classés par type", "Citations URL par URL, pas seulement par domaine", "Les sources où un concurrent est présent et vous non"],
        visual: "sources",
      },
      {
        id: "verite",
        title: "La fiche de vérité",
        text: "Vous indiquez une fois vos informations exactes (coordonnées, horaires, prix, services). Nous les comparons aux réponses des IA et nous vous alertons en cas d'écart.",
        points: ["Alerte quand une IA se trompe sur vous", "La source probable de l'erreur", "La correction préparée, ou faite avec Accompagné"],
        visual: "verite",
      },
      {
        id: "pourquoi-eux",
        title: "Pourquoi eux et pas vous",
        text: "La comparaison point par point avec le concurrent qui passe devant : avis, présence sur les sources citées, contenus, données structurées.",
        points: ["Écarts classés par effet probable", "Chaque écart renvoie à une tâche", "Aucune donnée privée du concurrent : uniquement ce qui est public"],
      },
    ],
    limits: [
      "Gemini ne fournit pas ses sources dans le mode que nous utilisons : la cartographie repose sur les autres IA.",
      "Une source citée n'est pas une cause certaine : c'est un indice fort, pas une preuve.",
      "La fiche de vérité ne vaut que si vous la tenez à jour.",
    ],
    related: ["mesurer", "agir", "audit-de-page"],
    plans: "Essentiel et Accompagné. Découverte : sources de vos 5 questions.",
  },
  {
    slug: "agir",
    kind: "pilier",
    name: "Agir",
    summary: "Des tâches prêtes à faire, ou faites pour vous : fiches, pages, balisage, avis, annuaires.",
    title: "Agir : le travail prêt à faire, ou fait pour vous",
    description:
      "Des tâches avec le texte à copier : fiches, pages FAQ hébergées, balisage schema.org, plugin WordPress, avis. Rien n'est publié sans votre accord.",
    lead: "Chaque écart trouvé devient une tâche concrète, avec le texte, le balisage ou la page déjà préparés. Avec Essentiel, vous la faites en quelques minutes. Avec Accompagné, nous la faisons et vous validez.",
    problem: {
      title: "Un tableau de bord ne corrige rien",
      text: "La plupart des outils s'arrêtent au constat. Il reste à écrire la page, corriger la fiche, contacter l'annuaire. C'est là que le temps manque.",
    },
    visual: "agir",
    visualCaption: "Compte démo Paysia : une tâche préparée, copiée puis marquée comme faite.",
    how: [
      { title: "Tâches classées", text: "Les écarts sont transformés en 12 à 15 tâches, classées par effet probable et par effort." },
      { title: "Livrable joint", text: "Chaque tâche arrive avec son livrable : texte de fiche, réponse à un avis, balisage JSON-LD, page FAQ, demande d'avis." },
      { title: "Votre validation", text: "Rien n'est publié sans votre accord. Vous validez depuis votre téléphone si vous voulez." },
      { title: "Mesure après coup", text: "Une fois la tâche faite, les questions liées sont reposées à J+14 et J+30 pour voir si quelque chose a bougé." },
    ],
    sections: [
      {
        id: "taches",
        title: "Des tâches prêtes à faire",
        text: "Chaque lundi, les trois actions de la semaine, avec le texte à copier et le temps estimé.",
        points: ["Textes prêts à coller", "Durée estimée et effet attendu expliqué", "Suivi fait / à faire, partagé avec l'équipe"],
        visual: "taches",
      },
      {
        id: "pages-hebergees",
        title: "Des pages FAQ hébergées",
        text: "Pour les entreprises sans site facile à modifier : une page de questions-réponses claire et balisée, hébergée chez nous à votre nom, que vous validez avant mise en ligne.",
        points: ["Balisage FAQPage et LocalBusiness ou Organization inclus", "Lien à mettre sur votre site ou vos fiches", "Retrait à tout moment"],
      },
      {
        id: "plugin",
        title: "Le plugin WordPress",
        text: "Une extension à installer une fois : elle sert le balisage préparé par Repéré et le tient à jour, sans copier-coller.",
        points: ["Balisage schema.org servi automatiquement", "Désactivable en un clic", "En option, signale les passages des robots des IA ; rien sur vos visiteurs"],
      },
    ],
    limits: [
      "Nous ne publions jamais sans votre validation : si vous ne validez pas, rien ne bouge.",
      "Certaines actions dépendent de tiers (annuaires, comparatifs, médias) : nous faisons la démarche, la décision leur appartient.",
      "Faire une tâche augmente les chances d'être cité ; ça ne garantit pas un rang.",
    ],
    related: ["comprendre", "prouver", "local"],
    plans: "Essentiel (tâches prêtes à faire) et Accompagné (faites pour vous). Pas d'exécution en Découverte.",
  },
  {
    slug: "prouver",
    kind: "pilier",
    name: "Prouver",
    summary: "Les visites venues des IA sur votre site, et le chiffre d'affaires quand vos outils le permettent.",
    title: "Prouver : les visites et les ventes venues des IA",
    description:
      "Les visites venues de ChatGPT, Perplexity, Gemini ou Copilot, mesurées sans cookie, le chiffre d'affaires attribué quand c'est possible et le rapport du mois.",
    lead: "Être cité, c'est bien. Savoir si ça amène des visites et des clients, c'est mieux. Nous mesurons les visites venues des IA sur votre site, sans cookie, et nous les mettons en face du travail fait.",
    problem: {
      title: "Le trafic des IA se perd dans vos statistiques",
      text: "Les visites venues de chatgpt.com ou perplexity.ai sont souvent rangées en « référents » ou en « direct ». Sans les isoler, impossible de savoir si le travail paie.",
    },
    visual: "prouver",
    visualCaption: "Compte démo Maison Sora : visites et commandes venues des IA sur 30 jours, la courbe sur 12 semaines, puis le rapport du mois.",
    how: [
      { title: "Un petit script", text: "Une ligne à coller sur votre site, sans cookie et sans donnée personnelle, ou la connexion à Google Analytics 4." },
      { title: "Tri des visites", text: "Chaque visite venue d'une IA est reconnue (ChatGPT, Perplexity, Gemini, Copilot, Claude) avec sa page d'arrivée." },
      { title: "Valeur", text: "Si vous transmettez la valeur d'une commande ou d'un contact, nous l'additionnons par IA." },
      { title: "Rapport", text: "Chaque mois, citations, part de voix, visites et travail fait sur une seule page, à partager." },
    ],
    sections: [
      {
        id: "trafic",
        title: "Trafic IA, sans cookie",
        text: "Les visites venues des assistants IA, par IA et par page, ainsi que les passages des robots des IA sur votre site.",
        points: ["Script léger, sans cookie ni bandeau", "Robots des IA détectés (GPTBot, PerplexityBot…)", "Ou lecture de Google Analytics 4 si vous le connectez"],
        visual: "trafic",
      },
      {
        id: "chiffre-affaires",
        title: "Chiffre d'affaires attribué",
        text: "Pour l'e-commerce et les formulaires de contact : la valeur des commandes ou des demandes venues d'une IA, quand votre site nous la transmet.",
        points: ["Valeur transmise par le script, sans donnée client", "Connecteur Shopify en préparation", "Toujours étiqueté « attribué », jamais « garanti »"],
      },
    ],
    limits: [
      "Une partie des visites venues des IA arrive sans référent (copier-coller d'une adresse) : elle reste invisible, pour nous comme pour tout le monde.",
      "Le chiffre d'affaires n'apparaît que si votre site transmet la valeur ; sinon nous le disons et nous n'estimons rien.",
      "Une hausse de visites coïncide avec le travail fait ; nous ne prétendons pas qu'elle en est la seule cause.",
    ],
    related: ["rapports-et-partage", "e-commerce", "mesurer"],
    plans: "Essentiel et Accompagné.",
  },
  {
    slug: "questions-suivies",
    kind: "module",
    name: "Questions suivies",
    summary: "Les questions de vos clients, choisies avec vous, rangées par thème et suivies dans le temps.",
    title: "Les questions suivies : vos vraies questions clients",
    description:
      "Choisissez les questions que vos clients posent aux IA : suggestions depuis votre site et votre secteur, thèmes, import CSV, historique par question et par IA.",
    lead: "Tout part des questions. Nous vous en proposons à partir de votre site et de votre secteur ; vous gardez celles qui ressemblent vraiment à vos clients, et vous les suivez dans le temps.",
    problem: {
      title: "Des questions génériques donnent des chiffres sans valeur",
      text: "« Meilleur plombier » ne dit rien d'un artisan du 11e qui fait surtout du dépannage. Si les questions ne ressemblent pas à vos clients, le score non plus.",
    },
    visual: "questions",
    visualCaption: "Compte démo Plomberie Martin : les questions suivies, leur thème et le résultat par IA.",
    how: [
      { title: "Suggestions", text: "Nous lisons votre site et votre secteur pour proposer des questions, sans doublons." },
      { title: "Tri", text: "Vous rangez par thème et par intention (comparer, choisir, se dépanner) et vous ajoutez les vôtres, une par une ou par fichier CSV." },
      { title: "Indice de demande", text: "Chaque question peut porter un indice faible, moyen ou fort, étiqueté « estimation », dérivé de signaux publics. Jamais un faux volume." },
      { title: "Historique", text: "Pour chaque question et chaque IA, les réponses complètes, avec les passages qui vous citent surlignés." },
    ],
    limits: [
      "Les IA ne publient aucun volume de questions : l'indice de demande est une estimation, et nous l'affichons comme telle.",
      "Le nombre de questions suivies dépend de votre offre (5 en Découverte).",
    ],
    related: ["mesurer", "copilote", "rapports-et-partage"],
    plans: "Toutes les offres, en quantité selon l'offre.",
  },
  {
    slug: "copilote",
    kind: "module",
    name: "Copilote",
    summary: "Posez une question sur vos résultats ; la réponse s'appuie uniquement sur les données de votre compte.",
    title: "Le copilote : une question, une réponse tirée de vos données",
    description:
      "Demandez « pourquoi mon score a baissé ? » : le copilote répond avec les données de votre compte, cite ses sources et dit quand il ne sait pas.",
    lead: "Plutôt que de chercher dans les écrans, posez la question. Le copilote lit vos mesures, vos sources, vos tâches et votre fiche de vérité, et vous répond en citant les données utilisées.",
    problem: {
      title: "Un tableau de bord demande du temps pour être lu",
      text: "Un dirigeant n'a pas vingt minutes pour croiser trois écrans. Il veut savoir ce qui a changé et quoi faire.",
    },
    visual: "copilote",
    visualCaption: "Compte démo Paysia : une question posée au copilote et sa réponse sourcée.",
    how: [
      { title: "Vous demandez", text: "En français courant : un concurrent, une IA, une période, une page." },
      { title: "Il cherche dans votre compte", text: "Le copilote reconnaît le concurrent, l'IA et la période visés, puis lit les données correspondantes." },
      { title: "Il répond avec ses sources", text: "Chaque chiffre cité vient de votre compte et renvoie à l'écran concerné." },
      { title: "Il propose la suite", text: "Quand c'est utile, il renvoie vers la tâche qui répond au problème." },
    ],
    limits: [
      "Le copilote est une IA : il peut se tromper. Il ne donne jamais un chiffre absent de vos données et le dit quand il ne sait pas.",
      "Le nombre de questions par jour dépend de votre offre.",
    ],
    related: ["mesurer", "comprendre", "questions-suivies"],
    plans: "Toutes les offres, avec un quota quotidien selon l'offre.",
  },
  {
    slug: "audit-de-page",
    kind: "module",
    name: "Audit de page",
    summary: "Votre site est-il lisible par les IA ? Robots, rendu sans JavaScript, balisage, citabilité d'une page.",
    title: "L'audit de page : votre site est-il lisible par les IA ?",
    description:
      "Robots des IA autorisés ou bloqués, rendu sans JavaScript, JSON-LD, sitemap, llms.txt et score de citabilité d'une page, avec la correction pour chaque point.",
    lead: "Avant d'espérer être cité, il faut être lu. L'audit vérifie que les robots des IA peuvent accéder à vos pages, les comprendre et en extraire une réponse.",
    problem: {
      title: "Un site peut être invisible pour les IA sans que vous le sachiez",
      text: "Un robots.txt trop strict, un contenu chargé uniquement en JavaScript ou un balisage absent suffisent à rendre vos pages illisibles pour les robots des IA.",
    },
    visual: "audit-page",
    visualCaption: "Exemple d'audit d'une page de service : contrôles, statut et correction proposée.",
    how: [
      { title: "Lecture respectueuse", text: "Notre robot, identifié comme RepereBot, lit la page en respectant votre robots.txt, avec des délais et une taille maximale." },
      { title: "Contrôles techniques", text: "Robots des IA autorisés, rendu sans JavaScript, JSON-LD présent et valide, sitemap, llms.txt, temps de réponse." },
      { title: "Citabilité", text: "Une note /100 selon des règles publiées : réponse en tête, structure en questions-réponses, chiffres sourcés, auteur, date." },
      { title: "Corrections", text: "Chaque point en échec vient avec sa correction, et devient une tâche dans votre compte." },
    ],
    limits: [
      "La citabilité est un score par règles, pas une prédiction : une page bien notée n'est pas assurée d'être citée.",
      "Le fichier llms.txt est encore peu utilisé par les IA : nous le proposons sans en exagérer l'effet.",
      "Les pages derrière une connexion ne sont pas analysées.",
    ],
    related: ["comprendre", "agir", "e-commerce"],
    plans: "Outils gratuits pour une page ; audit complet dans Essentiel et Accompagné.",
  },
  {
    slug: "local",
    kind: "module",
    name: "Commerce local",
    summary: "Fiche Google, avis, annuaires et quartiers : ce qui compte quand on demande « près de chez moi ».",
    title: "Commerce local : être recommandé près de chez vous",
    description:
      "Audit de fiche Google /100, cohérence de vos coordonnées sur les annuaires, thèmes de vos avis, visibilité par quartier et calendrier de publications.",
    lead: "Pour un artisan, un restaurant ou un institut, les IA s'appuient beaucoup sur les fiches et les avis. Nous les vérifions, nous les complétons et nous suivons votre visibilité quartier par quartier.",
    problem: {
      title: "Une fiche incomplète, et l'IA recommande le voisin",
      text: "Horaires faux, catégorie approximative, avis sans réponse, numéro différent d'un annuaire à l'autre : autant de raisons pour une IA de citer quelqu'un d'autre.",
    },
    visual: "local",
    visualCaption: "Compte démo Plomberie Martin : fiche, annuaires et visibilité par quartier.",
    how: [
      { title: "Audit de fiche", text: "Une note /100 de votre fiche Google : catégories, horaires, photos, avis, réponses, questions." },
      { title: "Annuaires", text: "La liste des annuaires utiles pour votre métier et la cohérence de vos nom, adresse et téléphone sur chacun." },
      { title: "Avis", text: "Les thèmes qui reviennent dans vos avis, les réponses rédigées, et une campagne de demande d'avis à vos vrais clients." },
      { title: "Quartiers", text: "Vos questions posées en précisant chaque quartier, pour voir où vous êtes cité et où vous ne l'êtes pas." },
    ],
    limits: [
      "La carte par quartier est une simulation : le quartier est indiqué dans la question, nous ne localisons pas l'IA.",
      "Sans clé d'accès à Google Places, l'audit de fiche se fait par saisie guidée.",
      "Nous ne conservons pas le contenu Google au-delà de ce que ses règles permettent.",
    ],
    related: ["agir", "comprendre", "mesurer"],
    plans: "Parcours Commerce local : Essentiel dès 29 €/mois, Accompagné 99 €/mois.",
  },
  {
    slug: "e-commerce",
    kind: "module",
    name: "E-commerce",
    summary: "Produit par produit : qui l'IA conseille, quels revendeurs elle cite, avec quels prix et avis.",
    title: "E-commerce : quand l'IA conseille un produit",
    description:
      "Suivi par produit, marques et revendeurs cités à votre place, prix et avis repris par les IA, fiches produit et guides d'achat préparés, ventes attribuées.",
    lead: "Quand un client demande « quelle crème solaire bio pour le visage ? », l'IA cite des produits, des marques et des boutiques. Nous suivons vos produits un par un et ce qui passe devant eux.",
    problem: {
      title: "Votre produit est cité, mais la vente part chez un revendeur",
      text: "L'IA peut recommander votre produit en renvoyant vers une marketplace, avec un prix ou des avis qui ne sont pas les vôtres. Vous ne le voyez nulle part.",
    },
    visual: "ecommerce",
    visualCaption: "Compte démo Maison Sora : produits suivis, marques et revendeurs cités.",
    how: [
      { title: "Catalogue", text: "Vous choisissez les produits à suivre ; nous préparons les questions d'achat qui leur correspondent." },
      { title: "Marques et revendeurs", text: "Pour chaque réponse : les marques citées, les produits cités et les boutiques vers lesquelles l'IA renvoie." },
      { title: "Prix et avis cités", text: "Le prix et la note repris par l'IA, comparés à votre fiche produit." },
      { title: "Fiches et guides", text: "FAQ produit, balisage Product et guide d'achat préparés, à valider avant publication." },
    ],
    limits: [
      "Le connecteur Shopify est en préparation : en attendant, les ventes viennent du script installé sur votre boutique.",
      "Les prix cités par une IA peuvent dater : nous signalons l'écart, nous ne le corrigeons pas chez le tiers.",
    ],
    related: ["prouver", "audit-de-page", "agir"],
    plans: "Parcours E-commerce : Essentiel dès 79 €/mois, Accompagné 390 €/mois.",
  },
  {
    slug: "rapports-et-partage",
    kind: "module",
    name: "Rapports et partage",
    summary: "Rapport du mois, exports CSV, lien de partage révocable, envoi planifié, Slack et webhook.",
    title: "Rapports et partage : montrer le travail et les résultats",
    description:
      "Rapport mensuel, exports CSV de chaque vue, lien de partage public révocable avec expiration, rapports planifiés par e-mail, alertes Slack et webhook signé.",
    lead: "Vos résultats doivent pouvoir sortir de l'outil : pour un associé, une direction ou un client. Exportez, partagez un lien, ou recevez le rapport sans vous connecter.",
    problem: {
      title: "Des captures d'écran ne font pas un rapport",
      text: "Montrer l'avancement à quelqu'un qui n'a pas de compte oblige souvent à bricoler. Et un lien envoyé une fois ne devrait pas rester ouvert pour toujours.",
    },
    visual: "rapports",
    visualCaption: "Compte démo Paysia : le rapport du mois et ses options de partage.",
    how: [
      { title: "Rapport du mois", text: "Citations, part de voix, visites venues des IA et travail fait, sur une page." },
      { title: "Lien de partage", text: "Un lien public à jeton, avec une date d'expiration, révocable à tout moment." },
      { title: "Envoi planifié", text: "Le rapport par e-mail chaque semaine ou chaque mois, aux personnes choisies." },
      { title: "Vers vos outils", text: "Exports CSV de chaque vue, alertes dans Slack et webhook signé pour vos propres outils." },
    ],
    limits: [
      "La marque blanche (votre logo et vos couleurs sur le rapport) est réservée aux agences, en liste d'attente.",
      "Les exports et liens de partage ne sont pas inclus dans Découverte.",
    ],
    related: ["prouver", "mesurer", "copilote"],
    plans: "Essentiel et Accompagné. Marque blanche : offre Agence (liste d'attente).",
  },
];

export const FEATURES: readonly Feature[] = [...SOCLE, ...BASE_FEATURES];

export const FEATURE_SLUGS = FEATURES.map((f) => f.slug);

export function getFeature(slug: string): Feature | undefined {
  return FEATURES.find((f) => f.slug === slug);
}

export const featurePath = (slug: string) => `/fonctionnalites/${slug}`;

export const PILLARS: readonly Feature[] = FEATURES.filter((f) => f.kind === "pilier");
export const MODULES: readonly Feature[] = FEATURES.filter((f) => f.kind === "module");
export const SOCLE_FEATURES: readonly Feature[] = SOCLE;

/**
 * Ancres du hub /fonctionnalites (liées par la grille bento de l'accueil : mesurer, sources, verite, trafic, copilote,
 * taches). Chaque ancre pointe vers une page détaillée.
 */
export const HUB_ANCHORS: readonly { id: string; label: string; href: string }[] = [
  { id: "mesurer", label: "Mesurer", href: featurePath("mesurer") },
  { id: "sources", label: "Sources des IA", href: `${featurePath("comprendre")}#sources` },
  { id: "verite", label: "Fiche de vérité", href: `${featurePath("comprendre")}#verite` },
  { id: "taches", label: "Tâches prêtes", href: `${featurePath("agir")}#taches` },
  { id: "trafic", label: "Trafic IA", href: `${featurePath("prouver")}#trafic` },
  { id: "copilote", label: "Copilote", href: featurePath("copilote") },
];

export const FEATURES_UPDATED = "2026-11-13";
