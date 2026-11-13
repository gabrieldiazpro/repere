/**
 * Adaptateur local SITE : grille V2 (docs/v2/07-plans-v2.json).
 *
 * Lit d'abord '@/lib/plans' (propriété de l'agent RETENTION). Si les plans exportés n'ont pas encore les champs
 * `segment` (grille V1), on retombe sur la copie de 07-plans-v2.json ci-dessous. Dès que '@/lib/plans' expose la
 * grille V2, c'est elle qui est affichée, sans toucher à ce fichier.
 */
import * as planLib from "@/lib/plans";

export type SiteSegment = "local" | "pme" | "ecommerce" | "agence";
export type SiteInterval = "one_time" | "month" | "year";

export interface SitePlan {
  id: string;
  segment: SiteSegment;
  name: string;
  priceCents: number;
  interval: SiteInterval;
  features: string[];
  highlighted: boolean;
  cta: string;
  /** false = liste d'attente (Agence tant que la marque blanche n'est pas livrée). */
  available: boolean;
}

type RawPlan = {
  id: string;
  segment?: string;
  name: string;
  priceCents: number;
  interval: string;
  features: readonly string[];
  highlighted?: boolean;
  cta: string;
  available?: boolean;
};

/* Copie de docs/v2/07-plans-v2.json (09/11/2026). */
const FALLBACK: RawPlan[] = [
  {"id":"local_audit_free","segment":"local","name":"Test gratuit","priceCents":0,"interval":"one_time","features":["Score de visibilité IA /100","Test sur ChatGPT, Gemini et Perplexity","Les concurrents cités à votre place","Un premier conseil détaillé","Rapport PDF par e-mail"],"highlighted":false,"cta":"Tester mon commerce gratuitement"},
  {"id":"local_audit_deep","segment":"local","name":"Audit + plan d'action","priceCents":14900,"interval":"one_time","features":["10 à 15 actions classées par priorité","Textes prêts à copier (fiche Google, site, réponses aux avis)","Les sources locales que lisent les IA (annuaires, guides, avis)","Livré sous 48 h","Déduit de l'Accompagné si souscrit sous 30 jours","Remboursé sous 14 jours si non satisfait"],"highlighted":false,"cta":"Obtenir mon plan d'action"},
  {"id":"local_essentiel_month","segment":"local","name":"Essentiel","priceCents":2900,"interval":"month","features":["20 questions clients suivies chaque mois","3 IA : ChatGPT, Gemini, Perplexity","3 concurrents suivis","Sources citées et opportunités classées","Actions de la semaine avec textes prêts à copier","Alerte si un concurrent vous dépasse","Sans engagement, résiliable en 1 clic"],"highlighted":false,"cta":"Commencer"},
  {"id":"local_essentiel_year","segment":"local","name":"Essentiel annuel","priceCents":29000,"interval":"year","features":["Tout Essentiel","2 mois offerts (290 € au lieu de 348 €)"],"highlighted":false,"cta":"Choisir l'annuel"},
  {"id":"local_accompagne_month","segment":"local","name":"Accompagné","priceCents":9900,"interval":"month","features":["Tout Essentiel, 30 questions suivies","Fiches Google, Bing et Apple complétées et tenues à jour par nous","Réponses à vos avis rédigées (jusqu'à 30/mois)","Une campagne de demande d'avis à vos vrais clients chaque mois","2 fiches d'annuaire créées ou corrigées par mois","Rapport mensuel avant/après","Rien n'est publié sans votre validation","3 mois minimum, puis sans engagement"],"highlighted":true,"cta":"Être accompagné"},
  {"id":"local_reseau_month","segment":"local","name":"Réseau","priceCents":7900,"interval":"month","features":["Jusqu'à 5 établissements en Essentiel","5 concurrents suivis par établissement","Tableau de bord multi-établissements","Accompagné : +69 €/mois par établissement supplémentaire"],"highlighted":false,"cta":"Choisir Réseau"},
  {"id":"local_reseau_year","segment":"local","name":"Réseau annuel","priceCents":79000,"interval":"year","features":["Tout Réseau","2 mois offerts (790 € au lieu de 948 €)"],"highlighted":false,"cta":"Réseau en annuel"},

  {"id":"pme_audit_free","segment":"pme","name":"Test gratuit","priceCents":0,"interval":"one_time","features":["10 questions d'acheteurs de votre secteur","3 IA : ChatGPT, Gemini, Perplexity","3 concurrents cités à votre place","Les 5 sources les plus citées et votre présence","Résultat par e-mail"],"highlighted":false,"cta":"Tester mon entreprise gratuitement"},
  {"id":"pme_audit_deep","segment":"pme","name":"Audit approfondi","priceCents":39000,"interval":"one_time","features":["50 questions, 3 IA, plusieurs passages","Part de voix face à 5 concurrents","Toutes les sources citées, avec votre présence ou absence","Analyse « pourquoi eux » : avis, sources, contenu, données structurées","Vérification technique : robots IA, schema.org, llms.txt","Plan d'action sur 90 jours et restitution visio de 45 min","Livré sous 5 jours ouvrés","Déduit du premier mois d'Accompagné si souscrit sous 30 jours"],"highlighted":false,"cta":"Commander l'audit approfondi"},
  {"id":"pme_essentiel_month","segment":"pme","name":"Essentiel","priceCents":9900,"interval":"month","features":["50 questions suivies chaque semaine","4 IA : ChatGPT, Gemini, Perplexity, Claude","5 concurrents, part de voix et sentiment","Cartographie des sources classée par opportunité","Actions de la semaine prêtes à faire (pages, FAQ, balisage)","Trafic venu des IA via Google Analytics","Rapport mensuel exportable","Sans engagement"],"highlighted":false,"cta":"Commencer"},
  {"id":"pme_essentiel_year","segment":"pme","name":"Essentiel annuel","priceCents":99000,"interval":"year","features":["Tout Essentiel","2 mois offerts (990 € au lieu de 1 188 €)"],"highlighted":false,"cta":"Choisir l'annuel"},
  {"id":"pme_accompagne_month","segment":"pme","name":"Accompagné","priceCents":49000,"interval":"month","features":["Tout Essentiel, 100 questions suivies","Mise en place faite : schema.org, llms.txt, robots IA, pages services","2 pages citables rédigées par mois (comparatif, alternative, FAQ métier)","3 fiches comparateurs ou annuaires B2B par mois","3 démarches vers les sources citées par les IA","Rapport mensuel et point visio de 30 min","Rien n'est publié sans votre validation","3 mois minimum, puis sans engagement"],"highlighted":true,"cta":"Être accompagné"},

  {"id":"ecom_audit_free","segment":"ecommerce","name":"Test gratuit","priceCents":0,"interval":"one_time","features":["10 requêtes produit testées","3 IA : ChatGPT, Gemini, Perplexity","Marques citées à la place des vôtres","5 sources citées (comparatifs, forums, marketplaces)","Résultat par e-mail"],"highlighted":false,"cta":"Tester ma boutique gratuitement"},
  {"id":"ecom_audit_deep","segment":"ecommerce","name":"Audit catalogue approfondi","priceCents":39000,"interval":"one_time","features":["50 requêtes produit, 3 IA, plusieurs passages","Part de voix face à 5 marques concurrentes","Toutes les sources citées, avec votre présence ou absence","Audit du balisage Product, du flux Merchant et des fiches","Plan d'action sur 90 jours et restitution visio de 45 min","Déduit du premier mois d'Accompagné si souscrit sous 30 jours"],"highlighted":false,"cta":"Commander l'audit catalogue"},
  {"id":"ecom_essentiel_month","segment":"ecommerce","name":"Essentiel","priceCents":7900,"interval":"month","features":["50 requêtes produit suivies chaque semaine","5 marques concurrentes suivies","Sources citées : comparatifs, Reddit, marketplaces","Fiches produit et balisage prêts à copier","Trafic venu des IA via GA4 ou Shopify","Alertes quand un concurrent apparaît","Sans engagement"],"highlighted":false,"cta":"Commencer"},
  {"id":"ecom_essentiel_year","segment":"ecommerce","name":"Essentiel annuel","priceCents":79000,"interval":"year","features":["Tout Essentiel","2 mois offerts (790 € au lieu de 948 €)"],"highlighted":false,"cta":"Choisir l'annuel"},
  {"id":"ecom_accompagne_month","segment":"ecommerce","name":"Accompagné","priceCents":39000,"interval":"month","features":["Tout Essentiel, 100 requêtes produit suivies","Mise en place faite : balisage Product/Offer/Review/FAQ, llms.txt, flux Merchant vérifié","20 fiches produit réécrites par mois","1 guide d'achat ou comparatif par mois","3 démarches vers les comparatifs et sources citées","Rapport mensuel (trafic et ventes IA si disponibles) et visio de 30 min","Rien n'est publié sans votre validation","3 mois minimum, puis sans engagement"],"highlighted":true,"cta":"Être accompagné"},

  {"id":"agency_partner","segment":"agence","name":"Partenaire","priceCents":0,"interval":"one_time","features":["Lien partenaire personnel","30 % de commission pendant 12 mois sur chaque client apporté","Sans abonnement"],"highlighted":false,"cta":"Devenir partenaire"},
  {"id":"agency_month","segment":"agence","name":"Agence","priceCents":14900,"interval":"month","features":["20 clients en Essentiel (tous parcours), +6 €/mois par client supplémentaire","Marque blanche : votre logo, vos couleurs, votre domaine de rapport","Tests gratuits illimités pour vos prospects","Audits approfondis à prix revendeur (Local 99 €, PME et e-commerce 250 €)","Accès équipe et export des données"],"highlighted":true,"cta":"Ouvrir un compte agence"},
  {"id":"agency_year","segment":"agence","name":"Agence annuel","priceCents":149000,"interval":"year","features":["Tout le plan Agence","2 mois offerts (1 490 € au lieu de 1 788 €)"],"highlighted":false,"cta":"Agence en annuel"},
  {"id":"agency_exec_local","segment":"agence","name":"Exécution marque blanche — Local","priceCents":5900,"interval":"month","features":["Accompagné Local exécuté par nous, sous votre marque","Par client et par mois","Vous gardez la relation et fixez votre prix"],"highlighted":false,"cta":"Nous contacter"},
  {"id":"agency_exec_ecommerce","segment":"agence","name":"Exécution marque blanche — E-commerce","priceCents":23000,"interval":"month","features":["Accompagné E-commerce exécuté par nous, sous votre marque","Par client et par mois","Vous gardez la relation et fixez votre prix"],"highlighted":false,"cta":"Nous contacter"},
  {"id":"agency_exec_pme","segment":"agence","name":"Exécution marque blanche — PME","priceCents":29000,"interval":"month","features":["Accompagné PME exécuté par nous, sous votre marque","Par client et par mois","Vous gardez la relation et fixez votre prix"],"highlighted":false,"cta":"Nous contacter"},
];

