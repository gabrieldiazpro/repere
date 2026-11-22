/**
 * Simulateur « Ce que la visibilité IA représente pour ma boutique » (V8, agent ECOM) — calcul pur, testé.
 *
 * Le marchand saisit SES chiffres ; chaque hypothèse a trois valeurs (basse / médiane / haute), modifiables, sourcées et
 * datées (recherche du 22 nov. 2026). Rien n'est une promesse : c'est une estimation à partir d'études publiques,
 * presque toutes américaines (les aperçus IA de Google ne sont arrivés en France que le 22 juillet 2026).
 *
 * Modèle (par mois) :
 *   ventes = visites × conversion × panier ; ventesGoogle = ventes × part Google
 *   AVANT (aperçus IA présents, boutique non citée ; assistants IA : votre part actuelle, 0 si inconnue)
 *     google = ventesGoogle × (1 − s × d)
 *     ia     = visites × aActuelle × conversion × c × panier
 *   APRÈS (boutique citée dans les aperçus IA et recommandée par les assistants comme un site moyen)
 *     google = ventesGoogle × (1 − s + s × min(1, (1 − d) × (1 + u)))   (plafond : être cité ne rend pas plus de clics
 *     qu'une recherche sans aperçu IA ; les valeurs de d et u viennent de mesures différentes)
 *     ia     = visites × max(aActuelle, a) × conversion × c × panier
 *   s : part des recherches avec aperçu IA ; d : baisse des clics quand l'aperçu ne vous cite pas ; u : clics en plus
 *   quand il vous cite ; a : part des visites venant des assistants IA ; c : conversion de ces visites / la vôtre.
 * Les scénarios combinent les valeurs défavorables (basse), centrales (médiane) ou favorables (haute) au gain.
 */
import type { Verdict } from '../v6/types';

export const SIM_UPDATED = '2026-11-22';

export const SIM_PLATFORMS = [
  { id: 'shopify', label: 'Shopify', agent: 'Shopify' },
  { id: 'woocommerce', label: 'WooCommerce', agent: 'WordPress / WooCommerce' },
  { id: 'prestashop', label: 'PrestaShop', agent: 'PrestaShop' },
  { id: 'magento', label: 'Magento / Adobe Commerce', agent: 'Magento' },
  { id: 'wix', label: 'Wix', agent: 'Wix' },
  { id: 'autre', label: 'Autre solution', agent: null },
] as const;
export type SimPlatform = (typeof SIM_PLATFORMS)[number]['id'];

export type Scenario = 'basse' | 'mediane' | 'haute';
export const SCENARIOS: Scenario[] = ['basse', 'mediane', 'haute'];
export const SCENARIO_LABEL: Record<Scenario, string> = { basse: 'Bas', mediane: 'Médian', haute: 'Haut' };

export type HypId = 's' | 'd' | 'u' | 'a' | 'c';

export interface HypSource {
  label: string;
  url: string;
  /** date de publication de la source */
  date: string;
  /** ce que dit la source, et le calcul éventuel */
  fact: string;
}

export interface Hypothesis {
  id: HypId;
  label: string;
  /** phrase courte sous le libellé */
  help: string;
  /** valeurs en % par scénario (déjà rangées du moins au plus favorable au gain) */
  values: Record<Scenario, number>;
  min: number;
  max: number;
  /** d'où vient chaque valeur */
  origin: Record<Scenario, string>;
  sources: HypSource[];
  /** ce que les études ne disent pas (à fixer par le marchand) */
  gap: string;
}

