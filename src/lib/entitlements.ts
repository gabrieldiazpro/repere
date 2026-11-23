/**
 * Droits par offre (contrat docs/v3/12-CONTRATS-V3.md) — une seule table de vérité, testée.
 * Sources : docs/v2/07-plans-v2.json (questions, IA, rythme annoncés), décision 2 (Découverte : 1 marque,
 * 5 questions, 1 mesure par mois, 3 IA, pas d'exécution), décision 3 (IA suivies, Mistral en option).
 * V10 (docs/v10/DECISIONS.md, scénario S2 de docs/v8/economie-offres.md) : aperçus IA de Google et AI Mode dans toutes
 * les offres payantes ; Essentiel mesuré chaque mois (3 passages) ; Accompagné chaque semaine (2 passages) ; Agence
 * 10 clients mesurés chaque mois ; Copilot et DeepSeek en option (Accompagné, Agence), Grok sur demande. Marges :
 * docs/v10/progress/DECISIONS-V10.md.
 *
 * Un commerce inactif ou sans offre payante active a les droits Découverte. Les comptes démo ont tout (lecture seule
 * côté serveur par ailleurs) pour montrer le produit complet.
 */
import type { Business } from '@/lib/db';
import { isDemoBusinessId } from '@/lib/demo-v2';
import type { ProviderId } from '@/lib/engine/types';
import type { Segment } from '@/lib/engine/types-v2';
import { HttpError } from '@/lib/auth/roles';
import { AGENCY_INCLUDED_CLIENTS, AGENCY_MAX_CLIENTS, getPlan, isPlanId, type PlanId, type PlanTier } from '@/lib/plans';
import { limitsFor as seoDataLimitsFor, type SeoDataLimits } from '@/lib/seodata/limits';
import { crawlRights, type CrawlRights } from '@/lib/recrawl-rights';

export type EntitlementTier = 'decouverte' | 'essentiel' | 'accompagne' | 'agence' | 'demo';

export interface Entitlements {
  planId: string;
  tier: EntitlementTier;
  /** questions suivies */
  prompts: number;
  engines: ProviderId[];
  frequency: 'monthly' | 'weekly' | 'daily';
  /** V10 : passages par mesure (chaque question posée N fois à chaque IA) : 3 au mois, 2 à la semaine */
  runs: number;
  /** V10 : IA ajoutables en option payante (Copilot, DeepSeek : Accompagné et Agence) ; jamais comptées dans « N IA » */
  optionalEngines: ProviderId[];
  /** V10 : contenus rédigés publiables par mois (0 / 2 / 6 / 6 par client) — src/lib/content/quota.ts */
  contentsPerMonth: number;
  /** tâches d'exécution (livrables, génération) */
  execution: boolean;
  /** utilisateurs (membres + invitations en attente) */
  seats: number;
  /** marques / établissements */
  brands: number;
  exports: boolean;
  shareLinks: boolean;
  whiteLabel: boolean;
  /** profondeur d'historique consultable ; null = illimitée */
  historyMonths: number | null;
  copilotDaily: number;
  integrations: boolean;
  /** V5 — analyse SEO + GEO du site (exploration réelle) : pages explorées, rythme de réanalyse */
  analysis: AnalysisLimits;
  /** V5 — données SEO externes (Search Console, positions, PageSpeed, liens) : src/lib/seodata/limits.ts */
  seoData: SeoDataLimits;
  /** V5 — agent de publication (src/lib/publish) */
  publish: PublishLimits;
  /** V5 — explorations manuelles du site depuis l'app (APP-SEO) : src/lib/recrawl-rights.ts */
  recrawl: CrawlRights;
  /** V6 — fonctions agences (src/lib/agency) : réservées à l'offre Agence (la démo les montre en lecture seule) */
  agency: AgencyLimits;
  /** V8 — API publique REST, serveur MCP en lecture et webhooks (src/lib/publicapi) : Accompagné, Agence, démo */
  api: boolean;
}

