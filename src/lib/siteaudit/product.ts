/**
 * Audit de fiche produit (/100) : ce qu'un moteur ou une IA peut extraire de la page (Product, Offer,
 * AggregateRating, Review) depuis le JSON-LD, les microdonnées et Open Graph. Aucune valeur n'est inventée :
 * le balisage proposé ne reprend que ce qui a été trouvé.
 */
import { safeFetch, type SafeFetchOptions } from './fetch';
import { parseAttrs, parseHtml, stripTags, wordCount, type ParsedPage } from './html';
import { allNodes, typesOf } from './jsonld';
import { finalize, mkCheck } from './readiness';
import type { Check, ProductData, ProductReport } from './types';

type Node = Record<string, unknown>;

export const PRODUCT_WEIGHTS: Record<string, number> = {
  structured: 15,
  name: 5,
  image: 8,
  description: 8,
  price: 12,
  availability: 8,
  brand: 6,
  identifier: 8,
  rating: 8,
  reviews: 5,
  shipping: 6,
  returns: 6,
  consistency: 5,
};

const s = (v: unknown): string | undefined => {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && !Array.isArray(v)) return s((v as Node).name ?? (v as Node)['@id'] ?? (v as Node).url);
  if (Array.isArray(v)) return s(v[0]);
  return undefined;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v]);