const PEW: HypSource = {
  label: 'Pew Research Center, « Google users are less likely to click on links when an AI summary appears »',
  url: 'https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/',
  date: '2025-07-22',
  fact: '900 adultes américains, mars 2025 : 18 % des recherches affichent un résumé IA ; clic sur un résultat classique dans 8 % des visites avec résumé contre 15 % sans (soit −47 %, notre calcul).',
};
const SEER_2025: HypSource = {
  label: 'Seer Interactive, « AIO Impact on Google CTR: September 2025 Update »',
  url: 'https://www.seerinteractive.com/blog/aio-impact-on-google-ctr-september-2025-update',
  date: '2025-11-04',
  fact: '3 119 requêtes informationnelles, 42 organisations, 25,1 M d’impressions : taux de clic 0,70 % quand la marque est citée dans l’aperçu contre 0,52 % quand elle ne l’est pas (+35 %). Seer précise que la citation peut refléter la notoriété plutôt que la causer.',
};
const SEER_2026: HypSource = {
  label: 'Seer Interactive, « AIO Impact on Google CTR: 2026 Update »',
  url: 'https://seerinteractive.com/insights/aio-impact-on-google-ctr-2026-update',
  date: '2026-04-24',
  fact: '53 marques, 5,47 M de requêtes, janv. 2025–févr. 2026 : taux de clic avec aperçu 2,36 % contre 3,82 % sans en février 2026 (−38 %, notre calcul), 1,31 % contre 3,16 % en décembre 2025 (−59 %) ; cité 0,95 % contre non cité 0,55 % en décembre 2025 (+73 %) ; « +120 % » de clics par impression quand la marque est citée (moyenne annuelle, requêtes informationnelles).',
};
const SEMRUSH_COMMERCIAL: HypSource = {
  label: 'Semrush, étude des aperçus IA sur les recherches commerciales (600 000 mots-clés, États-Unis)',
  url: 'https://www.semrush.com/blog/ai-overviews-commercial-search-study/',
  date: '2026-07-02',
  fact: 'Novembre 2025–avril 2026, ordinateur, États-Unis : en avril 2026, aperçus IA sur 16 % des pages de résultats transactionnelles et 14 % des commerciales dans l’alimentation et les boissons.',
};
const SEMRUSH_PANEL: HypSource = {
  label: 'Semrush via PPC Land, « Google AI Overviews now hit 88% of tracked commercial keywords »',
  url: 'https://ppc.land/google-ai-overviews-now-hit-88-of-tracked-commercial-keywords-semrush-finds/',
  date: '2026-10-22',
  fact: 'Panel fixe de 400 requêtes de décision (« meilleur X pour Y », « X ou Y », prix, avis) en banque, logiciel et e-commerce : 88 % déclenchent un aperçu IA en août 2026, contre 45,75 % en septembre 2025.',
};
const CONTENTSQUARE: HypSource = {
  label: 'Contentsquare, « AI-referred traffic » (Digital Experience Benchmark 2026)',
  url: 'https://contentsquare.com/blog/ai-referred-traffic/',
  date: '2026-04-03',
  fact: '99 milliards de sessions sur 6 500 sites : les visites venues des IA représentent 0,2 % du total.',
};
const KAISER: HypSource = {
  label: 'Kaiser et Schulze, « ChatGPT Referrals to E-Commerce Websites », Marketing Science',
  url: 'https://pubsonline.informs.org/doi/full/10.1287/mksc.2025.0489',
  date: '2026-04-21',
  fact: '973 sites marchands, août 2024–juillet 2025 : ChatGPT pèse moins de 0,2 % du trafic ; la recherche organique a une probabilité de conversion 13 % plus élevée que les visites venues des IA (soit ≈ −12 % pour ces dernières, notre calcul : 1 ÷ 1,13).',
};
const CONDUCTOR: HypSource = {
  label: 'Conductor, AEO/GEO Benchmarks Report 2026, via Search Engine Land',
  url: 'https://searchengineland.com/ai-1-traffic-mostly-chatgpt-464653',
  date: '2025-11-13',
  fact: '13 770 domaines américains, 3,3 milliards de sessions, mai–septembre 2025 : 1,08 % du trafic vient des IA, dont 87,4 % de ChatGPT.',
};
const ADOBE_HOLIDAY: HypSource = {
  label: 'Digital Commerce 360, d’après Adobe Digital Insights : fêtes de fin d’année 2025',
  url: 'https://www.digitalcommerce360.com/2026/01/13/generative-ai-online-holiday-shopping-traffic-2025/',
  date: '2026-01-13',
  fact: 'Sites marchands américains, novembre–décembre 2025 : les visites venues des IA convertissent 31 % de plus que les autres.',
};
const ADOBE_SEPT: HypSource = {
  label: 'Adobe, « AI traffic now generates 83% higher revenue per visit for U.S. retailers »',
  url: 'https://business.adobe.com/au/blog/ai-traffic-higher-revenue-per-visit-retail-holiday',
  date: '2026-10-29',
  fact: 'Plus de 1 000 milliards de visites de sites marchands américains : en septembre 2026, les visites venues des IA convertissent 90 % mieux (elles convertissaient 9 % moins bien en août 2025).',
};
export const GOOGLE_FR: HypSource = {
  label: 'Google France, « Lancement des Aperçus IA et du Mode IA dans la Recherche Google en France »',
  url: 'https://blog.google/intl/fr-fr/nouveautes-produits/explorez-obtenez-des-reponses/recherche-ia-apercus-mode/',
  date: '2026-07-22',
  fact: 'Les aperçus IA sont disponibles en France depuis le 22 juillet 2026.',
};

