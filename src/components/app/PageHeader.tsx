import Link from 'next/link';
import { AppLogo, Icon } from './icons';
import { OfflineBanner } from './HeaderClient';
import { SearchButton } from './shell/CommandPalette';
import { PageIntro } from '@/components/ui/PageIntro';
import type { Tone } from '@/components/ui/tone';

/** En-tête de page : barre mobile collante (logo + titre) et titre de page sur bureau. */
export function PageHeader({
  title,
  lead,
  meta,
  actions,
  back,
  dataDate,
  result,
  resultTone,
  subtitle,
  primary,
  secondary,
  status,
}: {
  title: string;
  /** V4 : titre-résultat (ce que l'écran établit), rendu en grand sous le H1 avec `subtitle` et UNE action `primary`. */
  result?: React.ReactNode;
  resultTone?: Tone;
  subtitle?: React.ReactNode;
  primary?: React.ReactNode;
  secondary?: React.ReactNode;
  status?: React.ReactNode;
  lead?: React.ReactNode;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  dataDate?: string | null;
}) {
  return (
    <>
      <OfflineBanner dataDate={dataDate ?? null} />
      <header className="rp-ph">
        <div className="rp-ph-inner">
          {back ? (
            <Link href={back.href} className="rp-back">
              <Icon name="chevron" size={18} className="rotate-180" />
              {back.label}
            </Link>
          ) : (
            <Link href="/app" aria-label="Accueil" className="flex-none lg:hidden">
              <AppLogo size={28} />
            </Link>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="rp-display rp-h1">{title}</h1>
            {meta && <div className="rp-meta">{meta}</div>}
          </div>
          {actions && <div className="hidden flex-none items-center gap-2 lg:flex">{actions}</div>}
          <SearchButton compact className="rp-ph-search lg:hidden" />
        </div>
      </header>
      {/* Mobile : les actions de la page sous la barre collante, pour laisser toute la largeur au titre. */}
      {actions && <div className="rp-ph-actions lg:hidden">{actions}</div>}
      {/* Hors de l'en-tête collant : sur mobile, seule la barre logo + titre reste épinglée. */}
      {lead && <p className="rp-lead">{lead}</p>}
      {result && (
        <div className="rp-ph-intro">
          <PageIntro result={result} tone={resultTone} subtitle={subtitle} primary={primary} secondary={secondary} status={status} />
        </div>
      )}
    </>
  );
}

export function Panel({
  title,
  id,
  aside,
  children,
  className = '',
  pad = true,
}: {
  title?: React.ReactNode;
  id?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`rp-panel ${className}`} aria-labelledby={title && id ? id : undefined}>
      {title && (
        <div className="rp-panel-head">
          <h2 id={id} className="rp-h2">
            {title}
          </h2>
          {aside && <div className="text-[13px] text-[var(--muted)]">{aside}</div>}
        </div>
      )}
      <div className={pad ? 'rp-panel-body' : ''}>{children}</div>
    </section>
  );
}

export function Empty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--line)] p-5 text-center">
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--muted)]">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
