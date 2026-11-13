import Link from 'next/link';
import { Icon } from '@/components/app/icons';
import { ACCOUNT_NAV, navGroups, TAB_HREFS } from '@/components/app/nav';
import { PageHeader } from '@/components/app/PageHeader';
import { SearchButton } from '@/components/app/shell/CommandPalette';
import { loadUnread, themePref } from '@/components/app/shell/server';
import { ThemeToggle } from '@/components/app/shell/ThemeToggle';
import { loadWorkspace } from '@/components/app/workspace';

export const metadata = { title: 'Plus' };

/** Page « Plus » (mobile) : toutes les rubriques hors onglets, regroupées comme la barre latérale. */
export default async function PlusPage() {
  const ws = await loadWorkspace();
  const [unread, theme] = await Promise.all([loadUnread(ws.business.id), themePref()]);
  const errors = ws.latest?.factCheck?.errors ?? 0;
  const groups = navGroups(ws.segment)
    .map((g) => ({ ...g, items: g.items.filter((n) => !TAB_HREFS.includes(n.href)) }))
    .filter((g) => g.items.length);
  groups.push({ id: 'compte', label: 'Compte', items: ACCOUNT_NAV });
  return (
    <>
      <PageHeader title="Plus" meta={ws.business.name} />
      <div className="rp-page">
        <SearchButton className="rp-btn w-full justify-start" />
        {groups.map((g) => (
          <section key={g.id} aria-labelledby={`plus-${g.id}`}>
            <h2 id={`plus-${g.id}`} className="mb-1.5 px-1 text-[13px] font-semibold text-[var(--muted)]">
              {g.label ?? 'Assistant'}
            </h2>
            <ul className="rp-panel divide-y divide-[var(--hair)] overflow-hidden">
              {g.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} className="flex min-h-[60px] items-center gap-3 px-4 py-3 hover:bg-[var(--surface-2)]">
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[var(--primary-bg)] text-[var(--primary)]">
                      <Icon name={it.icon} size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{it.label}</span>
                      <span className="block text-[13px] text-[var(--muted)]">{it.sub}</span>
                    </span>
                    {it.badge === 'errors' && errors > 0 && <span className="rp-chip rp-chip-danger rp-num">{errors}</span>}
                    {it.href === '/app/notifications' && unread > 0 && (
                      <span className="rp-chip rp-chip-primary rp-num">
                        {unread}
                        <span className="sr-only"> non lue{unread > 1 ? 's' : ''}</span>
                      </span>
                    )}
                    <Icon name="chevron" size={18} className="text-[var(--muted)]" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="rp-panel rp-panel-body flex items-center justify-between gap-3" aria-label="Affichage">
          <span className="text-[14px] font-semibold">Thème</span>
          <ThemeToggle initial={theme} variant="plain" />
        </section>
        <Link href={`/app?visite=1&segment=${ws.segment}`} className="rp-btn w-full">
          <Icon name="compass" size={18} /> Visite guidée
        </Link>
        {ws.demo ? (
          <Link href="/connexion" className="rp-btn rp-btn-primary">
            Se connecter
          </Link>
        ) : (
          <p className="text-center text-sm text-[var(--muted)]">Connecté : {ws.userEmail}</p>
        )}
        <p className="text-center text-xs text-[var(--muted)]">
          <Link href="/cgv" className="underline">
            CGV
          </Link>{' '}
          ·{' '}
          <Link href="/confidentialite" className="underline">
            Confidentialité
          </Link>{' '}
          ·{' '}
          <Link href="/mentions-legales" className="underline">
            Mentions légales
          </Link>
        </p>
      </div>
    </>
  );
}
