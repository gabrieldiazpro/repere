// Contexte serveur des écrans métiers (Local, Produits) : espace chargé par la coquille + fiche complète du commerce
// + droits de l'offre. Serveur uniquement.
import { getBusinessRecord, type BusinessRecord } from '@/lib/db';
import { getEntitlements, TIER_NAMES, type Entitlements } from '@/lib/entitlements';
import type { Segment } from '@/lib/engine/types-v2';
import { loadWorkspace, type Workspace } from '@/components/app/workspace';

export interface MetierContext {
  ws: Workspace;
  business: BusinessRecord;
  ent: Entitlements;
  tierName: string;
  demo: boolean;
  /** le commerce appartient au parcours demandé */
  inParcours: boolean;
}

export async function loadMetier(parcours: Segment): Promise<MetierContext> {
  const ws = await loadWorkspace();
  const rec = (await getBusinessRecord(ws.business.id).catch(() => null)) ?? fallbackRecord(ws);
  const ent = getEntitlements(rec);
  return { ws, business: rec, ent, tierName: TIER_NAMES[ent.tier], demo: ws.demo, inParcours: ws.segment === parcours };
}

/** Commerce minimal si la fiche complète est illisible (ne devrait pas arriver : l'espace vient d'être lu). */
function fallbackRecord(ws: Workspace): BusinessRecord {
  const [trade, place] = ws.business.descriptor.split(' · ');
  return {
    id: ws.business.id,
    name: ws.business.name,
    trade: trade ?? '',
    city: place ?? '',
    website: ws.business.website || undefined,
    plan: 'free',
    segment: ws.segment,
    lastScore: null,
    createdAt: new Date().toISOString(),
    ownerId: null,
    isActive: true,
    alertThreshold: 5,
  };
}
