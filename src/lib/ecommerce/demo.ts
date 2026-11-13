/**
 * Démonstration `demo-ecom` (Maison Sora, marque FICTIVE) : catalogue suivi et réponses « produit ».
 * Les réponses mock du moteur ne nomment que des marques ; pour la démo, chaque élément de liste est complété,
 * de façon déterministe, par un produit, un prix et une note (concurrents fictifs eux aussi). Une erreur de prix
 * volontaire (Perplexity reprend un ancien prix du shampoing « Onde ») illustre la vérification des faits.
 * Toutes ces données sont étiquetées « démo ».
 */
import type { AuditResult } from '@/lib/engine/types';
import { hash32 } from '@/lib/engine/util';
import { categoryOfQuery } from './match';
import type { Catalog, CatalogProduct } from './types';

export const DEMO_ECOM_ID = 'demo-ecom';
export const isDemoEcom = (id: string) => id === DEMO_ECOM_ID;

const AT = '2026-01-15T09:00:00.000Z';
const SITE = 'https://maison-sora.fr';

/** Prix alignés sur la fiche de vérité démo (« Shampoing solide 12,90 € ; déodorant solide 9,90 € ») et sur le trafic démo. */
export const DEMO_PRODUCTS: CatalogProduct[] = [
  {
    id: 'shampoing-solide-onde',
    name: 'Shampoing solide « Onde »',
    url: `${SITE}/products/shampoing-solide-onde`,
    category: 'shampoing solide',
    price: 12.9,
    currency: 'EUR',
    gtin: '3770012345017',
    sku: 'SORA-SH-ONDE',
    description: 'Shampoing solide pour cheveux normaux à secs, sans sulfates ni silicones, environ 60 lavages.',
    aliases: ['Onde', 'shampoing Onde'],
    variants: [{ name: '75 g', price: 12.9 }, { name: 'Lot de 2', price: 23.9 }],
    rating: { value: 4.7, count: 214, source: 'avis clients du site (démo)' },
    availability: 'InStock',
    source: 'demo',
    updatedAt: AT,
  },
  {
    id: 'shampoing-solide-avoine-douceur',
    name: 'Shampoing solide Avoine douceur',
    url: `${SITE}/products/shampoing-solide-avoine-douceur`,
    category: 'shampoing solide',
    price: 13.9,
    currency: 'EUR',
    description: 'Shampoing solide doux pour cuir chevelu sensible, à l’avoine.',
    rating: { value: 4.6, count: 88, source: 'avis clients du site (démo)' },
    availability: 'InStock',
    source: 'demo',
    updatedAt: AT,
  },
  {
    id: 'deodorant-solide-sans-bicarbonate',
    name: 'Déodorant solide sans bicarbonate',
    url: `${SITE}/products/deodorant-solide-sans-bicarbonate`,
    category: 'déodorant solide',
    price: 9.9,
    currency: 'EUR',
    gtin: '3770012345024',
    description: 'Déodorant solide sans bicarbonate ni sels d’aluminium, pour peaux sensibles.',
    aliases: ['déodorant Sora'],
    rating: { value: 4.5, count: 131, source: 'avis clients du site (démo)' },
    availability: 'InStock',
    source: 'demo',
    updatedAt: AT,
  },
  {
    id: 'soin-visage-solide',
    name: 'Soin visage solide « Lueur »',
    url: `${SITE}/products/soin-visage-solide`,
    category: 'soin visage solide',
    price: 18.9,
    currency: 'EUR',
    description: 'Baume visage solide nourrissant, sans eau ajoutée.',
    aliases: ['Lueur'],
    availability: 'InStock',
    source: 'demo',
    updatedAt: AT,
  },
];

export function demoCatalog(): Catalog {
  return { businessId: DEMO_ECOM_ID, brand: 'Maison Sora', website: 'maison-sora.fr', products: DEMO_PRODUCTS.map((p) => ({ ...p })), updatedAt: AT, demo: true };
}

const SUFFIXES: Record<string, string[]> = {
  'shampoing solide': ['Ortie', 'Argile verte', 'Coco', 'Romarin', 'Karité', 'Agrumes'],
  'déodorant solide': ['Palmarosa', 'Lavande', 'Menthe fraîche', 'Bergamote'],
  'soin visage solide': ['Rose', 'Calendula', 'Camomille'],
};
const BASE_PRICE: Record<string, number> = { 'shampoing solide': 9.9, 'déodorant solide': 7.9, 'soin visage solide': 15.9 };

const fmt = (n: number) => n.toFixed(2).replace('.', ',');

/** Complète les éléments de liste d'une réponse démo par un produit, un prix et une note. */
export function enrichDemoAnswer(text: string, query: string, provider: string, catalog: Catalog): string {
  const cats = Object.keys(SUFFIXES);
  const cat = categoryOfQuery(query, cats) ?? 'shampoing solide';
  const mine = catalog.products.filter((p) => p.category === cat);
  return text
    .split('\n')
    .map((line) => {
      const m = /^(\s*(?:\d+[.)]|[-*•])\s+)\*\*([^*]+)\*\*(.*)$/.exec(line);
      if (!m) return line;
      const [, head, brand, rest] = m;
      const h = hash32(`${provider}|${query}|${brand}`);
      if (brand === catalog.brand) {
        const p = mine.length ? mine[h % 10 < 7 ? 0 : Math.min(1, mine.length - 1)] : null;
        if (!p) return line;
        const label = p.name.replace(/[«»]/g, '').replace(/\s+/g, ' ').trim();
        // Erreur volontaire de la démo : Perplexity reprend un ancien prix du shampoing « Onde ».
        const price = provider === 'perplexity' && p.id === 'shampoing-solide-onde' ? 14.9 : p.price;
        const rating = p.rating ? `, ${fmt(p.rating.value).replace(/0$/, '')}/5 sur ${p.rating.count} avis` : '';
        return `${head}**${brand} – ${label}** (${price ? `${fmt(price)} €` : 'prix non cité'}${rating})${rest}`;
      }
      const sfx = SUFFIXES[cat][hash32(`${brand}|${cat}`) % SUFFIXES[cat].length];
      const product = `${cat.charAt(0).toUpperCase()}${cat.slice(1)} ${sfx}`;
      if (h % 10 < 4) return `${head}**${brand} – ${product}**${rest}`;
      const price = BASE_PRICE[cat] + (hash32(`${brand}|prix`) % 5);
      const rating = 4.2 + (hash32(`${brand}|note`) % 6) / 10;
      const count = 150 + (hash32(`${brand}|avis`) % 900);
      return `${head}**${brand} – ${product}** (${fmt(price)} €, ${fmt(rating).replace(/0$/, '')}/5 sur ${count} avis)${rest}`;
    })
    .join('\n');
}

/** Audit démo dont les réponses de recommandation nomment des produits. */
export function withDemoProducts(audit: AuditResult, catalog: Catalog = demoCatalog()): AuditResult {
  const qText = new Map(audit.queries.filter((q) => q.kind !== 'brand').map((q) => [q.id, q.text]));
  return {
    ...audit,
    answers: audit.answers.map((a) => {
      const q = qText.get(a.queryId);
      return q && a.text ? { ...a, text: enrichDemoAnswer(a.text, q, a.provider, catalog) } : a;
    }),
  };
}
