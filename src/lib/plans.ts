/**
 * Offres commerciales V2 — copie typée de docs/v2/07-plans-v2.json (source de vérité).
 * Toute modification de prix doit être faite ici ET dans Stripe (price id : STRIPE_PRICE_<PLANID>).
 *
 * Les offres V1 (audit_free, action_plan, suivi_*, bundle_start, pro_*) restent déclarées en `legacy`
 * pour les abonnés existants, les liens déjà envoyés et les pages pas encore migrées. Elles ne sont plus
 * proposées dans la grille V2 (`plansForSegment`). Équivalences : `PLAN_ALIASES`.
 */

export type PlanSegment = 'local' | 'pme' | 'ecommerce' | 'agence';

/** Offres V1 conservées (abonnés existants, liens déjà envoyés). */
export type LegacyPlanId =
  | 'audit_free'
  | 'action_plan'
  | 'suivi_month'
  | 'suivi_year'
  | 'bundle_start'
  | 'pro_month'
  | 'pro_year';

export type PlanIdV2 =
  | 'local_audit_free'
  | 'local_audit_deep'
  | 'local_essentiel_month'
  | 'local_essentiel_year'
  | 'local_accompagne_month'
  | 'local_reseau_month'
  | 'local_reseau_year'
  | 'pme_audit_free'
  | 'pme_audit_deep'
  | 'pme_essentiel_month'
  | 'pme_essentiel_year'
  | 'pme_accompagne_month'
  | 'ecom_audit_free'
  | 'ecom_audit_deep'
  | 'ecom_essentiel_month'
  | 'ecom_essentiel_year'
  | 'ecom_accompagne_month'
  | 'agency_partner'
  | 'agency_month'
  | 'agency_year'
  | 'agency_exec_local'
  | 'agency_exec_ecommerce'
  | 'agency_exec_pme';

/** Offre gratuite permanente « Découverte », une par parcours (V3, décision 2 de docs/v3/12-CONTRATS-V3.md). */
export type DecouvertePlanId = 'local_decouverte' | 'pme_decouverte' | 'ecom_decouverte';

export type PlanId = LegacyPlanId | PlanIdV2 | DecouvertePlanId;

export type PlanInterval = 'one_time' | 'month' | 'year';

/** Niveau d'accès porté par `Business.plan` (suivi/pro : V1 ; essentiel/accompagne/reseau : V2). */
export type PlanTier = 'free' | 'suivi' | 'pro' | 'agency' | 'essentiel' | 'accompagne' | 'reseau';

export interface Plan {
  id: PlanId;
  segment: PlanSegment;
  name: string;
  priceCents: number;
  interval: PlanInterval;
  features: string[];
  highlighted: boolean;
  cta: string;
  /** false = offre annoncée mais pas encore achetable (liste d'attente, refusée par /api/checkout). */
  available: boolean;
  /** Offre V1 conservée pour compatibilité, absente de la grille V2. */
  legacy?: boolean;
  /** Engagement minimum en mois (Accompagné : 3). */
  commitmentMonths?: number;
  /** Garantie « remboursé sous N jours » (audits approfondis et plans d'action ponctuels uniquement). */
  guaranteeDays?: number;
}

/** Franchise en base de TVA (micro-entreprise). Si le seuil est dépassé, changer ce texte ici (et STRIPE_TAX_RATE_ID). */
export const VAT_NOTICE = 'TVA non applicable, art. 293 B du CGI';
/** Phrase courte à placer sous les prix. */
export const PRICE_NOTE = `Prix nets : ${VAT_NOTICE}.`;

/** Engagement minimum de l'Accompagné (docs/v2/08-CONTRATS-V2.md). */
export const ACCOMPAGNE_COMMITMENT_MONTHS = 3;

// ---------------------------------------------------------------------------
// Grille V2 (docs/v2/07-plans-v2.json)
// ---------------------------------------------------------------------------

