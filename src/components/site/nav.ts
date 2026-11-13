/**
 * Données de navigation partagées (header, menu mobile, footer). Aucune dépendance client.
 * Règle : ne lier que des pages qui existent ou qui sont prévues au contrat V3 (docs/v3/12-CONTRATS-V3.md).
 */
import { GUIDES, guidePath } from "@/lib/seo/guides";
import { TOOLS as TOOL_REGISTRY, toolPath } from "@/components/tools/registry";
import { HELP_ARTICLES } from "@/components/pages/aide-data";

export type NavItem = { href: string; label: string; text?: string };
export type NavGroup = { id: string; label: string; items: readonly NavItem[]; wide?: boolean; footer?: NavItem };
export type LandingSegment = "local" | "pme" | "ecommerce";

export const PRODUCT: readonly NavItem[] = [
  { href: "/analyse", label: "Analyse gratuite en 60 s", text: "Votre site lu comme Google et les IA le lisent" },
  { href: "/fonctionnalites", label: "Toutes les fonctionnalités", text: "SEO, GEO, agent, mesure des IA" },
  { href: "/fonctionnalites/audit-seo", label: "Audit SEO", text: "Contrôles sourcés, 5 priorités" },
  { href: "/fonctionnalites/positions-et-search-console", label: "Positions et Search Console", text: "Ce que Google vous apporte" },
  { href: "/fonctionnalites/geo-avance", label: "GEO avancé", text: "Être lu, compris et cité par les IA" },
  { href: "/fonctionnalites/agent-de-publication", label: "Agent de publication", text: "Corrections appliquées, avec votre accord" },
  { href: "/demo", label: "Voir la démo", text: "Vidéos et compte démo, sans inscription" },
  { href: "/fonctionnalites/mesurer", label: "Mesurer", text: "Ce que répondent les IA à vos questions" },
  { href: "/fonctionnalites/comprendre", label: "Comprendre", text: "Sources, erreurs, concurrents devant vous" },
  { href: "/fonctionnalites/agir", label: "Agir", text: "Tâches prêtes ou faites pour vous" },
  { href: "/fonctionnalites/prouver", label: "Prouver", text: "Visites et ventes venues des IA" },
  { href: "/integrations", label: "Intégrations", text: "WordPress, Shopify, Search Console, GA4" },
  { href: "/nouveautes", label: "Nouveautés", text: "Ce qui change, daté" },
  { href: "/securite", label: "Sécurité", text: "Vos données et notre robot" },
];

export const SOLUTIONS: readonly NavItem[] = [
  { href: "/local", label: "Commerce local", text: "SEO local et IA : artisans, restaurants, instituts" },
  { href: "/pme", label: "PME et services B2B", text: "SEO B2B et IA : SaaS, cabinets, industrie" },
  { href: "/e-commerce", label: "E-commerce", text: "Fiches produit, facettes, Shopping, IA" },
  { href: "/tarifs?segment=agence", label: "Agences", text: "Marque blanche et partenariat" },
  { href: "/cas-usage", label: "Cas d'usage par métier", text: "Plombiers, restaurants, SaaS, cosmétiques…" },
];

/** Outils gratuits : calculés depuis le registre de l'agent OUTILS (jamais de slug écrit à la main). */
export const TOOLS: readonly NavItem[] = TOOL_REGISTRY.map((t) => ({ href: toolPath(t.slug), label: t.name, text: t.output }));

export const RESOURCES: readonly NavItem[] = [
  { href: "/guides", label: "Guides pratiques", text: "SEO + GEO, SEO local, Search Console, IA" },
  { href: "/aide", label: "Centre d'aide", text: `Bien utiliser Repéré, en ${HELP_ARTICLES.length} réponses` },
  { href: "/questions", label: "Questions fréquentes", text: "Des réponses franches sur le référencement IA" },
  { href: "/geo", label: "Le GEO", text: "Définition et leviers, sources à l'appui" },
  { href: "/methode", label: "Méthode", text: "Contrôles SEO, règles GEO, marges d'erreur" },
  { href: "/comparatif", label: "Comparatif", text: "Semrush, Ahrefs, Peec, Otterly, agences" },
  { href: "/etudes", label: "Études et baromètre", text: "Ce que disent les données publiques" },
  { href: "/glossaire", label: "Glossaire", text: "Les termes du GEO expliqués simplement" },
  { href: "/visibilite-ia", label: "Visibilité IA par métier", text: "Questions et sources par activité" },
  { href: "/a-propos", label: "À propos", text: "Qui nous sommes, nos engagements" },
];

/** Menus déroulants du header, dans l'ordre. Tarifs est un lien simple placé entre Outils et Ressources. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { id: "produit", label: "Produit", items: PRODUCT, wide: true },
  { id: "solutions", label: "Solutions", items: SOLUTIONS },
  { id: "outils", label: "Outils gratuits", items: TOOLS, wide: true, footer: { href: "/outils", label: "Tous les outils gratuits" } },
];

export const PRIMARY_LINKS: readonly NavItem[] = [{ href: "/tarifs", label: "Tarifs" }];

export const RESOURCES_GROUP: NavGroup = { id: "ressources", label: "Ressources", items: RESOURCES, wide: true };

export const GUIDE_LINKS: readonly NavItem[] = GUIDES.map((g) => ({ href: guidePath(g), label: g.title }));

export { LOGIN_HREF, DEMO_HREF } from "./nav-links";

export function auditHrefFor(segment?: LandingSegment) {
  return segment ? `/audit?segment=${segment}` : "/audit";
}

/** V5 : l'appel principal du site est l'analyse gratuite du site, sur le bon parcours quand on le connaît. */
export function analyseHrefFor(segment?: LandingSegment) {
  return segment ? `/analyse?segment=${segment}` : "/analyse";
}

/** « Essai gratuit » : inscription à l'offre Découverte, sur le bon parcours quand on le connaît. */
export function signupHrefFor(segment?: LandingSegment) {
  return segment ? `/inscription?parcours=${segment}` : "/inscription";
}

/** Colonnes du pied de page : toutes les pages publiques. */
export const FOOTER_COLUMNS: readonly { title: string; links: readonly NavItem[] }[] = [
  {
    title: "Produit",
    links: [
      { href: "/fonctionnalites", label: "Fonctionnalités" },
      { href: "/demo", label: "Démo" },
      { href: "/tarifs", label: "Tarifs" },
      { href: "/integrations", label: "Intégrations" },
      { href: "/nouveautes", label: "Nouveautés" },
      { href: "/securite", label: "Sécurité" },
      { href: "/analyse", label: "Analyse gratuite du site" },
      { href: "/audit", label: "Test de visibilité IA" },
      { href: "/inscription", label: "Créer un compte gratuit" },
    ],
  },
  {
    title: "Solutions",
    links: [...SOLUTIONS.map(({ href, label }) => ({ href, label })), { href: "/parrainage", label: "Parrainage" }],
  },
  {
    title: "Outils gratuits",
    links: [
      { href: "/outils", label: "Tous les outils" },
      ...TOOLS.map(({ href, label }) => ({ href, label })),
      { href: "/badge", label: "Badge à intégrer" },
      { href: "/classement", label: "Classement public" },
    ],
  },
  {
    title: "Ressources",
    links: [
      ...RESOURCES.filter((r) => r.href !== "/a-propos").map(({ href, label }) => ({ href, label })),
      { href: "/methode/robot", label: "Notre robot" },
    ],
  },
  {
    title: "Guides",
    links: [...GUIDE_LINKS, { href: "/guides", label: "Tous les guides" }],
  },
];
