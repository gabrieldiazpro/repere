/**
 * Livrables e-commerce (livrable 6, teardown F6) : FAQ produit, guide d'achat par catégorie, JSON-LD Product complet.
 * Gabarits de qualité fondés UNIQUEMENT sur la fiche produit et la fiche de vérité (jamais d'avis ni de chiffre
 * inventé : ce qui manque est marqué « à compléter »). LLM facultatif pour la reformulation, sous la même règle.
 */
import type { BrandFactField } from '@/lib/engine/types-v2';
import type { CatalogProduct, ProductTrackingReport } from './types';

export const TO_COMPLETE = '[à compléter]';

export interface DeliverableCtx {
  brand: string;
  website?: string;
  facts?: Partial<Record<BrandFactField, string>>;
}

export interface FaqItem {
  q: string;
  a: string;
  /** réponse incomplète : le marchand doit la compléter avant publication */
  toComplete?: boolean;
}

export interface ProductFaq {
  productId: string;
  items: FaqItem[];
  jsonLd: Record<string, unknown>;
  llm: boolean;
  /** questions réellement posées aux IA où le produit était attendu */
  fromQueries: string[];
}

export interface BuyingGuide {
  category: string;
  title: string;
  markdown: string;
  products: string[];
  questions: string[];
  llm: boolean;
}

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const site = (w?: string) => (w ? (/^https?:\/\//.test(w) ? w : `https://${w}`).replace(/\/$/, '') : undefined);

/* ------------------------------------------------------------------ */
/* JSON-LD Product                                                      */
/* ------------------------------------------------------------------ */

function gtinKey(g: string): string {
  return g.length === 8 ? 'gtin8' : g.length === 12 ? 'gtin12' : g.length === 13 ? 'gtin13' : g.length === 14 ? 'gtin14' : 'gtin';
}

/** JSON-LD Product complet à partir des seules valeurs connues (aucune note sans avis réels). */
export function buildProductJsonLd(p: CatalogProduct, ctx: DeliverableCtx): Record<string, unknown> {
  const url = p.url ?? (site(ctx.website) ? `${site(ctx.website)}/products/${p.id}` : undefined);
  const availability = `https://schema.org/${p.availability ?? 'InStock'}`;
  const prices = [p.price, ...(p.variants ?? []).map((v) => v.price)].filter((x): x is number => typeof x === 'number');
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    ...(p.description ? { description: p.description } : {}),
    ...(p.image ? { image: [p.image] } : {}),
    ...(p.sku ? { sku: p.sku } : {}),
    ...(p.gtin ? { [gtinKey(p.gtin)]: p.gtin } : {}),
    brand: { '@type': 'Brand', name: p.brand ?? ctx.brand },
    ...(p.category ? { category: p.category } : {}),
    ...(url ? { url } : {}),
  };
  const distinct = [...new Set(prices)];
  if (distinct.length > 1) {
    node.offers = {
      '@type': 'AggregateOffer',
      priceCurrency: p.currency ?? 'EUR',
      lowPrice: Math.min(...distinct).toFixed(2),
      highPrice: Math.max(...distinct).toFixed(2),
      offerCount: (p.variants ?? []).length || distinct.length,
      availability,
    };
  } else if (distinct.length === 1) {
    node.offers = {
      '@type': 'Offer',
      price: distinct[0].toFixed(2),
      priceCurrency: p.currency ?? 'EUR',
      availability,
      itemCondition: 'https://schema.org/NewCondition',
      ...(url ? { url } : {}),
      seller: { '@type': 'Organization', name: ctx.brand },
    };
  }
  if (p.rating && p.rating.count > 0) {
    node.aggregateRating = { '@type': 'AggregateRating', ratingValue: p.rating.value, reviewCount: p.rating.count, bestRating: 5, worstRating: 1 };
  }
  return node;
}

/** Contrôle minimal (champs attendus par Google Merchant / les flux d'agents). */
export function productJsonLdWarnings(node: Record<string, unknown>): string[] {
  const w: string[] = [];
  if (!node.offers) w.push('Prix manquant : ajoutez le prix du produit (offre).');
  if (!node.image) w.push('Image manquante.');
  if (!node.description) w.push('Description manquante.');
  if (!Object.keys(node).some((k) => k.startsWith('gtin'))) w.push('GTIN (code-barres EAN) absent : recommandé pour l’appariement des produits.');
  if (!node.aggregateRating) w.push('Aucune note : n’ajoutez une note que si elle provient d’avis clients réels et visibles sur la page.');
  return w;
}

/* ------------------------------------------------------------------ */
/* FAQ produit                                                          */
/* ------------------------------------------------------------------ */

export function productFaqTemplate(p: CatalogProduct, ctx: DeliverableCtx, tracking?: ProductTrackingReport | null): Omit<ProductFaq, 'llm'> {
  const f = ctx.facts ?? {};
  const items: FaqItem[] = [];
  const variants = (p.variants ?? []).filter((v) => v.name);
  if (typeof p.price === 'number') {
    const range = variants.filter((v) => typeof v.price === 'number').map((v) => `${v.name} : ${eur(v.price as number)}`);
    items.push({ q: `Quel est le prix de ${p.name} ?`, a: range.length > 1 ? `${p.name} est proposé à partir de ${eur(Math.min(p.price, ...variants.map((v) => v.price ?? Infinity)))} (${range.join(' ; ')}).` : `${p.name} coûte ${eur(p.price)} sur le site de ${ctx.brand}.` });
  }
  items.push(
    p.description
      ? { q: `Qu’est-ce que ${p.name} ?`, a: p.description.length > 400 ? `${p.description.slice(0, 397).replace(/\s\S*$/, '')}…` : p.description }
      : { q: `Qu’est-ce que ${p.name} ?`, a: `${TO_COMPLETE} Décrivez le produit en deux phrases : à quoi il sert et pour qui.`, toComplete: true },
  );
  items.push(
    f.ingredients
      ? { q: `Quelle est la composition de ${p.name} ?`, a: f.ingredients }
      : { q: `Quelle est la composition de ${p.name} ?`, a: `${TO_COMPLETE} Indiquez la composition (liste INCI, matières) telle qu’imprimée sur l’emballage.`, toComplete: true },
  );
  items.push({ q: `Comment utiliser ${p.name} ?`, a: `${TO_COMPLETE} Expliquez l’utilisation en 2 à 4 étapes et la durée d’usage d’un produit.`, toComplete: true });
  if (f.livraison) items.push({ q: `Quels sont les délais et frais de livraison de ${p.name} ?`, a: f.livraison });
  if (f.retours) items.push({ q: `Peut-on retourner ${p.name} ?`, a: f.retours });
  if (f.certifications) items.push({ q: `${p.name} est-il certifié ?`, a: f.certifications });
  items.push({
    q: `Où acheter ${p.name} ?`,
    a: p.url ? `${p.name} est en vente sur le site officiel de ${ctx.brand} : ${p.url}.` : `${p.name} est en vente sur le site officiel de ${ctx.brand}${ctx.website ? ` (${ctx.website})` : ''}.`,
  });
  if (p.rating && p.rating.count > 0)
    items.push({ q: `Que pensent les clients de ${p.name} ?`, a: `${p.name} obtient ${String(p.rating.value).replace('.', ',')}/5 sur ${p.rating.count} avis clients${p.rating.source ? ` (${p.rating.source})` : ''}.` });
  const fromQueries = (tracking?.queries ?? []).filter((q) => q.category && q.category === p.category).map((q) => q.query).slice(0, 5);
  return { productId: p.id, items, jsonLd: faqJsonLd(items), fromQueries };
}

/** FAQPage ne contient que les réponses complètes (jamais de « à compléter » publié). */
export function faqJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.filter((i) => !i.toComplete).map((i) => ({ '@type': 'Question', name: i.q, acceptedAnswer: { '@type': 'Answer', text: i.a } })),
  };
}

