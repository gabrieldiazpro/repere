/**
 * Catalogue des outils gratuits et contenu éditorial de leurs pages (sans dépendance client : lisible côté serveur).
 * Docs : docs/v3/11-outils-gratuits.md. Aucun chiffre de trafic ni promesse de citation.
 */
import type { QA } from '@/lib/seo/jsonld';

export type Parcours = 'local' | 'pme' | 'ecommerce';
export type ToolSlug =
  | 'lien-avis-google'
  | 'robots-ia'
  | 'pret-pour-les-ia'
  | 'citabilite'
  | 'json-ld'
  | 'rendu-sans-javascript'
  | 'comparateur'
  | 'llms-txt'
  | 'fiche-produit';

export interface ToolSource {
  label: string;
  url: string;
  note?: string;
}

export interface ToolDef {
  slug: ToolSlug;
  /** Nom court (hub, fil d'Ariane). */
  name: string;
  /** H1 : la promesse. */
  h1: string;
  /** Sous-titre sous le H1. */
  lead: string;
  /** <title> sans le suffixe de marque. */
  metaTitle: string;
  description: string;
  /** Ce que l'on obtient (hub). */
  output: string;
  parcours: Parcours[];
  /** Phrase contextuelle du pont vers l'audit. */
  bridge: string;
  howItWorks: string[];
  reading: string[];
  limits: string[];
  faq: QA[];
  sources: ToolSource[];
  related: { label: string; href: string }[];
}

export const PARCOURS_LABEL: Record<Parcours, string> = {
  local: 'Commerce local',
  pme: 'PME et services',
  ecommerce: 'E-commerce',
};

export const TOOLS_UPDATED = '2026-11-09';

const SRC_VERCEL: ToolSource = {
  label: 'Vercel, « The rise of the AI crawler »',
  url: 'https://vercel.com/blog/the-rise-of-the-ai-crawler',
  note: 'Observation sur le réseau Vercel : les grands robots d’IA récupèrent les fichiers JavaScript sans les exécuter.',
};
const SRC_RFC9309: ToolSource = {
  label: 'IETF, RFC 9309 « Robots Exclusion Protocol »',
  url: 'https://www.rfc-editor.org/rfc/rfc9309',
  note: 'Norme qui fixe la lecture d’un robots.txt (groupes, règle la plus longue, Allow prioritaire à égalité).',
};
const SRC_OPENAI_BOTS: ToolSource = {
  label: 'OpenAI, « Overview of OpenAI Crawlers »',
  url: 'https://platform.openai.com/docs/bots',
  note: 'Documentation officielle de GPTBot, OAI-SearchBot et ChatGPT-User.',
};
const SRC_GOOGLE_CRAWLERS: ToolSource = {
  label: 'Google, liste des robots et jetons (dont Google-Extended)',
  url: 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers',
};
const SRC_SCHEMA: ToolSource = { label: 'Schema.org, vocabulaire de référence', url: 'https://schema.org/' };
const SRC_SCHEMA_VALIDATOR: ToolSource = {
  label: 'Schema Markup Validator (validateur officiel schema.org)',
  url: 'https://validator.schema.org/',
};
const SRC_GOOGLE_SD: ToolSource = {
  label: 'Google Search Central, introduction aux données structurées',
  url: 'https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data',
};
const SRC_LLMS: ToolSource = {
  label: 'llmstxt.org, proposition de format llms.txt',
  url: 'https://llmstxt.org/',
  note: 'Proposition communautaire, pas une norme adoptée par les moteurs.',
};
const SRC_ECORP: ToolSource = {
  label: 'Ecorp IT, « Does llms.txt help SEO? » (2026)',
  url: 'https://ecorpit.com/does-llms-txt-help-seo-google-2026/',
  note: 'Source secondaire : reprend les déclarations de Google sur llms.txt. À recouper avec les sources primaires.',
};
const SRC_INSITES: ToolSource = {
  label: 'Insites, avis Google et recommandations des IA',
  url: 'https://insites.com/blog/do-google-reviews-affect-ai-recommendations-yes-heres-by-how-much/',
  note: 'Étude d’un éditeur sur 10 000 commerces américains. Corrélation, pas causalité.',
};
const SRC_GOOGLE_REVIEWS: ToolSource = {
  label: 'Google, aide Fiche d’établissement : demander des avis',
  url: 'https://support.google.com/business/answer/3474122',
};
const SRC_PLACE_ID: ToolSource = {
  label: 'Google, outil Place ID Finder',
  url: 'https://developers.google.com/maps/documentation/places/web-service/place-id',
};
const SRC_DGCCRF: ToolSource = {
  label: 'Code de la consommation, article L121-4 (pratiques commerciales trompeuses)',
  url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227301',
};

