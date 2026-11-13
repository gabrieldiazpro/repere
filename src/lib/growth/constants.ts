/**
 * Constantes de la boucle de croissance (docs/v3/11-outils-gratuits.md §2, points à valider §4).
 * Valeurs de départ, à confirmer par le fondateur : elles sont publiées sur /classement et /badge.
 */

/** Collections du store (préfixe du module). */
export const COLLECTIONS = {
  cards: 'growth.cards',
  badges: 'growth.badges',
  ranking: 'growth.ranking',
  refCodes: 'growth.refcodes',
  referrals: 'growth.referrals',
  rewards: 'growth.rewards',
} as const;

export const DAY_MS = 86_400_000;

/** Le badge ne s'affiche que pour une mesure réelle de moins de 45 jours. */
export const BADGE_MAX_AGE_DAYS = 45;

/** Nombre minimal de commerces inscrits (mesure réelle récente) avant de publier un classement métier × ville. */
export const RANKING_MIN_ENTRIES = 10;

/** Fraîcheur de la mesure pour figurer au classement (même règle que le badge). */
export const RANKING_MAX_AGE_DAYS = BADGE_MAX_AGE_DAYS;

/** Mention obligatoire : le badge est une mesure datée, pas un label ni une certification. */
export const BADGE_DISCLAIMER = 'Mesure datée, pas une certification : les IA varient d’une réponse à l’autre.';
