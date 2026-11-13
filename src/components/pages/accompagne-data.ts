/**
 * « Avant de prendre Accompagné » (qa/v3/regard-client-v3.md, amélioration 15) : ce que l'on peut vérifier soi-même,
 * le déroulé du premier mois et ce que le client valide. Règle absolue : aucun client, avis, logo ni chiffre de
 * résultat inventé. Les livrables montrés sont soit ceux de Repéré appliqués à lui-même (réels), soit ceux des
 * comptes démo (entreprises fictives, étiquetées comme telles). Le contenu mensuel vient de la grille (src/lib/plans.ts).
 */
import { ACCOMPAGNE_COMMITMENT_MONTHS, getPlan, type PlanId } from "@/lib/plans";
import { enginesLabel, frequencyAdverb, promptsCount } from "@/components/site/offer-facts";

export type AccSeg = "local" | "pme" | "ecommerce";

export interface DeliverableExample {
  title: string;
  what: string;
  href: string;
  /** « réel » : Repéré appliqué à lui-même ; « démo » : compte démo, entreprise fictive. */
  kind: "reel" | "demo";
  /** lien vers un fichier brut (JSON-LD, texte) plutôt qu'une page */
  raw?: boolean;
}

const PLAN: Record<AccSeg, PlanId> = {
  local: "local_accompagne_month",
  pme: "pme_accompagne_month",
  ecommerce: "ecom_accompagne_month",
};

const DEMO_NAME: Record<AccSeg, string> = { local: "Plomberie Martin", pme: "Paysia", ecommerce: "Maison Sora" };
const DEMO_SLUG: Record<AccSeg, string> = { local: "plomberie-martin", pme: "paysia", ecommerce: "maison-sora" };
const DEMO_ID: Record<AccSeg, string> = { local: "demo", pme: "demo-pme", ecommerce: "demo-ecom" };

/** Ce que l'offre Accompagné comprend, mot pour mot depuis la grille (hors lignes génériques). */
export function accompagneFeatures(seg: AccSeg): string[] {
  return getPlan(PLAN[seg]).features.filter((f) => !/^Tout Essentiel|minimum|validation|^\d IA/.test(f));
}

export function deliverableExamples(seg: AccSeg): DeliverableExample[] {
  const demo = DEMO_NAME[seg];
  const own: DeliverableExample[] = [
    {
      title: "Page officielle et questions fréquentes de Repéré",
      what: "La page de faits vérifiés que nous publions pour vous, ici faite pour nous-mêmes : informations établies uniquement, sans case vide.",
      href: "/p/repere",
      kind: "reel",
    },
    {
      title: "Balisage schema.org de Repéré",
      what: "Le JSON-LD servi par Repéré et lu par les robots, tel que nous le livrons en Accompagné.",
      href: "/api/schema/repere?format=json",
      kind: "reel",
      raw: true,
    },
    {
      title: "Fichier llms.txt de Repéré",
      what: "Le résumé du site destiné aux IA, avec la mention honnête de son utilité réelle.",
      href: "/llms.txt",
      kind: "reel",
      raw: true,
    },
  ];
  const comparatif: DeliverableExample = {
    title: "Page comparative de Repéré face aux autres outils",
    what: "Une page citable du type que nous rédigeons en Accompagné PME : prix sourcés et datés, points forts des autres reconnus, « non vérifié » quand c'est le cas.",
    href: "/comparatif",
    kind: "reel",
  };
  const demoPage: DeliverableExample = {
    title: `Page officielle de ${demo} (compte démo)`,
    what:
      seg === "local"
        ? "Fiche officielle d'un artisan : coordonnées, horaires, zone d'intervention et FAQ, à partir de sa fiche de vérité."
        : seg === "ecommerce"
          ? "Fiche officielle d'une marque : livraison, retours, labels, produits et FAQ, à partir de sa fiche de vérité."
          : "Présentation officielle d'un éditeur : offre, prix, clients cibles et FAQ, à partir de sa fiche de vérité.",
    href: `/p/${DEMO_SLUG[seg]}`,
    kind: "demo",
  };
  const demoSchema: DeliverableExample = {
    title: `Balisage schema.org de ${demo} (compte démo)`,
    what: seg === "ecommerce" ? "Organisation, produits et offres balisés." : seg === "local" ? "Balisage d'artisan (Plumber) avec horaires et zone." : "Balisage Organization et logiciel.",
    href: `/api/schema/${DEMO_ID[seg]}?format=json`,
    kind: "demo",
    raw: true,
  };
  const demoActions: DeliverableExample = {
    title: `Centre d'actions de ${demo} (compte démo)`,
    what:
      seg === "local"
        ? "Les textes livrés : fiche Google, réponses aux avis, demande d'avis, étapes d'inscription aux annuaires."
        : seg === "ecommerce"
          ? "Les textes livrés : fiches produit, e-mails aux auteurs de comparatifs, demande d'avis."
          : "Les textes livrés : page comparative, FAQ métier, fiches comparateurs, point pour votre comité.",
    href: `/app?visite=1&segment=${seg}`,
    kind: "demo",
  };
  return seg === "pme" ? [comparatif, ...own, demoActions, demoSchema] : [demoPage, demoActions, demoSchema, ...own];
}