export const HYPOTHESES: Hypothesis[] = [
  {
    id: 's',
    label: 'Part de vos recherches Google qui affichent un aperçu IA',
    help: 'Plus elle est haute, plus vos ventes Google dépendent d’être cité dans ces résumés.',
    values: { basse: 14, mediane: 18, haute: 88 },
    min: 0,
    max: 100,
    origin: { basse: 'Semrush, requêtes commerciales (avril 2026)', mediane: 'Pew, toutes recherches (mars 2025)', haute: 'Semrush, requêtes de décision « meilleur X pour Y » (août 2026)' },
    sources: [SEMRUSH_COMMERCIAL, PEW, SEMRUSH_PANEL, GOOGLE_FR],
    gap: 'Aucune mesure publique française au 22 novembre 2026 (aperçus IA lancés en France le 22 juillet 2026). Search Console ne sépare pas ces affichages : tapez les requêtes de vos produits phares et comptez.',
  },
  {
    id: 'd',
    label: 'Baisse des clics quand l’aperçu IA ne vous cite pas',
    help: 'Part des clics vers les résultats classiques qui disparaît quand un aperçu IA répond à la place.',
    values: { basse: 59, mediane: 47, haute: 38 },
    min: 0,
    max: 100,
    origin: { basse: 'Seer, décembre 2025 (calcul)', mediane: 'Pew, mars 2025 (calcul)', haute: 'Seer, février 2026 (calcul)' },
    sources: [SEER_2026, PEW],
    gap: 'Mesures américaines, surtout sur des requêtes d’information : l’effet sur des requêtes d’achat en français n’est pas publié. Une forte baisse réduit aussi ce que la citation rapporte : c’est pourquoi la valeur la plus haute sert au scénario bas.',
  },
  {
    id: 'u',
    label: 'Clics en plus quand l’aperçu IA vous cite',
    help: 'Par rapport à la même recherche où vous n’êtes pas cité.',
    values: { basse: 35, mediane: 73, haute: 120 },
    min: 0,
    max: 500,
    origin: { basse: 'Seer, 3e trimestre 2025', mediane: 'Seer, décembre 2025 (calcul)', haute: 'Seer, moyenne 2025 (requêtes d’information)' },
    sources: [SEER_2025, SEER_2026],
    gap: 'Lien constaté, pas causalité démontrée : les marques citées sont souvent déjà connues. Aucune donnée publique propre aux boutiques en ligne.',
  },
  {
    id: 'a',
    label: 'Part de vos visites venant des assistants IA (ChatGPT, Perplexity, Gemini…)',
    help: 'Pour une boutique que les assistants recommandent comme un site moyen.',
    values: { basse: 0.2, mediane: 0.6, haute: 1.08 },
    min: 0,
    max: 50,
    origin: { basse: 'Contentsquare (2025) ; Kaiser et Schulze, sites marchands', mediane: 'Milieu des deux mesures (calcul Repéré)', haute: 'Conductor, domaines américains (mai–sept. 2025)' },
    sources: [CONTENTSQUARE, KAISER, CONDUCTOR],
    gap: 'Ce sont des moyennes de tous les sites : aucune étude publique ne mesure la part d’une boutique effectivement recommandée par les IA. Si vous la connaissez (Google Analytics, source « chatgpt.com », « perplexity.ai »…), mettez-la.',
  },
  {
    id: 'c',
    label: 'Conversion des visiteurs venus des IA, comparée à la vôtre',
    help: '0 % = ils achètent autant que vos autres visiteurs.',
    values: { basse: -12, mediane: 31, haute: 90 },
    min: -100,
    max: 500,
    origin: { basse: 'Kaiser et Schulze, 973 boutiques (calcul)', mediane: 'Adobe, fêtes 2025 (États-Unis)', haute: 'Adobe, septembre 2026 (États-Unis)' },
    sources: [KAISER, ADOBE_HOLIDAY, ADOBE_SEPT],
    gap: 'Les études divergent (méthodes et périodes différentes) et l’écart change vite : Adobe passe de −9 % (août 2025) à +90 % (septembre 2026).',
  },
];