export const V2_PLANS: readonly Plan[] = [
  // --- Local ---
  {
    id: 'local_audit_free', segment: 'local', name: 'Test gratuit', priceCents: 0, interval: 'one_time',
    features: ['Score de visibilité IA /100', 'Test sur ChatGPT, Gemini et Perplexity', 'Les concurrents cités à votre place', 'Un premier conseil détaillé', 'Rapport PDF par e-mail'],
    highlighted: false, cta: 'Tester mon commerce gratuitement', available: true,
  },
  {
    id: 'local_audit_deep', segment: 'local', name: "Audit + plan d'action", priceCents: 14900, interval: 'one_time',
    features: ['10 à 15 actions classées par priorité', 'Textes prêts à copier (fiche Google, site, réponses aux avis)', 'Les sources locales que lisent les IA (annuaires, guides, avis)', 'Livré sous 48 h', "Déduit de l'Accompagné si souscrit sous 30 jours", 'Remboursé sous 14 jours si non satisfait', "1 mois d'Essentiel offert, sans carte bancaire, puis retour automatique à Découverte"],
    highlighted: false, cta: "Obtenir mon plan d'action", available: true, guaranteeDays: 14,
  },
  {
    id: 'local_essentiel_month', segment: 'local', name: 'Essentiel', priceCents: 2900, interval: 'month',
    features: ['20 questions clients suivies chaque mois', '3 IA : ChatGPT, Gemini, Perplexity', '3 concurrents suivis', 'Sources citées et opportunités classées', 'Actions de la semaine avec textes prêts à copier', 'Alerte si un concurrent vous dépasse', 'Sans engagement, résiliable en 1 clic'],
    highlighted: false, cta: 'Commencer', available: true,
  },
  {
    id: 'local_essentiel_year', segment: 'local', name: 'Essentiel annuel', priceCents: 29000, interval: 'year',
    features: ['Tout Essentiel', '2 mois offerts (290 € au lieu de 348 €)'],
    highlighted: false, cta: "Choisir l'annuel", available: true,
  },
  {
    id: 'local_accompagne_month', segment: 'local', name: 'Accompagné', priceCents: 9900, interval: 'month',
    features: ['Tout Essentiel, 30 questions suivies', '4 IA : ChatGPT, Gemini, Perplexity, Claude', 'Fiches Google, Bing et Apple complétées et tenues à jour par nous', 'Réponses à vos avis rédigées (jusqu\'à 30/mois)', 'Une campagne de demande d\'avis à vos vrais clients chaque mois', '2 fiches d\'annuaire créées ou corrigées par mois', 'Rapport mensuel avant/après', 'Rien n\'est publié sans votre validation', '3 mois minimum, puis sans engagement'],
    highlighted: true, cta: 'Être accompagné', available: true, commitmentMonths: ACCOMPAGNE_COMMITMENT_MONTHS,
  },
  {
    id: 'local_reseau_month', segment: 'local', name: 'Réseau', priceCents: 7900, interval: 'month',
    features: ["Jusqu'à 5 établissements en Essentiel", '5 concurrents suivis par établissement', 'Tableau de bord multi-établissements', 'Accompagné : +69 €/mois par établissement supplémentaire'],
    highlighted: false, cta: 'Choisir Réseau', available: true,
  },
  {
    id: 'local_reseau_year', segment: 'local', name: 'Réseau annuel', priceCents: 79000, interval: 'year',
    features: ['Tout Réseau', '2 mois offerts (790 € au lieu de 948 €)'],
    highlighted: false, cta: 'Réseau en annuel', available: true,
  },
  // --- PME ---
  {
    id: 'pme_audit_free', segment: 'pme', name: 'Test gratuit', priceCents: 0, interval: 'one_time',
    features: ["10 questions d'acheteurs de votre secteur", '3 IA : ChatGPT, Gemini, Perplexity', '3 concurrents cités à votre place', 'Les 5 sources les plus citées et votre présence', 'Résultat par e-mail'],
    highlighted: false, cta: 'Tester mon entreprise gratuitement', available: true,
  },
  {
    id: 'pme_audit_deep', segment: 'pme', name: 'Audit approfondi', priceCents: 39000, interval: 'one_time',
    features: ['50 questions, 3 IA, plusieurs passages', 'Part de voix face à 5 concurrents', 'Toutes les sources citées, avec votre présence ou absence', 'Analyse « pourquoi eux » : avis, sources, contenu, données structurées', 'Vérification technique : robots IA, schema.org, llms.txt', 'Plan d\'action sur 90 jours et restitution visio de 45 min', 'Livré sous 5 jours ouvrés', 'Déduit du premier mois d\'Accompagné si souscrit sous 30 jours', "1 mois d'Essentiel offert, sans carte bancaire, puis retour automatique à Découverte"],
    highlighted: false, cta: "Commander l'audit approfondi", available: true, guaranteeDays: 14,
  },
  {
    id: 'pme_essentiel_month', segment: 'pme', name: 'Essentiel', priceCents: 9900, interval: 'month',
    features: ['50 questions suivies chaque semaine', '4 IA : ChatGPT, Gemini, Perplexity, Claude', '5 concurrents, part de voix et sentiment', 'Cartographie des sources classée par opportunité', 'Actions de la semaine prêtes à faire (pages, FAQ, balisage)', 'Trafic venu des IA via Google Analytics', 'Rapport mensuel exportable', 'Sans engagement'],
    highlighted: false, cta: 'Commencer', available: true,
  },
  {
    id: 'pme_essentiel_year', segment: 'pme', name: 'Essentiel annuel', priceCents: 99000, interval: 'year',
    features: ['Tout Essentiel', '2 mois offerts (990 € au lieu de 1 188 €)'],
    highlighted: false, cta: "Choisir l'annuel", available: true,
  },
  {
    id: 'pme_accompagne_month', segment: 'pme', name: 'Accompagné', priceCents: 49000, interval: 'month',
    features: ['Tout Essentiel, 100 questions suivies', '5 IA : ChatGPT, Gemini, Perplexity, Claude, Mistral', 'Mise en place faite : schema.org, llms.txt, robots IA, pages services', '2 pages citables rédigées par mois (comparatif, alternative, FAQ métier)', '3 fiches comparateurs ou annuaires B2B par mois', '3 démarches vers les sources citées par les IA', 'Rapport mensuel et point visio de 30 min', 'Rien n\'est publié sans votre validation', '3 mois minimum, puis sans engagement'],
    highlighted: true, cta: 'Être accompagné', available: true, commitmentMonths: ACCOMPAGNE_COMMITMENT_MONTHS,
  },
  // --- E-commerce ---
  {
    id: 'ecom_audit_free', segment: 'ecommerce', name: 'Test gratuit', priceCents: 0, interval: 'one_time',
    features: ['10 requêtes produit testées', '3 IA : ChatGPT, Gemini, Perplexity', 'Marques citées à la place des vôtres', '5 sources citées (comparatifs, forums, marketplaces)', 'Résultat par e-mail'],
    highlighted: false, cta: 'Tester ma boutique gratuitement', available: true,
  },
  {
    id: 'ecom_audit_deep', segment: 'ecommerce', name: 'Audit catalogue approfondi', priceCents: 39000, interval: 'one_time',
    features: ['50 requêtes produit, 3 IA, plusieurs passages', 'Part de voix face à 5 marques concurrentes', 'Toutes les sources citées, avec votre présence ou absence', 'Audit du balisage Product, du flux Merchant et des fiches', 'Plan d\'action sur 90 jours et restitution visio de 45 min', 'Déduit du premier mois d\'Accompagné si souscrit sous 30 jours', "1 mois d'Essentiel offert, sans carte bancaire, puis retour automatique à Découverte"],
    highlighted: false, cta: "Commander l'audit catalogue", available: true, guaranteeDays: 14,
  },
  {
    id: 'ecom_essentiel_month', segment: 'ecommerce', name: 'Essentiel', priceCents: 7900, interval: 'month',
    features: ['50 requêtes produit suivies chaque semaine', '4 IA : ChatGPT, Gemini, Perplexity, Claude', '5 marques concurrentes suivies', 'Sources citées : comparatifs, Reddit, marketplaces', 'Fiches produit et balisage prêts à copier', 'Trafic venu des IA via GA4 ou Shopify', 'Alertes quand un concurrent apparaît', 'Sans engagement'],
    highlighted: false, cta: 'Commencer', available: true,
  },
  {
    id: 'ecom_essentiel_year', segment: 'ecommerce', name: 'Essentiel annuel', priceCents: 79000, interval: 'year',
    features: ['Tout Essentiel', '2 mois offerts (790 € au lieu de 948 €)'],
    highlighted: false, cta: "Choisir l'annuel", available: true,
  },
  {
    id: 'ecom_accompagne_month', segment: 'ecommerce', name: 'Accompagné', priceCents: 39000, interval: 'month',
    features: ['Tout Essentiel, 100 requêtes produit suivies', '5 IA : ChatGPT, Gemini, Perplexity, Claude, Mistral', 'Mise en place faite : balisage Product/Offer/Review/FAQ, llms.txt, flux Merchant vérifié', '20 fiches produit réécrites par mois', '1 guide d\'achat ou comparatif par mois', '3 démarches vers les comparatifs et sources citées', 'Rapport mensuel (trafic et ventes IA si disponibles) et visio de 30 min', 'Rien n\'est publié sans votre validation', '3 mois minimum, puis sans engagement'],
    highlighted: true, cta: 'Être accompagné', available: true, commitmentMonths: ACCOMPAGNE_COMMITMENT_MONTHS,
  },
  // --- Agence : liste d'attente tant que la marque blanche n'est pas livrée ---
  {
    id: 'agency_partner', segment: 'agence', name: 'Partenaire', priceCents: 0, interval: 'one_time',
    features: ['Lien partenaire personnel', '30 % de commission pendant 12 mois sur chaque client apporté', 'Sans abonnement'],
    highlighted: false, cta: 'Devenir partenaire', available: false,
  },
  {
    id: 'agency_month', segment: 'agence', name: 'Agence', priceCents: 14900, interval: 'month',
    features: ['20 clients en Essentiel (tous parcours), +6 €/mois par client supplémentaire', '5 IA : ChatGPT, Gemini, Perplexity, Claude, Mistral', 'Marque blanche : votre logo, vos couleurs, votre domaine de rapport', 'Tests gratuits illimités pour vos prospects', 'Audits approfondis à prix revendeur (Local 99 €, PME et e-commerce 250 €)', 'Accès équipe et export des données'],
    highlighted: true, cta: 'Ouvrir un compte agence', available: false,
  },
  {
    id: 'agency_year', segment: 'agence', name: 'Agence annuel', priceCents: 149000, interval: 'year',
    features: ['Tout le plan Agence', '2 mois offerts (1 490 € au lieu de 1 788 €)'],
    highlighted: false, cta: 'Agence en annuel', available: false,
  },
  {
    id: 'agency_exec_local', segment: 'agence', name: 'Exécution marque blanche — Local', priceCents: 5900, interval: 'month',
    features: ['Accompagné Local exécuté par nous, sous votre marque', 'Par client et par mois', 'Vous gardez la relation et fixez votre prix'],
    highlighted: false, cta: 'Nous contacter', available: false,
  },
  {
    id: 'agency_exec_ecommerce', segment: 'agence', name: 'Exécution marque blanche — E-commerce', priceCents: 23000, interval: 'month',
    features: ['Accompagné E-commerce exécuté par nous, sous votre marque', 'Par client et par mois', 'Vous gardez la relation et fixez votre prix'],
    highlighted: false, cta: 'Nous contacter', available: false,
  },
  {
    id: 'agency_exec_pme', segment: 'agence', name: 'Exécution marque blanche — PME', priceCents: 29000, interval: 'month',
    features: ['Accompagné PME exécuté par nous, sous votre marque', 'Par client et par mois', 'Vous gardez la relation et fixez votre prix'],
    highlighted: false, cta: 'Nous contacter', available: false,
  },
];

