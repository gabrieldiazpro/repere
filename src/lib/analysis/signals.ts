/**
 * V8 (TEST-MARQUE) — signaux lisibles qu'une IA peut utiliser pour recommander une entreprise, relevés sur une page :
 * fiche d'identité structurée, note et avis, FAQ, adresse, téléphone, horaires, ville, prix, profils liés, texte de
 * présentation. Fonctions PURES (aucun réseau) : la page est lue par l'orchestrateur.
 *
 * Sert au « Pourquoi lui ? » du test de marque : on compare la page d'accueil du concurrent cité (lue pour de vrai)
 * à VOTRE site (toutes les pages lues par l'exploration). On ne prête jamais à un concurrent un élément absent de sa page.
 */
import type { SiteCrawl } from '@/lib/crawl/types';
import { homeSignals } from './detect';
import type { SiteSignalId } from './types';

type Node = Record<string, unknown>;

export const SIGNAL_LABEL: Record<SiteSignalId, string> = {
  entity: 'Fiche d’identité structurée (données JSON-LD de l’entreprise)',
  rating: 'Note et avis clients visibles',
  faq: 'Questions fréquentes (FAQ)',
  address: 'Adresse complète',
  phone: 'Téléphone visible',
  hours: 'Horaires d’ouverture',
  city: 'Ville dans le titre de la page',
  prices: 'Prix ou tarifs affichés',
  sameas: 'Liens vers ses profils (annuaires, réseaux) dans les données structurées',
  content: 'Texte de présentation développé (300 mots ou plus)',
};

export type SignalMap = Partial<Record<SiteSignalId, string>>;

const ORG_RE = /Organization|Corporation|LocalBusiness|Store|Restaurant|Bakery|Cafe|Bar|Salon|Spa|Plumber|Electrician|Locksmith|Contractor|HVAC|Painter|Florist|AutoRepair|RealEstateAgent|Hotel|Dentist|Optician|Pharmacy|Gym|Veterinary|ChildCare|MovingCompany|FoodEstablishment|HomeAndConstructionBusiness|MedicalBusiness|LodgingBusiness|ProfessionalService|OnlineStore|OnlineBusiness/;

function types(n: Node): string[] {
  const t = n['@type'];
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string');
}

/** Tous les nœuds d'un JSON-LD déjà parsé (graphes, tableaux, nœuds imbriqués d'un niveau). */
function flatten(v: unknown, out: Node[] = [], depth = 0): Node[] {
  if (depth > 4 || !v || typeof v !== 'object') return out;
  if (Array.isArray(v)) {
    for (const x of v.slice(0, 50)) flatten(x, out, depth + 1);
    return out;
  }
  const n = v as Node;
  out.push(n);
  if (Array.isArray(n['@graph'])) flatten(n['@graph'], out, depth + 1);
  for (const k of ['mainEntity', 'publisher', 'provider', 'brand', 'author', 'itemListElement']) if (n[k] && typeof n[k] === 'object') flatten(n[k], out, depth + 1);
  return out;
}

