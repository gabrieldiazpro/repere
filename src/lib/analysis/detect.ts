/**
 * Détection automatique depuis la page d'accueil : nom de marque, type de site (local / PME / e-commerce), ville,
 * activité. Sources par ordre de confiance : saisie > JSON-LD > og:site_name > <title> > domaine.
 * Fonctions pures (aucun réseau) : la page est récupérée par l'orchestrateur.
 */
import { domainToUnicode } from 'node:url';
import { parseHtml, type ParsedPage } from '@/lib/siteaudit/html';
import { allNodes, typesOf } from '@/lib/siteaudit/jsonld';
import { cleanActivity, tradeFromBrand } from './activity';
import type { AnalysisInput, Detection, SiteType } from './types';

type Node = Record<string, unknown>;

/** Types schema.org → métier en français (questions IA). Liste courte : le reste passe par le titre. */
const TRADE_BY_TYPE: Record<string, string> = {
  Plumber: 'plombier',
  Electrician: 'électricien',
  Locksmith: 'serrurier',
  RoofingContractor: 'couvreur',
  HVACBusiness: 'chauffagiste',
  HousePainter: 'peintre en bâtiment',
  GeneralContractor: 'entreprise de travaux',
  Restaurant: 'restaurant',
  Bakery: 'boulangerie',
  CafeOrCoffeeShop: 'café',
  BarOrPub: 'bar',
  HairSalon: 'coiffeur',
  BeautySalon: 'institut de beauté',
  NailSalon: 'onglerie',
  DaySpa: 'spa',
  Florist: 'fleuriste',
  AutoRepair: 'garage automobile',
  RealEstateAgent: 'agence immobilière',
  Hotel: 'hôtel',
  Dentist: 'dentiste',
  Optician: 'opticien',
  Pharmacy: 'pharmacie',
  BookStore: 'librairie',
  ClothingStore: 'boutique de vêtements',
  ExerciseGym: 'salle de sport',
  VeterinaryCare: 'vétérinaire',
  ChildCare: 'crèche',
  MovingCompany: 'déménageur',
};

const LOCAL_TYPE_RE =
  /LocalBusiness|Store|Restaurant|Bakery|Cafe|Bar|Salon|Spa|Plumber|Electrician|Locksmith|Contractor|HVAC|Painter|Florist|AutoRepair|RealEstateAgent|Hotel|Dentist|Optician|Pharmacy|Gym|Veterinary|ChildCare|MovingCompany|FoodEstablishment|HomeAndConstructionBusiness|MedicalBusiness|LodgingBusiness/;
const ORG_TYPE_RE = /Organization|Corporation|LocalBusiness|Store|Brand|OnlineStore|OnlineBusiness/;
const SOFT_TYPE_RE = /^(SoftwareApplication|WebApplication|MobileApplication|Service|FinancialProduct|BankAccount|LoanOrCredit|PaymentService|InsuranceAgency|Course|EducationalOrganization)$/;
/** Plateformes faites pour vendre en ligne (Shopify, WooCommerce, PrestaShop). Une boutique Wix ajoutée à un site
 * d'établissement (« wixstores ») ne suffit pas : cas réel d'une praticienne avec un petit e-shop. */
const STRONG_ECOM_RE = /cdn\.shopify\.com|Shopify\.theme|woocommerce|prestashop/i;
const ECOM_HTML_RE = /cdn\.shopify\.com|Shopify\.theme|woocommerce|prestashop|wix-ecommerce|\/cart\b|\/panier\b|ajouter au panier|add to cart|data-product-id/i;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/**
 * Nom de marque lisible (TESTS-REELS) : sans forme juridique (« FLEURS DE VIES SAS » → « Fleurs de Vies »), et sans
 * capitales criées pour les mots de 4 lettres ou plus qui ont des voyelles (« CAFÉS RICHARD » → « Cafés Richard ») ;
 * les sigles restent (« LDLC », « OVH »).
 */
