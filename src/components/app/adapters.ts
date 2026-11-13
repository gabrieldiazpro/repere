/**
 * Adaptateurs de données de l'espace client (côté serveur).
 *
 * Contrat (docs/v2/08-CONTRATS-V2.md) : les données viennent des modules V2
 *   getDemoWorkspace (@/lib/demo-v2), listTasks / weeklyTasks (@/lib/execution),
 *   getAiTraffic (@/lib/tracking), getFacts (@/lib/facts), buildWeeklyDigest (@/lib/digest).
 * Chaque appel passe par REAL ; si l'export manque, lève une erreur ou renvoie une forme inattendue,
 * on retombe sur demo-data.ts (bâti sur createMockAudit) et on le note dans `fallbacks`.
 */
import type { AiTrafficSummary, BrandFacts, ExecTask, Segment, WeeklyDigest } from '@/lib/engine/types-v2';
import { demoAudits, demoBusiness, demoDigest, demoFacts, demoTasks, demoTraffic, type V2Audit, type WorkspaceBusiness } from './demo-data';
import { REAL } from './adapters-real';
import { applyDemoTaskState, DEMO_TASKS_COOKIE, parseDemoTaskState, type DemoTaskState } from './demoTaskState';
import { SITE_URL } from '@/lib/seo/site';

export type { V2Audit, WorkspaceBusiness };

export const DEMO_IDS: Record<Segment, string> = { local: 'demo', pme: 'demo-pme', ecommerce: 'demo-ecom' };
export function segmentOfDemoId(id: string): Segment | null {
  return id === 'demo' ? 'local' : id === 'demo-pme' ? 'pme' : id === 'demo-ecom' ? 'ecommerce' : null;
}

/** Trace des replis (affichée en mode développement seulement). */
export class Fallbacks {
  list: string[] = [];
  add(name: string) {
    if (!this.list.includes(name)) this.list.push(name);
  }
}

function isArr<T>(x: unknown): x is T[] {
  return Array.isArray(x);
}

// ---------------------------------------------------------------------------
// Espace démo
// ---------------------------------------------------------------------------
type LooseBusiness = { id?: string; name?: string; trade?: string; city?: string; district?: string; website?: string; segment?: Segment; descriptor?: string; cohort?: string; slug?: string };

function mergeBusiness(segment: Segment, real?: LooseBusiness | null): WorkspaceBusiness {
  const base = demoBusiness(segment);
  if (!real) return base;
  return {
    ...base,
    id: real.id ?? base.id,
    name: real.name ?? base.name,
    website: real.website ?? base.website,
    descriptor: real.descriptor ?? base.descriptor,
    cohort: real.cohort ?? base.cohort,
    slug: real.slug ?? base.slug,
  };
}

export async function adaptDemoWorkspace(segment: Segment, fb: Fallbacks): Promise<{ business: WorkspaceBusiness; audits: V2Audit[]; facts: BrandFacts }> {
  try {
    if (REAL.getDemoWorkspace) {
      const ws = (await REAL.getDemoWorkspace(segment)) as { business?: LooseBusiness; audits?: unknown; facts?: unknown } | null;
      if (ws && isArr<V2Audit>(ws.audits) && ws.audits.length) {
        const audits = [...ws.audits].sort((a, b) => new Date(a.measuredAt ?? a.createdAt).getTime() - new Date(b.measuredAt ?? b.createdAt).getTime());
        const facts = (ws.facts as BrandFacts | undefined)?.facts ? (ws.facts as BrandFacts) : demoFacts(segment);
        return { business: mergeBusiness(segment, ws.business), audits, facts };
      }
    }
  } catch {
    /* repli */
  }
  fb.add('getDemoWorkspace');
  return { business: demoBusiness(segment), audits: demoAudits(segment), facts: demoFacts(segment) };
}