const clip = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1).trim()}…` : s);

/** Signaux d'un ensemble de nœuds JSON-LD + textes de page. `city` : ville attendue (titre). */
function collect(nodes: Node[], page: { title: string; headings: string[]; text: string; wordCount: number; telLink: boolean }, city?: string): SignalMap {
  const out: SignalMap = {};
  const org = nodes.find((n) => types(n).some((t) => ORG_RE.test(t)) && typeof n.name === 'string');
  if (org) out.entity = `${types(org)[0]} « ${clip(String(org.name), 50)} »`;
  const rated = nodes.find((n) => n.aggregateRating && typeof n.aggregateRating === 'object');
  if (rated) {
    const r = rated.aggregateRating as Node;
    out.rating = r.ratingValue ? `note ${String(r.ratingValue)}${r.reviewCount || r.ratingCount ? ` sur ${String(r.reviewCount ?? r.ratingCount)} avis` : ''} (balisée)` : 'note balisée';
  } else {
    const m = /\b([1-5](?:[.,]\d)?)\s*(?:\/\s*5|sur\s*5|★)[^.]{0,40}?(\d{1,5})\s*avis/i.exec(page.text) ?? /(\d{1,5})\s*avis\s+(?:clients|google|vérifiés)/i.exec(page.text);
    if (m) out.rating = clip(m[0].replace(/\s+/g, ' '), 60);
  }
  if (nodes.some((n) => types(n).includes('FAQPage'))) out.faq = 'FAQ balisée (FAQPage)';
  else {
    const qs = page.headings.filter((h) => /\?\s*$/.test(h));
    if (qs.length >= 3) out.faq = `${qs.length} questions en intertitres`;
  }
  const withAddr = nodes.find((n) => n.address && (typeof n.address === 'object' || typeof n.address === 'string'));
  if (withAddr) {
    const a = withAddr.address as Node | string;
    out.address = typeof a === 'string' ? clip(a, 70) : clip([a.streetAddress, a.postalCode, a.addressLocality].filter((x) => typeof x === 'string').join(', ') || 'adresse balisée', 70);
  } else {
    const m = /\b\d{1,4}(?:\s?(?:bis|ter))?,?\s+(?:rue|avenue|av\.|boulevard|bd|place|chemin|route|allée|impasse|quai|cours)\s[^,\n]{2,40},?\s+\d{5}\s+[A-ZÉÈ][\p{L}' -]{1,30}/iu.exec(page.text);
    if (m) out.address = clip(m[0].replace(/\s+/g, ' '), 70);
  }
  const tel = nodes.find((n) => typeof n.telephone === 'string');
  if (tel) out.phone = String(tel.telephone);
  else if (page.telLink) out.phone = 'lien d’appel (tel:)';
  else {
    const m = /(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}/.exec(page.text);
    if (m) out.phone = m[0];
  }
  if (nodes.some((n) => n.openingHours || n.openingHoursSpecification)) out.hours = 'horaires balisés';
  else if (/\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b[^.\n]{0,30}\b\d{1,2}\s?(?:h|:)\s?\d{0,2}/i.test(page.text)) out.hours = 'horaires dans la page';
  if (city && city.length >= 2) {
    const c = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const t = page.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (t.includes(c)) out.city = clip(page.title, 70);
  }
  const price = /(?:\d{1,5}(?:[.,]\d{2})?\s?€|€\s?\d{1,5}|\b(?:à partir de|dès)\s+\d{1,5})/i.exec(page.text);
  if (price || nodes.some((n) => n.offers || n.priceRange)) out.prices = price ? clip(price[0], 30) : 'prix balisés';
  const same = nodes.find((n) => n.sameAs && (Array.isArray(n.sameAs) ? n.sameAs.length : typeof n.sameAs === 'string'));
  if (same) {
    const list = (Array.isArray(same.sameAs) ? same.sameAs : [same.sameAs]).filter((x): x is string => typeof x === 'string');
    out.sameas = `${list.length} profil${list.length > 1 ? 's' : ''} lié${list.length > 1 ? 's' : ''}`;
  }
  if (page.wordCount >= 300) out.content = `${page.wordCount} mots`;
  return out;
}

const words = (t: string) => (t.match(/[\p{L}\p{N}]+/gu) ?? []).length;

/** Signaux d'une page HTML (page d'accueil d'un concurrent ou la vôtre). */
export function pageSignals(html: string, city?: string): SignalMap {
  const sig = homeSignals(html);
  const p = sig.page;
  const text = `${p.title} ${p.bodyText}`.slice(0, 200_000);
  return collect(
    sig.nodes as Node[],
    { title: p.title, headings: p.headings.map((h) => h.text), text, wordCount: words(p.mainText || p.bodyText), telLink: p.links.some((l) => /^tel:/i.test(l.href)) },
    city,
  );
}

/**
 * Signaux de VOTRE site : union sur toutes les pages lues (un élément présent sur une seule page compte), la ville
 * étant cherchée dans le titre de la page d'accueil. Sans exploration : la page d'accueil seule.
 */
export function siteSignals(crawl: SiteCrawl | null, homeHtml: string | null, city?: string): SignalMap {
  const out: SignalMap = homeHtml ? pageSignals(homeHtml, city) : {};
  if (!crawl) return out;
  for (const pg of crawl.pages.slice(0, 80)) {
    let m: SignalMap;
    if (pg.html) m = pageSignals(pg.html, undefined);
    else {
      const nodes = flatten(pg.jsonLd);
      m = collect(nodes, { title: pg.title ?? '', headings: pg.headings.map((h) => h.text), text: pg.title ?? '', wordCount: pg.wordCount, telLink: false });
    }
    for (const [k, v] of Object.entries(m) as [SiteSignalId, string][]) if (k !== 'city' && !out[k]) out[k] = v;
  }
  if (!out.city && city && crawl.pages[0]?.title) {
    const c = city.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if ((crawl.pages[0].title ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(c)) out.city = crawl.pages[0].title;
  }
  return out;
}
