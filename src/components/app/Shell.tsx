'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import type { Segment } from '@/lib/engine/types-v2';
import { AppLogo, Icon } from './icons';
import { activeItem, ACCOUNT_NAV, allNav, navGroups, TAB_HREFS, type NavItem } from './nav';
import { BusinessSwitcher } from './shell/BusinessSwitcher';
import { SearchButton } from './shell/CommandPalette';
import { NotificationBell } from './shell/Notifications';
import { ThemeToggle } from './shell/ThemeToggle';
import type { Theme } from './shell/client';
import type { BusinessOption } from './shell/server';

export interface ShellInfo {
  businessId: string;
  businessName: string;
  descriptor: string;
  planLabel: string;
  segment: Segment;
  demo: boolean;
  errors: number;
  openTasks: number;
  /** Tâches de la semaine (id, statut) : le badge « à faire » suit les clics sur « C'est fait » sans attendre le serveur. */
  weekly?: { id: string; status: string }[];
  unread: number;
  theme: Theme;
  businesses: BusinessOption[];
}

const HIDDEN = ['/app/hors-ligne', '/app/connexion'];
/** La boucle du produit : Mesurer → Comprendre → Agir → Prouver (vraie séquence : numérotée dans le menu). */
const LOOP: Record<string, number> = { mesurer: 1, comprendre: 2, agir: 3, prouver: 4 };
const useIsoLayout = typeof window === 'undefined' ? () => {} : useLayoutEffect;

/** Nombre de tâches de la semaine encore à faire, mis à jour en direct (événement « rp:task-status » de useTasks). */
function useOpenTasks(info: ShellInfo): number {
  const [over, setOver] = useState<Record<string, string>>({});
  // Pas de remise à zéro au rafraîchissement serveur : le dernier clic gagne (évite un retour en arrière si la réponse
  // d'un rafraîchissement lancé avant « Annuler » arrive après).
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ id: string; status: string }>).detail;
      if (d?.id) setOver((o) => ({ ...o, [d.id]: d.status }));
    };
    window.addEventListener('rp:task-status', on);
    return () => window.removeEventListener('rp:task-status', on);
  }, []);
  if (!info.weekly) return info.openTasks;
  return info.weekly.filter((t) => {
    const st = over[t.id] ?? t.status;
    return st !== 'done' && st !== 'skipped';
  }).length;
}

function Badge({ n, tone }: { n: number; tone: 'danger' | 'neutral' }) {
  if (!n) return null;
  return (
    <span
      key={n}
      className={`rp-badge rp-badge-tick ${tone === 'danger' ? 'rp-badge-danger' : ''}`}
      title={tone === 'danger' ? (n > 1 ? `${n} erreurs des IA à corriger` : '1 erreur des IA à corriger') : `${n} à faire cette semaine`}
    >
      {n}
      <span className="sr-only">{tone === 'danger' ? (n > 1 ? ' erreurs' : ' erreur') : ' à faire cette semaine'}</span>
    </span>
  );
}

function SideLink({ it, on, info, open }: { it: NavItem; on: boolean; info: ShellInfo; open: number }) {
  return (
    <Link href={it.href} aria-current={on ? 'page' : undefined} className="rp-side-link" aria-keyshortcuts={it.key ? `g ${it.key}` : undefined}>
      <Icon name={it.icon} size={18} />
      <span className="flex-1 truncate">{it.label}</span>
      {it.badge === 'errors' && <Badge n={info.errors} tone="danger" />}
      {it.badge === 'tasks' && <Badge n={open} tone="neutral" />}
    </Link>
  );
}

