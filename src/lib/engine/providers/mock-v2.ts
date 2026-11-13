/**
 * Mock V2 : réponses de démonstration pour les 3 parcours (local, PME, e-commerce), avec sources structurées
 * réalistes, réponses aux requêtes de marque et UNE affirmation fausse de démonstration (alerte « hallucination »).
 * Synchrone, déterministe, aucun réseau. Les concurrents PME / e-commerce générés sont fictifs ;
 * seuls les concurrents déclarés par le client (knownCompetitors) sont repris tels quels.
 */
import { zoneInfo, resolveTrade } from '../queries';
import { isBrandQuery, segmentOf } from '../queries-v2';
import type { AuditInput, ProviderId, QuerySpec, RawSource } from '../types';
import type { BrandFactField, BrandFacts, Segment } from '../types-v2';
import { capitalize, hash32, seededRandom, stripAccents } from '../util';
import type { AskContext, AskResult, EngineProvider } from './http';
import { capLeader, competitorPool, mockAnswer } from './mock';

type Rng = () => number;
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];

function slug(s: string): string {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function siteOf(input: AuditInput): string {
  const w = (input.website ?? '').trim();
  if (w) return /^https?:\/\//.test(w) ? w : `https://${w}`;
  return `https://www.${slug(input.businessName)}.fr/`;
}

function bareDomain(input: AuditInput): string {
  return siteOf(input).replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

/* ------------------------------------------------------------------ */
/* Fiche de vérité de démonstration                                    */
/* ------------------------------------------------------------------ */

/** Fiches de vérité des comptes démo : SOURCE UNIQUE (src/lib/demo-v2.ts les lit via createMockFacts). */
const KNOWN_FACTS: Record<string, Partial<Record<BrandFactField, string>>> = {
  'plomberie martin': {
    adresse: '12 rue Oberkampf, 75011 Paris',
    telephone: '01 43 55 12 34',
    horaires: 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h ; urgences 7 j/7',
    prix: 'Déplacement 49 € ; intervention à partir de 89 € TTC ; devis gratuit',
    zone: 'Paris 11e, 10e, 12e et 20e',
    services: 'Dépannage de fuite, débouchage, remplacement de chauffe-eau, rénovation de salle de bains',
    dirigeant: 'Julien Martin',
    creation: '2009',
    site: 'plomberie-martin.fr',
    statut: 'ouvert',
  },
  paysia: {
    site: 'paysia.fr',
    adresse: '48 rue de la Chaussée-d’Antin, 75009 Paris',
    prix: 'À partir de 8 € HT par bulletin et par mois, sans frais de mise en place',
    services: 'Paie, DSN, gestion des absences et congés, notes de frais, portail salarié',
    clients: 'PME de 10 à 250 salariés ; 1 200 entreprises clientes',
    zone: 'France entière',
    dirigeant: 'Claire Dubois',
    creation: '2018',
    statut: 'en activité',
  },
  'maison sora': {
    site: 'maison-sora.fr',
    produits: 'Shampoings, après-shampoings, déodorants et soins visage solides, sans emballage plastique',
    prix: 'Shampoing solide 12,90 € ; déodorant solide 9,90 €',
    livraison: 'France et Belgique ; offerte dès 39 € ; expédition sous 48 h',
    retours: 'Retours gratuits sous 30 jours, produit non entamé',
    ingredients: 'Ingrédients d’origine naturelle, sans sulfates ni silicones ; liste INCI complète sur chaque fiche produit',
    certifications: 'Cosmos Organic (Ecocert) ; vegan',
    adresse: '7 rue Burdeau, 69001 Lyon (atelier, pas de boutique)',
    creation: '2020',
    dirigeant: 'Inès Morel',
    statut: 'en activité',
  },
};

/** Champ volontairement faux dans la démo, par parcours. */
export const DEMO_ERROR_FIELD: Record<Segment, BrandFactField> = { local: 'horaires', pme: 'prix', ecommerce: 'livraison' };
/** IA qui « se trompe » dans la démo. */
export const DEMO_ERROR_PROVIDER: ProviderId = 'gemini';

const STREETS = ['rue Oberkampf', 'rue de Charonne', 'boulevard Voltaire', 'avenue Parmentier', 'rue de la Roquette', 'rue du Faubourg-Saint-Antoine'];
const FIRST = ['Julien', 'Claire', 'Inès', 'Thomas', 'Sophie', 'Karim', 'Léa', 'Antoine'];
const LAST = ['Martin', 'Dubois', 'Morel', 'Lefèvre', 'Garnier', 'Roussel', 'Faure', 'Henry'];

/** Fiche de vérité de démonstration, cohérente avec les réponses mock (indépendante de la graine d'audit). */
export function createMockFacts(input: AuditInput, businessId = 'demo'): BrandFacts {
  const seg = segmentOf(input);
  const known = KNOWN_FACTS[stripAccents(input.businessName).toLowerCase().trim()];
  if (known) return { businessId, facts: { ...known }, updatedAt: '2026-11-01T08:00:00.000Z' };
  const r = seededRandom(`facts|${input.businessName}|${input.trade}`);
  const z = zoneInfo(input);
  const num = 2 + Math.floor(r() * 90);
  const cp = z.cp ?? (z.city.toLowerCase() === 'lyon' ? '69001' : z.city.toLowerCase() === 'paris' || !z.city ? '75011' : '75011');
  const city = z.city || 'Paris';
  const tel = `0${seg === 'local' ? 1 : 9} ${[0, 1, 2, 3].map(() => String(10 + Math.floor(r() * 89))).join(' ')}`;
  const dir = `${pick(r, FIRST)} ${pick(r, LAST)}`;
  const year = String(2008 + Math.floor(r() * 15));
  const facts: Partial<Record<BrandFactField, string>> = { site: bareDomain(input), dirigeant: dir, creation: year, statut: 'en activité' };
  if (seg === 'local') {
    const t = resolveTrade(input.trade);
    Object.assign(facts, {
      adresse: `${num} ${pick(r, STREETS)}, ${cp} ${city}`,
      telephone: tel,
      horaires: 'Du lundi au vendredi 8 h – 19 h, samedi 9 h – 13 h',
      services: t.services.map((s) => s.replace(/^(la|le|les|l['’])\s?/i, '')).join(', ') || t.activity,
      zone: z.zone,
    });
  } else if (seg === 'pme') {
    Object.assign(facts, {
      adresse: `${num} rue de la Chaussée-d’Antin, 75009 Paris`,
      prix: `À partir de ${8 + Math.floor(r() * 8)} € HT par utilisateur et par mois`,
      services: input.offering || input.category || input.trade,
      zone: input.market || 'France entière',
    });
  } else {
    // Une marque en ligne sans ville déclarée (« France ») n'a pas d'adresse inventée.
    const realTown = city && !/^(france|belgique|suisse|europe|france enti[eè]re)$/i.test(city.trim());
    Object.assign(facts, {
      ...(realTown ? { adresse: `${num} rue Burdeau, ${cp === '75011' ? '69001' : cp} ${city === 'Paris' ? 'Lyon' : city}` } : {}),
      prix: `À partir de ${10 + Math.floor(r() * 10)},90 €`,
      livraison: 'France et Belgique ; offerte dès 39 € ; expédition sous 48 h',
      produits: (input.productCategories ?? []).join(', ') || input.category || input.trade,
    });
  }
  return { businessId, facts, updatedAt: '2026-11-01T08:00:00.000Z' };
}

/** Valeur fausse de démonstration pour un champ. */
export function wrongValue(field: BrandFactField, expected: string): string {
  if (field === 'horaires') return 'du lundi au samedi de 8h à 20h';
  if (field === 'prix') {
    const m = /(\d+(?:[,.]\d+)?)\s?€/.exec(expected);
    const p = m ? Number(m[1].replace(',', '.')) : 10;
    return `environ ${Math.round(p * 1.9)} € par mois`;
  }
  if (field === 'adresse') {
    const cp = /\b(\d{5})\b/.exec(expected)?.[1] ?? '75011';
    const city = /\d{5}\s+([^,;]+)/.exec(expected)?.[1]?.trim() ?? 'Paris';
    const cp2 = cp.slice(0, 4) + String((Number(cp[4]) + 1) % 10);
    return `15 rue de la République, ${cp2} ${city}`;
  }
  if (field === 'telephone') return '01 40 00 00 00';
  if (field === 'livraison') return 'offerte dès 60 € ; France uniquement';
  return `${expected} (information erronée)`;
}

/* ------------------------------------------------------------------ */
/* Concurrents fictifs PME / e-commerce                                */
/* ------------------------------------------------------------------ */

const PME_PREFIX = ['Nova', 'Flux', 'Kali', 'Opti', 'Brio', 'Vela', 'Lumi', 'Orsa', 'Zeni', 'Axo', 'Tera', 'Maya'];
const ECOM_BRANDS = [
  'Maison Corail', 'Atelier Brume', 'Sève & Sel', 'Rivage Solide', 'Nacre', "Les Savons d'Iris", 'Céleste Bio', 'Mira Naturel',
  'Terre d’Ocre', 'Comptoir Argile', 'Belle Racine', 'Onde Douce',
];

/**
 * Concurrents déclarés des comptes démo : fictifs (Paysia, Maison Sora). Tout autre concurrent déclaré peut être une
 * vraie marque (PayFit, Lamazuna…) : le mock le cite sans lui prêter de description.
 */
export const DEMO_FICTIONAL_BRANDS: readonly string[] = ['Paylo', 'Netpaie', 'Salaria', 'Clairpaie', 'Savonnerie Alba', 'Pain de Lune', 'Atelier Brume'];

/** Vrai si le nom vient des viviers fictifs (générés ou démo), faux pour un concurrent déclaré par un vrai client. */
export function isFictionalBrand(name: string, input: AuditInput): boolean {
  const k = stripAccents(name).toLowerCase();
  const declared = (input.knownCompetitors ?? []).some((c) => stripAccents(c).toLowerCase() === k);
  if (!declared) return true;
  return DEMO_FICTIONAL_BRANDS.some((b) => stripAccents(b).toLowerCase() === k);
}

function pmeRoot(cat: string): { root: string; glue: boolean } {
  const c = stripAccents(cat).toLowerCase();
  if (/paie|payroll|bulletin/.test(c)) return { root: 'paie', glue: true };
  if (/\brh\b|sirh|ressources humaines/.test(c)) return { root: 'RH', glue: false };
  if (/crm/.test(c)) return { root: 'CRM', glue: false };
  if (/compta|expert/.test(c)) return { root: 'compta', glue: true };
  if (/recrut|chasse/.test(c)) return { root: 'Talents', glue: false };
  if (/formation|ecole/.test(c)) return { root: 'Campus', glue: false };
  if (/factur/.test(c)) return { root: 'factur', glue: true };
  if (/conseil|cabinet|strategie/.test(c)) return { root: 'Partners', glue: false };
  return { root: 'soft', glue: true };
}

export function segmentCompetitorPool(input: AuditInput, seed: string): string[] {
  const seg = segmentOf(input);
  if (seg === 'local') return competitorPool(input, seed);
  const r = seededRandom(`pool2|${seed}|${seg}|${input.category ?? ''}|${input.productCategories?.[0] ?? ''}|${input.trade}`);
  const target = stripAccents(input.businessName).toLowerCase();
  const out: string[] = [...(input.knownCompetitors ?? []).filter(Boolean)];
  const add = (n: string) => {
    const k = stripAccents(n).toLowerCase();
    if (!out.some((o) => stripAccents(o).toLowerCase() === k) && !k.includes(target) && !target.includes(k)) out.push(n);
  };
  if (seg === 'pme') {
    const { root, glue } = pmeRoot(input.category || input.trade);
    const prefixes = [...PME_PREFIX].sort(() => r() - 0.5);
    for (const p of prefixes) {
      if (out.length >= 9) break;
      add(glue ? `${p}${root}` : `${p} ${root}`);
    }
  } else {
    const brands = [...ECOM_BRANDS].sort(() => r() - 0.5);
    for (const b of brands) {
      if (out.length >= 9) break;
      add(b);
    }
  }
  return out.slice(0, 9);
}

function visibility(input: AuditInput, seed: string, provider: ProviderId): number {
  const base = seededRandom(`vis2|${seed}|${input.businessName}`)();
  const p = 0.08 + 0.5 * Math.pow(base, 1.1);
  const mod = 0.55 + 0.9 * seededRandom(`vis2|${seed}|${input.businessName}|${provider}`)();
  return Math.min(0.8, p * mod);
}

/* ------------------------------------------------------------------ */
/* Pools de sources                                                    */
/* ------------------------------------------------------------------ */

interface SrcTpl {
  domain: string;
  w: number;
  path: (c: string) => string;
  title: (c: string, zone: string) => string;
}

const LOCAL_SOURCES: SrcTpl[] = [
  { domain: 'leparisien.fr', w: 2, path: (c) => `/guide-shopping/meilleurs-${c}-2026`, title: (c, z) => `Les ${c} les mieux notés à ${z} – Le Parisien` },
  { domain: 'actu.fr', w: 2, path: (c) => `/ile-de-france/paris/${c}-recommandes`, title: (c, z) => `${capitalize(c)} : les adresses recommandées à ${z} – Actu.fr` },
  { domain: 'reddit.com', w: 1.5, path: (c) => `/r/paris/comments/x1/${c}_de_confiance`, title: (c) => `Un ${c} de confiance ? : r/paris` },
  { domain: 'justacote.com', w: 1, path: (c) => `/paris-75/${c}`, title: (c, z) => `${capitalize(c)} ${z} – Justacôté` },
  { domain: 'houzz.fr', w: 0.8, path: (c) => `/professionnels/${c}/paris`, title: (c) => `Les meilleurs ${c} – Houzz` },
  { domain: 'yelp.fr', w: 0.8, path: (c) => `/search?find_desc=${c}&find_loc=Paris`, title: (c, z) => `Top 10 ${c} à ${z} – Yelp` },
  { domain: 'tripadvisor.fr', w: 0.6, path: (c) => `/Restaurants-${c}`, title: (c, z) => `${capitalize(c)} à ${z} – Tripadvisor` },
];

const PME_SOURCES: SrcTpl[] = [
  { domain: 'g2.com', w: 3, path: (c) => `/categories/${c}`, title: (c) => `Meilleurs ${c} en 2026 – G2` },
  { domain: 'capterra.fr', w: 3, path: (c) => `/directory/${c}`, title: (c) => `Comparatif ${c} 2026 – Capterra France` },
  { domain: 'appvizer.fr', w: 2.5, path: (c) => `/${c}`, title: (c) => `Top 10 ${c} : comparatif – Appvizer` },
  { domain: 'reddit.com', w: 1.5, path: (c) => `/r/france/comments/x2/quel_${c}_utilisez_vous`, title: (c) => `Quel ${c} utilisez-vous ? : r/entrepreneur` },
  { domain: 'journaldunet.com', w: 1.5, path: (c) => `/solutions/${c}-comparatif`, title: (c) => `${capitalize(c)} : le comparatif du JDN` },
  { domain: 'trustpilot.com', w: 1.2, path: (c) => `/categories/${c}`, title: (c) => `Meilleurs ${c} – avis Trustpilot` },
  { domain: 'getapp.fr', w: 1, path: (c) => `/directory/${c}`, title: (c) => `${capitalize(c)} – GetApp France` },
  { domain: 'lesechos.fr', w: 0.8, path: (c) => `/tech-medias/${c}-pme`, title: (c) => `PME : comment choisir son ${c} – Les Échos` },
  { domain: 'linkedin.com', w: 0.8, path: (c) => `/pulse/${c}-retour-experience`, title: (c) => `${capitalize(c)} : retour d'expérience – LinkedIn` },
  { domain: 'blogdumoderateur.com', w: 0.6, path: (c) => `/outils-${c}`, title: (c) => `Les meilleurs outils de ${c} – BDM` },
];

const BEAUTY_SOURCES: SrcTpl[] = [
  { domain: 'beautetest.com', w: 2.5, path: (c) => `/produits/${c}`, title: (c) => `${capitalize(c)} : avis et tests – Beauté Test` },
  { domain: 'marieclaire.fr', w: 2, path: (c) => `/beaute/meilleurs-${c}`, title: (c) => `Les meilleurs ${c} testés par la rédaction – Marie Claire` },
  { domain: 'reddit.com', w: 1.8, path: (c) => `/r/BeauteFrance/comments/x3/${c}`, title: (c) => `Vos ${c} préférés ? : r/BeauteFrance` },
  { domain: 'incibeauty.fr', w: 1.5, path: (c) => `/recherche/${c}`, title: (c) => `${capitalize(c)} : composition – INCI Beauty` },
  { domain: 'trustpilot.com', w: 1.4, path: (c) => `/categories/${c}`, title: (c) => `Meilleures marques de ${c} – Trustpilot` },
  { domain: 'amazon.fr', w: 1.2, path: (c) => `/s?k=${c}`, title: (c) => `Amazon.fr : ${c}` },
  { domain: 'elle.fr', w: 1, path: (c) => `/Beaute/${c}-bio`, title: (c) => `${capitalize(c)} : notre sélection – ELLE` },
  { domain: 'forum.doctissimo.fr', w: 0.8, path: (c) => `/beaute/${c}/sujet_1.htm`, title: (c) => `${capitalize(c)}, vos avis ? – Doctissimo` },
  { domain: 'sephora.fr', w: 0.8, path: (c) => `/shop/${c}`, title: (c) => `${capitalize(c)} – Sephora` },
];

const FOOD_SOURCES: SrcTpl[] = [
  { domain: 'marmiton.org', w: 2.5, path: (c) => `/magazine/${c}-meilleures-marques`, title: (c) => `${capitalize(c)} : les marques préférées des lecteurs – Marmiton` },
  { domain: '750g.com', w: 1.5, path: (c) => `/${c}-comparatif`, title: (c) => `${capitalize(c)} : notre comparatif – 750g` },
  { domain: 'reddit.com', w: 1.5, path: (c) => `/r/france/comments/x4/${c}`, title: (c) => `Où acheter du bon ${c} ? : r/france` },
  { domain: 'quechoisir.org', w: 1.5, path: (c) => `/comparatif-${c}`, title: (c) => `Comparatif ${c} – UFC-Que Choisir` },
  { domain: 'trustpilot.com', w: 1.2, path: (c) => `/categories/${c}`, title: (c) => `Meilleures boutiques de ${c} – Trustpilot` },
  { domain: 'amazon.fr', w: 1, path: (c) => `/s?k=${c}`, title: (c) => `Amazon.fr : ${c}` },
  { domain: 'lefooding.com', w: 0.8, path: (c) => `/${c}-adresses`, title: (c) => `${capitalize(c)} : nos adresses – Le Fooding` },
];

const GOODS_SOURCES: SrcTpl[] = [
  { domain: 'lesnumeriques.com', w: 2, path: (c) => `/guide-achat/meilleur-${c}`, title: (c) => `Quel ${c} choisir en 2026 ? – Les Numériques` },
  { domain: 'quechoisir.org', w: 2, path: (c) => `/comparatif-${c}`, title: (c) => `Comparatif ${c} – UFC-Que Choisir` },
  { domain: 'reddit.com', w: 1.5, path: (c) => `/r/france/comments/x5/${c}`, title: (c) => `${capitalize(c)} : vos recommandations ? : r/france` },
  { domain: 'amazon.fr', w: 1.5, path: (c) => `/s?k=${c}`, title: (c) => `Amazon.fr : ${c}` },
  { domain: 'trustpilot.com', w: 1.2, path: (c) => `/categories/${c}`, title: (c) => `Meilleures marques de ${c} – Trustpilot` },
  { domain: 'idealo.fr', w: 1, path: (c) => `/prechcat.html?q=${c}`, title: (c) => `${capitalize(c)} : comparer les prix – idealo` },
  { domain: 'youtube.com', w: 0.8, path: (c) => `/watch?v=${c.slice(0, 11)}`, title: (c) => `Test ${c} : le comparatif – YouTube` },
];

function ecomPool(input: AuditInput): SrcTpl[] {
  const c = stripAccents(`${input.productCategories?.join(' ') ?? ''} ${input.category ?? ''} ${input.trade}`).toLowerCase();
  if (/creme|shampo|serum|cosmet|savon|soin|deodorant|maquill|beaute|parfum/.test(c)) return BEAUTY_SOURCES;
  if (/cafe|the |huile|granola|chocolat|vin|epicerie|terroir|miel|biscuit|apero/.test(c)) return FOOD_SOURCES;
  return GOODS_SOURCES;
}

/** Sources où la démo montre un écart (concurrents présents, client absent). */
const GAP_SHOWCASE = new Set(['pagesjaunes.fr', 'g2.com', 'capterra.fr', 'beautetest.com', 'marmiton.org', 'lesnumeriques.com']);

/** Le client figure-t-il (parfois) sur ce domaine dans la démo ? Déterministe par (client, domaine). */
function clientOn(input: AuditInput, domain: string): boolean {
  return !GAP_SHOWCASE.has(domain) && seededRandom(`on|${input.businessName}|${domain}`)() < 0.45;
}

function weightedPick<T extends { w: number }>(r: Rng, xs: T[], k: number): T[] {
  const avail = [...xs];
  const out: T[] = [];
  while (out.length < k && avail.length) {
    const tot = avail.reduce((a, b) => a + b.w, 0);
    let x = r() * tot;
    let i = 0;
    for (; i < avail.length - 1; i++) {
      x -= avail[i].w;
      if (x <= 0) break;
    }
    out.push(avail[i]);
    avail.splice(i, 1);
  }
  return out;
}

/** Sources structurées réalistes pour une réponse de recommandation (titres et extraits nommant des acteurs). */
function recoSources(
  r: Rng,
  pool: SrcTpl[],
  catLabel: string,
  zone: string,
  text: string,
  names: string[],
  client: string,
  clientMentioned: boolean,
  input: AuditInput,
): RawSource[] {
  const cs = slug(catLabel);
  const k = 3 + Math.floor(r() * 3);
  const chosen = weightedPick(r, pool, k);
  const comps = names.filter((n) => n !== client);
  const out: RawSource[] = chosen.map((t) => {
    const listed = comps.filter(() => r() < 0.55).slice(0, 3);
    if (!listed.length && comps.length) listed.push(comps[0]);
    if (clientMentioned && clientOn(input, t.domain) && r() < 0.5) listed.push(client);
    const first = listed.find((n) => text.includes(n));
    return {
      url: `https://www.${t.domain}${t.path(cs)}`.replace('www.forum.', 'forum.'),
      title: t.title(catLabel, zone),
      snippet: listed.length ? `… ${listed.join(', ')} figurent parmi les choix les plus cités par les utilisateurs …` : undefined,
      kind: 'cited',
      startIndex: first ? Math.max(0, text.indexOf(first)) : undefined,
    };
  });
  if (comps[0] && r() < 0.45) {
    out.push({ url: `https://www.${slug(comps[0])}.fr/`, title: `${comps[0]} – site officiel`, kind: 'cited', startIndex: Math.max(0, text.indexOf(comps[0])) });
  }
  if (clientMentioned && r() < 0.5) out.push({ url: siteOf(input), title: `${client} – site officiel`, kind: 'cited', startIndex: Math.max(0, text.indexOf(client)) });
  return out.map((s, i) => ({ ...s, order: i + 1 }));
}

/* ------------------------------------------------------------------ */
/* Réponses de marque                                                  */
/* ------------------------------------------------------------------ */

const OPINION: Record<Segment, { pos: string[]; neu: string[]; neg: string[] }> = {
  local: {
    pos: ['Les avis Google soulignent sa réactivité et ses devis clairs.', 'Les clients le décrivent comme un artisan sérieux et soigneux.'],
    neu: ["C'est une entreprise indépendante du quartier."],
    neg: ["Quelques clients mentionnent des délais d'intervention plus longs le week-end."],
  },
  pme: {
    pos: [
      "Les retours d'utilisateurs saluent une interface simple et un support réactif.",
      'La solution est appréciée des PME pour sa conformité DSN et son accompagnement à la mise en place.',
    ],
    neu: ["C'est un acteur plus récent que les leaders historiques du marché."],
    neg: ['Quelques utilisateurs regrettent des fonctionnalités encore limitées pour les grandes structures.'],
  },
  ecommerce: {
    pos: ['Les avis clients saluent la qualité des produits et les parfums naturels.', 'La marque est appréciée pour ses emballages zéro déchet et sa fabrication française.'],
    neu: ["C'est une marque encore jeune, surtout vendue en ligne."],
    neg: ['Certains clients trouvent les prix un peu élevés par rapport aux marques de grande distribution.'],
  },
};

function factSentence(field: BrandFactField, value: string, name: string): string {
  const v = value.trim();
  const low = v.charAt(0).toLowerCase() + v.slice(1);
  switch (field) {
    case 'adresse':
      return `L'adresse indiquée pour ${name} est ${v}.`;
    case 'telephone':
      return `On peut joindre l'entreprise au ${v}.`;
    case 'horaires':
      return `Horaires : ${low}.`;
    case 'prix':
      return `Côté tarifs : ${low}.`;
    case 'creation':
      return `L'entreprise a été créée en ${v}.`;
    case 'dirigeant':
      return `Elle est dirigée par ${v}.`;
    case 'livraison':
      return `Livraison : ${v}.`;
    case 'site':
      return `Site officiel : ${v}.`;
    default:
      return '';
  }
}

function brandAnswer(input: AuditInput, provider: ProviderId, query: QuerySpec, run: number, seed: string): AskResult {
  const seg = segmentOf(input);
  const angle = query.angle ?? (/^B1/.test(query.id) ? 'brand_opinion' : /^B2/.test(query.id) ? 'brand_trust' : 'brand_facts');
  const q = { ...query, angle };
  const name = input.businessName.trim();
  const facts = createMockFacts(input).facts;
  const r = seededRandom(`brand|${seed}|${provider}|${q.id}|${run}`);
  const op = OPINION[seg];
  const errField = DEMO_ERROR_FIELD[seg];
  const fields: BrandFactField[] =
    q.angle === 'brand_opinion'
      ? ['creation', 'dirigeant', 'prix']
      : q.angle === 'brand_trust'
        ? ['site', 'adresse', 'livraison', 'telephone', 'horaires']
        : ['adresse', 'telephone', 'horaires', 'prix', 'livraison'];
  if (!fields.includes(errField) && provider === DEMO_ERROR_PROVIDER) fields.push(errField);
  const sentences: string[] = [];
  if (q.angle === 'brand_facts') sentences.push(`Voici les informations publiques sur ${name} :`);
  else sentences.push(`${name} est ${seg === 'ecommerce' ? 'une marque française' : seg === 'pme' ? 'un éditeur français' : 'une entreprise'} de ${input.category || input.productCategories?.[0] || input.trade}. ${pick(r, op.pos)}`);
  if (q.angle !== 'brand_facts') sentences.push(r() < 0.5 ? pick(r, op.neu) : pick(r, op.neg));
  for (const f of fields) {
    const v = facts[f];
    if (!v) continue;
    const value = f === errField && provider === DEMO_ERROR_PROVIDER ? wrongValue(f, v) : v;
    const s = factSentence(f, value, name);
    if (s) sentences.push(s);
  }
  if (q.angle === 'brand_trust') sentences.push(`Dans l'ensemble, ${name} paraît fiable, mais vérifiez les avis récents avant de vous engager.`);
  const text = sentences.join(' ');
  const site = siteOf(input);
  const dom = bareDomain(input);
  const sources: RawSource[] =
    provider === 'gemini'
      ? []
      : [
          { url: site, title: `${name} – site officiel`, kind: 'cited', order: 1, startIndex: 0 },
          { url: `https://fr.trustpilot.com/review/${dom}`, title: `${name} : avis clients – Trustpilot`, snippet: `${name} est noté 4,4 sur 5 par ses clients.`, kind: 'cited', order: 2 },
          ...(seg === 'pme'
            ? [{ url: `https://www.capterra.fr/software/${slug(name)}`, title: `${name} : avis, prix et fonctionnalités – Capterra`, kind: 'cited' as const, order: 3 }]
            : seg === 'local'
              ? [{ url: `https://www.pagesjaunes.fr/pros/${slug(name)}`, title: `${name} – PagesJaunes`, kind: 'cited' as const, order: 3 }]
              : []),
        ];
  return { text, citations: sources.map((s) => s.url), sources };
}

/* ------------------------------------------------------------------ */
/* Réponses de recommandation                                          */
/* ------------------------------------------------------------------ */

const PME_DESCS = [
  'interface simple et support réactif',
  'très utilisé par les PME de 20 à 250 salariés',
  'tarifs transparents et sans engagement',
  'bonne intégration avec les outils comptables',
  'mises à jour légales incluses',
  'accompagnement personnalisé à la mise en place',
  'très bien noté sur G2 et Capterra',
];
const ECOM_DESCS = [
  'fabrication française et ingrédients naturels',
  'très bons avis sur la qualité',
  'emballages zéro déchet',
  'excellent rapport qualité-prix',
  'souvent citée dans les comparatifs',
  'gamme adaptée aux peaux sensibles',
  'livraison rapide',
];
const INTRO: Record<ProviderId, string> = {
  chatgpt: 'Voici les options les plus souvent recommandées',
  perplexity: "D'après les comparatifs et les avis en ligne",
  gemini: 'Plusieurs acteurs se distinguent',
  claude: 'Voici quelques pistes sérieuses',
  mistral: "D'après les résultats de recherche",
};

function segmentReco(input: AuditInput, provider: ProviderId, q: QuerySpec, run: number, seed: string): AskResult {
  const seg = segmentOf(input);
  const pool = segmentCompetitorPool(input, seed);
  const key = `${seed}|${provider}|${q.id}`;
  const rq = seededRandom(key);
  const rr = seededRandom(`${key}|run${run}`);
  const p = visibility(input, seed, provider);
  let u = rq();
  if (rr() < 0.22) u = rr();
  const mentioned = u < p;
  const count = 4 + Math.floor(rr() * 3);
  const names: string[] = [];
  const avail = pool.map((n, i) => ({ n, w: 1 / (i + 1.5) }));
  for (const x of weightedPick(rr, avail, mentioned ? count - 1 : count)) names.push(x.n);
  // Plafond de vraisemblance (D5) : le leader du vivier n'est pas cité partout.
  capLeader(names, pool, seededRandom(`lead|${key}|${run}`));
  const client = input.businessName.trim();
  if (mentioned) names.splice(Math.min(names.length, Math.floor(Math.pow(rr(), 0.8) * (names.length + 1))), 0, client);
  const descs = seg === 'pme' ? PME_DESCS : ECOM_DESCS;
  const style = provider === 'perplexity' ? 'dash' : provider === 'gemini' ? 'star' : 'numbered';
  const lines = names.map((n, i) => {
    // Un concurrent déclaré par le client peut être une vraie marque : aucune phrase ne lui est prêtée (citation neutre).
    const d = n === client ? (seg === 'pme' ? 'alternative française appréciée pour son accompagnement' : 'marque française engagée, appréciée pour ses formules') : isFictionalBrand(n, input) ? pick(rr, descs) : null;
    if (style === 'numbered') return d ? `${i + 1}. **${n}** – ${d}.` : `${i + 1}. **${n}**.`;
    if (style === 'dash') return d ? `- **${n}** : ${d}.` : `- **${n}**.`;
    return d ? `* **${n}** — ${d}.` : `* **${n}**.`;
  });
  const outro =
    seg === 'pme'
      ? 'Comparez les démonstrations et les tarifs selon votre nombre de salariés avant de choisir.'
      : 'Vérifiez la composition et les avis récents avant d’acheter.';
  const text = `${INTRO[provider]} pour « ${q.text.replace(/\s*\?$/, '')} » :\n\n${lines.join('\n')}\n\n${outro}`;
  if (provider === 'gemini') return { text, citations: [] }; // Gemini sans ancrage : aucune source
  const cat = input.category || input.productCategories?.[0] || input.trade;
  const rs = seededRandom(`src|${key}|${run}`);
  const sources = recoSources(rs, seg === 'pme' ? PME_SOURCES : ecomPool(input), cat, input.market || 'France', text, names, client, mentioned, input);
  return { text, citations: sources.map((s) => s.url), sources };
}

/** Enrichit une réponse locale V1 (texte inchangé sauf détails pratiques sur le client) avec des sources structurées. */
function localReco(input: AuditInput, provider: ProviderId, q: QuerySpec, run: number, seed: string): AskResult {
  const base = mockAnswer(input, provider, q, run, seed);
  const client = input.businessName.replace(/\b(SARL|SASU|SAS|EURL|SNC|EIRL|EI)\b\.?/g, '').replace(/\s+/g, ' ').trim();
  const rs = seededRandom(`src|${seed}|${provider}|${q.id}|${run}`);
  let text = base.text;
  const mentioned = text.includes(client);
  // Détails pratiques sur le client (alimentent la vérité) ; Gemini se trompe d'horaires dans la démo.
  if (mentioned && rs() < 0.5) {
    const facts = createMockFacts(input).facts;
    const detail =
      provider === DEMO_ERROR_PROVIDER && facts.horaires
        ? `${client} est ouvert ${wrongValue('horaires', facts.horaires)}.`
        : facts.telephone
          ? `${client} est joignable au ${facts.telephone}.`
          : '';
    if (detail) text = text.replace(/\n\n([^\n]*)$/, `\n\n${detail} $1`);
  }
  if (provider === 'gemini') return { text, citations: base.citations };
  const t = resolveTrade(input.trade);
  const z = zoneInfo(input);
  const pool = competitorPool(input, seed);
  const names = [...pool.filter((n) => text.includes(n)), ...(mentioned ? [client] : [])];
  const sources: RawSource[] = base.citations.map((url, i) => {
    const listed = names.filter((n) => n !== client && rs() < 0.5).slice(0, 3);
    const isPj = url.includes('pagesjaunes');
    const isMaps = url.includes('google.com/maps');
    // Une entreprise installée a (presque toujours) une fiche Google : présente, même incomplète.
    if (isMaps && mentioned) listed.push(client);
    const own = !isPj && !isMaps ? names.find((n) => url.includes(slug(n))) : undefined;
    return {
      url,
      title: isPj ? `${capitalize(t.plural)} à ${z.zone} – PagesJaunes` : isMaps ? `${capitalize(t.label)} ${z.zone} – Google Maps` : own ? `${own} – ${t.label} à ${z.city}` : undefined,
      snippet: (isPj || isMaps) && listed.length ? `${listed.join(', ')} …` : undefined,
      kind: 'cited',
      order: i + 1,
      startIndex: own ? Math.max(0, text.indexOf(own)) : undefined,
    };
  });
  const extra = weightedPick(rs, t.family === 'restauration' ? LOCAL_SOURCES : LOCAL_SOURCES.filter((s) => s.domain !== 'tripadvisor.fr'), 1 + Math.floor(rs() * 2));
  for (const e of extra) {
    const listed = names.filter((n) => n !== client && rs() < 0.6).slice(0, 3);
    if (mentioned && clientOn(input, e.domain) && rs() < 0.5) listed.push(client);
    const first = listed.find((n) => text.includes(n));
    sources.push({
      url: `https://www.${e.domain}${e.path(slug(t.plural))}`,
      title: e.title(t.plural, z.zone),
      snippet: listed.length ? `… ${listed.join(', ')} …` : undefined,
      kind: 'cited',
      order: sources.length + 1,
      startIndex: first ? Math.max(0, text.indexOf(first)) : undefined,
    });
  }
  return { text, citations: base.citations, sources };
}

/** Réponse mock V2 (tous parcours, requêtes de recommandation et de marque). */
export function mockAnswerV2(input: AuditInput, provider: ProviderId, q: QuerySpec, run: number, seed: string): AskResult {
  if (isBrandQuery(q)) return brandAnswer(input, provider, q, run, seed);
  const seg = segmentOf(input);
  if (seg === 'local') return localReco(input, provider, q, run, seed);
  return segmentReco(input, provider, q, run, seed);
}

/** Provider de démonstration V2 (parcours, sources structurées, requêtes de marque). */
export function createMockProviderV2(id: ProviderId, input: AuditInput, seed: string): EngineProvider {
  return {
    id,
    model: 'demo-mock',
    demo: true,
    costPerCallEur: 0,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      return mockAnswerV2(input, id, { id: ctx.queryId, text: query, intent: 'best' }, ctx.run, seed);
    },
  };
}

export function mockSeedOf(input: AuditInput): string {
  return `auditia|${hash32(`${input.businessName}|${input.trade}|${input.city}|${input.district ?? ''}`)}`;
}
