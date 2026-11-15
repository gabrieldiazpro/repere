/**
 * Guides V7 (agent GUIDES-2, 15 nov. 2026) : 20 guides de fond qui complètent les grappes de /guides
 * (SEO local, métiers, IA et GEO, SEO de fond, e-commerce).
 * Mêmes règles que guides.ts : aucune promesse de résultat, chaque affirmation chiffrée, datée, juridique ou technique
 * renvoie à une source listée en fin de guide ([n]), consultée le 15 novembre 2026. Les entreprises citées en exemple
 * sont fictives et présentées comme telles. Ce qui reste incertain est dit.
 * Liens internes dans le corps au format `[texte](/chemin)` (rendus par src/app/guides/[slug]/page.tsx).
 * Schémas : SVG statiques sous public/guides/v7/, déclarés dans GUIDE_V7_FIGURES.
 */
import type { Guide } from './guides';

const D = '2026-11-15';
const VU = 'consulté le 15 nov. 2026';
const CTA = { href: '/analyse', label: 'Analyser mon site gratuitement' };

/** Schémas des guides V7 : slug → section (index) → image SVG statique. */
export const GUIDE_V7_FIGURES: Record<string, { section: number; src: string; alt: string; caption: string }> = {
  'seo-local-multi-etablissements': {
    section: 2,
    src: '/guides/v7/multi-etablissements.svg',
    alt: 'Schéma : « Nos boutiques » relie une page par établissement, chacune liée à sa propre fiche Google.',
    caption: 'Une page par établissement, une fiche par établissement, et des liens dans les deux sens.',
  },
  'repondre-avis-clients': {
    section: 1,
    src: '/guides/v7/avis-reponse.svg',
    alt: 'Arbre de décision : avis positif, négatif mais réel, ou contraire aux règles, et l’action pour chaque cas.',
    caption: 'Trois cas, trois réponses : remercier, répondre sur le fond, signaler.',
  },
  'entite-de-marque-wikidata-sameas': {
    section: 2,
    src: '/guides/v7/entite-sameas.svg',
    alt: 'Schéma : la page « À propos » pointe, par sameAs, vers les profils officiels de l’organisation.',
    caption: 'Une description de référence sur votre site, reliée aux profils qui parlent de vous.',
  },
  'intention-de-recherche': {
    section: 1,
    src: '/guides/v7/intentions.svg',
    alt: 'Quatre intentions (savoir, faire, aller sur un site, se déplacer), avec une requête et la page qui y répond.',
    caption: 'Quatre intentions, quatre types de pages.',
  },
  'seo-international-hreflang': {
    section: 2,
    src: '/guides/v7/hreflang.svg',
    alt: 'Schéma : trois versions d’une page (fr-FR, fr-BE, en) se citent mutuellement, plus une page x-default.',
    caption: 'Chaque version cite toutes les autres, et elle-même.',
  },
  'migration-https-changement-domaine': {
    section: 1,
    src: '/guides/v7/migration-frise.svg',
    alt: 'Frise : préparation, bascule en 301, suivi sur 180 jours, redirections et domaine gardés au moins un an.',
    caption: 'Une migration se prépare avant et se surveille longtemps après.',
  },
  'rgpd-mesure-audience-cnil': {
    section: 1,
    src: '/guides/v7/mesure-audience.svg',
    alt: 'Arbre de décision : mesure d’audience seule et statistiques anonymes, exemption possible ; sinon, consentement.',
    caption: 'L’exemption de consentement tient en quelques conditions, toutes cumulatives.',
  },
  'pagination-filtres-e-commerce': {
    section: 1,
    src: '/guides/v7/pagination-filtres.svg',
    alt: 'Schéma : pages 1, 2, 3 d’une catégorie reliées par des liens ; les combinaisons de filtres sont écartées.',
    caption: 'Les pages de liste restent explorables ; les combinaisons de filtres, en général, non.',
  },
};