/** V6 — fonctions agences. Toutes fausses / nulles hors offre Agence. */
export interface AgencyLimits {
  /** tableau de bord multi-clients (/app/agence) */
  portfolio: boolean;
  /** espaces clients gérés depuis le tableau de bord */
  clients: number;
  /** marque de l'agence (nom, logo, couleur) appliquée à tous les rapports, liens et e-mails de ses clients */
  branding: boolean;
  /** domaine d'envoi propre (rapports envoyés depuis rapports@agence.fr, après vérification DNS) */
  senderDomain: boolean;
  /** accès client : le client voit son espace et valide les propositions de l'agent, sans rien régler */
  clientPortal: boolean;
  /** export CSV par client (constats, positions, réponses des IA) depuis le tableau de bord */
  clientExports: boolean;
  /** V10 : clients compris dans le prix de base (au-delà : +9 €/mois par client, option `agency_extra_client`) */
  includedClients: number;
}

const NO_AGENCY: AgencyLimits = { portfolio: false, clients: 0, branding: false, senderDomain: false, clientPortal: false, clientExports: false, includedClients: 0 };
/** V10 : « 10 clients mesurés chaque mois, +9 €/mois par client au-delà » ; plafond technique AGENCY_MAX_CLIENTS (devis au-delà). */
const AGENCY_FULL: AgencyLimits = { portfolio: true, clients: AGENCY_MAX_CLIENTS, branding: true, senderDomain: true, clientPortal: true, clientExports: true, includedClients: AGENCY_INCLUDED_CLIENTS };

export function agencyLimitsFor(tier: EntitlementTier): AgencyLimits {
  return tier === 'agence' || tier === 'demo' ? { ...AGENCY_FULL } : { ...NO_AGENCY };
}

export interface AnalysisLimits {
  /** pages explorées par analyse (l'analyse publique sans compte : 60) */
  maxPages: number;
  /** budget de temps d'exploration visé (ms) ; borné en pratique par JOBS_TIMEOUT_MS dans la file */
  crawlBudgetMs: number;
  /** réanalyse automatique du site (tâche `analysis.rerun`) */
  reanalysis: 'none' | 'monthly' | 'weekly';
}

export interface PublishLimits {
  /** application directe chez le client (WordPress, Shopify…) après validation ; sinon export seulement */
  apply: boolean;
  /** séries de modifications appliquées par mois (0 = export seulement) */
  changeSetsPerMonth: number;
}

/** V8 — niveaux qui ouvrent l'API publique (« réservée aux offres Accompagné et Agence » ; la démo la montre). */
export const API_TIERS: readonly EntitlementTier[] = ['accompagne', 'agence', 'demo'];

export function apiLimitFor(tier: EntitlementTier): boolean {
  return API_TIERS.includes(tier);
}

/** Analyse publique sans compte (route /api/v5/analysis) : mêmes chiffres que Découverte. */
export const PUBLIC_ANALYSIS_MAX_PAGES = 60;

/**
 * Limites V5 par niveau (brief V5 + journaux SEO-DATA et PUBLICATION ; tarifs à revoir avec le fondateur).
 * Pages explorées : Découverte 60, Essentiel 500, Accompagné 2 000 (Agence : 500 par marque).
 */
const V5: Record<EntitlementTier, { analysis: AnalysisLimits; publish: PublishLimits }> = {
  decouverte: { analysis: { maxPages: PUBLIC_ANALYSIS_MAX_PAGES, crawlBudgetMs: 45_000, reanalysis: 'monthly' }, publish: { apply: false, changeSetsPerMonth: 0 } },
  essentiel: { analysis: { maxPages: 500, crawlBudgetMs: 240_000, reanalysis: 'monthly' }, publish: { apply: true, changeSetsPerMonth: 20 } },
  accompagne: { analysis: { maxPages: 2_000, crawlBudgetMs: 600_000, reanalysis: 'weekly' }, publish: { apply: true, changeSetsPerMonth: 100 } },
  agence: { analysis: { maxPages: 500, crawlBudgetMs: 240_000, reanalysis: 'weekly' }, publish: { apply: true, changeSetsPerMonth: 200 } },
  // Démo : lecture seule côté serveur ; montre le produit complet, aucune tâche planifiée.
  demo: { analysis: { maxPages: 2_000, crawlBudgetMs: 600_000, reanalysis: 'none' }, publish: { apply: true, changeSetsPerMonth: 100 } },
};

function v5Limits(tier: EntitlementTier, segment: Segment): Pick<Entitlements, 'analysis' | 'seoData' | 'publish' | 'recrawl' | 'agency' | 'api'> {
  const v = V5[tier];
  return { analysis: { ...v.analysis }, seoData: seoDataLimitsFor({ tier }, segment), publish: { ...v.publish }, recrawl: { ...crawlRights(tier) }, agency: agencyLimitsFor(tier), api: apiLimitFor(tier) };
}

