'use client';
// Centre de notifications : cloche (barre latérale, avec panneau) et liste complète (/app/notifications).
// Données : GET /api/notifications ; lu / non lu : POST /api/notifications (refusé sur les comptes démo → gardé
// sur l'appareil, avec la mention « démo »).
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { NotificationItem } from '@/lib/notify';
import { Icon } from '../icons';
import { toast } from './client';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageIntro } from '@/components/ui/PageIntro';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Tabs } from '@/components/ui/Tabs';

const DEMO_READ_KEY = 'rp_demo_notif_read';

function demoRead(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DEMO_READ_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}
function saveDemoRead(s: Set<string>) {
  try {
    localStorage.setItem(DEMO_READ_KEY, JSON.stringify([...s].slice(-300)));
  } catch {
    /* stockage indisponible */
  }
}

export function relTime(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return '';
  const m = Math.round((now - d) / 60_000);
  if (m < 1) return 'à l’instant';
  if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  if (j < 7) return `il y a ${j} jour${j > 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
}

export function useNotifications(businessId: string, demo: boolean, initialUnread: number) {
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [unread, setUnread] = useState(initialUnread);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const r = await fetch(`/api/notifications?businessId=${encodeURIComponent(businessId)}&limit=50`, { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { items: NotificationItem[]; unread: number };
      let list = j.items ?? [];
      if (demo) {
        const read = demoRead();
        list = list.map((n) => (read.has(n.id) ? { ...n, read: true } : n));
      }
      setItems(list);
      setUnread(list.filter((n) => !n.read).length);
    } catch {
      setError(true);
    }
  }, [businessId, demo]);

  const mark = useCallback(
    async (ids: string[] | 'all', read = true) => {
      const target = ids === 'all' ? (items ?? []).map((n) => n.id) : ids;
      setItems((l) => (l ? l.map((n) => (target.includes(n.id) ? { ...n, read } : n)) : l));
      setUnread((u) => {
        const changed = (items ?? []).filter((n) => target.includes(n.id) && n.read !== read).length;
        return Math.max(0, u + (read ? -changed : changed));
      });
      if (demo) {
        const s = demoRead();
        for (const id of target) {
          if (read) s.add(id);
          else s.delete(id);
        }
        saveDemoRead(s);
        return;
      }
      try {
        const r = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, ids, read }),
        });
        if (!r.ok) throw new Error();
      } catch {
        toast({ text: 'Le changement n’a pas été enregistré. Réessayez.', tone: 'error' });
        void load();
      }
    },
    [businessId, demo, items, load],
  );

  return { items, unread, error, load, mark };
}

const SEV_CLASS: Record<string, string> = {
  critique: 'bg-[var(--danger-bg)] text-[var(--danger-ink)]',
  important: 'bg-[var(--warning-bg)] text-[var(--warning-ink)]',
  info: 'bg-[var(--primary-bg)] text-[var(--primary)]',
};

function Row({ n, onOpen, onToggle }: { n: NotificationItem; onOpen: () => void; onToggle?: () => void }) {
  const body = (
    <>
      <span className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg ${SEV_CLASS[n.severity] ?? SEV_CLASS.info}`} aria-hidden="true">
        <Icon name={n.severity === 'critique' ? 'alert' : n.type === 'audit_done' ? 'check' : 'bell'} size={15} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[14px] leading-snug ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
        {n.body && <span className="block text-[13px] leading-snug text-[var(--muted)]">{n.body}</span>}
        <span className="mt-0.5 block text-[12px] text-[var(--muted)]">
          {relTime(n.createdAt)}
          {n.demo ? ' · démo' : ''}
        </span>
      </span>
      <span className="rp-dot rp-notif-dot mt-2" data-read={n.read ? '' : undefined} aria-label={n.read ? undefined : 'Non lue'} role={n.read ? undefined : 'img'} aria-hidden={n.read ? true : undefined} />
    </>
  );
  return (
    <li className="rp-notif" data-sev={n.severity} data-read={n.read ? '' : undefined}>
      {n.href ? (
        <Link href={n.href} onClick={onOpen} className="rp-notif-main">
          {body}
        </Link>
      ) : (
        <div className="rp-notif-main">{body}</div>
      )}
      {onToggle && (
        <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm self-center" onClick={onToggle}>
          {n.read ? 'Marquer non lue' : 'Marquer lue'}
        </button>
      )}
    </li>
  );
}

