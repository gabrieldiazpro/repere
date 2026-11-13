/**
 * Catalogue suivi (livrable 1) : produits phares saisis à la main, importés depuis des URL de fiches
 * (audit de fiche produit de `@/lib/siteaudit`), depuis le sitemap, depuis le `/products.json` public d'une
 * boutique Shopify, ou via le connecteur Shopify. Persistance : collection `ecom.catalog` (un document par commerce).
 */
import { productFromHtml } from '@/lib/siteaudit';
import { putDoc, getDoc } from '@/lib/store';
import { safeFetch, type Fetcher } from './fetch';
import type { Availability, Catalog, CatalogProduct, CatalogSource, ProductVariant } from './types';

export const CATALOG_COLLECTION = 'ecom.catalog';
export const MAX_PRODUCTS = 200;
export const MAX_IMPORT_URLS = 30;

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'produit'
  );
}

/** « 12,90 € », « 12.90 », « 1 234,50 » → nombre, ou undefined. */
export function parsePrice(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 && v < 1_000_000 ? Math.round(v * 100) / 100 : undefined;
  if (typeof v !== 'string') return undefined;
  const m = /(\d{1,3}(?:[\s  ]\d{3})+|\d+)(?:[.,](\d{1,2}))?/.exec(v);
  if (!m) return undefined;
  const n = Number(`${m[1].replace(/[\s  ]/g, '')}.${m[2] ?? '0'}`);
  return parsePrice(n);
}

const str = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const s = v.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, max) : undefined;
};

