/**
 * Génération des requêtes (méthode 03 § 2) : dictionnaire TRADES, gabarits T1–T10, sélection.
 * Les requêtes ne contiennent JAMAIS le nom du commerce (partage du cache par couple métier × zone).
 */
import type { AuditInput, QueryIntent, QuerySpec } from './types';
import { capitalize, shortHash, stripAccents } from './util';

export type TradeFamily =
  | 'btp'
  | 'restauration'
  | 'sante_bienetre'
  | 'immobilier'
  | 'beaute'
  | 'juridique_compta'
  | 'autre';

export interface TradeInfo {
  key: string;
  aliases: string[];
  /** libellé singulier tel qu'utilisé dans les requêtes */
  label: string;
  plural: string;
  activity: string;
  family: TradeFamily;
  /** genre grammatical du libellé */
  g: 'm' | 'f';
  /** services avec article défini (« la recherche de fuite ») */
  services: string[];
  urgency: string | null;
  /** cuisine pour « Où manger {cuisine} ce soir… » (restaurants) */
  cuisine?: string | null;
  food?: boolean;
  /** mots génériques du métier, retirés du nom pour obtenir la variante `core` */
  words: string[];
}

type T = Omit<TradeInfo, 'aliases' | 'g' | 'words'> & { aliases?: string[]; g?: 'm' | 'f'; words?: string[] };