export function NotificationBell({ businessId, demo, initialUnread }: { businessId: string; demo: boolean; initialUnread: number }) {
  const { items, unread, error, load, mark } = useNotifications(businessId, demo, initialUnread);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    void load();
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, load]);

  return (
    <div ref={wrap} className="relative">
      <button
        ref={btn}
        type="button"
        className="rp-side-icon"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={unread ? `Notifications, ${unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="rp-bell-count rp-num" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div id={panelId} role="region" aria-label="Notifications récentes" className="rp-pop">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--hair)] px-4 py-2.5">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button type="button" className="rp-link text-[13px]" onClick={() => void mark('all')}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {error ? (
              <p className="px-4 py-5 text-[14px]">
                Les notifications n’ont pas pu être chargées.{' '}
                <button type="button" className="rp-link" onClick={() => void load()}>
                  Réessayer
                </button>
              </p>
            ) : !items ? (
              <div className="flex flex-col gap-2 p-4" aria-busy="true" aria-label="Chargement">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="rp-skel h-12" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-5 text-[14px] text-[var(--muted)]">
                Rien de neuf. Vous serez prévenu ici dès qu’une mesure se termine, qu’un concurrent passe devant ou qu’une IA se trompe sur vous.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--hair)]">
                {items.slice(0, 6).map((n) => (
                  <Row
                    key={n.id}
                    n={n}
                    onOpen={() => {
                      if (!n.read) void mark([n.id]);
                      setOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
          <Link href="/app/notifications" className="block border-t border-[var(--hair)] px-4 py-2.5 text-center text-[13px] font-semibold text-[var(--primary)]" onClick={() => setOpen(false)}>
            Toutes les notifications
          </Link>
        </div>
      )}
    </div>
  );
}

/** Regroupe par fraîcheur (aujourd'hui, 7 derniers jours, plus tôt), heure de Paris. */
export function groupByDay(items: NotificationItem[], now = Date.now()): { key: string; label: string; items: NotificationItem[] }[] {
  const day = (t: number) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const today = day(now);
  const groups = [
    { key: 'today', label: 'Aujourd’hui', items: [] as NotificationItem[] },
    { key: 'week', label: 'Cette semaine', items: [] as NotificationItem[] },
    { key: 'older', label: 'Plus tôt', items: [] as NotificationItem[] },
  ];
  for (const n of items) {
    const t = new Date(n.createdAt).getTime();
    if (day(t) === today) groups[0].items.push(n);
    else if (now - t < 7 * 86_400_000) groups[1].items.push(n);
    else groups[2].items.push(n);
  }
  return groups.filter((g) => g.items.length);
}

const SEV_RANK: Record<string, number> = { critique: 0, important: 1, info: 2 };

/** La notification non lue la plus importante (gravité, puis la plus récente). */
export function mostUrgent(items: NotificationItem[]): NotificationItem | null {
  return items.filter((n) => !n.read).sort((a, b) => (SEV_RANK[a.severity] ?? 3) - (SEV_RANK[b.severity] ?? 3) || b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function NotificationCenter({ businessId, demo, initial }: { businessId: string; demo: boolean; initial?: NotificationItem[] | null }) {
  const { items: loaded, unread: liveUnread, error, load, mark } = useNotifications(businessId, demo, initial ? initial.filter((n) => !n.read).length : 0);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  useEffect(() => {
    void load();
  }, [load]);
  // Rendu serveur avec la liste initiale (pas d'écran vide), puis l'état lu / non lu de cet appareil (démo) prend le relais.
  const items = loaded ?? initial ?? null;
  const unread = loaded ? liveUnread : (initial ?? []).filter((n) => !n.read).length;
  const shown = (items ?? []).filter((n) => filter === 'all' || !n.read);
  const top = items ? mostUrgent(items) : null;
  const critical = (items ?? []).filter((n) => !n.read && n.severity === 'critique').length;

  return (
    <div className="flex flex-col gap-5">
      {items && !error && (
        <PageIntro
          as="p"
          tone={critical ? 'down' : unread ? undefined : 'up'}
          status={
            unread ? (
              <StatusBadge tone={critical ? 'down' : 'warn'}>{critical ? `${critical} urgente${critical > 1 ? 's' : ''}` : 'À lire'}</StatusBadge>
            ) : (
              <StatusBadge tone="up">À jour</StatusBadge>
            )
          }
          result={unread ? `${unread} notification${unread > 1 ? 's' : ''} à lire` : 'Vous avez tout lu'}
          subtitle={top ? <>La plus importante : {top.title}</> : 'Vous serez prévenu ici à la fin de chaque mesure, si un concurrent passe devant ou si une IA se trompe sur vous.'}
          primary={
            top?.href ? (
              <Link href={top.href} className="ui-btn" data-variant="primary" onClick={() => void mark([top.id])}>
                Voir le détail
              </Link>
            ) : undefined
          }
          secondary={
            unread > 0 ? (
              <button type="button" className="ui-btn" data-variant="ghost" onClick={() => void mark('all')}>
                Tout marquer comme lu
              </button>
            ) : (
              <Link href="/app/reglages#alertes" className="rp-link text-[14px]">
                Choisir mes alertes
              </Link>
            )
          }
        />
      )}
      <section className="ui-card" aria-labelledby="notif-h">
        <div className="ui-card-head flex-wrap">
          <h2 id="notif-h" className="sr-only">
            Liste des notifications
          </h2>
          <Tabs
            label="Filtrer les notifications"
            variant="pill"
            idBase="notif"
            value={filter}
            onChange={(v) => setFilter(v as 'all' | 'unread')}
            items={[
              { id: 'all', label: 'Toutes', count: items?.length },
              { id: 'unread', label: 'Non lues', count: unread },
            ]}
          />
          {demo && <p className="ui-caption ml-auto">Démo : lu / non lu gardé sur cet appareil.</p>}
        </div>
        <div role="tabpanel" id="notif-panel" className="ui-tabpanel ui-card-body" key={filter}>
          {error && !items ? (
            <p className="text-[14px]">
              Les notifications n’ont pas pu être chargées.{' '}
              <button type="button" className="rp-link" onClick={() => void load()}>
                Réessayer
              </button>
            </p>
          ) : !items ? (
            <div className="flex flex-col gap-2" aria-busy="true" aria-label="Chargement">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="rp-skel h-14" />
              ))}
            </div>
          ) : shown.length === 0 ? (
            <EmptyState
              compact
              icon={<Icon name="bell" size={20} />}
              title={filter === 'unread' ? 'Aucune notification non lue' : 'Aucune notification pour le moment'}
              action={
                filter === 'unread' ? (
                  <button type="button" className="ui-btn" onClick={() => setFilter('all')}>
                    Voir toutes les notifications
                  </button>
                ) : (
                  <Link href="/app/reglages#alertes" className="ui-btn">
                    Choisir mes alertes
                  </Link>
                )
              }
            >
              {filter === 'unread' ? 'Vous avez tout lu.' : 'Fin de mesure, concurrent qui passe devant, erreur d’une IA : tout arrivera ici.'}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4">
              {groupByDay(shown).map((g) => (
                <div key={g.key}>
                  <h3 className="ui-caption mb-1 px-1 font-semibold text-[var(--muted)]">{g.label}</h3>
                  <ul className="-mx-2 divide-y divide-[var(--hair)]">
                    {g.items.map((n) => (
                      <Row key={n.id} n={n} onOpen={() => !n.read && void mark([n.id])} onToggle={() => void mark([n.id], !n.read)} />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