export interface MonthStep {
  when: string;
  title: string;
  us: string;
  you: string;
}

const SETUP: Record<AccSeg, string> = {
  local: "nous complétons vos fiches Google, Bing et Apple (horaires, services, zone, photos que vous nous fournissez) et corrigeons les annuaires où vous êtes mal renseigné",
  pme: "nous mettons en place le balisage schema.org, le fichier llms.txt, les règles des robots d'IA et les pages services manquantes",
  ecommerce: "nous mettons en place le balisage Product, Offer, Review et FAQ, le fichier llms.txt, et vérifions votre flux Merchant",
};

const MONTHLY: Record<AccSeg, string> = {
  local: "réponses à vos avis (jusqu'à 30), une campagne de demande d'avis à vos vrais clients, 2 fiches d'annuaire créées ou corrigées",
  pme: "2 pages citables (comparatif, alternative, FAQ métier), 3 fiches comparateurs ou annuaires B2B, 3 démarches vers les sources citées par les IA",
  ecommerce: "20 fiches produit réécrites, 1 guide d'achat ou comparatif, 3 démarches vers les comparatifs et sources citées",
};

export function firstMonth(seg: AccSeg): MonthStep[] {
  const visio = seg === "local" ? "" : " et un point visio de 30 minutes";
  return [
    {
      when: "Jours 1 et 2",
      title: "Prise de contact",
      us: "Nous vous écrivons sous 2 jours ouvrés et listons les accès utiles (fiche Google, site, outil de boutique ou d'analyse).",
      you: "Vous choisissez ce que vous partagez. Un accès refusé n'empêche pas le reste : nous vous préparons alors le texte à coller.",
    },
    {
      when: "Semaine 1",
      title: "Fiche de vérité et questions suivies",
      us: `Nous préremplissons votre fiche de vérité (coordonnées, prix, services) et proposons ${promptsCount(seg, "accompagne")} questions suivies, posées ${frequencyAdverb(seg, "accompagne")} à ${enginesLabel(seg, "accompagne")}. Première mesure : votre point de départ.`,
      you: "Vous corrigez et validez la fiche de vérité et la liste des questions. Rien n'est mesuré sur une question que vous n'avez pas acceptée.",
    },
    {
      when: "Semaines 2 et 3",
      title: "Mise en place",
      us: `D'abord ce qui corrige les erreurs des IA sur vous, puis ${SETUP[seg]}.`,
      you: "Chaque modification vous est soumise avant publication : vous validez, modifiez ou refusez en un clic, depuis votre téléphone si vous voulez.",
    },
    {
      when: "Semaines 3 et 4",
      title: "Livrables du mois",
      us: `Nous produisons les livrables mensuels de l'offre : ${MONTHLY[seg]}.`,
      you: "Vous relisez chaque texte. Tout message envoyé en votre nom (demande d'avis, e-mail à un site tiers) part seulement après votre accord, à la liste de destinataires que vous avez validée.",
    },
    {
      when: "Fin du mois",
      title: "Rapport avant / après",
      us: `Rapport mensuel${visio} : ce qui a été fait, ce qui est en attente de votre validation, et la mesure comparée au point de départ, avec sa marge d'erreur.`,
      you: "Vous vérifiez la liste des livrables faits. Si un livrable listé dans votre offre manque de notre fait, le mois suivant ne vous est pas facturé.",
    },
  ];
}

export const YOU_VALIDATE: string[] = [
  "La fiche de vérité : les faits que nous défendrons auprès des IA",
  "La liste des questions suivies et des concurrents",
  "Chaque texte avant publication : fiche, page, réponse à un avis, fiche produit",
  "Chaque message envoyé en votre nom, et à qui il part",
  "Les accès que vous nous donnez, révocables à tout moment",
];

export const WE_NEVER: string[] = [
  "Publier quoi que ce soit sans votre accord",
  "Écrire ou acheter de faux avis, ou poster sous un faux nom sur un forum",
  "Vous promettre une position dans une IA",
];

export const COMMITMENT_MONTHS = ACCOMPAGNE_COMMITMENT_MONTHS;
