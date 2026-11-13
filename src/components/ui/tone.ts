/** Tons sémantiques V4 : progrès = vert, recul = rouge, attention = ambre, neutre = gris, marque = indigo. */
export type Tone = 'up' | 'down' | 'warn' | 'neutral' | 'brand';

/** Ton d'une variation : positif = progrès, négatif = recul, nul = neutre. `invert` : une baisse est un progrès (ex. erreurs). */
export function deltaTone(value: number, invert = false): Tone {
  if (!value) return 'neutral';
  const good = invert ? value < 0 : value > 0;
  return good ? 'up' : 'down';
}

/** Signe typographique d'une variation : « + », « − » (vrai signe moins) ou « ± 0 ». */
export function signed(value: number, decimals = 0): string {
  const abs = Math.abs(value).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (!value) return '0';
  return `${value > 0 ? '+' : '−'}${abs}`;
}
