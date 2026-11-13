/**
 * Pages SEO V2 : catégories PME (B2B) et e-commerce.
 * Les requêtes sont des formulations réalistes d'acheteurs ; les domaines viennent de la table
 * docs/v2/03-domains.json (copiée dans ./domains.json). La liste des sources est une hypothèse éditoriale,
 * à confirmer par nos mesures : aucune statistique propre n'est publiée tant que getSegmentStats renvoie null.
 */
import domainsRaw from './domains.json';
import { abs, SITE_URL, MIN_AUDITS_FOR_INDEX, MAX_AGE_DAYS, type SeoStats } from './index';

export type SegmentKey = 'pme' | 'ecommerce';

export interface DomainRow {
  domain: string;
  category: string;
  label: string;
  howToGetListed: string;
}
const DOMAINS = domainsRaw as DomainRow[];
export const getDomain = (d: string): DomainRow | undefined => DOMAINS.find((x) => x.domain === d);

export const CATEGORY_LABELS: Record<string, string> = {
  directory: 'Annuaire',
  reviews: 'Avis',
  media_national: 'Média',
  media_local: 'Média local',
  comparison: 'Comparatif',
  forum: 'Forum',
  marketplace: 'Marketplace',
  social: 'Réseau social',
  wikipedia: 'Encyclopédie',
  institutional: 'Institutionnel',
  other: 'Autre',
};

export interface SegmentCategory {
  slug: string;
  segment: SegmentKey;
  /** « Logiciel RH et paie » */
  name: string;
  /** « un éditeur de logiciel RH ou de paie » */
  who: string;
  /** Exemple de promesse client à tester. */
  intro: string;
  queries: string[];
  /** Domaines de 03-domains.json typiquement cités pour ce secteur. */
  sources: string[];
  /** Leviers actionnables, sans promesse de résultat. */
  levers: { title: string; text: string }[];
  /** Question fréquente propre à la catégorie. */
  faq: { q: string; a: string }[];
}

export const SEGMENTS: Record<SegmentKey, { slug: string; name: string; path: string; audience: string; auditSegment: string }> = {
  pme: { slug: 'pme', name: 'PME et services B2B', path: '/visibilite-ia/pme', audience: 'entreprises de services et éditeurs', auditSegment: 'pme' },
  ecommerce: { slug: 'e-commerce', name: 'E-commerce', path: '/visibilite-ia/e-commerce', audience: 'boutiques et marques en ligne', auditSegment: 'ecommerce' },
};

const B2B_LEVERS_COMMON = [
  { title: 'Pages citables', text: 'Une page par question d\'acheteur (comparatif, « alternative à », tarifs, FAQ métier) : titre explicite, réponse dans les premières lignes, preuves datées.' },
  { title: 'Présence sur les sources tierces', text: 'Fiches et avis sur les comparateurs et annuaires que les IA citent déjà pour votre secteur, avec des informations identiques à celles de votre site.' },
  { title: 'Robots IA autorisés', text: 'Vérifier que robots.txt ne bloque pas OAI-SearchBot, PerplexityBot ni Claude-SearchBot : un robot d\'indexation bloqué rend le site invisible pour l\'IA concernée.' },
];
const ECOM_LEVERS_COMMON = [
  { title: 'Fiches produit qui répondent', text: 'Composition, usage, dimensions, compatibilité, limites : les questions concrètes que les acheteurs posent aux IA, dans le texte visible de la fiche.' },
  { title: 'Balisage Product et Offer', text: 'Données structurées cohérentes avec la fiche (prix, disponibilité, avis réels). Beaucoup de thèmes Shopify en génèrent déjà : vérifier plutôt que dupliquer.' },
  { title: 'Sources de test et de comparaison', text: 'Guides d\'achat, tests, forums et marketplaces cités dans les réponses : y figurer par des démarches honnêtes (échantillons, informations factuelles), jamais par de faux avis.' },
];