const BASE3: ProviderId[] = ['chatgpt', 'perplexity', 'gemini'];
const BASE4: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];
/** V10 : aperçus IA de Google et AI Mode (DataForSEO, ≈ 0,008 € la question pour les deux), dans toutes les offres payantes. */
export const GOOGLE_AI: ProviderId[] = ['google_aio', 'google_ai_mode'];
/** V10 : IA en option payante (Accompagné, Agence). Grok : sur demande, hors offres. */
export const OPTIONAL_AI: ProviderId[] = ['copilot', 'deepseek'];
const ESS_LOCAL: ProviderId[] = [...BASE3, ...GOOGLE_AI];
const PLUS: ProviderId[] = [...BASE4, ...GOOGLE_AI];
/** Mistral n'est réellement interrogé que si MISTRAL_API_KEY est fourni (moteur). */
const ALL: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude', 'mistral', ...GOOGLE_AI];

/** V10 : passages par mesure selon le rythme (docs/v10/progress/DECISIONS-V10.md : marge brute ≥ 70 %). */
export const RUNS_BY_FREQUENCY: Record<Entitlements['frequency'], number> = { monthly: 3, weekly: 2, daily: 1 };

/** V10 : contenus publiables par mois (décision 7 : 0 / 2 / 6 / 6 par client). */
export const CONTENTS_PER_MONTH: Record<EntitlementTier, number> = { decouverte: 0, essentiel: 2, accompagne: 6, agence: 6, demo: 2 };

type Row = Omit<Entitlements, 'planId' | 'tier' | 'analysis' | 'seoData' | 'publish' | 'recrawl' | 'agency' | 'api' | 'runs' | 'contentsPerMonth' | 'optionalEngines'>;

const DECOUVERTE: Row = {
  prompts: 5, engines: BASE3, frequency: 'monthly', execution: false, seats: 1, brands: 1,
  exports: false, shareLinks: false, whiteLabel: false, historyMonths: null, copilotDaily: 3, integrations: false,
};

/** Par parcours : les offres n'annoncent pas les mêmes volumes (docs/v2/07-plans-v2.json). */
const TABLE: Record<'essentiel' | 'accompagne', Record<Segment, Row>> = {
  essentiel: {
    // « 20 questions clients suivies chaque mois », « 5 IA »
    local: { prompts: 20, engines: ESS_LOCAL, frequency: 'monthly', execution: true, seats: 2, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 10, integrations: false },
    // « 50 questions suivies chaque mois », « 6 IA », trafic IA via GA4
    pme: { prompts: 50, engines: PLUS, frequency: 'monthly', execution: true, seats: 3, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 20, integrations: true },
    // « 50 requêtes produit suivies chaque mois », « 6 IA », GA4 ou Shopify
    ecommerce: { prompts: 50, engines: PLUS, frequency: 'monthly', execution: true, seats: 3, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 20, integrations: true },
  },
  accompagne: {
    // « Tout Essentiel, 30 questions suivies chaque semaine », « 6 IA » (2 passages)
    local: { prompts: 30, engines: PLUS, frequency: 'weekly', execution: true, seats: 3, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 20, integrations: true },
    // « Tout Essentiel, 100 questions suivies chaque semaine », « 7 IA » (2 passages)
    pme: { prompts: 100, engines: ALL, frequency: 'weekly', execution: true, seats: 5, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 40, integrations: true },
    ecommerce: { prompts: 100, engines: ALL, frequency: 'weekly', execution: true, seats: 5, brands: 1, exports: true, shareLinks: true, whiteLabel: false, historyMonths: null, copilotDaily: 40, integrations: true },
  },
};

/** V10 : « 10 clients mesurés chaque mois » (30 questions, 6 IA, 3 passages) ; marque blanche, accès équipe et export
 *  (offre en liste d'attente, briques construites). Droits d'UN espace client ; `brands` = plafond du compte. */
const AGENCE: Row = {
  prompts: 30, engines: PLUS, frequency: 'monthly', execution: true, seats: 10, brands: AGENCY_MAX_CLIENTS,
  exports: true, shareLinks: true, whiteLabel: true, historyMonths: null, copilotDaily: 60, integrations: true,
};