// ---------------------------------------------------------------------------
// Offres V1 conservées (legacy)
// ---------------------------------------------------------------------------

export const LEGACY_PLANS: readonly Plan[] = [
  {
    id: 'audit_free', segment: 'local', legacy: true, name: 'Audit gratuit', priceCents: 0, interval: 'one_time',
    features: ['Score de visibilité IA /100', 'Test sur ChatGPT, Perplexity et Gemini', 'Les concurrents cités à votre place', 'Rapport PDF par e-mail'],
    highlighted: false, cta: 'Lancer mon audit gratuit', available: true,
  },
  {
    id: 'action_plan', segment: 'local', legacy: true, name: "Plan d'action", priceCents: 14900, interval: 'one_time',
    features: ['10 à 15 actions concrètes classées par priorité', 'Textes prêts à copier (fiche Google, site, réponses aux avis)', 'Basé sur votre audit et vos concurrents réels', 'Livré en PDF sous 2 jours ouvrés', 'Satisfait ou remboursé : 14 jours après réception'],
    highlighted: false, cta: "Obtenir mon plan d'action", available: true, guaranteeDays: 14,
  },
  {
    id: 'suivi_month', segment: 'local', legacy: true, name: 'Suivi', priceCents: 2900, interval: 'month',
    features: ['Audit refait chaque mois', 'Évolution de votre score mois après mois', 'Alerte e-mail si un concurrent vous dépasse', 'Suivi de 3 concurrents', "Jusqu'à 5 questions personnalisées", 'Sans engagement, résiliable en 1 clic'],
    highlighted: false, cta: 'Démarrer le suivi', available: true,
  },
  {
    id: 'suivi_year', segment: 'local', legacy: true, name: 'Suivi annuel', priceCents: 29000, interval: 'year',
    features: ['Tout le plan Suivi', '2 mois offerts (290 € au lieu de 348 €)', 'Rapport de synthèse annuel'],
    highlighted: false, cta: "Choisir l'annuel", available: true,
  },
  {
    id: 'bundle_start', segment: 'local', legacy: true, name: 'Démarrage', priceCents: 19900, interval: 'one_time',
    features: ["Plan d'action complet (valeur 149 €)", '3 mois de suivi inclus (valeur 87 €)', "Audit de contrôle à 90 jours pour mesurer l'évolution", "Plan d'action satisfait ou remboursé 14 jours", 'Ensuite 29 €/mois, sans engagement, résiliable en 1 clic'],
    highlighted: true, cta: 'Choisir Démarrage', available: true, guaranteeDays: 14,
  },
  {
    id: 'pro_month', segment: 'local', legacy: true, name: 'Pro', priceCents: 7900, interval: 'month',
    features: ["Jusqu'à 5 établissements", 'Tout le plan Suivi pour chacun', 'Suivi de 5 concurrents par établissement', 'Tableau de bord multi-établissements', 'Rapports PDF à votre nom'],
    highlighted: false, cta: 'Passer Pro', available: false,
  },
  {
    id: 'pro_year', segment: 'local', legacy: true, name: 'Pro annuel', priceCents: 79000, interval: 'year',
    features: ['Tout le plan Pro', '2 mois offerts (790 € au lieu de 948 €)'],
    highlighted: false, cta: 'Pro en annuel', available: false,
  },
];

