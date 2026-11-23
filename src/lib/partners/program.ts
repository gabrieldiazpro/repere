/**
 * Programme partenaires (V9) : familles de partenaires, ce que chacun gagne, ce que nous attendons, comment ça marche.
 * Pur (aucun import serveur) : lu par la page publique /partenaires, le formulaire et l'admin.
 *
 * Les conditions chiffrées sont des PROPOSITIONS à valider par le fondateur (docs/v9/progress/PARTENAIRES.md). La
 * commission des agences reprend celle déjà publiée sur /agences et /tarifs (offre « Partenaire » : 30 % pendant
 * 12 mois) pour ne pas afficher deux chiffres différents. Chaque partenaire accepté reçoit SES conditions par écrit ;
 * l'admin peut les ajuster partenaire par partenaire (taux, durée).
 */

export const PARTNER_FAMILIES = ['agence', 'plateforme', 'prescripteur', 'formation'] as const;
export type PartnerFamily = (typeof PARTNER_FAMILIES)[number];

export function isPartnerFamily(v: unknown): v is PartnerFamily {
  return typeof v === 'string' && (PARTNER_FAMILIES as readonly string[]).includes(v);
}

/** Commission proposée : part des paiements HT réellement encaissés, pendant N mois à compter du premier paiement du client. */
export interface CommissionTerms {
  /** 0,3 = 30 % */
  rate: number;
  months: number;
}

export interface FamilyInfo {
  id: PartnerFamily;
  label: string;
  short: string;
  who: string;
  gains: string[];
  expect: string[];
  how: string[];
  /** Commission proposée par défaut (null : pas de commission, par ex. plateformes). */
  commission: CommissionTerms | null;
}

