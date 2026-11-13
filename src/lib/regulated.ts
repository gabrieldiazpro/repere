/**
 * Métiers réglementés non couverts en V1 (qa/ARBITRAGES.md n° 8, docs/12 §6) :
 * professions de santé, avocats, experts-comptables, officiers ministériels, architectes.
 * Utilisé par le formulaire d'audit (message immédiat) ET par /api/audit (refus côté serveur).
 */

export const REGULATED_TRADE_MESSAGE =
  'Repéré ne couvre pas encore les professions réglementées (santé, avocats, experts-comptables…). Merci de votre compréhension.';

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Mots (sur texte replié, sans accents) qui signalent un métier réglementé. */
const PATTERNS: RegExp[] = [
  // Santé
  /\bmedecin/,
  /\bdocteur\b/,
  /\bgeneraliste\b/,
  /\bdentiste/,
  /\bdentaire/,
  /\bstomatolog/,
  /\borthodont/,
  /\bosteo(pathe|pathie)?\b/,
  /\bkine(si)?/,
  /\bpsycholog/,
  /\bpsychiatr/,
  /\bpsychotherap/,
  /\bpharmac(ie|ien)/,
  /\binfirmi/,
  /\bsage femme/,
  /\bsages femmes/,
  /\bmaieuti/,
  /\borthophon/,
  /\borthopti/,
  /\bpodolog/,
  /\bpedicure/,
  /\bchirurgien/,
  /\bergotherap/,
  /\bpsychomotric/,
  /\bradiolog/,
  /\blaboratoire d analyses/,
  /\bveterinaire/,
  // Droit et chiffre
  /\bavocat/,
  /\bcomptab/,
  /\bnotari/,
  /\bnotaire/,
  /\bhuissier/,
  /\bcommissaire de justice/,
  /\bcommissaire aux comptes/,
  // Autres ordres
  /\barchitecte\b/,
];

/** Faux positifs connus : « architecte d'intérieur », « docteur » dans un nom de marque n'est pas un métier, etc. */
const ALLOW: RegExp[] = [
  /\barchitecte d interieur/,
  /\bdocteur (pizza|burger|phone|smartphone|ordi)/,
  // V2 (PME / e-commerce) : éditeurs de logiciels et vendeurs de produits POUR ces métiers ne sont pas des professions
  // réglementées (« logiciel de comptabilité », « matériel dentaire », « blouse médicale »…).
  /\b(logiciel|logiciels|saas|application|applications|appli|outil|outils|plateforme|solution|solutions|materiel|equipement|equipements|fourniture|fournitures|mobilier|vetement|vetements|blouse|blouses|livre|livres|formation|formations|crm|erp)\b/,
];

export function isRegulatedTrade(trade: string | undefined | null): boolean {
  if (!trade) return false;
  const t = fold(trade);
  if (!t) return false;
  if (ALLOW.some((r) => r.test(t))) return false;
  return PATTERNS.some((r) => r.test(t));
}
