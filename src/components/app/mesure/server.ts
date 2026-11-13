/**
 * Chargement commun des écrans Mesure (serveur uniquement) : espace, droits de l'offre, période choisie,
 * repères des courbes. Une seule lecture par requête (loadWorkspace / loadDashboard sont mis en cache).
 */
import type { Business } from '@/lib/db';
import { getEntitlements, TIER_NAMES, type Entitlements } from '@/lib/entitlements';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { listAnnotations, type Annotation } from '@/lib/annotations';
import { listPrompts } from '@/lib/prompts';
import { matchQuery } from '@/lib/prompts/history';
import { loadDashboard } from '../data';
import { loadWorkspace, type Workspace } from '../workspace';
import type { V2Audit } from '../adapters';
import { selectPeriod, type PeriodSelection } from './derive';
import { parseParams, type MesureParams, type RawSearch } from './params';

export interface MesureContext {
  ws: Workspace;
  /** commerce au format base (droits, questions suivies) */
  business: Business;
  ent: Entitlements;
  tierName: string;
  params: MesureParams;
  period: PeriodSelection<V2Audit>;
  sp: RawSearch;
}

export async function loadMesure(searchParams: Promise<RawSearch> | RawSearch): Promise<MesureContext> {
  const sp = await searchParams;
  const ws = await loadWorkspace();
  let business: Business;
  if (ws.demo || isDemoBusinessId(ws.business.id)) {
    // Démo : l'identifiant suffit aux droits (offre « démo ») ; les autres champs viennent de l'espace.
    business = { id: ws.business.id, name: ws.business.name, trade: '', city: '', website: ws.business.website, segment: ws.segment } as unknown as Business;
  } else {
    business = (await loadDashboard()).business;
  }
  const ent = getEntitlements(business);
  const providers = ws.latest?.providersUsed ?? [];
  const params = parseParams(sp, providers.length ? providers : undefined);
  const period = selectPeriod(ws.audits, params.periode, params.vs, ent.historyMonths);
  return { ws, business, ent, tierName: TIER_NAMES[ent.tier], params, period, sp };
}

/** Repères des courbes sur la période (tâches faites, repères manuels). Jamais bloquant. */
export async function loadAnnotations(businessId: string, from: string | null, to: string | null): Promise<Annotation[]> {
  try {
    return await listAnnotations(businessId, { from: from ?? undefined, to: to ?? undefined });
  } catch {
    return [];
  }
}

/** Identifiant de question suivie pour chaque requête d'audit (lien vers l'historique de la question). */
export async function promptIdsByQuery(businessId: string, audits: readonly V2Audit[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  try {
    const prompts = await listPrompts(businessId);
    for (const p of prompts)
      for (const a of audits) {
        const q = matchQuery(p, a);
        if (q && !out.has(q.id)) out.set(q.id, p.id);
      }
  } catch {
    /* sans lien : la page reste utilisable */
  }
  return out;
}
