import type { ProviderId } from '@/lib/engine';
import type { AiEngine, BrandFactField, Segment, SourceCategory, TaskKind, TaskStatus } from '@/lib/engine/types-v2';

// Tranches de la jauge (docs/01-marque.md §3.6). Copie locale pour ne pas dépendre de l'ordre de livraison des agents.
export const BANDS = [
  { min: 0, max: 39, label: 'Invisible', color: 'var(--danger)', bg: 'var(--danger-bg)', ink: 'var(--danger-ink)', icon: '!' },
  { min: 40, max: 69, label: 'Peu visible', color: 'var(--warning)', bg: 'var(--warning-bg)', ink: 'var(--warning-ink)', icon: '~' },
  { min: 70, max: 100, label: 'Bien recommandé', color: 'var(--success)', bg: 'var(--success-bg)', ink: 'var(--success-ink)', icon: '✓' },
] as const;

export type Band = (typeof BANDS)[number];

export function bandFor(score: number): Band {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return BANDS.find((b) => s >= b.min && s <= b.max) ?? BANDS[0];
}

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  claude: 'Claude',
  mistral: 'Mistral (Le Chat)',
};

export const PROVIDER_ORDER: ProviderId[] = ['chatgpt', 'gemini', 'perplexity', 'claude', 'mistral'];

export const ENGINE_LABEL: Record<AiEngine, string> = {
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  copilot: 'Copilot',
  claude: 'Claude',
  other_ai: 'Autres IA',
};
export const ENGINE_ORDER: AiEngine[] = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'other_ai'];
/** Couleurs de séries : variables CSS de app.css (--c-1…7), teintes distinctes contrastées dans les deux thèmes,
 *  toujours doublées d'un libellé. */
export const ENGINE_COLOR: Record<AiEngine, string> = {
  chatgpt: 'var(--c-1)',
  perplexity: 'var(--c-2)',
  gemini: 'var(--c-3)',
  copilot: 'var(--c-4)',
  claude: 'var(--c-5)',
  other_ai: 'var(--c-7)',
};
export const SERIES_COLORS = ['var(--c-1)', 'var(--c-2)', 'var(--c-3)', 'var(--c-4)', 'var(--c-5)', 'var(--c-6)', 'var(--c-7)'];

export const SEGMENT_LABEL: Record<Segment, string> = { local: 'Local', pme: 'PME', ecommerce: 'E-commerce' };

export const CATEGORY_LABEL: Record<SourceCategory, string> = {
  annuaire: 'Annuaire',
  avis: 'Avis',
  media_national: 'Média national',
  media_local: 'Média local',
  comparatif: 'Comparatif',
  forum: 'Forum',
  marketplace: 'Marketplace',
  reseau_social: 'Réseau social',
  concurrent: 'Concurrent',
  client: 'Votre site',
  wikipedia: 'Wikipédia',
  institutionnel: 'Institutionnel',
  autre: 'Autre',
};

export const FACT_LABEL: Record<BrandFactField, string> = {
  adresse: 'Adresse',
  telephone: 'Téléphone',
  horaires: 'Horaires',
  prix: 'Prix',
  zone: "Zone d'intervention",
  services: 'Services',
  dirigeant: 'Dirigeant',
  creation: 'Date de création',
  site: 'Site web',
  statut: 'Statut',
  produits: 'Produits',
  livraison: 'Livraison',
  clients: 'Références clients',
  retours: 'Retours',
  ingredients: 'Ingrédients (INCI)',
  certifications: 'Labels et certifications',
};

export const FACT_HINT: Partial<Record<BrandFactField, string>> = {
  horaires: 'Ex. lun–ven 8 h–19 h, sam 9 h–13 h, urgences 7 j/7',
  prix: 'Ex. déplacement 49 €, devis gratuit',
  statut: 'Ouvert, ou fermé définitivement',
  clients: 'Quelques références que vous acceptez de citer',
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  gbp_profile: 'Fiche Google',
  bing_places: 'Bing Places',
  apple_business: 'Apple Business',
  directory: 'Annuaire',
  schema: 'Données structurées',
  faq_page: 'Page FAQ',
  review_request: 'Demande d’avis',
  review_reply: 'Réponse à un avis',
  content: 'Contenu',
  source_outreach: 'Source à gagner',
  fact_fix: 'Correction',
  product_feed: 'Flux produit',
  other: 'Autre',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  done: 'Fait',
  skipped: 'Écartée',
};

export const AUTOMATION_LABEL = { auto: 'Fait pour vous', semi: 'Prêt à coller', guide: 'Guidé pas à pas' } as const;

export const INTENT_LABEL: Record<string, string> = {
  best: 'Le meilleur',
  nearby: 'Près de chez moi',
  urgent: 'Urgent',
  specific: 'Spécialité',
  review: 'Avis',
};

export const CONFIDENCE_LABEL: Record<string, string> = {
  bonne: 'Fiabilité bonne',
  moyenne: 'Fiabilité moyenne',
  faible: 'Fiabilité faible',
};

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...opts });
}

export function fmtMonth(iso: string) {
  return fmtDate(iso, { month: 'short', year: '2-digit' });
}

export function fmtInt(n: number) {
  return Math.round(n).toLocaleString('fr-FR');
}

export function pct(x: number, digits = 0) {
  const v = x <= 1 ? x * 100 : x;
  return `${v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits })} %`;
}

export function signed(n: number) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** « 4ᵉ », « 1ᵉʳ » */
export function ordinal(n: number) {
  return n === 1 ? '1ᵉʳ' : `${n}ᵉ`;
}

export function minutes(n: number) {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export const EFFORT_LABEL: Record<'S' | 'M' | 'L', string> = {
  S: 'Rapide',
  M: 'Moyen',
  L: 'Plus long',
};
export const EFFORT_TIME: Record<'S' | 'M' | 'L', string> = { S: '≈ 30 min', M: '≈ 2 h', L: 'une demi-journée ou plus' };

export const IMPACT_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Impact modéré',
  2: 'Impact important',
  3: 'Impact fort',
};
