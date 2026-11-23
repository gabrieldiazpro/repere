// Pilote automatique (V10, PILOTE-AUTO) : données de l'écran /app/agent/pilote, côté serveur uniquement.
// Compte réel : mandat, état et journal du pilote (@/lib/autopilot), mise en route (connexion, fiche, mandat).
// Compte démo : exemple étiqueté (entreprise fictive), actions simulées dans le navigateur.
import { cache } from 'react';
import { requireBusiness } from '@/lib/auth';
import { getBusinessRecord } from '@/lib/db';
import { getEntitlements } from '@/lib/entitlements';
import { isRegulatedTrade } from '@/lib/regulated';
import type { Mandate } from '@/lib/autopilot/mandate';
import type { AutopilotJournalEntry, AutopilotState } from '@/lib/autopilot/store';
import { loadWorkspace } from '../workspace';
import type { ViewerRole } from './model';

export interface PiloteData {
  businessId: string;
  demo: boolean;
  role: ViewerRole;
  name: string;
  site: string;
  segment: 'local' | 'pme' | 'ecommerce';
  /** l'offre Pilote automatique est active sur cet espace */
  offer: boolean;
  regulated: boolean;
  mandate: Mandate | null;
  state: AutopilotState;
  journal: AutopilotJournalEntry[];
  setup: { connected: string[]; fiche: boolean; ficheAt: string | null; mandate: boolean };
  limits: { series: number; contents: number };
  used: number;
  /** propositions de l'agent hors mandat, en attente de validation */
  waiting: number;
  loadError: boolean;
}

async function roleOf(businessId: string): Promise<ViewerRole> {
  try {
    return (await requireBusiness(null, businessId)).role as ViewerRole;
  } catch {
    return 'viewer';
  }
}

export const loadPilote = cache(async (): Promise<PiloteData> => {
  const ws = await loadWorkspace();
  const businessId = ws.business.id;
  const segment = ws.segment === 'pme' || ws.segment === 'ecommerce' ? ws.segment : 'local';
  const site = ws.business.website ? `https://${ws.business.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : '';
  if (ws.demo) {
    const { demoAutopilot } = await import('@/lib/autopilot/demo');
    const v = demoAutopilot(businessId, segment);
    return {
      businessId,
      demo: true,
      role: 'demo',
      name: ws.business.name,
      site: site || 'https://exemple-demo.example',
      segment,
      offer: true,
      regulated: false,
      mandate: v.mandate,
      state: v.state,
      journal: v.journal,
      setup: { connected: [segment === 'ecommerce' ? 'Shopify' : 'WordPress'], fiche: true, ficheAt: v.mandate?.signedAt ?? null, mandate: true },
      limits: { series: 20, contents: 2 },
      used: v.state.series.filter((s) => s.appliedAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length,
      waiting: 2,
      loadError: false,
    };
  }
  let loadError = false;
  const safe = async <T,>(p: Promise<T>, fb: T): Promise<T> => {
    try {
      return await p;
    } catch {
      loadError = true;
      return fb;
    }
  };
  const [{ getMandate, getState, listAutopilotJournal }, publish, fiche, rec, role] = await Promise.all([
    import('@/lib/autopilot/store'),
    import('@/lib/publish/service'),
    import('@/lib/execution/fiche'),
    getBusinessRecord(businessId).catch(() => null),
    roleOf(businessId),
  ]);
  const ent = rec ? getEntitlements(rec) : null;
  const [mandate, state, journal, conns, f, sets, used] = await Promise.all([
    safe(getMandate(businessId), null),
    safe(getState(businessId), { businessId, series: [], contents: [], updatedAt: '' } as AutopilotState),
    safe(listAutopilotJournal(businessId, 60), []),
    safe(publish.listConnectionViews(businessId), []),
    safe(fiche.getFiche(businessId), null),
    safe(publish.listChangeSets(businessId, { limit: 300 }), []),
    safe(publish.countAppliedThisMonth(businessId), 0),
  ]);
  const { PLATFORM_LABEL } = await import('@/lib/publish/types');
  return {
    businessId,
    demo: false,
    role,
    name: ws.business.name,
    site,
    segment,
    offer: !!ent?.autopilot,
    regulated: isRegulatedTrade(rec?.trade),
    mandate,
    state,
    journal: journal.reverse(),
    setup: {
      connected: conns.filter((c) => c.lastTest?.ok && c.platform !== 'export').map((c) => PLATFORM_LABEL[c.platform]),
      fiche: !!f?.confirmedAt,
      ficheAt: f?.confirmedAt ?? null,
      mandate: !!mandate && mandate.status !== 'revoked',
    },
    limits: { series: ent?.publish.changeSetsPerMonth ?? 0, contents: ent?.contentsPerMonth ?? 0 },
    used,
    waiting: sets.filter((c) => c.status === 'proposed').length,
    loadError,
  };
});
