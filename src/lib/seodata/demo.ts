/**
 * Fournisseurs de DÉMONSTRATION pour les 3 comptes démo (`demo`, `demo-pme`, `demo-ecom`) — jamais pour un vrai compte.
 * Données déterministes, cohérentes avec les comptes démo existants (src/lib/demo-v2.ts : Plomberie Martin, Paysia,
 * Maison Sora ; progression lente sur 16 mois comme leurs scores IA), toujours marquées `demo: true` et
 * `provider: 'demo'`. Les concurrents sont FICTIFS (domaines réservés `.example`), aucun vrai site n'est cité.
 */
import type { DemoId } from '@/lib/demo-v2';
import { addDays, day, hostOf } from './http';
import type {
  BacklinksProvider, BingProvider, Device, GscInspection, GscQuery, GscRow, GscSitemap, GscSite, KeywordLocation, KeywordMetrics, KeywordsProvider,
  PerfData, SearchConsoleProvider, SerpProvider, SerpRequest, SerpResult,
} from './types';
import type { PerfProvider } from './perf';
import { fieldFrom } from './perf';

interface DemoKw { kw: string; volume: number; pos: number; page: string; difficulty: number }
interface DemoSpec {
  domain: string;
  site: string;
  location: string;
  competitors: string[];
  keywords: DemoKw[];
  /** clics/jour au mois le plus récent */
  dailyClicks: number;
  features: string[];
  perf: { mobile: [number, number, number, number]; desktop: [number, number, number, number] }; // perf, lcp, inp, cls×1000
  links: { backlinks: number; domains: number; rank: number };
}

export const DEMO_SPECS: Record<DemoId, DemoSpec> = {
  demo: {
    domain: 'plomberie-martin.fr',
    site: 'https://plomberie-martin.fr/',
    location: 'Paris,Ile-de-France,France',
    competitors: ['plombier-voltaire.example', 'depannage-oberkampf.example', 'artisan-plomb-paris.example', 'sos-fuites-11.example'],
    keywords: [
      { kw: 'plombier paris 11', volume: 880, pos: 4, page: '/', difficulty: 34 },
      { kw: 'plombier urgence paris 11', volume: 320, pos: 6, page: '/urgence', difficulty: 29 },
      { kw: 'recherche de fuite paris', volume: 590, pos: 12, page: '/recherche-de-fuite', difficulty: 41 },
      { kw: 'remplacement chauffe-eau paris', volume: 480, pos: 15, page: '/chauffe-eau', difficulty: 38 },
      { kw: 'débouchage canalisation paris 11', volume: 170, pos: 3, page: '/debouchage', difficulty: 22 },
      { kw: 'plombier oberkampf', volume: 90, pos: 2, page: '/', difficulty: 15 },
      { kw: 'installation salle de bain paris 11', volume: 140, pos: 18, page: '/salle-de-bain', difficulty: 31 },
      { kw: 'plombier pas cher paris', volume: 1300, pos: 27, page: '/', difficulty: 52 },
    ],
    dailyClicks: 21,
    features: ['local_pack', 'people_also_ask', 'ai_overview'],
    perf: { mobile: [62, 3100, 240, 120], desktop: [88, 1600, 90, 40] },
    links: { backlinks: 214, domains: 37, rank: 112 },
  },
  'demo-pme': {
    domain: 'paysia.fr',
    site: 'sc-domain:paysia.fr',
    location: '',
    competitors: ['paylo.example', 'netpaie.example', 'salaria.example', 'clairpaie.example'],
    keywords: [
      { kw: 'logiciel de paie pme', volume: 1900, pos: 9, page: '/logiciel-paie-pme', difficulty: 58 },
      { kw: 'logiciel paie en ligne', volume: 2400, pos: 14, page: '/', difficulty: 63 },
      { kw: 'dsn logiciel', volume: 720, pos: 7, page: '/dsn', difficulty: 44 },
      { kw: 'gestion des absences salariés', volume: 1000, pos: 11, page: '/absences', difficulty: 47 },
      { kw: 'comparatif logiciel de paie', volume: 590, pos: 21, page: '/comparatif', difficulty: 55 },
      { kw: 'externaliser la paie', volume: 1300, pos: 33, page: '/blog/externaliser-paie', difficulty: 49 },
      { kw: 'bulletin de paie 2026', volume: 4400, pos: 17, page: '/blog/bulletin-de-paie', difficulty: 61 },
      { kw: 'paysia', volume: 210, pos: 1, page: '/', difficulty: 5 },
    ],
    dailyClicks: 64,
    features: ['people_also_ask', 'ai_overview', 'featured_snippet'],
    perf: { mobile: [71, 2700, 180, 60], desktop: [93, 1300, 70, 20] },
    links: { backlinks: 1840, domains: 162, rank: 241 },
  },
  'demo-ecom': {
    domain: 'maison-sora.fr',
    site: 'https://www.maison-sora.fr/',
    location: '',
    competitors: ['savonnerie-alba.example', 'pain-de-lune.example', 'atelier-brume.example', 'solides-et-sens.example'],
    keywords: [
      { kw: 'shampoing solide', volume: 22200, pos: 24, page: '/collections/shampoings-solides', difficulty: 66 },
      { kw: 'shampoing solide cheveux gras', volume: 2900, pos: 8, page: '/produits/shampoing-solide-ortie', difficulty: 43 },
      { kw: 'déodorant solide naturel', volume: 3600, pos: 13, page: '/collections/deodorants', difficulty: 51 },
      { kw: 'soin visage solide', volume: 880, pos: 6, page: '/collections/soins-visage', difficulty: 35 },
      { kw: 'cosmétiques solides lyon', volume: 260, pos: 2, page: '/', difficulty: 18 },
      { kw: 'coffret cosmétiques zéro déchet', volume: 1600, pos: 19, page: '/produits/coffret-decouverte', difficulty: 40 },
      { kw: 'après-shampoing solide', volume: 6600, pos: 29, page: '/produits/apres-shampoing', difficulty: 48 },
      { kw: 'maison sora', volume: 170, pos: 1, page: '/', difficulty: 4 },
    ],
    dailyClicks: 118,
    features: ['shopping', 'popular_products', 'people_also_ask', 'ai_overview', 'images'],
    perf: { mobile: [48, 3900, 310, 180], desktop: [79, 2100, 140, 90] },
    links: { backlinks: 3210, domains: 228, rank: 198 },
  },
};

