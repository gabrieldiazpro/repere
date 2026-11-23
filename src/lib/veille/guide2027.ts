/**
 * Contenu premium : « Être recommandé par Google et les IA en 2027 ». Guide imprimable (HTML) et PDF, construit à
 * partir des guides du site et des fiches de veille. Les renvois [n] pointent vers GUIDE_2027_SOURCES (relues le
 * 23 novembre 2026). `[texte](/chemin)` = lien interne. Aucune promesse de résultat ; l'incertain est dit.
 */
import { CONSULTED } from './entries';

export interface G27Block {
  h3?: string;
  paras?: string[];
  list?: string[];
  /** liste numérotée (étapes) */
  steps?: string[];
  /** cases à cocher imprimables */
  checklist?: string[];
  table?: { head: string[]; rows: string[][]; caption?: string };
  /** encadré « à retenir » */
  note?: string;
}

export interface G27Chapter {
  id: string;
  title: string;
  lead: string;
  blocks: G27Block[];
}

export interface G27Source {
  label: string;
  url: string;
  publisher: string;
  published?: string;
  primary: boolean;
}

export const GUIDE_2027 = {
  slug: 'guide-2027',
  title: 'Être recommandé par Google et les IA en 2027',
  subtitle: 'Le guide pratique des sites professionnels : ce qui a changé, ce qui compte, ce qu’il faut faire, et ce que personne ne sait encore.',
  edition: 'Édition de novembre 2026',
  updated: CONSULTED,
  published: '2026-11-23',
};