// ---------------------------------------------------------------------------
// Offre Découverte (V3) : gratuite, permanente, une par parcours. Jamais payée (refusée par /api/checkout),
// ouverte par /inscription. Droits : src/lib/entitlements.ts (1 marque, 5 questions, 1 mesure par mois, 3 IA,
// pas d'exécution).
// ---------------------------------------------------------------------------

const DECOUVERTE_FEATURES = [
  '1 marque suivie',
  '5 questions suivies',
  '1 mesure par mois',
  '3 IA : ChatGPT, Gemini, Perplexity',
  'Historique de vos mesures',
  'Gratuit, sans carte bancaire, sans limite de durée',
];

export const DECOUVERTE_PLANS: readonly Plan[] = [
  {
    id: 'local_decouverte', segment: 'local', name: 'Découverte', priceCents: 0, interval: 'month',
    features: DECOUVERTE_FEATURES, highlighted: false, cta: 'Créer mon compte gratuit', available: true,
  },
  {
    id: 'pme_decouverte', segment: 'pme', name: 'Découverte', priceCents: 0, interval: 'month',
    features: DECOUVERTE_FEATURES, highlighted: false, cta: 'Créer mon compte gratuit', available: true,
  },
  {
    id: 'ecom_decouverte', segment: 'ecommerce', name: 'Découverte', priceCents: 0, interval: 'month',
    features: DECOUVERTE_FEATURES, highlighted: false, cta: 'Créer mon compte gratuit', available: true,
  },
];