function normSegment(s: string | undefined): SiteSegment | null {
  if (s === "local" || s === "pme" || s === "ecommerce") return s;
  if (s === "agence" || s === "agency") return "agence";
  if (s === "e-commerce") return "ecommerce";
  return null;
}

/** Typographie française : espaces insécables avant « : ; ? ! » et à l'intérieur des guillemets. */
export function frTypo(t: string): string {
  return t
    .replace(/«\s+/g, "«\u00A0")
    .replace(/\s+»/g, "\u00A0»")
    .replace(/\s+([:;?!])/g, "\u00A0$1")
    .replace(/(\d)\s+(€|%)/g, "$1\u00A0$2");
}

function normalize(p: RawPlan): SitePlan | null {
  const segment = normSegment(p.segment);
  if (!segment) return null;
  const interval: SiteInterval = p.interval === "month" || p.interval === "year" ? p.interval : "one_time";
  return {
    id: p.id,
    segment,
    name: frTypo(p.name),
    priceCents: p.priceCents,
    interval,
    features: p.features.map(frTypo),
    highlighted: !!p.highlighted,
    cta: p.cta,
    // Décision orchestrateur : Agence en liste d'attente tant que la marque blanche n'est pas livrée.
    available: typeof p.available === "boolean" ? p.available : segment !== "agence",
  };
}

