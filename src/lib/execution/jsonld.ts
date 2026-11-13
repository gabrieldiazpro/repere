/**
 * Balisage schema.org (JSON-LD) et FAQ depuis la fiche de vérité.
 * Règle : le JSON-LD ne reprend que des informations déclarées par le client (fiche de vérité, réglages),
 * qui doivent aussi être visibles sur la page où il est inséré. Aucune donnée inventée.
 */
import type { Segment } from '@/lib/engine/types-v2';
import type { Business } from '@/lib/db';
import type { AuditV2, ExecProduct, ExecSettings, FaqItem, FactsMap, BrandFacts } from './types';
import { capitalize, cleanUrl, splitList } from './util';

export function toFactsMap(f: BrandFacts | FactsMap | null | undefined): FactsMap {
  if (!f) return {};
  if ('facts' in f && typeof (f as BrandFacts).facts === 'object') return { ...(f as BrandFacts).facts };
  return { ...(f as FactsMap) };
}

// ---------------------------------------------------------------------------
// Sous-types schema.org par métier
// ---------------------------------------------------------------------------
const SUBTYPES: [RegExp, string][] = [
  [/plomb/, 'Plumber'],
  [/electric/, 'Electrician'],
  [/chauffag|climatis|pompe a chaleur/, 'HVACBusiness'],
  [/serrur/, 'Locksmith'],
  [/peintre/, 'HousePainter'],
  [/couvreur|toiture/, 'RoofingContractor'],
  [/macon|menuis|renovation|carrel|btp|travaux/, 'GeneralContractor'],
  [/restaurant|pizzeria|brasserie|bistrot|creperie/, 'Restaurant'],
  [/cafe|coffee/, 'CafeOrCoffeeShop'],
  [/bar\b|pub/, 'BarOrPub'],
  [/boulang/, 'Bakery'],
  [/traiteur|patiss/, 'FoodEstablishment'],
  [/dentist|dentaire/, 'Dentist'],
  [/medecin|generaliste/, 'Physician'],
  [/kine/, 'Physiotherapy'],
  [/veterin/, 'VeterinaryCare'],
  [/pharmac/, 'Pharmacy'],
  [/optic|optique/, 'Optician'],
  [/coiff|barbier/, 'HairSalon'],
  [/onglerie|manucure/, 'NailSalon'],
  [/esthetique|institut|beaute|spa/, 'BeautySalon'],
  [/tatou/, 'TattooParlor'],
  [/avocat/, 'LegalService'],
  [/notaire/, 'Notary'],
  [/comptab/, 'AccountingService'],
  [/immobili/, 'RealEstateAgent'],
  [/garag|mecani|carrosserie/, 'AutoRepair'],
  [/fleur/, 'Florist'],
  [/demenag/, 'MovingCompany'],
  [/pressing|blanchisserie/, 'DryCleaningOrLaundry'],
  [/caviste|cave a vin/, 'LiquorStore'],
];

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function schemaTypeFor(trade: string, segment: Segment, override?: string): string {
  if (override && /^[A-Z][A-Za-z]{2,40}$/.test(override)) return override;
  if (segment === 'ecommerce') return 'OnlineStore';
  if (segment === 'pme') return 'Organization';
  const t = norm(trade);
  for (const [re, type] of SUBTYPES) if (re.test(t)) return type;
  return 'LocalBusiness';
}

// ---------------------------------------------------------------------------
// Analyse des faits (adresse, horaires, année)
// ---------------------------------------------------------------------------
export function parseAddress(s: string | undefined, city?: string) {
  if (!s) return null;
  s = s.replace(/^[^,\d]{2,30}\s:\s*/, ''); // « Atelier : 7 rue… » → « 7 rue… »
  const m = s.match(/^(.*?)[,\s]+(\d{5})\s+([^,]+?)\s*(?:,\s*France)?$/i);
  if (m) return { '@type': 'PostalAddress', streetAddress: m[1].trim().replace(/,$/, ''), postalCode: m[2], addressLocality: m[3].trim(), addressCountry: 'FR' };
  return { '@type': 'PostalAddress', streetAddress: s.trim(), ...(city ? { addressLocality: city } : {}), addressCountry: 'FR' };
}