export function Sidebar({ info }: { info: ShellInfo }) {
  const open = useOpenTasks(info);
  const pathname = usePathname() ?? '/app';
  const hidden = HIDDEN.some((h) => pathname.startsWith(h));
  const groups = navGroups(info.segment);
  const current = activeItem(allNav(info.segment), pathname);
  const navRef = useRef<HTMLElement>(null);
  // Indicateur de rubrique active qui glisse d'un lien à l'autre (transform ; mouvement réduit : fondu seul, voir app-shell.css).
  useIsoLayout(() => {
    const nav = navRef.current;
    const on = nav?.querySelector<HTMLElement>('.rp-side-link[aria-current="page"]');
    if (!nav) return;
    if (!on) {
      nav.removeAttribute('data-ind');
      return;
    }
    nav.style.setProperty('--ind-y', `${on.offsetTop}px`);
    nav.style.setProperty('--ind-h', `${on.offsetHeight}px`);
    // Première pose sans glissement, ensuite on anime.
    requestAnimationFrame(() => nav.setAttribute('data-ind', nav.hasAttribute('data-ind') ? 'move' : 'on'));
  }, [current?.href]);
  // Après les hooks (règles des hooks) : pages sans menu latéral.
  if (hidden) return null;
  return (
    <aside className="rp-side" aria-label="Navigation de l’espace client">
      <div className="rp-side-head flex items-center gap-2 px-4 pb-3 pt-5">
        <Link href="/app" aria-label="Repéré, Lundi" className="flex flex-1 items-center gap-2.5 rounded-lg">
          <AppLogo size={28} />
          <span className="rp-display text-[19px] text-white">Repéré</span>
        </Link>
        <NotificationBell businessId={info.businessId} demo={info.demo} initialUnread={info.unread} />
      </div>
      <div className="rp-side-biz mx-3 mb-2 rounded-xl bg-white/[0.06] px-3 py-2.5">
        <p className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">{info.businessName}</span>
          <span className="flex-none text-[11px] text-[var(--on-deep)]" title={`Offre ${info.planLabel}${info.demo ? ', compte de démonstration' : ''}`}>
            {info.demo ? 'démo' : info.planLabel}
          </span>
        </p>
        <p className="line-clamp-2 text-[12px] leading-snug text-[var(--on-deep)]" title={info.descriptor}>
          {info.descriptor}
        </p>
        <BusinessSwitcher current={info.businessId} options={info.businesses} />
      </div>
      <div className="px-3 pb-2">
        <SearchButton className="rp-side-search" />
      </div>
      <nav ref={navRef} className="rp-side-nav relative flex-1 overflow-y-auto px-2 pb-4" aria-label="Rubriques" data-visite="nav">
        <span className="rp-side-ind" aria-hidden="true" />
        {groups.map((g, gi) => (
          <div key={g.id} className={gi ? 'rp-side-group mt-3' : 'rp-side-group'} data-loop={LOOP[g.id] ? '' : undefined} role="group" aria-labelledby={g.label ? `nav-${g.id}` : undefined}>
            {g.label && (
              <p id={`nav-${g.id}`} className="rp-side-label">
                {LOOP[g.id] ? (
                  <span className="rp-side-step" aria-hidden="true">
                    {LOOP[g.id]}
                  </span>
                ) : null}
                {g.label}
              </p>
            )}
            <ul className="flex flex-col gap-px">
              {g.items.map((it) => (
                <li key={it.href}>
                  <SideLink it={it} on={current?.href === it.href} info={info} open={open} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="flex items-center gap-2 border-t border-white/10 px-2 py-2">
        <ul className="flex min-w-0 flex-1 flex-col gap-px">
          {ACCOUNT_NAV.filter((i) => i.href !== '/app/notifications').map((it) => (
            <li key={it.href}>
              <SideLink it={it} on={current?.href === it.href} info={info} open={open} />
            </li>
          ))}
        </ul>
        <ThemeToggle initial={info.theme} />
      </div>
    </aside>
  );
}

export function TabBar({ info }: { info: ShellInfo }) {
  const open = useOpenTasks(info);
  const pathname = usePathname() ?? '/app';
  if (HIDDEN.some((h) => pathname.startsWith(h))) return null;
  const nav = allNav(info.segment);
  const tabs = TAB_HREFS.map((h) => nav.find((n) => n.href === h)!).filter(Boolean);
  const current = activeItem(nav, pathname);
  const inTabs = tabs.some((t) => t.href === current?.href);
  const plusDot = info.errors > 0 || info.unread > 0;
  return (
    <nav className="rp-tabbar" aria-label="Navigation principale">
      <ul className="grid h-[var(--tabbar-h)] grid-cols-5">
        {tabs.map((t) => {
          const on = current?.href === t.href;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? 'page' : undefined} className="rp-tab">
                <span className="rp-tab-pill">
                  <Icon name={t.icon} size={22} />
                  {t.badge === 'tasks' && open > 0 && <span className="rp-tab-dot" aria-hidden="true" />}
                </span>
                {t.short ?? t.label}
              </Link>
            </li>
          );
        })}
        <li>
          <Link href="/app/plus" aria-current={!inTabs ? 'page' : undefined} className="rp-tab">
            <span className="rp-tab-pill">
              <Icon name="more" size={22} />
              {plusDot && <span className={`rp-tab-dot ${info.errors > 0 ? 'rp-tab-dot-danger' : ''}`} aria-hidden="true" />}
            </span>
            Plus
            {info.unread > 0 && <span className="sr-only">, {info.unread} notification{info.unread > 1 ? 's' : ''} non lue{info.unread > 1 ? 's' : ''}</span>}
          </Link>
        </li>
      </ul>
    </nav>
  );
}

const SEG_OPTIONS: { v: Segment; label: string; name: string }[] = [
  { v: 'local', label: 'Local', name: 'Plomberie Martin' },
  { v: 'pme', label: 'PME', name: 'Paysia' },
  { v: 'ecommerce', label: 'E-commerce', name: 'Maison Sora' },
];

/** Bandeau démo : sélecteur de compte démo (Local, PME, E-commerce), visite guidée, connexion. */
export function DemoBar({ segment }: { segment: Segment }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/app';
  const [pending, start] = useTransition();
  if (HIDDEN.some((h) => pathname.startsWith(h))) return null;
  const pick = (v: Segment) => {
    document.cookie = `rp_demo_segment=${v}; path=/; max-age=2592000; samesite=lax`;
    // Les pages métier n'existent que dans leur parcours : retour au Lundi en changeant de compte.
    const metier = pathname.startsWith('/app/local') || pathname.startsWith('/app/produits');
    start(() => {
      if (metier) router.push('/app');
      router.refresh();
    });
  };
  return (
    <div role="region" aria-label="Mode démo" className="rp-demobar">
      <p className="min-w-0 flex-1 truncate text-[13px] leading-snug" title="Données d’exemple, pas un audit réel. Vos modifications restent sur cet appareil.">
        <strong className="font-semibold">
          <span className="sm:hidden">Démo</span>
          <span className="hidden sm:inline">Compte démo.</span>
        </strong>{' '}
        <span className="text-[var(--warning-ink)]">
          <span className="hidden sm:inline">Données d’exemple, pas un audit réel ; vos modifications restent sur cet appareil.</span>
        </span>
      </p>
      <p className="flex flex-none items-center gap-3 whitespace-nowrap text-[13px]">
        <Link href={`/app?visite=1&segment=${segment}`} className="font-semibold underline underline-offset-2">
          Visite guidée
        </Link>
        <Link href="/inscription" className="hidden font-semibold underline underline-offset-2 sm:inline">
          Créer mon espace
        </Link>
      </p>
      <div role="radiogroup" aria-label="Compte démo" className="rp-seg" aria-busy={pending}>
        {SEG_OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={segment === o.v}
            tabIndex={segment === o.v ? 0 : -1}
            title={o.name}
            aria-label={o.label}
            onClick={() => pick(o.v)}
            onKeyDown={(e) => {
              const i = SEG_OPTIONS.findIndex((x) => x.v === o.v);
              const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
              if (!d) return;
              e.preventDefault();
              const next = (i + d + SEG_OPTIONS.length) % SEG_OPTIONS.length;
              const btns = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button');
              btns?.[next]?.focus();
              pick(SEG_OPTIONS[next].v);
            }}
            className="rp-seg-btn"
          >
            {o.v === 'ecommerce' ? (
              <>
                <span className="hidden sm:inline">E-commerce</span>
                <span className="sm:hidden">E-com</span>
              </>
            ) : (
              o.label
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