const GUARD = 'Règles : français, vouvoiement, ton sobre. N’ajoutez AUCUN fait, chiffre, avis, label ou promesse absent des données fournies. Conservez tel quel tout « [à compléter] ».';

async function llm(prompt: string, maxTokens = 900): Promise<string | null> {
  try {
    const { complete, llmAvailable, underDailyCap, SYSTEM_FR } = await import('@/lib/execution/llm');
    if (!llmAvailable() || !(await underDailyCap())) return null;
    return await complete({ system: `${SYSTEM_FR}\n${GUARD}`, prompt, json: true, maxTokens });
  } catch {
    return null;
  }
}

export async function buildProductFaq(p: CatalogProduct, ctx: DeliverableCtx, tracking?: ProductTrackingReport | null, opts: { llm?: boolean } = {}): Promise<ProductFaq> {
  const base = productFaqTemplate(p, ctx, tracking);
  if (!opts.llm) return { ...base, llm: false };
  const raw = await llm(
    [
      `Reformulez cette FAQ produit pour qu’elle soit claire et citable par un assistant IA. Données : ${JSON.stringify({ produit: p, faq: base.items })}.`,
      base.fromQueries.length ? `Questions réellement posées par les acheteurs : ${base.fromQueries.join(' | ')}. Ajoutez au plus 2 questions qui y répondent, uniquement si les données le permettent.` : '',
      'Répondez en JSON : {"items":[{"q":"…","a":"…"}]}.',
    ].join('\n'),
  );
  const { parseJsonObject } = await import('@/lib/execution/llm');
  const parsed = parseJsonObject<{ items?: FaqItem[] }>(raw);
  const items = (parsed?.items ?? [])
    .filter((i) => i && typeof i.q === 'string' && typeof i.a === 'string' && i.q.length < 200 && i.a.length < 1200)
    .map((i) => ({ q: i.q.trim(), a: i.a.trim(), ...(i.a.includes(TO_COMPLETE) ? { toComplete: true } : {}) }));
  if (items.length < 3) return { ...base, llm: false };
  return { ...base, items, jsonLd: faqJsonLd(items), llm: true };
}