const num = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(v.replace(/\s/g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
};
const shortAvail = (a: string | undefined) => a?.replace(/^https?:\/\/schema\.org\//i, '');

/** Microdonnées : propriétés itemprop de la page (première occurrence de chaque nom). */
export function microdataProps(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(/<([a-z0-9]+)\b([^>]*\bitemprop\s*=\s*["']?[^"'>\s]+[^>]*)>/gi)) {
    const attrs = parseAttrs(m[2]);
    const names = (attrs.itemprop ?? '').split(/\s+/).filter(Boolean);
    let value = attrs.content ?? attrs.href ?? attrs.src ?? '';
    if (!value && !('itemscope' in attrs)) {
      const rest = html.slice((m.index ?? 0) + m[0].length, (m.index ?? 0) + m[0].length + 2000);
      const close = rest.search(new RegExp(`</${m[1]}>`, 'i'));
      value = stripTags(close >= 0 ? rest.slice(0, close) : rest.slice(0, 200));
    }
    for (const n of names) if (!(n in out) && value) out[n] = value.slice(0, 500);
  }
  return out;
}

/** Extraction des données produit (JSON-LD, puis microdonnées, puis Open Graph). */
export function extractProduct(page: ParsedPage): { data: ProductData; ldNode: Node | null } {
  const nodes = page.jsonLdRaw.flatMap((r) => {
    try {
      return allNodes(JSON.parse(r));
    } catch {
      return [];
    }
  });
  const prod = nodes.find((n) => typesOf(n).some((t) => t === 'Product' || t === 'ProductGroup' || t === 'IndividualProduct')) ?? null;
  const md = /itemtype\s*=\s*["']?https?:\/\/schema\.org\/Product/i.test(page.raw) ? microdataProps(page.raw) : {};
  const og = page.og;
  const offer = prod ? ((arr(prod.offers)[0] as Node | undefined) ?? null) : null;
  const offerInner = offer && typesOf(offer).includes('AggregateOffer') ? offer : offer;
  const priceSpec = offerInner ? (arr(offerInner.priceSpecification)[0] as Node | undefined) : undefined;
  const rating = prod ? (prod.aggregateRating as Node | undefined) : undefined;
  const ld = {
    price: s(offerInner?.price) ?? s(offerInner?.lowPrice) ?? s(priceSpec?.price),
    currency: s(offerInner?.priceCurrency) ?? s(priceSpec?.priceCurrency),
  };
  const ogPrice = og['product:price:amount'] ?? og['og:price:amount'];
  const ogCurrency = og['product:price:currency'] ?? og['og:price:currency'];
  const data: ProductData = {
    name: s(prod?.name) ?? md.name ?? (og['og:type'] === 'product' ? og['og:title'] : undefined),
    brand: s(prod?.brand) ?? md.brand ?? og['product:brand'],
    gtin: s(prod?.gtin) ?? s(prod?.gtin13) ?? s(prod?.gtin8) ?? s(prod?.gtin12) ?? s(prod?.gtin14) ?? md.gtin13 ?? md.gtin ?? og['product:ean'],
    mpn: s(prod?.mpn) ?? md.mpn,
    sku: s(prod?.sku) ?? md.sku ?? og['product:retailer_item_id'],
    description: s(prod?.description) ?? md.description ?? og['og:description'] ?? page.metaDescription ?? undefined,
    images: [...new Set([...arr(prod?.image).map(s), md.image, og['og:image']].filter((x): x is string => !!x))].slice(0, 10),
    price: ld.price ?? md.price ?? ogPrice,
    priceCurrency: ld.currency ?? md.priceCurrency ?? ogCurrency,
    availability: shortAvail(s(offerInner?.availability) ?? md.availability ?? og['product:availability'] ?? og['og:availability']),
    ratingValue: s(rating?.ratingValue) ?? md.ratingValue,
    reviewCount: s(rating?.reviewCount) ?? s(rating?.ratingCount) ?? md.reviewCount ?? md.ratingCount,
    reviews: prod ? arr(prod.review).length : 0,
    hasShipping: !!(offerInner && (offerInner.shippingDetails || offerInner.deliveryLeadTime)),
    hasReturns: !!(offerInner?.hasMerchantReturnPolicy || prod?.hasMerchantReturnPolicy),
    sources: { jsonld: !!prod, microdata: Object.keys(md).length > 0, opengraph: og['og:type'] === 'product' || !!ogPrice },
    conflicts: [],
  };
  const prices = [ld.price && { src: 'JSON-LD', v: num(ld.price) }, md.price && { src: 'microdonnées', v: num(md.price) }, ogPrice && { src: 'Open Graph', v: num(ogPrice) }].filter(Boolean) as { src: string; v: number | null }[];
  for (let i = 1; i < prices.length; i++)
    if (prices[i].v !== null && prices[0].v !== null && Math.abs((prices[i].v as number) - (prices[0].v as number)) > 0.009) data.conflicts.push(`Prix différent selon la source : ${prices[0].src} ${frPrice(prices[0].v, data.priceCurrency)}, ${prices[i].src} ${frPrice(prices[i].v, data.priceCurrency)}.`);
  const p = num(data.price);
  if (p !== null && p > 0) {
    const text = page.bodyText.replace(/\s/g, '');
    const variants = [p.toFixed(2).replace('.', ','), p.toFixed(2), String(p).replace('.', ','), String(p)];
    if (!variants.some((v) => text.includes(v))) data.conflicts.push(`Le prix balisé (${frPrice(data.price, data.priceCurrency)}) est introuvable dans le texte de la page : il doit être visible.`);
  }
  return { data, ldNode: prod };
}

/** Montant lisible en français pour les textes de diagnostic : « 12.9 », « EUR » → « 12,90 € » (valeur brute sinon). */
export function frPrice(v: string | number | null | undefined, currency?: string | null): string {
  const n = typeof v === "number" ? v : num(v == null ? undefined : String(v));
  if (n === null || !Number.isFinite(n)) return String(v ?? '');
  const amount = n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[\u202f\u00a0]/g, ' ');
  const cur = (currency ?? '').toUpperCase();
  return cur && cur !== 'EUR' ? `${amount} ${cur}` : `${amount} €`;
}

export function productChecks(page: ParsedPage, data: ProductData): { checks: Check[]; descriptionWords: number } {
  const W = PRODUCT_WEIGHTS;
  const c: Check[] = [];
  const src = data.sources;
  c.push(
    src.jsonld
      ? mkCheck('structured', 'Balisage Product (JSON-LD)', 'ok', 'Product déclaré en JSON-LD.', '', W.structured)
      : mkCheck('structured', 'Balisage Product (JSON-LD)', src.microdata ? 'warn' : 'fail', src.microdata ? 'Produit en microdonnées seulement.' : src.opengraph ? 'Seulement des balises Open Graph produit.' : 'Aucun balisage produit.', 'Ajoutez un bloc JSON-LD Product avec Offer (prix, devise, disponibilité) : balisage proposé ci-dessous.', W.structured, { task: 'jsonld' }),
  );
  c.push(data.name ? mkCheck('name', 'Nom du produit', 'ok', `« ${data.name.slice(0, 100)} »`, '', W.name) : mkCheck('name', 'Nom du produit', 'fail', 'Nom non balisé.', 'Déclarez « name » dans le Product.', W.name));
  c.push(
    data.images.length >= 2
      ? mkCheck('image', 'Images', 'ok', `${data.images.length} image(s) déclarée(s).`, '', W.image)
      : mkCheck('image', 'Images', data.images.length ? 'warn' : 'fail', data.images.length ? 'Une seule image déclarée.' : 'Aucune image déclarée.', 'Déclarez plusieurs images (formats 1:1, 4:3, 16:9) en adresses absolues.', W.image),
  );
  const dw = wordCount(stripTags(data.description ?? ''));
  const mainW = wordCount(page.mainText);
  c.push(
    dw >= 50 || (dw >= 15 && mainW >= 300)
      ? mkCheck('description', 'Description', 'ok', `Description de ${dw} mots (${mainW} mots sur la page).`, '', W.description)
      : mkCheck('description', 'Description', dw ? 'warn' : 'fail', dw ? `Description courte (${dw} mots).` : 'Aucune description.', 'Décrivez usage, matière, dimensions, compatibilités et public visé : ce sont les critères que les IA comparent.', W.description, { task: 'content' }),
  );
  const pOk = !!data.price && num(data.price) !== null;
  c.push(
    pOk && data.priceCurrency
      ? mkCheck('price', 'Prix et devise', 'ok', `${frPrice(data.price, data.priceCurrency)} (balisé ${data.price} ${data.priceCurrency}).`, '', W.price)
      : mkCheck('price', 'Prix et devise', pOk ? 'warn' : 'fail', pOk ? 'Prix sans devise.' : 'Aucun prix balisé.', 'Déclarez offers.price (nombre, point décimal) et offers.priceCurrency (EUR).', W.price),
  );
  c.push(data.availability ? mkCheck('availability', 'Disponibilité', 'ok', `${data.availability}.`, '', W.availability) : mkCheck('availability', 'Disponibilité', 'fail', 'Disponibilité non balisée.', 'Déclarez offers.availability (https://schema.org/InStock…).', W.availability));
  c.push(data.brand ? mkCheck('brand', 'Marque', 'ok', `${data.brand}.`, '', W.brand) : mkCheck('brand', 'Marque', 'fail', 'Marque non balisée.', 'Déclarez brand (même pour votre propre marque).', W.brand));
  c.push(
    data.gtin || data.mpn
      ? mkCheck('identifier', 'Identifiant produit (GTIN/MPN)', 'ok', data.gtin ? `GTIN ${data.gtin}.` : `MPN ${data.mpn}.`, '', W.identifier)
      : mkCheck('identifier', 'Identifiant produit (GTIN/MPN)', data.sku ? 'warn' : 'fail', data.sku ? `Seulement un SKU interne (${data.sku}).` : 'Aucun identifiant.', 'Ajoutez le GTIN (EAN) s’il existe, sinon le MPN : il permet de reconnaître le produit d’un site à l’autre.', W.identifier),
  );
  c.push(
    data.ratingValue && data.reviewCount
      ? mkCheck('rating', 'Note agrégée', 'ok', `${data.ratingValue} sur ${data.reviewCount} avis.`, '', W.rating)
      : mkCheck('rating', 'Note agrégée', 'warn', data.ratingValue ? 'Note sans nombre d’avis.' : 'Pas de note agrégée.', 'Si vous collectez de vrais avis sur ce produit, affichez-les et déclarez aggregateRating. N’inventez jamais de note.', W.rating, { task: 'review_kit' }),
  );
  c.push(
    data.reviews
      ? mkCheck('reviews', 'Avis détaillés', 'ok', `${data.reviews} avis balisé(s).`, '', W.reviews)
      : mkCheck('reviews', 'Avis détaillés', 'warn', 'Aucun avis balisé.', 'Balisez quelques avis réels visibles (Review) : les IA citent volontiers les retours clients.', W.reviews),
  );
  const shipText = /livraison|expédition|expedition|délai de livraison|livré/i.test(page.bodyText);
  const retText = /retour|rembours|rétractation|retractation|échange/i.test(page.bodyText);
  c.push(
    data.hasShipping
      ? mkCheck('shipping', 'Livraison', 'ok', 'Conditions de livraison balisées.', '', W.shipping)
      : mkCheck('shipping', 'Livraison', shipText ? 'warn' : 'fail', shipText ? 'Livraison mentionnée dans le texte, non balisée.' : 'Aucune information de livraison.', 'Indiquez coût et délai de livraison sur la page et dans offers.shippingDetails.', W.shipping),
  );
  c.push(
    data.hasReturns
      ? mkCheck('returns', 'Retours', 'ok', 'Politique de retour balisée.', '', W.returns)
      : mkCheck('returns', 'Retours', retText ? 'warn' : 'fail', retText ? 'Retours mentionnés dans le texte, non balisés.' : 'Aucune information de retour.', 'Indiquez la politique de retour (délai, frais) et déclarez hasMerchantReturnPolicy.', W.returns),
  );
  c.push(
    data.conflicts.length
      ? mkCheck('consistency', 'Cohérence des données', 'fail', data.conflicts.join(' '), 'Alignez le prix balisé sur le prix affiché, dans toutes les sources.', W.consistency)
      : mkCheck('consistency', 'Cohérence des données', 'ok', 'Aucune contradiction détectée.', '', W.consistency),
  );
  return { checks: c, descriptionWords: dw };
}

/** JSON-LD Product à compléter, construit avec les seules valeurs trouvées. */
export function suggestedProductJsonLd(d: ProductData, url: string | null): Node | null {
  if (!d.name) return null;
  const offer: Node = { '@type': 'Offer' };
  if (d.price && num(d.price) !== null) offer.price = String(num(d.price));
  offer.priceCurrency = d.priceCurrency ?? '[à compléter : EUR]';
  offer.availability = d.availability ? `https://schema.org/${d.availability}` : '[à compléter : https://schema.org/InStock]';
  if (url) offer.url = url;
  if (!d.hasShipping) offer.shippingDetails = '[à compléter : OfferShippingDetails (coût, délai)]';
  if (!d.hasReturns) offer.hasMerchantReturnPolicy = '[à compléter : MerchantReturnPolicy (délai, frais)]';
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: d.name,
    ...(d.description ? { description: d.description.slice(0, 5000) } : {}),
    ...(d.images.length ? { image: d.images } : {}),
    brand: d.brand ? { '@type': 'Brand', name: d.brand } : '[à compléter : marque]',
    ...(d.sku ? { sku: d.sku } : {}),
    ...(d.gtin ? { gtin: d.gtin } : d.mpn ? { mpn: d.mpn } : { gtin: '[à compléter si le produit a un EAN]' }),
    offers: offer,
    ...(d.ratingValue && d.reviewCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: d.ratingValue, reviewCount: d.reviewCount } } : {}),
  };
}

const LABEL_MISSING: Record<string, string> = {
  name: 'nom', image: 'images', description: 'description', price: 'prix et devise', availability: 'disponibilité', brand: 'marque',
  identifier: 'GTIN ou MPN', rating: 'note agrégée', reviews: 'avis', shipping: 'livraison', returns: 'retours', structured: 'JSON-LD Product',
};

export function productFromHtml(html: string, url: string | null = null): ProductReport {
  const page = parseHtml(html);
  const { data } = extractProduct(page);
  const { checks, descriptionWords } = productChecks(page, data);
  const scored = finalize(checks);
  return {
    ...scored,
    url,
    product: data,
    descriptionWords,
    missing: checks.filter((c) => c.status !== 'ok' && LABEL_MISSING[c.id]).map((c) => LABEL_MISSING[c.id]),
    suggestedJsonLd: suggestedProductJsonLd(data, url),
  };
}

export async function auditProduct(url: string, opts: SafeFetchOptions = {}): Promise<ProductReport> {
  const res = await safeFetch(url, opts);
  return productFromHtml(res.body, res.finalUrl);
}
