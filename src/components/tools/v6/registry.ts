/**
 * Outils gratuits V6 (SEO Google) : contenu éditorial des pages. Veille des outils gratuits des leaders et choix :
 * docs/v6/progress/OUTILS.md. Aucun chiffre de trafic, aucune promesse de position.
 */
import type { ToolDef, ToolSource } from '../registry';

export const V6_SLUGS = [
  'apercu-google',
  'balises-title-meta',
  'indexabilite',
  'redirections',
  'en-tetes-http',
  'validateur-sitemap',
  'hreflang',
  'open-graph',
  'analyse-liens',
  'lisibilite',
  'generateur-robots-txt',
] as const;
export type V6Slug = (typeof V6_SLUGS)[number];

const G = (label: string, url: string, note?: string): ToolSource => ({ label, url, ...(note ? { note } : {}) });
const SRC_TITLE = G('Google Search Central, « Liens de titre dans les résultats »', 'https://developers.google.com/search/docs/appearance/title-link', 'Google peut réécrire un title trop long, vague ou répété.');
const SRC_SNIPPET = G('Google Search Central, « Extraits et meta description »', 'https://developers.google.com/search/docs/appearance/snippet');
const SRC_ROBOTS_META = G('Google Search Central, balise meta robots et X-Robots-Tag', 'https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag');
const SRC_NOINDEX = G('Google Search Central, « Bloquer l’indexation avec noindex »', 'https://developers.google.com/search/docs/crawling-indexing/block-indexing');
const SRC_CANONICAL = G('Google Search Central, « Regrouper les URL en double » (canonical)', 'https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls');
const SRC_REDIRECTS = G('Google Search Central, « Redirections et recherche Google »', 'https://developers.google.com/search/docs/crawling-indexing/301-redirects');
const SRC_SITEMAP = G('Google Search Central, « Créer et envoyer un sitemap »', 'https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap');
const SRC_SITEMAP_PROTO = G('sitemaps.org, protocole Sitemap 0.9', 'https://www.sitemaps.org/protocol.html', 'Limites : 50 000 adresses et 50 Mo décompressés par fichier.');
const SRC_HREFLANG = G('Google Search Central, « Versions localisées de vos pages » (hreflang)', 'https://developers.google.com/search/docs/specialty/international/localized-versions');
const SRC_OGP = G('The Open Graph protocol (ogp.me)', 'https://ogp.me/');
const SRC_MDN_HEADERS = G('MDN, référence des en-têtes HTTP', 'https://developer.mozilla.org/fr/docs/Web/HTTP/Reference/Headers');
const SRC_OWASP = G('OWASP Secure Headers Project', 'https://owasp.org/www-project-secure-headers/');
const SRC_LINKS = G('Google Search Central, « Liens explorables »', 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable');
const SRC_QUALIFY = G('Google Search Central, qualifier les liens sortants (nofollow, sponsored, ugc)', 'https://developers.google.com/search/docs/crawling-indexing/qualify-outbound-links');
const SRC_KM = G('T. François (TALN-RECITAL 2009), état de l’art de la lisibilité du français', 'https://aclanthology.org/2009.jeptalnrecital-recital.7.pdf', 'Cite Kandel et Moles (1958), « Application de l’indice de Flesch à la langue française », première formule pour le français.');
const SRC_RFC9309: ToolSource = G('IETF, RFC 9309 « Robots Exclusion Protocol »', 'https://www.rfc-editor.org/rfc/rfc9309');
const SRC_OPENAI_BOTS = G('OpenAI, « Overview of OpenAI Crawlers »', 'https://platform.openai.com/docs/bots');
const SRC_GOOGLE_CRAWLERS = G('Google, liste des robots et jetons (dont Google-Extended)', 'https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers');

const ANALYSE = { label: 'Analyse complète SEO et IA de votre site (gratuite)', href: '/analyse' };

export const V6_UPDATED = '2026-11-15';

export const V6_TOOLS: (ToolDef & { slug: V6Slug })[] = [
  {
    slug: 'apercu-google',
    updated: V6_UPDATED,
    name: 'Aperçu dans Google',
    h1: 'Voyez votre page comme dans Google, sur mobile et sur ordinateur',
    lead: 'Tapez un titre et une description, ou lisez ceux d’une page : nous les coupons là où Google les coupe, au pixel près, et vous disons quoi raccourcir.',
    metaTitle: 'Aperçu Google gratuit : titre et description coupés ?',
    description: 'Simulez gratuitement l’affichage de votre page dans Google, sur mobile et ordinateur : titre et meta description tronqués au pixel, longueur, conseils. Sans inscription.',
    output: 'Aperçu bureau et mobile, largeur en pixels, conseils de longueur',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un bon titre aide à être cliqué. L’analyse complète vérifie les titres de toutes vos pages et ce que lisent les IA.',
    howItWorks: [
      'Saisissez un titre, une description et l’adresse de la page, ou lisez-les directement sur une page en ligne.',
      'Nous calculons leur largeur en pixels avec les mesures de la police utilisée par Google (Arial, 20 px pour le titre, 14 px pour la description).',
      'Nous coupons au dernier mot qui tient, comme Google, et affichons le résultat sur ordinateur et sur mobile.',
    ],
    reading: [
      'Google ne coupe pas à un nombre de caractères mais à une largeur : un titre plein de « m » et de « W » est coupé plus tôt qu’un titre plein de « i ».',
      'Ce qui compte est le début : le service et le lieu dans les 50 premiers caractères, la marque à la fin.',
    ],
    limits: [
      'C’est une estimation : Google ne publie pas ses limites et réécrit souvent les titres et descriptions qu’il juge peu adaptés à la recherche.',
      'Les éléments enrichis (étoiles, prix, date, image) dépendent des données structurées et de Google : ils ne sont pas simulés.',
    ],
    faq: [
      { q: 'Quelle longueur pour un titre Google ?', a: 'Environ 50 à 60 caractères, soit moins de 600 pixels en bureau. Au-delà, Google coupe avec « … ». Mettez l’essentiel au début.' },
      { q: 'Quelle longueur pour une meta description ?', a: 'Environ 140 à 155 caractères (920 pixels) en bureau. Sur mobile, Google en montre moins, autour de 120 caractères : le début doit se suffire à lui-même.' },
      { q: 'Pourquoi Google n’affiche-t-il pas ma description ?', a: 'Google choisit l’extrait qui répond le mieux à la recherche. Il réécrit souvent une description absente, trop courte, répétée sur plusieurs pages ou sans rapport avec la requête.' },
      { q: 'La meta description compte-t-elle pour le classement ?', a: 'Non, selon Google. Elle sert à donner envie de cliquer. Le titre, lui, aide aussi Google à comprendre la page.' },
      { q: 'Dois-je mettre le nom de ma ville dans le titre ?', a: 'Pour une activité locale, oui : c’est ce que tapent vos clients (« plombier Lyon 3 »). Une fois, sans répéter les mots-clés.' },
    ],
    sources: [SRC_TITLE, SRC_SNIPPET],
    related: [{ label: 'Guide : écrire ses titres et meta descriptions', href: '/guides/titres-meta-descriptions' }, { label: 'Outil : vérifier le title et la description d’une page', href: '/outils/balises-title-meta' }, { label: 'Outil : aperçu de partage (Open Graph)', href: '/outils/open-graph' }, ANALYSE],
  },
  {
    slug: 'balises-title-meta',
    updated: V6_UPDATED,
    name: 'Vérificateur de title et meta description',
    h1: 'Le titre et la description de votre page sont-ils prêts pour Google ?',
    lead: 'Une adresse suffit : nous lisons la balise title, la meta description et le H1 tels que Google les reçoit, et vous disons ce qui sera coupé, manquant ou en double.',
    metaTitle: 'Vérifier le title et la meta description d’une page',
    description: 'Vérifiez gratuitement la balise title, la meta description et le H1 d’une page : longueur en pixels, doublons, oublis, aperçu Google. Sans inscription.',
    output: 'Title, description et H1 lus dans le HTML, contrôles, aperçu Google',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Une page vérifiée, c’est un début. L’analyse complète contrôle les titres et descriptions de tout le site, doublons compris.',
    howItWorks: [
      'Nous récupérons la page comme un robot, sans exécuter de JavaScript, avec notre robot déclaré RepereBot.',
      'Nous lisons les balises <title> et <meta name="description"> du <head>, et les titres H1 de la page.',
      'Nous contrôlons leur longueur au pixel, leurs doublons et leur cohérence, puis affichons l’aperçu Google.',
    ],
    reading: [
      '« À corriger » : un oubli ou une balise qui empêche un bon affichage. « À améliorer » : une longueur ou une formulation à reprendre.',
      'Si votre CMS ajoute le title par JavaScript, il apparaît ici comme absent : c’est ce que voient la plupart des robots d’IA.',
    ],
    limits: [
      'Une seule page est vérifiée. Les doublons de titre entre pages se voient dans l’analyse complète du site.',
      'Google peut réécrire titre et description : la page dit ce que vous lui proposez, pas ce qu’il affichera.',
    ],
    faq: [
      { q: 'Où modifier le title et la meta description ?', a: 'Sous WordPress, dans votre extension SEO (Yoast, Rank Math, SEOPress) en bas de la page. Sous Shopify, dans « Aperçu du référencement » de la page ou du produit. Sous Wix, dans « SEO de la page ».' },
      { q: 'Pourquoi deux balises title ?', a: 'Souvent un thème et une extension SEO qui écrivent chacun la leur. Google n’en garde qu’une. Désactivez l’option de titre du thème.' },
      { q: 'Le title et le H1 doivent-ils être identiques ?', a: 'Non. Ils doivent parler du même sujet : le title est fait pour la page de résultats, le H1 pour la personne arrivée sur la page.' },
      { q: 'Combien de temps pour que Google affiche le nouveau titre ?', a: 'De quelques jours à quelques semaines, au prochain passage de Google. La Search Console permet de demander une nouvelle exploration.' },
    ],
    sources: [SRC_TITLE, SRC_SNIPPET],
    related: [{ label: 'Guide : écrire ses titres et meta descriptions', href: '/guides/titres-meta-descriptions' }, { label: 'Guide : la Search Console pour débutants', href: '/guides/search-console-debutants' }, { label: 'Outil : Aperçu Google', href: '/outils/apercu-google' }, { label: 'Outil : aperçu de partage (Open Graph)', href: '/outils/open-graph' }, ANALYSE],
  },
  {
    slug: 'indexabilite',
    updated: V6_UPDATED,
    name: 'Testeur d’indexabilité',
    h1: 'Google peut-il indexer cette page ?',
    lead: 'Nous vérifions les cinq raisons qui empêchent une page d’entrer dans Google : erreur HTTP, redirection, robots.txt, noindex (balise ou en-tête) et canonical vers une autre page.',
    metaTitle: 'Test d’indexabilité : noindex, canonical, robots.txt',
    description: 'Testez gratuitement si Google peut indexer une page : code HTTP, redirections, robots.txt pour Googlebot, noindex en balise ou en-tête X-Robots-Tag, canonical. Verdict clair.',
    output: 'Verdict indexable ou non, raison principale, contrôles détaillés',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Indexable ne veut pas dire visible. L’analyse complète vérifie toutes vos pages et ce que les IA en retiennent.',
    howItWorks: [
      'Nous récupérons la page en suivant les redirections, saut par saut.',
      'Nous lisons le robots.txt du site et appliquons ses règles à Googlebot et Bingbot selon la norme RFC 9309.',
      'Nous cherchons noindex dans la balise meta robots et dans l’en-tête X-Robots-Tag, puis comparons la canonical à l’adresse de la page.',
    ],
    reading: [
      '« Non indexable » : un blocage certain (erreur, noindex, robots.txt). « Probablement une autre adresse » : Google retiendra sans doute la cible de la redirection ou de la canonical.',
      'Le cas le plus fréquent après une mise en ligne : la case « Demander aux moteurs de ne pas indexer ce site » restée cochée sous WordPress.',
    ],
    limits: [
      'Nous ne savons pas si la page est réellement indexée : seule la Search Console (outil « Inspection de l’URL ») le dit.',
      'Une page indexable peut ne pas être indexée si Google la juge en double ou de faible intérêt.',
      'Notre robot respecte le robots.txt du site : une page interdite à tous les robots ne peut pas être lue par cet outil.',
    ],
    faq: [
      { q: 'Quelle différence entre robots.txt et noindex ?', a: 'robots.txt interdit de lire la page ; noindex autorise la lecture mais interdit l’affichage dans les résultats. Pour retirer une page de Google, utilisez noindex et laissez-la lisible : sinon Google ne voit jamais la consigne.' },
      { q: 'Qu’est-ce que l’en-tête X-Robots-Tag ?', a: 'La même consigne que la balise meta robots, mais envoyée par le serveur dans les en-têtes HTTP. Elle est invisible dans le code source, d’où des noindex oubliés après une préproduction.' },
      { q: 'Ma canonical pointe vers une autre page : est-ce grave ?', a: 'C’est voulu pour une variante (couleur, tri, paramètres de suivi). C’est une erreur si la page doit apparaître elle-même : Google indexera l’autre adresse à sa place.' },
      { q: 'Comment faire indexer une page plus vite ?', a: 'Corrigez le blocage, ajoutez la page au sitemap, faites-y un lien depuis une page déjà indexée et demandez l’indexation dans la Search Console.' },
    ],
    sources: [SRC_NOINDEX, SRC_ROBOTS_META, SRC_CANONICAL, SRC_RFC9309],
    related: [{ label: 'Guide : la Search Console pour débutants', href: '/guides/search-console-debutants' }, { label: 'Guide : un audit SEO en 30 minutes', href: '/guides/audit-seo-30-minutes' }, { label: 'Glossaire : robots.txt', href: '/glossaire#robots-txt' }, { label: 'Outil : en-têtes HTTP', href: '/outils/en-tetes-http' }, { label: 'Outil : chaîne de redirections', href: '/outils/redirections' }, { label: 'Outil : validateur de sitemap', href: '/outils/validateur-sitemap' }, ANALYSE],
  },
  {
    slug: 'redirections',
    updated: V6_UPDATED,
    name: 'Vérificateur de redirections',
    h1: 'Où mène vraiment cette adresse ? Chaîne, codes et boucles',
    lead: 'Nous suivons l’adresse saut par saut, avec le code de chaque redirection (301, 302, 307, 308), détectons les boucles et vérifions que les variantes avec et sans www, en http et https, mènent à la même page.',
    metaTitle: 'Vérificateur de redirections 301 et 302 gratuit',
    description: 'Vérifiez gratuitement les redirections d’une adresse : chaîne complète, codes 301, 302, 307, 308, boucles, page finale, variantes www et https. Sans inscription.',
    output: 'Chaîne de redirection, codes, page finale, test des 4 variantes',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Une redirection propre, c’est une page. L’analyse complète repère les redirections et les liens cassés de tout le site.',
    howItWorks: [
      'Nous demandons l’adresse sans suivre automatiquement les redirections : chaque saut est noté avec son code.',
      'Nous nous arrêtons sur une boucle ou après 5 sauts, comme le font les robots.',
      'Nous testons aussi les variantes http, https, avec et sans www, qui doivent toutes aboutir à la même adresse.',
    ],
    reading: [
      '301 et 308 : déménagement définitif, Google transfère l’adresse. 302 et 307 : temporaire, Google peut garder l’ancienne adresse.',
      'Une seule redirection vers une page qui répond 200 est l’idéal. Deux ou plus : faites pointer la première directement vers la dernière.',
    ],
    limits: [
      'Seules les redirections HTTP (codes 3xx) sont suivies : une redirection faite en JavaScript ou par balise meta refresh n’apparaît pas ici.',
      'Notre robot respecte le robots.txt : une étape interdite à RepereBot arrête le suivi.',
    ],
    faq: [
      { q: '301 ou 302 : laquelle choisir ?', a: 'La 301 pour un changement définitif (nouvelle adresse, refonte, passage en https). La 302 seulement pour un remplacement temporaire, par exemple une page de promotion.' },
      { q: 'Qu’est-ce qu’une boucle de redirection ?', a: 'Deux adresses qui se renvoient l’une à l’autre. Le navigateur affiche « Trop de redirections » et Google abandonne. Souvent un conflit entre la règle du serveur et celle d’une extension.' },
      { q: 'Combien de redirections enchaînées Google accepte-t-il ?', a: 'Google indique suivre jusqu’à 10 sauts, mais chaque saut ralentit la page. Visez une seule redirection.' },
      { q: 'Faut-il rediriger la version sans www vers la version avec www ?', a: 'Choisissez l’une des deux et redirigez l’autre en 301. Peu importe laquelle, pourvu que toutes les variantes mènent au même endroit.' },
    ],
    sources: [SRC_REDIRECTS, SRC_CANONICAL],
    related: [{ label: 'Guide : refondre son site sans perdre son référencement', href: '/guides/refonte-site-sans-perdre-seo' }, { label: 'Outil : en-têtes HTTP', href: '/outils/en-tetes-http' }, { label: 'Outil : indexabilité d’une page', href: '/outils/indexabilite' }, { label: 'Outil : analyse des liens d’une page', href: '/outils/analyse-liens' }, ANALYSE],
  },
  {
    slug: 'en-tetes-http',
    updated: V6_UPDATED,
    name: 'Vérificateur d’en-têtes HTTP',
    h1: 'Ce que votre serveur dit à Google et aux navigateurs, en clair',
    lead: 'Tous les en-têtes HTTP de la page, rangés et expliqués : indexation (X-Robots-Tag), cache, compression, sécurité (HSTS, CSP, nosniff). Et ceux qui manquent.',
    metaTitle: 'Vérifier les en-têtes HTTP : cache, sécurité, X-Robots',
    description: 'Vérifiez gratuitement les en-têtes HTTP d’une page : X-Robots-Tag, Cache-Control, compression, HSTS, Content-Security-Policy, X-Frame-Options. Expliqués en français.',
    output: 'Tableau des en-têtes par famille, contrôles et lignes à ajouter',
    parcours: ['pme', 'ecommerce'],
    bridge: 'Des en-têtes propres, c’est la base technique. L’analyse complète vérifie aussi la vitesse, l’indexation et ce que lisent les IA.',
    howItWorks: [
      'Nous demandons la page à votre serveur comme un navigateur, en acceptant la compression.',
      'Nous rangeons chaque en-tête reçu par famille : indexation, cache, sécurité, contenu, serveur.',
      'Nous signalons ceux qui bloquent Google (X-Robots-Tag: noindex) et les protections courantes absentes.',
    ],
    reading: [
      'Un noindex dans l’en-tête X-Robots-Tag retire la page de Google : c’est le seul point bloquant pour le référencement.',
      'Les en-têtes de sécurité ne changent pas votre position : ils protègent vos visiteurs. Les plus simples à ajouter sont nosniff et HSTS.',
    ],
    limits: [
      'Les en-têtes peuvent varier selon le visiteur (pays, connexion, CDN) : nous montrons ceux reçus par notre robot.',
      'Les cookies ne sont jamais affichés en clair : seule leur présence est indiquée.',
    ],
    faq: [
      { q: 'Les en-têtes de sécurité améliorent-ils le référencement ?', a: 'Pas directement. Seul HTTPS est un signal confirmé par Google. Les autres protègent vos visiteurs et votre réputation.' },
      { q: 'Comment ajouter un en-tête sur WordPress ?', a: 'Par le fichier .htaccess (Apache), la configuration Nginx, ou une extension de sécurité. Chez beaucoup d’hébergeurs et de CDN, un écran dédié le permet sans code.' },
      { q: 'Qu’est-ce que Cache-Control ?', a: 'La consigne qui dit combien de temps navigateurs et CDN peuvent garder une copie. Une page vitrine peut être gardée quelques minutes ; une page de compte, jamais.' },
      { q: 'Pourquoi masquer la version du serveur ?', a: 'Un numéro de version aide les robots malveillants à cibler les failles connues. Le masquer ne coûte rien.' },
    ],
    sources: [SRC_ROBOTS_META, SRC_MDN_HEADERS, SRC_OWASP],
    related: [{ label: 'Guide : les Core Web Vitals sans jargon', href: '/guides/core-web-vitals-sans-jargon' }, { label: 'Guide : un audit SEO en 30 minutes', href: '/guides/audit-seo-30-minutes' }, { label: 'Outil : indexabilité d’une page', href: '/outils/indexabilite' }, { label: 'Outil : chaîne de redirections', href: '/outils/redirections' }, ANALYSE],
  },
  {
    slug: 'validateur-sitemap',
    updated: V6_UPDATED,
    name: 'Validateur de sitemap',
    h1: 'Votre sitemap est-il lisible par Google ?',
    lead: 'Collez votre site ou l’adresse du sitemap : nous le trouvons, le lisons, vérifions son format, ses dates, sa déclaration dans le robots.txt, et testons un échantillon d’adresses.',
    metaTitle: 'Valider un sitemap XML gratuitement',
    description: 'Validez gratuitement votre sitemap XML : format sitemaps.org, index, limite de 50 000 adresses, dates lastmod, déclaration dans robots.txt, adresses en erreur ou redirigées.',
    output: 'Format, nombre d’adresses, contrôles, échantillon d’adresses testées',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un sitemap propre aide Google à trouver vos pages. L’analyse complète compare le sitemap aux pages réellement liées.',
    howItWorks: [
      'Nous partons de l’adresse donnée, sinon des lignes Sitemap du robots.txt, sinon de /sitemap.xml et /sitemap_index.xml.',
      'Nous lisons le fichier (gzip compris) et contrôlons le format, les adresses, les doublons et les dates lastmod.',
      'Nous testons les 10 premières adresses : elles doivent répondre 200, sans redirection.',
    ],
    reading: [
      'Le point le plus fréquent : des adresses qui redirigent ou n’existent plus. Un sitemap ne doit lister que des pages finales, indexables.',
      'Pour un index de sitemaps, les trois premiers fichiers sont ouverts et comptés.',
    ],
    limits: [
      'Nous lisons au plus 2 Mo de chaque fichier ; au-delà, les contrôles portent sur le début.',
      'Seules 10 adresses sont testées : l’analyse complète compare tout le sitemap aux pages explorées.',
    ],
    faq: [
      { q: 'Qu’est-ce qu’un sitemap ?', a: 'Un fichier, en général à l’adresse /sitemap.xml, qui liste les pages de votre site à faire connaître aux moteurs. La plupart des CMS le génèrent tout seuls.' },
      { q: 'Où trouver mon sitemap ?', a: 'Sous WordPress avec Yoast : /sitemap_index.xml ; sans extension : /wp-sitemap.xml. Sous Shopify et Wix : /sitemap.xml. Le robots.txt l’indique souvent sur une ligne « Sitemap: ».' },
      { q: 'Faut-il le déclarer dans la Search Console ?', a: 'Oui : c’est là que Google vous dit combien d’adresses il a lues et lesquelles posent problème. Ajoutez aussi la ligne Sitemap dans le robots.txt pour les autres moteurs.' },
      { q: 'La date lastmod sert-elle à quelque chose ?', a: 'Google l’utilise si elle est fiable, c’est-à-dire si elle change seulement quand le contenu change. Une date qui se met à jour chaque jour sur toutes les pages est ignorée.' },
    ],
    sources: [SRC_SITEMAP, SRC_SITEMAP_PROTO],
    related: [{ label: 'Guide : la Search Console pour débutants', href: '/guides/search-console-debutants' }, { label: 'Guide : Bing, Copilot et IndexNow', href: '/guides/bing-copilot-indexnow' }, { label: 'Outil : hreflang', href: '/outils/hreflang' }, { label: 'Outil : indexabilité d’une page', href: '/outils/indexabilite' }, { label: 'Outil : générateur de robots.txt', href: '/outils/generateur-robots-txt' }, ANALYSE],
  },
  {
    slug: 'hreflang',
    updated: V6_UPDATED,
    name: 'Vérificateur hreflang',
    h1: 'Vos versions linguistiques sont-elles bien reliées pour Google ?',
    lead: 'Nous lisons les balises hreflang de la page, vérifions les codes de langue et de pays, l’auto-référence, x-default, et ouvrons chaque version pour contrôler qu’elle renvoie bien vers celle-ci.',
    metaTitle: 'Vérificateur hreflang gratuit : codes et réciprocité',
    description: 'Vérifiez gratuitement les balises hreflang d’une page : codes ISO de langue et de pays, x-default, auto-référence, liens de retour réciproques, canonical. Sans inscription.',
    output: 'Tableau des versions, codes vérifiés, liens de retour testés',
    parcours: ['pme', 'ecommerce'],
    bridge: 'Un site multilingue bien relié, c’est la bonne langue au bon visiteur. L’analyse complète contrôle les hreflang de tout le site.',
    howItWorks: [
      'Nous lisons les balises <link rel="alternate" hreflang> du HTML de la page.',
      'Nous vérifions chaque code : langue ISO 639-1, puis pays ISO 3166-1 facultatif (fr, fr-BE, en-GB), et x-default.',
      'Nous ouvrons jusqu’à 8 versions alternatives pour vérifier qu’elles citent cette page en retour.',
    ],
    reading: [
      'Sans lien de retour, Google ignore la paire : chaque version doit lister toutes les autres, et elle-même.',
      'Les erreurs les plus fréquentes : en-UK au lieu de en-GB, un pays seul (« be ») ou un tiret bas (« fr_FR »).',
    ],
    limits: [
      'Nous lisons les hreflang du HTML ; ceux déclarés dans les en-têtes HTTP ou le sitemap ne sont pas pris en compte ici.',
      'Une page sans hreflang n’est pas une erreur si votre site n’existe qu’en une langue.',
    ],
    faq: [
      { q: 'À quoi sert hreflang ?', a: 'À dire à Google quelle version d’une page montrer selon la langue et le pays du visiteur : la page belge aux Belges, la page suisse aux Suisses.' },
      { q: 'Faut-il hreflang pour un site uniquement en français ?', a: 'Non. Il ne sert qu’à relier des versions de la même page dans plusieurs langues ou pour plusieurs pays.' },
      { q: 'Qu’est-ce que x-default ?', a: 'La version proposée quand aucune autre ne correspond au visiteur : souvent la page de choix de langue ou la version internationale.' },
      { q: 'Faut-il préciser le pays ?', a: 'Seulement si le contenu change selon le pays (prix, livraison, mentions). « fr » suffit pour un contenu identique pour tous les francophones.' },
    ],
    sources: [SRC_HREFLANG, SRC_CANONICAL],
    related: [{ label: 'Guide : le SEO et le GEO des sites pros en 2026', href: '/guides/seo-geo-sites-pros-2026' }, { label: 'Outil : validateur de sitemap', href: '/outils/validateur-sitemap' }, { label: 'Outil : title et meta', href: '/outils/balises-title-meta' }, ANALYSE],
  },
  {
    slug: 'open-graph',
    updated: V6_UPDATED,
    name: 'Testeur Open Graph',
    h1: 'À quoi ressemble votre page quand on la partage ?',
    lead: 'Nous lisons les balises Open Graph et Twitter de la page, vérifions que l’image répond, et affichons l’aperçu tel qu’il apparaîtra sur LinkedIn, Facebook, WhatsApp ou X.',
    metaTitle: 'Testeur Open Graph : aperçu de partage de votre page',
    description: 'Testez gratuitement l’aperçu de partage d’une page : balises og:title, og:description, og:image, twitter:card, image accessible. Aperçu LinkedIn, Facebook, WhatsApp.',
    output: 'Aperçu de partage, balises lues, image vérifiée, lignes à ajouter',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un beau partage attire des visites. L’analyse complète vérifie aussi ce que Google et les IA lisent de chaque page.',
    howItWorks: [
      'Nous récupérons la page et lisons les balises og:* et twitter:* de son code.',
      'Nous vérifions que l’image déclarée existe et répond comme une image.',
      'Nous composons l’aperçu tel que le construisent la plupart des réseaux et messageries.',
    ],
    reading: [
      'L’image est le point qui compte le plus : sans og:image, la plupart des réseaux affichent un lien nu, peu cliqué.',
      'Les réseaux gardent l’aperçu en cache : après correction, utilisez leur outil de rafraîchissement (Post Inspector de LinkedIn, débogueur de Meta).',
    ],
    limits: [
      'Chaque réseau a ses règles de recadrage : l’aperçu est indicatif.',
      'Nous ne nous connectons à aucun réseau social : nous lisons seulement votre page.',
    ],
    faq: [
      { q: 'Quelle taille pour l’image Open Graph ?', a: '1200 × 630 pixels (format 1,91:1), en JPEG ou PNG, de préférence moins de 1 Mo. Gardez le texte au centre : les bords peuvent être recadrés.' },
      { q: 'Pourquoi LinkedIn affiche-t-il encore l’ancienne image ?', a: 'LinkedIn garde l’aperçu en mémoire environ une semaine. Son outil Post Inspector force une nouvelle lecture.' },
      { q: 'Faut-il des balises Twitter en plus ?', a: 'X lit les balises Open Graph. Ajoutez seulement twitter:card = summary_large_image pour obtenir une grande image.' },
      { q: 'Open Graph aide-t-il le référencement ?', a: 'Pas le classement Google. Il améliore le taux de clic des partages, et certains assistants d’IA s’en servent pour résumer une page.' },
    ],
    sources: [SRC_OGP],
    related: [{ label: 'Guide : le SEO des images', href: '/guides/seo-images' }, { label: 'Générateur JSON-LD (données structurées)', href: '/outils/json-ld' }, { label: 'Outil : Aperçu Google', href: '/outils/apercu-google' }, { label: 'Outil : title et meta', href: '/outils/balises-title-meta' }, ANALYSE],
  },
  {
    slug: 'analyse-liens',
    updated: V6_UPDATED,
    name: 'Analyseur de liens d’une page',
    h1: 'Les liens de votre page : internes, externes, nofollow et cassés',
    lead: 'Nous listons tous les liens HTML de la page, distinguons internes et externes, repérons nofollow, sponsored et ugc, les ancres vagues ou vides, et testons jusqu’à 30 adresses pour trouver les liens cassés.',
    metaTitle: 'Analyser les liens d’une page : cassés, nofollow',
    description: 'Analysez gratuitement les liens d’une page : internes, externes, nofollow, sponsored, ugc, ancres vagues, liens cassés et redirigés (30 adresses testées). Sans inscription.',
    output: 'Comptes par type, liens cassés, tableau filtrable des liens',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Une page sans lien cassé, c’est bien. L’analyse complète vérifie le maillage de tout le site et les pages orphelines.',
    howItWorks: [
      'Nous lisons les liens <a href> du HTML de la page, sans exécuter de JavaScript.',
      'Nous classons chaque lien (interne, externe, nofollow, sponsored, ugc) et relevons les ancres vagues ou vides.',
      'Nous testons les 30 premières adresses, internes d’abord, avec une requête légère, en respectant le robots.txt des sites visés.',
    ],
    reading: [
      'Un lien cassé (404, 410, 5xx ou injoignable) est à corriger en premier : il frustre les visiteurs et gaspille l’exploration.',
      'Un lien redirigé fonctionne, mais l’adresse finale est préférable.',
    ],
    limits: [
      'Les liens ajoutés par JavaScript (menus, widgets) peuvent manquer : c’est aussi ce que voient la plupart des robots d’IA.',
      'Au plus 30 adresses testées et 10 sites externes, pour rester rapide et poli. Un site qui refuse notre robot est noté « non vérifié ».',
    ],
    faq: [
      { q: 'Qu’est-ce qu’un lien nofollow ?', a: 'Un lien marqué rel="nofollow" : vous indiquez à Google que vous ne le recommandez pas. Google s’en sert comme d’un indice. Pour un lien payé, utilisez « sponsored » ; pour un commentaire, « ugc ».' },
      { q: 'Faut-il mettre les liens externes en nofollow ?', a: 'Non. Un lien vers une source fiable est normal et utile. Réservez nofollow aux liens que vous ne garantissez pas, et sponsored aux liens payés.' },
      { q: 'Combien de liens internes par page ?', a: 'Il n’y a pas de chiffre magique. Chaque page importante doit être reliée depuis d’autres pages, avec une ancre qui dit de quoi elle parle.' },
      { q: 'Comment trouver tous les liens cassés du site ?', a: 'Cet outil teste une page. L’analyse complète explore jusqu’à 60 pages gratuitement et vérifie leurs liens.' },
    ],
    sources: [SRC_LINKS, SRC_QUALIFY],
    related: [{ label: 'Guide : le maillage interne', href: '/guides/maillage-interne' }, { label: 'Guide : des liens entrants sans risque', href: '/guides/liens-entrants-sans-risque' }, { label: 'Outil : chaîne de redirections', href: '/outils/redirections' }, { label: 'Outil : lisibilité d’un texte', href: '/outils/lisibilite' }, ANALYSE],
  },
  {
    slug: 'lisibilite',
    updated: V6_UPDATED,
    name: 'Compteur de mots et lisibilité',
    h1: 'Votre texte est-il facile à lire ? Mots, phrases et indice en français',
    lead: 'Collez un texte : nombre de mots, temps de lecture, indice de lisibilité adapté au français, phrases trop longues et mots répétés. Le calcul se fait dans votre navigateur, rien n’est envoyé.',
    metaTitle: 'Compteur de mots et test de lisibilité en français',
    description: 'Comptez gratuitement les mots d’un texte et testez sa lisibilité en français (indice de Kandel et Moles) : temps de lecture, phrases trop longues, répétitions. Rien n’est envoyé.',
    output: 'Mots, phrases, temps de lecture, indice sur 100, phrases à couper',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Un texte clair se lit et se cite. L’analyse complète repère les pages trop courtes ou peu citables de votre site.',
    howItWorks: [
      'Collez votre texte (ou celui d’une page) dans le champ : le calcul se fait dans votre navigateur, sans envoi.',
      'Nous comptons mots, phrases et syllabes, puis calculons l’indice de Kandel et Moles, adaptation française de l’indice de Flesch.',
      'Nous relevons les phrases de plus de 25 mots, les paragraphes trop longs et les mots les plus répétés.',
    ],
    reading: [
      'Au-dessus de 60 : lisible par le grand public, le niveau à viser pour une page de service. Sous 40 : un texte de spécialiste.',
      'Les phrases longues sont aussi les plus difficiles à reprendre telles quelles par une IA : coupez-les en premier.',
    ],
    limits: [
      'La formule date de 1958 et ne mesure que la longueur des phrases et des mots : un texte court peut rester obscur.',
      'Le comptage des syllabes est une approximation (e muets, liaisons) : l’indice est fiable à quelques points près.',
    ],
    faq: [
      { q: 'Qu’est-ce que l’indice de Kandel et Moles ?', a: 'L’adaptation au français, en 1958, de l’indice de lisibilité de Flesch : 207 − 1,015 × (mots par phrase) − 73,6 × (syllabes par mot). Plus il est élevé, plus le texte est facile.' },
      { q: 'Combien de mots pour une page de service ?', a: 'Pas de minimum officiel. Une page doit répondre complètement à la question du client : souvent 300 à 800 mots pour un service, davantage pour un guide.' },
      { q: 'Mon texte est-il envoyé à vos serveurs ?', a: 'Non. Le calcul est fait par votre navigateur ; rien n’est transmis ni conservé.' },
      { q: 'Combien de temps faut-il pour lire mon texte ?', a: 'Nous comptons environ 230 mots par minute, une vitesse moyenne de lecture silencieuse en français. C’est une indication.' },
    ],
    sources: [SRC_KM],
    related: [{ label: 'Outil : citabilité d’une page pour les IA', href: '/outils/citabilite' }, { label: 'Guide : un contenu écrit avec l’IA, sans risque', href: '/guides/contenu-ecrit-avec-ia' }, { label: 'Guide : une page que les IA citent', href: '/guides/page-que-les-ia-citent' }, { label: 'Outil : analyse des liens d’une page', href: '/outils/analyse-liens' }, { label: 'Outil : title et meta', href: '/outils/balises-title-meta' }, ANALYSE],
  },
  {
    slug: 'generateur-robots-txt',
    updated: V6_UPDATED,
    name: 'Générateur de robots.txt',
    h1: 'Votre robots.txt en une minute, robot d’IA par robot d’IA',
    lead: 'Choisissez qui peut lire votre site (Google, ChatGPT, Claude, Perplexity, Gemini…), les dossiers à garder privés et votre sitemap : le fichier est généré, puis vérifié par notre lecteur RFC 9309.',
    metaTitle: 'Générateur de robots.txt gratuit, avec robots d’IA',
    description: 'Générez gratuitement un robots.txt : règles par robot d’IA (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended), dossiers privés, sitemap. Vérifié selon la RFC 9309.',
    output: 'robots.txt prêt à déposer, tableau de vérification robot par robot',
    parcours: ['local', 'pme', 'ecommerce'],
    bridge: 'Votre fichier est prêt. Reste à savoir ce que les IA disent de vous : l’analyse complète le mesure.',
    howItWorks: [
      'Partez d’un profil (ouvert à tous, cité sans servir à l’entraînement, fermé aux IA), puis ajustez robot par robot.',
      'Ajoutez les dossiers à ne pas explorer (administration, panier, compte) et l’adresse de votre sitemap.',
      'Le fichier est relu par le même lecteur que notre vérificateur : vous voyez ce que chaque robot pourra réellement lire.',
    ],
    reading: [
      'Bloquer un robot d’entraînement (GPTBot, ClaudeBot, CCBot, Google-Extended) n’empêche pas d’être cité. Bloquer un robot de recherche (OAI-SearchBot, PerplexityBot, Claude-SearchBot) si.',
      'Un robot qui a son propre groupe ignore le groupe « * » : ses règles doivent donc être complètes.',
    ],
    limits: [
      'robots.txt est une demande, pas un verrou : les robots qui ne le respectent pas ne sont arrêtés que par le serveur ou le pare-feu.',
      'La liste des robots d’IA change : elle est datée et revue chaque trimestre.',
      'Le fichier est généré dans votre navigateur ; rien n’est envoyé ni publié sur votre site.',
    ],
    faq: [
      { q: 'Où mettre le fichier robots.txt ?', a: 'À la racine du domaine : https://votre-site.fr/robots.txt. Sous WordPress, une extension SEO permet de le modifier ; sous Shopify, le modèle robots.txt.liquid du thème ; sous Wix, le menu SEO.' },
      { q: 'Faut-il bloquer les robots d’IA ?', a: 'C’est un choix. Pour être cité par les assistants, laissez passer leurs robots de recherche. Vous pouvez refuser l’entraînement sans perdre les citations.' },
      { q: 'robots.txt suffit-il à cacher une page ?', a: 'Non. Une page interdite peut encore apparaître dans Google si d’autres sites y renvoient. Pour la retirer, utilisez noindex et laissez-la lisible.' },
      { q: 'Que veut dire « Disallow: » vide ?', a: 'Aucune restriction : le robot peut tout lire. C’est l’inverse de « Disallow: / », qui interdit tout le site.' },
    ],
    sources: [SRC_RFC9309, SRC_OPENAI_BOTS, SRC_GOOGLE_CRAWLERS],
    related: [{ label: 'Outil : vérifier le robots.txt actuel de votre site', href: '/outils/robots-ia' }, { label: 'Guide : robots d’IA et robots.txt', href: '/guides/robots-ia-robots-txt' }, { label: 'Outil : validateur de sitemap', href: '/outils/validateur-sitemap' }, { label: 'Outil : indexabilité d’une page', href: '/outils/indexabilite' }, ANALYSE],
  },
];
