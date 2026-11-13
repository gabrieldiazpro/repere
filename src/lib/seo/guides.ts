/**
 * Guides piliers (V2). Textes écrits pour être utiles et honnêtes : aucune promesse de résultat,
 * chaque affirmation chiffrée renvoie à une source listée en fin de guide ([n]).
 * Les points non vérifiés sont signalés comme tels dans le texte.
 */
export interface GuideSection {
  h2: string;
  /** V5 : schéma SVG maison affiché sous le titre (src/components/pages/guide-figures.tsx). */
  figure?: string;
  paras?: string[];
  list?: string[];
  /** Paragraphes placés après la liste. */
  after?: string[];
}
export interface GuideSource {
  label: string;
  url: string;
  note?: string;
}
export interface Guide {
  slug: string;
  title: string;
  description: string;
  /** Date de dernière vérification des sources (ISO). */
  updated: string;
  /** Date de première publication (ISO). Par défaut : GUIDES_PUBLISHED. */
  published?: string;
  /** Title SEO plus court que le h1 (50 à 60 caractères avec « | Repéré »). */
  seoTitle?: string;
  intro: string[];
  sections: GuideSection[];
  sources: GuideSource[];
  cta: { text: string; href: string; label: string };
  related: string[];
  /** V5 : guide pilier (mis en avant sur /guides). */
  pillar?: boolean;
  /** V5 : questions fréquentes en fin de guide (visibles et reprises en FAQPage). */
  faq?: { q: string; a: string }[];
}

import { GUIDES_V3 } from './guides-v3';
import { GUIDES_V5, GUIDE_V5_EXTRAS } from './guides-v5';

export const GUIDES_UPDATED = '2026-11-09';
/** Première mise en ligne des guides. */
export const GUIDES_PUBLISHED = '2026-11-09';

