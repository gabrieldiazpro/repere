/**
 * Catalogue des baromètres et questions posées.
 * - Local : métier × ville, questions = gabarits T1–T10 du moteur + 2 variantes (buildQueries, jamais de nom d'entreprise).
 * - PME : catégorie d'offre, gabarits P1–P12 (buildPmeQueries) sans concurrent déclaré (pas de marque dans la question).
 * - E-commerce : catégorie de produits, gabarits E1–E12 (buildEcomQueries) sans concurrent déclaré.
 * Les professions réglementées (santé, avocats, experts-comptables…) sont exclues, comme dans l'audit.
 */
import { buildQueries } from '../engine/queries';
import { buildEcomQueries, buildPmeQueries } from '../engine/queries-v2';
import { ALL_PROVIDERS, type AuditInput, type ProviderId } from '../engine/types';
import { shortHash, stripAccents } from '../engine/util';
import { isRegulatedTrade } from '../regulated';
import type { BarometreDef, BarometreQuestion } from './types';

export const MIN_QUESTIONS = 8;
export const MAX_QUESTIONS = 20;
export const DEFAULT_QUESTIONS = 12;
export const DEFAULT_RUNS = 3;
/** IA interrogées par défaut : les 4 IA suivies par Repéré. Mistral s'ajoute quand MISTRAL_API_KEY est configurée. */
export const BASE_PROVIDERS: ProviderId[] = ['chatgpt', 'perplexity', 'gemini', 'claude'];

export function slugify(s: string): string {
  return stripAccents(s)
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** IA du baromètre : BAROMETRE_PROVIDERS (« chatgpt,perplexity ») sinon les 4 de base (+ Mistral si clé). */
export function defaultProviders(env: Record<string, string | undefined> = process.env): ProviderId[] {
  const raw = (env.BAROMETRE_PROVIDERS ?? '').trim();
  if (raw) {
    const ids = [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()))].filter((s): s is ProviderId =>
      (ALL_PROVIDERS as string[]).includes(s),
    );
    if (ids.length) return ids;
  }
  return env.MISTRAL_API_KEY ? [...BASE_PROVIDERS, 'mistral'] : [...BASE_PROVIDERS];
}

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

const LOCAL_TRADES: { trade: string; plural: string }[] = [
  { trade: 'plombier', plural: 'Plombiers' },
  { trade: 'electricien', plural: 'Électriciens' },
  { trade: 'serrurier', plural: 'Serruriers' },
  { trade: 'chauffagiste', plural: 'Chauffagistes' },
  { trade: 'garagiste', plural: 'Garagistes' },
  { trade: 'agence immobiliere', plural: 'Agences immobilières' },
  { trade: 'coiffeur', plural: 'Coiffeurs' },
  { trade: 'demenageur', plural: 'Déménageurs' },
];
const LOCAL_CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux'];

const PME: { category: string; title: string; subject: string }[] = [
  { category: 'logiciel de paie', title: 'Logiciels de paie pour PME', subject: 'logiciels de paie pour PME' },
  { category: 'CRM', title: 'CRM pour PME', subject: 'CRM pour PME' },
  { category: 'logiciel de facturation', title: 'Logiciels de facturation pour PME', subject: 'logiciels de facturation pour PME' },
  { category: 'logiciel de comptabilité', title: 'Logiciels de comptabilité pour PME', subject: 'logiciels de comptabilité pour PME' },
  { category: 'logiciel de signature électronique', title: 'Signature électronique pour PME', subject: 'solutions de signature électronique pour PME' },
];

const ECOM: { product: string; title: string; subject: string }[] = [
  { product: 'cosmétiques solides', title: 'Marques de cosmétiques solides', subject: 'marques de cosmétiques solides' },
  { product: 'café en grains', title: 'Marques de café en grains', subject: 'marques de café en grains' },
  { product: 'matelas', title: 'Marques de matelas', subject: 'marques de matelas' },
  { product: 'baskets éco-responsables', title: 'Marques de baskets éco-responsables', subject: 'marques de baskets éco-responsables' },
  { product: 'croquettes pour chien', title: 'Marques de croquettes pour chien', subject: 'marques de croquettes pour chien' },
];

function buildCatalog(): BarometreDef[] {
  const out: BarometreDef[] = [];
  let p = 1;
  // Ordre de priorité : d'abord une ville par métier (diversité), puis les autres villes.
  for (const city of LOCAL_CITIES) {
    for (const t of LOCAL_TRADES) {
      out.push({
        slug: slugify(`${t.plural} ${city}`),
        segment: 'local',
        title: `${t.plural} à ${city}`,
        subject: `${t.plural.toLowerCase()} à ${city}`,
        trade: t.trade,
        city,
        priority: p++,
      });
    }
  }
  for (const x of PME) out.push({ slug: slugify(x.title), segment: 'pme', title: x.title, subject: x.subject, category: x.category, priority: p++ });
  for (const x of ECOM) out.push({ slug: slugify(x.title), segment: 'ecommerce', title: x.title, subject: x.subject, productCategory: x.product, priority: p++ });
  return out;
}

/** Catalogue V1 : 50 baromètres (40 locaux = 8 métiers × 5 villes, 5 PME, 5 e-commerce). */
export const CATALOG: BarometreDef[] = buildCatalog();

/* ------------------------------------------------------------------ */
/* Lancement progressif (ROI-DONNEES, 13 nov. 2026)                     */
/* ------------------------------------------------------------------ */

