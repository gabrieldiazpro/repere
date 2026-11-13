/**
 * Guides V3 (mission CONTENU). Mêmes règles que guides.ts : aucune promesse de résultat, chaque affirmation chiffrée
 * ou technique renvoie à une source listée en fin de guide ([n]). Les points non vérifiés sont dits comme tels.
 * Sources de l'éditeur : documentation lue lors des relevés du 9 novembre 2026 (docs/v2/05-ai-sources.json, docs/v3/06).
 */
import type { Guide } from './guides';

const D = '2026-11-09';

export const GUIDES_V3: Guide[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: 'robots-ia-robots-txt',
    seoTitle: 'Robots d’IA : lesquels autoriser dans robots.txt',
    title: 'Robots d’IA : lesquels autoriser dans votre robots.txt',
    description:
      'GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended : à quoi sert chaque robot d’IA, ce que change son blocage, et une configuration type pour rester visible dans les réponses des assistants.',
    updated: D,
    published: D,
    intro: [
      'Votre fichier robots.txt décide quels robots lisent votre site. Pour les assistants d’IA, cette décision a une conséquence directe : un robot bloqué ne peut pas lire vos pages, et un assistant qui ne vous lit pas ne vous cite pas à partir de votre site. Beaucoup d’entreprises ont pourtant bloqué « les robots d’IA » en bloc, par prudence, sans savoir qu’elles se retiraient aussi des réponses de recherche.',
      'Ce guide distingue les trois rôles des robots, liste les principaux avec ce que dit leur éditeur, et propose une configuration. Il ne promet rien : autoriser un robot permet d’être lu, pas d’être cité.',
    ],
    sections: [
      {
        h2: 'Trois rôles à ne pas confondre',
        paras: [
          'Les éditeurs séparent désormais leurs robots par usage. C’est ce qui permet de refuser l’entraînement des modèles tout en restant présent dans les réponses. Trois rôles reviennent chez OpenAI, Anthropic et Perplexity [1][2][3].',
        ],
        list: [
          'Entraînement : le robot collecte des pages pour entraîner les modèles. Le bloquer ne vous retire pas des réponses de recherche, et il ne vous apporte pas de visites en retour.',
          'Recherche (index) : le robot construit l’index que l’assistant interroge quand il cherche sur le web. Le bloquer vous retire de ces réponses.',
          'Visite à la demande : le robot lit une page parce qu’un utilisateur vient de poser une question qui la concerne. C’est le signal le plus proche d’une citation en cours, mais ce n’est pas un clic humain sur votre site.',
        ],
      },
      {
        h2: 'Les robots principaux, un par un',
        paras: ['Les noms ci-dessous sont ceux publiés par les éditeurs à la date de ce guide. Ils changent : revérifiez-les chaque trimestre.'],
        list: [
          'GPTBot (OpenAI, entraînement) : OpenAI précise que le bloquer n’affecte pas l’apparition de votre site dans la recherche de ChatGPT [1].',
          'OAI-SearchBot (OpenAI, recherche) : il alimente l’index de la recherche de ChatGPT. Selon OpenAI, un changement dans le robots.txt est pris en compte en 24 heures environ [1].',
          'ChatGPT-User (OpenAI, visite à la demande) : lecture déclenchée par un utilisateur. OpenAI indique que, s’agissant d’une action de l’utilisateur, les règles du robots.txt peuvent ne pas s’appliquer [1].',
          'ClaudeBot, Claude-SearchBot, Claude-User (Anthropic) : respectivement entraînement, index de recherche et visite à la demande. Anthropic a mis à jour sa documentation sur ses robots, et la chaîne exacte du user agent de ClaudeBot doit être validée sur vos journaux [3].',
          'PerplexityBot (index) et Perplexity-User (visite à la demande) : Perplexity annonce que PerplexityBot n’est pas utilisé pour l’entraînement, et que Perplexity-User ignore généralement le robots.txt, car il agit pour un utilisateur [2].',
          'Google-Extended : ce n’est pas un robot mais un jeton du robots.txt. Il contrôle l’usage de vos pages pour l’entraînement et l’ancrage de Gemini, et reste sans effet sur Google Search, les AI Overviews et l’AI Mode, qui reposent sur l’index de Googlebot [4].',
          'Googlebot et Bingbot : les robots de recherche de Google et Microsoft. Les aperçus IA de Google s’appuient sur l’index de Googlebot, et l’index de Bing alimente notamment Copilot. Bloquer l’un d’eux vous retire du moteur correspondant et de ce qui en dépend.',
          'Applebot et Applebot-Extended : Applebot indexe pour Siri, Spotlight et Safari ; Applebot-Extended est un jeton qui autorise ou non l’entraînement des modèles d’Apple [5].',
          'CCBot (Common Crawl), Bytespider (ByteDance), Meta-ExternalAgent : robots d’entraînement. Le respect du robots.txt par Bytespider est contesté par des tiers, ce qui conduit certains sites à le bloquer au niveau du serveur.',
        ],
      },
      {
        h2: 'Que bloquer, que laisser ?',
        paras: [
          'Il n’y a pas de bonne réponse unique : c’est un choix éditorial. Voici une grille de lecture honnête.',
        ],
        list: [
          'Vous voulez être cité : autorisez les robots de recherche (OAI-SearchBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Applebot) et les robots de visite à la demande (ChatGPT-User, Claude-User, Perplexity-User, MistralAI-User). Ce sont eux qui lisent vos pages au moment où quelqu’un pose une question.',
          'Vous refusez que vos contenus servent à entraîner des modèles : bloquez GPTBot, ClaudeBot, CCBot, Google-Extended et Applebot-Extended. Vous gardez votre présence dans les réponses de recherche, mais vous perdez la chance d’être « connu » du modèle sans recherche web.',
          'Vous publiez du contenu payant ou sous licence : bloquez aussi les robots de recherche sur ces seules sections, avec des règles par dossier.',
          'Vous hésitez : autorisez la recherche et la visite à la demande, et décidez de l’entraînement plus tard. L’autorisation se retire en quelques lignes, la visibilité perdue se regagne lentement.',
        ],
        after: ['Repéré applique ce choix à son propre site : robots de recherche et de visite autorisés, et, par décision assumée, robots d’entraînement autorisés aussi. Vous pouvez le vérifier sur notre fichier robots.txt.'],
      },
      {
        h2: 'Une configuration type',
        paras: [
          'Le standard du robots.txt est décrit dans la RFC 9309 : un groupe commence par une ou plusieurs lignes « User-agent », suivies de règles « Allow » et « Disallow » [6]. Un exemple qui refuse l’entraînement et garde la recherche :',
          'User-agent: GPTBot / Disallow: / ; User-agent: ClaudeBot / Disallow: / ; User-agent: CCBot / Disallow: / ; User-agent: Google-Extended / Disallow: / ; User-agent: Applebot-Extended / Disallow: / ; puis, pour tous les autres robots, « User-agent: * » et « Allow: / ».',
          'Ne laissez pas un « User-agent: * / Disallow: / » général sans exceptions : il bloque tous les robots qui n’ont pas leur propre groupe, y compris ceux de recherche. C’est l’erreur la plus fréquente, souvent héritée d’un site de préproduction oublié.',
        ],
      },
      {
        h2: 'Ce que robots.txt ne fait pas',
        list: [
          'Il ne protège rien : c’est une demande de bonne conduite, pas un contrôle d’accès. Un robot malveillant l’ignore.',
          'Il n’efface pas ce qui a déjà été collecté. Pour retirer un contenu, il faut agir auprès de l’éditeur.',
          'Il ne remplace pas la lisibilité : un robot autorisé qui ne trouve que du JavaScript ne lira rien. Les robots d’IA n’exécutent en général pas de JavaScript ; servez le texte dans le HTML initial.',
          'Il ne se vérifie pas à l’œil : un user agent est usurpable. Pour confirmer qu’une visite vient bien d’un éditeur, comparez l’adresse IP aux listes publiées par celui-ci.',
        ],
      },
      {
        h2: 'Vérifier votre fichier en cinq minutes',
        list: [
          'Ouvrez votre-site.fr/robots.txt dans un navigateur et lisez-le ligne à ligne.',
          'Cherchez un « Disallow: / » dans le groupe « User-agent: * », ou dans un groupe visant un robot de recherche d’IA.',
          'Vérifiez que le fichier n’est pas servi avec une erreur (code 4xx ou 5xx) : selon la RFC 9309, un code 4xx est traité comme l’absence de fichier (tout est autorisé) et un code 5xx comme une interdiction provisoire de tout lire [6].',
          'Si vous utilisez un service de protection (pare-feu, CDN), vérifiez qu’il ne bloque pas les robots autorisés dans votre fichier : le robots.txt peut dire oui pendant que le pare-feu dit non.',
          'Consultez vos journaux sur 30 jours pour voir quels robots passent réellement.',
        ],
        after: ['Notre outil gratuit d’analyse du robots.txt fait cette lecture robot par robot et indique la ligne concernée. Le fichier llms.txt, lui, n’est pas un robots.txt : il n’autorise ni n’interdit rien, et une étude d’Ahrefs ne montre pas d’effet démontré sur les citations [7].'],
      },
    ],
    sources: [
      { label: 'OpenAI, documentation des robots (GPTBot, OAI-SearchBot, ChatGPT-User)', url: 'https://developers.openai.com/api/docs/bots.md', note: 'Documentation de l’éditeur, relevée le 9 novembre 2026.' },
      { label: 'Perplexity, documentation des robots (PerplexityBot, Perplexity-User)', url: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md', note: 'Documentation de l’éditeur, relevée le 9 novembre 2026.' },
      { label: 'Search Engine Roundtable, Anthropic met à jour la documentation de ses robots', url: 'https://www.seroundtable.com/anthropic-updates-its-crawler-docs-40978.html', note: 'Source secondaire : vérifiez les noms sur la documentation d’Anthropic.' },
      { label: 'PPC Land, Google-Extended', url: 'https://ppc.land/google-extended/', note: 'Source secondaire : vérifiez sur la documentation de Google.' },
      { label: 'PPC Land, Applebot', url: 'https://ppc.land/applebot/', note: 'Source secondaire : vérifiez sur la documentation d’Apple.' },
      { label: 'IETF, RFC 9309 : Robots Exclusion Protocol', url: 'https://www.rfc-editor.org/rfc/rfc9309' },
      { label: 'Ahrefs, étude llms.txt (juin 2026)', url: 'https://ahrefs.com/blog/llmstxt-study/' },
    ],
    cta: { text: 'Vérifiez, robot par robot, ce que votre robots.txt autorise.', href: '/outils', label: 'Analyser mon robots.txt' },
    related: ['page-que-les-ia-citent', 'apparaitre-dans-chatgpt-pme', 'trafic-chatgpt-ga4'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'page-que-les-ia-citent',
    seoTitle: 'Écrire une page que les IA citent : 9 règles',
    title: 'Écrire une page que les IA citent : la méthode en 9 règles',
    description:
      'Réponse en tête, intertitres en questions, chiffres sourcés, auteur et date : neuf règles de rédaction, issues des 20 contrôles de notre audit de page, pour qu’une page soit facile à reprendre par un assistant.',
    updated: D,
    published: D,
    intro: [
      'Quand un assistant cherche sur le web pour répondre, il lit des passages, pas des pages entières. Une page facile à citer est une page dont un passage répond à la question sans avoir besoin de son contexte. Ce guide donne neuf règles de rédaction pour y arriver.',
      'Ces règles regroupent les 20 contrôles de notre score de citabilité, dont la liste complète est publiée sur la page Méthode. Précision importante : ce sont des bonnes pratiques de rédaction, pas une mesure de ce que fait ChatGPT. Une page peut tout respecter sans être citée, et aucune étude ne permet de promettre l’inverse.',
    ],
    sections: [
      {
        h2: 'Règle 1 : répondez dans les 60 premiers mots',
        paras: [
          'Ouvrez par une phrase qui répond seule à la question principale : qui, quoi, où, combien. Évitez « Bienvenue », « Découvrez » et les introductions d’intention. Notre audit pèse cette règle plus lourdement que les autres (10 points sur 100), parce qu’un assistant qui prélève un passage prend d’abord le début de la section.',
          'Exemple pour un chauffagiste : « Un contrat d’entretien de chaudière gaz coûte entre X et Y euros par an à Lyon, visite annuelle et déplacement compris. » Remplacez X et Y par vos tarifs réels : un chiffre vague ne se cite pas.',
        ],
      },
      {
        h2: 'Règle 2 : titrez avec les questions de vos clients',
        paras: [
          'Reformulez vos intertitres comme les questions qu’on vous pose : « Combien coûte… ? », « Quel délai pour… ? », « Faut-il… ? ». Ils correspondent aux requêtes que les assistants reçoivent et facilitent le découpage en passages. Gardez une hiérarchie propre : un seul H1, puis des H2 et H3 qui annoncent chacun une section courte.',
        ],
      },
      {
        h2: 'Règle 3 : une idée par paragraphe, 2 à 4 phrases',
        paras: [
          'Notre audit signale les paragraphes de plus de 120 mots. Un passage long mélange plusieurs idées, et l’assistant n’en reprend aucune proprement. Utilisez des listes pour les étapes, les critères et les services, et un vrai tableau HTML, avec cellules d’en-tête, pour comparer des offres, des prix ou des délais.',
        ],
      },
      {
        h2: 'Règle 4 : des faits chiffrés, et sourcés',
        paras: [
          'Prix, délais, zone d’intervention, années d’expérience, nombre de clients réels : un fait précis peut être cité, une généralité non. Quand le chiffre ne vient pas de vous, liez la source (texte officiel, étude, fabricant). Deux sources externes liées suffisent pour que la règle soit validée, une seule vaut la moitié des points.',
          'Nous n’avons pas de mesure publique qui prouve qu’un chiffre sourcé augmente les chances d’être cité : c’est une hypothèse raisonnable, pas un résultat. Ce qui est certain, c’est qu’un passage vague ne peut rien apporter à une réponse. Les recherches publiques montrent surtout que les réponses varient fortement d’une exécution à l’autre [1] : mesurez donc l’effet de vos corrections sur plusieurs questions et plusieurs exécutions.',
        ],
      },
      {
        h2: 'Règle 5 : datez et signez',
        paras: [
          'Affichez « Mis à jour le [date] » près du titre, et tenez-le à jour quand vous modifiez la page : une date de métadonnées non affichée ne vaut que la moitié des points. Signez avec un nom, une fonction et une ligne d’expérience. Google invite, dans sa documentation sur les contenus générés par IA, à se demander qui a produit un contenu et comment, et à l’indiquer clairement quand c’est utile [2].',
        ],
      },
      {
        h2: 'Règle 6 : définissez et nommez précisément',
        paras: [
          'Définissez le terme clé en une phrase (« Un ramoneur certifié est… »), puis nommez les entités : votre marque, votre ville, vos quartiers, vos produits, vos certifications. Évitez « nous » et « ici » sans référent : un passage prélevé hors de la page doit rester compréhensible. Affichez vos coordonnées en texte, pas seulement dans une image.',
        ],
      },
      {
        h2: 'Règle 7 : une section de questions fréquentes',
        paras: [
          'Cinq à dix questions réelles de vos clients, avec des réponses courtes. Vous pouvez les baliser en FAQPage : le balisage doit reprendre exactement le texte visible, rien de plus. Si vous n’avez pas de questions réelles, regardez celles que vos clients posent par téléphone et par e-mail, ou celles suggérées par vos mesures dans Repéré.',
        ],
      },
      {
        h2: 'Règle 8 : une longueur utile, et des liens internes',
        paras: [
          'Visez au moins 300 mots utiles : réponses, détails, exemples, chiffres. À l’inverse, une page démesurée mélange plusieurs sujets : scindez-la en pages thématiques reliées entre elles par des liens explicites vers vos services, tarifs et contact.',
        ],
      },
      {
        h2: 'Règle 9 : une base technique lisible par un robot',
        paras: [
          'Servez le texte dans le HTML initial : les robots d’IA n’exécutent en général pas le JavaScript, et une page qui n’affiche son contenu qu’après chargement apparaît vide. Faites correspondre le titre et le H1 au sujet réel, déclarez l’adresse canonique, ajoutez un JSON-LD valide qui reprend ce qui est visible, et vérifiez que votre robots.txt autorise les robots de recherche (voir notre guide sur le sujet).',
        ],
        after: ['Ces neuf règles recouvrent nos 20 contrôles : réponse directe, titres en questions, structure, paragraphes courts, listes, tableaux, chiffres, sources, date, auteur, définitions, FAQ, longueur, liens internes, entités, coordonnées, données structurées, lisibilité sans JavaScript, cohérence du titre, adresse canonique.'],
      },
      {
        h2: 'Un exemple avant et après',
        paras: [
          'Avant : « Bienvenue chez Dupont Chauffage ! Depuis des années, notre équipe passionnée vous accompagne dans tous vos projets de confort thermique. N’hésitez pas à nous contacter. » Cette ouverture ne contient aucun fait : aucun assistant ne peut en tirer une réponse, et les trois quarts de ses mots n’informent personne.',
          'Après : « Dupont Chauffage entretient et dépanne les chaudières gaz à Lyon et dans le Grand Lyon depuis 2009. Un entretien annuel coûte 120 euros TTC, déplacement compris ; un dépannage en urgence est assuré sous 4 heures en semaine. » Les chiffres de cet exemple sont fictifs : écrivez les vôtres, et seulement s’ils sont vrais et tenables. La seconde version peut être citée telle quelle, et elle sert aussi votre client qui lit la page.',
        ],
      },
      {
        h2: 'Les erreurs les plus fréquentes',
        list: [
          'Cacher l’information utile dans un PDF, une image ou un onglet chargé par JavaScript : le robot ne la voit pas.',
          'Empiler des généralités (« qualité, proximité, savoir-faire ») au lieu de faits vérifiables.',
          'Copier-coller une description fournie par un fabricant ou un confrère : une page identique à des dizaines d’autres n’a aucune raison d’être préférée.',
          'Dater la page d’une année passée sans jamais la relire : une date ancienne sur un tarif périmé nuit plus qu’elle ne rassure.',
          'Balisage de FAQ qui reprend des questions absentes du texte visible : le balisage doit refléter la page, jamais la compléter.',
          'Faire écrire cent pages en série par une IA sans les relire : elles se ressemblent, se trompent et n’apportent rien aux lecteurs.',
        ],
      },
      {
        h2: 'Par où commencer',
        list: [
          'Choisissez une page qui compte (un service, un produit, une page de tarifs).',
          'Réécrivez les 60 premiers mots, ajoutez la date et la signature : ce sont les trois gains les plus rapides.',
          'Passez la page à l’audit de citabilité, corrigez les contrôles en échec, puis relancez-le.',
          'Mesurez ensuite sur vos questions : l’audit de page dit si la page est bien écrite, seule la mesure des réponses dit si l’assistant vous cite.',
        ],
      },
    ],
    sources: [
      { label: 'SparkToro et Gumshoe, variabilité des recommandations des IA (Search Engine Journal)', url: 'https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/', note: 'Montre surtout que les réponses varient : mesurez des fréquences, pas un rang. Ne prouve pas l’effet des règles ci-dessus.' },
      { label: 'Google Search Central, contenu généré par IA et qualité', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', note: 'Documentation de l’éditeur.' },
    ],
    cta: { text: 'Testez une de vos pages sur les 20 règles et voyez quoi corriger en premier.', href: '/outils', label: 'Auditer une page' },
    related: ['robots-ia-robots-txt', 'apparaitre-dans-chatgpt-pme', 'ia-disent-des-choses-fausses'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'fiche-produit-et-ia',
    seoTitle: 'Fiche produit et IA : ce que ChatGPT lit vraiment',
    title: 'Fiche produit et IA : ce que ChatGPT lit vraiment',
    description:
      'Données structurées Product et Offer, attributs, avis, flux produit : ce que les assistants peuvent lire sur une fiche produit, ce qui reste incertain, et une liste de contrôle pour votre boutique.',
    updated: D,
    published: D,
    intro: [
      'Quand un acheteur demande à un assistant « quelle crème solaire visage pour peau sensible, moins de 30 euros ? », la réponse mélange des marques, des attributs et parfois des prix. D’où viennent-ils ? Pour une part, de vos fiches produit. Pour une autre, de comparatifs, d’avis et de marketplaces, que vous ne contrôlez pas.',
      'Ce guide sépare ce qui est documenté de ce qui ne l’est pas. La conclusion honnête : personne, hors des éditeurs, ne sait exactement ce que lit chaque assistant, et aucun éditeur ne publie de critère garanti pour apparaître dans ses résultats d’achat.',
    ],
    sections: [
      {
        h2: 'Ce que les assistants lisent : trois canaux',
        list: [
          'Le web ouvert : l’assistant cherche, lit des pages (la vôtre, celles de revendeurs, de comparatifs, de forums) et s’appuie sur ce qu’il trouve. C’est le canal où votre fiche est lue comme n’importe quelle page.',
          'Les flux produit : selon Lengow, ChatGPT dispose d’une spécification de flux produit, avec des champs obligatoires (identifiant, titre, description, image, prix, disponibilité, marque, catégorie) et recommandés (notes, GTIN, variantes) [1]. Selon la même source, OpenAI n’a publié aucun critère d’éligibilité : le programme serait en bêta limitée, marché par marché, sans date annoncée pour la France [2]. Lengow vend des outils de flux : vérifiez auprès d’OpenAI.',
          'Les plateformes : Shopify active automatiquement des vitrines pour agents sur les boutiques admissibles, avec un tableau de bord qui évalue la qualité des fiches ; ses conditions d’éligibilité et ses pays ne sont pas détaillés [3].',
        ],
      },
      {
        h2: 'Les données structurées Product et Offer',
        paras: [
          'Schema.org définit un type Product, avec ses propriétés (nom, description, image, marque, identifiants GTIN ou référence) et un type Offer (prix, devise, disponibilité, état), plus des notes agrégées [4]. Google documente les champs qu’il exploite pour les fiches marchandes [5].',
          'Pour les assistants, l’effet exact du balisage n’est pas démontré. Ce qui est sûr : il rend la fiche non ambiguë pour un robot, il est exigé par les moteurs pour certains affichages, et il ne coûte presque rien. Une règle ne se discute pas : le balisage doit reprendre exactement ce qui est visible. Un prix balisé qui diffère du prix affiché est une erreur, pas une optimisation.',
        ],
      },
      {
        h2: 'Les attributs : ce qui répond aux questions d’acheteurs',
        paras: [
          'Les questions d’achat portent sur des critères : type de peau, taille, matière, compatibilité, usage, prix maximum. Si ces attributs figurent dans une phrase claire de la fiche, ou dans un tableau de caractéristiques, un assistant peut les reprendre. S’ils ne sont que dans une image, ou si la fiche ne parle que de « qualité premium », il n’y a rien à citer.',
        ],
        list: [
          'Écrivez les caractéristiques en texte : dimensions, composition, certifications, contenance, compatibilité.',
          'Répondez aux questions précises (« convient-il aux peaux sensibles ? ») par une phrase qui commence par la réponse.',
          'Donnez le prix, la disponibilité et les délais de livraison en texte, pas seulement dans un composant chargé par JavaScript.',
          'Nommez la marque, la gamme et la référence de la même manière partout : fiche, flux, marketplaces.',
        ],
      },
      {
        h2: 'Les avis : lisibles, ou invisibles',
        paras: [
          'Plusieurs applications d’avis rendent désormais leurs avis en HTML côté serveur, lisibles sans JavaScript, avec un balisage de la note agrégée. Judge.me, par exemple, décrit un JSON-LD portant la note, jusqu’à 50 avis récents et les questions-réponses [6]. Un widget d’avis chargé uniquement par JavaScript peut rester invisible pour un robot : vérifiez ce que renvoie la page « sans JavaScript ».',
          'Les chiffres de performance que publient les éditeurs d’avis sont, pour la plupart, auto-déclarés et ne portent pas sur les citations par les IA : prenez-les comme des arguments commerciaux, pas comme des preuves.',
        ],
      },
      {
        h2: 'Là où votre fiche n’est pas la seule voix',
        paras: [
          'Pour une question de recommandation, l’assistant s’appuie souvent sur des comparatifs, des forums et des marketplaces : les études publiques sur les domaines cités par les IA montrent de fortes variations d’un mois à l’autre : mi-septembre 2025, la part des réponses de ChatGPT citant Reddit est passée d’environ 60 % à environ 10 % selon Semrush [7]. Il peut aussi renvoyer l’acheteur vers un revendeur plutôt que vers votre boutique. Pour le savoir, il faut mesurer vos produits et vos catégories, pas seulement auditer vos fiches.',
        ],
      },
      {
        h2: 'Les fiches maigres, les variantes et les doublons',
        paras: [
          'Trois situations fréquentes en boutique pénalisent la lecture, par un robot comme par un acheteur. La fiche maigre, qui tient en une phrase et une image, ne répond à aucune question. Les variantes (couleur, taille, contenance) qui créent une page par déclinaison, avec le même texte, brouillent la page de référence : déclarez une adresse canonique et regroupez les variantes sous un seul produit quand c’est possible. Enfin, la description reprise du fabricant est publiée à l’identique chez tous vos revendeurs : rien ne justifie qu’un assistant cite la vôtre plutôt qu’une autre.',
          'Une fiche utile contient ce que le fabricant ne dit pas : pour qui le produit est fait, pour qui il ne l’est pas, ce qu’il remplace, comment l’utiliser, ce que vous avez constaté. Ces informations sont aussi celles qui convertissent un visiteur humain.',
        ],
      },
      {
        h2: 'Ce que vous ne contrôlez pas',
        paras: [
          'Même une fiche irréprochable ne garantit rien. L’assistant peut préférer un comparatif, un forum ou la page d’un revendeur, citer un prix périmé trouvé ailleurs ou se tromper de variante. Gemini, sans ancrage de recherche, ne fournit pas de sources et peut inventer des détails ou des adresses de page. Vérifiez régulièrement ce que disent les assistants de vos produits phares : les erreurs de prix, de disponibilité ou de compatibilité sont les plus coûteuses.',
          'Quand une erreur vient d’une source tierce (un comparatif, une marketplace, un agrégateur), corrigez-la à cette source. Quand elle vient de votre propre fiche, corrigez-la d’abord : c’est le seul cas que vous maîtrisez entièrement, et le plus simple à vérifier après coup.',
        ],
      },
      {
        h2: 'Liste de contrôle pour une fiche produit',
        list: [
          'Texte lisible sans JavaScript : titre, description, caractéristiques, prix, disponibilité.',
          'JSON-LD Product et Offer valide, cohérent avec la page (prix, devise, disponibilité).',
          'Identifiant produit (GTIN, référence) et marque renseignés.',
          'Attributs écrits en texte, un tableau de caractéristiques, des réponses courtes aux questions fréquentes.',
          'Avis rendus en HTML, avec note et nombre d’avis visibles et balisés.',
          'Descriptions uniques : évitez de reprendre mot pour mot le texte du fabricant, que tous vos revendeurs ont aussi.',
          'Images avec texte alternatif, et un nom de produit identique partout.',
          'Flux produit à jour si vous diffusez sur des places de marché ou vers un agrégateur.',
        ],
        after: ['Notre audit de fiche produit vérifie ces points sur l’adresse que vous donnez, et note la fiche sur 100. Il décrit des bonnes pratiques : il ne dit pas si ChatGPT recommande vos produits. Pour cela, il faut suivre des questions d’acheteurs dans les réponses.'],
      },
    ],
    sources: [
      { label: 'Lengow, faire apparaître vos produits dans les résultats IA', url: 'https://www.lengow.com/fr/aller-plus-loin/comment-faire-apparaitre-vos-produits-dans-les-resultats-ia-et-le-commerce-agentique/', note: 'Éditeur d’un outil de flux : source commerciale, intérêt à vendre ses services.' },
      { label: 'Lengow, ChatGPT Shopping : éligibilité, calendrier, préparation du flux', url: 'https://www.lengow.com/fr/aller-plus-loin/chatgpt-shopping-eligibilite-calendrier-et-comment-preparer-votre-flux', note: 'Éditeur d’un outil de flux ; relevé du 9 novembre 2026.' },
      { label: 'Shopify, Agentic Storefronts (version française)', url: 'https://www.shopify.com/fr/agentic-storefronts', note: 'Documentation de l’éditeur.' },
      { label: 'Schema.org, type Product', url: 'https://schema.org/Product' },
      { label: 'Google Search Central, données structurées Product', url: 'https://developers.google.com/search/docs/appearance/structured-data/product', note: 'Documentation de l’éditeur.' },
      { label: 'Judge.me, rendre les avis visibles par les assistants d’achat', url: 'https://judge.me/help/en/articles/15860924-making-reviews-visible-to-ai-shopping-assistants', note: 'Éditeur d’une application d’avis.' },
      { label: 'Semrush, most cited domains in AI (juillet à octobre 2025)', url: 'https://www.semrush.com/blog/most-cited-domains-ai/', note: 'Données principalement américaines.' },
    ],
    cta: { text: 'Auditez une de vos fiches produit, ou suivez les questions d’acheteurs de votre catégorie.', href: '/e-commerce', label: 'Voir le parcours e-commerce' },
    related: ['page-que-les-ia-citent', 'avis-clients-ia', 'trafic-chatgpt-ga4'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'suivre-ses-questions-chatgpt',
    seoTitle: 'Suivre ses questions dans ChatGPT : par où commencer',
    title: 'Suivre ses questions dans ChatGPT : par où commencer',
    description:
      'Comment choisir les 5 à 20 questions de clients à suivre dans ChatGPT, Perplexity, Gemini et Claude, les formuler, lire la marge d’erreur et décider quoi faire des résultats.',
    updated: D,
    published: D,
    intro: [
      'Suivre sa visibilité dans les IA, c’est poser régulièrement les mêmes questions que vos clients et noter si vous êtes cités. Tout le reste (scores, graphiques, alertes) en découle. Le point de départ est donc la liste de questions, et c’est là que la plupart des suivis se jouent.',
      'Voici comment la construire, combien en suivre, comment lire les résultats sans se tromper, et ce que vous pouvez faire gratuitement. Aucune promesse de résultat : une mesure sert à décider, pas à garantir.',
    ],
    sections: [
      {
        h2: 'Pourquoi des questions, et pas des mots-clés',
        paras: [
          'Un moteur de recherche classique reçoit des mots-clés ; un assistant reçoit des phrases : « Quel plombier peut intervenir en urgence à Lyon 3 ? ». Une même intention peut donc s’écrire de dix façons. Vous suivez une intention, par une ou deux formulations naturelles, pas un mot-clé exact.',
          'Autre différence : une réponse n’est pas stable. Des travaux publiés en 2026 montrent qu’obtenir deux fois la même liste de recommandations est très rare [1]. On mesure donc des fréquences : sur plusieurs exécutions de la même question, dans quelle part des réponses êtes-vous cité ?',
        ],
      },
      {
        h2: 'Étape 1 : listez 20 questions candidates',
        paras: ['Cherchez-les dans votre quotidien, pas dans un outil.'],
        list: [
          'Les questions que vos clients posent au téléphone, par e-mail et au comptoir.',
          'Les objections avant achat : prix, délai, comparaison avec un concurrent, alternative moins chère.',
          'Les recherches « près de moi » : votre métier plus votre ville, votre quartier, une urgence.',
          'Vos services ou produits les plus rentables, formulés comme un besoin (« réparer une fuite sous évier », pas « plomberie »).',
          'Les questions suggérées à partir de votre site et de votre secteur dans Repéré, que vous pouvez accepter, modifier ou écarter.',
        ],
      },
      {
        h2: 'Étape 2 : choisissez-en 5 pour commencer',
        paras: [
          'Cinq questions suffisent pour une première lecture, et c’est le volume de l’offre gratuite Découverte. Gardez un équilibre : des questions de recommandation générale (« meilleur… à… »), de proximité, d’urgence ou de prix, et une question précise sur votre service le plus rentable. Évitez les questions qui contiennent déjà votre nom : un assistant vous cite forcément si on lui demande de parler de vous. Elles servent à vérifier ce que l’IA dit de vous, pas à mesurer si elle vous recommande.',
          'Passez à 20 questions quand vous savez agir sur les résultats, et à 50 ou 100 si vous avez plusieurs services, produits ou villes. Au-delà, un outil de mesure généraliste ou un budget d’agence sont plus adaptés.',
        ],
      },
      {
        h2: 'Étape 3 : formulez comme un client',
        list: [
          'Une phrase naturelle, sans consigne de format ni jargon (« Quel est le meilleur plombier à Lyon 3 ? »).',
          'Un sujet par question : pas deux demandes dans la même phrase.',
          'Pas de vos propres mots de métier : utilisez ceux de vos clients.',
          'Gardez la liste stable : changer une question change ce que vous mesurez. Quand vous la modifiez, notez la date.',
        ],
      },
      {
        h2: 'Étape 4 : lisez les résultats avec leur marge',
        paras: [
          'Un score s’accompagne d’une marge : « 54 ± 7 » signifie que, d’après les questions suivies, la vraie valeur se situe vraisemblablement entre 47 et 61 (intervalle à 90 %, par rééchantillonnage des questions). Une évolution plus petite que la marge n’est pas une évolution. Sur cinq questions, la marge est large : c’est normal, et c’est un point de départ, pas un verdict.',
          'Regardez aussi, par question : êtes-vous cité, à quelle place, face à quels concurrents, sur quelles sources l’assistant s’appuie. C’est le « pourquoi » qui indique l’action : une fiche à compléter, une page à réécrire, une source tierce à viser.',
        ],
      },
      {
        h2: 'Étape 5 : décidez quoi faire, puis remesurez',
        list: [
          'Choisissez une ou deux actions seulement : celles qui touchent les questions où vous êtes absent et où un concurrent est cité.',
          'Faites-les, notez la date, puis attendez deux à quatre semaines : les IA mettent du temps à relire une page ou une fiche.',
          'Relancez les mêmes questions. L’outil compare l’avant et l’après avec une marge d’erreur et dit « stable » quand l’écart reste dans le bruit.',
          'Ne concluez pas à une cause : une hausse après une action est une corrélation, d’autres facteurs ont pu jouer.',
        ],
      },
      {
        h2: 'Un exemple de cinq questions pour un plombier lyonnais',
        list: [
          '« Quel est le meilleur plombier à Lyon 3 ? » (recommandation générale).',
          '« Plombier près de la Part-Dieu, lequel choisir ? » (proximité).',
          '« Urgent : fuite d’eau, quel plombier peut intervenir rapidement à Lyon 3 ? » (urgence).',
          '« Combien coûte le remplacement d’un chauffe-eau à Lyon ? » (prix, service rentable).',
          '« Quel plombier a les meilleurs avis à Lyon 3 ? » (avis).',
        ],
        after: ['Aucune ne cite le nom de l’entreprise. Les cinq couvrent cinq intentions différentes : si vous êtes cité sur l’une et pas sur les autres, la mesure vous dit déjà où agir.'],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Suivre uniquement des questions qui contiennent votre nom : vous mesurez que l’IA vous connaît, pas qu’elle vous recommande.',
          'Changer la liste à chaque mesure : l’évolution observée vient alors de la liste, pas de votre visibilité.',
          'Tirer une conclusion d’une seule réponse : une réponse isolée ne prouve rien, dans un sens ou dans l’autre.',
          'Ne regarder qu’une IA : vos clients n’utilisent pas tous le même assistant, et les sources diffèrent de l’un à l’autre.',
          'Confondre l’indice de demande et un volume : l’indice est une estimation fondée sur la forme de la question, jamais un nombre de recherches.',
          'Multiplier les questions avant d’avoir agi sur les premières : trente questions sans plan d’action ne changent rien.',
        ],
      },
      {
        h2: 'Ce que vous pouvez faire gratuitement',
        paras: [
          'Vous pouvez commencer à la main : posez vos cinq questions à ChatGPT, Perplexity, Gemini et Claude, trois fois chacune, dans des conversations neuves, et notez dans un tableur qui est cité. C’est lent et approximatif, mais cela suffit pour comprendre le principe. Le test gratuit de Repéré fait la même chose sur 8 à 10 questions types, et l’offre Découverte suit 5 de vos questions une fois par mois sur trois IA. Ni l’un ni l’autre ne couvre les aperçus IA de Google, dont aucune interface fiable ne permet la mesure.',
        ],
      },
    ],
    sources: [
      { label: 'SparkToro et Gumshoe, variabilité des recommandations des IA (Search Engine Journal)', url: 'https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/', note: '600 volontaires, près de 3 000 exécutions.' },
    ],
    cta: { text: 'Posez vos premières questions : le test gratuit vous montre qui est cité à votre place.', href: '/audit', label: 'Lancer mon test gratuit' },
    related: ['apparaitre-dans-chatgpt-pme', 'page-que-les-ia-citent', 'ia-disent-des-choses-fausses'],
  },
];