export const DEMO_NOTE = 'Données de démonstration : elles illustrent le produit et ne décrivent aucun site réel.';

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** CTR moyen par position (courbe publique usuelle, sert aussi à la part de visibilité). */
export function ctrAt(position: number | null): number {
  if (position === null || position <= 0) return 0;
  const t = [0, 0.28, 0.15, 0.1, 0.07, 0.05, 0.04, 0.03, 0.025, 0.02, 0.018];
  if (position <= 10) return t[Math.round(position)] ?? 0.018;
  if (position <= 20) return 0.01;
  if (position <= 30) return 0.004;
  return 0.001;
}

/** Progression du compte démo : 0,55 il y a 16 mois → 1 aujourd'hui (cohérent avec la montée des scores démo). */
const growth = (daysAgo: number) => 1 - 0.45 * Math.min(1, Math.max(0, daysAgo) / 490);

/** Position démo d'un mot-clé à une date (amélioration lente + petites variations hebdomadaires). */
export function demoPosition(id: DemoId, k: DemoKw, at: Date, now: Date): number {
  const daysAgo = Math.max(0, (now.getTime() - at.getTime()) / 86_400_000);
  const week = Math.floor(at.getTime() / (7 * 86_400_000));
  const drift = Math.round((hash(`${id}:${k.kw}:${week}`) - 0.5) * 3);
  return Math.max(1, Math.round(k.pos + daysAgo / 60 + drift));
}

