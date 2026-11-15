/**
 * Pages « grandes questions » : /questions/[slug]. Une page par question que se posent nos clients avant de choisir un
 * outil (agent GEO-MARQUE, V6). Règles :
 *  - réponse directe en tête (40 à 90 mots), puis sections en question-réponse, tableaux, FAQ, sources datées ;
 *  - aucun chiffre sans source `[@clé]` (sources.ts ou SRC du comparatif) ; les relevés de concurrents viennent de
 *    src/lib/seo/competitors.ts (CELLS, OTHER_FR) pour rester identiques à /comparatif ;
 *  - Repéré est présenté avec ses limites, jamais en tête d'une liste de concurrents ;
 *  - liens internes au format `[texte](/chemin)`.
 * Peu de pages, chacune substantielle : Google déconseille les pages produites en série pour chaque sous-requête.
 */
import { CELLS, COMPETITORS, COMPARE_CHECKED, COMPARE_CHECKED_SEO, OTHER_FR } from '@/lib/seo/competitors';
import { fmtDate } from '@/lib/seo';

export type Block =
  | { p: string }
  | { ul: string[] }
  | { ol: string[] }
  | { table: { head: string[]; rows: string[][]; caption?: string } };

export interface TqSection {
  id: string;
  q: string;
  answer: string;
  blocks?: Block[];
}

export interface TargetQuestion {
  slug: string;
  /** La question, telle qu'un client la tape (h1). */
  q: string;
  /** title SEO, 40 à 60 caractères */
  seoTitle: string;
  description: string;
  /** Réponse directe, 40 à 90 mots, en tête de page. */
  answer: string;
  takeaways: string[];
  sections: TqSection[];
  /** Questions voisines : texte brut (pas de renvoi), repris dans le JSON-LD FAQPage. */
  faq: { q: string; a: string }[];
  related: { href: string; label: string }[];
  published: string;
  updated: string;
}

const c = CELLS;
const origin = (slug: string) => COMPETITORS.find((x) => x.slug === slug)?.origin ?? 'Non vérifié';
const other = (name: string) => {
  const o = OTHER_FR.find((x) => x.name === name);
  if (!o) throw new Error(`Outil absent de OTHER_FR : ${name}`);
  return o;
};

/** Outils gratuits d'audit : partagé entre « alternative à Semrush » et « audit SEO gratuit ». */
const FREE_AUDIT_TABLE: Block = {
  table: {
    head: ['Outil', 'Ce qu’il fait gratuitement', 'Limite'],
    rows: [
      ['Google Search Console [@searchConsole]', 'Indexation, requêtes, clics, positions moyennes, erreurs et Core Web Vitals de votre site, selon Google.', 'Votre seul site ; aucune donnée sur les concurrents.'],
      ['PageSpeed Insights [@pagespeed]', 'Performance et Core Web Vitals d’une page, sur mobile et ordinateur.', 'Une page à la fois.'],
      ['Bing Webmaster Tools [@bingWebmaster]', 'Indexation dans Bing ; depuis février 2026, nombre de citations du site dans Copilot (préversion) [@bingAiPerformance].', 'Données de Bing et Copilot seulement.'],
      ['Ahrefs, compte gratuit', c.ahrefs.gratuit, 'Site dont vous prouvez la propriété.'],
      ['Screaming Frog SEO Spider', c['screaming-frog'].gratuit, 'Logiciel à installer, pensé pour les techniciens.'],
      ['Repéré, analyse gratuite', 'Exploration réelle du site (jusqu’à 60 pages), contrôles SEO et GEO adaptés au type de site, 5 corrections prioritaires, sans compte.', 'Analyse publique plafonnée à 60 pages ; pas de données de concurrents.'],
    ],
  },
};