const DEMO: Row = {
  prompts: 50, engines: ALL, frequency: 'weekly', execution: true, seats: 5, brands: 1,
  exports: true, shareLinks: true, whiteLabel: true, historyMonths: null, copilotDaily: 30, integrations: true,
};

/** Niveau de droits d'un niveau d'accès stocké (`Business.plan`, V1 et V2). */
export function tierOf(plan: PlanTier | string | null | undefined): Exclude<EntitlementTier, 'demo'> {
  switch (plan) {
    case 'essentiel':
    case 'suivi':
    case 'reseau':
    case 'pro':
      return 'essentiel';
    case 'accompagne':
      return 'accompagne';
    case 'agency':
      return 'agence';
    default:
      return 'decouverte';
  }
}

function segmentOf(b: Pick<Business, 'segment' | 'planId'>): Segment {
  if (b.segment === 'pme' || b.segment === 'ecommerce' || b.segment === 'local') return b.segment;
  if (b.planId && isPlanId(b.planId)) {
    const s = getPlan(b.planId).segment;
    if (s === 'pme' || s === 'ecommerce') return s;
  }
  return 'local';
}

type EntitlementBusiness = Pick<Business, 'id' | 'plan' | 'segment' | 'planId'> & { isActive?: boolean };

export function getEntitlements(business: EntitlementBusiness): Entitlements {
  if (isDemoBusinessId(business.id)) return { planId: 'demo', tier: 'demo', ...DEMO, engines: [...DEMO.engines], ...v10Fields('demo', DEMO), ...v5Limits('demo', segmentOf(business)) };
  const active = business.isActive !== false;
  const tier = active ? tierOf(business.plan) : 'decouverte';
  const segment = segmentOf(business);
  let row: Row;
  if (tier === 'essentiel' || tier === 'accompagne') row = { ...TABLE[tier][segment] };
  else if (tier === 'agence') row = { ...AGENCE };
  else row = { ...DECOUVERTE };
  // Réseau / Pro (V1) : plusieurs établissements en Essentiel (« jusqu'à 5 établissements »).
  if (active && (business.plan === 'reseau' || business.plan === 'pro')) row.brands = 5;
  const planId =
    tier === 'decouverte'
      ? business.planId && String(business.planId).endsWith('_decouverte')
        ? String(business.planId)
        : `${segment === 'ecommerce' ? 'ecom' : segment}_decouverte`
      : String(business.planId ?? business.plan);
  return { planId, tier, ...row, engines: [...row.engines], ...v10Fields(tier, row), ...v5Limits(tier, segment) };
}

function v10Fields(tier: EntitlementTier, row: Row): Pick<Entitlements, 'runs' | 'optionalEngines' | 'contentsPerMonth'> {
  return {
    runs: RUNS_BY_FREQUENCY[row.frequency],
    optionalEngines: tier === 'accompagne' || tier === 'agence' || tier === 'demo' ? [...OPTIONAL_AI] : [],
    contentsPerMonth: CONTENTS_PER_MONTH[tier],
  };
}

// ---------------------------------------------------------------------------
// V10 : options payantes d'un espace (Copilot et DeepSeek ; mesure hebdomadaire d'un client Agence).
// Activées par l'admin après souscription de l'option dans Stripe (scripts/ops/stripe-setup.mjs) ; document
// `entitlements.options` (id = businessId). Une option non permise par l'offre est ignorée.
// ---------------------------------------------------------------------------

export const OFFER_OPTIONS_COLLECTION = 'entitlements.options';

export interface OfferOptions {
  /** IA en option activées (sous-ensemble de `optionalEngines`) */
  engines?: ProviderId[];
  /** Agence : ce client est mesuré chaque semaine (2 passages) */
  weekly?: boolean;
  updatedAt?: string;
}

/** Droits avec les options de l'espace appliquées (pur). */
export function withOfferOptions(e: Entitlements, opts: OfferOptions | null | undefined): Entitlements {
  if (!opts) return e;
  const extra = (opts.engines ?? []).filter((p) => e.optionalEngines.includes(p) && !e.engines.includes(p));
  const weekly = opts.weekly === true && e.tier === 'agence';
  return {
    ...e,
    engines: [...e.engines, ...extra],
    ...(weekly ? { frequency: 'weekly' as const, runs: RUNS_BY_FREQUENCY.weekly } : {}),
  };
}