const libPlans = ((planLib as { PLANS?: readonly RawPlan[] }).PLANS ?? []) as readonly RawPlan[];
const libIsV2 = libPlans.some((p) => normSegment(p.segment) !== null);

/** Source utilisée : 'lib' quand '@/lib/plans' expose la grille V2, sinon 'fallback'. */
export const PLANS_SOURCE: "lib" | "fallback" = libIsV2 ? "lib" : "fallback";

export const SITE_PLANS: readonly SitePlan[] = (libIsV2 ? libPlans : FALLBACK)
  .map(normalize)
  .filter((p): p is SitePlan => p !== null);

export const VAT_NOTICE: string =
  (planLib as { VAT_NOTICE?: string }).VAT_NOTICE ?? "TVA non applicable, art. 293 B du CGI";

export function plansFor(segment: SiteSegment): SitePlan[] {
  return SITE_PLANS.filter((p) => p.segment === segment);
}

export function findSitePlan(id: string | undefined | null): SitePlan | undefined {
  if (!id) return undefined;
  return SITE_PLANS.find((p) => p.id === id);
}

/** Les 4 paliers affichés par parcours (test, audit approfondi, Essentiel mensuel/annuel, Accompagné). */
export function tiersFor(segment: Exclude<SiteSegment, "agence">) {
  const list = plansFor(segment);
  const pick = (re: RegExp) => list.find((p) => re.test(p.id));
  return {
    free: pick(/_audit_free$/),
    deep: pick(/_audit_deep$/),
    essentielMonth: pick(/_essentiel_month$/),
    essentielYear: pick(/_essentiel_year$/),
    accompagne: pick(/_accompagne_month$/),
    reseauMonth: pick(/_reseau_month$/),
    reseauYear: pick(/_reseau_year$/),
  };
}

/** Prix d'appel d'un parcours (Essentiel mensuel). */
export function fromPrice(segment: Exclude<SiteSegment, "agence">): number | undefined {
  return tiersFor(segment).essentielMonth?.priceCents;
}

const eur = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** « 1 490 € » avec espaces insécables. */
export function euros(cents: number): string {
  return `${eur.format(cents / 100)} €`.replace(/ | /g, " ");
}

/** Lien de commande : le parcours /audit reçoit le segment et l'offre. */
export function planLink(p: SitePlan): string {
  const seg = p.segment === "agence" ? "" : `segment=${p.segment}`;
  if (p.priceCents === 0) return `/audit${seg ? `?${seg}` : ""}`;
  return `/audit?${seg ? `${seg}&` : ""}plan=${encodeURIComponent(p.id)}`;
}
