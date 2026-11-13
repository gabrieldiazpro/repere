// En-tête-résultat des écrans (V4) : ce que l'écran vous apprend cette semaine, un chiffre clé, UNE action principale.
// Les détails (marges d'erreur, méthode) restent visibles mais en second plan, dépliables.
import Link from 'next/link';
import { Counter } from '@/components/motion/Counter';
import { Icon, type IconName } from '../icons';

export type Tone = 'good' | 'bad' | 'warn' | 'neutral' | 'brand';

const TONE_ICON: Record<Tone, IconName> = { good: 'trend', bad: 'alert', warn: 'alert', neutral: 'info', brand: 'spark' };
const TONE_SR: Record<Tone, string> = { good: 'Bonne nouvelle : ', bad: 'Point à corriger : ', warn: 'À surveiller : ', neutral: '', brand: '' };

export interface Figure {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

export function Verdict({
  tone = 'neutral',
  title,
  lead,
  figure,
  delta,
  action,
  secondary,
  details,
  detailsLabel = 'Détails et marges d’erreur',
  id,
}: {
  tone?: Tone;
  title: React.ReactNode;
  lead?: React.ReactNode;
  figure?: Figure | null;
  delta?: React.ReactNode;
  action?: { href: string; label: string; icon?: IconName } | React.ReactNode;
  secondary?: React.ReactNode;
  details?: React.ReactNode;
  detailsLabel?: string;
  id?: string;
}) {
  const act =
    action && typeof action === 'object' && 'href' in (action as object) && 'label' in (action as object) ? (
      <Link href={(action as { href: string }).href} className="rp-btn rp-btn-primary v4-press">
        {(action as { icon?: IconName }).icon && <Icon name={(action as { icon: IconName }).icon} size={16} />}
        {(action as { label: string }).label}
      </Link>
    ) : (
      (action as React.ReactNode)
    );
  return (
    <section className="v4-verdict" data-tone={tone} aria-labelledby={id ?? 'v4-verdict-t'}>
      <div className="v4-verdict-main">
        <p className="v4-verdict-title rp-display" id={id ?? 'v4-verdict-t'}>
          <span className="v4-verdict-ico" aria-hidden="true">
            <Icon name={TONE_ICON[tone]} size={18} />
          </span>
          <span>
            <span className="sr-only">{TONE_SR[tone]}</span>
            {title}
          </span>
        </p>
        {lead && <p className="v4-verdict-lead">{lead}</p>}
        {(act || secondary) && (
          <div className="v4-verdict-acts">
            {act}
            {secondary}
          </div>
        )}
      </div>
      {figure && (
        <div className="v4-verdict-fig">
          <p className="v4-verdict-num rp-display rp-num">
            {figure.prefix}
            <Counter value={figure.value} decimals={figure.decimals ?? 0} suffix={figure.suffix ?? ''} duration={800} />
          </p>
          <p className="v4-verdict-figlabel">{figure.label}</p>
          {delta && <div className="mt-1.5">{delta}</div>}
        </div>
      )}
      {details && (
        <details className="v4-verdict-details">
          <summary>
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="rp-chevron" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="m9 6 6 6-6 6" />
            </svg>
            {detailsLabel}
          </summary>
          <div className="v4-verdict-detail-body">{details}</div>
        </details>
      )}
    </section>
  );
}

/** Ligne d'état vide commune : une phrase + l'action suivante. */
export function V4Empty({ title, children, action, icon = 'info' }: { title: string; children?: React.ReactNode; action?: React.ReactNode; icon?: IconName }) {
  return (
    <div className="v4-empty">
      <span className="v4-empty-ico" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <p className="font-semibold">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--muted)]">{children}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