const RAW: T[] = [
  // BTP
  { key: 'plombier', aliases: ['plomberie', 'plombier chauffagiste'], label: 'plombier', plural: 'plombiers', activity: 'plomberie', family: 'btp', services: ['la recherche de fuite', 'le débouchage de canalisations', 'le remplacement de chauffe-eau'], urgency: "fuite d'eau", words: ['plomberie', 'plombier', 'chauffagiste', 'chauffage', 'sanitaire', 'depannage'] },
  { key: 'electricien', aliases: ['electricite'], label: 'électricien', plural: 'électriciens', activity: 'électricité', family: 'btp', services: ['la mise aux normes électrique', 'le dépannage électrique', "l'installation de bornes de recharge"], urgency: 'panne de courant', words: ['electricien', 'electricite', 'elec', 'depannage'] },
  { key: 'serrurier', aliases: ['serrurerie'], label: 'serrurier', plural: 'serruriers', activity: 'serrurerie', family: 'btp', services: ["l'ouverture de porte", 'le remplacement de serrure', 'la pose de porte blindée'], urgency: 'porte claquée', words: ['serrurier', 'serrurerie', 'depannage'] },
  { key: 'chauffagiste', aliases: ['chauffage'], label: 'chauffagiste', plural: 'chauffagistes', activity: 'chauffage', family: 'btp', services: ["l'entretien de chaudière", "l'installation de pompe à chaleur"], urgency: 'chaudière en panne', words: ['chauffagiste', 'chauffage', 'thermique', 'energie'] },
  { key: 'peintre', aliases: ['peintre en batiment', 'peinture'], label: 'peintre en bâtiment', plural: 'peintres en bâtiment', activity: 'peinture', family: 'btp', services: ["la peinture d'intérieur", 'le ravalement de façade'], urgency: null, words: ['peintre', 'peinture', 'batiment', 'decoration'] },
  { key: 'menuisier', aliases: ['menuiserie', 'ebeniste'], label: 'menuisier', plural: 'menuisiers', activity: 'menuiserie', family: 'btp', services: ['la pose de fenêtres', 'les placards sur mesure'], urgency: null, words: ['menuisier', 'menuiserie', 'ebenisterie', 'bois'] },
  { key: 'macon', aliases: ['maconnerie'], label: 'maçon', plural: 'maçons', activity: 'maçonnerie', family: 'btp', services: ['la rénovation de murs', "l'ouverture de mur porteur"], urgency: null, words: ['macon', 'maconnerie', 'batiment', 'construction', 'renovation'] },
  { key: 'couvreur', aliases: ['couverture', 'toiture'], label: 'couvreur', plural: 'couvreurs', activity: 'couverture', family: 'btp', services: ['la réparation de toiture', 'le nettoyage de gouttières'], urgency: 'fuite de toiture', words: ['couvreur', 'couverture', 'toiture', 'zinguerie'] },
  { key: 'carreleur', aliases: ['carrelage'], label: 'carreleur', plural: 'carreleurs', activity: 'carrelage', family: 'btp', services: ['la pose de carrelage', 'la rénovation de salle de bain'], urgency: null, words: ['carreleur', 'carrelage'] },
  { key: 'vitrier', aliases: ['miroiterie'], label: 'vitrier', plural: 'vitriers', activity: 'vitrerie', family: 'btp', services: ['le remplacement de vitre', 'le double vitrage'], urgency: 'vitre cassée', words: ['vitrier', 'vitrerie', 'miroiterie'] },
  { key: 'paysagiste', aliases: ['jardinier'], label: 'paysagiste', plural: 'paysagistes', activity: 'aménagement paysager', family: 'btp', services: ["l'entretien de jardin", "l'aménagement de terrasse"], urgency: null, words: ['paysagiste', 'jardin', 'jardins', 'paysage'] },
  // Restauration
  { key: 'restaurant', aliases: ['resto'], label: 'restaurant', plural: 'restaurants', activity: 'restauration', family: 'restauration', services: ['la cuisine maison', 'le brunch'], urgency: null, cuisine: null, food: true, words: ['restaurant', 'resto', 'bistrot', 'brasserie', 'cantine', 'table'] },
  { key: 'restaurant italien', aliases: ['italien', 'trattoria'], label: 'restaurant italien', plural: 'restaurants italiens', activity: 'cuisine italienne', family: 'restauration', services: ['les pâtes fraîches', 'la pizza napolitaine'], urgency: null, cuisine: 'italien', food: true, words: ['restaurant', 'trattoria', 'pizzeria', 'osteria', 'ristorante'] },
  { key: 'restaurant japonais', aliases: ['japonais', 'sushi'], label: 'restaurant japonais', plural: 'restaurants japonais', activity: 'cuisine japonaise', family: 'restauration', services: ['les sushis', 'les ramen'], urgency: null, cuisine: 'japonais', food: true, words: ['restaurant', 'sushi', 'ramen'] },
  { key: 'restaurant libanais', aliases: ['libanais'], label: 'restaurant libanais', plural: 'restaurants libanais', activity: 'cuisine libanaise', family: 'restauration', services: ['les mezzés', 'les grillades libanaises'], urgency: null, cuisine: 'libanais', food: true, words: ['restaurant', 'traiteur'] },
  { key: 'pizzeria', aliases: ['pizza'], label: 'pizzeria', g: 'f', plural: 'pizzerias', activity: 'pizza', family: 'restauration', services: ['la pizza au feu de bois', 'la pizza napolitaine'], urgency: null, cuisine: 'une pizza', food: true, words: ['pizzeria', 'pizza', 'pizze'] },
  { key: 'creperie', aliases: ['crepes'], label: 'crêperie', g: 'f', plural: 'crêperies', activity: 'crêpes', family: 'restauration', services: ['les galettes de sarrasin', 'les crêpes bretonnes'], urgency: null, cuisine: 'des crêpes', food: true, words: ['creperie', 'crepes', 'creperie bretonne'] },
  { key: 'brasserie', aliases: ['bistrot'], label: 'brasserie', g: 'f', plural: 'brasseries', activity: 'brasserie', family: 'restauration', services: ['le plat du jour', 'les fruits de mer'], urgency: null, cuisine: null, food: true, words: ['brasserie', 'bistrot', 'cafe', 'restaurant'] },
  { key: 'traiteur', aliases: [], label: 'traiteur', plural: 'traiteurs', activity: 'traiteur', family: 'restauration', services: ['le buffet pour événement', 'les plateaux-repas'], urgency: null, cuisine: null, food: false, words: ['traiteur', 'reception'] },
  // Beauté
  { key: 'coiffeur', aliases: ['coiffure', 'salon de coiffure', 'coiffeuse'], label: 'coiffeur', plural: 'coiffeurs', activity: 'coiffure', family: 'beaute', services: ['la coloration', 'la coupe homme', 'le balayage'], urgency: null, words: ['coiffure', 'coiffeur', 'salon', 'hair', 'studio'] },
  { key: 'barbier', aliases: ['barber', 'barbershop'], label: 'barbier', plural: 'barbiers', activity: 'barberie', family: 'beaute', services: ['la taille de barbe', 'le rasage à l\'ancienne'], urgency: null, words: ['barbier', 'barber', 'barbershop', 'shop'] },
  { key: 'estheticienne', aliases: ['institut de beaute', 'institut', 'esthetique'], label: 'institut de beauté', plural: 'instituts de beauté', activity: 'esthétique', family: 'beaute', services: ["l'épilation", 'les soins du visage', 'le massage relaxant'], urgency: null, words: ['institut', 'beaute', 'esthetique', 'spa', 'soins'] },
  { key: 'onglerie', aliases: ['prothesiste ongulaire', 'manucure', 'nail bar'], label: 'onglerie', g: 'f', plural: 'ongleries', activity: 'manucure', family: 'beaute', services: ['la pose de vernis semi-permanent', 'la manucure russe'], urgency: null, words: ['onglerie', 'nails', 'nail', 'ongles', 'beaute'] },
  { key: 'tatoueur', aliases: ['tatouage', 'tattoo'], label: 'tatoueur', plural: 'tatoueurs', activity: 'tatouage', family: 'beaute', services: ['le tatouage fineline', 'le recouvrement de tatouage'], urgency: null, words: ['tattoo', 'tatouage', 'ink', 'studio'] },
  // Santé / bien-être
  { key: 'dentiste', aliases: ['chirurgien dentiste', 'cabinet dentaire'], label: 'dentiste', plural: 'dentistes', activity: 'soins dentaires', family: 'sante_bienetre', services: ['les implants dentaires', 'le blanchiment des dents'], urgency: 'rage de dents', words: ['dentiste', 'dentaire', 'cabinet', 'centre', 'docteur', 'dr'] },
  { key: 'osteopathe', aliases: ['osteo', 'osteopathie'], label: 'ostéopathe', plural: 'ostéopathes', activity: 'ostéopathie', family: 'sante_bienetre', services: ["l'ostéopathie du sportif", "l'ostéopathie pour nourrissons"], urgency: 'blocage du dos', words: ['osteopathe', 'osteopathie', 'cabinet'] },
  { key: 'kinesitherapeute', aliases: ['kine', 'kinesitherapie'], label: 'kinésithérapeute', plural: 'kinésithérapeutes', activity: 'kinésithérapie', family: 'sante_bienetre', services: ['la rééducation du genou', 'la kiné respiratoire'], urgency: null, words: ['kine', 'kinesitherapie', 'kinesitherapeute', 'cabinet'] },
  { key: 'medecin generaliste', aliases: ['medecin', 'generaliste'], label: 'médecin généraliste', plural: 'médecins généralistes', activity: 'médecine générale', family: 'sante_bienetre', services: ['les consultations sans rendez-vous', 'le suivi pédiatrique'], urgency: 'fièvre qui ne baisse pas', words: ['medecin', 'cabinet', 'docteur', 'dr', 'centre', 'medical'] },
  { key: 'veterinaire', aliases: ['clinique veterinaire', 'veto'], label: 'vétérinaire', plural: 'vétérinaires', activity: 'soins vétérinaires', family: 'sante_bienetre', services: ['la vaccination des chats', 'la stérilisation'], urgency: 'chien malade', words: ['veterinaire', 'clinique', 'cabinet', 'veto'] },
  { key: 'psychologue', aliases: ['psy', 'psychotherapeute'], label: 'psychologue', plural: 'psychologues', activity: 'psychologie', family: 'sante_bienetre', services: ['la thérapie de couple', 'la thérapie cognitive et comportementale'], urgency: null, words: ['psychologue', 'cabinet', 'psy'] },
  { key: 'opticien', aliases: ['optique', 'lunetterie'], label: 'opticien', plural: 'opticiens', activity: 'optique', family: 'sante_bienetre', services: ['les lentilles de contact', "l'examen de vue"], urgency: 'lunettes cassées', words: ['opticien', 'optique', 'optic', 'lunettes', 'vision'] },
  { key: 'pharmacie', aliases: ['pharmacien'], label: 'pharmacie', g: 'f', plural: 'pharmacies', activity: 'pharmacie', family: 'sante_bienetre', services: ['la préparation magistrale', 'les tests rapides'], urgency: 'besoin de médicaments ce soir', words: ['pharmacie', 'pharma', 'parapharmacie'] },
  // Immobilier
  { key: 'agence immobiliere', aliases: ['immobilier', 'agent immobilier'], label: 'agence immobilière', g: 'f', plural: 'agences immobilières', activity: 'immobilier', family: 'immobilier', services: ["l'estimation d'appartement", 'la gestion locative'], urgency: null, words: ['agence', 'immobilier', 'immobiliere', 'immo', 'transactions'] },
  { key: 'diagnostiqueur immobilier', aliases: ['diagnostic immobilier', 'dpe'], label: 'diagnostiqueur immobilier', plural: 'diagnostiqueurs immobiliers', activity: 'diagnostic immobilier', family: 'immobilier', services: ['le DPE', 'le diagnostic amiante'], urgency: null, words: ['diagnostic', 'diagnostics', 'diag', 'expertise', 'immobilier'] },
  // Juridique / comptabilité
  { key: 'avocat', aliases: ['cabinet d avocats', 'avocats'], label: 'avocat', plural: 'avocats', activity: 'conseil juridique', family: 'juridique_compta', services: ['le droit de la famille', 'le droit du travail'], urgency: 'garde à vue', words: ['avocat', 'avocats', 'cabinet', 'associes', 'conseil', 'law'] },
  { key: 'expert comptable', aliases: ['comptable', 'cabinet comptable', 'expertise comptable'], label: 'expert-comptable', plural: 'experts-comptables', activity: 'expertise comptable', family: 'juridique_compta', services: ['la comptabilité des indépendants', 'la création d\'entreprise'], urgency: null, words: ['expert', 'comptable', 'expertise', 'cabinet', 'conseil', 'audit', 'associes'] },
  { key: 'notaire', aliases: ['office notarial', 'etude notariale'], label: 'notaire', plural: 'notaires', activity: 'notariat', family: 'juridique_compta', services: ['la succession', "l'achat immobilier"], urgency: null, words: ['notaire', 'notaires', 'office', 'etude', 'associes'] },
  // Autres commerces et services
  { key: 'garagiste', aliases: ['garage', 'mecanicien', 'garage automobile'], label: 'garagiste', plural: 'garagistes', activity: 'mécanique automobile', family: 'autre', services: ['la vidange', 'le changement de plaquettes de frein', 'la réparation de carrosserie'], urgency: 'voiture en panne', words: ['garage', 'garagiste', 'auto', 'automobile', 'automobiles', 'mecanique', 'carrosserie'] },
  { key: 'fleuriste', aliases: ['fleurs'], label: 'fleuriste', plural: 'fleuristes', activity: 'art floral', family: 'autre', services: ['les bouquets de mariage', 'la livraison de fleurs'], urgency: null, words: ['fleuriste', 'fleurs', 'flore', 'atelier'] },
  { key: 'boulanger', aliases: ['boulangerie', 'boulangerie patisserie'], label: 'boulanger', plural: 'boulangers', activity: 'boulangerie', family: 'autre', services: ['la baguette tradition', 'le pain au levain'], urgency: null, words: ['boulangerie', 'boulanger', 'patisserie', 'fournil', 'pain'] },
  { key: 'patissier', aliases: ['patisserie'], label: 'pâtissier', plural: 'pâtissiers', activity: 'pâtisserie', family: 'autre', services: ['les gâteaux d\'anniversaire', 'les macarons'], urgency: null, words: ['patisserie', 'patissier', 'maison'] },
  { key: 'photographe', aliases: ['studio photo'], label: 'photographe', plural: 'photographes', activity: 'photographie', family: 'autre', services: ['la photo de mariage', 'le portrait professionnel'], urgency: null, words: ['photographe', 'photo', 'photographie', 'studio'] },
  { key: 'auto ecole', aliases: ['auto-ecole', 'ecole de conduite'], label: 'auto-école', g: 'f', plural: 'auto-écoles', activity: 'formation à la conduite', family: 'autre', services: ['le permis accéléré', 'la conduite accompagnée'], urgency: null, words: ['auto', 'ecole', 'conduite', 'permis'] },
  { key: 'demenageur', aliases: ['demenagement'], label: 'déménageur', plural: 'déménageurs', activity: 'déménagement', family: 'autre', services: ['le déménagement de piano', 'le garde-meuble'], urgency: null, words: ['demenagement', 'demenageur', 'demenagements', 'transport'] },
  { key: 'pressing', aliases: ['blanchisserie', 'teinturerie'], label: 'pressing', plural: 'pressings', activity: 'nettoyage textile', family: 'autre', services: ['le nettoyage de costume', 'la retouche'], urgency: null, words: ['pressing', 'blanchisserie', 'teinturerie'] },
  { key: 'cordonnier', aliases: ['cordonnerie'], label: 'cordonnier', plural: 'cordonniers', activity: 'cordonnerie', family: 'autre', services: ['la réparation de talons', 'la reproduction de clés'], urgency: null, words: ['cordonnerie', 'cordonnier', 'cles'] },
  { key: 'reparateur telephone', aliases: ['reparation telephone', 'reparation smartphone', 'reparateur smartphone'], label: 'réparateur de téléphone', plural: 'réparateurs de téléphone', activity: 'réparation de smartphones', family: 'autre', services: ["le changement d'écran", 'le remplacement de batterie'], urgency: 'écran cassé', words: ['reparation', 'phone', 'smartphone', 'mobile', 'repair', 'gsm'] },
  { key: 'caviste', aliases: ['cave a vin', 'cave'], label: 'caviste', plural: 'cavistes', activity: 'vente de vin', family: 'autre', services: ['les vins nature', 'les dégustations'], urgency: null, words: ['cave', 'caviste', 'vins', 'vin'] },
];