export type HypValues = Record<HypId, Record<Scenario, number>>;
export const defaultHypValues = (): HypValues => Object.fromEntries(HYPOTHESES.map((h) => [h.id, { ...h.values }])) as HypValues;

export interface SimInput {
  visits: number;
  /** % */
  conversion: number;
  /** € TTC */
  basket: number;
  /** % du trafic venu de la recherche Google (hors annonces) */
  googleShare: number;
  /** % du trafic venu des IA aujourd'hui, si connu */
  aiShareNow: number | null;
  platform: SimPlatform;
}

export interface ScenarioResult {
  avant: number;
  apres: number;
  gain: number;
  /** ventes Google exposées aux aperçus IA quand vous n'êtes pas cité */
  exposed: number;
  googleAvant: number;
  googleApres: number;
  aiAvant: number;
  aiApres: number;
  /** visites mensuelles venues des IA dans le scénario « après » */
  aiVisits: number;
  /** le plafond « cité ≤ sans aperçu » s'applique */
  capped: boolean;
}

export interface SimResult {
  ok: boolean;
  errors: Partial<Record<keyof SimInput, string>>;
  revenue: number;
  googleRevenue: number;
  scenarios: Record<Scenario, ScenarioResult>;
  verdict: Verdict | null;
  notes: string[];
}

export const EXAMPLE_INPUT: SimInput = { visits: 20_000, conversion: 1.5, basket: 65, googleShare: 40, aiShareNow: null, platform: 'shopify' };

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const fin = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Contrôle de la saisie (texte libre côté formulaire, converti ici). */
export function validate(i: SimInput): Partial<Record<keyof SimInput, string>> {
  const e: Partial<Record<keyof SimInput, string>> = {};
  if (!fin(i.visits) || i.visits < 1 || i.visits > 100_000_000) e.visits = 'Entre 1 et 100 millions de visites par mois.';
  if (!fin(i.conversion) || i.conversion <= 0 || i.conversion > 50) e.conversion = 'Un pourcentage entre 0,01 et 50.';
  if (!fin(i.basket) || i.basket <= 0 || i.basket > 100_000) e.basket = 'Un montant entre 1 et 100 000 €.';
  if (!fin(i.googleShare) || i.googleShare < 0 || i.googleShare > 100) e.googleShare = 'Un pourcentage entre 0 et 100.';
  if (i.aiShareNow !== null && (!fin(i.aiShareNow) || i.aiShareNow < 0 || i.aiShareNow > 50)) e.aiShareNow = 'Un pourcentage entre 0 et 50, ou laissez vide.';
  return e;
}