const GUIDES_V2: Guide[] = [
  /* ------------------------------------------------------------------ */
  {
    slug: 'apparaitre-dans-chatgpt-pme',
    seoTitle: 'Apparaître dans ChatGPT quand on est une PME',
    title: 'Comment apparaître dans ChatGPT quand on est une PME',
    description:
      'Ce qui dépend de vous, ce qui n\'en dépend pas, et un plan en 90 jours pour augmenter vos chances d\'être cité par ChatGPT, Gemini et Perplexity. Sans promesse de position.',
    updated: GUIDES_UPDATED,
    intro: [
      'Quand un acheteur demande à ChatGPT « quel cabinet choisir pour structurer nos recrutements » ou « quel logiciel de paie pour 50 salariés », l\'assistant répond avec trois à cinq noms. Si le vôtre n\'y est pas, vous n\'êtes pas dans la comparaison. Ce guide explique, sans jargon, comment augmenter vos chances d\'y figurer.',
      'Un avertissement d\'abord : personne ne contrôle ces réponses, ni nous, ni les agences, ni les éditeurs d\'outils. Ce qui suit décrit des leviers raisonnables, pas une recette. La section finale dit ce qui reste hors de votre portée.',
    ],
    sections: [
      {
        h2: 'Apparaître, cela veut dire quoi ?',
        paras: [
          'Il n\'existe pas de « première place » stable dans ChatGPT. Les réponses varient d\'une interrogation à l\'autre. Une étude de SparkToro et Gumshoe, menée avec 600 volontaires et près de 3 000 exécutions, montre qu\'obtenir deux fois la même liste de recommandations est très rare, alors que certaines marques reviennent dans une grande partie des réponses [1]. L\'indicateur utile est donc une fréquence : sur vingt questions d\'acheteurs posées plusieurs fois, dans combien de réponses votre nom figure-t-il ?',
          'Cette fréquence se mesure par assistant. ChatGPT, Gemini et Perplexity ne s\'appuient pas sur les mêmes sources, et vos clients n\'utilisent pas tous le même.',
        ],
      },
      {
        h2: 'Étape 1 : mesurez avant d\'agir',
        paras: ['Vous pouvez faire un premier test vous-même en une heure.'],
        list: [
          'Écrivez 15 à 20 questions comme un acheteur les poserait : « meilleur logiciel de paie pour une PME de 50 salariés », « alternative à tel concurrent », « cabinet de conseil à Lyon pour une PME industrielle ». Ne citez pas votre nom.',
          'Posez chaque question trois fois à chaque assistant, dans une conversation neuve, sans être connecté si possible : l\'historique et la mémoire peuvent biaiser la réponse.',
          'Notez dans un tableau : votre nom cité ou non, les concurrents cités, les sites mentionnés comme sources.',
          'Datez le tableau. Refaites-le chaque mois avec les mêmes questions, pour comparer ce qui est comparable.',
        ],
        after: ['Ce tableau répond à deux questions : où en êtes-vous, et quels sites les assistants lisent-ils pour votre secteur ? La seconde est la plus précieuse pour la suite.'],
      },
      {
        h2: 'Étape 2 : ne bloquez pas les robots qui permettent d\'être cité',
        paras: [
          'Les éditeurs d\'IA utilisent plusieurs robots, de natures différentes. OpenAI distingue notamment GPTBot (entraînement des modèles), OAI-SearchBot (indexation pour la recherche de ChatGPT) et ChatGPT-User (visite déclenchée par un utilisateur) [2]. Bloquer GPTBot est un choix légitime ; bloquer OAI-SearchBot empêche votre site d\'apparaître dans les résultats de recherche de ChatGPT. Perplexity et Anthropic publient des distinctions comparables.',
          'Ouvrez votre fichier robots.txt (votresite.fr/robots.txt) et vérifiez qu\'aucune règle générale n\'interdit ces robots d\'indexation par erreur. Beaucoup de sites les bloquent sans le savoir, via un plugin de sécurité ou un réglage du CDN. Les mises à jour de robots.txt peuvent mettre une journée à être prises en compte [2].',
          'Autre point technique : les robots d\'IA n\'exécutent généralement pas le JavaScript [3]. Si le contenu de vos pages ne s\'affiche qu\'après chargement d\'un script, ils peuvent ne pas le voir. Un contenu rendu côté serveur est plus sûr.',
        ],
      },
      {
        h2: 'Étape 3 : répondez, sur votre site, aux questions des acheteurs',
        paras: [
          'Les études publiques sur les sources citées montrent une nuance utile : les questions d\'opinion ou de comparaison (« alternative à… », « meilleur… ») s\'appuient davantage sur des communautés, des comparatifs et des éditeurs spécialisés, tandis que les questions de décision font plus de place aux sites de marque [4]. Votre site compte donc surtout quand l\'acheteur a déjà un nom précis à l\'esprit, et pour fournir des faits exacts.',
          'Ce qui aide, sans effet magique :',
        ],
        list: [
          'une page par question d\'acheteur (« logiciel de paie pour une PME de 50 salariés », « différence entre notre offre et celle de X »), avec la réponse dans les premières lignes ;',
          'des faits précis et datés : prix ou fourchette, délais, public visé, limites, références clients autorisées ;',
          'une page « À propos » claire : qui vous êtes, où, depuis quand, quels sont vos domaines ;',
          'les mêmes informations (nom, adresse, activité, offre) sur votre site et sur toutes vos fiches externes.',
        ],
        after: [
          'Si vous faites aider par une IA pour rédiger, relisez et complétez avec des faits que vous seuls détenez. Google rappelle que le contenu généré en masse sans valeur ajoutée est traité comme du spam, avec ou sans IA [5].',
        ],
      },
      {
        h2: 'Étape 4 : soignez les sources que les assistants lisent déjà',
        paras: [
          'C\'est souvent le levier le plus rentable pour une PME. Les assistants citent beaucoup de sites tiers. Selon les études publiques, selon l\'assistant et la période : Wikipédia, Reddit, YouTube, LinkedIn, des comparateurs comme G2 ou Capterra, la presse spécialisée [4][6]. La composition varie fortement d\'un mois à l\'autre : mi-septembre 2025, la part des réponses de ChatGPT citant Reddit est passée d\'environ 60 % à environ 10 % selon Semrush [6]. Il ne faut donc pas bâtir une stratégie sur une source unique.',
          'La démarche : relever, dans votre tableau de l\'étape 1, les sites cités pour votre secteur, puis regarder si vos concurrents y figurent et pas vous. Les actions typiques :',
        ],
        list: [
          'créer ou compléter votre fiche sur les comparateurs et annuaires de votre secteur (Capterra, Appvizer, G2, Sortlist, Clutch, annuaires professionnels) ;',
          'proposer à un auteur de comparatif une information factuelle (prix, différence, cas réel) pour qu\'il vous ajoute, sans contrepartie cachée ;',
          'publier des contenus d\'expertise signés sur LinkedIn ;',
          'participer, sous votre vrai nom, aux discussions de forums de votre métier quand vous avez quelque chose d\'utile à apporter.',
        ],
        after: ['Chaque action est lente et dépend de tiers. Comptez plusieurs semaines pour une fiche, plusieurs mois pour une mention dans la presse.'],
      },
      {
        h2: 'Étape 5 : les avis',
        paras: [
          'Les plateformes d\'avis sont parmi les sources que les assistants lisent. Demandez un avis à tous vos clients, sans filtre ni contrepartie, et répondez à tous les avis. Les règles à respecter sont détaillées dans notre guide sur les avis clients et l\'IA.',
        ],
      },
      {
        h2: 'Ce qui n\'a pas prouvé son effet',
        list: [
          'Le fichier llms.txt. Une étude d\'Ahrefs sur 137 210 domaines (juin 2026) indique que 28 % en publient un, et que 97 % de ces fichiers n\'avaient reçu aucune requête en mai 2026 [7]. Le publier ne coûte presque rien, ce n\'est pas une priorité.',
          'La fiche Bing Places pour apparaître dans ChatGPT. Elle reste utile pour Bing et Copilot, mais l\'effet sur ChatGPT n\'est pas démontré [8].',
          'Les astuces de « prompt injection » cachée dans une page, ou les faux avis : elles exposent à des sanctions et à des déréférencements.',
        ],
      },
      {
        h2: 'Un plan réaliste sur 90 jours',
        list: [
          'Semaine 1 : tableau de mesure (20 questions, 3 assistants, 3 passages) ; vérification de robots.txt.',
          'Semaines 2 à 4 : mise en cohérence des informations (site, Google, annuaires) ; correction de ce que les assistants disent de faux.',
          'Semaines 5 à 8 : deux ou trois pages qui répondent aux questions les plus fréquentes ; fiches sur les comparateurs identifiés.',
          'Semaines 9 à 12 : nouvelle mesure avec les mêmes questions ; comparaison avec la première, en tenant compte de la marge d\'incertitude.',
        ],
        after: ['Avec 20 questions et trois passages, une variation de quelques points reste dans le bruit. Ne concluez que sur des écarts nets.'],
      },
      {
        h2: 'Ce que personne ne peut promettre',
        paras: [
          'Aucun prestataire ne peut promettre qu\'un assistant vous cite. Les modèles changent, leurs sources aussi, et vos concurrents agissent de leur côté. Méfiez-vous de toute offre qui annonce une position ou un délai. Un engagement honnête porte sur le travail fait et sur une mesure transparente de son effet : c\'est le principe de la méthode que nous publions.',
        ],
      },
    ],
    sources: [
      { label: 'Search Engine Journal, SparkToro et Gumshoe : les recommandations des IA changent presque à chaque requête (2026)', url: 'https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/' },
      { label: 'OpenAI, Overview of OpenAI Crawlers', url: 'https://developers.openai.com/api/docs/bots.md' },
      { label: 'Vercel, The rise of the AI crawler', url: 'https://vercel.com/blog/the-rise-of-the-ai-crawler' },
      { label: 'Similarweb, most cited domains by LLMs (janvier et février 2026, États-Unis)', url: 'https://aisearch.similarweb.com/blog/most-cited-domains-llms/', note: 'Données américaines : à lire comme un ordre de grandeur pour la France.' },
      { label: 'Google, contenu généré par IA et règles anti-spam', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content' },
      { label: 'Semrush, most cited domains in AI (juillet à octobre 2025)', url: 'https://www.semrush.com/blog/most-cited-domains-ai/' },
      { label: 'Ahrefs, étude llms.txt (juin 2026)', url: 'https://ahrefs.com/blog/llmstxt-study/' },
      { label: 'Peec AI, fournisseurs de résultats de ChatGPT search (septembre 2026)', url: 'https://docs.peec.ai/research/chatgpt-search-result-providers' },
    ],
    cta: { text: 'Voyez quels noms les assistants donnent dans votre secteur et quelles sources ils citent.', href: '/audit?segment=pme', label: 'Tester mon entreprise gratuitement' },
    related: ['ia-disent-des-choses-fausses', 'trafic-chatgpt-ga4', 'avis-clients-ia'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'ia-disent-des-choses-fausses',
    seoTitle: "Quand l'IA dit des choses fausses sur vous",
    title: 'Les IA disent des choses fausses sur votre entreprise : que faire',
    description:
      'Adresse erronée, offre inexistante, confusion avec un homonyme : comment documenter l\'erreur, en trouver l\'origine, la corriger à la source et vérifier le résultat. Sans promesse de délai.',
    updated: GUIDES_UPDATED,
    intro: [
      'Vous demandez à un assistant de présenter votre entreprise et il annonce une mauvaise adresse, un tarif périmé, un service que vous ne proposez pas, ou vous confond avec un homonyme. C\'est fréquent, et c\'est gênant : l\'acheteur ne vérifie pas toujours.',
      'Vous ne pouvez pas « éditer » la réponse d\'une IA. Vous pouvez en revanche agir sur ce qu\'elle lit, signaler l\'erreur et mesurer si elle disparaît. Voici la marche à suivre.',
    ],
    sections: [
      {
        h2: 'Pourquoi une IA se trompe',
        paras: ['Il y a trois origines principales, qui appellent des remèdes différents.'],
        list: [
          'Une source tierce erronée : un annuaire, un ancien article, une fiche non mise à jour. L\'assistant relaie ce qu\'il a trouvé. C\'est le cas le plus fréquent et le plus corrigeable.',
          'La mémoire du modèle : sans recherche web, l\'assistant répond à partir de ce qu\'il a retenu à l\'entraînement, parfois ancien ou déformé. Les assistants peuvent aussi inventer des détails, y compris des adresses de pages web : des utilisateurs de Gemini ont documenté des URL fabriquées, même avec la recherche activée [1].',
          'Une confusion d\'entités : un homonyme, une ancienne raison sociale, une filiale. L\'assistant fusionne deux entreprises.',
        ],
      },
      {
        h2: 'Étape 1 : documentez l\'erreur',
        paras: ['Avant toute correction, gardez une trace. Elle sert à demander une rectification, à comparer après coup et, au besoin, à étayer un signalement.'],
        list: [
          'La question exacte posée, l\'assistant utilisé, la date et l\'heure.',
          'Une capture de la réponse complète, avec les sources affichées s\'il y en a.',
          'La phrase fausse, recopiée, et ce qui est vrai, avec une preuve (extrait Kbis, grille tarifaire, page de votre site).',
          'Le nombre de fois où l\'erreur se reproduit sur trois à cinq essais : une erreur isolée n\'appelle pas la même réaction qu\'une erreur systématique.',
        ],
      },
      {
        h2: 'Étape 2 : trouvez l\'origine',
        paras: [
          'Perplexity et ChatGPT avec recherche affichent des sources. Ouvrez-les : l\'erreur y figure-t-elle ? Si oui, vous tenez la cause. Sinon, posez la même question à l\'assistant en demandant d\'où vient l\'information ; la réponse n\'est pas toujours fiable, mais elle donne une piste.',
          'Cherchez aussi votre nom, votre adresse et votre téléphone sur un moteur classique et dans les annuaires. Une donnée périmée y est souvent la source. Les sites qui reprennent les registres publics (comme Societe.com ou Pappers) ne se corrigent pas sur place : la correction se fait auprès de la source publique, INSEE, greffe ou INPI selon le cas.',
        ],
      },
      {
        h2: 'Étape 3 : créez une page de vérité',
        paras: [
          'Il s\'agit d\'une page de votre site qui énonce, en texte simple, les faits qui comptent : dénomination exacte, adresse, horaires, offres et tarifs ou fourchettes, zone d\'intervention, dirigeants, date de création, ce que vous ne faites pas. Elle doit être lisible sans JavaScript, datée, et refléter exactement ce que disent vos fiches externes.',
          'Vous pouvez y ajouter des données structurées schema.org (Organization, LocalBusiness, Service) à condition qu\'elles décrivent uniquement ce qui est visible sur la page. Ce balisage est lisible par les moteurs ; son effet sur les assistants IA n\'est pas démontré, mais il réduit l\'ambiguïté.',
          'Si vous avez un homonyme, ajoutez une phrase de désambiguïsation : « Ne pas confondre avec… ».',
        ],
      },
      {
        h2: 'Étape 4 : corrigez à la source',
        paras: ['Traitez d\'abord les sources qui portent l\'erreur, puis celles qui font autorité sur votre identité.'],
        list: [
          'Votre fiche Google, Bing et Apple : adresse, horaires, catégories, description.',
          'Les annuaires et comparateurs qui affichent des données fausses : revendiquez la fiche, corrigez, ou utilisez leur formulaire de signalement.',
          'Les articles de presse périmés : écrivez à la rédaction avec la preuve et demandez une mise à jour ou un complément.',
          'Les registres publics (INSEE, greffe) si l\'erreur est d\'origine légale.',
          'Wikipédia ou Wikidata si une entrée existe sur vous : signalez l\'erreur sur la page de discussion en déclarant votre lien, sans modifier vous-même un article vous concernant.',
        ],
      },
      {
        h2: 'Étape 5 : signalez à l\'éditeur de l\'assistant',
        paras: [
          'Les assistants proposent en général un moyen de signaler une réponse inexacte (bouton de retour sur la réponse, formulaire de contact). Utilisez-le avec votre capture. L\'effet est incertain et le délai inconnu : ce n\'est pas un substitut à la correction des sources.',
          'Si l\'erreur concerne une personne physique (vous, un dirigeant), le RGPD prévoit un droit de rectification des données inexactes (article 16) [2]. Les éditeurs d\'IA ont des procédures de demande ; leur efficacité est variable et nous ne l\'avons pas testée. Si l\'erreur est diffamatoire ou cause un préjudice réel, consultez un avocat avant d\'écrire à qui que ce soit.',
        ],
      },
      {
        h2: 'Étape 6 : vérifiez, et recommencez dans quelques semaines',
        paras: [
          'Refaites exactement les mêmes questions, sur les mêmes assistants, après quelques semaines. Les assistants avec recherche web suivent les changements de sources en quelques jours à quelques semaines dans certains cas, bien plus lentement dans d\'autres, notamment quand l\'erreur vient de la mémoire du modèle. Nous ne pouvons annoncer aucun délai.',
          'Comme les réponses varient, comptez : sur dix essais, combien contiennent encore l\'erreur ? Une baisse nette est un bon signal ; une réponse correcte isolée n\'en est pas un.',
        ],
      },
      {
        h2: 'Les erreurs à ne pas commettre',
        list: [
          'Corriger votre fiche Google mais laisser l\'ancienne adresse sur votre site : l\'incohérence entretient l\'erreur.',
          'Écrire à l\'éditeur de l\'IA avant d\'avoir traité les sources : la cause est souvent chez un tiers.',
          'Faire disparaître la critique plutôt que la fausseté : un avis négatif réel n\'est pas une erreur factuelle, et le faire retirer par des moyens détournés est contraire aux règles des plateformes.',
          'Inonder le web de pages quasi identiques pour « noyer » l\'erreur : c\'est du contenu en masse sans valeur, à risque.',
        ],
      },
      {
        h2: 'Comment nous procédons chez Repéré',
        paras: [
          'Vous renseignez une fiche de vérité (les faits corrects). Nous comparons chaque réponse collectée à cette fiche et signalons les affirmations contredites : adresse, horaires, tarifs, services. Une affirmation qui ne figure pas dans votre fiche est marquée « non vérifiable », pas « fausse ». Chaque erreur détectée donne une tâche de correction avec le texte prêt à publier, et nous revérifions ensuite. Notre extraction des faits repose elle-même sur un modèle d\'IA et peut se tromper : c\'est pourquoi nous affichons la phrase d\'origine, pour que vous jugiez par vous-même.',
        ],
      },
    ],
    sources: [
      { label: 'Forum Google AI, URL inventées même avec la recherche activée', url: 'https://discuss.ai.google.dev/t/gemini-fabricating-urls-even-with-search-grounding/66849', note: 'Retour d\'utilisateurs, pas une documentation éditeur.' },
      { label: 'RGPD (règlement UE 2016/679), article 16 : droit de rectification', url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj' },
      { label: 'Google, contenu généré par IA et règles anti-spam (scaled content abuse)', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content' },
    ],
    cta: { text: 'Voyez ce que disent les assistants sur votre entreprise et ce qui est faux.', href: '/audit', label: 'Lancer mon test gratuit' },
    related: ['apparaitre-dans-chatgpt-pme', 'avis-clients-ia', 'trafic-chatgpt-ga4'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'trafic-chatgpt-ga4',
    title: 'Mesurer le trafic venu de ChatGPT dans GA4',
    description:
      'Comment repérer dans Google Analytics 4 les visites venues de ChatGPT, Perplexity, Gemini ou Copilot, ce que vous ne verrez pas, et comment présenter ces chiffres honnêtement.',
    updated: GUIDES_UPDATED,
    intro: [
      'Vous avez peut-être des visiteurs qui arrivent depuis un assistant IA sans que vous le sachiez. Google Analytics 4 ne les isole pas toujours sous un nom clair, et une partie de ce trafic est invisible. Ce guide explique comment retrouver ce qui peut l\'être, et surtout comment ne pas surinterpréter.',
      'Règle de départ : le chiffre que vous obtiendrez est un plancher, pas un total.',
    ],
    sections: [
      {
        h2: 'Ce que les assistants envoient (et ce qu\'ils n\'envoient pas)',
        list: [
          'ChatGPT : OpenAI ajoute en général le paramètre utm_source=chatgpt.com aux liens de ses résultats de recherche, sans utm_medium. Le référent chatgpt.com est parfois absent. Un défaut constaté mi-octobre 2026 a retiré UTM et référent de certains liens pendant environ une semaine : prévoyez un trou dans vos courbes [1].',
          'Perplexity, Gemini, Copilot, Claude : le plus souvent un référent (perplexity.ai, gemini.google.com, copilot.microsoft.com, claude.ai) quand le navigateur ou l\'application le transmet. Les applications mobiles et les liens en noreferrer font retomber la visite en « Direct » [1].',
          'Google AI Mode et AI Overviews : aucun signal séparé. Ces visites sont indiscernables de l\'organique dans GA4. Depuis juin 2025, les clics depuis AI Mode sont comptés dans Search Console, sous le type « Web », sans filtre dédié [2][3].',
        ],
        after: ['Conséquence : n\'attribuez jamais le trafic « Direct » à une IA, et affichez Google comme « non mesurable » plutôt que de lui attribuer zéro.'],
      },
      {
        h2: 'Étape 1 : ouvrir le bon rapport',
        paras: [
          'Dans GA4, allez dans Rapports, puis Acquisition, puis Acquisition de trafic. Changez la dimension principale du tableau pour « Session : source / support » (session source / medium). Vous verrez des lignes comme « chatgpt.com / (not set) » ou « perplexity.ai / referral ».',
          'Utilisez bien les dimensions de session, pas celles du premier utilisateur : vous mesurez la source de chaque visite, pas celle de la toute première visite du visiteur.',
        ],
      },
      {
        h2: 'Étape 2 : filtrer sur les assistants',
        paras: [
          'Dans le tableau, utilisez la barre de recherche ou un filtre avec une expression régulière sur la source de session. Une base raisonnable :',
          'chatgpt|openai|perplexity|gemini|copilot|claude|you\\.com|mistral|deepseek|grok|phind',
          'Le canal par défaut de GA4 peut classer ces visites en « Referral » ou « Unassigned » selon les cas. Une source secondaire indique qu\'un canal « AI Assistant » aurait été introduit en mai 2026 ; nous n\'avons pas pu le confirmer dans la documentation de Google, vérifiez dans votre propriété [4]. Dans le doute, filtrez sur la source, pas sur le canal.',
        ],
      },
      {
        h2: 'Étape 3 : voir les pages d\'arrivée',
        paras: [
          'Pour savoir quelles pages reçoivent ces visites, créez une exploration (menu Explorer) en tableau libre : dimensions « Page de destination » et « Session : source / support », métriques sessions, sessions engagées, événements clés. Appliquez le même filtre sur la source.',
          'Ces pages sont précieuses : ce sont celles que les assistants citent. Vous y voyez aussi ce qui fonctionne pour déclencher un clic, pas seulement une mention.',
        ],
      },
      {
        h2: 'Étape 4 : relier aux conversions',
        paras: [
          'Dans la même exploration, ajoutez vos événements clés (formulaire envoyé, achat, demande de devis). Vous obtiendrez le nombre de conversions des sessions venues d\'un assistant.',
          'Lisez ce chiffre avec prudence : il s\'agit d\'une attribution au dernier clic, sur des volumes souvent faibles. Trois conversions ne permettent pas de calculer un taux. Écrivez « visites IA suivies de X demandes », pas « l\'IA a généré X euros ».',
          'Pour une boutique Shopify, vous pouvez aussi interroger les sessions par source dans les rapports de la plateforme, en les restreignant aux sessions humaines, car le filtre par défaut peut inclure des robots [5].',
        ],
      },
      {
        h2: 'Étape 5 : mettre en place une alerte simple',
        paras: [
          'Créez un rapport personnalisé et consultez-le chaque mois : sessions venues d\'assistants, par assistant, avec la page d\'arrivée principale. Notez en face les actions que vous avez menées (nouvelle page, nouvelle fiche) pour pouvoir comparer avant et après. Ne cherchez pas de causalité sur un mois : la volatilité des réponses est forte.',
        ],
      },
      {
        h2: 'Pourquoi les volumes sont souvent modestes',
        paras: [
          'Pour la plupart des sites de PME, les sessions venues d\'assistants représentent une petite fraction du trafic : quelques dizaines à quelques centaines par mois. C\'est normal. Un assistant répond souvent sans renvoyer de lien cliquable, et l\'utilisateur qui clique est déjà bien informé. La valeur de ces visites tient moins au volume qu\'à leur qualité : elles arrivent avec une intention précise, sur des pages de comparaison, de prix ou de contact.',
          'Autre précaution : si votre site reçoit peu de visites au total, une seule campagne ou un seul article peut doubler le chiffre d\'un mois à l\'autre. Comparez des périodes de même longueur, et regardez les tendances sur au moins trois mois avant de tirer une conclusion.',
        ],
      },
      {
        h2: 'Ce que vous ne verrez pas',
        list: [
          'Les visiteurs qui ont refusé les cookies : GA4 est soumis au consentement en France. À notre connaissance, la CNIL ne range pas Google Analytics parmi les solutions de mesure d\'audience exemptées de consentement (à vérifier sur sa page dédiée) [6] ; si vous avez un bandeau, un visiteur qui refuse n\'est pas compté. Le trafic IA est donc sous-estimé dans la même proportion.',
          'Les visites sans référent : applications, liens copiés, navigateurs intégrés. Elles passent en Direct.',
          'Les mentions sans clic : l\'acheteur lit votre nom dans la réponse, puis vous cherche sur Google ou tape votre adresse. C\'est probablement la majorité des cas, et aucune analytique ne les relie à l\'IA.',
          'Les robots d\'IA eux-mêmes : ils ne déclenchent pas GA4. Pour savoir s\'ils lisent votre site, il faut les journaux du serveur ou un plugin qui lit l\'agent utilisateur.',
        ],
      },
      {
        h2: 'Mesurer sans cookie, en complément',
        paras: [
          'Notre application propose un petit script de mesure qui n\'envoie que les visites reconnues comme venant d\'un assistant : aucun cookie, aucun stockage dans le navigateur, aucune adresse IP conservée, des totaux par jour, par moteur et par page. Il ne mesure pas votre audience générale. Son principal intérêt est de fournir un contrôle indépendant de votre bandeau cookies.',
          'Limite assumée : sans stockage d\'identifiant, une conversion n\'est rattachée à l\'IA que si elle a lieu sur la même page vue. Pour l\'attribution multi-pages, GA4 ou votre CRM restent les bons outils. Nous affichons GA4 comme référence et notre script comme contrôle, sans additionner les deux.',
          'Ce dispositif a été conçu pour entrer dans l\'exemption de consentement de la CNIL pour la mesure d\'audience, sous conditions strictes ; nous le faisons valider par un juriste et le décrivons dans notre politique de confidentialité.',
        ],
      },
      {
        h2: 'Comment présenter ces chiffres à votre direction',
        list: [
          'Toujours « visites mesurées », jamais « visites totales venues de l\'IA ».',
          'Indiquer la période, le nombre de sessions et ce qui n\'est pas mesuré.',
          'Ne pas afficher un taux de conversion sous un seuil d\'échantillon raisonnable.',
          'Rappeler que Google AI Mode et les mentions sans clic échappent à la mesure.',
        ],
      },
    ],
    sources: [
      { label: 'Clickport, ChatGPT en trafic direct dans GA4', url: 'https://clickport.io/blog/chatgpt-direct-traffic-ga4', note: 'Source secondaire.' },
      { label: 'Search Engine Land, Google AI Mode : trafic non traçable', url: 'https://searchengineland.com/googles-ai-mode-traffic-untrackable-455883' },
      { label: 'Search Engine Journal, AI Mode dans les rapports Search Console', url: 'https://www.searchenginejournal.com/google-adds-ai-mode-traffic-to-search-console-reports/549089/' },
      { label: 'Google Analytics, Data API (référence)', url: 'https://developers.google.com/analytics/devguides/reporting/', note: 'Le canal « AI Assistant » n\'est pas confirmé par cette documentation.' },
      { label: 'Highview Apps, rapport de sessions IA dans Shopify', url: 'https://www.highviewapps.com/kb/how-can-i-generate-an-analytics-report-of-sessions-from-ai-sources-for-my-shopify-store/' },
      { label: 'CNIL, mesurer la fréquentation de vos sites web et applications', url: 'https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications' },
    ],
    cta: { text: 'Branchez GA4 ou le script sans cookie et suivez les visites venues des assistants.', href: '/tarifs', label: 'Voir les tarifs' },
    related: ['apparaitre-dans-chatgpt-pme', 'ia-disent-des-choses-fausses', 'avis-clients-ia'],
  },

  /* ------------------------------------------------------------------ */
  {
    slug: 'avis-clients-ia',
    title: 'Avis clients et IA : ce qui est autorisé',
    description:
      'Demander des avis, y répondre, utiliser une IA pour rédiger vos réponses : les règles de Google et du droit français, ce qui est permis, ce qui ne l\'est pas, et pourquoi cela compte pour les assistants IA.',
    updated: GUIDES_UPDATED,
    intro: [
      'Les avis comptent pour les clients, et ils comptent pour les assistants IA : plateformes d\'avis et annuaires figurent parmi les sources qu\'ils lisent. La tentation est grande de « forcer » la collecte. Ce guide fait le tour de ce que vous pouvez faire, de ce que vous ne devez pas faire, et du cas particulier de l\'IA.',
      'Il ne remplace pas un avis juridique : en cas de doute sur un cas précis, consultez un avocat.',
    ],
    sections: [
      {
        h2: 'Pourquoi les avis intéressent les IA',
        paras: [
          'Une étude de BrightLocal sur des recherches locales dans dix secteurs observe que tous les assistants testés utilisent des annuaires, quel que soit le secteur, et que les sites d\'entreprises restent la première source [1]. Selon le secteur, des plateformes spécialisées (TripAdvisor, TheFork, Planity, Trustpilot, G2) s\'y ajoutent. Un nombre suffisant d\'avis récents, cohérents avec ce que dit votre site, donne aux assistants une matière à citer. Cela ne promet rien, mais l\'absence totale d\'avis ne vous aide pas.',
        ],
      },
      {
        h2: 'Ce qui est autorisé',
        list: [
          'Demander un avis à tous vos clients : par e-mail, SMS, QR code sur le comptoir ou la facture, lien direct vers votre fiche.',
          'Envoyer la même demande à chacun, avec un texte neutre : « Votre avis nous aide. Racontez votre expérience. »',
          'Répondre publiquement à tous les avis, positifs et négatifs, poliment et sans données personnelles du client.',
          'Signaler à la plateforme un avis que vous pensez faux ou contraire à ses règles, avec les éléments qui le montrent.',
          'Faire appel à un prestataire d\'avis vérifiés, qui contrôle que l\'avis vient d\'un client réel, en respectant les règles ci-dessous.',
          'Rappeler à votre équipe de proposer l\'avis, sans quota ni consigne sur le contenu.',
        ],
      },
      {
        h2: 'Ce qui est interdit ou à risque',
        paras: ['La politique de contenus de Google Maps interdit notamment [2] :'],
        list: [
          'offrir une contrepartie (remise, cadeau, paiement) en échange d\'un avis, ou pour modifier ou retirer un avis négatif ;',
          'décourager les avis négatifs ou solliciter sélectivement les avis positifs : pas de « filtre » du type « satisfait ? envoyez sur Google, mécontent ? passez par un formulaire privé » ;',
          'fixer des quotas d\'avis au personnel, ou demander des avis contenant un contenu précis (mots-clés, service, quartier) ;',
          'publier des avis à partir de plusieurs comptes à la demande d\'une seule personne, ou en situation de conflit d\'intérêts (vos proches, vos salariés).',
        ],
        after: [
          'La consigne précise « un contenu précis » mérite d\'être soulignée : demander « un avis qui mentionne notre service de dépannage à Paris 11e » est interdit, alors que demander « votre avis » ne l\'est pas. Certains guides marketing recommandent encore l\'inverse ; ignorez-les.',
        ],
      },
      {
        h2: 'Ce que dit le droit français',
        paras: [
          'Le Code de la consommation range parmi les pratiques commerciales trompeuses en toutes circonstances le fait d\'affirmer que des avis proviennent de consommateurs sans avoir pris de mesures pour le vérifier, et le fait de publier ou de faire publier de faux avis, ou de modifier des avis (article L121-4, 27° et 28°, en vigueur depuis le 28 mai 2022) [3]. Selon un avocat qui a fait l\'état du droit en 2026, les sanctions peuvent aller jusqu\'à deux ans d\'emprisonnement et 300 000 euros, portés à cinq ans et 750 000 euros pour une infraction commise en ligne, avec une amende pouvant atteindre 10 % du chiffre d\'affaires [4]. La DGCCRF contrôle activement : selon la même source, elle a contrôlé plus de 1 200 établissements depuis juillet 2023 avec un outil d\'analyse des avis, et une amende de 38 000 euros a été prononcée en décembre 2023 pour information incomplète sur le traitement des avis [4].',
          'Si vous affichez des avis sur votre site (widget, page témoignages), l\'article L111-7-2 et son décret d\'application imposent une information loyale, claire et transparente : avis vérifiés ou non, date, critères de classement, motifs de refus de publication [5].',
          'Si vous envoyez les demandes d\'avis par e-mail ou SMS, les règles de prospection et de protection des données s\'appliquent : identité de l\'entreprise, moyen simple de ne plus être sollicité. La base légale exacte dépend de votre situation et mérite d\'être validée par un juriste.',
        ],
      },
      {
        h2: 'Et quand une IA rédige la réponse ?',
        paras: [
          'Nous n\'avons pas trouvé de règle de Google spécifique aux réponses d\'entreprise rédigées avec une IA. Les principes qui restent valables sont ceux du bon sens et du droit : la réponse doit être exacte, ne pas promettre ce que vous ne ferez pas, ne pas divulguer de donnée personnelle du client, et refléter ce que vous pensez vraiment.',
          'Notre règle chez Repéré : l\'IA propose un brouillon, une personne le relit, et c\'est vous qui publiez. Nous n\'offrons pas de publication automatique par défaut ; si vous l\'activez pour les avis cinq étoiles, c\'est votre choix et vous pouvez le désactiver à tout moment.',
          'Côté réglementation européenne sur l\'IA, les obligations de transparence de l\'article 50 sont applicables depuis le 2 août 2026 ; leur périmètre exact pour les réponses d\'entreprise reste à confirmer, mais un principe est clair : ne jamais utiliser l\'IA pour fabriquer un faux témoignage ou un faux avis, ni pour donner l\'illusion qu\'un client réel s\'exprime [6].',
        ],
      },
      {
        h2: 'Que faire d\'un avis négatif ?',
        list: [
          'Répondre vite, sans polémique, en proposant un contact hors ligne.',
          'Reconnaître ce qui est fondé, expliquer sans justifier à l\'excès.',
          'Ne jamais dévoiler d\'information sur le client ou sa commande.',
          'Demander le retrait seulement si l\'avis enfreint les règles de la plateforme (insulte, hors-sujet, faux client) et non parce qu\'il est défavorable.',
        ],
        after: ['Un avis négatif traité avec professionnalisme est un signal de sérieux, pour vos clients comme pour les sources que lisent les assistants.'],
      },
      {
        h2: 'Une demande d\'avis conforme, en pratique',
        list: [
          'Un seul message, envoyé à tous vos clients d\'une période (ou à tous ceux d\'un fichier), sans tri préalable par satisfaction.',
          'Un texte court, neutre : « Merci de votre visite. Si vous le souhaitez, racontez votre expérience : [lien]. »',
          'Aucune contrepartie, aucun mot imposé, aucun quota donné à l\'équipe.',
          'La mention de votre identité et un lien pour ne plus recevoir de demande.',
          'Une réponse à chaque avis reçu, dans les jours qui suivent.',
        ],
        after: ['C\'est ce que fait notre kit de demande d\'avis. Nous n\'écrivons jamais d\'avis à votre place et nous ne filtrons pas les clients mécontents.'],
      },
      {
        h2: 'À retenir',
        paras: [
          'Les avis ne se fabriquent pas : ils se collectent honnêtement et se traitent avec sérieux. Les risques de sanction et de suppression de compte dépassent largement le bénéfice d\'un raccourci. Et à l\'heure où les assistants lisent ces plateformes, un faux avis détecté peut peser plus lourd que l\'absence d\'avis.',
        ],
      },
    ],
    sources: [
      { label: 'BrightLocal, AI search using listings sources', url: 'https://brightlocal.com/blog/ai-search-using-listings-sources', note: '20 recherches dans 10 secteurs locaux : échantillon restreint.' },
      { label: 'Google, politique Maps sur les contenus interdits et restreints (faux engagement, manipulation des notes)', url: 'https://support.google.com/contributionpolicy/answer/7400114?hl=en' },
      { label: 'Légifrance, article L121-4 du Code de la consommation', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107' },
      { label: 'Faux avis en ligne : état du droit et des risques en 2026 (avocat)', url: 'https://consultation.avocat.fr/blog/etienne-bucher/article-2981104-faux-avis-en-ligne-etat-du-droit-et-des-risques-en-2026.html', note: 'Source secondaire : vérifiez les montants sur les textes.' },
      { label: 'Légifrance, décret 2017-1436 (article L111-7-2 du Code de la consommation)', url: 'https://www.legifrance.gouv.fr/jorf/id/JORFARTI000035720943' },
      { label: 'DPO Consulting, AI Act et Digital Omnibus', url: 'https://www.dpo-consulting.com/fr-fr/blog/ai-act-ce-que-le-digital-omnibus-change-reellement-pour-les-entreprises-', note: 'Source secondaire : à vérifier sur EUR-Lex.' },
    ],
    cta: { text: 'Voyez quelles plateformes d\'avis les assistants citent pour votre métier.', href: '/audit', label: 'Lancer mon test gratuit' },
    related: ['apparaitre-dans-chatgpt-pme', 'ia-disent-des-choses-fausses', 'trafic-chatgpt-ga4'],
  },
];

/** Applique les compléments V5 (schéma, FAQ, appel vers l'analyse) à un guide existant, sans changer son adresse. */
function withV5(g: Guide): Guide {
  const x = GUIDE_V5_EXTRAS[g.slug];
  if (!x) return g;
  const sections = g.sections.map((s, i) => (x.figure && x.figure.section === i ? { ...s, figure: x.figure.id } : s));
  const related = [...(x.related ?? []), ...g.related.filter((r) => !(x.related ?? []).includes(r))];
  return { ...g, ...(x.seoTitle ? { seoTitle: x.seoTitle } : {}), sections, faq: x.faq, related, updated: '2026-11-13', cta: { ...g.cta, href: '/analyse', label: 'Analyser mon site gratuitement' } };
}

/** Guides V5 (pilier en tête), puis V2 et V3 (guides-v3.ts), enrichis en V5. */
export const GUIDES: Guide[] = [...GUIDES_V5, ...GUIDES_V2, ...GUIDES_V3.map(withV5)];
export const getGuide = (slug: string) => GUIDES.find((g) => g.slug === slug);
export const guidePublished = (g: Guide) => g.published ?? GUIDES_PUBLISHED;
export const guidePath = (g: Guide | string) => `/guides/${typeof g === 'string' ? g : g.slug}`;

export function guideWordCount(g: Guide): number {
  const parts = [
    ...g.intro,
    ...g.sections.flatMap((s) => [s.h2, ...(s.paras ?? []), ...(s.list ?? []), ...(s.after ?? [])]),
    ...(g.faq ?? []).flatMap((f) => [f.q, f.a]),
  ];
  return parts.join(' ').split(/\s+/).filter(Boolean).length;
}
