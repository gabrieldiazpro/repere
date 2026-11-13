/**
 * Comptes démo V2 (docs/v2/08-CONTRATS-V2.md) — données réalistes, toujours étiquetées « démo ».
 * - `demo`      : Plomberie Martin (local, plombier, Paris 11e) — historique 18 → 61 (V1 inchangé) ;
 * - `demo-pme`  : Paysia (PME, logiciel de paie pour PME) ;
 * - `demo-ecom` : Maison Sora (e-commerce, cosmétiques solides).
 *
 * `buildDemoWorkspace` est synchrone et sans dépendance à db.ts (db.ts l'utilise pour getBusiness/getAudit).
 * `getDemoWorkspace` ajoute l'amorçage des tâches (EXECUTION) et du trafic IA (TRACKING), tolérant à leur absence.
 */
import { createMockAudit, createMockFacts, type AuditInput, type AuditResult } from '@/lib/engine';
import type { AuditInputV2, AuditResultV2Ext, BrandFacts, Segment } from '@/lib/engine/types-v2';
import type { BusinessRecord } from '@/lib/db';
import { computeMargins } from '@/lib/engine/analytics';
import { buildGaps } from '@/lib/engine/insights';
import { registrableDomain } from '@/lib/engine/detect';
import { alignAnswer, citationPlan } from '@/lib/engine/providers/mock-align';
import { themeOf } from '@/lib/engine/queries-v3';
import { auditStats, benchmarkOfAudit } from '@/lib/digest/stats';

export type DemoId = 'demo' | 'demo-pme' | 'demo-ecom';
export const DEMO_IDS: readonly DemoId[] = ['demo', 'demo-pme', 'demo-ecom'];

const SEGMENT_TO_ID: Record<Segment, DemoId> = { local: 'demo', pme: 'demo-pme', ecommerce: 'demo-ecom' };
const ID_TO_SEGMENT: Record<DemoId, Segment> = { demo: 'local', 'demo-pme': 'pme', 'demo-ecom': 'ecommerce' };

export function isDemoBusinessId(id: string | null | undefined): id is DemoId {
  return typeof id === 'string' && (DEMO_IDS as readonly string[]).includes(id);
}
/** Message renvoyé par toute écriture sur un compte démo (données publiques, jamais modifiables côté serveur). */
export const DEMO_READ_ONLY = 'Compte de démonstration : les modifications ne sont pas enregistrées.';

export function demoIdForSegment(segment: Segment): DemoId {
  return SEGMENT_TO_ID[segment];
}
export function segmentForDemoId(id: DemoId): Segment {
  return ID_TO_SEGMENT[id];
}

export type DemoAudit = AuditResult & AuditResultV2Ext;
export type DemoInput = AuditInput & AuditInputV2;

export interface DemoWorkspace {
  business: BusinessRecord & { segment: Segment };
  audits: DemoAudit[]; // du plus ancien au plus récent
  facts: BrandFacts;
}

interface DemoSpec {
  id: DemoId;
  seedPrefix: string;
  /** préfixe des identifiants d'audit : `demo-1` (V1, inchangé), `demo-pme-1`, `demo-ecom-1` */
  auditPrefix: string;
  input: DemoInput;
  scores: number[];
}

const SPECS: Record<Segment, DemoSpec> = {
  local: {
    id: 'demo',
    seedPrefix: 'demo-plomberie-martin',
    auditPrefix: 'demo-',
    input: {
      businessName: 'Plomberie Martin',
      trade: 'plombier',
      city: 'Paris',
      district: '11e',
      website: 'plomberie-martin.fr',
      segment: 'local',
    },
    scores: [18, 27, 33, 42, 52, 61],
  },
  pme: {
    id: 'demo-pme',
    seedPrefix: 'demo-paysia',
    auditPrefix: 'demo-pme-',
    input: {
      businessName: 'Paysia',
      trade: 'logiciel de paie',
      city: 'Paris',
      website: 'paysia.fr',
      segment: 'pme',
      category: 'logiciel de paie pour PME',
      offering: 'Logiciel de paie en ligne pour les PME de 10 à 250 salariés, DSN et absences inclus',
      // Concurrents FICTIFS (aucune citation inventée attribuée à une vraie marque), alignés sur la landing.
      knownCompetitors: ['Paylo', 'Netpaie', 'Salaria', 'Clairpaie'],
      market: 'France',
    },
    scores: [22, 26, 31, 35, 41, 47],
  },
  ecommerce: {
    id: 'demo-ecom',
    seedPrefix: 'demo-maison-sora',
    auditPrefix: 'demo-ecom-',
    input: {
      businessName: 'Maison Sora',
      trade: 'cosmétiques solides',
      city: 'Lyon',
      website: 'maison-sora.fr',
      segment: 'ecommerce',
      offering: 'Cosmétiques solides zéro déchet fabriqués à Lyon',
      productCategories: ['shampoing solide', 'déodorant solide', 'soin visage solide'],
      knownCompetitors: ['Savonnerie Alba', 'Pain de Lune', 'Atelier Brume'],
      market: 'France',
    },
    scores: [12, 15, 21, 24, 30, 36],
  },
};

