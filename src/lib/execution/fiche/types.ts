/**
 * Fiche officielle de l'entreprise (V9, « passeport » repris de Fairly Made) — contrats.
 *
 * UNE seule source de faits : elle réunit la fiche de vérité (`facts.brand`, /app/verite), la fiche « faits clés » de
 * l'agent de contenu (`content.facts`, /app/contenu/faits) et les profils officiels (`exec.settings.sameAs`).
 * Chaque fait porte sa source (saisi par le client, lu sur son site, fiche Google), sa date et son statut « vérifié par
 * le client ». Stockage : collection `fiche.official` (id = businessId). Les anciennes collections restent en place et
 * sont tenues à jour par miroir à chaque enregistrement (rien n'est supprimé : migration douce, sans perte).
 */

/** D'où vient la valeur. */
export type FactSource = 'client' | 'site' | 'google';

export const SOURCE_LABEL: Record<FactSource, string> = {
  client: 'Saisi par vous',
  site: 'Lu sur votre site',
  google: 'Lu sur votre fiche Google',
};

export interface FactMeta {
  source: FactSource;
  /** date de la saisie ou de la lecture (ISO) */
  at: string;
  /** le client a confirmé cette valeur dans la fiche officielle */
  verified: boolean;
  verifiedAt?: string;
  /** collection d'origine lors de la migration (facts.brand, content.facts, exec.settings) */
  from?: string;
}

export interface TextFact extends FactMeta {
  value: string;
}

/** Service ou produit, avec un prix « à partir de » facultatif. */
export interface ServiceItem {
  name: string;
  /** prix minimal en euros (« à partir de ») */
  priceFrom?: number;
  /** précision du prix : « TTC », « HT par mois », « l'heure »… */
  unit?: string;
}

/** Label ou certification, avec numéro et lien de vérification chez l'organisme. */
export interface Credential {
  name: string;
  number?: string;
  /** page publique de l'organisme où vérifier (https) */
  verifyUrl?: string;
  issuer?: string;
}

/** Horaires exceptionnels (jours fériés, congés). Dates au format AAAA-MM-JJ. */
export interface HoursException {
  from: string;
  to?: string;
  closed: boolean;
  opens?: string;
  closes?: string;
  label?: string;
}

export interface ListFact<T> extends FactMeta {
  value: T[];
}

export const TEXT_KEYS = [
  'nom',
  'activite',
  'adresse',
  'zone',
  'horaires',
  'telephone',
  'email',
  'site',
  'prix',
  'delais',
  'garanties',
  'paiement',
  'langues',
  'creation',
  'dirigeant',
  'equipe',
  'histoire',
  'difference',
  'clients',
  'produits',
  'livraison',
  'retours',
  'ingredients',
  'avis',
  'statut',
] as const;
export type TextKey = (typeof TEXT_KEYS)[number];
export const isTextKey = (v: unknown): v is TextKey => typeof v === 'string' && (TEXT_KEYS as readonly string[]).includes(v);

export const LIST_KEYS = ['services', 'certifications', 'exceptions', 'sameAs'] as const;
export type ListKey = (typeof LIST_KEYS)[number];

export interface FicheLists {
  services?: ListFact<ServiceItem>;
  certifications?: ListFact<Credential>;
  exceptions?: ListFact<HoursException>;
  sameAs?: ListFact<string>;
}

export interface FichePublication {
  /** opt-in explicite : la page /p/<slug> peut être indexée (jamais pour un compte démo) */
  indexable: boolean;
  indexableAt?: string;
  /** l'encart injecte aussi le JSON-LD sur la page du client */
  embedJsonLd: boolean;
}

/** Valeurs lues sur le site du client (bouton « Relire mon site »). */
export interface SiteObservation {
  url: string;
  at: string;
  name?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  horaires?: string;
  sameAs?: string[];
  pages: string[];
  errors: string[];
}

export interface OfficialFiche extends FicheLists {
  businessId: string;
  version: 1;
  text: Partial<Record<TextKey, TextFact>>;
  /** dernière confirmation globale « c'est à jour » par le client */
  confirmedAt?: string;
  confirmedBy?: string;
  publication: FichePublication;
  observed?: { site?: SiteObservation };
  /** collections reprises lors de la migration */
  migratedFrom?: string[];
  updatedAt: string;
  /** compte de démonstration (jamais enregistré, jamais de JSON-LD) */
  demo?: boolean;
}

/** Saisie du client (formulaire /app/fiche) : chaîne vide = effacer. */
export interface FichePatch {
  text?: Partial<Record<TextKey, string>>;
  services?: ServiceItem[];
  certifications?: Credential[];
  exceptions?: HoursException[];
  sameAs?: string[];
  /** faits à marquer vérifiés sans changer la valeur (ex. accepter une valeur lue sur le site) */
  accept?: { key: TextKey; value: string; source: FactSource }[];
}

export interface FicheActor {
  id: string;
  email?: string | null;
}

/** Incohérence entre la fiche et une autre source. */
export interface FicheAlert {
  id: string;
  field: TextKey | 'services' | 'sameAs';
  label: string;
  severity: 'haute' | 'moyenne' | 'basse';
  /** valeur de la fiche officielle */
  expected: string | null;
  where: 'site' | 'google' | 'ia';
  /** nom lisible de la source (« votre site », « votre fiche Google », « ChatGPT ») */
  whereLabel: string;
  found: string;
  at?: string;
  /** ce qu'il faut faire */
  fix: string;
  href?: string;
}

export class FicheError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'fiche_error',
    public readonly errors?: Record<string, string>,
  ) {
    super(message);
  }
}
