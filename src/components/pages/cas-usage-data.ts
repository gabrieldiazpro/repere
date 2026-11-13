/**
 * Cas d'usage par métier (6 métiers prioritaires). Aucun client réel cité : ce sont des scénarios d'usage, présentés
 * comme tels. Les exemples de questions sont des exemples, pas des volumes mesurés.
 */
export interface UseCase {
  slug: string;
  segment: "local" | "pme" | "ecommerce";
  name: string;
  /** « pour les plombiers » */
  forWho: string;
  title: string;
  description: string;
  lead: string;
  questions: string[];
  /** Ce que les IA regardent pour ce métier. */
  signals: { title: string; text: string }[];
  /** Ce que Repéré fait, concrètement, pour ce métier. */
  actions: string[];
  watch: string;
  demoAccount?: "demo" | "demo-pme" | "demo-ecom";
  resource: { label: string; href: string };
}

export const USE_CASES: readonly UseCase[] = [
  {
    slug: "plombier",
    segment: "local",
    name: "Plombiers et chauffagistes",
    forWho: "pour les plombiers et chauffagistes",
    title: "Plombiers : être le nom que l'IA donne pour une urgence",
    description: "Comment un plombier ou un chauffagiste peut apparaître quand on demande à ChatGPT ou Gemini un dépanneur fiable près de chez soi.",
    lead: "Fuite un dimanche, chauffe-eau en panne : de plus en plus de gens demandent directement à une IA. Elle répond avec deux ou trois noms. Voici comment Repéré vous aide à en faire partie.",
    questions: ["Un plombier disponible ce soir dans le 11e ?", "Combien coûte le remplacement d'un chauffe-eau ?", "Quel chauffagiste pour l'entretien d'une chaudière à Lyon ?"],
    signals: [
      { title: "Fiche Google complète", text: "Zone d'intervention, horaires d'urgence, catégories exactes, photos récentes." },
      { title: "Avis récents et répondus", text: "Le volume, la fraîcheur et vos réponses comptent dans les sources que lisent les IA." },
      { title: "Coordonnées cohérentes", text: "Le même nom, la même adresse et le même numéro sur tous les annuaires." },
    ],
    actions: ["Audit de fiche Google sur 100 et corrections", "Réponses aux avis rédigées, campagne de demande d'avis", "Vérification des annuaires de votre métier", "Visibilité quartier par quartier (simulation étiquetée)"],
    watch: "Les erreurs d'horaires ou de numéro reprises par une IA : la fiche de vérité vous alerte.",
    demoAccount: "demo",
    resource: { label: "Visibilité IA des plombiers", href: "/visibilite-ia/plombier" },
  },
  {
    slug: "restaurant",
    segment: "local",
    name: "Restaurants",
    forWho: "pour les restaurants",
    title: "Restaurants : être recommandé quand on demande où dîner",
    description: "Comment un restaurant peut être cité par les IA quand on cherche une adresse pour ce soir : fiches, avis, menus et guides lus par les assistants.",
    lead: "« Un bon restaurant italien pas trop cher près de Bastille ? » La réponse de l'IA s'appuie sur des fiches, des avis et des guides. Repéré vous montre lesquels, et ce qui manque chez vous.",
    questions: ["Un restaurant pour un dîner d'anniversaire à Nantes ?", "Où manger végétarien près de la gare ?", "Un bistrot ouvert le lundi midi dans le 10e ?"],
    signals: [
      { title: "Horaires et menu à jour", text: "Une IA qui annonce « fermé le lundi » à tort vous coûte des tables." },
      { title: "Guides et sites d'avis", text: "Les IA citent souvent quelques guides et plateformes d'avis : y être présent compte." },
      { title: "Spécialités claires", text: "Cuisine, régimes, prix, ambiance : les mots que les clients utilisent dans leurs questions." },
    ],
    actions: ["Fiche de vérité : horaires, jours de fermeture, prix moyens", "Sources citées pour votre quartier et votre cuisine", "Réponses aux avis et demandes d'avis", "Alertes quand une IA donne une mauvaise information"],
    watch: "Les jours de fermeture et les horaires : ce sont les erreurs les plus coûteuses.",
    demoAccount: "demo",
    resource: { label: "Visibilité IA des restaurants", href: "/visibilite-ia/restaurant" },
  },
  {
    slug: "institut-de-beaute",
    segment: "local",
    name: "Instituts de beauté et coiffeurs",
    forWho: "pour les instituts de beauté et les coiffeurs",
    title: "Instituts et salons : être cité pour vos prestations",
    description: "Comment un institut de beauté ou un salon de coiffure peut apparaître dans les recommandations des IA, prestation par prestation.",
    lead: "Les questions sont précises : « soin du visage pour peau sensible », « coloriste spécialiste du blond ». Les IA citent les salons dont les prestations sont clairement décrites et bien notées.",
    questions: ["Un institut pour un soin du visage peau sensible à Bordeaux ?", "Coiffeur spécialiste des cheveux bouclés à Lille ?", "Où faire une épilation au laser près de chez moi ?"],
    signals: [
      { title: "Prestations détaillées", text: "Chaque soin nommé, avec sa durée et son prix, sur votre fiche et votre site." },
      { title: "Avis qui parlent des prestations", text: "Les thèmes de vos avis indiquent aux IA pour quoi vous êtes reconnu." },
      { title: "Plateformes de réservation", text: "Souvent citées par les IA : votre présence et la cohérence des informations comptent." },
    ],
    actions: ["Thèmes de vos avis et réponses rédigées", "Questions suivies par prestation", "Fiche Google et annuaires vérifiés", "Calendrier de publications sur votre fiche"],
    watch: "Les prix et les prestations périmés repris par les IA.",
    demoAccount: "demo",
    resource: { label: "Visibilité IA des instituts de beauté", href: "/visibilite-ia/institut-de-beaute" },
  },
  {
    slug: "logiciel-saas",
    segment: "pme",
    name: "Éditeurs de logiciels",
    forWho: "pour les éditeurs de logiciels",
    title: "Éditeurs de logiciels : entrer dans la liste courte de l'IA",
    description: "Comment un éditeur SaaS peut être cité quand un acheteur demande à une IA le meilleur logiciel de sa catégorie : comparatifs, sources B2B, pages citables.",
    lead: "Un acheteur demande « quel logiciel de paie pour une PME de 40 salariés ? » et obtient une liste courte. Elle s'appuie sur des comparatifs, des annuaires B2B et des pages claires. Repéré vous montre où vous manquez.",
    questions: ["Quel logiciel de paie pour une PME de 40 salariés ?", "Alternative française à un CRM américain ?", "Meilleur outil de signature électronique pour un cabinet ?"],
    signals: [
      { title: "Comparatifs et annuaires B2B", text: "Les pages « meilleurs logiciels de… » et les plateformes d'avis B2B sont très citées." },
      { title: "Pages comparatives honnêtes", text: "« X ou Y : lequel choisir ? », « Alternative à… » : des pages que les IA reprennent volontiers." },
      { title: "Prix et cas d'usage publics", text: "Une IA ne recommande pas ce qu'elle ne sait pas décrire." },
    ],
    actions: ["Part de voix face à 5 concurrents, par thème et par IA", "Cartographie des sources B2B citées", "Pages citables rédigées (Accompagné : 2 par mois)", "Démarches vers les comparatifs qui vous ignorent"],
    watch: "Un concurrent qui apparaît sur vos questions clés : l'alerte part le jour de la mesure.",
    demoAccount: "demo-pme",
    resource: { label: "Visibilité IA des logiciels RH et paie", href: "/visibilite-ia/pme/logiciel-rh-paie" },
  },
  {
    slug: "cabinet-de-conseil",
    segment: "pme",
    name: "Cabinets de conseil et de services",
    forWho: "pour les cabinets de conseil et de services",
    title: "Cabinets de conseil : être recommandé sur votre expertise",
    description: "Comment un cabinet de conseil ou de services B2B peut être cité par les IA sur son domaine d'expertise et sa région.",
    lead: "« Quel cabinet pour accompagner une levée de fonds à Lyon ? » Les IA citent les cabinets dont l'expertise est écrite noir sur blanc, et repris par des sources tierces.",
    questions: ["Un cabinet de conseil en organisation pour une PME industrielle ?", "Quel cabinet de recrutement tech à Paris ?", "Consultant RSE pour une première démarche ?"],
    signals: [
      { title: "Expertise explicite", text: "Des pages par expertise et par secteur, avec des exemples concrets." },
      { title: "Sources tierces", text: "Annuaires professionnels, médias spécialisés, interventions et publications." },
      { title: "Données structurées", text: "Organisation, services et zone d'intervention balisés pour être compris." },
    ],
    actions: ["Questions suivies par expertise et par ville", "Sources citées pour votre domaine", "Balisage schema.org et pages services (Accompagné)", "Rapport mensuel à partager avec vos associés"],
    watch: "Les IA qui vous attribuent une expertise que vous n'avez pas, ou en oublient une.",
    demoAccount: "demo-pme",
    resource: { label: "Visibilité IA des cabinets de conseil", href: "/visibilite-ia/pme/cabinet-de-conseil" },
  },
  {
    slug: "cosmetiques",
    segment: "ecommerce",
    name: "Marques de cosmétiques",
    forWho: "pour les marques de cosmétiques",
    title: "Cosmétiques : quand l'IA conseille un produit",
    description: "Comment une marque de cosmétiques peut voir ses produits cités par les IA, et vers quelle boutique elles renvoient : fiches, avis, comparatifs.",
    lead: "« Meilleure crème solaire bio pour le visage ? » L'IA cite des produits, des marques et des boutiques. Repéré suit vos produits un par un, et ce qui passe devant eux.",
    questions: ["Meilleure crème solaire bio pour le visage ?", "Un shampoing solide pour cheveux secs ?", "Déodorant naturel qui fonctionne vraiment ?"],
    signals: [
      { title: "Fiches produit riches", text: "Composition, usage, type de peau, avis, balisage Product : ce que les IA peuvent citer." },
      { title: "Comparatifs et forums", text: "Les articles « meilleurs produits » et les discussions entre utilisateurs pèsent lourd." },
      { title: "Revendeurs", text: "L'IA peut citer votre produit en renvoyant vers une marketplace, avec un autre prix." },
    ],
    actions: ["Suivi par produit sur 3 IA", "Marques et revendeurs cités à votre place", "Prix et avis cités comparés à vos fiches", "Fiches produit et guide d'achat préparés (Accompagné)"],
    watch: "Les allégations : nous n'écrivons aucune promesse santé ou d'efficacité non prouvée dans vos fiches.",
    demoAccount: "demo-ecom",
    resource: { label: "Visibilité IA des cosmétiques", href: "/visibilite-ia/e-commerce/cosmetiques" },
  },
];

export const casUsagePath = (slug: string) => `/cas-usage/${slug}`;
export const getUseCase = (slug: string) => USE_CASES.find((u) => u.slug === slug);
export const USE_CASES_UPDATED = "2026-11-09";
