/**
 * Revendeurs et marketplaces cités à la place de la marque (livrable 3, teardown F3).
 * Chaque URL citée par les IA est classée (site de la marque, marketplace, revendeur, comparatif, média, avis,
 * forum, réseau social, concurrent) en réutilisant la table de 436 domaines du moteur, complétée ici par une
 * liste de marketplaces et de revendeurs français.
 */
import { normName, registrableDomain } from '@/lib/engine/detect';
import { classifyDomain } from '@/lib/engine/sources';
import type { AuditResult, RawSource } from '@/lib/engine/types';
import type { SourceCategory } from '@/lib/engine/types-v2';
import type { EcomSourceKind, RetailerRecommendation, RetailerReport, RetailerStat } from './types';

/** Places de marché ouvertes à des vendeurs tiers. */
export const MARKETPLACES = new Set([
  'amazon.fr', 'amazon.com', 'amazon.de', 'amazon.es', 'amazon.it', 'cdiscount.com', 'rakuten.fr', 'ebay.fr', 'ebay.com', 'manomano.fr',
  'leboncoin.fr', 'vinted.fr', 'etsy.com', 'backmarket.fr', 'aliexpress.com', 'temu.com', 'shein.com', 'fruugo.fr', 'zalando.fr',
  'veepee.fr', 'ankorstore.com',
]);

/** Revendeurs (enseignes et e-commerçants multimarques) fréquents dans les réponses françaises. */
export const RETAILERS = new Set([
  'sephora.fr', 'nocibe.fr', 'marionnaud.fr', 'notino.fr', 'lookfantastic.fr', 'fnac.com', 'darty.com', 'boulanger.com', 'decathlon.fr',
  'leroymerlin.fr', 'castorama.fr', 'laredoute.fr', 'galerieslafayette.com', 'printemps.com', 'carrefour.fr', 'auchan.fr', 'monoprix.fr',
  'intermarche.com', 'conforama.fr', 'but.fr', 'maisonsdumonde.com', 'greenweez.com', 'lafourche.fr', 'naturalia.fr', 'biocoop.fr',
  'cocooncenter.com', 'easyparapharmacie.com', 'pharmacie-lafayette.com', 'pharma-gdd.com', 'mademoiselle-bio.com', 'oh-my-cream.com',
  'nature-et-decouvertes.com', 'kiabi.com', 'boulanger.fr', 'ldlc.com', 'cultura.com', 'jardiland.com', 'truffaut.com', 'botanic.com',
]);

/** Comparateurs de prix (classés « comparatif »). */
const PRICE_COMPARATORS = new Set(['idealo.fr', 'ledenicheur.fr', 'kelkoo.fr', 'google.com/shopping', 'leguide.com', 'touslesprix.com']);

const KIND_LABEL: Record<EcomSourceKind, string> = {
  brand: 'Votre site',
  marketplace: 'Marketplace',
  retailer: 'Revendeur',
  comparison: 'Comparatif ou comparateur',
  media: 'Média',
  reviews: "Plateforme d'avis",
  forum: 'Forum',
  social: 'Réseau social',
  competitor: 'Site d’un concurrent',
  other: 'Autre',
};
export { KIND_LABEL as ECOM_KIND_LABEL };

const PURCHASE: EcomSourceKind[] = ['brand', 'marketplace', 'retailer', 'competitor'];

function fromCategory(c: SourceCategory): EcomSourceKind {
  switch (c) {
    case 'client':
      return 'brand';
    case 'concurrent':
      return 'competitor';
    case 'marketplace':
      return 'retailer';
    case 'comparatif':
      return 'comparison';
    case 'avis':
      return 'reviews';
    case 'forum':
      return 'forum';
    case 'reseau_social':
      return 'social';
    case 'media_local':
    case 'media_national':
    case 'wikipedia':
      return 'media';
    default:
      return 'other';
  }
}

export interface ClassifyCtx {
  brand: string;
  website?: string;
  competitors?: string[];
}

/** Type d'une URL citée, du point de vue d'un e-commerçant. */
export function classifyEcomUrl(url: string, ctx: ClassifyCtx, meta: { title?: string; snippet?: string } = {}): { domain: string; label: string; kind: EcomSourceKind } {
  const clientDomain = ctx.website ? registrableDomain(ctx.website) : undefined;
  const c = classifyDomain(url, { clientDomain, clientName: ctx.brand, competitors: ctx.competitors, title: meta.title, snippet: meta.snippet });
  const d = c.domain;
  let kind: EcomSourceKind;
  if (c.category === 'client') kind = 'brand';
  else if (MARKETPLACES.has(d)) kind = 'marketplace';
  else if (RETAILERS.has(d)) kind = 'retailer';
  else if (PRICE_COMPARATORS.has(d)) kind = 'comparison';
  else kind = fromCategory(c.category);
  return { domain: d, label: kind === 'brand' ? 'Votre site' : c.label, kind };
}