function cleanName(s: string): string {
  let n = s
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\s,-]+\b(?:SAS|SASU|SARL|EURL|SA|SNC|SCI|SCOP|SELARL|EIRL|EI|GmbH|Ltd|Inc\.?|LLC)\.?$/i, '')
    .trim();
  if (n === n.toUpperCase() && /\p{Lu}{4,}/u.test(n)) {
    n = n
      .split(' ')
      .map((w, i) => {
        if (w.length < 4 && i > 0 && /^(DE|DU|DES|ET|LA|LE|LES|EN|AU|AUX|D'|L')$/i.test(w)) return w.toLowerCase();
        if (w.length >= 4 && /[AEIOUYÀÂÉÈÊËÎÏÔÛÙÜ]/.test(w)) return w.charAt(0) + w.slice(1).toLowerCase();
        return w;
      })
      .join(' ');
  }
  return n.slice(0, 80);
}

/** Domaine lisible : « www.plomberie-martin.example » → « Plomberie Martin ». */
export function nameFromDomain(url: string): string {
  let host = url;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
    // Domaine accentué (IDN) : « xn--boulangerie-lonore-mwbb.fr » → « boulangerie-éléonore.fr » (ROBUSTESSE V6).
    if (host.includes('xn--')) host = domainToUnicode(host) || host;
  } catch {
    /* saisie brute */
  }
  const label = host.replace(/^www\./, '').split('.')[0] ?? host;
  return label
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function titleSegments(title: string): string[] {
  return title
    .split(/\s+[|·•–—-]\s+|\s*[|·•]\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
}

function addressOf(n: Node): Node | null {
  const a = n.address;
  if (a && typeof a === 'object' && !Array.isArray(a)) return a as Node;
  if (Array.isArray(a) && a[0] && typeof a[0] === 'object') return a[0] as Node;
  return null;
}

const NOT_CITY =
  /^(?:Domicile|Distance|Ligne|France|Europe|Mesure|Rendez|Devis|Gros|Promo|Promotion|Stock|Vente|Bio|Direct|Partenariat|Savoir|Ce|Cette|Votre|Vos|Notre|Nos|Toute|Tout|Tous|Plus|Moins|Location|Livraison|Magasin|Boutique|Ville|Centre|Famille|Solo|Groupe|Equipe|Équipe|Option|Ce|Un|Une|Le|La|Les|Images?|Vidéo|Video|Photos?|Cadeau|Offre|Soldes?|Noël|Noel|Fête|Fete|Été|Ete|Hiver|Automne|Printemps|Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre|Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche|Savoir-faire|Français|Française|Francais|Francaise|Anglais|English|Fr|En|Cas|Fonction|Matière|Bois|Or|Argent|Cuir|Coton|Lin|Soie|Laine|Verre|Pierre|Céramique|Ceramique|Bref|Images?)$/i;

/** Ville citée dans un texte court : « Plombier à Lyon 3e » → « Lyon ». */
export function cityFromText(text: string): string | undefined {
  const m = /(?:^|\s)(?:à|sur|en)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+(?:[ -](?:sur|en|lès|les|de|du)[ -][A-ZÉ][\p{L}'’-]+)?)/u.exec(text);
  if (!m) return undefined;
  const c = m[1];
  // « Sur Mesure », « En Ligne », « À Domicile »… : pas des villes (titres en casse de titre de vrais sites).
  if (NOT_CITY.test(c)) return undefined;
  if (/^Paris\d/i.test(c)) return c.replace(/\d+$/, '');
  return c;
}

export interface HomeSignals {
  page: ParsedPage;
  nodes: Node[];
  types: string[];
}

export function homeSignals(html: string): HomeSignals {
  const page = parseHtml(html);
  const nodes: Node[] = [];
  for (const raw of page.jsonLdRaw.slice(0, 12)) {
    try {
      for (const n of allNodes(JSON.parse(raw))) if (n && typeof n === 'object') nodes.push(n as Node);
    } catch {
      /* JSON-LD invalide : ignoré ici (SEO-AUDIT le signale) */
    }
  }
  return { page, nodes, types: nodes.flatMap((n) => typesOf(n)) };
}

/**
 * Activité lue dans le H1, le titre, puis la description (« Spécialiste de … », « … à Lyon ») : premier segment qui
 * est vraiment une activité une fois nettoyé (sans la marque, la ville, les articles ni les slogans).
 */
export function activityFromText(sig: HomeSignals, brand: string): string | undefined {
  const h1 = sig.page.headings.find((h) => h.level === 1)?.text ?? '';
  const segs = [...titleSegments(h1), ...titleSegments(sig.page.title)];
  for (const seg of segs) {
    const a = cleanActivity(seg, brand);
    if (a) return a;
  }
  const desc = str(sig.page.metaDescription) ?? str(sig.page.og['og:description']) ?? '';
  const m = /\bsp[ée]cialiste\s+(?:fran[çc]ais\s+|français(?:e)?\s+)?(?:de\s+la\s+|de\s+l['’]\s*|du\s+|des\s+|de\s+|d['’]\s*|en\s+)([^,.;:!?]{3,60})/i.exec(desc);
  if (m) {
    const a = cleanActivity(m[1].split(/\s+et\s+(?:de|du|des|d['’])\s+/i)[0], brand);
    if (a) return a;
  }
  return undefined;
}

/** Détection complète. `html` absent (page injoignable) : on se rabat sur la saisie puis le domaine. */
export function detectSite(input: AnalysisInput, html: string | null, finalUrl?: string): Detection {
  const url = finalUrl || input.url;
  const sig = html ? homeSignals(html) : null;
  const nodes = sig?.nodes ?? [];
  const types = sig?.types ?? [];

  // ---- Marque ----
  let brand: string | undefined;
  let brandSrc = 'saisie';
  if (input.brand?.trim()) brand = cleanName(input.brand);
  if (!brand) {
    const org = nodes.find((n) => typesOf(n).some((t) => ORG_TYPE_RE.test(t) || LOCAL_TYPE_RE.test(t)) && str(n.name));
    if (org) {
      brand = cleanName(str(org.name)!);
      brandSrc = 'JSON-LD';
    }
  }
  if (!brand && sig) {
    const site = str(sig.page.og['og:site_name']) ?? str(sig.page.og.site_name);
    if (site) {
      brand = cleanName(site);
      brandSrc = 'og:site_name';
    }
  }
  if (!brand && sig?.page.title) {
    const segs = titleSegments(sig.page.title);
    const dom = nameFromDomain(url).toLowerCase().replace(/\s+/g, '');
    const match = segs.find((s) => s.toLowerCase().replace(/[\s'’-]+/g, '').includes(dom) || dom.includes(s.toLowerCase().replace(/[\s'’-]+/g, '')));
    const pick = match ?? (segs.length > 1 ? [...segs].sort((a, b) => a.length - b.length)[0] : undefined);
    if (pick && pick.length <= 50) {
      brand = cleanName(pick);
      brandSrc = 'titre';
    }
  }
  if (!brand) {
    brand = nameFromDomain(url) || 'Votre site';
    brandSrc = 'domaine';
  }

  // ---- Type de site ----
  let siteType: SiteType;
  let typeSrc: string;
  // Un logiciel, une banque ou un service déclarés aussi « Product » avec des « Offer » (cas réels : SaaS de paie,
  // néobanque) ne sont pas des boutiques en ligne.
  const isProduct = nodes.some((n) => {
    const ts = typesOf(n);
    if (ts.some((x) => SOFT_TYPE_RE.test(x))) return false;
    if (ts.some((x) => /^(Product|ProductGroup|OnlineStore)$/.test(x))) return true;
    // Offre isolée : seulement si elle porte sur un produit (pas un abonnement logiciel, pas une offre d'emploi).
    return ts.some((x) => /^(Offer|AggregateOffer)$/.test(x)) && typesOf((n.itemOffered as Node) ?? {}).some((x) => /^(Product|ProductGroup)$/.test(x));
  });
  const isLocal = types.some((t) => LOCAL_TYPE_RE.test(t) && !/OnlineStore/.test(t)) || nodes.some((n) => !!str(addressOf(n)?.addressLocality) && (str(n.telephone) || n.openingHoursSpecification || n.openingHours));
  const ecomHtml = !!html && ECOM_HTML_RE.test(html);
  // Boutique en ligne qui se déclare aussi « LiquorStore » / « Store » avec une adresse de siège, sans horaires
  // d'ouverture (cas réel : lepetitballon.com, Shopify) : c'est un e-commerce, pas un commerce de quartier.
  const hasHours = nodes.some((n) => n.openingHoursSpecification || n.openingHours);
  const shopPlatform = !!html && STRONG_ECOM_RE.test(html);
  if (input.siteType) {
    siteType = input.siteType;
    typeSrc = 'saisie';
  } else if (isProduct || (ecomHtml && !isLocal) || (shopPlatform && isLocal && !hasHours)) {
    siteType = 'ecommerce';
    typeSrc = isProduct ? 'JSON-LD Product/Offer' : 'plateforme de boutique détectée';
  } else if (isLocal) {
    siteType = 'local';
    typeSrc = 'JSON-LD établissement local';
  } else if (sig && /\b(?:0[1-9](?:[ .]?\d{2}){4}|\+33 ?[1-9](?:[ .]?\d{2}){4})\b/.test(sig.page.bodyText) && /\b\d{5}\b/.test(sig.page.bodyText) && cityFromText(sig.page.title)) {
    siteType = 'local';
    typeSrc = 'téléphone, code postal et ville sur la page';
  } else {
    siteType = 'pme';
    typeSrc = sig ? 'par défaut (ni boutique ni établissement local détecté)' : 'par défaut (page d’accueil injoignable)';
  }

  // ---- Ville ----
  let city: string | undefined;
  let citySrc: string | undefined;
  if (input.city?.trim()) {
    city = cleanName(input.city);
    citySrc = 'saisie';
  } else {
    const loc = nodes.map((n) => str(addressOf(n)?.addressLocality)).find(Boolean);
    if (loc) {
      city = cleanName(loc);
      citySrc = 'JSON-LD';
    } else if (sig) {
      const c = cityFromText(sig.page.title) ?? cityFromText(sig.page.headings.find((h) => h.level === 1)?.text ?? '');
      if (c) {
        city = c;
        citySrc = 'titre';
      }
    }
  }

  // ---- Activité (métier ou catégorie) ----
  // Type schema.org (métier) d'abord pour un établissement ; pour une boutique en ligne, ce qu'elle vend (texte).
  let activity: string | undefined;
  const t = types.find((x) => TRADE_BY_TYPE[x]);
  const fromType = t ? TRADE_BY_TYPE[t] : undefined;
  if (fromType && siteType !== 'ecommerce') activity = fromType;
  // « Coiffeur Jean Louis David » : le métier est dans le nom de l'enseigne (plus sûr qu'un slogan).
  if (!activity && siteType !== 'ecommerce') activity = tradeFromBrand(brand);
  if (!activity && sig) activity = activityFromText(sig, brand);
  if (!activity && siteType === 'ecommerce') {
    const p = nodes.find((n) => typesOf(n).includes('Product'));
    const cat = str(p?.category);
    if (cat) activity = cleanActivity(cat.split(/\s*[>/]\s*/).pop(), brand);
  }
  if (!activity && fromType) activity = fromType;

  return {
    brand,
    siteType,
    ...(city ? { city } : {}),
    ...(activity ? { activity } : {}),
    sources: { brand: brandSrc, siteType: typeSrc, ...(citySrc ? { city: citySrc } : {}) },
  };
}
