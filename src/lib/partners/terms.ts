/**
 * Conditions du programme partenaires DÉCIDÉES en V10 (docs/v10/DECISIONS.md, décisions 8 et 9). Pur (aucun import
 * serveur) : lu par /partenaires, /tarifs, les CGV, la politique de confidentialité, l'admin et le calcul de commission.
 *
 * - Agences : 30 % des paiements HT pendant 12 mois (déjà publié) ;
 * - prescripteurs (experts-comptables, fédérations, associations) et formateurs : 20 % pendant 12 mois ;
 * - CCI et chambres consulaires (chambres de métiers, d'agriculture) : un atelier gratuit pour leurs adhérents À LA
 *   PLACE de la commission ;
 * - plateformes : aucune commission ;
 * - versement trimestriel, sur facture du partenaire, jamais automatique ; remboursements Stripe déduits.
 *
 * Les textes juridiques ci-dessous sont des BROUILLONS « à relire » par un avocat (modèle de contrat :
 * docs/v10/contrat-partenaire.md).
 */
import type { CommissionTerms, PartnerFamily } from './program';

export const COMMISSION_BY_FAMILY: Record<PartnerFamily, CommissionTerms | null> = {
  agence: { rate: 0.3, months: 12 },
  plateforme: null,
  prescripteur: { rate: 0.2, months: 12 },
  formation: { rate: 0.2, months: 12 },
};

/** CCI, chambres de métiers et de l'artisanat, chambres d'agriculture : atelier gratuit au lieu d'une commission. */
const CONSULAR_RE = /\b(cci|cma|chambres?\s+(de\s+|d['’]\s*)?(commerce|m[ée]tiers|l['’]artisanat|agriculture|r[ée]gionale|consulaire))\b/i;

export function isConsularChamber(company: string | null | undefined): boolean {
  return !!company && CONSULAR_RE.test(company);
}

/** Conditions par défaut à l'acceptation d'un partenaire (l'admin peut ensuite les ajuster partenaire par partenaire). */
export function defaultTermsFor(family: PartnerFamily, company?: string | null): CommissionTerms | null {
  if (family === 'prescripteur' && isConsularChamber(company)) return null;
  const t = COMMISSION_BY_FAMILY[family];
  return t ? { ...t } : null;
}

export const PAYOUT_RULES = {
  /** fréquence des versements */
  period: 'trimestre' as const,
  /** délai de paiement de la facture du partenaire, en jours, après sa réception */
  paymentDays: 30,
  /** seuil minimal de versement (en dessous, report au trimestre suivant), en centimes */
  minimumCents: 5000,
  text: 'Commission calculée sur les paiements hors taxes réellement encaissés, remboursements déduits, versée chaque trimestre sur facture du partenaire (30 jours après réception), jamais automatiquement ; en dessous de 50 €, report au trimestre suivant.',
};

/** Trimestre civil d'une date ISO : « 2026-T4 ». */
export function quarterOf(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-T${Math.floor(d.getUTCMonth() / 3) + 1}`;
}

/** Paragraphe CGV (article « Programme partenaires ») — BROUILLON, à relire par un avocat. */
export const PARTNER_LEGAL_SUMMARY: string[] = [
  'Les partenaires (agences, prescripteurs, formateurs) qui recommandent Repéré signent un contrat de partenariat distinct. Ils reçoivent une commission sur les paiements hors taxes réellement encaissés auprès des clients qu\'ils apportent (agences : 30 % ; prescripteurs et formateurs : 20 %), pendant les 12 mois qui suivent le premier paiement du client. Les CCI et chambres consulaires reçoivent, à la place, un atelier gratuit pour leurs adhérents.',
  'Un client est rattaché à un partenaire lorsqu\'il arrive par son lien personnel (paramètre « ?ref= ») ou lors du paiement depuis ce lien. Le client ne paie rien de plus : la commission est prise sur le prix payé. Les remboursements sont déduits ; la commission est versée chaque trimestre sur facture du partenaire, jamais automatiquement.',
  'Le partenaire présente Repéré tel qu\'il est, sans promesse de résultat ni démarchage contraire à la loi ; il n\'a aucun accès aux données des clients qu\'il apporte, sauf accord écrit de ceux-ci (offre Agence). [À RELIRE : brouillon à faire valider par un avocat avant ouverture du programme.]',
];

/** Paragraphe de la politique de confidentialité (parrainage et attribution partenaire) — BROUILLON, à relire. */
export const PARTNER_PRIVACY_SUMMARY: string[] = [
  'Parrainage et partenaires : lorsque vous arrivez par un lien de parrainage ou un lien partenaire (paramètre « ?ref= »), nous enregistrons ce code, la première page vue et la date, dans la mémoire de l\'onglet (sans cookie), puis, si vous créez un compte ou payez, avec votre espace client (métadonnée « partner_ref » transmise à Stripe lors du paiement). Finalité : attribuer l\'inscription ou le paiement au parrain ou au partenaire et calculer sa récompense ou sa commission. Base légale : intérêt légitime (art. 6.1.f RGPD) et exécution du contrat de partenariat.',
  'Le partenaire ne reçoit que des informations agrégées ou strictement nécessaires au calcul de sa commission (nom de l\'entreprise apportée, offre, montants hors taxes encaissés et remboursés, dates) ; jamais vos réponses, vos mesures ni vos données de connexion. Durée de conservation : la durée du programme, puis 10 ans pour les pièces comptables (article L123-22 du Code de commerce). Vous pouvez demander la suppression du rattachement : il cesse alors pour l\'avenir. [À RELIRE : brouillon à faire valider par un avocat.]',
];
