/**
 * Module TRACKING : agrégats journaliers de visites IA, sans IP ni identifiant.
 * Collections : `track.daily` (id `${businessId}:${YYYY-MM-DD}`), `track.pages` (même id).
 * Clés de compteur : `v.<moteur>` visites IA, `c.<moteur>` conversions, `total` visites toutes sources, `bot.<jeton>`.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { SITE_URL } from '@/lib/seo/site';
import type { AiEngine, AiTrafficDay, AiTrafficSummary } from '@/lib/engine/types-v2';
import { getDoc, incrDoc, listDocs, putDoc } from '@/lib/store';

/** Pages distinctes conservées par jour et par commerce. */
export const MAX_PAGE_KEYS = 300;

export const DEMO_TRACK_IDS = ['demo', 'demo-pme', 'demo-ecom'] as const;
export const isDemoTrackId = (id: string) => (DEMO_TRACK_IDS as readonly string[]).includes(id);

export const ENGINES: AiEngine[] = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'other_ai'];
const DAILY = 'track.daily';
const PAGES = 'track.pages';

/** Date du jour (YYYY-MM-DD) en Europe/Paris. */
export function parisDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Chemin d'arrivée nettoyé : sans query ni fragment, ≤ 120 car. */
export function cleanPath(p: string): string {
  let v = String(p || '/').split(/[?#]/)[0].slice(0, 120);
  if (!v.startsWith('/')) v = `/${v}`;
  // Caractères d'URL seulement : aucun espace ni balise (le chemin finit dans le contexte du copilote, E4).
  return v.replace(/[^A-Za-z0-9/_.~%-]/g, '').slice(0, 120) || '/';
}

export interface Hit {
  businessId: string;
  engine: AiEngine | null; // null = visite non IA (comptée dans le total uniquement)
  path: string;
  conversion?: boolean;
  /** valeur de la conversion en centimes (t.js : `repere('conversion', libellé, montantEnEuros)`), facultative */
  valueCents?: number;
  date?: string;
}

/**
 * Enregistre une page vue. Une conversion (`conversion: true`) n'incrémente que les conversions
 * du moteur (pas les visites) : elle se rattache à la même page vue, déjà comptée.
 */
export async function recordHit(h: Hit): Promise<void> {
  const date = h.date ?? parisDate();
  const id = `${h.businessId}:${date}`;
  if (h.conversion) {
    // Valeur (centimes) : `r.<moteur>` pour les IA, `xc.other` / `xr.other` pour les autres sources (lus par
    // revenueReport de src/lib/ecommerce/revenue.ts : part du CA venue des IA hors Shopify).
    const value = Number.isInteger(h.valueCents) && h.valueCents! > 0 && h.valueCents! <= 100_000_000 ? h.valueCents! : 0;
    if (h.engine) await incrDoc(DAILY, id, { [`c.${h.engine}`]: 1, ...(value ? { [`r.${h.engine}`]: value } : {}) }, h.businessId);
    else await incrDoc(DAILY, id, { 'xc.other': 1, ...(value ? { 'xr.other': value } : {}) }, h.businessId);
    return;
  }
  const deltas: Record<string, number> = { total: 1 };
  if (h.engine) deltas[`v.${h.engine}`] = 1;
  await incrDoc(DAILY, id, deltas, h.businessId);
  if (h.engine) {
    let key = `${h.engine}|${cleanPath(h.path)}`;
    const cur = await getDoc<Record<string, number>>(PAGES, id);
    // Au plus MAX_PAGE_KEYS pages distinctes par jour et par commerce ; au-delà, regroupées (M2 : le document ne grossit pas sans fin).
    if (cur && !(key in cur.data) && Object.keys(cur.data).length >= MAX_PAGE_KEYS) key = `${h.engine}|/autres-pages`;
    await incrDoc(PAGES, id, { [key]: 1 }, h.businessId);
  }
}

export async function recordBot(businessId: string, token: string, date: string = parisDate()): Promise<void> {
  await incrDoc(DAILY, `${businessId}:${date}`, { [`bot.${token}`]: 1 }, businessId);
}

/* ---------------- HMAC du endpoint robots ---------------- */

function secret(): string {
  const s = process.env.AUDIT_SIGNING_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('AUDIT_SIGNING_SECRET manquant');
  return 'dev-only-signing-secret';
}
/** Clé du plugin WordPress : HMAC-SHA256 hex de l'identifiant du commerce. */
export function botKeyFor(businessId: string): string {
  // Séparation de domaine (F1) : jamais égale à un autre HMAC du même secret (ex. jeton du plan d'action).
  return createHmac('sha256', secret()).update(`bot-relay|${businessId}`).digest('hex');
}
export function verifyBotKey(businessId: string, key: string | null | undefined): boolean {
  if (!key || !/^[0-9a-f]{64}$/i.test(key)) return false;
  try {
    return timingSafeEqual(Buffer.from(botKeyFor(businessId), 'hex'), Buffer.from(key, 'hex'));
  } catch {
    return false;
  }
}

/* ---------------- Lecture ---------------- */

type Counters = Record<string, number>;

function dayFrom(date: string, c: Counters | undefined): AiTrafficDay {
  const visits: Partial<Record<AiEngine, number>> = {};
  const conversions: Partial<Record<AiEngine, number>> = {};
  const bots: Record<string, number> = {};
  for (const [k, v] of Object.entries(c ?? {})) {
    if (k.startsWith('v.')) visits[k.slice(2) as AiEngine] = v;
    else if (k.startsWith('c.')) conversions[k.slice(2) as AiEngine] = v;
    else if (k.startsWith('bot.')) bots[k.slice(4)] = v;
  }
  const ai = Object.values(visits).reduce((a, b) => a + b, 0);
  return { date, visits, conversions, totalVisits: Math.max(c?.total ?? 0, ai), bots };
}

export function summarize(
  businessId: string,
  dates: string[],
  daily: Record<string, Counters>,
  pages: Record<string, Counters>,
  installed: boolean,
  demo: boolean,
): AiTrafficSummary {
  const days = dates.map((d) => dayFrom(d, daily[d]));
  const byEngine: Partial<Record<AiEngine, number>> = {};
  let ai = 0, total = 0, conv = 0;
  for (const d of days) {
    total += d.totalVisits;
    for (const [e, v] of Object.entries(d.visits)) {
      byEngine[e as AiEngine] = (byEngine[e as AiEngine] ?? 0) + v;
      ai += v;
    }
    conv += Object.values(d.conversions).reduce((a, b) => a + b, 0);
  }
  const agg = new Map<string, { path: string; visits: number; engine: AiEngine }>();
  for (const d of dates) {
    for (const [k, v] of Object.entries(pages[d] ?? {})) {
      const i = k.indexOf('|');
      if (i < 0) continue;
      const key = k;
      const cur = agg.get(key) ?? { path: k.slice(i + 1), visits: 0, engine: k.slice(0, i) as AiEngine };
      cur.visits += v;
      agg.set(key, cur);
    }
  }
  // une page = une ligne, avec le moteur dominant
  const byPath = new Map<string, { path: string; visits: number; engine: AiEngine; best: number }>();
  for (const r of agg.values()) {
    const cur = byPath.get(r.path) ?? { path: r.path, visits: 0, engine: r.engine, best: 0 };
    cur.visits += r.visits;
    if (r.visits > cur.best) { cur.best = r.visits; cur.engine = r.engine; }
    byPath.set(r.path, cur);
  }
  const topLandingPages = [...byPath.values()]
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
    .map(({ path, visits, engine }) => ({ path, visits, engine }));
  return {
    businessId,
    from: dates[0],
    to: dates[dates.length - 1],
    days,
    totals: { aiVisits: ai, aiShare: total > 0 ? Math.min(1, ai / total) : 0, conversions: conv, byEngine },
    topLandingPages,
    installed,
    demo,
  };
}

export async function getAiTraffic(businessId: string, days = 30, today: string = parisDate()): Promise<AiTrafficSummary> {
  const n = Math.min(Math.max(Math.floor(days) || 30, 1), 400);
  const dates = Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  const set = new Set(dates);
  const prefix = `${businessId}:`;
  const [dRows, pRows] = await Promise.all([
    listDocs<Counters>(DAILY, { businessId, limit: 800 }),
    listDocs<Counters>(PAGES, { businessId, limit: 800 }),
  ]);
  const daily: Record<string, Counters> = {};
  const pages: Record<string, Counters> = {};
  let installed = false;
  for (const r of dRows) {
    if (!r.id.startsWith(prefix)) continue;
    if ((r.data.total ?? 0) > 0) installed = true;
    const date = r.id.slice(prefix.length);
    if (set.has(date)) daily[date] = r.data;
  }
  for (const r of pRows) {
    const date = r.id.startsWith(prefix) ? r.id.slice(prefix.length) : '';
    if (set.has(date)) pages[date] = r.data;
  }
  const hasData = Object.keys(daily).length > 0;
  // Comptes démo : toujours le profil courant (jamais de données figées dans le store d'une ancienne version).
  if (isDemoTrackId(businessId)) {
    const demo = demoCounters(businessId, today, 90);
    const demoDates = dates.filter((d) => demo.daily[d]);
    return withDemoCommerce(summarize(businessId, dates, demo.daily, demo.pages, true, demoDates.length > 0));
  }
  return withDemoCommerce(summarize(businessId, dates, daily, pages, installed, isDemoTrackId(businessId)));
}

const PRODUCT_NAMES: Record<string, string> = {
  '/products/shampoing-solide-onde': 'Shampoing solide « Onde »',
  '/products/deodorant-solide-sans-bicarbonate': 'Déodorant solide sans bicarbonate',
  '/products/soin-visage-solide': 'Soin visage solide',
  '/collections/shampoings-solides': 'Collection shampoings solides',
};
const PRODUCT_PRICE: Record<string, number> = {
  '/products/shampoing-solide-onde': 12.9,
  '/products/deodorant-solide-sans-bicarbonate': 9.9,
  '/products/soin-visage-solide': 18.9,
  '/collections/shampoings-solides': 12.9,
};

/**
 * Démo e-commerce : commandes et CA attribués aux IA, DÉRIVÉS des conversions mesurées (une conversion = une commande),
 * panier = prix du produit d'arrivée × 2 à 3 articles (déterministe). Jamais de chiffre hors des compteurs.
 */
export function withDemoCommerce(s: AiTrafficSummary): AiTrafficSummary {
  if (s.businessId !== 'demo-ecom' || !s.demo) return s;
  const orders = s.totals.conversions;
  const pages = s.topLandingPages.filter((p) => p.path in PRODUCT_PRICE);
  const pageVisits = pages.reduce((a, p) => a + p.visits, 0) || 1;
  let left = orders;
  const products = pages.map((p, i) => {
    const o = i === pages.length - 1 ? left : Math.min(left, Math.round((orders * p.visits) / pageVisits));
    left -= o;
    const basket = PRODUCT_PRICE[p.path] * (2 + (hash32(p.path) % 2));
    return { path: p.path, name: PRODUCT_NAMES[p.path] ?? p.path, visits: p.visits, orders: o, revenueEur: Math.round(o * basket * 100) / 100 };
  });
  const revenueEur = Math.round(products.reduce((a, p) => a + p.revenueEur, 0) * 100) / 100;
  const byEngine: NonNullable<AiTrafficSummary['commerce']>['byEngine'] = {};
  // Commandes entières au plus fort reste (somme = total) ; le CA suit les commandes (aucun CA sans commande),
  // le dernier moteur doté de commandes absorbe l'arrondi (somme des CA = total).
  const engines = Object.entries(s.totals.byEngine).filter(([, v]) => (v ?? 0) > 0) as [AiEngine, number][];
  const engineVisits = engines.reduce((a, [, v]) => a + v, 0) || 1;
  const quotas = engines.map(([, v]) => (orders * v) / engineVisits);
  const alloc = quotas.map(Math.floor);
  let rest = orders - alloc.reduce((a, b) => a + b, 0);
  const byRemainder = quotas.map((q, i) => ({ i, r: q - Math.floor(q) })).sort((x, y) => y.r - x.r || x.i - y.i);
  for (let k = 0; rest > 0 && byRemainder.length; k = (k + 1) % byRemainder.length, rest--) alloc[byRemainder[k].i]++;
  const lastWithOrders = alloc.reduce((acc, o, i) => (o > 0 ? i : acc), -1);
  let rLeft = revenueEur;
  engines.forEach(([e], i) => {
    const o = alloc[i];
    const r = o === 0 ? 0 : i === lastWithOrders ? Math.round(rLeft * 100) / 100 : Math.round(((revenueEur * o) / Math.max(1, orders)) * 100) / 100;
    rLeft -= r;
    byEngine[e] = { orders: o, revenueEur: r };
  });
  return { ...s, commerce: { source: 'demo', orders, revenueEur, byEngine, products } };
}

/* ---------------- Démo ---------------- */

function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROFILES: Record<string, { base: number; share: number; pages: string[]; convRate: number; botBase: number }> = {
  demo: { base: 60, share: 0.04, pages: ['/', '/depannage-urgence', '/tarifs', '/contact', '/fuite-eau-paris-11'], convRate: 0.09, botBase: 3 },
  'demo-pme': { base: 420, share: 0.06, pages: ['/', '/logiciel-paie-pme', '/tarifs', '/comparatif-logiciels-paie', '/demo', '/blog/dsn-guide'], convRate: 0.05, botBase: 9 },
  // Maison Sora : 10ᵉ sur 10 marques citées → trafic IA modeste (≈ 150 visites par mois), mais qui convertit.
  'demo-ecom': { base: 900, share: 0.0062, pages: ['/products/shampoing-solide-onde', '/', '/products/deodorant-solide-sans-bicarbonate', '/collections/shampoings-solides', '/products/soin-visage-solide', '/pages/livraison'], convRate: 0.055, botBase: 7 },
};
const SHARES: [AiEngine, number][] = [['chatgpt', 0.62], ['perplexity', 0.17], ['gemini', 0.08], ['copilot', 0.06], ['claude', 0.05], ['other_ai', 0.02]];
const BOT_MIX: [string, number][] = [['GPTBot', 0.3], ['OAI-SearchBot', 0.22], ['ChatGPT-User', 0.2], ['PerplexityBot', 0.14], ['ClaudeBot', 0.09], ['Claude-SearchBot', 0.05]];

function demoCounters(businessId: string, today: string, n: number) {
  const p = PROFILES[businessId] ?? PROFILES.demo;
  const daily: Record<string, Counters> = {};
  const pages: Record<string, Counters> = {};
  for (let i = 0; i < n; i++) {
    const date = addDays(today, i - n + 1);
    const r = rng(hash32(`${businessId}:${date}`));
    const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
    const weekend = wd === 0 || wd === 6 ? 0.55 : 1;
    const growth = 0.3 + 1.7 * (i / (n - 1)) ** 1.3; // tendance croissante, x~6 sur 90 j
    const total = Math.round(p.base * weekend * (0.9 + r() * 0.25) * (0.8 + 0.2 * growth));
    const aiTotal = Math.round(p.base * p.share * 1.0 * weekend * growth * (0.8 + r() * 0.4));
    const c: Counters = { total: Math.max(total, aiTotal + 1) };
    const pg: Counters = {};
    let left = aiTotal;
    SHARES.forEach(([e, s], idx) => {
      const v = idx === SHARES.length - 1 ? left : Math.min(left, Math.round(aiTotal * s * (0.85 + r() * 0.3)));
      left -= v;
      if (v <= 0) return;
      c[`v.${e}`] = v;
      // arrondi probabiliste : de petits volumes produisent quand même quelques conversions (appels, commandes)
      const conv = Math.floor(v * p.convRate * (0.6 + r() * 0.8) + r());
      if (conv > 0) c[`c.${e}`] = conv;
      for (let k = 0; k < v; k++) {
        const path = p.pages[Math.min(p.pages.length - 1, Math.floor(r() ** 1.6 * p.pages.length))];
        pg[`${e}|${path}`] = (pg[`${e}|${path}`] ?? 0) + 1;
      }
    });
    const botTotal = Math.round(p.botBase * (0.7 + 0.6 * growth) * (0.7 + r() * 0.6));
    for (const [b, s] of BOT_MIX) {
      const v = Math.round(botTotal * s * (0.7 + r() * 0.6));
      if (v > 0) c[`bot.${b}`] = v;
    }
    daily[date] = c;
    pages[date] = pg;
  }
  return { daily, pages };
}

/** Écrit 90 jours de données démo réalistes dans le store (idempotent : remplace). */
export async function seedDemoTraffic(businessId: string): Promise<void> {
  const { daily, pages } = demoCounters(businessId, parisDate(), 90);
  for (const [date, c] of Object.entries(daily)) {
    await putDoc(DAILY, `${businessId}:${date}`, c, businessId);
    await putDoc(PAGES, `${businessId}:${date}`, pages[date], businessId);
  }
}

/** HTML à coller dans le <head> du site. */
export function snippetFor(businessId: string): string {
  const base = SITE_URL;
  // Appels et e-mails : un clic sur un lien tel: ou mailto: compte comme une conversion (« Appels déclenchés »).
  const calls =
    `<script>document.addEventListener("click",function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href^="tel:"],a[href^="mailto:"]');` +
    `if(a&&window.repere)window.repere("conversion",a.protocol==="tel:"?"appel":"email")},true)</script>`;
  return `<script async src="${base}/t.js" data-site="${businessId}"></script>\n${calls}`;
}

