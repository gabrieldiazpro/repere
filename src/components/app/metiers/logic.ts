// Logique pure des écrans métiers (aucun calcul de score ici : les scores viennent de @/lib/local, @/lib/ecommerce,
// @/lib/siteaudit ; on ne fait que trier, regrouper, étiqueter et relier aux actions).
import type { CriterionStatus, Criterion, GbpAudit, GbpGroup, GbpSource, LocalPost, NapStatus, TaskLink, VisibilityMap, ZoneResult } from '@/lib/local/types';
import type { MapCaps } from '@/lib/local/map';
import type { CatalogProduct, EcomSourceKind, PriceCheck, RevenueLine, RevenueReport, RevenueSource } from '@/lib/ecommerce/types';
import type { ProductReport } from '@/lib/siteaudit/types';

// ---------------------------------------------------------------------------
// Liens « et maintenant ? »
// ---------------------------------------------------------------------------
export function taskHref(task?: Pick<TaskLink, 'id' | 'href'> | null): string {
  if (task?.href) return task.href;
  return task?.id ? `/app/actions?t=${encodeURIComponent(task.id)}` : '/app/actions';
}

export function copilotHref(question: string, screen = 'local'): string {
  // La page Copilote n'accepte en `context` qu'un nom d'écran ; la question passe dans `q` (bornée à 300 caractères).
  return `/app/copilote?context=${encodeURIComponent(screen)}&q=${encodeURIComponent(question.slice(0, 300))}`;
}

// ---------------------------------------------------------------------------
// Statuts de critères
// ---------------------------------------------------------------------------
export const STATUS_META: Record<CriterionStatus, { label: string; chip: string; rank: number }> = {
  fail: { label: 'À corriger', chip: 'rp-chip-danger', rank: 0 },
  warn: { label: 'À améliorer', chip: 'rp-chip-warning', rank: 1 },
  unknown: { label: 'Non évalué', chip: '', rank: 2 },
  ok: { label: 'Conforme', chip: 'rp-chip-success', rank: 3 },
};

export function byStatus<T extends { status: CriterionStatus }>(list: T[]): T[] {
  return [...list].sort((a, b) => STATUS_META[a.status].rank - STATUS_META[b.status].rank);
}

export interface CriteriaGroup {
  group: GbpGroup;
  label: string;
  points: number;
  max: number;
  evaluated: number;
  criteria: Criterion[];
  todo: number;
}

/** Regroupe les critères par famille (ordre : familles les plus perdantes d'abord). */
export function groupCriteria(audit: Pick<GbpAudit, 'criteria' | 'groups'>, labels: Record<GbpGroup, string>): CriteriaGroup[] {
  const out: CriteriaGroup[] = (Object.keys(audit.groups) as GbpGroup[]).map((g) => {
    const criteria = byStatus(audit.criteria.filter((c) => c.group === g));
    return { group: g, label: labels[g] ?? g, ...audit.groups[g], criteria, todo: criteria.filter((c) => c.status === 'fail' || c.status === 'warn').length };
  });
  return out.filter((g) => g.criteria.length).sort((a, b) => b.max - b.points - (a.max - a.points) || a.label.localeCompare(b.label));
}

export const GBP_SOURCE_LABEL: Record<GbpSource, { label: string; detail: string }> = {
  places: { label: 'API Google Places', detail: 'Fiche lue en direct par l’API officielle de Google. Son contenu n’est pas conservé : seuls votre identifiant de fiche et nos scores le sont.' },
  manual: { label: 'Saisie guidée', detail: 'Calculé à partir de ce que vous avez déclaré dans le formulaire ci-dessous.' },
  demo: { label: 'Démo', detail: 'Fiche fictive de démonstration : aucune donnée Google réelle.' },
};

// ---------------------------------------------------------------------------
// Carte par zone
// ---------------------------------------------------------------------------
export const BAND_META: Record<ZoneResult['band'], { label: string; color: string; ink: string }> = {
  fort: { label: 'Souvent cité', color: 'var(--success)', ink: 'var(--success-ink)' },
  moyen: { label: 'Parfois cité', color: 'var(--accent)', ink: 'var(--warning-ink)' },
  faible: { label: 'Rarement cité', color: 'var(--warning)', ink: 'var(--warning-ink)' },
  absent: { label: 'Jamais cité', color: 'var(--danger)', ink: 'var(--danger-ink)' },
  na: { label: 'Pas de réponse exploitable', color: 'var(--line)', ink: 'var(--muted)' },
};
export const BAND_ORDER: ZoneResult['band'][] = ['fort', 'moyen', 'faible', 'absent', 'na'];

export interface MapPoint extends ZoneResult {
  cx: number;
  cy: number;
  r: number;
}

