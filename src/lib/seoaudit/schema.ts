/**
 * Validation des données structurées contre les exigences de Google (fonctionnalités de recherche),
 * type par type. Sources : https://developers.google.com/search/docs/appearance/structured-data/search-gallery
 * et les pages de chaque type (citées dans RULES). Mise à jour : nov. 2026 (FAQ retirée des résultats le 7 mai 2026,
 * sept types abandonnés en juin 2025, Practice problems / Dataset (Search) / Vehicle listing en nov. 2025).
 */
import { allNodes, has, str, typesOf, type Node } from './util';

export interface SdRule {
  feature: string; // nom de la fonctionnalité Google
  doc: string;
  required: string[][]; // chaque entrée : au moins une des propriétés
  recommended: string[][];
}

const GSD = 'https://developers.google.com/search/docs/appearance/structured-data';

export const LOCAL_SUBTYPES = new Set([
  'LocalBusiness', 'Restaurant', 'FoodEstablishment', 'Bakery', 'BarOrPub', 'CafeOrCoffeeShop', 'FastFoodRestaurant', 'IceCreamShop',
  'Store', 'ClothingStore', 'Florist', 'HardwareStore', 'HomeGoodsStore', 'FurnitureStore', 'GroceryStore', 'BookStore', 'JewelryStore',
  'ShoeStore', 'SportingGoodsStore', 'PetStore', 'ElectronicsStore', 'GardenStore', 'BikeStore', 'OptometricStore' /* rare */,
  'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'NailSalon', 'DaySpa', 'TattooParlor', 'HealthClub',
  'HomeAndConstructionBusiness', 'Electrician', 'Plumber', 'HVACBusiness', 'RoofingContractor', 'GeneralContractor', 'HousePainter', 'Locksmith', 'MovingCompany',
  'AutomotiveBusiness', 'AutoRepair', 'AutoDealer', 'AutoBodyShop', 'AutoWash', 'GasStation',
  'ProfessionalService', 'LegalService', 'Attorney', 'Notary', 'AccountingService', 'FinancialService', 'InsuranceAgency', 'RealEstateAgent', 'EmploymentAgency', 'TravelAgency',
  'MedicalBusiness', 'Dentist', 'Physician', 'Optician', 'Pharmacy', 'MedicalClinic', 'Physiotherapy',
  'LodgingBusiness', 'Hotel', 'BedAndBreakfast', 'Campground', 'Hostel', 'Motel', 'Resort',
  'EntertainmentBusiness', 'SportsActivityLocation', 'ChildCare', 'DryCleaningOrLaundry', 'AnimalShelter', 'Library', 'SelfStorage', 'ShoppingCenter', 'TouristInformationCenter',
]);

const LOCAL_RULE: SdRule = {
  feature: 'Établissement local',
  doc: `${GSD}/local-business`,
  required: [['name'], ['address']],
  recommended: [['telephone'], ['url'], ['openingHoursSpecification', 'openingHours'], ['geo'], ['image'], ['priceRange']],
};

export const RULES: Record<string, SdRule> = {
  LocalBusiness: LOCAL_RULE,
  Organization: {
    feature: 'Organisation (logo, panneau)',
    doc: `${GSD}/organization`,
    required: [],
    recommended: [['name'], ['url'], ['logo'], ['sameAs'], ['address'], ['telephone', 'contactPoint']],
  },
  Product: {
    feature: 'Produit (extrait et fiche marchand)',
    doc: `${GSD}/product`,
    required: [['name'], ['offers', 'review', 'aggregateRating'], ['image']],
    recommended: [['description'], ['brand'], ['sku'], ['gtin', 'gtin13', 'gtin8', 'gtin12', 'gtin14', 'mpn'], ['offers']],
  },
  Offer: {
    feature: 'Offre (prix)',
    doc: `${GSD}/merchant-listing`,
    required: [['price', 'priceSpecification'], ['priceCurrency', 'priceSpecification']],
    recommended: [['availability'], ['shippingDetails'], ['hasMerchantReturnPolicy']],
  },
  AggregateOffer: {
    feature: 'Offre groupée (fourchette de prix)',
    doc: `${GSD}/product-snippet`,
    required: [['lowPrice'], ['priceCurrency']],
    recommended: [['highPrice'], ['offerCount']],
  },
  AggregateRating: {
    feature: 'Note moyenne',
    doc: `${GSD}/review-snippet`,
    required: [['ratingValue'], ['ratingCount', 'reviewCount']],
    recommended: [['bestRating']],
  },
  Review: {
    feature: 'Avis',
    doc: `${GSD}/review-snippet`,
    required: [['author'], ['reviewRating']],
    recommended: [['datePublished']],
  },
  BreadcrumbList: {
    feature: "Fil d'Ariane",
    doc: `${GSD}/breadcrumb`,
    required: [['itemListElement']],
    recommended: [],
  },
  Article: {
    feature: 'Article',
    doc: `${GSD}/article`,
    required: [],
    recommended: [['headline'], ['author'], ['datePublished'], ['dateModified'], ['image']],
  },
  Event: {
    feature: 'Événement',
    doc: `${GSD}/event`,
    required: [['name'], ['startDate'], ['location']],
    recommended: [['endDate'], ['eventStatus'], ['image'], ['description'], ['offers'], ['organizer']],
  },
  Recipe: {
    feature: 'Recette',
    doc: `${GSD}/recipe`,
    required: [['name'], ['image']],
    recommended: [['author'], ['datePublished'], ['description'], ['recipeIngredient'], ['recipeInstructions'], ['totalTime', 'cookTime'], ['recipeYield']],
  },
  VideoObject: {
    feature: 'Vidéo',
    doc: `${GSD}/video`,
    required: [['name'], ['thumbnailUrl'], ['uploadDate']],
    recommended: [['description'], ['contentUrl', 'embedUrl'], ['duration']],
  },
  JobPosting: {
    feature: "Offre d'emploi",
    doc: `${GSD}/job-posting`,
    required: [['title'], ['description'], ['datePosted'], ['hiringOrganization'], ['jobLocation', 'applicantLocationRequirements']],
    recommended: [['validThrough'], ['baseSalary'], ['employmentType']],
  },
  SoftwareApplication: {
    feature: 'Application',
    doc: `${GSD}/software-app`,
    required: [['name'], ['offers'], ['aggregateRating', 'review']],
    recommended: [['applicationCategory'], ['operatingSystem']],
  },
  FAQPage: {
    feature: 'FAQ',
    doc: `${GSD}/faqpage`,
    required: [['mainEntity']],
    recommended: [],
  },
};

