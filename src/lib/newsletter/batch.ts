/**
 * Envoi d'un numéro par lots, toujours déclenché par l'administrateur (un clic = un lot). Rien n'est planifié.
 * Reprise sans doublon : chaque (numéro, abonné) envoyé est enregistré dans `newsletter.deliveries`.
 */
import type { SendEmailResult } from '@/lib/email';
import { getEntry, type TimelineItem, type VeilleEntry } from '@/lib/veille';
import { sendIssueEmail, type RenderIssueInput } from './emails';
import { issueDeadlines, todayParis } from './issue';
import { getDelivery, getIssue, listSubscribers, recordDelivery, saveIssue, type NewsletterIssue } from './store';

export const DEFAULT_BATCH = 50;
export const MAX_BATCH = 200;

export interface BatchDeps {
  send: (input: RenderIssueInput) => Promise<SendEmailResult>;
  /** Pause entre deux envois (ms), pour ménager le fournisseur d'envoi. */
  pauseMs: number;
  today: () => string;
}

const defaultDeps: BatchDeps = { send: sendIssueEmail, pauseMs: 120, today: () => todayParis() };

export interface BatchResult {
  ok: boolean;
  reason?: 'introuvable' | 'deja-envoye' | 'vide' | 'confirmation' | 'aucun-destinataire';
  attempted: number;
  sent: number;
  failed: number;
  remaining: number;
  issue?: NewsletterIssue;
}

/** Abonnés actifs qui n'ont pas encore reçu ce numéro. */
export async function pendingRecipients(issueId: string) {
  const subs = (await listSubscribers()).filter((s) => s.status === 'active');
  const out: typeof subs = [];
  for (const s of subs) if (!(await getDelivery(issueId, s.id))) out.push(s);
  return out;
}

/**
 * Envoie le lot suivant. `confirmCount` doit être égal au nombre d'abonnés restants affiché à l'administrateur au
 * moment du clic : si la liste a changé entre-temps, rien ne part et l'administrateur revoit le chiffre.
 */
export async function sendNextBatch(
  issueId: string,
  opts: { size?: number; confirmCount: number },
  deps: Partial<BatchDeps> = {},
): Promise<BatchResult> {
  const d = { ...defaultDeps, ...deps };
  const issue = await getIssue(issueId);
  if (!issue) return { ok: false, reason: 'introuvable', attempted: 0, sent: 0, failed: 0, remaining: 0 };
  if (issue.status === 'sent') return { ok: false, reason: 'deja-envoye', attempted: 0, sent: 0, failed: 0, remaining: 0, issue };
  const entries = issue.entrySlugs.map((s) => getEntry(s)).filter((e): e is VeilleEntry => Boolean(e));
  if (!entries.length) return { ok: false, reason: 'vide', attempted: 0, sent: 0, failed: 0, remaining: 0, issue };

  const pending = await pendingRecipients(issueId);
  if (!pending.length) return { ok: false, reason: 'aucun-destinataire', attempted: 0, sent: 0, failed: 0, remaining: 0, issue };
  if (opts.confirmCount !== pending.length) {
    return { ok: false, reason: 'confirmation', attempted: 0, sent: 0, failed: 0, remaining: pending.length, issue };
  }
  const size = Math.max(1, Math.min(MAX_BATCH, Math.floor(opts.size ?? DEFAULT_BATCH)));
  const batch = pending.slice(0, size);
  const deadlines: TimelineItem[] = issueDeadlines(d.today());

  let sent = 0;
  let failed = 0;
  for (const [i, s] of batch.entries()) {
    let r: SendEmailResult;
    try {
      r = await d.send({ issue, entries, deadlines, to: s.email });
    } catch (e) {
      r = { id: null, status: 'error', error: e instanceof Error ? e.message : String(e) };
    }
    // Une erreur n'est pas enregistrée comme livrée : l'adresse sera retentée au lot suivant.
    if (r.status === 'error') failed++;
    else {
      sent++;
      await recordDelivery({ issueId, subscriberId: s.id, status: r.status, at: new Date().toISOString(), error: r.error });
    }
    if (d.pauseMs > 0 && i < batch.length - 1) await new Promise((res) => setTimeout(res, d.pauseMs));
  }
  const remaining = pending.length - sent;
  const now = new Date().toISOString();
  const next = await saveIssue({
    ...issue,
    status: remaining === 0 ? 'sent' : 'sending',
    sentCount: issue.sentCount + sent,
    failedCount: issue.failedCount + failed,
    lastBatchAt: now,
    ...(remaining === 0 ? { sentAt: now } : {}),
  });
  return { ok: true, attempted: batch.length, sent, failed, remaining, issue: next };
}
