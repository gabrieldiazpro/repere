/** Centre d'aide : articles courts. Une source unique pour /aide et /aide/[slug]. */
export type HelpCategory = "Démarrer" | "Mesure" | "Actions" | "Équipe et partage" | "Compte et données";

export interface HelpArticle {
  slug: string;
  category: HelpCategory;
  title: string;
  summary: string;
  /** Paragraphes d'introduction. */
  intro: string[];
  /** Étapes, quand l'article décrit une marche à suivre. */
  steps?: string[];
  /** Remarque honnête (limite, précaution). */
  note?: string;
  related?: { label: string; href: string }[];
}

export const HELP_CATEGORIES: readonly HelpCategory[] = ["Démarrer", "Mesure", "Actions", "Équipe et partage", "Compte et données"];

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    slug: "creer-un-compte",
    category: "Démarrer",
    title: "Comment créer un compte gratuit",
    summary: "L'offre Découverte : 5 questions suivies sur 3 IA, une mesure par mois, sans carte bancaire.",
    intro: ["Le compte Découverte est gratuit et sans limite de durée. Il suit une marque sur 5 questions, une fois par mois, sur ChatGPT, Gemini et Perplexity."],
    steps: [
      "Ouvrez la page d'inscription et choisissez votre activité : commerce local, PME ou e-commerce.",
      "Indiquez votre e-mail, le nom de votre entreprise et votre site ou votre ville.",
      "Cliquez sur le lien reçu par e-mail : votre espace s'ouvre et la première mesure est lancée.",
    ],
    note: "Découverte ne comprend ni les tâches prêtes ni le travail fait pour vous. Vous pouvez changer d'offre à tout moment.",
    related: [
      { label: "Créer mon compte", href: "/inscription" },
      { label: "Comparer les offres", href: "/tarifs#comparer" },
    ],
  },
  {
    slug: "se-connecter",
    category: "Démarrer",
    title: "Se connecter avec un lien magique",
    summary: "Pas de mot de passe : un lien de connexion arrive par e-mail.",
    intro: ["Repéré n'utilise pas de mot de passe. Vous saisissez votre e-mail, nous vous envoyons un lien qui ouvre votre espace."],
    steps: [
      "Ouvrez la page de connexion et saisissez l'e-mail de votre compte.",
      "Ouvrez l'e-mail de Repéré et cliquez sur le lien, sur le même appareil de préférence.",
      "Votre session reste ouverte sur cet appareil ; « Se déconnecter » la ferme.",
    ],
    note: "Le lien n'est valable qu'un temps limité. S'il a expiré ou s'il n'arrive pas, vérifiez vos indésirables puis demandez-en un nouveau.",
    related: [{ label: "Page de connexion", href: "/connexion" }],
  },
  {
    slug: "choisir-ses-questions",
    category: "Mesure",
    title: "Choisir et modifier vos questions suivies",
    summary: "Les questions décident de tout : gardez celles qui ressemblent vraiment à vos clients.",
    intro: [
      "Nous proposons des questions à partir de votre site et de votre secteur. Vous pouvez en retirer, en ajouter une par une ou en importer un fichier CSV, et les ranger par thème.",
    ],
    steps: [
      "Dans votre espace, ouvrez « Questions ».",
      "Retirez les questions qui ne correspondent pas à vos clients et ajoutez les vôtres.",
      "Rangez-les par thème (prix, dépannage, comparaison…) pour lire vos résultats par sujet.",
    ],
    note: "L'indice de demande (faible, moyen, fort) est une estimation : les IA ne publient pas de volumes de questions.",
    related: [{ label: "Le module Questions suivies", href: "/fonctionnalites/questions-suivies" }],
  },
  {
    slug: "lire-son-score",
    category: "Mesure",
    title: "Lire votre score et sa marge d'erreur",
    summary: "Un score sur 100, le nombre de réponses derrière, et un niveau de confiance.",
    intro: [
      "Le score résume la part des réponses où vous êtes cité, et à quel rang, sur l'ensemble de vos questions et des IA suivies.",
      "Les IA ne répondent pas toujours la même chose. C'est pourquoi chaque chiffre affiche le nombre de réponses analysées et une marge : une variation à l'intérieur de la marge n'est pas un vrai changement.",
    ],
    related: [{ label: "Notre méthode", href: "/methode" }],
  },
  {
    slug: "part-de-voix",
    category: "Mesure",
    title: "Comprendre la part de voix",
    summary: "La part des citations qui vous revient face à vos concurrents.",
    intro: [
      "Sur toutes les réponses, nous comptons les citations de chaque entreprise. Votre part de voix est la part qui vous revient.",
      "Elle se lit par IA et par thème : vous pouvez être bien placé sur ChatGPT pour les questions de prix et absent de Gemini pour les questions de dépannage.",
    ],
    note: "Les concurrents sont détectés dans les réponses ; vous pouvez en ajouter ou en retirer.",
  },
  {
    slug: "sources-citees",
    category: "Mesure",
    title: "Lire l'écran des sources",
    summary: "Les sites que lisent les IA, et votre présence sur chacun.",
    intro: [
      "Quand une IA cite des pages pour appuyer sa réponse, nous les relevons. L'écran Sources les classe par type et par opportunité : en tête, les sites souvent cités où vous êtes absent.",
    ],
    note: "Gemini, interrogé sans recherche web, ne fournit pas de sources : l'écran repose sur les autres IA.",
    related: [{ label: "Le pilier Comprendre", href: "/fonctionnalites/comprendre#sources" }],
  },
  {
    slug: "fiche-de-verite",
    category: "Mesure",
    title: "Remplir la fiche de vérité",
    summary: "Vos informations exactes, pour être alerté quand une IA se trompe.",
    intro: ["La fiche de vérité contient ce qui est vrai sur vous : coordonnées, horaires, prix, services, zone d'intervention. Nous la comparons aux réponses des IA."],
    steps: [
      "Ouvrez « Vérité » dans votre espace.",
      "Complétez chaque champ ; laissez vide ce qui ne s'applique pas.",
      "Mettez-la à jour dès qu'une information change : une fiche périmée produit de fausses alertes.",
    ],
    related: [{ label: "La fiche de vérité", href: "/fonctionnalites/comprendre#verite" }],
  },
  {
    slug: "faire-une-tache",
    category: "Actions",
    title: "Faire une tâche de la semaine",
    summary: "Chaque tâche arrive avec son texte prêt et une durée estimée.",
    intro: ["Chaque lundi, vous recevez trois actions prioritaires. Chacune explique pourquoi elle compte et fournit le livrable : texte, balisage, page ou message."],
    steps: [
      "Ouvrez la tâche depuis l'e-mail du lundi ou l'écran « Tâches ».",
      "Copiez le texte ou le balisage et collez-le à l'endroit indiqué.",
      "Marquez la tâche comme faite : les questions liées seront reposées plus tard pour mesurer l'effet.",
    ],
    note: "Faire une tâche augmente les chances d'être cité ; ça ne garantit pas un rang.",
    related: [{ label: "Le pilier Agir", href: "/fonctionnalites/agir" }],
  },
  {
    slug: "valider-une-publication",
    category: "Actions",
    title: "Valider une publication (Accompagné)",
    summary: "Nous préparons, vous validez, nous publions.",
    intro: [
      "Avec Accompagné, nous faisons le travail : fiche, réponse à un avis, page, annuaire. Rien n'est publié sans votre accord.",
      "Vous recevez un e-mail avec le contenu proposé. Vous validez, demandez une modification ou refusez, depuis votre téléphone si vous voulez.",
    ],
  },
  {
    slug: "installer-le-script",
    category: "Actions",
    title: "Installer le script de mesure sans cookie",
    summary: "Une ligne à coller pour compter les visites venues des IA.",
    intro: ["Le script ne pose aucun cookie et ne collecte aucune donnée personnelle : pas besoin de bandeau de consentement pour lui."],
    steps: [
      "Dans Réglages, copiez la ligne de script propre à votre compte.",
      "Collez-la dans l'en-tête de votre site (ou via votre gestionnaire de balises).",
      "Les premières visites venues des IA apparaissent dans « Trafic IA » dès qu'elles ont lieu.",
    ],
    note: "Une partie des visites venues des IA arrive sans site d'origine : elle reste invisible, pour nous comme pour tout outil.",
    related: [{ label: "Le trafic IA", href: "/fonctionnalites/prouver#trafic" }],
  },
  {
    slug: "plugin-wordpress",
    category: "Actions",
    title: "Installer le plugin WordPress",
    summary: "Le balisage schema.org de votre fiche de vérité, servi automatiquement.",
    intro: ["L'extension insère côté serveur le balisage préparé par Repéré, lisible par les robots des IA qui n'exécutent pas le JavaScript."],
    steps: [
      "Téléchargez l'extension depuis votre espace.",
      "Dans WordPress, « Extensions », « Ajouter », « Téléverser », puis activez-la.",
      "Collez votre clé dans les réglages de l'extension.",
    ],
    note: "En option, l'extension signale les passages des robots des IA, sans adresse IP. Elle se désactive en un clic.",
    related: [{ label: "Intégrations", href: "/integrations#wordpress" }],
  },
  {
    slug: "inviter-un-collegue",
    category: "Équipe et partage",
    title: "Inviter un collègue et choisir son rôle",
    summary: "Propriétaire, administrateur, membre ou lecteur.",
    intro: ["Vous pouvez inviter des collègues par e-mail. Le rôle décide de ce qu'ils peuvent faire."],
    steps: [
      "Dans Réglages, ouvrez « Équipe » et saisissez l'e-mail de la personne.",
      "Choisissez son rôle : administrateur (tout sauf la facturation), membre (travaille sur les tâches) ou lecteur (consulte seulement).",
      "La personne reçoit un lien d'invitation et se connecte sans mot de passe.",
    ],
    note: "Le nombre de places dépend de votre offre.",
  },
  {
    slug: "partager-un-rapport",
    category: "Équipe et partage",
    title: "Partager un rapport par lien",
    summary: "Un lien public, avec expiration, révocable à tout moment.",
    intro: ["Pour montrer vos résultats à quelqu'un qui n'a pas de compte, créez un lien de partage. Il ouvre une version en lecture seule du rapport."],
    steps: ["Ouvrez « Rapports » puis « Partager ».", "Choisissez une date d'expiration.", "Copiez le lien. Vous pouvez le révoquer à tout moment ; il cesse alors de fonctionner."],
    note: "Les liens de partage et les exports sont inclus dans Essentiel et Accompagné.",
    related: [{ label: "Rapports et partage", href: "/fonctionnalites/rapports-et-partage" }],
  },
  {
    slug: "changer-d-offre",
    category: "Compte et données",
    title: "Changer d'offre ou résilier",
    summary: "Passer à l'offre supérieure, revenir à Découverte ou arrêter.",
    intro: [
      "Le changement d'offre se fait depuis l'espace de facturation, au prorata. Essentiel est sans engagement ; Accompagné demande 3 mois, puis devient mensuel sans engagement.",
      "Si vous arrêtez un abonnement, le mois en cours reste accessible jusqu'à son terme. Votre historique est conservé.",
    ],
    related: [{ label: "Tarifs", href: "/tarifs" }],
  },
  {
    slug: "exporter-ou-supprimer-ses-donnees",
    category: "Compte et données",
    title: "Exporter ou supprimer vos données",
    summary: "Vos données vous appartiennent : export complet ou suppression.",
    intro: ["Depuis Réglages, vous pouvez télécharger toutes les données de votre compte ou demander leur suppression définitive. Vous pouvez aussi nous écrire."],
    note: "La suppression est définitive : exportez d'abord ce que vous voulez garder. Les factures sont conservées le temps imposé par la loi.",
    related: [
      { label: "Sécurité et données", href: "/securite#rgpd" },
      { label: "Politique de confidentialité", href: "/confidentialite" },
    ],
  },
];

export const helpPath = (slug: string) => `/aide/${slug}`;
export const getHelpArticle = (slug: string) => HELP_ARTICLES.find((a) => a.slug === slug);
export const HELP_UPDATED = "2026-11-09";