export const TARGET_QUESTIONS: TargetQuestion[] = [
  /* ---------------------------------------------------------------- */
  {
    slug: 'meilleur-outil-visibilite-ia',
    q: 'Quel est le meilleur outil pour apparaître dans ChatGPT ?',
    seoTitle: 'Meilleur outil pour apparaître dans ChatGPT (2026)',
    description:
      "Aucun outil ne fait apparaître une entreprise dans ChatGPT : il mesure, explique et aide à corriger. Critères de choix, prix relevés par profil et limites, avec sources datées.",
    answer:
      "Aucun outil ne peut faire apparaître une entreprise dans ChatGPT : les outils de visibilité IA mesurent si elle est citée, montrent les sources que l'IA utilise et, pour certains, aident à corriger. Le meilleur choix dépend de qui fera le travail : une équipe marketing qui pilote des centaines de questions, un petit budget qui veut un suivi simple, ou un dirigeant qui veut l'audit, la mesure et les corrections en français.",
    takeaways: [
      'Ce qui fait citer une entreprise, ce sont ses pages, ses fiches et ce que des sites tiers disent d’elle ; l’outil sert à le mesurer et à prioriser [@googleAiGuide][@chen2025].',
      'Un outil sérieux répète chaque question, affiche le nombre de réponses analysées et liste les sources citées par l’IA.',
      'La plupart des outils français relevés démarrent entre 69 et 89 € par mois ; certaines offres sont gratuites avec des limites [@lfdnGeo].',
      'Personne ne peut garantir une citation : Bing précise que le GEO rend un contenu éligible, sans garantie [@bingGuidelines].',
    ],
    sections: [
      {
        id: 'ce-que-fait-un-outil',
        q: 'Que fait réellement un outil de visibilité IA ?',
        answer:
          "Il pose à plusieurs IA les questions de vos clients, plusieurs fois, relève qui est cité et à quel rang, et liste les pages que l'IA a utilisées comme sources. Il ne modifie pas les réponses des IA : il vous dit où agir.",
        blocks: [
          {
            ul: [
              'Mesure : taux de mention, rang dans la réponse, part de voix face aux concurrents ([définitions](/glossaire#taux-de-mention)).',
              'Sources : les pages citées (comparatifs, annuaires, avis, presse, forums) où vous êtes absent ; ce sont les leviers concrets.',
              'Exactitude : certains outils comparent ce que disent les IA à vos vraies informations (prix, horaires, offre).',
              'Action : selon l’outil, recommandations, briefs, ou corrections appliquées après votre validation.',
            ],
          },
          {
            p: "Les conditions d'accès sont publiques : OpenAI indique que tout site public peut apparaître dans la recherche de ChatGPT s'il ne bloque pas son robot OAI-SearchBot [@openaiPublishers] ; Google rappelle que ses fonctions IA reposent sur ses systèmes de classement habituels et que les bonnes pratiques SEO restent valables [@googleAiGuide].",
          },
        ],
      },
      {
        id: 'criteres',
        q: 'Quels critères comparer avant de choisir ?',
        answer:
          "Comparez les IA réellement suivies, la répétition des questions et la marge d'erreur, l'analyse des sources, l'audit du site, l'aide à l'exécution, la langue et le prix à usage égal.",
        blocks: [
          {
            table: {
              head: ['Critère', 'Pourquoi c’est important', 'Question à poser à l’éditeur'],
              rows: [
                ['IA suivies', 'ChatGPT, Gemini, Perplexity, Claude, Copilot, Mistral Le Chat et Google AI Overviews ne citent pas les mêmes sources.', 'Quelles IA sont incluses dans le prix affiché, lesquelles sont en option ?'],
                ['Répétition et marge d’erreur', 'Une IA peut donner deux réponses différentes à la même question ; une réponse isolée ne prouve rien.', 'Combien de fois chaque question est-elle posée ? La marge d’erreur est-elle affichée ?'],
                ['Sources citées', 'Ce sont les pages à corriger ou à obtenir : comparatifs, annuaires, avis, presse.', 'L’outil liste-t-il les URL citées, IA par IA ?'],
                ['Audit du site', 'Un site que les robots ne lisent pas (blocage, contenu chargé en JavaScript) a peu de chances d’être cité.', 'L’outil vérifie-t-il robots.txt, le rendu sans JavaScript, les données structurées ?'],
                ['Exécution', 'Les PME manquent souvent de temps plus que de données.', 'Qui applique les corrections, et avec quelle validation ?'],
                ['Langue et marché', 'Les réponses et les sources changent selon la langue et le pays.', 'Les questions sont-elles posées en français, pour la France ?'],
                ['Prix à usage égal', 'Les grilles comptent en questions, en crédits ou en domaines.', 'Combien coûtent mes 20 questions mesurées chaque semaine sur 4 IA ?'],
              ],
            },
          },
        ],
      },
      {
        id: 'quel-profil',
        q: 'Quels outils pour quel profil ?',
        answer:
          "Les grandes équipes marketing regardent surtout Profound, Peec AI, Semrush ou Ahrefs ; les petits budgets Otterly.AI ; les entreprises qui veulent un éditeur français Meteoria, Qwairy, BotRank.ai, GetMint, Hikoo ou Repéré. Les prix ci-dessous sont des relevés datés, à revérifier chez chaque éditeur.",
        blocks: [
          {
            table: {
              head: ['Outil', 'Prix relevé', 'IA suivies (selon nos sources)', 'Profil type'],
              caption: `Relevés du ${fmtDate(COMPARE_CHECKED)} (outils GEO) et du ${fmtDate(COMPARE_CHECKED_SEO)} (suites SEO). Prix hors taxes sauf mention, en dollars quand l’éditeur facture en dollars.`,
              rows: [
                ['Profound', c.profound.prix, c.profound.ia, 'Grandes marques avec une équipe dédiée'],
                ['Peec AI', c.peec.prix, c.peec.ia, 'Équipes marketing, agences, plusieurs pays'],
                ['Semrush (AI Visibility Toolkit)', c.semrush.prix, c.semrush.ia, 'Équipes déjà équipées de Semrush'],
                ['Ahrefs (Brand Radar)', c.ahrefs.prix, c.ahrefs.ia, 'Équipes SEO déjà équipées d’Ahrefs'],
                ['Otterly.AI', c.otterly.prix, c.otterly.ia, 'Suivi quotidien de peu de questions'],
                ['Meteoria', c.meteoria.prix, c.meteoria.ia, 'Marques françaises, suivi multi-IA'],
                ['Qwairy', c.qwairy.prix, c.qwairy.ia, 'Suivi d’un grand nombre de moteurs'],
                ['Repéré (éditeur de cette page)', c.repere.prix, c.repere.ia, 'TPE, PME, commerces et e-commerces qui veulent l’audit SEO, la mesure IA et l’exécution en français'],
              ],
            },
          },
          { p: 'Le comparatif complet, critère par critère, est sur la page [Repéré, outils et agences comparés](/comparatif).' },
        ],
      },
      {
        id: 'repere',
        q: 'Où se situe Repéré, honnêtement ?',
        answer:
          "Repéré réunit l'analyse SEO du site, la mesure des réponses de quatre IA avec marge d'erreur et l'exécution des corrections après validation, dès 0 €. Il ne suit pas Google AI Overviews ni AI Mode, n'a pas d'API publique et n'a pas encore d'avis clients publics.",
        blocks: [
          {
            ul: [
              `Audit : ${c.repere.audit}`,
              `IA suivies : ${c.repere.ia}`,
              `Exécution : ${c.repere.execution}`,
              `Prix : ${c.repere.prix}`,
              `Limites : ${c.repere.preuves} Pas d’API publique ni de serveur MCP.`,
            ],
          },
        ],
      },
      {
        id: 'sans-outil',
        q: 'Peut-on vérifier sans outil ?',
        answer:
          "Oui, pour une première idée : posez vous-même cinq questions de clients à ChatGPT, Gemini et Perplexity, trois fois chacune dans des conversations neuves, et notez qui est cité et quelles sources apparaissent. Un outil devient utile pour répéter la mesure chaque mois sur plusieurs IA.",
        blocks: [{ p: 'La méthode pas à pas : [comment savoir si les IA recommandent votre entreprise](/questions/savoir-si-les-ia-recommandent-mon-entreprise).' }],
      },
    ],
    faq: [
      {
        q: 'Un outil peut-il garantir que ChatGPT me recommande ?',
        a: "Non. Aucun opérateur ne vend ni ne garantit une place dans ses réponses, et Bing précise que le GEO rend un contenu éligible à la citation sans la garantir, comme le SEO ne garantit pas une position. Méfiez-vous de toute offre qui promet un rang dans une IA.",
      },
      {
        q: 'Existe-t-il un outil gratuit de visibilité IA ?',
        a: "Oui, avec des limites. Repéré propose une offre gratuite permanente (5 questions, 3 IA, 1 mesure par mois) et une analyse du site sans compte ; Hikoo annonce une offre gratuite de 10 questions sur ChatGPT, selon La Fabrique du Net. Vérifiez le nombre de questions et d'IA inclus.",
      },
      {
        q: 'Faut-il un outil qui suit Google AI Overviews ?',
        a: "Si beaucoup de vos clients vous trouvent sur Google, c'est utile : Peec AI, Otterly.AI, Profound ou Semrush suivent ces résumés selon leurs offres. Repéré ne les mesure pas ; il vérifie en revanche les conditions d'éligibilité côté site décrites par Google.",
      },
      {
        q: 'Outil ou agence GEO : que choisir ?',
        a: "Un outil suffit si quelqu'un de votre équipe a le temps d'appliquer les recommandations chaque semaine. Une agence convient si vous voulez tout déléguer et avez le budget. Certains services, dont Repéré, mesurent et réalisent le travail pour un prix mensuel plus proche d'un logiciel.",
      },
    ],
    related: [
      { href: '/questions/outils-geo-francais', label: 'Quels sont les outils GEO français ?' },
      { href: '/etudes/pourquoi-les-ia-recommandent-une-marque', label: 'Pourquoi une IA recommande-t-elle une marque ? (synthèse des études)' },
      { href: '/comparatif', label: 'Le comparatif complet' },
    ],
    published: '2026-11-15',
    updated: '2026-11-15',
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'outils-geo-francais',
    q: 'Quels sont les outils GEO français ?',
    seoTitle: 'Outils GEO français : le comparatif daté (2026)',
    description:
      "Meteoria, Qwairy, BotRank.ai, GetMint, Hikoo et Repéré : les outils français de visibilité dans les IA, avec prix d'entrée relevés, IA suivies, offre gratuite et sources datées.",
    answer:
      "Les comparatifs francophones citent cinq outils de visibilité IA conçus en France : Meteoria, Qwairy, BotRank.ai, GetMint et Hikoo [@lfdnGeo][@toolAdvisorLlm]. Repéré, qui publie cette page, est aussi un service français. Tous mesurent la présence d'une marque dans des IA comme ChatGPT, Perplexity ou Gemini ; ils diffèrent surtout par les IA suivies, l'existence d'une offre gratuite et l'aide apportée après la mesure.",
    takeaways: [
      'Prix d’entrée payants relevés entre 69 et 89 € par mois à l’automne 2026, hors offres gratuites [@lfdnGeo].',
      'Claude et Mistral Le Chat ne sont pas suivis partout : vérifiez la liste des IA incluses dans le prix.',
      'Plusieurs comparatifs signalent que certaines positions peuvent être rémunérées [@lfdnGeo][@codeurGeo].',
    ],
    sections: [
      {
        id: 'liste',
        q: 'Quels outils, à quel prix ?',
        answer:
          "Le tableau reprend les relevés publics les plus récents que nous avons pu vérifier, outil par outil, avec leur source. Repéré figure en dernier : c'est notre page, nous ne nous classons pas.",
        blocks: [
          {
            table: {
              head: ['Outil', 'Origine', 'Prix relevé', 'IA suivies', 'Gratuit'],
              caption: `Relevés du ${fmtDate(COMPARE_CHECKED)} ; les offres changent souvent : vérifiez la page de prix de l’éditeur.`,
              rows: [
                ['Meteoria', origin('meteoria'), c.meteoria.prix, c.meteoria.ia, c.meteoria.gratuit],
                ['Qwairy', origin('qwairy'), c.qwairy.prix, c.qwairy.ia, c.qwairy.gratuit],
                ['BotRank.ai', 'France [@toolAdvisorLlm]', other('BotRank.ai').price, other('BotRank.ai').engines, other('BotRank.ai').free],
                ['GetMint', 'France [@lfdnGeo]', other('GetMint').price, other('GetMint').engines, other('GetMint').free],
                ['Hikoo', 'France [@lfdnGeo]', other('Hikoo').price, other('Hikoo').engines, other('Hikoo').free],
                ['Repéré', 'France', c.repere.prix, c.repere.ia, c.repere.gratuit],
              ],
            },
          },
        ],
      },
      {
        id: 'differences',
        q: "Qu'est-ce qui les distingue ?",
        answer:
          "Trois choses : les IA couvertes, l'existence d'une offre gratuite durable, et ce qui se passe après la mesure (tableau de bord, recommandations, ou corrections réalisées).",
        blocks: [
          {
            ul: [
              'IA couvertes : Meteoria ne suit pas Claude selon nos sources ; BotRank.ai propose Mistral et Claude parmi ses moteurs ; Hikoo inclut Mistral dans son offre Agent [@lfdnGeo].',
              `Langue : ${c.qwairy.langue}`,
              'Après la mesure : la plupart des outils fournissent des recommandations ; Repéré ajoute un audit SEO complet du site et un agent qui publie les corrections après validation.',
              'Cible : Repéré vise les TPE, PME, commerces et e-commerces non spécialistes ; plusieurs concurrents visent des équipes marketing équipées.',
            ],
          },
        ],
      },
      {
        id: 'francais-ou-pas',
        q: 'Faut-il forcément un outil français ?',
        answer:
          "Non : l'important est que les questions soient posées en français et que les sources françaises soient analysées. Un éditeur français peut apporter un support en français, une facturation en euros et, selon les cas, un hébergement dans l'Union européenne ; vérifiez ces points un par un.",
      },
      {
        id: 'comparatifs',
        q: 'Comment lire les comparatifs en ligne ?',
        answer:
          "Avec prudence : plusieurs comparatifs francophones indiquent que certaines positions peuvent être rémunérées, et les éditeurs publient souvent des classements où ils figurent en tête. Vérifiez la date du relevé et la mention de sponsoring, puis testez sur vos propres questions.",
        blocks: [
          {
            ul: [
              'La Fabrique du Net précise que certaines positions de son classement des outils GEO peuvent être attribuées contre rémunération [@lfdnGeo].',
              'Codeur.com indique que la première position de son comparatif peut être liée à un sponsoring [@codeurGeo].',
              'Sur 250 recherches Google « best X software », 67,6 % affichaient une liste où l’éditeur se classe lui-même premier [@ahrefsBestLists].',
              'Cette page est publiée par Repéré : Repéré y figure en dernier, sans lien affilié.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: "Quel est l'outil GEO français le moins cher ?",
        a: "À l'entrée, les offres gratuites : Repéré (offre Découverte permanente) et Hikoo (10 questions sur ChatGPT, selon La Fabrique du Net). Parmi les offres payantes relevées, Hikoo démarre à 69 € HT par site et Meteoria à 75 € par mois ; Repéré Essentiel démarre à 29 € par mois pour un commerce local.",
      },
      {
        q: 'Ces outils suivent-ils Mistral Le Chat ?',
        a: "Certains : BotRank.ai le propose parmi ses moteurs, Hikoo dans son offre Agent, Qwairy sur devis et Repéré en option, selon nos relevés. Vérifiez sur la page de prix de l'éditeur, les offres changent souvent.",
      },
      {
        q: 'Un outil français héberge-t-il les données en France ?',
        a: "Pas forcément : la nationalité de l'éditeur ne dit rien du lieu d'hébergement. Demandez la liste des sous-traitants et la localisation des serveurs ; pour Repéré, elle est publiée sur la page Sécurité.",
      },
    ],
    related: [
      { href: '/questions/meilleur-outil-visibilite-ia', label: 'Quel est le meilleur outil pour apparaître dans ChatGPT ?' },
      { href: '/comparatif/meteoria', label: 'Repéré ou Meteoria ?' },
      { href: '/comparatif/qwairy', label: 'Repéré ou Qwairy ?' },
      { href: '/securite', label: 'Sécurité et hébergement des données de Repéré' },
    ],
    published: '2026-11-15',
    updated: '2026-11-15',
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'savoir-si-les-ia-recommandent-mon-entreprise',
    q: 'Comment savoir si mon entreprise est recommandée par les IA ?',
    seoTitle: 'Savoir si ChatGPT recommande mon entreprise',
    description:
      "La méthode pour vérifier si ChatGPT, Gemini et Perplexity recommandent votre entreprise : questions à poser, nombre d'essais, lecture des résultats, robots à autoriser, et quand passer à un outil.",
    answer:
      "Posez aux IA les questions que vos clients leur posent, sans citer votre nom, plusieurs fois et dans des conversations séparées, puis comptez dans combien de réponses vous apparaissez, à quel rang et à côté de quels concurrents. Une seule réponse ne prouve rien : les IA varient d'une fois à l'autre. Un outil de mesure automatise ce test sur plusieurs IA et affiche une marge d'erreur.",
    takeaways: [
      'Cinq questions de clients, trois essais chacune, sur trois IA : 45 réponses pour une première lecture.',
      'Avec 45 réponses et un taux de 30 %, la marge d’erreur est d’environ ±11 points (intervalle à 90 %) : ne concluez pas sur un petit écart.',
      'Vérifiez aussi que votre site ne bloque pas les robots de recherche des IA [@openaiPublishers].',
    ],
    sections: [
      {
        id: 'methode-manuelle',
        q: 'Comment faire le test vous-même en 20 minutes ?',
        answer:
          'Choisissez cinq questions de clients, posez chacune trois fois à ChatGPT, Gemini et Perplexity dans des conversations neuves, et notez dans un tableau : cité ou non, rang, concurrents cités, sources affichées.',
        blocks: [
          {
            ol: [
              'Écrivez cinq questions comme un client, sans votre nom : « Quel plombier appeler en urgence à Nantes ? », « Quel logiciel de paie pour une PME de 20 salariés ? ».',
              'Ouvrez une conversation neuve pour chaque essai, pour limiter l’effet de l’historique et de la mémoire du compte.',
              'Posez chaque question trois fois à ChatGPT, Gemini et Perplexity ; ajoutez Claude, Copilot ou Mistral Le Chat si vos clients les utilisent.',
              'Notez pour chaque réponse : êtes-vous cité, à quel rang, quels concurrents, quelles sources (liens affichés).',
              'Calculez votre taux de mention : réponses où vous êtes cité, divisées par le nombre de réponses obtenues.',
              'Posez enfin une question avec votre nom (« Que sais-tu de [votre entreprise] ? ») pour repérer les informations fausses.',
            ],
          },
        ],
      },
      {
        id: 'lire-les-resultats',
        q: 'Comment interpréter les résultats ?',
        answer:
          "Regardez votre taux de mention, votre rang quand vous êtes cité et les sources affichées. Si vos concurrents sont cités et vous non, comparez leur présence à la vôtre sur ces sources : c'est là que se trouve le plan d'action.",
        blocks: [
          {
            table: {
              head: ['Constat', 'Ce que cela signifie le plus souvent', 'Première action'],
              rows: [
                ['Jamais cité, concurrents cités', 'Les sources consultées par l’IA parlent d’eux, pas de vous.', 'Relever les sources citées et vérifier votre présence sur chacune.'],
                ['Cité, mais loin dans la liste', 'Vous êtes connu, mais moins mis en avant (avis, comparatifs, précision de l’offre).', 'Comparer avis, fiches et pages avec ceux des concurrents cités en premier.'],
                ['Cité avec des informations fausses', 'Une source ancienne ou erronée circule.', 'Corriger la source, puis votre site et vos fiches ([guide](/guides/ia-disent-des-choses-fausses)).'],
                ['Cité par une IA et pas par une autre', 'Chaque IA a son propre index : Copilot s’appuie sur Bing, ChatGPT et Perplexity ont leurs robots [@bingGuidelines][@openaiBots][@perplexityBots].', 'Vérifier l’accès de chaque robot et votre présence dans Bing.'],
              ],
            },
          },
        ],
      },
      {
        id: 'robots',
        q: 'Votre site est-il lisible par les robots des IA ?',
        answer:
          "Vérifiez que votre robots.txt n'interdit pas OAI-SearchBot, PerplexityBot, Claude-SearchBot, Googlebot et Bingbot. OpenAI indique que, pour figurer dans les résumés et extraits de la recherche ChatGPT, il ne faut pas bloquer OAI-SearchBot ; sinon, la page n'apparaît au mieux que sous forme de lien et de titre [@openaiPublishers].",
        blocks: [
          {
            p: 'Notre [testeur de robots.txt](/outils/robots-ia) gratuit le vérifie en quelques secondes ; [l’analyse gratuite du site](/analyse) contrôle aussi le rendu sans JavaScript et les données structurées.',
          },
        ],
      },
      {
        id: 'outil',
        q: 'Quand passer à un outil de mesure ?',
        answer:
          "Quand vous voulez suivre l'évolution chaque mois, sur plusieurs IA, ou mesurer l'effet d'une action : refaire 45 essais à la main devient vite fastidieux, et une comparaison n'a de sens qu'avec les mêmes questions et une marge d'erreur.",
        blocks: [
          { p: `Chez Repéré : ${c.repere.gratuit} Pour comparer les outils : [quel outil choisir](/questions/meilleur-outil-visibilite-ia).` },
        ],
      },
      {
        id: 'trafic',
        q: 'Peut-on le voir dans Google Analytics ?',
        answer:
          "En partie : ChatGPT ajoute utm_source=chatgpt.com à ses liens, ce qui permet de compter les visites qu'il envoie [@openaiPublishers], mais ce chiffre ne dit pas combien de fois vous avez été cité sans clic. Bing Webmaster Tools affiche, depuis février 2026, le nombre de citations de votre site dans Copilot [@bingAiPerformance].",
        blocks: [{ p: 'Mode d’emploi : [mesurer le trafic venu de ChatGPT dans GA4](/guides/trafic-chatgpt-ga4).' }],
      },
    ],
    faq: [
      {
        q: 'Pourquoi ChatGPT me cite-t-il chez moi et pas chez mon client ?',
        a: "Les réponses varient selon la conversation, la mémoire du compte, la localisation et le moment. C'est pourquoi une mesure sérieuse répète les questions dans des conversations neuves et compte un pourcentage, plutôt que de se fier à une capture d'écran.",
      },
      {
        q: "Faut-il poser la question avec le nom de mon entreprise ?",
        a: "Pas pour mesurer la recommandation : un client qui ne vous connaît pas ne tape pas votre nom. Posez les questions génériques, puis une question nominative à part, pour vérifier l'exactitude de ce que l'IA dit de vous.",
      },
      {
        q: 'Combien de questions faut-il suivre ?',
        a: "Cinq questions bien choisies suffisent pour une première lecture ; vingt à cinquante si vous avez plusieurs services, produits ou villes. Gardez la même liste d'un mois à l'autre, sinon les comparaisons n'ont pas de sens.",
      },
    ],
    related: [
      { href: '/audit', label: 'Lancer le test gratuit' },
      { href: '/guides/suivre-ses-questions-chatgpt', label: 'Guide : choisir les questions à suivre' },
      { href: '/methode#marge-erreur', label: 'Comment Repéré calcule la marge d’erreur' },
    ],
    published: '2026-11-15',
    updated: '2026-11-15',
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'alternative-semrush-pme',
    q: 'Quelle alternative à Semrush pour une PME ?',
    seoTitle: 'Alternative à Semrush pour une PME (2026)',
    description:
      "Alternatives gratuites et payantes à Semrush pour une PME : audit, mots-clés, positions, visibilité dans les IA. Ce que chaque outil fait, prix relevés et sources datées.",
    answer:
      "Tout dépend de ce que vous utilisez dans Semrush. Pour l'audit de votre site, Google Search Console, PageSpeed Insights, le compte gratuit d'Ahrefs et la version gratuite de Screaming Frog couvrent l'essentiel. Pour les mots-clés et les concurrents, les comparatifs citent SE Ranking, Ahrefs, Ubersuggest ou les français Haloscan et Ranxplorer [@lfdnSemrush]. Pour le SEO et la visibilité dans les IA en français, avec les corrections faites, il y a Repéré.",
    takeaways: [
      `Semrush : ${c.semrush.prix}`,
      'L’audit technique de votre propre site peut se faire avec des outils gratuits.',
      'Repéré n’a pas d’index de mots-clés ni de liens comparable à Semrush ou Ahrefs : il ne les remplace pas pour la recherche de mots-clés à grande échelle.',
    ],
    sections: [
      {
        id: 'gratuit',
        q: "Quelles alternatives gratuites pour l'audit ?",
        answer:
          "Search Console et PageSpeed Insights pour ce que Google voit de votre site, Bing Webmaster Tools pour Bing et Copilot, et un robot d'exploration gratuit pour parcourir vos pages.",
        blocks: [FREE_AUDIT_TABLE],
      },
      {
        id: 'payant',
        q: 'Quelles alternatives payantes pour les mots-clés et les concurrents ?',
        answer:
          "La Fabrique du Net liste, en octobre 2026, SE Ranking, Ahrefs, Haloscan, Ranxplorer, Ubersuggest, Mangools, Moz Pro, Serpstat, Sistrix, Majestic et SEO PowerSuite ; Haloscan et Ranxplorer y sont présentés comme français [@lfdnSemrush].",
        blocks: [
          {
            table: {
              head: ['Outil', 'Prix d’entrée relevé par La Fabrique du Net'],
              caption: 'Prix relevés le 7 octobre 2026 par La Fabrique du Net, non vérifiés par Repéré.',
              rows: [
                ['SE Ranking', '87,20 € par mois en annuel, 109 € en mensuel'],
                ['Ahrefs', '27 € par mois (offre Starter) ; l’offre Lite relevée par Repéré est à 129 $ par mois [@ahrefsPricing]'],
                ['Haloscan (France)', 'Gratuit, puis 59 € HT par mois'],
                ['Ranxplorer (France)', '32 € HT par mois'],
                ['Ubersuggest', '29 € par mois'],
                ['Sistrix', '119 € HT par mois'],
              ],
            },
          },
        ],
      },
      {
        id: 'repere',
        q: 'Repéré remplace-t-il Semrush ?',
        answer:
          "Pas pour tout : Repéré n'a pas d'index de mots-clés ni de liens comparable. Il convient à une PME qui veut savoir quoi corriger sur son site, suivre ses positions et sa visibilité dans les IA, en français, et faire appliquer les corrections ; une équipe SEO qui fait de la recherche de mots-clés à grande échelle gardera une suite complète.",
        blocks: [
          {
            ul: [`SEO : ${c.repere.seo}`, `Positions : ${c.repere.positions}`, `Prix : ${c.repere.prix}`],
          },
          { p: 'Le détail : [Repéré ou Semrush ?](/comparatif/semrush)' },
        ],
      },
      {
        id: 'choisir',
        q: 'Comment choisir en trois questions ?',
        answer: "Demandez-vous qui utilisera l'outil chaque semaine, de quelles données vous avez vraiment besoin, et combien de temps vous avez pour appliquer les recommandations.",
        blocks: [
          {
            ol: [
              'Qui utilisera l’outil ? Un expert SEO tirera parti d’une suite complète ; un dirigeant a besoin de priorités claires.',
              'De quoi avez-vous besoin : audit technique, mots-clés, concurrents, positions, visibilité dans les IA ?',
              'Combien de temps pour agir ? Sans temps, un service qui exécute coûte moins cher qu’un abonnement inutilisé.',
            ],
          },
        ],
      },
    ],
    faq: [
      {
        q: 'Existe-t-il une alternative gratuite à Semrush ?',
        a: "Pas pour toutes ses fonctions, mais Google Search Console, PageSpeed Insights, Bing Webmaster Tools, le compte gratuit d'Ahrefs (site vérifié) et la version gratuite de Screaming Frog (500 URL) couvrent l'audit de votre propre site. Haloscan propose aussi une offre gratuite selon La Fabrique du Net.",
      },
      {
        q: 'Quelle alternative française à Semrush ?',
        a: "Les comparatifs citent Haloscan et Ranxplorer pour les mots-clés et le positionnement. Repéré, également français, couvre l'audit SEO, les positions et la visibilité dans les IA, mais pas la recherche de mots-clés à grande échelle.",
      },
      {
        q: 'Semrush suit-il la visibilité dans ChatGPT ?',
        a: "Oui, avec son AI Visibility Toolkit, vendu en plus de l'abonnement SEO : suivi de prompts sur ChatGPT et l'AI Mode de Google, et relevé des mentions dans Gemini, Perplexity et les réponses IA de Google, selon sa documentation lue le 13 novembre 2026.",
      },
    ],
    related: [
      { href: '/comparatif/semrush', label: 'Repéré ou Semrush ?' },
      { href: '/comparatif/ahrefs', label: 'Repéré ou Ahrefs ?' },
      { href: '/questions/audit-seo-gratuit', label: 'Comment faire un audit SEO gratuit ?' },
    ],
    published: '2026-11-15',
    updated: '2026-11-15',
  },

  /* ---------------------------------------------------------------- */
  {
    slug: 'audit-seo-gratuit',
    q: 'Comment faire un audit SEO gratuit de son site ?',
    seoTitle: 'Audit SEO gratuit : méthode et outils (2026)',
    description:
      "Faire l'audit SEO de son site gratuitement : ce qu'il faut vérifier, les outils gratuits (Search Console, PageSpeed, Bing, robots d'exploration), comment prioriser, et ce qui compte pour les IA.",
    answer:
      "Combinez trois sources gratuites : Google Search Console pour ce que Google voit réellement de votre site, PageSpeed Insights pour la vitesse mobile, et un robot d'exploration qui parcourt vos pages (version gratuite de Screaming Frog, compte gratuit d'Ahrefs ou analyse gratuite de Repéré). Classez ensuite les problèmes par impact : pages bloquées ou non indexées d'abord, puis titres absents, doublons et lenteur, enfin les détails.",
    takeaways: [
      'Un audit utile se termine par une liste courte de priorités, pas par 300 alertes.',
      'Google indique que les bonnes pratiques SEO restent valables pour ses fonctions IA [@googleAiGuide].',
      'En 2026, vérifiez aussi l’accès des robots d’IA et le rendu sans JavaScript.',
    ],
    sections: [
      {
        id: 'points',
        q: 'Que doit vérifier un audit SEO ?',
        answer:
          "Six familles : l'exploration et l'indexation, les balises et la structure, le contenu, la performance mobile, les données structurées et, depuis l'arrivée des IA, l'accès de leurs robots.",
        blocks: [
          {
            table: {
              head: ['Famille', 'Exemples de contrôles', 'Outil gratuit'],
              rows: [
                ['Exploration et indexation', 'robots.txt, sitemap, pages en noindex, erreurs 404 et 5xx, redirections en chaîne, balises canonical', 'Search Console, robot d’exploration'],
                ['Balises et structure', 'Title et meta description absents ou dupliqués, un seul h1 par page, liens internes cassés', 'Robot d’exploration'],
                ['Contenu', 'Pages trop pauvres, doublons, réponse claire aux questions des clients', 'Robot d’exploration et lecture humaine'],
                ['Performance', 'Core Web Vitals (LCP, INP, CLS) sur mobile', 'PageSpeed Insights, Search Console'],
                ['Données structurées', 'Organization, LocalBusiness, Product, FAQPage valides et conformes au texte visible', 'Test des résultats enrichis de Google'],
                ['Robots d’IA', 'OAI-SearchBot, PerplexityBot, Claude-SearchBot autorisés ; contenu lisible sans JavaScript', '[Testeur de robots.txt](/outils/robots-ia)'],
              ],
            },
          },
        ],
      },
      {
        id: 'outils',
        q: 'Quels outils gratuits utiliser ?',
        answer: 'Les outils gratuits de Google et de Bing pour vos données réelles, et un robot d’exploration pour parcourir les pages comme le ferait un moteur.',
        blocks: [FREE_AUDIT_TABLE],
      },
      {
        id: 'prioriser',
        q: 'Comment prioriser les corrections ?',
        answer:
          "Corrigez d'abord ce qui empêche les moteurs de voir vos pages (blocage, noindex, erreurs serveur), ensuite ce qui touche beaucoup de pages à la fois (gabarit lent, titres dupliqués), enfin les détails page par page.",
        blocks: [
          {
            ol: [
              'Bloquant : pages importantes bloquées, en noindex, en erreur ou absentes de l’index.',
              'Massif : un défaut de gabarit répété sur des dizaines de pages (titres, lenteur, canonical).',
              'Contenu : pages clés qui ne répondent pas clairement à la question du client.',
              'Détails : textes alternatifs, longueurs de balises, liens internes secondaires.',
            ],
          },
        ],
      },
      {
        id: 'ia',
        q: 'Un audit SEO suffit-il pour les IA ?',
        answer:
          "C'est la base, pas la totalité : Google indique que ses fonctions IA reposent sur les mêmes systèmes que la recherche [@googleAiGuide], mais les assistants s'appuient aussi beaucoup sur ce que des sites tiers disent de vous [@chen2025], ce qu'aucun audit de site ne mesure.",
        blocks: [{ p: 'Ce que montrent les études : [pourquoi une IA recommande une marque](/etudes/pourquoi-les-ia-recommandent-une-marque).' }],
      },
      {
        id: 'repere',
        q: "Que contient l'analyse gratuite de Repéré ?",
        answer:
          "Une exploration réelle de votre site (jusqu'à 60 pages, en 45 secondes environ), des contrôles SEO et GEO adaptés à votre type de site et les 5 corrections prioritaires, sans création de compte. Elle mesure l'état du site, pas une position : la note SEO ne dit pas où vous êtes classé.",
        blocks: [{ p: '[Lancer l’analyse gratuite](/analyse) · [La liste des contrôles et la méthode](/methode)' }],
      },
    ],
    faq: [
      {
        q: 'Un audit SEO gratuit est-il fiable ?',
        a: "Oui pour les problèmes techniques mesurables, que les outils gratuits détectent bien. Il l'est moins pour la stratégie : le choix des mots-clés, la concurrence et le contenu à créer demandent des données payantes ou une analyse humaine.",
      },
      {
        q: 'À quelle fréquence refaire un audit SEO ?',
        a: "Après chaque refonte ou migration, et au moins une fois par trimestre pour un site qui publie souvent. Entre deux audits, Search Console signale une grande partie des problèmes d'indexation de votre site.",
      },
      {
        q: 'Faut-il installer un logiciel ?',
        a: "Non : Search Console, PageSpeed Insights, Bing Webmaster Tools et les analyses en ligne fonctionnent dans le navigateur. Screaming Frog est un logiciel de bureau, plus complet pour les techniciens.",
      },
    ],
    related: [
      { href: '/analyse', label: 'Analyse SEO et IA gratuite du site' },
      { href: '/questions/alternative-semrush-pme', label: 'Quelle alternative à Semrush pour une PME ?' },
      { href: '/outils', label: 'Outils gratuits de Repéré' },
    ],
    published: '2026-11-15',
    updated: '2026-11-15',
  },
];

export const getTargetQuestion = (slug: string) => TARGET_QUESTIONS.find((x) => x.slug === slug);
export const targetQuestionPath = (x: TargetQuestion | string) => `/questions/${typeof x === 'string' ? x : x.slug}`;
/** Date de dernière modification la plus récente (pour /questions et le sitemap). */
export const TARGET_QUESTIONS_UPDATED = TARGET_QUESTIONS.map((x) => x.updated).sort().at(-1)!;
