// Listes pour l'autocomplete du formulaire, générées depuis docs/10-seo-data.json (ne pas éditer à la main).
export interface TradeOption { slug: string; nom: string }
export interface CityOption { slug: string; nom: string }
export interface ArrondissementOption { slug: string; nom: string; short: string; quartiers: string[] }

import { isRegulatedTrade } from '@/lib/regulated';

const ALL_TRADES: TradeOption[] = [
  {
    "slug": "plombier",
    "nom": "Plombier"
  },
  {
    "slug": "electricien",
    "nom": "Électricien"
  },
  {
    "slug": "serrurier",
    "nom": "Serrurier"
  },
  {
    "slug": "chauffagiste",
    "nom": "Chauffagiste"
  },
  {
    "slug": "couvreur",
    "nom": "Couvreur"
  },
  {
    "slug": "peintre-en-batiment",
    "nom": "Peintre en bâtiment"
  },
  {
    "slug": "menuisier",
    "nom": "Menuisier"
  },
  {
    "slug": "restaurant",
    "nom": "Restaurant"
  },
  {
    "slug": "coiffeur",
    "nom": "Coiffeur"
  },
  {
    "slug": "institut-de-beaute",
    "nom": "Institut de beauté"
  },
  {
    "slug": "dentiste",
    "nom": "Dentiste"
  },
  {
    "slug": "osteopathe",
    "nom": "Ostéopathe"
  },
  {
    "slug": "kinesitherapeute",
    "nom": "Kinésithérapeute"
  },
  {
    "slug": "avocat",
    "nom": "Avocat"
  },
  {
    "slug": "expert-comptable",
    "nom": "Expert-comptable"
  },
  {
    "slug": "agence-immobiliere",
    "nom": "Agence immobilière"
  },
  {
    "slug": "garage-automobile",
    "nom": "Garage automobile"
  },
  {
    "slug": "fleuriste",
    "nom": "Fleuriste"
  },
  {
    "slug": "photographe",
    "nom": "Photographe"
  },
  {
    "slug": "auto-ecole",
    "nom": "Auto-école"
  }
];

/** Les professions réglementées ne sont pas proposées (qa/ARBITRAGES.md n° 8). */
export const TRADES: TradeOption[] = ALL_TRADES.filter((t) => !isRegulatedTrade(t.nom));

export const CITIES: CityOption[] = [{ slug: 'paris', nom: 'Paris' }, ...[
  {
    "slug": "marseille",
    "nom": "Marseille"
  },
  {
    "slug": "lyon",
    "nom": "Lyon"
  },
  {
    "slug": "toulouse",
    "nom": "Toulouse"
  },
  {
    "slug": "nice",
    "nom": "Nice"
  },
  {
    "slug": "nantes",
    "nom": "Nantes"
  },
  {
    "slug": "montpellier",
    "nom": "Montpellier"
  },
  {
    "slug": "strasbourg",
    "nom": "Strasbourg"
  },
  {
    "slug": "bordeaux",
    "nom": "Bordeaux"
  },
  {
    "slug": "lille",
    "nom": "Lille"
  },
  {
    "slug": "rennes",
    "nom": "Rennes"
  },
  {
    "slug": "reims",
    "nom": "Reims"
  },
  {
    "slug": "saint-etienne",
    "nom": "Saint-Étienne"
  },
  {
    "slug": "toulon",
    "nom": "Toulon"
  },
  {
    "slug": "le-havre",
    "nom": "Le Havre"
  },
  {
    "slug": "grenoble",
    "nom": "Grenoble"
  }
]];