const DECOUVERTE_BY_SEGMENT: Record<Exclude<PlanSegment, 'agence'>, DecouvertePlanId> = {
  local: 'local_decouverte',
  pme: 'pme_decouverte',
  ecommerce: 'ecom_decouverte',
};

/** Offre Découverte d'un parcours (agence → local). */
export function decouvertePlanFor(segment: PlanSegment | string | null | undefined): DecouvertePlanId {
  return DECOUVERTE_BY_SEGMENT[segment as Exclude<PlanSegment, 'agence'>] ?? 'local_decouverte';
}

export function isDecouvertePlanId(v: unknown): v is DecouvertePlanId {
  return v === 'local_decouverte' || v === 'pme_decouverte' || v === 'ecom_decouverte';
}

/** Toutes les offres connues (V2, Découverte V3, puis V1 conservées). */
export const PLANS: readonly Plan[] = [...V2_PLANS, ...DECOUVERTE_PLANS, ...LEGACY_PLANS];

export const PLAN_IDS = PLANS.map((p) => p.id) as PlanId[];

/** Équivalent V2 d'une offre V1 (affichage, migration). */
export const PLAN_ALIASES: Readonly<Record<LegacyPlanId, PlanIdV2>> = {
  audit_free: 'local_audit_free',
  action_plan: 'local_audit_deep',
  suivi_month: 'local_essentiel_month',
  suivi_year: 'local_essentiel_year',
  bundle_start: 'local_accompagne_month',
  pro_month: 'local_reseau_month',
  pro_year: 'local_reseau_year',
};