export const TRADES: TradeInfo[] = RAW.map((t) => ({
  ...t,
  aliases: t.aliases ?? [],
  g: t.g ?? 'm',
  words: [...new Set([...(t.words ?? []), ...simpleNorm(t.label).split(' ')])].filter((w) => w.length > 2),
}));

/** Mots génériques communs à tous les métiers (retirés pour la variante `core`). */
export const COMMON_TRADE_WORDS = [
  'salon', 'institut', 'agence', 'atelier', 'cabinet', 'services', 'service', 'boutique', 'studio',
  'centre', 'entreprise', 'artisan', 'pro', 'expert', 'experts', 'groupe', 'societe', 'maison', 'et', 'fils',
  'paris', 'depannage', 'renovation', 'conseil', 'france',
];

function simpleNorm(s: string): string {
  return stripAccents(s).toLowerCase().replace(/['’`\-_/.]/g, ' ').replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/** Trouve l'entrée TRADES du métier saisi (sinon une entrée générique construite à partir de la saisie). */
export function resolveTrade(trade: string): TradeInfo {
  const n = simpleNorm(trade);
  let best: TradeInfo | null = null;
  let bestLen = 0;
  for (const t of TRADES) {
    for (const k of [t.key, ...t.aliases, simpleNorm(t.label)]) {
      if (n === k) return t;
      if ((` ${n} `).includes(` ${k} `) && k.length > bestLen) {
        best = t;
        bestLen = k.length;
      }
    }
  }
  if (best) return best;
  const label = trade.trim().toLowerCase() || 'professionnel';
  return {
    key: n || 'professionnel',
    aliases: [],
    label,
    plural: label.endsWith('s') || label.endsWith('x') ? label : `${label}s`,
    activity: label,
    family: 'autre',
    g: 'm',
    services: [],
    urgency: null,
    words: n.split(' ').filter((w) => w.length > 2),
  };
}

export function tradeFamily(trade: string): TradeFamily {
  return resolveTrade(trade).family;
}

/* ------------------------------------------------------------------ */
/* Géographie                                                          */
/* ------------------------------------------------------------------ */

export interface ZoneInfo {
  city: string;
  quartier: string | null;
  /** « Paris 11e » si district numérique ou code postal d'arrondissement */
  arr: string | null;
  arrNum: number | null;
  cp: string | null;
  zone: string;
}

const ARR_CP: Record<string, { prefix: string; max: number }> = {
  paris: { prefix: '750', max: 20 },
  lyon: { prefix: '6900', max: 9 },
  marseille: { prefix: '130', max: 16 },
};

export function ordinalFr(n: number): string {
  return n === 1 ? '1er' : `${n}e`;
}

export function zoneInfo(input: Pick<AuditInput, 'city' | 'district'>): ZoneInfo {
  const city = (input.city || '').trim();
  const d = (input.district || '').trim();
  const cityKey = simpleNorm(city);
  let quartier: string | null = null;
  let arrNum: number | null = null;
  let cp: string | null = null;

  if (d) {
    const cpMatch = /^(\d{5})$/.exec(d);
    const arrMatch = /^(\d{1,2})\s*(?:e|er|eme|ème|è|ieme|ième)?\s*(?:arr\.?|arrondissement)?$/i.exec(d);
    if (cpMatch) {
      cp = cpMatch[1];
      const conf = ARR_CP[cityKey];
      if (conf && cp.startsWith(conf.prefix)) {
        const n = Number(cp.slice(conf.prefix.length));
        if (n >= 1 && n <= conf.max) arrNum = n;
      }
    } else if (arrMatch) {
      arrNum = Number(arrMatch[1]);
      const conf = ARR_CP[cityKey];
      if (conf && arrNum >= 1 && arrNum <= conf.max) cp = conf.prefix + String(arrNum).padStart(5 - conf.prefix.length, '0');
    } else {
      quartier = d;
    }
  }
  const arr = arrNum != null ? `${city} ${ordinalFr(arrNum)}` : null;
  const zone = arr ?? (quartier ? `${quartier} à ${city}` : city);
  return { city, quartier, arr, arrNum, cp, zone };
}

/* ------------------------------------------------------------------ */
/* Gabarits                                                            */
/* ------------------------------------------------------------------ */

function partitive(s: string): string {
  if (/^la\s/i.test(s)) return `de ${s}`;
  if (/^le\s/i.test(s)) return `du ${s.slice(3)}`;
  if (/^les\s/i.test(s)) return `des ${s.slice(4)}`;
  if (/^l['’]/i.test(s)) return `de ${s}`;
  return `de ${s}`;
}

function bare(s: string): string {
  return s.replace(/^(la|le|les)\s+/i, '').replace(/^l['’]/i, '');
}

export type TemplateId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'T8' | 'T9' | 'T10';

interface Ctx {
  t: TradeInfo;
  z: ZoneInfo;
  zone: string;
}

const f = (c: Ctx, m: string, fem: string) => (c.t.g === 'f' ? fem : m);

const TEMPLATES: Record<TemplateId, { intent: QueryIntent; build: (c: Ctx) => string }> = {
  T1: { intent: 'best', build: (c) => `${f(c, 'Quel est le meilleur', 'Quelle est la meilleure')} ${c.t.label} à ${c.zone} ?` },
  T2: { intent: 'best', build: (c) => `Tu peux me conseiller ${f(c, 'un bon', 'une bonne')} ${c.t.label} à ${c.zone} ?` },
  T3: {
    intent: 'nearby',
    build: (c) => `${capitalize(c.t.label)} près de ${c.z.quartier ?? c.z.arr ?? c.z.city}, ${f(c, 'lequel', 'laquelle')} choisir ?`,
  },
  T4: {
    intent: 'nearby',
    build: (c) => `Je cherche ${f(c, 'un', 'une')} ${c.t.label} pas loin de chez moi, j'habite ${c.zone}. Des adresses ?`,
  },
  T5: {
    intent: 'urgent',
    build: (c) => {
      if (c.t.food) {
        const near = c.z.quartier ?? c.z.arr ?? c.z.city;
        return c.t.cuisine ? `Où manger ${c.t.cuisine} ce soir près de ${near} ?` : `Où manger ce soir près de ${near} ?`;
      }
      return `Urgent : ${c.t.urgency ?? 'besoin rapide'}, ${f(c, 'quel', 'quelle')} ${c.t.label} peut intervenir rapidement à ${c.zone} ?`;
    },
  },
  T6: {
    intent: 'urgent',
    build: (c) => `${f(c, 'Quel', 'Quelle')} ${c.t.label} à ${c.zone} est ${f(c, 'disponible', 'disponible')} rapidement, même le samedi ?`,
  },
  T7: {
    intent: 'specific',
    build: (c) => {
      const s = c.t.services[0];
      return s ? `Qui fait ${partitive(s)} à ${c.zone} ?` : `Qui propose des services de ${c.t.activity} à ${c.zone} ?`;
    },
  },
  T8: {
    intent: 'specific',
    build: (c) => {
      const s = c.t.services[1] ?? c.t.services[0];
      const spec = f(c, 'spécialisé', 'spécialisée');
      return s
        ? `Je cherche ${f(c, 'un', 'une')} ${c.t.label} ${spec} en ${bare(s)} à ${c.z.city}, tu as des noms ?`
        : `Je cherche ${f(c, 'un', 'une')} ${c.t.label} sérieux à ${c.z.city}, tu as des noms ?`;
    },
  },
  T9: { intent: 'review', build: (c) => `${f(c, 'Quel', 'Quelle')} ${c.t.label} a les meilleurs avis à ${c.zone} ?` },
  T10: {
    intent: 'review',
    build: (c) => `${capitalize(c.t.plural)} à ${c.zone} : ${f(c, 'lesquels', 'lesquelles')} sont ${f(c, 'fiables', 'fiables')} et pas trop chers ?`,
  },
};

function spec(tid: string, intent: QueryIntent, text: string): QuerySpec {
  return { id: `${tid}-${shortHash(text)}`, text, intent };
}

/** Ordre de sélection de l'audit gratuit (8 requêtes, § 2.3). */
export function freeTemplateIds(t: TradeInfo): TemplateId[] {
  const urgent: TemplateId = t.urgency || t.food ? 'T5' : 'T6';
  return ['T1', 'T2', 'T3', 'T4', urgent, 'T7', 'T8', 'T9'];
}

/**
 * Construit les requêtes. n = 8 (défaut) : audit gratuit. n ≥ 12 : suivi mensuel
 * (10 gabarits + 2 variantes géographiques). Autres valeurs : troncature de la liste.
 */
export function buildQueries(input: AuditInput, n = 8): QuerySpec[] {
  const t = resolveTrade(input.trade);
  const z = zoneInfo(input);
  const c: Ctx = { t, z, zone: z.zone };
  const make = (tid: TemplateId, ctx: Ctx = c) => spec(tid, TEMPLATES[tid].intent, TEMPLATES[tid].build(ctx));

  if (n <= 8) return freeTemplateIds(t).slice(0, Math.max(1, n)).map((tid) => make(tid));

  const all: QuerySpec[] = (Object.keys(TEMPLATES) as TemplateId[]).map((tid) => make(tid));
  // Variantes géographiques : on permute quartier / arrondissement, sinon « ville et alentours ».
  const altZone =
    z.arr && z.quartier ? `${z.quartier} à ${z.city}` : z.arr ? `${z.city} centre` : z.quartier ? z.city : `${z.city} et alentours`;
  const alt: Ctx = { t, z, zone: altZone };
  const variants = [
    spec('T1g', 'best', TEMPLATES.T1.build(alt)),
    spec('T9g', 'review', TEMPLATES.T9.build(alt)),
  ];
  const out = [...all, ...variants];
  const seen = new Set<string>();
  return out.filter((q) => (seen.has(q.text) ? false : (seen.add(q.text), true))).slice(0, n);
}

/** Identifiant de gabarit (« T3 ») à partir d'un QuerySpec.id. */
export function templateOf(queryId: string): string {
  return queryId.split('-')[0];
}
