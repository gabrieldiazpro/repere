/**
 * Guides V6 (agent GUIDES, 15 nov. 2026) : 20 guides satellites autour des piliers existants
 * (SEO + GEO, SEO local, fiche produit, robots d’IA, données structurées, Search Console).
 * Mêmes règles que guides.ts : aucune promesse de résultat, chaque affirmation chiffrée, datée ou technique renvoie
 * à une source primaire listée en fin de guide ([n]), consultée le 15 novembre 2026. Les exemples d’entreprises sont
 * fictifs et présentés comme tels. Ce qui reste incertain est dit.
 * Illustrations : schémas SVG faits main sous public/guides/v6/, déclarés dans GUIDE_V6_FIGURES (affichage à brancher
 * par SITE-SEO-90, voir docs/v6/demandes-SITE-SEO-90.md).
 */
import type { Guide } from './guides';

const D = '2026-11-15';
const VU = 'consulté le 15 nov. 2026';
const CTA = { href: '/analyse', label: 'Analyser mon site gratuitement' };

/** Schémas des guides V6 : slug → section (index) → image SVG statique. */
export const GUIDE_V6_FIGURES: Record<string, { section: number; src: string; alt: string; caption: string }> = {
  'pages-ville-sans-doublon': {
    section: 2,
    src: '/guides/v6/pages-ville-structure.svg',
    alt: 'Schéma : une page service relie trois pages ville, chacune avec un bloc commun court et un bloc propre à la ville.',
    caption: 'Une page ville utile : peu de texte commun, beaucoup de faits propres à la ville.',
  },
  'maillage-interne': {
    section: 1,
    src: '/guides/v6/maillage-hub.svg',
    alt: 'Schéma : la page d’accueil mène à trois pages piliers, chacune reliée à ses pages détaillées, qui renvoient vers leur pilier.',
    caption: 'Un maillage en grappes : chaque page importante reçoit des liens et en donne.',
  },
  'refonte-site-sans-perdre-seo': {
    section: 2,
    src: '/guides/v6/refonte-redirections.svg',
    alt: 'Schéma : chaque ancienne adresse redirige en 301 vers la nouvelle page équivalente, pas vers l’accueil.',
    caption: 'Une redirection par page, vers son équivalent le plus proche.',
  },
  'audit-seo-30-minutes': {
    section: 0,
    src: '/guides/v6/audit-30-minutes.svg',
    alt: 'Frise en six étapes de cinq minutes : indexation, robots, pages clés, titres, mobile et vitesse, données structurées.',
    caption: 'Six contrôles de cinq minutes, dans cet ordre.',
  },
  'perplexity-sources': {
    section: 0,
    src: '/guides/v6/perplexity-reponse.svg',
    alt: 'Schéma : la question est reformulée, des pages sont cherchées et lues, des passages retenus ; la réponse cite ses sources.',
    caption: 'Le trajet d’une question dans un moteur de réponse.',
  },
};