export async function getOfferOptions(businessId: string): Promise<OfferOptions | null> {
  if (isDemoBusinessId(businessId)) return null;
  const { getDoc } = await import('@/lib/store');
  return (await getDoc<OfferOptions>(OFFER_OPTIONS_COLLECTION, businessId))?.data ?? null;
}

export async function setOfferOptions(businessId: string, opts: OfferOptions, now: Date = new Date()): Promise<OfferOptions> {
  const { putDoc } = await import('@/lib/store');
  const clean: OfferOptions = {
    engines: [...new Set((opts.engines ?? []).filter((p) => OPTIONAL_AI.includes(p)))],
    weekly: opts.weekly === true,
    updatedAt: now.toISOString(),
  };
  await putDoc(OFFER_OPTIONS_COLLECTION, businessId, clean, businessId);
  return clean;
}

/** Droits d'un espace, options comprises (mesures planifiées, moteur). */
export async function getEntitlementsWithOptions(business: EntitlementBusiness): Promise<Entitlements> {
  const e = getEntitlements(business);
  try {
    return withOfferOptions(e, await getOfferOptions(business.id));
  } catch {
    return e;
  }
}

/** Offre minimale qui débloque une fonction (message 402). */
const UNLOCKED_BY: Partial<Record<keyof Entitlements, string>> = {
  execution: 'Essentiel',
  exports: 'Essentiel',
  shareLinks: 'Essentiel',
  integrations: 'Essentiel (PME, E-commerce) ou Accompagné',
  whiteLabel: 'Agence',
  api: 'Accompagné ou Agence',
};

/**
 * Lève HttpError(402, code 'upgrade_required') si la fonction n'est pas incluse :
 * booléen faux, quota numérique nul ou liste vide.
 */
export function assertEntitled(e: Entitlements, feature: keyof Entitlements): void {
  const v = e[feature];
  const ok = Array.isArray(v) ? v.length > 0 : typeof v === 'number' ? v > 0 : v === null ? true : Boolean(v);
  if (ok) return;
  const offer = UNLOCKED_BY[feature];
  throw new HttpError(402, offer ? `Cette fonction est disponible avec l’offre ${offer}.` : 'Cette fonction n’est pas incluse dans votre offre.', 'upgrade_required');
}

/** Fonction agence (V6) : lève 402 hors offre Agence. */
export function assertAgency(e: Entitlements, feature: Exclude<keyof AgencyLimits, 'clients'>): void {
  if (e.agency[feature]) return;
  throw new HttpError(402, 'Cette fonction est réservée à l’offre Agence.', 'upgrade_required');
}

/** Agent de publication : l'application directe chez le client demande Essentiel (l'export reste ouvert à tous). */
export function assertCanApplyPublish(e: Entitlements): void {
  if (e.publish.apply) return;
  throw new HttpError(402, 'L’application directe sur votre site est disponible avec l’offre Essentiel. Vous pouvez télécharger les modifications (export) dès maintenant.', 'upgrade_required');
}

/** V10 : plafond mensuel de séries de corrections appliquées (Essentiel 20, Accompagné 100, Agence 200). */
export function assertWithinPublishQuota(e: Entitlements, appliedThisMonth: number): void {
  const max = e.publish.changeSetsPerMonth;
  if (appliedThisMonth < max) return;
  throw new HttpError(
    402,
    max > 0
      ? `Votre offre comprend ${max} séries de corrections appliquées par mois : la limite est atteinte. Vous pouvez télécharger ces modifications (export) ou attendre le mois prochain.`
      : 'L’application directe sur votre site est disponible avec l’offre Essentiel.',
    'quota_exceeded',
  );
}

/** Quota numérique : lève 402 si `used + adding` dépasse la limite. */
export function assertWithinQuota(e: Entitlements, feature: 'prompts' | 'seats' | 'brands' | 'copilotDaily', used: number, adding = 1): void {
  const max = e[feature];
  if (used + adding <= max) return;
  const what = { prompts: 'questions suivies', seats: 'accès', brands: 'marques', copilotDaily: 'questions au copilote par jour' }[feature];
  throw new HttpError(402, `Votre offre comprend ${max} ${what}. Passez à l’offre supérieure pour en ajouter.`, 'quota_exceeded');
}