// ---------------------------------------------------------------------------
// Fiche de vérité
// ---------------------------------------------------------------------------
export async function adaptFacts(businessId: string, fb: Fallbacks): Promise<BrandFacts | null> {
  try {
    if (REAL.getFacts) {
      const f = (await REAL.getFacts(businessId)) as BrandFacts | null;
      if (f && f.facts && Object.keys(f.facts).length) return f;
    }
  } catch {
    /* repli */
  }
  const seg = segmentOfDemoId(businessId);
  if (seg) {
    fb.add('getFacts');
    return demoFacts(seg);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tâches
// ---------------------------------------------------------------------------
/** Démo : statuts et dates « fait » posés sur cet appareil (cookie écrit par localDemo), jamais en base. */
async function demoDeviceState(businessId: string): Promise<DemoTaskState> {
  if (!segmentOfDemoId(businessId)) return {};
  try {
    const { cookies } = await import('next/headers');
    return parseDemoTaskState((await cookies()).get(DEMO_TASKS_COOKIE)?.value);
  } catch {
    return {}; // hors requête (tests, tâches de fond)
  }
}

export async function adaptTasks(businessId: string, fb: Fallbacks): Promise<ExecTask[]> {
  const device = await demoDeviceState(businessId);
  try {
    if (REAL.listTasks) {
      const t = await REAL.listTasks(businessId);
      if (isArr<ExecTask>(t) && t.length) return applyDemoTaskState(t, device);
    }
  } catch {
    /* repli */
  }
  const seg = segmentOfDemoId(businessId);
  fb.add('listTasks');
  return seg ? applyDemoTaskState(demoTasks(seg), device) : [];
}

export async function adaptWeekly(businessId: string, all: ExecTask[], fb: Fallbacks): Promise<ExecTask[]> {
  try {
    if (REAL.weeklyTasks) {
      const t = await REAL.weeklyTasks(businessId);
      if (isArr<ExecTask>(t) && t.length) {
        // statut le plus récent (la liste complète fait foi)
        return t.map((x) => all.find((y) => y.id === x.id) ?? x).slice(0, 3);
      }
    }
  } catch {
    /* repli */
  }
  fb.add('weeklyTasks');
  const open = all.filter((t) => t.status !== 'skipped');
  const thisWeek = open.filter((t) => t.week && t.week === mondayOf());
  const pick = (thisWeek.length ? thisWeek : open.filter((t) => t.status !== 'done')).slice(0, 3);
  return pick;
}

function mondayOf(d = new Date()) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Trafic IA
// ---------------------------------------------------------------------------
export async function adaptTraffic(businessId: string, days: number, fb: Fallbacks): Promise<AiTrafficSummary | null> {
  try {
    if (REAL.getAiTraffic) {
      const t = (await REAL.getAiTraffic(businessId, days)) as AiTrafficSummary | null;
      if (t && isArr(t.days) && t.days.length) return t;
    }
  } catch {
    /* repli */
  }
  const seg = segmentOfDemoId(businessId);
  fb.add('getAiTraffic');
  return seg ? demoTraffic(seg, days) : null;
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------
export async function adaptDigest(businessId: string, fb: Fallbacks): Promise<WeeklyDigest | null> {
  try {
    if (REAL.buildWeeklyDigest) {
      const d = (await REAL.buildWeeklyDigest(businessId)) as WeeklyDigest | null;
      if (d && typeof d.headline === 'string') return d;
    }
  } catch {
    /* repli */
  }
  const seg = segmentOfDemoId(businessId);
  fb.add('buildWeeklyDigest');
  return seg ? demoDigest(seg) : null;
}

/** Extrait de snippet (repli si le module tracking n'expose pas snippetFor). */
export function adaptSnippet(businessId: string): string {
  try {
    if (REAL.snippetFor) {
      const s = REAL.snippetFor(businessId);
      if (typeof s === 'string' && s) return s;
    }
  } catch {
    /* repli */
  }
  return `<script async src="${SITE_URL}/t.js" data-site="${businessId}"></script>`;
}
