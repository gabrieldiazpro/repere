import Link from 'next/link';
import type { ReactNode } from 'react';
import { Counter } from '@/components/motion/Counter';
import { Delta } from './Delta';
import { Sparkline } from './Sparkline';

/**
 * Carte de chiffre clé : libellé, chiffre qui monte (Counter), variation signée et colorée, marge d'erreur en
 * second plan, mini-courbe qui se trace. Valeur finale dans le HTML serveur. Composant serveur (îlots client dedans).
 * <KeyFigure label="Score de visibilité" value={61} unit="/100" delta={9} deltaLabel="sur un mois" margin="± 7 points" trend={[52, 61]} />
 */
export function KeyFigure({
  label,
  value,
  display,
  unit,
  decimals = 0,
  delta,
  deltaUnit = '',
  deltaLabel,
  invert = false,
  margin,
  trend,
  trendLabel,
  foot,
  href,
  size = 'md',
  animate = true,
  className = '',
}: {
  label: ReactNode;
  value: number | null;
  /** Texte à afficher à la place du nombre (ex. « 3ᵉ »). Pas de compteur dans ce cas. */
  display?: ReactNode;
  unit?: ReactNode;
  decimals?: number;
  delta?: number | null;
  deltaUnit?: string;
  deltaLabel?: string;
  invert?: boolean;
  /** Marge d'erreur : toujours visible, jamais en premier. */
  margin?: ReactNode;
  trend?: number[];
  trendLabel?: string;
  foot?: ReactNode;
  href?: string;
  size?: 'xl' | 'md' | 'sm';
  animate?: boolean;
  className?: string;
}) {
  const fig = size === 'xl' ? 'ui-figure-xl' : size === 'sm' ? 'ui-figure-sm' : 'ui-figure';
  const number =
    display ?? (value === null ? '—' : animate ? <Counter value={value} decimals={decimals} duration={size === 'xl' ? 1100 : 900} /> : value.toLocaleString('fr-FR'));
  const body = (
    <>
      <span className="ui-stat-label">{label}</span>
      <span className="ui-stat-row">
        <span className="min-w-0">
          <span className="ui-stat-value">
            <span className={fig}>
              {number}
              {unit ? <span className="ui-figure-unit">{unit}</span> : null}
            </span>
            {delta !== undefined && delta !== null ? <Delta value={delta} unit={deltaUnit} label={deltaLabel} invert={invert} pill /> : null}
          </span>
        </span>
        {trend && trend.length > 1 ? (
          <Sparkline values={trend} className="ui-stat-spark" width={size === 'xl' ? 132 : 88} height={size === 'xl' ? 44 : 30} label={trendLabel ?? `Évolution : ${trend.join(', ')}`} />
        ) : null}
      </span>
      {margin ? <span className="ui-stat-margin">{margin}</span> : null}
      {foot ? <span className="ui-stat-foot">{foot}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className={`ui-stat ${className}`}>
      {body}
    </Link>
  ) : (
    <div className={`ui-stat ${className}`}>{body}</div>
  );
}

export default KeyFigure;