export const TIER_NAMES: Record<EntitlementTier, string> = {
  decouverte: 'Découverte',
  essentiel: 'Essentiel',
  accompagne: 'Accompagné',
  agence: 'Agence',
  demo: 'Démo',
};

// ---------------------------------------------------------------------------
// Audit approfondi acheté seul : 1 mois d'Essentiel offert (décision du fondateur)
// ---------------------------------------------------------------------------
//
// L'achat d'un audit approfondi (local_audit_deep 149 €, pme_audit_deep / ecom_audit_deep 390 €, action_plan V1)
// donne 30 jours d'Essentiel du même parcours, sans moyen de paiement enregistré : `Business.plan = 'essentiel'` et
// `Business.planId = <offre d'audit>`, l'échéance est gardée dans le document `entitlements.audit_offer`. Le balayage
// quotidien (`audit.scheduled`) envoie le rappel J-5 (lien /tarifs) puis rend les droits Découverte, sans paiement ni
// suppression : historique, questions et livrables restent consultables ; seules les 5 premières questions actives
// sont encore mesurées (les autres restent listées, mesurées à nouveau dès qu'une offre payante est prise).
// Un abonnement payé pendant la période remplace `plan`/`planId` : l'échéance n'y touche plus (« relayé »).

export const AUDIT_OFFER_DAYS = 30;
export const AUDIT_OFFER_REMINDER_DAYS = 5;
export const AUDIT_OFFER_COLLECTION = 'entitlements.audit_offer';

const AUDIT_OFFER_PLANS = new Set(['local_audit_deep', 'pme_audit_deep', 'ecom_audit_deep', 'action_plan']);

/** Offre d'audit approfondi ouvrant le mois d'Essentiel offert. */
export function isAuditOfferPlan(planId: string | null | undefined): boolean {
  return !!planId && AUDIT_OFFER_PLANS.has(planId);
}

export interface AuditOffer {
  businessId: string;
  planId: string;
  segment: Segment;
  grantedAt: string;
  until: string;
  /** active : en cours ; ended : rendu à Découverte ; relayed : un abonnement payé a pris le relais ;
   *  skipped : le commerce avait déjà une offre payante au moment de l'achat */
  status: 'active' | 'ended' | 'relayed' | 'skipped';
  reminderSentAt?: string | null;
  endedAt?: string | null;
}

/** Échéance d'une offre accordée à `paidAt` (pur). */
export function auditOfferUntil(paidAt: Date): Date {
  return new Date(paidAt.getTime() + AUDIT_OFFER_DAYS * 86_400_000);
}

/** Le commerce bénéficie-t-il encore du mois offert (et pas d'une offre payante) ? */
function onOffer(b: Pick<Business, 'plan' | 'planId'>, offer: AuditOffer): boolean {
  return b.plan === 'essentiel' && b.planId === offer.planId;
}

/**
 * Enregistre l'achat d'un audit approfondi : 30 jours d'Essentiel du parcours. Idempotent (un événement Stripe rejoué
 * ne prolonge rien : une seule offre par commerce). Sans effet si le commerce a déjà une offre payante (on ne
 * rétrograde jamais un Accompagné). Renvoie l'offre enregistrée, ou null si l'offre ne s'applique pas.
 */
export async function grantAuditOffer(businessId: string, planId: string, paidAt: Date = new Date()): Promise<AuditOffer | null> {
  if (!isAuditOfferPlan(planId) || isDemoBusinessId(businessId)) return null;
  const { getDoc, putDoc } = await import('@/lib/store');
  const existing = await getDoc<AuditOffer>(AUDIT_OFFER_COLLECTION, businessId);
  if (existing?.data) return existing.data;
  const db = await import('@/lib/db');
  const b = await db.getBusinessRecord(businessId);
  if (!b) return null;
  const segment = isPlanId(planId) ? (getPlan(planId).segment as Segment) : 'local';
  const paid = tierOf(b.plan) !== 'decouverte' && b.isActive !== false;
  const offer: AuditOffer = {
    businessId,
    planId,
    segment: segment === 'pme' || segment === 'ecommerce' ? segment : 'local',
    grantedAt: paidAt.toISOString(),
    until: auditOfferUntil(paidAt).toISOString(),
    status: paid ? 'skipped' : 'active',
    reminderSentAt: null,
    endedAt: null,
  };
  await putDoc(AUDIT_OFFER_COLLECTION, businessId, offer, businessId);
  if (!paid) await db.updateBusiness(businessId, { plan: 'essentiel', planId: planId as PlanId, isActive: true });
  return offer;
}

