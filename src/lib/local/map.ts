/**
 * Carte de visibilité IA par zone — SIMULATION (docs/v3/05-teardown-local.md § 2.1).
 *
 * Les API des IA ne prennent pas de position GPS : on reformule chaque question en y injectant la zone
 * (« … dans le 11e arrondissement de Paris ») et on mesure, zone par zone, le taux de mention, le rang moyen et le
 * concurrent dominant. Une seule exécution de `runAudit(input, { queries })` porte toutes les zones. Le coût est
 * plafonné par l'offre (zones × questions × IA × 2 exécutions). Gemini reste sans ancrage (pas de Maps grounding).
 */
import { createMockAudit, resolveTrade, runAudit, PROVIDER_LABELS } from '@/lib/engine';
import type { AuditInput, AuditResult, MentionResult, ProviderId } from '@/lib/engine/types';
import type { CustomQuery } from '@/lib/engine/types-v3';
import type { LocalTier } from './auth';
import type { MapBudget, MapSvgModel, VisibilityMap, Zone, ZoneQuestion, ZoneResult } from './types';
import { newLocalId, rand01 } from './util';
import { buildZoneGrid, nearestZones } from './zones';

/** Exécutions par question et par IA (mode « free » du moteur). */
export const MAP_RUNS = 2;

export interface MapCaps {
  zones: number;
  questions: number;
  providers: number;
  /** cartes par mois civil */
  perMonth: number;
  /** budget LLM en euros pour une carte */
  budgetEur: number;
}

export const MAP_CAPS: Record<LocalTier, MapCaps> = {
  decouverte: { zones: 5, questions: 1, providers: 1, perMonth: 1, budgetEur: 0.3 },
  essentiel: { zones: 9, questions: 2, providers: 3, perMonth: 2, budgetEur: 1.5 },
  accompagne: { zones: 16, questions: 3, providers: 4, perMonth: 4, budgetEur: 3 },
  agence: { zones: 25, questions: 3, providers: 5, perMonth: 8, budgetEur: 5 },
  demo: { zones: 25, questions: 3, providers: 4, perMonth: 0, budgetEur: 0 },
};

export const MAP_DISCLAIMER =
  'Simulation par zone : les IA ne connaissent pas votre position. Nous posons la même question en y ajoutant le nom de chaque zone ; c’est une indication de visibilité, pas un classement géolocalisé. Les réponses varient d’un jour à l’autre.';

/** Questions par défaut (gabarits avec `{zone}`), selon le métier. */
export function defaultZoneQuestions(trade: string, n = 3): ZoneQuestion[] {
  const t = resolveTrade(trade);
  const list: string[] = [`Quel ${t.label} me recommandez-vous {zone} ?`];
  if (t.urgency) list.push(`J’ai une urgence (${t.urgency}) {zone} : quel ${t.label} appeler ?`);
  list.push(`Quels sont les meilleurs ${t.plural} {zone} ?`);
  if (t.services[0]) list.push(`Qui contacter pour ${t.services[0]} {zone} ?`);
  return list.slice(0, Math.max(1, n)).map((template, i) => ({ id: `q${i + 1}`, template }));
}

/** Questions personnalisées : on garde celles qui contiennent `{zone}` (sinon on l'ajoute en fin de phrase). */
export function normalizeZoneQuestions(raw: unknown, trade: string, max: number): ZoneQuestion[] {
  const arr = Array.isArray(raw) ? raw : [];
  const out: ZoneQuestion[] = [];
  for (const r of arr) {
    const text = typeof r === 'string' ? r : r && typeof r === 'object' && typeof (r as { template?: unknown }).template === 'string' ? (r as { template: string }).template : '';
    let t = text.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (t.length < 8) continue;
    if (!t.includes('{zone}')) t = /[?.!]$/.test(t) ? `${t.slice(0, -1).trim()} {zone} ${t.slice(-1)}` : `${t} {zone}`;
    out.push({ id: `q${out.length + 1}`, template: t });
    if (out.length >= max) break;
  }
  return out.length ? out : defaultZoneQuestions(trade, max);
}

export function fillZone(template: string, z: Zone): string {
  return template.replace('{zone}', z.phrase).replace(/\s+([?!])/g, ' $1').replace(/\s{2,}/g, ' ').trim();
}

export function mapBudget(zones: number, questions: number, providers: number, tier: LocalTier): MapBudget {
  const caps = MAP_CAPS[tier];
  return {
    zones,
    questions,
    providers,
    runs: MAP_RUNS,
    calls: zones * questions * providers * MAP_RUNS,
    maxCalls: caps.zones * caps.questions * caps.providers * MAP_RUNS,
    tier,
  };
}

export interface MapPlan {
  city: string;
  kind: VisibilityMap['kind'];
  zones: Zone[];
  questions: ZoneQuestion[];
  providers: ProviderId[];
  budget: MapBudget;
  /** id de requête moteur → zone */
  queries: (CustomQuery & { id: string; zoneId: string })[];
}

