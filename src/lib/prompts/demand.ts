/**
 * Indice de demande (décision 4 de docs/v3/12-CONTRATS-V3.md) : faible / moyen / fort, étiqueté « estimation ».
 * Règle déterministe et publiée (src/lib/prompts/METHODE.md) : type d'intention, généricité, présence d'une ville.
 * JAMAIS de volume chiffré : la fonction ne renvoie qu'un niveau et les signaux lus dans la question.
 */
import { contentTokens, normalizeQuestion } from './text';
import type { DemandIndex, DemandLevel, PromptIntent } from './types';

/** Points d'intention : les intentions larges de découverte sont les plus posées. */
export const INTENT_POINTS: Record<PromptIntent, number> = {
  recommandation: 2,
  proximite: 2,
  avis: 1,
  urgence: 1,
  prix: 1,
  achat: 1,
  comparatif: 0,
  alternative: 0,
  service: 0,
  marque: -1,
};

/** Grandes villes (plus de 150 000 habitants, INSEE) : une ville de cette liste ne réduit pas l'indice. */
export const LARGE_CITIES = [
  'paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'montpellier', 'strasbourg', 'bordeaux', 'lille',
  'rennes', 'reims', 'toulon', 'saint etienne', 'le havre', 'grenoble', 'dijon', 'angers', 'villeurbanne', 'nimes',
  'clermont ferrand', 'aix en provence', 'le mans', 'brest', 'tours', 'amiens', 'limoges',
];

export interface DemandContext {
  /** ville déclarée du commerce (détectée dans la question si elle y figure) */
  city?: string;
  /** quartier / arrondissement déclaré */
  district?: string;
  /** noms propres connus (client, concurrents) : leur présence rend la question plus pointue */
  names?: string[];
}

function has(n: string, needle: string): boolean {
  const k = normalizeQuestion(needle);
  return k.length >= 2 && ` ${n} `.includes(` ${k} `);
}

/**
 * Calcul :
 *   points = intention (−1 à +2) + généricité (0 à +2) − ville (0 à 2) − nom propre (0 ou 1)
 *   fort ≥ 3 ; moyen = 1 ou 2 ; faible ≤ 0.
 */
export function demandIndex(text: string, intent: PromptIntent, ctx: DemandContext = {}): DemandIndex {
  const n = normalizeQuestion(text);
  const signals: string[] = [];
  let pts = INTENT_POINTS[intent];
  signals.push(
    pts >= 2 ? 'intention de découverte, très posée' : pts === 1 ? 'intention courante' : pts === 0 ? 'intention pointue' : 'question sur une marque précise',
  );

  // Généricité : nombre de mots porteurs de sens (hors ville, quartier et mots vides).
  const placeWords = new Set(
    [ctx.city, ctx.district, ...LARGE_CITIES].filter(Boolean).flatMap((s) => contentTokens(String(s))),
  );
  const words = contentTokens(text).filter((w) => !placeWords.has(w) && !/^\d+(e|er|eme)?$/.test(w));
  if (words.length <= 3) {
    pts += 2;
    signals.push('formulation courte et générique');
  } else if (words.length <= 6) {
    pts += 1;
    signals.push('formulation de longueur moyenne');
  } else {
    signals.push('formulation longue et précise');
  }

  // Ville : une question locale est posée par moins de monde qu'une question nationale.
  const cityInText = ctx.city && has(n, ctx.city) ? normalizeQuestion(ctx.city) : LARGE_CITIES.find((c) => has(n, c)) ?? null;
  const districtInText =
    (ctx.district && has(n, ctx.district)) || /\b\d{1,2}(e|er|eme)\b|\b\d{5}\b|arrondissement|quartier/.test(n);
  if (cityInText) {
    if (LARGE_CITIES.includes(cityInText)) signals.push('grande ville');
    else {
      pts -= 1;
      signals.push('ville de taille moyenne ou petite');
    }
  }
  if (districtInText) {
    pts -= 1;
    signals.push('quartier ou arrondissement');
  }

  if ((ctx.names ?? []).some((name) => has(n, name))) {
    pts -= 1;
    signals.push('cite un nom de marque');
  }

  const level: DemandLevel = pts >= 3 ? 'fort' : pts >= 1 ? 'moyen' : 'faible';
  return { level, label: 'estimation', signals };
}

export const DEMAND_LABEL: Record<DemandLevel, string> = { faible: 'Faible', moyen: 'Moyen', fort: 'Fort' };
