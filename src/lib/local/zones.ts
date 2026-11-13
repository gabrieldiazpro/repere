/**
 * Grilles de zones pour la carte de visibilité (schématique, coordonnées 0–100, nord en haut, pas de fond de carte).
 * Paris, Lyon, Marseille : arrondissements. 12 villes suivantes (population) : quartiers usuels. Ailleurs : centre + 8
 * secteurs cardinaux autour de l'adresse. Positions approximatives, destinées à un dessin, pas à la géolocalisation.
 */
import { zoneInfo } from '@/lib/engine';
import type { Zone, ZoneGrid } from './types';
import { fold } from './util';

type Row = [label: string, x: number, y: number, hint?: string];

const ARR: Record<string, { city: string; rows: Row[] }> = {
  paris: {
    city: 'Paris',
    rows: [
      ['1', 47, 45, 'Louvre'], ['2', 50, 40, 'Bourse'], ['3', 55, 42, 'Haut-Marais'], ['4', 54, 49, 'Marais'],
      ['5', 51, 57, 'Quartier latin'], ['6', 45, 55, 'Saint-Germain-des-Prés'], ['7', 37, 50, 'Invalides'], ['8', 37, 38, 'Champs-Élysées'],
      ['9', 48, 33, 'Opéra'], ['10', 57, 33, 'Canal Saint-Martin'], ['11', 63, 46, 'Oberkampf'], ['12', 68, 61, 'Bercy'],
      ['13', 56, 71, 'Butte-aux-Cailles'], ['14', 43, 71, 'Montparnasse'], ['15', 30, 63, 'Convention'], ['16', 17, 48, 'Passy'],
      ['17', 33, 24, 'Batignolles'], ['18', 50, 17, 'Montmartre'], ['19', 67, 24, 'Buttes-Chaumont'], ['20', 76, 42, 'Belleville'],
    ],
  },
  lyon: {
    city: 'Lyon',
    rows: [
      ['1', 48, 42, 'Pentes de la Croix-Rousse'], ['2', 46, 56, 'Bellecour'], ['3', 62, 52, 'Part-Dieu'], ['4', 47, 28, 'Croix-Rousse'],
      ['5', 35, 52, 'Vieux-Lyon'], ['6', 60, 37, 'Brotteaux'], ['7', 54, 73, 'Guillotière'], ['8', 72, 72, 'Monplaisir'], ['9', 30, 24, 'Vaise'],
    ],
  },
  marseille: {
    city: 'Marseille',
    rows: [
      ['1', 45, 50, 'Noailles'], ['2', 39, 42, 'Le Panier'], ['3', 50, 37, 'Belle de Mai'], ['4', 58, 45, 'Cinq-Avenues'],
      ['5', 55, 54, 'Baille'], ['6', 47, 58, 'Castellane'], ['7', 35, 60, 'Endoume'], ['8', 42, 78, 'Prado'],
      ['9', 58, 86, 'Mazargues'], ['10', 66, 68, 'Saint-Loup'], ['11', 83, 60, 'La Valentine'], ['12', 72, 47, 'Saint-Barnabé'],
      ['13', 68, 24, 'Château-Gombert'], ['14', 52, 25, 'Sainte-Marthe'], ['15', 36, 18, 'Saint-Antoine'], ['16', 21, 25, 'L’Estaque'],
    ],
  },
};