const DAYS: [RegExp, string][] = [
  [/^lun/, 'Monday'],
  [/^mar/, 'Tuesday'],
  [/^mer/, 'Wednesday'],
  [/^jeu/, 'Thursday'],
  [/^ven/, 'Friday'],
  [/^sam/, 'Saturday'],
  [/^dim/, 'Sunday'],
];
const ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayOf = (w: string) => DAYS.find(([re]) => re.test(norm(w).trim()))?.[1] ?? null;
const hhmm = (h: string, m?: string) => `${h.padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;

/**
 * « Lun-ven 8h-19h, sam 9h-13h » → openingHoursSpecification. Renvoie [] si le texte n'est pas reconnu
 * (on n'invente pas d'horaires). « 24h/24 » et « 7j/7 » sont gérés.
 */
export function parseOpeningHours(s: string | undefined) {
  if (!s) return [];
  const t = norm(s);
  if (/24\s*h\s*\/\s*24|24h24/.test(t) && /7\s*j\s*\/\s*7|7j7|tous les jours/.test(t))
    return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ORDER, opens: '00:00', closes: '23:59' }];
  const out: { '@type': string; dayOfWeek: string[]; opens: string; closes: string }[] = [];
  for (const part of t.split(/[;,\n]|\bet\b/)) {
    const time = part.match(/(\d{1,2})\s*h\s*(\d{2})?\s*(?:-|–|à|a)\s*(\d{1,2})\s*h\s*(\d{2})?/);
    if (!time) continue;
    const before = part.slice(0, time.index).trim();
    const range = before.match(/([a-z]+)\.?\s*(?:-|–|\s+au\s+|\s+a\s+)\s*([a-z]+)/);
    let days: string[] = [];
    const a = range ? dayOf(range[1]) : null;
    const b = range ? dayOf(range[2]) : null;
    if (a && b) {
      const i = ORDER.indexOf(a);
      const j = ORDER.indexOf(b);
      days = i <= j ? ORDER.slice(i, j + 1) : [...ORDER.slice(i), ...ORDER.slice(0, j + 1)];
    } else {
      days = before
        .split(/[\s/]+/)
        .map(dayOf)
        .filter((d): d is string => !!d);
    }
    if (!days.length) continue;
    out.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: days, opens: hhmm(time[1], time[2]), closes: hhmm(time[3], time[4]) });
  }
  return out;
}

export function yearOf(s: string | undefined): string | undefined {
  const m = s?.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : undefined;
}

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------
type FaqSource = Pick<AuditV2, 'input'> & Partial<Pick<AuditV2, 'segment'>>;

/** FAQ factuelle : une question n'apparaît que si la fiche de vérité contient la réponse. */
export function buildFaq(result: FaqSource | null | undefined, factsIn: BrandFacts | FactsMap | null | undefined, business?: Partial<Business>): FaqItem[] {
  const f = toFactsMap(factsIn);
  const input = result?.input;
  const name = input?.businessName || business?.name || 'notre entreprise';
  const segment: Segment = result?.segment ?? input?.segment ?? 'local';
  const trade = input?.category || input?.trade || business?.trade || '';
  const city = input?.city || business?.city;
  const district = input?.district || business?.district;
  const place = [city, district].filter(Boolean).join(' ');
  const items: FaqItem[] = [];
  const add = (q: string, a: string | undefined | false) => {
    if (a) items.push({ q, a: a.trim() });
  };
  const services = splitList(f.services);
  const products = splitList(f.produits);

  if (segment === 'local') {
    add(`Que propose ${name} ?`, services.length ? `${name}${trade ? `, ${trade}${place ? ` à ${place}` : ''},` : ''} propose : ${services.join(', ')}.` : false);
    add(`Où se trouve ${name} ?`, f.adresse && `Adresse : ${f.adresse}.`);
    add(`Quelle zone ${name} dessert-il ?`, f.zone && `Nous intervenons sur la zone suivante : ${f.zone}.`);
    add(`Quels sont les horaires de ${name} ?`, f.horaires && `Nos horaires : ${f.horaires}.`);
    // Questions factuelles que posent vraiment les clients, seulement quand la fiche y répond.
    const urgent = f.horaires && /(dimanche|7\s?j\s?\/\s?7|24\s?h)/i.exec(f.horaires);
    if (urgent) {
      const clause = (f.horaires ?? '').split(/[;,]/).find((x) => /(dimanche|7\s?j|24\s?h)/i.test(x))?.trim();
      add(`${name} intervient-il le dimanche ?`, clause && `Oui : ${clause.replace(/^./, (c) => c.toLowerCase())}.`);
    }
    add(`Quels sont les tarifs de ${name} ?`, f.prix && `${f.prix}.`);
    add(`Le devis est-il gratuit ?`, f.prix && /devis gratuit/i.test(f.prix) && `Oui, le devis est gratuit. ${f.prix.split(/;/).filter((x) => !/devis gratuit/i.test(x)).map((x) => x.trim()).join(' ; ')}.`);
  } else if (segment === 'pme') {
    add(`Qu'est-ce que ${name} ?`, (!!input?.offering || services.length > 0) && `${input?.offering ? capitalize(input.offering).replace(/\.$/, '') + '.' : ''}${services.length ? ` Nos offres : ${services.join(', ')}.` : ''}`.trim());
    add(`À quelles entreprises s'adresse ${name} ?`, f.clients && `${name} accompagne notamment : ${f.clients}.`);
    add(`Combien coûte ${name} ?`, f.prix && `${f.prix}.`);
    add(`Où ${name} est-il implanté ?`, (f.adresse || f.zone) && [f.adresse && `Siège : ${f.adresse}.`, f.zone && `Zone couverte : ${f.zone}.`].filter(Boolean).join(' '));
  } else {
    add(`Que vend ${name} ?`, (products.length > 0 || !!input?.offering) && (f.produits ? `${name} propose : ${f.produits.replace(/\.$/, '')}.` : `${capitalize(input?.offering ?? '')}.`));
    add(`Quels sont les délais et frais de livraison ?`, f.livraison && `${f.livraison}.`);
    add(`Quels sont les prix des produits ${name} ?`, f.prix && `${f.prix}.`);
    add(`Peut-on retourner un produit ${name} ?`, f.retours && `${f.retours}.`);
    add(`Quelle est la composition des produits ${name} ?`, f.ingredients && `${f.ingredients}.`);
    add(`Les produits ${name} sont-ils certifiés ?`, f.certifications && `${f.certifications}.`);
    add(`Où est basée la marque ${name} ?`, f.adresse && `${f.adresse}.`);
  }
  add(`Depuis quand ${name} existe-t-il ?`, yearOf(f.creation) && `${name} existe depuis ${yearOf(f.creation)}.`);
  add(
    `Comment contacter ${name} ?`,
    (f.telephone || f.site || business?.website) &&
      [f.telephone && `Par téléphone au ${f.telephone}`, (f.site || business?.website) && `via le site ${(f.site || business?.website)!.replace(/^https?:\/\//, '')}`].filter(Boolean).join(', ou ') + '.',
  );
  // Jamais deux fois la même réponse (risque d'action manuelle Google sur un FAQPage répétitif).
  const seen = new Set<string>();
  return items
    .map((i) => ({ q: i.q, a: capitalize(i.a.replace(/\.\.$/, '.').replace(/\s+/g, ' ')) }))
    .filter((i) => {
      const k = i.a.toLowerCase().replace(/[^a-z0-9à-ÿ]/g, '');
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// ---------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------
export interface JsonLdOptions {
  settings?: Partial<ExecSettings>;
  faq?: FaqItem[];
  /** URL de la page qui porte le balisage (page hébergée) */
  pageUrl?: string;
  description?: string;
}

type Node = Record<string, unknown>;

/** JSON-LD : LocalBusiness (ou sous-type) / Organization (+ Service) / OnlineStore + Product / FAQPage. */
export function buildJsonLd(business: Business, factsIn: BrandFacts | FactsMap | null | undefined, segment: Segment = 'local', opts: JsonLdOptions = {}): Node {
  const f = toFactsMap(factsIn);
  const s = opts.settings ?? {};
  const site = cleanUrl(f.site || business.website);
  const baseId = (site ?? opts.pageUrl ?? `urn:repere:${business.id}`).replace(/\/$/, '');
  const orgId = `${baseId}/#organization`;
  const type = schemaTypeFor(business.trade, segment, s.schemaType);
  const sameAs = [...new Set((s.sameAs ?? []).map(cleanUrl).filter((u): u is string => !!u))];
  const services = splitList(f.services);

  const org: Node = {
    '@type': type,
    '@id': orgId,
    name: business.name,
    ...(site ? { url: site } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(s.logoUrl ? { logo: s.logoUrl } : {}),
    ...(f.telephone ? { telephone: f.telephone } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
  const address = parseAddress(f.adresse, business.city);
  if (address) org.address = address;
  const year = yearOf(f.creation);
  if (year) org.foundingDate = year;
  if (f.dirigeant && segment !== 'local') org.founder = { '@type': 'Person', name: f.dirigeant };

  if (segment === 'local') {
    const hours = parseOpeningHours(f.horaires);
    if (hours.length) org.openingHoursSpecification = hours;
    const zones = splitList(f.zone);
    if (zones.length) org.areaServed = zones.map((z) => ({ '@type': 'Place', name: z }));
    else if (business.city) org.areaServed = { '@type': 'City', name: business.city };
    if (f.prix && f.prix.length <= 100) org.priceRange = f.prix;
    if (services.length)
      org.hasOfferCatalog = {
        '@type': 'OfferCatalog',
        name: 'Services',
        itemListElement: services.map((sv) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: capitalize(sv) } })),
      };
  } else if (f.telephone) {
    org.contactPoint = { '@type': 'ContactPoint', contactType: 'customer service', telephone: f.telephone, availableLanguage: ['fr'] };
  }

  const graph: Node[] = [org];

  if (segment === 'pme') {
    const areaServed = f.zone || 'France';
    for (const sv of services.slice(0, 8))
      graph.push({ '@type': 'Service', name: capitalize(sv), provider: { '@id': orgId }, areaServed: { '@type': 'Country', name: areaServed } });
  }

  if (segment === 'ecommerce') {
    // Produits structurés seulement (réglages) : le texte libre de la fiche ne suffit pas à décrire un Product.
    const products: ExecProduct[] = s.products ?? [];
    for (const p of products.slice(0, 20)) {
      const prod: Node = { '@type': 'Product', name: p.name, brand: { '@type': 'Brand', name: (p.brand) || business.name } };
      if (p.description) prod.description = p.description;
      if (p.image) prod.image = p.image;
      if (p.sku) prod.sku = p.sku;
      if (p.gtin) prod.gtin = p.gtin;
      if (p.category) prod.category = p.category;
      if (p.url) prod.url = p.url;
      if (typeof p.price === 'number')
        prod.offers = {
          '@type': 'Offer',
          price: p.price.toFixed(2),
          priceCurrency: p.currency || 'EUR',
          availability: `https://schema.org/${p.availability || 'InStock'}`,
          ...(p.url ? { url: p.url } : {}),
          seller: { '@id': orgId },
        };
      graph.push(prod);
    }
  }

  if (opts.faq?.length) {
    graph.push({
      '@type': 'FAQPage',
      ...(opts.pageUrl ? { '@id': `${opts.pageUrl}#faq`, url: opts.pageUrl } : {}),
      about: { '@id': orgId },
      mainEntity: opts.faq.map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** Sérialise pour un <script> : échappe « < » pour empêcher la fermeture prématurée de la balise. */
export function jsonLdString(data: unknown, pretty = false): string {
  return JSON.stringify(data, null, pretty ? 2 : 0)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Bloc statique à coller dans le <head> (lu par Google ET par les robots IA, sans JavaScript). */
export function jsonLdScriptTag(data: unknown): string {
  return `<script type="application/ld+json">\n${jsonLdString(data, true)}\n</script>`;
}

/** Validation interne minimale (utilisée par les tests et l'endpoint). */
export function validateJsonLd(data: unknown): string[] {
  const errs: string[] = [];
  const d = data as Node;
  if (!d || d['@context'] !== 'https://schema.org') errs.push('@context manquant');
  const graph = Array.isArray(d?.['@graph']) ? (d['@graph'] as Node[]) : [];
  if (!graph.length) errs.push('@graph vide');
  for (const n of graph) {
    if (typeof n['@type'] !== 'string') errs.push('nœud sans @type');
    if (n['@type'] !== 'FAQPage' && !n.name) errs.push(`${String(n['@type'])} sans name`);
    if (n['@type'] === 'FAQPage') {
      const me = n.mainEntity as Node[] | undefined;
      if (!me?.length) errs.push('FAQPage sans question');
      for (const q of me ?? []) if (!q.name || !(q.acceptedAnswer as Node | undefined)?.text) errs.push('question incomplète');
    }
    const offers = n.offers as Node | undefined;
    if (offers && (!offers.price || !offers.priceCurrency)) errs.push('Offer incomplète');
  }
  try {
    JSON.parse(jsonLdString(data));
  } catch {
    errs.push('JSON invalide');
  }
  return errs;
}