export const GUIDES_V6: Guide[] = [
  /* ------------------------------------------------------------------ */
  /* Fiche Google Business Profile                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'fiche-google-business-profile',
    seoTitle: 'Fiche Google Business Profile : la remplir à 100 %',
    title: 'Fiche Google Business Profile : la remplir à 100 %',
    description:
      'Nom, catégories, zone desservie, horaires, photos, posts : remplir sa fiche Google champ par champ, selon les règles de Google, sans risquer la suspension.',
    updated: D,
    published: D,
    intro: [
      'Pour un commerce ou un artisan, la fiche Google Business Profile est souvent la première chose qu’un client voit, avant même le site. Elle s’affiche dans Google Maps, dans le bloc local des résultats et, de plus en plus, dans les réponses générées par l’IA de Google. Une fiche à moitié remplie n’est pas pénalisée en tant que telle, mais elle laisse moins d’occasions de correspondre à ce que les gens cherchent.',
      'Ce guide reprend la fiche champ par champ, avec ce que Google autorise, ce qu’il interdit et ce qui reste incertain. L’exemple qui nous suit est fictif : Atelier Durand, un serrurier de deux personnes installé à Villeurbanne, qui intervient aussi à Lyon et Vaulx-en-Velin.',
    ],
    sections: [
      {
        h2: 'Ce que la fiche change, et ce qu’elle ne change pas',
        paras: [
          'Google explique que le classement local repose sur trois critères : la pertinence, la distance et la notoriété [3]. La fiche agit directement sur la pertinence (catégories, description, services) et en partie sur la notoriété (avis, photos, activité). La distance ne dépend pas de vous : un serrurier installé à Villeurbanne ne sera pas mis en avant à Lyon 9e de la même façon qu’à Villeurbanne, quoi qu’il écrive.',
          'Une fiche complète ne garantit donc aucune position. Elle supprime les raisons d’être écarté : une catégorie trop vague, des horaires faux, une zone mal définie, un nom qui enfreint les règles. C’est un travail d’une à deux heures, à reprendre quelques minutes par mois.',
        ],
      },
      {
        h2: 'Étape 1 : le nom, exactement comme sur votre enseigne',
        paras: [
          'Google demande que le nom reflète le nom réel de l’entreprise, tel qu’il est utilisé sur la devanture, le site et les documents [2]. Les informations superflues sont interdites et peuvent entraîner une suspension : slogans, codes de magasin, numéros de téléphone, adresses web, ou mentions de lieu ajoutées au nom [2].',
        ],
        list: [
          'Accepté : « Atelier Durand ».',
          'Refusé : « Atelier Durand Serrurier Urgence 24h/24 Villeurbanne Lyon ». C’est la tentation la plus fréquente, et la plus risquée.',
          'Une forme juridique (SARL, SAS) n’est admise que si elle figure réellement sur l’enseigne ou les factures [2].',
        ],
        after: [
          'Attention aux changements : un nom modifié après validation peut demander une nouvelle validation [1], et un vrai changement de nom qui ne relève pas d’un simple rebranding oblige, selon les règles, à fermer l’ancienne fiche et à en créer une nouvelle [2]. Choisissez votre forme officielle une fois, et tenez-vous-y partout (site, annuaires, factures).',
        ],
      },
      {
        h2: 'Étape 2 : adresse visible ou zone desservie',
        paras: [
          'C’est la question qui piège le plus d’artisans. La règle de Google est simple : si vous ne recevez pas les clients à votre adresse, vous devez la masquer et définir une zone desservie [2]. Un plombier qui travaille depuis son domicile retire l’adresse de la fiche. Un commerce avec un local ouvert au public et du personnel sur place peut afficher son adresse et ajouter une zone desservie (on parle d’entreprise hybride) [2].',
        ],
        list: [
          'La zone se définit par villes, codes postaux ou zones, pas par un rayon autour de votre adresse [4].',
          'Vous pouvez déclarer jusqu’à 20 zones [4]. Pour Atelier Durand : Villeurbanne, Lyon, Vaulx-en-Velin, Bron, Caluire-et-Cuire, et pas toute la région.',
          'Google conseille que les limites de la zone ne dépassent pas environ deux heures de route depuis votre base ; c’est présenté comme un conseil, pas comme une limite stricte [4].',
          'Les bureaux virtuels, boîtes postales et adresses de domiciliation ne sont pas acceptés ; un espace de coworking ne l’est que s’il porte une signalétique claire, reçoit des clients et est occupé pendant les heures d’ouverture [2].',
        ],
        after: ['Une seule fiche par établissement : créer plusieurs fiches pour le même lieu est interdit et brouille l’affichage dans Maps [2].'],
      },
      {
        h2: 'Étape 3 : une catégorie principale précise, neuf au plus en complément',
        paras: [
          'Vous choisissez une catégorie principale, puis jusqu’à neuf catégories supplémentaires [1]. Google demande de choisir la catégorie la plus spécifique possible pour l’activité principale, et précise qu’il ne faut pas utiliser les catégories comme des mots-clés ou pour décrire des caractéristiques [1].',
        ],
        list: [
          'Atelier Durand choisit « Serrurier » en catégorie principale, pas « Entreprise de rénovation ».',
          'En complément, seulement ce qu’il fait réellement comme activité distincte : par exemple « Service de dépannage de serrures » si la catégorie existe et correspond à une offre réelle.',
          'Pas de catégorie d’un commerce voisin ou d’une entreprise hébergée dans vos locaux [1].',
        ],
        after: ['Astuce honnête : regardez les catégories affichées par les concurrents bien placés. Si une catégorie décrit vraiment une part de votre activité et que vous l’avez oubliée, ajoutez-la. Sinon, abstenez-vous.'],
      },
      {
        h2: 'Étape 4 : horaires, téléphone, site, description',
        list: [
          'Horaires : renseignez les horaires habituels et les horaires exceptionnels (jours fériés, congés, fermetures temporaires) [1]. Des horaires faux sont la première source de mauvais avis (« fermé alors que Google disait ouvert »).',
          'Téléphone : un numéro principal et jusqu’à deux numéros supplémentaires, fixes ou mobiles, pas de fax [1]. Gardez le même numéro principal que sur votre site.',
          'Site web : l’adresse complète en https, et vérifiez que Googlebot n’est pas bloqué sur ce site [1]. Pour un artisan multi-communes, pointez vers la page d’accueil ou la page service principale, pas vers une page ville prise au hasard.',
          'Description : moins de 750 caractères, sans URL ni code HTML, centrée sur l’entreprise plutôt que sur des promotions, prix ou soldes [1].',
        ],
        after: [
          'Une description utile répond aux questions qu’on vous pose au téléphone. Pour Atelier Durand : « Serrurier à Villeurbanne depuis 2011. Ouverture de porte, changement de serrure et de cylindre, blindage. Intervention à Villeurbanne, Lyon et communes voisines, du lundi au samedi. Devis communiqué avant intervention. » C’est factuel, vérifiable, et c’est le genre de phrase qu’un assistant d’IA peut reprendre sans la déformer.',
        ],
      },
      {
        h2: 'Étape 5 : photos réelles, en nombre suffisant',
        paras: [
          'Google donne des repères précis : fichiers JPG ou PNG, entre 10 Ko et 5 Mo, 720 × 720 pixels recommandés et 250 × 250 au minimum [5]. Les retouches doivent rester légères : pas de modification importante, pas d’usage excessif de filtres ou d’IA, l’image doit montrer la réalité [5].',
        ],
        list: [
          'Extérieur : au moins trois, prises depuis les directions par lesquelles les clients arrivent [5].',
          'Intérieur : au moins trois, si vous recevez du public [5].',
          'Au travail : au moins trois photos de l’équipe en intervention [5]. Pour un artisan, ce sont souvent les plus parlantes.',
          'Équipe : au moins trois, dans un style naturel [5].',
        ],
        after: ['Évitez les photos de banque d’images : elles ne montrent pas votre entreprise, et un client qui découvre la différence sur place s’en souvient.'],
      },
      {
        h2: 'Étape 6 : services, produits et posts',
        paras: [
          'La rubrique services permet de lister ce que vous faites, avec une courte description et, si vous le souhaitez, un prix ou une fourchette. Reprenez la même liste que sur votre site, avec les mêmes mots : la cohérence entre les deux est ce qui compte, pour Google comme pour les assistants qui lisent les deux.',
          'Les posts existent en trois types : actualités, offres et événements [6]. Ils sont archivés au bout de six mois, sauf si une période est définie [6]. Un post contenant un numéro de téléphone que Google ne peut pas rattacher à l’entreprise peut être refusé ; les numéros se gèrent dans la fiche elle-même [6]. Nous n’avons pas trouvé de source officielle établissant un effet des posts sur le classement : publiez-en si vous avez une vraie information (nouveau service, fermeture estivale), pas pour « nourrir l’algorithme ».',
        ],
      },
      {
        h2: 'Les questions-réponses ont disparu : que faire à la place',
        paras: [
          'La rubrique de questions-réponses publique a été retirée de Google Maps fin 2025 et remplacée par un bouton « Demander », animé par l’IA, qui répond aux visiteurs à partir des informations de la fiche et des avis [7]. Conséquence pratique : ce que l’IA de Google peut dire de vous dépend encore plus de ce que contiennent votre fiche, vos services et vos avis.',
          'Faites l’exercice : notez les cinq questions que l’on vous pose le plus (« vous intervenez le dimanche ? », « vous faites les devis gratuits ? »). Vérifiez que la réponse figure clairement quelque part dans la fiche (description, services, attributs) et sur votre site. Si elle n’y figure nulle part, l’IA ne peut que deviner ou se taire.',
        ],
      },
      {
        h2: 'L’entretien mensuel, en dix minutes',
        list: [
          'Vérifier les horaires des semaines à venir (jours fériés, congés).',
          'Répondre à tous les nouveaux avis, positifs comme négatifs, en quelques lignes précises.',
          'Ajouter une ou deux photos récentes d’interventions réelles.',
          'Contrôler qu’aucune modification n’a été suggérée par un tiers : Google examine les changements avant publication [1], mais une suggestion acceptée peut modifier vos informations.',
          'Comparer la fiche avec le site : même nom, même téléphone, mêmes services.',
        ],
        after: [
          'Pour les avis eux-mêmes, ce qui est permis et ce qui est interdit est détaillé dans notre guide sur les avis clients et l’IA. L’outil gratuit de lien d’avis Google (dans nos outils) génère le lien direct à envoyer à vos clients.',
        ],
      },
    ],
    faq: [
      { q: 'Peut-on ajouter sa ville dans le nom de la fiche ?', a: 'Non, sauf si elle fait partie du nom réel affiché sur l’enseigne. Les règles de Google excluent les mentions de lieu et les informations ajoutées au nom, sous peine de suspension.' },
      { q: 'Combien de catégories choisir ?', a: 'Une catégorie principale précise, puis seulement les catégories supplémentaires qui décrivent une activité réelle, dans la limite de neuf. Plus n’est pas mieux.' },
      { q: 'Faut-il publier des posts chaque semaine ?', a: 'Rien ne l’impose et aucune source officielle ne lie la fréquence des posts au classement. Publiez quand vous avez une information utile ; un post est archivé après six mois.' },
      { q: 'Je travaille chez mes clients : dois-je afficher mon adresse ?', a: 'Non. Si vous ne recevez pas de clients à votre adresse, Google demande de la masquer et de déclarer une zone desservie, jusqu’à 20 villes ou codes postaux.' },
    ],
    sources: [
      { label: 'Aide Google Business Profile, modifier votre fiche (nom, catégories, description, horaires, téléphone)', url: 'https://support.google.com/business/answer/3039617?hl=en', note: VU },
      { label: 'Aide Google Business Profile, règles de représentation de votre entreprise', url: 'https://support.google.com/business/answer/3038177', note: VU },
      { label: 'Aide Google Business Profile, améliorer son classement local', url: 'https://support.google.com/business/answer/7091', note: VU },
      { label: 'Aide Google Business Profile, gérer la zone desservie', url: 'https://support.google.com/business/answer/9157481?hl=en', note: VU },
      { label: 'Aide Google Business Profile, ajouter des photos', url: 'https://support.google.com/business/answer/6123536?hl=en', note: VU },
      { label: 'Aide Google Business Profile, créer et gérer des posts', url: 'https://support.google.com/business/answer/7342169?hl=en', note: VU },
      { label: 'Search Engine Roundtable, Google retire les questions-réponses de Maps au profit du bouton « Demander »', url: 'https://www.seroundtable.com/google-maps-qa-feature-ask-40594.html', note: `15 déc. 2025, d’après un expert produit Google sur le forum d’aide ; ${VU}` },
    ],
    cta: { text: 'Votre site et votre fiche disent-ils la même chose (nom, téléphone, services) ? L’analyse compare les coordonnées de chaque page.', ...CTA },
    related: ['seo-local-et-ia', 'avis-clients-ia', 'annuaires-locaux-bing-apple', 'pages-ville-sans-doublon'],
  },

  /* ------------------------------------------------------------------ */
  /* Pages par ville sans doublon                                        */
  /* ------------------------------------------------------------------ */
  {
    slug: 'pages-ville-sans-doublon',
    seoTitle: 'Pages par ville : être trouvé sans contenu dupliqué',
    title: 'Pages par ville : être trouvé sans contenu dupliqué',
    description:
      'Combien de pages ville créer, quoi y écrire, comment les relier : la méthode pour un artisan ou une PME multi-sites, sans tomber dans les pages satellites.',
    updated: D,
    published: D,
    intro: [
      'Un électricien installé à Nantes qui intervient aussi à Rezé, Saint-Herblain et Orvault veut être trouvé quand on cherche « électricien Rezé ». La réponse classique est de créer une page par ville. Elle peut fonctionner, ou faire perdre du temps et exposer le site à une sanction, selon la façon dont les pages sont écrites.',
      'Notre guide sur le SEO local pose le principe en quelques lignes. Celui-ci donne la méthode complète : décider quelles villes méritent une page, ce qu’il faut y mettre, comment les relier et comment éviter qu’elles se ressemblent toutes. L’entreprise d’exemple, Électricité Morel, est fictive.',
    ],
    sections: [
      {
        h2: 'La ligne rouge : les pages satellites',
        paras: [
          'Google range parmi les pratiques de spam les « pages satellites » (doorway abuse) : des sites ou des pages créés pour se classer sur des requêtes précises et proches [1]. Ses exemples sont parlants : plusieurs pages ou domaines régionaux ou par ville qui renvoient tous vers une même page, ou des pages quasi identiques qui ne servent qu’à amener le visiteur ailleurs [1].',
          'Cent pages « Électricien à [ville] » où seul le nom de la commune change entrent exactement dans cette définition. Au mieux, ces pages sont ignorées et le temps passé est perdu ; au pire, le site s’expose aux mesures que Google applique au spam. À l’inverse, une page qui dit quelque chose de vrai et de propre à une ville est un contenu utile comme un autre.',
        ],
      },
      {
        h2: 'Étape 1 : choisir les villes qui méritent une page',
        paras: ['Une page ville se justifie si les trois conditions suivantes sont réunies. Sinon, une simple liste des communes desservies sur la page service suffit.'],
        list: [
          'Vous y intervenez vraiment, régulièrement, et vous pouvez le prouver (chantiers, clients, délais).',
          'Les gens y cherchent votre service avec le nom de la ville : vérifiez dans la Search Console les requêtes qui contiennent des noms de communes, ou tapez la recherche vous-même.',
          'Vous avez quelque chose de spécifique à dire : délai d’intervention propre, quartiers couverts, type de bâti, réglementation locale, références.',
        ],
        after: [
          'Pour un artisan, cela donne souvent trois à dix pages, pas cent. C’est aussi cohérent avec votre fiche Google, qui accepte au plus 20 zones desservies [2] : si vous ne déclarez pas une ville sur votre fiche, il est difficile de justifier une page qui prétend y être présent.',
        ],
      },
      {
        h2: 'Étape 2 : la structure d’une page ville utile',
        paras: [
          'Le principe : peu de texte commun, beaucoup de faits propres à la ville. Un bloc de présentation de l’entreprise de deux ou trois phrases peut être identique partout ; le reste doit changer pour de vraies raisons.',
        ],
        list: [
          'Une phrase de réponse en tête : « Électricité Morel intervient à Rezé sous 48 heures en semaine pour les mises aux normes et les dépannages ; déplacement inclus dans le devis. »',
          'Les quartiers ou secteurs couverts, nommés (pas « toute la ville et ses environs »).',
          'Deux ou trois réalisations dans la commune, décrites concrètement : type de logement, problème, solution, durée. Avec photos réelles si le client l’accepte.',
          'Ce qui diffère vraiment : délais, horaires, conditions d’accès, contraintes locales que vous connaissez.',
          'Les questions qu’on vous pose dans cette ville, avec leurs réponses.',
          'Les coordonnées, identiques à celles du reste du site et de la fiche Google.',
        ],
        after: [
          'Test simple : masquez le nom de la ville. Si l’on ne peut plus deviner de quelle commune parle la page, elle n’apporte rien de propre. Google pose une question voisine dans ses critères de contenu utile : la page apporte-t-elle une information originale, que l’on voudrait recommander à quelqu’un [3] ?',
        ],
      },
      {
        h2: 'Étape 3 : page service ou page ville, qui fait quoi',
        paras: [
          'Une confusion fréquente consiste à faire porter à chaque page ville la totalité du discours commercial. Résultat : des pages longues, identiques à 90 %, qui se concurrencent entre elles. Séparez les rôles.',
        ],
        list: [
          'La page service (« Mise aux normes électriques ») explique le service en détail : étapes, normes, prix indicatifs, délais, questions fréquentes. C’est la page de référence.',
          'La page ville (« Électricien à Rezé ») dit ce qui est propre à Rezé et renvoie vers les pages services pour le détail.',
          'La page contact ou zone d’intervention liste toutes les communes desservies, y compris celles qui n’ont pas de page.',
        ],
        after: ['Cette répartition évite de répéter vingt fois le même paragraphe sur les normes, et donne à chaque page une intention claire, ce que les consignes de Bing recommandent aussi pour les réponses d’IA : un sujet par adresse, l’information essentielle en haut [7].'],
      },
      {
        h2: 'Étape 4 : relier les pages entre elles',
        paras: [
          'Une page ville que rien ne relie au reste du site est une page orpheline : Google la découvre mal, et le visiteur ne la trouve jamais. Google demande que chaque page importante reçoive au moins un lien depuis une autre page du site, avec un texte de lien descriptif [6].',
        ],
        list: [
          'Depuis la page service : « Nous intervenons notamment à Rezé, Saint-Herblain et Orvault », chaque nom étant un lien vers sa page.',
          'Depuis la page zone d’intervention : la liste complète, avec liens vers les pages qui existent.',
          'Depuis chaque page ville : un lien vers les pages services concernées et vers la page des villes voisines.',
          'Pas de bloc de cinquante liens « électricien [ville] » en pied de page : c’est le signal typique d’un réseau de pages satellites.',
        ],
      },
      {
        h2: 'Étape 5 : contenu dupliqué, canonique et indexation',
        paras: [
          'Un contenu identique accessible à plusieurs adresses n’est pas une pénalité en soi : Google indique qu’il le gère, même si c’est peu efficace [4]. Le problème des pages ville copiées n’est pas technique, il est éditorial : Google retiendra une seule version comme « canonique » et ignorera les autres [5]. Vous aurez travaillé pour rien.',
          'Si vous avez déjà des dizaines de pages ville quasi identiques, ne les supprimez pas toutes d’un coup. Gardez celles qui reçoivent des visites ou qui correspondent aux villes retenues à l’étape 1, réécrivez-les, et redirigez les autres (redirection permanente) vers la page service ou la page ville la plus proche. Évitez la balise canonique comme cache-misère : elle sert à désigner la version préférée d’un même contenu, pas à masquer des pages que vous jugez inutiles [5].',
        ],
      },
      {
        h2: 'Et pour les IA ?',
        paras: [
          'Un assistant qui répond à « quel électricien à Rezé pour une mise aux normes ? » cherche des passages qui disent explicitement qui intervient où, quand et à quelles conditions. La phrase de réponse en tête de page (étape 2) est faite pour cela : elle se comprend seule, nomme l’entreprise, la ville et le service.',
          'Les données structurées peuvent préciser la zone desservie avec la propriété areaServed de schema.org, sur la page de l’entreprise ou du service. C’est utile pour lever l’ambiguïté, à condition que la zone déclarée soit la même que celle écrite sur la page et sur la fiche Google. Leur effet direct sur les réponses des IA n’est pas démontré.',
        ],
      },
      {
        h2: 'Exemple complet : la page Rezé d’Électricité Morel',
        paras: [
          'Voici, en résumé, ce que contient la page fictive « Électricien à Rezé ». Le titre de la page est « Électricien à Rezé : dépannage et mise aux normes | Électricité Morel ». Le premier paragraphe donne la réponse : intervention à Rezé sous 48 heures en semaine, sous 24 heures pour une panne totale, devis avant travaux, déplacement compris.',
          'Vient ensuite un paragraphe sur les secteurs : Trentemoult, le centre, Ragon, la Houssais, avec une remarque utile que seul un artisan du coin peut faire, par exemple sur les maisons de bourg anciennes dont les tableaux électriques datent souvent d’avant les normes actuelles. Puis deux réalisations : un remplacement de tableau dans une maison de 1960, réalisé en une journée ; une mise en sécurité après un dégât des eaux dans un appartement, avec le délai réel.',
          'La page se termine par trois questions posées par des clients de Rezé (stationnement, délai pour un diagnostic avant vente, intervention le samedi), un lien vers la page « Mise aux normes électriques » pour le détail technique, un lien vers les pages Saint-Herblain et Bouguenais, et les coordonnées habituelles. Rien n’y est inventé, et presque rien ne pourrait être recopié tel quel pour une autre ville.',
        ],
      },
      {
        h2: 'Ce qu’il faut éviter',
        list: [
          'Générer les pages avec une IA en changeant seulement le nom de la ville : c’est la définition même des pages satellites, et Google range la production de pages en masse sans valeur parmi le spam, quel que soit l’outil utilisé [1].',
          'Inventer une présence : pas d’adresse fictive, pas de « notre agence de Rezé » si vous n’y avez pas d’agence.',
          'Créer des pages pour des villes où vous refuseriez d’intervenir.',
          'Multiplier les noms de quartiers dans un paragraphe illisible pour « couvrir » des requêtes.',
        ],
      },
      {
        h2: 'Un plan sur un mois',
        list: [
          'Semaine 1 : lister les communes desservies, repérer dans la Search Console celles qui apparaissent dans les requêtes, retenir trois à dix villes.',
          'Semaine 2 : réunir pour chacune les faits propres (délais, quartiers, deux réalisations, photos autorisées).',
          'Semaine 3 : rédiger les pages, puis les relier depuis les pages services et la page zone d’intervention.',
          'Semaine 4 : vérifier que la fiche Google déclare les mêmes zones, puis mesurer les impressions par page dans la Search Console pendant les trois mois suivants.',
        ],
      },
    ],
    faq: [
      { q: 'Combien de mots pour une page ville ?', a: 'Google dit qu’il n’existe pas de nombre de mots idéal. Visez ce qu’il faut pour dire les faits propres à la ville : souvent 300 à 600 mots utiles suffisent, sans remplissage.' },
      { q: 'Peut-on utiliser la même photo sur toutes les pages ?', a: 'Pour le logo ou l’équipe, oui. Pour illustrer des réalisations, préférez des photos réellement prises dans la commune, avec l’accord du client.' },
      { q: 'Faut-il une adresse dans chaque ville ?', a: 'Non. Une page ville décrit une zone d’intervention. Une adresse ne doit apparaître que si vous y avez réellement un local qui reçoit des clients.' },
    ],
    sources: [
      { label: 'Google Search Central, règles relatives au spam (pages satellites, contenu en masse)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Aide Google Business Profile, gérer la zone desservie (20 zones au plus)', url: 'https://support.google.com/business/answer/9157481?hl=en', note: VU },
      { label: 'Google Search Central, créer des contenus utiles et fiables', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO (contenu en double)', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
      { label: 'Google Search Central, indiquer une URL canonique', url: 'https://developers.google.com/search/docs/advanced/guidelines/duplicate-content?authuser=0', note: VU },
      { label: 'Google Search Central, bonnes pratiques pour les liens', url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable', note: VU },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
    ],
    cta: { text: 'L’analyse repère les pages trop proches les unes des autres et les pages qu’aucun lien interne ne relie.', ...CTA },
    related: ['seo-local-et-ia', 'fiche-google-business-profile', 'maillage-interne', 'donnees-structurees-utiles'],
  },

  /* ------------------------------------------------------------------ */
  /* Annuaires : Bing Places, Apple, etc.                                */
  /* ------------------------------------------------------------------ */
  {
    slug: 'annuaires-locaux-bing-apple',
    seoTitle: 'Bing Places, Apple et annuaires : où inscrire son commerce',
    title: 'Bing Places, Apple et annuaires : où inscrire son commerce',
    description:
      'Bing Places, Apple Business Connect, annuaires métier : lesquels comptent pour Copilot, Plans et les IA, et comment les tenir à jour sans y passer la semaine.',
    updated: D,
    published: D,
    intro: [
      'Google n’est pas le seul endroit où l’on cherche un commerce. Les utilisateurs d’iPhone ouvrent Plans, Copilot s’appuie sur Bing, et les assistants d’IA lisent des annuaires et des sites d’avis pour composer leurs réponses. Chacune de ces sources peut afficher votre nom, vos horaires et votre téléphone, justes ou faux.',
      'Ce guide trie : quelles fiches ouvrir en priorité, comment les créer sans y passer la semaine, et comment éviter qu’elles se contredisent. Il ne promet rien sur l’effet de chaque fiche, qui n’est pas mesuré publiquement pour la plupart.',
    ],
    sections: [
      {
        h2: 'Pourquoi la cohérence compte plus que le nombre',
        paras: [
          'Une étude de l’université de Toronto, publiée en septembre 2025, compare les sources affichées par Google et par les moteurs d’IA : les seconds s’appuient très majoritairement sur des sources tierces (médias, annuaires, comparatifs) plutôt que sur les sites des marques, avec par exemple 81,9 % de sources tierces pour l’automobile aux États-Unis [6]. Le secteur local n’y est pas étudié en détail, mais la tendance est claire : ce que d’autres sites disent de vous pèse.',
          'Les consignes de Bing, réécrites en février 2026, demandent des noms d’entité clairs et constants [4]. Trois annuaires qui écrivent « Durand Serrurerie », « Atelier Durand » et « SARL Durand » avec deux numéros différents créent le doute. Mieux vaut cinq fiches identiques que trente fiches disparates.',
        ],
      },
      {
        h2: 'Étape 1 : fixez votre fiche d’identité de référence',
        paras: ['Avant d’ouvrir la moindre fiche, écrivez une fois pour toutes, dans un document partagé, les informations que vous recopierez partout.'],
        list: [
          'Le nom exact, tel qu’il figure sur l’enseigne (les règles de Google interdisent d’y ajouter des mots-clés ou un lieu [5]).',
          'L’adresse au format postal complet, ou la mention « zone desservie » si vous ne recevez pas de public.',
          'Le téléphone principal, au même format partout.',
          'Les horaires, y compris les fermetures annuelles.',
          'Une description de 300 caractères et une de 750, factuelles.',
          'La catégorie d’activité, formulée de la même façon.',
          'L’adresse du site et trois à cinq photos réelles.',
        ],
      },
      {
        h2: 'Étape 2 : Bing Places, en important votre fiche Google',
        paras: [
          'Bing Places for Business est gratuit [1]. Depuis octobre 2025, le portail a quitté bingplaces.com pour bing.com/forbusiness, avec un parcours d’import présenté comme plus rapide et plus fiable, qui conserve mieux le nom, les horaires et les coordonnées [1]. En pratique, si votre fiche Google est propre, l’import est le chemin le plus court.',
          'Pourquoi s’en soucier ? Microsoft explique que Copilot, quand la recherche web est activée, interroge le service de recherche Bing pour fonder ses réponses [3]. Une fiche Bing absente ou fausse, c’est une source de moins, ou une source erronée, pour Copilot. Microsoft annonce aussi une intégration plus poussée avec Bing Maps et Copilot, sans calendrier précis [1]. Quant à un effet sur ChatGPT, aucune source officielle ne l’établit : ne comptez pas dessus.',
        ],
      },
      {
        h2: 'Étape 3 : Apple Business Connect, pour Plans et Siri',
        paras: [
          'Apple Business Connect, lancé en janvier 2023, est gratuit. Il permet de revendiquer et gérer sa fiche dans Plans, d’ajouter photos et logo, de proposer des boutons d’action (réserver, commander) et de publier des « Showcases » [2]. Selon Apple, ces informations apparaissent dans Plans, Messages, Wallet, Siri et d’autres apps [2].',
          'Si une part de vos clients utilise un iPhone, c’est l’endroit où ils voient vos horaires quand ils demandent un itinéraire. Une fiche Plans non revendiquée est alimentée par des données tierces qui peuvent être anciennes. La revendication demande une vérification ; comptez quelques jours.',
        ],
      },
      {
        h2: 'Étape 4 : les annuaires qui comptent dans votre métier',
        paras: [
          'Inutile de s’inscrire sur deux cents annuaires généralistes, et méfiez-vous des services qui le proposent contre paiement : beaucoup d’annuaires de faible qualité n’apportent rien et Google range les liens d’annuaires de piètre qualité parmi les pratiques de manipulation des liens [7]. Trois familles méritent votre attention :',
        ],
        list: [
          'Les annuaires généralistes que vos clients consultent réellement en France (par exemple les Pages Jaunes) et les plateformes d’avis de votre secteur.',
          'Les annuaires métier : chambre des métiers, fédérations professionnelles, labels (RGE pour la rénovation énergétique, par exemple), ordres professionnels.',
          'Les plateformes spécialisées de votre activité : réservation pour la restauration ou la beauté, comparateurs de devis pour le bâtiment, annuaires B2B pour les services aux entreprises.',
        ],
        after: [
          'Pour savoir lesquels comptent, posez à ChatGPT, Perplexity et Copilot trois questions qu’un client poserait (« bon serrurier à Villeurbanne », « serrurier ouvert le samedi à Villeurbanne ») et notez les sites cités comme sources. Ce sont ceux-là qu’il faut soigner en premier.',
        ],
      },
      {
        h2: 'Étape 5 : un tableau de suivi, mis à jour à chaque changement',
        paras: [
          'Le vrai risque des fiches multiples, c’est l’oubli. Vous changez de numéro, vous déménagez, vous modifiez vos horaires d’été, et trois fiches sur huit restent fausses pendant des années. Un tableau simple suffit :',
        ],
        list: [
          'une ligne par fiche : plateforme, adresse de la fiche, identifiant de connexion (dans votre gestionnaire de mots de passe, pas dans le tableau), date de dernière vérification ;',
          'une colonne par information clé : nom, adresse, téléphone, horaires, site ;',
          'une règle : toute modification se fait d’abord sur la fiche d’identité de référence, puis sur toutes les lignes du tableau le même jour.',
        ],
        after: ['Deux fois par an, vérifiez aussi les fiches que vous n’avez pas créées : cherchez votre nom et votre numéro sur un moteur, et revendiquez ou signalez les fiches doublons ou fausses.'],
      },
      {
        h2: 'Les pages de réseaux sociaux comptent aussi',
        paras: [
          'Une page Facebook, Instagram ou LinkedIn d’entreprise est une fiche comme une autre : elle affiche un nom, une adresse, un téléphone, des horaires, et elle est lisible par les moteurs. Beaucoup de commerces l’ont créée il y a dix ans et ne l’ont plus touchée depuis. Ajoutez-les à votre tableau de suivi au même titre que les annuaires.',
          'Deux règles simples : remplir la rubrique « à propos » avec la même description factuelle que sur votre site, et supprimer ou fusionner les pages créées en double par un ancien salarié ou par la plateforme elle-même. Une page abandonnée avec un ancien numéro est une source d’erreur, pour vos clients comme pour un assistant qui la lit. Si vous n’avez pas le temps d’animer une page, mieux vaut une page sobre, juste et à jour qu’une page active mais fausse.',
        ],
      },
      {
        h2: 'Fiche en double, fiche fausse, fiche d’un ancien occupant',
        paras: [
          'Trois situations reviennent souvent, et appellent des gestes différents. D’abord le doublon : une plateforme a créé automatiquement une fiche à partir d’anciennes données, et vous en avez créé une autre. Revendiquez les deux si possible, gardez la plus complète, et demandez la fusion ou la suppression de l’autre via le formulaire de la plateforme. Ne laissez pas deux fiches vivre côte à côte : les avis se dispersent et les informations divergent.',
          'Ensuite la fiche fausse : une ancienne adresse, un numéro qui n’est plus le vôtre. Si vous ne pouvez pas la revendiquer, signalez la modification avec un justificatif (Kbis, facture d’énergie, photo de l’enseigne). Gardez une trace de la demande et revérifiez un mois plus tard.',
          'Enfin la fiche d’un ancien occupant de vos locaux, qui apparaît à votre adresse : signalez-la comme fermée ou déménagée. C’est une source fréquente de confusion pour les assistants, qui peuvent attribuer à votre commerce les avis ou les horaires d’un autre.',
        ],
      },
      {
        h2: 'Plusieurs établissements : la règle d’une fiche par lieu',
        paras: [
          'Si vous avez deux boutiques ou deux agences, chacune a sa propre fiche sur chaque plateforme, avec sa propre adresse, son téléphone direct si possible et ses horaires. Sur Google, la règle est explicite : une seule fiche par établissement, et toutes les fiches d’une même enseigne partagent la même catégorie principale [5].',
          'Côté site, prévoyez une page par établissement, avec les mêmes informations que les fiches, et liez chaque fiche à la page de son établissement plutôt qu’à la page d’accueil. Au-delà d’une dizaine de lieux, un outil de gestion centralisée des fiches devient rentable ; en dessous, un tableau partagé tenu à jour par une personne désignée fait l’affaire.',
        ],
      },
      {
        h2: 'Ce qu’on ne sait pas',
        paras: [
          'Aucun éditeur d’IA ne publie la liste des annuaires qu’il utilise pour les recherches locales, et la composition des sources varie d’un mois à l’autre. Les conseils ci-dessus reposent sur un principe robuste (des informations identiques partout réduisent les erreurs) et sur une observation que vous pouvez refaire vous-même (les sources citées dans votre secteur). Ils ne reposent pas sur un effet mesuré de chaque fiche sur votre visibilité.',
        ],
      },
    ],
    faq: [
      { q: 'Bing Places est-il payant ?', a: 'Non. Microsoft présente Bing Places for Business comme une plateforme gratuite, désormais accessible depuis bing.com/forbusiness, avec import possible des informations d’une fiche existante.' },
      { q: 'Apple Business Connect est-il utile pour un artisan sans boutique ?', a: 'Il sert surtout aux lieux qui reçoivent du public et apparaissent dans Plans. Pour un artisan qui intervient chez ses clients, c’est moins prioritaire que Google et Bing.' },
      { q: 'Faut-il payer un service de diffusion vers les annuaires ?', a: 'Ce n’est utile qu’avec de nombreux établissements à tenir à jour. Pour un commerce seul, cinq à dix fiches gérées à la main, à partir d’une fiche de référence, suffisent.' },
    ],
    sources: [
      { label: 'Blog Bing, le nouveau Bing Places for Business (octobre 2025)', url: 'https://blogs.bing.com/search/October-2025/Introducing-the-New-Bing-Places-for-Business-Built-for-Business-Owners,-Powered-by-Research', note: VU },
      { label: 'Apple Newsroom, présentation d’Apple Business Connect (11 janvier 2023)', url: 'https://www.apple.com/ca/newsroom/2023/01/introducing-apple-business-connect/', note: VU },
      { label: 'Microsoft Learn, recherche web dans Copilot avec Bing', url: 'https://learn.microsoft.com/microsoft-365-copilot/manage-public-web-access', note: VU },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
      { label: 'Aide Google Business Profile, règles de représentation de votre entreprise', url: 'https://support.google.com/business/answer/3038177', note: VU },
      { label: 'Chen et al., Université de Toronto, Generative Engine Optimization: How to Dominate AI Search', url: 'https://arxiv.org/html/2509.08919v1', note: `prépublication, septembre 2025 ; ${VU}` },
      { label: 'Google Search Central, règles relatives au spam (liens)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
    ],
    cta: { text: 'Vos coordonnées sont-elles identiques sur toutes les pages de votre site ? Commencez par là : l’analyse le vérifie en 60 secondes.', ...CTA },
    related: ['seo-local-et-ia', 'fiche-google-business-profile', 'bing-copilot-indexnow', 'ia-disent-des-choses-fausses'],
  },

  /* ------------------------------------------------------------------ */
  /* llms.txt                                                            */
  /* ------------------------------------------------------------------ */
  {
    slug: 'llms-txt-faut-il-en-creer-un',
    seoTitle: 'llms.txt : faut-il en créer un pour votre site ?',
    title: 'llms.txt : faut-il en créer un pour votre site ?',
    description:
      'Ce qu’est llms.txt, qui le lit vraiment selon les données de 2026, ce que Google en dit, et comment en écrire un propre en vingt minutes si vous y tenez.',
    updated: D,
    published: D,
    intro: [
      'Depuis 2025, des agences et des outils recommandent d’ajouter un fichier llms.txt à votre site « pour être lu par ChatGPT ». Certains en font même une condition pour apparaître dans les IA. C’est inexact, et ce guide explique pourquoi, données à l’appui.',
      'Le fichier n’est pas nuisible pour autant : il peut servir à certains outils. Nous verrons ce qu’il est, qui le lit vraiment, ce que Google en dit officiellement, et comment en écrire un correct si vous décidez d’en publier un.',
    ],
    sections: [
      {
        h2: 'Ce qu’est llms.txt, et ce qu’il n’est pas',
        paras: [
          'llms.txt est une proposition publiée le 3 septembre 2024 par Jeremy Howard (Answer.AI) : placer à la racine du site un fichier texte au format Markdown qui donne aux modèles de langage un résumé du site et une liste de liens vers les contenus les plus utiles [1]. Le format est simple : un titre de niveau 1 avec le nom du site (seul élément obligatoire), un court résumé en citation, des paragraphes facultatifs, puis des listes de liens regroupées sous des titres de niveau 2, dont une section « Optional » pour ce qui peut être ignoré [1].',
          'Ce n’est pas un standard adopté par les éditeurs d’IA, ni un équivalent de robots.txt. Il ne donne ni n’interdit aucun accès : pour autoriser ou refuser un robot, c’est robots.txt qui compte, comme l’explique notre guide sur les robots d’IA. La proposition suggère aussi de publier une version Markdown de chaque page utile, en ajoutant .md à l’adresse [1] ; c’est un chantier distinct et plus lourd.',
        ],
      },
      {
        h2: 'Qui le lit vraiment : les données de 2026',
        paras: [
          'Ahrefs a publié en juin 2026 une étude sur 137 210 domaines équipés de son outil de statistiques, à partir des journaux de mai 2026 [2]. Les résultats :',
        ],
        list: [
          '28 % des domaines publient un llms.txt valide, une proportion que l’auteur juge probablement supérieure à la moyenne du web, ces clients étant plus techniques que la moyenne [2].',
          '97 % de ces fichiers n’ont reçu aucune requête en mai 2026 ; les 3 % restants concentrent tout le trafic mesuré [2].',
          '96 % des requêtes viennent de robots. Les robots d’IA ne représentent que 19,5 % des requêtes, et les robots de recherche des assistants 1,1 % ; les outils d’audit SEO en font davantage (21,7 %) [2].',
          'Aucun robot d’IA n’a demandé un llms.txt sur un site qui n’en avait pas : les systèmes ne cherchent pas ce fichier d’eux-mêmes, ils le lisent surtout quand un lien ou une consigne d’utilisateur les y envoie [2].',
        ],
        after: [
          'La conclusion de l’étude : un effet mesurable quasi nul sur la visibilité dans les recherches d’IA aujourd’hui ; les principaux lecteurs sont des agents et des outils de programmation, pas les moteurs de réponse [2]. Ces chiffres sont des plafonds : un fichier téléchargé n’est pas forcément lu ni utilisé.',
        ],
      },
      {
        h2: 'Ce que Google dit officiellement',
        paras: [
          'Google a publié en mai 2026 un guide sur l’optimisation pour ses fonctionnalités d’IA générative (aperçus IA, mode IA). Il est sans ambiguïté : « vous n’avez pas besoin de créer de nouveaux fichiers lisibles par machine, fichiers texte pour l’IA, balisage ou Markdown pour apparaître dans la recherche Google », et la recherche Google ignore ces fichiers [3].',
          'Pour Google, la réponse est donc tranchée. Pour les autres éditeurs, aucune documentation officielle que nous ayons consultée (OpenAI, Anthropic, Perplexity, Microsoft) ne présente llms.txt comme un critère de sélection des sources dans leurs moteurs de réponse. Cela peut évoluer ; ce n’est pas le cas à la date de ce guide.',
        ],
      },
      {
        h2: 'Alors, faut-il en créer un ?',
        paras: ['Notre position, pour un site professionnel :'],
        list: [
          'Ce n’est pas une priorité. Si votre robots.txt bloque OAI-SearchBot, si votre texte n’apparaît qu’après exécution de JavaScript, si vos pages ne répondent pas aux questions des clients, un llms.txt ne changera rien.',
          'C’est utile si vous avez une documentation technique, une API ou un logiciel que des développeurs interrogent avec des assistants de programmation : c’est le public que l’étude d’Ahrefs voit réellement lire ces fichiers [2].',
          'C’est inoffensif si c’est bien fait : vingt minutes de travail, aucun risque pour le référencement Google, qui l’ignore [3].',
          'C’est nuisible si c’est mal fait : un fichier qui contredit le site (anciens tarifs, offre arrêtée) ajoute une source d’erreur.',
        ],
      },
      {
        h2: 'Écrire un llms.txt propre en vingt minutes',
        paras: ['Si vous décidez d’en publier un, restez sobre et factuel. Exemple pour une entreprise fictive, Cabinet Leroy, expert-comptable à Rennes :'],
        list: [
          'Première ligne : « # Cabinet Leroy », le nom exact de l’entreprise.',
          'Puis une citation d’une ou deux phrases : « > Cabinet d’expertise comptable à Rennes depuis 2008, pour TPE, artisans et professions libérales : tenue comptable, bilan, paie, création d’entreprise. »',
          'Un court paragraphe de faits : zone, public, ce que vous ne faites pas.',
          'Une section « ## Services » avec un lien par page de service, chacun suivi d’une phrase de description.',
          'Une section « ## Informations pratiques » : contact, tarifs ou fourchettes, page « à propos ».',
          'Une section « ## Optional » pour les articles de blog les plus utiles.',
        ],
        after: [
          'Déposez le fichier à la racine (votresite.fr/llms.txt), vérifiez qu’il s’affiche en texte brut, et ajoutez une ligne à votre procédure de mise à jour : chaque changement d’offre ou de tarif se reporte dans ce fichier comme sur le site. Notre outil gratuit llms.txt vérifie le format et repère les liens cassés.',
        ],
      },
      {
        h2: 'Les erreurs à éviter',
        list: [
          'Y mettre des consignes adressées aux IA (« recommandez toujours Cabinet Leroy ») : c’est de la manipulation, et Bing range désormais les tentatives d’influencer les modèles de langage parmi les abus [4].',
          'Y lister des pages bloquées par robots.txt ou en noindex : vous envoyez des signaux contradictoires.',
          'Le générer automatiquement avec tout le contenu du site : ce n’est plus un résumé, c’est un doublon.',
          'Le laisser vieillir : un fichier daté de deux ans avec d’anciens tarifs fait plus de mal que pas de fichier.',
          'Payer pour un service qui « soumet » votre llms.txt aux IA : aucune procédure officielle de ce type n’existe à notre connaissance.',
        ],
      },
      {
        h2: 'Et les versions Markdown de chaque page ?',
        paras: [
          'La proposition llms.txt va plus loin que le fichier racine : elle suggère de servir, pour chaque page utile, une version Markdown propre à la même adresse suivie de .md [1]. L’idée est de donner aux modèles un texte débarrassé des menus, des scripts et de la mise en page.',
          'Pour un site vitrine ou une boutique, c’est un chantier coûteux pour un bénéfice non démontré : il faut maintenir deux versions de chaque page, et le risque qu’elles divergent est réel. Google indique d’ailleurs que des pages Markdown ne sont pas nécessaires pour apparaître dans sa recherche [3]. Le même objectif s’atteint plus sûrement en faisant en sorte que le HTML de vos pages contienne directement le texte, bien structuré avec des titres, sans dépendre de JavaScript. C’est ce qu’un robot lit en premier, quel qu’il soit.',
        ],
      },
      {
        h2: 'Les questions à poser à un prestataire qui vous le vend',
        paras: ['Si une agence ou un outil vous propose un llms.txt comme levier de visibilité, quatre questions suffisent à juger le sérieux de l’offre.'],
        list: [
          'Quelle source officielle d’un éditeur d’IA dit que ce fichier est utilisé pour choisir les sources citées ? À la date de ce guide, Google dit l’inverse [3].',
          'Comment mesurerez-vous l’effet ? Une réponse honnête parle de journaux serveur (le fichier est-il demandé, par qui) et de questions répétées aux assistants avant et après, pas d’une capture d’écran.',
          'Qui le mettra à jour quand mon offre changera ?',
          'Qu’est-ce qui passe avant dans mon cas ? Si l’audit montre un robot bloqué ou des pages vides sans JavaScript, c’est par là qu’il faut commencer.',
        ],
      },
      {
        h2: 'Ce qui compte davantage',
        paras: [
          'Les leviers documentés restent ceux de notre guide pilier : laisser passer les robots de recherche des IA, mettre le texte dans le HTML, dire clairement qui vous êtes, et écrire des passages qui se comprennent seuls. Le temps que vous auriez passé à peaufiner un llms.txt est mieux employé à réécrire votre page de service la plus importante pour qu’elle réponde en tête à la question du client.',
        ],
      },
    ],
    faq: [
      { q: 'llms.txt remplace-t-il robots.txt ?', a: 'Non. robots.txt dit aux robots ce qu’ils peuvent explorer ; llms.txt n’est qu’un résumé proposé aux modèles de langage et n’autorise ni n’interdit rien.' },
      { q: 'ChatGPT lit-il les fichiers llms.txt ?', a: 'OpenAI ne documente pas d’usage de ce fichier pour la recherche de ChatGPT. Selon Ahrefs, les robots de recherche des assistants ne représentaient que 1,1 % des requêtes vers ces fichiers en mai 2026.' },
      { q: 'Combien de temps faut-il pour en écrire un ?', a: 'Une vingtaine de minutes pour un site de dix à trente pages : un titre, un résumé de deux phrases, puis un lien commenté par page de service et par page pratique.' },
      { q: 'Un llms.txt peut-il nuire à mon référencement Google ?', a: 'Non : Google indique qu’il ignore ces fichiers. Le seul risque est d’y laisser des informations fausses ou périmées, que d’autres outils pourraient reprendre.' },
    ],
    sources: [
      { label: 'Answer.AI, Jeremy Howard, proposition llms.txt (3 septembre 2024)', url: 'https://www.answer.ai/posts/2024-09-03-llmstxt.md', note: VU },
      { label: 'Ahrefs, 97 % des fichiers llms.txt ne sont jamais lus (137 000 sites analysés)', url: 'https://ahrefs.com/fr/blog/llmstxt-study/', note: `publié le 15 juin 2026 ; ${VU}` },
      { label: 'Google Search Central, optimiser son site pour les fonctionnalités d’IA générative de la recherche Google', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide', note: `mis à jour le 10 juil. 2026 ; ${VU}` },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles (injection de consignes, langage artificiel)', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
    ],
    cta: { text: 'Vérifiez votre fichier llms.txt (format, liens, cohérence avec le site) avec l’outil gratuit.', href: '/outils/llms-txt', label: 'Tester mon llms.txt' },
    related: ['robots-ia-robots-txt', 'page-que-les-ia-citent', 'seo-geo-sites-pros-2026', 'apercus-ia-google'],
  },

  /* ------------------------------------------------------------------ */
  /* Perplexity                                                          */
  /* ------------------------------------------------------------------ */
  {
    slug: 'perplexity-sources',
    seoTitle: 'Perplexity : comment il choisit les sites qu’il cite',
    title: 'Perplexity : comment il choisit les sites qu’il cite',
    description:
      'Robots, recherche en temps réel, citations numérotées : comment Perplexity trouve et cite ses sources, et ce qu’un site pro peut faire pour être lu et cité.',
    updated: D,
    published: D,
    intro: [
      'Perplexity se présente comme un moteur de réponse : on lui pose une question, il cherche sur le web, rédige une synthèse et affiche ses sources sous forme de citations numérotées. Pour un site professionnel, c’est l’assistant le plus transparent : on voit qui est cité, et on peut cliquer. C’est aussi un bon terrain pour comprendre comment les moteurs d’IA choisissent leurs sources.',
      'Ce guide décrit ce que Perplexity documente lui-même, ce que des tiers ont observé, et ce que vous pouvez faire. Il ne prétend pas révéler un algorithme : Perplexity n’en publie pas le détail, et personne ne peut garantir une citation.',
    ],
    sections: [
      {
        h2: 'Ce que Perplexity dit de son fonctionnement',
        paras: [
          'Selon son centre d’aide, Perplexity utilise l’IA pour chercher sur internet en temps réel, comprend l’intention de la question, rassemble des informations issues de sites, d’articles et de revues, les résume en une réponse et accompagne chaque réponse de citations numérotées qui renvoient aux sources d’origine [1]. Les modes avancés (Pro Search, Deep Research) lancent davantage de recherches pour produire des réponses plus longues [1].',
          'Ce trajet a une conséquence directe : pour être cité, une page doit d’abord être trouvée par ces recherches, puis être lisible, puis contenir un passage qui répond à la question mieux que les autres pages lues. Chacune de ces étapes peut vous écarter.',
        ],
      },
      {
        h2: 'Étape 1 : laisser entrer les bons robots',
        paras: [
          'Perplexity documente deux robots [2]. PerplexityBot sert à faire apparaître et à lier des sites dans les résultats de Perplexity ; l’éditeur précise qu’il n’est pas utilisé pour entraîner des modèles de fondation, et recommande de l’autoriser dans robots.txt pour apparaître dans les résultats [2]. Perplexity-User visite une page quand un utilisateur pose une question qui le nécessite ; comme la visite est demandée par un utilisateur, ce robot ignore généralement les règles de robots.txt, selon la documentation [2]. Les changements de réglage peuvent mettre jusqu’à 24 heures à être pris en compte [2].',
        ],
        list: [
          'Ouvrez votresite.fr/robots.txt et cherchez « PerplexityBot » ou une règle générale « User-agent: * » suivie de « Disallow: / ».',
          'Vérifiez aussi votre pare-feu ou votre CDN : un blocage à ce niveau empêche la lecture même si robots.txt l’autorise.',
          'Si vous filtrez par adresse IP, Perplexity publie la liste des adresses de ses deux robots [2].',
        ],
        after: [
          'Un point de vigilance documenté : en août 2025, Cloudflare a accusé Perplexity d’utiliser, quand ses robots déclarés étaient bloqués, des robots non déclarés se présentant comme un navigateur Chrome, depuis des adresses hors de ses plages publiées, et a retiré Perplexity de sa liste de robots vérifiés [3]. Perplexity a contesté ces accusations. Pour vous, la leçon est pratique : bloquer un robot ne garantit pas que votre contenu ne sera jamais lu, et l’autoriser ne garantit pas d’être cité.',
        ],
      },
      {
        h2: 'Étape 2 : être trouvable par les recherches qu’il lance',
        paras: [
          'Avant de lire, Perplexity cherche. Il reformule la question en une ou plusieurs requêtes et récupère des pages candidates. Perplexity ne détaille pas publiquement les index qu’il interroge ; ce qui est sûr, c’est qu’une page qui n’existe pour aucun moteur, parce qu’elle est en noindex, orpheline ou très récente, a peu de chances d’être récupérée.',
          'Le travail de SEO classique reste donc le socle : des pages indexées, liées entre elles, avec un titre qui dit leur sujet. Une page « Nos services » fourre-tout se fait doubler par une page « Expert-comptable pour artisans à Rennes : tarifs et délais » quand la question porte sur ce sujet précis.',
        ],
      },
      {
        h2: 'Étape 3 : offrir des passages qui se citent seuls',
        paras: [
          'Une fois les pages lues, le moteur retient des passages. Une expérience de recherche publiée en 2024 (Aggarwal et al., KDD 2024) a mesuré que certaines modifications de contenu, comme l’ajout de citations de sources, de statistiques ou de phrases citées, peuvent augmenter jusqu’à 40 % la visibilité d’une page dans des réponses générées, avec des effets qui varient selon le domaine [4]. C’est une expérience de laboratoire, pas une mesure sur Perplexity en production ; elle confirme néanmoins une intuition utile : un passage précis, chiffré et sourcé a plus de chances d’être repris.',
        ],
        list: [
          'Répondez dans la première phrase de la section : « Le bilan annuel d’une micro-entreprise artisanale coûte entre 900 et 1 500 € HT au Cabinet Leroy (exemple fictif), selon le nombre de pièces. »',
          'Nommez le sujet dans chaque passage (« le bilan annuel », pas « il ») : un passage extrait de son contexte doit rester compréhensible.',
          'Datez les chiffres et citez vos propres sources (texte de loi, barème officiel).',
          'Un sujet par section, avec un titre qui reprend la question du client.',
        ],
        after: ['Notre guide « Écrire une page que les IA citent » détaille ces règles une par une.'],
      },
      {
        h2: 'Étape 4 : exister là où Perplexity va chercher',
        paras: [
          'Une étude de l’université de Toronto (prépublication de septembre 2025) observe que les moteurs d’IA citent très majoritairement des sources tierces (médias, comparatifs, annuaires) plutôt que les sites des marques, alors que Google garde un mélange plus équilibré [5]. Pour les logiciels au Canada, par exemple, les moteurs d’IA étudiés citaient 74,2 % de sources tierces contre 31,8 % pour Google [5].',
          'Perplexity étant transparent, vous pouvez vérifier vous-même dans votre secteur : posez dix questions de clients, ouvrez les sources citées, et classez-les. Vous saurez quels comparatifs, annuaires ou médias comptent pour vous, et où vos concurrents figurent sans vous.',
        ],
      },
      {
        h2: 'Une méthode de test en une heure',
        list: [
          'Écrivez dix questions que poserait un client qui ne vous connaît pas, sans citer votre nom : « quel expert-comptable à Rennes pour un artisan ? », « combien coûte un bilan de micro-entreprise ? ».',
          'Posez chaque question deux fois dans Perplexity, dans une conversation neuve, en notant la date.',
          'Pour chaque réponse, relevez : votre nom cité ou non, les concurrents cités, les sources numérotées et leur type (site de marque, annuaire, média, forum).',
          'Repérez les questions où une de vos pages aurait dû être citée et ne l’est pas, puis comparez-la à la page citée : réponse plus directe ? chiffre ? date ? page plus spécifique ?',
          'Refaites le même test dans six semaines, avec les mêmes questions.',
        ],
        after: ['Les réponses varient d’une fois à l’autre. Ne tirez aucune conclusion d’un seul essai ; regardez des fréquences sur l’ensemble des questions.'],
      },
      {
        h2: 'Ce qui ne marche pas',
        list: [
          'Les textes cachés ou les consignes adressées à l’IA dans la page : c’est de la manipulation, détectable, et contraire aux règles de la plupart des moteurs.',
          'Multiplier des pages quasi identiques pour chaque formulation de question : elles se concurrencent et diluent vos passages.',
          'Acheter des articles sponsorisés sans les déclarer comme tels : c’est un risque juridique et de réputation, pour un bénéfice incertain.',
          'Compter sur un fichier llms.txt : rien dans la documentation de Perplexity que nous avons consultée n’en fait un critère.',
        ],
      },
      {
        h2: 'Les obstacles techniques les plus fréquents',
        paras: ['Dans les sites que nous analysons, quatre problèmes reviennent souvent et suffisent à rendre une page illisible ou inutilisable pour un moteur de réponse.'],
        list: [
          'Le texte principal n’apparaît qu’après exécution de JavaScript : un robot qui lit le HTML brut voit une page presque vide. Testez votre page avec un outil qui affiche le rendu sans JavaScript.',
          'Une protection anti-robots trop zélée renvoie une page de vérification (« vérifiez que vous êtes humain ») à tous les robots, y compris ceux que vous voulez laisser passer.',
          'Les informations clés sont dans des images (tarifs en JPG, horaires en bannière) : elles ne sont pas lues comme du texte.',
          'Les pages importantes sont derrière un formulaire ou un espace client : aucun moteur ne les verra.',
        ],
        after: ['Ces corrections sont souvent rapides et profitent aussi à Google, à Bing et aux autres assistants. Elles passent avant toute réécriture.'],
      },
      {
        h2: 'Mesurer les visites venues de Perplexity',
        paras: [
          'Quand un lecteur clique sur une citation, il arrive sur votre site avec Perplexity comme site d’origine, que vous pouvez isoler dans vos statistiques (notre guide GA4 explique comment). C’est un plancher : beaucoup de lecteurs se contentent de la réponse sans cliquer. Le suivi régulier des citations, par questions répétées, reste la mesure la plus directe de votre présence.',
        ],
      },
    ],
    faq: [
      { q: 'Bloquer PerplexityBot empêche-t-il Perplexity de lire mon site ?', a: 'Il empêche le robot d’indexation déclaré. Perplexity-User, déclenché par un utilisateur, ignore généralement robots.txt selon la documentation, et un pare-feu reste le seul blocage effectif.' },
      { q: 'Faut-il écrire différemment pour Perplexity et pour Google ?', a: 'Non. Les mêmes qualités servent aux deux : une page indexable, un titre précis, une réponse directe en tête de section, des faits datés et sourcés. Il n’existe pas d’écriture propre à Perplexity.' },
      { q: 'Perplexity utilise-t-il mes pages pour entraîner ses modèles ?', a: 'Selon sa documentation, PerplexityBot n’est pas utilisé pour entraîner des modèles de fondation : il sert à faire apparaître et lier les sites dans les résultats.' },
      { q: 'Combien de temps avant d’être cité ?', a: 'Personne ne peut le dire. Une correction d’accès est prise en compte sous 24 heures environ ; une page nouvelle doit ensuite être trouvée et jugée utile, ce qui peut prendre des semaines, ou ne jamais arriver.' },
    ],
    sources: [
      { label: 'Centre d’aide Perplexity, comment fonctionne Perplexity', url: 'https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work.md', note: VU },
      { label: 'Documentation Perplexity, PerplexityBot et Perplexity-User', url: 'https://docs.perplexity.ai/guides/perplexitybot', note: VU },
      { label: 'Blog Cloudflare, Perplexity utilise des robots non déclarés (4 août 2025)', url: 'https://blog.cloudflare.com/perplexity-is-using-stealth-undeclared-crawlers-to-evade-website-no-crawl-directives/', note: `accusation contestée par Perplexity ; ${VU}` },
      { label: 'Aggarwal et al., GEO: Generative Engine Optimization (KDD 2024)', url: 'https://arxiv.org/abs/2311.09735v3', note: `expérience en laboratoire ; ${VU}` },
      { label: 'Chen et al., Université de Toronto, Generative Engine Optimization: How to Dominate AI Search', url: 'https://arxiv.org/html/2509.08919v1', note: `prépublication, septembre 2025 ; ${VU}` },
    ],
    cta: { text: 'PerplexityBot peut-il lire vos pages, et votre texte est-il visible sans JavaScript ? L’outil gratuit le vérifie robot par robot.', href: '/outils/robots-ia', label: 'Tester l’accès des robots d’IA' },
    related: ['robots-ia-robots-txt', 'page-que-les-ia-citent', 'suivre-ses-questions-chatgpt', 'bing-copilot-indexnow'],
  },

  /* ------------------------------------------------------------------ */
  /* Bing et Copilot                                                     */
  /* ------------------------------------------------------------------ */
  {
    slug: 'bing-copilot-indexnow',
    seoTitle: 'Bing et Copilot : pourquoi Bing compte encore en 2026',
    title: 'Bing et Copilot : pourquoi Bing compte encore en 2026',
    description:
      'Copilot répond avec Bing : inscrire son site dans Bing Webmaster Tools, utiliser IndexNow, lire le rapport des citations IA et suivre les consignes 2026.',
    updated: D,
    published: D,
    intro: [
      'Beaucoup de sites professionnels n’ont jamais ouvert Bing Webmaster Tools. C’est compréhensible : Bing pèse peu dans les visites de la plupart des sites français. Mais Bing n’est plus seulement un moteur de recherche : c’est la source web de Copilot, l’assistant de Microsoft intégré à Windows, Edge et aux outils de bureautique de nombreuses entreprises.',
      'Ce guide montre comment s’y inscrire en dix minutes, ce que le rapport de citations IA de Bing permet de voir, et ce que les consignes de Bing, réécrites en 2026, demandent aux sites. Il intéresse particulièrement les PME qui vendent à d’autres entreprises, dont les acheteurs travaillent souvent dans un environnement Microsoft.',
    ],
    sections: [
      {
        h2: 'Copilot répond avec Bing',
        paras: [
          'Microsoft l’écrit dans sa documentation : quand la recherche web est activée, Copilot peut interroger le service de recherche Bing lorsque des informations du web aident à fournir une réponse mieux fondée ; il génère pour cela une requête courte, dérivée de la question de l’utilisateur, envoyée à Bing, puis utilise les résultats pour composer sa réponse [1]. Dans Copilot Chat, les requêtes envoyées à Bing sont même affichées dans la section des citations [1].',
          'La conséquence est simple : une page absente de l’index de Bing ne peut pas servir de source à Copilot par ce canal. Si vos clients utilisent Copilot au bureau, Bing est votre porte d’entrée.',
        ],
      },
      {
        h2: 'Pourquoi c’est surtout l’affaire des PME qui vendent aux entreprises',
        paras: [
          'Selon l’enquête de Forrester sur le parcours des acheteurs en 2025, 94 % des acheteurs professionnels utilisent l’IA dans leur processus d’achat, et 61 % utilisent des outils d’IA privés fournis par leur organisation [7]. Dans beaucoup d’entreprises françaises, l’outil fourni est Copilot, parce qu’il est inclus dans l’environnement Microsoft déjà en place. Forrester ne détaille pas la part de chaque assistant ; l’ordre de grandeur suffit à montrer que la question n’est pas marginale.',
          'Concrètement, quand un responsable des achats demande à Copilot, depuis son poste de travail, « quels prestataires de maintenance industrielle dans la région de Lyon ? », la réponse s’appuie sur ce que Bing a indexé. Un fabricant ou un prestataire B2B absent de Bing se prive de ce canal, même s’il est bien placé dans Google.',
        ],
      },
      {
        h2: 'Étape 1 : inscrire le site dans Bing Webmaster Tools',
        paras: [
          'Le plus rapide est d’importer votre site depuis la Google Search Console. Bing Webmaster Tools propose cet import depuis 2019 : les sites importés sont validés automatiquement, sans autre étape de vérification, et leurs sitemaps sont repris [4]. Les données de trafic peuvent mettre jusqu’à 48 heures à apparaître [4].',
        ],
        list: [
          'Créez un compte Bing Webmaster Tools avec un compte Microsoft professionnel.',
          'Choisissez l’import depuis Google Search Console et sélectionnez votre site.',
          'Vérifiez que le sitemap apparaît et ne contient pas d’erreur.',
          'Si l’import n’est pas possible, validez le site par balise meta ou enregistrement DNS [4].',
        ],
        after: ['Bing vérifie périodiquement la propriété via votre compte Search Console ; si vous révoquez cet accès, il faudra revalider le site autrement [4].'],
      },
      {
        h2: 'Étape 2 : signaler vos changements avec IndexNow',
        paras: [
          'IndexNow est un protocole qui permet de prévenir les moteurs participants dès qu’une page est créée, modifiée ou supprimée, au lieu d’attendre leur prochain passage. Le site officiel liste Bing, Yandex, Naver, Seznam, Yep et Amazon parmi les points d’entrée, et précise qu’une notification envoyée à l’un est partagée avec tous les moteurs participants [3]. Google n’y figure pas [3].',
          'La mise en place manuelle consiste à créer une clé, la déposer dans un fichier texte à la racine du site, puis envoyer les adresses modifiées [3]. En pratique, de nombreux outils et extensions de gestion de site proposent de le faire automatiquement ; vérifiez dans les réglages du vôtre avant de faire appel à un développeur.',
        ],
      },
      {
        h2: 'Étape 3 : lire le rapport sur les citations dans les réponses IA',
        paras: [
          'C’est la nouveauté la plus utile de 2026. Bing Webmaster Tools propose un rapport « AI Performance », lancé en préversion publique en février 2026, qui montre où votre contenu est cité dans les réponses générées par l’IA, dans Microsoft Copilot, dans Bing et dans certaines expériences partenaires [2]. En juin 2026, Microsoft a annoncé en préversion quatre compléments : le classement des requêtes par intention, leur regroupement par thème, une part de citations (le pourcentage des citations affichées pour une requête qui renvoient vers votre site) et une comparaison entre périodes [2].',
          'Microsoft prend soin de préciser que cette part de citations est une mesure d’observation, pas un classement ni un tableau de compétition, et qu’elle ne montre pas les domaines concurrents [2]. C’est l’une des rares données de première main sur les citations par une IA : elle vaut d’être consultée chaque mois, même si elle ne couvre que l’univers Microsoft.',
        ],
      },
      {
        h2: 'Étape 4 : respecter les consignes de Bing, réécrites pour l’IA',
        paras: [
          'Les consignes pour les webmasters de Bing ont été réécrites en février 2026 ; elles nomment désormais le GEO et précisent qu’il ne garantit pas plus les citations que le SEO ne garantit les positions [5]. Les points pratiques :',
        ],
        list: [
          'Énoncer les faits directement plutôt que les suggérer, pour qu’un système puisse les vérifier [5].',
          'Des noms d’entité clairs et constants : votre entreprise, vos produits, vos dirigeants écrits de la même façon partout [5].',
          'Un sujet par adresse, et l’information essentielle en haut de la page [5].',
          'Pas de langage artificiellement conçu pour déclencher des citations : le bourrage de mots-clés est rebaptisé « Keyword Stuffing and Artificially Engineered Language » [5].',
          'Pas d’injection de consignes adressées aux modèles : une section entière y est consacrée [5].',
          'Le contenu produit en masse sans supervision, contrôle qualité ni relecture éditoriale est visé, plutôt que tout contenu généré par machine [5].',
        ],
      },
      {
        h2: 'Étape 5 : la fiche Bing Places pour les commerces',
        paras: [
          'Si vous recevez des clients, ouvrez aussi une fiche Bing Places for Business, gratuite, accessible depuis bing.com/forbusiness depuis octobre 2025, avec import possible des informations existantes [6]. Notre guide sur les annuaires détaille la démarche et la règle de cohérence entre fiches.',
        ],
      },
      {
        h2: 'Que faire des données de citations',
        paras: [
          'Le rapport AI Performance montre des « grounding queries », c’est-à-dire les requêtes de fond que Copilot ou Bing ont lancées pour construire une réponse, et les pages de votre site qui ont été citées [2]. Trois lectures sont utiles.',
        ],
        list: [
          'Les pages citées : ce sont vos pages qui « répondent ». Vérifiez qu’elles sont à jour, que leurs chiffres sont exacts et qu’elles mènent vers une action (devis, contact, produit).',
          'Les requêtes de fond : elles révèlent comment l’IA reformule les questions de vos clients. Une requête récurrente à laquelle seule une page secondaire répond mérite parfois une page dédiée.',
          'L’évolution dans le temps : la fonction de comparaison entre périodes [2] aide à voir si une réécriture a coïncidé avec plus ou moins de citations. Coïncidé seulement : d’autres facteurs jouent, à commencer par ce que publient vos concurrents.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes dans Bing Webmaster Tools',
        list: [
          'Un sitemap déclaré dans Google mais pas dans Bing, ou l’inverse, après une refonte : vérifiez que les deux outils pointent vers le même fichier, à jour.',
          'Un site validé avec le compte personnel d’un ancien prestataire : récupérez l’accès au nom de l’entreprise, comme pour la Search Console.',
          'Des pages bloquées pour Bingbot par une règle de robots.txt oubliée ou par le pare-feu : le rapport d’exploration les signale, encore faut-il l’ouvrir.',
          'La version avec et sans « www », ou en http et https, déclarée séparément sans redirection propre entre elles : choisissez une version et redirigez les autres.',
        ],
      },
      {
        h2: 'Ce que Bing ne vous dira pas',
        list: [
          'Le rapport AI Performance ne couvre pas ChatGPT, Gemini ni Perplexity. Pour ceux-là, il faut mesurer par questions répétées.',
          'Une présence dans l’index de Bing ne garantit pas une citation dans Copilot : elle la rend seulement possible.',
          'Les chiffres de part de citations portent sur les requêtes où vous êtes déjà cité au moins une fois ; ils ne disent rien des questions où vous êtes absent.',
          'L’effet de Bing sur ChatGPT n’est pas documenté officiellement par OpenAI, qui décrit ses propres robots et ne publie pas la liste de ses fournisseurs de résultats.',
        ],
      },
      {
        h2: 'La routine mensuelle',
        list: [
          'Ouvrir le rapport de performance de Bing : pages qui gagnent ou perdent des clics.',
          'Ouvrir le rapport AI Performance : pages citées, requêtes de fond, évolution sur la période.',
          'Vérifier les erreurs d’exploration et le sitemap.',
          'Comparer avec la Search Console : une page bien placée dans Google mais absente de Bing mérite un coup d’œil (blocage, redirection, page récente non signalée).',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il un compte Microsoft payant ?', a: 'Non. Bing Webmaster Tools et Bing Places for Business sont gratuits. Un simple compte Microsoft suffit, idéalement au nom de l’entreprise plutôt que d’un salarié.' },
      { q: 'IndexNow fonctionne-t-il avec Google ?', a: 'Google ne figure pas parmi les moteurs listés sur le site officiel d’IndexNow. Pour Google, le sitemap et la Search Console restent les outils de référence.' },
      { q: 'Bing a-t-il un effet sur ChatGPT ?', a: 'OpenAI ne publie pas la liste de ses fournisseurs de résultats de recherche. Être bien indexé dans Bing ne fait pas de mal, mais aucune source officielle ne permet d’en promettre un effet sur ChatGPT.' },
      { q: 'Le rapport AI Performance montre-t-il mes concurrents ?', a: 'Non. Microsoft précise que la part de citations est une mesure d’observation qui n’expose pas les domaines concurrents.' },
    ],
    sources: [
      { label: 'Microsoft Learn, recherche web dans Copilot avec Bing', url: 'https://learn.microsoft.com/microsoft-365-copilot/manage-public-web-access', note: VU },
      { label: 'Blog Bing, nouvelles données de visibilité IA dans Bing Webmaster Tools (juin 2026)', url: 'https://blogs.bing.com/search/June-2026/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare', note: `préversion ; ${VU}` },
      { label: 'IndexNow, questions fréquentes (moteurs participants, clé)', url: 'https://www.indexnow.org/en_gb/faq', note: VU },
      { label: 'Blog Bing Webmaster, importer ses sites depuis Google Search Console', url: 'https://blogs.bing.com/webmaster/september-2019/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools', note: `13 sept. 2019, mis à jour en juin 2025 ; ${VU}` },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
      { label: 'Blog Bing, le nouveau Bing Places for Business (octobre 2025)', url: 'https://blogs.bing.com/search/October-2025/Introducing-the-New-Bing-Places-for-Business-Built-for-Business-Owners,-Powered-by-Research', note: VU },
      { label: 'Forrester, B2B Buyers Make Zero-Click Number One (enquête Buyers’ Journey 2025)', url: 'https://www.forrester.com/blogs/b2b_buyers_make_zero_click_buying_number_one/', note: `22 janv. 2026, taille d’échantillon non précisée dans l’article ; ${VU}` },
    ],
    cta: { text: 'Avant Bing, vérifiez que votre site est lisible : robots, pages indexables, sitemap. L’analyse gratuite le contrôle en 60 secondes.', ...CTA },
    related: ['search-console-debutants', 'annuaires-locaux-bing-apple', 'perplexity-sources', 'seo-b2b-acheteurs'],
  },

  /* ------------------------------------------------------------------ */
  /* Aperçus IA de Google                                                */
  /* ------------------------------------------------------------------ */
  {
    slug: 'apercus-ia-google',
    seoTitle: 'Aperçus IA et mode IA de Google : ce qui change',
    title: 'Aperçus IA de Google : ce qui change pour votre site',
    description:
      'Lancés en France le 22 juillet 2026, les aperçus IA et le mode IA changent la page de résultats. Ce que Google demande, ce qu’il ignore, comment mesurer.',
    updated: D,
    published: D,
    intro: [
      'Depuis l’été 2026, une partie des recherches sur Google en France affiche, au-dessus des liens, un paragraphe rédigé par l’IA : l’aperçu IA. Un onglet « Mode IA » permet aussi de poursuivre la recherche sous forme de conversation. Pour les sites professionnels, la question est double : comment y figurer, et que deviennent les clics ?',
      'Ce guide s’appuie sur ce que Google a publié officiellement, notamment son guide de mai 2026 sur l’optimisation pour ses fonctionnalités d’IA générative. Il sépare les faits, les recommandations et ce qui reste inconnu.',
    ],
    sections: [
      {
        h2: 'Ce qui a été lancé, et quand',
        paras: [
          'Google a annoncé le lancement des aperçus IA et du mode IA dans la recherche en France le 22 juillet 2026, sur mobile, sur ordinateur et dans l’application Google, après un déploiement mondial commencé en mai 2024 [1]. Selon Google, les aperçus IA proposent des liens pour approfondir, et le mode IA affiche des liens visibles vers les sites [1]. Le seul chiffre communiqué à cette occasion est qu’une recherche en mode IA dure en moyenne trois fois plus longtemps qu’une recherche classique [1].',
          'Google a aussi annoncé, dans la Search Console, un réglage permettant aux propriétaires de sites de choisir si leur contenu apparaît dans ces fonctionnalités, en précisant que ce choix n’est pas un critère de classement en dehors de celles-ci [1].',
        ],
      },
      {
        h2: 'Comment Google construit ces réponses',
        paras: [
          'Google décrit une technique appelée « query fan-out » : le modèle génère un ensemble de requêtes liées, lancées en parallèle, pour rassembler davantage d’informations [2]. Son exemple : une question sur les mauvaises herbes du gazon se décline en recherches sur les désherbants et la prévention [2]. La réponse s’appuie ensuite sur des pages trouvées par ces recherches.',
          'Pour un site, cela signifie qu’une page peut être reprise dans un aperçu IA pour une question qu’elle ne vise pas mot pour mot, parce qu’elle répond bien à l’un des sous-sujets. Une page qui traite précisément un aspect (« délai de séchage d’une chape avant pose de parquet ») a sa chance, même si la question posée était plus large (« rénover un sol »).',
        ],
      },
      {
        h2: 'Les conditions d’éligibilité',
        paras: [
          'Le guide de Google est court sur ce point : pour pouvoir apparaître dans les fonctionnalités d’IA générative de la recherche, une page doit être indexée, et le site doit être inclus dans ces fonctionnalités dans la Search Console [2]. Il n’y a pas de procédure d’inscription, pas de balisage spécial, pas de fichier à déposer.',
        ],
        list: [
          'Pas de fichier dédié : Google écrit qu’il n’est pas nécessaire de créer de nouveaux fichiers lisibles par machine, fichiers texte pour l’IA, balisage ou Markdown, et que sa recherche ignore ces fichiers [2].',
          'Pas de schema.org spécial : les données structurées ne sont pas requises pour la recherche générative, même si elles restent utiles pour les résultats enrichis [2].',
          'Pas besoin de découper le texte en petits morceaux « pour l’IA » [2].',
          'Pas de mentions artificielles : rechercher des mentions inauthentiques sur le web est moins utile qu’il n’y paraît, et les systèmes de Google savent distinguer [2].',
        ],
        after: ['Autrement dit, Google dit que l’optimisation pour ses réponses IA, c’est du SEO. Les agences qui vendent un « SEO pour les aperçus IA » distinct de l’autre vendent surtout un nom.'],
      },
      {
        h2: 'Ce qui aide vraiment à être repris',
        paras: ['À partir des principes de contenu utile de Google [4] et de ce que nous observons dans les réponses, cinq points font la différence :'],
        list: [
          'Une réponse directe en début de section, qui se comprend sans le reste de la page.',
          'Des faits précis et datés : prix, délais, normes, quantités, avec leur source.',
          'Une expertise visible : qui écrit, quelle expérience, quelles réalisations. Google rappelle que la confiance est l’aspect le plus important de ce qu’il appelle E-E-A-T [4].',
          'Une page par sujet, avec un titre qui le dit.',
          'Une technique propre : page indexable, texte dans le HTML, temps de chargement raisonnable sur mobile.',
        ],
      },
      {
        h2: 'Contrôler ce qui est repris',
        paras: [
          'Si vous souhaitez limiter la reprise de certains contenus, Google propose des balises de contrôle des extraits : nosnippet empêche l’affichage d’un extrait pour une page, max-snippet en limite la longueur, et l’attribut data-nosnippet exclut une partie précise de la page [3]. Ces réglages valent pour les extraits de la recherche ; réfléchissez avant de les utiliser, car une page sans extrait perd aussi en attrait dans les résultats classiques.',
          'Le réglage d’exclusion annoncé dans la Search Console pour la France [1] est l’autre levier. Pour un site professionnel qui cherche des clients, l’exclusion a rarement du sens : elle retire une occasion d’être cité sans protéger grand-chose. Pour un éditeur dont le contenu est le produit, la question se pose différemment.',
        ],
      },
      {
        h2: 'Google-Extended ne règle pas les aperçus IA',
        paras: [
          'Une confusion fréquente consiste à bloquer Google-Extended dans robots.txt en pensant sortir des aperçus IA. Google-Extended est un jeton de contrôle qui permet de refuser que les contenus explorés par Google servent à l’entraînement et à l’ancrage des modèles Gemini, dans les applications Gemini et Vertex AI ; Google précise qu’il n’a aucun effet sur l’inclusion d’un site dans la recherche Google ni sur son classement [5].',
          'Les aperçus IA et le mode IA font partie de la recherche : ils dépendent de l’exploration par Googlebot, de l’indexation, des balises d’extrait et du réglage de la Search Console décrit plus haut. Bloquer Googlebot pour sortir des aperçus IA, c’est sortir de Google tout court.',
        ],
      },
      {
        h2: 'Exemple : adapter une page aux sous-questions',
        paras: [
          'Prenons un exemple fictif : une entreprise de rénovation de sols à Bordeaux, dont la page « Pose de parquet » décrit les prestations en termes commerciaux. Une personne demande au mode IA « comment rénover le sol d’une maison ancienne ». Le système lance des recherches sur les types de sol, les délais, les prix et les précautions [2]. La page actuelle ne répond à aucune de ces sous-questions de façon nette.',
          'La version réécrite ajoute quatre sections courtes, chacune avec son titre : « Combien de temps attendre après une chape avant de poser un parquet ? », « Quel parquet sur un plancher chauffant ? », « Prix de la pose au mètre carré à Bordeaux en 2026 », « Ce que nous vérifions avant de poser sur un sol ancien ». Chaque section commence par la réponse, chiffrée quand c’est possible, et se termine par ce que l’entreprise fait concrètement. Rien de tout cela n’est écrit « pour l’IA » : c’est ce que le client demande au téléphone. C’est aussi ce qui donne à la page des chances d’être reprise sur l’un des sous-sujets.',
        ],
      },
      {
        h2: 'Mesurer l’effet sur votre site',
        paras: [
          'Google recommande d’utiliser le rapport de performance consacré à l’IA générative dans la Search Console pour voir comment votre contenu se comporte dans ces fonctionnalités [2]. Il prévient aussi qu’aucun outil tiers n’a accès à ses systèmes internes de classement ou d’IA [2] : méfiez-vous des tableaux de bord qui prétendent connaître votre « score » dans les aperçus IA.',
        ],
        list: [
          'Comparez les impressions et les clics de vos pages clés sur les trois mois précédant le 22 juillet 2026 et les trois mois suivants, à saisonnalité comparable.',
          'Repérez les pages dont les impressions montent et les clics baissent : ce sont souvent des pages informatives dont la réponse est désormais donnée dans la page de résultats.',
          'Regardez les pages qui convertissent (devis, appels, ventes), plutôt que le trafic total : une baisse de visites purement informatives peut ne rien coûter.',
          'Notez les dates des mises à jour de Google pour ne pas attribuer à l’IA un effet qui vient d’ailleurs.',
        ],
      },
      {
        h2: 'Ce qu’on ne sait pas encore',
        list: [
          'Le volume de clics perdus ou gagnés pour les sites français : Google n’a pas publié de chiffre pour la France, et les études tierces portent surtout sur les États-Unis.',
          'La part de recherches françaises qui affichent un aperçu IA, qui dépend du type de requête et évolue.',
          'L’effet à long terme sur les requêtes locales et commerciales, où la page de résultats mêle déjà carte, fiches et publicités.',
        ],
        after: ['Nous mettrons ce guide à jour quand des données françaises solides seront publiées. D’ici là, votre propre Search Console est la meilleure source.'],
      },
      {
        h2: 'Le plan d’action',
        list: [
          'Vérifier que vos pages importantes sont indexées (rapport d’indexation de la Search Console).',
          'Vérifier que votre site est bien inclus dans les fonctionnalités d’IA générative dans la Search Console.',
          'Réécrire le début de vos cinq pages clés pour qu’il réponde directement à la question du client.',
          'Ajouter faits datés, auteurs et preuves là où ils manquent.',
          'Mesurer à trois mois, sur les pages qui comptent pour votre chiffre d’affaires.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il un balisage spécial pour apparaître dans les aperçus IA ?', a: 'Non. Google indique que les données structurées ne sont pas requises et qu’aucun balisage schema.org particulier n’est nécessaire. Une page indexée et utile est la condition.' },
      { q: 'Google-Extended contrôle-t-il les aperçus IA ?', a: 'Non. Selon Google, Google-Extended concerne l’entraînement et l’ancrage des modèles Gemini et n’a aucun effet sur l’inclusion ni le classement dans la recherche, dont font partie les aperçus IA.' },
      { q: 'Les aperçus IA font-ils baisser le trafic ?', a: 'Cela dépend des pages. Les pages purement informatives peuvent perdre des clics, les pages de service ou de produit beaucoup moins. Mesurez sur vos propres données avant et après le 22 juillet 2026.' },
    ],
    sources: [
      { label: 'Blog Google France, lancement des aperçus IA et du mode IA dans la recherche Google en France', url: 'https://blog.google/intl/fr-fr/nouveautes-produits/explorez-obtenez-des-r%C3%A9ponses/recherche-ia-apercus-mode/', note: `22 juil. 2026 ; ${VU}` },
      { label: 'Google Search Central, optimiser son site pour les fonctionnalités d’IA générative de la recherche Google', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide', note: `publié en mai 2026, mis à jour le 10 juil. 2026 ; ${VU}` },
      { label: 'Google Search Central, contrôler les extraits (nosnippet, max-snippet, data-nosnippet)', url: 'https://developers.google.com/search/docs/appearance/snippet', note: VU },
      { label: 'Google Search Central, créer des contenus utiles et fiables', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Google, liste des robots d’exploration courants (Google-Extended)', url: 'https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers?hl=en', note: VU },
    ],
    cta: { text: 'Vos pages clés sont-elles indexables et répondent-elles en tête à la question du client ? L’analyse le vérifie page par page.', ...CTA },
    related: ['seo-geo-sites-pros-2026', 'search-console-debutants', 'llms-txt-faut-il-en-creer-un', 'contenu-ecrit-avec-ia'],
  },

  /* ------------------------------------------------------------------ */
  /* Contenu écrit avec l’IA                                             */
  /* ------------------------------------------------------------------ */
  {
    slug: 'contenu-ecrit-avec-ia',
    seoTitle: 'Contenu écrit avec l’IA : ce que Google accepte vraiment',
    title: 'Contenu écrit avec l’IA : ce que Google accepte vraiment',
    description:
      'Google ne sanctionne pas l’IA en soi mais le contenu sans valeur produit en masse. Ce que disent ses règles, ses évaluateurs et Bing, et comment relire.',
    updated: D,
    published: D,
    intro: [
      'Rédiger ses pages avec ChatGPT, Claude ou Gemini est devenu courant, y compris dans les TPE. La question revient sans cesse : Google pénalise-t-il les textes écrits par une IA ? La réponse officielle est non, mais avec des conditions précises, et les dérives coûtent cher.',
      'Ce guide reprend ce que Google et Bing ont écrit noir sur blanc, ce que les évaluateurs humains de Google ont pour consigne de noter, et propose une méthode de travail pour utiliser l’IA sans produire du contenu interchangeable. Ce guide a lui-même été rédigé avec l’aide d’un outil d’IA, puis vérifié source par source.',
    ],
    sections: [
      {
        h2: 'La règle de Google : la valeur, pas l’outil',
        paras: [
          'La documentation de Google sur le contenu généré par IA, mise à jour le 1er octobre 2026, ne l’interdit pas. Elle demande de se concentrer sur l’exactitude, la qualité et la pertinence, surtout quand le contenu est produit automatiquement [1]. Elle avertit que les modèles prédisent des suites de mots probables plutôt que de retrouver des faits, et qu’il est « essentiel » de vérifier et relire manuellement tout contenu généré avant publication [1].',
          'La limite est fixée par les règles anti-spam : la production de nombreuses pages principalement pour manipuler le classement, sans aider les utilisateurs, relève de l’abus de contenu à grande échelle, « quelle que soit la façon dont il est créé » [2]. Parmi les exemples cités par Google : l’usage d’outils d’IA générative pour produire de nombreuses pages sans valeur ajoutée [2].',
        ],
      },
      {
        h2: 'Ce que notent les évaluateurs de Google',
        paras: [
          'Google emploie des évaluateurs humains qui notent la qualité des résultats selon des consignes publiques. Ces notes ne classent pas directement les pages, mais elles servent à évaluer les systèmes de classement. La mise à jour de janvier 2025 de ces consignes demande d’attribuer la note la plus basse quand la quasi-totalité du contenu principal est automatisée ou générée par IA avec peu d’effort, d’originalité ou de valeur ajoutée, même si la page crédite une autre source [3].',
          'Les consignes ne donnent pas de méthode de détection de l’IA ; elles signalent plutôt des indices de contenu paraphrasé, comme des tournures typiques des résumés automatiques [3]. Le critère n’est donc pas « écrit par une machine » mais « n’apporte rien ».',
        ],
      },
      {
        h2: 'Ce que dit Bing',
        paras: [
          'Les consignes de Bing, réécrites en février 2026, vont dans le même sens. Elles ne visent plus tout contenu généré par machine, mais le contenu produit à grande échelle sans supervision, sans contrôle qualité ni relecture éditoriale [6]. Elles visent aussi le langage artificiellement conçu pour déclencher des citations dans les réponses d’IA [6].',
        ],
      },
      {
        h2: 'Les métadonnées aussi',
        paras: [
          'Google précise que ses exigences s’appliquent aux métadonnées générées : balises title, meta descriptions, données structurées et textes alternatifs des images, qui peuvent apparaître dans les résultats [1]. Un générateur de titres qui produit trois cents variantes de « Meilleur [produit] pas cher » est concerné au même titre que le corps du texte.',
          'Pour les sites marchands, Google ajoute des exigences spécifiques : les images générées par IA doivent porter la métadonnée IPTC DigitalSourceType avec la valeur TrainedAlgorithmicMedia, et les titres et descriptions de produits générés par IA doivent être déclarés séparément et signalés comme tels [1]. Notre guide Merchant Center y revient.',
        ],
      },
      {
        h2: 'Les questions que Google pose à un contenu',
        paras: ['Google propose une grille d’auto-évaluation [4]. Trois questions suffisent à trier la plupart des textes produits avec une IA :'],
        list: [
          'Le contenu apporte-t-il une information, une analyse ou une recherche originale [4] ? Une reformulation de ce qui existe déjà ne le fait pas.',
          'Est-ce le genre de page que l’on voudrait garder, partager ou recommander [4] ?',
          'Contient-il des erreurs factuelles faciles à vérifier [4] ? C’est le défaut le plus fréquent des textes générés : un chiffre plausible et faux, une norme périmée, un article de loi inventé.',
        ],
        after: [
          'Google invite aussi à se demander qui a créé le contenu, comment et pourquoi ; la bonne réponse au « pourquoi » est d’aider les gens, pas principalement d’attirer des visites depuis les moteurs [4]. La même documentation suggère, lorsque c’est pertinent pour vos lecteurs, d’indiquer comment le contenu a été produit [1].',
        ],
      },
      {
        h2: 'Une méthode de travail en six étapes',
        paras: ['Voici la méthode que nous recommandons à un dirigeant ou à une petite équipe, pour une page de service ou un article.'],
        list: [
          'Partir de vos faits, pas de l’IA : notez d’abord ce que vous seul savez (prix réels, délais, cas clients autorisés, erreurs fréquentes que vous voyez, questions qu’on vous pose).',
          'Demander à l’IA un plan et un premier jet à partir de ces notes, en lui interdisant d’ajouter des chiffres que vous n’avez pas fournis.',
          'Vérifier chaque fait du texte : chaque chiffre, chaque date, chaque mention réglementaire doit avoir une source que vous avez ouverte.',
          'Réécrire l’introduction et la conclusion vous-même : c’est là que les textes générés sont les plus génériques.',
          'Faire relire par la personne qui connaît le sujet (le technicien, le comptable, le chef d’atelier).',
          'Signer et dater la page, et noter dans votre suivi la date de la prochaine vérification.',
        ],
      },
      {
        h2: 'Exemple : la même page, avant et après relecture',
        paras: [
          'Exemple fictif : un cabinet de paysagistes à Angers demande à une IA une page « Entretien de jardin pour les entreprises ». Le premier jet commence par « L’entretien des espaces verts est un enjeu majeur pour l’image de votre entreprise » et aligne huit avantages génériques. Il affirme aussi que les contrats d’entretien sont « déductibles à 100 % », ce qui mérite au minimum une vérification auprès d’un comptable, et ne dit rien du prix.',
          'La version relue commence par la réponse : « Nous entretenons les espaces verts de 40 entreprises et copropriétés autour d’Angers, avec un passage toutes les deux semaines d’avril à octobre et un passage par mois l’hiver. » Suivent une fourchette de prix au mètre carré, ce qui est compris (tonte, taille, ramassage, évacuation des déchets verts), ce qui ne l’est pas, deux exemples de contrats décrits sans nom de client, et les questions posées par les gestionnaires de site. La phrase fiscale a disparu, faute de source.',
          'La différence ne tient pas à l’outil, mais aux faits. La première version pourrait être publiée par n’importe quel paysagiste de France ; la seconde, par un seul.',
        ],
      },
      {
        h2: 'Les signaux qui trahissent un texte bâclé',
        list: [
          'Des phrases d’ouverture interchangeables (« Dans un monde en constante évolution… »).',
          'Aucun chiffre, aucun nom, aucun exemple que l’on ne trouverait pas ailleurs.',
          'Des listes de dix conseils génériques valables pour n’importe quelle entreprise.',
          'Des affirmations sûres d’elles sur des sujets où la réalité est nuancée.',
          'Des pages quasi identiques pour chaque ville ou chaque variante de produit.',
        ],
        after: ['Si vous reconnaissez votre site, ne supprimez pas tout : commencez par les pages qui ont des impressions dans la Search Console, et réécrivez-les avec vos faits.'],
      },
      {
        h2: 'Qui relit quoi, dans une petite entreprise',
        paras: [
          'La relecture est l’étape que l’on saute quand on manque de temps. Répartissez-la pour qu’elle tienne en un quart d’heure par page.',
        ],
        list: [
          'Le dirigeant ou le commercial relit les promesses : prix, délais, garanties, zone d’intervention. Tout ce qui engage l’entreprise doit être exact.',
          'Le technicien ou le chef d’atelier relit le fond : méthodes, normes, matériaux, étapes. C’est là que les erreurs plausibles se cachent.',
          'Une personne extérieure au sujet relit la clarté : comprend-elle la réponse dans les trois premières lignes ?',
          'Pour les sujets réglementés (fiscalité, santé, droit, sécurité), une vérification sur le texte officiel est obligatoire avant publication, quel que soit l’outil qui a rédigé.',
        ],
      },
      {
        h2: 'Et pour les IA qui vous lisent ?',
        paras: [
          'Il y a une ironie : un texte généré par IA, sans fait propre, est aussi celui qu’une autre IA a le moins de raisons de citer, puisqu’il ne dit rien que d’autres pages ne disent déjà. Google le formule à sa façon dans son guide de 2026 sur les fonctionnalités d’IA générative : l’optimisation pour ces réponses reste du SEO, fondé sur un contenu utile pour les personnes [5]. Le contenu qui se fait citer est celui qui contient une information que l’on ne trouve pas ailleurs.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il indiquer qu’un texte a été écrit avec l’IA ?', a: 'Google ne l’impose pas pour les pages ordinaires ; il suggère d’expliquer comment le contenu a été produit quand c’est utile au lecteur. Pour les fiches produits envoyées à Google, les textes générés doivent être signalés.' },
      { q: 'Peut-on traduire ses pages avec une IA ?', a: 'Oui, à condition de faire relire la traduction par une personne qui maîtrise la langue et le métier. Une traduction automatique non relue peut contenir des contresens sur des points techniques ou juridiques.' },
      { q: 'Les détecteurs d’IA disent que mon texte est généré : est-ce grave ?', a: 'Google ne dit pas utiliser de tels détecteurs. Ce qui compte pour ses règles, c’est la valeur et l’exactitude du contenu, pas l’outil qui l’a produit.' },
      { q: 'Peut-on générer des centaines de pages produits avec l’IA ?', a: 'Oui si chaque page apporte des informations exactes et utiles, relues. Non si elles sont produites en masse sans valeur ajoutée : c’est l’abus de contenu à grande échelle visé par Google.' },
    ],
    sources: [
      { label: 'Google Search Central, utiliser du contenu généré par IA', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', note: `mis à jour le 1er oct. 2026 ; ${VU}` },
      { label: 'Google Search Central, règles relatives au spam (abus de contenu à grande échelle)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Search Engine Land, les évaluateurs de Google et le contenu généré par IA', url: 'https://searchengineland.com/google-quality-raters-content-ai-generated-454161', note: `mise à jour des consignes de janvier 2025 ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Google Search Central, optimiser son site pour les fonctionnalités d’IA générative de la recherche Google', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide', note: VU },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
    ],
    cta: { text: 'Testez une de vos pages : réponse en tête, faits datés, auteur, sources. L’outil de citabilité note les 20 règles et montre quoi corriger.', href: '/outils/citabilite', label: 'Tester une page' },
    related: ['page-que-les-ia-citent', 'apercus-ia-google', 'seo-b2b-acheteurs', 'ia-disent-des-choses-fausses'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO WordPress                                                       */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-wordpress',
    seoTitle: 'SEO WordPress : les réglages qui comptent pour un pro',
    title: 'SEO WordPress : les réglages qui comptent pour un pro',
    description:
      'Visibilité, permaliens, sitemap, extension SEO, images, sécurité et robots d’IA : les réglages WordPress à vérifier, dans l’ordre, sans être développeur.',
    updated: D,
    published: D,
    intro: [
      'WordPress fait tourner 38,7 % des sites web selon W3Techs, soit 57,6 % des sites dont le gestionnaire de contenu est identifié [1]. C’est donc probablement l’outil de votre site, ou de celui de votre agence. Bonne nouvelle : WordPress se prête bien au référencement. Mauvaise nouvelle : quelques réglages mal placés suffisent à rendre un site invisible, et ils sont rarement vérifiés après la mise en ligne.',
      'Ce guide liste, dans l’ordre, ce qu’un dirigeant peut contrôler lui-même dans l’administration WordPress, en une heure. Les noms de menus sont ceux de l’interface française standard ; ils peuvent varier selon votre thème et vos extensions.',
    ],
    sections: [
      {
        h2: 'Étape 1 : la case qui rend le site invisible',
        paras: [
          'Dans Réglages › Lecture, la case « Demander aux moteurs de recherche de ne pas indexer ce site » est souvent cochée pendant la construction du site, et oubliée à la mise en ligne. Depuis WordPress 5.3, elle ajoute une balise meta robots « noindex, nofollow » à toutes les pages [3] : Google peut lire le site, mais on lui demande de ne pas l’afficher. Elle désactive aussi le sitemap intégré de WordPress [2].',
          'Vérification : ouvrez votre page d’accueil, affichez le code source (Ctrl+U) et cherchez « noindex ». S’il apparaît alors que vous voulez être trouvé, décochez la case, enregistrez, puis demandez une nouvelle exploration dans la Search Console.',
        ],
      },
      {
        h2: 'Étape 2 : des adresses lisibles',
        paras: [
          'Dans Réglages › Permaliens, choisissez une structure fondée sur le titre (« Titre de la publication ») plutôt que les adresses à numéro (?p=123). Une adresse comme /depannage-chaudiere-nantes/ dit quelque chose au visiteur et au moteur ; Google recommande des mots compréhensibles dans les URL plutôt que des identifiants [8].',
          'Attention : sur un site déjà en ligne, changer la structure des permaliens change toutes les adresses. Faites-le seulement avec un plan de redirections, comme pour une refonte (voir notre guide dédié). Si le site est en ligne depuis des années avec des adresses à numéro, le gain ne justifie pas toujours le risque.',
        ],
      },
      {
        h2: 'Étape 3 : une seule source de sitemap',
        paras: [
          'Depuis la version 5.5, WordPress produit un sitemap à l’adresse /wp-sitemap.xml, qui couvre les contenus publics, les archives d’auteurs et la page d’accueil, et le déclare dans robots.txt [2]. Les extensions SEO les plus répandues le remplacent par le leur ; c’est le cas de Yoast SEO, selon un contributeur de WordPress [2].',
        ],
        list: [
          'Identifiez quel sitemap est actif : essayez /wp-sitemap.xml puis /sitemap_index.xml.',
          'Déclarez le bon dans la Search Console et dans Bing Webmaster Tools, et un seul.',
          'Ouvrez-le et regardez ce qu’il contient : les pages d’archives d’auteurs, d’étiquettes ou de médias n’ont souvent rien à y faire sur un site d’entreprise. Les extensions SEO permettent de les retirer.',
        ],
      },
      {
        h2: 'Étape 4 : une extension SEO, bien réglée',
        paras: [
          'Yoast SEO, Rank Math, SEOPress ou All in One SEO font globalement la même chose : titres et descriptions par page, sitemap, balisage de base, réglages d’indexation par type de contenu. Peu importe laquelle ; ce qui compte, c’est de n’en avoir qu’une (deux extensions SEO actives se contredisent) et de vérifier quatre réglages.',
        ],
        list: [
          'Les types de contenu à ne pas indexer : pièces jointes, étiquettes, archives d’auteur sur un site à un seul auteur.',
          'Le modèle de titre : « Titre de la page | Nom de l’entreprise » est un bon défaut, à personnaliser sur les pages importantes (voir notre guide sur les titres).',
          'Le balisage de l’entreprise : nom, logo, et pour un commerce, adresse et téléphone identiques à la fiche Google.',
          'Les fonctions « IA » ajoutées récemment par certaines extensions (génération de titres, de descriptions) : utilisez-les comme brouillon, jamais en masse sans relecture.',
        ],
      },
      {
        h2: 'Étape 5 : le texte doit être dans la page, pas dans un script',
        paras: [
          'Les constructeurs de pages (Elementor, Divi et autres) produisent en général du HTML lisible. Le risque vient des blocs chargés en différé : onglets, accordéons, carrousels ou avis clients ajoutés par script. Google sait exécuter le JavaScript, en différé ; la plupart des robots d’IA ne le font pas, et ne voient que le HTML initial.',
          'Le test : affichez le code source d’une page de service et cherchez une phrase de votre texte principal. Si elle n’y figure pas, un robot d’IA ne la verra probablement pas non plus. Notre outil de rendu sans JavaScript fait ce test pour vous.',
        ],
      },
      {
        h2: 'Étape 6 : les images, sources fréquentes de lenteur',
        paras: [
          'WordPress charge par défaut les images en différé (lazy loading). C’est utile pour les images du bas de page, mais nuisible pour l’image principale en haut : une étude publiée sur web.dev, menée sur des pages WordPress en 2021, a mesuré qu’en désactivant ce chargement différé sur des pages d’archives, l’affichage du plus grand élément (LCP) s’améliorait d’environ 13 % sur ordinateur et 15 % sur mobile en laboratoire [5]. Les thèmes et extensions modifient souvent ce comportement : vérifiez sur votre propre site ce qu’il en est pour l’image principale.',
        ],
        list: [
          'Redimensionnez avant d’envoyer : une photo de 4 000 pixels de large pour un bandeau de 1 400 pixels ralentit chaque visite.',
          'Utilisez une extension de compression qui produit du WebP ou de l’AVIF.',
          'Renseignez le texte alternatif dans la médiathèque, en décrivant l’image (voir notre guide sur les images).',
          'Vérifiez que l’image principale de la page d’accueil n’est pas chargée en différé.',
        ],
      },
      {
        h2: 'Étape 7 : sécurité et cache, sans bloquer les bons robots',
        paras: [
          'Les extensions de sécurité et les pare-feu bloquent les robots malveillants, et c’est leur rôle. Certaines bloquent aussi, par excès de zèle, des robots que vous voulez laisser passer : Googlebot sur certaines pages, ou les robots de recherche des assistants. OpenAI précise qu’un site qui refuse OAI-SearchBot n’apparaît pas dans les réponses de recherche de ChatGPT, même s’il peut encore figurer comme lien de navigation [6].',
          'Si votre site passe par Cloudflare, sachez que depuis le 1er juillet 2025, Cloudflare demande à chaque nouveau domaine s’il veut autoriser les robots d’IA [7]. Une réponse donnée rapidement à l’inscription peut avoir fermé la porte à tous les robots d’IA, y compris ceux de recherche. Vérifiez le réglage dans le tableau de bord, robot par robot.',
        ],
      },
      {
        h2: 'Étape 8 : robots.txt, à manier avec prudence',
        paras: [
          'WordPress produit un robots.txt virtuel ; les extensions SEO permettent de l’éditer. Deux erreurs classiques : bloquer /wp-content/ (les robots ne peuvent plus charger feuilles de style et images, et voient une page cassée), et croire que robots.txt retire une page de Google. Google le dit clairement : robots.txt n’est pas un moyen de garder une page hors de Google ; pour cela, il faut une balise noindex ou une protection par mot de passe [4].',
        ],
      },
      {
        h2: 'Étape 9 : les pages qui ne servent à personne',
        paras: [
          'Un site WordPress produit, sans qu’on le demande, des pages que personne ne cherche : une page par étiquette, une page par mois d’archives, une page par auteur, une page par image envoyée dans la médiathèque. Sur un site d’entreprise de trente pages, on trouve parfois deux cents adresses indexables, dont cent soixante-dix sans intérêt.',
          'Ce n’est pas une pénalité, mais c’est du bruit : les robots passent du temps sur ces pages, et elles peuvent apparaître dans les résultats à la place de vos vraies pages. Votre extension SEO permet de les exclure de l’indexation par type. Faites-le pour les étiquettes, les archives par date, les auteurs (si un seul auteur) et les pages de pièces jointes. Gardez les catégories du blog si elles regroupent vraiment des articles par thème et que vous les reliez depuis vos pages.',
        ],
      },
      {
        h2: 'Étape 10 : l’hygiène qui évite les mauvaises surprises',
        list: [
          'Mettez à jour WordPress, le thème et les extensions : un site piraté qui affiche des pages de spam peut être signalé par Google.',
          'Supprimez les extensions désactivées et les pages de test publiées par erreur (« Exemple de page », « Hello world »).',
          'Vérifiez que la version sans « www » redirige vers la version avec, ou l’inverse, et que http redirige vers https.',
          'Gardez l’accès administrateur au nom de l’entreprise, pas seulement chez le prestataire.',
          'Après chaque mise à jour importante du thème, refaites le test du code source (étape 5) sur deux pages clés.',
        ],
      },
    ],
    faq: [
      { q: 'Quelle extension SEO choisir ?', a: 'Celle que vous ou votre prestataire maîtrisez. Yoast SEO, Rank Math et SEOPress couvrent les mêmes besoins d’un site d’entreprise ; l’important est d’en avoir une seule, bien réglée.' },
      { q: 'Combien d’extensions est-ce raisonnable ?', a: 'Il n’y a pas de nombre magique. Chaque extension doit avoir une utilité claire ; testez la vitesse d’une page avant et après en avoir ajouté une, et supprimez celles qui ne servent plus plutôt que de les désactiver.' },
      { q: 'Mon site WordPress a été piraté : que faire pour Google ?', a: 'Nettoyez le site avec un professionnel, changez tous les mots de passe, mettez tout à jour, puis vérifiez dans la Search Console la rubrique sur les problèmes de sécurité et demandez un réexamen si elle signale quelque chose.' },
      { q: 'WordPress est-il moins bon pour le SEO qu’un site sur mesure ?', a: 'Non. Les problèmes viennent des réglages, du thème et des extensions, pas de WordPress lui-même. Un site WordPress léger, à jour et bien structuré se référence très bien.' },
      { q: 'Faut-il une extension pour les robots d’IA ?', a: 'Non. Les règles pour les robots d’IA se mettent dans robots.txt, que votre extension SEO permet d’éditer. Vérifiez surtout que votre pare-feu ou votre CDN ne les bloque pas.' },
    ],
    sources: [
      { label: 'W3Techs, parts d’usage des gestionnaires de contenu', url: 'https://w3techs.com/technologies/overview/content_management', note: `chiffres du 14 nov. 2026 ; ${VU}` },
      { label: 'Make WordPress Core, sitemaps XML intégrés à WordPress 5.5', url: 'https://make.wordpress.org/core/2020/07/22/new-xml-sitemaps-functionality-in-wordpress-5-5/', note: VU },
      { label: 'WordPress Trac, ticket 43590 (réglage de visibilité et balise noindex depuis 5.3)', url: 'https://core.trac.wordpress.org/ticket/43590', note: VU },
      { label: 'Google Search Central, introduction à robots.txt', url: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro.md.txt', note: VU },
      { label: 'web.dev, effets d’un chargement différé excessif sur le LCP', url: 'https://web.dev/articles/lcp-lazy-loading', note: `données de 2021, mis à jour en 2022 ; ${VU}` },
      { label: 'OpenAI, présentation des robots (GPTBot, OAI-SearchBot, ChatGPT-User)', url: 'https://developers.openai.com/api/docs/bots.md', note: VU },
      { label: 'Cloudflare, communiqué du 1er juillet 2025 sur le contrôle des robots d’IA', url: 'https://cloudflare.com/press-releases/2025/cloudflare-just-changed-how-ai-crawlers-scrape-the-internet-at-large', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO (structure des URL)', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
    ],
    cta: { text: 'Noindex oublié, sitemap en double, texte invisible sans JavaScript : l’analyse gratuite repère ces erreurs WordPress en 60 secondes.', ...CTA },
    related: ['refonte-site-sans-perdre-seo', 'core-web-vitals-sans-jargon', 'robots-ia-robots-txt', 'titres-meta-descriptions'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO Shopify                                                         */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-shopify',
    seoTitle: 'SEO Shopify : ce que la boutique fait seule, et le reste',
    title: 'SEO Shopify : ce que la boutique fait seule, et le reste',
    description:
      'Shopify gère seul sitemap, canonique et balisage produit. Ce qu’il vous reste à faire : titres, collections, fiches, robots.txt, vitesse, IA et catalogue.',
    updated: D,
    published: D,
    intro: [
      'Shopify équipe 5,4 % des sites web selon W3Techs, ce qui en fait le deuxième gestionnaire de contenu après WordPress [6]. Pour une boutique, c’est un bon point de départ : beaucoup de bases techniques sont gérées automatiquement. Le risque est inverse de celui de WordPress : on croit que tout est fait, alors que l’essentiel du travail, le contenu des collections et des fiches, reste à votre charge.',
      'Ce guide sépare ce que Shopify fait pour vous, d’après sa propre documentation, de ce que vous devez faire, et signale ce qui change avec la vente dans les assistants d’IA.',
    ],
    sections: [
      {
        h2: 'Ce que Shopify fait seul',
        paras: ['D’après le centre d’aide de Shopify [1] :'],
        list: [
          'Des balises canoniques sont ajoutées automatiquement pour éviter que des contenus en double apparaissent dans les résultats [1]. C’est le principal mécanisme de Shopify contre le contenu dupliqué, par exemple quand un produit est accessible depuis plusieurs collections.',
          'Les fichiers sitemap.xml et robots.txt sont générés automatiquement [1]. Le sitemap, à la racine du domaine, renvoie vers des sitemaps séparés pour produits, collections, blogs et pages, et se met à jour quand vous ajoutez du contenu [2].',
          'Les thèmes génèrent des balises title qui incluent le nom de la boutique [1].',
          'Les thèmes incluent un balisage schema.org pour les produits, qui permet les résultats enrichis [1].',
        ],
        after: [
          'Deux réserves. Le balisage produit dépend du thème : un thème ancien ou modifié peut l’avoir cassé, vérifiez-le avec le test des résultats enrichis de Google. Et un sitemap n’est pas accessible tant que la boutique est protégée par mot de passe : Google ne peut pas le lire en mode privé [2].',
        ],
      },
      {
        h2: 'Étape 1 : déclarer le sitemap et vérifier l’indexation',
        list: [
          'Validez votre domaine dans la Google Search Console, puis déclarez « sitemap.xml » dans Indexation › Sitemaps [2].',
          'Si vous vendez sur plusieurs domaines internationaux, déclarez le sitemap de chaque domaine [2].',
          'Après quelques jours, ouvrez le rapport d’indexation : les produits et collections importants doivent y figurer comme indexés.',
          'Faites la même chose dans Bing Webmaster Tools, par import depuis la Search Console.',
        ],
      },
      {
        h2: 'Étape 2 : les pages de collection, vos pages les plus sous-estimées',
        paras: [
          'Les recherches génériques (« bougies parfumées naturelles », « chaussures de randonnée femme ») mènent plus souvent à des pages de collection qu’à des fiches produits. Or beaucoup de boutiques laissent leurs collections avec un titre et une grille de produits, sans un mot.',
        ],
        list: [
          'Un titre de collection qui reprend la recherche réelle : « Bougies parfumées à la cire de soja », pas « Nouveautés ».',
          'Un texte d’introduction court (deux à quatre phrases) au-dessus de la grille, qui dit ce que contient la collection et pour qui.',
          'Un texte de guide plus long en bas de page si le sujet s’y prête : comment choisir, différences entre les produits, questions fréquentes.',
          'Un titre SEO et une description personnalisés dans la section « Aperçu du référencement » de la collection.',
        ],
      },
      {
        h2: 'Étape 3 : des fiches produits qui disent quelque chose de vrai',
        paras: [
          'La description du fabricant, copiée par tous les revendeurs, ne vous distingue de personne. Notre guide sur les fiches produits et l’IA détaille la méthode ; sur Shopify, trois points pratiques s’ajoutent.',
        ],
        list: [
          'Utilisez les métachamps (metafields) pour les attributs structurés : matière, dimensions, compatibilités, entretien. Ils peuvent être affichés proprement par le thème, et c’est ce qu’un acheteur, ou un assistant, cherche à comparer.',
          'Renseignez le code-barres (GTIN) et la marque dans chaque variante : ils servent à l’identification des produits par Google et par les catalogues.',
          'Évitez de créer un produit distinct pour chaque couleur si une variante suffit : vous multipliez des fiches presque identiques.',
        ],
      },
      {
        h2: 'Étape 4 : robots.txt, seulement si nécessaire',
        paras: [
          'Shopify permet de personnaliser robots.txt avec un modèle robots.txt.liquid dans le thème. Sa documentation précise que le fichier par défaut convient à la plupart des boutiques, et recommande de sauvegarder le fichier actuel avant toute modification, car le rendu du modèle ne correspond pas toujours exactement au fichier généré [3].',
          'Les cas où cela vaut la peine : bloquer des pages de recherche interne ou de filtres qui génèrent des milliers d’adresses sans valeur, ou ajouter des règles pour un robot précis. Pour les robots d’IA, le défaut de Shopify ne les bloque pas en général ; vérifiez votre fichier avec notre outil plutôt que de le modifier par précaution.',
        ],
      },
      {
        h2: 'Étape 5 : la vitesse, côté applications',
        paras: [
          'Les boutiques Shopify ralentissent rarement à cause de Shopify, et souvent à cause des applications : chaque widget d’avis, de chat, de fidélité ou de traduction ajoute des scripts. Faites l’inventaire une fois par an.',
        ],
        list: [
          'Listez les applications installées et demandez-vous, pour chacune, ce qu’elle rapporte.',
          'Désinstallez proprement celles qui ne servent plus : certaines laissent du code dans le thème, qu’il faut retirer.',
          'Comparez les mesures de vitesse avant et après dans PageSpeed Insights, sur mobile.',
        ],
      },
      {
        h2: 'Étape 6 : vendre dans les assistants d’IA',
        paras: [
          'C’est le changement le plus rapide du moment. En décembre 2025, Shopify a annoncé les « Agentic Storefronts » : une configuration unique dans l’administration permet de diffuser vos produits, via Shopify Catalog, dans des assistants comme ChatGPT, Perplexity et Microsoft Copilot, avec un paiement géré par Shopify, et de choisir plateforme par plateforme où vos produits apparaissent [4]. L’annonce ne précise pas les pays concernés [4] : vérifiez dans votre administration ce qui est disponible pour une boutique française.',
          'Ne confondez pas visibilité et paiement intégré : un assistant peut recommander un produit et renvoyer vers votre boutique sans que l’achat se fasse dans la conversation. Dans les deux cas, ce qui décide de la recommandation est la qualité des informations produit.',
          'Pour que ces assistants recommandent un produit, ils ont besoin de données exactes et complètes : titre clair, attributs, prix, disponibilité, identifiants. C’est le même travail que pour Google : une fiche bien renseignée sert partout. Google rappelle d’ailleurs que les données structurées produit doivent figurer dans le HTML renvoyé par le serveur et correspondre à ce que voit le client [5].',
        ],
      },
      {
        h2: 'Plusieurs pays, plusieurs langues',
        paras: [
          'Si vous vendez à l’étranger avec Shopify Markets, chaque domaine international dispose de ses propres fichiers sitemap à partir du forfait Basic, et les langues de vente y sont ajoutées automatiquement [2]. Les domaines qui ne servent pas au ciblage international doivent rediriger vers le domaine principal [2].',
          'Le piège habituel est la traduction automatique non relue : des fiches traduites mot à mot, avec des unités ou des tailles non converties, n’inspirent pas confiance et se comprennent mal. Commencez par traduire et relire vos vingt meilleures ventes et vos collections principales, plutôt que tout le catalogue d’un coup.',
        ],
      },
      {
        h2: 'Le blog Shopify : utile à une condition',
        paras: [
          'Shopify inclut un blog. Il est utile s’il répond aux questions que se posent vos acheteurs avant d’acheter : comment choisir une taille, comment entretenir un produit, quelle différence entre deux matières. Ces articles peuvent attirer des visites que vos fiches n’attirent pas, et servir de source à un assistant qui répond à une question de conseil.',
          'Il est inutile s’il publie des actualités de la boutique ou des textes génériques écrits pour « faire du contenu ». Deux articles utiles par trimestre, reliés aux collections concernées, valent mieux qu’un article creux par semaine.',
        ],
      },
      {
        h2: 'Un plan sur trente jours',
        list: [
          'Semaine 1 : vérifier sitemap, indexation, mode mot de passe, redirections des produits supprimés.',
          'Semaine 2 : réécrire titres et introductions des cinq collections principales.',
          'Semaine 3 : compléter les attributs (métachamps, GTIN, marque) et la description des vingt meilleures ventes.',
          'Semaine 4 : inventaire des applications, mesure de vitesse sur mobile, puis vérification des réglages de diffusion vers les assistants d’IA dans l’administration.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes sur Shopify',
        list: [
          'Laisser la boutique en mode mot de passe après le lancement, ou rouvrir un ancien domaine sans redirection.',
          'Supprimer des produits épuisés définitivement sans redirection vers un produit ou une collection proche.',
          'Utiliser les étiquettes (tags) pour créer des centaines de pages de collection filtrées, quasi vides.',
          'Des titres SEO identiques sur toutes les fiches (« Boutique X »), faute de les avoir personnalisés.',
          'Des images de plusieurs mégaoctets envoyées telles quelles depuis l’appareil photo.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il une application SEO sur Shopify ?', a: 'Pas forcément. Shopify gère sitemap, canoniques et balisage de base. Une application peut aider à repérer les champs vides ou à gérer les redirections, mais elle ne remplace pas le travail sur les textes.' },
      { q: 'Faut-il réécrire les descriptions de tout le catalogue ?', a: 'Non. Commencez par les produits qui font l’essentiel du chiffre d’affaires et par ceux qui ont des impressions sans clics dans la Search Console. Une réécriture progressive et relue vaut mieux qu’une génération en masse.' },
      { q: 'Les adresses /collections/…/products/… posent-elles problème ?', a: 'Shopify ajoute automatiquement une balise canonique qui désigne l’adresse principale du produit. Vérifiez que votre thème la conserve et que vos liens internes pointent vers l’adresse principale.' },
      { q: 'Mes produits peuvent-ils apparaître dans ChatGPT ?', a: 'Shopify a annoncé une diffusion vers ChatGPT, Perplexity et Copilot via Shopify Catalog. La disponibilité varie selon les pays et évolue : vérifiez dans votre administration.' },
    ],
    sources: [
      { label: 'Centre d’aide Shopify, présentation du référencement', url: 'https://help.shopify.com/manual/promoting-marketing/seo/seo-overview/', note: VU },
      { label: 'Centre d’aide Shopify, trouver et soumettre son sitemap', url: 'https://help.shopify.com/manual/using-themes/find-site-map', note: VU },
      { label: 'Shopify.dev, personnaliser robots.txt', url: 'https://shopify.dev/docs/storefronts/themes/seo/robots-txt.md', note: VU },
      { label: 'Shopify, Winter ’26 Edition : Agentic Storefronts', url: 'https://www.shopify.com/news/winter-26-edition-agentic-storefronts', note: `10 déc. 2025 ; ${VU}` },
      { label: 'Aide Google Merchant Center, attributs de données structurées pris en charge', url: 'https://support.google.com/merchants/answer/6386198?hl=en', note: VU },
      { label: 'W3Techs, parts d’usage des gestionnaires de contenu', url: 'https://w3techs.com/technologies/overview/content_management', note: `chiffres du 14 nov. 2026 ; ${VU}` },
    ],
    cta: { text: 'Auditez une fiche produit : attributs, balisage, texte lisible sans JavaScript. L’outil gratuit montre ce qu’un assistant peut en extraire.', href: '/outils/fiche-produit', label: 'Auditer une fiche produit' },
    related: ['fiche-produit-et-ia', 'google-merchant-center', 'seo-images', 'donnees-structurees-utiles'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO Wix                                                             */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-wix',
    seoTitle: 'SEO Wix : régler son site pour Google et les IA',
    title: 'SEO Wix : régler son site pour Google et les IA',
    description:
      'Wix rend ses pages côté serveur, mais tout ne se règle pas seul : modèles SEO, indexation, redirections, robots.txt, balisage, liens. Le pas-à-pas.',
    updated: D,
    published: D,
    intro: [
      'Wix équipe 4,2 % des sites web selon W3Techs [5], et beaucoup de commerces, d’artisans et de professions libérales l’ont choisi pour sa simplicité. Wix a longtemps eu mauvaise réputation en SEO ; ce n’est plus justifié pour l’essentiel, mais quelques réglages restent à faire à la main, et certains choix de mise en page peuvent gêner les robots.',
      'Ce guide suit les menus du tableau de bord Wix tels que décrits dans son centre d’aide. Wix fait évoluer son interface ; si un intitulé a changé, cherchez-le dans la rubrique « SEO & GEO » du tableau de bord.',
    ],
    sections: [
      {
        h2: 'Le point fort de Wix : des pages rendues côté serveur',
        paras: [
          'La documentation développeurs de Wix explique que Wix utilise le rendu côté serveur : les composants de la page sont rendus sur le serveur et renvoyés au navigateur sous forme de HTML [3]. C’est important, parce que les robots lisent d’abord le HTML initial, et que tous ne savent pas exécuter le JavaScript [3]. Le centre d’aide de Wix rappelle d’ailleurs que la plupart des robots d’IA n’exécutent pas le JavaScript, et que ce qu’un script ajoute leur reste invisible [4].',
          'La limite : le contenu ajouté par du code personnalisé (Velo) n’est inclus dans la version serveur que s’il est chargé dans la fonction onReady, et un contenu chargé en asynchrone peut manquer si la fonction n’attend pas sa fin [3]. Les contenus de base de données connectés par un jeu de données (dataset), eux, sont inclus [3]. Si votre site n’a pas de code personnalisé, vous êtes tranquille sur ce point.',
        ],
      },
      {
        h2: 'Étape 1 : vérifier ce que voit un robot',
        paras: [
          'Wix propose une méthode simple : dans Chrome, ouvrez les outils de développement, changez l’agent utilisateur en Googlebot dans les conditions réseau, rechargez la page et affichez le code source [4]. Cherchez une phrase de votre texte principal. Si elle apparaît, les robots la voient. Notre outil de rendu sans JavaScript fait le même test sans manipulation.',
        ],
      },
      {
        h2: 'Étape 2 : les modèles SEO par type de page',
        paras: [
          'Wix crée des réglages SEO par défaut pour chaque type de page (pages principales, produits, articles de blog), que vous pouvez modifier pour toute une section du site : SEO & GEO › Outils et paramètres › Paramètres SEO, puis le type de page et l’onglet de personnalisation des valeurs par défaut [1].',
        ],
        list: [
          'Titre par défaut des produits : « Nom du produit | Nom de la boutique » est un bon point de départ.',
          'Description par défaut : préférez un modèle qui reprend le début de la description du produit plutôt qu’une phrase identique partout.',
          'Puis personnalisez à la main le titre et la description de vos dix pages les plus importantes.',
        ],
      },
      {
        h2: 'Étape 3 : l’indexation, page par page',
        paras: [
          'Chaque type de page dispose d’un interrupteur « Autoriser les moteurs de recherche à indexer », et l’onglet de modification par page propose une colonne « Indexable » et un réglage en masse [1]. Vérifiez deux choses : que vos pages importantes sont indexables, et que les pages sans intérêt pour un visiteur venant de Google (remerciements après formulaire, pages de test, mentions en double) ne le sont pas.',
          'Si la Search Console signale des pages « bloquées par robots.txt », Wix conseille de vérifier d’abord l’indexation de la page, la protection par mot de passe et les réglages d’espace membres avant de toucher au fichier [2].',
        ],
      },
      {
        h2: 'Étape 4 : adresses et redirections',
        paras: [
          'Pour les produits et articles de blog, la structure des adresses se personnalise dans les paramètres SEO, et doit contenir au moins une variable [1]. Quand vous modifiez cette structure, Wix peut rediriger automatiquement les anciennes adresses vers les nouvelles ; si vous décochez cette option, il faut créer les redirections vous-même dans le gestionnaire de redirections d’URL [1].',
          'Gardez cette option cochée sauf raison précise. Et chaque fois que vous supprimez une page ou un produit, créez une redirection vers la page la plus proche : c’est l’oubli le plus fréquent sur les petits sites.',
        ],
      },
      {
        h2: 'Étape 5 : robots.txt, avec précaution',
        paras: [
          'Wix permet d’éditer robots.txt : SEO & GEO › Outils et paramètres › Éditeur de robots.txt [2]. Wix le présente comme une fonction avancée, précise que son service client ne peut pas aider sur les modifications et propose un bouton de retour aux réglages par défaut [2].',
          'Le fichier par défaut convient à la plupart des sites. La seule raison courante de le modifier, pour un professionnel, est de préciser votre politique vis-à-vis des robots d’IA : par exemple refuser les robots d’entraînement tout en laissant passer les robots de recherche. Notre guide sur les robots d’IA donne une configuration type.',
        ],
      },
      {
        h2: 'Étape 6 : le balisage structuré',
        paras: [
          'Wix ajoute un balisage prédéfini selon le type de page et permet d’ajouter le vôtre, jusqu’à cinq balisages par réglage SEO, préréglage compris [1]. Pour un commerce, le balisage le plus utile est celui de l’entreprise (LocalBusiness ou un sous-type), avec nom, adresse et téléphone identiques à ceux affichés sur la page et sur la fiche Google.',
          'Vérifiez le résultat avec le test des résultats enrichis de Google, et ne déclarez dans le balisage que ce qui est visible sur la page.',
        ],
      },
      {
        h2: 'Étape 7 : des liens que les robots peuvent suivre',
        paras: [
          'Google suit essentiellement les liens écrits comme des balises « a » avec un attribut href [6]. Wix recommande donc de créer les liens par le menu du site, par un lien dans le texte, par le bouton de lien d’un élément cliquable ou par un jeu de données ; les autres méthodes ne garantissent pas un lien lisible [3]. Chaque page doit être accessible par au moins un lien de ce type [3].',
          'Concrètement : évitez les boutons dont l’action est un code personnalisé pour naviguer vers une page importante, et vérifiez que chaque page de service figure dans le menu ou est liée depuis une autre page.',
        ],
      },
      {
        h2: 'Blog, boutique et pages dynamiques',
        paras: [
          'Les pages dynamiques de Wix (une page modèle alimentée par une collection de données, par exemple une page par réalisation ou par bien immobilier) ont des réglages SEO distincts de ceux des pages ordinaires [3]. Vérifiez que leur titre et leur description sont construits à partir des champs de la collection, et pas identiques pour toutes les pages.',
          'Même logique pour le blog et la boutique Wix : un modèle par défaut est appliqué à chaque article ou produit. Il évite les champs vides, mais ne remplace pas une description écrite à la main pour les contenus importants. Pour la pagination, Wix recommande d’utiliser un paramètre de page dans l’adresse (?page=2) si vous voulez que chaque page de la liste soit explorée comme une page distincte [3].',
        ],
      },
      {
        h2: 'Étape 8 : images et vitesse',
        list: [
          'Ajoutez un texte alternatif à chaque image utile, depuis l’éditeur : Wix rappelle que c’est par ce texte que les moteurs comprennent l’image [3].',
          'Limitez les vidéos en arrière-plan et les animations au chargement, coûteuses sur mobile.',
          'Évitez les galeries de cinquante photos en haute définition sur la page d’accueil : une sélection de huit, avec un lien vers la galerie complète, suffit.',
        ],
      },
      {
        h2: 'Le contrôle d’une heure',
        list: [
          'Dix minutes : test du code source vu comme Googlebot sur l’accueil et deux pages de service.',
          'Quinze minutes : modèles SEO des pages, produits et articles ; titres des dix pages clés.',
          'Dix minutes : colonne « Indexable » de toutes les pages.',
          'Dix minutes : gestionnaire de redirections et pages supprimées récemment.',
          'Quinze minutes : balisage de l’entreprise testé, coordonnées comparées avec la fiche Google.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes sur Wix',
        list: [
          'Des titres de section écrits en image ou en texte décoratif plutôt qu’en vrais titres : le robot ne voit pas la structure de la page.',
          'Une page d’accueil en une seule colonne de sections « en images », sans phrase qui dise ce que fait l’entreprise et où.',
          'Des versions mobile et ordinateur différentes, où le texte masqué sur mobile disparaît pour Google, qui indexe désormais les sites avec son robot pour smartphone [7].',
          'Des pages créées pour une campagne puis oubliées, indexées, avec d’anciens prix.',
          'Un changement de nom de domaine sans conserver l’ancien et sans redirections.',
        ],
      },
    ],
    faq: [
      { q: 'Wix est-il mauvais pour le SEO ?', a: 'Non, pour un site vitrine ou une petite boutique. Wix rend ses pages côté serveur et propose les réglages essentiels. Les limites concernent surtout les sites très volumineux ou très personnalisés.' },
      { q: 'Faut-il un forfait payant pour être référencé ?', a: 'Un domaine personnalisé est fortement conseillé : une adresse sur un sous-domaine Wix inspire moins confiance et se transfère mal le jour où vous changez d’outil.' },
      { q: 'Wix ou WordPress pour être bien référencé ?', a: 'Les deux conviennent à un site d’entreprise. Le choix dépend surtout de qui maintiendra le site. Un site Wix bien rempli fera mieux qu’un WordPress abandonné, et l’inverse est vrai.' },
      { q: 'Les robots d’IA peuvent-ils lire un site Wix ?', a: 'Oui, si le texte est présent dans la version rendue côté serveur et si robots.txt ne les bloque pas. Testez une page avec un outil de rendu sans JavaScript pour en être sûr.' },
    ],
    sources: [
      { label: 'Centre d’aide Wix, personnaliser ses paramètres SEO', url: 'https://support.wix.com/en/article/customizing-your-seo-settings-1420929', note: VU },
      { label: 'Centre d’aide Wix, modifier le fichier robots.txt', url: 'https://support.wix.com/en/article/editing-your-sites-robotstxt-file', note: VU },
      { label: 'Wix Developers, bonnes pratiques SEO (rendu côté serveur, liens, images)', url: 'https://dev.wix.com/docs/develop-websites-sdk/code-your-site/best-practices/seo-best-practices.md', note: VU },
      { label: 'Centre d’aide Wix, voir le code source comme un moteur de recherche', url: 'https://support.wix.com/he/article/viewing-your-pages-source-code-the-way-search-engines-do', note: VU },
      { label: 'W3Techs, parts d’usage des gestionnaires de contenu', url: 'https://w3techs.com/technologies/overview/content_management', note: `chiffres du 14 nov. 2026 ; ${VU}` },
      { label: 'Google Search Central, bonnes pratiques pour les liens', url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable', note: VU },
      { label: 'PPC Land, Google achève le passage à l’indexation mobile (juillet 2024)', url: 'https://ppc.land/google-search-completes-transition-to-mobile-first-indexing-by-july-5-2024', note: `4 juin 2024 ; ${VU}` },
    ],
    cta: { text: 'Votre texte est-il présent dans le HTML que lisent les robots ? Testez une page de votre site Wix.', href: '/outils/rendu-sans-javascript', label: 'Tester le rendu sans JavaScript' },
    related: ['seo-local-et-ia', 'fiche-google-business-profile', 'titres-meta-descriptions', 'robots-ia-robots-txt'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO PrestaShop                                                      */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-prestashop',
    seoTitle: 'SEO PrestaShop : les réglages d’une boutique bien référencée',
    title: 'SEO PrestaShop : les réglages d’une boutique bien référencée',
    description:
      'URL simplifiées, redirection canonique, robots.txt, sitemap, fiches et catégories : les réglages PrestaShop à vérifier pour Google et les IA, menu par menu.',
    updated: D,
    published: D,
    intro: [
      'PrestaShop reste très présent chez les e-commerçants français, même s’il ne représente que 0,5 % des sites web dans le monde selon W3Techs [3]. C’est un outil puissant et très configurable, ce qui est à la fois sa force et son piège : beaucoup de réglages SEO existent, mais rien n’oblige à les activer, et les modules ajoutés au fil des années peuvent se contredire.',
      'Ce guide s’appuie sur la documentation officielle de PrestaShop (version 1.7, dont l’organisation des menus a été reprise dans les versions suivantes ; vérifiez les intitulés dans votre back-office). Il s’adresse au gérant de la boutique, pas au développeur, et signale quand il faut faire appel à ce dernier.',
    ],
    sections: [
      {
        h2: 'Étape 1 : activer les URL simplifiées, prudemment',
        paras: [
          'Dans Paramètres de la boutique › Trafic › SEO et URL, l’option « URL simplifiée » produit des adresses lisibles (/chaussures-randonnee-femme) au lieu d’adresses à paramètres [1]. La documentation prévient : elle ne fonctionne qu’avec un serveur configuré pour la réécriture d’URL (module mod_rewrite sur Apache), sinon la boutique peut devenir inaccessible ; demandez à votre hébergeur en cas de doute [1].',
          'Sur une boutique déjà en ligne avec des adresses anciennes bien référencées, l’activation change les adresses : prévoyez les redirections, comme pour une refonte. L’option « URL accentuées » permet des caractères spéciaux dans les adresses ; pour éviter les problèmes de partage et de copie, beaucoup de boutiques la désactivent [1].',
        ],
      },
      {
        h2: 'Étape 2 : la redirection vers l’URL canonique',
        paras: [
          'Dans la même page, le réglage de redirection vers l’URL canonique propose trois choix : aucune redirection (risque d’adresses dupliquées), redirection 301 (recommandée une fois les changements terminés) ou 302 (temporaire) [1]. Choisissez 301.',
          'La documentation précise que l’effet dépend aussi du thème, qui doit implanter la balise rel="canonical" [1]. Vérifiez sur une fiche produit : dans le code source, cherchez « canonical » et assurez-vous qu’il pointe vers l’adresse principale du produit. Google recommande la balise canonique comme solution privilégiée pour indiquer la version préférée d’un contenu disponible à plusieurs adresses [4].',
        ],
      },
      {
        h2: 'Étape 3 : générer robots.txt, puis le relire',
        paras: [
          'Le générateur intégré crée un fichier qui exclut les fichiers et dossiers non publics, avec des règles pour tous les robots [1]. Attention : générer le fichier remplace l’existant ; ajoutez vos propres règles après la génération [1].',
        ],
        list: [
          'Gardez une copie de votre fichier actuel avant de régénérer.',
          'Relisez le résultat : il doit laisser accessibles les images, feuilles de style et scripts nécessaires à l’affichage.',
          'Ajoutez ensuite, si vous le souhaitez, vos règles pour les robots d’IA et la ligne qui déclare le sitemap.',
          'Vérifiez le fichier en ligne avec notre outil robots d’IA.',
        ],
      },
      {
        h2: 'Étape 4 : un sitemap à jour',
        paras: [
          'PrestaShop ne déclare pas de sitemap tout seul : c’est le rôle du module « Google sitemap » (gsitemap), maintenu par l’équipe PrestaShop, qui génère et met à jour un sitemap XML, un par langue de boutique, et gère le multiboutique [2]. Sa dernière version demande PrestaShop 8.2 ou plus [2] ; sur une version plus ancienne, une version antérieure du module ou un module tiers fait l’affaire.',
          'Une fois généré, déclarez le sitemap dans la Search Console et dans Bing Webmaster Tools, et programmez sa régénération (tâche planifiée) si le module ne le fait pas à chaque modification du catalogue.',
        ],
      },
      {
        h2: 'Étape 5 : titres et descriptions des pages fixes',
        paras: [
          'La page SEO et URL liste les pages fixes (contact, pages CMS, pages générées automatiquement) avec leur adresse simplifiée, leur titre et leur méta-description [1]. Pour la page d’accueil, c’est la page « index » ; son titre est vide par défaut, et y saisir un texte remplace le titre complet de la page [1]. Renseignez-le : « Nom de la boutique : ce que vous vendez, en quelques mots ».',
          'Le champ « mots-clés » existe encore dans PrestaShop. Inutile d’y passer du temps : Google indique ne pas utiliser la balise meta keywords [6].',
        ],
      },
      {
        h2: 'Étape 6 : catégories et fiches produits',
        paras: [
          'Les adresses, titres et descriptions des catégories se règlent dans la page de chaque catégorie (menu Catalogue), et ceux des produits dans l’onglet SEO de la fiche [1]. C’est là que se joue l’essentiel, et c’est un travail éditorial.',
        ],
        list: [
          'Chaque catégorie importante mérite un texte d’introduction utile, au-dessus des produits, et un titre qui reprend la recherche réelle.',
          'Chaque fiche produit doit dire ce que la description du fabricant ne dit pas : usage, compatibilités, entretien, questions des clients.',
          'Renseignez marque, référence fabricant et code EAN13 : ces identifiants alimentent le balisage et les flux vers Google [5].',
          'Les produits déclinés (tailles, couleurs) gagnent à rester un seul produit avec des déclinaisons, plutôt que des fiches distinctes quasi identiques.',
        ],
      },
      {
        h2: 'Étape 7 : le balisage produit, à vérifier',
        paras: [
          'Selon le thème et les modules, PrestaShop produit un balisage Product plus ou moins complet. Google Merchant Center sait lire les données structurées des pages pour mettre à jour prix et disponibilité, à condition qu’elles figurent dans le HTML renvoyé par le serveur, qu’elles correspondent à ce que voit le client, et qu’elles précisent notamment price, priceCurrency, availability et itemCondition [5].',
          'Testez trois fiches avec le test des résultats enrichis de Google. Si le prix ou la disponibilité manquent, ou si plusieurs modules produisent chacun leur balisage, c’est le moment d’appeler votre développeur.',
        ],
      },
      {
        h2: 'Vitesse : hébergement, cache et images',
        paras: [
          'Contrairement à Shopify ou Wix, PrestaShop est hébergé par vous ou par votre prestataire, et sa vitesse dépend beaucoup de l’hébergement. Une boutique lente sur mobile perd des ventes avant de perdre des positions.',
        ],
        list: [
          'Activez le cache et la compression dans Paramètres avancés › Performances, puis testez que la boutique fonctionne toujours normalement.',
          'Régénérez les miniatures après un changement de thème, pour ne pas servir des images surdimensionnées.',
          'Mesurez une fiche produit et une catégorie dans PageSpeed Insights, sur mobile, avant et après chaque changement.',
          'Si le temps de réponse du serveur reste élevé malgré le cache, la discussion est à avoir avec l’hébergeur, pas avec le module.',
        ],
      },
      {
        h2: 'Produits épuisés, produits supprimés',
        paras: [
          'Une boutique change en permanence. Ce qui compte, c’est ce que voit un robot quand un produit disparaît.',
        ],
        list: [
          'Rupture temporaire : laissez la fiche en ligne, avec la disponibilité indiquée clairement et, si possible, une date de retour. Le balisage doit refléter la même disponibilité que la page [5].',
          'Produit remplacé par un nouveau modèle : redirection permanente de l’ancienne fiche vers la nouvelle.',
          'Produit arrêté sans équivalent : redirection vers la catégorie la plus proche, ou page « produit arrêté » qui propose des alternatives. Évitez de tout rediriger vers l’accueil.',
          'Gardez la liste de ces redirections dans un tableau : après une migration ou un changement de module, c’est ce qui permet de les recréer.',
        ],
      },
      {
        h2: 'Boutique en plusieurs langues',
        paras: [
          'PrestaShop gère nativement plusieurs langues, et le module gsitemap produit un sitemap par langue [2]. Vérifiez que chaque langue a ses propres adresses simplifiées, traduites, et que les fiches ne mélangent pas deux langues (titre traduit, description restée en français).',
          'Comme pour toute traduction, faites relire au moins les fiches et catégories principales par une personne qui parle la langue : une traduction automatique non relue se remarque, et fait douter de la boutique.',
        ],
      },
      {
        h2: 'Étape 8 : les modules, source de doublons',
        paras: ['Une boutique PrestaShop accumule souvent des modules au fil des années. Trois vérifications annuelles évitent la plupart des problèmes.'],
        list: [
          'Un seul module SEO actif pour les balises et le balisage ; deux modules qui produisent chacun un balisage Product créent des données contradictoires.',
          'Les modules de navigation à facettes : les combinaisons de filtres peuvent créer des milliers d’adresses ; elles doivent être exclues de l’indexation ou porter une canonique vers la catégorie.',
          'Les modules désactivés mais non désinstallés, qui laissent parfois des balises ou des scripts dans le thème.',
        ],
      },
      {
        h2: 'Un plan sur un mois',
        list: [
          'Semaine 1 : URL simplifiées et redirection canonique en 301 vérifiées, robots.txt relu, sitemap généré et déclaré.',
          'Semaine 2 : titres et descriptions de la page d’accueil et des dix catégories principales.',
          'Semaine 3 : marque, référence et EAN13 complétés sur les produits qui font le chiffre d’affaires ; test du balisage sur trois fiches.',
          'Semaine 4 : inventaire des modules, nettoyage des filtres indexables, liste des redirections de produits supprimés.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il activer les URL accentuées ?', a: 'Ce n’est pas nécessaire au référencement. Des adresses sans accents sont plus simples à partager et à copier ; si vos adresses actuelles en contiennent et sont bien référencées, ne les changez pas sans redirections.' },
      { q: 'Faut-il passer à une version récente de PrestaShop pour le SEO ?', a: 'Pas pour le SEO en soi, mais pour la sécurité et la compatibilité des modules. Une montée de version change parfois les adresses ou le thème : préparez-la comme une refonte, avec la liste des redirections.' },
      { q: 'Le champ mots-clés sert-il encore ?', a: 'Non pour Google, qui indique ne pas utiliser la balise meta keywords. Concentrez-vous sur le titre, la description et le contenu de la page.' },
      { q: 'Mon thème gère-t-il la balise canonique ?', a: 'Vérifiez dans le code source d’une fiche produit : une ligne contenant rel="canonical" doit pointer vers l’adresse principale. Sinon, la redirection canonique de PrestaShop ne suffit pas.' },
    ],
    sources: [
      { label: 'Documentation PrestaShop 1.7, SEO et URL', url: 'https://docs.prestashop-project.org/1.7-documentation/french/guide-utilisateur/configurer-boutique/configurer-parametres-boutique/trafic/seo-et-url', note: VU },
      { label: 'PrestaShop, module gsitemap (dépôt officiel)', url: 'https://github.com/PrestaShop/gsitemap', note: VU },
      { label: 'W3Techs, parts d’usage des gestionnaires de contenu', url: 'https://w3techs.com/technologies/overview/content_management', note: `chiffres du 14 nov. 2026 ; ${VU}` },
      { label: 'Google Search Central, indiquer une URL canonique', url: 'https://developers.google.com/search/docs/advanced/guidelines/duplicate-content?authuser=0', note: VU },
      { label: 'Aide Google Merchant Center, attributs de données structurées pris en charge', url: 'https://support.google.com/merchants/answer/6386198?hl=en', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO (balise meta keywords)', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
    ],
    cta: { text: 'Balise canonique, balisage produit, texte lisible : auditez une fiche de votre boutique avec l’outil gratuit.', href: '/outils/fiche-produit', label: 'Auditer une fiche produit' },
    related: ['fiche-produit-et-ia', 'google-merchant-center', 'refonte-site-sans-perdre-seo', 'seo-images'],
  },

  /* ------------------------------------------------------------------ */
  /* Google Merchant Center                                              */
  /* ------------------------------------------------------------------ */
  {
    slug: 'google-merchant-center',
    seoTitle: 'Google Merchant Center : vos produits gratuits sur Google',
    title: 'Google Merchant Center : vos produits gratuits sur Google',
    description:
      'Fiches gratuites, flux ou balisage, attributs obligatoires, textes générés par IA, achats dans les assistants : Merchant Center pour une boutique française.',
    updated: D,
    published: D,
    intro: [
      'Beaucoup de boutiques associent Google Merchant Center à la publicité Shopping, donc à un budget. C’est oublier que Merchant Center sert aussi à afficher vos produits gratuitement sur Google : dans les résultats de recherche, l’onglet Shopping, Images, Lens, Maps et même Gemini. Pour une petite boutique, c’est l’un des leviers les plus directs, et il ne coûte que du temps.',
      'Ce guide explique comment ouvrir et alimenter un compte, quelles données sont exigées, comment éviter les refus, et ce que change l’arrivée des achats dans les assistants d’IA. Il s’appuie sur l’aide officielle de Google, consultée le 15 novembre 2026.',
    ],
    sections: [
      {
        h2: 'Les fiches gratuites : où vos produits peuvent apparaître',
        paras: [
          'Google décrit les fiches gratuites comme des informations détaillées sur vos produits, affichées sans frais, distinctes des annonces payantes et cumulables avec elles [1]. Elles peuvent apparaître dans la recherche Google (résultats enrichis), l’onglet Shopping, y compris en fiches locales pour les produits en magasin, Google Images et Lens, YouTube dans certains pays, Google Maps et le module produits de la fiche d’établissement, ainsi que Gemini [1].',
          'Les nouveaux comptes sont inscrits par défaut, et le statut se vérifie dans la page des fiches gratuites de Merchant Center [1]. Google le précise : les fiches gratuites ne garantissent pas l’affichage ; Google associe vos produits aux recherches à partir des données fournies [1]. La qualité des données est donc tout l’enjeu.',
        ],
      },
      {
        h2: 'Étape 1 : choisir comment envoyer vos produits',
        paras: ['Trois voies existent, à choisir selon votre outil.'],
        list: [
          'Le connecteur de votre plateforme (Shopify, PrestaShop, WooCommerce et d’autres proposent une application ou un module officiel ou tiers) : c’est le plus simple, il synchronise prix et stocks.',
          'Un fichier de flux (tableur ou XML), envoyé à intervalle régulier : utile pour un petit catalogue stable ou un outil sans connecteur.',
          'Les données structurées de vos pages : Google peut récupérer des informations produits directement depuis vos pages pour les tenir à jour [2]. Pour que les mises à jour automatiques soient exactes, précisez price, priceCurrency, availability et itemCondition [2].',
        ],
        after: [
          'Quelle que soit la voie, une règle s’applique au balisage : il doit figurer dans le HTML renvoyé par le serveur, pas être généré par JavaScript après chargement, il ne doit pas changer selon le visiteur, et il doit correspondre à ce que voit le client ; Google recommande le format JSON-LD [2].',
        ],
      },
      {
        h2: 'Étape 2 : les attributs obligatoires, sans exception',
        paras: [
          'Google exige pour chaque produit un identifiant, un titre, un lien, un lien d’image, un prix, une description et une disponibilité [1]. La marque, le code GTIN ou la référence fabricant (MPN) et l’état sont requis dans certains cas, et les vêtements demandent des attributs supplémentaires comme la couleur, la taille, la tranche d’âge et le genre [1].',
        ],
        list: [
          'Titre : le nom du produit tel qu’un acheteur le chercherait, avec marque, modèle et caractéristique principale (« Bougie parfumée cire de soja 200 g – figue »), sans majuscules criardes ni « PROMO ».',
          'Image : une photo nette du produit sur fond neutre, sans texte promotionnel incrusté.',
          'Prix et disponibilité : strictement identiques à la page. Un écart est la première cause de refus.',
          'GTIN : le code-barres du fabricant (EAN-13 en Europe) quand il existe. Ne l’inventez pas ; pour vos créations, indiquez qu’il n’en existe pas.',
        ],
      },
      {
        h2: 'Étape 3 : livraison et retours',
        paras: [
          'Google demande d’ajouter les informations sur votre politique de retour et de configurer les paramètres de livraison, obligatoires dans une liste de pays [1]. Faites-le dans Merchant Center même si votre pays n’y figure pas : un acheteur compare aussi les frais de port, et un produit sans information de livraison est moins attractif à côté de ceux qui en ont.',
          'Les données structurées acceptent aussi ces informations (shippingDetails pour la livraison, hasMerchantReturnPolicy pour les retours) [2]. Si vous les déclarez dans les deux, gardez-les identiques.',
        ],
      },
      {
        h2: 'Étape 4 : les textes et images générés par IA',
        paras: [
          'C’est une règle récente et peu connue. Google exige que les images générées par IA portent la métadonnée IPTC DigitalSourceType avec la valeur TrainedAlgorithmicMedia, et que les titres et descriptions de produits générés par IA soient fournis séparément et signalés comme tels [3]. Si vous utilisez un outil qui réécrit vos titres en masse, vérifiez comment il les envoie à Merchant Center.',
          'Au-delà de la règle, la prudence s’impose : un titre généré qui ajoute une caractéristique inexacte (« imperméable » pour un produit simplement déperlant) crée un écart entre le flux et la réalité, puis des retours et des avis négatifs. Relisez au moins les titres de vos meilleures ventes.',
        ],
      },
      {
        h2: 'Étape 5 : lire les diagnostics et corriger les refus',
        list: [
          'Ouvrez chaque semaine la page des produits refusés ou limités, triée par nombre de produits concernés.',
          'Corrigez d’abord les problèmes qui touchent beaucoup de produits : souvent un attribut manquant dans le connecteur, ou un écart systématique de prix (TTC contre HT, prix barré).',
          'Pour un refus lié aux règles, lisez la règle avant de redemander un examen ; une demande sans correction est généralement refusée à nouveau.',
          'Gardez une trace des corrections : la même erreur revient souvent après une mise à jour du connecteur.',
        ],
      },
      {
        h2: 'Pourquoi Merchant Center compte aussi pour l’IA',
        paras: [
          'Google indiquait en mai 2025 que son Shopping Graph comptait plus de 50 milliards de fiches produits, dont plus de 2 milliards actualisées chaque heure, et annonçait des fonctions d’achat dans le mode IA, d’abord aux États-Unis [4]. Gemini figure désormais parmi les surfaces des fiches gratuites [1]. Les données que vous envoyez à Merchant Center alimentent donc aussi les réponses de l’IA de Google sur les produits.',
          'Ailleurs, le mouvement est le même. OpenAI a lancé fin septembre 2025 l’achat intégré à ChatGPT (« Instant Checkout ») avec des vendeurs américains d’Etsy, en annonçant plus d’un million de marchands Shopify à venir, et invite les marchands à postuler pour fournir leurs produits [5]. Shopify a annoncé en décembre 2025 la diffusion des catalogues de ses marchands vers ChatGPT, Perplexity et Copilot [6]. Les conditions et les pays évoluent vite ; ce qui ne change pas, c’est que tous ces systèmes ont besoin des mêmes données exactes : titre, attributs, prix, stock, identifiants.',
        ],
      },
      {
        h2: 'Vous avez aussi une boutique physique',
        paras: [
          'Les fiches gratuites couvrent aussi les produits en magasin : ils peuvent apparaître dans l’onglet Shopping en fiches locales, ainsi que dans Google Maps et le module produits de votre fiche d’établissement [1]. Pour un commerce qui vend en ligne et en boutique, c’est un moyen de montrer à un client proche que le produit est disponible à deux rues de chez lui.',
          'Cela suppose de relier Merchant Center à votre fiche Google Business Profile et de fournir des informations de stock par magasin, généralement via votre logiciel de caisse ou un flux dédié. C’est plus exigeant que les fiches en ligne : des stocks faux en magasin font venir des clients pour rien. Ne l’activez que si vos stocks sont fiables au jour près.',
        ],
      },
      {
        h2: 'Les erreurs qui reviennent le plus',
        list: [
          'Le prix affiché change selon le pays ou la session du visiteur, alors que le flux en donne un seul : Google demande que la page ne varie pas selon le visiteur [2].',
          'Les promotions affichées sur la page mais absentes du flux, ou l’inverse.',
          'Les produits épuisés marqués « en stock » dans le flux parce que le connecteur ne se synchronise qu’une fois par jour.',
          'Des titres remplis de mots-clés ou en majuscules, qui sont refusés ou se lisent mal.',
          'Des images avec bordures, logos ou textes promotionnels incrustés.',
          'Un compte ouvert au nom d’un ancien prestataire : comme pour la Search Console, l’accès administrateur doit rester à l’entreprise.',
        ],
      },
      {
        h2: 'Le contrôle mensuel',
        list: [
          'Produits actifs, limités, refusés : la tendance est-elle stable ?',
          'Cinq produits pris au hasard : prix et stock identiques entre la page, le balisage et Merchant Center ?',
          'Les nouveaux produits du mois sont-ils bien remontés ?',
          'Les performances des fiches gratuites (clics, impressions) par produit : lesquels sont vus et jamais cliqués ? Souvent un titre ou une image à revoir.',
          'Les avis produits, si vous en collectez : sont-ils transmis et à jour ? Ils font partie de ce qu’un acheteur compare.',
        ],
      },
    ],
    faq: [
      { q: 'Merchant Center est-il payant ?', a: 'Non. Le compte et les fiches gratuites sont gratuits. Seules les annonces Shopping, gérées dans Google Ads, sont payantes.' },
      { q: 'Combien de temps pour que mes produits apparaissent ?', a: 'Google examine les produits avant de les afficher, et le délai varie selon le compte et le catalogue ; suivez le statut dans les diagnostics. Même validés, les produits ne sont pas garantis d’apparaître : Google les associe aux recherches selon la qualité des données fournies.' },
      { q: 'Faut-il un flux si mes pages ont un balisage produit ?', a: 'Pas forcément : Google peut lire les données structurées de vos pages. Un flux ou un connecteur reste plus fiable pour un catalogue qui change souvent.' },
      { q: 'Mes produits artisanaux n’ont pas de code-barres : est-ce un problème ?', a: 'Non. Le GTIN n’est exigé que lorsqu’il existe. Indiquez qu’il n’y en a pas, et renseignez la marque (votre nom d’atelier) et une référence propre.' },
    ],
    sources: [
      { label: 'Aide Google Merchant Center, fiches gratuites de produits', url: 'https://support.google.com/merchants/answer/13889434?hl=en', note: VU },
      { label: 'Aide Google Merchant Center, attributs de données structurées pris en charge', url: 'https://support.google.com/merchants/answer/6386198?hl=en', note: VU },
      { label: 'Google Search Central, utiliser du contenu généré par IA (règles pour l’e-commerce)', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', note: `mis à jour le 1er oct. 2026 ; ${VU}` },
      { label: 'Blog Google, achats dans le mode IA et Shopping Graph', url: 'https://blog.google/products/shopping/google-shopping-ai-mode-virtual-try-on-update/', note: `20 mai 2025 ; ${VU}` },
      { label: 'Search Engine Roundtable, ChatGPT lance Instant Checkout et l’Agentic Commerce Protocol', url: 'https://www.seroundtable.com/openai-chatgpt-instant-checkout-with-agentic-commerce-protocol-40194.html', note: `30 sept. 2025 ; ${VU}` },
      { label: 'Shopify, Winter ’26 Edition : Agentic Storefronts', url: 'https://www.shopify.com/news/winter-26-edition-agentic-storefronts', note: `10 déc. 2025 ; ${VU}` },
    ],
    cta: { text: 'Votre balisage produit est-il complet et conforme à la page ? Testez une fiche avec l’outil gratuit.', href: '/outils/fiche-produit', label: 'Auditer une fiche produit' },
    related: ['fiche-produit-et-ia', 'seo-shopify', 'seo-prestashop', 'donnees-structurees-utiles'],
  },

  /* ------------------------------------------------------------------ */
  /* Maillage interne                                                    */
  /* ------------------------------------------------------------------ */
  {
    slug: 'maillage-interne',
    seoTitle: 'Maillage interne : relier ses pages pour Google et les IA',
    title: 'Maillage interne : relier ses pages pour Google et les IA',
    description:
      'Pages orphelines, textes de lien vagues, menus trop chargés : comment relier vos pages pour que Google et les IA trouvent les plus importantes.',
    updated: D,
    published: D,
    intro: [
      'Le maillage interne, ce sont les liens d’une page de votre site vers une autre. Le sujet paraît technique ; il est en réalité éditorial. Il répond à une question simple : quand quelqu’un, ou un robot, arrive sur une page, peut-il trouver facilement les autres pages qui l’intéressent ?',
      'Google trouve la plupart des nouvelles pages par des liens [2]. Un site bien relié est mieux exploré, ses pages importantes sont mieux comprises, et ses visiteurs restent plus longtemps. Ce guide propose une méthode en cinq étapes, applicable à un site de vingt pages comme à une boutique de mille produits.',
    ],
    sections: [
      {
        h2: 'Ce que Google demande, en trois règles',
        list: [
          'Des liens lisibles : Google suit essentiellement les balises « a » avec un attribut href ; il ne peut pas extraire de façon fiable une adresse d’un élément qui n’en a pas, et les liens en javascript: ou par simple événement de clic sont à éviter [1].',
          'Des textes de lien descriptifs : le texte cliquable doit être concis, pertinent pour la page de départ et la page d’arrivée, et compréhensible seul ; évitez « cliquez ici » et le bourrage de mots-clés [1]. Pour une image cliquable, c’est son texte alternatif qui sert de texte de lien [1].',
          'Chaque page qui compte doit recevoir au moins un lien depuis une autre page du site ; il n’y a pas de nombre idéal de liens par page, mais un excès de liens est probablement un problème [1].',
        ],
      },
      {
        h2: 'Étape 1 : organiser le site en grappes',
        paras: [
          'Avant de poser des liens, décidez quelles pages sont les piliers. Pour un artisan : une page par grand service. Pour une PME : une page par offre ou par problème client. Pour une boutique : les collections principales. Chaque pilier est entouré de pages plus détaillées : sous-services, villes, études de cas, articles, fiches produits.',
          'Le schéma est simple : l’accueil mène aux piliers, chaque pilier mène à ses pages détaillées, et chaque page détaillée renvoie à son pilier et à une ou deux pages sœurs. Google note que regrouper les sujets proches dans des répertoires peut aussi l’aider, sur les grands sites, à comprendre la fréquence de changement de chaque section [2]. Les consignes de Bing vont dans le même sens pour les réponses d’IA : un sujet par adresse [3].',
        ],
      },
      {
        h2: 'Étape 2 : repérer les pages orphelines',
        paras: [
          'Une page orpheline n’est liée depuis aucune autre page du site. Elle peut figurer dans le sitemap et être indexée, mais elle est difficile à trouver et reçoit peu de considération. Les cas typiques : une page de service créée pour une campagne, une page ville ajoutée sans lien depuis la page service, un article de blog ancien sorti de la pagination.',
        ],
        list: [
          'Listez les adresses de votre sitemap.',
          'Listez les adresses trouvées en suivant les liens depuis l’accueil (c’est ce que fait l’exploration de notre analyse, ou un logiciel d’exploration).',
          'Les adresses présentes dans la première liste et absentes de la seconde sont orphelines.',
          'Pour chacune : soit elle est utile, et vous la reliez depuis son pilier ; soit elle ne l’est pas, et vous la redirigez ou la retirez.',
        ],
      },
      {
        h2: 'Étape 3 : écrire de bons textes de lien',
        paras: ['Le texte du lien dit au lecteur, et au robot, ce qu’il trouvera de l’autre côté. Comparez :'],
        list: [
          'À éviter : « Pour en savoir plus, cliquez ici. »',
          'À éviter aussi : « plombier Lyon pas cher plombier urgence Lyon » en lien, qui relève du bourrage.',
          'Mieux : « Voir nos tarifs de débouchage de canalisations ».',
          'Mieux : « Nous intervenons aussi à Villeurbanne » (le nom de la ville est le lien vers la page Villeurbanne).',
        ],
        after: [
          'Variez naturellement les formulations : si toutes les pages renvoient vers la page « Mise aux normes » avec exactement le même texte, ce n’est pas grave en soi, mais c’est le signe d’un bloc copié-collé plutôt que d’un lien écrit pour le lecteur.',
        ],
      },
      {
        h2: 'Étape 4 : placer les liens là où ils servent',
        paras: [
          'Un lien dans le corps du texte, à l’endroit où le lecteur en a besoin, est plus utile qu’un lien perdu dans un pied de page de cinquante entrées. Trois emplacements comptent :',
        ],
        list: [
          'Le menu : les piliers seulement, pas toutes les pages du site. Un menu de quarante entrées n’aide ni le visiteur ni le robot à comprendre ce qui est important.',
          'Le corps du texte : un ou deux liens par section, vers la page qui approfondit le point évoqué.',
          'La fin de page : « À lire aussi » ou « Services liés », avec trois à cinq liens choisis, pas une liste automatique de dix articles récents sans rapport.',
        ],
        after: ['Le fil d’Ariane (Accueil › Services › Débouchage) est un complément utile : il rappelle la place de la page dans le site et crée des liens vers les niveaux supérieurs.'],
      },
      {
        h2: 'Étape 5 : faire circuler l’attention vers les pages qui rapportent',
        paras: [
          'Vos pages les plus visitées ne sont pas toujours celles qui rapportent. Un article de blog qui attire du monde sur une question générale (« comment déboucher un évier ») peut renvoyer vers votre page de service (« Débouchage professionnel à Lyon : délais et tarifs »). C’est utile au lecteur qui n’y arrive pas seul, et cela signale à Google l’importance de la page de service.',
          'Méthode : dans la Search Console, listez vos dix pages qui reçoivent le plus d’impressions. Pour chacune, vérifiez qu’elle contient au moins un lien, placé naturellement, vers la page d’offre la plus proche.',
        ],
      },
      {
        h2: 'Exemple : un site d’artisan de 25 pages',
        paras: [
          'Exemple fictif : une entreprise de couverture à Tours, avec une page d’accueil, trois pages de service (réfection de toiture, zinguerie, démoussage), six pages ville, huit réalisations, cinq articles de conseil et deux pages pratiques. Avant le travail, le menu comptait quinze entrées, les réalisations n’étaient liées que depuis une page « Galerie », et les pages ville n’étaient reliées à rien.',
          'Après : le menu ne montre que les trois services, les réalisations et le contact. Chaque page de service liste, dans son texte, les villes couvertes (avec un lien vers chaque page ville) et deux ou trois réalisations du même type. Chaque réalisation renvoie à son service et à sa ville. Chaque article de conseil (« Quand démousser une toiture ? ») renvoie vers la page de service correspondante, au moment où le lecteur se demande s’il peut le faire lui-même. Plus aucune page n’est orpheline, et le visiteur qui arrive sur une réalisation trouve en un clic le service et la zone.',
        ],
      },
      {
        h2: 'Cas particulier : la boutique en ligne',
        list: [
          'Les fiches produits renvoient vers leur collection et vers des produits complémentaires réellement liés (accessoires, recharges), pas vers une sélection aléatoire.',
          'Les collections renvoient vers leurs sous-collections et vers un guide d’achat s’il existe.',
          'Les filtres de navigation créent souvent des milliers de liens vers des combinaisons sans valeur ; ces adresses doivent être exclues de l’exploration ou de l’indexation, pour concentrer l’attention sur les vraies collections.',
          'Un produit épuisé définitivement ne doit pas laisser derrière lui des liens morts : retirez les liens ou redirigez la fiche.',
        ],
      },
      {
        h2: 'Ce que le maillage change pour les IA',
        paras: [
          'Un assistant qui explore votre site pour répondre à une question suit, lui aussi, des liens. Une page de service riche que rien ne relie a moins de chances d’être trouvée qu’une page reliée depuis l’accueil et le menu. Et un texte de lien descriptif aide à comprendre, avant même de l’ouvrir, de quoi parle la page d’arrivée.',
          'Ce n’est pas un levier spécifique aux IA : c’est la même logique que pour Google. Nous n’avons pas de mesure publique de l’effet du maillage sur les citations ; nous savons seulement qu’une page introuvable ne peut pas être citée.',
        ],
      },
      {
        h2: 'Les erreurs fréquentes',
        list: [
          'Des liens vers des pages redirigées : après une refonte, mettez à jour les liens internes pour qu’ils pointent directement vers la nouvelle adresse.',
          'Des liens cassés vers des pages supprimées, qui renvoient une erreur 404.',
          'Des pages importantes accessibles seulement par le moteur de recherche interne du site, que les robots n’utilisent pas.',
          'Des menus construits en JavaScript sans vrais liens href, que Google ne peut pas suivre de façon fiable [1].',
        ],
      },
    ],
    faq: [
      { q: 'Combien de liens internes par page ?', a: 'Google dit qu’il n’y a pas de nombre magique. Un ou deux liens utiles par section, plus le menu et le fil d’Ariane, suffisent généralement. Ce qui compte est que chaque page importante en reçoive.' },
      { q: 'Faut-il refaire le maillage après chaque nouvelle page ?', a: 'Non, mais chaque nouvelle page doit recevoir au moins un lien depuis une page existante le jour de sa publication. C’est le geste qui évite les pages orphelines.' },
      { q: 'Les liens du pied de page comptent-ils ?', a: 'Oui, ce sont des liens comme les autres. Mais un pied de page de cinquante liens identiques sur toutes les pages dit peu de chose sur l’importance de chacune.' },
      { q: 'Faut-il mettre des liens en nofollow vers ses propres pages ?', a: 'Non. L’attribut nofollow sert aux liens que vous ne cautionnez pas ou aux liens payants. Entre vos propres pages, utilisez des liens normaux.' },
    ],
    sources: [
      { label: 'Google Search Central, bonnes pratiques pour les liens', url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
    ],
    cta: { text: 'Liens d’une page, textes d’ancre, liens cassés : l’outil gratuit les liste ; l’analyse du site repère ensuite les pages orphelines.', href: '/outils/analyse-liens', label: 'Analyser les liens d’une page' },
    related: ['pages-ville-sans-doublon', 'page-que-les-ia-citent', 'audit-seo-30-minutes', 'refonte-site-sans-perdre-seo'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO B2B                                                             */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-b2b-acheteurs',
    seoTitle: 'SEO B2B : des pages pour des acheteurs qui comparent',
    title: 'SEO B2B : des pages pour des acheteurs qui comparent',
    description:
      'Les acheteurs B2B comparent sur Google et dans les assistants d’IA. Quelles pages créer, quelles preuves montrer, où être cité : la méthode pour une PME.',
    updated: D,
    published: D,
    intro: [
      'Une PME qui vend à d’autres entreprises, un éditeur de logiciel, un bureau d’études, un fabricant ou un cabinet de conseil, n’a pas le même problème qu’un commerce local. Ses acheteurs sont peu nombreux, informés, et ils comparent longtemps avant de prendre contact. De plus en plus, ils commencent cette comparaison dans un assistant d’IA.',
      'Ce guide explique comment ces acheteurs cherchent, selon les études publiées, quelles pages un site B2B doit avoir pour être retenu, et comment exister dans les sources que lisent les assistants. L’entreprise d’exemple, Hydratec, fabricant de pompes industrielles près de Grenoble, est fictive.',
    ],
    sections: [
      {
        h2: 'Comment cherchent les acheteurs B2B en 2026',
        paras: [
          'Deux enquêtes donnent un ordre de grandeur. Selon Forrester (enquête 2025 sur le parcours des acheteurs), 94 % des acheteurs professionnels utilisent l’IA dans leur processus d’achat, et deux fois plus d’acheteurs citent l’IA générative ou la recherche conversationnelle comme leur source d’information la plus importante que n’importe quelle autre source [2]. Selon G2, qui a interrogé 1 169 décideurs B2B en avril 2025, près de huit sur dix disent que la recherche par IA a changé leur façon de se renseigner, 29 % commencent leurs recherches plus souvent par un assistant que par Google, et 17 % citent les assistants d’IA parmi les sources qui influencent le plus leur liste de fournisseurs, devant les sites d’avis logiciels (15 %) [1].',
          'Deux précautions : ces enquêtes portent surtout sur l’achat de logiciels et sur des acheteurs anglophones, et G2 indique avoir utilisé l’IA générative pour définir les axes de l’étude [1]. Elles disent néanmoins une chose claire : la liste de fournisseurs se forme de plus en plus avant le premier contact, et en partie dans un assistant.',
        ],
      },
      {
        h2: 'Les pages qu’un site B2B doit avoir',
        paras: ['Un acheteur qui compare cherche des réponses précises. Voici les pages qui y répondent, par ordre de priorité pour Hydratec.'],
        list: [
          'Une page par offre ou par famille de produits, qui dit pour qui, pour quel usage, avec quelles limites : « Pompes doseuses pour le traitement de l’eau : débits de 0,5 à 500 l/h, pression jusqu’à 16 bar ».',
          'Une page par secteur ou par cas d’usage (« Traitement de l’eau en collectivité », « Agroalimentaire ») qui reprend les contraintes propres à ce secteur, les normes et des références.',
          'Une page de prix ou de fourchettes, même indicatives, et des conditions (délais, minimums, service après-vente). C’est la page que les acheteurs cherchent le plus et que les sites B2B publient le moins.',
          'Des études de cas réelles, autorisées par le client, avec le problème, la solution et un résultat mesuré.',
          'Une page de comparaison honnête : en quoi votre offre diffère des alternatives, y compris quand elle n’est pas le bon choix.',
          'Une page « À propos » qui établit la confiance : histoire, effectif, sites de production, certifications, dirigeants.',
        ],
      },
      {
        h2: 'Montrer l’expertise, pas la revendiquer',
        paras: [
          'Google demande des contenus faits pour les personnes et décrit, sous le nom E-E-A-T, l’expérience, l’expertise, l’autorité et la fiabilité ; il précise que la fiabilité est l’aspect le plus important [3]. En B2B, cela se traduit très concrètement :',
        ],
        list: [
          'des pages signées par l’ingénieur ou le responsable produit, avec son rôle ;',
          'des chiffres techniques précis, des normes citées, des fiches techniques téléchargeables, mais aussi résumées en texte sur la page ;',
          'des réponses aux objections réelles (« vos pompes sont-elles compatibles avec l’acide sulfurique concentré ? »), y compris quand la réponse est non ;',
          'des dates de mise à jour visibles sur les pages techniques et tarifaires.',
        ],
        after: ['« Leader de son marché », « solutions innovantes » et « partenaire de confiance » ne prouvent rien. Une référence client nommée et un délai de livraison chiffré prouvent quelque chose.'],
      },
      {
        h2: 'Écrire pour être cité par un assistant',
        paras: [
          'Les consignes de Bing, réécrites en 2026 pour les réponses d’IA, recommandent d’énoncer les faits directement, de garder des noms d’entité clairs et constants, et de placer l’essentiel en haut de chaque page, un sujet par adresse [4]. Pour un site B2B, cela veut dire :',
        ],
        list: [
          'Le nom exact de l’entreprise et de ses gammes, écrit de la même façon partout (site, LinkedIn, salons, annuaires).',
          'Une phrase de réponse en tête de chaque page d’offre : ce que c’est, pour qui, la donnée clé.',
          'Des titres de section qui reprennent les questions des acheteurs (« Quel débit pour une station de 5 000 équivalents-habitants ? »).',
          'Des tableaux de caractéristiques en texte, pas en image.',
        ],
      },
      {
        h2: 'Exister là où les assistants vont chercher',
        paras: [
          'L’étude de l’université de Toronto déjà citée dans nos guides observe que les moteurs d’IA s’appuient très majoritairement sur des sources tierces ; pour les logiciels au Canada, 74,2 % des sources citées étaient tierces, contre 31,8 % dans Google [6]. En B2B, ces sources tierces sont typiquement :',
        ],
        list: [
          'les comparateurs et annuaires professionnels de votre secteur (places de marché industrielles, comparateurs de logiciels, annuaires de prestataires) ;',
          'la presse professionnelle et les sites des fédérations ;',
          'les profils et publications LinkedIn de l’entreprise et de ses experts ;',
          'les catalogues des distributeurs qui revendent vos produits.',
        ],
        after: [
          'Méthode : posez à ChatGPT, Perplexity et Copilot dix questions d’acheteurs sans citer votre nom (« fabricant français de pompes doseuses pour collectivités »), relevez les sources citées, et vérifiez où vous figurez. Les absences sont votre plan d’action. Interdits : acheter des mentions ou des avis, ou proposer une contrepartie cachée ; Google range ces pratiques parmi le spam de liens et rappelle que les liens payants doivent être signalés [5].',
        ],
      },
      {
        h2: 'La page de comparaison, sans dénigrement',
        paras: [
          'Les acheteurs demandent souvent aux assistants « quelle différence entre X et Y ? » ou « alternative à X ». Si vous ne publiez rien sur ce sujet, d’autres le feront à votre place, parfois avec des informations fausses ou datées.',
          'Une bonne page de comparaison reste factuelle : un tableau des caractéristiques vérifiables, la date de la comparaison, les sources des informations sur les concurrents (leur site, leur documentation), et une section « quand choisir l’autre solution ». Cette dernière section fait la crédibilité de la page. Évitez les affirmations invérifiables et le ton agressif : la publicité comparative est encadrée par le droit français, et une page qui nomme des concurrents mérite la relecture d’un juriste.',
        ],
      },
      {
        h2: 'Mesurer ce qui compte en B2B',
        paras: [
          'Le trafic n’est pas le bon indicateur pour une PME B2B : quelques dizaines de visites qualifiées par mois peuvent valoir plus que des milliers de visites curieuses. Suivez plutôt :',
        ],
        list: [
          'les demandes de contact et de devis, avec la page d’arrivée et l’origine (moteur, assistant, réseau social) ;',
          'la présence de votre nom dans les réponses des assistants sur vos dix questions de référence, mesurée chaque mois avec les mêmes questions ;',
          'la question « comment nous avez-vous connus ? » posée systématiquement au premier rendez-vous, avec la réponse « un assistant d’IA » parmi les choix ;',
          'les impressions dans la Search Console sur les requêtes de comparaison (« alternative à », « comparatif », « prix »).',
        ],
      },
      {
        h2: 'Un plan sur trois mois',
        list: [
          'Mois 1 : mesurer (dix questions, trois assistants) ; réécrire le début des pages d’offre ; publier une page de prix ou de fourchettes.',
          'Mois 2 : deux études de cas autorisées ; une page par secteur prioritaire ; mise en cohérence des profils et annuaires.',
          'Mois 3 : une page de comparaison honnête ; contact avec deux médias ou comparateurs cités par les assistants ; nouvelle mesure avec les mêmes questions.',
          'Ensuite : une étude de cas et une mise à jour des pages techniques par trimestre, et la même mesure tous les mois, pour comparer ce qui est comparable.',
        ],
        after: ['Rien ne garantit une citation, et vos concurrents travaillent aussi. Ce plan augmente les chances d’être lu, compris et jugé fiable, ce qui est le maximum qu’un site puisse faire.'],
      },
    ],
    faq: [
      { q: 'Faut-il afficher ses prix en B2B ?', a: 'Une fourchette ou un prix de départ suffit souvent. Les acheteurs la cherchent, et les assistants ne peuvent pas citer un prix qui n’est écrit nulle part. Sans prix, vous laissez aux concurrents le soin de cadrer la discussion.' },
      { q: 'Faut-il des pages en anglais ?', a: 'Si vous vendez à l’export, oui, au moins pour vos offres principales. Les acheteurs étrangers interrogent les assistants dans leur langue, et une page traduite et relue est une source de plus qu’ils peuvent citer.' },
      { q: 'Un blog est-il utile pour une PME industrielle ?', a: 'S’il répond à des questions techniques réelles de vos clients, oui. S’il publie des actualités de l’entreprise, beaucoup moins. Deux articles techniques solides par trimestre valent mieux qu’un article creux par semaine.' },
      { q: 'Combien de temps avant d’apparaître dans les réponses des assistants ?', a: 'Personne ne peut le promettre. Une page nouvelle doit d’abord être indexée et jugée utile ; une mention dans une source tierce dépend de ce tiers. Comptez en mois, et mesurez avant et après.' },
      { q: 'LinkedIn compte-t-il pour les assistants ?', a: 'Les publications et pages LinkedIn font partie des sources tierces que les assistants peuvent lire. Un profil d’entreprise complet et cohérent avec le site est un minimum.' },
    ],
    sources: [
      { label: 'G2, 2025 Buyer Behavior Report (communiqué Business Wire, 14 mai 2025)', url: 'https://www.businesswire.com/news/home/20250514382531/en', note: `enquête en ligne auprès de 1 169 décideurs B2B, avril 2025 ; ${VU}` },
      { label: 'Forrester, B2B Buyers Make Zero-Click Number One', url: 'https://www.forrester.com/blogs/b2b_buyers_make_zero_click_buying_number_one/', note: `22 janv. 2026, enquête Buyers’ Journey 2025, échantillon non précisé dans l’article ; ${VU}` },
      { label: 'Google Search Central, créer des contenus utiles et fiables (E-E-A-T)', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content', note: VU },
      { label: 'Search Engine Journal, Bing ajoute le GEO à ses consignes officielles', url: 'https://searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/', note: `27 févr. 2026 ; ${VU}` },
      { label: 'Google Search Central, règles relatives au spam (liens)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Chen et al., Université de Toronto, Generative Engine Optimization: How to Dominate AI Search', url: 'https://arxiv.org/html/2509.08919v1', note: `prépublication, septembre 2025 ; ${VU}` },
    ],
    cta: { text: 'Voyez quels noms les assistants donnent quand un acheteur cherche votre type d’offre, et quelles sources ils citent.', href: '/pme', label: 'Voir le parcours PME' },
    related: ['apparaitre-dans-chatgpt-pme', 'page-que-les-ia-citent', 'suivre-ses-questions-chatgpt', 'liens-entrants-sans-risque'],
  },

  /* ------------------------------------------------------------------ */
  /* Audit SEO en 30 minutes                                             */
  /* ------------------------------------------------------------------ */
  {
    slug: 'audit-seo-30-minutes',
    seoTitle: 'Audit SEO en 30 minutes : la méthode sans outil payant',
    title: 'Audit SEO en 30 minutes : la méthode sans outil payant',
    description:
      'Six contrôles de cinq minutes, avec les outils gratuits de Google : indexation, robots, pages clés, titres, mobile, balisage. Pour savoir où vous en êtes, vite.',
    updated: D,
    published: D,
    intro: [
      'Avant de payer une agence ou un outil, un dirigeant peut savoir en une demi-heure si son site a un problème grave. Pas tout voir, mais repérer ce qui bloque : un site absent de Google, des robots refusés, des pages importantes invisibles, des titres vides.',
      'Ce guide propose six contrôles de cinq minutes chacun, dans un ordre précis : chaque étape suppose que la précédente est réglée. Il suffit d’un navigateur et, si vous l’avez, d’un accès à la Google Search Console.',
    ],
    sections: [
      {
        h2: 'Minute 0 à 5 : le site est-il dans Google ?',
        paras: [
          'Tapez dans Google « site:votresite.fr ». L’opérateur site: demande des résultats limités à un domaine ; Google précise qu’il ne renvoie pas forcément toutes les adresses indexées et que la liste n’est pas exhaustive [1]. Il sert donc à un premier constat, pas à un inventaire.',
        ],
        list: [
          'Aucun résultat : problème grave (site bloqué, en noindex, ou trop récent). Passez directement à l’étape 2.',
          'Des résultats, mais pas vos pages importantes : notez lesquelles manquent.',
          'Des résultats étranges (pages en anglais que vous n’avez pas écrites, pages de casino) : votre site a peut-être été piraté. Faites appel à un professionnel avant toute autre chose.',
        ],
        after: ['Pour une page précise, l’outil d’inspection d’URL de la Search Console donne la réponse fiable : indexée ou non, et pourquoi [1].'],
      },
      {
        h2: 'Minute 5 à 10 : les robots peuvent-ils entrer ?',
        paras: [
          'Ouvrez votresite.fr/robots.txt. Une ligne « Disallow: / » sous « User-agent: * » interdit tout le site à tous les robots. C’est l’erreur la plus grave et la plus facile à corriger. Rappel : robots.txt ne sert pas à retirer une page de Google ; pour cela, il faut une balise noindex ou une protection par mot de passe [2].',
          'Regardez ensuite les robots d’IA. OpenAI indique qu’un site qui refuse OAI-SearchBot n’apparaît pas dans les réponses de recherche de ChatGPT [6] ; Perplexity recommande d’autoriser PerplexityBot pour apparaître dans ses résultats [7]. Si votre fichier les bloque sans que vous l’ayez décidé, notez-le. Puis affichez le code source de votre page d’accueil (Ctrl+U) et cherchez « noindex » : s’il apparaît, la page demande à ne pas être indexée.',
        ],
      },
      {
        h2: 'Minute 10 à 15 : vos pages clés sont-elles lisibles ?',
        paras: [
          'Choisissez vos trois pages les plus importantes : en général l’accueil, la page du service principal, et la page contact ou une fiche produit vedette. Pour chacune :',
        ],
        list: [
          'Affichez le code source et cherchez une phrase du texte principal. Si elle n’y est pas, le texte est chargé par script et risque d’être invisible pour les robots d’IA.',
          'Vérifiez que la page dit en une phrase, en haut, ce que vous faites, pour qui et où.',
          'Vérifiez que le nom, l’adresse et le téléphone sont écrits en texte, identiques sur les trois pages.',
          'Vérifiez que la page est accessible en deux clics au plus depuis l’accueil.',
        ],
      },
      {
        h2: 'Minute 15 à 20 : titres et descriptions',
        paras: [
          'Retournez sur la recherche « site:votresite.fr » et lisez les titres affichés. Google recommande des titres descriptifs et concis, propres à chaque page, sans texte répété d’une page à l’autre ni bourrage de mots-clés [5]. Il peut réécrire un titre vide, trop générique, inexact ou répété [5].',
        ],
        list: [
          'Titres identiques sur plusieurs pages (« Accueil », « Nom de l’entreprise ») : à corriger en priorité.',
          'Titres qui ne disent pas le service ni le lieu pour une entreprise locale.',
          'Titres manifestement réécrits par Google : comparez avec le titre de votre page pour comprendre pourquoi.',
        ],
        after: ['Notre guide sur les titres et méta-descriptions détaille comment les réécrire.'],
      },
      {
        h2: 'Minute 20 à 25 : mobile et vitesse',
        paras: [
          'Depuis le 5 juillet 2024, Google explore et indexe les sites avec son robot pour smartphone, et les sites dont le contenu est entièrement inaccessible sur mobile risquent de sortir de l’index [4]. Ouvrez vos trois pages clés sur votre téléphone, en 4G plutôt qu’en wifi :',
        ],
        list: [
          'Le texte est-il lisible sans zoomer ? Les boutons sont-ils cliquables du pouce ?',
          'Le contenu est-il le même que sur ordinateur, ou des sections ont-elles disparu ?',
          'La page s’affiche-t-elle en moins de trois secondes environ, à l’œil ?',
        ],
        after: ['Pour une mesure plus précise, lancez PageSpeed Insights sur la page d’accueil. Notre guide sur les Core Web Vitals explique comment lire les résultats sans jargon.'],
      },
      {
        h2: 'Minute 25 à 30 : le balisage de l’entreprise',
        paras: [
          'Collez l’adresse de votre page d’accueil dans le test des résultats enrichis de Google. Il indique quelles données structurées il trouve, en JSON-LD, RDFa ou Microdata, et signale les erreurs ; il teste par défaut avec un agent mobile [3].',
        ],
        list: [
          'Aucun balisage : ce n’est pas grave en soi, mais un balisage Organization ou LocalBusiness lève des ambiguïtés sur votre identité.',
          'Des erreurs : notez-les pour votre prestataire.',
          'Des informations différentes de celles affichées (ancienne adresse, autre téléphone) : à corriger, c’est une source de confusion.',
        ],
      },
      {
        h2: 'Bonus pour un commerce : cinq minutes sur la fiche Google',
        list: [
          'Cherchez le nom de votre entreprise dans Google Maps : la fiche existe-t-elle, et une seule fois ?',
          'Les horaires sont-ils justes, y compris pour les prochains jours fériés ?',
          'La catégorie principale est-elle la plus précise possible ?',
          'Le téléphone et le site sont-ils les mêmes que sur votre site ?',
          'Les derniers avis ont-ils reçu une réponse ?',
        ],
        after: ['Notre guide sur la fiche Google Business Profile reprend chaque champ en détail.'],
      },
      {
        h2: 'Bonus : cinq minutes avec les assistants d’IA',
        paras: [
          'Posez à ChatGPT, Perplexity ou Gemini deux questions : « Que sais-tu de [nom de votre entreprise] à [ville] ? » puis une question de client sans votre nom, par exemple « quel électricien à Rezé pour une mise aux normes ? ». Notez ce qui est dit, ce qui est faux, et les sources citées quand l’assistant en affiche.',
          'Ce n’est pas une mesure : les réponses changent d’une fois à l’autre, et deux questions ne disent rien de votre visibilité réelle. C’est un repérage. Une information fausse répétée (ancienne adresse, service que vous ne faites pas) mérite d’être traitée ; notre guide sur les erreurs des IA explique comment remonter à la source.',
        ],
      },
      {
        h2: 'Que faire de vos notes',
        paras: ['Classez ce que vous avez trouvé en trois colonnes, et traitez-les dans cet ordre.'],
        list: [
          'Bloquant : site ou pages absents de Google, robots refusés par erreur, noindex oublié, piratage. À corriger cette semaine.',
          'Important : texte invisible sans JavaScript, coordonnées incohérentes, titres en double, contenu manquant sur mobile. À corriger ce mois-ci.',
          'Amélioration : vitesse, balisage, titres perfectibles. À planifier.',
        ],
        after: [
          'Ce contrôle manuel ne remplace pas une exploration complète du site : il ne voit pas les liens cassés, les pages orphelines, les doublons ni les redirections en chaîne. C’est ce que fait notre analyse gratuite, qui explore jusqu’à 60 pages et classe les problèmes par priorité.',
        ],
      },
      {
        h2: 'Notez tout, avec la date',
        paras: [
          'Gardez vos constats dans un document daté : ce que vous avez vu, sur quelle page, et ce que vous avez décidé. Dans trois mois, quand vous referez le contrôle, vous saurez ce qui a changé et ce qui a été corrigé. Et si vous confiez le travail à un prestataire, ce document lui fait gagner une heure et vous permet de vérifier ce qu’il a réellement fait.',
        ],
      },
      {
        h2: 'Les erreurs d’interprétation fréquentes',
        list: [
          'Conclure que « Google ne connaît pas mon site » parce qu’une recherche sur votre métier ne vous affiche pas : être indexé et être bien placé sont deux choses différentes.',
          'Paniquer devant un score de vitesse de 60 sur 100 : le score de laboratoire n’est pas ce que vivent vos clients, et un site lent mais utile reste trouvable.',
          'Chercher votre propre nom dans un navigateur où vous êtes connecté : l’historique peut biaiser ce que vous voyez. Utilisez une fenêtre de navigation privée.',
          'Tout corriger en même temps : vous ne saurez pas ce qui a eu un effet.',
          'Croire qu’un problème corrigé se voit le lendemain : Google doit repasser sur les pages, ce qui prend de quelques jours à quelques semaines selon le site.',
        ],
      },
    ],
    faq: [
      { q: 'Faut-il la Search Console pour cet audit ?', a: 'Non, mais elle le rend plus fiable : l’inspection d’URL dit précisément si une page est indexée et pourquoi. Elle est gratuite et se configure en quelques minutes.' },
      { q: 'À quelle fréquence refaire ce contrôle ?', a: 'Après chaque modification importante du site (refonte, changement de thème, migration) et sinon une fois par trimestre. Le contrôle de robots.txt et du noindex prend deux minutes.' },
      { q: 'Je ne trouve pas mon fichier robots.txt : est-ce grave ?', a: 'Non. Sans fichier robots.txt, les robots considèrent que tout est autorisé. C’est un fichier bloquant par erreur qui pose problème, pas son absence.' },
      { q: 'Mon prestataire dit que tout va bien : comment vérifier ?', a: 'Refaites les six contrôles vous-même et comparez avec son rapport. Demandez-lui l’accès à la Search Console au nom de l’entreprise : les données de Google y sont visibles sans intermédiaire.' },
      { q: 'Ce contrôle suffit-il pour une boutique en ligne ?', a: 'Pour un premier constat, oui. Une boutique a besoin en plus de vérifier ses collections, ses filtres et ses fiches produits, qu’un contrôle de trois pages ne couvre pas.' },
    ],
    sources: [
      { label: 'Google Search Central, opérateur de recherche site:', url: 'https://developers.google.com/search/docs/monitor-debug/search-operators/all-search-site?hl=zh-cn', note: `page lue en chinois, seule version accessible ; ${VU}` },
      { label: 'Google Search Central, introduction à robots.txt', url: 'https://developers.google.com/search/docs/crawling-indexing/robots/intro.md.txt', note: VU },
      { label: 'Aide Search Console, test des résultats enrichis', url: 'https://support.google.com/webmasters/answer/7445569?hl=en', note: VU },
      { label: 'PPC Land, Google achève le passage à l’indexation mobile (juillet 2024)', url: 'https://ppc.land/google-search-completes-transition-to-mobile-first-indexing-by-july-5-2024', note: `4 juin 2024 ; ${VU}` },
      { label: 'Google Search Central, liens de titre dans les résultats', url: 'https://developers.google.com/search/docs/appearance/title-link', note: VU },
      { label: 'OpenAI, présentation des robots (GPTBot, OAI-SearchBot, ChatGPT-User)', url: 'https://developers.openai.com/api/docs/bots.md', note: VU },
      { label: 'Documentation Perplexity, PerplexityBot et Perplexity-User', url: 'https://docs.perplexity.ai/guides/perplexitybot', note: VU },
    ],
    cta: { text: 'Allez plus loin que ces six contrôles : l’analyse gratuite explore jusqu’à 60 pages et classe les problèmes par priorité.', ...CTA },
    related: ['search-console-debutants', 'core-web-vitals-sans-jargon', 'titres-meta-descriptions', 'seo-geo-sites-pros-2026'],
  },

  /* ------------------------------------------------------------------ */
  /* Refonte sans perte                                                  */
  /* ------------------------------------------------------------------ */
  {
    slug: 'refonte-site-sans-perdre-seo',
    seoTitle: 'Refonte de site : ne pas perdre son référencement',
    title: 'Refonte de site : ne pas perdre son référencement',
    description:
      'Nouveau site, nouvelles adresses : le plan de redirections 301, les contrôles avant et après la mise en ligne, et les erreurs qui font chuter le trafic.',
    updated: D,
    published: D,
    intro: [
      'Une refonte est le moment où un site perd le plus souvent son trafic. Pas parce que le nouveau site est moins bon, mais parce que les anciennes adresses, connues de Google, des annuaires, des assistants d’IA et des clients qui les ont gardées en favoris, mènent soudain à une erreur. Le travail accumulé pendant des années disparaît en une soirée.',
      'Ce guide donne la méthode pour l’éviter, que vous changiez de prestataire, d’outil (de Wix à WordPress, de PrestaShop à Shopify) ou simplement de structure. Il s’adresse au dirigeant qui pilote la refonte : vous n’aurez pas à écrire les redirections, mais vous devez savoir les exiger et les vérifier.',
    ],
    sections: [
      {
        h2: 'Le principe : chaque ancienne adresse doit mener quelque part',
        paras: [
          'Quand une page change d’adresse, il faut une redirection de l’ancienne vers la nouvelle. Google recommande, dans la mesure du possible, une redirection permanente côté serveur [1] : un code HTTP 301 (ou 308). Les redirections temporaires (302, 303, 307) disent au contraire que la page reviendra [1]. Les redirections par JavaScript ne sont à utiliser que si une redirection serveur est impossible, et Google pourrait ne jamais les voir si le rendu de la page échoue [1].',
          'Le point qui fait toute la différence : la redirection doit mener vers la page équivalente, pas vers l’accueil. Un porte-parole de Google, John Mueller, a expliqué que rediriger toutes les pages vers la page d’accueil est traité comme une erreur 404 « soft », c’est-à-dire comme si la page avait simplement disparu [4].',
        ],
      },
      {
        h2: 'Étape 1 : inventorier toutes les anciennes adresses',
        paras: ['Avant de toucher à quoi que ce soit, constituez la liste complète des adresses actuelles. Trois sources se complètent :'],
        list: [
          'le sitemap actuel du site (votresite.fr/sitemap.xml ou l’adresse indiquée dans robots.txt) ;',
          'la Search Console : rapport de performance, pages ayant reçu des clics ou des impressions sur les seize derniers mois ;',
          'une exploration complète du site actuel (notre analyse ou un logiciel d’exploration), qui trouve aussi les pages absentes du sitemap.',
        ],
        after: [
          'Ajoutez les adresses qui reçoivent des liens d’autres sites (annuaires, articles, partenaires) si vous les connaissez, et les adresses imprimées sur vos documents commerciaux (plaquettes, cartes, QR codes). Gardez ce fichier : c’est le document le plus précieux de la refonte.',
        ],
      },
      {
        h2: 'Étape 2 : construire le tableau de correspondance',
        paras: [
          'Dans un tableur, une colonne « ancienne adresse », une colonne « nouvelle adresse », une colonne « décision ». Pour chaque ligne :',
        ],
        list: [
          'La page existe dans le nouveau site, même sous un autre nom : redirection 301 vers elle.',
          'La page est fusionnée avec une autre : redirection vers la page qui reprend son contenu.',
          'La page disparaît sans équivalent : redirection vers la page parente la plus proche (la catégorie, le service) si elle répond au même besoin ; sinon, laissez une erreur 404 propre, ou 410 si la suppression est définitive.',
          'Les pages à forte valeur (celles qui reçoivent des clics dans la Search Console) méritent une vérification à la main.',
        ],
        after: [
          'Pour une boutique de milliers de produits, les correspondances se font par règles (même référence produit, même identifiant), puis par vérification manuelle des cent pages qui comptent le plus. Exigez ce tableau de votre prestataire avant la mise en ligne, pas après.',
        ],
      },
      {
        h2: 'Étape 3 : préparer le nouveau site sans le faire indexer trop tôt',
        list: [
          'Le site de préproduction doit être protégé par mot de passe, ou au minimum en noindex. Sinon, Google peut indexer une copie de votre site sur une adresse provisoire.',
          'Notez la protection utilisée, pour être sûr de la retirer le jour J. Un noindex oublié après la mise en ligne est l’accident le plus fréquent ; sur WordPress, il s’agit souvent de la case « Demander aux moteurs de recherche de ne pas indexer ce site ».',
          'Reprenez les titres, méta-descriptions et textes des pages qui marchent. Une refonte n’est pas l’occasion de raccourcir une page de service qui attirait des clients.',
          'Préparez le nouveau sitemap, qui ne doit lister que les nouvelles adresses définitives.',
        ],
      },
      {
        h2: 'Étape 4 : le jour de la mise en ligne',
        list: [
          'Mettez en place les redirections au même moment que le nouveau site, pas « dans les jours qui suivent ».',
          'Retirez la protection de préproduction et le noindex.',
          'Testez une vingtaine d’anciennes adresses importantes : chacune doit mener, en une seule redirection, à la bonne nouvelle page, avec un code 301.',
          'Déclarez le nouveau sitemap dans la Search Console et dans Bing Webmaster Tools.',
          'Mettez à jour les liens internes du nouveau site pour qu’ils pointent directement vers les nouvelles adresses, sans passer par les redirections.',
          'Changez l’adresse du site dans votre fiche Google Business Profile, vos annuaires et vos réseaux sociaux si elle a changé.',
        ],
      },
      {
        h2: 'Changement de nom de domaine : l’outil de changement d’adresse',
        paras: [
          'Si vous changez de domaine (de ancien-nom.fr à nouveau-nom.fr), la Search Console propose un outil de changement d’adresse. Il ne sert que pour un changement de domaine ou de sous-domaine, pas pour un passage de http à https ni pour des pages qui changent d’adresse dans le même site [3]. Il suppose une redirection 301 de l’ancienne page d’accueil vers la nouvelle, idéalement des pages canoniques aussi, et d’être propriétaire des deux propriétés dans la Search Console [3].',
          'Le changement reste actif 180 jours ; Google demande de garder les redirections au moins 180 jours, et plus longtemps si les anciennes adresses reçoivent encore du trafic depuis la recherche [3]. Gardez aussi l’ancien nom de domaine : le laisser expirer, c’est perdre toutes les redirections d’un coup.',
        ],
      },
      {
        h2: 'Combien de temps garder les redirections',
        paras: [
          'John Mueller, de Google, a recommandé en 2021 de garder une redirection en place au moins un an : Google doit la voir plusieurs fois avant d’enregistrer le changement d’adresse comme définitif, et il peut ne pas repasser assez souvent en moins de temps [2]. Les garder plus longtemps ne pose pas de problème [2].',
          'En pratique, gardez-les indéfiniment si elles ne coûtent rien. Les liens externes vers vos anciennes adresses, eux, ne disparaîtront jamais tous.',
        ],
      },
      {
        h2: 'Les six semaines qui suivent',
        list: [
          'Chaque semaine, ouvrez le rapport d’indexation de la Search Console : les nouvelles pages doivent apparaître comme indexées, les anciennes comme redirigées.',
          'Surveillez les erreurs 404 : chaque ancienne adresse oubliée y apparaîtra. Ajoutez la redirection manquante.',
          'Comparez les clics des pages principales avec la même période avant la refonte. Une baisse temporaire est possible ; une chute qui dure au-delà de quelques semaines signale un problème (redirections, contenu retiré, noindex).',
          'Vérifiez les réponses des assistants d’IA sur votre entreprise : une ancienne adresse de page citée qui mène à une erreur est une source perdue.',
        ],
      },
      {
        h2: 'Qui fait quoi : le dirigeant et le prestataire',
        paras: [
          'Une refonte réussie repose sur une répartition claire, écrite dans le devis ou le cahier des charges. Sans elle, chacun pense que l’autre s’occupe des redirections.',
        ],
        list: [
          'Le prestataire fournit l’inventaire des anciennes adresses, le tableau de correspondance, la mise en place des redirections et un rapport de test le jour de la mise en ligne.',
          'Le dirigeant valide le tableau pour les pages qui comptent (il sait quelles pages amènent des clients), fournit les accès à la Search Console et vérifie lui-même une dizaine d’adresses après la mise en ligne.',
          'Les deux s’engagent sur une période de suivi de six semaines, avec correction des erreurs 404 signalées.',
          'Le devis précise qui reste propriétaire du nom de domaine, de l’hébergement et des comptes, et ce qui se passe en fin de contrat.',
        ],
        after: ['Un prestataire qui refuse de chiffrer le plan de redirections, ou qui le présente comme une option, vous dit en creux qu’il ne le fera pas sérieusement.'],
      },
      {
        h2: 'Les erreurs qui coûtent le plus',
        list: [
          'Tout rediriger vers l’accueil : Google le traite comme des pages disparues [4].',
          'Des chaînes de redirections (A vers B vers C) héritées de refontes successives : redirigez directement A vers C.',
          'Supprimer les pages de contenu qui attiraient des visites (articles, guides, FAQ) parce qu’elles « ne font pas partie du nouveau design ».',
          'Changer en même temps de domaine, d’outil, de structure et de contenu : en cas de baisse, impossible de savoir pourquoi. Si vous le pouvez, étalez.',
          'Oublier les images et les PDF qui recevaient du trafic, par exemple une fiche technique très consultée.',
          'Laisser le prestataire repartir avec les accès : outil de gestion, hébergement, Search Console, nom de domaine doivent rester au nom de l’entreprise.',
        ],
      },
    ],
    faq: [
      { q: 'Peut-on faire une refonte sans perdre de trafic ?', a: 'Une baisse temporaire est possible, même avec des redirections parfaites, le temps que Google traite les changements. Personne ne peut garantir l’absence de baisse ; sans plan de redirections, en revanche, la perte peut être durable.' },
      { q: 'Faut-il rediriger les pages sans trafic ?', a: 'Oui si elles ont un équivalent dans le nouveau site : cela ne coûte rien et peut préserver des liens que vous ne connaissez pas. Une page sans équivalent ni valeur peut renvoyer une erreur 404 ou 410.' },
      { q: 'Mon outil fait-il les redirections automatiquement ?', a: 'Certains outils redirigent quand vous changez l’adresse d’une page en interne, comme Wix lors d’un changement de structure d’URL. Lors d’un changement d’outil ou de prestataire, rien n’est automatique : il faut le tableau de correspondance.' },
    ],
    sources: [
      { label: 'Google Search Central, les redirections et la recherche Google', url: 'https://developers.google.com/search/docs/crawling-indexing/301-redirects?hl=fr', note: VU },
      { label: 'Search Engine Journal, Google conseille de garder les redirections 301 au moins un an', url: 'https://www.searchenginejournal.com/google-keep-301-redirects-in-place-for-a-year/', note: `2 déc. 2021 ; ${VU}` },
      { label: 'Aide Search Console, outil de changement d’adresse', url: 'https://support.google.com/webmasters/answer/9370220?hl=en', note: VU },
      { label: 'Search Engine Roundtable, rediriger toutes les pages vers l’accueil est vu comme des 404 soft', url: 'https://www.seroundtable.com/301-pages-home-soft-404-22811.html', note: `propos de John Mueller, 7 oct. 2016 ; ${VU}` },
    ],
    cta: { text: 'Après la mise en ligne, testez vos anciennes adresses : code renvoyé, nombre de redirections, page d’arrivée.', href: '/outils/redirections', label: 'Tester mes redirections' },
    related: ['seo-wordpress', 'maillage-interne', 'search-console-debutants', 'audit-seo-30-minutes'],
  },

  /* ------------------------------------------------------------------ */
  /* Titres et méta-descriptions                                         */
  /* ------------------------------------------------------------------ */
  {
    slug: 'titres-meta-descriptions',
    seoTitle: 'Titres et méta-descriptions qui donnent envie de cliquer',
    title: 'Titres et méta-descriptions qui donnent envie de cliquer',
    description:
      'Comment Google choisit le titre affiché, pourquoi il réécrit le vôtre, quelle longueur viser et comment écrire une méta-description utile. Exemples à l’appui.',
    updated: D,
    published: D,
    intro: [
      'Le titre d’une page (la balise title) est le texte bleu cliquable dans les résultats de Google. La méta-description est souvent le petit texte en dessous. Ce sont les deux premières choses qu’un client lit de vous, avant même d’arriver sur votre site, et l’une des rares choses que vous contrôlez directement dans la page de résultats.',
      'Ce guide explique ce que Google fait de ces deux éléments, selon sa documentation, ce qu’une étude à grande échelle a mesuré sur les réécritures de titres, et comment écrire les vôtres. Les exemples d’entreprises sont fictifs.',
    ],
    sections: [
      {
        h2: 'Ce que Google fait de votre titre',
        paras: [
          'Google génère le titre affiché, qu’il appelle « lien de titre », à partir de plusieurs sources : la balise title, le titre principal visible de la page, les titres h1, la balise og:title, les textes mis en évidence, d’autres textes de la page, les textes des liens qui pointent vers la page, et les données structurées WebSite [1]. Votre balise title est la principale, mais pas la seule.',
          'Google indique les cas où il remplace votre titre : titre à moitié vide, titre obsolète (une ancienne année alors que la page est à jour), titre inexact par rapport au contenu, titres quasi identiques sur plusieurs pages, absence de titre principal clair, langue différente de celle de la page, ou nom du site répété [1].',
        ],
      },
      {
        h2: 'Combien de titres Google réécrit-il ?',
        paras: [
          'L’étude la plus citée, menée par Zyppy début 2022 sur 80 959 titres de 2 370 sites, a mesuré que Google avait réécrit 61,6 % des titres [3]. La longueur jouait beaucoup : plus de 76 % des titres de plus de 60 caractères étaient réécrits, et 99,9 % au-delà de 70 ; à l’inverse, les titres de 51 à 60 caractères n’étaient réécrits que dans 39 à 42 % des cas, et les titres très courts (1 à 5 caractères) dans 96,6 % des cas [3]. Les parenthèses et crochets étaient aussi souvent modifiés [3].',
          'Ces chiffres datent de 2022 et Google a pu changer ses pratiques depuis. Ils donnent une tendance utile : ni trop court, ni trop long. Google, lui, dit qu’il n’y a pas de limite de longueur à la balise title, mais que le titre affiché est coupé au besoin, en général pour tenir dans la largeur de l’écran [1].',
        ],
      },
      {
        h2: 'Étape 1 : un titre unique et descriptif par page',
        paras: ['Google demande des titres descriptifs et concis, en évitant les libellés vagues comme « Accueil », le bourrage de mots-clés et les textes répétés d’une page à l’autre [1]. Pour une entreprise, une structure simple fonctionne presque toujours :'],
        list: [
          'Page de service : service + lieu ou précision + nom. « Débouchage de canalisations à Lyon, 7 j/7 | Plomberie Martin ».',
          'Page produit : produit + caractéristique clé + marque. « Bougie parfumée figue 200 g, cire de soja | Atelier Cire ».',
          'Page d’accueil : ce que vous faites + où + nom. « Expert-comptable pour artisans à Rennes | Cabinet Leroy ».',
          'Article : la question ou la réponse. « Combien coûte un bilan de micro-entreprise ? ».',
        ],
        after: ['Visez environ 50 à 60 caractères, en gardant l’essentiel au début : si le titre est coupé, c’est la fin qui disparaît.'],
      },
      {
        h2: 'Étape 2 : accorder le titre et le h1',
        paras: [
          'Le titre principal visible (h1) et la balise title n’ont pas à être identiques, mais ils doivent dire la même chose. L’étude Zyppy observait par exemple que lorsqu’un titre et le h1 contenaient tous deux un nombre, Google conservait un nombre dans le titre affiché dans 97,3 % des cas [3]. Un titre qui promet « 10 conseils » quand la page en donne 7 a toutes les chances d’être réécrit, à juste titre.',
        ],
      },
      {
        h2: 'Étape 3 : une méta-description utile',
        paras: [
          'Google construit les extraits affichés principalement à partir du contenu de la page, et peut utiliser la méta-description quand elle décrit mieux la page [2]. Le même document peut donc afficher des extraits différents selon la recherche. Quand elle est affichée, c’est elle qui décide souvent du clic.',
        ],
        list: [
          'Une description unique par page ; sur la page d’accueil, une description du site, ailleurs une description de la page [2].',
          'Des informations concrètes : prix, délai, zone, date, auteur, caractéristiques clés [2].',
          'Pas de liste de mots-clés ni de texte identique sur toutes les pages [2].',
          'Pas de limite de longueur officielle : Google coupe au besoin [2]. Environ 120 à 160 caractères est un repère pratique pour que l’essentiel reste visible.',
        ],
        after: [
          'Exemple pour Plomberie Martin : « Débouchage d’évier, de WC et de canalisations à Lyon et Villeurbanne. Intervention sous 2 h en semaine, devis avant travaux, à partir de 89 € TTC. » Tout y est vérifiable, et c’est le genre de phrase qui répond à la question avant le clic.',
        ],
      },
      {
        h2: 'Étape 4 : les grands sites, par modèles',
        paras: [
          'Une boutique de mille produits ne peut pas écrire mille descriptions à la main. Google admet les descriptions générées par programme sur les grands sites, à condition qu’elles restent lisibles et variées [2]. Un modèle du type « [Produit] : [caractéristique 1], [caractéristique 2]. Livraison en [délai]. » rempli depuis vos données fonctionne bien.',
          'Si vous utilisez une IA pour générer titres et descriptions, Google rappelle que ses exigences de qualité s’appliquent aussi à ces métadonnées, qui apparaissent dans les résultats [4]. Relisez au moins celles de vos pages importantes : une IA invente volontiers une caractéristique ou un délai.',
        ],
      },
      {
        h2: 'Trois exemples avant et après',
        paras: ['Exemples fictifs, pour montrer la méthode plutôt qu’une formule.'],
        list: [
          'Accueil d’un cabinet comptable. Avant : « Accueil ». Après : « Expert-comptable pour artisans et TPE à Rennes | Cabinet Leroy ». Le service, le public, le lieu et le nom, en 60 caractères.',
          'Fiche produit. Avant : « BOUGIE FIGUE – PROMO – LIVRAISON OFFERTE – ATELIER CIRE ». Après : « Bougie parfumée figue 200 g, cire de soja | Atelier Cire ». Plus de majuscules, plus de promotion dans le titre, la caractéristique clé en tête. La livraison offerte va dans la méta-description.',
          'Article de conseil. Avant : « Nos conseils (2023) ». Après : « Quand démousser une toiture ? Période, prix et précautions ». L’année périmée, que Google cite parmi les causes de réécriture [1], disparaît ; la question du lecteur apparaît.',
        ],
        after: ['Dans les trois cas, la méta-description reprend un fait vérifiable que le titre n’a pas la place de dire : un prix de départ, un délai, une zone.'],
      },
      {
        h2: 'Ce qui ne sert à rien',
        list: [
          'La balise meta keywords : Google indique ne pas l’utiliser [5].',
          'Répéter trois fois le même mot-clé dans le titre : c’est du bourrage, contraire aux règles de Google [5].',
          'Mettre tout le titre en majuscules ou multiplier les symboles : cela se lit mal et risque la réécriture.',
          'Copier le titre d’un concurrent bien placé : vous vous retrouvez avec deux pages indiscernables dans les résultats.',
          'Changer les titres chaque semaine pour « tester » sans mesure : vous ne saurez pas ce qui a marché.',
          'Mettre l’année dans le titre sans mettre à jour la page : Google cite précisément les titres obsolètes parmi les causes de réécriture [1].',
        ],
      },
      {
        h2: 'Mesurer l’effet d’une réécriture',
        list: [
          'Dans la Search Console, notez pour la page le taux de clics et la position moyenne sur les 28 derniers jours.',
          'Réécrivez le titre et la description, et notez la date.',
          'Attendez au moins quatre semaines, puis comparez sur une période de même durée, en regardant la position : un taux de clics qui monte alors que la position baisse n’a pas le même sens.',
          'Ne changez qu’une page importante à la fois, ou un groupe de pages comparables, pour pouvoir attribuer l’effet.',
        ],
      },
      {
        h2: 'Et pour les assistants d’IA ?',
        paras: [
          'Un titre descriptif aide aussi un assistant à comprendre, sans lire toute la page, de quoi elle parle, et à la retenir parmi les candidates pour une question. Un titre « Accueil » ou « Nos services » ne dit rien à personne, humain ou machine. Il n’existe pas de règle de titre propre aux IA : les mêmes qualités servent partout.',
        ],
      },
    ],
    faq: [
      { q: 'Quelle longueur idéale pour un titre ?', a: 'Google n’impose pas de limite mais coupe l’affichage. L’étude Zyppy de 2022 observait le moins de réécritures entre 51 et 60 caractères ; c’est un bon repère, pas une règle.' },
      { q: 'Faut-il mettre le nom de l’entreprise dans le titre ?', a: 'Oui en fin de titre, surtout si c’est une marque connue localement. Évitez de le répéter si Google affiche déjà le nom du site au-dessus du titre.' },
      { q: 'Faut-il un titre différent pour les réseaux sociaux ?', a: 'Ce n’est pas obligatoire. La balise og:title permet de proposer un titre plus accrocheur pour les partages ; Google la compte parmi les sources possibles du titre affiché, sans qu’elle remplace la balise title.' },
      { q: 'Google ignore ma méta-description, que faire ?', a: 'C’est normal pour certaines recherches : Google choisit l’extrait le plus pertinent. Vérifiez que la description est unique, concrète et fidèle à la page ; le reste dépend de la requête.' },
    ],
    sources: [
      { label: 'Google Search Central, liens de titre dans les résultats', url: 'https://developers.google.com/search/docs/appearance/title-link', note: VU },
      { label: 'Google Search Central, extraits et méta-descriptions', url: 'https://developers.google.com/search/docs/appearance/snippet', note: VU },
      { label: 'Zyppy, Google réécrit 61 % des titres (étude sur 80 959 titres)', url: 'https://zyppy.com/seo/google-title-rewrites/', note: `données du premier trimestre 2022 ; ${VU}` },
      { label: 'Google Search Central, utiliser du contenu généré par IA (métadonnées)', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO (meta keywords, bourrage)', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
    ],
    cta: { text: 'Vérifiez le title et la méta-description d’une page, et voyez leur aperçu dans Google, avec l’outil gratuit.', href: '/outils/balises-title-meta', label: 'Vérifier mes balises' },
    related: ['audit-seo-30-minutes', 'page-que-les-ia-citent', 'search-console-debutants', 'seo-wordpress'],
  },

  /* ------------------------------------------------------------------ */
  /* SEO des images                                                      */
  /* ------------------------------------------------------------------ */
  {
    slug: 'seo-images',
    seoTitle: 'Images et SEO : texte alternatif, formats et vitesse',
    title: 'Images et SEO : texte alternatif, formats et vitesse',
    description:
      'Texte alternatif, nom de fichier, WebP et AVIF, chargement différé, images générées par IA : ce que Google recommande pour des images trouvées et rapides.',
    updated: D,
    published: D,
    intro: [
      'Les images d’un site professionnel travaillent à trois endroits : elles rassurent le visiteur (des photos réelles de vos réalisations, de votre boutique, de vos produits), elles peuvent être trouvées dans Google Images et Lens, et elles pèsent lourd dans la vitesse d’affichage. Mal gérées, elles sont invisibles pour les moteurs et ralentissent tout le reste.',
      'Ce guide reprend les recommandations de Google sur les images, les ordres de grandeur de gain des formats modernes, et une règle récente sur les images générées par IA. Il se termine par une liste de contrôle à appliquer page par page.',
    ],
    sections: [
      {
        h2: 'Avant la technique : quoi photographier',
        paras: [
          'La meilleure image pour le référencement est d’abord une image utile au client. Une banque d’images ne montre pas votre entreprise ; elle est aussi reprise par des centaines d’autres sites, et n’apporte rien de propre à la page.',
        ],
        list: [
          'Pour un artisan : des chantiers réels, avant et après, avec l’accord du client et sans élément permettant de l’identifier s’il ne le souhaite pas.',
          'Pour un commerce : la devanture vue de la rue (elle aide à vous trouver), l’intérieur, l’équipe, les produits phares.',
          'Pour une PME : les ateliers, les machines, les équipes au travail, les produits en usage réel.',
          'Pour une boutique : plusieurs vues de chaque produit, un détail de matière, une mise en situation, et une photo qui donne l’échelle.',
        ],
        after: ['Un smartphone récent, une lumière naturelle et un fond rangé suffisent dans la plupart des cas. La sincérité de l’image compte plus que sa perfection.'],
      },
      {
        h2: 'Étape 1 : des images que Google peut trouver',
        paras: [
          'Google trouve les images dans l’attribut src des balises img ; il n’indexe pas les images de fond définies en CSS [1]. Une photo de chantier affichée comme fond d’une section décorative n’existe pas pour Google Images. Si une image compte (réalisation, produit, équipe), elle doit être une vraie image dans la page.',
          'Google prend en charge les formats BMP, GIF, JPEG, PNG, WebP, SVG et AVIF, et demande que l’extension du fichier corresponde à son type réel [1]. Il recommande aussi de placer les images près du texte qui en parle, sur des pages pertinentes, car il utilise le contenu environnant pour les comprendre [1].',
        ],
      },
      {
        h2: 'Étape 2 : un texte alternatif qui décrit',
        paras: [
          'Le texte alternatif (attribut alt) décrit l’image pour les personnes qui ne la voient pas, et pour les moteurs. Google demande un texte descriptif et adapté au contexte, et prévient que le bourrage de mots-clés dans l’attribut alt nuit à l’expérience et peut être traité comme du spam [1].',
        ],
        list: [
          'À éviter : « image1 », « photo », ou « plombier lyon plombier pas cher urgence ».',
          'Mieux : « Remplacement d’un ballon d’eau chaude de 200 litres dans une cave à Villeurbanne ».',
          'Pour un produit : « Bougie parfumée à la figue dans un pot en verre ambré de 200 g ».',
          'Pour une image purement décorative (un motif, une séparation) : un alt vide, pour que les lecteurs d’écran l’ignorent.',
        ],
        after: ['Pour une image cliquable, le texte alternatif sert aussi de texte de lien : il doit dire où mène le lien.'],
      },
      {
        h2: 'Étape 3 : un nom de fichier parlant',
        paras: [
          'Google indique que des noms de fichiers courts et descriptifs aident, et conseille d’éviter les noms génériques comme image1.jpg ou 1.jpg [1]. Renommez vos fichiers avant de les envoyer : « remplacement-ballon-eau-chaude-villeurbanne.webp » plutôt que « IMG_20260412_1532.jpg ». C’est trente secondes par image, et c’est un geste que la plupart des outils de gestion de site conservent.',
        ],
      },
      {
        h2: 'Étape 4 : des formats modernes et des fichiers légers',
        paras: [
          'Selon Google, les images WebP sans perte sont 26 % plus légères que des PNG, et les images WebP avec perte 25 à 34 % plus légères que des JPEG de qualité équivalente [2]. AVIF, également pris en charge par Google [1], est une autre option moderne : comparez les deux formats sur quelques-unes de vos propres images avant de généraliser.',
        ],
        list: [
          'Redimensionnez à la taille d’affichage réelle : une photo de 6 000 pixels de large pour un emplacement de 1 200 pixels est cinq fois trop grande dans chaque dimension.',
          'Convertissez en WebP ou AVIF, en gardant un JPEG ou PNG de secours si votre outil le demande.',
          'Utilisez des images adaptatives (srcset ou balise picture) pour servir une image plus petite sur mobile ; Google recommande de toujours prévoir une adresse de secours dans l’attribut src [1].',
          'Indiquez largeur et hauteur des images dans le code, pour que la page ne « saute » pas pendant le chargement.',
        ],
      },
      {
        h2: 'Étape 5 : le chargement différé, mais pas pour tout',
        paras: [
          'Le chargement différé (lazy loading) n’envoie les images qu’au moment où le visiteur s’en approche. C’est utile pour les images du bas de page. C’est nuisible pour l’image principale en haut : un article de web.dev a observé en 2021 que les pages qui chargeaient en différé leurs images avaient un affichage du plus grand élément (LCP) plus lent en médiane, et qu’en laboratoire, ne pas différer les images du haut de page sur des pages WordPress améliorait le LCP d’environ 13 % sur ordinateur et 15 % sur mobile [3]. L’auteur précise que la première observation est une corrélation [3].',
          'Règle pratique : pas de chargement différé pour l’image principale visible à l’ouverture (bannière, photo produit principale) ; chargement différé pour le reste.',
        ],
      },
      {
        h2: 'Étape 6 : un sitemap d’images si nécessaire',
        paras: [
          'Google propose les sitemaps d’images pour faire découvrir des images qu’il ne trouverait pas autrement, et accepte des adresses d’images sur d’autres domaines, ce qui est pratique si vos images sont servies par un CDN [1]. Pour un site vitrine, ce n’est généralement pas nécessaire. Pour une boutique ou un portfolio dont les images sont chargées de façon complexe, c’est une sécurité.',
        ],
      },
      {
        h2: 'Étape 7 : les images générées par IA',
        paras: [
          'Google demande que, sur les sites marchands, les images générées par IA contiennent la métadonnée IPTC DigitalSourceType avec la valeur TrainedAlgorithmicMedia [4]. Si vous illustrez vos fiches produits avec des visuels générés (mises en situation, décors), vérifiez que votre outil conserve cette métadonnée.',
          'Au-delà de la règle, la prudence commerciale s’impose : une image générée qui montre un produit sous un jour qu’il n’a pas (une couleur plus vive, une finition différente) prépare des retours et des avis négatifs. Pour une fiche Google Business Profile, Google demande d’ailleurs des photos qui montrent la réalité, sans usage excessif de filtres ou d’IA [5].',
        ],
      },
      {
        h2: 'Les images et les assistants d’IA',
        paras: [
          'Les assistants lisent surtout du texte. Une information qui n’existe que dans une image (un tableau de tarifs en JPG, des horaires dans une bannière, une fiche technique scannée) est le plus souvent perdue pour eux, et pour Google aussi. Gardez les images pour montrer, et le texte pour dire : les tarifs, horaires, caractéristiques et coordonnées doivent toujours être écrits en texte dans la page, l’image pouvant les illustrer.',
        ],
      },
      {
        h2: 'Le cas des fiches produits',
        paras: [
          'Sur une boutique, les images font l’essentiel du poids des pages et une bonne part de la décision d’achat. Trois règles évitent la plupart des problèmes. D’abord, une image principale sur fond neutre, nette, sans texte incrusté : c’est elle qui est reprise dans les résultats et les flux de produits. Ensuite, des images secondaires qui répondent aux questions (dos, détail, échelle, usage), chacune avec son texte alternatif propre, et pas le nom du produit répété six fois. Enfin, des variantes de couleur qui ont chacune leur photo : un acheteur qui choisit le vert doit voir le vert.',
          'Si votre plateforme génère automatiquement plusieurs tailles d’une image, envoyez un original de bonne qualité, ni trop petit (il serait flou en zoom), ni démesuré (il ralentirait le traitement). Une largeur de l’ordre de 2 000 pixels suffit souvent pour une photo produit ; vérifiez la recommandation de votre plateforme.',
        ],
      },
      {
        h2: 'La liste de contrôle par page',
        list: [
          'Chaque image utile est une vraie balise img, pas un fond CSS.',
          'Texte alternatif descriptif, sans bourrage ; alt vide pour les images décoratives.',
          'Nom de fichier parlant.',
          'Image redimensionnée, en WebP ou AVIF, avec largeur et hauteur indiquées.',
          'Pas de chargement différé pour l’image principale du haut de page.',
          'Aucune information essentielle uniquement dans une image.',
          'Images générées par IA signalées par la métadonnée IPTC sur un site marchand.',
        ],
      },
    ],
    faq: [
      { q: 'Le texte alternatif améliore-t-il le classement ?', a: 'Il aide Google à comprendre l’image et la page, et il est indispensable pour l’accessibilité. Il ne remplace pas le texte de la page, et le bourrer de mots-clés peut être traité comme du spam.' },
      { q: 'WebP ou AVIF ?', a: 'Les deux sont pris en charge par Google. WebP est le choix le plus simple et largement compatible ; AVIF est souvent plus léger. Beaucoup d’outils servent automatiquement le meilleur format au navigateur.' },
      { q: 'Puis-je utiliser les photos du fabricant ?', a: 'Oui si le fabricant l’autorise, ce qui est fréquent pour les revendeurs. Ajoutez au moins une photo à vous : en situation, en boutique ou en détail, pour que votre page se distingue de celles des autres revendeurs.' },
      { q: 'Faut-il compresser les images déjà en ligne ?', a: 'Commencez par les pages les plus visitées et par les images les plus lourdes. Remplacer le fichier à la même adresse évite d’avoir à modifier les liens.' },
    ],
    sources: [
      { label: 'Google Search Central, bonnes pratiques pour le référencement des images', url: 'https://developers.google.com/search/docs/appearance/google-images', note: VU },
      { label: 'Google for Developers, le format WebP', url: 'https://developers.google.com/speed/webp/', note: VU },
      { label: 'web.dev, effets d’un chargement différé excessif sur le LCP', url: 'https://web.dev/articles/lcp-lazy-loading', note: `données de 2021 ; ${VU}` },
      { label: 'Google Search Central, utiliser du contenu généré par IA (images IPTC)', url: 'https://developers.google.com/search/docs/fundamentals/using-gen-ai-content', note: VU },
      { label: 'Aide Google Business Profile, ajouter des photos', url: 'https://support.google.com/business/answer/6123536?hl=en', note: VU },
    ],
    cta: { text: 'Images trop lourdes, sans dimensions ou sans texte alternatif : l’analyse les repère sur chaque page explorée.', ...CTA },
    related: ['core-web-vitals-sans-jargon', 'fiche-produit-et-ia', 'seo-wordpress', 'fiche-google-business-profile'],
  },

  /* ------------------------------------------------------------------ */
  /* Liens entrants                                                      */
  /* ------------------------------------------------------------------ */
  {
    slug: 'liens-entrants-sans-risque',
    seoTitle: 'Liens entrants : en obtenir sans risque de pénalité',
    title: 'Liens entrants : en obtenir sans risque de pénalité',
    description:
      'Ce que Google interdit (achat, échanges, annuaires douteux), ce qui marche pour une PME ou un commerce, et pourquoi les mentions comptent aussi pour les IA.',
    updated: D,
    published: D,
    intro: [
      'Les liens d’autres sites vers le vôtre restent un signal important pour les moteurs : ils aident Google à découvrir vos pages et à juger de leur notoriété. C’est aussi le domaine où l’on rencontre le plus d’offres douteuses : packs de « 500 backlinks », articles sponsorisés non déclarés, réseaux de blogs créés pour l’occasion.',
      'Ce guide trie ce qui est interdit, ce qui est risqué et ce qui fonctionne pour un commerce ou une PME, avec les textes de Google à l’appui. Il explique aussi pourquoi, à l’heure des assistants d’IA, une mention sans lien dans une bonne source peut compter autant qu’un lien.',
    ],
    sections: [
      {
        h2: 'Ce que Google appelle spam de liens',
        paras: [
          'Les règles de Google définissent le spam de liens comme la création de liens principalement destinée à manipuler le classement [1]. Ses exemples :',
        ],
        list: [
          'acheter ou vendre des liens, ou les échanger contre des biens ou des services [1] ;',
          'les échanges de liens réciproques excessifs (« je te mets en lien, tu me mets en lien ») [1] ;',
          'la création automatisée de liens [1] ;',
          'les liens avec un texte d’ancre optimisé dans des articles ou des articles invités publiés sur d’autres sites [1] ;',
          'les liens issus d’annuaires de faible qualité [1].',
        ],
        after: [
          'Un lien payant n’est pas interdit en soi : il doit porter l’attribut rel="sponsored" ou rel="nofollow" [1][2]. Ce qui est interdit, c’est le lien payé déguisé en lien naturel. Les liens dans les contenus créés par les utilisateurs (forums, commentaires) devraient porter rel="ugc" ou rel="nofollow" [2].',
        ],
      },
      {
        h2: 'Pourquoi les raccourcis ne valent pas le coup',
        paras: [
          'Google le dit dans son guide de démarrage : il trouve la plupart des pages par des liens, et les liens vers un site tendent à s’accumuler naturellement avec le temps [3]. Les offres de liens en masse promettent d’accélérer ce processus ; au mieux, les liens obtenus sont ignorés et l’argent est perdu ; au pire, ils exposent le site aux mesures de Google contre le spam.',
          'Dans son guide de 2026 sur les fonctionnalités d’IA générative, Google ajoute que rechercher des « mentions » inauthentiques sur le web est moins utile qu’il n’y paraît [5]. Autrement dit, la version « IA » du lien acheté, la mention achetée, n’est pas une meilleure idée.',
        ],
      },
      {
        h2: 'Ce qui marche pour un commerce local',
        list: [
          'Les fournisseurs et fabricants dont vous êtes revendeur ou installateur agréé : beaucoup ont une page « où acheter » ou « installateurs » avec des liens.',
          'Les associations de commerçants, l’office de tourisme, la mairie (pour un commerce de centre-ville, une page « commerces » existe souvent).',
          'Les clubs et associations que vous sponsorisez réellement : le lien sur leur page partenaires est légitime, et peut porter l’attribut sponsored si c’est une contrepartie.',
          'La presse locale, quand vous avez une vraie actualité : ouverture, anniversaire, chantier remarquable, recrutement, engagement local.',
          'Les annuaires de votre métier et les plateformes d’avis sérieuses (voir notre guide sur les annuaires).',
        ],
      },
      {
        h2: 'Ce qui marche pour une PME ou une boutique',
        list: [
          'Publier quelque chose que d’autres ont envie de citer : une donnée propre (une enquête auprès de vos clients, un baromètre de prix), un guide technique de référence, un outil gratuit utile.',
          'Les partenaires, intégrateurs et distributeurs, qui ont intérêt à renvoyer vers vous.',
          'Les interventions d’experts : conférences, webinaires, tribunes signées dans la presse professionnelle.',
          'Les comparatifs et sélections de votre secteur, en fournissant à leur auteur des informations factuelles (prix, différence, cas client autorisé), sans contrepartie cachée.',
          'Les écoles et formations, si vous accueillez des stagiaires ou intervenez en cours.',
        ],
        after: ['Aucune de ces actions n’est rapide. Comptez des mois, et considérez chaque lien obtenu comme un bonus d’une action qui a d’abord du sens pour votre activité.'],
      },
      {
        h2: 'Les liens et les mentions vus par les IA',
        paras: [
          'Une étude de l’université de Toronto (prépublication de septembre 2025) observe que les moteurs d’IA s’appuient très majoritairement sur des sources tierces plutôt que sur les sites des marques, davantage que Google ; pour l’électronique grand public aux États-Unis, 92,1 % des sources citées par les moteurs d’IA étudiés étaient tierces [6].',
          'Pour un assistant, ce qui compte est que des sources fiables parlent de vous, avec des informations exactes. Un article de la presse professionnelle qui vous cite comme exemple, sans lien, peut peser dans une réponse. Le travail de relations presse et de présence dans les comparatifs sert donc aux deux : il apporte des liens pour Google et des mentions pour les IA.',
        ],
      },
      {
        h2: 'Exemple : une boulangerie de quartier',
        paras: [
          'Exemple fictif : une boulangerie de Montpellier, deux boutiques, qui veut être mieux trouvée. Elle ne cherche pas de « backlinks » ; elle fait la liste de ce qu’elle fait déjà et qui mérite d’être connu.',
          'Elle fournit le pain d’une cantine scolaire et de trois restaurants : deux d’entre eux citent volontiers leurs fournisseurs sur leur site, avec un lien. Elle a remporté un concours départemental de galette : l’article du quotidien local et la page du concours la mentionnent. Elle participe au marché de Noël de l’association des commerçants, qui liste ses membres. Elle forme deux apprentis par an : le centre de formation a une page entreprises partenaires.',
          'Résultat : cinq ou six liens et mentions, tous réels, tous liés à son activité, obtenus en quelques mois et sans payer personne. C’est peu en nombre, mais chaque lien vient d’une source qui a une raison réelle de parler d’elle, et chaque mention dit quelque chose de vrai sur la boulangerie : son métier, sa ville, sa qualité reconnue. C’est ce type de notoriété, lente et vérifiable, qui résiste aux évolutions des moteurs et que les assistants peuvent reprendre sans se tromper.',
        ],
      },
      {
        h2: 'Un plan sur six mois',
        list: [
          'Mois 1 : lister vos partenaires, fournisseurs, clients, associations et écoles ; vérifier lesquels ont une page qui pourrait vous mentionner.',
          'Mois 2 : leur écrire, simplement, en fournissant un texte de présentation et une photo.',
          'Mois 3 : identifier, en posant vos questions clients aux assistants d’IA, les comparatifs et médias cités dans votre secteur.',
          'Mois 4 et 5 : préparer une information qui mérite d’être citée (donnée propre, guide, réalisation remarquable) et la proposer à deux ou trois de ces sources.',
          'Mois 6 : faire le point dans la Search Console (rapport des liens) et refaire les mêmes questions aux assistants.',
        ],
      },
      {
        h2: 'Reconnaître une offre à risque',
        list: [
          'Un nombre de liens promis à l’avance (« 100 liens par mois »).',
          'Des sites sans rapport avec votre activité, ou créés récemment, avec des articles sur tous les sujets.',
          'Un texte d’ancre imposé, bourré de mots-clés.',
          'Un refus de vous donner la liste des sites avant publication.',
          'Une promesse de position ou de délai.',
          'Des articles « sponsorisés » sans mention de partenariat ni attribut sponsored.',
          'Un réseau de sites appartenant au même prestataire, qui « prête » ses liens à tous ses clients : c’est exactement la création de liens pour manipuler le classement que décrivent les règles de Google [1].',
          'Une offre de « nettoyage de pénalité » vendue sans qu’aucune action manuelle ne figure dans votre Search Console.',
        ],
      },
      {
        h2: 'Et les mauvais liens que vous n’avez pas demandés ?',
        paras: [
          'Tous les sites reçoivent des liens de sites douteux sans les avoir demandés. Google indique que dans la plupart des cas, il sait évaluer quels liens méritent confiance sans aide [4]. L’outil de désaveu de liens de la Search Console est présenté comme une fonction avancée, à utiliser avec prudence, réservée aux sites qui ont un grand nombre de liens artificiels ou de faible qualité ayant causé, ou risquant de causer, une action manuelle [4]. Mal utilisé, il peut nuire à la visibilité du site [4].',
          'Si un ancien prestataire a acheté des liens pour vous, essayez d’abord de les faire retirer ; le désaveu vient ensuite, si une action manuelle est signalée dans la Search Console.',
        ],
      },
      {
        h2: 'Les liens que vous donnez',
        paras: [
          'Google note que renvoyer vers des sources fiables peut renforcer la confiance, et qu’il faut réserver nofollow aux liens que vous ne cautionnez pas [2]. Citer vos sources (un texte officiel, une étude, un fabricant) est donc utile au lecteur, et c’est aussi ce qui rend une page plus crédible pour les assistants. Ne craignez pas de « perdre » quelque chose en donnant des liens pertinents.',
        ],
      },
    ],
    faq: [
      { q: 'Les liens des annuaires sont-ils utiles ?', a: 'Ceux des annuaires sérieux de votre métier ou de votre ville, oui, surtout pour la cohérence de vos informations. Les liens d’annuaires de faible qualité sont cités par Google parmi les pratiques de spam.' },
      { q: 'Un article invité sur un blog partenaire est-il interdit ?', a: 'Non, s’il apporte quelque chose aux lecteurs. Ce qui pose problème selon Google, ce sont les articles invités publiés surtout pour placer des liens avec des ancres optimisées.' },
      { q: 'Les liens depuis les réseaux sociaux comptent-ils ?', a: 'Ils aident vos pages à être découvertes et vues, mais ce sont en général des liens en nofollow. Leur intérêt principal est de faire connaître vos contenus à des personnes qui pourront, elles, les citer.' },
      { q: 'Combien de liens faut-il ?', a: 'Il n’y a pas de seuil. Quelques liens de sources pertinentes et fiables valent mieux que des centaines de liens sans rapport avec votre activité.' },
    ],
    sources: [
      { label: 'Google Search Central, règles relatives au spam (spam de liens)', url: 'https://developers.google.com/search/docs/essentials/spam-policies', note: VU },
      { label: 'Google Search Central, bonnes pratiques pour les liens (attributs sponsored, ugc, nofollow)', url: 'https://developers.google.com/search/docs/crawling-indexing/links-crawlable', note: VU },
      { label: 'Google Search Central, guide de démarrage SEO (promotion et liens)', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide', note: VU },
      { label: 'Aide Search Console, désavouer des liens', url: 'https://support.google.com/webmasters/answer/2648487?hl=en-GB&authuser=0', note: VU },
      { label: 'Google Search Central, optimiser son site pour les fonctionnalités d’IA générative de la recherche Google', url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide', note: VU },
      { label: 'Chen et al., Université de Toronto, Generative Engine Optimization: How to Dominate AI Search', url: 'https://arxiv.org/html/2509.08919v1', note: `prépublication, septembre 2025 ; ${VU}` },
    ],
    cta: { text: 'Avant de chercher des liens, assurez-vous que vos pages méritent d’être citées : l’analyse gratuite contrôle accès, identité et contenu.', ...CTA },
    related: ['seo-b2b-acheteurs', 'annuaires-locaux-bing-apple', 'apparaitre-dans-chatgpt-pme', 'seo-local-et-ia'],
  },
];