export class DemoSearchConsole implements SearchConsoleProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId, private now: Date = new Date()) {}

  async listSites(): Promise<GscSite[]> {
    return [{ siteUrl: DEMO_SPECS[this.id].site, permissionLevel: 'siteOwner' }];
  }

  async query(_site: string, q: GscQuery, maxRows = 25_000): Promise<GscRow[]> {
    const s = DEMO_SPECS[this.id];
    const start = new Date(`${q.startDate}T00:00:00Z`);
    const end = new Date(`${q.endDate}T00:00:00Z`);
    const nDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1);
    const mid = addDays(start, nDays / 2);
    const g = growth((this.now.getTime() - mid.getTime()) / 86_400_000);
    const dims = q.dimensions ?? [];
    const kwRow = (k: DemoKw, share = 1) => {
      const pos = demoPosition(this.id, k, mid, this.now);
      const impressions = Math.round(((k.volume * nDays) / 30) * share * Math.min(1, 12 / pos) * 0.9);
      const clicks = Math.round(impressions * ctrAt(pos) * 0.8);
      return { impressions, clicks, pos };
    };
    let rows: GscRow[] = [];
    if (dims[0] === 'date') {
      // Position moyenne propre à chaque compte démo : moyenne de ses mots-clés pondérée par le volume (cohérente avec
      // le tableau des requêtes), qui s'améliore doucement avec le temps comme les clics.
      const basePos = s.keywords.reduce((a, k) => a + k.volume * k.pos, 0) / Math.max(1, s.keywords.reduce((a, k) => a + k.volume, 0));
      for (let i = 0; i < nDays; i++) {
        const d = addDays(start, i);
        const gd = growth((this.now.getTime() - d.getTime()) / 86_400_000);
        const dow = d.getUTCDay();
        const season = dow === 0 || dow === 6 ? 0.7 : 1.08;
        const clicks = Math.round(s.dailyClicks * gd * season * (0.9 + hash(`${this.id}:${day(d)}`) * 0.2));
        const impressions = Math.round(clicks * 31 * (1.05 - gd * 0.1));
        rows.push({ keys: [day(d)], clicks, impressions, ctr: impressions ? clicks / impressions : 0, position: Math.round(basePos * (1.35 - 0.35 * gd + (hash(`${this.id}:pos:${day(d)}`) - 0.5) * 0.04) * 10) / 10 });
      }
    } else if (dims[0] === 'query' && dims[1] === 'page') {
      rows = s.keywords.map((k) => {
        const r = kwRow(k);
        return { keys: [k.kw, `${s.site.startsWith('sc-domain:') ? `https://${s.domain}` : s.site.replace(/\/$/, '')}${k.page}`], clicks: Math.round(r.clicks * g), impressions: Math.round(r.impressions * g), ctr: r.impressions ? r.clicks / r.impressions : 0, position: r.pos };
      });
    } else if (dims[0] === 'query') {
      rows = s.keywords.map((k) => {
        const r = kwRow(k);
        return { keys: [k.kw], clicks: Math.round(r.clicks * g), impressions: Math.round(r.impressions * g), ctr: r.impressions ? r.clicks / r.impressions : 0, position: r.pos };
      });
    } else if (dims[0] === 'page') {
      const by = new Map<string, { c: number; i: number; p: number }>();
      for (const k of s.keywords) {
        const r = kwRow(k);
        const url = `${s.site.startsWith('sc-domain:') ? `https://${s.domain}` : s.site.replace(/\/$/, '')}${k.page}`;
        const v = by.get(url) ?? { c: 0, i: 0, p: 0 };
        v.c += r.clicks;
        v.i += r.impressions;
        v.p += r.pos * r.impressions;
        by.set(url, v);
      }
      rows = [...by.entries()].map(([url, v]) => ({ keys: [url], clicks: Math.round(v.c * g), impressions: Math.round(v.i * g), ctr: v.i ? v.c / v.i : 0, position: v.i ? Math.round((v.p / v.i) * 10) / 10 : 0 }));
    } else if (dims[0] === 'device') {
      const tot = s.dailyClicks * nDays * g;
      const split: [string, number, number][] = this.id === 'demo' ? [['MOBILE', 0.74, 9.8], ['DESKTOP', 0.23, 8.1], ['TABLET', 0.03, 11.2]] : [['DESKTOP', 0.58, 12.4], ['MOBILE', 0.39, 15.1], ['TABLET', 0.03, 16.0]];
      rows = split.map(([k, sh, p]) => ({ keys: [k], clicks: Math.round(tot * sh), impressions: Math.round(tot * sh * 30), ctr: 1 / 30, position: p }));
    } else if (dims[0] === 'country') {
      const tot = s.dailyClicks * nDays * g;
      rows = ([['fra', 0.92], ['bel', 0.04], ['che', 0.02], ['can', 0.02]] as const).map(([k, sh]) => ({ keys: [k], clicks: Math.round(tot * sh), impressions: Math.round(tot * sh * 30), ctr: 1 / 30, position: 14 }));
    }
    return rows.sort((a, b) => (dims[0] === 'date' ? a.keys[0].localeCompare(b.keys[0]) : b.clicks - a.clicks)).slice(0, maxRows);
  }

  async sitemaps(): Promise<GscSitemap[]> {
    const s = DEMO_SPECS[this.id];
    const n = s.keywords.length * (this.id === 'demo-ecom' ? 40 : 5);
    return [{ path: `https://${this.id === 'demo-ecom' ? 'www.' : ''}${s.domain}/sitemap.xml`, lastSubmitted: addDays(this.now, -40).toISOString(), lastDownloaded: addDays(this.now, -2).toISOString(), isPending: false, isSitemapsIndex: false, warnings: 0, errors: 0, contents: [{ type: 'web', submitted: n, indexed: null }] }];
  }

  async inspect(_site: string, url: string): Promise<GscInspection> {
    const indexed = hash(`${this.id}:${url}`) > 0.2;
    return { url, verdict: indexed ? 'PASS' : 'NEUTRAL', coverageState: indexed ? 'Envoyée et indexée' : 'Détectée, actuellement non indexée', indexingState: 'INDEXING_ALLOWED', robotsTxtState: 'ALLOWED', pageFetchState: 'SUCCESSFUL', lastCrawlTime: addDays(this.now, -5).toISOString(), googleCanonical: url, userCanonical: url, crawledAs: 'MOBILE' };
  }
}