export const CATEGORIES: SegmentCategory[] = [
  /* ------------------------------- PME ------------------------------- */
  {
    slug: 'logiciel-rh-paie', segment: 'pme', name: 'Logiciel RH et paie', who: 'un éditeur de logiciel RH ou de paie',
    intro: 'Les directions administratives et RH demandent à une IA une short-list de logiciels avant de contacter un éditeur.',
    queries: [
      'Quel est le meilleur logiciel de paie pour une PME de 50 salariés ?',
      'Logiciel RH français conforme RGPD pour gérer congés et absences',
      'Alternative à Lucca ou PayFit pour une entreprise de 100 personnes',
      'Comparatif des logiciels de paie : prix, intégration comptable, support',
      'Quel SIRH choisir quand on n\'a pas de service RH dédié ?',
      'Logiciel de paie externalisable avec expert-comptable : lequel choisir ?',
    ],
    sources: ['capterra.fr', 'appvizer.fr', 'g2.com', 'journaldunet.com', 'getapp.fr', 'linkedin.com', 'reddit.com', 'trustradius.com'],
    levers: [
      { title: 'Profils sur les comparateurs', text: 'Créer ou compléter la fiche Capterra, Appvizer, G2 : description, tarifs, intégrations, captures. Collecter des avis de clients réels, sans contrepartie ni filtre.' },
      { title: 'Pages « alternative à » et comparatifs', text: 'Des pages factuelles sur votre site (fonctions, prix, public visé), datées, sans dénigrement : la publicité comparative est encadrée.' },
      ...B2B_LEVERS_COMMON.slice(2),
    ],
    faq: [{ q: 'Les IA citent-elles les sites d\'éditeurs ou les comparateurs ?', a: 'Dans nos lectures de la littérature publique, les requêtes de comparaison favorisent les comparateurs et les médias spécialisés ; les requêtes de décision citent plus souvent les sites de marque. Nous le mesurons pour votre secteur dans l\'audit.' }],
  },
  {
    slug: 'cabinet-de-conseil', segment: 'pme', name: 'Cabinet de conseil', who: 'un cabinet de conseil',
    intro: 'Les dirigeants demandent à une IA quels cabinets consulter sur une transformation, un recrutement ou une stratégie.',
    queries: [
      'Quel cabinet de conseil en stratégie pour une PME industrielle de 80 personnes ?',
      'Cabinet de conseil en transformation digitale à Lyon : lequel choisir ?',
      'Consultant ou cabinet pour structurer les processus d\'une entreprise en croissance',
      'Cabinet de conseil en RSE accessible à une PME : avis et tarifs',
      'Meilleurs cabinets de conseil en organisation en France',
      'Quel cabinet de recrutement pour un poste de directeur financier ?',
    ],
    sources: ['sortlist.fr', 'clutch.co', 'linkedin.com', 'lesechos.fr', 'decideurs-magazine.com', 'malt.fr', 'journaldunet.com', 'glassdoor.fr'],
    levers: [
      { title: 'Pages d\'expertise par problème', text: 'Une page par situation client (« structurer le recrutement d\'une PME de 50 personnes ») avec méthode, durée, ordre de prix et cas réel autorisé par le client.' },
      { title: 'Profils sur les plateformes de mise en relation', text: 'Fiches complètes sur Sortlist, Clutch ou Malt selon votre offre, avec avis vérifiables de vrais clients.' },
      ...B2B_LEVERS_COMMON.slice(2),
    ],
    faq: [{ q: 'LinkedIn compte-t-il pour les IA ?', a: 'LinkedIn apparaît parmi les domaines les plus cités dans plusieurs études publiques sur AI Mode et Perplexity. Des publications d\'expertise signées d\'une personne identifiée sont une source possible ; l\'effet sur votre cas se mesure, il ne se promet pas.' }],
  },
  {
    slug: 'organisme-de-formation', segment: 'pme', name: 'Organisme de formation', who: 'un organisme de formation',
    intro: 'Les entreprises et les particuliers demandent à une IA quel organisme choisir pour une formation certifiante ou finançable.',
    queries: [
      'Meilleur organisme de formation Qualiopi pour former mes équipes à Excel',
      'Formation management éligible CPF : quel organisme choisir ?',
      'Organisme de formation en cybersécurité pour une PME à Nantes',
      'Quelle formation intra pour former 20 commerciaux à la négociation ?',
      'Organisme de formation avec de bons avis pour une certification Scrum',
      'Formation en ligne ou présentiel pour devenir comptable : quels organismes ?',
    ],
    sources: ['moncompteformation.gouv.fr', 'kelformation.com', 'trustpilot.com', 'avis-verifies.com', 'studyrama.com', 'letudiant.fr', 'linkedin.com', 'reddit.com'],
    levers: [
      { title: 'Catalogues et fiches publiques à jour', text: 'Vérifier le catalogue Mon Compte Formation, les mentions Qualiopi et les fiches sur les annuaires de formation : intitulés, durées, tarifs, prérequis identiques partout.' },
      { title: 'Avis de stagiaires collectés sans filtre', text: 'Demander un avis à chaque stagiaire via une plateforme d\'avis vérifiés, avec la même demande pour tous.' },
      ...B2B_LEVERS_COMMON.slice(0, 1),
    ],
    faq: [{ q: 'Dois-je afficher mes résultats de formation ?', a: 'Les indicateurs de résultats font partie des obligations de transparence liées à Qualiopi. Les publier sur votre site, de façon lisible et datée, donne aussi aux IA une information exacte à reprendre.' }],
  },
  {
    slug: 'esn', segment: 'pme', name: 'ESN et services numériques', who: 'une ESN ou une société de services numériques',
    intro: 'Les directions informatiques demandent à une IA quelles ESN consulter pour un projet, une infogérance ou du développement sur mesure.',
    queries: [
      'Meilleure ESN pour un projet de développement sur mesure en Python',
      'ESN spécialisée en cloud AWS pour une PME à Bordeaux',
      'Infogérance pour une PME de 60 postes : quelles sociétés choisir ?',
      'Alternative à une grande ESN pour un projet de 6 mois',
      'Comment choisir une ESN : critères et exemples d\'entreprises',
      'ESN avec une bonne réputation côté salariés et clients',
    ],
    sources: ['clutch.co', 'goodfirms.co', 'sortlist.fr', 'malt.fr', 'journaldunet.com', 'welcometothejungle.com', 'glassdoor.fr', 'reddit.com'],
    levers: [
      { title: 'Pages par expertise et par technologie', text: 'Une page par offre précise (cloud, data, mobile), avec technologies maîtrisées, méthode, références autorisées et ordre de grandeur de budget.' },
      { title: 'Fiches sur les classements et plateformes', text: 'Profils Clutch, GoodFirms, Sortlist, Malt : spécialités, tailles de projets, avis clients réels.' },
      { title: 'Marque employeur lisible', text: 'Les IA reprennent aussi les avis salariés (Glassdoor, Welcome to the Jungle). Répondre honnêtement aux avis et tenir la fiche à jour est un levier de réputation, pas un levier technique.' },
    ],
    faq: [{ q: 'Les classements d\'ESN comptent-ils ?', a: 'Les classements publiés par la presse spécialisée figurent parmi les sources que nous observons pour ce secteur. Leur poids varie d\'un mois à l\'autre : nous mesurons plutôt que de supposer.' }],
  },
  {
    slug: 'agence-marketing', segment: 'pme', name: 'Agence marketing et communication', who: 'une agence marketing ou de communication',
    intro: 'Les PME demandent à une IA quelle agence choisir pour leur site, leur référencement ou leurs réseaux sociaux.',
    queries: [
      'Meilleure agence SEO à Paris pour une PME B2B',
      'Agence de création de site e-commerce : laquelle choisir et à quel prix ?',
      'Agence marketing digital pour une PME de services à Toulouse',
      'Alternative à une grande agence pour un budget de 2 000 € par mois',
      'Agence de communication spécialisée en industrie : avis et références',
      'Freelance ou agence : qui choisir pour gérer la publicité en ligne ?',
    ],
    sources: ['sortlist.fr', 'clutch.co', 'designrush.com', 'codeur.com', 'blogdumoderateur.com', 'journaldunet.com', 'linkedin.com', 'trustpilot.com'],
    levers: [
      { title: 'Études de cas chiffrées et autorisées', text: 'Des cas clients réels, datés, avec la méthode et la mention de ce qui n\'est pas reproductible à l\'identique.' },
      { title: 'Profils sur Sortlist, Clutch, DesignRush', text: 'Spécialités, budgets types, avis vérifiables de clients réels.' },
      ...B2B_LEVERS_COMMON.slice(0, 1),
    ],
    faq: [{ q: 'Une agence peut-elle être évaluée par une IA sur ses propres sujets ?', a: 'Oui, et c\'est un test utile : demandez à ChatGPT, Gemini et Perplexity les questions que vos clients posent sur votre propre métier. L\'audit gratuit le fait pour vous et affiche ce qui est cité à votre place.' }],
  },
  /* ---------------------------- E-COMMERCE ---------------------------- */
  {
    slug: 'cosmetiques', segment: 'ecommerce', name: 'Cosmétiques', who: 'une marque ou une boutique de cosmétiques',
    intro: 'Les acheteuses demandent à une IA quel produit choisir selon leur type de peau, leur budget et la composition.',
    queries: [
      'Meilleure crème solaire visage non grasse pour peau sensible',
      'Alternative à La Roche-Posay pour peau à tendance acnéique',
      'Shampoing solide bio efficace pour cheveux gras',
      'Quel sérum à la vitamine C choisir à moins de 30 € ?',
      'Cosmétiques made in France avec une composition propre : quelles marques ?',
      'Cadeau beauté naturel pour une femme de 60 ans, budget 40 €',
    ],
    sources: ['beautetest.com', 'incibeauty.fr', 'quelcosmetic.fr', 'yuka.io', 'sephora.fr', 'marieclaire.fr', 'aufeminin.com', 'reddit.com', 'youtube.com'],
    levers: [
      ...ECOM_LEVERS_COMMON.slice(0, 2),
      { title: 'Composition et allégations lisibles', text: 'Liste INCI complète, allégations conformes à la réglementation, informations de test. Les bases comme INCI Beauty et Yuka lisent la composition : elle doit être exacte et à jour.' },
    ],
    faq: [{ q: 'Dois-je être sur Sephora ou Nocibé pour être cité ?', a: 'Pas nécessairement : les sites de test, de composition et les forums pèsent aussi dans les réponses. L\'audit indique, pour vos requêtes, lesquelles de ces sources sont réellement citées.' }],
  },
  {
    slug: 'mode', segment: 'ecommerce', name: 'Mode et accessoires', who: 'une marque ou une boutique de mode',
    intro: 'Les acheteurs demandent à une IA une sélection de marques ou de pièces selon leur style, leur budget et leurs valeurs.',
    queries: [
      'Marques de baskets françaises éthiques pour homme',
      'Alternative à Zara plus durable, budget moyen',
      'Meilleure marque de jeans made in France',
      'Où acheter un manteau en laine de qualité à moins de 200 € ?',
      'Marques de lingerie éco-responsable avec bonnes tailles',
      'Idée cadeau mode pour un homme de 30 ans, budget 80 €',
    ],
    sources: ['zalando.fr', 'laredoute.fr', 'vinted.fr', 'elle.fr', 'vogue.fr', 'marieclaire.fr', 'trustpilot.com', 'reddit.com', 'youtube.com'],
    levers: [
      ...ECOM_LEVERS_COMMON.slice(0, 2),
      { title: 'Tailles, matières, origine', text: 'Guide des tailles, composition, lieu de fabrication et entretien dans le texte visible : ce sont les critères que les acheteurs posent à l\'IA.' },
    ],
    faq: [{ q: 'Les IA citent-elles les marketplaces plutôt que les marques ?', a: 'Pour les requêtes de choix de produit, les marketplaces et les médias de mode apparaissent souvent. Votre site de marque garde un rôle, surtout pour les requêtes sur une marque précise.' }],
  },
  {
    slug: 'maison-deco', segment: 'ecommerce', name: 'Maison et décoration', who: 'une boutique de maison ou de décoration',
    intro: 'Les acheteurs demandent à une IA quel meuble, quel équipement ou quelle marque choisir pour leur logement.',
    queries: [
      'Meilleur canapé convertible confortable pour un petit salon',
      'Alternative à IKEA en bois massif, budget raisonnable',
      'Quel matelas choisir pour mal de dos, comparatif et avis',
      'Marques françaises de linge de maison en lin',
      'Où acheter un luminaire design pas trop cher ?',
      'Meilleure marque de vaisselle durable pour un usage quotidien',
    ],
    sources: ['maisonsdumonde.com', 'ikea.com', 'leroymerlin.fr', 'manomano.fr', 'houzz.fr', 'quechoisir.org', 'lesnumeriques.com', 'reddit.com', 'youtube.com'],
    levers: [
      ...ECOM_LEVERS_COMMON.slice(0, 2),
      { title: 'Guides d\'achat et comparatifs', text: 'Un guide par grande question (« quel matelas pour le dos ? ») avec critères, limites et produits comparés sans parti pris caché.' },
    ],
    faq: [{ q: 'Un guide d\'achat sur mon site suffit-il ?', a: 'Il fournit une page à citer, mais les tests indépendants et les forums restent des sources fréquentes. Les deux se complètent ; la mesure dira ce qui pèse dans votre catégorie.' }],
  },
  {
    slug: 'alimentation', segment: 'ecommerce', name: 'Alimentation et boissons', who: 'une marque ou une boutique d\'alimentation',
    intro: 'Les acheteurs demandent à une IA quel produit alimentaire choisir selon le goût, le régime, l\'origine et le prix.',
    queries: [
      'Meilleur café en grains pour machine automatique, origine et goût',
      'Épicerie en ligne de produits locaux avec livraison en France',
      'Alternative saine aux barres chocolatées pour le goûter',
      'Meilleure huile d\'olive française, comment la choisir ?',
      'Box gourmande artisanale en cadeau, budget 50 €',
      'Thés bio de qualité : quelles marques et où acheter ?',
    ],
    sources: ['quechoisir.org', 'yuka.io', 'marmiton.org', '750g.com', 'lsa-conso.fr', 'ankorstore.com', 'reddit.com', 'youtube.com'],
    levers: [
      ...ECOM_LEVERS_COMMON.slice(0, 2),
      { title: 'Origine, composition, labels', text: 'Informations vérifiables : origine des ingrédients, labels réels, allergènes, valeurs nutritionnelles. Des applications comme Yuka lisent ces données : elles doivent être exactes.' },
    ],
    faq: [{ q: 'Les allégations de santé posent-elles un problème ?', a: 'Oui : les allégations nutritionnelles et de santé sont réglementées. Nous ne rédigeons que des fiches conformes à ce que vous pouvez prouver, et chaque texte est validé par vous avant publication.' }],
  },
  {
    slug: 'sport', segment: 'ecommerce', name: 'Sport et plein air', who: 'une marque ou une boutique de sport',
    intro: 'Les acheteurs demandent à une IA quel équipement choisir selon leur pratique, leur niveau et leur budget.',
    queries: [
      'Meilleures chaussures de trail pour débutant, budget 120 €',
      'Alternative à Decathlon pour du matériel de running plus technique',
      'Quel vélo de ville électrique choisir à moins de 1 500 € ?',
      'Meilleure montre GPS pour la course à pied, comparatif',
      'Tapis de yoga écologique et antidérapant : quelles marques ?',
      'Cadeau pour un cycliste, budget 50 €',
    ],
    sources: ['decathlon.fr', 'amazon.fr', 'lesnumeriques.com', 'quechoisir.org', 'reddit.com', 'youtube.com', 'dealabs.com'],
    levers: [
      ...ECOM_LEVERS_COMMON.slice(0, 2),
      { title: 'Tests et retours d\'usage', text: 'Fiches avec cas d\'usage et niveau visé, vidéos de démonstration réelles, et prêt de matériel à des testeurs indépendants sans exiger d\'avis favorable.' },
    ],
    faq: [{ q: 'Les vidéos YouTube comptent-elles ?', a: 'YouTube fait partie des domaines les plus cités dans plusieurs études publiques sur les réponses IA. Pour un équipement, des démonstrations réelles et sous-titrées sont une source possible ; l\'effet se mesure au cas par cas.' }],
  },
];