/** Prépare la carte en respectant les plafonds de l'offre. */
export function planMap(
  input: { city: string; district?: string; trade: string },
  tier: LocalTier,
  opts: { engines: ProviderId[]; questions?: unknown; zones?: number; providers?: ProviderId[] },
): MapPlan {
  const caps = MAP_CAPS[tier];
  const grid = buildZoneGrid(input.city, input.district);
  const zones = nearestZones(grid, Math.min(caps.zones, opts.zones ?? caps.zones, grid.zones.length));
  const questions = opts.questions ? normalizeZoneQuestions(opts.questions, input.trade, caps.questions) : defaultZoneQuestions(input.trade, caps.questions);
  const wanted = (opts.providers?.length ? opts.providers : opts.engines).filter((p) => opts.engines.includes(p));
  const providers = [...new Set(wanted.length ? wanted : opts.engines)].slice(0, caps.providers);
  const queries = zones.flatMap((z) =>
    questions.map((q) => ({ id: `Z-${z.id}-${q.id}`, zoneId: z.id, text: fillZone(q.template, z), kind: 'reco' as const, tags: ['carte', z.id] })),
  );
  return { city: grid.city, kind: grid.kind, zones, questions, providers, budget: mapBudget(zones.length, questions.length, providers.length, tier), queries };
}

export function bandOf(rate: number | null): ZoneResult['band'] {
  if (rate === null) return 'na';
  if (rate >= 0.5) return 'fort';
  if (rate >= 0.25) return 'moyen';
  if (rate > 0) return 'faible';
  return 'absent';
}

