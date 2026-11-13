/**
 * Journal public des nouveautés (/nouveautes et /nouveautes/rss.xml). Source unique : ajouter une entrée en tête.
 * Règle : seulement ce qui est livré. Ce qui est prévu va dans UPCOMING, sans date promise.
 */
export type ChangeTag = "Nouveau" | "Amélioré" | "Corrigé";

export interface ChangeEntry {
  /** Identifiant stable (ancre et guid RSS). */
  id: string;
  date: string; // AAAA-MM-JJ
  version: "V1" | "V2" | "V3";
  tag: ChangeTag;
  title: string;
  text: string;
  href?: string;
}

export const CHANGELOG: readonly ChangeEntry[] = [
  // ---- V3 ----
  {
    id: "v3-decouverte",
    date: "2026-11-09",
    version: "V3",
    tag: "Nouveau",
    title: "Offre Découverte, gratuite et sans limite de durée",
    text: "Un compte gratuit par parcours : 1 marque, 5 questions suivies, 1 mesure par mois sur 3 IA. Inscription et connexion par lien magique, sans mot de passe.",
    href: "/tarifs",
  },
  {
    id: "v3-partage",
    date: "2026-11-09",
    version: "V3",
    tag: "Nouveau",
    title: "Exports, liens de partage, Slack et webhook",
    text: "Exports CSV de chaque vue, lien de partage public révocable avec expiration, rapports planifiés par e-mail, alertes dans Slack et webhook signé.",
    href: "/fonctionnalites/rapports-et-partage",
  },
  {
    id: "v3-demo",
    date: "2026-11-09",
    version: "V3",
    tag: "Nouveau",
    title: "Démos animées et page de démo",
    text: "Les quatre temps du produit (mesurer, comprendre, agir, prouver) en courtes démos qui se mettent en pause, avec transcription. Trois comptes démo ouverts sans inscription.",
    href: "/demo",
  },
  {
    id: "v3-fonctionnalites",
    date: "2026-11-09",
    version: "V3",
    tag: "Amélioré",
    title: "Pages fonctionnalités, sécurité, intégrations, aide",
    text: "Une page par fonction avec ses limites écrites en clair, un centre d'aide, la liste des intégrations avec leur état réel et une page sur la protection de vos données.",
    href: "/fonctionnalites",
  },
  {
    id: "v3-calculateur",
    date: "2026-11-09",
    version: "V3",
    tag: "Nouveau",
    title: "Calculateur de rentabilité sur la page Tarifs",
    text: "Entrez la valeur d'un client et votre hypothèse : le calcul indique combien de clients couvrent l'offre. Aucune promesse de résultat.",
    href: "/tarifs#rentabilite",
  },
  // ---- V2 ----
  {
    id: "v2-parcours",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Trois parcours : commerce local, PME, e-commerce",
    text: "Des questions, des sources et des tâches propres à chaque activité, avec deux façons de travailler : Essentiel (actions prêtes) et Accompagné (travail fait pour vous).",
    href: "/tarifs",
  },
  {
    id: "v2-sources",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Les sources citées par les IA",
    text: "Les sites que lisent les IA pour répondre, classés par type et par opportunité, avec votre présence ou votre absence sur chacun.",
    href: "/fonctionnalites/comprendre#sources",
  },
  {
    id: "v2-verite",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Fiche de vérité et alertes d'erreur",
    text: "Vos informations exactes comparées aux réponses des IA, avec une alerte quand une IA se trompe sur vos coordonnées, vos prix ou vos services.",
    href: "/fonctionnalites/comprendre#verite",
  },
  {
    id: "v2-execution",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Tâches avec livrables",
    text: "12 à 15 tâches avec leur livrable : textes de fiche, balisage JSON-LD servi, plugin WordPress, page FAQ hébergée, kit d'avis, réponses aux avis.",
    href: "/fonctionnalites/agir",
  },
  {
    id: "v2-trafic",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Trafic venu des IA, sans cookie",
    text: "Un script léger, sans cookie, qui reconnaît les visites venues de ChatGPT, Perplexity, Gemini ou Copilot et les passages des robots des IA.",
    href: "/fonctionnalites/prouver#trafic",
  },
  {
    id: "v2-lundi",
    date: "2026-11-09",
    version: "V2",
    tag: "Nouveau",
    title: "Le résumé du lundi et le copilote",
    text: "Chaque lundi, ce qui a bougé et trois actions prêtes. Le copilote répond à vos questions à partir des données de votre compte.",
    href: "/fonctionnalites/copilote",
  },
  // ---- V1 ----
  {
    id: "v1-audit",
    date: "2026-11-09",
    version: "V1",
    tag: "Nouveau",
    title: "Premier audit de visibilité dans les IA",
    text: "Un score sur 100 pour un commerce local, mesuré sur ChatGPT, Perplexity et Gemini, avec les concurrents cités à sa place et un rapport par e-mail.",
    href: "/audit",
  },
];

/** Prévu, sans date promise. */
export const UPCOMING: readonly { title: string; text: string }[] = [
  { title: "Visite guidée du compte démo", text: "Une visite pas à pas des écrans, directement dans l'application." },
  { title: "Outils gratuits", text: "Robots des IA, citabilité d'une page, générateur JSON-LD, lien d'avis Google et d'autres, sans inscription." },
  { title: "Mistral (Le Chat)", text: "Une cinquième IA suivie, en option." },
  { title: "Connecteur Shopify", text: "Les ventes venues des IA lues directement dans votre boutique." },
  { title: "Offre agence", text: "Marque blanche et exécution à prix revendeur ; liste d'attente ouverte." },
];

export function sortedChangelog(entries: readonly ChangeEntry[] = CHANGELOG): ChangeEntry[] {
  const order = { V3: 3, V2: 2, V1: 1 } as const;
  return [...entries].sort((a, b) => (a.date === b.date ? order[b.version] - order[a.version] : a.date < b.date ? 1 : -1));
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function frDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Flux RSS 2.0 du journal. `site` = URL absolue du site sans barre finale. */
export function changelogRss(site: string, entries: readonly ChangeEntry[] = CHANGELOG): string {
  const items = sortedChangelog(entries)
    .map((e) => {
      const link = e.href ? `${site}${e.href}` : `${site}/nouveautes#${e.id}`;
      return `<item><title>${esc(`${e.version} : ${e.title}`)}</title><link>${esc(link)}</link><guid isPermaLink="false">${esc(e.id)}</guid><pubDate>${new Date(`${e.date}T12:00:00Z`).toUTCString()}</pubDate><category>${esc(e.tag)}</category><description>${esc(e.text)}</description></item>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Nouveautés de Repéré</title><link>${esc(site)}/nouveautes</link><description>Ce qui change dans Repéré, le référencement IA des entreprises françaises.</description><language>fr-FR</language>${items}</channel></rss>`;
}
