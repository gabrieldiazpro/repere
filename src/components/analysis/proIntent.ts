/**
 * Lancement direct depuis l'accueil (TESTS-REELS, nov. 2026) : la case « J’agis pour les besoins de mon activité
 * professionnelle » est cochée dans le formulaire de l'accueil ; /analyse démarre alors tout seul.
 *
 * La déclaration doit venir de la personne qui lance le test, pas d'un lien partagé : le formulaire de l'accueil garde
 * une trace à usage unique dans sessionStorage (même onglet, 10 minutes, même site). Un lien « ?pro=1 » reçu d'un tiers
 * n'a pas cette trace : le formulaire s'affiche avec la case décochée. L'horodatage qui fait foi est celui du serveur
 * (route /api/v5/analysis, collection `analysis.pro`).
 */
const KEY = 'repere.pro-intent';
export const PRO_INTENT_TTL_MS = 10 * 60 * 1000;

/** Adresse ou nom ramené à une forme comparable (« https://www.Site.fr/ » → « site.fr »). */
export function intentKey(target: string): string {
  return target
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[/?#].*$/, '');
}

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const session = (): Store | null => {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
};

export function rememberProIntent(target: string, now = Date.now(), store: Store | null = session()): void {
  try {
    store?.setItem(KEY, JSON.stringify({ t: intentKey(target), at: now }));
  } catch {
    /* stockage indisponible : la case sera redemandée sur /analyse */
  }
}

/** true (et la trace est effacée) si la case a été cochée sur l'accueil pour ce site, dans cet onglet, il y a < 10 min. */
export function consumeProIntent(target: string, now = Date.now(), store: Store | null = session()): boolean {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return false;
    store?.removeItem(KEY);
    const v = JSON.parse(raw) as { t?: unknown; at?: unknown };
    return typeof v.t === 'string' && v.t === intentKey(target) && typeof v.at === 'number' && now - v.at >= 0 && now - v.at < PRO_INTENT_TTL_MS;
  } catch {
    return false;
  }
}
export const PRO_DECLARATION_TEXT = 'J’agis pour les besoins de mon activité professionnelle';