function stableHash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Façonne une série d'audits mock autour de scores imposés.
 * - UN SEUL vivier de concurrents (même graine) pour les 6 mois : le classement évolue, il ne change pas de casting ;
 * - les concurrents montent progressivement (citations retirées au hasard dans les mois anciens) ;
 * - un seul vrai entrant : le dernier du classement du mois courant, absent des mois précédents ;
 * - citations, parts de voix, « pourquoi » et rang recalculés sur les mentions façonnées (même base partout).
 */
function shapeAudits(spec: DemoSpec, now: Date): DemoAudit[] {
  const { scores, input } = spec;
  const last = scores.length - 1;
  const dateOf = (i: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (scores.length - 1 - i), 5, 8, 0, 0)).toISOString();
  const poolSeed = `${spec.seedPrefix}-pool`;
  // Vivier brut (mois courant, non façonné) : sert à l'ordre des questions et au choix de l'entrant.
  const base0 = createMockAudit(input, poolSeed, { measuredAt: dateOf(last) }) as DemoAudit;
  // l'entrant : le moins cité des concurrents classés du mois courant
  const entrant = base0.competitors.length > 4 ? base0.competitors[base0.competitors.length - 1].name : null;
  const client = mockClientName(input);
  const clientDomain = input.website ? registrableDomain(/^https?:\/\//.test(input.website) ? input.website : `https://${input.website}`) : undefined;
  const allNames = [...new Set([...base0.competitors.map((c) => c.name), ...base0.mentions.flatMap((m) => m.competitors)])];
  const description =
    input.segment === 'pme'
      ? 'alternative française appréciée pour son accompagnement'
      : input.segment === 'ecommerce'
        ? 'marque française engagée, appréciée pour ses formules'
        : 'artisan sérieux, très bien noté par ses clients';
  // Ordre stable des questions par IA (d'un mois à l'autre).
  const qById = new Map(base0.queries.map((q) => [q.id, q]));
  const byProvider = new Map<string, { id: string; theme: string }[]>();
  for (const m of base0.mentions) {
    const qs = byProvider.get(m.provider) ?? [];
    const q = qById.get(m.queryId);
    if (!qs.some((x) => x.id === m.queryId)) qs.push({ id: m.queryId, theme: q ? themeOf(q) : '' });
    byProvider.set(m.provider, qs);
  }
  return scores.map((score, i) => {
    const iso = dateOf(i);
    const offsets = [4, -5, 1, -2];
    const subScores = Object.fromEntries(
      Object.entries(base0.subScores).map(([k, v], j) => [k, v === null ? null : clamp(score + offsets[j % 4])]),
    ) as AuditResult['subScores'];
    const targetRate = Math.round((score / 100) * 0.85 * 100) / 100;
    // Citation cohérente par question : pour chaque IA, ses premières questions (ordre propre à l'IA, stable d'un mois
    // à l'autre, voir citationPlan) sont citées à tous les passages ; chaque IA a son taux et ses thèmes de prédilection.
    const cited = citationPlan(spec.seedPrefix, targetRate, byProvider);
    // Concurrents : tendance propre à chacun ; le mois courant garde toutes les citations du mock.
    const keep = (name: string, key: string) => {
      if (i === last) return true;
      if (entrant && name === entrant) return false;
      const trend = (stableHash(`${spec.seedPrefix}|trend|${name}`) % 1000) / 1000; // 0..1
      const p = Math.max(0.45, 1 - (last - i) * (0.03 + 0.07 * trend));
      return (stableHash(`${spec.seedPrefix}|${i}|${name}|${key}`) % 1000) / 1000 < p;
    };
    // Le TEXTE porte la citation : nom injecté (au rang 1 à 3) ou retiré, concurrents retirés des réponses ;
    // le moteur en dérive ensuite « cité », le rang, les concurrents, les parts de voix et les sources.
    const base = createMockAudit(input, poolSeed, {
      measuredAt: iso,
      rewrite: (a) => {
        const key = `${a.provider}|${a.queryId}|${a.run}`;
        return alignAnswer(
          a,
          {
            client,
            clientDomain,
            mention: cited.has(`${a.provider}|${a.queryId}`),
            rank: 1 + (stableHash(`${spec.seedPrefix}|rank|${a.provider}|${a.queryId}`) % 3),
            drop: allNames.filter((n) => !keep(n, key)),
            description,
            // Une entreprise installée a (presque toujours) une fiche Google : présente quand elle est citée.
            ...(input.segment === 'local' ? { listedOn: (u: string) => u.includes('google.com/maps') } : {}),
          },
          allNames,
        );
      },
    }) as DemoAudit;
    const shaped: DemoAudit = {
      ...base,
      id: `${spec.auditPrefix}${i + 1}`,
      input,
      createdAt: iso,
      measuredAt: iso,
      score,
      range: { low: clamp(score - 7), high: clamp(score + 6) },
      subScores,
      segment: input.segment,
      demo: true,
      benchmark: undefined,
      gaps: undefined,
    };
    // Marges recalculées sur l'audit façonné : celles du vivier décrivaient un autre score
    // (ex. « 23 ± 11 » pour un score de 61) et le rapport public / PDF contredisaient l'app, le CSV et le copilote.
    shaped.margins = computeMargins(shaped);
    const gaps = buildGaps(shaped, { sources: shaped.sources });
    const out: DemoAudit = { ...shaped, gaps };
    return { ...out, benchmark: benchmarkOfAudit(out) };
  });
}

