/**
 * Préférences d'alerte CÔTÉ SERVEUR (remplace le localStorage de Settings.tsx, docs/v3/09-audit-app.md RG1).
 * Collection `notify.prefs`, id = businessId. Lues par `notify()`, le cron des alertes et le digest.
 */
import { getDoc, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';

export const PREFS = 'notify.prefs';

export const NOTIF_TYPES = [
  'audit_done',
  'score_change',
  'milestone',
  'new_competitor',
  'competitor_overtook',
  'fact_error',
  'actions_reminder',
  'weekly_digest',
  'task_done',
  'measure_result',
  'report_sent',
  'integration_error',
  'agent_proposals',
] as const;
export type NotifType = (typeof NOTIF_TYPES)[number];
export const isNotifType = (v: unknown): v is NotifType => typeof v === 'string' && (NOTIF_TYPES as readonly string[]).includes(v);

export const CHANNELS = ['inApp', 'email', 'push', 'slack', 'webhook'] as const;
export type Channel = (typeof CHANNELS)[number];

export const NOTIF_LABELS: Record<NotifType, string> = {
  audit_done: 'Mesure du mois prête',
  score_change: 'Score en hausse ou en baisse (au-delà de la marge)',
  milestone: 'Nouveau palier atteint',
  new_competitor: 'Nouveau concurrent cité',
  competitor_overtook: 'Un concurrent vous dépasse',
  fact_error: 'Une IA donne une information fausse',
  actions_reminder: 'Rappel d’action (au plus tous les 14 jours)',
  weekly_digest: 'Résumé du lundi',
  task_done: 'Tâche faite',
  measure_result: 'Résultat d’une mesure avant/après',
  report_sent: 'Rapport planifié envoyé',
  integration_error: 'Échec d’envoi vers Slack ou un webhook',
  agent_proposals: 'Nouvelles corrections proposées par l’agent (à valider)',
};

/** Types considérés comme des « alertes » (événement `alert.created` vers Slack et webhook). */
export const ALERT_TYPES: NotifType[] = ['score_change', 'milestone', 'new_competitor', 'competitor_overtook', 'fact_error'];

export type ChannelPrefs = Partial<Record<Channel, boolean>>;

export interface AlertPrefs {
  types: Record<NotifType, ChannelPrefs>;
  /** seuil de variation du score, en points, en plus de la marge d'erreur (défaut 5) */
  threshold: number;
  /** copie du résumé du lundi (associé, agence) — 5 adresses max */
  copyTo: string[];
  updatedAt: string | null;
}

const on = (...chs: Channel[]): ChannelPrefs => Object.fromEntries(CHANNELS.map((c) => [c, chs.includes(c)]));

/** Défauts : boucle de rétention (résumé du lundi, « un concurrent vous dépasse », erreur factuelle) active. */
export function defaultPrefs(): AlertPrefs {
  return {
    types: {
      audit_done: on('inApp', 'email', 'slack', 'webhook'),
      score_change: on('inApp', 'email', 'push', 'slack', 'webhook'),
      milestone: on('inApp', 'push', 'slack', 'webhook'),
      new_competitor: on('inApp', 'push', 'slack', 'webhook'),
      competitor_overtook: on('inApp', 'email', 'push', 'slack', 'webhook'),
      fact_error: on('inApp', 'email', 'push', 'slack', 'webhook'),
      actions_reminder: on('inApp', 'email', 'push'),
      weekly_digest: on('email', 'slack'),
      task_done: on('inApp', 'webhook'),
      measure_result: on('inApp', 'email', 'slack', 'webhook'),
      report_sent: on('inApp'),
      integration_error: on('inApp', 'email'),
      agent_proposals: on('inApp', 'email'),
    },
    threshold: 5,
    copyTo: [],
    updatedAt: null,
  };
}

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
export const isEmail = (s: string) => s.length <= 254 && EMAIL_RE.test(s);

/** Fusionne un patch validé avec les préférences existantes (clés inconnues ignorées). */
export function mergePrefs(base: AlertPrefs, patch: unknown): AlertPrefs {
  const out: AlertPrefs = { ...base, types: { ...base.types } };
  if (!patch || typeof patch !== 'object') return out;
  const p = patch as Record<string, unknown>;
  if (p.types && typeof p.types === 'object') {
    for (const [t, chs] of Object.entries(p.types as Record<string, unknown>)) {
      if (!isNotifType(t) || !chs || typeof chs !== 'object') continue;
      const next = { ...out.types[t] };
      for (const [c, v] of Object.entries(chs as Record<string, unknown>)) {
        if ((CHANNELS as readonly string[]).includes(c) && typeof v === 'boolean') next[c as Channel] = v;
      }
      out.types[t] = next;
    }
  }
  if (typeof p.threshold === 'number' && Number.isFinite(p.threshold)) out.threshold = Math.min(30, Math.max(1, Math.round(p.threshold)));
  if (Array.isArray(p.copyTo)) {
    out.copyTo = [...new Set(p.copyTo.filter((e): e is string => typeof e === 'string').map((e) => e.trim().toLowerCase()).filter(isEmail))].slice(0, 5);
  }
  return out;
}

export async function getAlertPrefs(businessId: string): Promise<AlertPrefs> {
  const base = defaultPrefs();
  if (isDemoBusinessId(businessId)) return base;
  const doc = await getDoc<AlertPrefs>(PREFS, businessId);
  return doc ? { ...mergePrefs(base, doc.data), updatedAt: doc.updatedAt } : base;
}

export async function saveAlertPrefs(businessId: string, patch: unknown): Promise<AlertPrefs> {
  const next = mergePrefs(await getAlertPrefs(businessId), patch);
  const saved = await putDoc<AlertPrefs>(PREFS, businessId, { ...next, updatedAt: new Date().toISOString() }, businessId);
  return { ...saved.data, updatedAt: saved.updatedAt };
}

/** Le canal est-il actif pour ce type ? `delta` (points) : le seuil s'applique aux variations de score. */
export function wants(prefs: AlertPrefs, type: NotifType, channel: Channel, opts: { delta?: number } = {}): boolean {
  if (!prefs.types[type]?.[channel]) return false;
  if (type === 'score_change' && typeof opts.delta === 'number' && Math.abs(opts.delta) < prefs.threshold) return false;
  return true;
}

/** Correspondance des types d'alerte V2 (db.AlertType) vers les types de notification. */
export function notifTypeOfAlert(t: string): NotifType | null {
  if (t === 'visibility_change' || t === 'score_up' || t === 'score_down') return 'score_change';
  return isNotifType(t) ? t : null;
}