function sourcesOf(a: AuditResult['answers'][number]): RawSource[] {
  if (a.sources?.length) return a.sources.filter((s) => s.kind !== 'retrieved');
  return a.citations.map((url, i) => ({ url, kind: 'cited' as const, order: i + 1 }));
}

function named(text: string, name: string): boolean {
  const n = normName(text);
  const k = normName(name);
  return k.length >= 3 && (` ${n} `.includes(` ${k} `) || n.replace(/\s+/g, '').includes(k.replace(/\s+/g, '')));
}

export function buildRetailerReport(audit: AuditResult | null, ctx: ClassifyCtx & { businessId: string; demo?: boolean }): RetailerReport {
  const empty: RetailerReport = {
    businessId: ctx.businessId,
    citations: 0,
    answersWithSources: 0,
    byKind: {},
    destinations: {},
    thirdPartyShare: 0,
    domains: [],
    byQuery: [],
    recommendations: [],
    notes: [],
    demo: Boolean(ctx.demo),
  };
  if (!audit) return { ...empty, notes: ['Aucun audit disponible : lancez une première mesure.'] };
  const competitors = ctx.competitors ?? audit.competitors.map((c) => c.name);
  const cctx = { ...ctx, competitors };
  const qText = new Map(audit.queries.map((q) => [q.id, q.text]));
  const recoIds = new Set(audit.queries.filter((q) => q.kind !== 'brand').map((q) => q.id));
  const stats = new Map<string, RetailerStat & { answerKeys: Set<string> }>();
  const kindCount: Partial<Record<EcomSourceKind, number>> = {};
  const dest: Partial<Record<'brand' | 'marketplace' | 'retailer' | 'competitor', number>> = {};
  const perQuery = new Map<string, { destinations: Map<string, EcomSourceKind>; brandLinked: boolean }>();
  let total = 0, answersWithSources = 0, purchaseAnswers = 0;
  const providersWithoutSources = new Set<string>();

  for (const a of audit.answers) {
    if (!recoIds.has(a.queryId) || a.error) continue;
    const srcs = sourcesOf(a);
    if (!srcs.length) {
      providersWithoutSources.add(a.provider);
      continue;
    }
    answersWithSources++;
    const key = `${a.provider}|${a.queryId}|${a.run}`;
    const ordered = [...srcs].sort((x, y) => (x.order ?? 99) - (y.order ?? 99));
    let firstPurchase: EcomSourceKind | null = null;
    const pq = perQuery.get(a.queryId) ?? { destinations: new Map(), brandLinked: false };
    for (const s of ordered) {
      const c = classifyEcomUrl(s.url, cctx, s);
      total++;
      kindCount[c.kind] = (kindCount[c.kind] ?? 0) + 1;
      const st = stats.get(c.domain) ?? { domain: c.domain, label: c.label, kind: c.kind, citations: 0, answers: 0, queries: [], brandPresent: false, competitorsPresent: [], answerKeys: new Set<string>() };
      st.citations++;
      if (!st.answerKeys.has(key)) {
        st.answerKeys.add(key);
        st.answers++;
      }
      if (!st.queries.includes(a.queryId)) st.queries.push(a.queryId);
      const hay = `${s.title ?? ''} ${s.snippet ?? ''} ${decodeURIComponent(s.url).replace(/[-_/]+/g, ' ')}`;
      if (c.kind === 'brand' || named(hay, ctx.brand)) st.brandPresent = true;
      for (const comp of competitors) if (!st.competitorsPresent.includes(comp) && named(hay, comp)) st.competitorsPresent.push(comp);
      stats.set(c.domain, st);
      if (PURCHASE.includes(c.kind)) {
        if (!firstPurchase) firstPurchase = c.kind;
        pq.destinations.set(c.domain, c.kind);
        if (c.kind === 'brand') pq.brandLinked = true;
      }
    }
    perQuery.set(a.queryId, pq);
    if (firstPurchase) {
      purchaseAnswers++;
      const k = firstPurchase as 'brand' | 'marketplace' | 'retailer' | 'competitor';
      dest[k] = (dest[k] ?? 0) + 1;
    }
  }

  const share = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : 0);
  const byKind: RetailerReport['byKind'] = {};
  for (const [k, n] of Object.entries(kindCount) as [EcomSourceKind, number][]) byKind[k] = { citations: n, share: share(n, total) };
  const destinations: RetailerReport['destinations'] = {};
  for (const [k, n] of Object.entries(dest) as ['brand', number][]) destinations[k] = { answers: n, share: share(n, purchaseAnswers) };
  const purchaseCitations = PURCHASE.reduce((a, k) => a + (kindCount[k] ?? 0), 0);
  const thirdPartyShare = share(purchaseCitations - (kindCount.brand ?? 0), purchaseCitations);

  const domains = [...stats.values()]
    .map(({ answerKeys: _k, ...s }) => s)
    .sort((a, b) => b.citations - a.citations);

  const notes: string[] = [];
  if (providersWithoutSources.size) notes.push(`Sans sources citées : ${[...providersWithoutSources].join(', ')} (Gemini est interrogé sans ancrage web, il ne cite pas ses sources).`);
  notes.push('Destination d’achat = première source « où acheter » (votre site, marketplace, revendeur, concurrent) citée dans chaque réponse.');

  return {
    ...empty,
    citations: total,
    answersWithSources,
    byKind,
    destinations,
    thirdPartyShare,
    domains,
    byQuery: [...perQuery.entries()].map(([queryId, v]) => ({
      queryId,
      query: qText.get(queryId) ?? queryId,
      destinations: [...v.destinations.entries()].map(([domain, kind]) => ({ domain, kind })),
      brandLinked: v.brandLinked,
    })),
    recommendations: retailerRecommendations(domains, { brandCitations: kindCount.brand ?? 0, purchaseCitations, brand: ctx.brand }),
    notes,
  };
}