/**
 * Ordre de lancement : les 10 baromètres à plus fort potentiel d'abord (justification : docs/v5/progress/ROI-DONNEES.md).
 * Paris, Lyon, Marseille = les trois plus grands bassins ; dépannage urgent (plombier, serrurier, électricien) = questions
 * les plus posées aux IA et sujet repris par la presse locale ; agences immobilières et coiffeurs = beaucoup
 * d'entreprises indépendantes, cible directe de l'offre Essentiel à 29 €/mois. Hypothèse raisonnée, à confirmer par les
 * visites et inscriptions mesurées dans /admin/roi (aucun volume de recherche inventé).
 */
export const LAUNCH_ORDER: readonly string[] = [
  'plombiers-paris',
  'serruriers-paris',
  'electriciens-paris',
  'agences-immobilieres-paris',
  'coiffeurs-paris',
  'plombiers-lyon',
  'serruriers-lyon',
  'agences-immobilieres-lyon',
  'plombiers-marseille',
  'serruriers-marseille',
];

/** Nombre de baromètres mesurés par mois par défaut (lancement progressif). */
export const DEFAULT_MAX_BAROMETRES = 10;

/** BAROMETRE_MAX (1 à la taille du catalogue), défaut 10. */
export function barometreMax(env: Record<string, string | undefined> = process.env, catalog: BarometreDef[] = CATALOG): number {
  const n = Math.floor(Number(env.BAROMETRE_MAX));
  const all = catalog.filter((d) => d.active !== false).length;
  if (!Number.isFinite(n) || n < 1) return Math.min(DEFAULT_MAX_BAROMETRES, all);
  return Math.min(n, all);
}

/**
 * Baromètres mesurés chaque mois : l'ordre de lancement puis le reste du catalogue par priorité, coupé à BAROMETRE_MAX.
 * Les priorités sont renumérotées (1 = premier mesuré) pour que le plan budgétaire suive cet ordre.
 */
export function launchCatalog(env: Record<string, string | undefined> = process.env, catalog: BarometreDef[] = CATALOG): BarometreDef[] {
  const rank = (d: BarometreDef) => {
    const i = LAUNCH_ORDER.indexOf(d.slug);
    return i >= 0 ? i : LAUNCH_ORDER.length + (d.priority ?? 999);
  };
  return catalog
    .filter((d) => d.active !== false)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, barometreMax(env, catalog))
    .map((d, i) => ({ ...d, priority: i + 1 }));
}

export function getDef(slug: string, catalog: BarometreDef[] = CATALOG): BarometreDef | undefined {
  return catalog.find((d) => d.slug === slug);
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

/** Entrée moteur « sans cible » : sert aux gabarits et à l'extraction heuristique. Aucun nom d'entreprise. */
export function engineInput(def: BarometreDef): AuditInput {
  if (def.segment === 'local') return { businessName: '', trade: def.trade ?? '', city: def.city ?? '', segment: 'local' };
  if (def.segment === 'pme')
    return { businessName: '', trade: def.category ?? def.subject, city: '', segment: 'pme', category: def.category, market: 'France' };
  return {
    businessName: '',
    trade: def.productCategory ?? def.subject,
    city: '',
    segment: 'ecommerce',
    productCategories: [def.productCategory ?? def.subject],
    market: 'France',
  };
}

/** Questions du baromètre (8 à 20). Identifiants stables d'un mois à l'autre (gabarit + hachage du texte). */
export function questionsFor(def: BarometreDef): BarometreQuestion[] {
  if (def.questions?.length) {
    return def.questions.map((text) => ({ id: `Q-${shortHash(text, 6)}`, text: text.trim() }));
  }
  const n = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, def.questionCount ?? DEFAULT_QUESTIONS));
  const input = engineInput(def);
  const qs = def.segment === 'local' ? buildQueries(input, n) : def.segment === 'pme' ? buildPmeQueries(input, n) : buildEcomQueries(input, n);
  return qs.map((q) => ({ id: q.id, text: q.text, intent: q.angle ?? q.intent }));
}

export function runsFor(def: BarometreDef): number {
  return Math.min(5, Math.max(1, def.runs ?? DEFAULT_RUNS));
}

export function providersFor(def: BarometreDef, env: Record<string, string | undefined> = process.env): ProviderId[] {
  return def.providers?.length ? [...def.providers] : defaultProviders(env);
}

/** Contrôle du catalogue : renvoie la liste des problèmes (vide = valide). */
export function validateCatalog(catalog: BarometreDef[] = CATALOG): string[] {
  const errs: string[] = [];
  const seen = new Set<string>();
  for (const d of catalog) {
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)) errs.push(`${d.slug} : slug invalide`);
    if (seen.has(d.slug)) errs.push(`${d.slug} : slug en double`);
    seen.add(d.slug);
    if (d.segment === 'local' && (!d.trade || !d.city)) errs.push(`${d.slug} : métier et ville requis`);
    if (d.segment === 'pme' && !d.category) errs.push(`${d.slug} : catégorie requise`);
    if (d.segment === 'ecommerce' && !d.productCategory) errs.push(`${d.slug} : catégorie de produits requise`);
    if (isRegulatedTrade(d.trade) || isRegulatedTrade(d.category)) errs.push(`${d.slug} : profession réglementée exclue`);
    const qs = questionsFor(d);
    if (qs.length < MIN_QUESTIONS || qs.length > MAX_QUESTIONS) errs.push(`${d.slug} : ${qs.length} questions (8 à 20 attendues)`);
    if (new Set(qs.map((q) => q.text)).size !== qs.length) errs.push(`${d.slug} : questions en double`);
  }
  return errs;
}
