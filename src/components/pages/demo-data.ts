/** Comptes démo (lecture seule côté serveur) et liens vers la visite guidée de l'app. Questions et volumes lus dans les comptes. */
import { demoMeasure } from "@/components/site/demo-figures";

const q = (seg: "local" | "pme" | "ecommerce") => `«\u00a0${demoMeasure(seg).question.text.replace(/\s*\?$/, "\u00a0?")}\u00a0»`;
const rivals = (seg: "local" | "pme" | "ecommerce") => demoMeasure(seg).of - 1;
export type DemoAccount = {
  id: "demo" | "demo-pme" | "demo-ecom";
  segment: "local" | "pme" | "ecommerce";
  name: string;
  activity: string;
  text: string;
  question: string;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    id: "demo",
    segment: "local",
    name: "Plomberie Martin",
    activity: "Artisan plombier, Paris 11e",
    text: "Fiche Google, avis, annuaires et visibilité par quartier. Gemini y donne de mauvais horaires.",
    question: q("local"),
  },
  {
    id: "demo-pme",
    segment: "pme",
    name: "Paysia",
    activity: "Logiciel de paie pour PME, Lyon",
    text: `Part de voix face à ${rivals("pme")} concurrents, sources B2B, pages comparatives à publier.`,
    question: q("pme"),
  },
  {
    id: "demo-ecom",
    segment: "ecommerce",
    name: "Maison Sora",
    activity: "Cosmétiques solides, boutique Shopify",
    text: "Produits suivis, revendeurs cités à sa place, visites et ventes venues des IA.",
    question: q("ecommerce"),
  },
];

/** Lien vers l'app en compte démo, visite guidée activée. */
export function demoAppHref(a: Pick<DemoAccount, "id" | "segment">): string {
  return `/app?compte=${a.id}&visite=1&segment=${a.segment}`;
}

export const DEMO_CLIPS = [
  { id: "mesurer", pillar: "mesurer", title: "Mesurer", text: "Une question suivie, trois IA, la part de voix face aux concurrents." },
  { id: "comprendre", pillar: "comprendre", title: "Comprendre", text: "Les sources que lisent les IA et pourquoi un concurrent passe devant." },
  { id: "agir", pillar: "agir", title: "Agir", text: "Une tâche préparée, son texte prêt à copier, la validation en un clic." },
  { id: "prouver", pillar: "prouver", title: "Prouver", text: "Les visites et commandes venues des IA sur 30 jours, la courbe sur 12 semaines, puis le rapport du mois." },
] as const;
