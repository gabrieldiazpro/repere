/**
 * Données structurées : extraction (JSON-LD + microdonnées), validation par type (règles maison, en français)
 * et générateur (réutilise `buildJsonLd` du module d'exécution : même balisage que celui que Repéré sert).
 * Honnêteté : le balisage ne garantit ni affichage enrichi ni citation ; il réduit l'ambiguïté.
 */
import { buildJsonLd, jsonLdScriptTag } from '@/lib/execution/jsonld';
import type { Business } from '@/lib/db';
import type { ExecProduct, FactsMap } from '@/lib/execution/types';
import { safeFetch, type SafeFetchOptions } from './fetch';
import { parseHtml, stripTags, type ParsedPage } from './html';
import type { JsonLdBlock, JsonLdValidation } from './types';

type Node = Record<string, unknown>;

export const JSONLD_NOTE =
  'Le balisage ne garantit ni affichage enrichi ni citation par une IA : il rend vos informations moins ambiguës. Recoupez avec le validateur officiel (validator.schema.org).';

/* ------------------------------------------------------------------ */
/* Parcours des nœuds                                                  */
/* ------------------------------------------------------------------ */

export function typesOf(n: unknown): string[] {
  const t = (n as Node | null)?.['@type'];
  if (typeof t === 'string') return [t.replace(/^https?:\/\/schema\.org\//, '')];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string').map((x) => x.replace(/^https?:\/\/schema\.org\//, ''));
  return [];
}

/** Nœuds de premier niveau d'un bloc (gère les tableaux et `@graph`). */
export function topNodes(data: unknown): Node[] {
  if (Array.isArray(data)) return data.flatMap(topNodes);
  if (!data || typeof data !== 'object') return [];
  const d = data as Node;
  if (Array.isArray(d['@graph'])) return (d['@graph'] as unknown[]).flatMap(topNodes);
  return [d];
}

/** Tous les nœuds typés, y compris imbriqués (offers, aggregateRating, mainEntity…). */
export function allNodes(data: unknown, depth = 0, out: Node[] = []): Node[] {
  if (depth > 8 || !data || typeof data !== 'object') return out;
  if (Array.isArray(data)) {
    for (const x of data) allNodes(x, depth + 1, out);
    return out;
  }
  const d = data as Node;
  if (typesOf(d).length) out.push(d);
  for (const [k, v] of Object.entries(d)) if (k !== '@context' && v && typeof v === 'object') allNodes(v, depth + 1, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Règles par type                                                     */
/* ------------------------------------------------------------------ */

interface TypeRule {
  required: string[][]; // chaque entrée : au moins une des propriétés
  recommended: string[][];
}

const LOCAL_RULE: TypeRule = {
  required: [['name'], ['address']],
  recommended: [['telephone'], ['url'], ['openingHoursSpecification', 'openingHours'], ['image', 'logo'], ['geo'], ['priceRange'], ['sameAs']],
};

const RULES: Record<string, TypeRule> = {
  LocalBusiness: LOCAL_RULE,
  Organization: { required: [['name'], ['url']], recommended: [['logo'], ['sameAs'], ['contactPoint', 'telephone'], ['description'], ['address']] },
  OnlineStore: { required: [['name'], ['url']], recommended: [['logo'], ['sameAs'], ['contactPoint', 'telephone'], ['hasMerchantReturnPolicy']] },
  Corporation: { required: [['name'], ['url']], recommended: [['logo'], ['sameAs'], ['contactPoint', 'telephone']] },
  WebSite: { required: [['name'], ['url']], recommended: [['publisher']] },
  WebPage: { required: [['name', 'headline']], recommended: [['url'], ['dateModified']] },
  Product: { required: [['name'], ['offers', 'review', 'aggregateRating']], recommended: [['image'], ['description'], ['brand'], ['sku'], ['gtin', 'gtin13', 'gtin8', 'gtin12', 'gtin14', 'mpn'], ['offers']] },
  Offer: { required: [['price', 'priceSpecification'], ['priceCurrency', 'priceSpecification']], recommended: [['availability'], ['url'], ['shippingDetails'], ['hasMerchantReturnPolicy']] },
  AggregateOffer: { required: [['lowPrice'], ['priceCurrency']], recommended: [['highPrice'], ['offerCount']] },
  AggregateRating: { required: [['ratingValue'], ['ratingCount', 'reviewCount']], recommended: [['bestRating']] },
  Review: { required: [['author'], ['reviewRating', 'reviewBody']], recommended: [['datePublished']] },
  FAQPage: { required: [['mainEntity']], recommended: [] },
  Question: { required: [['name'], ['acceptedAnswer']], recommended: [] },
  Article: { required: [['headline']], recommended: [['author'], ['datePublished'], ['dateModified'], ['image'], ['publisher']] },
  BreadcrumbList: { required: [['itemListElement']], recommended: [] },
  Person: { required: [['name']], recommended: [['url', 'sameAs']] },
  Service: { required: [['name']], recommended: [['provider'], ['areaServed'], ['description']] },
  Event: { required: [['name'], ['startDate'], ['location']], recommended: [['endDate'], ['offers'], ['image']] },
  Recipe: { required: [['name'], ['image']], recommended: [['recipeIngredient'], ['recipeInstructions'], ['author']] },
};

const ARTICLE_TYPES = ['Article', 'BlogPosting', 'NewsArticle', 'TechArticle', 'Report'];
const ORG_TYPES = ['Organization', 'Corporation', 'NGO', 'EducationalOrganization', 'GovernmentOrganization', 'MedicalOrganization'];
const LOCAL_HINT = /(Business|Store|Shop|Restaurant|Bakery|Plumber|Electrician|Locksmith|Contractor|Painter|Dentist|Physician|Salon|Parlor|Service|Agent|Repair|Florist|Company|Pharmacy|Optician|Notary|Physiotherapy|VeterinaryCare|BarOrPub|Hotel|Clinic|Gym|Attorney|Laundry|Spa)$/;

/** Règle applicable à un type schema.org. */
export function ruleFor(type: string): { rule: TypeRule; as: string } | null {
  if (RULES[type] && type !== 'Service') return { rule: RULES[type], as: type };
  if (ARTICLE_TYPES.includes(type)) return { rule: RULES.Article, as: 'Article' };
  if (ORG_TYPES.includes(type)) return { rule: RULES.Organization, as: 'Organization' };
  if (type === 'Service') return { rule: RULES.Service, as: 'Service' };
  if (LOCAL_HINT.test(type)) return { rule: LOCAL_RULE, as: 'LocalBusiness' };
  return null;
}

const has = (n: Node, k: string) => {
  const v = n[k];
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
};

const isAbsUrl = (s: unknown) => typeof s === 'string' && /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(s);
const PHONE_OK = /^\+?[\d\s().-]{8,20}$/;
const OH_OK = /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)*( \d{2}:\d{2}-\d{2}:\d{2})?$/;

function str(v: unknown): string | null {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return null;
}

export interface NodeCheck {
  type: string;
  errors: string[];
  warnings: string[];
  missing: string[];
}

/** Valide un nœud typé (sans récursion : les nœuds imbriqués sont validés séparément). */
export function validateNode(n: Node, visibleText?: string): NodeCheck | null {
  const types = typesOf(n);
  const type = types[0];
  if (!type) return null;
  const r = types.map(ruleFor).find(Boolean) ?? null;
  const errors: string[] = [];
  const warnings: string[] = [];
  const missing: string[] = [];
  const label = type;
  if (r) {
    for (const alts of r.rule.required)
      if (!alts.some((k) => has(n, k))) {
        errors.push(`${label} : propriété requise absente (${alts.join(' ou ')}).`);
        missing.push(`${label}.${alts[0]}`);
      }
    for (const alts of r.rule.recommended)
      if (!alts.some((k) => has(n, k))) {
        warnings.push(`${label} : propriété recommandée absente (${alts.join(' ou ')}).`);
        missing.push(`${label}.${alts[0]}`);
      }
  }
  // Formats
  const tel = str(n.telephone);
  if (tel && !PHONE_OK.test(tel.trim())) warnings.push(`${label} : téléphone « ${tel} » mal formé (format conseillé : +33 1 23 45 67 89).`);
  for (const k of ['url', 'logo'] as const) {
    const v = n[k];
    if (typeof v === 'string' && v && !isAbsUrl(v)) warnings.push(`${label} : « ${k} » doit être une adresse absolue (https://…).`);
  }
  const sameAs = Array.isArray(n.sameAs) ? n.sameAs : n.sameAs ? [n.sameAs] : [];
  for (const s of sameAs) if (!isAbsUrl(s)) warnings.push(`${label} : « sameAs » contient une adresse non absolue (${String(s).slice(0, 80)}).`);
  const oh = n.openingHours;
  for (const o of Array.isArray(oh) ? oh : oh ? [oh] : []) if (typeof o === 'string' && !OH_OK.test(o.trim())) warnings.push(`${label} : « openingHours » invalide (« ${o} ») ; format attendu « Mo-Fr 09:00-18:00 », ou utilisez openingHoursSpecification.`);
  if (type === 'Offer') {
    const p = str(n.price);
    if (p && !/^\d+(\.\d{1,4})?$/.test(p.trim())) errors.push(`Offer : prix « ${p} » invalide (nombre avec un point décimal, sans symbole : 19.90).`);
    const c = str(n.priceCurrency);
    if (c && !/^[A-Z]{3}$/.test(c)) errors.push(`Offer : devise « ${c} » invalide (code ISO 4217 : EUR).`);
    const a = str(n.availability);
    if (a && !/^(https?:\/\/schema\.org\/)?(InStock|OutOfStock|PreOrder|BackOrder|Discontinued|InStoreOnly|LimitedAvailability|OnlineOnly|PreSale|SoldOut|Reserved)$/.test(a)) warnings.push(`Offer : disponibilité « ${a} » non reconnue (https://schema.org/InStock…).`);
  }
  if (type === 'AggregateRating') {
    const v = Number(str(n.ratingValue));
    const best = Number(str(n.bestRating) ?? 5);
    if (str(n.ratingValue) && (!Number.isFinite(v) || v < 0 || v > (Number.isFinite(best) ? best : 5))) errors.push(`AggregateRating : note « ${String(n.ratingValue)} » hors échelle.`);
    warnings.push('AggregateRating : la note doit refléter des avis réels, visibles sur la page et collectés par vous (pas une note Google recopiée).');
  }
  if (type === 'FAQPage') {
    const me = Array.isArray(n.mainEntity) ? (n.mainEntity as Node[]) : n.mainEntity ? [n.mainEntity as Node] : [];
    me.forEach((q, i) => {
      const ans = q?.acceptedAnswer as Node | undefined;
      if (!q?.name || !ans || !str(ans.text)) errors.push(`FAQPage : la question ${i + 1} est incomplète (name et acceptedAnswer.text requis).`);
    });
    if (visibleText && me.length) {
      const hidden = me.filter((q) => typeof q?.name === 'string' && !visibleText.toLowerCase().includes(stripTags(q.name as string).toLowerCase().slice(0, 40)));
      if (hidden.length) warnings.push(`FAQPage : ${hidden.length} question(s) introuvable(s) dans le texte de la page. Le balisage doit décrire un contenu visible.`);
    }
  }
  if (visibleText && r && (r.as === 'LocalBusiness' || r.as === 'Organization' || r.as === 'Product')) {
    const name = str(n.name);
    if (name && name.length > 2 && !visibleText.toLowerCase().includes(name.toLowerCase())) warnings.push(`${label} : le nom « ${name} » n’apparaît pas dans le texte de la page.`);
  }
  return { type, errors, warnings, missing };
}

/* ------------------------------------------------------------------ */
/* Extraction et validation                                            */
/* ------------------------------------------------------------------ */

/** Types déclarés en microdonnées (itemtype). */
export function microdataTypes(html: string): string[] {
  return [...new Set([...html.matchAll(/itemtype\s*=\s*["']?https?:\/\/schema\.org\/([A-Za-z]+)/gi)].map((m) => m[1]))];
}

function lenientParse(raw: string): { data: unknown; error: string | null } {
  const s = raw.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '').trim();
  try {
    return { data: JSON.parse(s), error: null };
  } catch (e) {
    // Virgules finales : erreur fréquente que les navigateurs tolèrent mais pas les robots.
    try {
      const data = JSON.parse(s.replace(/,\s*([}\]])/g, '$1'));
      return { data, error: 'virgule en trop avant une accolade ou un crochet fermant (certains robots rejettent le bloc)' };
    } catch {
      return { data: null, error: (e as Error).message.replace(/^JSON\.parse: /, '') };
    }
  }
}

/** Valide des blocs JSON-LD bruts (texte), éventuellement contre le texte visible de la page. */
export function validateBlocks(raws: string[], page?: Pick<ParsedPage, 'bodyText' | 'raw'> | null): JsonLdValidation {
  const blocks: JsonLdBlock[] = raws.map((raw, index) => {
    const { data, error } = lenientParse(raw);
    const errors: string[] = [];
    const warnings: string[] = [];
    const missing: string[] = [];
    if (data === null) {
      errors.push(`Bloc ${index + 1} : JSON invalide (${error}). Les robots ignorent un bloc illisible.`);
      return { index, types: [], valid: false, data: null, errors, warnings, missing };
    }
    if (error) warnings.push(`Bloc ${index + 1} : ${error}.`);
    const tops = topNodes(data);
    for (const t of tops) {
      const ctx = (t['@context'] ?? (data as Node)?.['@context']) as unknown;
      const ctxOk = typeof ctx === 'string' ? /schema\.org/.test(ctx) : !!ctx && JSON.stringify(ctx).includes('schema.org');
      if (!ctxOk) errors.push(`Bloc ${index + 1} : « @context » absent ou différent de https://schema.org.`);
      if (!typesOf(t).length) errors.push(`Bloc ${index + 1} : nœud sans « @type ».`);
      break;
    }
    const nodes = allNodes(data);
    for (const n of nodes) {
      const c = validateNode(n, page?.bodyText);
      if (!c) continue;
      errors.push(...c.errors);
      warnings.push(...c.warnings);
      missing.push(...c.missing);
    }
    return { index, types: [...new Set(nodes.flatMap(typesOf))], valid: errors.length === 0, data, errors: [...new Set(errors)], warnings: [...new Set(warnings)], missing: [...new Set(missing)] };
  });
  const microdata = page ? microdataTypes(page.raw) : [];
  return {
    blocks,
    microdataTypes: microdata,
    errors: blocks.flatMap((b) => b.errors),
    warnings: [...blocks.flatMap((b) => b.warnings), ...(!blocks.length && !microdata.length && page ? ['Aucune donnée structurée trouvée sur cette page.'] : [])],
    missing: [...new Set(blocks.flatMap((b) => b.missing))],
    note: JSONLD_NOTE,
  };
}

/** Saisie collée : JSON brut, ou HTML contenant des <script type="application/ld+json">. */
export function validateJsonLdText(input: string): JsonLdValidation {
  if (/<script\b/i.test(input) || /<html\b/i.test(input)) {
    const page = parseHtml(input);
    return validateBlocks(page.jsonLdRaw, /<body\b/i.test(input) ? page : null);
  }
  return validateBlocks([input]);
}

/** Valide un objet déjà analysé. */
export function validateJsonLdValue(value: unknown): JsonLdValidation {
  return validateBlocks([JSON.stringify(value)]);
}

/** Récupère une page et valide ses données structurées. */
export async function validateJsonLdUrl(url: string, opts: SafeFetchOptions = {}): Promise<JsonLdValidation & { url: string; finalUrl: string }> {
  const res = await safeFetch(url, opts);
  const page = parseHtml(res.body);
  return { url: res.url, finalUrl: res.finalUrl, ...validateBlocks(page.jsonLdRaw, page) };
}

/* ------------------------------------------------------------------ */
/* Générateur                                                          */
/* ------------------------------------------------------------------ */

export type GenerateType = 'LocalBusiness' | 'Organization' | 'Product' | 'FAQPage';
export const GENERATE_TYPES: GenerateType[] = ['LocalBusiness', 'Organization', 'Product', 'FAQPage'];

export interface GenerateFields {
  name?: string;
  /** Métier (« plombier ») : choisit le sous-type schema.org (Plumber…). */
  trade?: string;
  /** Sous-type forcé (Plumber, Restaurant…). */
  schemaType?: string;
  url?: string;
  description?: string;
  telephone?: string;
  address?: string;
  city?: string;
  /** « Lun-ven 8h-19h, sam 9h-13h » */
  openingHours?: string;
  priceRange?: string;
  areaServed?: string;
  services?: string;
  foundingYear?: string;
  founder?: string;
  logo?: string;
  sameAs?: string[];
  // Produit
  brand?: string;
  image?: string;
  sku?: string;
  gtin?: string;
  category?: string;
  price?: string;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  ratingValue?: string;
  reviewCount?: string;
  // FAQ
  faq?: { q: string; a: string }[];
}

export interface GenerateResult {
  type: GenerateType;
  jsonld: Node;
  script: string;
  validation: JsonLdValidation;
  notes: string[];
}

function pseudoBusiness(f: GenerateFields): Business {
  return {
    id: 'outil-json-ld',
    name: (f.name ?? '').trim() || 'Votre entreprise',
    trade: f.trade ?? '',
    city: f.city ?? '',
    website: f.url,
    plan: 'free',
    lastScore: null,
    createdAt: new Date(0).toISOString(),
  };
}

/** Génère un JSON-LD prêt à coller, à partir des seules valeurs saisies (rien n'est inventé). */
export function generateJsonLd(type: GenerateType, f: GenerateFields): GenerateResult {
  const b = pseudoBusiness(f);
  const facts: FactsMap = {
    ...(f.address ? { adresse: f.address } : {}),
    ...(f.telephone ? { telephone: f.telephone } : {}),
    ...(f.openingHours ? { horaires: f.openingHours } : {}),
    ...(f.priceRange ? { prix: f.priceRange } : {}),
    ...(f.areaServed ? { zone: f.areaServed } : {}),
    ...(f.services ? { services: f.services } : {}),
    ...(f.foundingYear ? { creation: f.foundingYear } : {}),
    ...(f.founder ? { dirigeant: f.founder } : {}),
    ...(f.url ? { site: f.url } : {}),
  };
  const settings = { sameAs: f.sameAs ?? [], logoUrl: f.logo, schemaType: type === 'LocalBusiness' ? f.schemaType : undefined };
  const notes: string[] = ['Collez ce bloc dans le <head> de la page concernée. Les informations balisées doivent aussi être visibles sur la page.'];
  let out: Node;
  if (type === 'LocalBusiness' || type === 'Organization') {
    const g = buildJsonLd(b, facts, type === 'LocalBusiness' ? 'local' : 'pme', { settings, description: f.description });
    out = g;
    if (type === 'LocalBusiness' && f.openingHours && !((g['@graph'] as Node[])[0].openingHoursSpecification))
      notes.push('Horaires non reconnus : écrivez-les sous la forme « Lun-ven 8h-19h, sam 9h-13h ». Rien n’a été inventé.');
  } else if (type === 'Product') {
    const price = f.price ? Number(String(f.price).replace(',', '.').replace(/[^\d.]/g, '')) : undefined;
    const p: ExecProduct = {
      name: (f.name ?? '').trim() || 'Votre produit',
      description: f.description,
      url: f.url,
      image: f.image,
      sku: f.sku,
      gtin: f.gtin,
      brand: f.brand,
      category: f.category,
      price: price !== undefined && Number.isFinite(price) ? price : undefined,
      currency: f.currency && /^[A-Z]{3}$/.test(f.currency) ? f.currency : 'EUR',
      availability: f.availability,
    };
    const g = buildJsonLd({ ...b, name: f.brand || b.name }, {}, 'ecommerce', { settings: { products: [p] } });
    const prod = (g['@graph'] as Node[]).find((n) => n['@type'] === 'Product') as Node;
    if (prod.offers) delete (prod.offers as Node).seller; // vendeur : nœud absent de ce bloc autonome
    if (!f.brand) delete prod.brand;
    if (f.ratingValue && f.reviewCount) {
      prod.aggregateRating = { '@type': 'AggregateRating', ratingValue: f.ratingValue, reviewCount: f.reviewCount, bestRating: '5' };
      notes.push('Note agrégée : uniquement si elle reflète des avis réels, visibles sur la page et collectés par vous.');
    }
    if (p.price === undefined) notes.push('Sans prix, Google n’affiche pas d’extrait enrichi produit : ajoutez le prix et la devise.');
    out = { '@context': 'https://schema.org', ...prod };
  } else {
    const faq = (f.faq ?? []).filter((x) => x.q?.trim() && x.a?.trim()).slice(0, 30);
    const g = buildJsonLd(b, {}, 'pme', { faq, ...(f.url ? { pageUrl: f.url } : {}) });
    const node = (g['@graph'] as Node[]).find((n) => n['@type'] === 'FAQPage');
    out = node ? { '@context': 'https://schema.org', ...node } : { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [] };
    delete out.about;
    notes.push('Les questions et réponses doivent être affichées telles quelles sur la page. Depuis 2023, Google ne montre plus ces extraits que pour quelques sites officiels ; le balisage reste lisible par les IA.');
  }
  return { type, jsonld: out, script: jsonLdScriptTag(out), validation: validateJsonLdValue(out), notes };
}