export const GUIDE_2027_SOURCES: G27Source[] = [
  /* 1 */ { label: 'Lancement des Aperçus IA et du Mode IA dans la Recherche Google en France', url: 'https://blog.google/intl/fr-fr/nouveautes-produits/explorez-obtenez-des-reponses/recherche-ia-apercus-mode/', publisher: 'Google France', published: '2026-07-22', primary: true },
  /* 2 */ { label: 'Optimizing your website for generative AI features on Google Search', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide', publisher: 'Google Search Central', published: '2026-07-10', primary: true },
  /* 3 */ { label: "Contrôle de l'IA générative dans la Recherche", url: 'https://support.google.com/webmasters/answer/16908024?hl=fr', publisher: 'Google, aide Search Console', primary: true },
  /* 4 */ { label: 'Google Search Status Dashboard, historique des incidents de classement', url: 'https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history', publisher: 'Google', primary: true },
  /* 5 */ { label: "Conseils de la recherche Google concernant l'utilisation de contenu généré par IA", url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content?hl=fr', publisher: 'Google Search Central', published: '2026-10-05', primary: true },
  /* 6 */ { label: 'Règles relatives au spam pour la recherche Google', url: 'https://developers.google.com/search/docs/essentials/spam-policies', publisher: 'Google Search Central', published: '2026-08-28', primary: true },
  /* 7 */ { label: 'Règlement (UE) 2024/1689 sur l’IA, version consolidée au 27 juillet 2026', url: 'https://eur-lex.europa.eu/eli/reg/2024/1689/2026-07-27/eng/pdf', publisher: 'EUR-Lex', published: '2026-07-27', primary: true },
  /* 8 */ { label: 'Règlement (UE) 2026/1744 (Omnibus numérique sur l’IA)', url: 'https://eur-lex.europa.eu/eli/reg/2026/1744/oj?locale=en', publisher: 'EUR-Lex', published: '2026-07-08', primary: true },
  /* 9 */ { label: 'Digital Services Act starts applying to all online platforms in the EU', url: 'https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_24_881/IP', publisher: 'Commission européenne', published: '2024-02-16', primary: true },
  /* 10 */ { label: 'Directive (UE) 2019/2161, article 3', url: 'https://www.legislation.gov.uk/eudr/2019/2161/article/3/data.html', publisher: 'Texte de la directive (copie legislation.gov.uk)', published: '2019-11-27', primary: true },
  /* 11 */ { label: 'Les avis en ligne : comment leur faire confiance ?', url: 'https://www.inc-conso.fr/node/12763', publisher: 'Institut national de la consommation', published: '2022-04-12', primary: true },
  /* 12 */ { label: 'Fake reviews (CMA208)', url: 'https://www.gov.uk/government/publications/fake-reviews', publisher: 'Competition and Markets Authority', published: '2025-04-04', primary: true },
  /* 13 */ { label: 'Trade Regulation Rule on the Use of Consumer Reviews and Testimonials', url: 'https://www.federalregister.gov/documents/2024/08/22/2024-18519/trade-regulation-rule-on-the-use-of-consumer-reviews-and-testimonials', publisher: 'FTC (Federal Register)', published: '2024-08-22', primary: true },
  /* 14 */ { label: "New ways we're protecting businesses on Maps", url: 'https://blog.google/products-and-platforms/products/maps/new-ways-were-protecting-businesses-on-maps/', publisher: 'Google', published: '2026-04-16', primary: true },
  /* 15 */ { label: 'Google Removing Q&A Feature In Google Maps For AI-Powered Ask Button', url: 'https://www.seroundtable.com/google-maps-qa-feature-ask-40594.html', publisher: 'Search Engine Roundtable', published: '2025-12-15', primary: false },
  /* 16 */ { label: "Cookies : solutions pour les outils de mesure d'audience", url: 'https://cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience', publisher: 'CNIL', published: '2025-07-04', primary: true },
  /* 17 */ { label: 'Questions-réponses sur la recommandation cookies et traceurs', url: 'https://cnil.fr/questions-reponses-lignes-directrices-modificatives-et-recommandation-cookies-traceurs', publisher: 'CNIL', published: '2026-04-29', primary: true },
  /* 18 */ { label: 'Pixels de suivi dans les courriers électroniques : la CNIL publie ses recommandations', url: 'https://cnil.fr/fr/recommandation-pixel-suivi-courriels', publisher: 'CNIL', published: '2026-04-14', primary: true },
  /* 19 */ { label: "Accessibilité numérique et handicap : entrée en vigueur de l'EAA", url: 'https://www.monparcourshandicap.gouv.fr/actualite/accessibilite-numerique-et-handicap-entree-en-vigueur-de-leaa', publisher: 'Mon Parcours Handicap', published: '2025-07-01', primary: true },
  /* 20 */ { label: 'Overview of OpenAI Crawlers', url: 'https://developers.openai.com/api/docs/bots.md', publisher: 'OpenAI', primary: true },
  /* 21 */ { label: 'Robots.txt controls', url: 'https://support.claude.com/en/articles/8896518-robots-txt-controls', publisher: 'Anthropic', primary: true },
  /* 22 */ { label: 'Perplexity crawlers', url: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md', publisher: 'Perplexity', primary: true },
  /* 23 */ { label: "List of Google's common crawlers", url: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers', publisher: 'Google', published: '2026-10-30', primary: true },
  /* 24 */ { label: 'About Applebot', url: 'https://support.apple.com/en-euro/119829', publisher: 'Apple', published: '2026-09-04', primary: true },
  /* 25 */ { label: 'We Analyzed 137K Sites: 97% of llms.txt Files Never Get Read', url: 'https://ahrefs.com/blog/llmstxt-study/', publisher: 'Ahrefs', published: '2026-06-15', primary: false },
  /* 26 */ { label: 'A content analysis of llms.txt files from the July 2026 crawl archive', url: 'https://commoncrawl.org/blog/a-content-analysis-of-llms-txt-files-from-the-july-2026-crawl-archive', publisher: 'Common Crawl', published: '2026-08-31', primary: true },
  /* 27 */ { label: 'Powering product discovery in ChatGPT', url: 'https://openai.com/index/powering-product-discovery-in-chatgpt/', publisher: 'OpenAI', published: '2026-03-24', primary: true },
  /* 28 */ { label: 'Merchant Center product data specification update 2026', url: 'https://support.google.com/merchants/answer/16989427?hl=en', publisher: 'Google Merchant Center', primary: true },
  /* 29 */ { label: 'About the Universal Commerce Protocol (UCP) and UCP-powered checkout feature on Google', url: 'https://support.google.com/merchants/answer/16837055?hl=en', publisher: 'Google Merchant Center', primary: true },
  /* 30 */ { label: 'Introducing AI Performance in Bing Webmaster Tools Public Preview', url: 'https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview', publisher: 'Microsoft Bing', published: '2026-02-10', primary: true },
  /* 31 */ { label: 'New AI Visibility Insights in Bing Webmaster Tools', url: 'https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare', publisher: 'Microsoft Bing', published: '2026-06-16', primary: true },
  /* 32 */ { label: 'Le Chat is now Vibe', url: 'https://help.mistral.ai/en/articles/682992-le-chat-is-now-vibe', publisher: 'Mistral AI', published: '2026-08-12', primary: true },
  /* 33 */ { label: 'Siri AI, a profoundly more capable and personal assistant, is here', url: 'https://www.apple.com/uk/newsroom/2026/09/siri-ai-a-profoundly-more-capable-and-personal-assistant-is-here/', publisher: 'Apple', published: '2026-09-14', primary: true },
  /* 34 */ { label: 'Google Search Drops FAQ Rich Results In Search & Search Console', url: 'https://www.seroundtable.com/google-drops-faq-rich-results-41298.html', publisher: 'Search Engine Roundtable', published: '2026-05-11', primary: false },
  /* 35 */ { label: 'Google adds AI Mode and AI Overviews opt-out for websites', url: 'https://9to5google.com/2026/06/02/google-ai-mode-overviews-opt-out/', publisher: '9to5Google', published: '2026-06-02', primary: false },
  /* 36 */ { label: 'Carrefour becomes first European retailer to offer shopping on ChatGPT', url: 'https://finance.yahoo.com/sectors/technology/articles/carrefour-becomes-first-european-retailer-093836925.html', publisher: 'Yahoo Finance', published: '2026-03-27', primary: false },
];

export const GUIDE_2027_CHAPTERS: G27Chapter[] = [
  /* ------------------------------------------------------------------ */
  {
    id: 'lire',
    title: 'Avant de commencer : ce que ce guide promet, et ce qu’il ne promet pas',
    lead: 'Personne ne contrôle les réponses de Google ou des assistants IA. Ce guide décrit des leviers raisonnables, vérifiés à la date d’édition, pas une recette.',
    blocks: [
      {
        paras: [
          'En 2027, un client qui cherche un artisan, un cabinet, un logiciel ou un produit a trois façons de le trouver : la liste de résultats de Google, une réponse rédigée par une IA (dans Google, ChatGPT, Gemini, Perplexity, Copilot, Claude, Vibe ou Siri), et la recommandation d’un proche. Les deux premières dépendent en partie de votre site et de ce que le web dit de vous. C’est le sujet de ce guide.',
          'Nous l’avons écrit pour les dirigeants de commerces, de PME et de boutiques en ligne, et pour les agences qui les accompagnent. Il ne suppose aucune compétence technique ; les passages plus techniques sont signalés et peuvent être confiés à votre prestataire.',
          'Chaque affirmation datée renvoie à une source numérotée en fin de document. Les sources ont été relues le 23 novembre 2026. Nous préférons les textes officiels et la documentation des éditeurs ; quand nous citons la presse spécialisée ou un cabinet, nous le signalons. Quand une information n’est pas confirmée, nous l’écrivons.',
        ],
      },
      {
        h3: 'Ce qui est hors de votre portée',
        list: [
          'Le choix final d’une IA : deux questions identiques peuvent recevoir deux réponses différentes, et aucune position n’est stable.',
          'Le calendrier des mises à jour de Google, qui réévaluent l’ensemble des sites plusieurs fois par an.',
          'Les décisions commerciales des éditeurs : un bouton d’achat peut apparaître dans un pays et pas dans un autre, ou être retiré quelques mois après son lancement.',
        ],
      },
      {
        note: 'Méfiez-vous de toute offre qui « garantit » une place dans ChatGPT ou dans les Aperçus IA. Aucun éditeur ne vend cette place, et aucun prestataire ne peut la promettre honnêtement.',
      },
      {
        h3: 'Comment utiliser ce guide',
        steps: [
          'Lisez le chapitre 1 pour comprendre ce qui a changé depuis 2024.',
          'Faites le diagnostic du chapitre 2 (une heure, sans outil payant).',
          'Traitez les fondations techniques (chapitre 3) avant le contenu : une page que les robots ne lisent pas ne sera jamais citée.',
          'Choisissez ensuite le chapitre de votre activité (local, PME, e-commerce).',
          'Suivez le plan sur douze mois du chapitre 13, et revenez à la [veille](/veille) chaque mois.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'change',
    title: '1. Ce qui a changé : la réponse passe avant le lien',
    lead: 'Depuis le 22 juillet 2026, Google affiche en France des réponses générées au-dessus de ses résultats. Les assistants IA, eux, sont devenus des moteurs de recherche à part entière.',
    blocks: [
      {
        h3: 'Google : Aperçus IA et Mode IA en France',
        paras: [
          'Google a lancé en France, le 22 juillet 2026, les Aperçus IA et le Mode IA, sur mobile, sur ordinateur et dans son application [1]. Les Aperçus IA apparaissent au-dessus des résultats quand les systèmes de Google jugent une réponse générée utile ; ils contiennent des liens. Le Mode IA est une recherche conversationnelle : la question est découpée en sous-questions, et plusieurs recherches sont lancées en parallèle. Google indique qu’une recherche en Mode IA est en moyenne trois fois plus longue qu’une recherche classique [1].',
          'Conséquence pratique : vos clients posent des questions plus longues et plus précises (« quel cabinet d’expertise comptable à Lyon accompagne les SCI familiales ? »), et la réponse cite quelques sources. Être bien classé sur un mot-clé court reste utile, mais ne suffit plus : il faut que vos pages répondent à ces questions longues.',
          'Pour être éligible, Google pose une condition simple : la page doit être indexée et pouvoir s’afficher avec un extrait. Aucun fichier, balisage ou format spécial n’est nécessaire [2].',
        ],
      },
      {
        h3: 'Les assistants IA : chacun ses sources',
        paras: [
          'ChatGPT, Perplexity, Claude et Copilot cherchent sur le web au moment de répondre, avec leurs propres robots. OpenAI, Anthropic et Perplexity documentent séparément leurs robots de recherche, leurs robots d’entraînement et les visites déclenchées par un utilisateur [20][21][22]. Microsoft montre désormais aux sites quand Copilot les cite [30]. Mistral a renommé son assistant le Chat en Vibe le 12 août 2026 [32]. Apple a lancé Siri AI en bêta en anglais le 14 septembre 2026, avec des modèles conçus en collaboration avec Google et Gemini ; il n’est pas disponible au départ sur iPhone dans l’Union européenne [33].',
          'Il n’existe donc pas « une » visibilité dans les IA, mais une visibilité par assistant. Un site peut être bien cité par Perplexity et absent de ChatGPT, parce que l’un lit une source que l’autre ignore.',
        ],
      },
      {
        h3: 'Ce qui n’a pas changé',
        list: [
          'Google continue de réévaluer l’ensemble des sites par des mises à jour principales : six entre mars 2025 et novembre 2026, la dernière ayant commencé le 10 novembre 2026 [4].',
          'Les règles anti-spam s’appliquent toujours, et le contenu produit en série par IA sans valeur ajoutée y est explicitement visé [6].',
          'Les fondamentaux restent les mêmes : des pages accessibles, une information exacte, des preuves, une réputation cohérente.',
        ],
      },
      {
        table: {
          caption: 'Calendrier des changements récents (sources : chapitre « Sources »)',
          head: ['Date', 'Changement', 'Source'],
          rows: [
            ['17 février 2024', 'Le DSA s’applique à tous les intermédiaires en ligne', '[9]'],
            ['28 juin 2025', 'Acte européen sur l’accessibilité : sites marchands concernés', '[19]'],
            ['10 février 2026', 'Bing montre les citations dans Copilot (préversion)', '[30]'],
            ['24 mars 2026', 'OpenAI met en retrait l’achat intégré à ChatGPT', '[27]'],
            ['7 mai 2026', 'Fin des résultats enrichis FAQ dans Google', '[34]'],
            ['22 juillet 2026', 'Aperçus IA et Mode IA en France', '[1]'],
            ['2 août 2026', 'AI Act : obligations de transparence (article 50)', '[7]'],
            ['31 août 2026', 'Réglage « IA générative » dans la Search Console, monde entier', '[3]'],
            ['10 novembre 2026', 'Mise à jour principale de Google (en cours au 23 novembre)', '[4]'],
          ],
        },
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'diagnostic',
    title: '2. Le diagnostic en une heure',
    lead: 'Avant d’agir, mesurez. Ce test se fait sans outil payant et donne une base de comparaison pour toute l’année.',
    blocks: [
      {
        steps: [
          'Écrivez quinze questions comme vos clients les poseraient, sans citer votre nom : « meilleur restaurant italien près de la gare de Rennes », « logiciel de planning pour une crèche », « chaussures de randonnée larges pour pieds sensibles ».',
          'Posez chaque question trois fois à Google (en regardant l’Aperçu IA s’il apparaît), à ChatGPT, à Perplexity et à Gemini, dans une conversation neuve et si possible sans être connecté.',
          'Notez dans un tableau : êtes-vous cité ? quels concurrents le sont ? quels sites sont donnés en source ?',
          'Datez le tableau. Refaites le même test chaque mois, avec les mêmes questions, pour comparer ce qui est comparable.',
        ],
      },
      {
        paras: [
          'La colonne la plus précieuse est celle des sources : elle vous dit quels sites les assistants lisent pour votre métier (annuaires, comparateurs, presse locale, forums, plateformes d’avis). C’est là que vous devez être présent et exact.',
          'Pourquoi trois fois ? Parce que les réponses varient. Un nom cité une fois sur trois n’est pas « en première position » : il apparaît dans un tiers des réponses. C’est ce type de fréquence qu’il faut suivre, assistant par assistant.',
          'Repéré automatise ce test (questions, répétitions, sources) et affiche une marge d’erreur ; vous pouvez aussi le faire à la main avec ce protocole. Notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt) détaille la méthode.',
        ],
      },
      {
        h3: 'Les données que vous avez déjà',
        list: [
          'Search Console : le rapport de performance sur l’IA générative montre les pages qui apparaissent dans les réponses de Google et les pays concernés [3][35].',
          'Bing Webmaster Tools : le rapport AI Performance compte les citations dans Copilot et les résumés IA de Bing, avec, depuis juin 2026, la part des citations d’une requête qui vont à votre site [30][31].',
          'Votre outil de mesure d’audience : les visites venant de chatgpt.com, perplexity.ai ou copilot.microsoft.com (voir [Mesurer le trafic venu de ChatGPT](/guides/trafic-chatgpt-ga4)).',
        ],
      },
      {
        checklist: [
          'J’ai listé quinze questions de clients, sans mon nom.',
          'J’ai noté, pour chaque assistant, si je suis cité et qui l’est.',
          'J’ai relevé les sites cités en source pour mon métier.',
          'J’ai ouvert la Search Console et Bing Webmaster Tools.',
          'J’ai daté ce premier relevé.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'fondations',
    title: '3. Les fondations techniques : être lisible par les robots',
    lead: 'Une page que les robots ne peuvent pas lire, ou qu’ils n’ont pas le droit de lire, ne sera jamais citée. C’est le chapitre à confier à votre prestataire si besoin.',
    blocks: [
      {
        h3: 'Indexation et extrait',
        paras: [
          'Pour Google, la règle est posée noir sur blanc : une page doit être indexée et pouvoir s’afficher avec un extrait pour être éligible aux fonctions d’IA [2]. Une balise « noindex », une balise « nosnippet » ou une page bloquée dans le robots.txt suffisent à vous exclure.',
          'Vérifiez aussi que le texte important est présent dans le HTML envoyé par le serveur. Beaucoup de robots d’IA ne lancent pas le JavaScript : un texte affiché seulement après chargement d’un script peut leur être invisible. Notre outil [Rendu sans JavaScript](/outils/rendu-sans-javascript) le montre en une minute.',
        ],
      },
      {
        h3: 'robots.txt : séparer recherche et entraînement',
        paras: [
          'Les éditeurs distinguent désormais trois usages : faire apparaître votre site dans leurs réponses (recherche), utiliser vos pages pour entraîner leurs modèles (entraînement), et visiter une page à la demande d’un utilisateur. Bloquer le mauvais robot peut vous retirer des réponses sans rien changer à l’entraînement.',
        ],
        table: {
          caption: 'Principaux robots documentés par les éditeurs (relus le 23 novembre 2026)',
          head: ['Éditeur', 'Recherche (à laisser passer pour être cité)', 'Entraînement (à bloquer si vous refusez)', 'Visite à la demande'],
          rows: [
            ['OpenAI [20]', 'OAI-SearchBot', 'GPTBot', 'ChatGPT-User (robots.txt peut ne pas s’appliquer)'],
            ['Anthropic [21]', 'Claude-SearchBot', 'ClaudeBot', 'Claude-User'],
            ['Perplexity [22]', 'PerplexityBot', 'non utilisé pour l’entraînement selon Perplexity', 'Perplexity-User (ignore en général robots.txt)'],
            ['Google [23]', 'Googlebot', 'Google-Extended (sans effet sur la recherche)', 'non concerné'],
            ['Apple [24]', 'Applebot', 'Applebot-Extended (ne parcourt rien lui-même)', 'non concerné'],
          ],
        },
      },
      {
        paras: [
          'Deux précisions utiles. Google indique que Google-Extended n’a aucun effet sur l’inclusion ni sur le classement dans la recherche [23]. Et depuis le 31 août 2026, la Search Console propose un réglage distinct pour sortir des Aperçus IA et du Mode IA ; il retire les impressions et le trafic venant de ces fonctions, et n’est pas un signal de classement pour le reste de la recherche [3]. Pour une entreprise qui veut être recommandée, laisser ce réglage sur « inclure » est en général le bon choix.',
          'Anthropic indique respecter robots.txt pour ses trois robots et déconseille de bloquer ses adresses IP, ce qui peut l’empêcher de lire vos consignes [21].',
        ],
      },
      {
        h3: 'llms.txt : ne pas en attendre de miracle',
        paras: [
          'Le fichier llms.txt a eu beaucoup de succès en 2025 et 2026. Les données disponibles invitent à la prudence. Google écrit que sa recherche ignore ces fichiers : en publier un « ne nuira ni n’aidera » [2]. Une étude d’Ahrefs portant sur 137 210 sites (échantillon plutôt technique) trouve un llms.txt sur 28 % d’entre eux, mais 97 % de ces fichiers n’ont reçu aucune requête en mai 2026 [25]. Common Crawl relève que 68 % environ des fichiers sont produits par des modèles automatiques et que certains contredisent le robots.txt du site [26].',
          'Notre position : un llms.txt court et exact ne fait pas de mal, mais il ne remplace aucune des actions de ce guide. Voir [Faut-il créer un llms.txt ?](/guides/llms-txt-faut-il-en-creer-un).',
        ],
      },
      {
        h3: 'Données structurées : garder celles qui servent',
        paras: [
          'Google a retiré les résultats enrichis FAQ le 7 mai 2026, après avoir abandonné en 2025 plusieurs autres types de balisage [34]. Il rappelle que les données structurées ne sont pas nécessaires pour ses fonctions d’IA, mais restent utiles pour les résultats enrichis encore pris en charge [2]. Concentrez-vous sur Organization ou LocalBusiness (identité, adresse, horaires), Product et Offer (prix, disponibilité) et Review. Un balisage FAQ resté en place ne pénalise pas : vous pouvez le retirer quand vous retouchez la page [34].',
        ],
      },
      {
        checklist: [
          'Mes pages importantes sont indexées, sans noindex ni nosnippet.',
          'Le texte principal est présent sans JavaScript.',
          'Mon robots.txt laisse passer OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot et Applebot.',
          'J’ai décidé, en connaissance de cause, de bloquer ou non GPTBot, ClaudeBot, Google-Extended et Applebot-Extended.',
          'Le réglage « IA générative dans la Recherche » de la Search Console est sur « inclure », sauf décision contraire mesurée.',
          'Mon balisage Organization ou LocalBusiness est exact et valide.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'contenu',
    title: '4. Le contenu qui se fait citer',
    lead: 'Une IA cite une page quand elle y trouve, vite, une réponse précise et vérifiable. Écrire pour être cité, c’est d’abord écrire pour être compris.',
    blocks: [
      {
        h3: 'Une page par question importante',
        paras: [
          'Reprenez les quinze questions de votre diagnostic. Pour chacune, existe-t-il sur votre site une page qui y répond directement ? Si la réponse est noyée au milieu d’une page « Nos services », une IA aura du mal à la reprendre. Créez ou réorganisez une page par sujet important : un service, une zone, un cas d’usage, une comparaison.',
          'En haut de chaque page, donnez la réponse en deux ou trois phrases. Puis détaillez : conditions, prix ou fourchette, délais, zone couverte, exceptions. Terminez par les questions fréquentes, visibles sur la page.',
        ],
      },
      {
        h3: 'Des faits, datés et vérifiables',
        list: [
          'Des chiffres exacts plutôt que des superlatifs : « intervention sous 48 heures dans un rayon de 30 km » plutôt que « réactivité exceptionnelle ».',
          'Des dates : date de mise à jour visible, date des tarifs, date des horaires d’été.',
          'Des preuves : certifications avec leur numéro, réalisations avec leur lieu, auteurs identifiés avec leur métier.',
          'Une cohérence absolue : les mêmes horaires, le même téléphone, les mêmes prix partout (site, fiche Google, annuaires).',
        ],
      },
      {
        h3: 'Écrire avec l’IA, sans se mettre en danger',
        paras: [
          'Google n’interdit pas le contenu produit avec l’IA. Mais sa documentation, mise à jour le 5 octobre 2026, demande de vérifier manuellement l’exactitude de tout contenu généré avant publication, y compris les titres, descriptions, données structurées et textes alternatifs [5]. Produire de nombreuses pages sans valeur ajoutée relève de l’« abus de contenu à grande échelle », interdit par les règles anti-spam [6].',
          'Côté droit européen, l’article 50 de l’AI Act s’applique depuis le 2 août 2026. Celui qui publie un texte généré par IA pour informer le public sur des questions d’intérêt public doit le signaler, sauf si le texte a été relu par un humain ou soumis à un contrôle éditorial et qu’une personne en assume la responsabilité éditoriale [7]. La règle la plus simple tient donc en une phrase : faites relire, et assumez.',
        ],
        note: 'Bonne pratique : indiquez en bas de vos articles qui les a relus et quand. C’est utile au lecteur, utile pour la confiance, et cohérent avec l’exception prévue par l’AI Act.',
      },
      {
        h3: 'Ce qui ne marche pas',
        list: [
          'Les pages ville recopiées en changeant seulement le nom de la commune (voir [Pages ville sans doublon](/guides/pages-ville-sans-doublon)).',
          'Les listes « top 10 » où vous vous classez vous-même premier sans critère explicite.',
          'Les textes allongés pour atteindre un nombre de mots.',
          'Les « avis » ou « témoignages » inventés, interdits en droit européen (chapitre 6).',
        ],
      },
      {
        checklist: [
          'Chaque question importante a sa page, avec la réponse en haut.',
          'Mes pages portent une date de mise à jour visible.',
          'Mes chiffres, horaires et prix sont identiques partout.',
          'Tout texte écrit avec une IA est relu par une personne nommée avant publication.',
          'J’ai supprimé ou fusionné les pages produites en série.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'entite',
    title: '5. Votre entreprise comme « entité » : que le web dise la même chose de vous',
    lead: 'Les IA recoupent. Quand votre site, votre fiche Google, les annuaires et la presse se contredisent, elles hésitent, se trompent ou citent un concurrent plus net.',
    blocks: [
      {
        paras: [
          'Une IA ne « connaît » pas votre entreprise : elle reconstitue une image à partir des sources qu’elle lit. Plus ces sources concordent, plus l’image est nette. Votre travail consiste à rendre cette image exacte et cohérente.',
        ],
      },
      {
        h3: 'Les fiches qui comptent',
        list: [
          'Google Business Profile, pour toute entreprise qui reçoit des clients ou se déplace chez eux (voir [Fiche Google Business Profile](/guides/fiche-google-business-profile)).',
          'Bing Places, qui alimente Bing et Copilot, et Apple Business Connect, pour Plans, Siri et Spotlight (voir [Annuaires locaux Bing et Apple](/guides/annuaires-locaux-bing-apple)).',
          'Les annuaires et plateformes cités en source dans votre diagnostic (chapitre 2) : ce sont eux que les assistants lisent pour votre métier.',
          'Pour les PME : LinkedIn, et le cas échéant une fiche Wikidata exacte et sourcée (voir [Entité de marque, Wikidata et sameAs](/guides/entite-de-marque-wikidata-sameas)).',
        ],
      },
      {
        h3: 'La fiche Google en 2026',
        paras: [
          'Deux évolutions récentes. D’abord, l’affichage des questions-réponses a été retiré des fiches dans Maps au profit d’un bouton qui répond à partir des réponses de l’entreprise et des avis ; les réponses que vous publiez dans votre fiche peuvent encore nourrir ces réponses [15]. La date exacte de ce changement en France n’est pas confirmée. Ensuite, depuis avril 2026, Google suspend temporairement les avis en cas de vague de faux avis, prévient le propriétaire, filtre avec Gemini les modifications contraires à ses règles et envoie des alertes par e-mail aux propriétaires vérifiés avant publication de modifications importantes [14].',
        ],
      },
      {
        checklist: [
          'Nom, adresse, téléphone, horaires et site sont identiques sur mon site, Google, Bing, Apple et les annuaires principaux.',
          'J’ai répondu par écrit, dans ma fiche Google, aux cinq questions les plus fréquentes.',
          'L’e-mail du propriétaire de ma fiche est à jour (alertes de modification).',
          'Mon site a une page « À propos » avec l’identité légale, les dirigeants et l’historique.',
          'Mon balisage Organization pointe (sameAs) vers mes profils officiels.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'avis',
    title: '6. Avis et réputation : collecter honnêtement, répondre toujours',
    lead: 'Les avis sont lus par vos clients, par Google et par les assistants IA. Ils sont aussi très encadrés par le droit, en Europe comme ailleurs.',
    blocks: [
      {
        h3: 'Ce que dit le droit',
        list: [
          'Dans l’UE, quand un professionnel affiche des avis, l’information sur le fait qu’il vérifie (ou non) qu’ils viennent de clients réels est une information substantielle [10].',
          'Sont interdits en toutes circonstances : affirmer que les avis viennent de vrais clients sans mesures raisonnables pour le vérifier, soumettre ou faire soumettre de faux avis, ou déformer des avis pour promouvoir des produits [10].',
          'En France, l’Institut national de la consommation résume les mentions attendues : date de l’avis, existence d’une procédure de contrôle, critères de classement, contrepartie éventuelle, durée de conservation [11].',
          'Au Royaume-Uni, l’autorité de la concurrence a publié le 4 avril 2025 ses lignes directrices sur les faux avis [12] ; aux États-Unis, la règle de la FTC s’applique depuis le 21 octobre 2024 [13].',
        ],
      },
      {
        note: 'Nous n’avons pas pu relire les articles du Code de la consommation sur Légifrance le 23 novembre 2026 (site inaccessible depuis notre outil). Vérifiez le texte en vigueur avant toute décision.',
      },
      {
        h3: 'Une méthode simple',
        steps: [
          'Demandez un avis à tous vos clients, sans les filtrer : un lien direct suffit (notre outil [Lien de demande d’avis Google](/outils/lien-avis-google) le crée).',
          'Demandez-le au bon moment : juste après la prestation, quand le client est satisfait ou insatisfait en connaissance de cause.',
          'Répondez à chaque avis dans les jours qui suivent, avec des faits, sans données personnelles.',
          'Affichez sur votre site une phrase claire sur la manière dont vous collectez et vérifiez les avis.',
          'Signalez les avis manifestement faux depuis votre fiche, au lieu de polémiquer.',
        ],
      },
      {
        paras: ['Pour aller plus loin : [Avis clients et IA](/guides/avis-clients-ia) et [Répondre aux avis clients](/guides/repondre-avis-clients).'],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'local',
    title: '7. Spécial commerce local et artisans',
    lead: 'Pour un commerce, la question type est « qui, près de moi, peut faire ceci, maintenant ? ». Les réponses s’appuient sur les fiches, les avis et les pages qui disent clairement où et quand.',
    blocks: [
      {
        list: [
          'Votre fiche Google est votre page la plus vue : catégorie principale exacte, horaires (y compris exceptionnels), photos récentes, services décrits avec leurs prix quand c’est possible.',
          'Votre site doit dire, en toutes lettres, la zone couverte et les conditions : « dépannage le dimanche à Nantes et dans un rayon de 20 km, majoration de 30 % ».',
          'Une page par service réel, et une page par zone seulement si vous avez quelque chose de propre à dire sur cette zone.',
          'Les plateformes de votre métier (réservation, devis, annuaires professionnels) comptent autant que votre site : c’est souvent elles que les assistants citent.',
          'Siri AI n’est pas disponible au départ sur iPhone dans l’UE [33], mais Applebot alimente déjà Spotlight, Siri et Safari [24] : laissez-le passer et tenez votre fiche Apple Business Connect à jour.',
        ],
      },
      {
        h3: 'Trois erreurs fréquentes',
        list: [
          'Des horaires différents entre la fiche Google, le site et les annuaires : l’IA choisit au hasard, ou annonce que vous êtes fermé.',
          'Un numéro de suivi d’appels différent sur chaque annuaire : l’identité se brouille.',
          'Des avis demandés seulement aux clients contents : c’est interdit si vous laissez croire que les avis sont représentatifs, et cela se voit.',
        ],
      },
      { paras: ['Guides utiles : [SEO local et IA](/guides/seo-local-et-ia), [Plusieurs établissements](/guides/seo-local-multi-etablissements), [Restaurant](/guides/seo-restaurant), [Artisans du bâtiment](/guides/seo-artisans-batiment), [Professions de santé](/guides/seo-professions-sante).'] },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'pme',
    title: '8. Spécial PME et B2B',
    lead: 'En B2B, l’acheteur demande à l’IA de comparer : « quel logiciel de paie pour 50 salariés ? », « alternative à tel concurrent ». Si vous n’êtes pas dans la liste, vous n’êtes pas dans la comparaison.',
    blocks: [
      {
        list: [
          'Publiez les informations que les acheteurs cherchent et que beaucoup cachent : à qui s’adresse votre offre, à qui elle ne s’adresse pas, ordre de grandeur des prix, délais de mise en place, intégrations.',
          'Créez des pages de comparaison honnêtes, qui reconnaissent les points forts des concurrents : les IA reprennent plus volontiers une comparaison équilibrée.',
          'Montrez des cas clients réels, avec l’accord des clients et des faits vérifiables. Jamais de logo ou de témoignage inventé.',
          'Soignez vos profils hors site : LinkedIn, annuaires professionnels, comparateurs de logiciels, presse spécialisée.',
          'Vérifiez dans Bing Webmaster Tools quelles pages Copilot cite déjà, et pour quelles intentions [31].',
        ],
      },
      { paras: ['Guides utiles : [Apparaître dans ChatGPT quand on est une PME](/guides/apparaitre-dans-chatgpt-pme), [SEO B2B](/guides/seo-b2b-acheteurs), [LinkedIn et IA](/guides/linkedin-visibilite-b2b-ia), [Avocats et experts-comptables](/guides/seo-avocats-experts-comptables).'] },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'ecommerce',
    title: '9. Spécial e-commerce',
    lead: 'Les assistants comparent des produits : prix, caractéristiques, avis, disponibilité. Vos fiches produits et votre flux Merchant Center sont la matière de ces comparaisons.',
    blocks: [
      {
        h3: 'Acheter dans l’IA : où en est-on ?',
        paras: [
          'OpenAI a lancé l’achat intégré à ChatGPT aux États-Unis en septembre 2025, puis l’a mis en retrait le 24 mars 2026 au profit de la découverte de produits et des applications de marchands ; les marchands peuvent utiliser leur propre parcours d’achat [27]. En France, Carrefour propose depuis mars 2026 de composer un panier dans ChatGPT, avec paiement sur son site [36].',
          'Google ajoute un bouton « Acheter » dans le Mode IA et Gemini via le protocole UCP, mais sa page d’aide vise pour l’instant les États-Unis, le Canada et l’Australie, sur sélection [29]. Nous n’avons trouvé aucune source confirmant l’ouverture de ces achats intégrés aux marchands français.',
        ],
        note: 'Conclusion pratique pour 2027 : l’achat se fait encore sur votre site. Ce qui compte, c’est d’être bien décrit dans les comparaisons, puis d’avoir un parcours d’achat sans friction.',
      },
      {
        h3: 'Merchant Center : les échéances',
        list: [
          'Depuis le 14 avril 2026 : nouveaux attributs de livraison (heure limite de traitement, montant minimum de commande) et attribut video_link [28].',
          'Depuis le 30 juin 2026 : les vidéos produit peuvent être diffusées [28].',
          '31 janvier 2027 : résolution minimale des images produits portée à 500 × 500 pixels, toutes catégories [28].',
          'Images générées par IA : métadonnée IPTC DigitalSourceType « TrainedAlgorithmicMedia » ; titres et descriptions générés par IA à signaler séparément [5].',
        ],
      },
      {
        h3: 'Fiches produits lisibles par les IA',
        list: [
          'Un titre qui dit ce qu’est le produit, pour qui, avec ses caractéristiques distinctives.',
          'Les caractéristiques en clair, dans le HTML : dimensions, matières, compatibilités, entretien.',
          'Le prix, la disponibilité, les délais et frais de livraison, la politique de retour, visibles et balisés (Product, Offer).',
          'Des avis collectés honnêtement, avec la mention de leur mode de vérification (chapitre 6).',
        ],
      },
      {
        h3: 'Accessibilité : une obligation depuis juin 2025',
        paras: [
          'L’acte européen sur l’accessibilité s’applique depuis le 28 juin 2025 au commerce en ligne. Les entreprises de moins de 10 salariés dont le chiffre d’affaires ou le bilan est inférieur à 2 millions d’euros en sont exemptées ; les sanctions annoncées vont jusqu’à 7 500 € d’amende, avec une astreinte possible [19]. Commencez par le parcours d’achat : clavier, contrastes, libellés, messages d’erreur, textes alternatifs. Ces corrections servent aussi les robots.',
        ],
      },
      { paras: ['Guides utiles : [Fiche produit et IA](/guides/fiche-produit-et-ia), [Google Merchant Center](/guides/google-merchant-center), [Shopify](/guides/seo-shopify), [PrestaShop](/guides/seo-prestashop), [Filtres et pagination](/guides/pagination-filtres-e-commerce), [Accessibilité et SEO](/guides/accessibilite-et-seo).'] },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'agences',
    title: '10. Spécial agences : vendre la visibilité dans les IA sans survendre',
    lead: 'Vos clients vous demandent « d’apparaître dans ChatGPT ». Le métier consiste à transformer cette demande en travail mesurable, sans promesse impossible.',
    blocks: [
      {
        list: [
          'Commencez chaque mission par le diagnostic du chapitre 2, daté et partagé avec le client : c’est la base de comparaison qui protège les deux parties.',
          'Écrivez dans vos propositions ce qui dépend de vous (pages, fiches, données techniques, demandes d’avis) et ce qui n’en dépend pas (choix des IA, mises à jour de Google).',
          'Documentez, client par client, les choix de robots.txt (citation, entraînement) et le réglage « IA générative » de la Search Console, et revérifiez-les après chaque refonte [3][20][21].',
          'Tenez un journal des changements par client, avec les dates des mises à jour de Google [4] : il évite d’attribuer à votre travail une hausse qui vient d’ailleurs, ou l’inverse.',
          'Listez les outils d’IA que vous utilisez pour produire du contenu, faites relire chaque texte et gardez la trace de la relecture [5][7].',
          'Rapportez des fréquences de citation avec leur marge d’erreur, pas des « positions dans ChatGPT ».',
        ],
      },
      {
        h3: 'Questions à poser à un client avant de commencer',
        steps: [
          'Quelles sont les quinze questions que vos clients posent avant d’acheter ?',
          'Quels concurrents voulez-vous dépasser, et sur quels critères vous comparent-ils ?',
          'Acceptez-vous que vos pages servent à entraîner des modèles d’IA, ou seulement à vous faire citer ?',
          'Qui, chez vous, peut relire et valider les textes avant publication ?',
          'Quelles données (Search Console, Bing, mesure d’audience, ventes) pouvez-vous nous ouvrir ?',
        ],
      },
      { note: 'Une promesse de résultat dans une IA n’est pas tenable : aucune agence ne contrôle ces réponses. Vendez une méthode, des livrables et une mesure honnête.' },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'conformite',
    title: '11. Conformité : le minimum à tenir en 2027',
    lead: 'Quatre textes concernent directement la visibilité d’un site professionnel. Ce chapitre informe ; il ne remplace pas un conseil juridique.',
    blocks: [
      {
        table: {
          head: ['Sujet', 'Ce qui s’applique', 'Échéance', 'Source'],
          rows: [
            ['AI Act, article 50', 'Signaler un assistant conversationnel ; signaler hypertrucages et textes d’information générés non relus ; marquage par les fournisseurs', 'En vigueur depuis le 2 août 2026 ; marquage au 2 décembre 2026 pour les systèmes déjà sur le marché', '[7][8]'],
            ['Accessibilité (EAA)', 'Sites marchands accessibles ; exemption des très petites entreprises de services', 'En vigueur depuis le 28 juin 2025', '[19]'],
            ['Cookies et mesure d’audience', 'Consentement, sauf mesure d’audience strictement exemptée ; refus aussi simple qu’acceptation', 'En vigueur ; questions-réponses CNIL du 29 avril 2026', '[16][17]'],
            ['Pixels dans les e-mails', 'Consentement en principe ; exemption étroite pour la délivrabilité', 'Recommandation CNIL du 14 avril 2026', '[18]'],
            ['Avis en ligne', 'Informer sur la vérification ; faux avis interdits', 'En vigueur', '[10][11]'],
            ['DSA', 'Obligations des plateformes ; exemption des petites entreprises', 'En vigueur depuis le 17 février 2024', '[9]'],
          ],
        },
      },
      {
        paras: [
          'Le règlement (UE) 2026/1744 dit « Omnibus numérique sur l’IA », en vigueur depuis le 27 juillet 2026, a surtout décalé les obligations des systèmes à haut risque ; il n’a pas reporté les obligations de transparence de l’article 50 [8][7].',
          'Pour la mesure d’audience, la CNIL rappelle les conditions de l’exemption : finalité limitée à la mesure, pour le seul éditeur, statistiques anonymes, pas de recoupement ni de suivi d’un site à l’autre ; elle recommande des traceurs d’une durée de vie d’environ 13 mois et une conservation des données de 25 mois au plus [16].',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'mesurer',
    title: '12. Mesurer sans se raconter d’histoires',
    lead: 'Une hausse ou une baisse a souvent plusieurs causes. Mesurer honnêtement, c’est séparer ce qui dépend de vous de ce qui n’en dépend pas.',
    blocks: [
      {
        list: [
          'Comparez des périodes de même durée et notez les dates des mises à jour de Google : elles expliquent beaucoup de variations [4].',
          'Suivez une fréquence de citation par assistant, sur les mêmes questions, chaque mois, avec plusieurs répétitions.',
          'Lisez les compteurs de citations (Bing, Search Console) comme des tendances : Microsoft précise qu’un nombre de citations n’indique ni la position ni la présentation dans la réponse [30].',
          'Notez vos propres changements (refonte, bandeau cookies, nouvelles pages) dans un journal daté : sans lui, impossible d’attribuer un effet.',
          'Méfiez-vous des chiffres sans marge d’erreur : une réponse d’IA varie d’une interrogation à l’autre.',
        ],
      },
      {
        h3: 'Les indicateurs utiles',
        table: {
          head: ['Indicateur', 'Où le trouver', 'Fréquence'],
          rows: [
            ['Pages présentes dans les réponses IA de Google', 'Search Console, rapport IA générative', 'Mensuelle'],
            ['Citations dans Copilot et part de citations', 'Bing Webmaster Tools, AI Performance', 'Mensuelle'],
            ['Fréquence de citation par assistant', 'Test manuel du chapitre 2, ou Repéré', 'Mensuelle'],
            ['Visites venant des assistants', 'Votre outil de mesure d’audience', 'Mensuelle'],
            ['Demandes de contact, devis, ventes', 'Votre CRM ou votre caisse', 'Mensuelle'],
          ],
        },
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'plan',
    title: '13. Le plan sur douze mois',
    lead: 'Un trimestre par étape, une heure par semaine suffit pour la plupart des entreprises. Les agences peuvent dérouler ce plan client par client.',
    blocks: [
      {
        h3: 'Premier trimestre : fondations',
        checklist: [
          'Diagnostic du chapitre 2, daté.',
          'Indexation, robots.txt et rendu sans JavaScript vérifiés (chapitre 3).',
          'Fiches Google, Bing et Apple cohérentes avec le site (chapitre 5).',
          'Images produits à 500 × 500 pixels minimum avant le 31 janvier 2027 (e-commerce).',
          'Bandeau cookies et mesure d’audience conformes (chapitre 11).',
        ],
      },
      {
        h3: 'Deuxième trimestre : contenu',
        checklist: [
          'Une page par question importante, réponse en haut, date visible.',
          'Pages produites en série supprimées ou réécrites.',
          'Processus de relecture humaine des textes générés par IA, avec nom et date.',
          'Page « À propos » complète et balisage Organization.',
        ],
      },
      {
        h3: 'Troisième trimestre : réputation et sources',
        checklist: [
          'Demande d’avis systématique, sans filtrage, et réponse à chaque avis.',
          'Mention claire de la manière dont les avis sont collectés et vérifiés.',
          'Présence exacte sur les sites cités en source dans votre diagnostic.',
          'Une action de relations presse ou de partenariat local par trimestre.',
        ],
      },
      {
        h3: 'Quatrième trimestre : mesure et ajustements',
        checklist: [
          'Diagnostic refait avec les mêmes questions, comparé au premier.',
          'Rapports Search Console et Bing relus ; pages citées identifiées.',
          'Journal des changements relu : qu’est-ce qui a vraiment bougé ?',
          'Accessibilité du parcours d’achat contrôlée (e-commerce).',
          'Plan de l’année suivante écrit à partir des écarts constatés.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'inconnu',
    title: '14. Ce que nous ne savons pas',
    lead: 'Un guide honnête dit aussi où s’arrête ce qu’on sait. Voici les questions ouvertes au 23 novembre 2026.',
    blocks: [
      {
        list: [
          'Le poids exact des Aperçus IA et du Mode IA sur le trafic des sites en France : Google ne publie pas de chiffre par pays, et les premières données de la Search Console datent de l’été 2026.',
          'L’arrivée de l’achat intégré (ChatGPT, Mode IA) pour les marchands français : aucune date confirmée dans les sources consultées [27][29].',
          'La disponibilité de Siri AI sur iPhone dans l’Union européenne : Apple ne donne pas de date [33].',
          'L’effet de la mise à jour principale de Google commencée le 10 novembre 2026, toujours en cours à la date d’édition [4].',
          'L’adoption d’un signal standard de refus d’entraînement : Anthropic indique en reconnaître un depuis le 30 octobre 2026, à partir d’un projet de norme encore en discussion [21].',
          'Les modalités françaises de contrôle et de sanction de l’article 50 de l’AI Act.',
        ],
      },
      {
        paras: [
          'Nous mettons à jour ces points dans la [veille](/veille), fiche par fiche, avec la date de chaque vérification. La lettre mensuelle vous les envoie si vous le souhaitez.',
        ],
      },
    ],
  },
  /* ------------------------------------------------------------------ */
  {
    id: 'glossaire',
    title: 'Glossaire',
    lead: 'Les mots de ce guide, en une phrase chacun.',
    blocks: [
      {
        table: {
          head: ['Terme', 'Définition'],
          rows: [
            ['Aperçu IA', 'Réponse générée par Google, affichée au-dessus des résultats, avec des liens vers des sites.'],
            ['Mode IA', 'Recherche conversationnelle de Google, qui lance plusieurs recherches pour une même question.'],
            ['Citation', 'Lien ou mention d’un site donné comme source dans une réponse d’IA.'],
            ['Robot de recherche', 'Programme qui lit les pages pour les faire apparaître dans les réponses (OAI-SearchBot, Claude-SearchBot…).'],
            ['Robot d’entraînement', 'Programme qui collecte des pages pour entraîner des modèles (GPTBot, ClaudeBot…).'],
            ['robots.txt', 'Fichier à la racine du site qui indique aux robots ce qu’ils peuvent lire.'],
            ['llms.txt', 'Fichier proposé pour résumer un site à l’intention des IA ; peu lu à ce jour.'],
            ['Données structurées', 'Balisage invisible qui décrit une page (entreprise, produit, avis) dans un format standard.'],
            ['Entité', 'Votre entreprise telle que les moteurs la reconstituent à partir de toutes les sources.'],
            ['Mise à jour principale', 'Réévaluation générale des résultats par Google, plusieurs fois par an.'],
            ['GEO', 'Optimisation pour les moteurs génératifs : le travail décrit dans ce guide.'],
          ],
        },
      },
      { paras: ['Le [glossaire complet](/glossaire) est en ligne.'] },
    ],
  },
];

/** Nombre de mots du guide (hors sources), pour le contrôle de longueur et le JSON-LD. */
export function guide2027WordCount(): number {
  const parts: string[] = [GUIDE_2027.title, GUIDE_2027.subtitle];
  for (const c of GUIDE_2027_CHAPTERS) {
    parts.push(c.title, c.lead);
    for (const b of c.blocks) {
      parts.push(b.h3 ?? '', ...(b.paras ?? []), ...(b.list ?? []), ...(b.steps ?? []), ...(b.checklist ?? []), b.note ?? '');
      if (b.table) parts.push(...b.table.head, ...b.table.rows.flat(), b.table.caption ?? '');
    }
  }
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}

/** Tous les renvois [n] utilisés dans le texte. */
export function guide2027Refs(): number[] {
  const text = JSON.stringify(GUIDE_2027_CHAPTERS);
  return [...new Set([...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
}

/** Tous les liens internes [texte](/chemin) utilisés dans le texte. */
export function guide2027Links(): string[] {
  const text = JSON.stringify(GUIDE_2027_CHAPTERS);
  return [...new Set([...text.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1]))];
}