const QUARTIERS: Record<string, { city: string; rows: Row[] }> = {
  toulouse: { city: 'Toulouse', rows: [['Capitole', 50, 48], ['Saint-Cyprien', 37, 52], ['Carmes', 50, 57], ['Minimes', 48, 28], ['Compans-Caffarelli', 39, 37], ['Saint-Michel', 52, 67], ['Rangueil', 60, 80], ['Côte Pavée', 69, 52], ['Purpan', 24, 42]] },
  nice: { city: 'Nice', rows: [['Vieux-Nice', 56, 62], ['Carré d’Or', 45, 58], ['Libération', 45, 40], ['Cimiez', 55, 28], ['Port', 67, 58], ['Riquier', 69, 47], ['Magnan', 30, 60], ['Saint-Roch', 62, 38], ['Fabron', 17, 55]] },
  nantes: { city: 'Nantes', rows: [['Bouffay', 50, 50], ['Île de Nantes', 50, 66], ['Chantenay', 24, 58], ['Doulon', 76, 45], ['Erdre', 55, 30], ['Hauts-Pavés', 40, 38], ['Malakoff', 66, 58], ['Nantes Nord', 46, 14], ['Breil', 32, 27]] },
  montpellier: { city: 'Montpellier', rows: [['Écusson', 50, 50], ['Antigone', 60, 52], ['Port Marianne', 73, 63], ['Beaux-Arts', 55, 38], ['Boutonnet', 45, 34], ['Les Arceaux', 38, 50], ['Croix-d’Argent', 38, 71], ['Mosson', 14, 35], ['Hôpitaux-Facultés', 40, 19]] },
  strasbourg: { city: 'Strasbourg', rows: [['Grande Île', 50, 50], ['Krutenau', 58, 56], ['Neudorf', 55, 73], ['Orangerie', 62, 37], ['Esplanade', 67, 52], ['Cronenbourg', 27, 40], ['Koenigshoffen', 24, 56], ['Robertsau', 68, 19], ['Meinau', 48, 86]] },
  bordeaux: { city: 'Bordeaux', rows: [['Saint-Pierre', 55, 50], ['Chartrons', 52, 30], ['Saint-Michel', 55, 62], ['Bastide', 73, 50], ['Bacalan', 50, 14], ['Saint-Augustin', 29, 55], ['Nansouty', 45, 73], ['Caudéran', 24, 40], ['Saint-Seurin', 42, 45]] },
  lille: { city: 'Lille', rows: [['Vieux-Lille', 48, 34], ['Centre', 50, 50], ['Wazemmes', 40, 62], ['Moulins', 56, 68], ['Fives', 71, 48], ['Saint-Maurice Pellevoisin', 68, 35], ['Vauban-Esquermes', 31, 48], ['Lille-Sud', 48, 83], ['Bois-Blancs', 21, 37]] },
  rennes: { city: 'Rennes', rows: [['Centre', 50, 48], ['Thabor', 61, 45], ['Sainte-Thérèse', 55, 66], ['Bréquigny', 42, 79], ['Cleunay', 29, 58], ['Villejean', 30, 29], ['Maurepas', 62, 27], ['Jeanne d’Arc', 69, 40], ['Beauregard', 40, 20]] },
  toulon: { city: 'Toulon', rows: [['Haute-Ville', 50, 50], ['Le Mourillon', 66, 69], ['Le Port', 50, 63], ['Saint-Jean-du-Var', 66, 44], ['La Rode', 60, 56], ['Pont-du-Las', 31, 48], ['Saint-Roch', 40, 41], ['Les Routes', 35, 29], ['Cap Brun', 81, 62]] },
  reims: { city: 'Reims', rows: [['Centre', 50, 50], ['Clairmarais', 40, 35], ['Saint-Remi', 58, 66], ['Cernay', 69, 35], ['Orgeval', 45, 19], ['Croix-Rouge', 29, 66], ['Murigny', 50, 83], ['Laon-Zola', 51, 29], ['Jean-Jaurès', 66, 48]] },
  'saint etienne': { city: 'Saint-Étienne', rows: [['Hôtel de Ville', 50, 50], ['Jacquard', 39, 48], ['Bellevue', 48, 71], ['Carnot', 52, 31], ['Châteaucreux', 63, 42], ['Montreynaud', 69, 21], ['La Terrasse', 52, 17], ['Côte-Chaude', 34, 62], ['Solaure', 66, 65]] },
  'le havre': { city: 'Le Havre', rows: [['Centre-ville', 40, 58], ['Saint-François', 48, 66], ['Saint-Vincent', 31, 60], ['Sanvic', 30, 39], ['Danton', 55, 47], ['Rond-Point', 63, 55], ['Graville', 76, 52], ['Mont-Gaillard', 60, 24], ['Caucriauville', 76, 34]] },
};