export const categoriesFor = (s: SegmentKey) => CATEGORIES.filter((c) => c.segment === s);
export const getCategory = (s: SegmentKey, slug: string) => CATEGORIES.find((c) => c.segment === s && c.slug === slug);
export const categoryPath = (c: SegmentCategory) => `${SEGMENTS[c.segment].path}/${c.slug}`;
export const categoryAuditHref = (c: SegmentCategory) =>
  `/audit?segment=${SEGMENTS[c.segment].auditSegment}&secteur=${encodeURIComponent(c.slug)}`;

/** Sources typiques résolues dans la table de domaines (jamais un domaine inconnu). */
export function resolveSources(c: SegmentCategory): DomainRow[] {
  return c.sources.map(getDomain).filter((d): d is DomainRow => !!d);
}

/**
 * Statistiques agrégées par catégorie. Pas encore branché (aucun audit réel par catégorie) : null => noindex,
 * canonical vers le hub du segment. Même règle K-anonymat que les pages métier (>= 5 audits).
 */
export async function getSegmentStats(_segment: SegmentKey, _slug: string): Promise<SeoStats | null> {
  return null;
}
export function isSegmentIndexable(stats: SeoStats | null, now = Date.now()): boolean {
  if (!stats) return false;
  const ageDays = (now - new Date(stats.lastUpdated).getTime()) / 86_400_000;
  return stats.auditCount >= MIN_AUDITS_FOR_INDEX && stats.distinctQueries >= 3 && ageDays <= MAX_AGE_DAYS;
}