/** Points de la carte : coordonnées du modèle SVG de la bibliothèque, couleurs par palier (variables CSS). */
export function mapPoints(map: Pick<VisibilityMap, 'zones' | 'svg'>): MapPoint[] {
  const pos = new Map(map.svg.points.map((p) => [p.id, p]));
  return map.zones.map((z) => {
    const p = pos.get(z.zoneId);
    return { ...z, cx: p?.cx ?? z.x, cy: p?.cy ?? z.y, r: p?.r ?? map.svg.radius };
  });
}

export interface MapSummary {
  zones: number;
  covered: number;
  bestZone: ZoneResult | null;
  worstZone: ZoneResult | null;
  rival: { name: string; zones: number } | null;
}

/** Résumé lisible : zones où vous êtes cité, meilleure et pire zone, concurrent qui domine le plus de zones. */
export function summarize(zones: ZoneResult[]): MapSummary {
  const valid = zones.filter((z) => z.mentionRate !== null);
  const sorted = [...valid].sort((a, b) => (b.mentionRate ?? 0) - (a.mentionRate ?? 0) || a.label.localeCompare(b.label));
  const rivals = new Map<string, number>();
  for (const z of zones) if (z.dominantCompetitor) rivals.set(z.dominantCompetitor.name, (rivals.get(z.dominantCompetitor.name) ?? 0) + 1);
  const top = [...rivals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return {
    zones: zones.length,
    covered: valid.filter((z) => (z.mentionRate ?? 0) > 0).length,
    bestZone: sorted[0] ?? null,
    worstZone: sorted.length > 1 ? sorted[sorted.length - 1] : null,
    rival: top ? { name: top[0], zones: top[1] } : null,
  };
}

export interface MapQuota {
  remaining: number;
  canRun: boolean;
  reason: string | null;
}

export function mapQuota(caps: Pick<MapCaps, 'perMonth'>, used: number, demo: boolean): MapQuota {
  if (demo) return { remaining: 0, canRun: false, reason: 'Compte de démonstration : la carte affichée est simulée, sans appel aux IA.' };
  const remaining = Math.max(0, caps.perMonth - used);
  if (!remaining) return { remaining, canRun: false, reason: `Vous avez utilisé ${caps.perMonth === 1 ? 'la carte' : `les ${caps.perMonth} cartes`} de ce mois.` };
  return { remaining, canRun: true, reason: null };
}

// ---------------------------------------------------------------------------
// Annuaires
// ---------------------------------------------------------------------------
export const NAP_META: Record<NapStatus, { label: string; chip: string; hint: string }> = {
  verified: { label: 'Présent, vérifié', chip: 'rp-chip-success', hint: 'Nous avons lu la page et retrouvé vos coordonnées.' },
  declared: { label: 'Présent, déclaré', chip: 'rp-chip-primary', hint: 'Vous l’avez déclaré ; ajoutez l’adresse de la fiche pour la vérifier.' },
  absent: { label: 'Absent', chip: 'rp-chip-danger', hint: 'Aucune fiche : inscrivez-vous.' },
  unknown: { label: 'À renseigner', chip: '', hint: 'Dites-nous si vous y êtes inscrit.' },
};

export const NAP_FIELD_LABEL = { name: 'Nom', address: 'Adresse', phone: 'Téléphone', url: 'Adresse de la fiche' } as const;

// ---------------------------------------------------------------------------
// Posts Google
// ---------------------------------------------------------------------------
export const POST_TYPE_LABEL: Record<LocalPost['type'], string> = {
  actualite: 'Actualité',
  offre: 'Offre',
  conseil: 'Conseil',
  evenement: 'Événement',
  coulisses: 'Coulisses',
};
export const POST_STATUS_LABEL: Record<LocalPost['status'], string> = { planned: 'Prévu', published: 'Publié', skipped: 'Ignoré' };

/** Prochain post à publier (le plus proche non publié), sinon null. */
export function nextPost(posts: LocalPost[], now: Date = new Date()): LocalPost | null {
  const today = now.toISOString().slice(0, 10);
  const planned = posts.filter((p) => p.status === 'planned').sort((a, b) => a.date.localeCompare(b.date));
  return planned.find((p) => p.date >= today) ?? planned.at(-1) ?? null;
}

// ---------------------------------------------------------------------------
// E-commerce
// ---------------------------------------------------------------------------
export const KIND_COLOR: Record<EcomSourceKind, string> = {
  brand: 'var(--success)',
  marketplace: 'var(--danger)',
  retailer: 'var(--warning)',
  comparison: 'var(--accent)',
  media: 'var(--primary)',
  reviews: 'var(--primary-strong)',
  forum: 'var(--muted)',
  social: 'var(--muted)',
  competitor: 'var(--danger-ink)',
  other: 'var(--line)',
};

export const DESTINATION_LABEL: Record<'brand' | 'marketplace' | 'retailer' | 'competitor', string> = {
  brand: 'Votre site',
  marketplace: 'Une marketplace',
  retailer: 'Un revendeur',
  competitor: 'Un concurrent',
};

export const VERDICT_META: Record<PriceCheck['verdict'], { label: string; chip: string }> = {
  correct: { label: 'Exact', chip: 'rp-chip-success' },
  faux: { label: 'Faux', chip: 'rp-chip-danger' },
  non_verifiable: { label: 'Non vérifiable', chip: '' },
};

export const REVENUE_SOURCE_LABEL: Record<RevenueSource, string> = {
  shopify: 'Commandes Shopify',
  beacon: 'Script de suivi Repéré',
  demo: 'Démo',
  none: 'Aucune source branchée',
};

export function fmtEur(n: number | null | undefined, digits?: number): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const d = digits ?? (Number.isInteger(n) ? 0 : 2);
  return `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)} €`;
}