/** Offres achetables (V2 et V1 conservées). */
export const AVAILABLE_PLANS: readonly Plan[] = PLANS.filter((p) => p.available);

export function isPlanAvailable(id: PlanId): boolean {
  return getPlan(id).available;
}

export function isPlanId(v: unknown): v is PlanId {
  return typeof v === 'string' && (PLAN_IDS as string[]).includes(v);
}

export function isLegacyPlanId(v: unknown): v is LegacyPlanId {
  return typeof v === 'string' && v in PLAN_ALIASES;
}

export function getPlan(id: PlanId): Plan {
  const p = PLANS.find((x) => x.id === id);
  if (!p) throw new Error(`Plan inconnu : ${id}`);
  return p;
}

/** Offre V2 équivalente (identité pour une offre V2). */
export function resolvePlanId(id: PlanId): PlanIdV2 | DecouvertePlanId {
  return isLegacyPlanId(id) ? PLAN_ALIASES[id] : (id as PlanIdV2 | DecouvertePlanId);
}

/** Grille V2 d'un parcours (hors offres V1). `includeUnavailable` : afficher aussi la liste d'attente. */
export function plansForSegment(segment: PlanSegment, opts: { includeUnavailable?: boolean } = {}): Plan[] {
  return V2_PLANS.filter((p) => p.segment === segment && (opts.includeUnavailable || p.available));
}