/** Agrège les mentions du moteur par zone. */
export function aggregateZones(plan: MapPlan, mentions: Pick<MentionResult, 'queryId' | 'mentioned' | 'rank' | 'competitors' | 'noRec'>[]): ZoneResult[] {
  const zoneOf = new Map(plan.queries.map((q) => [q.id, q.zoneId]));
  return plan.zones.map((z) => {
    const ms = mentions.filter((m) => zoneOf.get(m.queryId) === z.id);
    const valid = ms.filter((m) => !m.noRec);
    const hits = valid.filter((m) => m.mentioned);
    const ranks = hits.map((m) => m.rank).filter((r): r is number => typeof r === 'number' && r > 0);
    const comp = new Map<string, number>();
    for (const m of ms) for (const c of new Set(m.competitors)) comp.set(c, (comp.get(c) ?? 0) + 1);
    const top = [...comp.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const mentionRate = valid.length ? hits.length / valid.length : null;
    return {
      zoneId: z.id,
      label: z.label,
      x: z.x,
      y: z.y,
      ...(z.home ? { home: true } : {}),
      mentionRate: mentionRate === null ? null : Math.round(mentionRate * 1000) / 1000,
      avgRank: ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null,
      answers: valid.length,
      dominantCompetitor: top ? { name: top[0], mentions: top[1] } : null,
      band: bandOf(mentionRate),
    };
  });
}

const BAND_STYLE: Record<ZoneResult['band'], { fill: string; label: string }> = {
  fort: { fill: '#15803D', label: 'Cité dans la moitié des réponses ou plus' },
  moyen: { fill: '#B45309', label: 'Cité dans 25 à 49 % des réponses' },
  faible: { fill: '#C2410C', label: 'Cité dans moins de 25 % des réponses' },
  absent: { fill: '#B91C1C', label: 'Jamais cité' },
  na: { fill: '#9CA3AF', label: 'Pas de réponse exploitable' },
};

/** Modèle prêt pour un SVG schématique (cercles par zone, pas de fond de carte). */
export function toSvgModel(zones: ZoneResult[]): MapSvgModel {
  const r = zones.length > 16 ? 5 : zones.length > 9 ? 6 : 8;
  return {
    viewBox: '0 0 100 100',
    radius: r,
    points: zones.map((z) => ({
      id: z.zoneId,
      cx: z.x,
      cy: z.y,
      r: z.home ? r + 1.5 : r,
      fill: BAND_STYLE[z.band].fill,
      stroke: z.home ? '#111827' : '#FFFFFF',
      label: z.label,
      value: z.mentionRate === null ? '–' : `${Math.round(z.mentionRate * 100)} %`,
      ...(z.home ? { home: true } : {}),
    })),
    legend: (Object.keys(BAND_STYLE) as ZoneResult['band'][]).map((band) => ({ band, label: BAND_STYLE[band].label, fill: BAND_STYLE[band].fill })),
  };
}

export interface MapRunInput {
  businessId: string;
  businessName: string;
  trade: string;
  city: string;
  district?: string;
  website?: string;
}

function assemble(plan: MapPlan, input: MapRunInput, zones: ZoneResult[], demo: boolean, now: Date): VisibilityMap {
  return {
    id: newLocalId('map', input.businessId),
    businessId: input.businessId,
    city: plan.city,
    trade: input.trade,
    kind: plan.kind,
    label: demo ? 'Simulation par zone (démonstration)' : 'Simulation par zone',
    disclaimer: MAP_DISCLAIMER,
    providers: plan.providers,
    questions: plan.questions,
    budget: plan.budget,
    zones,
    svg: toSvgModel(zones),
    createdAt: now.toISOString(),
    demo,
  };
}

/** Exécute la carte : un seul `runAudit` pour toutes les zones. `forceMock` = moteur simulé. */
export async function runVisibilityMap(
  input: MapRunInput,
  plan: MapPlan,
  opts: { budgetEur: number; forceMock?: boolean; now?: Date; signal?: AbortSignal; run?: typeof runAudit },
): Promise<{ map: VisibilityMap; audit: AuditResult }> {
  const now = opts.now ?? new Date();
  const ai: AuditInput = { businessName: input.businessName, trade: input.trade, city: input.city, district: input.district, website: input.website, segment: 'local' };
  const queries = plan.queries.map(({ zoneId: _z, ...q }) => q);
  const run = opts.run ?? runAudit;
  const audit = await run(ai, { mode: 'free', providers: plan.providers, queries, queriesMode: 'replace', budgetEur: opts.budgetEur, forceMock: opts.forceMock, signal: opts.signal, measuredAt: now.toISOString() });
  return { map: assemble(plan, input, aggregateZones(plan, audit.mentions), audit.demo, now), audit };
}

export interface DemoMapOptions {
  /** vivier du compte (Concurrents), poids = citations ; sinon le mock moteur */
  competitors?: { name: string; weight: number }[];
  /** taux de mention global du compte (réponses citantes / réponses) : la carte est centrée dessus */
  baseRate?: number;
}

/**
 * Démo déterministe : visibilité plus forte près du commerce, qui décroît avec la distance, CENTRÉE sur le taux de
 * mention global du compte ; concurrents tirés du même vivier que l'écran Concurrents (pondérés par leurs citations).
 */
export function demoVisibilityMap(input: MapRunInput, plan: MapPlan, now: Date = new Date(), opts: DemoMapOptions = {}): VisibilityMap {
  const ai: AuditInput = { businessName: input.businessName, trade: input.trade, city: input.city, district: input.district, website: input.website, segment: 'local' };
  const pool =
    opts.competitors?.filter((c) => c.name && c.weight > 0) ??
    createMockAudit(ai, `local-map-${input.businessId}`).competitors.slice(0, 5).map((c) => ({ name: c.name, weight: Math.max(1, c.mentions) }));
  const names = pool.length ? pool : [{ name: 'Concurrent A (démo)', weight: 1 }, { name: 'Concurrent B (démo)', weight: 1 }];
  const totalW = names.reduce((s, c) => s + c.weight, 0);
  const pickName = (u: number) => {
    let acc = 0;
    for (const c of names) {
      acc += c.weight / totalW;
      if (u < acc) return c.name;
    }
    return names[names.length - 1].name;
  };
  const home = plan.zones.find((z) => z.home) ?? plan.zones[0];
  const dists = plan.zones.map((z) => Math.hypot(z.x - home.x, z.y - home.y));
  const maxD = Math.max(1, ...dists);
  const meanD = dists.reduce((s, d) => s + d, 0) / Math.max(1, dists.length);
  const base = opts.baseRate ?? 0.5;
  const mentions: Pick<MentionResult, 'queryId' | 'mentioned' | 'rank' | 'competitors' | 'noRec'>[] = [];
  for (const q of plan.queries) {
    const z = plan.zones.find((x) => x.id === q.zoneId)!;
    const dist = Math.hypot(z.x - home.x, z.y - home.y);
    // ± 25 points autour du taux global selon la distance (la moyenne des zones reste proche du taux global)
    const p = Math.max(0.03, Math.min(0.9, base + 0.25 * ((meanD - dist) / maxD) * 2 + (rand01(`${q.id}|p`) - 0.5) * 0.12));
    for (const pr of plan.providers)
      for (let run = 1; run <= MAP_RUNS; run++) {
        const k = `${input.businessId}|${q.id}|${pr}|${run}`;
        const mentioned = rand01(k) < p;
        const n = 1 + Math.floor(rand01(`${k}|n`) * 3);
        const comps = [...new Set(Array.from({ length: n }, (_, i) => pickName(rand01(`${k}|c${i}`))))];
        mentions.push({ queryId: q.id, mentioned, rank: mentioned ? 1 + Math.floor(rand01(`${k}|r`) * (dist > 15 ? 4 : 2)) : null, competitors: comps });
      }
  }
  return assemble(plan, input, aggregateZones(plan, mentions), true, now);
}

/** Phrase de synthèse (pour le rapport et le copilote). */
export function summarizeMap(m: VisibilityMap): string {
  const ok = m.zones.filter((z) => z.band === 'fort').length;
  const weak = m.zones.filter((z) => z.band === 'absent' || z.band === 'faible');
  const ia = m.providers.map((p) => PROVIDER_LABELS[p]).join(', ');
  const worst = weak.slice(0, 3).map((z) => z.label).join(', ');
  return `Sur ${m.zones.length} zones (${ia}), vous êtes cité dans au moins la moitié des réponses dans ${ok} zone${ok > 1 ? 's' : ''}.${weak.length ? ` Zones faibles : ${worst}.` : ''} Simulation, pas un classement géolocalisé.`;
}