export const ARRONDISSEMENTS: ArrondissementOption[] = [
  {
    "slug": "paris-1er",
    "nom": "Paris 1er",
    "quartiers": [
      "Louvre",
      "Tuileries",
      "Les Halles",
      "Palais-Royal"
    ],
    "short": "1er"
  },
  {
    "slug": "paris-2e",
    "nom": "Paris 2e",
    "quartiers": [
      "Sentier",
      "Bourse",
      "Montorgueil",
      "Vivienne"
    ],
    "short": "2e"
  },
  {
    "slug": "paris-3e",
    "nom": "Paris 3e",
    "quartiers": [
      "Haut-Marais",
      "Arts-et-Métiers",
      "Temple",
      "Enfants-Rouges"
    ],
    "short": "3e"
  },
  {
    "slug": "paris-4e",
    "nom": "Paris 4e",
    "quartiers": [
      "Le Marais",
      "Île Saint-Louis",
      "Notre-Dame",
      "Hôtel-de-Ville"
    ],
    "short": "4e"
  },
  {
    "slug": "paris-5e",
    "nom": "Paris 5e",
    "quartiers": [
      "Quartier Latin",
      "Jardin des Plantes",
      "Mouffetard",
      "Val-de-Grâce"
    ],
    "short": "5e"
  },
  {
    "slug": "paris-6e",
    "nom": "Paris 6e",
    "quartiers": [
      "Saint-Germain-des-Prés",
      "Odéon",
      "Luxembourg",
      "Notre-Dame-des-Champs"
    ],
    "short": "6e"
  },
  {
    "slug": "paris-7e",
    "nom": "Paris 7e",
    "quartiers": [
      "Invalides",
      "Tour Eiffel",
      "Saint-Thomas-d'Aquin",
      "Gros-Caillou"
    ],
    "short": "7e"
  },
  {
    "slug": "paris-8e",
    "nom": "Paris 8e",
    "quartiers": [
      "Madeleine",
      "Champs-Élysées",
      "Europe",
      "Saint-Lazare"
    ],
    "short": "8e"
  },
  {
    "slug": "paris-9e",
    "nom": "Paris 9e",
    "quartiers": [
      "Opéra",
      "Pigalle",
      "Saint-Georges",
      "Grands Boulevards"
    ],
    "short": "9e"
  },
  {
    "slug": "paris-10e",
    "nom": "Paris 10e",
    "quartiers": [
      "Canal Saint-Martin",
      "Gare du Nord",
      "Gare de l'Est",
      "Château d'Eau"
    ],
    "short": "10e"
  },
  {
    "slug": "paris-11e",
    "nom": "Paris 11e",
    "quartiers": [
      "Bastille",
      "Oberkampf",
      "Voltaire",
      "Charonne"
    ],
    "short": "11e"
  },
  {
    "slug": "paris-12e",
    "nom": "Paris 12e",
    "quartiers": [
      "Bercy",
      "Gare de Lyon",
      "Daumesnil",
      "Nation"
    ],
    "short": "12e"
  },
  {
    "slug": "paris-13e",
    "nom": "Paris 13e",
    "quartiers": [
      "Butte-aux-Cailles",
      "Place d'Italie",
      "Olympiades",
      "Bibliothèque"
    ],
    "short": "13e"
  },
  {
    "slug": "paris-14e",
    "nom": "Paris 14e",
    "quartiers": [
      "Montparnasse",
      "Alésia",
      "Pernety",
      "Montsouris"
    ],
    "short": "14e"
  },
  {
    "slug": "paris-15e",
    "nom": "Paris 15e",
    "quartiers": [
      "Vaugirard",
      "Convention",
      "Beaugrenelle",
      "Commerce"
    ],
    "short": "15e"
  },
  {
    "slug": "paris-16e",
    "nom": "Paris 16e",
    "quartiers": [
      "Passy",
      "Auteuil",
      "Trocadéro",
      "La Muette"
    ],
    "short": "16e"
  },
  {
    "slug": "paris-17e",
    "nom": "Paris 17e",
    "quartiers": [
      "Batignolles",
      "Ternes",
      "Épinettes",
      "Monceau"
    ],
    "short": "17e"
  },
  {
    "slug": "paris-18e",
    "nom": "Paris 18e",
    "quartiers": [
      "Montmartre",
      "Barbès",
      "La Chapelle",
      "Goutte d'Or"
    ],
    "short": "18e"
  },
  {
    "slug": "paris-19e",
    "nom": "Paris 19e",
    "quartiers": [
      "Buttes-Chaumont",
      "La Villette",
      "Jaurès",
      "Bassin de la Villette"
    ],
    "short": "19e"
  },
  {
    "slug": "paris-20e",
    "nom": "Paris 20e",
    "quartiers": [
      "Belleville",
      "Ménilmontant",
      "Père-Lachaise",
      "Gambetta"
    ],
    "short": "20e"
  }
];