/** Engagement minimum en mois (0 = sans engagement). */
export function commitmentMonths(id: PlanId): number {
  return getPlan(id).commitmentMonths ?? 0;
}

/**
 * Éléments Stripe propres à l'engagement (Accompagné : 3 mois) : metadata + mention affichée sur la page de paiement.
 * Renvoie null pour une offre sans engagement.
 */
export function commitmentCheckoutTerms(
  id: PlanId,
  now: Date = new Date(),
): { metadata: Record<string, string>; message: string } | null {
  const months = commitmentMonths(id);
  if (!months) return null;
  const until = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + months, now.getUTCDate()));
  return {
    metadata: {
      commitment_months: String(months),
      commitment_until: until.toISOString().slice(0, 10),
      plan_segment: getPlan(id).segment,
    },
    message: `Engagement de ${months} mois minimum (la mise en place est faite le premier mois), puis sans engagement, résiliable à tout moment depuis votre espace.`,
  };
}

/** Abonnement récurrent côté Stripe ? (Démarrage = paiement unique + Suivi en essai 90 j.) */
export function isSubscriptionPlan(id: PlanId): boolean {
  return getPlan(id).interval !== 'one_time' || id === 'bundle_start';
}

/** Niveau d'accès donné par une offre (audits ponctuels seuls : pas de changement de niveau). */
export function planTier(id: PlanId): PlanTier {
  if (id.startsWith('suivi') || id === 'bundle_start') return 'suivi';
  if (id.startsWith('pro_')) return 'pro';
  if (id === 'agency_month' || id === 'agency_year') return 'agency';
  if (id.includes('_accompagne_')) return 'accompagne';
  if (id.includes('_essentiel_')) return 'essentiel';
  if (id.startsWith('local_reseau')) return 'reseau';
  return 'free';
}

/** Libellé lisible d'un niveau d'accès (`Business.plan`), pour l'espace client (A13 de docs/v3/10). */
export const TIER_LABEL: Record<PlanTier, string> = {
  free: 'Découverte',
  suivi: 'Suivi',
  pro: 'Pro',
  agency: 'Agence',
  essentiel: 'Essentiel',
  accompagne: 'Accompagné',
  reseau: 'Réseau',
};

/** Offres qui donnent droit au plan d'action complet (PDF généré). */
export function includesActionPlan(id: PlanId): boolean {
  return id === 'action_plan' || id === 'bundle_start' || id === 'local_audit_deep';
}

/** Nombre max d'établissements suivis par niveau. */
export const MAX_BUSINESSES: Record<PlanTier, number> = {
  free: 0,
  suivi: 1,
  pro: 5,
  agency: 20,
  essentiel: 1,
  accompagne: 1,
  reseau: 5,
};

/** Questions au copilote par mois et par parcours (docs/v2/06-indispensable.md § 3.3). */
export const COPILOT_MONTHLY_QUOTA: Record<PlanSegment, number> = { local: 20, pme: 100, ecommerce: 150, agence: 500 };

/** « 29 € », « 149 € », « 1 490 € ». */
export function formatPrice(cents: number): string {
  const euros = cents / 100;
  return (
    new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: Number.isInteger(euros) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(euros) + ' €'
  );
}

export function formatPlanPrice(p: Plan): string {
  if (p.priceCents === 0) return 'Gratuit';
  const suffix = p.interval === 'month' ? ' / mois' : p.interval === 'year' ? ' / an' : '';
  return formatPrice(p.priceCents) + suffix;
}