export const FAMILIES: Record<PartnerFamily, FamilyInfo> = {
  agence: {
    id: 'agence',
    label: 'Agences web, SEO et marketing',
    short: 'Agence',
    who: 'Agences, consultants et intégrateurs qui créent ou font vivre les sites de plusieurs clients.',
    gains: [
      '30 % des paiements hors taxes de chaque client apporté, pendant ses 12 premiers mois.',
      'Ou la revente sous votre marque : offre Agence (marque blanche, tableau multi-clients) et exécution à prix revendeur.',
      'L’API, le serveur MCP et les webhooks pour brancher Repéré dans vos outils.',
      'Un lien de parrainage personnel et un suivi des inscriptions qu’il apporte.',
    ],
    expect: [
      'Présenter Repéré tel qu’il est : une mesure avec marge d’erreur, jamais une promesse de position.',
      'Faire valider par vos clients tout ce qui est publié sur leur site.',
      'Un point de 30 minutes par trimestre avec nous.',
    ],
    how: [
      'Vous posez votre candidature ; le fondateur vous répond sous 5 jours ouvrés.',
      'Accord écrit : conditions, lien de parrainage, accès à la démo agence.',
      'Vos clients s’inscrivent par votre lien ; la commission est calculée sur leurs paiements réels et versée sur facture.',
    ],
    commission: { rate: 0.3, months: 12 },
  },
  plateforme: {
    id: 'plateforme',
    label: 'Plateformes et intégrations',
    short: 'Plateforme',
    who: 'Éditeurs de CMS, de solutions e-commerce, de modules ou d’outils utilisés par les sites professionnels.',
    gains: [
      'Une intégration documentée de part et d’autre, testée sur des comptes réels.',
      'Du contenu commun : guide pas à pas, article, webinaire, si vous le souhaitez.',
      'Les retours de vos utilisateurs sur ce que les IA lisent (ou pas) de leurs sites.',
    ],
    expect: [
      'Un accès de test à votre API ou à un compte de démonstration.',
      'Un contact technique pour les évolutions qui cassent l’intégration.',
      'Relire tout contenu qui cite votre marque avant publication.',
    ],
    how: [
      'Repéré est aujourd’hui compatible avec ces outils grâce à leurs API publiques, sans accord officiel.',
      'Un partenariat officiel n’est annoncé qu’une fois signé, avec l’accord écrit de la plateforme.',
    ],
    commission: null,
  },
  prescripteur: {
    id: 'prescripteur',
    label: 'Réseaux prescripteurs',
    short: 'Prescripteur',
    who: 'Experts-comptables, CCI, chambres de métiers, fédérations et associations professionnelles qui conseillent des entreprises.',
    gains: [
      '20 % des paiements hors taxes de chaque entreprise apportée, pendant ses 12 premiers mois.',
      'Si votre statut exclut toute commission (établissement public, fédération) : un atelier gratuit pour vos adhérents, en ligne ou sur place.',
      'Le baromètre de visibilité de votre territoire ou de votre métier, quand il est mesuré.',
    ],
    expect: [
      'Recommander Repéré quand il répond à un vrai besoin, sans le présenter comme obligatoire ni garanti.',
      'Nous dire ce que vos adhérents ou clients en pensent, en bien comme en mal.',
    ],
    how: [
      'Vous posez votre candidature ; nous convenons ensemble de la forme : commission, atelier, ou les deux.',
      'Vous recevez un lien de parrainage à partager dans vos lettres, réunions ou rendez-vous clients.',
      'Vous suivez les inscriptions apportées ; la commission éventuelle est versée sur facture.',
    ],
    commission: { rate: 0.2, months: 12 },
  },
  formation: {
    id: 'formation',
    label: 'Écoles et formateurs',
    short: 'Formation',
    who: 'Écoles, organismes de formation et formateurs indépendants en marketing, web ou commerce.',
    gains: [
      'Un accès gratuit à l’espace de démonstration pour vos cours et travaux pratiques.',
      'Nos supports de méthode : comment chaque IA est mesurée, avec quelles marges d’erreur.',
      '20 % des paiements hors taxes des entreprises apportées, pendant leurs 12 premiers mois (formateurs indépendants).',
    ],
    expect: [
      'Citer la méthode correctement, sans en faire une promesse de résultat.',
      'Ne pas utiliser l’espace de démonstration pour auditer des entreprises réelles sans leur accord.',
    ],
    how: [
      'Vous posez votre candidature en décrivant votre public.',
      'Nous vous ouvrons les supports et l’espace de démonstration.',
      'Si vous recommandez Repéré à des entreprises, votre lien de parrainage suit les inscriptions.',
    ],
    commission: { rate: 0.2, months: 12 },
  },
};

/**
 * Outils avec lesquels Repéré est COMPATIBLE (connecteurs dans src/lib/publish/connectors, API publiques).
 * Jamais « partenaires officiels » : aucun accord n'est signé avec ces éditeurs.
 */
export const COMPATIBLE_PLATFORMS = ['WordPress', 'WooCommerce', 'Shopify', 'Wix', 'Webflow', 'PrestaShop', 'Magento'] as const;

/** Mention légale de compatibilité, affichée sous la liste. */
export const COMPATIBILITY_NOTE =
  'Compatible signifie que Repéré se connecte à ces outils par leurs interfaces publiques. Ce ne sont pas des partenaires officiels : aucun accord n’est signé avec leurs éditeurs, qui ne recommandent pas Repéré. Les marques citées appartiennent à leurs propriétaires.';

/** Ce sur quoi la commission est calculée (affiché sur la page et dans l'admin). */
export const COMMISSION_BASIS =
  'Sur les paiements réellement encaissés par Stripe, hors taxes, hors remboursements ; versée sur facture, jamais automatiquement.';

export const pct = (rate: number) => `${Math.round(rate * 1000) / 10} %`.replace('.', ',');

export function commissionLabel(t: CommissionTerms | null): string {
  if (!t) return 'Pas de commission';
  return `${pct(t.rate)} pendant ${t.months} mois`;
}
