/** État public par service (page /statut) : mesures automatiques + incidents déclarés par l'admin. */
import type { HealthReport, Level } from './health';
import { SERVICES, type Incident, type ServiceId } from './incidents';

export type PublicState = 'operationnel' | 'perturbe' | 'panne' | 'maintenance' | 'inactif';

export const STATE_LABEL: Record<PublicState, string> = {
  operationnel: 'Opérationnel',
  perturbe: 'Perturbations',
  panne: 'Panne',
  maintenance: 'Maintenance',
  inactif: 'Pas encore activé',
};

export interface ServiceStatus {
  id: ServiceId;
  label: string;
  state: PublicState;
}

const RANK: Record<PublicState, number> = { inactif: 0, operationnel: 1, maintenance: 2, perturbe: 3, panne: 4 };
const fromLevel = (l: Level): PublicState => (l === 'fail' ? 'panne' : l === 'warn' ? 'perturbe' : 'operationnel');
const worst = (a: PublicState, b: PublicState) => (RANK[b] > RANK[a] ? b : a);

export function serviceStatuses(h: HealthReport | null, incidents: Incident[]): ServiceStatus[] {
  const auto: Record<ServiceId, PublicState> = {
    site: 'operationnel',
    analyses: h ? worst(fromLevel(h.checks.jobs), h.checks.cron === 'ok' ? 'operationnel' : 'perturbe') : 'operationnel',
    paiement: h && !h.configured.stripe ? 'inactif' : 'operationnel',
    emails: h && !h.configured.resend ? 'inactif' : 'operationnel',
    donnees: h ? fromLevel(h.checks.db) : 'operationnel',
  };
  for (const inc of incidents) {
    if (inc.status !== 'en_cours') continue;
    const s: PublicState = inc.impact === 'majeur' ? 'panne' : inc.impact === 'maintenance' ? 'maintenance' : 'perturbe';
    for (const id of inc.services) auto[id] = worst(auto[id] === 'inactif' ? 'operationnel' : auto[id], s);
  }
  return (Object.keys(SERVICES) as ServiceId[]).map((id) => ({ id, label: SERVICES[id], state: auto[id] }));
}

export function overallState(list: ServiceStatus[]): PublicState {
  return list.reduce<PublicState>((acc, s) => (s.state === 'inactif' ? acc : worst(acc, s.state)), 'operationnel');
}