/** Recommandations classées par impact, à partir des domaines cités. */
export function retailerRecommendations(domains: RetailerStat[], x: { brandCitations: number; purchaseCitations: number; brand: string }): RetailerRecommendation[] {
  const recs: RetailerRecommendation[] = [];
  const top = (kind: EcomSourceKind) => domains.filter((d) => d.kind === kind).slice(0, 3);
  for (const d of top('marketplace')) {
    recs.push(
      d.brandPresent
        ? {
            kind: 'marketplace', domain: d.domain, impact: 2,
            title: `Soigner vos fiches sur ${d.label}`,
            why: `Les IA citent ${d.label} ${d.citations} fois ; votre marque y apparaît : la recommandation part chez un tiers plutôt que sur votre site.`,
            steps: ['Alignez titre, prix et attributs de la fiche sur votre site (mêmes noms de produit).', 'Ajoutez votre site officiel dans la fiche marque quand la plateforme le permet.', 'Renforcez la fiche produit de votre site (balisage Product complet) pour qu’elle devienne la source citée.'],
          }
        : {
            kind: 'marketplace', domain: d.domain, impact: d.competitorsPresent.length ? 3 : 2,
            title: `Être présent sur ${d.label} ou rendre votre site plus citable`,
            why: `${d.label} est cité ${d.citations} fois${d.competitorsPresent.length ? `, avec ${d.competitorsPresent.slice(0, 3).join(', ')}` : ''}, sans votre marque.`,
            steps: ['Décidez si la plateforme sert votre stratégie (marge, image).', 'Si oui : publiez vos produits phares avec les mêmes noms que sur votre site.', 'Si non : renforcez vos fiches et vos pages « où acheter » pour donner aux IA une alternative directe.'],
          },
    );
  }
  for (const d of top('retailer')) {
    recs.push({
      kind: 'retailer', domain: d.domain, impact: d.brandPresent ? 1 : 2,
      title: d.brandPresent ? `Mettre à jour vos produits chez ${d.label}` : `Proposer vos produits à ${d.label}`,
      why: d.brandPresent
        ? `${d.label} est cité ${d.citations} fois et vous y figurez : les IA reprennent ses fiches (prix, description).`
        : `${d.label} est cité ${d.citations} fois${d.competitorsPresent.length ? ` avec ${d.competitorsPresent.slice(0, 3).join(', ')}` : ''} ; votre marque n’y apparaît pas.`,
      steps: d.brandPresent
        ? ['Vérifiez prix, contenance et description de vos produits chez ce revendeur.', 'Fournissez des visuels et des attributs complets (GTIN, composition).']
        : ['Identifiez l’acheteur ou le programme « nouvelles marques » de l’enseigne.', 'Préparez un dossier produit (fiches, prix, GTIN, avis vérifiés).'],
    });
  }
  for (const d of top('comparison').filter((x) => !x.brandPresent).slice(0, 2)) {
    recs.push({
      kind: 'comparison', domain: d.domain, impact: 2,
      title: `Entrer dans le comparatif ${d.label}`,
      why: `${d.label} est cité ${d.citations} fois sans votre marque${d.competitorsPresent.length ? ` (on y trouve ${d.competitorsPresent.slice(0, 3).join(', ')})` : ''}.`,
      steps: ['Proposez un échantillon ou une fiche technique à la rédaction.', 'Publiez sur votre site un guide d’achat honnête de la catégorie.'],
    });
  }
  if (x.purchaseCitations > 0 && x.brandCitations / x.purchaseCitations < 0.25) {
    recs.push({
      kind: 'brand', impact: 3,
      title: 'Faire de votre site la destination citée',
      why:
        x.brandCitations <= 1
          ? `Seule ${x.brandCitations} citation « où acheter » sur ${x.purchaseCitations} pointe vers votre site.`
          : `Seules ${x.brandCitations} citations « où acheter » sur ${x.purchaseCitations} pointent vers votre site.`,
      steps: ['Complétez le balisage Product (prix, disponibilité, GTIN, avis) de vos fiches phares.', 'Ajoutez une FAQ produit et un guide d’achat par catégorie (livrables générés).', 'Vérifiez que les robots des IA ne sont pas bloqués (outil « robots »).'],
    });
  }
  return recs.sort((a, b) => b.impact - a.impact).slice(0, 8);
}