export function segmentFaq(c: SegmentCategory): { q: string; a: string }[] {
  const srcs = resolveSources(c).slice(0, 4).map((d) => d.label).join(', ');
  return [
    {
      q: `Comment ${c.who} peut-il être cité par ChatGPT ?`,
      a: `Les assistants s'appuient sur des sources publiques. Pour ce secteur, celles que nous observons le plus souvent sont : ${srcs}. Les bases : des pages qui répondent aux questions des acheteurs, des fiches complètes et cohérentes sur ces sources, des avis réels et des robots IA autorisés. Aucun résultat n'est promis.`,
    },
    ...c.faq,
    {
      q: 'D\'où viennent les questions et les sources affichées ?',
      a: 'Les questions sont des formulations réalistes que nous testons. La liste des sources est établie à partir de notre table de domaines et de la littérature publique : elle sert d\'hypothèse de départ, que l\'audit confirme ou corrige avec vos propres requêtes. Nous ne publions pas de statistique de secteur tant que nous n\'avons pas au moins 5 audits.',
    },
  ];
}

export function categoryServiceLd(c: SegmentCategory) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Audit de visibilité IA : ${c.name}`,
    serviceType: 'Audit de visibilité sur les assistants IA',
    description: `Mesure de la fréquence à laquelle ChatGPT, Gemini et Perplexity citent ${c.who} sur des questions d'acheteurs, avec les sources citées.`,
    '@id': `${abs(categoryPath(c))}#service`,
    url: abs(categoryPath(c)),
    provider: { '@id': `${SITE_URL}/#organization` },
    areaServed: { '@type': 'Country', name: 'France' },
  };
}
