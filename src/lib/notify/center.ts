/**
 * Centre de notifications (cloche) : collection `notify.items`, lu / non lu, historique.
 * Bas niveau (pas d'envoi externe) : `notify()` (index.ts) ajoute la diffusion Slack / webhook.
 */
import crypto from 'node:crypto';
import { getDoc, listDocs, putDoc } from '@/lib/store';
import { isDemoBusinessId } from '@/lib/demo-v2';
import { buildDemoWorkspaceById } from '@/lib/demo-v2';
import { detectAlerts, type AuditV2 } from '@/lib/alerts';
import { previousComparable } from '@/lib/digest/stats';
import { notifTypeOfAlert, type NotifType } from './prefs';

export const ITEMS = 'notify.items';

export type Severity = 'critique' | 'important' | 'info';

export interface NotificationInput {
  type: NotifType;
  title: string;
  body?: string;
  /** lien interne de l'app (commence par « / ») */
  href?: string;
  severity?: Severity;
  data?: Record<string, unknown>;
  /** évite les doublons (même clé = même notification) */
  dedupeKey?: string;
}

export interface NotificationItem {
  id: string;
  businessId: string;
  type: NotifType;
  title: string;
  body: string;
  href: string | null;
  severity: Severity;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  data?: Record<string, unknown>;
  demo?: boolean;
}

/** N'accepte que des liens internes (« /app/… »), jamais « //hôte » ni « javascript: ». */
export function safeHref(href: string | undefined | null): string | null {
  if (!href || typeof href !== 'string') return null;
  if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/\\') || href.length > 300) return null;
  return href;
}

const clean = (s: string | undefined, max: number) => (s ?? '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, max);

export function notificationId(businessId: string, dedupeKey?: string): string {
  return dedupeKey ? `n_${crypto.createHash('sha256').update(`${businessId}:${dedupeKey}`).digest('hex').slice(0, 20)}` : `n_${crypto.randomUUID()}`;
}

/** Enregistre une notification (sans diffusion). Comptes démo : jamais d'écriture, renvoie null. */
export async function addNotification(businessId: string, n: NotificationInput, now: Date = new Date()): Promise<NotificationItem | null> {
  if (isDemoBusinessId(businessId)) return null;
  const id = notificationId(businessId, n.dedupeKey);
  if (n.dedupeKey) {
    const prev = await getDoc<NotificationItem>(ITEMS, id);
    if (prev) return prev.data;
  }
  const item: NotificationItem = {
    id,
    businessId,
    type: n.type,
    title: clean(n.title, 160) || 'Notification',
    body: clean(n.body, 1000),
    href: safeHref(n.href),
    severity: n.severity ?? 'info',
    read: false,
    readAt: null,
    createdAt: now.toISOString(),
    ...(n.data ? { data: n.data } : {}),
  };
  await putDoc<NotificationItem>(ITEMS, id, item, businessId);
  return item;
}

export async function listNotifications(
  businessId: string,
  opts: { unreadOnly?: boolean; limit?: number; now?: Date } = {},
): Promise<{ items: NotificationItem[]; unread: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let all: NotificationItem[];
  if (isDemoBusinessId(businessId)) all = demoNotifications(businessId, opts.now);
  else {
    const docs = await listDocs<NotificationItem>(ITEMS, { businessId, limit: 1000 });
    all = docs.map((d) => d.data).filter((n) => n.businessId === businessId);
  }
  all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = all.filter((n) => !n.read).length;
  return { items: (opts.unreadOnly ? all.filter((n) => !n.read) : all).slice(0, limit), unread };
}

/** Marque comme lues (`ids`) ou toutes (`'all'`). `read: false` pour remettre en non lu. Renvoie le nombre modifié. */
export async function markNotifications(businessId: string, ids: string[] | 'all', read = true, now: Date = new Date()): Promise<number> {
  if (isDemoBusinessId(businessId)) return 0;
  const docs = await listDocs<NotificationItem>(ITEMS, { businessId, limit: 1000 });
  const want = ids === 'all' ? null : new Set(ids);
  let n = 0;
  for (const d of docs) {
    const it = d.data;
    if (it.businessId !== businessId || (want && !want.has(it.id)) || it.read === read) continue;
    await putDoc<NotificationItem>(ITEMS, it.id, { ...it, read, readAt: read ? now.toISOString() : null }, businessId);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Démo : notifications dérivées des données démo (jamais stockées, étiquetées)
// ---------------------------------------------------------------------------
export function demoNotifications(businessId: string, now: Date = new Date()): NotificationItem[] {
  const ws = buildDemoWorkspaceById(businessId);
  if (!ws || !ws.audits.length) return [];
  const last = ws.audits[ws.audits.length - 1] as AuditV2;
  // Alertes d'écart : contre la dernière mesure comparable seulement (mêmes questions, ≥ 6 jours).
  const prev = previousComparable(ws.audits as AuditV2[]);
  const at = (last.measuredAt || last.createdAt) as string;
  const base = (id: string, createdAt: string, read: boolean) => ({ id: `n_demo_${businessId}_${id}`, businessId, read, readAt: read ? createdAt : null, createdAt, demo: true });
  const items: NotificationItem[] = [
    {
      ...base('audit', at, true),
      type: 'audit_done',
      title: `Mesure du ${new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} prête : ${Math.round(last.score)}/100`,
      body: 'Données de démonstration.',
      href: '/app',
      severity: 'info',
    },
  ];
  let i = 0;
  for (const a of detectAlerts(prev, last, ws.facts)) {
    const type = notifTypeOfAlert(a.type);
    if (!type) continue;
    const createdAt = new Date(Date.parse(at) + (++i) * 60_000).toISOString();
    items.push({ ...base(`alert${i}`, createdAt, false), type, title: a.title, body: a.body, href: a.type === 'fact_error' ? '/app/verite' : '/app/concurrents', severity: a.severity, data: a.payload });
  }
  void now;
  return items;
}