export class DemoPerf implements PerfProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId) {}
  async measure(url: string, opts: { devices?: Device[] } = {}): Promise<PerfData> {
    const s = DEMO_SPECS[this.id];
    const out: PerfData = { url, fetchedAt: new Date().toISOString(), demo: true, devices: {}, errors: [], sources: ['demo'] };
    for (const device of opts.devices?.length ? opts.devices : (['mobile', 'desktop'] as Device[])) {
      const [perf, lcp, inp, cls] = s.perf[device];
      out.devices[device] = {
        device,
        field: fieldFrom('origin', { lcpMs: lcp, inpMs: inp, cls: cls / 1000, fcpMs: Math.round(lcp * 0.55), ttfbMs: Math.round(lcp * 0.22) }, 'demo'),
        lab: { performance: perf, lcpMs: Math.round(lcp * 1.15), cls: cls / 1000, tbtMs: Math.round(inp * 1.4), fcpMs: Math.round(lcp * 0.6), speedIndexMs: Math.round(lcp * 1.05), opportunities: [{ id: 'render-blocking-resources', title: 'Éliminer les ressources qui bloquent le rendu', savingsMs: Math.round(lcp * 0.18) }, { id: 'uses-optimized-images', title: 'Encoder les images de manière efficace', savingsMs: Math.round(lcp * 0.12) }] },
      };
    }
    return out;
  }
}

export class DemoKeywords implements KeywordsProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId) {}
  private find(k: string) {
    return DEMO_SPECS[this.id].keywords.find((x) => x.kw === k.trim().toLowerCase());
  }
  async volumes(keywords: string[]): Promise<KeywordMetrics[]> {
    // Mot-clé hors du jeu de démo : pas de volume inventé.
    return keywords.map((k) => {
      const d = this.find(k);
      return { keyword: k.trim().toLowerCase(), volume: d?.volume ?? null, cpcEur: d ? Math.round((0.6 + hash(d.kw) * 2.4) * 100) / 100 : null, competition: d ? (d.difficulty > 50 ? 'HIGH' : d.difficulty > 30 ? 'MEDIUM' : 'LOW') : null, difficulty: d?.difficulty ?? null };
    });
  }
  async difficulty(keywords: string[]): Promise<Record<string, number | null>> {
    return Object.fromEntries(keywords.map((k) => [k, this.find(k)?.difficulty ?? null]));
  }
  async rankedKeywords(_domain: string, _loc: KeywordLocation, limit: number) {
    const s = DEMO_SPECS[this.id];
    const base = s.site.startsWith('sc-domain:') ? `https://${s.domain}` : s.site.replace(/\/$/, '');
    return s.keywords.slice(0, limit).map((k) => ({ keyword: k.kw, position: k.pos, url: `${base}${k.page}`, volume: k.volume, difficulty: k.difficulty }));
  }
  async competitors(_domain: string, _loc: KeywordLocation, limit: number) {
    return DEMO_SPECS[this.id].competitors.slice(0, limit).map((d, i) => ({ domain: d, commonKeywords: 6 - i, avgPosition: 6 + i * 2.5 }));
  }
}

