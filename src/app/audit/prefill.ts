// Pré-remplissage du formulaire d'audit à partir du site (fonctions pures, testées).
// Utilisé par l'action serveur ./actions.ts (récupération sûre par @/lib/siteaudit) et, hors ligne, par le formulaire.

export type PrefillSegment = 'local' | 'pme' | 'ecommerce';

export interface SitePrefill {
  businessName?: string;
  /** métier (local) ou secteur (PME), en minuscules */
  category?: string;
  segment?: PrefillSegment;
  /** d'où vient la proposition, pour l'afficher honnêtement */
  from: 'site' | 'adresse';
}

const STOP = new Set(['www', 'shop', 'boutique', 'store', 'site', 'web', 'fr', 'com', 'paris']);

/** « maison-sora.fr » → « Maison Sora » ; « https://www.plomberie-martin.fr/contact » → « Plomberie Martin ». */
export function nameFromDomain(input: string): string | null {
  let host = input.trim().toLowerCase();
  if (!host) return null;
  try {
    host = new URL(/^https?:\/\//.test(host) ? host : `https://${host}`).hostname;
  } catch {
    return null;
  }
  const parts = host.replace(/^www\d?\./, '').split('.');
  if (parts.length < 2) return null;
  const label = parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2];
  if (!label || /^xn--/.test(label)) return null;
  const words = label.split(/[-_]+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return null;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 80);
}

/** Types schema.org courants → métier en français (parcours local), ou parcours. */
const LOCAL_TYPES: Record<string, string> = {
  plumber: 'plombier',
  electrician: 'électricien',
  locksmith: 'serrurier',
  roofingcontractor: 'couvreur',
  hvacbusiness: 'chauffagiste',
  housepainter: 'peintre en bâtiment',
  generalcontractor: 'entreprise de travaux',
  restaurant: 'restaurant',
  bakery: 'boulangerie',
  cafeorcoffeeshop: 'café',
  barorpub: 'bar',
  hairsalon: 'coiffeur',
  beautysalon: 'institut de beauté',
  dayspa: 'spa',
  florist: 'fleuriste',
  autorepair: 'garage automobile',
  bikestore: 'magasin de vélos',
  bookstore: 'librairie',
  clothingstore: 'boutique de vêtements',
  hotel: 'hôtel',
  realestateagent: 'agence immobilière',
  movingcompany: 'déménageur',
  pethealth: 'clinique vétérinaire',
  sportsactivitylocation: 'salle de sport',
  healthclub: 'salle de sport',
  optician: 'opticien',
};

export function segmentFromTypes(types: string[]): { segment?: PrefillSegment; trade?: string } {
  const t = types.map((x) => x.toLowerCase().replace(/^https?:\/\/schema\.org\//, ''));
  for (const x of t) if (LOCAL_TYPES[x]) return { segment: 'local', trade: LOCAL_TYPES[x] };
  if (t.some((x) => x === 'product' || x === 'productgroup' || x === 'offercatalog' || x === 'onlinestore')) return { segment: 'ecommerce' };
  if (t.some((x) => x === 'softwareapplication' || x === 'webapplication' || x === 'saas')) return { segment: 'pme' };
  if (t.some((x) => x === 'localbusiness' || x === 'store' || x === 'foodestablishment')) return { segment: 'local' };
  return {};
}

const SEP = /\s+[|–—·•:-]\s+/;

/** Nom de marque le plus probable à partir de og:site_name, du nom JSON-LD ou du titre de la page. */
export function brandFromTitle(title: string, siteName?: string | null, domainName?: string | null): string | null {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (siteName && clean(siteName).length >= 2 && clean(siteName).length <= 60) return clean(siteName);
  const parts = clean(title).split(SEP).map(clean).filter((p) => p.length >= 2 && p.length <= 60);
  if (!parts.length) return null;
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (domainName) {
    const d = fold(domainName);
    const match = parts.find((p) => fold(p) === d || (d.length > 3 && fold(p).includes(d)));
    if (match) return match.length <= 40 ? match : domainName;
  }
  // Le segment le plus court est le plus souvent la marque (« Accueil | Plomberie Martin »).
  const generic = /^(accueil|home|bienvenue|page d.accueil)$/i;
  const cand = parts.filter((p) => !generic.test(p)).sort((a, b) => a.length - b.length)[0];
  return cand ?? null;
}

export interface PageSignals {
  title: string;
  siteName?: string | null;
  jsonLdNames?: string[];
  jsonLdTypes?: string[];
}

/** Combine les signaux de la page. Ne propose jamais plus que ce que la page dit. */
export function prefillFromSignals(url: string, page: PageSignals | null): SitePrefill {
  const domainName = nameFromDomain(url);
  if (!page) return domainName ? { businessName: domainName, from: 'adresse' } : { from: 'adresse' };
  const ldName = page.jsonLdNames?.map((n) => n.trim()).find((n) => n.length >= 2 && n.length <= 60) ?? null;
  const name = ldName ?? brandFromTitle(page.title, page.siteName, domainName) ?? domainName ?? undefined;
  const seg = segmentFromTypes(page.jsonLdTypes ?? []);
  return {
    ...(name ? { businessName: name } : {}),
    ...(seg.segment ? { segment: seg.segment } : {}),
    ...(seg.trade ? { category: seg.trade } : {}),
    from: 'site',
  };
}

/**
 * Faut-il écrire le nom proposé depuis le site dans le champ « Nom » ? (B22 de qa/v3/regard-client-v3.md)
 * Jamais pendant que la personne tape ou a le champ en main (sinon sa saisie s'ajoute à la proposition :
 * « Plomberie KarimPlomberie Karim ») ; jamais par-dessus une saisie ; la proposition faite depuis l'adresse peut être
 * remplacée par le nom lu sur la page tant que personne n'y a touché.
 */
export function shouldProposeName(o: { current: string; proposed?: string | null; guess: string | null; replaceGuess: boolean; userEditing: boolean }): boolean {
  if (!o.proposed || o.userEditing) return false;
  if (!o.current.trim()) return true;
  return o.replaceGuess && o.current === o.guess && o.proposed !== o.guess;
}

/** Paramètres jamais gardés dans l'adresse de /audit (données personnelles, cases de consentement). */
export const PRIVATE_PARAMS = ['email', 'consent', 'marketingConsent'] as const;

/** Query string sans e-mail ni consentements (ordre des autres paramètres conservé). */
export function stripPrivateParams(sp: URLSearchParams): string {
  const out = new URLSearchParams(sp);
  for (const k of PRIVATE_PARAMS) out.delete(k);
  return out.toString();
}