/** Nom du client tel que l'écrivent les réponses mock (formes juridiques retirées). */
function mockClientName(input: AuditInput): string {
  return input.businessName.replace(/\b(SARL|SASU|SAS|EURL|SNC|EIRL|EI)\b\.?/g, '').replace(/\s+/g, ' ').trim();
}

/** Chiffres clés d'un audit démo (réexport pratique pour les tests de cohérence). */
export const demoAuditStats = auditStats;

const cache = new Map<Segment, { key: string; ws: DemoWorkspace }>();

/** Espace démo (synchrone, mis en cache par mois). */
export function buildDemoWorkspace(segment: Segment = 'local', now: Date = new Date()): DemoWorkspace {
  const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}`;
  const hit = cache.get(segment);
  if (hit && hit.key === key) return hit.ws;
  const spec = SPECS[segment];
  const audits = shapeAudits(spec, now);
  const business: DemoWorkspace['business'] = {
    id: spec.id,
    name: spec.input.businessName,
    trade: spec.input.trade,
    city: spec.input.city,
    district: spec.input.district,
    website: spec.input.website,
    segment,
    plan: segment === 'local' ? 'suivi' : 'accompagne',
    lastScore: spec.scores[spec.scores.length - 1],
    createdAt: audits[0].createdAt,
    ownerId: null,
    contactEmail: undefined,
    isActive: false, // jamais ré-audité ni relancé par les crons
    alertThreshold: 5,
  };
  // Source de vérité unique : la fiche démo du moteur (celle que contredisent les réponses mock et que vérifie factCheck).
  const facts: BrandFacts = { businessId: spec.id, facts: { ...createMockFacts(spec.input, spec.id).facts }, updatedAt: audits[0].createdAt };
  const ws = { business, audits, facts };
  cache.set(segment, { key, ws });
  return ws;
}

/** Espace démo d'un identifiant (`demo`, `demo-pme`, `demo-ecom`), ou null. */
export function buildDemoWorkspaceById(id: string): DemoWorkspace | null {
  return isDemoBusinessId(id) ? buildDemoWorkspace(segmentForDemoId(id)) : null;
}

/** Audit démo par identifiant (`demo-3`, `demo-pme-6`…). */
export function findDemoAudit(auditId: string): { audit: DemoAudit; businessId: DemoId } | null {
  for (const seg of ['pme', 'ecommerce', 'local'] as Segment[]) {
    const ws = buildDemoWorkspace(seg);
    const a = ws.audits.find((x) => x.id === auditId);
    if (a) return { audit: a, businessId: ws.business.id as DemoId };
  }
  return null;
}

const seeded = new Set<string>();

/**
 * Espace démo complet : business, 6 mois d'audits, fiche de vérité. Amorce une fois par processus
 * les tâches (seedDemoExec) et le trafic IA (seedDemoTraffic) ; leur absence ne bloque pas la démo.
 */
export async function getDemoWorkspace(segment: Segment = 'local'): Promise<DemoWorkspace> {
  const ws = buildDemoWorkspace(segment);
  const id = ws.business.id;
  if (!seeded.has(id)) {
    seeded.add(id);
    const { seedDemoExec, seedDemoTraffic } = await import('@/lib/digest/deps');
    await Promise.allSettled([seedDemoExec(id), seedDemoTraffic(id)]);
  }
  return ws;
}