/** Offre enregistrée d'un commerce (pour l'affichage « Essentiel offert jusqu'au … »), ou null. */
export async function getAuditOffer(businessId: string): Promise<AuditOffer | null> {
  const { getDoc } = await import('@/lib/store');
  return (await getDoc<AuditOffer>(AUDIT_OFFER_COLLECTION, businessId))?.data ?? null;
}

const frDay = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });

/**
 * Balayage (quotidien, via `audit.scheduled`) : rappel J-5 puis retour à Découverte à l'échéance. Idempotent.
 */
export async function sweepAuditOffers(now: Date = new Date()): Promise<{ reminded: number; ended: number; relayed: number }> {
  const out = { reminded: 0, ended: 0, relayed: 0 };
  const { listDocs, putDoc } = await import('@/lib/store');
  const db = await import('@/lib/db');
  const docs = await listDocs<AuditOffer>(AUDIT_OFFER_COLLECTION, { limit: 2000 });
  for (const d of docs) {
    const offer = d.data;
    if (!offer || offer.status !== 'active') continue;
    const b = await db.getBusinessRecord(offer.businessId).catch(() => null);
    if (!b) continue;
    const until = Date.parse(offer.until);
    if (!onOffer(b, offer)) {
      // Un abonnement payé a pris le relais (ou l'offre a été retirée) : l'échéance ne touche plus aux droits.
      await putDoc(AUDIT_OFFER_COLLECTION, offer.businessId, { ...offer, status: 'relayed', endedAt: now.toISOString() }, offer.businessId);
      out.relayed++;
      continue;
    }
    if (now.getTime() >= until) {
      await db.updateBusiness(offer.businessId, { plan: 'free', planId: null });
      await putDoc(AUDIT_OFFER_COLLECTION, offer.businessId, { ...offer, status: 'ended', endedAt: now.toISOString() }, offer.businessId);
      await db
        .recordAlert({
          businessId: offer.businessId,
          type: 'subscription_canceled',
          title: 'Votre mois d’Essentiel offert est terminé',
          body: 'Votre espace repasse en Découverte, sans frais. Votre historique et vos livrables restent consultables.',
        })
        .catch(() => undefined);
      out.ended++;
      continue;
    }
    if (!offer.reminderSentAt && now.getTime() >= until - AUDIT_OFFER_REMINDER_DAYS * 86_400_000) {
      let emailSent = false;
      if (b.contactEmail) {
        const { sendAuditOfferReminderEmail } = await import('@/lib/email');
        const r = await sendAuditOfferReminderEmail(b.contactEmail, { businessName: b.name, until: offer.until, segment: offer.segment }).catch(() => null);
        emailSent = r?.status === 'sent' || r?.status === 'logged';
      }
      await db
        .recordAlert({
          businessId: offer.businessId,
          type: 'actions_reminder',
          title: `Votre mois d’Essentiel offert se termine le ${frDay(offer.until)}`,
          body: 'Ensuite, votre espace repasse en Découverte, sans frais et sans perte de données. Pour garder le suivi complet, voyez les offres.',
          payload: { href: `/tarifs?segment=${offer.segment}`, until: offer.until },
          emailSent,
        })
        .catch(() => undefined);
      try {
        const { addNotification } = await import('@/lib/notify/center');
        await addNotification(offer.businessId, {
          type: 'actions_reminder',
          title: `Votre mois d’Essentiel offert se termine le ${frDay(offer.until)}`,
          body: 'Ensuite, retour à Découverte sans frais et sans perte de données. Voir les offres pour garder le suivi complet.',
          href: `/tarifs?segment=${offer.segment}`,
          severity: 'info',
          dedupeKey: `audit_offer_reminder:${offer.businessId}:${offer.grantedAt}`,
        }, now);
      } catch {
        /* centre de notifications indisponible : l'e-mail et l'alerte suffisent */
      }
      await putDoc(AUDIT_OFFER_COLLECTION, offer.businessId, { ...offer, reminderSentAt: now.toISOString() }, offer.businessId);
      out.reminded++;
    }
  }
  return out;
}
