/**
 * Détection automatique depuis la page d'accueil : nom de marque, type de site (local / PME / e-commerce), ville,
 * activité. Sources par ordre de confiance : saisie > JSON-LD > og:site_name > <title> > domaine.
 * Fonctions pures (aucun réseau) : la page est récupérée par l'orchestrateur.
 */
import { parseHtml, type ParsedPage } from '@/lib/siteaudit/html';
import { allNodes, typesOf } from '@/lib/siteaudit/jsonld';
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
const ECOM_HTML_RE = /cdn\.shopify\.com|Shopify\.theme|woocommerce|prestashop|wix-ecommerce|\/cart\b|\/panier\b|ajouter au panier|add to cart|data-product-id/i;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function cleanName(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Domaine lisible : « www.plomberie-martin.fr » → « Plomberie Martin ». */
export function nameFromDomain(url: string): string {
  let host = url;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname;
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

/** Ville citée dans un texte court : « Plombier à Lyon 3e » → « Lyon ». */
export function cityFromText(text: string): string | undefined {
  const m = /\b(?:à|a|sur|en)\s+([A-ZÉÈÀÂÎÔ][\p{L}'’-]+(?:[ -](?:sur|en|lès|les|de|du)[ -][A-ZÉ][\p{L}'’-]+)?)/u.exec(text);
  if (!m) return undefined;
  const c = m[1];
  if (/^(Domicile|Distance|Ligne|France|Paris\d)/i.test(c)) return /^France/i.test(c) ? undefined : c.replace(/\d+$/, '');
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
  const isProduct = types.some((t) => /^(Product|ProductGroup|Offer|AggregateOffer|OnlineStore)$/.test(t));
  const isLocal = types.some((t) => LOCAL_TYPE_RE.test(t) && !/OnlineStore/.test(t)) || nodes.some((n) => !!str(addressOf(n)?.addressLocality) && (str(n.telephone) || n.openingHoursSpecification || n.openingHours));
  const ecomHtml = !!html && ECOM_HTML_RE.test(html);
  if (input.siteType) {
    siteType = input.siteType;
    typeSrc = 'saisie';
  } else if (isProduct || (ecomHtml && !isLocal)) {
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
  let activity: string | undefined;
  const t = types.find((x) => TRADE_BY_TYPE[x]);
  if (t) activity = TRADE_BY_TYPE[t];
  if (!activity && sig) {
    const brandKey = brand.toLowerCase();
    const seg = [sig.page.headings.find((h) => h.level === 1)?.text ?? '', ...titleSegments(sig.page.title)]
      .map((s) => s.trim())
      .find((s) => s && !s.toLowerCase().includes(brandKey) && s.length <= 90);
    if (seg) {
      activity = seg
        .replace(/\s*[:,].*$/, '')
        .replace(/\s+(?:à|a|sur|en)\s+[A-ZÉ].*$/u, '')
        .split(/\s+/)
        .slice(0, 6)
        .join(' ')
        .toLowerCase()
        .trim();
      if (activity.length < 3) activity = undefined;
    }
  }
  if (!activity && siteType === 'ecommerce') {
    const p = nodes.find((n) => typesOf(n).includes('Product'));
    const cat = str(p?.category);
    if (cat) activity = cat.toLowerCase().slice(0, 60);
  }

  return {
    brand,
    siteType,
    ...(city ? { city } : {}),
    ...(activity ? { activity } : {}),
    sources: { brand: brandSrc, siteType: typeSrc, ...(citySrc ? { city: citySrc } : {}) },
  };
}
