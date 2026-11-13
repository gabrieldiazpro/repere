// Composants communs (serveur) des écrans métiers : sous-navigation, garde de parcours, statuts, source, actions.
import Link from 'next/link';
import { Icon } from '@/components/app/icons';
import { Empty } from '@/components/app/PageHeader';
import type { CriterionStatus } from '@/lib/local/types';
import { STATUS_META } from './logic';
import { ReloadButton } from './client';

export const LOCAL_TABS = [
  { href: '/app/local/fiche-google', label: 'Fiche Google' },
  { href: '/app/local/carte', label: 'Carte' },
  { href: '/app/local/annuaires', label: 'Annuaires' },
  { href: '/app/local/avis', label: 'Avis et posts' },
] as const;

export const PRODUITS_TABS = [
  { href: '/app/produits', label: 'Catalogue' },
  { href: '/app/produits/revendeurs', label: 'Revendeurs' },
  { href: '/app/produits/prix-avis', label: 'Prix et avis' },
  { href: '/app/produits/ventes', label: 'Ventes' },
] as const;

/** Onglets du parcours (liens, défilement horizontal sur mobile). */
export function SubNav({ tabs, current, label }: { tabs: readonly { href: string; label: string }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="rp-scroll -mx-1 mb-1">
      <ul className="flex min-w-max gap-1 px-1">
        {tabs.map((t) => {
          const on = t.href === current;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={on ? 'page' : undefined}
                className={`inline-flex min-h-[40px] items-center rounded-full px-3.5 text-[14px] font-medium ${on ? 'bg-[var(--ink)] text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--hair)] hover:text-[var(--ink)]'}`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Écran réservé à un autre parcours : message clair + lien utile (jamais une erreur). */
export function ParcoursGate({ parcours, demo }: { parcours: 'local' | 'ecommerce'; demo: boolean }) {
  const local = parcours === 'local';
  return (
    <div className="rp-page">
      <Empty
        title={local ? 'Cet écran est réservé aux commerces de proximité' : 'Cet écran est réservé aux boutiques en ligne'}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            {demo && (
              <Link href={local ? '/app/local/fiche-google?compte=demo' : '/app/produits?compte=demo-ecom'} className="rp-btn rp-btn-primary">
                {local ? 'Voir la démo Plomberie Martin' : 'Voir la démo Maison Sora'}
              </Link>
            )}
            <Link href="/app" className="rp-btn">
              Retour à l’accueil
            </Link>
          </div>
        }
      >
        {local
          ? 'Fiche Google, carte par quartier, annuaires et avis concernent les commerces qui reçoivent des clients près de chez eux. Votre espace suit un autre parcours.'
          : 'Catalogue, revendeurs, prix cités et ventes venues des IA concernent les boutiques en ligne. Votre espace suit un autre parcours.'}
      </Empty>
    </div>
  );
}

export function StatusChip({ status }: { status: CriterionStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`rp-chip ${m.chip}`}>
      {status === 'ok' && <Icon name="check" size={12} />}
      {status === 'fail' && <Icon name="alert" size={12} />}
      {m.label}
    </span>
  );
}

/** Provenance des données, toujours visible. */
export function SourceNote({ label, detail, demo }: { label: string; detail?: string; demo?: boolean }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[13px] text-[var(--muted)]">
      <span>
        Source : <strong className="font-semibold text-[var(--ink)]">{label}</strong>
      </span>
      {demo && <span className="rp-chip rp-chip-warning">démo</span>}
      {detail && <span>{detail}</span>}
    </p>
  );
}

export interface NextStep {
  href: string;
  label: string;
  primary?: boolean;
  external?: boolean;
}

/** « Et maintenant ? » : chaque donnée mène à une action. */
export function NextSteps({ steps, title = 'Et maintenant ?' }: { steps: NextStep[]; title?: string }) {
  if (!steps.length) return null;
  return (
    <div className="flex flex-col gap-2 border-t border-[var(--hair)] pt-4 sm:flex-row sm:flex-wrap sm:items-center">
      <p className="text-[13px] font-semibold text-[var(--muted)] sm:mr-1">{title}</p>
      {steps.map((s) =>
        s.external ? (
          <a key={s.href + s.label} href={s.href} target="_blank" rel="noopener noreferrer" className={`rp-btn rp-btn-sm ${s.primary ? 'rp-btn-primary' : ''}`}>
            {s.label}
            <Icon name="external" size={14} />
          </a>
        ) : (
          <Link key={s.href + s.label} href={s.href} className={`rp-btn rp-btn-sm ${s.primary ? 'rp-btn-primary' : ''}`}>
            {s.label}
          </Link>
        ),
      )}
    </div>
  );
}

/** Ligne de chiffres clés (même gabarit que les autres écrans). */
export function KeyFigures({ items }: { items: { k: string; v: React.ReactNode; extra?: React.ReactNode }[] }) {
  return (
    <dl className="rp-panel grid grid-cols-2 lg:grid-cols-4">
      {items.map((x, i) => (
        <div
          key={x.k}
          className={`border-[var(--hair)] p-4 lg:px-6 ${i % 2 === 0 ? 'border-r' : ''} ${i < items.length - 2 ? 'border-b lg:border-b-0' : ''} ${i > 0 && i < items.length - 1 ? 'lg:border-r' : ''}`}
        >
          <dt className="text-[12px] text-[var(--muted)]">{x.k}</dt>
          <dd className="mt-1">
            <span className="rp-display rp-num text-[24px]">{x.v}</span>
            {x.extra && <span className="ml-1.5 text-[12px] text-[var(--muted)]">{x.extra}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Message d'erreur de chargement côté serveur, avec relance. */
export function LoadError({ what }: { what: string }) {
  return (
    <Empty title={`Impossible de charger ${what}`} action={<ReloadButton />}>
      Le service n’a pas répondu. Vos données ne sont pas perdues : réessayez dans un instant.
    </Empty>
  );
}

/** Barre de proportion en HTML (couleur par variable CSS : compatible mode sombre). */
export function Meter({ value, max, color = 'var(--primary)', height = 8, label }: { value: number; max: number; color?: string; height?: number; label?: string }) {
  const v = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <span
      className="block w-full overflow-hidden rounded-full bg-[var(--hair)]"
      style={{ height }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="block h-full rounded-full" style={{ width: `${v > 0 ? Math.max(v * 100, 2) : 0}%`, background: color }} />
    </span>
  );
}

/** Mini-courbe de tendance (traits colorés par style CSS). */
export function Trend({ values, label, width = 120, height = 32 }: { values: number[]; label: string; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const span = Math.max(1e-9, Math.max(...values) - min);
  const pts = values.map((v, i) => [3 + (i / (values.length - 1)) * (width - 6), 3 + (1 - (v - min) / span) * (height - 6)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={label} className="block">
      <path d={d} fill="none" style={{ stroke: 'var(--primary)' }} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="3" style={{ fill: 'var(--accent)', stroke: 'var(--primary)' }} strokeWidth="1.5" />
    </svg>
  );
}
