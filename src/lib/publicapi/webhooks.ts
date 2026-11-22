/**
 * Webhooks sortants de l'API publique, branchés sur le système d'intégrations existant.
 *
 * - « audit.completed » (nouvelle mesure) : déjà émis par src/lib/notify (type audit_done).
 * - « score.dropped » : calculé ici à la fin d'une mesure (notification audit_done), contre la dernière mesure
 *   COMPARABLE (previousComparable : mêmes questions, au moins 6 jours d'écart), seulement si la baisse dépasse la
 *   marge (intervalles à 90 % disjoints).
 * - « proposal.pending » : à la notification agent_proposals (propositions de l'agent à valider).
 * Le seul consentement est l'abonnement de la cible webhook à l'événement (Réglages › Intégrations) : rien n'est
 * envoyé à une cible qui ne l'a pas coché. Comptes démo : rien (dispatchEvent l'interdit déjà).
 */
import type { AuditResult } from '@/lib/engine/types';
import type { PublicWebhookEvent } from './webhook-events';

export interface ScoreDrop {
  from: { score: number; low: number; high: number };
  to: { score: number; low: number; high: number };
  delta: number;
}

const rangeOf = (a: Pick<AuditResult, 'score' | 'range'>) => ({ score: a.score, low: a.range?.low ?? a.score, high: a.range?.high ?? a.score });

/** Baisse au-delà de la marge : nouveau score plus bas ET intervalle entièrement sous l'ancien. null sinon. */
export function scoreDropBeyondMargin(prev: Pick<AuditResult, 'score' | 'range'> | null, cur: Pick<AuditResult, 'score' | 'range'>): ScoreDrop | null {
  if (!prev) return null;
  const from = rangeOf(prev);
  const to = rangeOf(cur);
  if (to.score >= from.score || to.high >= from.low) return null;
  return { from, to, delta: to.score - from.score };
}

export interface ExtraEvent {
  event: PublicWebhookEvent;
  title: string;
  body: string;
  href: string;
  severity: 'critique' | 'important' | 'info';
  data: Record<string, unknown>;
}

export interface NotificationLike {
  type: string;
  dedupeKey?: string;
}

/** Dépendances injectables (tests). */
export interface WebhookDeps {
  listAudits(businessId: string): Promise<AuditResult[]>;
  listPendingProposals(businessId: string): Promise<{ id: string }[]>;
}

async function defaultDeps(): Promise<WebhookDeps> {
  return {
    async listAudits(id) {
      const { listAuditsForBusiness } = await import('@/lib/db');
      return listAuditsForBusiness(id);
    },
    async listPendingProposals(id) {
      const { listChangeSets } = await import('@/lib/publish');
      return listChangeSets(id, { status: ['proposed'] });
    },
  };
}

/** Événements supplémentaires à diffuser pour une notification (vide le plus souvent). Ne lève jamais. */
export async function extraWebhookEvents(businessId: string, n: NotificationLike, deps?: Partial<WebhookDeps>): Promise<ExtraEvent[]> {
  try {
    const d = { ...(await defaultDeps()), ...(deps ?? {}) };
    if (n.type === 'audit_done') {
      const { previousComparable } = await import('@/lib/digest/stats');
      const audits = [...(await d.listAudits(businessId))].sort((a, b) => (a.measuredAt || a.createdAt).localeCompare(b.measuredAt || b.createdAt));
      const cur = audits.at(-1);
      if (!cur) return [];
      type A = Parameters<typeof previousComparable>[0][number];
      const prev = previousComparable(audits as unknown as A[]) as unknown as AuditResult | null;
      const drop = scoreDropBeyondMargin(prev, cur);
      if (!drop) return [];
      return [
        {
          event: 'score.dropped',
          title: `Score en baisse : ${drop.from.score} → ${drop.to.score}`,
          body: `Baisse au-delà de la marge d’erreur (avant ${drop.from.low}–${drop.from.high}, maintenant ${drop.to.low}–${drop.to.high}).`,
          href: '/app',
          severity: 'important',
          data: { ...drop, measurementId: cur.id, previousMeasurementId: prev?.id ?? null },
        },
      ];
    }
    if (n.type === 'agent_proposals') {
      const pending = await d.listPendingProposals(businessId);
      if (!pending.length) return [];
      return [
        {
          event: 'proposal.pending',
          title: pending.length > 1 ? `${pending.length} corrections proposées par l’agent, à valider` : '1 correction proposée par l’agent, à valider',
          body: 'Rien n’est publié sans la validation d’un humain dans l’app.',
          href: '/app/agent',
          severity: 'info',
          data: { pending: pending.length, proposalIds: pending.slice(0, 20).map((p) => p.id) },
        },
      ];
    }
  } catch {
    /* jamais bloquant pour la notification d'origine */
  }
  return [];
}
