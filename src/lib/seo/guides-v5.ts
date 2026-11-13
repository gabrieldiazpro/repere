/**
 * Guides V5 (SITE-POSITIONNEMENT) : un guide pilier SEO + GEO et ses satellites. Mêmes règles que guides.ts :
 * aucune promesse de résultat, chaque affirmation technique ou chiffrée renvoie à une source listée ([n]),
 * ce qui reste incertain est dit. Exemples français concrets (entreprises fictives, nommées comme telles).
 * `figure` = schéma SVG maison (src/components/pages/guide-figures.tsx), `faq` = questions fréquentes en fin de guide.
 */
import type { Guide } from './guides';

const D = '2026-11-13';
const CTA = { href: '/analyse', label: 'Analyser mon site gratuitement' };

export const GUIDES_V5: Guide[] = [
  /* ------------------------------------------------------------------ */
  /* Pilier                                                              */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-geo-sites-pros-2026',
    pillar: true,
    seoTitle: 'SEO + GEO pour les sites pros en 2026 : le guide',
    title: 'SEO + GEO pour les sites pros en 2026 : ce que Google et les IA lisent',
    description:
      'Pour commerces, PME et e-commerce : comment Google classe, comment les IA citent, ce qui sert aux deux et dans quel ordre agir. Sources officielles.',
    updated: D,
    published: D,
    intro: [
      'Un plombier de Villeurbanne, un éditeur de logiciel de paie à Nantes et une boutique de cosmétiques solides à Bordeaux ont le même problème en 2026 : leurs clients ne cherchent plus seulement sur Google. Ils posent aussi la question à ChatGPT, à Perplexity ou à Gemini, qui répondent avec trois à cinq noms. Et dans Google même, un aperçu généré par IA s’affiche souvent au-dessus des liens.',
      'Ce guide explique, sources à l’appui, comment chacun de ces lecteurs fonctionne, pourquoi l’essentiel du travail est commun, et dans quel ordre s’y prendre. Il ne promet rien : ni Google ni les éditeurs d’IA ne publient de recette garantie, et ceux qui en vendent une se trompent ou vous trompent.',
    ],
    sections: [
      {
        h2: 'Deux lecteurs, deux façons de décider',
        figure: 'deux-lecteurs',
        paras: [
          'Google explore les pages avec Googlebot, les indexe, puis les classe requête par requête selon des centaines de signaux, dont la pertinence du contenu, sa qualité et l’expérience offerte [1]. Le résultat est une liste ordonnée, et vos clics se mesurent dans la Search Console.',
          'Les assistants avec recherche web fonctionnent autrement : ils lancent une ou plusieurs recherches, récupèrent quelques pages, en extraient des passages et rédigent une réponse qui cite certaines sources. Google décrit ce mécanisme pour ses propres aperçus IA et son mode IA, qui lancent plusieurs recherches liées par sous-thème (« query fan-out ») [2]. Le résultat n’est pas une position mais une présence, variable d’une interrogation à l’autre.',
          'Conséquence pratique : sur Google, on peut être cinquième et recevoir des appels ; dans une réponse d’IA, on est cité ou on ne l’est pas. Et comme les réponses varient, la seule mesure honnête est une fréquence sur des questions répétées, pas une capture d’écran.',
        ],
      },
      {
        h2: 'Ce qui sert aux deux : quatre fondations',
        list: [
          'Être lisible par les robots. Un robots.txt qui bloque, une page en noindex ou un pare-feu trop zélé suffisent à vous rendre invisible. Pour les IA, c’est encore plus net : OpenAI indique qu’un site qui bloque OAI-SearchBot n’apparaît pas dans les réponses de recherche de ChatGPT [3].',
          'Mettre le texte dans le HTML. Google rend le JavaScript, en différé [4]. La plupart des robots d’IA ne l’exécutent pas : une page dont le texte n’apparaît qu’après un script peut leur sembler vide.',
          'Dire clairement qui vous êtes. Nom, adresse, téléphone, activité, identiques sur toutes vos pages, dans votre balisage et sur vos fiches. Google en fait un critère du référencement local [5] ; les consignes de Bing demandent des noms d’entité clairs et constants [6].',
          'Répondre vraiment aux questions. Google demande des contenus faits pour les personnes, avec une expertise visible [7]. Une expérience contrôlée publiée en 2024 montre qu’ajouter des citations, des statistiques et des sources augmente la part d’une page reprise dans une réponse générée, et que le bourrage de mots-clés la fait baisser [8].',
        ],
        after: [
          'Rien dans cette liste n’est un « hack ». C’est ce qui rend une page utile, et c’est pour cela que le même travail profite aux deux lecteurs.',
        ],
      },
      {
        h2: 'Ce qui est propre à Google',
        paras: [
          'Le SEO classique garde ses chantiers propres : des titres uniques et descriptifs (Google réécrit les titres vides, génériques ou trop longs), une page par intention de recherche, un maillage interne qui mène aux pages importantes, des redirections propres après une refonte, un sitemap qui ne liste que des pages indexables, et des pages rapides pour vos vrais visiteurs sur mobile [9].',
          'Pour une boutique, s’ajoutent les facettes et filtres, qui peuvent créer des milliers d’URL sans valeur : Google a publié en décembre 2024 une documentation dédiée, qui recommande de bloquer l’exploration des combinaisons inutiles [10]. Pour un commerce, la fiche Google Business Profile pèse lourd dans les résultats locaux.',
        ],
      },
      {
        h2: 'Ce qui est propre aux IA',
        list: [
          'Les robots ont des rôles distincts. Chez OpenAI, GPTBot sert à l’entraînement, OAI-SearchBot à la recherche de ChatGPT : on peut refuser le premier et accepter le second [3]. Anthropic et Perplexity publient des distinctions comparables [11][12].',
          'Le passage compte plus que la page. Un passage cité doit se comprendre seul : le sujet nommé, la réponse en tête, un chiffre daté. « Nous intervenons sous 2 heures à Lyon et Villeurbanne, 7 jours sur 7 » est citable ; « Contactez-nous pour en savoir plus » ne l’est pas.',
          'Les sources tierces pèsent lourd. Une étude de l’université de Toronto observe que les moteurs d’IA citent surtout des médias et sites tiers plutôt que les sites des marques [13]. Les annuaires, comparatifs, avis et articles qui parlent de vous font partie du travail.',
          'La fraîcheur aide. Des chercheurs ont mesuré que des reclasseurs à base de modèles de langage favorisent les passages datés récemment, toutes choses égales par ailleurs [14]. Une date de mise à jour visible et honnête est utile ; rajeunir une date sans rien changer ne l’est pas.',
        ],
      },
      {
        h2: 'Dans quel ordre agir',
        figure: 'ordre-action',
        paras: [
          'L’ordre compte, parce qu’un chantier du bas annule ceux du haut. Inutile de réécrire vos pages si un robots.txt les bloque, ou de soigner votre balisage si votre adresse diffère d’une page à l’autre.',
        ],
        list: [
          'Accès : robots.txt, noindex, pare-feu, texte présent dans le HTML. Souvent une heure de travail, effet immédiat sur ce que les robots peuvent lire.',
          'Identité : coordonnées identiques partout, page « à propos », balisage Organization ou LocalBusiness qui reprend le texte visible.',
          'Pages qui répondent : une page par service, produit ou problème client, réponse en tête, preuves datées.',
          'Technique fine : doublons, liens cassés, redirections, vitesse, images.',
          'Présence ailleurs : fiches, annuaires, comparatifs et médias que lisent réellement les IA dans votre secteur.',
        ],
      },
      {
        h2: 'Ce qu’il ne faut pas faire',
        list: [
          'Produire des pages en masse pour chaque variante de question : Google classe la production de contenus à grande échelle sans valeur parmi les pratiques de spam [15].',
          'Écrire « pour l’IA » avec des phrases artificielles : Bing range le langage fabriqué pour déclencher des citations parmi les abus [6].',
          'Compter sur llms.txt : Google dit ne pas l’utiliser, et une étude sur 300 000 domaines ne trouve pas de lien avec la fréquence de citation [16]. Le fichier ne nuit pas, il ne fait pas de miracle.',
          'Acheter des avis ou des mentions : c’est illégal en France pour les avis, et inefficace selon Google pour les mentions artificielles.',
        ],
      },
      {
        h2: 'Mesurer sans se raconter d’histoires',
        paras: [
          'Côté Google, la Search Console donne vos clics, impressions et positions moyennes ; depuis 2025, les clics et impressions des aperçus IA et du mode IA y sont comptés avec les résultats classiques [17]. Côté IA, il faut poser vos questions clients plusieurs fois à chaque assistant et compter : sur 20 questions répétées trois fois, dans combien de réponses votre nom apparaît-il ? Toute mesure sans répétition et sans marge d’erreur est une anecdote.',
          'Enfin, regardez les visites : celles qui viennent de chatgpt.com ou perplexity.ai apparaissent dans vos statistiques. C’est un plancher, pas un total, mais c’est une donnée réelle.',
        ],
      },
    ],
    faq: [
      { q: 'Le SEO est-il mort avec les IA ?', a: 'Non. Google reste la première porte d’entrée de la plupart des sites, et ses propres réponses IA s’appuient sur son index. Le travail de fond (pages accessibles, claires, utiles) sert aux deux.' },
      { q: 'GEO, AEO, LLMO : quelle différence ?', a: 'Ce sont des noms différents pour la même idée : augmenter les chances d’être cité par les moteurs qui génèrent des réponses. Le terme GEO vient d’un article de recherche de 2023, publié en 2024.' },
      { q: 'Faut-il bloquer les robots d’IA pour protéger son contenu ?', a: 'Vous pouvez refuser l’entraînement (GPTBot, ClaudeBot, Google-Extended) sans perdre la recherche, à condition d’autoriser les robots de recherche (OAI-SearchBot, Claude-SearchBot, PerplexityBot).' },
      { q: 'Combien de temps avant un effet ?', a: 'Une correction d’accès se voit dès le passage suivant des robots, en jours. Le reste se compte en semaines ou en mois, sans garantie : il faut mesurer avant et après.' },
    ],
    sources: [
      { label: 'Google Search Central, guide de démarrage SEO', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
      { label: 'Google Search Central, fonctionnalités IA et votre site (AI Overviews, AI Mode)', url: 'https://developers.google.com/search/docs/appearance/ai-features' },
      { label: 'OpenAI, présentation des robots (GPTBot, OAI-SearchBot, ChatGPT-User)', url: 'https://developers.openai.com/api/docs/bots.md' },
      { label: 'Google Search Central, les bases du JavaScript et du SEO', url: 'https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics' },
      { label: 'Aide Google Business Profile, améliorer son classement local', url: 'https://support.google.com/business/answer/7091' },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: 'février 2026' },
      { label: 'Google Search Central, créer des contenus utiles et fiables', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
      { label: 'Aggarwal et al., GEO: Generative Engine Optimization (KDD 2024)', url: 'https://arxiv.org/pdf/2311.09735', note: 'expérience en laboratoire ; la transposition aux moteurs actuels reste probable, pas démontrée' },
      { label: 'Google Search Central, liens de titre dans les résultats', url: 'https://developers.google.com/search/docs/appearance/title-link' },
      { label: 'Google Search Central, navigation à facettes', url: 'https://developers.google.com/crawling/docs/faceted-navigation' },
      { label: 'Anthropic, robots de Claude et robots.txt', url: 'https://support.claude.com/en/articles/8896518' },
      { label: 'Perplexity, robots d’exploration', url: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md' },
      { label: 'Chen et al., Université de Toronto, sources citées par les moteurs d’IA', url: 'https://arxiv.org/html/2509.08919v1', note: 'prépublication, septembre 2025' },
      { label: 'Fang et al., biais de fraîcheur des reclasseurs à base de LLM', url: 'https://arxiv.org/abs/2509.11353v1', note: 'expérience en laboratoire' },
      { label: 'Google Search Central, règles relatives au spam', url: 'https://developers.google.com/search/docs/essentials/spam-policies' },
      { label: 'Search Engine Journal, llms.txt sans effet net sur 300 000 domaines', url: 'https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/', note: 'étude SE Ranking, novembre 2025 ; corrélation' },
      { label: 'Aide Search Console, impressions, position et clics (dont aperçus IA et mode IA)', url: 'https://support.google.com/webmasters/answer/7042828?hl=en' },
    ],
    cta: { text: 'Voyez votre site comme Google et les IA le voient : accès, identité, pages, technique.', ...CTA },
    related: ['seo-local-et-ia', 'robots-ia-robots-txt', 'donnees-structurees-utiles', 'search-console-debutants', 'core-web-vitals-sans-jargon', 'fiche-produit-et-ia'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO local et IA                                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-local-et-ia',
    seoTitle: 'Être recommandé par Google Maps et ChatGPT : le guide',
    title: 'SEO local et IA : ce qui fait recommander un commerce en 2026',
    description:
      'Fiche Google, coordonnées cohérentes, pages par ville, avis, annuaires : ce qui fait recommander un commerce sur Google Maps et dans ChatGPT.',
    updated: D,
    published: D,
    intro: [
      '« Serrurier ouvert la nuit à Lyon 7 », « boulangerie sans gluten près de la Croix-Rousse » : ces recherches se tapent dans Google Maps et se demandent de plus en plus à ChatGPT. Dans les deux cas, le commerce recommandé est celui dont les informations sont complètes, cohérentes et confirmées ailleurs.',
      'Prenons un exemple fictif tout au long de ce guide : Plomberie Martin, deux salariés, installée à Lyon 3e, qui intervient aussi à Villeurbanne et Bron.',
    ],
    sections: [
      {
        h2: 'Les trois critères de Google pour les commerces locaux',
        paras: [
          'Google explique que les résultats locaux dépendent de trois critères : la pertinence (votre fiche correspond-elle à la recherche ?), la distance et la notoriété (avis, liens, articles, présence sur le web) [1]. Vous ne contrôlez pas la distance. Vous contrôlez la pertinence, et en partie la notoriété.',
          'Pour Plomberie Martin, la pertinence passe par une catégorie principale exacte (« Plombier », pas « Entreprise de construction »), des catégories secondaires justes, des horaires à jour, y compris les jours fériés, et une description qui dit ce qu’elle fait vraiment.',
        ],
      },
      {
        h2: 'Ce qu’une IA regarde pour choisir un commerce',
        paras: [
          'Un assistant avec recherche web lit des pages : votre site, votre fiche quand elle est accessible, des annuaires, des avis, des articles. Une étude de BrightLocal sur des recherches locales observe que les assistants s’appuient largement sur les plateformes de fiches et d’avis [2] ; l’échantillon est petit, mais la tendance est cohérente avec ce que nous mesurons.',
          'Une IA ne « connaît » pas votre quartier : elle reprend ce qu’elle trouve. Si trois annuaires donnent un ancien numéro, elle peut le répéter. C’est pourquoi la cohérence prime.',
        ],
      },
      {
        h2: 'Le triangle de cohérence : site, fiche, annuaires',
        figure: 'triangle-nap',
        paras: [
          'Nom, adresse, téléphone (NAP en anglais) doivent être identiques sur votre site, votre fiche Google et les annuaires qui comptent dans votre métier. « Plomberie Martin », « Martin Plomberie » et « SARL Martin » sont trois entreprises différentes pour un robot pressé.',
        ],
        list: [
          'Choisissez une forme officielle du nom, et tenez-vous-y partout.',
          'Une seule adresse et un seul numéro principal ; si vous avez un numéro de suivi d’appels, gardez le numéro principal en premier.',
          'Mettez ces informations en texte sur votre site (pied de page, page contact), pas seulement dans une image.',
          'Reprenez-les dans un balisage LocalBusiness (ou son sous-type, comme Plumber), avec le nom et l’adresse, qui sont obligatoires selon Google [3].',
        ],
      },
      {
        h2: 'Des pages par service et par ville, sans tricher',
        paras: [
          'Une page « Débouchage de canalisations à Villeurbanne » a du sens si vous y intervenez vraiment et si elle dit quelque chose de propre à cette ville : délais d’intervention, quartiers couverts, chantiers réalisés. Cent pages identiques où seul le nom de la ville change sont ce que Google appelle des pages satellites, contraires à ses règles [4].',
          'Une bonne page locale répond en tête à la question : « Plomberie Martin intervient à Villeurbanne sous 2 heures en semaine, débouchage à partir de 89 € TTC. » Cette phrase est utile au client, lisible par Google, et citable telle quelle par une IA.',
        ],
      },
      {
        h2: 'Les avis : nombre, fraîcheur, réponses',
        paras: [
          'Les avis font partie de la notoriété locale selon Google [1]. Ce qui compte : des avis réguliers, des réponses courtes et précises, et des avis qui parlent du service (« fuite réparée un dimanche matin, devis respecté »).',
          'Interdits : acheter des avis, en rédiger soi-même, en échanger contre une remise sans le dire. En France, les fausses pratiques autour des avis relèvent des pratiques commerciales trompeuses [5].',
        ],
      },
      {
        h2: 'Les annuaires qui comptent vraiment',
        paras: [
          'Inutile de s’inscrire sur 200 annuaires. Commencez par ceux qui apparaissent quand vous cherchez votre métier et votre ville, et par les sources que les IA citent dans leurs réponses pour votre activité : c’est mesurable en leur posant vos questions clients et en notant les sites cités.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il un site si l’on a une bonne fiche Google ?', a: 'Oui, si vous voulez être cité par les IA : beaucoup d’assistants lisent les sites web plus facilement que les fiches. Un site d’une page claire vaut mieux que pas de site.' },
      { q: 'Combien de pages par ville créer ?', a: 'Autant que de villes où vous intervenez vraiment et où vous avez quelque chose de spécifique à dire. Pour un artisan, c’est souvent trois à dix, pas cent.' },
      { q: 'Les IA lisent-elles les avis Google ?', a: 'Cela dépend de l’assistant et de son accès aux données ; Google ne publie pas de détail pour Gemini. Les avis publiés sur des plateformes ouvertes sont plus faciles à lire pour les autres assistants.' },
    ],
    sources: [
      { label: 'Aide Google Business Profile, conseils pour améliorer son classement local', url: 'https://support.google.com/business/answer/7091' },
      { label: 'BrightLocal, les assistants d’IA et les sources de fiches locales', url: 'https://brightlocal.com/blog/ai-search-using-listings-sources', note: '20 recherches dans 10 secteurs : échantillon restreint' },
      { label: 'Google Search Central, données structurées LocalBusiness', url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business' },
      { label: 'Google Search Central, règles relatives au spam (pages satellites)', url: 'https://developers.google.com/search/docs/essentials/spam-policies' },
      { label: 'Légifrance, article L121-4 du Code de la consommation', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107' },
    ],
    cta: { text: 'Votre nom, votre adresse et votre téléphone sont-ils les mêmes partout sur votre site ? L’analyse le vérifie page par page.', ...CTA },
    related: ['seo-geo-sites-pros-2026', 'donnees-structurees-utiles', 'avis-clients-ia', 'ia-disent-des-choses-fausses'],
  },

  /* ------------------------------------------------------------------ */
  /* Données structurées utiles                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: 'donnees-structurees-utiles',
    seoTitle: 'Données structurées : celles qui servent en 2026',
    title: 'Données structurées : celles qui servent encore en 2026, et celles à oublier',
    description:
      'Les balisages schema.org qui servent encore à Google et aux IA en 2026, ceux que Google a retirés (FAQ, HowTo…) et l’erreur à ne jamais faire.',
    updated: D,
    published: D,
    intro: [
      'Les données structurées décrivent votre page dans un langage commun aux robots (schema.org), le plus souvent en JSON-LD. Elles ont été vendues comme un passe-droit vers les étoiles et les encadrés de Google. En 2026, la réalité est plus sobre : Google a retiré plusieurs affichages, mais un petit nombre de balisages reste très utile, à Google comme aux IA.',
    ],
    sections: [
      {
        h2: 'Ce que Google a retiré, et quand',
        list: [
          'HowTo : retiré des résultats en 2023 [1].',
          'En juin 2025, Google a annoncé l’arrêt de plusieurs affichages, dont Course Info, ClaimReview, Estimated Salary, Learning Video, Special Announcement et Vehicle Listing [2].',
          'FAQ : Google n’affiche plus les questions-réponses enrichies depuis mai 2026 [3]. Le balisage FAQPage reste valide, mais il ne produit plus d’encadré.',
          'Le champ de recherche des liens annexes (Sitelinks Search Box) a disparu en novembre 2024 [2].',
        ],
        after: ['Retiré de l’affichage ne veut pas dire nuisible : un balisage FAQPage qui reprend des questions visibles ne fait pas de mal. Mais n’en attendez plus d’encadré dans Google.'],
      },
      {
        h2: 'Les balisages qui servent encore',
        list: [
          'Organization (ou LocalBusiness et ses sous-types pour un commerce) : votre identité, adresse, téléphone, logo et profils officiels (sameAs). Pour un commerce, Google exige au minimum le nom et l’adresse [4].',
          'Product et Offer : nom, image, prix, devise, disponibilité, retours, livraison. Indispensable en e-commerce pour les fiches marchandes de Google [5].',
          'Article ou BlogPosting : auteur, date de publication, date de mise à jour. Utile pour la fraîcheur et l’attribution.',
          'BreadcrumbList : le fil d’Ariane, qui aide Google à comprendre la structure du site.',
          'Event, Recipe, VideoObject, JobPosting : si votre activité s’y prête, ils restent dans la galerie de Google [6].',
        ],
      },
      {
        h2: 'La règle d’or : refléter ce qui est visible',
        figure: 'jsonld-visible',
        paras: [
          'Google le dit sans ambiguïté : le balisage doit décrire le contenu visible de la page [7]. Un prix balisé à 29 € quand la page affiche 34 €, des horaires balisés qui ne sont pas ceux de la page, une note moyenne inventée : ce sont des erreurs, et elles peuvent priver le site de tout affichage enrichi.',
          'Cas fréquent : les avis « auto-attribués ». Une entreprise qui balise sur son propre site une note moyenne de ses clients n’est pas éligible aux étoiles pour LocalBusiness ou Organization [8].',
        ],
      },
      {
        h2: 'Ce que les données structurées changent pour les IA',
        paras: [
          'Google précise que les données structurées ne sont pas nécessaires pour apparaître dans ses aperçus IA, mais qu’elles doivent concorder avec le texte visible [9]. Bing, dont l’index alimente Copilot, recommande le JSON-LD pour les produits, avis, FAQ et événements [10]. Pour les autres assistants, aucun effet direct sur les citations n’est démontré.',
          'Notre position : les balisages d’identité (Organization, LocalBusiness) et de produit (Product, Offer) sont utiles parce qu’ils lèvent les ambiguïtés ; le reste est secondaire.',
        ],
      },
      {
        h2: 'Exemple minimal pour un commerce',
        paras: [
          'Pour Plomberie Martin (entreprise fictive), un bloc JSON-LD dans la page d’accueil suffit : type Plumber, nom, adresse complète, téléphone, horaires, zone servie et lien vers la fiche Google. Validez-le avec le test des résultats enrichis de Google et le validateur de schema.org avant de le publier.',
        ],
      },
    ],
    faq: [
      { q: 'JSON-LD, microdonnées ou RDFa ?', a: 'Google accepte les trois et recommande le JSON-LD, plus simple à maintenir parce qu’il est séparé du HTML visible.' },
      { q: 'Mon extension SEO ajoute déjà du balisage, est-ce suffisant ?', a: 'Souvent pour Organization et BreadcrumbList. Vérifiez qu’elle reprend la bonne adresse et le bon téléphone, et qu’elle n’ajoute pas de note moyenne auto-attribuée.' },
      { q: 'Faut-il supprimer mon balisage FAQ ?', a: 'Non, s’il reprend des questions visibles. Il ne produit plus d’encadré dans Google, mais il reste un résumé lisible de vos réponses.' },
    ],
    sources: [
      { label: 'Google Search Central, changements HowTo et FAQ (2023)', url: 'https://developers.google.com/search/blog/2023/08/howto-faq-changes' },
      { label: 'Google Search Central, simplification des résultats (juin 2025)', url: 'https://developers.google.com/search/blog/2025/06/simplifying-search-results' },
      { label: 'Search Engine Journal, Google abandonne les résultats enrichis FAQ', url: 'https://www.searchenginejournal.com/google-drops-faq-rich-results/574429/', note: 'mai 2026' },
      { label: 'Google Search Central, données structurées LocalBusiness', url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business' },
      { label: 'Google Search Central, données structurées Product', url: 'https://developers.google.com/search/docs/appearance/structured-data/product' },
      { label: 'Google Search Central, galerie des résultats enrichis', url: 'https://developers.google.com/search/docs/appearance/structured-data/search-gallery' },
      { label: 'Google Search Central, règles générales des données structurées', url: 'https://developers.google.com/search/docs/appearance/structured-data/sd-policies' },
      { label: 'Google Search Central, extraits d’avis (avis auto-attribués)', url: 'https://developers.google.com/search/docs/appearance/structured-data/review-snippet' },
      { label: 'Google Search Central, fonctionnalités IA et votre site', url: 'https://developers.google.com/search/docs/appearance/ai-features' },
      { label: 'Search Engine Journal, consignes Bing 2026', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/' },
    ],
    cta: { text: 'Votre balisage est-il valide, complet et conforme à ce que la page affiche ? L’analyse le vérifie type par type.', ...CTA },
    related: ['seo-geo-sites-pros-2026', 'seo-local-et-ia', 'fiche-produit-et-ia'],
  },

  /* ------------------------------------------------------------------ */
  /* Search Console pour débutants                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'search-console-debutants',
    seoTitle: 'Search Console pour débutants : le guide pratique',
    title: 'La Search Console pour débutants : quatre rapports qui suffisent',
    description:
      'Clics, impressions, CTR, position : quatre rapports de la Search Console pour repérer ce qui décroche, sans jargon, aperçus IA de Google compris.',
    updated: D,
    published: D,
    intro: [
      'La Search Console est l’outil gratuit de Google pour les propriétaires de sites. Elle dit ce que Google montre de vous, ce qui est cliqué et ce qui bloque. Beaucoup de dirigeants l’ont installée un jour, puis ne l’ont plus ouverte. Quatre rapports suffisent pour en tirer l’essentiel en quinze minutes par mois.',
    ],
    sections: [
      {
        h2: 'Quatre mots à comprendre',
        figure: 'sc-entonnoir',
        list: [
          'Impression : un lien vers votre site a été affiché (ou potentiellement vu) dans les résultats [1].',
          'Clic : quelqu’un a cliqué ce lien et quitté Google pour votre page [1].',
          'CTR : la part des impressions qui deviennent des clics.',
          'Position moyenne : la place la plus haute de votre lien pour chaque recherche, moyennée sur toutes les recherches où vous êtes apparu [1]. Plus le chiffre est petit, mieux c’est.',
        ],
        after: [
          'Bon à savoir : depuis 2025, les clics et impressions des aperçus IA et du mode IA de Google sont comptés dans ces chiffres. Un aperçu IA occupe une position, partagée par tous les liens qu’il contient [1]. La Search Console ne les isole pas dans un rapport à part.',
        ],
      },
      {
        h2: 'Rapport 1 : Performance, les requêtes qui vous amènent des clients',
        paras: [
          'Ouvrez « Performances », cochez les quatre indicateurs, choisissez les trois derniers mois, puis l’onglet « Requêtes » [2]. Vous voyez les recherches qui affichent votre site. Exemple fictif pour Plomberie Martin : « plombier lyon 3 » (1 200 impressions, 48 clics, position 6,3) et « fuite chauffe-eau lyon » (400 impressions, 5 clics, position 11,8).',
          'Deux lectures utiles : une requête avec beaucoup d’impressions et peu de clics appelle un meilleur titre ou une meilleure description ; une requête en position 8 à 15 est souvent la plus facile à faire monter, avec une page qui lui répond mieux.',
        ],
      },
      {
        h2: 'Rapport 2 : Pages, celles qui décrochent',
        paras: [
          'Dans le même rapport, l’onglet « Pages » et la comparaison de deux périodes (par exemple ce trimestre contre le même trimestre de l’an dernier) montrent les pages qui perdent des clics. La Search Console garde 16 mois de données [3] : assez pour comparer une saison à la précédente.',
        ],
      },
      {
        h2: 'Rapport 3 : Indexation des pages',
        paras: [
          'Le rapport « Pages » de la section Indexation liste ce que Google a indexé ou non, et pourquoi : page en noindex, redirigée, explorée mais non indexée, introuvable (404) [4]. Toutes les exclusions ne sont pas des erreurs : une page de mentions légales en noindex est un choix. Ce qui doit alerter : une page importante, service ou produit, marquée non indexée.',
        ],
      },
      {
        h2: 'Rapport 4 : Inspection d’URL',
        paras: [
          'Collez l’adresse d’une page en haut de l’écran : Google dit s’il l’a indexée, quand il l’a explorée pour la dernière fois et quelle version il considère comme canonique [5]. Après une correction, « Demander une indexation » accélère parfois la prise en compte, sans garantie.',
        ],
      },
      {
        h2: 'Ce que la Search Console ne dit pas',
        list: [
          'Ce que répondent ChatGPT, Perplexity ou Claude : rien de ces assistants n’y apparaît.',
          'Vos positions exactes à un instant donné : la position est une moyenne, sur toutes les recherches et tous les lieux.',
          'Toutes les requêtes : Google masque une partie des requêtes rares pour protéger la vie privée [6].',
        ],
      },
    ],
    faq: [
      { q: 'Comment ajouter mon site à la Search Console ?', a: 'Avec un compte Google, ajoutez une « propriété de domaine » et validez-la par un enregistrement DNS chez votre hébergeur, ou une « propriété avec préfixe d’URL » validée par une balise ou un fichier.' },
      { q: 'Pourquoi mes clics baissent alors que ma position ne bouge pas ?', a: 'Souvent parce que la page de résultats a changé : un aperçu IA, des annonces ou un encadré au-dessus des liens prennent l’attention. Comparez le CTR à position égale.' },
      { q: 'La Search Console remplace-t-elle Google Analytics ?', a: 'Non. La Search Console dit ce qui se passe dans Google avant le clic ; Analytics, ce que font les visiteurs après.' },
    ],
    sources: [
      { label: 'Aide Search Console, impressions, position et clics', url: 'https://support.google.com/webmasters/answer/7042828?hl=en' },
      { label: 'Aide Search Console, rapport Performances (résultats de recherche)', url: 'https://support.google.com/webmasters/answer/7576553?hl=en' },
      { label: 'Google, API Search Analytics (données disponibles)', url: 'https://developers.google.com/webmaster-tools/v1/searchanalytics/query' },
      { label: 'Aide Search Console, rapport d’indexation des pages', url: 'https://support.google.com/webmasters/answer/7440203' },
      { label: 'Aide Search Console, outil d’inspection d’URL', url: 'https://support.google.com/webmasters/answer/9012289' },
      { label: 'Google Search Central Blog, filtrage et limites des données de performance', url: 'https://developers.google.com/search/blog/2022/10/performance-data-deep-dive' },
    ],
    cta: { text: 'Connectez votre Search Console à Repéré : nous la lisons pour vous chaque semaine. Commencez par l’analyse gratuite du site.', ...CTA },
    related: ['seo-geo-sites-pros-2026', 'core-web-vitals-sans-jargon', 'trafic-chatgpt-ga4'],
  },

  /* ------------------------------------------------------------------ */
  /* Core Web Vitals sans jargon                                         */
  /* ------------------------------------------------------------------ */
  {
    slug: 'core-web-vitals-sans-jargon',
    seoTitle: 'Core Web Vitals expliqués sans jargon (2026)',
    title: 'Core Web Vitals sans jargon : la vitesse vue par vos vrais clients',
    description:
      'LCP, INP et CLS expliqués simplement : les seuils de Google, terrain contre labo, et les causes fréquentes sur les sites de commerces et de PME.',
    updated: D,
    published: D,
    intro: [
      'Les « Signaux Web essentiels » (Core Web Vitals) mesurent trois choses que vos visiteurs ressentent : le temps avant de voir le contenu principal, la réactivité quand ils cliquent, et la stabilité de la page pendant le chargement. Google les utilise dans son évaluation de l’expérience de page [1]. Ce n’est pas le critère principal de classement, mais un site lent perd des visiteurs avant même qu’ils lisent.',
    ],
    sections: [
      {
        h2: 'Les trois mesures, et leurs seuils',
        figure: 'cwv-seuils',
        list: [
          'LCP (Largest Contentful Paint) : le temps d’affichage du plus gros élément visible, souvent la photo principale ou le titre. Bon jusqu’à 2,5 secondes, mauvais au-delà de 4 [2].',
          'INP (Interaction to Next Paint) : le délai entre un clic, un toucher ou une frappe et la réaction visible de la page. Bon jusqu’à 200 millisecondes, mauvais au-delà de 500. L’INP a remplacé le FID en mars 2024 [3].',
          'CLS (Cumulative Layout Shift) : les sauts de mise en page, quand un bandeau ou une image décale le texte. Bon jusqu’à 0,1, mauvais au-delà de 0,25 [2].',
        ],
        after: ['Google juge chaque mesure au 75e centile des visites : il faut que trois visites sur quatre au moins soient bonnes [2].'],
      },
      {
        h2: 'Terrain contre labo : deux chiffres qui diffèrent',
        paras: [
          'Les données terrain viennent des navigateurs Chrome de vos vrais visiteurs, sur 28 jours (rapport CrUX) [4]. Ce sont elles que Google utilise. Les données labo viennent d’un test ponctuel (Lighthouse, dans PageSpeed Insights) : utiles pour trouver la cause, elles ne reflètent pas forcément l’expérience réelle.',
          'Un petit site n’a souvent pas assez de visites Chrome pour avoir des données terrain : PageSpeed Insights l’indique. Dans ce cas, les mesures labo et les bonnes pratiques prennent le relais.',
        ],
      },
      {
        h2: 'Les causes les plus fréquentes',
        list: [
          'Une photo d’accueil de 3 Mo, non compressée, ou chargée en différé alors qu’elle est en haut de page : c’est le premier suspect d’un mauvais LCP [5].',
          'Un bandeau cookies, une barre promotionnelle ou une image sans dimensions déclarées qui pousse le contenu vers le bas : CLS.',
          'Des scripts tiers (chat, publicité, suivi, avis) qui occupent le téléphone quand le visiteur clique : INP.',
          'Un hébergement lent : si le serveur met plus d’une seconde à répondre, tout le reste suit. Le TTFB, indicatif, est jugé bon jusqu’à 0,8 seconde [6].',
        ],
      },
      {
        h2: 'Par où commencer, selon votre site',
        list: [
          'Site vitrine sur WordPress : compresser et dimensionner les images, limiter les extensions, activer un cache.',
          'Boutique Shopify ou PrestaShop : faire l’inventaire des applications et scripts tiers, retirer ceux qui ne servent plus.',
          'Site B2B moderne : vérifier que le contenu principal ne dépend pas d’un gros paquet de JavaScript, ce qui aide aussi les robots d’IA à le lire.',
        ],
      },
    ],
    faq: [
      { q: 'Un score PageSpeed de 100 est-il nécessaire ?', a: 'Non. Le score labo est un indicateur. Ce qui compte pour Google, ce sont les trois mesures terrain au-dessus des seuils.' },
      { q: 'Mon site est rapide sur mon ordinateur, pourquoi serait-il lent ?', a: 'Parce que vos clients sont sur téléphone, avec un réseau moins bon et un processeur moins puissant. Google évalue d’abord la version mobile.' },
      { q: 'La vitesse aide-t-elle à être cité par les IA ?', a: 'Aucun effet direct n’est démontré. Une page qui répond lentement peut en revanche échouer à être lue par un robot pressé.' },
    ],
    sources: [
      { label: 'Google Search Central, Core Web Vitals et résultats de recherche', url: 'https://developers.google.com/search/docs/appearance/core-web-vitals' },
      { label: 'web.dev, Web Vitals (seuils et 75e centile)', url: 'https://web.dev/articles/vitals' },
      { label: 'web.dev, Interaction to Next Paint (INP)', url: 'https://web.dev/articles/inp' },
      { label: 'Chrome for Developers, Chrome UX Report (CrUX)', url: 'https://developer.chrome.com/docs/crux' },
      { label: 'web.dev, chargement différé des images et LCP', url: 'https://web.dev/articles/browser-level-image-lazy-loading' },
      { label: 'web.dev, Time to First Byte (TTFB)', url: 'https://web.dev/articles/ttfb' },
    ],
    cta: { text: 'Poids des pages, images sans dimensions, scripts bloquants : l’analyse les repère sur votre site, et PageSpeed complète quand c’est possible.', ...CTA },
    related: ['seo-geo-sites-pros-2026', 'search-console-debutants', 'fiche-produit-et-ia'],
  },
];

/**
 * Compléments V5 des guides existants (même adresse, même texte) : schéma, questions fréquentes, appel vers
 * l'analyse et liens vers le guide pilier.
 */
export const GUIDE_V5_EXTRAS: Record<string, { seoTitle?: string; figure?: { section: number; id: string }; faq: { q: string; a: string }[]; related?: string[] }> = {
  'robots-ia-robots-txt': {
    figure: { section: 0, id: 'robots-roles' },
    faq: [
      { q: 'Bloquer GPTBot me fait-il disparaître de ChatGPT ?', a: 'Non, selon OpenAI : GPTBot sert à l’entraînement. C’est OAI-SearchBot qui permet d’apparaître dans les réponses de recherche de ChatGPT, et les deux se règlent séparément.' },
      { q: 'Mon robots.txt autorise tout, suis-je tranquille ?', a: 'Pas forcément : un pare-feu ou un CDN peut bloquer les robots d’IA avant même qu’ils lisent votre robots.txt. Cloudflare les bloque par défaut pour ses nouveaux clients depuis juillet 2025.' },
      { q: 'Google-Extended contrôle-t-il les aperçus IA de Google ?', a: 'Non. Google-Extended concerne Gemini hors de la Recherche ; les aperçus IA et le mode IA dépendent de Googlebot.' },
    ],
    related: ['seo-geo-sites-pros-2026', 'core-web-vitals-sans-jargon'],
  },
  'fiche-produit-et-ia': {
    seoTitle: 'Rédiger des fiches produit que Google et les IA comprennent',
    figure: { section: 0, id: 'fiche-anatomie' },
    faq: [
      { q: 'Faut-il réécrire toutes ses fiches produit ?', a: 'Non : commencez par les 20 produits qui font l’essentiel du chiffre d’affaires et par ceux qui ont des impressions dans la Search Console sans clics.' },
      { q: 'La description du fabricant suffit-elle ?', a: 'Elle est reprise par tous vos concurrents. Ajoutez ce que vous seul savez : usage réel, compatibilités, questions de vos clients, conseils d’entretien.' },
      { q: 'Les onglets cachent-ils le texte aux robots ?', a: 'Le texte présent dans le HTML reste lisible, même replié. Le texte chargé seulement au clic, par script, peut échapper aux robots d’IA.' },
    ],
    related: ['seo-geo-sites-pros-2026', 'donnees-structurees-utiles'],
  },
};
