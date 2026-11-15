/**
 * Alertes au fondateur par e-mail (ALERT_EMAIL, via Resend : src/lib/email.ts), une par type et par heure au plus.
 * Chaque alerte (envoyée, retenue par l'anti-spam ou sans destinataire) est journalisée dans `ops.alertlog`
 * et visible dans /admin/ops.
 */
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { log } from '@/lib/log';
import { esc, sendEmail, type SendEmailResult } from '@/lib/email';
import { OPS, opsConfig } from './config';

export type OpsAlertKind = 'health_fail' | 'cron_stale' | 'error_spike' | 'jobs_dead' | 'stripe_webhook' | 'cost_cap';

export const ALERT_LABEL: Record<OpsAlertKind, string> = {
  health_fail: 'Santé en échec',
  cron_stale: 'Tâches de fond arrêtées',
  error_spike: "Pic d'erreurs",
  jobs_dead: 'Tâches abandonnées',
  stripe_webhook: 'Webhook Stripe en échec',
  cost_cap: 'Plafond de coût du jour dépassé',
};

export interface OpsAlertEntry {
  kind: OpsAlertKind;
  at: string;
  subject: string;
  lines: string[];
  status: 'sent' | 'logged' | 'throttled' | 'no_recipient' | 'error';
  error?: string;
}

export type Sender = (to: string, subject: string, text: string, html: string) => Promise<SendEmailResult>;

const defaultSender: Sender = (to, subject, text, html) =>
  sendEmail({ to, subject, text, html, kind: 'transactional', tags: [{ name: 'category', value: 'ops_alert' }] });

export interface SendAlertOptions {
  now?: Date;
  send?: Sender;
  env?: Record<string, string | undefined>;
}

/**
 * Envoie une alerte si aucune du même type n'est partie dans l'heure. Ne lève jamais.
 * `lines` : faits courts (sans secret ni donnée personnelle), le premier sert de résumé.
 */
export async function sendOpsAlert(kind: OpsAlertKind, lines: string[], opts: SendAlertOptions = {}): Promise<OpsAlertEntry> {
  const now = opts.now ?? new Date();
  const cfg = opsConfig(opts.env ?? process.env);
  const subject = `[Repéré] ${ALERT_LABEL[kind]}`;
  const entry: OpsAlertEntry = { kind, at: now.toISOString(), subject, lines: lines.slice(0, 20).map((l) => l.slice(0, 500)), status: 'throttled' };
  try {
    const last = (await getDoc<{ lastSentAt?: string }>(OPS.alerts, kind))?.data.lastSentAt;
    if (last && now.getTime() - new Date(last).getTime() < cfg.alertThrottleMin * 60_000) {
      return entry; // retenue : ni e-mail ni ligne de journal (un incident en cours ne remplit pas l'historique)
    }
    if (!cfg.alertEmail) {
      entry.status = 'no_recipient';
      log.warn('ops.alert', { kind, subject, lines: entry.lines, note: 'ALERT_EMAIL absent' });
    } else {
      const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || '').replace(/\/$/, '');
      const link = base ? `${base}/admin/ops` : '/admin/ops';
      const text = `${entry.lines.join('\n')}\n\nTableau de bord : ${link}\nAnti-spam : au plus une alerte « ${ALERT_LABEL[kind]} » par heure.`;
      const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#111">
<p style="font-size:17px;font-weight:bold;margin:0 0 12px">${esc(ALERT_LABEL[kind])}</p>
<ul style="padding-left:18px;margin:0 0 16px">${entry.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<p style="margin:0 0 8px"><a href="${esc(link)}">Ouvrir le tableau de bord des opérations</a></p>
<p style="color:#666;font-size:13px;margin:0">Au plus une alerte de ce type par heure.</p></div>`;
      const r = await (opts.send ?? defaultSender)(cfg.alertEmail, subject, text, html);
      entry.status = r.status === 'sent' ? 'sent' : r.status === 'logged' ? 'logged' : 'error';
      if (r.error) entry.error = r.error.slice(0, 300);
    }
    // L'anti-spam vaut aussi sans destinataire : pas d'avalanche de journaux.
    await putDoc(OPS.alerts, kind, { lastSentAt: entry.at, status: entry.status });
    await putDoc(OPS.alertLog, `${entry.at}-${kind}`, entry);
  } catch (e) {
    entry.status = 'error';
    entry.error = e instanceof Error ? e.message.slice(0, 300) : 'erreur';
  }
  return entry;
}

export async function listOpsAlerts(limit = 30): Promise<OpsAlertEntry[]> {
  return (await listDocs<OpsAlertEntry>(OPS.alertLog, { limit })).map((d) => d.data).sort((a, b) => b.at.localeCompare(a.at));
}
