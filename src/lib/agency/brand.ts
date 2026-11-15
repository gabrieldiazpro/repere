/** Éléments de marque purs, utilisables côté client (aucune dépendance serveur). */
export const DEFAULT_AGENCY_COLOR = '#0f766e';

/** Initiales pour le monogramme quand l'agence n'a pas de logo (« Agence Exemple » → « AE »). */
export function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/[\s-]+/).filter(Boolean);
  const pick = words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2);
  return pick.toUpperCase();
}