const CARDINAL: [id: string, label: string, x: number, y: number][] = [
  ['centre', 'centre', 50, 50], ['nord', 'nord', 50, 18], ['nord-est', 'nord-est', 73, 27], ['est', 'est', 82, 50], ['sud-est', 'sud-est', 73, 73],
  ['sud', 'sud', 50, 82], ['sud-ouest', 'sud-ouest', 27, 73], ['ouest', 'ouest', 18, 50], ['nord-ouest', 'nord-ouest', 27, 27],
];

export function cityKey(city: string): string {
  return fold(city).replace(/[-’']/g, ' ').replace(/\bst\b/g, 'saint').replace(/\s+/g, ' ').trim();
}

const de = (city: string) => (/^[aeiouyh]/i.test(fold(city)) ? `d’${city}` : `de ${city}`);
const ord = (n: number) => (n === 1 ? '1er' : `${n}e`);
const slug = (s: string) => fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Villes ayant une grille dédiée (arrondissements ou quartiers). */
export const GRID_CITIES: string[] = [...Object.values(ARR), ...Object.values(QUARTIERS)].map((c) => c.city);

/**
 * Grille de la ville. `district` (« 11e », « 75011 », « Capitole ») désigne la zone du commerce (`home`).
 */
export function buildZoneGrid(city: string, district?: string): ZoneGrid {
  const key = cityKey(city);
  const arr = ARR[key];
  if (arr) {
    const info = zoneInfo({ city: arr.city, district });
    const homeNum = info.arrNum ?? null;
    const hintMatch = district && !homeNum ? arr.rows.find((r) => r[3] && fold(r[3]).includes(fold(district))) : undefined;
    const zones: Zone[] = arr.rows.map(([n, x, y, hint]) => ({
      id: `arr-${n}`,
      label: `${arr.city} ${ord(Number(n))}`,
      hint,
      phrase: `dans le ${ord(Number(n))} arrondissement ${de(arr.city)}`,
      x,
      y,
      ...((homeNum && Number(n) === homeNum) || hintMatch?.[0] === n ? { home: true } : {}),
    }));
    return { city: arr.city, kind: 'arrondissements', zones: ensureHome(zones) };
  }
  const q = QUARTIERS[key];
  if (q) {
    const d = district ? fold(district) : '';
    const zones: Zone[] = q.rows.map(([label, x, y]) => ({
      id: `q-${slug(label)}`,
      label: `${q.city}, ${label}`,
      hint: label,
      phrase: `dans le quartier ${label} à ${q.city}`,
      x,
      y,
      ...(d && (fold(label).includes(d) || d.includes(fold(label))) ? { home: true } : {}),
    }));
    return { city: q.city, kind: 'quartiers', zones: ensureHome(zones) };
  }
  const name = city.trim().replace(/\s+/g, ' ').slice(0, 80) || 'votre ville';
  const zones: Zone[] = CARDINAL.map(([id, label, x, y]) => ({
    id: `c-${id}`,
    label: id === 'centre' ? `${name}, centre` : `${name}, secteur ${label}`,
    phrase: id === 'centre' ? `dans le centre ${de(name)}` : `dans le secteur ${label} ${de(name)}`,
    x,
    y,
    ...(id === 'centre' ? { home: true } : {}),
  }));
  return { city: name, kind: 'cardinal', zones };
}

/** Zone du commerce par défaut : la plus centrale. */
function ensureHome(zones: Zone[]): Zone[] {
  if (zones.some((z) => z.home)) return zones;
  let best = 0;
  let bd = Infinity;
  zones.forEach((z, i) => {
    const d = (z.x - 50) ** 2 + (z.y - 50) ** 2;
    if (d < bd) [best, bd] = [i, d];
  });
  return zones.map((z, i) => (i === best ? { ...z, home: true } : z));
}

/** Les `n` zones les plus proches de la zone du commerce (elle comprise), pour tenir le budget. */
export function nearestZones(grid: ZoneGrid, n: number): Zone[] {
  const home = grid.zones.find((z) => z.home) ?? grid.zones[0];
  return [...grid.zones]
    .sort((a, b) => (a.home ? -1 : b.home ? 1 : 0) || (a.x - home.x) ** 2 + (a.y - home.y) ** 2 - ((b.x - home.x) ** 2 + (b.y - home.y) ** 2))
    .slice(0, Math.max(1, n));
}