function httpUrl(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`);
    if (!/^https?:$/.test(u.protocol) || u.username || u.password) return undefined;
    u.hash = '';
    return u.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}

function availabilityOf(v: unknown): Availability | undefined {
  const s = typeof v === 'string' ? v.toLowerCase() : '';
  if (/outofstock|out_of_stock|soldout|rupture/.test(s)) return 'OutOfStock';
  if (/preorder|pre_order|precommande/.test(s)) return 'PreOrder';
  if (/instock|in_stock|en stock|limitedavailability/.test(s)) return 'InStock';
  return undefined;
}

/** Entrée libre (formulaire, CSV, import) → produit validé, ou une erreur lisible. */
export function normalizeProduct(raw: Record<string, unknown>, source: CatalogSource, now = new Date().toISOString()): CatalogProduct | { error: string } {
  const name = str(raw.name, 120);
  if (!name || name.length < 2) return { error: 'Le nom du produit est obligatoire.' };
  const price = parsePrice(raw.price);
  const gtinRaw = typeof raw.gtin === 'string' || typeof raw.gtin === 'number' ? String(raw.gtin).replace(/\s/g, '') : '';
  if (gtinRaw && !/^\d{8,14}$/.test(gtinRaw)) return { error: 'Le GTIN doit compter de 8 à 14 chiffres.' };
  const aliases = (Array.isArray(raw.aliases) ? raw.aliases : typeof raw.aliases === 'string' ? raw.aliases.split(/[,;|]/) : [])
    .map((a) => str(a, 80))
    .filter((a): a is string => Boolean(a))
    .slice(0, 8);
  const variants: ProductVariant[] = (Array.isArray(raw.variants) ? raw.variants : [])
    .slice(0, 30)
    .map((v) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {}))
    .map((v) => ({ name: str(v.name, 80) ?? '', price: parsePrice(v.price), sku: str(v.sku, 60), gtin: typeof v.gtin === 'string' && /^\d{8,14}$/.test(v.gtin) ? v.gtin : undefined }))
    .filter((v) => v.name);
  let rating: CatalogProduct['rating'];
  const r = raw.rating as Record<string, unknown> | undefined;
  const rv = Number(r?.value ?? raw.ratingValue);
  const rc = Number(r?.count ?? raw.reviewCount);
  if (Number.isFinite(rv) && rv > 0 && rv <= 5 && Number.isFinite(rc) && rc >= 1) rating = { value: Math.round(rv * 100) / 100, count: Math.floor(rc), source: str(r?.source, 60) };
  const p: CatalogProduct = {
    id: str(raw.id, 60) ? slugify(String(raw.id)) : slugify(name),
    name,
    url: httpUrl(raw.url),
    category: str(raw.category, 60)?.toLowerCase(),
    price,
    currency: price !== undefined ? (str(raw.currency, 3)?.toUpperCase() ?? 'EUR') : undefined,
    gtin: gtinRaw || undefined,
    sku: str(raw.sku, 60),
    image: httpUrl(raw.image),
    description: str(raw.description, 1000),
    brand: str(raw.brand, 80),
    aliases: aliases.length ? aliases : undefined,
    variants: variants.length ? variants : undefined,
    rating,
    availability: availabilityOf(raw.availability),
    source,
    updatedAt: now,
  };
  for (const k of Object.keys(p) as (keyof CatalogProduct)[]) if (p[k] === undefined) delete p[k];
  return p;
}

/** Fusionne des produits dans un catalogue (même id ou même URL : mise à jour), plafonné à MAX_PRODUCTS. */
export function mergeProducts(existing: CatalogProduct[], incoming: CatalogProduct[]): { products: CatalogProduct[]; added: number; updated: number; skipped: number } {
  const out = [...existing];
  let added = 0, updated = 0, skipped = 0;
  for (const p of incoming) {
    const i = out.findIndex((x) => x.id === p.id || (p.url && x.url === p.url));
    if (i >= 0) {
      out[i] = { ...out[i], ...p, id: out[i].id };
      updated++;
    } else if (out.length < MAX_PRODUCTS) {
      let id = p.id;
      for (let n = 2; out.some((x) => x.id === id); n++) id = `${p.id}-${n}`;
      out.push({ ...p, id });
      added++;
    } else skipped++;
  }
  return { products: out, added, updated, skipped };
}

/* ------------------------------------------------------------------ */
/* Persistance                                                         */
/* ------------------------------------------------------------------ */

export async function loadCatalog(businessId: string): Promise<Catalog | null> {
  return (await getDoc<Catalog>(CATALOG_COLLECTION, businessId))?.data ?? null;
}

export async function saveCatalog(c: Catalog): Promise<Catalog> {
  const next = { ...c, products: c.products.slice(0, MAX_PRODUCTS), updatedAt: new Date().toISOString() };
  await putDoc(CATALOG_COLLECTION, c.businessId, next, c.businessId);
  return next;
}

export function emptyCatalog(businessId: string, brand: string, website?: string): Catalog {
  return { businessId, brand, website, products: [], updatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Imports                                                             */
/* ------------------------------------------------------------------ */

export interface ImportResult {
  products: CatalogProduct[];
  errors: { url: string; error: string }[];
}

/** Fiche produit publique → produit (audit de fiche de `@/lib/siteaudit`). */
export function productFromPage(html: string, url: string, now = new Date().toISOString()): CatalogProduct | null {
  const rep = productFromHtml(html, url);
  const d = rep.product;
  if (!d.name) return null;
  const p = normalizeProduct(
    {
      name: d.name,
      url,
      price: d.price,
      currency: d.priceCurrency,
      gtin: d.gtin && /^\d{8,14}$/.test(d.gtin) ? d.gtin : undefined,
      sku: d.sku,
      image: d.images[0],
      description: d.description,
      brand: d.brand,
      availability: d.availability,
      ratingValue: d.ratingValue,
      reviewCount: d.reviewCount,
    },
    'url',
    now,
  );
  if ('error' in p) return null;
  if (p.rating) p.rating.source = 'balisage de la fiche';
  return p;
}

export async function importFromUrls(urls: string[], fetcher: Fetcher = safeFetch): Promise<ImportResult> {
  const list = [...new Set(urls.map((u) => httpUrl(u)).filter((u): u is string => Boolean(u)))].slice(0, MAX_IMPORT_URLS);
  const res: ImportResult = { products: [], errors: [] };
  const out = await Promise.all(list.map(async (url) => ({ url, page: await fetcher(url, 'html') })));
  for (const { url, page } of out) {
    if (!page || page.status >= 400) {
      res.errors.push({ url, error: 'Page inaccessible (ou interdite à notre robot par robots.txt).' });
      continue;
    }
    const p = productFromPage(page.body, page.url || url);
    if (p) res.products.push(p);
    else res.errors.push({ url, error: 'Aucun nom de produit lisible (ni balisage Product, ni Open Graph).' });
  }
  return res;
}

const PRODUCT_PATH = /\/(products?|produits?|p|shop|boutique|article|item)\/[^/?#]+/i;

/** URL de fiches produit listées dans un sitemap (suit un index de sitemaps, 3 sous-sitemaps au plus). */
export async function productUrlsFromSitemap(site: string, fetcher: Fetcher = safeFetch, max = MAX_IMPORT_URLS): Promise<string[]> {
  const base = httpUrl(site);
  if (!base) return [];
  const origin = new URL(base).origin;
  const first = /\.xml(\?|$)/i.test(base) ? base : `${origin}/sitemap.xml`;
  const locs = (xml: string) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].replace(/&amp;/g, '&'));
  const page = await fetcher(first, 'xml');
  if (!page || page.status >= 400) return [];
  let urls: string[] = [];
  if (/<sitemapindex\b/i.test(page.body)) {
    const children = locs(page.body)
      .filter((u) => u.startsWith(origin))
      .sort((a, b) => Number(/product|produit/i.test(b)) - Number(/product|produit/i.test(a)))
      .slice(0, 3);
    for (const c of children) {
      const sub = await fetcher(c, 'xml');
      if (sub && sub.status < 400) urls.push(...locs(sub.body));
    }
  } else urls = locs(page.body);
  return [...new Set(urls.filter((u) => u.startsWith(origin) && PRODUCT_PATH.test(new URL(u).pathname)))].slice(0, max);
}

interface ShopifyPublicProduct {
  title?: string;
  handle?: string;
  product_type?: string;
  vendor?: string;
  body_html?: string;
  variants?: { title?: string; price?: string; sku?: string; barcode?: string; available?: boolean }[];
  images?: { src?: string }[];
}

/** `/products.json` public d'une boutique Shopify (sans connexion) → produits. */
export function productsFromShopifyJson(json: unknown, origin: string, now = new Date().toISOString()): CatalogProduct[] {
  const list = (json as { products?: ShopifyPublicProduct[] })?.products;
  if (!Array.isArray(list)) return [];
  const out: CatalogProduct[] = [];
  for (const sp of list.slice(0, MAX_PRODUCTS)) {
    const variants = (sp.variants ?? []).filter((v) => v.title && v.title !== 'Default Title');
    const v0 = sp.variants?.[0];
    const p = normalizeProduct(
      {
        id: sp.handle,
        name: sp.title,
        url: sp.handle ? `${origin}/products/${sp.handle}` : undefined,
        category: sp.product_type || undefined,
        price: v0?.price,
        currency: 'EUR',
        sku: v0?.sku || undefined,
        gtin: v0?.barcode && /^\d{8,14}$/.test(v0.barcode) ? v0.barcode : undefined,
        image: sp.images?.[0]?.src,
        description: sp.body_html?.replace(/<[^>]+>/g, ' '),
        brand: sp.vendor,
        availability: v0 ? (sp.variants?.some((v) => v.available !== false) ? 'InStock' : 'OutOfStock') : undefined,
        variants: variants.map((v) => ({ name: v.title, price: v.price, sku: v.sku || undefined, gtin: v.barcode || undefined })),
      },
      'products_json',
      now,
    );
    if (!('error' in p)) out.push(p);
  }
  return out;
}

export async function importFromProductsJson(site: string, fetcher: Fetcher = safeFetch): Promise<ImportResult> {
  const base = httpUrl(site);
  if (!base) return { products: [], errors: [{ url: site, error: 'Adresse invalide.' }] };
  const origin = new URL(base).origin;
  const url = `${origin}/products.json?limit=250`;
  const page = await fetcher(url, 'json');
  if (!page || page.status >= 400) return { products: [], errors: [{ url, error: 'Catalogue public introuvable (boutique non Shopify ou catalogue fermé).' }] };
  try {
    const products = productsFromShopifyJson(JSON.parse(page.body), origin);
    return { products, errors: products.length ? [] : [{ url, error: 'Aucun produit dans le catalogue public.' }] };
  } catch {
    return { products: [], errors: [{ url, error: 'Réponse illisible.' }] };
  }
}

/** Import depuis le sitemap : repère les fiches produit puis lit chacune. */
export async function importFromSitemap(site: string, fetcher: Fetcher = safeFetch, max = 20): Promise<ImportResult> {
  const urls = await productUrlsFromSitemap(site, fetcher, max);
  if (!urls.length) return { products: [], errors: [{ url: site, error: 'Aucune fiche produit trouvée dans le sitemap.' }] };
  const r = await importFromUrls(urls, fetcher);
  return { products: r.products.map((p) => ({ ...p, source: 'sitemap' as const })), errors: r.errors };
}