export const TOOLS: ToolDef[] = [
  {
    slug: 'lien-avis-google',
    name: 'Lien d’avis Google et QR code',
    h1: 'Votre lien d’avis Google et son QR code, prêts à imprimer',
    lead: 'Un lien direct vers le formulaire d’avis de votre fiche, un QR code téléchargeable et une affichette A5 pour le comptoir. Gratuit, sans compte.',
    metaTitle: 'Lien avis Google et QR code gratuits, à imprimer',
    description:
      'Générez le lien direct d’avis Google de votre établissement, son QR code en SVG et une affichette A5 à imprimer. Gratuit, sans inscription, avec les règles à respecter.',
    output: 'Lien direct, QR code SVG, affichette A5, modèles de SMS et d’e-mail',
    parcours: ['local'],
    bridge: 'Vos avis pèsent dans ce que les IA disent de vous (corrélation observée, pas garantie). Voyez ce que ChatGPT dit de votre commerce.',
    howItWorks: [
      'Collez le lien de votre fiche Google Maps, votre lien « Demander des avis » ou votre identifiant de lieu (Place ID).',
      'Nous construisons le lien direct vers le formulaire d’avis, au format documenté par Google, sans clé ni compte.',
      'Téléchargez le QR code, imprimez l’affichette A5 et copiez les modèles de message.',
    ],
    reading: [
      'Le lien ouvre directement la fenêtre « Donner un avis » de votre fiche. Testez-le une fois sur votre téléphone avant de l’imprimer.',
      'Le QR code encode exactement ce lien : si votre fiche change d’identifiant (fusion, déménagement), générez-en un nouveau.',
    ],
    limits: [
      'Sans clé Google Places, nous ne pouvons pas retrouver votre fiche à partir de son nom seul : le Place ID Finder de Google le fait en trente secondes.',
      'Un lien Maps raccourci (maps.app.goo.gl) ne contient pas l’identifiant : ouvrez-le, puis copiez l’adresse complète.',
      'Nous ne conservons ni votre lien ni votre QR code : ils sont calculés à la demande, puis oubliés.',
    ],
    faq: [
      { q: 'Comment obtenir le lien direct pour laisser un avis Google ?', a: 'Depuis votre fiche d’établissement, le bouton « Demander des avis » donne un lien court. Vous pouvez aussi le construire à partir de votre Place ID : https://search.google.com/local/writereview?placeid= suivi de l’identifiant. Cet outil le fait pour vous.' },
      { q: 'Où trouver le Place ID de mon commerce ?', a: 'Dans l’outil Place ID Finder de Google : tapez le nom de votre commerce, choisissez-le sur la carte et copiez l’identifiant qui commence souvent par « ChIJ ». Collez-le ici.' },
      { q: 'Ai-je le droit de demander des avis à mes clients ?', a: 'Oui, à condition de demander à tous vos clients, satisfaits ou non, sans contrepartie et sans imposer de contenu. Offrir une remise contre un avis, ou ne solliciter que les clients contents, est contraire aux règles de Google et peut constituer une pratique commerciale trompeuse.' },
      { q: 'Quelle taille pour imprimer le QR code ?', a: 'Au moins 3 cm de côté pour un scan confortable à 30 cm, davantage sur une affiche lue de loin. Le fichier SVG reste net à toutes les tailles. L’affichette A5 prévoit un code d’environ 9 cm.' },
      { q: 'Les avis Google comptent-ils pour ChatGPT ou Perplexity ?', a: 'Une étude d’éditeur sur 10 000 commerces américains observe que les entreprises citées par les assistants ont en moyenne beaucoup plus d’avis. C’est une corrélation, pas une preuve de cause à effet, et rien ne garantit une citation.' },
    ],
    sources: [SRC_GOOGLE_REVIEWS, SRC_PLACE_ID, SRC_INSITES, SRC_DGCCRF],
    related: [
      { label: 'Guide : utiliser les avis clients dans les règles', href: '/guides/avis-clients-ia' },
      { label: 'Glossaire : mention et citation', href: '/glossaire#mention' },
    ],
  },
  {
    slug: 'robots-ia',
    name: 'Robots.txt et robots d’IA',
    h1: 'Les robots d’OpenAI, Anthropic, Perplexity et Google peuvent-ils lire votre site ?',
    lead: 'Nous lisons votre robots.txt comme le font les robots, robot par robot, et vous donnons les lignes à ajouter selon ce que vous voulez autoriser.',
    metaTitle: 'Vérifier son robots.txt pour les robots d’IA',
    description:
      'Vérifiez si GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended et les autres robots d’IA peuvent lire votre site. Tableau par robot et robots.txt recommandé, gratuit.',
    output: 'Tableau par robot (rôle, autorisé ou bloqué, ligne en cause) et lignes à ajouter',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Vous êtes ouvert aux IA ? Reste à savoir ce qu’elles disent de vous quand un client leur pose la question.',
    howItWorks: [
      'Nous récupérons le fichier /robots.txt de votre domaine, comme le ferait un robot.',
      'Nous appliquons les règles de la norme RFC 9309 pour chaque robot d’IA : groupe qui le nomme, sinon le groupe « * » ; la règle la plus précise l’emporte.',
      'Nous indiquons pour chaque robot s’il peut lire votre page d’accueil, la ligne responsable, et proposons un robots.txt adapté à votre choix.',
    ],
    reading: [
      '« Autorisé » : le robot peut lire la page testée. « Bloqué » : une règle Disallow l’en empêche. « Non précisé » : aucun groupe ne le concerne et rien ne l’interdit, il est donc autorisé par défaut.',
      'Les robots d’entraînement (GPTBot, ClaudeBot, CCBot) ne servent pas à vous citer aujourd’hui ; les robots de recherche et de requête (OAI-SearchBot, Claude-SearchBot, PerplexityBot, ChatGPT-User) alimentent les réponses avec sources.',
    ],
    limits: [
      'Un robots.txt est une demande, pas une barrière : un pare-feu ou un CDN peut bloquer un robot que votre fichier autorise, et inversement.',
      'Google-Extended n’est pas un robot mais un jeton : il agit sur Gemini, pas sur les AI Overviews de la recherche Google.',
      'La liste des robots change : elle est datée et revue chaque trimestre.',
    ],
    faq: [
      { q: 'Faut-il bloquer GPTBot ?', a: 'Bloquer GPTBot empêche l’utilisation de vos pages pour entraîner les modèles d’OpenAI, sans vous retirer des réponses de recherche de ChatGPT, qui passent par OAI-SearchBot. Si vous voulez être cité sans servir à l’entraînement, bloquez GPTBot et autorisez OAI-SearchBot.' },
      { q: 'Quelle différence entre robot d’entraînement et robot de recherche ?', a: 'Le premier collecte des textes pour entraîner un modèle. Le second indexe des pages pour les citer dans les réponses avec sources. Un troisième type récupère une page à la demande d’un utilisateur (ChatGPT-User, Perplexity-User, Claude-User).' },
      { q: 'Mon site n’a pas de robots.txt : est-ce un problème ?', a: 'Non : sans fichier, tous les robots sont autorisés. Un fichier explicite reste utile pour indiquer votre sitemap et faire un choix clair sur l’entraînement.' },
      { q: 'Comment autoriser ChatGPT à lire mon site ?', a: 'Vérifiez qu’aucune règle Disallow ne vise OAI-SearchBot ni ChatGPT-User, ni le groupe « * ». Ajoutez au besoin un groupe « User-agent: OAI-SearchBot » suivi de « Allow: / ».' },
      { q: 'Le robots.txt suffit-il à bloquer un robot ?', a: 'Les robots des grands opérateurs déclarent le respecter. D’autres non. Pour un blocage réel, il faut une règle au niveau du serveur ou du pare-feu.' },
    ],
    sources: [SRC_RFC9309, SRC_OPENAI_BOTS, SRC_GOOGLE_CRAWLERS, SRC_VERCEL],
    related: [
      { label: 'Glossaire : robots.txt', href: '/glossaire#robots-txt' },
      { label: 'Glossaire : GPTBot', href: '/glossaire#gptbot' },
      { label: 'Glossaire : OAI-SearchBot', href: '/glossaire#oai-searchbot' },
    ],
  },
  {
    slug: 'pret-pour-les-ia',
    name: 'Site prêt pour les IA ?',
    h1: 'Votre site est-il prêt à être lu par les IA ?',
    lead: 'Une liste de contrôles techniques sur votre page d’accueil, notée sur 100, avec le correctif de chaque point. Ce n’est pas une mesure de ce que disent les IA : c’est la base qui leur permet de vous lire.',
    metaTitle: 'Votre site est-il prêt pour ChatGPT et les IA ?',
    description:
      'Testez gratuitement si votre site est lisible par ChatGPT, Perplexity et Gemini : accès des robots, rendu sans JavaScript, données structurées, sitemap, llms.txt. Score sur 100 et correctifs.',
    output: 'Score sur 100, contrôles dépliables avec leur correctif',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Ce test regarde votre site. L’audit regarde ce que les IA disent de vous, sur les questions de vos clients.',
    howItWorks: [
      'Nous récupérons votre page comme un robot, sans exécuter de JavaScript, avec un robot déclaré qui respecte votre robots.txt.',
      'Nous passons une série de contrôles déterministes : accès des robots d’IA, contenu présent dans le HTML, données structurées, sitemap, llms.txt, temps de réponse.',
      'Chaque contrôle vaut des points ; le score est leur somme. Les points à corriger sont classés en premier, avec le correctif.',
    ],
    reading: [
      '70 et plus : la base technique est solide. Entre 40 et 69 : des points bloquent une partie de la lecture. Sous 40 : un robot d’IA voit peu de chose de votre site.',
      'Commencez par les contrôles « À corriger » : ce sont ceux qui empêchent la lecture, pas ceux qui l’améliorent.',
    ],
    limits: [
      'Le score note des conditions techniques, pas votre présence réelle dans les réponses des IA : un site parfait peut ne pas être cité.',
      'Une seule page est analysée (celle que vous indiquez).',
      'Nous ne simulons pas un navigateur : ce qui dépend du JavaScript est compté comme absent, car c’est ce que voient la plupart des robots d’IA.',
    ],
    faq: [
      { q: 'Que veut dire « prêt pour les IA » ?', a: 'Qu’un robot d’IA peut accéder à vos pages, y lire le texte sans exécuter de JavaScript et comprendre qui vous êtes grâce à des données structurées. C’est une condition nécessaire pour être cité, pas une garantie.' },
      { q: 'Pourquoi le rendu sans JavaScript compte-t-il ?', a: 'Les grands robots d’IA récupèrent les fichiers JavaScript sans les exécuter, selon les observations publiées par Vercel. Un texte qui n’apparaît qu’après exécution du script leur reste invisible.' },
      { q: 'Mon score est bas : est-ce grave ?', a: 'C’est un point de départ. La plupart des correctifs sont simples : une ligne dans le robots.txt, un bloc JSON-LD, un sitemap déclaré. Chaque contrôle indique quoi faire.' },
      { q: 'Le score est-il le même que celui de l’audit Repéré ?', a: 'Non. Ce score porte sur votre site. L’audit mesure ce que ChatGPT, Perplexity et Gemini répondent réellement aux questions de vos clients.' },
      { q: 'À quelle fréquence refaire le test ?', a: 'Après chaque modification technique (refonte, changement d’hébergeur, nouveau thème) et une fois par trimestre, car la liste des robots d’IA évolue.' },
    ],
    sources: [SRC_VERCEL, SRC_RFC9309, SRC_GOOGLE_SD],
    related: [
      { label: 'Guide : apparaître dans ChatGPT quand on est une PME', href: '/guides/apparaitre-dans-chatgpt-pme' },
      { label: 'Notre méthode', href: '/methode' },
    ],
  },
  {
    slug: 'citabilite',
    name: 'Citabilité d’une page',
    h1: 'Cette page contient-elle des passages qu’une IA peut citer ?',
    lead: 'Collez une adresse ou un texte : nous vérifions les bonnes pratiques qui rendent un passage facile à reprendre (réponse directe, chiffres, structure, auteur, date) et surlignons les extraits citables.',
    metaTitle: 'Score de citabilité d’une page pour les IA',
    description:
      'Analysez gratuitement une page ou un texte : réponse directe, questions en titres, chiffres datés, auteur, tableaux. Liste de contrôle notée sur 100 et extraits citables surlignés.',
    output: 'Score sur 100, règles réussies ou à corriger, extraits citables surlignés',
    parcours: ['pme', 'ecommerce', 'local'],
    bridge: 'Une page bien construite peut être citée. Seule une mesure dit si elle l’est vraiment.',
    howItWorks: [
      'Nous lisons le texte de la page (ou celui que vous collez) tel qu’il est dans le HTML.',
      'Nous appliquons des règles publiques : réponse dans les premières lignes, titres en forme de question, listes et tableaux, chiffres et dates, auteur, longueur des paragraphes.',
      'Nous repérons les phrases autonomes, précises et chiffrées : ce sont les plus faciles à reprendre telles quelles.',
    ],
    reading: [
      'Le score est un décompte de bonnes pratiques, pas une mesure de ce que fait ChatGPT.',
      'Un extrait surligné est une phrase qui se comprend seule : un fait, un chiffre, une définition. Si aucune phrase n’est surlignée, commencez par écrire la réponse en une phrase en haut de la page.',
    ],
    limits: [
      'Les règles sont des heuristiques : une page peut être citée sans les respecter toutes.',
      'Nous n’évaluons pas l’exactitude de vos affirmations ni la réputation du site.',
      'En mode texte collé, les contrôles liés au HTML (balisage, auteur déclaré, date) sont moins fiables.',
    ],
    faq: [
      { q: 'Qu’est-ce qu’un passage citable ?', a: 'Une phrase ou un court paragraphe qui répond à une question précise, se comprend sans le reste de la page et contient un élément vérifiable : un chiffre, une date, un lieu, un nom.' },
      { q: 'Faut-il écrire en questions-réponses ?', a: 'Les titres en forme de question aident à faire correspondre une page à une demande, et une FAQ structure bien l’information. Ce n’est pas obligatoire : une réponse claire en tête de section produit le même effet.' },
      { q: 'La longueur de la page compte-t-elle ?', a: 'Moins que la densité. Une page courte qui répond nettement vaut mieux qu’une longue page vague. Les paragraphes très longs sont plus difficiles à extraire.' },
      { q: 'Pourquoi indiquer un auteur et une date ?', a: 'Ce sont des signaux de confiance et de fraîcheur, lisibles par les robots comme par les lecteurs. Une information datée est plus facile à reprendre avec prudence.' },
      { q: 'Puis-je analyser un texte avant de le publier ?', a: 'Oui : choisissez « Coller un texte ». Rien n’est publié ni conservé au-delà de l’analyse.' },
    ],
    sources: [SRC_GOOGLE_SD, SRC_VERCEL],
    related: [
      { label: 'Glossaire : citation', href: '/glossaire#citation' },
      { label: 'Guide : quand les IA disent des choses fausses', href: '/guides/ia-disent-des-choses-fausses' },
    ],
  },
  {
    slug: 'json-ld',
    name: 'Générateur et validateur JSON-LD',
    h1: 'Les données structurées que lisent les moteurs et les IA, prêtes à coller',
    lead: 'Remplissez un formulaire (commerce local, organisation, produit, FAQ) et copiez le bloc JSON-LD. Ou validez celui d’une page existante.',
    metaTitle: 'Générateur JSON-LD gratuit (LocalBusiness, Product)',
    description:
      'Générez gratuitement votre JSON-LD schema.org (LocalBusiness, Organization, Product, FAQPage) et validez celui de votre site : erreurs et champs manquants expliqués en français.',
    output: 'Bloc <script type="application/ld+json"> copiable, erreurs et champs manquants',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Le balisage aide les IA à vous identifier. L’audit montre si elles le font, et ce qu’elles disent de vous.',
    howItWorks: [
      'Choisissez le type qui décrit votre page, remplissez les champs, puis générez le bloc : seules vos valeurs y figurent, rien n’est inventé.',
      'Copiez le bloc et collez-le dans le <head> de la page concernée (ou dans le champ prévu par votre CMS).',
      'Revenez en mode « Valider » avec l’adresse de la page pour vérifier qu’il est bien publié et complet.',
    ],
    reading: [
      'Une erreur empêche la lecture du bloc (JSON mal formé, type inconnu). Un champ manquant ne bloque rien, mais laisse une information ambiguë.',
      'Les données déclarées doivent être visibles sur la page : un horaire balisé mais absent du texte est une incohérence.',
    ],
    limits: [
      'Le balisage ne garantit ni affichage enrichi dans Google ni citation par une IA : il réduit l’ambiguïté sur qui vous êtes.',
      'Ne balisez jamais d’avis ou de note que vous ne pouvez pas prouver.',
      'Pour un contrôle de syntaxe exhaustif, recoupez avec le validateur officiel de schema.org.',
    ],
    faq: [
      { q: 'Qu’est-ce que le JSON-LD ?', a: 'Un format de données structurées, invisible pour le visiteur, qui décrit votre entreprise, vos produits ou vos questions-réponses avec le vocabulaire schema.org. Les moteurs de recherche et les robots d’IA le lisent dans le HTML.' },
      { q: 'Où coller le code JSON-LD ?', a: 'Dans la section <head> de la page, ou en fin de <body>. Sous WordPress, une extension SEO ou un bloc HTML personnalisé convient ; sous Shopify, le fichier du thème.' },
      { q: 'LocalBusiness ou Organization ?', a: 'LocalBusiness (ou un sous-type comme Plumber, Restaurant) si vous recevez des clients ou intervenez dans une zone. Organization pour une entreprise sans adresse d’accueil, une marque ou un site de services en ligne.' },
      { q: 'Puis-je ajouter mes avis Google dans le JSON-LD ?', a: 'Non : Google n’accepte pas le balisage d’avis provenant d’un autre site sur votre propre page. Balisez uniquement des avis recueillis et affichés sur votre site.' },
      { q: 'Faut-il un bloc par page ?', a: 'Le bloc d’identité (LocalBusiness ou Organization) va sur l’accueil ou la page contact. Un bloc Product va sur chaque fiche produit, un bloc FAQPage sur la page qui affiche ces questions.' },
    ],
    sources: [SRC_SCHEMA, SRC_SCHEMA_VALIDATOR, SRC_GOOGLE_SD],
    related: [
      { label: 'Glossaire : JSON-LD', href: '/glossaire#json-ld' },
      { label: 'Guide : apparaître dans ChatGPT quand on est une PME', href: '/guides/apparaitre-dans-chatgpt-pme' },
    ],
  },
  {
    slug: 'rendu-sans-javascript',
    name: 'Rendu sans JavaScript',
    h1: 'Voyez votre page comme un robot d’IA : sans JavaScript',
    lead: 'La plupart des robots d’IA lisent le HTML tel qu’il arrive du serveur, sans exécuter le JavaScript. Voici le texte qu’ils trouvent réellement.',
    metaTitle: 'Test de rendu sans JavaScript : ChatGPT vous lit-il ?',
    description:
      'Voyez gratuitement le texte que les robots d’IA trouvent dans le HTML brut de votre page, sans JavaScript : titres, nombre de mots, coquille vide, verdict lisible ou quasi vide.',
    output: 'Texte extrait du HTML brut, indicateurs, verdict',
    parcours: ['ecommerce', 'pme'],
    bridge: 'Contenu invisible pour les robots ? L’audit montre ce que les IA disent de vous malgré tout, et d’où elles tirent leurs informations.',
    howItWorks: [
      'Nous récupérons le HTML de la page tel que le serveur l’envoie, sans navigateur et sans exécuter de script.',
      'Nous en extrayons le texte lisible, les titres, la balise title, la meta description et les données structurées.',
      'Nous comparons ce texte à ce qu’attend une page normale et détectons les coquilles vides typiques des applications JavaScript.',
    ],
    reading: [
      '« Lisible » : le contenu principal est dans le HTML. « Partiellement lisible » : une partie du texte n’arrive qu’après exécution du JavaScript. « Quasi vide » : un robot d’IA ne voit presque rien.',
      'Comparez l’extrait avec votre page dans le navigateur : ce qui manque dans l’extrait est invisible pour ces robots.',
    ],
    limits: [
      'Nous n’ouvrons pas de navigateur : la comparaison porte sur le HTML brut et des indicateurs, pas sur une capture du rendu final.',
      'Googlebot exécute le JavaScript, contrairement à la plupart des robots d’IA : un site bien indexé par Google peut rester illisible pour eux.',
    ],
    faq: [
      { q: 'Les robots d’IA exécutent-ils le JavaScript ?', a: 'Les grands robots d’IA observés par Vercel (GPTBot, ClaudeBot, PerplexityBot) téléchargent des fichiers JavaScript sans les exécuter. Le texte injecté par script leur échappe.' },
      { q: 'Mon site est fait avec React, Vue ou Angular : est-il invisible ?', a: 'Pas forcément. S’il utilise un rendu côté serveur ou une génération statique (Next.js, Nuxt, Astro…), le HTML contient déjà le texte. S’il s’agit d’une application rendue uniquement dans le navigateur, il l’est probablement en grande partie.' },
      { q: 'Comment corriger une page quasi vide ?', a: 'Activez le rendu côté serveur ou le pré-rendu des pages importantes, ou publiez une version HTML lisible des informations clés : qui vous êtes, ce que vous faites, où, à quel prix.' },
      { q: 'Et les sites Wix, Shopify ou WordPress ?', a: 'Ils servent en général le texte dans le HTML. Les blocs ajoutés par des applications tierces (avis, FAQ dynamiques, configurateurs) sont souvent l’exception.' },
      { q: 'Pourquoi ne pas simplement regarder la page dans mon navigateur ?', a: 'Parce que votre navigateur exécute le JavaScript. L’option « Afficher le code source » montre le HTML brut, mais il est difficile à lire : cet outil en extrait le texte.' },
    ],
    sources: [SRC_VERCEL],
    related: [
      { label: 'Site prêt pour les IA ? (audit complet du site)', href: '/outils/pret-pour-les-ia' },
      { label: 'Glossaire : moteur de réponse', href: '/glossaire#moteur-de-reponse' },
    ],
  },
  {
    slug: 'comparateur',
    name: 'Comparateur face à un concurrent',
    h1: 'Votre site face à un concurrent, sur les signaux que lisent les IA',
    lead: 'Deux adresses, un tableau côte à côte : accès des robots, rendu sans JavaScript, données structurées, citabilité, sitemap, llms.txt. Et les écarts à combler en premier.',
    metaTitle: 'Comparer mon site à un concurrent pour les IA',
    description:
      'Comparez gratuitement votre site à celui d’un concurrent sur les signaux techniques lus par les IA : robots, rendu sans JavaScript, JSON-LD, citabilité, sitemap. Écarts à combler.',
    output: 'Tableau côte à côte et écarts à combler en priorité',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Ce tableau compare deux sites. L’audit compare ce que les IA répondent sur vous et sur ce concurrent.',
    howItWorks: [
      'Nous analysons les deux pages en parallèle, avec les mêmes contrôles et le même robot déclaré.',
      'Nous rangeons les résultats signal par signal, côte à côte.',
      'Nous listons les écarts où le concurrent fait mieux, du plus bloquant au plus secondaire.',
    ],
    reading: [
      'Un écart en votre défaveur sur l’accès des robots ou le rendu sans JavaScript passe avant tout le reste : il empêche la lecture.',
      'Un concurrent mieux noté ici n’est pas forcément plus cité : c’est une comparaison de conditions techniques.',
    ],
    limits: [
      'Nous comparons des signaux techniques, pas des recommandations réelles des IA.',
      'Une page par site est analysée. Nous ne conservons pas les résultats du concurrent au-delà d’un cache de 24 heures.',
    ],
    faq: [
      { q: 'Est-ce légal d’analyser le site d’un concurrent ?', a: 'Nous lisons une page publique, comme un moteur de recherche, avec un robot déclaré qui respecte son robots.txt. Aucune donnée personnelle n’est collectée.' },
      { q: 'Pourquoi mon concurrent est-il cité et pas moi ?', a: 'Les signaux techniques n’expliquent qu’une partie. Les avis, les mentions sur d’autres sites et la clarté de l’offre comptent aussi. L’audit Repéré regarde ces sources.' },
      { q: 'Quelle page comparer ?', a: 'Les pages d’accueil pour une première vue, ou deux pages qui répondent à la même demande (deux pages de service, deux fiches produit) pour une comparaison plus juste.' },
      { q: 'Combien de comparaisons puis-je faire ?', a: 'Le comparateur est limité à 5 comparaisons par heure et par connexion, pour éviter les abus, car chaque comparaison analyse deux sites.' },
      { q: 'Le concurrent est-il prévenu ?', a: 'Non. Il voit seulement, dans ses journaux de serveur, une visite de notre robot déclaré.' },
    ],
    sources: [SRC_VERCEL, SRC_RFC9309],
    related: [
      { label: 'Glossaire : part de voix', href: '/glossaire#part-de-voix' },
      { label: 'Comparatif des solutions', href: '/comparatif' },
    ],
  },
  {
    slug: 'llms-txt',
    name: 'Générateur de llms.txt',
    h1: 'Générez votre llms.txt en une minute, et sachez ce qu’il fait réellement',
    lead: 'Nous lisons votre sitemap et vos pages principales pour proposer un fichier llms.txt, à relire et à poser à la racine de votre site. Avec ce qu’on sait, et ce qu’on ne sait pas, de son effet.',
    metaTitle: 'Générateur llms.txt gratuit et honnête : utile ou pas ?',
    description:
      'Générez gratuitement un fichier llms.txt à partir de votre sitemap, avec les instructions de pose (WordPress, Shopify) et un point honnête sur son utilité réelle pour ChatGPT, Gemini et Perplexity.',
    output: 'Fichier llms.txt proposé, instructions de pose, point sur son utilité',
    parcours: ['pme', 'ecommerce'],
    bridge: 'Mieux qu’un fichier : mesurer si les IA vous citent, et sur quelles questions.',
    howItWorks: [
      'Nous lisons votre sitemap (ou, à défaut, les liens de la page d’accueil) et sélectionnons les pages principales.',
      'Nous reprenons leurs titres et descriptions pour rédiger un fichier au format proposé par llmstxt.org.',
      'Vous relisez, modifiez, puis déposez le fichier à la racine : https://votre-site.fr/llms.txt.',
    ],
    reading: [
      'Le fichier est une proposition : relisez les descriptions, retirez les pages sans intérêt (mentions légales, panier) et ajoutez celles qui manquent.',
      'S’il existe déjà un llms.txt sur votre site, nous l’indiquons.',
    ],
    limits: [
      'Aucun effet démontré sur les citations à ce jour : voyez l’encadré ci-dessous.',
      'Le fichier ne contrôle pas l’entraînement des modèles : c’est le rôle du robots.txt.',
    ],
    faq: [
      { q: 'Qu’est-ce que le fichier llms.txt ?', a: 'Un fichier texte en Markdown, posé à la racine d’un site, qui résume le site et liste ses pages utiles pour les modèles de langage. C’est une proposition communautaire (llmstxt.org), pas une norme.' },
      { q: 'Le llms.txt améliore-t-il le référencement dans ChatGPT ?', a: 'Aucun effet n’est démontré à ce jour. Google a déclaré ne pas l’utiliser pour la recherche ; certains assistants et agents de développement le liraient. Il ne coûte presque rien, mais ne remplace ni un contenu clair ni l’accès des robots.' },
      { q: 'Comment l’installer sur WordPress ?', a: 'Déposez le fichier llms.txt à la racine via le gestionnaire de fichiers de votre hébergeur (au même niveau que wp-config.php), ou utilisez une extension qui le sert. Vérifiez ensuite que https://votre-site.fr/llms.txt s’affiche.' },
      { q: 'Et sur Shopify ?', a: 'Shopify ne permet pas de déposer un fichier à la racine. La solution habituelle est une page ou un fichier servi par une redirection d’URL vers /llms.txt ; elle n’est pas toujours lue de la même façon.' },
      { q: 'Le llms.txt bloque-t-il l’entraînement des IA ?', a: 'Non. Pour autoriser ou bloquer des robots, utilisez le robots.txt (notre vérificateur vous donne les lignes).' },
    ],
    sources: [SRC_LLMS, SRC_ECORP],
    related: [
      { label: 'Glossaire : llms.txt', href: '/glossaire#llms-txt' },
      { label: 'Vérificateur robots.txt pour les IA', href: '/outils/robots-ia' },
    ],
  },
  {
    slug: 'fiche-produit',
    name: 'Audit de fiche produit',
    h1: 'Votre fiche produit donne-t-elle aux IA ce qu’il faut pour la recommander ?',
    lead: 'Nous vérifions ce qu’un assistant d’achat lit sur une fiche : données Product et Offer, prix, disponibilité, avis, attributs, texte lisible sans JavaScript. Score sur 100 et correctifs.',
    metaTitle: 'Audit gratuit d’une fiche produit (Product, Offer)',
    description:
      'Auditez gratuitement une fiche produit : données Product et Offer, prix, disponibilité, avis, attributs, texte lisible sans JavaScript. Score sur 100 et correctifs pour les assistants d’achat.',
    output: 'Score sur 100, contrôles Product / Offer / avis / attributs avec correctifs',
    parcours: ['ecommerce'],
    bridge: 'Une fiche complète peut être recommandée. L’audit dit si les IA citent votre marque, vos produits, ou un revendeur à votre place.',
    howItWorks: [
      'Collez l’adresse d’une fiche produit : nous la lisons sans exécuter de JavaScript.',
      'Nous vérifions les données structurées Product et Offer, le prix, la devise, la disponibilité, les avis, la marque, les identifiants (GTIN, référence) et les attributs.',
      'Nous comparons ces données au texte visible et listons les correctifs, du plus bloquant au plus secondaire.',
    ],
    reading: [
      'Un prix ou une disponibilité absents du HTML brut sont les erreurs les plus courantes : l’assistant ne peut pas les citer.',
      'Les attributs (matière, dimensions, compatibilité) servent à répondre aux questions précises des acheteurs.',
    ],
    limits: [
      'Une seule fiche est analysée ; les variantes chargées en JavaScript peuvent manquer.',
      'Nous ne vérifions pas l’exactitude des prix ni la conformité de vos avis.',
    ],
    faq: [
      { q: 'Quelles données structurées pour une fiche produit ?', a: 'Un bloc Product avec name, image, description, brand et un identifiant (sku, gtin), et un bloc Offer avec price, priceCurrency et availability. aggregateRating seulement si les avis sont recueillis et affichés sur votre site.' },
      { q: 'Les assistants d’achat lisent-ils mes fiches ?', a: 'Les assistants avec recherche web récupèrent des pages produit pour comparer prix et caractéristiques. Ils lisent le HTML brut, d’où l’importance d’avoir le prix et la disponibilité dans le code servi.' },
      { q: 'Mon prix s’affiche mais n’est pas détecté : pourquoi ?', a: 'Il est probablement injecté par JavaScript après le chargement. Ajoutez-le au balisage Offer côté serveur et dans le HTML initial.' },
      { q: 'Faut-il réécrire toutes mes descriptions ?', a: 'Non. Commencez par vos produits phares : une description factuelle, des attributs complets et une réponse aux trois questions que posent vos clients.' },
      { q: 'Et Shopify ?', a: 'La plupart des thèmes Shopify publient déjà un bloc Product. Vérifiez qu’il contient la marque, un identifiant et la disponibilité, souvent incomplets.' },
    ],
    sources: [SRC_SCHEMA, SRC_GOOGLE_SD, SRC_VERCEL],
    related: [
      { label: 'Générateur JSON-LD (bloc Product)', href: '/outils/json-ld' },
      { label: 'Repéré pour l’e-commerce', href: '/e-commerce' },
    ],
  },
];

export const toolPath = (slug: ToolSlug) => `/outils/${slug}`;
export const getTool = (slug: ToolSlug): ToolDef => {
  const t = TOOLS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Outil inconnu : ${slug}`);
  return t;
};
