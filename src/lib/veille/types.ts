/**
 * Veille « ce qui change pour votre visibilité sur Google et dans les IA » (V9, agent VEILLE).
 *
 * Règle éditoriale : une fiche n'affirme que ce que ses sources confirment. Ce qui reste incertain est écrit dans
 * `uncertain` et affiché comme tel. Chaque source porte sa date de publication (si elle est indiquée) et la date à
 * laquelle nous l'avons consultée.
 */

/** Statut de l'évènement à la date de mise à jour de la fiche. */
export type VeilleStatus = 'en-vigueur' | 'annonce' | 'a-venir';

export type VeilleTheme = 'google' | 'ia' | 'droit' | 'commerce' | 'local' | 'technique';

export type VeilleAudience = 'local' | 'pme' | 'ecommerce' | 'agences';

export interface VeilleSource {
  label: string;
  url: string;
  /** Éditeur (Google, Commission européenne, CNIL…). */
  publisher: string;
  /** Date de publication ou de dernière mise à jour affichée par la source (ISO), si elle existe. */
  published?: string;
  /** Date à laquelle nous avons relu la source (ISO). */
  consulted: string;
  /** Source primaire (texte officiel, documentation de l'éditeur) ou secondaire (presse, cabinet). */
  primary: boolean;
  note?: string;
}

export interface VeilleDeadline {
  date: string;
  label: string;
}

export interface VeilleEntry {
  slug: string;
  /** Titre-résultat (h1). */
  title: string;
  /** Une à deux phrases : l'essentiel. */
  summary: string;
  /** Date de l'évènement (ISO). */
  eventDate: string;
  status: VeilleStatus;
  /** Précision sur le statut (ex. « déploiement en cours au 23 novembre 2026 »). */
  statusNote?: string;
  themes: VeilleTheme[];
  audiences: VeilleAudience[];
  /** Ce qui change (faits sourcés). */
  changes: string[];
  /** Ce qu'il faut faire. */
  actions: string[];
  /** Points non confirmés par les sources consultées. */
  uncertain?: string[];
  deadlines: VeilleDeadline[];
  sources: VeilleSource[];
  /** Guides liés (slugs de src/lib/seo/guides*). */
  guides: string[];
  /** Outils et pages liés (chemins internes). */
  tools: { href: string; label: string }[];
  /** Date de dernière vérification de la fiche (ISO). */
  updated: string;
}

export const STATUS_LABEL: Record<VeilleStatus, string> = {
  'en-vigueur': 'En vigueur',
  annonce: 'Annoncé',
  'a-venir': 'À venir',
};

export const THEME_LABEL: Record<VeilleTheme, string> = {
  google: 'Google',
  ia: 'Assistants IA',
  droit: 'Droit et conformité',
  commerce: 'E-commerce',
  local: 'Commerce local',
  technique: 'Technique',
};

export const AUDIENCE_LABEL: Record<VeilleAudience, string> = {
  local: 'Commerces locaux',
  pme: 'PME et B2B',
  ecommerce: 'E-commerce',
  agences: 'Agences',
};