const ALIASES: Record<string, string> = {
  NewsArticle: 'Article',
  BlogPosting: 'Article',
  OnlineStore: 'Organization',
  OnlineBusiness: 'Organization',
  Corporation: 'Organization',
  NGO: 'Organization',
  ProductGroup: 'Product',
  MobileApplication: 'SoftwareApplication',
  WebApplication: 'SoftwareApplication',
  EmployerAggregateRating: 'AggregateRating',
};

/** Types que Google n'utilise plus (ou plus pour la recherche). */
export const DEPRECATED: Record<string, string> = {
  HowTo: 'résultats enrichis « Procédure » retirés en 2023',
  SpecialAnnouncement: 'abandonné par Google en juin 2025',
  ClaimReview: 'abandonné par Google en juin 2025 (vérification des faits)',
  Occupation: 'salaire estimé abandonné en juin 2025',
  Quiz: 'exercices (Practice problems) abandonnés en novembre 2025',
  Dataset: 'utilisé seulement par Google Dataset Search, plus par la recherche Google (nov. 2025)',
  Car: 'annonces de véhicules abandonnées (2025)',
  FAQPage: 'les résultats enrichis FAQ ne s’affichent plus dans Google depuis le 7 mai 2026 (le balisage reste inoffensif et utile aux IA)',
};

export function ruleFor(type: string): { rule: SdRule; as: string } | null {
  if (RULES[type]) return { rule: RULES[type], as: type };
  if (ALIASES[type]) return { rule: RULES[ALIASES[type]], as: ALIASES[type] };
  if (LOCAL_SUBTYPES.has(type)) return { rule: LOCAL_RULE, as: 'LocalBusiness' };
  return null;
}

