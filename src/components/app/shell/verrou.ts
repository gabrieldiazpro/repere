// Verrouillage par offre (logique pure, testée). Une fonction hors offre s'affiche verrouillée avec l'offre requise
// et un lien vers /tarifs : jamais cachée, jamais d'erreur brute.
import type { Entitlements } from '@/lib/entitlements';
import { ALL_PROVIDERS, type ProviderId } from '@/lib/engine/types';

/** Fonctions verrouillables : drapeaux de @/lib/entitlements + quelques fonctions dérivées. */
export type VerrouFeature =
  | 'execution'
  | 'exports'
  | 'shareLinks'
  | 'whiteLabel'
  | 'integrations'
  | 'weekly'
  | 'daily'
  | 'claude'
  | 'mistral'
  | 'team';

/** Offre minimale qui débloque la fonction (mêmes libellés que les messages 402 de @/lib/entitlements). */
export const OFFRE_REQUISE: Record<VerrouFeature, string> = {
  execution: 'Essentiel',
  exports: 'Essentiel',
  shareLinks: 'Essentiel',
  whiteLabel: 'Agence',
  integrations: 'Essentiel (PME, E-commerce) ou Accompagné',
  weekly: 'Accompagné',
  daily: 'sur devis',
  claude: 'Essentiel (PME, E-commerce) ou Accompagné',
  mistral: 'Accompagné (PME, E-commerce)',
  team: 'Essentiel',
};

/** Ce que la fonction apporte, en une phrase (affiché dans le cadre verrouillé). */
export const BENEFICE: Record<VerrouFeature, string> = {
  execution: 'Des livrables prêts à coller, générés pour vous à chaque tâche.',
  exports: 'Toutes vos vues en CSV, pour vos tableaux ou votre agence.',
  shareLinks: 'Un lien de rapport à envoyer, révocable à tout moment.',
  whiteLabel: 'Vos rapports à votre nom, avec votre logo et votre couleur.',
  integrations: 'Slack, webhook, GA4, Shopify : vos données là où vous travaillez.',
  weekly: 'Une mesure chaque semaine au lieu d’une par mois.',
  daily: 'Une mesure chaque jour.',
  claude: 'Les réponses de Claude en plus de ChatGPT, Perplexity et Gemini.',
  mistral: 'Les réponses de Mistral Vibe (ex-Le Chat) en plus des autres IA.',
  team: 'Invitez vos collègues ou votre agence.',
};

export interface VerrouEtat {
  locked: boolean;
  /** offre minimale requise (vide si non verrouillé) */
  offre: string;
  benefice: string;
  /** lien vers les tarifs, avec la fonction en paramètre (mesure des déblocages) */
  href: string;
}

export function isEntitled(e: Entitlements, feature: VerrouFeature): boolean {
  switch (feature) {
    case 'weekly':
      return e.frequency === 'weekly' || e.frequency === 'daily';
    case 'daily':
      return e.frequency === 'daily';
    case 'claude':
      return e.engines.includes('claude');
    case 'mistral':
      return e.engines.includes('mistral');
    case 'team':
      return e.seats > 1;
    default:
      return Boolean(e[feature]);
  }
}

export function verrou(e: Entitlements | null | undefined, feature: VerrouFeature): VerrouEtat {
  // Sans droits connus (chargement, erreur) : on n'affiche pas de faux verrou.
  const locked = e ? !isEntitled(e, feature) : false;
  return {
    locked,
    offre: locked ? OFFRE_REQUISE[feature] : '',
    benefice: BENEFICE[feature],
    href: `/tarifs?depuis=app&fonction=${encodeURIComponent(feature)}`,
  };
}

/** Quota consommé : part (0..1) et libellé « 3 sur 5 ». */
export function quota(used: number, max: number) {
  const m = Math.max(0, max);
  const u = Math.max(0, used);
  return { used: u, max: m, ratio: m ? Math.min(1, u / m) : 1, full: u >= m, label: `${u} sur ${m}` };
}

/**
 * IA suivies dans Réglages : incluse (cochée), verrouillée avec l'offre minimale qui l'ouvre pour ce parcours, ou
 * « en option » (V8 : IA mesurables qu'aucune offre n'annonce encore, ajoutées par la plateforme quand elle les active).
 * Liste dynamique : toutes les IA du moteur (ALL_PROVIDERS), jamais une liste figée.
 */
export interface EngineAccess {
  id: ProviderId;
  included: boolean;
  /** offre minimale qui inclut cette IA pour ce parcours (« Essentiel », « Accompagné ») ; null si incluse ou en option */
  unlock: string | null;
  /** aucune offre ne l'annonce (IA en option) ; `extraActive` : mesurée en plus pour les offres payantes (plateforme) */
  optional: boolean;
  extraActive?: boolean;
}

export function engineAccess(
  e: Pick<Entitlements, 'engines' | 'tier'>,
  segment: 'local' | 'pme' | 'ecommerce',
  getEnt: (b: { id: string; plan: 'essentiel' | 'accompagne'; segment: 'local' | 'pme' | 'ecommerce' }) => Pick<Entitlements, 'engines'>,
  names: Record<'essentiel' | 'accompagne', string>,
  opts: { extras?: readonly ProviderId[] } = {},
): EngineAccess[] {
  const ladder = (['essentiel', 'accompagne'] as const).map((plan) => ({ plan, engines: getEnt({ id: `offre-${plan}`, plan, segment }).engines }));
  const anyOffer = new Set<ProviderId>(ladder.flatMap((l) => l.engines));
  const paid = e.tier === 'essentiel' || e.tier === 'accompagne' || e.tier === 'agence';
  return ALL_PROVIDERS.map((id) => {
    const included = e.engines.includes(id);
    const first = included ? null : ladder.find((l) => l.engines.includes(id));
    const optional = !included && !anyOffer.has(id);
    const extraActive = optional && paid && (opts.extras ?? []).includes(id);
    return { id, included, unlock: first ? names[first.plan] : null, optional, ...(extraActive ? { extraActive } : {}) };
  });
}