export const GUIDES_V7: Guide[] = [
  /* ------------------------------------------------------------------ */
  /* SEO local multi-établissements                                      */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-local-multi-etablissements',
    seoTitle: 'SEO local multi-établissements : réseaux et enseignes',
    title: 'SEO local multi-établissements : la méthode pour un réseau',
    description:
      'Fiches Google, pages par établissement, données structurées, avis : organiser le référencement local d’un réseau de 3 à 300 points de vente sans doublon.',
    updated: D,
    published: D,
    intro: [
      'Une enseigne qui possède plusieurs points de vente, un réseau de franchisés, un cabinet à plusieurs adresses ou une agence d’intérim implantée dans dix villes partagent le même problème : chaque établissement doit être trouvé par les clients qui sont près de lui, sans que les pages et les fiches se fassent concurrence ou se contredisent. Le travail n’est pas plus compliqué que pour un commerce unique, il est simplement multiplié, et les erreurs se multiplient avec lui.',
      'Ce guide décrit une organisation qui tient dans la durée : une fiche Google par lieu réel, une page par établissement sur le site, des informations identiques partout, et une personne responsable de chaque fiche. L’exemple qui nous suit est fictif : les Boulangeries Lemaire, six boutiques dans l’agglomération lyonnaise, un site unique et une gérante qui veut savoir par où commencer.',
    ],
    sections: [
      {
        h2: 'Ce qui change quand on a plusieurs adresses',
        paras: [
          'Google classe les résultats locaux selon la pertinence, la distance et la notoriété [6]. Pour un réseau, la distance joue en votre faveur : chaque boutique a sa propre zone de chalandise, et c’est la plus proche du client qui a le plus de chances d’apparaître. Encore faut-il que Google sache que chaque boutique existe, où elle se trouve et ce qu’elle propose.',
          'Les règles de Google pour les fiches d’établissement posent trois principes qui structurent tout le reste [1]. Tous les établissements d’une même entreprise dans un pays doivent porter le même nom. Ils doivent partager la catégorie qui représente le mieux l’activité. Et il ne faut jamais créer plus d’une fiche par établissement, ni dans un compte ni dans plusieurs.',
        ],
        list: [
          'Même nom partout : « Boulangeries Lemaire », et non « Lemaire Croix-Rousse » sur une fiche et « Boulangerie Lemaire Part-Dieu » sur une autre. Le quartier n’a pas à figurer dans le nom de la fiche [1].',
          'Même catégorie principale : « Boulangerie » pour les six boutiques, même si l’une d’elles fait aussi salon de thé (ce qui peut aller en catégorie secondaire).',
          'Une fiche par lieu réel qui reçoit des clients : pas de fiche pour l’atelier de production fermé au public, pas de seconde fiche « pour tester ».',
        ],
      },
      {
        h2: 'Étape 1 : inventorier avant de créer',
        paras: [
          'Dans un réseau, la première tâche n’est presque jamais de créer des fiches, mais de retrouver celles qui existent déjà. Des fiches ont pu être créées par un ancien responsable, un franchisé, un client ou par Google lui-même à partir de données publiques. Un doublon non traité dilue les avis et peut afficher de mauvais horaires.',
        ],
        list: [
          'Cherchez chaque adresse dans Google Maps, avec et sans le nom de l’enseigne, et notez toutes les fiches qui apparaissent.',
          'Pour chaque fiche, notez qui la gère. Si une fiche a été validée par quelqu’un d’autre, il faut demander l’accès à son propriétaire avant de pouvoir la gérer [2].',
          'Signalez les doublons et les fiches d’établissements fermés depuis la fiche elle-même, plutôt que d’en créer une nouvelle par-dessus.',
          'Rassemblez dans un tableur, pour chaque établissement : nom, adresse exacte, téléphone direct, horaires, services, responsable local et adresse de la page sur le site.',
        ],
        after: [
          'Ce tableur devient la source de vérité du réseau. Toute modification (horaires d’été, nouveau numéro, fermeture pour travaux) part de lui, puis se reporte sur la fiche, la page du site et les annuaires. Sans lui, les informations divergent en quelques mois.',
        ],
      },
      {
        h2: 'Étape 2 : une page par établissement sur le site',
        paras: [
          'Chaque fiche Google renvoie vers une adresse web. Pour un réseau, la meilleure destination est la page de l’établissement, pas la page d’accueil : le client qui clique veut l’adresse, les horaires et le téléphone de cette boutique-là. La page « Nos boutiques » liste ensuite tous les établissements et renvoie vers chacun.',
          'Une page d’établissement utile contient ce qu’on ne trouve nulle part ailleurs :',
        ],
        list: [
          'l’adresse complète, le téléphone direct, les horaires (y compris exceptionnels), un plan ou des indications d’accès (transports, stationnement) ;',
          'ce qui distingue ce lieu : la boutique Croix-Rousse fait des commandes de pièces montées, celle de Villeurbanne ouvre le dimanche, celle de la Part-Dieu propose un comptoir de petite restauration ;',
          'le nom du responsable et, si possible, une photo réelle de la devanture et de l’équipe ;',
          'des liens vers les pages de service communes (commandes pour entreprises, allergènes, recrutement) et vers les boutiques voisines.',
        ],
        after: [
          'Le piège est connu : des pages identiques où seul le nom du quartier change. Google range la création de pages quasi identiques destinées à capter des recherches locales parmi les pratiques de spam (pages satellites) [4]. La règle est la même que pour les pages par ville d’un artisan, détaillée dans notre guide [Pages par ville : être trouvé sans contenu dupliqué](/guides/pages-ville-sans-doublon) : peu de texte commun, beaucoup de faits propres au lieu.',
          'Reliez enfin toutes ces pages avec des liens HTML ordinaires depuis la page « Nos boutiques » et depuis le pied de page ou le menu. Google rappelle qu’il découvre les pages par les liens qu’il peut suivre, avec un texte de lien qui décrit la destination [5]. Un sélecteur de magasin qui ne fonctionne qu’en JavaScript, sans liens, laisse souvent les pages locales orphelines ; notre guide sur le [maillage interne](/guides/maillage-interne) détaille comment vérifier.',
        ],
      },
      {
        h2: 'Étape 3 : les fiches Google, établissement par établissement',
        paras: [
          'Chaque fiche se remplit comme celle d’un commerce unique, en suivant les recommandations de notre guide [Fiche Google Business Profile : la remplir à 100 %](/guides/fiche-google-business-profile). Pour un réseau, trois points demandent une attention particulière.',
        ],
        list: [
          'La validation groupée. À partir de dix fiches pour une même entreprise, Google propose une validation en masse depuis le gestionnaire de fiches. Elle concerne les chaînes, pas les agences qui gèrent plusieurs entreprises, et les établissements sans adresse visible (zone desservie) n’y sont pas éligibles [2]. En dessous de dix, chaque fiche se valide une par une.',
          'Les rayons et départements. Un service qui fonctionne comme une entité distincte, avec ses propres horaires, peut avoir sa propre fiche [1]. Une pharmacie dans un supermarché ou un restaurant dans un hôtel sont donnés en exemples d’entreprises co-implantées qui doivent avoir chacune leur fiche [1]. Une simple vitrine de produits n’en justifie pas une.',
          'Les praticiens. Dans un cabinet à plusieurs professionnels, un praticien qui a sa propre fiche ne doit pas en multiplier pour chacune de ses spécialités, et le titre de sa fiche ne comporte que son nom [1].',
        ],
        after: [
          'Désignez un responsable par fiche. Dans un réseau de franchisés, la question « qui répond aux avis de la boutique de Bron ? » doit avoir une réponse écrite. Le siège garde un accès propriétaire à toutes les fiches, les responsables locaux ont un accès de gestionnaire : le jour où un franchisé quitte le réseau, la fiche ne part pas avec lui.',
        ],
      },
      {
        h2: 'Étape 4 : les données structurées par établissement',
        paras: [
          'Google indique que chaque établissement physique se décrit comme une entité LocalBusiness distincte, avec au minimum son nom et son adresse, et recommande l’adresse de la page propre à l’établissement (url), ses coordonnées géographiques, ses horaires et son téléphone [3]. Pour un service interne qui a des horaires différents, la propriété department permet d’imbriquer une entité dans une autre, avec un nom de la forme « enseigne + service » [3].',
          'En pratique, chaque page d’établissement porte le balisage de cet établissement, et seulement de celui-là. La page « Nos boutiques » peut décrire l’organisation (Organization) et lister les établissements par des liens. Le balisage doit refléter exactement ce qui est écrit sur la page : mêmes horaires, même téléphone. Notre outil gratuit [Validateur JSON-LD](/outils/json-ld) affiche ce que contient le balisage d’une page et signale les propriétés manquantes.',
          'Une précision sur les étoiles : la documentation de Google réserve les propriétés review et aggregateRating aux sites qui agrègent des avis sur d’autres établissements [3]. Baliser vos propres avis sur vos propres pages n’ouvre pas droit à l’affichage d’étoiles dans les résultats.',
        ],
      },
      {
        h2: 'Étape 5 : avis, posts et cohérence dans la durée',
        paras: [
          'Les avis sont rattachés à chaque fiche, donc à chaque établissement. C’est une bonne nouvelle : une boutique très appréciée n’est pas pénalisée par une autre qui l’est moins. C’est aussi une charge : six fiches, ce sont six flux d’avis à lire et à traiter. Notre guide [Avis clients : y répondre et en obtenir dans les règles](/guides/repondre-avis-clients) détaille la méthode et le cadre légal.',
        ],
        list: [
          'Donnez à chaque boutique son propre lien de demande d’avis (notre outil [Lien d’avis Google](/outils/lien-avis-google) le génère à partir de la fiche) et affichez-le en caisse ou sur le ticket, sans condition.',
          'Fixez un délai de réponse commun, par exemple trois jours ouvrés, et un ton commun, mais laissez le responsable local répondre avec ce qu’il sait du cas.',
          'Faites un contrôle mensuel du tableur contre les fiches et les pages : horaires, téléphone, photos récentes, attributs (accès en fauteuil, terrasse, paiement sans contact). Notre outil [Cohérence nom, adresse, téléphone](/outils/coherence-nap) compare champ par champ vos coordonnées de référence et celles de chaque fiche.',
          'Avant chaque période sensible (jours fériés, congés d’été), saisissez les horaires exceptionnels sur toutes les fiches en une fois.',
        ],
      },
      {
        h2: 'Et pour les assistants d’IA ?',
        paras: [
          'Quand un client demande à un assistant « une boulangerie ouverte le dimanche près de Villeurbanne », la réponse s’appuie sur des données locales (fiches, annuaires, avis) et sur des pages lisibles. Une page d’établissement qui dit en une phrase, en tête, « La boutique de Villeurbanne des Boulangeries Lemaire est ouverte le dimanche de 7 h à 13 h » se cite facilement. Une page qui renvoie tout vers un widget de carte ne se cite pas.',
          'Aucun réglage n’assure d’être recommandé par un assistant. Ce qui dépend de vous, c’est que les informations soient exactes, identiques partout et faciles à lire, y compris sans JavaScript. Pour le reste, voyez notre guide pilier sur le [SEO local et l’IA](/guides/seo-local-et-ia).',
        ],
      },
      {
        h2: 'Les erreurs les plus fréquentes dans un réseau',
        list: [
          'Ajouter le quartier ou un mot-clé au nom de chaque fiche (« Boulangeries Lemaire – Meilleur pain Lyon 6 ») : c’est contraire aux règles et cela expose à une suspension [1].',
          'Faire pointer toutes les fiches vers la page d’accueil : le client doit chercher l’établissement une seconde fois.',
          'Laisser chaque franchisé créer son propre site ou sa propre fiche sans coordination : noms, numéros et horaires divergent, et les doublons s’accumulent.',
          'Créer des fiches pour des lieux qui ne reçoivent pas de clients (bureaux administratifs, entrepôts) afin d’« occuper » une ville.',
          'Fermer une boutique sans marquer la fiche comme définitivement fermée : les clients continuent de s’y présenter, et les avis négatifs suivent.',
        ],
      },
      {
        h2: 'Un plan sur six semaines',
        list: [
          'Semaines 1 et 2 : inventaire des fiches existantes, demandes d’accès, signalement des doublons, construction du tableur de référence.',
          'Semaine 3 : rédaction des pages d’établissement (faits propres, horaires, accès, équipe) et de la page « Nos boutiques ».',
          'Semaine 4 : mise à jour de chaque fiche, adresse web vers la page de l’établissement, photos réelles, validation groupée si vous dépassez dix fiches.',
          'Semaine 5 : balisage LocalBusiness par page, vérification avec l’outil, liens entre pages voisines.',
          'Semaine 6 : mise en place du circuit des avis (liens par boutique, responsables, délai), puis contrôle mensuel.',
        ],
        after: [
          'Mesurez ensuite établissement par établissement : appels, itinéraires et clics vers le site dans les statistiques de chaque fiche, impressions de chaque page locale dans la Search Console. Comparez les boutiques entre elles plutôt qu’à une moyenne nationale : leurs quartiers n’ont rien de comparable.',
        ],
      },
    ],
    faq: [
      { q: 'Un franchisé peut-il gérer seul sa fiche ?', a: 'Il peut en être gestionnaire, mais le franchiseur a intérêt à rester propriétaire de toutes les fiches du réseau, pour garder la cohérence du nom et récupérer la fiche si le franchisé quitte le réseau.' },
      { q: 'Faut-il un site par établissement ?', a: 'Rarement. Un site unique avec une page par établissement est plus simple à tenir à jour et concentre les liens. Un site séparé ne se justifie que pour des établissements très différents.' },
      { q: 'Combien de temps prend la validation groupée ?', a: 'Google ne donne pas de délai : il examine le compte, peut demander des informations complémentaires et confirme par e-mail. Prévoyez plusieurs jours, voire davantage.' },
      { q: 'Peut-on regrouper les avis de toutes les boutiques sur une seule fiche ?', a: 'Non. Les avis sont liés à chaque établissement, et fusionner des fiches de lieux différents est contraire aux règles. Chaque boutique construit sa propre réputation.' },
    ],
    sources: [
      { label: 'Aide Google Business Profile, règles de représentation de l’entreprise (chaînes, départements, praticiens, entreprises co-implantées)', url: 'https://support.google.com/business/answer/3038177?hl=en', note: VU },
      { label: 'Aide Google Business Profile, validation groupée des fiches (10 établissements au moins)', url: 'https://support.google.com/business/answer/4490296?hl=en-IN', note: VU },
      { label: 'Google Search Central, données structurées LocalBusiness (établissements, department, avis)', url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business', note: `mise à jour du 15 sept. 2026 ; ${VU}` },
      { label: 'Google Search Central, règles relatives au spam (pages satellites)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Google Search Central, bonnes pratiques pour les liens explorables', url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable', note: VU },
      { label: 'Aide Google Business Profile, améliorer son classement local (pertinence, distance, notoriété)', url: 'https://support.google.com/business/answer/7091', note: VU },
    ],
    cta: { text: 'Vos pages d’établissement sont-elles reliées, lisibles sans JavaScript et cohérentes avec vos fiches ? L’analyse explore le site et le vérifie.', ...CTA },
    related: ['seo-local-et-ia', 'fiche-google-business-profile', 'pages-ville-sans-doublon', 'repondre-avis-clients'],
  },

  /* ------------------------------------------------------------------ */
  /* Avis clients : répondre et en obtenir légalement                    */
  /* ------------------------------------------------------------------ */
  {
    slug: 'repondre-avis-clients',
    seoTitle: 'Avis clients : y répondre et en obtenir dans les règles',
    title: 'Avis clients : y répondre et en obtenir dans les règles',
    description:
      'Répondre aux avis positifs et négatifs, signaler un avis abusif, demander des avis sans enfreindre Google ni le Code de la consommation : la méthode pas à pas.',
    updated: D,
    published: D,
    intro: [
      'Les avis en ligne pèsent sur la décision des clients, sur le classement local et, de plus en plus, sur ce que les assistants d’IA disent d’une entreprise. Notre guide [Avis clients et IA : ce qui est autorisé](/guides/avis-clients-ia) fait le tour des interdits. Celui-ci est pratique : comment répondre, que faire d’un avis injuste, comment en obtenir davantage sans tricher, et quelles obligations s’appliquent si vous affichez des avis sur votre propre site.',
      'Les exemples sont fictifs : un garage indépendant, le Garage des Tilleuls à Angers, et une boutique en ligne de thés, Feuilles & Cie. Les règles citées sont celles de Google et du Code de la consommation, lues le 15 novembre 2026. Pour un cas litigieux (diffamation, dénigrement par un concurrent), seul un avocat peut vous dire ce qui est recevable.',
    ],
    sections: [
      {
        h2: 'Pourquoi répondre, même aux avis positifs',
        paras: [
          'Une réponse n’est pas destinée seulement à l’auteur de l’avis. Elle est lue par tous ceux qui consultent la fiche ensuite, et elle est publique : sur Google, la réponse du propriétaire s’affiche sous l’avis du client, sans votre nom personnel [1]. Google présente des réponses utiles et positives comme un moyen de montrer que vous êtes à l’écoute de vos clients [1].',
          'Répondre aux avis positifs n’a pas besoin d’être long. Une phrase qui reprend un détail précis (« merci d’avoir pris le temps de revenir nous voir après la révision de votre Clio ») montre qu’un humain a lu l’avis, ce que ne montre pas un « Merci pour votre avis ! » collé cinquante fois.',
        ],
      },
      {
        h2: 'Trois cas, trois réponses',
        paras: ['Avant d’écrire, classez l’avis. Chaque catégorie appelle une action différente.'],
        list: [
          'Avis positif : remerciez, nommez un détail, invitez à revenir. Pas d’offre commerciale, pas de mots-clés glissés pour le référencement.',
          'Avis négatif mais réel : répondez sur le fond, sans contester l’expérience vécue, en proposant une suite hors ligne. C’est le cas le plus fréquent et le plus important.',
          'Avis contraire aux règles (faux client, concurrent, propos haineux, hors sujet, conflit d’intérêts) : signalez-le à la plateforme, sans engager de polémique publique. Sur Google, vous pouvez signaler un avis qui enfreint les règles de contenu [1] ; la plateforme décide.',
        ],
      },
      {
        h2: 'Répondre à un avis négatif : la structure qui fonctionne',
        paras: [
          'Un client mécontent du Garage des Tilleuls écrit : « Voiture rendue avec deux jours de retard, personne ne m’a prévenu. » La tentation est de se justifier (« la pièce n’était pas arrivée »). La réponse utile fait autre chose :',
        ],
        list: [
          'Reconnaître le fait sans conditions : « Vous avez raison, nous aurions dû vous prévenir dès que nous avons su que la pièce arriverait en retard. »',
          'Donner une explication courte, pas une excuse : « Le fournisseur a décalé sa livraison de 48 heures. »',
          'Dire ce qui change : « Nous appelons désormais chaque client dès qu’un délai bouge. »',
          'Proposer une suite hors ligne : « Je vous propose d’en parler de vive voix : vous pouvez me joindre directement au garage. »',
          'Signer d’un prénom et d’une fonction.',
        ],
        after: [
          'Ce qu’il ne faut jamais faire : révéler des informations personnelles sur le client (immatriculation, montant de la facture, état de santé pour un professionnel de santé), menacer de poursuites dans la réponse, ou demander publiquement de retirer l’avis. Et ne proposez pas de geste commercial en échange d’une modification : les règles de Google interdisent d’offrir une contrepartie pour faire réviser ou retirer un avis négatif [2].',
          'Si l’assistant de rédaction de votre outil propose une réponse générée, relisez-la : une réponse générique à un reproche précis se remarque, et une IA peut inventer un fait. Notre guide sur le [contenu écrit avec l’IA](/guides/contenu-ecrit-avec-ia) donne les précautions générales.',
        ],
      },
      {
        h2: 'Quand l’avis est faux ou abusif',
        paras: [
          'Un avis qui vous déplaît n’est pas un avis abusif. Les plateformes ne retirent pas un avis parce qu’il est sévère ou injuste à vos yeux ; elles retirent ceux qui enfreignent leurs règles. Les règles de contenu de Google visent notamment les faux engagements (avis payés, publiés depuis plusieurs comptes), les conflits d’intérêts (employés actuels ou anciens, concurrents, proches) et la manipulation des notes [2].',
        ],
        list: [
          'Rassemblez les éléments : date, absence de trace du client dans vos fichiers, éventuelle vague d’avis similaires en peu de temps.',
          'Signalez l’avis depuis la fiche, en choisissant le motif le plus précis.',
          'Répondez publiquement de façon neutre si l’avis reste en ligne : « Nous ne retrouvons pas de trace de votre passage ; pouvez-vous nous contacter pour que nous comprenions ? » Les lecteurs savent lire.',
          'Pour un avis qui porte atteinte à votre honneur ou relève du dénigrement, la voie est juridique : consultez un avocat avant toute démarche.',
        ],
      },
      {
        h2: 'Obtenir des avis : ce qui est permis et ce qui ne l’est pas',
        paras: [
          'Demander un avis est permis et même encouragé. Ce qui est interdit, c’est d’orienter le résultat. Les règles de Google sont précises [2] :',
        ],
        list: [
          'interdit d’offrir une contrepartie (paiement, remise, produit ou service gratuit) en échange d’un avis ;',
          'interdit de solliciter sélectivement les clients satisfaits, par exemple en n’envoyant le lien qu’à ceux qui ont mis une bonne note à un questionnaire préalable ;',
          'interdit de décourager ou d’empêcher les avis négatifs ;',
          'interdit de fixer à des salariés un nombre d’avis à obtenir, ou de leur demander d’obtenir des avis au contenu imposé.',
        ],
        after: [
          'Le droit français va dans le même sens. Le Code de la consommation range parmi les pratiques commerciales trompeuses le fait de diffuser ou faire diffuser de faux avis, de modifier des avis pour promouvoir des produits, et d’affirmer que des avis émanent de consommateurs ayant réellement utilisé ou acheté le produit sans avoir pris les mesures nécessaires pour le vérifier [5].',
          'En pratique, une demande conforme est simple : le même message à tous les clients, au même moment du parcours (après la restitution du véhicule, à la livraison du colis), avec un lien direct vers la page d’avis. Notre outil [Lien d’avis Google](/outils/lien-avis-google) fabrique ce lien et un QR code à imprimer. Le Garage des Tilleuls l’imprime sur la facture ; Feuilles & Cie l’envoie dans l’e-mail de confirmation de livraison, sept jours après l’expédition, à tous les acheteurs.',
        ],
      },
      {
        h2: 'Si vous affichez des avis sur votre propre site',
        paras: [
          'Dès qu’un site collecte, modère ou publie des avis de consommateurs, à titre principal ou accessoire, il est soumis à une obligation d’information loyale, claire et transparente sur la façon dont les avis sont publiés et traités [4]. Le décret du 29 septembre 2017, en vigueur depuis le 1er janvier 2018, détaille ce qu’il faut afficher [3].',
        ],
        list: [
          'À proximité des avis, de façon claire et visible : s’ils font ou non l’objet d’une procédure de contrôle, la date de publication de chaque avis et celle de l’expérience de consommation, et les critères de classement des avis, dont le classement chronologique [3].',
          'Dans une rubrique facilement accessible : l’existence ou non d’une contrepartie en échange du dépôt d’un avis, et le délai maximal de publication et de conservation d’un avis [3].',
          'Si vous contrôlez les avis : les caractéristiques principales du contrôle, la possibilité ou non de contacter l’auteur ou de modifier un avis, et les motifs de refus de publication [3].',
          'En cas de refus de publication, vous devez en informer l’auteur et lui donner les motifs [3].',
        ],
        after: [
          'L’Institut national de la consommation précise que le manquement à ces obligations peut être sanctionné par une amende administrative pouvant atteindre 75 000 € pour une personne physique et 375 000 € pour une personne morale [4]. Si vous passez par un prestataire d’avis, vérifiez qu’il affiche ces mentions ; la responsabilité de votre page reste la vôtre.',
          'Une précision technique pour les boutiques : baliser vos avis avec des données structurées ne garantit pas l’affichage d’étoiles. Pour les fiches d’établissement, Google réserve les propriétés review et aggregateRating aux sites qui agrègent des avis sur d’autres établissements [6]. Pour les pages produit, les règles sont différentes ; notre guide sur les [données structurées utiles](/guides/donnees-structurees-utiles) fait le point.',
        ],
      },
      {
        h2: 'Exemple : deux réponses de Feuilles & Cie',
        paras: [
          'Un acheteur laisse trois étoiles : « Thé excellent, mais colis arrivé écrasé et boîte abîmée. » La réponse de la boutique fictive : « Merci d’avoir pris le temps d’écrire, et désolés pour la boîte : ce n’est pas l’état dans lequel elle devait vous arriver. Depuis ce mois-ci, nous calons les boîtes métal avec un carton intérieur. Si le thé lui-même a souffert, écrivez-nous depuis votre espace client, nous regarderons avec vous. — Camille, service clients. »',
          'Un autre laisse cinq étoiles sans texte. La réponse : « Merci pour ces cinq étoiles ! Si vous avez aimé le sencha de printemps, la récolte d’automne arrive en novembre. — Camille. » Deux phrases, un détail, aucune promotion agressive. Dans les deux cas, la réponse est écrite pour les futurs lecteurs autant que pour l’auteur : elle montre ce que l’entreprise fait quand quelque chose se passe mal.',
        ],
      },
      {
        h2: 'Organiser le traitement des avis',
        paras: ['Les avis se traitent mieux en routine qu’en réaction. Un circuit minimal :'],
        list: [
          'Activez les notifications d’avis sur chaque plateforme et désignez une personne responsable (et un remplaçant pendant les congés).',
          'Fixez-vous un délai, par exemple 72 heures, et tenez-le aussi pour les avis positifs.',
          'Gardez une bibliothèque de formulations, mais réécrivez toujours la première phrase à partir de l’avis réel.',
          'Une fois par trimestre, relisez les avis négatifs : s’ils reviennent sur le même point (attente au téléphone, délais), c’est un problème d’organisation à régler, pas de réputation.',
        ],
      },
      {
        h2: 'Ce que les avis changent pour les IA, sans exagérer',
        paras: [
          'Les assistants d’IA qui recommandent des commerces s’appuient en partie sur les plateformes d’avis. Un assistant peut résumer « les clients saluent la ponctualité » ou « plusieurs avis mentionnent des retards ». Des réponses précises du propriétaire, qui expliquent ce qui a changé, font partie de ce que ces systèmes peuvent lire. Personne ne sait exactement quel poids ils leur donnent, et aucun volume d’avis n’assure une citation. Pour aller plus loin sur le local, voyez notre guide [SEO local multi-établissements](/guides/seo-local-multi-etablissements) si vous gérez plusieurs adresses.',
        ],
      },
    ],
    faq: [
      { q: 'Peut-on supprimer un avis Google négatif ?', a: 'Vous ne pouvez pas supprimer l’avis d’un client. Vous pouvez le signaler s’il enfreint les règles de Google ; la décision appartient à Google. Vous pouvez en revanche modifier ou supprimer votre propre réponse.' },
      { q: 'Peut-on offrir un bon de réduction aux clients qui laissent un avis ?', a: 'Non sur Google : les règles interdisent toute contrepartie en échange d’un avis. Sur votre propre site, une contrepartie doit au minimum être signalée dans la rubrique d’information prévue par le Code de la consommation ; mieux vaut s’en passer.' },
      { q: 'Faut-il répondre à tous les avis ?', a: 'Ce n’est pas une obligation. Répondre à tous les avis négatifs et à une bonne partie des positifs, dans un délai court, montre une entreprise attentive. Une réponse bâclée fait plus de tort que pas de réponse.' },
      { q: 'Un salarié peut-il laisser un avis sur son employeur ?', a: 'Sur la fiche de l’entreprise, non : Google considère qu’un emploi actuel ou passé crée un conflit d’intérêts. Il peut en revanche s’exprimer sur des plateformes dédiées aux employeurs, selon leurs règles.' },
    ],
    sources: [
      { label: 'Aide Google Business Profile, gérer les avis clients (réponses publiques, signalement)', url: 'https://support.google.com/business/answer/3474050?hl=en', note: VU },
      { label: 'Google, règles relatives aux contenus interdits et restreints (faux engagement, conflit d’intérêts, sollicitation sélective)', url: 'https://support.google.com/contributionpolicy/answer/7400114?hl=en', note: VU },
      { label: 'Légifrance, décret n° 2017-1436 du 29 septembre 2017 relatif aux obligations d’information sur les avis en ligne (art. D. 111-16 à D. 111-19)', url: 'https://www.legifrance.gouv.fr/jorf/id/JORFARTI000035720943', note: VU },
      { label: 'Institut national de la consommation, avis en ligne : ce qui change au 1er janvier 2018 (obligations et sanctions)', url: 'https://www.inc-conso.fr/content/avis-en-ligne-ce-qui-change-au-1er-janvier-2018', note: VU },
      { label: 'Légifrance, article L. 121-4 du Code de la consommation (pratiques réputées trompeuses, 27° et 28°)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107', note: VU },
      { label: 'Google Search Central, données structurées LocalBusiness (avis réservés aux sites agrégateurs)', url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business', note: VU },
    ],
    cta: { text: 'Générez un lien direct vers votre page d’avis Google et un QR code à imprimer, en une minute.', href: '/outils/lien-avis-google', label: 'Créer mon lien d’avis' },
    related: ['avis-clients-ia', 'fiche-google-business-profile', 'seo-local-et-ia', 'ia-disent-des-choses-fausses'],
  },
  /* ------------------------------------------------------------------ */
  /* SEO pour restaurants                                                */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-restaurant',
    seoTitle: 'SEO pour restaurant : être trouvé sur Google et les IA',
    title: 'SEO pour restaurant : être choisi sur Google et les IA',
    description:
      'Fiche Google, menu lisible, photos, réservation, avis, site : ce qui fait choisir un restaurant sur Google Maps et dans les réponses des assistants d’IA.',
    updated: D,
    published: D,
    intro: [
      'Un restaurant se choisit souvent en moins d’une minute, téléphone en main : « restaurant italien ouvert ce soir », « brunch près de la gare », « où manger sans gluten à Nantes ». La décision se joue sur la fiche Google, les photos, la carte et les avis, bien plus que sur la page d’accueil du site. Et de plus en plus de clients posent la même question à un assistant d’IA, qui puise dans ces mêmes sources.',
      'Ce guide reprend, dans l’ordre d’importance, ce qu’un restaurateur peut faire lui-même en quelques heures, puis entretenir en quelques minutes par semaine. L’exemple est fictif : Le Comptoir de Léa, bistrot de 40 couverts dans le quartier Graslin, à Nantes, ouvert du mardi au samedi.',
    ],
    sections: [
      {
        h2: 'Ce que le client regarde avant de réserver',
        paras: [
          'Le parcours typique est court : une recherche, une liste de restaurants sur une carte, deux ou trois fiches ouvertes, un coup d’œil aux photos et à la carte, la note et quelques avis, puis un appel ou une réservation. Chaque étape élimine des candidats. Une fiche sans carte, avec des horaires douteux ou des photos sombres, est éliminée même si la cuisine est excellente.',
          'Votre travail consiste donc à ne pas être écarté pour une mauvaise raison. Aucune action ne peut assurer d’apparaître en tête : Google tient compte de la distance entre le client et le restaurant, qui ne dépend pas de vous [6]. Ce qui en dépend, ce sont des informations complètes, exactes et appétissantes.',
        ],
      },
      {
        h2: 'Étape 1 : la fiche Google, pilier de tout le reste',
        paras: [
          'Remplissez la fiche comme le décrit notre guide [Fiche Google Business Profile : la remplir à 100 %](/guides/fiche-google-business-profile), avec quelques spécificités propres à la restauration.',
        ],
        list: [
          'Catégorie principale précise : « Bistrot » ou « Restaurant français » plutôt que « Restaurant ». Les catégories secondaires seulement si elles décrivent une offre réelle (bar à vins, brunch).',
          'Horaires du service, pas de l’ouverture des portes : si la cuisine ferme à 21 h 30, dites-le dans la description et ajustez les horaires. Les horaires exceptionnels (fermeture annuelle, réveillons) se saisissent à l’avance.',
          'Attributs : terrasse, accès en fauteuil roulant, options végétariennes, réservation conseillée, paiement par carte. Ils servent de filtres aux clients et répondent directement aux questions les plus fréquentes.',
          'Un restaurant installé dans un hôtel a sa propre fiche, distincte de celle de l’hôtel : Google le cite en exemple d’entreprises co-implantées qui doivent chacune avoir leur fiche [5].',
        ],
      },
      {
        h2: 'Étape 2 : une carte lisible partout',
        paras: [
          'La carte est le document le plus consulté. Sur Google, le menu d’un restaurant peut provenir de plusieurs sources : le restaurateur lui-même via sa fiche, des partenaires de réservation ou de commande, et des photos de menus prises par les clients ; quand plusieurs fournisseurs envoient un menu, le restaurateur peut choisir celui qu’il préfère depuis l’éditeur de menu de sa fiche [1]. Si vous ne faites rien, c’est une photo floue de votre carte de l’an dernier qui risque de s’afficher.',
        ],
        list: [
          'Saisissez la carte dans la fiche (plats, descriptions courtes, prix) et mettez-la à jour à chaque changement de saison.',
          'Sur votre site, publiez la carte en texte HTML, pas seulement en PDF ou en image : un texte se lit sur mobile, se traduit, et se comprend par les moteurs et les assistants. Notre outil [Rendu sans JavaScript](/outils/rendu-sans-javascript) montre si votre carte est visible dans le HTML que lisent les robots.',
          'Indiquez les prix. Un client qui hésite entre deux adresses écarte souvent celle dont il ignore les prix.',
          'Signalez clairement les options (végétarien, sans gluten sur demande) et renvoyez vers l’information sur les allergènes disponible sur place.',
        ],
        after: [
          'Si vous utilisez la mention « fait maison », elle obéit à des règles précises : un plat fait maison est entièrement cuisiné sur place à partir de produits bruts, et la mention doit figurer sur un support lisible par tous les clients dans l’établissement (carte, menu, ardoise) ; le site internet ne peut être qu’un support secondaire [3]. Ne la reprenez donc en ligne que pour les plats qui la portent réellement en salle.',
        ],
      },
      {
        h2: 'Étape 3 : des photos qui donnent faim (et qui disent vrai)',
        paras: [
          'Les photos sont le premier critère émotionnel. Ajoutez régulièrement des photos réelles, prises à la lumière du jour : la devanture (pour que le client reconnaisse l’adresse), la salle et la terrasse, une dizaine de plats signatures, l’équipe en cuisine. Pas de photos de banque d’images : un client qui découvre une assiette différente de la photo le dira dans son avis.',
          'Donnez à chaque photo publiée sur votre site un nom de fichier et un texte alternatif descriptifs (« tartare-de-boeuf-frites-maison.jpg », « Tartare de bœuf, frites maison »), et compressez-les : notre guide [Images et SEO](/guides/seo-images) détaille la méthode.',
        ],
      },
      {
        h2: 'Étape 4 : réservation et commande, en un clic',
        paras: [
          'La fiche peut afficher un bouton de réservation ou de commande. Il provient soit d’un lien que vous saisissez (vers votre module de réservation), soit d’un partenaire de réservation intégré à Google. Les intégrations de partenaires reposent sur un programme dédié de Google, qui alimente aussi l’onglet menu [1]. Choisissez un seul circuit principal et vérifiez qu’il fonctionne depuis un téléphone : un bouton qui mène à une page d’erreur coûte des tables.',
          'Si vous passez par une plateforme qui prélève une commission, gardez aussi un moyen direct visible (téléphone, réservation sur votre site). C’est une décision commerciale, pas une obligation technique ; l’important est que le client trouve un chemin qui marche.',
        ],
      },
      {
        h2: 'Étape 5 : les avis, matière première de la recommandation',
        paras: [
          'Pour un restaurant, les avis sont nombreux, et c’est une chance : ils décrivent ce que les clients ont aimé avec leurs propres mots (« le meilleur pot-au-feu de Nantes », « service lent le samedi »). Demandez-les à tous les clients, de la même façon : un QR code sur l’addition ou sur un chevalet, généré avec notre outil [Lien d’avis Google](/outils/lien-avis-google). Ne réservez jamais la demande aux tables contentes et n’offrez rien en échange : notre guide [Avis clients : y répondre et en obtenir dans les règles](/guides/repondre-avis-clients) détaille ce qui est interdit.',
          'Répondez aux avis dans les jours qui suivent, en particulier aux critiques : un « Nous avons renforcé l’équipe du samedi soir depuis votre passage » rassure tous les lecteurs suivants.',
        ],
      },
      {
        h2: 'Étape 6 : un site court, rapide et complet',
        paras: [
          'Le site d’un restaurant n’a pas besoin d’être grand. Il doit répondre en un coup d’œil aux questions qu’on vous pose au téléphone. Cinq pages suffisent souvent :',
        ],
        list: [
          'Accueil : une phrase qui dit tout (« Bistrot de cuisine de saison à Nantes, quartier Graslin, ouvert du mardi au samedi midi et soir »), l’adresse, le téléphone, le bouton de réservation.',
          'La carte en texte, avec les prix et la date de mise à jour.',
          'Infos pratiques : horaires de service, accès (tram, parkings), accessibilité, groupes et privatisation.',
          'À propos : le chef, l’histoire, les producteurs avec qui vous travaillez. C’est ce qui vous distingue et ce qu’un assistant peut reprendre.',
          'Contact et réservation.',
        ],
        after: [
          'Les données structurées LocalBusiness (ou un type plus précis) permettent de déclarer le nom, l’adresse, les horaires, le téléphone, et des propriétés propres à la restauration comme le lien vers le menu ou le type de cuisine servi, que Google liste parmi les propriétés recommandées [2]. Elles doivent reprendre exactement ce qui est affiché. Vérifiez votre balisage avec notre [Validateur JSON-LD](/outils/json-ld).',
        ],
      },
      {
        h2: 'Et dans les assistants d’IA ?',
        paras: [
          'Une question comme « un bistrot à Nantes pour un dîner d’affaires, pas trop bruyant » est exactement le genre de demande qu’on pose à un assistant. Pour y répondre, il combine des données locales, des avis et des pages lisibles. Côté Google, les aperçus IA et le mode IA s’appuient sur l’index de recherche : une page doit être indexée et pouvoir s’afficher avec un extrait pour y être reprise, sans exigence technique supplémentaire [4].',
          'Ce que vous pouvez faire : écrire noir sur blanc ce qui vous caractérise (« salle calme à l’étage, idéale pour les repas d’affaires », « menu du midi à 22 € »), le répéter de façon cohérente sur la fiche, le site et les annuaires, et laisser les avis décrire le reste. Aucune formule n’assure une citation ; voyez notre guide [SEO local et IA](/guides/seo-local-et-ia) pour la vue d’ensemble.',
        ],
      },
      {
        h2: 'Les questions des clients, et où y répondre',
        paras: [
          'Notez pendant deux semaines les questions qu’on vous pose au téléphone et en salle. Pour Le Comptoir de Léa, la liste ressemble à ceci, et chaque question a sa place dans la fiche ou sur le site :',
        ],
        list: [
          '« Vous êtes ouverts le dimanche ? » : horaires de la fiche, horaires exceptionnels, page infos pratiques.',
          '« Il y a des plats végétariens ? » : attribut de la fiche, mention sur la carte en texte.',
          '« On peut venir à douze ? » : page groupes et privatisation, avec la capacité réelle et le délai pour réserver.',
          '« Où se garer ? » : page infos pratiques, avec le nom du parking le plus proche et l’arrêt de tram.',
          '« C’est accessible en fauteuil ? » : attribut de la fiche et phrase précise sur le site (marche à l’entrée, toilettes adaptées ou non).',
          '« Vous faites à emporter ? » : attribut, bouton de commande s’il existe, phrase claire sinon.',
        ],
        after: [
          'Chaque réponse écrite une fois évite un appel, rassure un client qui hésite, et donne à un assistant d’IA une information exacte au lieu d’une supposition. C’est aussi la meilleure base pour la description de la fiche : une phrase sur la cuisine, une sur le lieu, une sur ce qui vous distingue.',
        ],
      },
      {
        h2: 'Les erreurs qui coûtent des couverts',
        list: [
          'Des horaires Google faux un jour férié : le client trouve porte close et laisse une étoile.',
          'Une carte qui n’existe qu’en photo Instagram : invisible pour les moteurs, illisible pour beaucoup de clients.',
          'Un site qui s’ouvre sur une vidéo plein écran de dix secondes avant d’afficher l’adresse.',
          'Des réponses aux avis qui se disputent avec le client : les lecteurs prennent rarement le parti du restaurant.',
          'Un nom de fiche rallongé de mots-clés (« Le Comptoir de Léa – Meilleur restaurant Nantes centre ») : contraire aux règles de Google et risqué pour la fiche.',
        ],
      },
      {
        h2: 'La routine hebdomadaire de dix minutes',
        list: [
          'Lundi : vérifier les horaires de la semaine (jours fériés, fermeture exceptionnelle) sur la fiche.',
          'Mercredi : répondre aux avis de la semaine.',
          'Vendredi : publier deux ou trois photos du plat du jour ou d’un nouveau dessert.',
          'À chaque changement de carte : mettre à jour la fiche et la page carte du site le même jour.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il être sur TheFork, Tripadvisor et les autres ?', a: 'C’est une décision commerciale. Ces plateformes sont lues par les clients et par certains assistants. Si vous y êtes, tenez-y les mêmes informations que sur Google et votre site ; une fiche abandonnée y fait plus de tort que d’absence.' },
      { q: 'Un menu en PDF suffit-il ?', a: 'Il vaut mieux que rien, mais une carte en texte HTML se lit mieux sur mobile et se comprend mieux par les moteurs. Gardez le PDF pour l’impression si vous le souhaitez.' },
      { q: 'Les posts Google servent-ils à quelque chose ?', a: 'Ils permettent d’annoncer un événement ou un menu spécial. Leur effet sur le classement n’est pas démontré ; voyez-les comme une information pour les clients qui consultent déjà la fiche.' },
    ],
    sources: [
      { label: 'Google Actions Center, menus des restaurants sur Google (sources des menus, choix du fournisseur préféré)', url: 'https://developers.google.com/actions-center/verticals/reservations/e2e/add-ons/add-menus/overview', note: VU },
      { label: 'Google Search Central, données structurées LocalBusiness (menu, servesCuisine)', url: 'https://developers.google.com/search/docs/appearance/structured-data/local-business', note: VU },
      { label: 'DREETS Bretagne, guide d’utilisation de la mention « fait maison » pour les professionnels', url: 'https://bretagne.dreets.gouv.fr/sites/bretagne.dreets.gouv.fr/IMG/pdf/Fait_Maison_guide_utilisation_pro-2.pdf', note: VU },
      { label: 'Google Search Central, fonctionnalités d’IA et votre site (aperçus IA, mode IA)', url: 'https://developers.google.com/search/docs/appearance/ai-features', note: `mise à jour du 10 déc. 2025 ; ${VU}` },
      { label: 'Aide Google Business Profile, règles de représentation (entreprises co-implantées)', url: 'https://support.google.com/business/answer/3038177?hl=en', note: VU },
      { label: 'Aide Google Business Profile, améliorer son classement local (pertinence, distance, notoriété)', url: 'https://support.google.com/business/answer/7091', note: VU },
    ],
    cta: { text: 'Votre carte est-elle lisible par Google et les assistants, ou seulement en image ? Testez la page de votre carte.', href: '/outils/rendu-sans-javascript', label: 'Tester ma page carte' },
    related: ['fiche-google-business-profile', 'repondre-avis-clients', 'seo-local-et-ia', 'seo-images'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO pour artisans du bâtiment                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-artisans-batiment',
    seoTitle: 'SEO pour artisans du bâtiment : la méthode concrète',
    title: 'SEO pour artisans du bâtiment : être trouvé et rassurer',
    description:
      'Zone desservie, pages par métier et par ville, photos de chantiers, avis, mentions d’assurance et qualification RGE : la méthode de référencement d’un artisan.',
    updated: D,
    published: D,
    intro: [
      'Un couvreur, un électricien, un plombier ou une entreprise de rénovation sont cherchés de deux façons. En urgence (« fuite toiture Tours », « électricien dépannage samedi ») : le client appelle le premier qui inspire confiance. En projet (« rénovation salle de bain prix », « isolation combles aides ») : il compare plusieurs entreprises pendant des semaines. Le référencement doit servir les deux, et la confiance compte autant que la visibilité.',
      'Ce guide est écrit pour l’artisan qui gère lui-même son site ou qui veut savoir quoi demander à son prestataire. L’exemple est fictif : Martin Couverture, trois personnes, installé à Joué-lès-Tours, qui intervient dans un rayon d’une quarantaine de kilomètres.',
    ],
    sections: [
      {
        h2: 'Ce qui fait choisir un artisan',
        paras: [
          'Pour un chantier qui engage plusieurs milliers d’euros, le client cherche des preuves : des réalisations proches de son projet, des avis récents, une entreprise identifiable (adresse, numéro SIRET, assurances), un délai de réponse. Le référencement amène le client jusqu’à vous ; ces preuves le font appeler.',
          'Dans le bâtiment, la proximité compte. Google tient compte de la distance dans les résultats locaux [6], et un artisan installé à Joué-lès-Tours ne sera pas mis en avant à Amboise comme dans sa propre commune. Il faut l’accepter : votre zone réelle d’intervention est votre terrain de jeu, pas toute la région.',
        ],
      },
      {
        h2: 'Étape 1 : la fiche Google d’une entreprise qui se déplace',
        paras: [
          'La plupart des artisans ne reçoivent pas de clients à leur adresse. Dans ce cas, les règles de Google demandent de masquer l’adresse et de définir une zone desservie [4]. La zone se définit par villes ou codes postaux, jusqu’à 20 zones, et Google conseille qu’elle ne dépasse pas environ deux heures de route depuis votre base [3].',
        ],
        list: [
          'Nom réel de l’entreprise, sans mots-clés ajoutés : « Martin Couverture », pas « Martin Couverture Couvreur Urgence Tours 37 » [4].',
          'Catégorie principale qui décrit le cœur du métier (« Couvreur »), catégories secondaires seulement pour des activités réelles et distinctes.',
          'Zone desservie : les communes où vous intervenez vraiment, nommées une à une.',
          'Services détaillés dans la fiche : réfection de toiture, recherche de fuite, pose de fenêtres de toit, démoussage.',
          'Photos de chantiers réels, avant et après, avec l’accord des clients.',
        ],
        after: [
          'Le détail champ par champ est dans notre guide [Fiche Google Business Profile : la remplir à 100 %](/guides/fiche-google-business-profile).',
        ],
      },
      {
        h2: 'Étape 2 : une page par métier, puis par ville quand c’est justifié',
        paras: [
          'Le site d’un artisan s’organise d’abord par métier, parce que c’est ainsi que les clients cherchent : une page par grand service (couverture neuve, rénovation de toiture, zinguerie, recherche de fuite), qui explique le service, les étapes, les délais habituels, des fourchettes de prix quand c’est possible, et montre des réalisations.',
          'Les pages par ville viennent ensuite, et seulement pour les communes où vous avez des choses à dire : des chantiers réalisés, des contraintes locales (secteur sauvegardé, ardoise imposée), un délai différent. Des pages identiques où seul le nom de la commune change sont considérées comme des pages satellites par Google, qui les range parmi les pratiques de spam [5]. Notre guide [Pages par ville : être trouvé sans contenu dupliqué](/guides/pages-ville-sans-doublon) donne la structure d’une page ville utile.',
        ],
      },
      {
        h2: 'Étape 3 : les réalisations, votre meilleur contenu',
        paras: [
          'Une page de réalisation bien faite répond à la question que se pose le client : « ont-ils déjà fait un chantier comme le mien ? » Elle se rédige en vingt minutes à partir des photos du téléphone.',
        ],
        list: [
          'Le titre dit le chantier et le lieu : « Réfection d’une toiture en ardoise à Montlouis-sur-Loire ».',
          'Le contexte : type de maison, problème de départ (« infiltrations dans les combles après la tempête »).',
          'La solution : matériaux, étapes, contraintes rencontrées.',
          'La durée réelle du chantier et, si le client l’accepte, un ordre de grandeur du budget.',
          'Des photos réelles avant, pendant et après, avec un texte alternatif descriptif (voir notre guide [Images et SEO](/guides/seo-images)).',
        ],
        after: [
          'Dix réalisations bien décrites valent mieux que cinquante pages de texte générique. Elles fournissent aussi aux assistants d’IA des faits précis à citer, et à Google des pages qui ne ressemblent à aucune autre.',
        ],
      },
      {
        h2: 'Étape 4 : les preuves de sérieux, affichées clairement',
        paras: [
          'Le bâtiment est un secteur où le client craint l’arnaque. Affichez sur le site, dans une page « Qui sommes-nous » et en pied de page, tout ce qui permet de vous identifier et de vous vérifier.',
        ],
        list: [
          'Raison sociale, adresse, SIRET, téléphone fixe ou mobile professionnel.',
          'Assurances. Pour les travaux soumis à l’assurance de responsabilité civile décennale, les devis et factures doivent mentionner l’assurance professionnelle souscrite, les coordonnées de l’assureur et la couverture géographique du contrat ; cette obligation vient de la loi du 18 juin 2014, qui a ajouté un article 22-2 à la loi du 5 juillet 1996 [1]. Le rappeler sur le site, avec le nom de l’assureur, rassure le client qui compare.',
          'Qualifications et labels réels (RGE, Qualibat ou autres), avec leur périmètre et leur date de validité. Pour certaines aides, primes ou prêts, les travaux doivent être confiés à un professionnel qualifié RGE, et le client peut vérifier votre statut et les catégories de travaux couvertes dans l’annuaire France Rénov’ [2]. N’affichez jamais une qualification expirée ou qui ne couvre pas le service présenté.',
          'Délai de réponse et de devis, zone d’intervention, horaires.',
          'Les mêmes coordonnées partout : site, fiche Google, annuaires, devis. Notre outil [Cohérence nom, adresse, téléphone](/outils/coherence-nap) repère les écarts entre vos fiches.',
        ],
      },
      {
        h2: 'Étape 5 : les avis, demandés à la fin de chaque chantier',
        paras: [
          'La meilleure occasion de demander un avis, c’est le jour de la réception du chantier, quand le client vient de voir le résultat. Un SMS ou un e-mail avec le lien direct vers votre page d’avis Google (généré avec notre outil [Lien d’avis Google](/outils/lien-avis-google)), envoyé à tous les clients, sans condition et sans contrepartie. Notre guide [Avis clients : y répondre et en obtenir dans les règles](/guides/repondre-avis-clients) détaille ce qui est permis.',
          'Répondez à chaque avis en reprenant le chantier : « Merci pour votre confiance pour la réfection de votre toiture à Montlouis ; n’hésitez pas à nous rappeler pour l’entretien des gouttières. » Les réponses aux avis négatifs se lisent encore plus attentivement : restez factuel et proposez d’en parler.',
        ],
      },
      {
        h2: 'Étape 6 : titres et textes qui disent quoi, où et pour qui',
        paras: [
          'Chaque page doit annoncer clairement son contenu dans son titre (balise title) et dans sa première phrase. « Couvreur à Joué-lès-Tours : réfection et réparation de toiture | Martin Couverture » dit le métier, le lieu et l’entreprise. Vérifiez l’affichage de vos titres avec notre outil [Vérificateur de title et meta description](/outils/balises-title-meta).',
          'Écrivez comme vous parlez à un client : « Nous intervenons sous 48 heures pour une recherche de fuite, sous 24 heures si l’eau coule à l’intérieur. » Une phrase concrète comme celle-là sert à la fois au client pressé, à Google et à un assistant qui cherche qui intervient vite près de Tours.',
        ],
      },
      {
        h2: 'Exemple : la page « Recherche de fuite » de Martin Couverture',
        paras: [
          'Voici, en résumé, la page fictive qui sert de modèle. Le titre : « Recherche de fuite de toiture à Tours et alentours | Martin Couverture ». La première phrase répond à la question du client inquiet : « Nous intervenons sous 48 heures pour localiser une fuite de toiture, sous 24 heures si l’eau coule à l’intérieur, dans un rayon de 40 km autour de Joué-lès-Tours. »',
          'Viennent ensuite le déroulement (inspection depuis l’extérieur, contrôle des combles, recherche des points d’entrée les plus fréquents : solins, noues, fenêtres de toit, tuiles déplacées), ce que le client peut faire en attendant (bâche, récipients, couper l’électricité de la pièce si l’eau approche d’un point lumineux), un ordre de grandeur du prix de l’intervention et la façon dont la réparation est chiffrée ensuite.',
          'La page se termine par trois réalisations récentes avec photos, les questions fréquentes (« l’assurance prend-elle en charge ? », « intervenez-vous le samedi ? »), un lien vers la page « Réfection de toiture » pour les cas où la réparation ne suffit pas, et les coordonnées. Rien d’inventé : chaque phrase correspond à ce que fait réellement l’entreprise. C’est ce type de page qu’un client imprime pour comparer trois devis.',
        ],
      },
      {
        h2: 'Les urgences : être joignable avant d’être visible',
        paras: [
          'Pour les recherches d’urgence, la visibilité ne sert à rien si personne ne décroche. Un artisan seul sur un toit ne peut pas répondre au téléphone : prévoyez une messagerie qui donne un délai de rappel réaliste, un formulaire court sur le site (adresse, problème, photo), et des horaires de la fiche qui reflètent les créneaux où vous rappelez réellement.',
          'N’affichez « 24 h/24 » que si c’est vrai. Un client qui appelle un dimanche soir et tombe sur une messagerie pleine laisse un avis, et cet avis sera lu par tous les suivants. Mieux vaut annoncer « rappel sous deux heures en semaine » et le tenir.',
        ],
      },
      {
        h2: 'Ce qu’il vaut mieux éviter',
        list: [
          'Les annuaires et plateformes de mise en relation qui revendent vos contacts sans contrôle : mesurez ce qu’ils apportent avant de payer.',
          'Les « packs SEO » qui promettent la première place : personne ne peut la garantir, et certains créent des dizaines de pages copiées qui finissent ignorées.',
          'Une fausse adresse dans chaque ville pour « être local » partout : c’est contraire aux règles de Google et cela peut entraîner la suspension de la fiche [4].',
          'Des photos de chantiers trouvées sur internet : le client le découvre un jour, et les droits d’auteur s’appliquent.',
        ],
      },
      {
        h2: 'Mesurer sans se compliquer la vie',
        paras: [
          'Trois chiffres suffisent pour un artisan : les appels et demandes d’itinéraire depuis la fiche Google (dans ses statistiques), les demandes de devis reçues par le site, et la question « comment nous avez-vous connus ? » posée à chaque nouveau client. Notez-les chaque mois. Si une page de réalisation amène des demandes, faites-en d’autres sur le même type de chantier. Pour la vue d’ensemble du local, lisez notre guide [SEO local et IA](/guides/seo-local-et-ia).',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il un site, ou la fiche Google suffit-elle ?', a: 'La fiche suffit pour être trouvé en urgence près de chez vous. Pour les projets plus importants, où le client compare, un site avec des réalisations et des preuves de sérieux fait souvent la différence.' },
      { q: 'Combien de pages par ville créer ?', a: 'Seulement pour les communes où vous avez de vrais chantiers et des informations propres à donner. Trois à dix pages solides valent mieux que cent pages copiées.' },
      { q: 'Les plateformes de mise en relation remplacent-elles un site ?', a: 'Elles peuvent apporter des demandes, souvent payantes et partagées avec des concurrents. Votre site et votre fiche restent les seuls supports que vous contrôlez entièrement ; mesurez ce que chaque canal rapporte avant d’y investir davantage.' },
      { q: 'Puis-je afficher le logo RGE sur mon site ?', a: 'Oui si votre qualification est en cours de validité et couvre les travaux présentés sur la page. Le client peut la vérifier dans l’annuaire France Rénov’, avec l’attestation et ses dates.' },
    ],
    sources: [
      { label: 'CAPEB, la mention de l’assurance est obligatoire sur les devis et factures (loi du 18 juin 2014)', url: 'https://www.capeb.fr/actualites/la-mention-de-lassurance-est-obligatoire-sur-les-devis-et-facture', note: `article du 9 févr. 2017 ; ${VU}` },
      { label: 'Institut national de la consommation, comment vérifier qu’un professionnel du bâtiment est « RGE »', url: 'https://www.inc-conso.fr/content/comment-verifier-quun-professionnel-du-batiment-est-rge', note: VU },
      { label: 'Aide Google Business Profile, gérer la zone desservie (20 zones au plus, environ deux heures de route)', url: 'https://support.google.com/business/answer/9157481?hl=en', note: VU },
      { label: 'Aide Google Business Profile, règles de représentation de l’entreprise (nom, adresse masquée, zone desservie)', url: 'https://support.google.com/business/answer/3038177?hl=en', note: VU },
      { label: 'Google Search Central, règles relatives au spam (pages satellites)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Aide Google Business Profile, améliorer son classement local (pertinence, distance, notoriété)', url: 'https://support.google.com/business/answer/7091', note: VU },
    ],
    cta: { text: 'Pages de service, titres, coordonnées identiques partout : l’analyse gratuite contrôle votre site d’artisan en 60 secondes.', ...CTA },
    related: ['pages-ville-sans-doublon', 'fiche-google-business-profile', 'seo-local-et-ia', 'repondre-avis-clients'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO pour professions de santé                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-professions-sante',
    seoTitle: 'SEO pour médecins et professions de santé : les règles',
    title: 'SEO pour professions de santé : visibilité et déontologie',
    description:
      'Ce qu’un médecin ou un soignant peut publier en ligne depuis 2020, ce qui reste interdit (référencement payé, avis affichés) et comment être trouvé.',
    updated: D,
    published: D,
    intro: [
      'Un médecin, un dentiste, un kinésithérapeute ou une sage-femme ne communique pas comme un commerçant. Les codes de déontologie encadrent ce qu’ils peuvent dire, où et comment. Pour les médecins, le cadre a changé à la fin de 2020 : l’interdiction générale de la publicité a disparu, remplacée par un droit d’informer le public, sous conditions. Beaucoup de praticiens l’ignorent et n’osent rien publier ; d’autres reproduisent des pratiques commerciales qui leur sont interdites.',
      'Ce guide porte surtout sur les médecins, dont les règles sont les plus détaillées publiquement ; les autres professions de santé ont leur propre code et leur propre ordre, à consulter avant toute action. Il ne remplace pas l’avis de votre conseil départemental. L’exemple est fictif : la Dre Claire Antoine, médecin généraliste dans une maison de santé de Rennes.',
    ],
    sections: [
      {
        h2: 'Ce qui a changé en décembre 2020',
        paras: [
          'Le décret n° 2020-1662 du 22 décembre 2020 a modifié le code de déontologie des médecins : l’ancien texte interdisait la publicité directe ou indirecte, la nouvelle version supprime cette interdiction [2]. Les médecins peuvent désormais informer le public par tout moyen, y compris un site internet, sur leurs compétences, leur parcours et leurs conditions d’exercice, à condition que l’information soit loyale et honnête, sans témoignages de tiers, sans comparaison avec d’autres médecins ou établissements, sans inciter à des soins inutiles et sans induire le public en erreur [1][2].',
          'Ils peuvent aussi publier des informations scientifiques à finalité éducative ou sanitaire, avec prudence et mesure, sans présenter comme acquises des hypothèses non confirmées [1]. Autrement dit, un médecin peut avoir un site utile et à jour, et même écrire des articles de prévention.',
        ],
      },
      {
        h2: 'Ce qui reste interdit, et qui concerne directement le référencement',
        paras: [
          'Deux limites touchent le cœur des pratiques habituelles de référencement. Le commentaire officiel de l’article R. 4127-19-1 du code de la santé publique, publié par le Conseil national de l’Ordre des médecins, est explicite [1] :',
        ],
        list: [
          'Pas de référencement payant ou prioritaire : un médecin ne peut pas obtenir, contre paiement ou par tout autre moyen, un référencement numérique qui le fasse apparaître en priorité dans les résultats de recherche sur internet. Le commentaire précise que cela vaut pour tout usage d’internet, pas seulement pour les annuaires [1].',
          'Pas d’avis ni de témoignages affichés : le médecin ne doit pas présenter de notes, évaluations, commentaires, remerciements ou témoignages de patients ou de tiers [1].',
          'Pas de comparaison des délais, tarifs ou actes avec ceux d’autres médecins, pas de mise en avant de résultats suggérant une supériorité, pas de photos avant/après qui laisseraient croire à un résultat garanti [1].',
          'La médecine ne doit pas être pratiquée comme un commerce [2].',
        ],
        after: [
          'Conséquence pratique : les campagnes de liens sponsorisés sur des mots-clés et les « packs de visibilité » qui promettent d’apparaître en premier ne sont pas compatibles avec ces règles. Le référencement naturel, qui consiste à publier une information exacte et à rendre son site lisible, l’est, tant qu’il ne cherche pas à manipuler le classement.',
        ],
      },
      {
        h2: 'Étape 1 : un site sobre, complet et daté',
        paras: [
          'Le site d’un cabinet répond d’abord aux questions pratiques des patients. Le commentaire de l’Ordre recommande en outre de dater les contenus mis en ligne, d’en citer les sources et de les revoir régulièrement pour les mettre à jour ou retirer ce qui est dépassé, et encourage les liens vers les sites des autorités sanitaires [1].',
        ],
        list: [
          'Identité, qualifications reconnues, secteur conventionnel, langues parlées.',
          'Honoraires et modes de paiement acceptés : la MACSF rappelle que le site doit les indiquer, de façon claire, honnête, précise et non comparative [2].',
          'Accès (adresse, transports, accessibilité), horaires, modalités de prise de rendez-vous, conduite à tenir en urgence et en dehors des heures d’ouverture.',
          'Si vous écrivez des articles de prévention : date, sources, relecture régulière, liens vers les recommandations officielles.',
        ],
        after: [
          'Pour Google, les sujets de santé relèvent de ce qu’il appelle « Your Money or Your Life » : des sujets qui peuvent affecter la santé, la sécurité ou la situation financière des personnes, pour lesquels ses systèmes accordent un poids supplémentaire aux contenus qui montrent une forte expérience, expertise, autorité et fiabilité [3]. Un contenu signé, sourcé et daté par un praticien identifié correspond à ce que Google décrit ; notre guide [E-E-A-T pour une petite entreprise](/guides/eeat-petite-entreprise) explique comment le montrer sans artifice.',
        ],
      },
      {
        h2: 'Étape 2 : la fiche Google du cabinet et des praticiens',
        paras: [
          'Les fiches Google des cabinets médicaux existent souvent sans que les praticiens les aient créées. Mieux vaut en prendre le contrôle pour que les horaires, l’adresse et le téléphone soient justes. Les règles de Google prévoient des fiches pour les praticiens : un praticien ne doit pas multiplier les fiches pour chacune de ses spécialités, et quand il exerce avec d’autres dans un même lieu, le titre de sa fiche ne comporte que son nom [4].',
        ],
        list: [
          'Revendiquez la fiche du cabinet ou de la maison de santé, et éventuellement celle de chaque praticien.',
          'Renseignez les horaires réels, le lien de prise de rendez-vous, l’accessibilité.',
          'Pas de mots-clés dans le nom (« Dre Antoine – Médecin généraliste Rennes centre sans dépassement ») : le nom seul.',
        ],
      },
      {
        h2: 'Étape 3 : les avis Google, un terrain délicat',
        paras: [
          'Les patients laissent des avis sur les fiches Google, que le praticien le veuille ou non. Le praticien ne peut pas les afficher sur son site [1], mais il peut y répondre sur Google, où la réponse du propriétaire est publique [5]. C’est là que le risque est le plus grand : une réponse ne doit jamais confirmer qu’une personne est patiente du cabinet, ni évoquer son état de santé ou ses soins. Le secret professionnel s’applique aussi en ligne.',
        ],
        list: [
          'Réponse type à un avis négatif : « Nous sommes attentifs à tous les retours. Pour des raisons de confidentialité, nous ne pouvons pas répondre ici à une situation particulière ; le secrétariat est à votre disposition pour en parler. »',
          'Pas de sollicitation d’avis auprès des patients : elle irait à l’encontre de l’esprit des règles qui interdisent de s’appuyer sur des témoignages, et l’Ordre recommande la retenue.',
          'Un avis diffamatoire ou mensonger se signale à Google ; pour aller plus loin, adressez-vous à votre conseil départemental ou à un avocat.',
        ],
        after: [
          'Pour la méthode générale de réponse, notre guide [Avis clients : y répondre et en obtenir dans les règles](/guides/repondre-avis-clients) reste utile, en retirant tout ce qui concerne la demande d’avis.',
        ],
      },
      {
        h2: 'Étape 4 : être compris par les assistants d’IA',
        paras: [
          'Des patients demandent désormais à un assistant « un médecin généraliste qui accepte de nouveaux patients à Rennes » ou « une sage-femme pour la rééducation périnéale près de chez moi ». Les assistants peuvent se tromper, et Google lui-même rappelle qu’il ne faut pas se fier aux réponses de Gemini comme à un avis médical, juridique ou financier [6]. Votre intérêt est que les informations factuelles vous concernant soient exactes et faciles à lire : nom, qualification, adresse, accepte ou non de nouveaux patients, modalités de rendez-vous.',
          'Une phrase claire en tête de la page d’accueil (« La Dre Claire Antoine, médecin généraliste conventionnée secteur 1, consulte à la maison de santé du Blosne, à Rennes, du lundi au vendredi ») se cite telle quelle. Si un assistant affiche une information fausse sur votre cabinet, notre guide [Les IA disent des choses fausses sur votre entreprise](/guides/ia-disent-des-choses-fausses) décrit comment corriger la source. Pour la forme des pages, voyez [Écrire une page que les IA citent](/guides/page-que-les-ia-citent).',
        ],
      },
      {
        h2: 'Exemple : la page d’accueil de la Dre Antoine',
        paras: [
          'Voici le contenu, en résumé, de la page fictive. En tête : nom, qualification (« médecin généraliste, conventionnée secteur 1 »), adresse de la maison de santé, et une ligne qui répond à la question la plus fréquente : « Le cabinet accepte de nouveaux patients pour le suivi en médecin traitant, dans la limite des créneaux disponibles. »',
          'Viennent ensuite les modalités de rendez-vous (en ligne, par téléphone, créneaux sans rendez-vous le mardi matin), les honoraires et moyens de paiement, l’accès (bus, stationnement, accessibilité), et la conduite à tenir le soir et le week-end (numéros d’urgence et de permanence des soins). Une section « Prévention » propose trois articles courts, datés et sourcés, sur la vaccination, le dépistage et le sommeil, avec des liens vers les recommandations officielles.',
          'La page ne contient ni avis de patients, ni comparaison avec d’autres cabinets, ni formule du type « le meilleur suivi de Rennes ». Elle est sobre, et c’est ce qui la rend utile, à la fois pour un patient, pour Google et pour un assistant qui cherche une information exacte. Notre outil [Citabilité](/outils/citabilite) vérifie qu’une page de ce type donne l’essentiel en tête.',
        ],
      },
      {
        h2: 'Réseaux sociaux et pseudonymes',
        paras: [
          'Le commentaire de l’Ordre appelle à la prudence et à la mesure sur les réseaux sociaux, même sous pseudonyme, et à éviter tout propos diffamatoire, injurieux ou discriminatoire. Il rappelle que l’exercice sous pseudonyme est interdit, et qu’un médecin qui utilise un pseudonyme pour une activité liée à la santé doit le déclarer au conseil départemental [1]. Un compte de prévention tenu sous son vrai nom, sourcé et sans promotion, est la voie la plus sûre.',
        ],
      },
      {
        h2: 'Une liste de contrôle avant publication',
        list: [
          'L’information est-elle exacte, loyale, vérifiable ?',
          'Contient-elle une comparaison avec un confrère, un délai ou un tarif « meilleur que » ? À retirer.',
          'Affiche-t-elle un avis, une note, un remerciement de patient ? À retirer.',
          'Un contenu de santé est-il daté, sourcé, relu ?',
          'Payez-vous un service pour apparaître en priorité dans les résultats ? À arrêter.',
          'Les honoraires et modes de paiement sont-ils indiqués ?',
          'En cas de doute : demander au conseil départemental de l’Ordre avant de publier.',
        ],
      },
    ],
    faq: [
      { q: 'Un médecin peut-il avoir un site internet ?', a: 'Oui. Depuis le décret du 22 décembre 2020, il peut informer le public par tout moyen, y compris un site, sur ses compétences, son parcours et ses conditions d’exercice, dans le respect des règles de loyauté et sans comparaison ni témoignages.' },
      { q: 'Peut-on faire de la publicité Google Ads pour un cabinet médical ?', a: 'Le commentaire de l’Ordre exclut d’obtenir par paiement un référencement prioritaire dans les résultats de recherche. Avant toute campagne payante, interrogez votre conseil départemental.' },
      { q: 'Peut-on faire supprimer sa fiche Google ou les avis ?', a: 'Les avis ne se suppriment pas à la demande ; un avis contraire aux règles de Google peut être signalé. Pour les situations particulières, l’Ordre et un avocat sont les bons interlocuteurs.' },
      { q: 'Peut-on écrire des articles de santé pour attirer des visiteurs ?', a: 'Oui, si leur finalité est éducative ou sanitaire, qu’ils sont présentés avec prudence, datés, sourcés et relus régulièrement. Un article ne doit pas devenir un argument commercial ni présenter une hypothèse comme un fait établi.' },
      { q: 'Ces règles valent-elles pour les autres professions de santé ?', a: 'Chaque profession a son propre code de déontologie et son ordre. Les principes sont souvent proches, mais vérifiez les règles exactes de votre profession avant de publier.' },
    ],
    sources: [
      { label: 'Conseil national de l’Ordre des médecins, article 19-1 du code de déontologie (art. R. 4127-19-1 CSP) et son commentaire', url: 'https://conseil-national.medecin.fr/code-deontologie/devoirs-generaux-medecins-art-2-31/article-19-1-communication-professionnelle', note: VU },
      { label: 'MACSF, « La publicité n’est plus interdite pour les médecins » (décret n° 2020-1662 du 22 décembre 2020)', url: 'https://www.macsf.fr/responsabilite-professionnelle/relation-au-patient-et-deontologie/medecins-communication-d-informations-au-public', note: `source secondaire (assureur professionnel) ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables (E-E-A-T, sujets YMYL)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: `mise à jour du 5 oct. 2026 ; ${VU}` },
      { label: 'Aide Google Business Profile, règles de représentation (praticiens)', url: 'https://support.google.com/business/answer/3038177?hl=en', note: VU },
      { label: 'Aide Google Business Profile, gérer les avis clients (réponses publiques)', url: 'https://support.google.com/business/answer/3474050?hl=en', note: VU },
      { label: 'Aide Gemini, à propos des réponses des applications Gemini (limites, pas un avis médical)', url: 'https://support.google.com/gemini/answer/16279220?hl=en', note: VU },
    ],
    cta: { text: 'Votre page d’accueil dit-elle en une phrase qui vous êtes, où et comment prendre rendez-vous ? L’outil de citabilité vérifie 20 règles de clarté.', href: '/outils/citabilite', label: 'Tester ma page' },
    related: ['eeat-petite-entreprise', 'ia-disent-des-choses-fausses', 'fiche-google-business-profile', 'page-que-les-ia-citent'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO pour avocats et experts-comptables                              */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-avocats-experts-comptables',
    seoTitle: 'SEO pour avocats et experts-comptables : les règles',
    title: 'SEO pour avocats et experts-comptables : les règles du jeu',
    description:
      'Nom de domaine, mentions, spécialisations, avis, liens sponsorisés : ce que la déontologie des avocats et experts-comptables permet pour être trouvé en ligne.',
    updated: D,
    published: D,
    intro: [
      'Un avocat ou un expert-comptable est choisi sur la confiance, et la confiance commence souvent par une recherche : « avocat droit du travail Bordeaux », « expert-comptable pour SCI », « cabinet comptable startup Lyon ». Ces professions ont le droit de communiquer et de faire de la publicité, mais dans un cadre précis fixé par leur déontologie. Le référencement doit s’y plier, ce qui exclut certaines pratiques courantes dans d’autres secteurs.',
      'Ce guide résume les règles applicables au web, d’après le vade-mecum de la communication du Conseil national des barreaux et le code de déontologie des experts-comptables, puis propose une méthode compatible. Il ne remplace pas l’avis de votre Ordre ou de votre barreau. Les exemples sont fictifs : le cabinet Roussel Avocats à Bordeaux et le cabinet d’expertise comptable Bertin & Associés à Lyon.',
    ],
    sections: [
      {
        h2: 'Avocats : ce que dit le vade-mecum du CNB',
        paras: [
          'Le vade-mecum de la communication des avocats, dans sa troisième édition d’octobre 2023, rassemble les règles issues de l’article 10 du règlement intérieur national (RIN) [1]. Pour un site et sa visibilité en ligne, les points principaux sont les suivants.',
        ],
        list: [
          'Le site est un support de publicité admis. Sa création et ses modifications substantielles doivent être déclarées à l’Ordre [1].',
          'Le nom de domaine doit comporter le nom de l’avocat ou la dénomination du cabinet ; il ne peut pas reprendre de façon générique le titre d’avocat ou un domaine du droit, et un nom non conforme ne bénéficie d’aucun droit acquis [1]. « roussel-avocats.fr » convient ; « avocat-divorce-bordeaux.fr » ne convient pas.',
          'Le site doit permettre d’identifier, localiser et joindre l’avocat, et mentionner le barreau, la structure d’exercice et l’éventuel réseau [1].',
          'Interdits : la publicité mensongère ou trompeuse, toute mention comparative ou dénigrante, l’affirmation d’être « le meilleur », et la mention du nom des clients, même avec leur accord (sauf cas encadré d’appel d’offres) [1].',
          'Les mots « spécialiste » ou « spécialisé » sont réservés aux avocats titulaires d’un certificat de spécialisation délivré par le CNB ; un avocat peut indiquer au plus trois domaines d’activité dominants, correspondant à une pratique effective et habituelle [1].',
        ],
      },
      {
        h2: 'Avocats : référencement payant, annuaires et avis',
        paras: [
          'Contrairement aux médecins, les avocats peuvent payer pour être visibles. Le vade-mecum admet l’achat de liens sponsorisés pour promouvoir un cabinet, à condition qu’ils reflètent l’activité et la compétence réelles du cabinet ; les règles sur les termes génériques et sur le mot « spécialiste » s’y appliquent aussi [1]. L’inscription prioritaire payante dans un annuaire est également permise, à condition de mentionner le barreau et de ne pas figurer dans un annuaire dont le contenu porterait atteinte aux principes de la profession [1].',
          'Sur les avis, la position est réservée : le vade-mecum déconseille de faire figurer des avis ou des notes de clients sur le site ou dans la promotion du cabinet, parce que leur provenance, leur véracité et leur objectivité ne peuvent pas être garanties, et rappelle que l’avocat est responsable des commentaires publiés à son sujet [1]. Les règles s’appliquent à toute communication directe ou indirecte, y compris par des tiers ou des sites tiers [1].',
          'Les avis laissés spontanément sur la fiche Google du cabinet sont un autre sujet : vous ne les contrôlez pas, mais vous pouvez y répondre, publiquement, sans jamais révéler d’élément couvert par le secret professionnel ni confirmer qu’une personne est cliente.',
        ],
      },
      {
        h2: 'Experts-comptables : l’article 152',
        paras: [
          'Pour les experts-comptables, l’article 152 du décret n° 2012-432 du 30 mars 2012, dans sa rédaction en vigueur depuis le 22 août 2014, encadre les actions de promotion [2]. Elles ont pour objet de procurer au public une information utile. Les moyens de promotion doivent être mis en œuvre sans porter atteinte à l’indépendance, à la dignité et à l’honneur de la profession, ni au secret professionnel et à la loyauté envers les clients et les confrères. Les communications doivent être décentes et empreintes de retenue, ne comporter aucune inexactitude ni risquer d’induire le public en erreur, et être exemptes de tout élément comparatif [2].',
          'En pratique, un cabinet comptable peut avoir un site détaillé, publier des articles, être présent sur LinkedIn et communiquer sur ses offres, à condition de rester exact et de ne pas se comparer à ses confrères. « Le cabinet le moins cher de Lyon » est exclu ; « Forfait tenue comptable pour SCI à partir de 90 € HT par mois » est une information utile et vérifiable.',
        ],
      },
      {
        h2: 'Étape 1 : un site qui répond aux questions des clients',
        paras: [
          'Les clients d’un avocat ou d’un expert-comptable cherchent rarement le nom d’un cabinet ; ils cherchent une réponse à leur problème. Le site doit donc présenter les domaines d’activité sous forme de pages dédiées, chacune centrée sur une situation réelle.',
        ],
        list: [
          'Roussel Avocats : une page par domaine dominant (droit du travail côté salarié, rupture conventionnelle, licenciement), avec le déroulement d’une procédure, les délais habituels, les documents à préparer et la manière dont les honoraires sont fixés.',
          'Bertin & Associés : une page par type de client (SCI, professions libérales, startups), avec les missions, le calendrier fiscal, les forfaits indicatifs.',
          'Une page par associé ou collaborateur : parcours, diplômes, certificats de spécialisation réels, langues, publications.',
          'Une page honoraires claire : le vade-mecum recommande vivement une rubrique dédiée [1].',
        ],
        after: [
          'Ces pages répondent aux critères de Google sur les sujets juridiques et financiers, que la firme classe parmi les sujets « Your Money or Your Life », pour lesquels ses systèmes donnent un poids accru aux contenus montrant expérience, expertise, autorité et fiabilité [3]. Notre guide [E-E-A-T pour une petite entreprise](/guides/eeat-petite-entreprise) explique comment le montrer concrètement.',
        ],
      },
      {
        h2: 'Étape 2 : des articles utiles, signés et datés',
        paras: [
          'Un article d’actualité juridique ou fiscale bien fait (« Barème des indemnités prud’homales : ce qui s’applique en 2026 », « Location meublée : régime réel ou micro-BIC ? ») attire des recherches précises et montre une compétence. Il doit être signé par un professionnel identifié, daté, et mis à jour quand la règle change. Un article de 2021 sur une règle modifiée depuis est pire qu’aucun article : il trompe le lecteur, et un assistant d’IA peut le reprendre.',
          'Ces contenus sont aussi ceux que les assistants citent quand un acheteur leur pose une question. Écrivez la réponse dans les premières lignes, avec les conditions et les exceptions, comme le décrit notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent). L’outil gratuit [Citabilité](/outils/citabilite) vérifie une page sur 20 règles de clarté.',
        ],
      },
      {
        h2: 'Étape 3 : fiche Google, annuaires et identité de marque',
        list: [
          'Fiche Google : nom exact du cabinet, adresse réelle où vous recevez, catégorie précise. Un praticien qui a sa propre fiche ne doit pas en créer une par spécialité, et quand il exerce avec d’autres dans un même lieu, le titre de sa fiche ne comporte que son nom [4].',
          'Annuaires officiels de la profession (annuaire du barreau, annuaire de l’Ordre des experts-comptables) : vérifiez que vos informations y sont identiques à celles du site.',
          'Données structurées : un balisage Organization ou LocalBusiness sur la page « Le cabinet », avec l’adresse, le téléphone et les liens vers vos profils officiels. Notre guide [Page « À propos » et entité de marque](/guides/entite-de-marque-wikidata-sameas) détaille la méthode, et le [Validateur JSON-LD](/outils/json-ld) contrôle le résultat.',
          'LinkedIn : pour un cabinet qui travaille avec des entreprises, c’est souvent le canal principal. Voir notre guide [LinkedIn et visibilité B2B dans les IA](/guides/linkedin-visibilite-b2b-ia).',
        ],
      },
      {
        h2: 'Exemple : la page « Licenciement » du cabinet Roussel',
        paras: [
          'La page fictive commence par la réponse que cherche le salarié : « Vous venez d’être convoqué à un entretien préalable ou licencié ? Le cabinet Roussel Avocats, inscrit au barreau de Bordeaux, vous conseille et vous représente devant le conseil de prud’hommes. Attention : le délai pour contester un licenciement est limité. » Le délai lui-même est donné juste après, avec la référence de l’article du Code du travail et la date à laquelle le cabinet l’a vérifiée.',
          'Viennent ensuite les étapes (analyse de la lettre, négociation, saisine du conseil de prud’hommes, audience de conciliation), les documents à rassembler, la façon dont les honoraires sont fixés (forfait pour la consultation, convention d’honoraires pour la procédure) et la présentation de l’avocate qui traite ces dossiers, avec son parcours. Aucun nom de client, aucun pourcentage de dossiers gagnés, aucun « meilleur avocat de Bordeaux ».',
          'Une page construite ainsi répond à la recherche du salarié, montre la compétence sans enfreindre les règles, et fournit à un assistant des faits précis et sourcés. Elle se met à jour chaque fois que la règle évolue, avec une mention « mis à jour le… » visible.',
        ],
      },
      {
        h2: 'Experts-comptables : des pages par situation de client',
        paras: [
          'Pour Bertin & Associés, la logique est la même, appliquée aux situations des clients : « Créer sa société : ce que fait l’expert-comptable la première année », « SCI à l’impôt sur le revenu ou à l’impôt sur les sociétés : les critères », « Profession libérale : déclaration 2035 et calendrier ». Chaque page indique ce que le cabinet prend en charge, ce qui reste à faire par le client, les échéances et un ordre de prix.',
          'Ces pages remplacent avantageusement une liste générique de « missions comptables, fiscales et sociales ». Elles sont lues par le dirigeant qui compare deux cabinets, et c’est leur précision qui convainc, pas un slogan.',
        ],
      },
      {
        h2: 'Ce que les assistants d’IA changent pour ces métiers',
        paras: [
          'Les assistants répondent de plus en plus aux premières questions juridiques et fiscales des particuliers et des dirigeants. Pour un cabinet, l’enjeu n’est pas de « remplacer » cette réponse, mais d’être la source fiable que l’assistant cite, et le cabinet que l’on contacte quand la situation se complique. Cela suppose des pages exactes et à jour, et une identité claire (qui, où, quels domaines) cohérente sur le site, les annuaires et LinkedIn.',
          'Aucune technique n’assure une citation. Et les règles déontologiques s’appliquent à ce que vous publiez, pas à ce qu’un assistant dit de vous : si une réponse vous attribue une spécialisation que vous n’avez pas, corrigez la source plutôt que d’en profiter.',
        ],
      },
      {
        h2: 'Liste de contrôle déontologique du site',
        list: [
          'Nom de domaine conforme (nom du cabinet, pas de terme générique) pour un avocat.',
          'Mentions d’identification complètes : barreau ou inscription à l’Ordre, structure, adresse, contact.',
          'Aucun superlatif comparatif (« le meilleur », « le moins cher »).',
          'Aucun nom de client (avocats), aucune information couverte par le secret.',
          '« Spécialiste » uniquement avec un certificat (avocats) ; au plus trois domaines dominants affichés.',
          'Pas d’avis clients affichés sur le site (avocats) ; réponses prudentes sur les plateformes.',
          'Contenus datés, signés, revus à chaque changement de règle.',
          'Déclaration du site et de ses modifications substantielles à l’Ordre (avocats).',
        ],
      },
    ],
    faq: [
      { q: 'Un avocat peut-il acheter des mots-clés sur Google Ads ?', a: 'Le vade-mecum du CNB admet l’achat de liens sponsorisés s’ils reflètent l’activité et la compétence réelles du cabinet, en respectant les règles sur les termes génériques et le mot « spécialiste ».' },
      { q: 'Un expert-comptable peut-il afficher ses prix ?', a: 'Oui, une information tarifaire exacte est une information utile au sens de l’article 152, à condition de ne pas la présenter de façon comparative avec les confrères et de ne pas induire en erreur.' },
      { q: 'Peut-on publier des cas clients ?', a: 'Pour un avocat, la mention du nom des clients est strictement interdite, même avec leur accord. Un cas anonymisé, sans élément permettant d’identifier le client, est la seule voie, sous réserve du secret professionnel.' },
    ],
    sources: [
      { label: 'Conseil national des barreaux, Vade-mecum de la communication des avocats (3e édition, octobre 2023)', url: 'https://www.cnb.avocat.fr/sites/default/files/documents/vademecum_communication_des_avocats.pdf', note: VU },
      { label: 'Légifrance, décret n° 2012-432 du 30 mars 2012, article 152 (promotion des experts-comptables)', url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000029387074', note: VU },
      { label: 'Google Search Central, créer des contenus utiles et fiables (E-E-A-T, sujets YMYL)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Aide Google Business Profile, règles de représentation (praticiens)', url: 'https://support.google.com/business/answer/3038177?hl=en', note: VU },
    ],
    cta: { text: 'Vos pages de domaines d’activité donnent-elles la réponse en tête, avec date et auteur ? Testez-en une avec l’outil gratuit.', href: '/outils/citabilite', label: 'Tester une page' },
    related: ['seo-b2b-acheteurs', 'eeat-petite-entreprise', 'page-que-les-ia-citent', 'entite-de-marque-wikidata-sameas'],
  },
  /* ------------------------------------------------------------------ */
  /* ChatGPT Search et OAI-SearchBot                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'chatgpt-search-oai-searchbot',
    seoTitle: 'ChatGPT Search et OAI-SearchBot : le guide détaillé',
    title: 'ChatGPT Search et OAI-SearchBot : comment ça marche',
    description:
      'Comment ChatGPT cherche sur le web, ce que fait OAI-SearchBot, comment l’autoriser sans céder vos textes à l’entraînement, et comment mesurer le trafic reçu.',
    updated: D,
    published: D,
    intro: [
      'Quand ChatGPT répond à une question d’actualité, compare des offres ou cite un site en lien sous sa réponse, il ne puise pas seulement dans ce qu’il a appris : il cherche sur le web. Cette fonction, lancée sous le nom de ChatGPT search, repose sur des robots, des fournisseurs de recherche et des règles qu’un propriétaire de site peut connaître et en partie maîtriser.',
      'Ce guide détaille ce qu’OpenAI documente publiquement : les robots et leurs rôles, les réglages de robots.txt, la différence entre être cité et être utilisé pour l’entraînement, le suivi du trafic. Il signale aussi ce qu’OpenAI ne dit pas, et qui reste donc incertain. Pour une vue plus large des robots de toutes les IA, voyez notre guide [Robots d’IA : lesquels autoriser](/guides/robots-ia-robots-txt).',
    ],
    sections: [
      {
        h2: 'Ce qu’est ChatGPT search, en dates',
        paras: [
          'OpenAI a présenté ChatGPT search le 31 octobre 2024, d’abord pour les abonnés Plus et Team et les inscrits à la liste d’attente de SearchGPT [1]. Selon les mises à jour de l’annonce, la fonction a été ouverte à tous les utilisateurs connectés le 16 décembre 2024, puis le 5 février 2025 à tous les utilisateurs, sans inscription, là où ChatGPT est disponible [1].',
          'OpenAI explique que ChatGPT décide de lui-même quand chercher sur le web, selon la question, et que l’utilisateur peut aussi le demander explicitement. Les réponses peuvent contenir des liens vers les sources, et un bouton « Sources » ouvre la liste des références [1]. Pour trouver ces sources, OpenAI indique s’appuyer sur des fournisseurs de recherche tiers et sur des contenus fournis directement par des partenaires [1]. OpenAI ne publie pas la liste détaillée de ses fournisseurs : tout ce qui se dit sur la part exacte de tel ou tel moteur relève de l’observation extérieure, pas d’une information officielle.',
        ],
      },
      {
        h2: 'Les robots d’OpenAI et leurs rôles',
        paras: ['OpenAI documente quatre agents distincts, chacun réglable séparément dans robots.txt [2] :'],
        list: [
          'OAI-SearchBot : il sert à faire apparaître des sites dans les résultats des fonctions de recherche de ChatGPT. Un site qui le bloque n’apparaît pas dans les réponses de recherche, même s’il peut encore figurer comme simple lien de navigation [2].',
          'GPTBot : il collecte des contenus susceptibles de servir à l’entraînement des modèles de fondation d’OpenAI. Le bloquer signale que vos contenus ne doivent pas servir à cet entraînement [2].',
          'ChatGPT-User : il visite une page quand un utilisateur pose une question à ChatGPT ou à un GPT personnalisé, ou utilise une action. Il n’explore pas le web de façon automatique, et OpenAI précise que les règles de robots.txt peuvent ne pas s’appliquer à ces actions déclenchées par un utilisateur [2].',
          'OAI-AdsBot : il ne visite que les pages soumises comme annonces publicitaires, pour vérifier leur sûreté, et ses données ne servent pas à l’entraînement [2].',
        ],
        after: [
          'La conséquence est simple et souvent mal comprise : on peut refuser l’entraînement (GPTBot) tout en restant visible dans la recherche de ChatGPT (OAI-SearchBot). Le centre d’aide d’OpenAI pour les éditeurs le dit en ces termes : la recherche et l’entraînement sont contrôlés par deux agents différents [3].',
        ],
      },
      {
        h2: 'Les réglages de robots.txt, cas par cas',
        paras: [
          'Voici trois configurations courantes. Elles se placent dans le fichier robots.txt à la racine du site. Notre [Générateur de robots.txt](/outils/generateur-robots-txt) produit ces blocs sans erreur de syntaxe, et l’outil [Robots d’IA](/outils/robots-ia) vérifie, robot par robot, ce que votre fichier actuel autorise.',
        ],
        list: [
          'Visible dans ChatGPT, pas d’entraînement : autoriser OAI-SearchBot, interdire GPTBot (User-agent: GPTBot puis Disallow: /).',
          'Visible et entraînement accepté : ne rien bloquer pour ces deux agents.',
          'Invisible dans la recherche de ChatGPT : interdire OAI-SearchBot. À réserver aux sites qui ont une raison claire de ne pas être cités.',
        ],
        after: [
          'Deux précisions d’OpenAI. D’abord, une modification de robots.txt peut mettre environ 24 heures à être prise en compte par ses systèmes de recherche [2]. Ensuite, interdire l’exploration ne suffit pas toujours à disparaître : une page bloquée par robots.txt peut encore apparaître sous forme de simple lien avec son titre, notamment dans le navigateur ChatGPT Atlas, si ChatGPT a connu son adresse par un fournisseur tiers ou par d’autres pages [3]. Pour l’empêcher, OpenAI recommande la balise meta noindex, ce qui suppose de laisser le robot lire la page pour qu’il voie la balise [3].',
          'Attention aux blocages involontaires : un pare-feu, un CDN ou une extension de sécurité peut refuser ces robots sans que robots.txt n’en dise rien. OpenAI publie les plages d’adresses IP de chacun de ses agents dans des fichiers JSON, ce qui permet à votre hébergeur de les autoriser précisément [2].',
        ],
      },
      {
        h2: 'Ce qui fait qu’une page est retenue',
        paras: [
          'OpenAI dit qu’un site public peut apparaître dans ChatGPT search et que, pour que vos contenus figurent dans les résumés et extraits, il ne faut pas bloquer OAI-SearchBot [3]. Au-delà, OpenAI ne publie pas de critères de sélection détaillés. Ce que l’on sait du fonctionnement des moteurs de réponse en général, et qu’on observe aussi chez ChatGPT, pousse vers les mêmes bonnes pratiques :',
        ],
        list: [
          'Le texte doit être présent dans le HTML : les robots d’IA n’exécutent généralement pas le JavaScript. Vérifiez une page avec notre outil [Rendu sans JavaScript](/outils/rendu-sans-javascript).',
          'La réponse doit être dans les premières lignes de la page, formulée pour être comprise hors contexte, avec les faits (prix, délais, zones, conditions) écrits en clair.',
          'Les faits doivent être datés et cohérents avec ce que disent vos autres profils (fiche Google, annuaires, LinkedIn).',
          'La page doit être indexable par les moteurs classiques, puisqu’OpenAI s’appuie sur des fournisseurs de recherche tiers dont il ne détaille pas la liste [1].',
        ],
        after: [
          'Notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent) détaille ces règles une à une. Et parce que ChatGPT cite beaucoup de sites tiers (comparatifs, presse, forums), votre présence ailleurs compte autant que votre site : notre guide sur la façon d’apparaître dans ChatGPT quand on est une PME détaille ce travail sur les sources tierces.',
        ],
      },
      {
        h2: 'Exemple : le réglage d’une PME fictive',
        paras: [
          'Prenons Atelier Numérique Vasseur, une agence web fictive de douze personnes à Lille. Sa direction veut être citée quand un prospect demande à ChatGPT « une agence pour refaire le site d’une PME industrielle dans le Nord », mais ne souhaite pas que ses études de cas servent à entraîner des modèles. Son prestataire constate trois choses en vérifiant le site.',
        ],
        list: [
          'Le robots.txt contient un bloc qui interdit GPTBot : c’est voulu, on le garde.',
          'Le même fichier ne mentionne pas OAI-SearchBot, qui est donc autorisé par défaut ; mais le pare-feu de l’hébergeur renvoie une erreur 403 aux robots « inconnus ». OAI-SearchBot ne peut donc rien lire. La correction passe par l’hébergeur, qui autorise les plages d’adresses publiées par OpenAI.',
          'Les pages d’études de cas affichent leur texte via un script : le HTML initial ne contient qu’un titre. L’agence passe ces pages en rendu côté serveur.',
        ],
        after: [
          'Après correction, l’agence attend quelques jours, puis pose ses vingt questions d’acheteurs à ChatGPT chaque mois. Elle ne sait pas si elle sera citée, et personne ne peut le lui promettre ; elle sait en revanche qu’aucun obstacle technique ne l’en empêche, ce qui n’était pas le cas avant.',
        ],
      },
      {
        h2: 'Mesurer le trafic venu de ChatGPT',
        paras: [
          'Le centre d’aide d’OpenAI indique que ChatGPT ajoute automatiquement le paramètre utm_source=chatgpt.com aux liens de référence, ce qui permet de suivre ce trafic dans un outil comme Google Analytics [3]. Dans GA4, ce trafic se retrouve donc dans les rapports d’acquisition, sous la source chatgpt.com.',
          'Deux limites à garder en tête. Une partie des visites venues d’un assistant arrive sans paramètre ni référent (lien copié-collé, application mobile), et se retrouve dans le trafic direct. Et beaucoup de réponses ne génèrent aucun clic : l’utilisateur lit la réponse et s’arrête là. Le trafic mesuré est donc un minimum, pas une mesure de votre visibilité. Pour vos propres liens publiés ailleurs (e-mails, réseaux), notre [Générateur de liens UTM](/outils/generateur-utm) fabrique des adresses de suivi cohérentes. Notre guide [Mesurer le trafic venu de ChatGPT dans GA4](/guides/trafic-chatgpt-ga4) détaille la configuration des rapports et des segments.',
        ],
      },
      {
        h2: 'Mesurer la visibilité, pas seulement le trafic',
        paras: [
          'La vraie question n’est pas « combien de visites ChatGPT m’envoie-t-il ? », mais « dans combien de réponses suis-je cité quand un client pose une question sur mon métier ? ». Elle se mesure en posant régulièrement les mêmes questions d’acheteurs, plusieurs fois, et en notant si votre nom et vos pages apparaissent. Les réponses changent d’une exécution à l’autre : un seul essai ne prouve rien.',
          'Notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt) propose une méthode manuelle, et le suivi de Repéré automatise ces relevés. Dans les deux cas, on mesure une fréquence d’apparition, jamais une position garantie.',
        ],
      },
      {
        h2: 'ChatGPT Atlas et les agents qui naviguent',
        paras: [
          'OpenAI propose aussi un navigateur, ChatGPT Atlas, et des fonctions d’agent qui parcourent des pages pour accomplir une tâche. Le centre d’aide indique qu’Atlas s’appuie sur les rôles et libellés ARIA pour interpréter la structure des pages, et recommande d’ajouter des attributs ARIA descriptifs aux éléments interactifs [3]. C’est une raison de plus de soigner l’accessibilité de vos formulaires et boutons : ce qui aide un lecteur d’écran aide aussi un agent. Notre guide [Accessibilité et SEO](/guides/accessibilite-et-seo) fait le lien entre les deux.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Bloquer « tous les robots d’IA » d’un coup avec une extension ou un réglage de CDN, sans distinguer recherche et entraînement.',
          'Croire qu’un blocage dans robots.txt efface une page de ChatGPT : le lien et le titre peuvent rester visibles, seul noindex l’empêche.',
          'Juger sa visibilité sur une seule question posée une seule fois, depuis son propre compte, avec l’historique de ses conversations.',
          'Confondre le trafic mesuré dans GA4 et la visibilité réelle : beaucoup de réponses citent un site sans générer de clic.',
        ],
      },
      {
        h2: 'Ce qu’on ne sait pas',
        list: [
          'Le poids exact de chaque fournisseur de recherche tiers dans les résultats de ChatGPT : OpenAI ne le publie pas.',
          'Les critères précis de sélection et d’ordre des sources dans une réponse.',
          'L’effet d’un fichier llms.txt, que la documentation d’OpenAI citée ici ne mentionne pas.',
          'La part des contenus de partenaires de presse dans les réponses d’actualité, et la façon dont elle évolue.',
        ],
        after: [
          'Méfiez-vous des offres qui prétendent « garantir » une citation dans ChatGPT : aucune ne peut s’appuyer sur une règle publique d’OpenAI. Ce qui est sûr, c’est ce qui est documenté : ne pas bloquer OAI-SearchBot, rendre le texte lisible, être exact et cohérent partout.',
        ],
      },
    ],
    faq: [
      { q: 'Bloquer GPTBot me fait-il disparaître de ChatGPT ?', a: 'Pas de la recherche : GPTBot concerne l’entraînement. C’est OAI-SearchBot qui permet d’apparaître dans les résultats de recherche de ChatGPT. Les deux se règlent séparément dans robots.txt.' },
      { q: 'Combien de temps pour qu’un changement de robots.txt soit pris en compte ?', a: 'OpenAI indique qu’il peut falloir environ 24 heures à ses systèmes de recherche pour s’adapter à une modification de robots.txt.' },
      { q: 'Faut-il s’inscrire quelque part pour être dans ChatGPT search ?', a: 'Non. OpenAI indique que tout site public peut apparaître. Il n’existe pas de console d’inscription comparable à la Search Console de Google pour ChatGPT.' },
      { q: 'Comment empêcher totalement l’affichage d’une page ?', a: 'Utilisez la balise meta noindex et laissez OAI-SearchBot lire la page pour qu’il la voie. Un simple blocage dans robots.txt peut laisser apparaître le lien et le titre.' },
    ],
    sources: [
      { label: 'OpenAI, Introducing ChatGPT search (31 oct. 2024, mises à jour du 16 déc. 2024 et du 5 févr. 2025)', url: 'https://openai.com/index/introducing-chatgpt-search/', note: VU },
      { label: 'OpenAI, Overview of OpenAI Crawlers (OAI-SearchBot, GPTBot, ChatGPT-User, OAI-AdsBot)', url: 'https://developers.openai.com/api/docs/bots.md', note: VU },
      { label: 'Centre d’aide OpenAI, Publishers and Developers FAQ (noindex, utm_source, Atlas)', url: 'https://help.openai.com/en/articles/12627856-publishers-and-developers-faq', note: VU },
    ],
    cta: { text: 'OAI-SearchBot peut-il lire votre site, et GPTBot est-il réglé comme vous le souhaitez ? L’outil gratuit le vérifie robot par robot.', href: '/outils/robots-ia', label: 'Tester l’accès des robots d’IA' },
    related: ['robots-ia-robots-txt', 'trafic-chatgpt-ga4', 'suivre-ses-questions-chatgpt', 'apparaitre-dans-chatgpt-pme'],
  },

  /* ------------------------------------------------------------------ */
  /* Gemini : sources et Google-Extended                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: 'gemini-sources-google-extended',
    seoTitle: 'Gemini : d’où viennent ses réponses et ses sources',
    title: 'Gemini : d’où viennent ses réponses et ses sources',
    description:
      'Application Gemini, aperçus IA, mode IA : ce que chacun lit, ce que contrôle Google-Extended, et pourquoi le bloquer ne change rien à votre classement Google.',
    updated: D,
    published: D,
    intro: [
      '« Gemini » désigne à la fois une famille de modèles d’IA de Google, une application de conversation (sur le web, Android et iPhone) et la technologie qui alimente les aperçus IA et le mode IA dans la recherche Google. Ces produits ne se règlent pas de la même façon, et la confusion conduit à des décisions coûteuses : des sites bloquent Google-Extended en croyant se protéger, d’autres pensent qu’il faut l’autoriser pour apparaître dans les aperçus IA.',
      'Ce guide sépare les trois cas, à partir de la documentation de Google, et dit ce qu’un propriétaire de site peut faire pour chacun. Pour le détail des aperçus IA et du mode IA dans la recherche, voyez aussi notre guide [Aperçus IA et mode IA de Google](/guides/apercus-ia-google).',
    ],
    sections: [
      {
        h2: 'Trois produits, trois logiques',
        list: [
          'Les aperçus IA et le mode IA : ce sont des fonctions de la recherche Google. Elles s’appuient sur l’index de Google Search et sur Googlebot. Pour y figurer, une page doit être indexée et pouvoir s’afficher avec un extrait ; Google précise qu’il n’existe pas d’exigence technique supplémentaire [3].',
          'L’application Gemini : un assistant de conversation, qui peut, selon la question, s’appuyer sur la recherche Google et afficher des sources [2].',
          'Les modèles Gemini proposés aux entreprises via Vertex AI et l’API Gemini : ils peuvent eux aussi être « ancrés » sur les résultats de Google Search, quand le développeur active cette option [1].',
        ],
        after: [
          'La distinction compte parce que les réglages ne sont pas les mêmes : Googlebot et les balises de la recherche (noindex, nosnippet) gouvernent les deux premiers usages de l’index ; Google-Extended gouverne l’entraînement des modèles et l’ancrage dans l’application Gemini et Vertex AI.',
        ],
      },
      {
        h2: 'Ce que contrôle Google-Extended, exactement',
        paras: [
          'Google-Extended est un jeton que l’on utilise dans robots.txt. Google le décrit comme un jeton de produit autonome qui permet aux éditeurs de choisir si les contenus que Google explore sur leurs sites peuvent servir à entraîner les futurs modèles Gemini, qui alimentent l’application Gemini et l’API Gemini de Vertex AI, et à l’ancrage (le fait de fournir au modèle, au moment de la question, des contenus issus de l’index de Google Search) dans l’application Gemini et dans l’ancrage avec Google Search sur Vertex AI [1].',
          'Deux précisions de la même page sont essentielles. Google-Extended n’a aucune incidence sur l’inclusion d’un site dans la recherche Google, et il n’y est pas utilisé comme signal de classement [1]. Et il n’a pas de robot distinct : l’exploration se fait avec les agents habituels de Google, le jeton sert seulement à exprimer votre choix dans robots.txt [1].',
        ],
        list: [
          'Bloquer Google-Extended (User-agent: Google-Extended puis Disallow: /) : vos pages ne servent plus à l’entraînement des futurs modèles Gemini ni à l’ancrage dans l’application Gemini ; votre présence dans Google Search, y compris dans ses fonctions d’IA, ne dépend pas de ce jeton.',
          'Ne pas le bloquer : vos pages peuvent servir à l’entraînement et être utilisées pour ancrer des réponses de l’application Gemini.',
        ],
        after: [
          'Notre outil [Robots d’IA](/outils/robots-ia) indique si votre robots.txt bloque Google-Extended, Googlebot ou d’autres agents, et notre [Générateur de robots.txt](/outils/generateur-robots-txt) produit la règle voulue.',
        ],
      },
      {
        h2: 'Aperçus IA et mode IA : c’est Googlebot qui compte',
        paras: [
          'Pour les fonctions d’IA de la recherche, la documentation de Google est sans ambiguïté : une page doit être indexée et éligible à l’affichage d’un extrait, sans autre exigence technique, et les pratiques SEO habituelles s’appliquent [3]. Google explique aussi que ces fonctions peuvent lancer plusieurs recherches apparentées sur des sous-thèmes pour construire une réponse (ce qu’il appelle le « query fan-out »), ce qui peut faire apparaître un éventail plus large de pages [3].',
          'Les commandes à votre disposition sont celles de la recherche : nosnippet, data-nosnippet, max-snippet ou noindex pour limiter ce qui est affiché à partir de vos pages, et robots.txt pour l’accès de Googlebot [3]. Google rapporte les apparitions dans ces fonctions dans le rapport Performances de la Search Console, sous le type de recherche « Web » [3] ; elles ne sont pas isolées dans un rapport à part. Notre guide [La Search Console pour débutants](/guides/search-console-debutants) explique où les lire.',
          'Avant tout, vérifiez que vos pages importantes sont indexables : notre [Testeur d’indexabilité](/outils/indexabilite) contrôle en une fois la balise robots, l’en-tête X-Robots-Tag, la balise canonique et robots.txt.',
        ],
      },
      {
        h2: 'Dans l’application Gemini, comment s’affichent les sources',
        paras: [
          'L’aide de Google indique que les applications Gemini affichent parfois des sources et des contenus associés dans et sous la réponse : quand c’est le cas, un bouton « Sources » apparaît en bas de la réponse ou dans le texte, et ouvre un panneau avec les liens correspondants [2]. Ces liens peuvent renvoyer vers des sites publics, mais aussi vers des fichiers que l’utilisateur a importés ou, s’il a connecté Google Workspace, vers ses documents et e-mails [2]. Si aucun bouton n’apparaît, c’est que Gemini n’a pas fourni de liens pour cette réponse [2].',
          'Autrement dit, une réponse de Gemini n’est pas toujours accompagnée de sources, et quand elle l’est, rien ne garantit que la vôtre y figure. Google lui-même prévient que Gemini peut produire des informations inexactes, « halluciner », et qu’il ne faut pas se fier à ses réponses comme à un avis médical, juridique ou financier [4].',
        ],
      },
      {
        h2: 'Faut-il bloquer Google-Extended ?',
        paras: [
          'C’est une décision qui dépend de votre modèle économique, pas une question technique. Quelques repères :',
        ],
        list: [
          'Un commerce local, un artisan, une PME de services : vous avez généralement intérêt à être lu et compris par le plus d’assistants possible. Bloquer Google-Extended peut réduire l’usage de vos pages pour ancrer les réponses de l’application Gemini, sans rien vous apporter en retour.',
          'Un éditeur dont les contenus sont le produit (presse, études payantes, formation) : bloquer l’entraînement peut se justifier. Mesurez alors qu’il couvre aussi l’ancrage dans l’application Gemini.',
          'Dans tous les cas : ne bloquez pas Googlebot pour « échapper à l’IA ». Vous disparaîtriez de la recherche Google elle-même.',
        ],
        after: [
          'Si vous changez d’avis, la règle se modifie dans robots.txt. Google ne précise pas, dans la page consultée, le délai de prise en compte ni le sort des contenus déjà utilisés pour l’entraînement : considérez que le choix vaut pour l’avenir.',
        ],
      },
      {
        h2: 'Exemple : deux décisions, deux raisonnements',
        paras: [
          'Le Fournil de Saint-Ouen, boulangerie fictive, veut être recommandé par tous les assistants quand on cherche « bon pain au levain à Saint-Ouen ». Elle ne bloque ni Googlebot ni Google-Extended : ses pages peuvent servir à l’entraînement et à l’ancrage de Gemini, ce qui ne lui coûte rien et peut l’aider à être bien décrite. Elle soigne en revanche sa fiche Google et sa page d’accueil, qui sont lues par la recherche.',
          'La Revue des métiers d’art, éditeur fictif d’une revue spécialisée vendue sur abonnement, fait le choix inverse pour une partie de son site : elle bloque Google-Extended sur les articles réservés aux abonnés, parce que leur contenu est son produit. Elle laisse Googlebot accéder aux pages de présentation et aux extraits gratuits, pour rester trouvable dans la recherche et dans ses aperçus IA. Les deux décisions sont cohérentes ; elles répondent à des modèles économiques différents.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Bloquer Googlebot pour « sortir de l’IA de Google » : la page disparaît aussi des résultats classiques.',
          'Autoriser Google-Extended en pensant que c’est une condition pour apparaître dans les aperçus IA : ce n’est pas le cas selon la documentation [1].',
          'Ajouter un noindex sur des pages importantes pour éviter qu’elles soient résumées : elles perdent tout le trafic de recherche.',
          'Conclure de l’absence de bouton « Sources » dans une réponse que votre site est ignoré : beaucoup de réponses n’en affichent pas.',
        ],
      },
      {
        h2: 'Ce qui aide vos pages à être reprises',
        paras: [
          'Que la réponse vienne des aperçus IA, du mode IA ou de l’application Gemini, elle s’appuie sur des pages indexées par Google. Les leviers sont donc ceux d’un bon référencement, appliqués avec rigueur :',
        ],
        list: [
          'des pages qui répondent à une question précise, avec la réponse dans les premières lignes ;',
          'des faits datés et vérifiables, cohérents avec votre fiche Google et vos autres profils ;',
          'un texte lisible dans le HTML, sans dépendre d’un script ;',
          'une page « À propos » qui dit clairement qui vous êtes, où et depuis quand (voir [Page « À propos » et entité de marque](/guides/entite-de-marque-wikidata-sameas)).',
        ],
        after: [
          'Et si Gemini affirme quelque chose de faux à votre sujet, la correction passe d’abord par la source qui alimente l’erreur ; notre guide [Les IA disent des choses fausses sur votre entreprise](/guides/ia-disent-des-choses-fausses) décrit la démarche, y compris le signalement à l’éditeur de l’assistant.',
        ],
      },
      {
        h2: 'Mesurer ce que Gemini vous apporte',
        paras: [
          'Pour la recherche, la Search Console reste la source : les impressions et clics issus des aperçus IA et du mode IA y sont comptés avec le reste du trafic web [3], sans distinction. Pour l’application Gemini, il n’existe pas de rapport équivalent pour les éditeurs. Les visites qui en proviennent apparaissent dans votre outil d’analyse selon ce que transmet le navigateur : regardez quels référents Google autres que la recherche figurent dans vos rapports d’acquisition, en sachant qu’une partie des visites arrive sans référent. Le plus fiable reste de poser régulièrement à Gemini les questions de vos clients et de noter si vous êtes cité, comme le décrit notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt), dont la méthode s’applique à tous les assistants.',
        ],
      },
      {
        h2: 'Ce qui reste incertain',
        list: [
          'Le fonctionnement exact de l’ancrage dans l’application Gemini : quand il se déclenche, combien de pages sont lues, comment elles sont choisies.',
          'La différence de traitement entre les pages qui bloquent Google-Extended et les autres dans l’application Gemini, au-delà de ce que dit la documentation.',
          'L’évolution des produits : Google change régulièrement les noms, les fonctions et leur disponibilité par pays. Revérifiez la documentation avant de décider.',
        ],
      },
    ],
    faq: [
      { q: 'Bloquer Google-Extended me retire-t-il des aperçus IA ?', a: 'Selon la documentation de Google, Google-Extended n’a aucune incidence sur l’inclusion dans la recherche Google ni sur le classement. Les aperçus IA et le mode IA dépendent de l’indexation par Googlebot et des balises de la recherche.' },
      { q: 'Comment sortir mes pages des aperçus IA ?', a: 'Avec les commandes de la recherche : nosnippet, data-nosnippet ou max-snippet limitent ce qui est repris, noindex retire la page de la recherche. Ces réglages s’appliquent aussi aux résultats classiques.' },
      { q: 'Google-Extended a-t-il son propre robot dans mes journaux ?', a: 'Non. Google indique que Google-Extended n’a pas de chaîne d’agent distincte : l’exploration se fait avec les robots habituels de Google, et le jeton sert seulement à exprimer votre choix dans robots.txt.' },
      { q: 'Les réponses de Gemini sont-elles fiables pour mes clients ?', a: 'Google prévient lui-même qu’elles peuvent être inexactes. C’est une raison de plus de publier des informations claires et à jour sur votre site et votre fiche : ce sont les sources que l’assistant peut lire.' },
      { q: 'Gemini lit-il mon site en direct ?', a: 'L’ancrage dans l’application Gemini fournit au modèle des contenus issus de l’index de Google Search au moment de la question. Votre page doit donc d’abord être indexée par Google.' },
    ],
    sources: [
      { label: 'Google, liste des robots d’exploration communs (section Google-Extended)', url: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers?hl=fr', note: `mise à jour du 4 nov. 2026 ; ${VU}` },
      { label: 'Aide Gemini, afficher les sources associées aux réponses des applications Gemini', url: 'https://support.google.com/gemini/answer/14143489', note: VU },
      { label: 'Google Search Central, fonctionnalités d’IA et votre site (éligibilité, query fan-out, commandes, Search Console)', url: 'https://developers.google.com/search/docs/appearance/ai-features', note: `mise à jour du 10 déc. 2025 ; ${VU}` },
      { label: 'Aide Gemini, à propos des réponses des applications Gemini (inexactitudes, limites)', url: 'https://support.google.com/gemini/answer/16279220?hl=en', note: VU },
    ],
    cta: { text: 'Votre robots.txt bloque-t-il Google-Extended, Googlebot ou d’autres robots sans que vous le sachiez ? Vérifiez-le en une minute.', href: '/outils/robots-ia', label: 'Tester mon robots.txt' },
    related: ['apercus-ia-google', 'robots-ia-robots-txt', 'search-console-debutants', 'ia-disent-des-choses-fausses'],
  },

  /* ------------------------------------------------------------------ */
  /* Claude et Mistral (Vibe) : sources                                   */
  /* ------------------------------------------------------------------ */
  {
    slug: 'claude-mistral-vibe-sources',
    seoTitle: 'Claude et Mistral Vibe : d’où viennent leurs sources',
    title: 'Claude et Mistral Vibe : d’où viennent leurs sources',
    description:
      'Robots d’Anthropic et de Mistral, recherche web de Claude, Le Chat devenu Vibe, accord avec l’AFP : ce qui est documenté, ce qui ne l’est pas, et quoi régler.',
    updated: D,
    published: D,
    intro: [
      'ChatGPT et Gemini occupent l’essentiel des discussions, mais beaucoup d’entreprises françaises utilisent aussi Claude, l’assistant d’Anthropic, et l’assistant de Mistral AI, qui s’appelait Le Chat jusqu’en mai 2026 et s’appelle désormais Vibe. Ces assistants cherchent aussi sur le web, citent des pages et envoient des robots sur votre site. Leurs règles sont moins connues, et une partie de leur fonctionnement n’est pas documentée.',
      'Ce guide rassemble ce que les deux éditeurs publient sur leurs robots, ce que l’on sait de leurs sources de recherche, et ce qui reste incertain. Il complète notre guide général [Robots d’IA : lesquels autoriser](/guides/robots-ia-robots-txt) et nos guides consacrés à [ChatGPT Search](/guides/chatgpt-search-oai-searchbot) et à [Perplexity](/guides/perplexity-sources).',
    ],
    sections: [
      {
        h2: 'Les trois robots d’Anthropic',
        paras: ['Anthropic documente trois agents, chacun avec un rôle distinct [1] :'],
        list: [
          'ClaudeBot collecte des contenus web susceptibles de contribuer à l’entraînement des modèles. Le bloquer signale que les futurs contenus du site doivent être exclus des jeux de données d’entraînement [1].',
          'Claude-User accède aux sites quand des utilisateurs posent des questions à Claude. Le bloquer peut réduire la visibilité de votre site dans les recherches web dirigées par les utilisateurs [1].',
          'Claude-SearchBot parcourt le web pour améliorer la qualité des résultats de recherche proposés aux utilisateurs. Le bloquer peut réduire la visibilité et l’exactitude de votre site dans ces résultats [1].',
        ],
        after: [
          'Anthropic indique que ses robots respectent les directives standard de robots.txt, et qu’il prend aussi en charge l’extension non standard Crawl-delay, pour ralentir l’exploration plutôt que de l’interdire [1]. Il déconseille le blocage par adresse IP, qui peut ne pas fonctionner correctement ni garantir durablement l’exclusion, et publie la liste des adresses IP de ses robots pour permettre de vérifier qu’une visite vient bien de lui [1].',
          'La logique est donc la même que chez OpenAI : on peut refuser l’entraînement (ClaudeBot) tout en restant lisible pour la recherche (Claude-SearchBot) et pour les visites déclenchées par un utilisateur (Claude-User). Notre outil [Robots d’IA](/outils/robots-ia) vérifie ces trois agents dans votre robots.txt.',
        ],
      },
      {
        h2: 'Où Claude cherche-t-il ?',
        paras: [
          'Anthropic ne détaille pas publiquement, dans les pages consultées, le moteur qui fournit les résultats de recherche web de Claude. En mars 2025, TechCrunch a rapporté qu’Anthropic avait ajouté Brave Search à la liste de ses sous-traitants, la semaine même du lancement de la recherche web dans Claude, ce qui laisse penser que Brave fournit au moins une partie des résultats [2]. L’article précise qu’Anthropic n’avait pas répondu à la demande de confirmation [2].',
          'Il faut donc rester prudent : cette information date de 2025, elle repose sur une liste de sous-traitants et non sur une explication technique, et rien n’indique la part de Brave par rapport aux robots propres d’Anthropic (Claude-SearchBot). Ce qui est sûr, c’est que vos pages doivent être accessibles aux robots d’Anthropic et indexables par les moteurs en général.',
        ],
      },
      {
        h2: 'Mistral : de Le Chat à Vibe',
        paras: [
          'Le 28 mai 2026, Mistral AI a annoncé que Le Chat devenait Vibe, un agent unique pour le travail et le code, avec reprise des conversations, réglages et abonnements existants [4]. L’annonce porte surtout sur les fonctions de travail (recherche dans les applications connectées de l’entreprise, exécution d’outils) et ne détaille pas la recherche web [4]. La documentation des robots de Mistral, elle, parle déjà de Vibe [3].',
        ],
      },
      {
        h2: 'Les trois robots de Mistral',
        paras: ['Mistral documente trois agents [3] :'],
        list: [
          'MistralAI-User : utilisé pour les actions des utilisateurs dans Vibe. Quand un utilisateur pose une question, Vibe peut visiter une page pour y répondre et lier la source. Mistral précise que cet agent n’explore pas le web de façon automatique et ne sert pas à collecter des contenus pour l’entraînement [3].',
          'MistralAI-Index : exploration automatisée uniquement destinée à l’indexation, pour alimenter la recherche de Mistral qui aide à répondre dans Vibe ; les contenus explorés ne servent à aucun entraînement d’IA générative [3].',
          'MistralAI-Training : il explore des contenus pour constituer des jeux de données d’entraînement des modèles de Mistral, et n’est utilisé ni pour l’indexation ni pour les requêtes en direct ; il peut être interdit dans robots.txt [3].',
        ],
        after: [
          'Mistral publie les plages d’adresses IP de MistralAI-User et de MistralAI-Index [3]. La page consultée ne dit pas explicitement que MistralAI-Index respecte robots.txt ; en pratique, déclarez vos règles pour chacun des trois agents, et vérifiez dans vos journaux de serveur ce qui se passe réellement.',
        ],
      },
      {
        h2: 'L’accord AFP, et ce qu’il dit des sources d’actualité',
        paras: [
          'Le 16 janvier 2025, Mistral a annoncé un partenariat mondial avec l’Agence France-Presse : l’assistant peut s’appuyer sur les dépêches de l’AFP, qui compte 1 700 journalistes et produit 2 300 dépêches par jour en six langues, pour fonder ses réponses sur une information fiable et à jour [5]. Pour une entreprise, la leçon est indirecte : sur l’actualité, ces assistants privilégient des sources de presse identifiées. Être cité dans un article de presse ou d’une revue professionnelle sérieuse reste un moyen de figurer dans les réponses, bien plus qu’une page autopromotionnelle.',
        ],
      },
      {
        h2: 'Quel robots.txt pour Claude et Vibe ?',
        paras: [
          'Pour la plupart des entreprises qui veulent être citées, la configuration raisonnable autorise les agents de recherche et de visite, et laisse un choix sur l’entraînement :',
        ],
        list: [
          'Autoriser Claude-SearchBot, Claude-User, MistralAI-Index et MistralAI-User.',
          'Décider pour ClaudeBot et MistralAI-Training, selon votre position sur l’entraînement. Les bloquer n’empêche pas, d’après la documentation des éditeurs, d’être visible dans la recherche de leurs assistants.',
          'Ne pas bloquer par adresse IP sans vérifier la liste publiée par l’éditeur, et vérifier les réglages de votre CDN ou pare-feu, qui peuvent bloquer ces agents par défaut.',
        ],
        after: [
          'Notre [Générateur de robots.txt](/outils/generateur-robots-txt) propose ces agents dans sa liste. Après modification, testez votre fichier avec l’outil [Robots d’IA](/outils/robots-ia).',
        ],
      },
      {
        h2: 'Vérifier dans vos journaux qui passe vraiment',
        paras: [
          'Un fichier robots.txt exprime une préférence ; il ne dit pas ce qui se passe. Pour savoir si les robots d’Anthropic et de Mistral visitent votre site, et s’ils y arrivent, il faut regarder les journaux du serveur (ou les statistiques de votre CDN, qui les résument souvent par agent).',
        ],
        list: [
          'Cherchez les noms des agents dans la colonne « user-agent » : ClaudeBot, Claude-User, Claude-SearchBot, MistralAI-User, MistralAI-Index, MistralAI-Training.',
          'Regardez le code de réponse : un 200 signifie que la page a été servie, un 403 ou un 429 que votre protection l’a refusée.',
          'Comparez l’adresse IP de la visite aux listes publiées par les éditeurs : n’importe qui peut se faire passer pour un robot connu en recopiant son nom [1][3].',
          'Notez les pages les plus visitées par Claude-User ou MistralAI-User : ce sont des pages que des utilisateurs ont demandé à l’assistant de lire, donc des pages qui comptent.',
        ],
        after: [
          'Si vous n’avez pas accès aux journaux (hébergement mutualisé, site sur une plateforme), demandez à votre hébergeur s’il bloque des robots d’IA par défaut. C’est de plus en plus fréquent, et rarement signalé au client.',
        ],
      },
      {
        h2: 'Pourquoi s’en occuper quand on est une PME',
        paras: [
          'Il serait tentant d’ignorer ces assistants, faute de chiffres d’usage fiables. Trois raisons plaident pour quelques minutes de réglage. D’abord, ils sont utilisés en entreprise, souvent pour des recherches de fournisseurs ou de prestataires, ce qui en fait un canal B2B potentiel. Ensuite, Vibe est l’offre d’un éditeur français, que des organisations choisissent pour des raisons de souveraineté. Enfin, le travail à faire est le même que pour les autres assistants : un robots.txt clair, des pages lisibles, des faits exacts. Le coût marginal de bien faire est faible.',
          'Ce qui serait une erreur, c’est d’y consacrer un budget important sur la foi de promesses : comme pour ChatGPT, aucun prestataire ne peut garantir une citation dans Claude ou Vibe.',
        ],
      },
      {
        h2: 'Ce qui aide à être cité, ici comme ailleurs',
        paras: [
          'Aucun des deux éditeurs ne publie de critères de sélection des sources. Les bonnes pratiques sont donc les mêmes que pour les autres moteurs de réponse : des pages lisibles sans JavaScript, la réponse en tête, des faits datés, une identité claire et cohérente sur tous vos profils. Notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent) en donne la liste complète.',
          'Pour savoir si ces assistants vous citent, posez-leur régulièrement les mêmes questions d’acheteurs, sans être connecté à votre compte professionnel si possible, et notez les résultats ; la méthode est décrite dans notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt).',
        ],
      },
      {
        h2: 'Exemple : le réglage d’un cabinet d’architectes',
        paras: [
          'Le cabinet fictif Delmas Architectes, à Toulouse, publie des fiches de projets détaillées et un blog sur la rénovation du bâti ancien. Ses associés veulent être cités quand un particulier demande à un assistant « un architecte pour rénover une maison toulousaine en brique », mais refusent que leurs textes servent à l’entraînement de modèles.',
        ],
        list: [
          'robots.txt : Claude-SearchBot, Claude-User, MistralAI-Index et MistralAI-User autorisés ; ClaudeBot et MistralAI-Training interdits ; mêmes choix pour OAI-SearchBot (autorisé) et GPTBot (interdit).',
          'Hébergement : vérification auprès de l’hébergeur qu’aucune règle de pare-feu ne bloque les agents autorisés.',
          'Pages : chaque fiche de projet commence par une phrase qui dit le lieu, le type de bâtiment, la nature des travaux et l’année.',
          'Suivi : une fois par mois, les mêmes dix questions posées à Claude, à Vibe et aux autres assistants, avec relevé des noms et des liens cités.',
        ],
        after: [
          'Ce réglage ne garantit rien, mais il évite les deux erreurs les plus courantes : être invisible par accident, ou céder ses textes à l’entraînement sans l’avoir décidé.',
        ],
      },
      {
        h2: 'Ce qu’on ne sait pas',
        list: [
          'Le ou les moteurs qui fournissent aujourd’hui la recherche web de Claude, et leur part respective : non documenté par Anthropic dans les pages consultées.',
          'Le fonctionnement de la recherche web de Vibe et la taille de l’index de MistralAI-Index.',
          'La façon dont ces assistants traitent un site qui autorise la recherche mais refuse l’entraînement, au-delà de ce que disent les documentations.',
          'La part d’usage de ces assistants en France : il n’existe pas de chiffre public fiable comparable entre éditeurs.',
        ],
        after: [
          'Ces zones d’ombre évoluent vite : les éditeurs ajoutent des fonctions et renomment leurs produits d’un trimestre à l’autre. Revérifiez leurs pages de documentation avant de modifier vos réglages, et datez vos propres notes.',
        ],
      },
    ],
    faq: [
      { q: 'Bloquer ClaudeBot me retire-t-il des réponses de Claude ?', a: 'D’après Anthropic, ClaudeBot concerne l’entraînement. La visibilité dans la recherche dépend de Claude-SearchBot et des visites de Claude-User, qui se règlent séparément.' },
      { q: 'Le Chat existe-t-il encore ?', a: 'Mistral a annoncé le 28 mai 2026 que Le Chat devenait Vibe, avec reprise des conversations et abonnements. La documentation des robots de Mistral fait désormais référence à Vibe.' },
      { q: 'Faut-il un fichier llms.txt pour Claude ou Vibe ?', a: 'Aucun des deux éditeurs ne le demande dans les documentations consultées. Un llms.txt ne remplace ni un robots.txt correct ni des pages lisibles ; voyez notre guide dédié avant d’en créer un.' },
      { q: 'Peut-on ralentir ClaudeBot sans le bloquer ?', a: 'Oui : Anthropic indique prendre en charge la directive non standard Crawl-delay dans robots.txt, qui espace les visites de son robot sans les interdire.' },
      { q: 'Claude utilise-t-il Google ?', a: 'Anthropic ne le dit pas dans les pages consultées. La presse a rapporté en mars 2025 l’ajout de Brave Search à ses sous-traitants, sans confirmation officielle dans l’article.' },
    ],
    sources: [
      { label: 'Centre d’aide Claude, robots d’Anthropic (ClaudeBot, Claude-User, Claude-SearchBot)', url: 'https://support.claude.com/en/articles/8896518', note: VU },
      { label: 'TechCrunch, Anthropic appears to be using Brave to power web searches for its Claude chatbot', url: 'https://techcrunch.com/2025/03/21/anthropic-appears-to-be-using-brave-to-power-web-searches-for-its-claude-chatbot/', note: `21 mars 2025, source secondaire ; ${VU}` },
      { label: 'Mistral AI, documentation des robots (MistralAI-User, MistralAI-Index, MistralAI-Training)', url: 'https://docs.mistral.ai/robots', note: VU },
      { label: 'Mistral AI, annonce de Vibe (Le Chat devient Vibe)', url: 'https://mistral.ai/fr/news/vibe-agent/', note: `28 mai 2026 ; ${VU}` },
      { label: 'Mistral AI, partenariat avec l’AFP', url: 'https://mistral.ai/news/mistral-afp/', note: `16 janv. 2025 ; ${VU}` },
    ],
    cta: { text: 'Les robots d’Anthropic et de Mistral peuvent-ils lire votre site ? L’outil gratuit teste votre robots.txt agent par agent.', href: '/outils/robots-ia', label: 'Tester les robots d’IA' },
    related: ['robots-ia-robots-txt', 'perplexity-sources', 'chatgpt-search-oai-searchbot', 'page-que-les-ia-citent'],
  },
  /* ------------------------------------------------------------------ */
  /* Vidéo et YouTube                                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'video-youtube-ia',
    seoTitle: 'Vidéo et YouTube : être trouvé sur Google et cité',
    title: 'Vidéo et YouTube : être trouvé sur Google et cité par les IA',
    description:
      'Page dédiée, sous-titres, moments clés, VideoObject : comment une PME peut rendre ses vidéos visibles dans Google et utiles aux assistants, sans studio.',
    updated: D,
    published: D,
    intro: [
      'Une vidéo de démonstration, un tutoriel d’installation, une visite d’atelier ou une réponse filmée à une question fréquente : beaucoup de PME en produisent sans savoir si elles sont vues ailleurs que sur leur chaîne. Pourtant, la vidéo apparaît dans les résultats de Google, dans les aperçus IA et dans les réponses des assistants, et YouTube est l’un des sites les plus présents dans ces réponses.',
      'Ce guide explique ce que Google demande pour indexer une vidéo, comment rendre son contenu lisible (une vidéo sans texte est une boîte noire pour un moteur), et ce que l’on sait, avec prudence, du lien entre YouTube et la visibilité dans les IA. L’exemple est fictif : Hydro-Conseil, un installateur de pompes à chaleur à Annecy, qui publie une vidéo par mois.',
    ],
    sections: [
      {
        h2: 'Ce que l’on sait du lien entre YouTube et les IA',
        paras: [
          'Une étude d’Ahrefs publiée le 12 décembre 2025, portant sur 75 000 marques, a mesuré quels facteurs étaient le plus corrélés à la visibilité d’une marque dans ChatGPT, le mode IA et les aperçus IA de Google. Les mentions de la marque sur YouTube y présentent la corrélation la plus forte (environ 0,74), devant les mentions de la marque sur le web (entre 0,66 et 0,71), loin devant des indicateurs classiques comme l’autorité du domaine ou le nombre de liens entrants [3].',
          'Les auteurs le disent eux-mêmes : une corrélation n’est pas une causalité, et ces chiffres ne prouvent pas qu’améliorer ces indicateurs augmentera votre visibilité [3]. Une marque très visible dans les IA est souvent une marque dont on parle beaucoup, y compris en vidéo ; la vidéo peut être la conséquence autant que la cause. Il faut donc lire cette étude comme une indication : la vidéo fait partie des sources que les systèmes rencontrent, pas comme une recette.',
        ],
      },
      {
        h2: 'Étape 1 : une vidéo, une page dédiée sur votre site',
        paras: [
          'Pour Google, une vidéo est d’abord indexée à partir d’une page. Sa documentation distingue les « pages de visionnage », dont la vidéo est le contenu principal, des pages où la vidéo n’est qu’un complément (un article de blog avec une vidéo intégrée, par exemple), qui ne comptent pas comme pages de visionnage [1].',
        ],
        list: [
          'Intégrez la vidéo avec un élément HTML standard (video, iframe, embed ou object), sans la faire dépendre d’une action de l’utilisateur ni d’un identifiant de fragment dans l’adresse [1].',
          'Si un script insère la vidéo, vérifiez qu’elle apparaît dans le HTML rendu [1].',
          'La page de visionnage doit être indexée, et la vidéo ne doit pas être masquée par d’autres éléments [1].',
          'Donnez à chaque page de visionnage un titre et une description uniques [1].',
          'Utilisez une miniature valide, à une adresse stable [1].',
        ],
        after: [
          'Pour Hydro-Conseil, cela signifie une page « Entretien annuel d’une pompe à chaleur : la vidéo pas à pas » dont la vidéo est le cœur, plutôt qu’une vidéo glissée au milieu de la page d’accueil. La même vidéo peut aussi être publiée sur YouTube : les deux ne s’excluent pas.',
        ],
      },
      {
        h2: 'Étape 2 : rendre la vidéo lisible en texte',
        paras: [
          'Un moteur ou un assistant comprend mieux une vidéo quand elle s’accompagne de texte. C’est aussi ce qui la rend accessible aux personnes sourdes ou malentendantes et à ceux qui regardent sans le son.',
        ],
        list: [
          'Sous-titres : YouTube génère des sous-titres automatiques, y compris en français, mais prévient qu’ils peuvent mal représenter le contenu parlé à cause de la prononciation, des accents ou du bruit de fond ; vous pouvez les relire et les corriger dans YouTube Studio [2]. Relisez au moins les noms propres, les chiffres et les termes techniques.',
          'Transcription sur la page : publiez sous la vidéo une version texte, relue, découpée en intertitres. C’est le texte qu’un moteur lira.',
          'Résumé en tête : trois phrases qui disent ce que montre la vidéo et pour qui, comme pour n’importe quelle page qu’on veut voir citée (voir [Écrire une page que les IA citent](/guides/page-que-les-ia-citent)).',
          'Chapitres : sur YouTube, des horodatages dans la description découpent la vidéo en moments clés ; Google peut aussi les détecter automatiquement si vous ne les indiquez pas [1].',
        ],
      },
      {
        h2: 'Étape 3 : les métadonnées qui aident Google',
        paras: [
          'Google recommande de fournir des métadonnées par plusieurs voies, en veillant à ce qu’elles soient cohérentes entre elles : données structurées VideoObject, sitemaps vidéo et balises Open Graph [1].',
        ],
        list: [
          'VideoObject : nom, description, miniature, date de mise en ligne et durée, au minimum. Notre [Validateur JSON-LD](/outils/json-ld) affiche ce que contient le balisage d’une page, et l’outil [Résultats enrichis Google](/outils/resultats-enrichis) le compare aux propriétés exigées par Google.',
          'Moments clés : avec les données structurées Clip (horodatages exacts) ou SeekToAction (horodatages dans l’adresse), ou via les horodatages de la description YouTube [1]. La balise nosnippet permet de s’en exclure [1].',
          'Open Graph : titre, description et image pour le partage ; vérifiez-les avec notre [Testeur Open Graph](/outils/open-graph).',
          'Ne bloquez pas les fichiers vidéo par robots.txt ou noindex, et gardez-les à une adresse stable : c’est nécessaire pour les aperçus et les moments clés [1].',
        ],
        after: [
          'Notre guide sur les [données structurées utiles](/guides/donnees-structurees-utiles) précise lesquelles servent encore en 2026.',
        ],
      },
      {
        h2: 'Étape 4 : YouTube, une plateforme à part entière',
        paras: [
          'Publier aussi sur YouTube augmente les occasions d’être vu et cité, puisque c’est une plateforme que les moteurs et les assistants rencontrent souvent. Quelques réglages simples font la différence :',
        ],
        list: [
          'Un titre qui dit ce que la vidéo résout (« Pompe à chaleur qui se met en défaut l’hiver : 4 vérifications ») plutôt qu’un titre interne (« Vidéo n° 12 »).',
          'Une description complète : résumé, chapitres horodatés, lien vers la page correspondante de votre site, nom et ville de l’entreprise.',
          'Le nom exact de l’entreprise sur la chaîne, identique à celui du site et de la fiche Google, et un lien vers le site dans la section « À propos ».',
          'Des playlists par thème, qui aident le visiteur à enchaîner et donnent du contexte à chaque vidéo.',
        ],
      },
      {
        h2: 'Quelles vidéos pour une PME ?',
        paras: [
          'Les vidéos les plus utiles ne sont pas les plus spectaculaires. Ce sont celles qui répondent à une question que les clients se posent avant d’acheter ou après avoir acheté :',
        ],
        list: [
          'les questions fréquentes, une vidéo par question, en deux à quatre minutes ;',
          'les démonstrations et tutoriels (installer, régler, entretenir) ;',
          'les visites (atelier, chantier, entrepôt) qui montrent que l’entreprise existe vraiment ;',
          'les comparaisons honnêtes entre vos propres offres (« modèle A ou modèle B : lequel choisir pour une maison de 100 m² ? ») ;',
          'les témoignages clients, avec leur accord écrit, et en respectant les règles propres à votre profession si elle en a.',
        ],
        after: [
          'Un téléphone récent, un micro-cravate et une pièce calme suffisent. Le son compte plus que l’image : une vidéo dont on comprend mal les paroles sera mal sous-titrée, donc mal comprise par les moteurs.',
        ],
      },
      {
        h2: 'Exemple : la vidéo mensuelle d’Hydro-Conseil',
        paras: [
          'Chaque mois, le gérant d’Hydro-Conseil enregistre une réponse à une question posée par un client. En novembre : « Pourquoi ma pompe à chaleur givre-t-elle ? » La vidéo de trois minutes est publiée sur YouTube avec chapitres et description, puis intégrée dans une page dédiée du site, avec la transcription relue, un résumé de trois phrases en tête, des photos du boîtier concerné et un lien vers la page « Entretien annuel ». La page porte un balisage VideoObject.',
          'Au bout de six mois, l’entreprise dispose de six pages de visionnage, d’une chaîne cohérente et de six transcriptions qui répondent à des questions précises. Elle ne sait pas si un assistant la citera, mais chacune de ces pages peut être lue, comprise et reprise ; ce n’était pas le cas des vidéos publiées auparavant sans texte sur une page d’accueil.',
        ],
      },
      {
        h2: 'Une vidéo, plusieurs usages',
        paras: [
          'Une vidéo bien préparée se décline sans effort supplémentaire important. La transcription relue devient une page de questions-réponses ou un article ; les chapitres deviennent les intertitres de cette page ; un extrait de trente secondes devient une publication LinkedIn ou une story ; une capture d’écran légendée illustre la fiche Google. Chaque version renvoie vers la page de visionnage, qui reste la référence.',
          'Ce recyclage n’est pas qu’une économie de temps. Il multiplie les endroits où la même information exacte apparaît, sous la même forme et avec le même nom d’entreprise, ce qui aide les moteurs comme les lecteurs à rattacher le contenu à la bonne entreprise. Notre guide [LinkedIn et visibilité B2B dans les IA](/guides/linkedin-visibilite-b2b-ia) décrit la partie LinkedIn de ce travail.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Publier la vidéo seulement sur un réseau social, sans page sur le site ni texte associé : elle reste invisible pour la recherche classique.',
          'Laisser les sous-titres automatiques sans relecture : un nom de produit mal transcrit se retrouve dans le texte que lisent les moteurs.',
          'Intégrer la vidéo derrière un bouton « Voir la vidéo » qui charge le lecteur au clic : Google peut ne pas la trouver [1].',
          'Donner le même titre et la même description à toutes les pages vidéo d’une série.',
          'Bloquer le dossier des fichiers vidéo dans robots.txt « pour économiser de la bande passante » : cela empêche les aperçus et les moments clés [1].',
        ],
      },
      {
        h2: 'Mesurer',
        paras: [
          'Google propose dans la Search Console un rapport d’indexation des vidéos, un rapport sur les résultats enrichis et, dans le rapport Performances, un filtre par apparence de recherche vidéo [1]. YouTube Studio donne les sources de trafic de chaque vidéo. Pour les assistants, la méthode reste le relevé régulier des réponses à vos questions d’acheteurs. Pour la mesure dans les aperçus IA, voyez notre guide [Aperçus IA et mode IA de Google](/guides/apercus-ia-google).',
        ],
      },
      {
        h2: 'Accessibilité : un bénéfice double',
        paras: [
          'Des sous-titres exacts, une transcription et une description textuelle des informations visuelles importantes rendent la vidéo utilisable par davantage de personnes, et la rendent en même temps compréhensible par les moteurs. Notre guide [Accessibilité et SEO](/guides/accessibilite-et-seo) détaille ce recoupement, ainsi que le cadre légal de l’accessibilité des services en ligne.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il héberger ses vidéos sur YouTube ou sur son site ?', a: 'Les deux sont possibles et compatibles : YouTube apporte une audience et une plateforme très lue par les moteurs ; une page dédiée sur votre site, avec transcription et balisage, donne à Google une page de visionnage qui vous appartient.' },
      { q: 'Les sous-titres automatiques suffisent-ils ?', a: 'Ils sont un point de départ. YouTube prévient qu’ils peuvent être inexacts ; relisez au moins les noms propres, les chiffres et le vocabulaire technique avant de les publier.' },
      { q: 'Faut-il un sitemap vidéo ?', a: 'Il aide Google à découvrir les vidéos, surtout sur un site qui en publie beaucoup. Pour quelques vidéos sur des pages bien reliées, des données structurées VideoObject cohérentes suffisent souvent ; l’un n’empêche pas l’autre.' },
      { q: 'Une vidéo courte de type Shorts compte-t-elle ?', a: 'Elle peut être vue et indexée, mais elle contient peu de texte. Pour être comprise et citée, une vidéo qui répond pleinement à une question, avec transcription, est plus utile.' },
    ],
    sources: [
      { label: 'Google Search Central, bonnes pratiques SEO pour les vidéos (pages de visionnage, moments clés, métadonnées)', url: 'https://developers.google.com/search/docs/appearance/video', note: `mise à jour du 20 févr. 2026 ; ${VU}` },
      { label: 'Aide YouTube, utiliser les sous-titres automatiques (langues, limites, modification)', url: 'https://support.google.com/youtube/answer/6373554', note: VU },
      { label: 'Ahrefs, Top Brand Visibility Factors in ChatGPT, AI Mode, and AI Overviews (75 000 marques)', url: 'https://ahrefs.com/blog/ai-brand-visibility-correlations', note: `12 déc. 2025, étude de corrélation ; ${VU}` },
    ],
    cta: { text: 'Le balisage VideoObject de votre page est-il complet et cohérent avec la vidéo ? Vérifiez-le avec l’outil gratuit.', href: '/outils/json-ld', label: 'Valider mon balisage' },
    related: ['page-que-les-ia-citent', 'donnees-structurees-utiles', 'apercus-ia-google', 'linkedin-visibilite-b2b-ia'],
  },

  /* ------------------------------------------------------------------ */
  /* LinkedIn et visibilité B2B dans les IA                               */
  /* ------------------------------------------------------------------ */
  {
    slug: 'linkedin-visibilite-b2b-ia',
    seoTitle: 'LinkedIn et visibilité B2B dans les IA : la méthode',
    title: 'LinkedIn et visibilité B2B dans les réponses des IA',
    description:
      'Page entreprise, profils des dirigeants, publications d’expertise : comment LinkedIn nourrit la visibilité d’une PME B2B dans Google et chez les assistants IA.',
    updated: D,
    published: D,
    intro: [
      'Pour une PME qui vend à d’autres entreprises, LinkedIn est souvent le premier endroit où un acheteur vérifie qui vous êtes : combien de salariés, quels dirigeants, depuis quand, avec quels clients. C’est aussi un lieu où l’on parle de vous, ou pas. Les assistants d’IA qui répondent à « quels prestataires pour… » s’appuient sur ce qui est écrit sur le web au sujet des entreprises, et LinkedIn en fait partie.',
      'Ce guide propose une méthode réaliste pour une PME de 10 à 200 personnes : une page entreprise exacte, des profils de dirigeants cohérents, des publications qui démontrent une expertise, et le lien avec votre site. Il ne promet ni portée ni citation : personne ne contrôle l’algorithme de LinkedIn ni les réponses des IA. L’exemple est fictif : Logistique Delorme, prestataire logistique de 60 personnes près d’Orléans.',
    ],
    sections: [
      {
        h2: 'Pourquoi LinkedIn compte pour la visibilité dans les IA',
        paras: [
          'Les assistants n’inventent pas les entreprises qu’ils recommandent : ils les rencontrent dans des pages, des comparatifs, des articles, des profils. L’étude d’Ahrefs publiée le 12 décembre 2025 sur 75 000 marques montre que les mentions d’une marque sur le web figurent parmi les facteurs les plus corrélés à sa visibilité dans ChatGPT, le mode IA et les aperçus IA de Google (corrélation entre 0,66 et 0,71), bien plus que l’autorité du domaine ou le nombre de liens [1]. Les auteurs précisent qu’il s’agit de corrélations, pas de causes [1].',
          'LinkedIn est l’un des endroits où une PME B2B peut faire exister son nom, de façon cohérente et répétée, à côté de son métier : « Logistique Delorme, logistique e-commerce pour PME du Centre-Val de Loire ». Ce n’est pas un levier magique, c’est une façon d’être décrit souvent et de la même manière.',
        ],
      },
      {
        h2: 'Étape 1 : une page entreprise exacte et complète',
        list: [
          'Nom identique à celui du site, de la fiche Google et du registre (même orthographe, même forme juridique ou absence de forme juridique).',
          'Description qui commence par une phrase de définition : qui vous êtes, pour qui, où. « Logistique Delorme est un prestataire logistique pour les marques e-commerce de 1 000 à 50 000 commandes par mois, avec un entrepôt de 12 000 m² à Saran (Loiret). »',
          'Site web, secteur, taille, année de création, adresse : remplis et identiques à ce que dit votre page « À propos ».',
          'Une section qui liste vos offres avec les mêmes noms que sur votre site.',
        ],
        after: [
          'Reliez ensuite la page LinkedIn à votre site dans les deux sens : un lien visible vers LinkedIn depuis le site, et la propriété sameAs dans les données structurées Organization de votre page d’accueil ou de votre page « À propos ». Google cite explicitement sameAs, qui pointe vers d’autres profils comme les réseaux sociaux, parmi les propriétés recommandées pour décrire une organisation [3]. Notre guide [Page « À propos » et entité de marque](/guides/entite-de-marque-wikidata-sameas) détaille la méthode.',
        ],
      },
      {
        h2: 'Étape 2 : les profils des dirigeants et experts',
        paras: [
          'En B2B, on achète à des personnes. Les profils des dirigeants et des experts de l’entreprise comptent autant que la page entreprise, et sont souvent plus lus. Google lui-même insiste, dans ses critères de contenu fiable, sur l’importance de savoir qui a écrit un contenu et d’afficher des informations d’auteur exactes [2]. Un article signé par une personne identifiable, dont le profil confirme l’expérience, est plus crédible qu’un texte anonyme.',
        ],
        list: [
          'Titre de profil qui dit le rôle et le domaine (« Directrice des opérations chez Logistique Delorme, logistique e-commerce »), pas seulement un slogan.',
          'Expérience à jour, avec l’entreprise reliée à sa page.',
          'Une section « Infos » de quelques lignes qui dit ce que la personne sait faire et pour qui.',
          'Vérifiez la visibilité publique du profil dans les paramètres de LinkedIn : un profil qui n’est pas visible hors connexion ne peut être lu ni par les visiteurs non connectés ni par les moteurs.',
        ],
      },
      {
        h2: 'Étape 3 : publier de l’expertise, pas de la publicité',
        paras: [
          'Les publications qui servent la visibilité à long terme sont celles qui apprennent quelque chose au lecteur et associent votre nom à un sujet précis. Pour Logistique Delorme, cela donne par exemple :',
        ],
        list: [
          '« Ce que nous avons appris en préparant 40 000 colis en novembre » : chiffres internes réels, problèmes rencontrés, solutions.',
          '« Délais de préparation : ce qu’un e-commerçant peut exiger dans son contrat » : un sujet que les acheteurs se posent, traité concrètement.',
          '« Notre méthode d’inventaire tournant, expliquée en cinq étapes » : un savoir-faire montré, pas seulement affirmé.',
          'Des retours d’expérience clients, avec leur accord, qui décrivent un problème et la façon dont il a été résolu.',
        ],
        after: [
          'Republiez les contenus de fond sur votre site, dans une version plus complète et datée, et liez les deux. Une publication LinkedIn est éphémère dans le fil d’actualité ; une page de votre site reste, s’indexe, et peut être citée par un moteur ou un assistant. Notre guide [SEO B2B : des pages pour des acheteurs qui comparent](/guides/seo-b2b-acheteurs) explique comment structurer ces pages.',
        ],
      },
      {
        h2: 'Étape 4 : faire parler de vous ailleurs que sur vos comptes',
        paras: [
          'Les mentions qui pèsent le plus sont celles que vous n’écrivez pas vous-même : un client qui cite votre entreprise dans un retour d’expérience, un partenaire qui vous recommande, un média professionnel qui vous interroge. LinkedIn facilite ces mentions, sans les remplacer.',
        ],
        list: [
          'Proposez aux clients satisfaits de témoigner, en les laissant écrire avec leurs mots, et en mentionnant votre page.',
          'Participez aux discussions de votre secteur sous votre vrai nom, quand vous avez quelque chose d’utile à apporter.',
          'Répondez aux journalistes et organisateurs d’événements professionnels de votre région : une intervention dans un salon ou un article dans une revue spécialisée crée une mention durable.',
          'Évitez les pods d’engagement, les achats d’abonnés et les commentaires automatiques : ils n’apportent rien de durable et abîment la crédibilité.',
        ],
      },
      {
        h2: 'Une question à trancher : vos données et l’entraînement de l’IA',
        paras: [
          'LinkedIn utilise, depuis le 3 novembre 2025, certaines données de ses membres européens pour entraîner des modèles d’IA générative, avec un paramètre permettant de s’y opposer ; la liste des données concernées est large (profil, publications, activité) selon les articles qui ont décrit le changement [4]. C’est un choix personnel et d’entreprise, distinct de la visibilité : refuser l’entraînement ne rend pas vos publications invisibles aux visiteurs. Vérifiez la politique de confidentialité de LinkedIn et le paramètre correspondant, qui peuvent évoluer.',
        ],
      },
      {
        h2: 'Mesurer sans se tromper',
        paras: [
          'Les statistiques de LinkedIn (impressions, abonnés, visiteurs de la page) mesurent l’audience sur LinkedIn, pas votre visibilité dans les IA. Pour cette dernière, la méthode reste la même : des questions d’acheteurs posées régulièrement aux assistants, et le relevé des entreprises citées. Notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt) décrit cette méthode.',
          'Les formats ne se valent pas tous pour la durée : une vidéo de démonstration publiée sur LinkedIn et reprise sur votre site, avec sa transcription, continue de servir des mois après sa publication (voir [Vidéo et YouTube : être trouvé sur Google et cité par les IA](/guides/video-youtube-ia)).',
          'Regardez aussi les sources que les assistants citent quand ils parlent de votre secteur. Si des comparatifs ou des articles reviennent, c’est là qu’il faut chercher à figurer ; si votre page LinkedIn apparaît parmi les sources, vérifiez qu’elle dit exactement ce que vous voulez qu’on retienne.',
        ],
      },
      {
        h2: 'Relier LinkedIn et votre site : la liste technique',
        paras: ['Quelques vérifications simples garantissent que les deux se renforcent au lieu de se contredire :'],
        list: [
          'Le lien vers votre page LinkedIn est présent sur le site, dans le pied de page ou la page « À propos », sous forme de lien HTML ordinaire.',
          'La page d’accueil ou la page « À propos » porte un balisage Organization avec sameAs vers LinkedIn ; notre [Validateur JSON-LD](/outils/json-ld) le contrôle.',
          'Les articles du blog repris sur LinkedIn portent le nom de leur auteur, avec un lien vers son profil.',
          'Les textes longs restent lisibles : phrases courtes, intertitres, un sujet par paragraphe. Notre outil [Compteur de mots et lisibilité](/outils/lisibilite) donne un indice de lisibilité en français.',
          'Les aperçus de partage de vos pages (titre, image, description) sont corrects quand on colle le lien dans LinkedIn ; vérifiez-les avec le [Testeur Open Graph](/outils/open-graph).',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Une page entreprise créée en 2019 et jamais mise à jour : effectif, offres et adresse ne correspondent plus au site.',
          'Des profils de dirigeants qui décrivent trois métiers différents pour la même entreprise.',
          'Des publications uniquement promotionnelles (« Nous sommes fiers d’annoncer… ») qui n’apprennent rien à l’acheteur.',
          'Des contenus de fond publiés seulement sur LinkedIn, introuvables quelques semaines plus tard et absents du site.',
          'Des promesses chiffrées non vérifiables (« le leader de la logistique en France ») qu’un assistant pourrait reprendre, ou contredire.',
        ],
      },
      {
        h2: 'Exemple : six mois chez Logistique Delorme',
        paras: [
          'Mois 1 : la page entreprise est réécrite avec la phrase de définition, les offres et les chiffres clés ; les trois dirigeants mettent à jour leur profil. Le site ajoute un lien vers LinkedIn et la propriété sameAs. Mois 2 à 6 : une publication de fond toutes les deux semaines, signée par la directrice des opérations ou le directeur commercial, reprise en version longue sur le blog du site. Deux clients publient un retour d’expérience. Le directeur intervient dans une table ronde régionale sur la logistique e-commerce, relayée par l’organisateur.',
          'Résultat mesurable : davantage de visites de la page entreprise et des profils, des demandes entrantes qui citent une publication. Résultat incertain : la présence dans les réponses des assistants, que l’entreprise relève chaque mois sans pouvoir l’attribuer avec certitude à LinkedIn. C’est la réalité de ce canal, et il vaut mieux le savoir avant de commencer.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il une page vitrine LinkedIn par offre ?', a: 'Rarement pour une PME. Une seule page entreprise bien tenue, avec des sections d’offres claires, vaut mieux que plusieurs pages peu actives qui dispersent l’attention et les abonnés.' },
      { q: 'Les vidéos ont-elles leur place sur LinkedIn ?', a: 'Oui, en particulier les démonstrations et les réponses courtes à des questions d’acheteurs. Publiez la version complète, avec transcription, sur votre site ; notre guide sur la vidéo et YouTube détaille la méthode.' },
      { q: 'Faut-il publier tous les jours ?', a: 'Non. La régularité compte plus que la fréquence : une publication de fond toutes les une à deux semaines, tenue dans la durée, vaut mieux qu’un rythme quotidien abandonné au bout d’un mois.' },
      { q: 'Les articles LinkedIn remplacent-ils un blog ?', a: 'Non. Une page de votre site vous appartient, s’indexe durablement et peut être citée. Publiez sur LinkedIn pour la diffusion, et gardez la version de référence sur votre site.' },
      { q: 'Une page entreprise LinkedIn peut-elle apparaître dans les réponses des IA ?', a: 'Elle fait partie des pages qu’un assistant peut rencontrer quand il cherche des informations sur une entreprise. Rien ne garantit qu’elle soit lue ou citée ; d’où l’intérêt qu’elle soit exacte et cohérente avec votre site.' },
    ],
    sources: [
      { label: 'Ahrefs, Top Brand Visibility Factors in ChatGPT, AI Mode, and AI Overviews (75 000 marques)', url: 'https://ahrefs.com/blog/ai-brand-visibility-correlations', note: `12 déc. 2025, étude de corrélation ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables (auteur, signatures)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Google Search Central, données structurées Organization (sameAs, logo, identifiants)', url: 'https://developers.google.com/search/docs/appearance/structured-data/organization', note: VU },
      { label: 'Blog du Modérateur, LinkedIn va utiliser vos données pour entraîner son IA : comment s’y opposer', url: 'https://www.blogdumoderateur.com/linkedin-utiliser-donnees-entrainer-ia', note: `source secondaire ; ${VU}` },
    ],
    cta: { text: 'Comparez votre site à celui d’un concurrent sur les signaux que lisent les IA : identité, structure, lisibilité.', href: '/outils/comparateur', label: 'Comparer avec un concurrent' },
    related: ['seo-b2b-acheteurs', 'apparaitre-dans-chatgpt-pme', 'entite-de-marque-wikidata-sameas', 'suivre-ses-questions-chatgpt'],
  },

  /* ------------------------------------------------------------------ */
  /* Page « À propos » et entité de marque                                */
  /* ------------------------------------------------------------------ */
  {
    slug: 'entite-de-marque-wikidata-sameas',
    seoTitle: 'Page « À propos » et entité de marque : Wikidata, sameAs',
    title: 'Page « À propos » et entité de marque : Wikidata et sameAs',
    description:
      'Faire comprendre aux moteurs et aux IA qui est votre entreprise : page « À propos » de référence, balisage Organization, sameAs, et ce que Wikidata accepte.',
    updated: D,
    published: D,
    intro: [
      'Quand un assistant d’IA confond votre entreprise avec une homonyme, se trompe sur votre date de création ou vous attribue un métier que vous n’exercez plus, le problème est rarement technique : c’est que les informations disponibles sur vous sont rares, éparses ou contradictoires. Les moteurs et les assistants raisonnent de plus en plus en « entités » (une entreprise, une personne, un lieu) décrites par des faits. Plus ces faits sont clairs et concordants, moins il y a d’erreurs.',
      'Ce guide explique comment construire une description de référence de votre entreprise : une page « À propos » complète, un balisage Organization, des liens sameAs vers vos profils officiels, et, seulement si c’est justifié, un élément Wikidata. L’exemple est fictif : Ferronnerie Vidal, une entreprise familiale de serrurerie métallerie à Clermont-Ferrand, qu’on confond régulièrement avec une homonyme à Montpellier.',
    ],
    sections: [
      {
        h2: 'Ce qu’est une « entité », en pratique',
        paras: [
          'Pour un moteur, « Ferronnerie Vidal » n’est pas seulement une suite de mots : c’est une entreprise qui a un nom, une adresse, une date de création, des dirigeants, un métier, un site, des profils. Quand ces informations sont réunies et cohérentes, le moteur peut rattacher les pages qui parlent de vous à la bonne entreprise, et ne pas les confondre avec l’homonyme de Montpellier.',
          'Ce travail est d’abord éditorial. Les balisages et les bases de données ne font qu’exprimer, sous une forme lisible par les machines, ce que votre site dit déjà clairement. S’il ne le dit pas, aucun balisage ne compensera.',
        ],
      },
      {
        h2: 'Étape 1 : une page « À propos » qui sert de référence',
        paras: [
          'Google, dans ses critères de contenu fiable, invite à se demander si les visiteurs peuvent facilement savoir qui est derrière un site et un contenu [4]. La page « À propos » est l’endroit où l’on répond à cette question une fois pour toutes. Elle doit contenir des faits, pas un slogan :',
        ],
        list: [
          'une phrase de définition en tête : « Ferronnerie Vidal est une entreprise de serrurerie métallerie fondée en 1987 à Clermont-Ferrand, spécialisée dans les garde-corps, portails et escaliers sur mesure pour particuliers et professionnels » ;',
          'le nom légal, la forme juridique, le numéro SIREN, l’adresse du siège et des ateliers ;',
          'la date de création et les étapes importantes (reprise par la deuxième génération en 2015, nouvel atelier en 2022) ;',
          'les dirigeants, avec leur rôle et un lien vers leur profil professionnel ;',
          'les métiers, la zone d’intervention, les qualifications réelles ;',
          'ce que vous ne faites pas, si la confusion est fréquente (« nous n’avons aucun lien avec la société Vidal Métallerie de Montpellier »).',
        ],
        after: [
          'Rédigez-la pour qu’un assistant puisse en citer une phrase sans la déformer, comme le décrit notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent). Vérifiez ensuite que la même description se retrouve, au mot près pour les faits, sur votre fiche Google, vos annuaires et votre page LinkedIn.',
        ],
      },
      {
        h2: 'Étape 2 : le balisage Organization et les liens sameAs',
        paras: [
          'Google recommande de placer le balisage Organization sur la page d’accueil ou sur une page unique qui décrit l’organisation, comme une page « À propos » ; il n’est pas nécessaire de le répéter sur toutes les pages [1]. Aucune propriété n’est obligatoire, mais Google conseille d’en renseigner autant que possible parmi celles qui s’appliquent [1] :',
        ],
        list: [
          'identité : name, alternateName, legalName, url, description ;',
          'contact : address, email, telephone, contactPoint ;',
          'profils et image : sameAs (adresses de vos autres profils, par exemple sur les réseaux sociaux) et logo ;',
          'identifiants : vatID, taxID, iso6523Code, duns, leiCode, globalLocationNumber, naics ;',
          'autres : foundingDate, numberOfEmployees [1].',
        ],
        after: [
          'Pour le logo, Google demande une image d’au moins 112 × 112 pixels, à une adresse explorable et indexable, dans un format pris en charge par Google Images, et qui s’affiche correctement sur fond blanc [1].',
          'La propriété sameAs est le fil qui relie votre entité à ses autres descriptions. Pour Ferronnerie Vidal : la page LinkedIn de l’entreprise, la fiche Google (son adresse publique), la page de l’entreprise dans l’annuaire des entreprises de l’État, le profil sur un annuaire professionnel du bâtiment, et un élément Wikidata s’il existe. Ne listez que des pages qui parlent bien de vous et que vous pouvez faire corriger. Notre [Validateur JSON-LD](/outils/json-ld) vérifie que le balisage est bien formé.',
        ],
      },
      {
        h2: 'Exemple : le balisage de Ferronnerie Vidal',
        paras: [
          'Sur sa page « À propos », Ferronnerie Vidal place un bloc JSON-LD de type Organization (ou d’un sous-type plus précis de LocalBusiness si elle reçoit des clients à l’atelier). Il reprend exactement ce qu’affiche la page :',
        ],
        list: [
          'name : « Ferronnerie Vidal » ; legalName : la raison sociale complète figurant au registre ;',
          'url : l’adresse de la page d’accueil ; logo : l’adresse du logo carré, en 512 × 512 pixels ;',
          'foundingDate : 1987 ; address : l’adresse postale de l’atelier ; telephone : le numéro du standard ;',
          'taxID ou vatID : les identifiants fiscaux réels, qui distinguent sans ambiguïté l’entreprise de son homonyme ;',
          'sameAs : la page LinkedIn de l’entreprise, sa fiche Google, sa page dans l’annuaire des entreprises de l’État et son profil sur un annuaire professionnel.',
        ],
        after: [
          'Rien d’autre : pas d’avis, pas de mots-clés, pas de zones d’intervention fantaisistes. Ce balisage n’a rien de spectaculaire ; sa valeur tient à ce qu’il est exact, complet et cohérent avec toutes les autres descriptions de l’entreprise.',
        ],
      },
      {
        h2: 'Étape 3 : Wikidata, seulement si vous êtes admissible',
        paras: [
          'Wikidata est une base de connaissances libre, liée à Wikipédia, que de nombreux systèmes réutilisent. Il est tentant d’y créer un élément pour son entreprise. Mais Wikidata a des critères d’admissibilité : un élément doit, soit avoir un lien vers une page d’un projet Wikimédia (comme un article Wikipédia), soit désigner une entité clairement identifiable pouvant être décrite à l’aide de sources sérieuses et publiquement accessibles, soit répondre à un besoin structurel, par exemple pour rendre plus utiles des déclarations faites dans d’autres éléments [2][3].',
          'Pour une PME sans article Wikipédia, c’est en général le deuxième critère qui compte, et il suppose des sources indépendantes : articles de presse, publications professionnelles, registres publics. Le site de l’entreprise, sa page LinkedIn et les présentations qu’elle rédige elle-même peuvent étayer des faits précis, mais ne suffisent pas à établir l’admissibilité ; les éléments qui ne reposent que sur ces sources sont souvent proposés à la suppression [3].',
        ],
        list: [
          'Si vous créez ou modifiez un élément sur votre propre entreprise, déclarez votre lien d’intérêt : la modification sur son employeur n’est pas interdite, mais une modification rémunérée non déclarée nuit à la confiance [3].',
          'Ne renseignez que des faits sourcés (date de création avec le registre, siège, site officiel), sans formulation promotionnelle.',
          'Si l’élément est supprimé, n’insistez pas : c’est le signe que les sources indépendantes manquent, et le travail à faire est ailleurs (presse, publications professionnelles).',
        ],
      },
      {
        h2: 'Étape 4 : la cohérence partout',
        paras: [
          'Une entité claire, c’est d’abord une entité décrite partout de la même façon. Faites une fois par an le tour de toutes les descriptions de votre entreprise :',
        ],
        list: [
          'site (page d’accueil, « À propos », mentions légales, pied de page) ;',
          'fiche Google et autres fiches locales (Bing, Apple) ;',
          'annuaires officiels et professionnels ;',
          'LinkedIn (page entreprise et profils des dirigeants) ;',
          'plateformes d’avis et marketplaces où vous vendez ;',
          'élément Wikidata, s’il existe.',
        ],
        after: [
          'Pour chacune, comparez nom, adresse, téléphone, date de création, description d’activité. Corrigez toute divergence à la source. Notre outil [Site prêt pour les IA ?](/outils/pret-pour-les-ia) vérifie en une fois plusieurs signaux d’identité de votre site, et l’outil [Fiche « faits clés »](/outils/fiche-faits-cles) met en forme les faits essentiels de l’entreprise en un bloc à poser sur la page « À propos ».',
        ],
      },
      {
        h2: 'Quand une IA vous confond avec un homonyme',
        paras: [
          'C’est le cas de Ferronnerie Vidal : un assistant lui attribue l’adresse de l’entreprise de Montpellier. La démarche est celle décrite dans notre guide [Les IA disent des choses fausses sur votre entreprise](/guides/ia-disent-des-choses-fausses) : documenter l’erreur, trouver la source qui la nourrit, publier une page de vérité, corriger les sources tierces, signaler l’erreur à l’éditeur de l’assistant. La page « À propos » avec sa phrase de distinction (« aucun lien avec… ») et le balisage Organization avec ses identifiants (SIREN, adresse) sont ici les outils les plus directs.',
          'Il faut être patient : les modèles et les index ne se mettent pas à jour au même rythme, et rien ne garantit que la correction soit reprise rapidement. Notez la date de chaque correction et refaites le test un mois plus tard, avec les mêmes questions.',
        ],
      },
      {
        h2: 'Ce qu’il ne faut pas faire',
        list: [
          'Créer de faux profils ou de fausses pages pour « renforcer » l’entité : c’est détectable, et cela peut entraîner la suppression des vraies.',
          'Lister dans sameAs des pages qui ne parlent pas de vous, ou des annuaires de mauvaise qualité.',
          'Baliser des informations absentes de la page visible : le balisage doit refléter ce que voit le visiteur.',
          'Payer un service qui promet un « panneau de connaissances garanti » ou un article Wikipédia : aucune de ces promesses ne repose sur une règle publique, et les articles promotionnels sont supprimés.',
        ],
      },
      {
        h2: 'Pour aller plus loin',
        paras: [
          'Une entité de marque se renforce surtout par des mentions indépendantes : presse locale et professionnelle, partenaires, clients qui témoignent. Notre guide [LinkedIn et visibilité B2B dans les IA](/guides/linkedin-visibilite-b2b-ia) décrit une façon de les susciter, et notre guide [E-E-A-T pour une petite entreprise](/guides/eeat-petite-entreprise) explique comment montrer l’expérience et la fiabilité sur le site lui-même.',
        ],
      },
    ],
    faq: [
      { q: 'Le balisage Organization fait-il apparaître un panneau de connaissances ?', a: 'Il aide Google à comprendre les informations de votre organisation, notamment le logo, mais il ne garantit pas l’affichage d’un panneau de connaissances, qui dépend d’autres facteurs que Google ne détaille pas.' },
      { q: 'Faut-il mettre le balisage sur toutes les pages ?', a: 'Non. Google recommande de le placer sur la page d’accueil ou sur une page unique qui décrit l’organisation, comme la page « À propos ».' },
      { q: 'Un indépendant ou un consultant doit-il baliser Organization ou Person ?', a: 'Celui qui correspond à la réalité de la page : une page qui présente une personne qui exerce en son nom peut décrire une Person ; une société, même unipersonnelle, une Organization. L’essentiel est la cohérence avec le reste du site.' },
      { q: 'Faut-il indiquer le numéro SIREN sur le site ?', a: 'S’il figure déjà dans vos mentions légales, le reprendre sur la page « À propos » et dans le balisage ne coûte rien et aide à distinguer l’entreprise d’un homonyme, en particulier quand deux sociétés portent le même nom dans des villes différentes.' },
      { q: 'Combien de temps pour qu’une correction soit prise en compte ?', a: 'Personne ne peut le dire précisément : les moteurs réexplorent les pages à leur rythme, et les modèles d’IA ne sont pas réentraînés en continu. Comptez en semaines ou en mois, et vérifiez régulièrement.' },
      { q: 'Mon entreprise peut-elle avoir un élément Wikidata sans article Wikipédia ?', a: 'Oui, si elle peut être décrite à l’aide de sources sérieuses et publiquement accessibles, indépendantes d’elle. À défaut, l’élément risque d’être supprimé.' },
    ],
    sources: [
      { label: 'Google Search Central, données structurées Organization (emplacement, propriétés, logo)', url: 'https://developers.google.com/search/docs/appearance/structured-data/organization', note: VU },
      { label: 'Wikidata, critères d’admissibilité (Wikidata:Notability)', url: 'https://www.wikidata.org/wiki/Wikidata:Notability', note: `page non lisible par notre outil ; critères vérifiés via la citation de la source suivante ; ${VU}` },
      { label: 'InstantPress, Wikidata notability (critères cités, suppression des éléments autosourcés)', url: 'https://www.instantpress.co/blog/wikidata-notability', note: `source secondaire ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables (qui, comment, pourquoi)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
    ],
    cta: { text: 'Votre balisage Organization est-il complet, avec sameAs et logo ? Vérifiez-le sur votre page « À propos ».', href: '/outils/json-ld', label: 'Valider mon balisage' },
    related: ['ia-disent-des-choses-fausses', 'page-que-les-ia-citent', 'donnees-structurees-utiles', 'linkedin-visibilite-b2b-ia'],
  },
  /* ------------------------------------------------------------------ */
  /* Intention de recherche                                               */
  /* ------------------------------------------------------------------ */
  {
    slug: 'intention-de-recherche',
    seoTitle: 'Intention de recherche : écrire la page qu’on attend',
    title: 'Intention de recherche : écrire la page que le client attend',
    description:
      'Savoir, faire, trouver un site, se rendre sur place : identifier l’intention derrière une recherche et y répondre avec le bon type de page, exemples à l’appui.',
    updated: D,
    published: D,
    intro: [
      'Deux personnes tapent « pompe à chaleur ». La première veut comprendre comment ça marche, la seconde veut un installateur près de chez elle cette semaine. Une même page ne peut pas bien servir les deux. L’intention de recherche, c’est ce que la personne cherche vraiment à accomplir derrière les mots qu’elle tape, et c’est souvent elle, plus que les mots-clés, qui explique pourquoi une page bien écrite ne se positionne pas.',
      'Ce guide explique comment Google décrit les intentions, comment les repérer sans outil payant, et comment choisir le bon type de page pour chacune. Il s’adresse aux sites de PME, de commerces et de boutiques en ligne. Les exemples sont fictifs : un installateur de pompes à chaleur, une librairie indépendante et un éditeur de logiciel de planning.',
    ],
    sections: [
      {
        h2: 'Ce que Google appelle « répondre au besoin »',
        paras: [
          'Google fait évaluer la qualité de ses résultats par des évaluateurs humains, à partir d’un document public, les consignes aux évaluateurs de la qualité de la recherche, dont la version citée ici date du 11 septembre 2025 [1]. Ces consignes demandent notamment de juger si un résultat répond au besoin de la personne, sur une échelle qui va de « répond entièrement » à « ne répond pas » [1]. Google précise qu’une note donnée par un évaluateur n’a pas d’effet direct sur l’affichage d’une page dans la recherche [1] : les consignes servent à évaluer et améliorer les systèmes, pas à classer les sites un par un.',
          'Elles n’en sont pas moins un bon révélateur de la façon dont Google pense la pertinence. Une page peut être excellente et pourtant mal répondre au besoin, si elle répond à une autre question que celle qui est posée.',
        ],
      },
      {
        h2: 'Quatre intentions principales',
        paras: [
          'Les consignes distinguent plusieurs familles de requêtes, que l’on peut résumer en quatre intentions [1] :',
        ],
        list: [
          'Savoir : la personne veut une information. « Comment fonctionne une pompe à chaleur air-eau », « différence entre SARL et SAS ». Certaines sont des questions simples, qui appellent une réponse courte et exacte (« horaires de la mairie de Rezé »), d’autres demandent une explication.',
          'Faire : la personne veut accomplir une action, souvent acheter, télécharger, réserver ou demander un devis. « Acheter roman Annie Ernaux », « devis pompe à chaleur Annecy ».',
          'Aller sur un site : la personne cherche un site ou une page précise. « Doctolib », « espace client EDF ». Le meilleur résultat est le site lui-même.',
          'Se rendre sur place : la personne cherche un lieu physique, en général près d’elle. « Librairie ouverte dimanche Lyon », « installateur pompe à chaleur près de moi ». La localisation de la personne compte, et les consignes en tiennent compte [1].',
        ],
        after: [
          'Beaucoup de requêtes mélangent plusieurs intentions. « Pompe à chaleur » seule peut vouloir dire savoir, comparer ou acheter ; c’est pour cela que les résultats de Google pour une requête vague mélangent souvent articles, pages produits et carte locale.',
        ],
      },
      {
        h2: 'Étape 1 : regarder ce que Google affiche déjà',
        paras: [
          'Le moyen le plus fiable de connaître l’intention dominante d’une requête est gratuit : taper la requête dans Google, en navigation privée, et regarder la première page. Google montre ce qui, selon lui, répond le mieux au plus grand nombre de personnes qui tapent ces mots.',
        ],
        list: [
          'Une carte et des fiches d’établissements : l’intention est locale. Une page article aura du mal à se faire une place ; c’est la fiche Google et la page de l’établissement qui comptent.',
          'Des fiches produits et des catégories de boutiques : l’intention est d’acheter. Un article de blog sera rarement préféré.',
          'Des guides, des articles et un bloc « Autres questions posées » : l’intention est de savoir. Une page commerciale qui ne répond pas à la question passera après.',
          'Le site d’une marque en tête, puis ses pages : l’intention est de trouver ce site.',
          'Un aperçu IA en haut de page : la question appelle une synthèse ; les pages citées sous l’aperçu montrent les formats que Google juge utiles.',
        ],
        after: [
          'Notez aussi les angles des pages en tête : « prix », « avis », « comparatif », « pour débutant », « 2026 ». Ils disent ce que les gens veulent savoir en plus de la question de base. Refaites l’exercice sur mobile : la présentation des résultats y diffère souvent, et vos clients ne cherchent pas tous depuis un ordinateur. Comparez les deux et notez les différences.',
        ],
      },
      {
        h2: 'Étape 2 : écouter les questions réelles',
        paras: [
          'Les mots que vos clients emploient sont votre meilleure source. Trois sources gratuites suffisent souvent :',
        ],
        list: [
          'La Search Console : le rapport Performances liste les requêtes qui ont fait apparaître vos pages, avec impressions, clics, taux de clic et position moyenne, et permet de voir quelles pages s’affichent pour une requête donnée [4]. Une page qui reçoit beaucoup d’impressions pour une requête mais peu de clics répond peut-être à une autre intention.',
          'Les suggestions de Google : quand on tape une requête, la saisie semi-automatique propose des suites qui reflètent des recherches réellement effectuées sur Google, selon la langue, le lieu et l’actualité [3]. Google précise qu’elle n’affiche pas simplement les requêtes les plus fréquentes [3] : c’est un indice des formulations, pas une mesure de volume.',
          'Les questions de vos clients : celles qu’on pose au téléphone, en boutique, dans les e-mails et les demandes de devis. Notez-les telles qu’elles sont formulées.',
        ],
        after: [
          'Notre guide [Trouver ses mots-clés sans outil payant](/guides/mots-cles-sans-outil-payant) détaille ces sources et comment les combiner.',
        ],
      },
      {
        h2: 'Étape 3 : une intention, un type de page',
        paras: ['Une fois l’intention identifiée, le format de page s’en déduit presque toujours.'],
        list: [
          'Savoir : un guide ou une page explicative, avec la réponse dans les premières lignes, puis le détail, des exemples, les cas particuliers. L’installateur publie « Pompe à chaleur air-eau : comment ça marche et pour quelle maison ».',
          'Faire (acheter, demander un devis) : une page de service ou de produit, avec le prix ou une fourchette, les délais, ce qui est inclus, un bouton d’action visible. La librairie a une fiche par livre avec disponibilité et retrait en boutique.',
          'Comparer : une page comparative honnête, qui dit pour qui chaque option convient. L’éditeur de logiciel publie « Planning d’équipe : tableur, logiciel ou application, que choisir selon la taille de l’équipe ».',
          'Se rendre sur place : la fiche Google, complète, et une page par établissement avec adresse, horaires, accès. Voir notre guide [Fiche Google Business Profile](/guides/fiche-google-business-profile).',
          'Aller sur un site : une page d’accueil et des pages clés faciles à trouver, des titres qui reprennent le nom exact de la marque et du service.',
        ],
        after: [
          'L’erreur la plus fréquente est de vouloir tout faire avec une seule page : une page service qui contient un long cours théorique, ou un article de blog qui se termine par trois paragraphes de vente. Chacun dessert l’autre. Mieux vaut deux pages reliées entre elles : l’article explique et renvoie vers le service ; la page service vend et renvoie vers l’article pour ceux qui veulent comprendre. Notre guide sur le [maillage interne](/guides/maillage-interne) montre comment les relier.',
        ],
      },
      {
        h2: 'L’intention et les assistants d’IA',
        paras: [
          'Les assistants reçoivent des questions plus longues et plus explicites que les moteurs : « je cherche un installateur de pompe à chaleur près d’Annecy qui s’occupe aussi des démarches pour les aides ». L’intention y est souvent écrite en toutes lettres, avec des critères. Google explique que ses fonctions d’IA peuvent décomposer une question en plusieurs recherches apparentées sur des sous-thèmes pour construire leur réponse [2] ; une page qui répond précisément à l’un de ces sous-thèmes peut donc être retenue même si elle ne couvre pas toute la question.',
          'En pratique, cela renforce les principes précédents : des pages qui répondent nettement à une question précise, avec les critères écrits en clair (« nous montons le dossier d’aide pour vous », « intervention en Haute-Savoie et dans le pays de Gex »), sont plus faciles à reprendre qu’une page générique. Notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent) détaille la forme.',
        ],
      },
      {
        h2: 'Exemple : trois requêtes, trois pages',
        paras: [
          'L’installateur fictif d’Annecy relève dans sa Search Console trois requêtes qui lui apportent des impressions sans clics. Il les tape dans Google et observe :',
        ],
        list: [
          '« prix pompe à chaleur air eau » : des articles qui donnent des fourchettes et des comparateurs. Intention : savoir et comparer. Il crée une page « Prix d’une pompe à chaleur air-eau en Haute-Savoie : ce qui fait varier le devis », avec ses fourchettes réelles et les postes de coût.',
          '« installateur pompe à chaleur annecy » : une carte et des fiches. Intention : se rendre sur place, ou faire venir. Il complète sa fiche Google et sa page de contact avec sa zone d’intervention.',
          '« pompe à chaleur bruit voisin » : des articles et des forums. Intention : savoir, avec une inquiétude. Il écrit une page courte sur l’emplacement de l’unité extérieure et les règles de bon voisinage, et la relie à sa page service.',
        ],
        after: [
          'Aucune de ces pages ne garantit un clic de plus. Mais chacune répond enfin à ce que les gens cherchaient en tapant ces mots, ce qui n’était pas le cas de sa page d’accueil unique.',
        ],
      },
      {
        h2: 'Les signes qu’une page rate l’intention',
        list: [
          'Beaucoup d’impressions et un taux de clic très bas dans la Search Console, alors que le titre est correct.',
          'Des visiteurs qui repartent aussitôt depuis cette page dans votre outil d’analyse.',
          'Des pages concurrentes en tête qui sont toutes d’un autre type que la vôtre (articles quand vous avez une page produit, ou l’inverse).',
          'Des questions de clients qui portent sur un point que la page n’aborde pas.',
        ],
        after: [
          'Dans ces cas, réécrire le titre ne suffit pas : il faut souvent changer la nature de la page, ou en créer une seconde. Vérifiez ensuite l’aperçu de votre nouveau titre avec notre outil [Aperçu dans Google](/outils/apercu-google).',
        ],
      },
    ],
    faq: [
      { q: 'Une page peut-elle viser plusieurs intentions ?', a: 'Elle peut servir une intention principale et une secondaire proche (savoir le prix, puis demander un devis). Au-delà, mieux vaut des pages distinctes reliées entre elles.' },
      { q: 'L’intention d’une requête change-t-elle avec le temps ?', a: 'Oui : l’actualité, la saison ou un nouveau produit peuvent la faire évoluer. Retapez vos requêtes importantes quelques fois par an et regardez si les résultats ont changé de nature.' },
      { q: 'Faut-il cibler les questions posées aux assistants d’IA ?', a: 'Elles ressemblent aux questions de vos clients, en plus longues. Une page qui y répond précisément sert à la fois la recherche classique et les assistants ; il n’existe pas de données publiques de volume pour ces questions.' },
      { q: 'Les consignes aux évaluateurs sont-elles des règles de classement ?', a: 'Non. Google précise qu’une note d’évaluateur n’influence pas directement une page. Elles décrivent ce que Google considère comme un bon résultat, ce qui en fait un guide utile pour écrire.' },
    ],
    sources: [
      { label: 'Google, consignes aux évaluateurs de la qualité de la recherche (version du 11 septembre 2025, copie publiée par Search Engine Roundtable)', url: 'https://seroundtable.s3.amazonaws.com/searchqualityevaluatorguidelines-09112025.pdf.pdf', note: `copie du document officiel ; ${VU}` },
      { label: 'Google Search Central, fonctionnalités d’IA et votre site (query fan-out)', url: 'https://developers.google.com/search/docs/appearance/ai-features', note: VU },
      { label: 'Aide Google Search, fonctionnement des suggestions de la saisie semi-automatique', url: 'https://support.google.com/websearch/answer/7368877', note: VU },
      { label: 'Aide Search Console, rapport Performances : tâches courantes et cas d’usage', url: 'https://support.google.com/webmasters/answer/17010961', note: VU },
    ],
    cta: { text: 'Voyez comment votre titre et votre description s’affichent dans Google avant de les publier.', href: '/outils/apercu-google', label: 'Prévisualiser dans Google' },
    related: ['mots-cles-sans-outil-payant', 'page-que-les-ia-citent', 'titres-meta-descriptions', 'search-console-debutants'],
  },

  /* ------------------------------------------------------------------ */
  /* Mots-clés sans outil payant                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: 'mots-cles-sans-outil-payant',
    seoTitle: 'Trouver ses mots-clés sans outil payant : la méthode',
    title: 'Trouver ses mots-clés sans outil payant : la méthode',
    description:
      'Search Console, suggestions de Google, Google Trends, Keyword Planner, questions des clients : construire sa liste de mots-clés gratuitement, et savoir la lire.',
    updated: D,
    published: D,
    intro: [
      'Les outils payants de recherche de mots-clés sont utiles, mais une PME, un commerce ou une petite boutique peut construire une liste solide sans eux. Les sources gratuites sont moins pratiques, mais elles ont un avantage : elles viennent de Google lui-même, de vos propres données et de vos clients. Et pour un site de quelques dizaines de pages, la précision d’un volume de recherche compte moins que le choix des bonnes questions.',
      'Ce guide présente cinq sources gratuites, ce que chacune dit vraiment (et ce qu’elle ne dit pas), puis une méthode pour passer d’une liste de mots à un plan de pages. L’exemple est fictif : La Fabrique à Vélos, un atelier de réparation et de vente de vélos d’occasion à Grenoble.',
    ],
    sections: [
      {
        h2: 'Avant de commencer : ce qu’on cherche vraiment',
        paras: [
          'Une liste de mots-clés n’est pas une fin en soi. Elle sert à décider quelles pages créer ou améliorer, et quelles questions y traiter. Pour La Fabrique à Vélos, l’enjeu n’est pas de « se positionner sur vélo », requête immense et ambiguë, mais d’être trouvée par les Grenoblois qui cherchent une réparation, un vélo d’occasion révisé ou un conseil pour un vélo électrique.',
          'Gardez donc en tête trois critères pour chaque expression : correspond-elle à ce que vous vendez ? Quelle est l’intention derrière (savoir, acheter, venir sur place) ? Pouvez-vous écrire la meilleure réponse à cette question ? Notre guide [Intention de recherche](/guides/intention-de-recherche) détaille le deuxième point.',
          'Ce cadrage rejoint ce que Google demande : des contenus écrits d’abord pour être utiles aux personnes, et Google met en garde contre les contenus créés avant tout pour attirer des visites depuis les moteurs [2]. Les consignes de Google à ses évaluateurs jugent d’ailleurs un résultat sur sa capacité à répondre au besoin de la personne, pas sur la présence d’un mot [1].',
        ],
      },
      {
        h2: 'Source 1 : la Search Console, vos propres requêtes',
        paras: [
          'Si votre site existe déjà, c’est la source la plus précieuse : le rapport Performances liste les requêtes réellement tapées par les internautes pour lesquelles vos pages se sont affichées, avec les clics, les impressions, le taux de clic et la position moyenne [4]. Les requêtes affichées sont des correspondances exactes, sans distinction de casse [4].',
        ],
        list: [
          'Triez par impressions : les requêtes qui vous font apparaître souvent, mais où vous êtes loin, sont des pistes d’amélioration.',
          'Filtrez par page : quelles requêtes amènent à votre page « Réparation » ? Correspondent-elles à ce qu’elle propose ?',
          'Utilisez le filtre par expression régulière pour regrouper des requêtes proches (toutes celles qui contiennent « électrique », par exemple) [4].',
          'Comparez deux périodes et triez par différence pour repérer ce qui monte ou décroche [4].',
        ],
        after: [
          'Notre guide [La Search Console pour débutants](/guides/search-console-debutants) explique comment ouvrir ces rapports.',
        ],
      },
      {
        h2: 'Source 2 : les suggestions et les questions de Google',
        paras: [
          'Tapez le début d’une requête dans Google et regardez les suggestions. Elles reflètent des recherches réellement effectuées sur Google, et varient selon la langue, le lieu, l’actualité et, si vous êtes connecté, vos propres recherches [3]. Faites l’exercice en navigation privée pour limiter cette personnalisation.',
          'Google prévient qu’elles n’affichent pas simplement les requêtes les plus fréquentes, et déconseille de les comparer avec Google Trends [3]. Elles indiquent donc des formulations réelles, pas des volumes. Pour La Fabrique à Vélos, « réparation vélo électrique gren… » fait apparaître des suites avec « batterie », « pas cher », « à domicile » : autant d’angles à traiter.',
          'Sur la page de résultats, le bloc « Autres questions posées » et les recherches associées en bas de page complètent la liste. Notez les questions telles qu’elles sont formulées : ce sont souvent de bons intertitres.',
        ],
      },
      {
        h2: 'Source 3 : Google Trends, pour comparer et voir la saison',
        paras: [
          'Google Trends ne donne pas de volumes de recherche. Il utilise un échantillon de recherches réelles, divise chaque point par le total des recherches du lieu et de la période, puis ramène le résultat sur une échelle de 0 à 100 : les chiffres mesurent une popularité relative [5]. Deux régions qui montrent le même intérêt pour un terme n’ont pas forcément le même nombre de recherches [5].',
        ],
        list: [
          'Comparez deux formulations : « vélo d’occasion » ou « vélo reconditionné », laquelle est la plus cherchée dans votre région ?',
          'Repérez la saison : les recherches de réparation de vélo montent-elles au printemps ? Publiez et mettez à jour vos pages avant le pic.',
          'Restreignez la zone à votre région ou à votre département quand l’outil le permet : l’intérêt national peut masquer des différences locales importantes.',
          'Méfiez-vous des termes rares : les requêtes à très faible volume apparaissent à 0, et Google ajoute un léger bruit aléatoire pour protéger la vie privée, plus visible sur ces termes [5]. Un pic soudain sur un terme confidentiel n’est pas forcément réel.',
        ],
      },
      {
        h2: 'Source 4 : le Keyword Planner de Google Ads',
        paras: [
          'L’outil de planification des mots-clés de Google Ads donne, pour une liste de mots, des moyennes de recherches mensuelles, un niveau de concurrence publicitaire et des fourchettes d’enchères [6]. C’est la seule source gratuite de Google qui donne des ordres de grandeur de volume.',
          'Deux précisions. D’abord, l’accès suppose un compte Google Ads dont la configuration est terminée : l’aide de Google indique qu’il faut saisir ses informations de facturation pour accéder aux fonctions de base comme la recherche d’idées de mots-clés [6]. Rien ne vous oblige ensuite à lancer une campagne, mais faites attention à ne pas en activer une par mégarde. Ensuite, les volumes affichés sont arrondis [6] : prenez-les comme des ordres de grandeur pour comparer des expressions entre elles, pas comme des chiffres exacts.',
        ],
      },
      {
        h2: 'Source 5 : vos clients, la source que les outils n’ont pas',
        paras: [
          'Les outils montrent ce que les gens tapent ; vos clients vous disent ce qu’ils cherchent vraiment. Pendant un mois, notez :',
        ],
        list: [
          'les questions posées au téléphone et au comptoir (« vous réparez les vélos électriques de toutes marques ? ») ;',
          'les mots employés dans les demandes de devis et les e-mails ;',
          'les questions des avis clients et des commentaires sur les réseaux ;',
          'les objections avant l’achat (« un vélo d’occasion, c’est garanti combien de temps ? »).',
        ],
        after: [
          'Ces formulations sont souvent celles que les gens tapent aussi dans Google, et de plus en plus celles qu’ils posent à un assistant d’IA, sous forme de phrases complètes. Une page qui y répond exactement a toutes les chances d’être utile, quel que soit le volume affiché par un outil.',
        ],
      },
      {
        h2: 'De la liste au plan de pages',
        paras: ['Réunissez tout dans un tableur, une ligne par expression, et ajoutez trois colonnes : intention, page existante ou à créer, priorité.'],
        list: [
          'Regroupez les expressions qui ont la même intention et appellent la même réponse : « réparation vélo électrique Grenoble », « réparer batterie vélo électrique », « atelier vélo électrique toutes marques » peuvent relever d’une seule page de service.',
          'Séparez celles qui appellent une autre page : « vélo électrique d’occasion garantie » relève de la page de vente, pas de la page de réparation.',
          'Pour chaque groupe, choisissez une expression principale pour le titre et la première phrase, et traitez les autres comme des questions dans la page.',
          'Priorisez ce qui correspond à votre chiffre d’affaires et à votre zone, puis ce que vous pouvez écrire mieux que les autres.',
        ],
        after: [
          'Le résultat pour La Fabrique à Vélos : une page « Réparation de vélos électriques à Grenoble », une page « Vélos d’occasion révisés et garantis », un guide « Entretenir son vélo électrique : ce que vous pouvez faire vous-même », et des réponses courtes aux questions fréquentes sur chaque page. Quatre pages, pas quarante. Chacune a une raison d’exister, une intention claire et des questions précises à traiter, ce qui la rend aussi plus simple à écrire.',
        ],
      },
      {
        h2: 'Exemple : cinq lignes du tableur de La Fabrique à Vélos',
        list: [
          '« réparation vélo électrique grenoble » : faire venir ; source Search Console ; page de service existante à enrichir ; priorité haute.',
          '« batterie vélo électrique ne charge plus » : savoir ; source suggestions de Google ; question à traiter dans le guide d’entretien, avec renvoi vers la réparation ; priorité moyenne.',
          '« vélo reconditionné garantie » : acheter ; source questions au comptoir ; page de vente à créer, avec la durée de garantie réelle ; priorité haute.',
          '« révision vélo avant été » : savoir puis faire ; source Google Trends (pic en avril) ; page de forfait révision à mettre à jour en mars ; priorité moyenne.',
          '« vélo cargo occasion » : acheter ; source Keyword Planner (volume faible) ; l’atelier n’en vend pas ; pas de page, aucune priorité.',
        ],
        after: [
          'La dernière ligne compte autant que les autres : décider de ne pas créer une page est une économie de temps, et évite d’attirer des visiteurs que l’on ne peut pas servir.',
        ],
      },
      {
        h2: 'Les pièges à éviter',
        list: [
          'Courir après les gros volumes : une requête très cherchée mais vague apporte des visiteurs qui ne sont pas vos clients.',
          'Créer une page par variante de mot-clé (« réparation vélo », « réparer vélo », « réparateur vélo ») : ces pages se ressemblent et se concurrencent.',
          'Répéter le mot-clé de façon artificielle : Google comprend les synonymes, et un texte bourré de répétitions se lit mal. Notre outil [Compteur de mots et lisibilité](/outils/lisibilite) aide à repérer un texte lourd.',
          'Oublier la mise à jour : une liste de mots-clés se revoit au moins une fois par an, et après chaque changement d’offre.',
        ],
      },
      {
        h2: 'Et les assistants d’IA ?',
        paras: [
          'Il n’existe pas d’équivalent public des volumes de recherche pour les questions posées aux assistants. Ce que l’on peut faire : partir des questions réelles de vos clients, les poser à ChatGPT, Gemini ou Perplexity, et noter qui est cité. C’est la méthode de notre guide [Suivre ses questions dans ChatGPT](/guides/suivre-ses-questions-chatgpt). Les pages construites à partir de ces questions servent les deux mondes à la fois.',
        ],
      },
    ],
    faq: [
      { q: 'Le Keyword Planner est-il gratuit ?', a: 'Son usage ne coûte rien tant que vous ne lancez pas de campagne, mais l’accès suppose un compte Google Ads configuré, avec des informations de facturation, selon l’aide de Google.' },
      { q: 'Combien de mots-clés faut-il viser par page ?', a: 'Une expression principale et ses variantes proches, plus les questions associées. Si deux expressions appellent des réponses différentes, elles méritent deux pages.' },
      { q: 'Faut-il viser les requêtes avec le nom de la ville ?', a: 'Pour un commerce ou un artisan, oui, quand elles correspondent à votre zone réelle. Mais Google tient aussi compte de la position de la personne : des recherches locales se font aussi sans nom de ville, depuis un téléphone, et c’est alors surtout la fiche Google qui y répond.' },
      { q: 'Google Trends peut-il remplacer un outil de volume ?', a: 'Non : il donne une popularité relative sur 100, pas un nombre de recherches. Il sert à comparer des formulations et à repérer les saisons.' },
    ],
    sources: [
      { label: 'Google, consignes aux évaluateurs de la qualité de la recherche (version du 11 septembre 2025, copie)', url: 'https://seroundtable.s3.amazonaws.com/searchqualityevaluatorguidelines-09112025.pdf.pdf', note: `copie du document officiel ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Aide Google Search, fonctionnement des suggestions de la saisie semi-automatique', url: 'https://support.google.com/websearch/answer/7368877', note: VU },
      { label: 'Aide Search Console, rapport Performances : tâches courantes et cas d’usage', url: 'https://support.google.com/webmasters/answer/17010961', note: VU },
      { label: 'Aide Google Trends, questions fréquentes sur les données (échantillon, échelle 0 à 100)', url: 'https://support.google.com/trends/answer/4365533', note: VU },
      { label: 'Aide Google Ads, à propos des prévisions et statistiques du Keyword Planner', url: 'https://support.google.com/google-ads/answer/3022575', note: VU },
    ],
    cta: { text: 'Une fois vos pages écrites, vérifiez que leurs titres et descriptions s’affichent bien dans Google.', href: '/outils/balises-title-meta', label: 'Vérifier mes balises' },
    related: ['intention-de-recherche', 'search-console-debutants', 'titres-meta-descriptions', 'audit-seo-30-minutes'],
  },
  /* ------------------------------------------------------------------ */
  /* E-E-A-T pour une petite entreprise                                   */
  /* ------------------------------------------------------------------ */
  {
    slug: 'eeat-petite-entreprise',
    seoTitle: 'E-E-A-T pour une petite entreprise : le guide concret',
    title: 'E-E-A-T pour une petite entreprise : montrer qu’on sait',
    description:
      'Expérience, expertise, autorité, fiabilité : ce que Google entend par E-E-A-T, ce que ce n’est pas, et comment une TPE peut le montrer sans artifice.',
    updated: D,
    published: D,
    intro: [
      'E-E-A-T est l’un des sigles les plus cités du référencement, et l’un des plus mal compris. On lit qu’il faudrait « optimiser son E-E-A-T » avec des biographies d’auteurs gonflées, des badges et des pages de références. Ce n’est pas ce que dit Google. Pour une petite entreprise, c’est à la fois plus simple et plus exigeant : montrer honnêtement qui l’on est, ce que l’on a fait, et pourquoi on peut être cru.',
      'Ce guide reprend ce que Google écrit lui-même sur le sujet, puis le traduit en actions concrètes pour une TPE. Les exemples sont fictifs : un plombier chauffagiste, une diététicienne et une boutique en ligne de matériel de randonnée.',
    ],
    sections: [
      {
        h2: 'Ce que Google dit, et ce qu’il ne dit pas',
        paras: [
          'Dans sa documentation sur les contenus utiles, Google explique que ses systèmes cherchent à mettre en avant les contenus qui montrent de l’expérience, de l’expertise, de l’autorité et de la fiabilité, ce qu’il appelle E-E-A-T. Il précise que parmi ces aspects, la fiabilité est le plus important, et que les autres y contribuent sans qu’un contenu doive les montrer tous [1].',
          'Point essentiel : Google écrit que l’E-E-A-T n’est pas en soi un facteur de classement spécifique [1]. Il n’existe pas de « score E-E-A-T » à optimiser. C’est un ensemble de qualités que plusieurs signaux permettent d’estimer. Les consignes aux évaluateurs vont dans le même sens : la fiabilité y est décrite comme le membre le plus important de la famille E-E-A-T, et l’expérience, l’expertise et l’autorité servent à l’évaluer [2].',
          'Google ajoute que pour les sujets qui peuvent affecter la santé, la stabilité financière ou la sécurité des personnes, les sujets dits « Your Money or Your Life », ses systèmes accordent un poids supplémentaire aux contenus qui montrent une forte E-E-A-T [1]. Une diététicienne, un courtier ou un électricien qui parle de sécurité sont concernés de plus près qu’une boutique de décoration.',
        ],
      },
      {
        h2: 'Les quatre lettres, traduites pour une TPE',
        list: [
          'Expérience : avez-vous fait ce dont vous parlez ? Le plombier qui décrit un désembouage qu’il a réalisé, photos à l’appui, montre une expérience directe. Un texte générique sur « l’importance du désembouage » n’en montre aucune.',
          'Expertise : savez-vous de quoi vous parlez ? Diplômes, qualifications, années de métier, précision technique des explications. La diététicienne indique son diplôme et explique les nuances, pas des généralités.',
          'Autorité : d’autres vous reconnaissent-ils ? Mentions dans la presse locale, partenariats, citations par des confrères, avis clients. Elle se construit surtout hors de votre site.',
          'Fiabilité : peut-on vous faire confiance ? Coordonnées complètes, informations exactes et à jour, prix clairs, conditions de vente lisibles, sources citées, erreurs corrigées. C’est le cœur du sujet [1][2].',
        ],
      },
      {
        h2: 'Qui, comment, pourquoi : les trois questions de Google',
        paras: [
          'Google propose de regarder un contenu à travers trois questions : qui l’a créé, comment, et pourquoi [1].',
        ],
        list: [
          'Qui : est-il évident pour le visiteur qui a écrit le contenu ? Google encourage fortement des informations d’auteur exactes, comme des signatures là où les lecteurs s’y attendent, et met en garde contre les profils d’auteurs inventés [1].',
          'Comment : si l’automatisation ou l’IA a servi à produire une part importante du contenu, son usage est-il évident pour le visiteur, par une mention ou autrement, et explique-t-on comment et pourquoi elle a été utilisée [1] ? Notre guide [Contenu écrit avec l’IA](/guides/contenu-ecrit-avec-ia) développe ce point.',
          'Pourquoi : le contenu est-il créé d’abord pour aider des personnes, ou d’abord pour attirer des visites depuis les moteurs ? Google dit clairement que la seconde motivation ne correspond pas à ce que ses systèmes cherchent à récompenser [1].',
        ],
      },
      {
        h2: 'Étape 1 : rendre l’entreprise identifiable',
        paras: [
          'Avant même le contenu, la fiabilité tient à des éléments simples, que beaucoup de petits sites oublient :',
        ],
        list: [
          'une page « À propos » avec le nom légal, l’adresse, la date de création, les personnes et leur rôle (voir notre guide [Page « À propos » et entité de marque](/guides/entite-de-marque-wikidata-sameas)) ;',
          'des coordonnées complètes et visibles, identiques sur le site, la fiche Google et les annuaires ;',
          'des mentions légales et, pour une boutique, des conditions générales de vente, des délais et des frais de livraison et de retour faciles à trouver ;',
          'des prix ou des fourchettes de prix quand c’est possible, plutôt que « sur devis » partout ;',
          'des photos réelles de l’entreprise, de l’équipe et des réalisations.',
        ],
      },
      {
        h2: 'Étape 2 : montrer l’expérience dans chaque page',
        paras: [
          'L’expérience est la lettre la plus accessible à une petite entreprise, parce qu’elle repose sur ce que vous faites tous les jours. Elle se montre par des détails que seul un praticien connaît.',
        ],
        list: [
          'Le plombier : « Sur les radiateurs en fonte des maisons des années 1930 du quartier, nous trouvons presque toujours… » suivi d’une observation précise, et des photos de l’intervention.',
          'La diététicienne : un exemple de suivi anonymisé, avec ce qui a fonctionné et ce qui n’a pas fonctionné, et la mention claire de ce qui relève d’un médecin.',
          'La boutique de randonnée : un test du produit sur un itinéraire réel, avec les conditions (météo, dénivelé, durée) et les défauts constatés, pas seulement les qualités.',
        ],
        after: [
          'Une phrase qui commence par « Nous avons constaté », « Sur nos chantiers », « En boutique, les clients nous demandent » apporte plus qu’un paragraphe de généralités. C’est aussi ce qui distingue votre page de mille autres, et ce qu’un assistant d’IA peut citer comme un fait. Notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent) en tire les règles.',
        ],
      },
      {
        h2: 'Étape 3 : signer, dater, sourcer',
        list: [
          'Signez les articles et les guides d’un nom réel, avec une courte présentation et un lien vers une page auteur qui détaille le parcours.',
          'Datez la publication et la dernière mise à jour, et mettez réellement à jour : un guide sur une aide financière de 2023 qui n’a pas bougé depuis abîme la confiance. Notre outil [Date et fraîcheur d’une page](/outils/fraicheur-page) vérifie que les dates affichées, balisées et envoyées par le serveur concordent.',
          'Citez vos sources pour les faits qui ne viennent pas de vous (réglementation, chiffres, études), avec un lien vers la source primaire.',
          'Corrigez visiblement les erreurs signalées (« Mise à jour du 3 mars : nous avions indiqué un délai erroné »).',
        ],
        after: [
          'Pour une TPE, une page auteur peut être très simple : nom, photo, métier, années d’expérience, qualifications réelles, deux ou trois réalisations. Ne l’enjolivez pas : Google met explicitement en garde contre les profils inventés [1], et un client qui découvre un écart s’en souviendra.',
        ],
      },
      {
        h2: 'Étape 4 : l’autorité, hors de votre site',
        paras: [
          'L’autorité ne se décrète pas sur sa propre page. Elle vient de ce que d’autres disent de vous : avis de clients, articles de presse, partenaires, associations professionnelles, interventions dans des salons ou des formations. Pour une petite entreprise, quelques actions réalistes :',
        ],
        list: [
          'Proposer une information utile à la presse locale ou spécialisée (une étude sur les demandes reçues, un conseil de saison).',
          'Être référencé par les organisations professionnelles dont vous êtes membre.',
          'Obtenir des avis réguliers, honnêtement, comme décrit dans notre guide [Avis clients : y répondre et en obtenir dans les règles](/guides/repondre-avis-clients).',
          'Obtenir des liens de partenaires réels, sans échange artificiel : notre guide sur les [liens entrants sans risque](/guides/liens-entrants-sans-risque) détaille ce qui est accepté.',
        ],
      },
      {
        h2: 'Exemple : la page « Rééquilibrage alimentaire » de la diététicienne',
        paras: [
          'Avant : un texte de 600 mots sur « l’importance d’une alimentation équilibrée », sans signature, illustré par une photo de banque d’images, se terminant par « Prenez rendez-vous ». Rien ne le distingue de milliers d’autres pages, rien ne dit qui l’a écrit ni sur quoi il s’appuie.',
          'Après : la page commence par ce que propose la diététicienne fictive Inès Garnier, diplômée, installée à Poitiers depuis 2016 : un suivi en trois à six consultations, à quel tarif, pour qui, et ce qui relève d’un médecin plutôt que d’elle. Suivent le déroulement d’une première consultation, deux exemples anonymisés de suivis (objectif, difficultés, ce qui a été ajusté), les recommandations officielles sur lesquelles elle s’appuie, avec leurs liens, et une signature avec la date de mise à jour. Une page auteur détaille son diplôme et son parcours.',
          'La seconde version n’a rien de spectaculaire. Elle est simplement vérifiable, précise et honnête, c’est-à-dire fiable au sens où Google l’entend. Elle est aussi beaucoup plus utile à la personne qui hésite à prendre rendez-vous.',
        ],
      },
      {
        h2: 'Ce qui ne sert à rien, ou nuit',
        list: [
          'Des biographies d’auteurs gonflées ou inventées, des photos de banque d’images présentées comme l’équipe.',
          'Des badges « Expert certifié » qui ne renvoient à aucune certification réelle.',
          'Des pages de références qui citent des clients sans leur accord, ou des logos de grandes marques avec lesquelles vous avez travaillé une fois.',
          'Des contenus produits en masse sur des sujets sans rapport avec votre métier, pour « montrer de l’expertise » : Google range la production de contenu en masse sans valeur parmi les pratiques de spam [3].',
          'Des mentions « mis à jour en 2026 » sur des pages qui n’ont pas changé.',
        ],
      },
      {
        h2: 'Une liste de contrôle en quinze minutes',
        paras: ['Ouvrez votre page la plus importante et répondez honnêtement :'],
        list: [
          'Sait-on en dix secondes qui est l’entreprise, où elle est, et comment la joindre ?',
          'La page contient-elle au moins un fait que seul un praticien de votre entreprise peut écrire ?',
          'Est-elle signée, datée, et la date est-elle vraie ?',
          'Les chiffres et règles cités ont-ils une source ?',
          'Les prix, délais et conditions sont-ils clairs ?',
          'Un client mécontent trouverait-il facilement comment vous contacter ?',
        ],
        after: [
          'Si vous répondez non à plus de deux questions, c’est par là qu’il faut commencer, avant tout travail de mots-clés. L’outil gratuit [Citabilité](/outils/citabilite) vérifie une page sur 20 règles proches de cette liste.',
        ],
      },
    ],
    faq: [
      { q: 'E-E-A-T est-il un facteur de classement ?', a: 'Google écrit que l’E-E-A-T n’est pas en soi un facteur de classement spécifique. C’est un ensemble de qualités que ses systèmes cherchent à repérer à travers de nombreux signaux.' },
      { q: 'Faut-il refaire toutes ses pages d’un coup ?', a: 'Non. Commencez par les pages qui comptent le plus pour votre activité (services principaux, produits phares), puis avancez par ordre d’importance. Une page améliorée par semaine suffit.' },
      { q: 'Une page auteur est-elle obligatoire ?', a: 'Non, mais Google encourage des informations d’auteur exactes là où les lecteurs s’y attendent. Pour des conseils techniques, de santé ou financiers, savoir qui écrit est un élément de confiance important.' },
      { q: 'Faut-il afficher ses diplômes et certifications ?', a: 'Oui, s’ils sont réels et en rapport avec le contenu, avec leur intitulé exact et, quand c’est possible, un moyen de les vérifier. Un diplôme sans rapport avec le sujet de la page n’apporte rien.' },
      { q: 'Les avis clients comptent-ils dans l’E-E-A-T ?', a: 'Les consignes aux évaluateurs tiennent compte de la réputation, dont les avis font partie. Ils relèvent de l’autorité et de la fiabilité, et se construisent honnêtement, sans contrepartie ni sélection des clients.' },
      { q: 'Une TPE peut-elle rivaliser avec de grands sites sur l’E-E-A-T ?', a: 'Sur l’autorité, rarement. Sur l’expérience directe et la précision locale, souvent : un artisan qui décrit ses vrais chantiers apporte ce qu’un grand site généraliste n’a pas.' },
    ],
    sources: [
      { label: 'Google Search Central, créer des contenus utiles, fiables et axés sur les personnes (E-E-A-T, qui/comment/pourquoi, YMYL)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: `mise à jour du 5 oct. 2026 ; ${VU}` },
      { label: 'Google, consignes aux évaluateurs de la qualité de la recherche (version du 11 septembre 2025, copie)', url: 'https://seroundtable.s3.amazonaws.com/searchqualityevaluatorguidelines-09112025.pdf.pdf', note: `copie du document officiel ; ${VU}` },
      { label: 'Google Search Central, règles relatives au spam (contenu en masse)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
    ],
    cta: { text: 'Votre page montre-t-elle qui vous êtes, avec des faits datés et sourcés ? L’outil de citabilité la note sur 20 règles.', href: '/outils/citabilite', label: 'Tester une page' },
    related: ['page-que-les-ia-citent', 'contenu-ecrit-avec-ia', 'entite-de-marque-wikidata-sameas', 'seo-b2b-acheteurs'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO international et hreflang                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-international-hreflang',
    seoTitle: 'SEO international et hreflang : la méthode sans erreur',
    title: 'SEO international et hreflang : traduire sans se perdre',
    description:
      'Sous-dossiers, sous-domaines ou domaines par pays, balises hreflang, x-default, redirections par langue : vendre à l’étranger sans brouiller Google.',
    updated: D,
    published: D,
    intro: [
      'Une PME française qui ouvre son site à la Belgique, à la Suisse ou à l’anglais se heurte vite à des questions techniques : faut-il un domaine par pays ? Comment éviter que la version belge et la version française se fassent concurrence ? Que faire des visiteurs dont la langue n’est pas prévue ? Les erreurs sont fréquentes, et souvent silencieuses : Google affiche la mauvaise version, ou ignore les indications qu’on lui donne.',
      'Ce guide suit la documentation de Google sur les sites multilingues et multirégionaux, et l’applique à des cas de PME. L’exemple est fictif : Maison Arnaud, fabricant de linge de lit à Roubaix, qui vend en France, en Belgique et, depuis peu, aux clients anglophones.',
    ],
    sections: [
      {
        h2: 'Langue ou pays : d’abord savoir ce que l’on cible',
        paras: [
          'Deux situations se ressemblent mais ne se traitent pas de la même façon. Cibler une langue (proposer le site en anglais à tous les anglophones) et cibler un pays (proposer une version pour la Belgique, avec ses prix, ses délais et ses conditions de livraison). Maison Arnaud fait les deux : une version française pour la France, une version française pour la Belgique avec des frais de port différents, et une version anglaise sans pays précis.',
          'Google rappelle qu’il détermine la langue d’une page à partir de son contenu visible, et qu’il n’utilise pas les informations de langue du code, comme l’attribut lang, ni l’adresse [2]. Une page en anglais doit donc être réellement en anglais, et pas seulement balisée comme telle. Google précise aussi que des versions localisées ne sont considérées comme des doublons que si leur contenu principal n’est pas traduit [1].',
        ],
      },
      {
        h2: 'Étape 1 : choisir la structure des adresses',
        paras: ['Google compare quatre structures, avec leurs avantages et leurs inconvénients [2] :'],
        list: [
          'Un domaine par pays (maisonarnaud.be) : ciblage géographique clair, mais coûteux, plus lourd à maintenir, et limité à un pays par domaine [2].',
          'Des sous-domaines (be.maisonarnaud.com) : faciles à mettre en place, mais l’utilisateur ne sait pas toujours si « be » désigne une langue ou un pays [2].',
          'Des sous-dossiers (maisonarnaud.com/fr-be/) : simples à mettre en place et à maintenir, sur un seul serveur [2].',
          'Des paramètres d’adresse (?loc=be) : Google ne les recommande pas, parce qu’ils rendent la segmentation difficile [2].',
        ],
        after: [
          'Pour une PME, les sous-dossiers sont souvent le choix le plus simple : un seul site, un seul tableau de bord, et des versions faciles à repérer. Maison Arnaud choisit /fr/ pour la France, /fr-be/ pour la Belgique et /en/ pour l’anglais. Quel que soit le choix, gardez-le : changer de structure plus tard équivaut à une migration, avec ses risques (voir notre guide [Migration https et changement de domaine](/guides/migration-https-changement-domaine)).',
        ],
      },
      {
        h2: 'Étape 2 : les balises hreflang, sans erreur',
        paras: [
          'Les balises hreflang indiquent à Google qu’une page existe en plusieurs versions linguistiques ou régionales, et laquelle montrer à qui. Google accepte trois façons de les déclarer, qu’il considère comme équivalentes : des balises link dans le HTML, des en-têtes HTTP, ou un sitemap XML [1]. Choisissez-en une seule et tenez-vous-y.',
        ],
        list: [
          'Chaque version doit citer toutes les autres versions et elle-même. Si la page X cite la page Y, la page Y doit citer la page X ; sinon, les annotations peuvent être ignorées [1].',
          'Les adresses doivent être complètes, avec le protocole (https://), pas relatives [1].',
          'Le code de langue suit la norme ISO 639-1 (fr, en, nl), le code de pays, facultatif, la norme ISO 3166-1 alpha-2 (FR, BE, CH). Un code de pays seul n’est pas valide [1].',
          'Les codes réservés comme EU ou UK n’ont pas d’effet dans hreflang [1] ; pour le Royaume-Uni, le code de pays est GB.',
          'La valeur x-default désigne la page à proposer quand aucune autre version ne correspond à la langue ou au pays du visiteur [1].',
        ],
        after: [
          'Pour Maison Arnaud, chaque fiche produit déclare donc quatre lignes : fr-FR vers /fr/, fr-BE vers /fr-be/, en vers /en/, et x-default vers la page de choix de langue (ou vers la version anglaise). Les mêmes quatre lignes figurent sur les trois versions. Notre outil gratuit [Vérificateur hreflang](/outils/hreflang) contrôle les codes, les adresses complètes et les liens de retour d’une page.',
        ],
      },
      {
        h2: 'Étape 3 : ne pas rediriger selon l’adresse IP',
        paras: [
          'Une tentation fréquente : détecter le pays du visiteur et le rediriger automatiquement vers « sa » version. Google le déconseille. Il recommande de ne pas rediriger les utilisateurs en fonction de la langue supposée ou de l’adresse IP, parce que cela peut empêcher les utilisateurs et les moteurs de voir toutes les versions d’un site, et rappelle que la localisation par IP est en général peu fiable [2].',
          'Google précise aussi que son robot explore généralement depuis les États-Unis et n’envoie pas d’en-tête indiquant une langue préférée : si votre contenu change dynamiquement selon la langue du navigateur, Google pourrait ne pas trouver toutes vos variantes [2]. La bonne pratique : des adresses distinctes par version, des balises hreflang, et un bandeau qui propose (sans l’imposer) la version adaptée, avec un sélecteur de langue fait de liens ordinaires.',
        ],
      },
      {
        h2: 'Étape 4 : localiser, pas seulement traduire',
        paras: [
          'Une version pour un pays doit parler à ses clients. Google cite parmi les signaux qu’il utilise pour comprendre le ciblage géographique les adresses locales, les numéros de téléphone, la devise, les liens locaux et les données de la fiche d’établissement, et précise qu’il ignore les balises meta de localisation comme geo.position [2].',
        ],
        list: [
          'Prix dans la devise du pays, avec les taxes applicables.',
          'Délais et frais de livraison réels pour le pays, conditions de retour adaptées.',
          'Coordonnées : un numéro joignable depuis le pays, une adresse de retour si elle existe.',
          'Vocabulaire local : en Belgique, on ne parle pas toujours comme en France ; faites relire par quelqu’un du pays.',
          'Traductions relues par un humain : une traduction automatique non relue se remarque, et peut contenir des erreurs gênantes sur des caractéristiques de produit.',
        ],
      },
      {
        h2: 'Étape 5 : canonique, sitemap et liens internes',
        list: [
          'Chaque version porte une balise canonique qui pointe vers elle-même, pas vers la version française : une canonique vers une autre langue revient à dire à Google d’ignorer la version traduite.',
          'Le sitemap liste toutes les versions ; si vous déclarez hreflang dans le sitemap, chaque adresse y liste ses alternatives.',
          'Le sélecteur de langue est fait de liens HTML vers la page équivalente dans l’autre langue, pas vers la page d’accueil.',
          'Les liens internes de chaque version restent dans la même version : un lien depuis /en/ doit mener vers /en/, sauf le sélecteur.',
        ],
        after: [
          'Vérifiez enfin que chaque version est indexable, avec notre [Testeur d’indexabilité](/outils/indexabilite) : une version anglaise accidentellement en noindex est un classique après une mise en ligne.',
        ],
      },
      {
        h2: 'Exemple : une fiche produit de Maison Arnaud',
        paras: [
          'La parure « Lin lavé, blanc » existe en trois versions. Sur /fr/, le prix est en euros TTC avec la TVA française, la livraison en 48 heures, le retour gratuit sous 30 jours. Sur /fr-be/, le texte est relu par une collègue belge, les délais de livraison sont ceux du transporteur pour la Belgique, et les frais de port sont indiqués clairement. Sur /en/, la description est traduite par un traducteur professionnel, les tailles de lit sont expliquées (les standards ne sont pas les mêmes partout), et la page précise vers quels pays la boutique livre.',
          'Chaque version porte une canonique vers elle-même et les mêmes quatre lignes hreflang. Le sélecteur de langue en haut de page mène vers la même parure dans l’autre version, pas vers la page d’accueil. Les liens internes de chaque version restent dans sa langue : la fiche anglaise renvoie vers la catégorie anglaise, comme le recommande la logique d’un bon [maillage interne](/guides/maillage-interne).',
        ],
      },
      {
        h2: 'Avec un CMS : où se règlent les langues',
        paras: [
          'La plupart des outils de site gèrent les versions linguistiques par une application ou une extension, qui génère aussi les balises hreflang. C’est pratique, mais vérifiez toujours le résultat : codes de langue et de pays, présence de la version elle-même dans la liste, adresses complètes, canonique. Les réglages propres à Shopify sont abordés dans notre guide [SEO Shopify](/guides/seo-shopify) ; pour WordPress, les extensions multilingues varient, et c’est le code produit qu’il faut contrôler, pas la page de réglages.',
          'Méfiez-vous des traductions automatiques activées en un clic pour « couvrir » vingt langues : des pages traduites sans relecture, sur des marchés où vous ne livrez pas, n’apportent rien et peuvent donner une mauvaise image. Mieux vaut deux langues bien faites que vingt approximatives. Ajoutez une langue quand vous êtes capable de répondre aux clients qui la parlent, de les livrer et de traiter leurs retours.',
        ],
      },
      {
        h2: 'Et pour les assistants d’IA ?',
        paras: [
          'Les assistants répondent dans la langue de la question et peuvent citer des pages dans d’autres langues. Une version anglaise propre, avec les faits essentiels (qui vous êtes, ce que vous vendez, où vous livrez), augmente les chances d’être compris par un acheteur étranger qui interroge un assistant en anglais. Les règles de lisibilité sont les mêmes qu’en français : réponse en tête, faits datés, texte présent dans le HTML. Voir notre guide [Écrire une page que les IA citent](/guides/page-que-les-ia-citent).',
        ],
      },
      {
        h2: 'Les erreurs les plus fréquentes',
        list: [
          'Des balises hreflang sans liens de retour : la version belge cite la française, mais pas l’inverse [1].',
          'Un code de pays seul (hreflang="be") : invalide, et « be » est d’ailleurs le code de la langue biélorusse [1].',
          'Des adresses relatives dans hreflang [1].',
          'Une redirection automatique par IP qui empêche Google de voir les autres versions [2].',
          'Des pages « traduites » dont seul le menu change, le contenu principal restant en français.',
          'Une canonique de toutes les versions vers la version française.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il un domaine .be pour vendre en Belgique ?', a: 'Ce n’est pas nécessaire. Un domaine par pays donne un signal géographique clair mais coûte plus cher à maintenir ; un sous-dossier /fr-be/ avec des balises hreflang et un contenu localisé fonctionne aussi.' },
      { q: 'Faut-il traduire les adresses (URL) des pages ?', a: 'Ce n’est pas obligatoire, mais une adresse dans la langue de la page est plus claire pour le visiteur. Si vous le faites, décidez-le dès le départ : changer les adresses plus tard impose des redirections.' },
      { q: 'hreflang améliore-t-il le classement ?', a: 'Il sert à montrer la bonne version au bon public, pas à mieux classer une page. Il évite surtout qu’une version prenne la place d’une autre dans les résultats d’un pays.' },
      { q: 'Peut-on utiliser une seule version française pour la France, la Belgique et la Suisse ?', a: 'Oui, avec hreflang="fr" pour l’ensemble des francophones. Des versions par pays ne se justifient que si les prix, les délais, les conditions ou le vocabulaire changent vraiment d’un pays à l’autre.' },
      { q: 'Que mettre en x-default ?', a: 'La page à montrer quand aucune version ne correspond : souvent une page de choix de langue, ou la version la plus internationale (l’anglais pour beaucoup de sites).' },
    ],
    sources: [
      { label: 'Google Search Central, indiquer à Google les versions localisées d’une page (hreflang, x-default)', url: 'https://developers.google.com/search/docs/specialty/international/localized-versions', note: `mise à jour du 21 sept. 2026 ; ${VU}` },
      { label: 'Google Search Central, gérer des sites multirégionaux et multilingues (structures d’adresses, redirections, signaux)', url: 'https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites', note: `mise à jour du 10 déc. 2025 ; ${VU}` },
    ],
    cta: { text: 'Vos balises hreflang ont-elles des codes valides, des adresses complètes et des liens de retour ? Vérifiez une page en une minute.', href: '/outils/hreflang', label: 'Vérifier mes hreflang' },
    related: ['migration-https-changement-domaine', 'seo-shopify', 'maillage-interne', 'refonte-site-sans-perdre-seo'],
  },

  /* ------------------------------------------------------------------ */
  /* Migration https et changement de domaine                             */
  /* ------------------------------------------------------------------ */
  {
    slug: 'migration-https-changement-domaine',
    seoTitle: 'Passer en https ou changer de domaine sans perdre Google',
    title: 'Migration https et changement de domaine : la méthode sûre',
    description:
      'Table de correspondance, redirections 301, outil de changement d’adresse, suivi : passer en https ou changer de nom de domaine sans perdre son référencement.',
    updated: D,
    published: D,
    intro: [
      'Changer de nom de domaine (après un changement de nom de l’entreprise, une fusion, un rachat) ou passer enfin un vieux site en https sont deux opérations que Google traite de la même façon : comme un déménagement avec changement d’adresses. Bien préparé, il se passe généralement sans grande perte ; mal préparé, il peut effacer des années de référencement en quelques semaines.',
      'Ce guide suit la documentation de Google sur les déplacements de site et l’outil de changement d’adresse. Il complète notre guide [Refonte de site : ne pas perdre son référencement](/guides/refonte-site-sans-perdre-seo), qui traite le cas où les pages elles-mêmes changent. L’exemple est fictif : Bureau Morin, cabinet de géomètres qui devient Morin Géo Conseil et passe de bureau-morin.fr à morin-geo.fr.',
    ],
    sections: [
      {
        h2: 'Ce que Google appelle un déplacement de site',
        paras: [
          'Pour Google, un passage de http à https est un déplacement de site avec changement d’adresses, au même titre qu’un changement de domaine [1]. La méthode est donc commune : établir la correspondance entre anciennes et nouvelles adresses, rediriger, mettre à jour les liens, surveiller. La différence tient à l’outil de changement d’adresse de la Search Console, qui sert pour un changement de domaine mais pas pour un passage en https [1][2].',
          'Google prévient qu’un classement peut fluctuer pendant un déplacement, et que pour un site de taille moyenne il peut s’écouler quelques semaines ou plus avant que les nouvelles adresses remplacent complètement les anciennes ; les grands sites prennent plus de temps [1]. Prévoyez l’opération en dehors de votre haute saison.',
        ],
      },
      {
        h2: 'Étape 1 : préparer la table de correspondance',
        paras: [
          'Google insiste sur l’importance d’établir une correspondance entre les adresses de l’ancien site et celles du nouveau [1]. Pour un changement de domaine sans refonte, c’est simple : chaque adresse garde son chemin, seul le domaine change. Pour un passage en https, seul le protocole change.',
        ],
        list: [
          'Exportez la liste complète des adresses de l’ancien site : sitemap, export de la Search Console, outil d’exploration.',
          'Ajoutez les adresses qui reçoivent des liens externes ou du trafic, même si elles ne sont plus dans le menu.',
          'Pour chaque adresse, notez la nouvelle adresse équivalente. Une adresse sans équivalent redirige vers la page la plus proche, pas vers l’accueil.',
          'Conservez deux sitemaps : l’ancien et le nouveau. Google recommande de soumettre les deux pendant la surveillance, puis de ne garder que le nouveau une fois la migration stabilisée [1].',
        ],
      },
      {
        h2: 'Étape 2 : avant la bascule',
        list: [
          'Validez dans la Search Console toutes les variantes des deux sites, y compris avec et sans www [1]. L’outil de changement d’adresse ne fonctionne qu’entre propriétés que vous possédez avec le même compte Google, au niveau du domaine [2].',
          'Pour un passage en https : installez un certificat valide pour toutes les variantes, et vérifiez que toutes les ressources (images, scripts, feuilles de style) se chargent en https, sinon le navigateur signalera du contenu mixte. Notre outil [HTTPS et contenu mixte](/outils/https-contenu-mixte) liste les ressources encore appelées en http.',
          'Préparez les balises canoniques : chaque page du nouveau site doit avoir une canonique qui pointe vers elle-même ; les annotations hreflang doivent utiliser les nouvelles adresses [1].',
          'Mettez à jour les liens internes pour qu’ils pointent directement vers les nouvelles adresses, à partir de votre table [1].',
        ],
      },
      {
        h2: 'Étape 3 : la bascule et les redirections 301',
        paras: [
          'Le jour J, mettez en place des redirections permanentes (301) côté serveur, de chaque ancienne adresse vers la nouvelle, en évitant les chaînes de redirections [1]. Une chaîne typique à éviter : http://bureau-morin.fr/page vers https://bureau-morin.fr/page puis vers https://morin-geo.fr/page. Chaque ancienne variante doit mener directement à l’adresse finale.',
          'Testez un échantillon d’anciennes adresses avec notre outil [Vérificateur de redirections](/outils/redirections) : il affiche chaque étape, le code renvoyé et la page d’arrivée. Contrôlez aussi les en-têtes de quelques pages avec le [Vérificateur d’en-têtes HTTP](/outils/en-tetes-http), pour vous assurer qu’aucune réponse ne renvoie une erreur ou un noindex inattendu.',
        ],
      },
      {
        h2: 'Étape 4 : l’outil de changement d’adresse (changement de domaine seulement)',
        paras: [
          'Une fois les redirections en place, utilisez dans la Search Console l’outil de changement d’adresse, depuis la propriété de l’ancien domaine. Google indique qu’il faut d’abord rediriger en 301 la page d’accueil et les pages canoniques de l’ancien site [2]. L’outil demande à Google de concentrer l’exploration et l’indexation sur le nouveau site, transfère les signaux de l’ancien vers le nouveau et lui demande de préférer les adresses canoniques du nouveau site ; ces effets durent 180 jours à partir du début de la migration [2].',
        ],
        list: [
          'L’outil ne migre aucun sous-domaine, y compris www : chaque variante doit être traitée séparément, et Google demande, pour un changement de domaine, une demande pour chaque variante validée [1][2].',
          'L’ancien site reste dans l’index un certain temps : les redirections et les canoniques aident à réduire les anciennes adresses dans les résultats [2].',
          'Pour un simple passage de http à https, n’utilisez pas cet outil : Google détecte ce changement automatiquement [2].',
        ],
      },
      {
        h2: 'Étape 5 : combien de temps garder les redirections et l’ancien domaine',
        paras: [
          'C’est l’erreur la plus coûteuse : supprimer les redirections trop tôt, ou laisser expirer l’ancien domaine. Google recommande de conserver les redirections au moins 180 jours, et plus longtemps si des utilisateurs arrivent encore sur l’ancien site depuis la recherche [2] ; sa documentation sur les déplacements de site conseille de les garder au moins un an, et aussi longtemps que possible [1]. Google recommande aussi de continuer à payer l’ancien domaine pendant au moins un an, pour éviter que quelqu’un d’autre l’enregistre à des fins malveillantes [2].',
          'Pour Bureau Morin, la décision est simple : l’ancien domaine est renouvelé pour plusieurs années, et les redirections restent en place sans date de fin. Le coût est de quelques euros par an ; les liens accumulés depuis quinze ans sur des sites de mairies, de notaires et d’annuaires continuent ainsi de mener au bon endroit.',
        ],
      },
      {
        h2: 'Étape 6 : surveiller pendant trois mois',
        list: [
          'Dans la Search Console du nouveau site : progression du nombre de pages indexées, erreurs d’exploration, rapport Performances.',
          'Dans celle de l’ancien site : baisse progressive des pages indexées, ce qui est normal.',
          'Dans vos statistiques : trafic total, pages d’arrivée, pages en erreur 404.',
          'Hors du site : mettez à jour l’adresse sur la fiche Google, les annuaires, les réseaux sociaux, les signatures d’e-mail, et demandez aux partenaires principaux de mettre à jour leurs liens.',
        ],
      },
      {
        h2: 'Exemple : le calendrier de Bureau Morin',
        list: [
          'J-30 : export des adresses (sitemap, Search Console, outil d’exploration), table de correspondance dans un tableur, achat et configuration de morin-geo.fr avec certificat https.',
          'J-15 : copie du site sur le nouveau domaine en préproduction, protégée par mot de passe ; mise à jour des liens internes et des canoniques ; vérification des variantes www et sans www.',
          'J-7 : validation des deux domaines et de leurs variantes dans la Search Console ; préparation des règles de redirection.',
          'Jour J (un mardi matin, hors période de forte activité) : mise en ligne, activation des redirections 301, tests sur cinquante anciennes adresses, envoi des deux sitemaps, demande de changement d’adresse pour chaque variante.',
          'J+1 à J+90 : suivi hebdomadaire de l’indexation et du trafic, correction des erreurs 404 signalées, mise à jour de la fiche Google, des annuaires et des signatures.',
          'Au-delà : redirections conservées sans date de fin, ancien domaine renouvelé.',
        ],
        after: [
          'Le calendrier est modeste parce que le site l’est : une quarantaine de pages. Pour une boutique de plusieurs milliers de produits, chaque étape demande plus de temps, et les tests doivent porter sur un échantillon représentatif de chaque type de page. Notre guide [Audit SEO en 30 minutes](/guides/audit-seo-30-minutes) propose une vérification rapide à refaire une semaine après la bascule.',
        ],
      },
      {
        h2: 'Cas particulier : passer seulement en https',
        paras: [
          'Si vous gardez le même domaine et passez simplement en https, l’opération est plus légère, mais les étapes restent les mêmes : certificat valide pour toutes les variantes, redirections 301 de chaque adresse http vers son équivalent https, liens internes et canoniques mis à jour, sitemap en https, propriété https suivie dans la Search Console. Pas d’outil de changement d’adresse : Google détecte ce changement automatiquement [2].',
          'Vérifiez aussi les éléments qui pointent encore en http sans que vous le voyiez : images insérées dans d’anciens articles, scripts de partenaires, balises hreflang si votre site a plusieurs langues (voir [SEO international et hreflang](/guides/seo-international-hreflang)), liens dans les e-mails automatiques. La [Search Console](/guides/search-console-debutants) signalera ensuite les pages qui posent problème.',
        ],
      },
      {
        h2: 'Pourquoi passer en https, si ce n’est pas déjà fait',
        paras: [
          'Google a annoncé en août 2014 qu’il commençait à utiliser le https comme signal de classement [3]. Aujourd’hui, l’enjeu est surtout ailleurs : les navigateurs signalent les pages http comme non sécurisées, les formulaires y inquiètent les visiteurs, et de nombreuses fonctions modernes du web exigent le https. Un site encore en http en 2026 envoie un mauvais signal de fiabilité, quelle que soit la qualité de son contenu. Notre guide [E-E-A-T pour une petite entreprise](/guides/eeat-petite-entreprise) explique pourquoi la fiabilité est le cœur du sujet.',
        ],
      },
      {
        h2: 'Les erreurs les plus fréquentes',
        list: [
          'Rediriger toutes les anciennes adresses vers la page d’accueil du nouveau site.',
          'Laisser des chaînes de redirections (http → https → nouveau domaine).',
          'Oublier la variante www ou sans www, ou un sous-domaine (blog., boutique.) [2].',
          'Garder dans les pages des liens internes vers l’ancien domaine, qui passent par une redirection à chaque clic.',
          'Supprimer les redirections au bout de quelques semaines, ou laisser expirer l’ancien domaine.',
          'Faire en même temps changement de domaine, refonte graphique et réécriture des adresses : si le trafic baisse, impossible de savoir pourquoi.',
          'Ne pas prévenir l’équipe commerciale et le support : les clients qui appellent pour signaler « un site qui a changé » doivent recevoir une réponse claire.',
        ],
      },
    ],
    faq: [
      { q: 'Combien de temps dure une migration ?', a: 'Google indique que pour un site de taille moyenne, il peut s’écouler quelques semaines ou plus avant que les nouvelles adresses remplacent les anciennes ; les grands sites prennent plus de temps.' },
      { q: 'Faut-il utiliser l’outil de changement d’adresse pour passer en https ?', a: 'Non. Google précise que ce n’est pas nécessaire pour un passage de http à https, qu’il détecte automatiquement. L’outil sert aux changements de domaine.' },
      { q: 'Faut-il prévenir Google d’une migration avant de la faire ?', a: 'Non. On prépare tout en amont (variantes validées, table de correspondance, redirections prêtes), puis on bascule et on déclare le changement d’adresse dans la Search Console une fois les redirections actives.' },
      { q: 'Et les liens de mes campagnes publicitaires et e-mails ?', a: 'Mettez-les à jour vers les nouvelles adresses dès la bascule. Les redirections fonctionnent, mais chaque étape supplémentaire ralentit la page et complique la mesure.' },
      { q: 'Le trafic va-t-il baisser pendant la migration ?', a: 'Google prévient que le classement peut fluctuer pendant un déplacement de site. Une baisse temporaire est possible même quand tout est bien fait ; une baisse durable signale en général des redirections manquantes ou erronées.' },
      { q: 'Peut-on revendre l’ancien domaine après la migration ?', a: 'Google recommande de le conserver au moins un an. En pratique, le garder plus longtemps protège les liens anciens et évite qu’un tiers l’utilise de façon malveillante.' },
    ],
    sources: [
      { label: 'Google Search Central, déplacer un site avec changement d’URL', url: 'https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes', note: `mise à jour du 11 sept. 2026 ; ${VU}` },
      { label: 'Aide Search Console, outil de changement d’adresse (180 jours, conservation du domaine, cas non valides)', url: 'https://support.google.com/webmasters/answer/9370220?hl=fr', note: VU },
      { label: 'Google Search Central Blog, HTTPS as a ranking signal', url: 'https://developers.google.com/search/blog/2014/08/https-as-ranking-signal', note: `août 2014 ; ${VU}` },
    ],
    cta: { text: 'Après la bascule, testez vos anciennes adresses : nombre d’étapes, code renvoyé et page d’arrivée.', href: '/outils/redirections', label: 'Tester mes redirections' },
    related: ['refonte-site-sans-perdre-seo', 'search-console-debutants', 'seo-international-hreflang', 'audit-seo-30-minutes'],
  },

  /* ------------------------------------------------------------------ */
  /* Accessibilité et SEO                                                 */
  /* ------------------------------------------------------------------ */
  {
    slug: 'accessibilite-et-seo',
    seoTitle: 'Accessibilité et SEO : ce qui sert aux deux, et la loi',
    title: 'Accessibilité et SEO : ce qui sert aux deux, et la loi',
    description:
      'Textes alternatifs, titres, liens, formulaires : les gestes d’accessibilité qui aident aussi Google et les IA, et les obligations légales depuis 2025.',
    updated: D,
    published: D,
    intro: [
      'L’accessibilité numérique consiste à rendre un site utilisable par tous, y compris les personnes aveugles qui naviguent avec un lecteur d’écran, celles qui ne peuvent pas utiliser une souris, ou celles qui voient mal les contrastes faibles. Elle recoupe largement le référencement : un moteur de recherche, comme un lecteur d’écran, lit le code d’une page sans voir sa mise en forme. Et depuis juin 2025, pour une partie des entreprises, elle est aussi une obligation légale.',
      'Ce guide présente les gestes qui servent à la fois l’accessibilité, Google et les assistants d’IA, puis le cadre légal applicable aux services en ligne, notamment au commerce électronique. Il ne remplace pas un audit d’accessibilité complet ni un conseil juridique. L’exemple est fictif : Papeterie Lucas, boutique en ligne de fournitures de bureau de quinze salariés.',
    ],
    sections: [
      {
        h2: 'Pourquoi les deux se recoupent',
        paras: [
          'Un robot d’exploration et un lecteur d’écran ont un point commun : ils ne voient pas la page, ils la lisent. Ils s’appuient sur la structure du code (titres, listes, liens, textes alternatifs, libellés de formulaires) pour comprendre ce qu’elle contient et comment elle s’organise. Ce qui rend une page compréhensible pour l’un la rend généralement compréhensible pour l’autre.',
          'Google le dit explicitement pour les images : il utilise le texte alternatif avec ses algorithmes de vision et le contenu de la page pour comprendre le sujet d’une image, et ce texte améliore l’accessibilité pour les personnes qui ne peuvent pas voir les images [3]. OpenAI indique de son côté que son navigateur ChatGPT Atlas s’appuie sur les rôles et libellés ARIA pour interpréter la structure des pages, et recommande des attributs ARIA descriptifs sur les éléments interactifs [4]. Les agents d’IA qui remplissent des formulaires ou cliquent sur des boutons ont donc les mêmes besoins qu’un utilisateur de lecteur d’écran.',
        ],
      },
      {
        h2: 'Les gestes qui servent aux deux',
        list: [
          'Textes alternatifs : décrivez les images qui portent une information (« Carnet A5 à couverture en lin bleu, 96 pages lignées »), laissez un texte alternatif vide pour les images purement décoratives, et évitez d’y entasser des mots-clés : Google déconseille de remplir les attributs alt de mots-clés, ce qui nuit à l’expérience et peut être considéré comme du spam [3].',
          'Titres hiérarchisés : un seul titre principal (h1) par page, puis des intertitres (h2, h3) dans l’ordre. Les lecteurs d’écran permettent de naviguer de titre en titre ; les moteurs comprennent mieux l’organisation du contenu.',
          'Liens explicites : « Voir les conditions de livraison » plutôt que « Cliquez ici ». Un lien doit se comprendre hors contexte, ce qui aide aussi les moteurs à comprendre la page de destination.',
          'Formulaires : chaque champ a un libellé associé (pas seulement un texte d’exemple qui disparaît à la saisie), les erreurs sont expliquées en texte.',
          'Boutons : de vrais boutons HTML, avec un intitulé qui dit l’action (« Ajouter au panier »), pas des blocs cliquables sans nom.',
          'Langue de la page déclarée dans le code, et texte réel plutôt qu’images de texte.',
          'Vidéos sous-titrées et transcrites (voir notre guide [Vidéo et YouTube](/guides/video-youtube-ia)).',
        ],
        after: [
          'Nos outils [Images et textes alternatifs](/outils/textes-alternatifs) et [Structure des titres H1 à H6](/outils/structure-titres) contrôlent les deux premiers points sur une page ; l’[Analyseur de liens d’une page](/outils/analyse-liens) liste les textes de liens et repère les « cliquez ici » et les liens vides ; l’outil [Rendu sans JavaScript](/outils/rendu-sans-javascript) montre si le texte et les liens existent dans le HTML, ce qui conditionne aussi leur lecture par de nombreux robots.',
        ],
      },
      {
        h2: 'Ce que l’accessibilité demande en plus',
        paras: [
          'Tout ne se recoupe pas. Certains critères d’accessibilité n’ont pas d’effet connu sur le référencement, mais restent indispensables pour les utilisateurs :',
        ],
        list: [
          'des contrastes suffisants entre le texte et le fond ;',
          'une navigation possible entièrement au clavier, avec un indicateur de focus visible ;',
          'des zones cliquables assez grandes sur mobile ;',
          'pas d’information transmise uniquement par la couleur (« les champs en rouge sont obligatoires ») ;',
          'des animations qui peuvent être mises en pause, et pas de clignotements.',
        ],
        after: [
          'La référence technique internationale est le référentiel WCAG du W3C, dont la version 2.2 est devenue une recommandation officielle du W3C le 5 octobre 2023 [5].',
        ],
      },
      {
        h2: 'Le cadre légal depuis le 28 juin 2025',
        paras: [
          'La directive européenne 2019/882 sur les exigences d’accessibilité des produits et services, transposée en France notamment par le décret n° 2023-931 du 9 octobre 2023, s’applique depuis le 28 juin 2025, avec des périodes de transition pouvant aller jusqu’au 28 juin 2030 pour certains produits et services [1]. Le commerce électronique fait partie des services concernés [1].',
        ],
        list: [
          'Les prestataires de services concernés doivent concevoir et fournir leurs services conformément aux exigences d’accessibilité, publier des informations expliquant comment leurs services y satisfont, maintenir des procédures pour rester conformes, et prendre des mesures correctives en cas de non-conformité [2].',
          'Les dispositions s’appliquent aux services fournis après le 28 juin 2025, selon les modalités transitoires prévues par la loi n° 2023-171 du 9 mars 2023 [2].',
          'Les microentreprises prestataires de services, c’est-à-dire celles qui emploient moins de 10 personnes et dont le chiffre d’affaires ou le bilan ne dépasse pas 2 millions d’euros, n’ont aucune obligation d’accessibilité au titre de ce texte [1].',
          'La DGCCRF est l’autorité compétente pour contrôler les produits et services concernés ; un manquement constitue une contravention de cinquième classe [1].',
        ],
        after: [
          'Papeterie Lucas, avec ses quinze salariés, n’entre pas dans l’exemption des microentreprises : sa boutique en ligne est concernée. Une boutique de trois personnes qui réalise 400 000 € de chiffre d’affaires, elle, est exemptée au titre de ce texte, ce qui ne l’empêche pas de rendre son site accessible à ses clients. Le périmètre exact dépend de votre activité : vérifiez votre situation avec un juriste ou sur les fiches de la DGCCRF.',
        ],
      },
      {
        h2: 'Une organisation qui tient dans le temps',
        paras: [
          'L’accessibilité se dégrade vite si elle n’est pas intégrée aux habitudes : un nouveau produit mis en ligne sans texte alternatif, une bannière promotionnelle en image avec du texte incrusté, un nouveau formulaire sans libellés. Quelques règles simples évitent de retomber dans les travers corrigés :',
        ],
        list: [
          'une liste de contrôle courte pour toute nouvelle page ou fiche produit (texte alternatif, titres, liens, contrastes) ;',
          'une personne désignée qui vérifie au clavier chaque nouveau parcours (inscription, paiement, contact) avant sa mise en ligne ;',
          'une clause dans les contrats avec vos prestataires web qui fixe le niveau d’accessibilité attendu ;',
          'un moyen simple pour les visiteurs de signaler une difficulté, et une réponse rapide quand ils le font.',
        ],
      },
      {
        h2: 'Par où commencer',
        list: [
          'Testez votre parcours d’achat au clavier seul : arrivez-vous à choisir un produit, l’ajouter au panier et payer sans souris ?',
          'Activez le lecteur d’écran de votre ordinateur ou de votre téléphone (il est intégré aux systèmes courants) et écoutez votre page d’accueil et une fiche produit.',
          'Vérifiez les textes alternatifs de vos images produits et les libellés de vos formulaires.',
          'Corrigez les contrastes trop faibles, souvent dans les textes gris clair et les boutons.',
          'Rédigez la déclaration d’information sur l’accessibilité de votre service, si vous êtes concerné.',
          'Pour une boutique concernée par la loi, faites réaliser un audit par un spécialiste : les contrôles automatiques ne détectent qu’une partie des problèmes.',
        ],
      },
      {
        h2: 'Exemple : la fiche produit de Papeterie Lucas, avant et après',
        paras: [
          'Avant : une photo sans texte alternatif, le nom du produit en image, un sélecteur de couleur fait de pastilles colorées sans nom, un bouton « + » sans intitulé, des avis chargés uniquement par un script. Un lecteur d’écran annonce « image, bouton, bouton, bouton ». Un robot d’IA qui lit le HTML ne voit ni le nom du produit, ni ses couleurs.',
          'Après : un texte alternatif descriptif, le nom du produit en texte dans un titre h1, des couleurs nommées (« Bleu nuit », « Vert sauge »), un bouton « Ajouter au panier » explicite, les caractéristiques dans une liste, les avis présents dans le HTML. La page est utilisable au lecteur d’écran, et elle est lisible par Google et les assistants. Notre guide [Fiche produit et IA](/guides/fiche-produit-et-ia) détaille la partie e-commerce.',
        ],
      },
      {
        h2: 'Accessibilité, mobile et vitesse',
        paras: [
          'Une page lente ou instable gêne tout le monde, et davantage encore les personnes qui naviguent avec une aide technique, une connexion faible ou un appareil ancien. Les éléments qui bougent pendant le chargement font perdre le fil à un utilisateur de loupe d’écran comme à n’importe qui ; des boutons trop petits sur mobile pénalisent les personnes qui ont des difficultés motrices.',
          'Ces sujets rejoignent les mesures de vitesse et de stabilité que Google observe chez les vrais visiteurs, détaillées dans notre guide [Core Web Vitals sans jargon](/guides/core-web-vitals-sans-jargon). Des images bien dimensionnées et compressées, décrites par un texte alternatif utile, servent à la fois la vitesse, l’accessibilité et la recherche d’images : notre guide [Images et SEO](/guides/seo-images) donne la méthode.',
        ],
      },
      {
        h2: 'Ce qui ne marche pas',
        list: [
          'Les « surcouches » d’accessibilité vendues comme une mise en conformité en une ligne de code : elles ne corrigent pas la structure de la page, et ne remplacent pas un travail sur le site lui-même.',
          'Les textes alternatifs générés en masse sans relecture, qui décrivent mal le produit.',
          'Les titres choisis pour leur taille visuelle plutôt que pour leur rôle (un h3 parce qu’il « fait plus joli »).',
          'Le contenu caché aux lecteurs d’écran mais visible aux yeux, ou l’inverse.',
        ],
        after: [
          'Pour une vue d’ensemble technique de votre site, notre guide [Audit SEO en 30 minutes](/guides/audit-seo-30-minutes) donne une méthode rapide, dont plusieurs contrôles recoupent l’accessibilité.',
        ],
      },
    ],
    faq: [
      { q: 'Mon petit site vitrine est-il soumis à l’obligation d’accessibilité ?', a: 'Les obligations issues de la directive de 2019 visent certains produits et services, dont le commerce électronique, et exemptent les microentreprises prestataires de services (moins de 10 personnes et 2 millions d’euros de chiffre d’affaires ou de bilan au plus). Vérifiez votre situation exacte avec un juriste.' },
      { q: 'L’accessibilité améliore-t-elle le classement Google ?', a: 'Google ne présente pas l’accessibilité comme un facteur de classement en tant que tel. Mais plusieurs gestes d’accessibilité (textes alternatifs, titres, liens explicites, texte réel) aident directement Google à comprendre vos pages.' },
      { q: 'Les textes alternatifs générés par IA sont-ils acceptables ?', a: 'Ils peuvent servir de premier jet, à condition d’être relus : une IA décrit souvent l’apparence générale d’une image sans l’information utile (référence, couleur exacte, contenu d’un schéma). Un texte alternatif faux est pire qu’un texte absent.' },
      { q: 'Les PDF sont-ils concernés ?', a: 'Un document mis à disposition des clients (catalogue, notice, conditions) fait partie de ce qu’ils doivent pouvoir lire. Un PDF scanné, sans texte, n’est ni accessible ni lisible par les moteurs ; préférez une page HTML ou un PDF balisé.' },
      { q: 'Faut-il publier une déclaration d’accessibilité ?', a: 'Les prestataires de services concernés doivent rendre publiques des informations expliquant comment leurs services satisfont aux exigences d’accessibilité. Une page dédiée, reliée depuis le pied de page, est la façon la plus simple de le faire.' },
      { q: 'Un outil automatique suffit-il à vérifier l’accessibilité ?', a: 'Non. Il repère une partie des problèmes (contrastes, textes alternatifs manquants), mais pas la logique d’un parcours au clavier ou la pertinence d’un texte alternatif. Un test manuel reste nécessaire.' },
    ],
    sources: [
      { label: 'DGCCRF, fiche professionnels : vos produits et services doivent être conformes à la directive accessibilité', url: 'https://handicap.gouv.fr/sites/handicap/files/2025-07/Fiche-conso-DGCCRF.pdf', note: `juillet 2025 ; ${VU}` },
      { label: 'Légifrance, article D. 412-57 du Code de la consommation (obligations des prestataires de services)', url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048180389', note: VU },
      { label: 'Google Search Central, bonnes pratiques de référencement des images (texte alternatif)', url: 'https://developers.google.com/search/docs/appearance/google-images', note: `mise à jour du 2 mars 2026 ; ${VU}` },
      { label: 'Centre d’aide OpenAI, Publishers and Developers FAQ (ChatGPT Atlas et ARIA)', url: 'https://help.openai.com/en/articles/12627856-publishers-and-developers-faq', note: VU },
      { label: 'W3C, WCAG 2.2 devient une recommandation du W3C', url: 'https://www.w3.org/WAI/news/2023-10-05/wcag22rec', note: `5 oct. 2023 ; ${VU}` },
    ],
    cta: { text: 'Vos liens ont-ils des textes explicites, et votre texte existe-t-il dans le HTML ? Commencez par l’analyse des liens d’une page.', href: '/outils/analyse-liens', label: 'Analyser une page' },
    related: ['seo-images', 'fiche-produit-et-ia', 'core-web-vitals-sans-jargon', 'audit-seo-30-minutes'],
  },
  /* ------------------------------------------------------------------ */
  /* RGPD et mesure d’audience                                            */
  /* ------------------------------------------------------------------ */
  {
    slug: 'rgpd-mesure-audience-cnil',
    seoTitle: 'Mesure d’audience et RGPD : l’exemption CNIL expliquée',
    title: 'Mesure d’audience et RGPD : ce que permet l’exemption CNIL',
    description:
      'Quand un outil de statistiques peut se passer de consentement selon la CNIL, pourquoi Google Analytics demande un bandeau, et comment mesurer sans tout perdre.',
    updated: D,
    published: D,
    intro: [
      'Mesurer la fréquentation de son site est indispensable pour savoir ce qui fonctionne, y compris le trafic venu des moteurs et des assistants d’IA. Mais en France, déposer un cookie ou un autre traceur sur l’appareil d’un visiteur demande en principe son consentement. Résultat : beaucoup de sites affichent un bandeau, une partie des visiteurs refusent, et les statistiques deviennent incomplètes.',
      'La CNIL prévoit une exemption pour certains outils de mesure d’audience, à des conditions précises. Ce guide les explique, dit ce qu’elles impliquent pour les outils courants, et propose une organisation réaliste pour une PME. Il ne remplace pas un conseil juridique adapté à votre situation. L’exemple est fictif : Atelier Céramique Brun, boutique en ligne de vaisselle artisanale.',
    ],
    sections: [
      {
        h2: 'Le principe : consentement, sauf exception',
        paras: [
          'Les traceurs déposés sur l’appareil d’un internaute (cookies, identifiants, empreintes) nécessitent en principe son consentement préalable. L’exemption vise les traceurs strictement nécessaires au service demandé par l’utilisateur ; la CNIL y range, sous conditions, certains traceurs de mesure d’audience [2].',
          'Selon la CNIL, pour bénéficier de l’exemption, ces traceurs doivent avoir une finalité strictement limitée à la seule mesure de l’audience du site ou de l’application, pour le compte exclusif de l’éditeur ; servir uniquement à produire des données statistiques anonymes ; ne pas permettre le suivi global de la navigation de la personne sur différents sites ou applications ; et ne pas conduire à un recoupement des données avec d’autres traitements ni à leur transmission à des tiers [1][2].',
        ],
      },
      {
        h2: 'Les conditions, une par une',
        paras: ['La page de la CNIL consacrée aux solutions de mesure d’audience, datée du 4 juillet 2025, détaille ce qui est attendu [1] :'],
        list: [
          'Finalité : mesurer l’audience (performances du site, problèmes de navigation, optimisation technique ou ergonomique, estimation de la capacité des serveurs, analyse des contenus consultés), uniquement pour le compte de l’éditeur [1].',
          'Données : uniquement des statistiques anonymes [1].',
          'Information : les personnes doivent être informées de l’utilisation de ces traceurs, par exemple dans la politique de confidentialité [1].',
          'Durée de vie des traceurs : la CNIL recommande 13 mois au plus, sans prorogation automatique lors de nouvelles visites [1].',
          'Conservation des informations collectées : la CNIL recommande 25 mois au plus [1].',
          'Revue périodique de ces durées [1].',
          'Interdits : le recoupement avec d’autres traitements, la transmission de données non anonymes à des tiers, et le suivi global d’une personne sur plusieurs sites ou applications, y compris par un identifiant commun pour mesurer une audience unifiée [1].',
        ],
        after: [
          'Ces conditions sont cumulatives. Il suffit qu’une seule manque pour que le consentement redevienne nécessaire.',
        ],
      },
      {
        h2: 'Et Google Analytics ?',
        paras: [
          'Dans sa page de 2020 sur la mesure de fréquentation, la CNIL cite Google Analytics, parmi d’autres offres, comme exemple de solution qui sort de l’exemption lorsque le fournisseur réutilise les données pour son propre compte, et rappelle qu’il faut, pour en bénéficier, un engagement contractuel du fournisseur à ne pas réutiliser les données collectées [2]. Sa page de 2025 ajoute que certaines offres du marché réutilisent les données pour les finalités propres du fournisseur, ce qui les exclut de l’exemption, et que certaines peuvent être configurées pour désactiver cette réutilisation [1].',
          'En pratique, la plupart des sites qui utilisent Google Analytics 4 dans sa configuration habituelle le soumettent donc au consentement, via leur bandeau. C’est une solution légitime ; elle implique simplement que les visiteurs qui refusent ne sont pas mesurés par cet outil. Si vous voulez savoir précisément si votre configuration peut entrer dans l’exemption, la CNIL propose aux éditeurs d’outils un outil d’autoévaluation et une documentation type à remettre à leurs clients [1] : demandez-la à votre fournisseur.',
          'Il reste la question des transferts hors de l’Union européenne, que la CNIL invite à vérifier auprès de son fournisseur [1]. Depuis la décision d’adéquation adoptée par la Commission européenne le 10 juillet 2023, des données personnelles peuvent être transférées vers les entreprises américaines qui participent au cadre de protection des données UE–États-Unis, sans garanties supplémentaires [4]. Ce cadre ne concerne que les entreprises participantes, et il ne règle pas la question du consentement aux traceurs : ce sont deux sujets distincts.',
        ],
      },
      {
        h2: 'Les outils qui peuvent être configurés pour l’exemption',
        paras: [
          'Plusieurs éditeurs d’outils de mesure ont publié, sur le site de la CNIL, des guides de configuration pour un mode exempté. Celui de Matomo, par exemple, décrit les réglages à respecter : anonymisation des adresses IP (par défaut, suppression des deux derniers octets des adresses IPv4 et localisation limitée à la ville), absence d’identifiant utilisateur, désactivation des cartes de chaleur et des enregistrements de session, pas de cookies tiers ni de suivi entre domaines, pas de mesure e-commerce, désactivation du journal des visites et des profils de visiteurs, et un moyen pour les visiteurs de s’opposer au suivi [3].',
          'Ce dernier exemple montre ce que l’exemption coûte : on renonce aux fonctions qui permettraient de suivre un individu (profils, enregistrements de session, suivi des ventes au niveau du visiteur). On garde l’essentiel pour piloter un site : pages vues, sources de trafic, pages d’entrée et de sortie, appareils, tendances.',
        ],
      },
      {
        h2: 'Une organisation réaliste pour une PME',
        paras: ['Atelier Céramique Brun a besoin de deux choses : piloter son site au quotidien, et mesurer finement ses campagnes et ses ventes. Elle s’organise en deux couches :'],
        list: [
          'Un outil de mesure d’audience configuré pour l’exemption, actif pour tous les visiteurs, sans bandeau pour lui : il donne une vision complète et comparable dans le temps du trafic, des pages et des sources, dont les visites venues des moteurs et des assistants d’IA.',
          'Un outil plus riche (Google Analytics 4, outils publicitaires) soumis au consentement via le bandeau, pour l’analyse des conversions et des campagnes, en sachant que ses chiffres ne couvrent que les visiteurs qui ont accepté.',
          'Une politique de confidentialité qui décrit les deux, leurs finalités, leurs durées et le moyen de s’opposer à la mesure exemptée.',
        ],
        after: [
          'Ce choix n’est pas obligatoire, et chaque outil supplémentaire est une charge. Mais il évite le piège le plus courant : piloter un site avec un outil qui ne voit qu’une partie, variable, des visiteurs.',
        ],
      },
      {
        h2: 'Ce que la Search Console apporte, sans cookie',
        paras: [
          'Pour le référencement, une partie importante des données ne dépend d’aucun traceur sur votre site. La Search Console de Google donne les requêtes, impressions, clics et positions de vos pages dans la recherche Google, à partir des données de Google lui-même ; Bing Webmaster Tools fait de même pour Bing. Ces outils ne remplacent pas une mesure d’audience, mais ils ne sont pas affectés par les refus de cookies. Notre guide [La Search Console pour débutants](/guides/search-console-debutants) explique comment les lire.',
          'Pour le trafic venu des assistants d’IA, la mesure d’audience reste nécessaire. Notre guide [Mesurer le trafic venu de ChatGPT dans GA4](/guides/trafic-chatgpt-ga4) détaille la méthode dans GA4 ; elle se transpose à un outil exempté, qui enregistre aussi les sites de provenance.',
        ],
      },
      {
        h2: 'Vérifier ce que dépose réellement votre site',
        paras: [
          'Beaucoup de sites déposent des traceurs sans que leur propriétaire le sache : un module de chat, une vidéo intégrée, un bouton de partage, une police chargée depuis un service tiers, un pixel publicitaire ajouté par un prestataire. Avant de décider quoi soumettre au consentement, faites l’inventaire.',
        ],
        list: [
          'Ouvrez votre site en navigation privée, sans rien accepter, et regardez les cookies et le stockage local dans les outils de développement du navigateur.',
          'Regardez les en-têtes de la page : notre [Vérificateur d’en-têtes HTTP](/outils/en-tetes-http) affiche notamment les cookies déposés par le serveur.',
          'Listez chaque service tiers chargé par la page, sa finalité et son fournisseur.',
          'Supprimez ce qui ne sert plus : un pixel d’une campagne terminée depuis deux ans n’a rien à faire sur le site.',
        ],
      },
      {
        h2: 'Lire des chiffres qui ne se ressemblent pas',
        paras: [
          'Avec deux outils, les chiffres diffèrent toujours, et c’est normal. L’outil exempté voit tous les visiteurs, l’outil soumis au consentement ne voit que ceux qui ont accepté ; leurs méthodes de comptage (sessions, visiteurs, durée) ne sont pas les mêmes. Atelier Céramique Brun constate par exemple que son outil soumis au consentement compte nettement moins de visites que son outil exempté. Ce n’est pas une erreur : c’est la part des visiteurs qui ont refusé ou ignoré le bandeau, plus les différences de méthode.',
          'La règle pratique : choisir un outil de référence pour chaque question. L’outil exempté pour le volume de trafic, les pages et les sources dans le temps ; l’outil soumis au consentement pour les taux de conversion et les campagnes, en raisonnant en tendances plutôt qu’en valeurs absolues. Et ne jamais additionner les deux.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Déclarer un outil « exempté » sans avoir vérifié sa configuration, ni obtenu l’engagement du fournisseur de ne pas réutiliser les données.',
          'Activer dans un outil exempté une fonction qui le fait sortir de l’exemption (identifiant utilisateur, enregistrement de session, partage de données avec un tiers).',
          'Garder des données indéfiniment, au-delà des durées recommandées.',
          'Un bandeau qui rend le refus plus difficile que l’acceptation, ou qui dépose des traceurs avant le choix.',
          'Oublier d’informer les visiteurs de la mesure exemptée dans la politique de confidentialité.',
        ],
      },
      {
        h2: 'Une liste de contrôle',
        list: [
          'Inventaire des traceurs réalisé et daté.',
          'Pour chaque outil de mesure : exempté ou soumis au consentement, et pourquoi.',
          'Pour l’outil exempté : configuration vérifiée selon le guide de l’éditeur, durées de 13 et 25 mois respectées, engagement contractuel du fournisseur.',
          'Pour les outils soumis au consentement : rien ne se charge avant l’accord, refus aussi simple que l’acceptation.',
          'Politique de confidentialité à jour, avec le moyen de s’opposer à la mesure exemptée.',
          'Transferts hors UE vérifiés auprès de chaque fournisseur.',
        ],
        after: [
          'Pour le reste de votre site, notre [Audit SEO en 30 minutes](/guides/audit-seo-30-minutes) propose une vérification technique rapide, indépendante de ces questions.',
        ],
      },
    ],
    faq: [
      { q: 'Puis-je utiliser Google Analytics sans bandeau ?', a: 'Selon la CNIL, une solution dont le fournisseur réutilise les données pour son propre compte sort de l’exemption. Dans sa configuration habituelle, Google Analytics est donc en général soumis au consentement. Vérifiez votre configuration et votre contrat avec un juriste si vous envisagez autre chose.' },
      { q: 'Un outil exempté suffit-il pour mesurer le trafic venu des IA ?', a: 'Oui pour l’essentiel : il enregistre les sites de provenance, dont ceux des assistants. Il ne permet pas, en revanche, de suivre un visiteur individuel jusqu’à l’achat, ce qui relève d’un outil soumis au consentement.' },
      { q: 'La Search Console est-elle concernée par le consentement ?', a: 'Elle ne dépose rien sur l’appareil de vos visiteurs : ses données proviennent de la recherche Google. Elle n’entre donc pas dans votre bandeau de consentement.' },
      { q: 'Faut-il un bandeau si je n’utilise qu’un outil exempté ?', a: 'Pour cet outil seul, l’exemption dispense du consentement, mais pas de l’information : les visiteurs doivent être informés, par exemple dans la politique de confidentialité, et pouvoir s’opposer. Les autres traceurs éventuels (vidéos, chat, publicité) restent à examiner un par un.' },
      { q: 'Combien de temps garder les statistiques ?', a: 'Pour une mesure exemptée, la CNIL recommande de conserver les informations collectées 25 mois au plus, et de limiter la durée de vie des traceurs à 13 mois.' },
    ],
    sources: [
      { label: 'CNIL, cookies : solutions pour les outils de mesure d’audience (conditions de l’exemption)', url: 'https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience', note: `4 juill. 2025 ; ${VU}` },
      { label: 'CNIL, mesurer la fréquentation de vos sites web et de vos applications', url: 'https://www.cnil.fr/fr/mesurer-la-frequentation-de-vos-sites-web-et-de-vos-applications', note: `27 janv. 2020 ; ${VU}` },
      { label: 'Matomo, guide de configuration du mode exempté publié sur le site de la CNIL', url: 'https://www.cnil.fr/sites/cnil/files/2023-06/matomo_analytics_exemption_guide_de_configuration.pdf', note: `non daté ; ${VU}` },
      { label: 'Commission européenne, décision d’adéquation pour le cadre de protection des données UE–États-Unis (communiqué IP/23/3721)', url: 'https://ec.europa.eu/commission/presscorner/api/files/document/print/en/ip_23_3721/IP_23_3721_EN.pdf', note: `10 juill. 2023 ; ${VU}` },
    ],
    cta: { text: 'Voyez ce que votre serveur renvoie réellement, cookies compris, avec le vérificateur d’en-têtes gratuit.', href: '/outils/en-tetes-http', label: 'Vérifier mes en-têtes' },
    related: ['trafic-chatgpt-ga4', 'search-console-debutants', 'audit-seo-30-minutes', 'suivre-ses-questions-chatgpt'],
  },

  /* ------------------------------------------------------------------ */
  /* Pagination et filtres e-commerce                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'pagination-filtres-e-commerce',
    seoTitle: 'Pagination et filtres e-commerce : le guide SEO',
    title: 'Pagination et filtres e-commerce : ce que Google recommande',
    description:
      'Pages 2, 3, 4, bouton « Charger plus », filtres par taille ou couleur : organiser les catégories d’une boutique pour Google sans gaspiller l’exploration.',
    updated: D,
    published: D,
    intro: [
      'Une boutique en ligne de quelques centaines de produits peut générer des milliers, voire des millions d’adresses : chaque catégorie paginée, chaque combinaison de filtres (taille, couleur, prix, marque), chaque ordre de tri crée une adresse différente. Pour Google, c’est autant de pages à explorer, souvent presque identiques. Pour la boutique, c’est un risque : que les robots passent leur temps sur des variantes inutiles et peinent à atteindre les fiches produits.',
      'Ce guide suit les deux documentations de Google consacrées à la pagination et à la navigation à facettes, toutes deux mises à jour le 18 décembre 2025, et les applique à une boutique type. L’exemple est fictif : Sentiers & Cie, boutique de matériel de randonnée qui compte 1 200 produits et une vingtaine de catégories.',
    ],
    sections: [
      {
        h2: 'Deux sujets distincts : pagination et filtres',
        paras: [
          'La pagination découpe une longue liste en pages successives (catégorie « Sacs à dos », pages 1 à 6). Les filtres, ou facettes, restreignent la liste selon des critères (« Sacs à dos, 30 à 40 litres, femme, moins de 150 € »). Les deux créent des adresses supplémentaires, mais ils ne posent pas le même problème : les pages paginées servent à atteindre tous les produits, les combinaisons de filtres se multiplient presque sans limite.',
        ],
      },
      {
        h2: 'La pagination : ce que Google recommande',
        paras: ['La documentation de Google sur la pagination est claire sur plusieurs points [1] :'],
        list: [
          'Donnez à chaque page une adresse unique, par exemple avec un paramètre ?page=2 : Google traite chaque page paginée comme une page distincte [1].',
          'N’utilisez pas d’identifiant de fragment (#page2) pour les numéros de page : Google ignore ce qui suit le # et peut ne pas suivre un lien qui ne diffère que par là [1].',
          'Reliez chaque page à la suivante par un lien <a href> ordinaire, et pensez à relier chaque page à la première page de la série [1].',
          'Ne faites pas de la première page la page canonique de toute la série : chaque page paginée doit avoir sa propre adresse canonique [1].',
          'Les balises rel="prev" et rel="next" ne sont plus prises en compte par Google, même si d’autres moteurs peuvent encore s’en servir [1].',
        ],
        after: [
          'Pour Sentiers & Cie, la catégorie « Sacs à dos » a donc six adresses (/sacs-a-dos, puis /sacs-a-dos?page=2 à 6), chacune canonique vers elle-même, reliées par des liens numérotés et un lien « page suivante ». Notre outil [Analyseur de liens d’une page](/outils/analyse-liens) montre si ces liens existent bien dans le HTML.',
        ],
      },
      {
        h2: '« Charger plus » et défilement infini',
        paras: [
          'Google rappelle que les boutons « Charger plus » et le défilement infini sont généralement réalisés en JavaScript, et que son robot ne clique pas sur les boutons [1]. Si les produits suivants ne s’affichent qu’après un clic ou un défilement, Google risque de ne voir que les premiers.',
          'La solution : garder, derrière le bouton ou le défilement, des pages paginées accessibles par des liens explorables. Le visiteur profite du chargement continu ; le robot suit les liens vers ?page=2, ?page=3, etc. Testez votre catégorie avec notre outil [Rendu sans JavaScript](/outils/rendu-sans-javascript) : si les liens de pagination n’apparaissent pas dans le HTML, il faut les ajouter.',
        ],
      },
      {
        h2: 'Les filtres : le plus souvent, les écarter de l’exploration',
        paras: [
          'La documentation de Google sur la navigation à facettes part d’un constat : il n’y a souvent aucune bonne raison de laisser explorer les éléments filtrés, ce qui consomme des ressources serveur pour un bénéfice nul ou négligeable [2]. Google recommande de garder explorables une page de liste non filtrée et les fiches produits, et propose plusieurs moyens d’écarter les combinaisons de filtres [2] :',
        ],
        list: [
          'Interdire l’exploration des adresses filtrées dans robots.txt (par exemple les adresses qui contiennent ?couleur= ou ?prix=) [2]. Notre [Générateur de robots.txt](/outils/generateur-robots-txt) aide à écrire ces règles.',
          'Utiliser des identifiants de fragment pour les filtres : ils sont en général ignorés par Google, et n’ont donc aucun effet, positif ou négatif, sur l’exploration [2].',
          'Les balises canoniques et l’attribut nofollow sur les liens de filtres peuvent réduire l’exploration avec le temps, mais Google les juge en général moins efficaces à long terme ; un nofollow ne marche que si tous les liens vers l’adresse le portent [2].',
        ],
        after: [
          'La documentation sur la pagination ajoute une possibilité pour les variantes de liste (filtres, tris) : bloquer leur indexation avec une balise meta robots noindex, ou décourager leur exploration avec robots.txt [1]. Attention à ne pas combiner les deux sur la même adresse : un robot qui ne peut pas explorer une page ne voit pas son noindex.',
        ],
      },
      {
        h2: 'Quand un filtre mérite d’être indexé',
        paras: [
          'Certaines combinaisons correspondent à de vraies recherches : « sac à dos randonnée femme », « chaussures de randonnée imperméables ». Plutôt que de laisser indexer toutes les combinaisons, créez pour ces cas des pages de catégorie à part entière, avec une adresse propre, un titre, un texte d’introduction utile et des liens depuis le menu ou la catégorie parente. Sentiers & Cie crée ainsi « Sacs à dos femme » et « Chaussures imperméables », et laisse les autres combinaisons hors de l’exploration.',
          'Si vous laissez explorer des adresses filtrées, Google donne des règles pour limiter les dégâts [2] :',
        ],
        list: [
          'utiliser le caractère & comme séparateur de paramètres, que les robots reconnaissent ;',
          'garder un ordre constant des filtres dans les adresses et empêcher les filtres en double ;',
          'renvoyer un code HTTP 404 quand une combinaison de filtres ne donne aucun résultat [2].',
        ],
      },
      {
        h2: 'Les tris et les paramètres techniques',
        paras: [
          'Les ordres de tri (prix croissant, nouveautés, popularité) et les paramètres techniques (identifiants de session, paramètres de suivi de campagne) créent eux aussi des adresses en double. Ils n’apportent aucun contenu nouveau : traitez-les comme des variantes de liste, à écarter de l’exploration ou de l’indexation [1]. Les liens internes de la boutique doivent pointer vers l’adresse propre, sans paramètre de tri ni de suivi. Les paramètres de campagne ne servent qu’aux liens publiés à l’extérieur (e-mails, publicités, réseaux sociaux), jamais aux liens du menu ou des fiches.',
        ],
      },
      {
        h2: 'Vérifier ce que Google explore vraiment',
        list: [
          'Dans la Search Console, le rapport d’indexation des pages montre les adresses explorées mais non indexées : un grand nombre d’adresses avec des paramètres de filtres signale un problème.',
          'Le sitemap ne doit lister que les adresses que vous voulez voir indexées : catégories, pages de catégories ciblées, fiches produits. Vérifiez-le avec notre [Validateur de sitemap](/outils/validateur-sitemap).',
          'Testez une adresse filtrée avec notre [Testeur d’indexabilité](/outils/indexabilite) : est-elle bloquée par robots.txt, marquée noindex, ou dotée d’une canonique ? Le résultat doit correspondre à votre intention.',
          'Comparez deux pages de catégorie proches (« Sacs à dos » et « Sacs à dos femme ») avec l’outil [Contenu dupliqué entre deux pages](/outils/contenu-duplique) : si elles se ressemblent trop, la page ciblée manque de contenu propre.',
          'Si vous avez accès aux journaux du serveur, regardez la part des visites de Googlebot sur des adresses filtrées par rapport aux fiches produits. Si les premières dominent, la règle de robots.txt est à revoir.',
        ],
      },
      {
        h2: 'Avec Shopify, PrestaShop ou WooCommerce',
        paras: [
          'Chaque plateforme gère la pagination et les filtres à sa façon, souvent à travers le thème ou une application de filtres. Ne présumez pas que c’est bien fait : vérifiez les adresses générées, la présence de liens de pagination dans le HTML, les balises canoniques et le robots.txt. Nos guides [SEO Shopify](/guides/seo-shopify) et [SEO PrestaShop](/guides/seo-prestashop) détaillent les réglages propres à ces plateformes.',
        ],
      },
      {
        h2: 'Et pour les assistants d’IA ?',
        paras: [
          'Les assistants qui recommandent des produits s’appuient surtout sur les fiches produits, les flux de données (comme ceux de Google Merchant Center) et les pages de catégories utiles. Une architecture propre, où chaque produit est accessible par des liens et décrit par une fiche complète, est la meilleure base. Les combinaisons de filtres, elles, n’apportent rien de plus aux assistants qu’aux moteurs. Voir notre guide [Fiche produit et IA](/guides/fiche-produit-et-ia) pour la partie produit, et notre guide sur le [maillage interne](/guides/maillage-interne) pour l’organisation des liens.',
        ],
      },
      {
        h2: 'Exemple : le plan de Sentiers & Cie',
        list: [
          'Catégories et sous-catégories : explorables et indexables, une adresse propre chacune, un court texte d’introduction utile en haut de page.',
          'Pagination : ?page=2 et suivantes, liens numérotés dans le HTML, canonique propre à chaque page, bouton « Charger plus » conservé pour les visiteurs mais doublé de ces liens.',
          'Filtres de taille, couleur, prix, marque : adresses écartées de l’exploration par une règle robots.txt sur leurs paramètres, liens de filtres maintenus pour les visiteurs.',
          'Cinq combinaisons recherchées (sacs à dos femme, chaussures imperméables, bâtons pliants, tentes une place, vestes coupe-vent) : transformées en vraies pages de catégorie, reliées depuis le menu.',
          'Tris : liens vers des adresses avec paramètre de tri, exclues de l’exploration par la même règle.',
          'Sitemap : catégories, pages ciblées et fiches produits uniquement.',
        ],
        after: [
          'Après la mise en place, l’équipe vérifie dans la Search Console, au fil des semaines, que les adresses filtrées disparaissent des pages explorées et que les fiches produits sont indexées. Elle ne peut pas prédire l’effet sur le trafic, mais elle sait que les robots consacrent désormais leur temps aux pages qui comptent.',
        ],
      },
      {
        h2: 'Les erreurs les plus fréquentes',
        list: [
          'Une canonique de toutes les pages paginées vers la page 1 : les produits des pages suivantes risquent de ne plus être découverts [1].',
          'Un « Charger plus » sans pages paginées derrière : les produits au-delà du premier lot restent invisibles pour Google [1].',
          'Des filtres explorables à l’infini, sans règle dans robots.txt, qui multiplient les adresses inutiles [2].',
          'Un robots.txt qui bloque des adresses filtrées tout en comptant sur leur noindex pour les retirer de l’index.',
          'Des filtres vides qui renvoient une page « 0 produit » avec un code 200 au lieu d’un 404 [2].',
          'Des liens internes, dans le menu ou les fiches, qui pointent vers des adresses avec paramètres de tri.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il mettre les pages 2, 3, 4 en noindex ?', a: 'Google ne le demande pas. Il recommande une adresse unique et une canonique propre pour chaque page paginée, reliées par des liens. Les pages paginées servent à atteindre les produits ; les mettre en noindex n’est pas la recommandation de Google.' },
      { q: 'rel="next" et rel="prev" sont-ils encore utiles ?', a: 'Google indique ne plus en tenir compte. D’autres moteurs peuvent encore s’en servir ; les garder ne nuit pas, mais ils ne remplacent pas des liens explorables entre les pages.' },
      { q: 'Faut-il bloquer les filtres si ma boutique est petite ?', a: 'Avec peu de produits et peu de filtres, le risque est limité. Il augmente vite avec le nombre de critères combinables : trois filtres de dix valeurs chacun produisent déjà des centaines de combinaisons. Mieux vaut poser la règle tôt.' },
      { q: 'Un filtre en JavaScript sans changement d’adresse pose-t-il problème ?', a: 'Non pour l’exploration : sans nouvelle adresse, il n’y a rien à explorer. Vérifiez seulement que la liste non filtrée et ses pages restent accessibles par des liens.' },
      { q: 'Combien de produits par page ?', a: 'Google ne fixe pas de nombre. Choisissez ce qui reste confortable pour le visiteur et rapide à charger sur mobile, testez-le, et gardez dans tous les cas des liens vers toutes les pages.' },
    ],
    sources: [
      { label: 'Google Search Central, pagination, chargement incrémentiel et impact sur la recherche Google', url: 'https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading?hl=fr', note: `mise à jour du 18 déc. 2025 ; ${VU}` },
      { label: 'Google, gérer l’exploration des URL de navigation à facettes', url: 'https://developers.google.com/crawling/docs/faceted-navigation', note: `mise à jour du 18 déc. 2025 ; ${VU}` },
    ],
    cta: { text: 'Une adresse filtrée est-elle bloquée, en noindex ou canonique ? Vérifiez qu’elle est traitée comme vous le souhaitez.', href: '/outils/indexabilite', label: 'Tester une adresse' },
    related: ['seo-shopify', 'seo-prestashop', 'fiche-produit-et-ia', 'google-merchant-center'],
  },
];
