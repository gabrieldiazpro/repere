/**
 * Outils gratuits V7 (OUTILS-2, 20 → 31) : contenu éditorial des pages. Choix et doublons écartés :
 * docs/v7/progress/OUTILS-2.md. Aucun chiffre de trafic, aucune promesse de position ni de citation.
 */
import type { ToolDef, ToolSource } from '../registry';

export const V7_SLUGS = [
  'resultats-enrichis',
  'structure-titres',
  'textes-alternatifs',
  'poids-page',
  'compatibilite-mobile',
  'https-contenu-mixte',
  'contenu-duplique',
  'fraicheur-page',
  'coherence-nap',
  'generateur-utm',
  'fiche-faits-cles',
] as const;
export type V7Slug = (typeof V7_SLUGS)[number];

const G = (label: string, url: string, note?: string): ToolSource => ({ label, url, ...(note ? { note } : {}) });
const SRC_GALLERY = G('Google Search Central, galerie des résultats enrichis', 'https://developers.google.com/search/docs/appearance/structured-data/search-gallery', 'Liste des types que Google affiche, et ceux qu’il a retirés.');
const SRC_SD_POLICIES = G('Google Search Central, règles générales des données structurées', 'https://developers.google.com/search/docs/appearance/structured-data/sd-policies');
const SRC_RRT = G('Google, test des résultats enrichis', 'https://search.google.com/test/rich-results', 'L’outil officiel, qui exécute le JavaScript : à recouper.');
const SRC_WAI_HEADINGS = G('W3C WAI, tutoriel « Headings » (structure des titres)', 'https://www.w3.org/WAI/tutorials/page-structure/headings/');
const SRC_STARTER = G('Google Search Central, guide de démarrage SEO', 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide');
const SRC_IMAGES = G('Google Search Central, bonnes pratiques pour les images', 'https://developers.google.com/search/docs/appearance/google-images');
const SRC_ALT_TREE = G('W3C WAI, arbre de décision pour le texte alternatif', 'https://www.w3.org/WAI/tutorials/images/decision-tree/');
const SRC_FORMATS = G('web.dev, « Choose the right image format »', 'https://web.dev/articles/choose-the-right-image-format');
const SRC_ALMANAC = G('HTTP Archive, Web Almanac, chapitre « Page Weight »', 'https://almanac.httparchive.org/en/2024/page-weight', 'Mesures publiques du poids des pages sur des millions de sites.');
const SRC_MOBILE_FIRST = G('Google Search Central, bonnes pratiques de l’indexation mobile', 'https://developers.google.com/search/docs/crawling-indexing/mobile/mobile-sites-mobile-first-indexing');
const SRC_VIEWPORT = G('MDN, balise meta viewport', 'https://developer.mozilla.org/en-US/docs/Web/HTML/Viewport_meta_tag');
const SRC_TARGET = G('W3C, WCAG 2.2, critère 2.5.8 « Taille de la cible »', 'https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html');
const SRC_MIXED = G('MDN, contenu mixte', 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content');
const SRC_HSTS = G('MDN, en-tête Strict-Transport-Security', 'https://developer.mozilla.org/fr/docs/Web/HTTP/Headers/Strict-Transport-Security');
const SRC_LE = G('Let’s Encrypt, certificats HTTPS gratuits', 'https://letsencrypt.org/fr/');
const SRC_CANONICAL = G('Google Search Central, « Regrouper les URL en double » (canonical)', 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls');
const SRC_SPAM = G('Google Search Central, règles contre le spam (contenu copié)', 'https://developers.google.com/search/docs/essentials/spam-policies');
const SRC_DATES = G('Google Search Central, dates de publication dans les résultats', 'https://developers.google.com/search/docs/appearance/publication-dates');
const SRC_HELPFUL = G('Google Search Central, « Créer du contenu utile et fiable »', 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', 'Déconseille de changer une date sans changement réel du contenu.');
const SRC_GBP_GUIDE = G('Google, règles de représentation des établissements sur Google', 'https://support.google.com/business/answer/3038177');
const SRC_LOCAL_RANK = G('Google, améliorer son classement local', 'https://support.google.com/business/answer/7091');
const SRC_CHANNELS = G('Google Analytics, regroupement de canaux par défaut (GA4)', 'https://support.google.com/analytics/answer/9756891', 'Les règles qui rangent une visite selon sa source et son support.');
const SRC_UTM = G('Google Analytics, données de campagne et paramètres UTM', 'https://support.google.com/analytics/answer/10917952');
const SRC_LLMS = G('llmstxt.org, proposition de format llms.txt', 'https://llmstxt.org/', 'Proposition communautaire, pas une norme adoptée par les moteurs.');
const SRC_L121 = G('Code de la consommation, article L121-4 (pratiques commerciales trompeuses)', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032227301');

const ANALYSE = { label: 'Analyse complète SEO et IA de votre site (gratuite)', href: '/analyse' };
const g = (slug: string, label: string) => ({ label: `Guide : ${label}`, href: `/guides/${slug}` });

export const V7_UPDATED = '2026-11-15';

export const V7_TOOLS: (ToolDef & { slug: V7Slug })[] = [
  {
    slug: 'resultats-enrichis',
    updated: V7_UPDATED,
    name: 'Résultats enrichis Google',
    h1: 'Vos données structurées ouvrent-elles droit aux résultats enrichis de Google ?',
    lead: 'Nous lisons le JSON-LD d’une page (ou celui que vous collez) et le comparons, type par type, aux propriétés que Google exige : éligible, incomplet, mal formé ou plus affiché du tout.',
    metaTitle: 'Tester ses résultats enrichis Google (JSON-LD), gratuit',
    description: 'Vérifiez gratuitement si le JSON-LD d’une page remplit les exigences de Google : propriétés obligatoires, formats, types retirés (FAQ, HowTo). Résultat par type, sans inscription.',
    output: 'Tableau par type : éligible, incomplet, mal formé ou retiré, avec les propriétés manquantes',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un balisage complet réduit l’ambiguïté. L’analyse complète le vérifie sur toutes vos pages et regarde ce que les IA comprennent de vous.',
    howItWorks: [
      'Saisissez l’adresse d’une page : nous lisons ses blocs JSON-LD dans le HTML envoyé par le serveur, sans exécuter de JavaScript. Ou collez directement votre code.',
      'Chaque type (LocalBusiness, Product, Offer, Article, Event, BreadcrumbList…) est comparé aux propriétés obligatoires et recommandées de la documentation de Google, datée de novembre 2026.',
      'Vous voyez, type par type, ce qui manque, ce qui est mal formé (date, prix, devise) et les types que Google n’affiche plus.',
    ],
    reading: [
      '« Éligible » veut dire que les propriétés obligatoires sont là : Google peut afficher un résultat enrichi, sans obligation de le faire.',
      '« Retiré » : Google n’affiche plus ce type (FAQ depuis le 7 mai 2026, HowTo depuis 2023…). Le balisage ne nuit pas et reste lisible par les IA.',
    ],
    limits: [
      'Le JSON-LD injecté par JavaScript (certaines extensions, Google Tag Manager) n’est pas lu ici ; le test officiel de Google, qui exécute le script, le verra.',
      'Nous vérifions la présence et le format des propriétés, pas leur exactitude ni leur concordance avec le texte visible.',
      'Les règles suivent la documentation de Google, qui change : elles sont datées et revues chaque trimestre.',
    ],
    faq: [
      { q: 'Qu’est-ce qu’un résultat enrichi ?', a: 'Un affichage dans Google plus riche qu’un simple lien bleu : prix et disponibilité d’un produit, étoiles d’avis, fil d’Ariane, dates d’un événement. Google les construit à partir des données structurées de la page.' },
      { q: 'Mon balisage est valide mais rien ne s’affiche : pourquoi ?', a: 'Google ne garantit jamais l’affichage : il dépend de la requête, de la qualité de la page et du type. Un balisage complet rend l’affichage possible, pas automatique.' },
      { q: 'Faut-il retirer mon balisage FAQ ?', a: 'Non. Google n’affiche plus les FAQ en résultat enrichi depuis mai 2026, mais le bloc reste inoffensif et décrit clairement vos questions-réponses aux robots, dont ceux des IA.' },
      { q: 'Quelle différence avec le validateur JSON-LD de Repéré ?', a: 'Le générateur et validateur JSON-LD vérifie qu’un bloc décrit correctement votre entreprise. Cet outil-ci compare chaque type aux exigences d’affichage de Google et signale les types retirés.' },
      { q: 'Puis-je tester un code avant de le publier ?', a: 'Oui : choisissez « Coller du code ». Le calcul se fait dans votre navigateur, rien n’est envoyé.' },
    ],
    sources: [SRC_GALLERY, SRC_SD_POLICIES, SRC_RRT],
    related: [g('donnees-structurees-utiles', 'les données structurées qui servent encore'), g('seo-local-et-ia', 'SEO local et IA'), { label: 'Outil : générateur JSON-LD', href: '/outils/json-ld' }, ANALYSE],
  },
  {
    slug: 'structure-titres',
    updated: V7_UPDATED,
    name: 'Structure des titres H1 à H6',
    h1: 'Le plan de votre page, H1 à H6, tel que le lisent Google et les IA',
    lead: 'Nous dessinons le sommaire de la page à partir de ses balises de titre et repérons ce qui le brouille : H1 absent ou multiple, niveaux sautés, titres vides, répétés ou trop longs.',
    metaTitle: 'Analyser la structure des titres H1 à H6 d’une page',
    description: 'Visualisez gratuitement le plan H1 à H6 d’une page : H1 absent ou en double, niveaux sautés, titres vides ou répétés, intertitres en question. Sans inscription.',
    output: 'Sommaire indenté H1–H6, niveaux sautés surlignés, contrôles avec correctifs',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un plan clair aide à être cité. L’analyse complète vérifie toutes vos pages et repère les passages que les IA peuvent reprendre.',
    howItWorks: [
      'Nous lisons le HTML de la page tel que le serveur l’envoie et relevons chaque balise H1 à H6, dans l’ordre.',
      'Nous reconstruisons le sommaire et contrôlons les règles d’accessibilité et de lisibilité : un H1, des niveaux qui descendent un par un, des titres courts et distincts.',
      'Nous signalons les intertitres formulés en question, ceux qui correspondent le plus directement aux demandes faites aux IA.',
    ],
    reading: [
      'Le sommaire doit se lire comme une table des matières : si vous ne comprenez pas la page en le lisant, un robot non plus.',
      'Un saut de niveau (H2 puis H4) n’empêche pas l’indexation ; il brouille la structure pour les lecteurs d’écran et le découpage en sections.',
    ],
    limits: [
      'Les titres ajoutés par JavaScript ne sont pas vus : c’est aussi le cas de la plupart des robots d’IA.',
      'Un texte mis en gras ou en gros caractères sans balise de titre n’est pas un titre pour les robots.',
    ],
    faq: [
      { q: 'Peut-on avoir plusieurs H1 ?', a: 'Le HTML le permet et Google dit s’en accommoder. Un seul H1, qui annonce le sujet de la page, reste plus clair pour les lecteurs et les outils d’accessibilité.' },
      { q: 'Les balises de titre comptent-elles pour le référencement ?', a: 'Elles aident Google à comprendre de quoi parle chaque section, et Google s’en sert parfois pour réécrire le titre affiché. Ce n’est pas une formule magique : le contenu sous le titre compte davantage.' },
      { q: 'Pourquoi formuler des intertitres en question ?', a: 'Parce que vos clients posent des questions (« Combien coûte un débouchage ? »). Un intertitre identique suivi d’une réponse directe est facile à retrouver et à citer.' },
      { q: 'Mon thème met le logo en H1 : est-ce grave ?', a: 'Ce n’est pas bloquant, mais le vrai sujet de la page passe alors en second. Passez le logo en simple balise et gardez le H1 pour le titre de la page.' },
    ],
    sources: [SRC_WAI_HEADINGS, SRC_STARTER],
    related: [g('page-que-les-ia-citent', 'écrire une page que les IA citent'), g('titres-meta-descriptions', 'titres et méta-descriptions'), g('audit-seo-30-minutes', 'audit SEO en 30 minutes'), ANALYSE],
  },
  {
    slug: 'textes-alternatifs',
    updated: V7_UPDATED,
    name: 'Images et textes alternatifs',
    h1: 'Vos images sont-elles décrites, et s’affichent-elles toutes ?',
    lead: 'Nous listons les images de la page avec leur texte alternatif (alt) : absent, vide, nom de fichier, trop générique. Et nous vérifions qu’elles répondent, sans image cassée.',
    metaTitle: 'Vérifier les textes alternatifs (alt) des images',
    description: 'Vérifiez gratuitement les images d’une page : attribut alt absent, vide ou inutile, liens-images sans nom, images cassées. Correctifs pour Google, les IA et l’accessibilité.',
    output: 'Liste des images avec leur alt, images cassées, correctifs',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Des images décrites se comprennent. L’analyse complète fait le tour de toutes vos pages et des textes que les IA y lisent.',
    howItWorks: [
      'Nous lisons le HTML de la page et relevons chaque image, son attribut alt et le fait qu’elle serve de lien.',
      'Nous classons chaque texte alternatif : absent, vide (image décorative), nom de fichier, mot générique, trop long, répété.',
      'Nous interrogeons jusqu’à 20 images (celles du site d’abord) pour repérer celles qui ne s’affichent plus.',
    ],
    reading: [
      'Un alt absent est un oubli ; un alt vide (alt="") est un choix, correct pour une image purement décorative.',
      'Un bon texte alternatif dit ce que montre l’image dans le contexte de la page : « Salle de bains refaite à Villeurbanne », pas « IMG_2034.jpg ».',
    ],
    limits: [
      'Les images de fond (CSS) et celles chargées par JavaScript ne sont pas vues.',
      'Nous ne regardons pas les images : nous ne pouvons pas dire si l’alt les décrit fidèlement.',
    ],
    faq: [
      { q: 'À quoi sert l’attribut alt ?', a: 'À remplacer l’image pour ceux qui ne la voient pas : lecteurs d’écran, image qui ne charge pas, robots. Google s’en sert pour comprendre l’image et la page.' },
      { q: 'Faut-il un alt sur toutes les images ?', a: 'Il faut l’attribut sur toutes. Pour une image décorative (motif, séparateur, icône à côté d’un texte), laissez-le vide : alt="".' },
      { q: 'Faut-il mettre des mots-clés dans l’alt ?', a: 'Décrivez l’image, simplement. Si elle montre votre prestation dans votre ville, les mots utiles y seront naturellement. Une liste de mots-clés est du bourrage.' },
      { q: 'Où modifier l’alt sur mon site ?', a: 'Sur WordPress, dans la médiathèque (champ « Texte alternatif ») ; sur Shopify, en cliquant sur l’image du produit ; sur Wix, dans les paramètres de l’image.' },
    ],
    sources: [SRC_IMAGES, SRC_ALT_TREE],
    related: [g('seo-images', 'images et SEO'), g('audit-seo-30-minutes', 'audit SEO en 30 minutes'), { label: 'Outil : poids de la page et des images', href: '/outils/poids-page' }, ANALYSE],
  },
  {
    slug: 'poids-page',
    updated: V7_UPDATED,
    name: 'Poids de la page',
    h1: 'Combien pèse votre page, et quels fichiers l’alourdissent ?',
    lead: 'Nous mesurons le HTML et les fichiers qu’il appelle (images, scripts, styles, polices) d’après la taille annoncée par les serveurs, et listons les plus lourds avec le correctif.',
    metaTitle: 'Poids d’une page web : images et scripts trop lourds',
    description: 'Mesurez gratuitement le poids d’une page : HTML, images, scripts, styles et polices, compression, formats d’image. Les fichiers les plus lourds et quoi en faire, sans inscription.',
    output: 'Poids total mesuré, répartition par type, fichiers les plus lourds',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Une page légère se charge vite et se lit en entier. L’analyse complète regarde toutes vos pages et ce que les robots d’IA en récupèrent.',
    howItWorks: [
      'Nous récupérons le HTML de la page et relevons les fichiers qu’il appelle : images, scripts, feuilles de style, polices préchargées.',
      'Nous demandons à chaque serveur la taille annoncée de 30 fichiers au plus, ceux du site d’abord, sans les télécharger en entier.',
      'Nous additionnons, classons par type et signalons les images trop lourdes, les formats anciens et l’absence de compression.',
    ],
    reading: [
      'Le total est un minimum : les fichiers chargés plus tard par JavaScript, et ceux dont le serveur ne donne pas la taille, ne sont pas comptés.',
      'Les images sont presque toujours la première source de poids : commencez par les plus lourdes.',
    ],
    limits: [
      'Ce n’est pas une mesure de vitesse : le temps d’affichage dépend aussi du serveur, du réseau et de l’ordre de chargement. Pour la vitesse vécue par vos visiteurs, voyez les Core Web Vitals dans la Search Console.',
      'Les seuils (300 Ko par image, 3 Mo par page) sont des repères de bon sens, pas des règles de Google.',
    ],
    faq: [
      { q: 'Quel poids pour une page web ?', a: 'Il n’y a pas de limite officielle. Une page vitrine bien faite tient souvent sous 2 Mo ; au-delà de 3 Mo, le chargement se ressent sur un téléphone en 4G moyenne.' },
      { q: 'Le poids de la page compte-t-il pour Google ?', a: 'Indirectement : une page lourde est plus lente, et Google tient compte de l’expérience de chargement mesurée chez vos visiteurs (Core Web Vitals). Elle coûte aussi plus de temps d’exploration.' },
      { q: 'WebP ou AVIF ?', a: 'Les deux sont plus légers que JPEG et PNG à qualité égale. WebP est lu partout et se produit facilement ; AVIF est souvent encore plus léger, mais plus lent à générer.' },
      { q: 'Comment alléger un site WordPress ?', a: 'Une extension d’optimisation d’images (compression et conversion en WebP), la suppression des extensions inutilisées et l’activation de la compression chez l’hébergeur règlent l’essentiel.' },
    ],
    sources: [SRC_FORMATS, SRC_ALMANAC, SRC_IMAGES],
    related: [g('core-web-vitals-sans-jargon', 'Core Web Vitals sans jargon'), g('seo-images', 'images et SEO'), { label: 'Outil : compatibilité mobile', href: '/outils/compatibilite-mobile' }, ANALYSE],
  },
  {
    slug: 'compatibilite-mobile',
    updated: V7_UPDATED,
    name: 'Compatibilité mobile',
    h1: 'Votre page est-elle prévue pour un téléphone ?',
    lead: 'Google explore votre site comme un téléphone. Nous vérifions dans le HTML ce qui gêne sur un petit écran : balise viewport, zoom bloqué, éléments trop larges, petits caractères, liens collés, numéro non cliquable.',
    metaTitle: 'Test de compatibilité mobile gratuit d’une page',
    description: 'Testez gratuitement si une page est adaptée aux téléphones : balise viewport, zoom, éléments trop larges, petits textes, liens trop proches, numéro cliquable. Sans inscription.',
    output: 'Contrôles mobile (viewport, largeurs, textes, liens, téléphone) avec correctifs',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Sur mobile, chaque gêne coûte un appel. L’analyse complète passe toutes vos pages en revue, pour Google et pour les IA.',
    howItWorks: [
      'Nous lisons le HTML de la page tel que le serveur l’envoie, comme le robot mobile de Google le reçoit.',
      'Nous vérifions la balise viewport, puis repérons dans le HTML les largeurs fixes, les très petites polices, les liens collés et les champs de formulaire mal typés.',
      'Nous regardons si votre numéro de téléphone est cliquable : sur mobile, c’est souvent le bouton le plus utile de la page.',
    ],
    reading: [
      'La balise viewport est la condition de base : sans elle, aucune feuille de style ne rend la page lisible sur téléphone.',
      'Les autres contrôles sont des approximations faites sur le HTML : ils signalent des risques à vérifier sur votre propre téléphone.',
    ],
    limits: [
      'Nous n’affichons pas la page dans un navigateur : la mise en page réelle dépend de vos feuilles de style, que nous ne calculons pas.',
      'Google a retiré son propre test d’optimisation mobile fin 2023 ; le rapport Core Web Vitals de la Search Console reste la mesure réelle sur vos visiteurs.',
    ],
    faq: [
      { q: 'Qu’est-ce que l’indexation mobile d’abord ?', a: 'Google explore et indexe votre site avec un robot qui se présente comme un téléphone. Ce qui manque ou casse sur la version mobile manque aussi pour Google.' },
      { q: 'Que mettre dans la balise viewport ?', a: '<meta name="viewport" content="width=device-width, initial-scale=1">, dans le <head>. N’ajoutez pas user-scalable=no : il empêche les visiteurs d’agrandir le texte.' },
      { q: 'Quelle taille pour les boutons sur mobile ?', a: 'Les règles d’accessibilité (WCAG 2.2) demandent au moins 24 × 24 pixels et un espace suffisant entre deux cibles ; 44 pixels de haut restent un bon repère pour un doigt.' },
      { q: 'Mon site est responsive : ai-je besoin de ce test ?', a: 'Un thème adaptatif règle la plupart des cas. Les problèmes viennent souvent de contenus ajoutés à la main : tableau de prix, carte intégrée, image à largeur fixe.' },
    ],
    sources: [SRC_MOBILE_FIRST, SRC_VIEWPORT, SRC_TARGET],
    related: [g('core-web-vitals-sans-jargon', 'Core Web Vitals sans jargon'), g('audit-seo-30-minutes', 'audit SEO en 30 minutes'), g('search-console-debutants', 'la Search Console pour débutants'), ANALYSE],
  },
  {
    slug: 'https-contenu-mixte',
    updated: V7_UPDATED,
    name: 'HTTPS et contenu mixte',
    h1: 'Votre page est-elle entièrement en HTTPS, sans contenu mixte ?',
    lead: 'Nous vérifions que la page est servie en HTTPS, que la version http y redirige, que l’en-tête HSTS est en place, et qu’aucun script, style ou image n’est encore appelé en http.',
    metaTitle: 'Vérifier HTTPS et contenu mixte d’une page, gratuit',
    description: 'Vérifiez gratuitement la sécurité HTTPS d’une page : redirection http vers https, HSTS, contenu mixte (scripts, styles, images en http), liens internes en http. Sans inscription.',
    output: 'HTTPS, redirection http, HSTS, liste des ressources en http',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un site sûr inspire confiance. L’analyse complète vérifie toutes vos pages et ce que Google et les IA peuvent en lire.',
    howItWorks: [
      'Nous récupérons la page en https, lisons l’en-tête Strict-Transport-Security, puis interrogeons sa version http pour voir si elle redirige.',
      'Nous relevons dans le HTML toutes les ressources appelées en http:// : scripts, feuilles de style, cadres, formulaires, images, vidéos.',
      'Nous distinguons le contenu actif, bloqué par les navigateurs, du contenu passif, qu’ils tentent de charger en https.',
    ],
    reading: [
      'Contenu actif en http (script, style, cadre, formulaire) : une partie de la page ne fonctionne pas, à corriger d’abord.',
      'Contenu passif (image, vidéo) : le navigateur tente la version https et l’affiche si elle existe ; corrigez quand même l’adresse.',
    ],
    limits: [
      'Nous ne détaillons pas le certificat : s’il est invalide ou expiré, la page est simplement injoignable et l’outil vous le dit.',
      'Les ressources ajoutées par JavaScript ou par une feuille de style externe ne sont pas lues.',
    ],
    faq: [
      { q: 'Qu’est-ce que le contenu mixte ?', a: 'Une page sécurisée (https) qui appelle des fichiers par une adresse non sécurisée (http). Le navigateur bloque les scripts et les styles concernés, et peut afficher un avertissement.' },
      { q: 'HTTPS compte-t-il pour Google ?', a: 'Oui, comme un léger signal de classement depuis 2014, et surtout pour la confiance : Chrome marque « Non sécurisé » les pages en http.' },
      { q: 'Qu’est-ce que HSTS ?', a: 'Un en-tête qui demande au navigateur de n’utiliser que https pour votre site pendant une durée donnée. Il évite un passage par http à chaque visite. Ajoutez-le une fois tout le site en https.' },
      { q: 'Comment corriger le contenu mixte sur WordPress ?', a: 'Mettez l’adresse du site en https dans Réglages › Général, puis remplacez dans la base les adresses « http://votre-site » par « https://votre-site » (extension de recherche-remplacement).' },
    ],
    sources: [SRC_MIXED, SRC_HSTS, SRC_LE],
    related: [g('refonte-site-sans-perdre-seo', 'refonte de site sans perdre son référencement'), g('audit-seo-30-minutes', 'audit SEO en 30 minutes'), { label: 'Outil : vérificateur de redirections', href: '/outils/redirections' }, ANALYSE],
  },
  {
    slug: 'contenu-duplique',
    updated: V7_UPDATED,
    name: 'Contenu dupliqué entre deux pages',
    h1: 'Ces deux pages disent-elles la même chose ?',
    lead: 'Deux adresses, un pourcentage de texte commun, les phrases reprises mot pour mot et les balises en double. Pour vos pages « ville », vos fiches produit déclinées, ou un site qui vous a copié.',
    metaTitle: 'Détecter le contenu dupliqué entre deux pages',
    description: 'Comparez gratuitement deux pages : part de texte commune, phrases identiques, title, description et H1 en double, canonical. Pages ville, fiches déclinées ou copie, sans inscription.',
    output: 'Pourcentage de texte commun, phrases reprises, balises en double',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Deux pages qui se copient se font concurrence. L’analyse complète repère les doublons sur tout votre site.',
    howItWorks: [
      'Nous lisons les deux pages et en extrayons le texte principal, sans le menu ni le pied de page quand la page les balise.',
      'Nous découpons chaque texte en suites de cinq mots et calculons la part commune (indice de Jaccard), puis relevons les phrases identiques.',
      'Nous comparons aussi le title, la meta description, le H1 et la balise canonical des deux pages.',
    ],
    reading: [
      'À partir de 85 % de texte commun, Google traite en général les deux pages comme des doublons et n’en montre qu’une. Entre 50 et 85 %, elles se ressemblent beaucoup.',
      'Une balise canonical qui désigne l’autre page signale que vous avez déjà choisi la version de référence.',
    ],
    limits: [
      'Deux pages seulement : pour tout le site, l’analyse complète compare les empreintes de texte de chaque page.',
      'Si la page ne balise pas son contenu principal, le menu et le pied de page entrent dans la comparaison et gonflent le pourcentage.',
    ],
    faq: [
      { q: 'Le contenu dupliqué est-il pénalisé par Google ?', a: 'Pas en soi : Google regroupe les doublons et choisit une version à afficher. Le problème est qu’il peut choisir la mauvaise, et que vos deux pages se partagent les signaux. Le contenu copié pour tromper relève, lui, des règles contre le spam.' },
      { q: 'Comment faire des pages par ville sans doublon ?', a: 'Gardez un gabarit commun, mais donnez à chaque page des éléments propres : interventions réelles dans la ville, délais, quartiers, prix locaux, questions des clients de cette zone.' },
      { q: 'Un autre site a copié mon texte : que faire ?', a: 'Demandez-lui de citer la source ou de retirer le texte. En cas de refus, Google propose une procédure de signalement pour atteinte au droit d’auteur.' },
      { q: 'Les IA citent-elles les pages dupliquées ?', a: 'Elles retiennent en général une seule version d’un même texte, souvent celle du site le plus connu. Un texte propre, avec vos faits, est plus sûr d’être attribué à vous.' },
    ],
    sources: [SRC_CANONICAL, SRC_SPAM],
    related: [g('pages-ville-sans-doublon', 'pages par ville sans contenu dupliqué'), g('fiche-produit-et-ia', 'fiche produit et IA'), g('contenu-ecrit-avec-ia', 'contenu écrit avec l’IA'), ANALYSE],
  },
  {
    slug: 'fraicheur-page',
    updated: V7_UPDATED,
    name: 'Date et fraîcheur d’une page',
    h1: 'Votre page dit-elle clairement quand elle a été mise à jour ?',
    lead: 'Nous relevons toutes les dates de la page : visibles dans le texte, déclarées dans le JSON-LD, dans les balises et dans l’en-tête du serveur. Et nous vérifions qu’elles concordent.',
    metaTitle: 'Date de mise à jour d’une page : visible et cohérente ?',
    description: 'Vérifiez gratuitement les dates d’une page : date visible, dateModified du JSON-LD, balises, en-tête Last-Modified, pied de page figé, tarifs d’une année passée. Sans inscription.',
    output: 'Toutes les dates relevées, la plus récente, incohérences et correctifs',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Une information datée se cite avec confiance. L’analyse complète vérifie la fraîcheur de toutes vos pages.',
    howItWorks: [
      'Nous lisons le HTML de la page et y cherchons les dates : texte visible, blocs JSON-LD (datePublished, dateModified), balises article:modified_time et <time>.',
      'Nous ajoutons l’en-tête HTTP Last-Modified et repérons les signes de page figée : « © 2021 » en pied de page, « tarifs 2024 » dans le texte.',
      'Nous comparons ces dates entre elles et à aujourd’hui : date future, dates qui se contredisent, page sans date.',
    ],
    reading: [
      'La date qui compte pour un lecteur est celle qu’il voit. Celle du JSON-LD doit dire la même chose.',
      'Une page ancienne n’est pas un problème si l’information est toujours juste. Ne changez la date que quand vous changez le contenu.',
    ],
    limits: [
      'Nous ne savons pas si le contenu a réellement changé : nous lisons seulement les dates déclarées.',
      'Les dates écrites en toutes lettres sans année (« lundi dernier ») ne sont pas reconnues.',
    ],
    faq: [
      { q: 'La date de mise à jour compte-t-elle pour Google ?', a: 'Google l’utilise pour afficher une date dans les résultats et, pour certaines recherches, privilégie des informations récentes. Il déconseille expressément de changer une date sans changer le contenu.' },
      { q: 'Les IA tiennent-elles compte de la date ?', a: 'Les assistants avec recherche web reprennent souvent la date d’une page pour situer une information (« selon une page mise à jour en mars 2026 »). Une page sans date laisse un doute sur l’actualité de vos prix et horaires.' },
      { q: 'Où afficher la date ?', a: 'Près du titre, sous la forme « Mis à jour le 15 novembre 2026 ». Sur une page de service ou de tarifs, en bas de la grille suffit.' },
      { q: 'L’en-tête Last-Modified suffit-il ?', a: 'Non : beaucoup de sites le fixent à l’heure de la visite, ce qui ne dit rien. Seules une date visible et un dateModified honnête renseignent vraiment.' },
    ],
    sources: [SRC_DATES, SRC_HELPFUL],
    related: [g('page-que-les-ia-citent', 'écrire une page que les IA citent'), g('apercus-ia-google', 'aperçus IA de Google'), g('contenu-ecrit-avec-ia', 'contenu écrit avec l’IA'), ANALYSE],
  },
  {
    slug: 'coherence-nap',
    updated: V7_UPDATED,
    name: 'Cohérence nom, adresse, téléphone',
    h1: 'Votre nom, votre adresse et votre téléphone sont-ils les mêmes partout ?',
    lead: 'Saisissez vos coordonnées de référence, puis celles affichées sur vos fiches (Google, Pages Jaunes, Facebook, annuaires) : nous comparons champ par champ et signalons chaque écart.',
    metaTitle: 'Vérifier la cohérence NAP de ses fiches, gratuit',
    description: 'Comparez gratuitement vos nom, adresse et téléphone entre votre site, votre fiche Google et vos annuaires : écarts, variantes d’écriture, champs absents. Calcul dans le navigateur.',
    output: 'Tableau fiche par fiche (identique, variante, différent, absent), écarts à corriger',
    parcours: ['local'],
    bridge: 'Des coordonnées qui concordent rassurent Google et les IA. L’audit montre ce qu’elles répondent quand on leur demande votre numéro.',
    howItWorks: [
      'Saisissez vos coordonnées de référence, celles que vous voulez voir partout (en général, celles de votre site).',
      'Ajoutez jusqu’à huit fiches : copiez le nom, l’adresse et le téléphone tels qu’ils y sont affichés.',
      'Nous normalisons l’écriture (accents, abréviations « bd » ou « av », formes juridiques, +33) et comparons champ par champ, dans votre navigateur.',
    ],
    reading: [
      '« Variante » : la même information écrite autrement (« Bd » au lieu de « Boulevard », « SARL » en plus). Ce n’est pas une erreur, mais une écriture unique est plus sûre.',
      '« Différent » : un autre numéro, un autre code postal, un autre nom. À corriger en premier : c’est ce qui envoie un client, ou une IA, au mauvais endroit.',
    ],
    limits: [
      'Nous ne récupérons pas vos fiches : sans fournisseur payant, nous ne pouvons pas lire Google Maps ou les annuaires à votre place. Vous copiez, nous comparons.',
      'La comparaison est faite pour les adresses et numéros français.',
    ],
    faq: [
      { q: 'Que veut dire NAP ?', a: 'Name, Address, Phone : le nom, l’adresse et le téléphone de l’entreprise. Leur cohérence d’une source à l’autre est un des signaux de confiance du référencement local.' },
      { q: 'Pourquoi la cohérence compte-t-elle pour les IA ?', a: 'Les assistants recoupent plusieurs sources pour répondre « où » et « comment joindre ». Deux numéros différents les poussent à hésiter, à en choisir un au hasard, ou à ne pas vous recommander.' },
      { q: 'Quelles fiches vérifier en priorité ?', a: 'Votre fiche Google, votre site, puis Bing Places, Apple Plans, Pages Jaunes, Facebook et les annuaires de votre métier.' },
      { q: 'J’ai déménagé : que faire ?', a: 'Mettez d’abord à jour votre site et votre fiche Google, puis chaque annuaire. Gardez la liste de vos fiches : c’est elle que vous comparerez ici.' },
    ],
    sources: [SRC_GBP_GUIDE, SRC_LOCAL_RANK],
    related: [g('fiche-google-business-profile', 'remplir sa fiche Google à 100 %'), g('annuaires-locaux-bing-apple', 'Bing Places, Apple et annuaires'), g('seo-local-et-ia', 'SEO local et IA'), ANALYSE],
  },
  {
    slug: 'generateur-utm',
    updated: V7_UPDATED,
    name: 'Générateur de liens UTM',
    h1: 'Des liens de suivi UTM pour savoir d’où viennent vos visiteurs',
    lead: 'Un lien pour votre fiche Google, votre lettre d’information ou un QR code imprimé : nous ajoutons les paramètres UTM sans faute de frappe, et vous disons dans quel canal GA4 la visite sera rangée.',
    metaTitle: 'Générateur de liens UTM gratuit (fiche Google, QR)',
    description: 'Créez gratuitement des liens UTM propres pour votre fiche Google, vos e-mails, réseaux sociaux ou QR codes : minuscules, espaces, canal GA4 estimé et QR code. Sans inscription.',
    output: 'Lien UTM prêt à coller, canal GA4 estimé, QR code SVG',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Mesurer d’où viennent les visites, c’est la moitié du travail. L’analyse complète regarde ce que Google et les IA lisent de vos pages.',
    howItWorks: [
      'Choisissez un modèle (fiche Google, lettre d’information, réseau social, QR code) ou remplissez la source, le support et la campagne.',
      'Nous construisons le lien en minuscules, sans espace, en gardant les autres paramètres de votre adresse.',
      'Nous estimons le canal dans lequel Google Analytics 4 rangera la visite, d’après les règles qu’il publie, et produisons un QR code du lien.',
    ],
    reading: [
      'Les paramètres UTM ne changent rien au référencement : ils servent seulement à vos statistiques.',
      'GA4 distingue les majuscules : « Google » et « google » font deux sources. D’où les minuscules imposées.',
    ],
    limits: [
      'Le canal GA4 est une estimation : il dépend aussi des réglages de votre propriété (groupes de canaux personnalisés).',
      'N’ajoutez jamais de paramètres UTM sur vos liens internes : ils écrasent la vraie source de la visite.',
    ],
    faq: [
      { q: 'Qu’est-ce qu’un lien UTM ?', a: 'Une adresse avec des paramètres (utm_source, utm_medium, utm_campaign) qui disent à votre outil de statistiques d’où vient le visiteur. Le visiteur arrive sur la même page.' },
      { q: 'Quel lien UTM pour une fiche Google ?', a: 'Une pratique courante : utm_source=google, utm_medium=organic, utm_campaign=fiche-google. Les visites restent dans la recherche naturelle, et vous isolez celles venues de la fiche.' },
      { q: 'Un lien UTM nuit-il au référencement ?', a: 'Non, si la page a une balise canonical vers son adresse sans paramètres, ce que font la plupart des CMS. N’en mettez pas sur vos liens internes.' },
      { q: 'ChatGPT ajoute-t-il ses propres paramètres ?', a: 'Les liens cités par ChatGPT arrivent souvent avec utm_source=chatgpt.com. Notre guide sur GA4 explique comment isoler ce trafic sans rien ajouter vous-même.' },
    ],
    sources: [SRC_UTM, SRC_CHANNELS],
    related: [g('trafic-chatgpt-ga4', 'mesurer le trafic venu de ChatGPT dans GA4'), g('fiche-google-business-profile', 'remplir sa fiche Google à 100 %'), { label: 'Outil : lien d’avis Google et QR code', href: '/outils/lien-avis-google' }, ANALYSE],
  },
  {
    slug: 'fiche-faits-cles',
    updated: V7_UPDATED,
    name: 'Fiche « faits clés »',
    h1: 'Vos faits clés en un bloc que Google et les IA peuvent citer',
    lead: 'Remplissez ce qu’un client demande le plus (activité, zone, horaires, prix, ce qui vous distingue) : nous en faisons un bloc HTML à poser sur votre site et une version Markdown pour votre llms.txt ou votre page À propos.',
    metaTitle: 'Générer une fiche faits clés citable par les IA',
    description: 'Générez gratuitement un bloc « L’essentiel » de votre entreprise : HTML à coller sur votre site et Markdown pour llms.txt. Faits datés, sans superlatif. Calcul dans le navigateur.',
    output: 'Bloc HTML « L’essentiel », version Markdown, contrôles de précision',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Des faits clairs sur votre site, c’est la base. L’audit montre si les IA les reprennent, ou disent autre chose.',
    howItWorks: [
      'Remplissez les champs : seuls ceux que vous renseignez apparaissent, rien n’est ajouté ni deviné.',
      'Nous produisons un bloc HTML sémantique (liste de définitions) à coller sur votre page d’accueil ou À propos, et sa version Markdown.',
      'Nous signalons les informations manquantes, les faits sans chiffre ni date et les superlatifs invérifiables.',
    ],
    reading: [
      'Un fait citable se comprend seul et se vérifie : « Intervention sous 2 heures à Lyon et Villeurbanne », pas « réactivité exemplaire ».',
      'La date de vérification dit au lecteur, et aux IA, que l’information est tenue à jour. Changez-la seulement quand vous revérifiez.',
    ],
    limits: [
      'Le bloc ne garantit ni affichage dans Google ni citation par une IA : il rend vos informations plus faciles à trouver et à reprendre.',
      'Le llms.txt est une proposition communautaire, sans effet démontré à ce jour ; le bloc visible sur votre site compte davantage.',
    ],
    faq: [
      { q: 'Où placer ce bloc ?', a: 'Sur la page d’accueil ou la page À propos, en texte visible (pas dans une image). Sous WordPress, un bloc « HTML personnalisé » convient ; sous Wix ou Shopify, un élément « code intégré » ou une section de texte.' },
      { q: 'Pourquoi éviter les superlatifs ?', a: 'Parce qu’ils ne se vérifient pas : une IA les reprend rarement, et « numéro 1 » ou « le meilleur » sans preuve peut être une pratique commerciale trompeuse.' },
      { q: 'Quelle différence avec le JSON-LD ?', a: 'Le JSON-LD décrit l’entreprise aux machines, de façon invisible. Ce bloc dit la même chose aux lecteurs, en clair : les deux se complètent et doivent concorder.' },
      { q: 'Que faire de la version Markdown ?', a: 'La coller dans votre fichier llms.txt (à la racine du site) ou dans un document de présentation. Notre générateur de llms.txt peut l’accueillir en tête de fichier.' },
    ],
    sources: [SRC_HELPFUL, SRC_LLMS, SRC_L121],
    related: [g('llms-txt-faut-il-en-creer-un', 'llms.txt, faut-il en créer un ?'), g('ia-disent-des-choses-fausses', 'quand les IA disent des choses fausses'), g('apparaitre-dans-chatgpt-pme', 'apparaître dans ChatGPT quand on est une PME'), ANALYSE],
  },
];