/** Lit un nombre saisi en français (« 1 500 », « 1,5 % », « 65 € »). `null` si vide ou illisible. */
export function parseNumber(raw: string): number | null {
  const s = String(raw ?? '').replace(/[\s  €%]/g, '').replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function scenario(i: SimInput, hv: HypValues, sc: Scenario): ScenarioResult {
  const p = (id: HypId) => {
    const h = HYPOTHESES.find((x) => x.id === id)!;
    const v = hv[id]?.[sc];
    return clamp(fin(v) ? v : h.values[sc], h.min, h.max) / 100;
  };
  const s = p('s');
  const d = p('d');
  const u = p('u');
  const a = p('a');
  const c = 1 + p('c');
  const cr = i.conversion / 100;
  const revenue = i.visits * cr * i.basket;
  const rg = revenue * (i.googleShare / 100);
  const now = i.aiShareNow === null ? 0 : i.aiShareNow / 100;
  const googleAvant = rg * (1 - s * d);
  const cited = Math.min(1, (1 - d) * (1 + u));
  const googleApres = rg * (1 - s + s * cited);
  const aiAvant = i.visits * now * cr * c * i.basket;
  const aiShareAfter = Math.max(now, a);
  const aiApres = i.visits * aiShareAfter * cr * c * i.basket;
  const avant = googleAvant + aiAvant;
  const apres = googleApres + aiApres;
  return { avant, apres, gain: apres - avant, exposed: rg * s * d, googleAvant, googleApres, aiAvant, aiApres, aiVisits: i.visits * aiShareAfter, capped: (1 - d) * (1 + u) > 1 };
}

const EMPTY_SC: ScenarioResult = { avant: 0, apres: 0, gain: 0, exposed: 0, googleAvant: 0, googleApres: 0, aiAvant: 0, aiApres: 0, aiVisits: 0, capped: false };

export function simulate(i: SimInput, hv: HypValues = defaultHypValues()): SimResult {
  const errors = validate(i);
  if (Object.keys(errors).length) return { ok: false, errors, revenue: 0, googleRevenue: 0, scenarios: { basse: EMPTY_SC, mediane: EMPTY_SC, haute: EMPTY_SC }, verdict: null, notes: [] };
  const revenue = i.visits * (i.conversion / 100) * i.basket;
  const googleRevenue = revenue * (i.googleShare / 100);
  const scenarios = Object.fromEntries(SCENARIOS.map((sc) => [sc, scenario(i, hv, sc)])) as Record<Scenario, ScenarioResult>;
  // Fourchette : les valeurs modifiées peuvent inverser l'ordre ; on présente toujours du plus bas au plus haut.
  const gains = SCENARIOS.map((sc) => scenarios[sc].gain).sort((x, y) => x - y);
  const med = scenarios.mediane.gain;
  const share = revenue > 0 ? med / revenue : 0;
  const notes: string[] = [];
  if (i.aiShareNow === null) notes.push('Part actuelle des visites venues des IA inconnue : comptée à 0. Si vous en recevez déjà, saisissez-la, le gain diminue d’autant.');
  if (SCENARIOS.some((sc) => scenarios[sc].capped)) notes.push('Plafond appliqué : nous ne comptons jamais plus de clics pour une boutique citée que pour une recherche sans aperçu IA (les deux mesures viennent d’études différentes).');
  if (i.googleShare === 0) notes.push('Sans trafic venu de Google, seuls les assistants IA comptent dans la simulation.');
  if (i.aiShareNow !== null && i.aiShareNow >= hv.a.haute) notes.push('Vous recevez déjà autant de visites des IA que la valeur haute des études : la part « assistants » n’ajoute rien.');
  const verdict: Verdict = {
    tone: share >= 0.02 ? 'warn' : 'ok',
    title: `Simulation : entre ${euros(gains[0])} et ${euros(gains[2])} de ventes par mois en plus si votre boutique est citée par les IA (médiane ${euros(med)}).`,
    text:
      share >= 0.02
        ? `Soit environ ${pct(share)} de vos ventes actuelles dans le scénario médian. Une estimation à partir d’études publiques, pas une promesse.`
        : `Soit moins de 2 % de vos ventes actuelles dans le scénario médian : un enjeu limité aujourd’hui, qui dépend surtout de la part de vos recherches touchées par les aperçus IA. Une estimation, pas une promesse.`,
  };
  return { ok: true, errors: {}, revenue, googleRevenue, scenarios, verdict, notes };
}

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
/** Arrondi lisible : à 10 € près sous 1 000 €, à 100 € près au-delà (une estimation n'a pas de centimes). */
export function euros(x: number): string {
  const r = Math.abs(x) < 1000 ? Math.round(x / 10) * 10 : Math.round(x / 100) * 100;
  return `${nf0.format(r === 0 ? 0 : r)} €`;
}
export function pct(x: number): string {
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: x < 0.1 ? 1 : 0 }).format(x * 100)} %`;
}