export interface SdIssue {
  type: string;
  level: 'required' | 'recommended' | 'invalid' | 'self_serving' | 'deprecated' | 'context';
  prop?: string;
  message: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ][\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/;
const AVAIL = /^(https?:\/\/schema\.org\/)?(InStock|OutOfStock|PreOrder|BackOrder|Discontinued|LimitedAvailability|InStoreOnly|OnlineOnly|SoldOut|PreSale|Reserved|MadeToOrder)$/;

function checkValues(n: Node, t: string, out: SdIssue[]): void {
  for (const k of ['startDate', 'endDate', 'datePublished', 'dateModified', 'uploadDate', 'datePosted', 'priceValidUntil', 'validThrough']) {
    const v = str(n[k]);
    if (v !== undefined && !ISO_DATE.test(v.trim())) out.push({ type: t, level: 'invalid', prop: k, message: `${k} « ${v} » n'est pas une date au format ISO 8601 (AAAA-MM-JJ)` });
  }
  if (n.priceCurrency !== undefined) {
    const c = str(n.priceCurrency) ?? '';
    if (!/^[A-Z]{3}$/.test(c)) out.push({ type: t, level: 'invalid', prop: 'priceCurrency', message: `priceCurrency « ${c} » doit être un code ISO 4217 (EUR)` });
  }
  for (const k of ['price', 'lowPrice', 'highPrice']) {
    if (n[k] === undefined) continue;
    const v = n[k];
    const ok = typeof v === 'number' ? Number.isFinite(v) : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim());
    if (!ok) out.push({ type: t, level: 'invalid', prop: k, message: `${k} « ${String(v)} » doit être un nombre (point décimal, sans symbole €)` });
  }
  if (n.availability !== undefined) {
    const v = str(n.availability) ?? '';
    if (!AVAIL.test(v.trim())) out.push({ type: t, level: 'invalid', prop: 'availability', message: `availability « ${v} » n'est pas une valeur schema.org (ex. https://schema.org/InStock)` });
  }
  if (t === 'AggregateRating' || t === 'Rating') {
    const v = Number(str(n.ratingValue)?.replace(',', '.'));
    const best = n.bestRating !== undefined ? Number(str(n.bestRating)) : 5;
    const worst = n.worstRating !== undefined ? Number(str(n.worstRating)) : 1;
    if (n.ratingValue !== undefined && (!Number.isFinite(v) || v < worst || v > best)) {
      out.push({ type: t, level: 'invalid', prop: 'ratingValue', message: `ratingValue « ${String(n.ratingValue)} » hors de l'échelle ${worst}–${best}` });
    }
  }
  if (t === 'BreadcrumbList' && Array.isArray(n.itemListElement)) {
    const items = n.itemListElement as Node[];
    items.forEach((it, i) => {
      if (!it || typeof it !== 'object') return;
      if (!has(it, 'position')) out.push({ type: t, level: 'required', prop: 'position', message: `élément ${i + 1} du fil d'Ariane sans position` });
      const named = has(it, 'name') || (it.item && typeof it.item === 'object' && has(it.item as Node, 'name'));
      if (!named) out.push({ type: t, level: 'required', prop: 'name', message: `élément ${i + 1} du fil d'Ariane sans nom` });
      if (i < items.length - 1 && !has(it, 'item')) out.push({ type: t, level: 'required', prop: 'item', message: `élément ${i + 1} du fil d'Ariane sans URL (item)` });
    });
  }
  if (t === 'FAQPage') {
    const qs = Array.isArray(n.mainEntity) ? (n.mainEntity as Node[]) : n.mainEntity ? [n.mainEntity as Node] : [];
    qs.forEach((q, i) => {
      if (!q || typeof q !== 'object') return;
      const a = q.acceptedAnswer as Node | undefined;
      if (!has(q, 'name') || !a || !has(a, 'text')) out.push({ type: t, level: 'required', prop: 'acceptedAnswer', message: `question ${i + 1} sans intitulé ou sans réponse (acceptedAnswer.text)` });
    });
  }
  if (t === 'LocalBusiness' && n.address && typeof n.address === 'object' && !Array.isArray(n.address)) {
    const a = n.address as Node;
    for (const k of ['streetAddress', 'addressLocality', 'postalCode']) {
      if (!has(a, k)) out.push({ type: t, level: 'recommended', prop: `address.${k}`, message: `adresse sans ${k}` });
    }
  }
}

/** Valide tous les nœuds JSON-LD d'une page. */
export function validateNodes(jsonLd: unknown[]): { types: string[]; issues: SdIssue[] } {
  const issues: SdIssue[] = [];
  const types = new Set<string>();
  for (const block of jsonLd) {
    const top = Array.isArray(block) ? block : [block];
    for (const b of top) {
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        const ctx = (b as Node)['@context'];
        const okCtx = typeof ctx === 'string' ? /schema\.org/i.test(ctx) : Array.isArray(ctx) || (ctx && typeof ctx === 'object');
        if (!okCtx) issues.push({ type: typesOf(b)[0] ?? '?', level: 'context', message: '@context absent ou différent de https://schema.org' });
      }
    }
    for (const n of allNodes(block)) {
      for (const t of typesOf(n)) {
        types.add(t);
        if (DEPRECATED[t]) issues.push({ type: t, level: 'deprecated', message: DEPRECATED[t] });
        const r = ruleFor(t);
        if (!r) continue;
        for (const alt of r.rule.required) if (!alt.some((k) => has(n, k))) issues.push({ type: r.as, level: 'required', prop: alt.join(' ou '), message: `${t} : propriété obligatoire manquante (${alt.join(' ou ')})` });
        for (const alt of r.rule.recommended) if (!alt.some((k) => has(n, k))) issues.push({ type: r.as, level: 'recommended', prop: alt.join(' ou '), message: `${t} : propriété recommandée manquante (${alt.join(' ou ')})` });
        checkValues(n, r.as === 'LocalBusiness' ? 'LocalBusiness' : t, issues);
        if ((r.as === 'LocalBusiness' || r.as === 'Organization') && (has(n, 'aggregateRating') || has(n, 'review'))) {
          issues.push({ type: t, level: 'self_serving', message: `${t} porte ses propres avis (aggregateRating/review) : Google n'affiche pas d'étoiles pour les avis « auto-attribués »` });
        }
      }
    }
  }
  return { types: [...types], issues };
}
