/**
 * Point d'entrée des notifications : `notify(businessId, {type, title, body, href})`.
 * 1. centre de notifications (si le canal « inApp » est actif pour ce type) ;
 * 2. Slack / webhook signé (événements audit.completed, alert.created, task.done, measure.result) selon les préférences ;
 * 3. e-mail pour les types non couverts par les e-mails existants (le digest et les alertes mensuelles gardent les leurs).
 * Comptes démo : rien n'est écrit ni envoyé.
 */
import { isDemoBusinessId } from '@/lib/demo-v2';
import { getBusinessRecord } from '@/lib/db';
import { appUrl, esc, sendEmail, unsubscribeUrl } from '@/lib/email';
import { dispatchEvent, type EVENTS } from '@/lib/integrations';
import { addNotification, type NotificationInput, type NotificationItem } from './center';
import { ALERT_TYPES, getAlertPrefs, wants, type NotifType } from './prefs';

export * from './center';
export * from './prefs';
export { sendScheduledReport, getSchedule, saveSchedule, confirmRecipient, renderScheduledReport, nextRunAt, ReportError, type ReportSchedule } from './reports';

/** Types déjà envoyés par e-mail par d'autres modules (digest, alertes mensuelles, rapport d'audit). */
const EMAIL_HANDLED_ELSEWHERE: NotifType[] = ['audit_done', 'weekly_digest', 'score_change', 'competitor_overtook', 'fact_error', 'actions_reminder'];

export function eventOfType(type: NotifType): (typeof EVENTS)[number] | null {
  if (type === 'audit_done') return 'audit.completed';
  if (type === 'task_done') return 'task.done';
  if (type === 'measure_result') return 'measure.result';
  if (ALERT_TYPES.includes(type)) return 'alert.created';
  return null;
}

export interface NotifyResult {
  item: NotificationItem | null;
  slack: number;
  webhook: number;
  email: boolean;
}

export async function notify(businessId: string, n: NotificationInput & { delta?: number }): Promise<NotifyResult> {
  const out: NotifyResult = { item: null, slack: 0, webhook: 0, email: false };
  if (isDemoBusinessId(businessId)) return out;
  const prefs = await getAlertPrefs(businessId);
  const opt = { delta: n.delta };
  if (wants(prefs, n.type, 'inApp', opt)) out.item = await addNotification(businessId, n);
  const event = eventOfType(n.type);
  const business = await getBusinessRecord(businessId).catch(() => null);
  if (event) {
    const d = { title: n.title, body: n.body, href: n.href, severity: n.severity, businessName: business?.name, data: n.data };
    const dk = n.dedupeKey;
    try {
      if (wants(prefs, n.type, 'slack', opt)) out.slack = await dispatchEvent(businessId, event, d, { only: ['slack'], dedupeKey: dk });
      if (wants(prefs, n.type, 'webhook', opt)) out.webhook = await dispatchEvent(businessId, event, d, { only: ['webhook'], dedupeKey: dk });
    } catch (e) {
      console.warn('[notify] diffusion impossible', e);
    }
  }
  if (!EMAIL_HANDLED_ELSEWHERE.includes(n.type) && wants(prefs, n.type, 'email', opt) && business?.contactEmail) {
    const to = business.contactEmail;
    const link = n.href && n.href.startsWith('/') && !n.href.startsWith('//') ? `${appUrl()}${n.href}` : `${appUrl()}/app`;
    const r = await sendEmail({
      to,
      subject: n.title.slice(0, 120),
      kind: 'service',
      text: `${n.title}\n\n${n.body ?? ''}\n\n${link}\n\nSe désinscrire : ${unsubscribeUrl(to)}`,
      html: `<p style="font-family:Arial,sans-serif;font-size:16px;font-weight:600">${esc(n.title)}</p><p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5">${esc(n.body ?? '')}</p><p><a href="${esc(link)}">Ouvrir dans Repéré</a></p><p style="font-family:Arial,sans-serif;font-size:12px;color:#5A6275">Notification choisie dans vos réglages. <a href="${esc(unsubscribeUrl(to))}">Se désinscrire</a></p>`,
      tags: [{ name: 'type', value: n.type }],
    }).catch(() => null);
    out.email = !!r && (r.status === 'sent' || r.status === 'logged');
  }
  return out;
}