/** Comparaison IA / autres sources : multiplicateur de conversion et de panier, null si non mesurable. */
export function revenueCompare(r: Pick<RevenueReport, 'ai' | 'other'>): { conversion: number | null; aov: number | null } {
  const ratio = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? a / b : null);
  return { conversion: ratio(r.ai.conversionRate, r.other.conversionRate), aov: ratio(r.ai.aov, r.other.aov) };
}

export function engineRows<E extends string>(byEngine: Partial<Record<E, RevenueLine>>): { engine: E; line: RevenueLine }[] {
  return (Object.entries(byEngine) as [E, RevenueLine | undefined][])
    .filter((x): x is [E, RevenueLine] => Boolean(x[1]) && (x[1]!.orders > 0 || x[1]!.visits > 0))
    .map(([engine, line]) => ({ engine, line }))
    .sort((a, b) => b.line.revenueEur - a.line.revenueEur || b.line.visits - a.line.visits);
}

/** Clé de comparaison d'URL (hôte sans www + chemin sans barre finale). */
export function urlKey(u: string | null | undefined): string {
  if (!u) return '';
  try {
    const x = new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`);
    return `${x.hostname.replace(/^www\./, '').toLowerCase()}${x.pathname.replace(/\/+$/, '') || '/'}`;
  } catch {
    return u.trim().toLowerCase();
  }
}

export interface ProductScore {
  score: number;
  at: string;
  fixes: ProductReport['fixes'];
  missing: string[];
  demo?: boolean;
}

/** Dernier audit de fiche par produit (historique `siteaudit.runs`, plus récent d'abord). */
export function scoresByProduct(products: Pick<CatalogProduct, 'id' | 'url'>[], runs: { url: string; createdAt: string; product: ProductReport | null }[]): Record<string, ProductScore> {
  const out: Record<string, ProductScore> = {};
  const byUrl = new Map<string, { createdAt: string; product: ProductReport }>();
  for (const r of runs) {
    if (!r.product) continue;
    for (const k of [urlKey(r.url), urlKey(r.product.url)]) {
      const prev = byUrl.get(k);
      if (k && (!prev || prev.createdAt < r.createdAt)) byUrl.set(k, { createdAt: r.createdAt, product: r.product });
    }
  }
  for (const p of products) {
    const hit = byUrl.get(urlKey(p.url));
    if (hit) out[p.id] = { score: hit.product.score, at: hit.createdAt, fixes: hit.product.fixes, missing: hit.product.missing };
  }
  return out;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Démo : page produit reconstituée à partir des SEULS champs du catalogue fictif (pas de champ inventé), pour faire
 * tourner le vrai audit de fiche (`productFromHtml`). Les manques (livraison, retours, images…) restent des manques.
 */
export function demoProductHtml(p: CatalogProduct, brand: string): string {
  const ld: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Product', name: p.name, brand: { '@type': 'Brand', name: p.brand ?? brand } };
  if (p.description) ld.description = p.description;
  if (p.gtin) ld.gtin13 = p.gtin;
  if (p.sku) ld.sku = p.sku;
  if (p.price !== undefined) ld.offers = { '@type': 'Offer', price: p.price.toFixed(2), priceCurrency: p.currency ?? 'EUR', ...(p.availability ? { availability: `https://schema.org/${p.availability}` } : {}) };
  if (p.rating) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: String(p.rating.value), reviewCount: String(p.rating.count) };
  return `<!doctype html><html><head><title>${esc(p.name)}</title><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script></head><body><h1>${esc(p.name)}</h1>${p.description ? `<p>${esc(p.description)}</p>` : ''}</body></html>`;
}

export function scoreTone(score: number): 'success' | 'warning' | 'danger' {
  return score >= 75 ? 'success' : score >= 50 ? 'warning' : 'danger';
}