export class DemoSerp implements SerpProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId, private now: Date = new Date()) {}
  async live(req: SerpRequest, at: Date = this.now): Promise<SerpResult> {
    const s = DEMO_SPECS[this.id];
    const k = s.keywords.find((x) => x.kw === req.keyword.trim().toLowerCase());
    const own = k ? demoPosition(this.id, k, at, this.now) + (req.device === 'mobile' ? 1 : 0) : null;
    const organic: SerpResult['organic'] = [];
    let ci = 0;
    for (let p = 1; p <= req.depth; p++) {
      if (own === p) organic.push({ position: p, domain: s.domain, url: `https://${s.domain}${k!.page}` });
      else {
        const d = ci < s.competitors.length && hash(`${req.keyword}:${p}`) > 0.35 ? s.competitors[ci++] : `annuaire-${(p % 7) + 1}.example`;
        organic.push({ position: p, domain: d, url: `https://${d}/` });
      }
    }
    const features = s.features.filter((f) => hash(`${req.keyword}:${f}`) > 0.3);
    const aio = features.includes('ai_overview');
    return {
      keyword: req.keyword,
      device: req.device,
      checkedAt: at.toISOString(),
      features,
      aiOverview: req.aiOverview ? aio : null,
      aiOverviewDomains: aio ? [s.competitors[0], ...(own !== null && own <= 5 ? [s.domain] : [])] : [],
      organic,
    };
  }
}

export class DemoBacklinks implements BacklinksProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId, private now: Date = new Date()) {}
  async summary(target: string) {
    const l = DEMO_SPECS[this.id].links;
    return { target: hostOf(target), backlinks: l.backlinks, referringDomains: l.domains, referringMainDomains: Math.round(l.domains * 0.9), rank: l.rank, brokenBacklinks: Math.round(l.backlinks * 0.03) };
  }
  async referringDomains(_target: string, limit: number) {
    const n = Math.min(limit, DEMO_SPECS[this.id].links.domains);
    return Array.from({ length: n }, (_, i) => ({ domain: `media-${i + 1}.example`, backlinks: Math.max(1, Math.round(30 / (i + 1))), rank: Math.max(1, 480 - i * 9), firstSeen: addDays(this.now, -30 * (i % 18) - 10).toISOString() }));
  }
  async anchors(target: string, limit: number) {
    const s = DEMO_SPECS[this.id];
    const brand = hostOf(target).split('.')[0].replace(/-/g, ' ');
    return [brand, s.domain, `https://${s.domain}/`, s.keywords[0].kw, 'cliquez ici', 'site officiel'].slice(0, limit).map((a, i) => ({ anchor: a, backlinks: Math.round(s.links.backlinks * [0.34, 0.21, 0.12, 0.06, 0.04, 0.03][i]), referringDomains: Math.max(1, Math.round(s.links.domains * [0.4, 0.25, 0.15, 0.08, 0.05, 0.04][i])) }));
  }
  async newLost(_target: string, from: string) {
    const out = [];
    let d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
    while (d <= this.now) {
      const h = hash(`${this.id}:${day(d)}`);
      out.push({ date: day(d), newBacklinks: Math.round(6 + h * 14), lostBacklinks: Math.round(2 + h * 5), newDomains: Math.round(1 + h * 4), lostDomains: Math.round(h * 2) });
      d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    }
    return out;
  }
}

export class DemoBing implements BingProvider {
  readonly name = 'demo';
  readonly demo = true;
  constructor(private id: DemoId, private now: Date = new Date()) {}
  async sites() {
    return [`https://${DEMO_SPECS[this.id].domain}/`];
  }
  async queryStats() {
    const s = DEMO_SPECS[this.id];
    return s.keywords.slice(0, 5).map((k, i) => ({ query: k.kw, date: day(addDays(this.now, -7 * (i % 3) - 3)), clicks: Math.round(k.volume * 0.004), impressions: Math.round(k.volume * 0.08), avgPosition: k.pos + 1 }));
  }
  async trafficStats() {
    const s = DEMO_SPECS[this.id];
    return Array.from({ length: 12 }, (_, i) => {
      const d = addDays(this.now, -7 * (11 - i));
      const c = Math.round(s.dailyClicks * 0.6 * growth(7 * (11 - i)));
      return { date: day(d), clicks: c, impressions: c * 28 };
    });
  }
}