/* ------------------------------------------------------------------ */
/* Guide d'achat par catégorie                                          */
/* ------------------------------------------------------------------ */

export function buyingGuideTemplate(category: string, products: CatalogProduct[], ctx: DeliverableCtx, tracking?: ProductTrackingReport | null): Omit<BuyingGuide, 'llm'> {
  const mine = products.filter((p) => p.category === category);
  const questions = (tracking?.queries ?? []).filter((q) => q.category === category).map((q) => q.query);
  const cat = tracking?.categories.find((c) => c.category === category);
  const cited = (cat?.topBrands ?? []).filter((b) => !b.isClient).map((b) => b.brand).slice(0, 4);
  const prices = mine.map((p) => p.price).filter((x): x is number => typeof x === 'number');
  const title = `Comment choisir un ${category} ?`;
  const lines: string[] = [
    `# ${title}`,
    '',
    `*Guide rédigé par ${ctx.brand}. Nous vendons des produits de cette catégorie : ce guide le dit et compare honnêtement.*`,
    '',
    '## En bref',
    `${TO_COMPLETE} En 3 phrases : le critère n°1, à qui s’adresse quel type de produit, l’erreur à éviter.`,
    '',
    '## Les critères qui comptent',
    `1. **Composition et matières** — ${TO_COMPLETE}`,
    `2. **Usage et type de besoin** — ${TO_COMPLETE}`,
    `3. **Durée d’usage et prix réel à l’usage** — ${prices.length ? `nos ${category}s vont de ${eur(Math.min(...prices))} à ${eur(Math.max(...prices))} ; ` : ''}${TO_COMPLETE} (nombre d’utilisations par produit).`,
    `4. **Emballage, fabrication, certifications** — ${ctx.facts?.certifications ?? TO_COMPLETE}`,
    '',
  ];
  if (questions.length) {
    lines.push('## Les questions que se posent les acheteurs', ...questions.slice(0, 6).map((q) => `- ${q} — ${TO_COMPLETE}`), '');
  }
  if (mine.length) {
    lines.push(`## Nos ${category}s`, ...mine.map((p) => `- **${p.name}**${typeof p.price === 'number' ? ` — ${eur(p.price)}` : ''}${p.url ? ` — ${p.url}` : ''}${p.description ? ` : ${p.description.slice(0, 160)}` : ''}`), '');
  }
  if (cited.length) {
    lines.push('## Les autres marques souvent citées', `Les assistants IA citent aussi ${cited.join(', ')}. ${TO_COMPLETE} Décrivez objectivement pour quel profil chacune peut convenir (sans dénigrement, informations vérifiables seulement).`, '');
  }
  if (ctx.facts?.livraison || ctx.facts?.retours) lines.push('## Livraison et retours', [ctx.facts?.livraison, ctx.facts?.retours].filter(Boolean).join(' '), '');
  return { category, title, markdown: lines.join('\n'), products: mine.map((p) => p.id), questions };
}

export async function buildBuyingGuide(category: string, products: CatalogProduct[], ctx: DeliverableCtx, tracking?: ProductTrackingReport | null, opts: { llm?: boolean } = {}): Promise<BuyingGuide> {
  const base = buyingGuideTemplate(category, products, ctx, tracking);
  if (!opts.llm) return { ...base, llm: false };
  const raw = await llm(`Améliorez la rédaction de ce brouillon de guide d’achat en Markdown, sans changer sa structure. Brouillon : ${JSON.stringify(base.markdown)}. Répondez en JSON : {"markdown":"…"}.`, 1800);
  const { parseJsonObject } = await import('@/lib/execution/llm');
  const md = parseJsonObject<{ markdown?: string }>(raw)?.markdown;
  if (typeof md !== 'string' || md.length < base.markdown.length * 0.6 || !md.startsWith('#')) return { ...base, llm: false };
  return { ...base, markdown: md, llm: true };
}
