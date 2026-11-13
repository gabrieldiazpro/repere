// Briques serveur de la partie SEO (APP-SEO) : navigation, provenance, graphiques SVG, listes de corrections.
import Link from 'next/link';
import { Tabs } from '@/components/ui/Tabs';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Icon } from '@/components/app/icons';
import type { ProviderStatus } from '@/lib/seodata/types';
import { SEVERITY_LABEL, SEVERITY_TONE, canAutoFix, fmtInt, type RankedFix } from './model';

export const SEO_TABS = [
  { id: 'apercu', label: 'Vue d’ensemble', href: '/app/seo' },
  { id: 'technique', label: 'Audit du site', href: '/app/seo/technique' },
  { id: 'positions', label: 'Positions', href: '/app/seo/positions' },
  { id: 'search-console', label: 'Search Console', href: '/app/seo/search-console' },
  { id: 'performance', label: 'Vitesse', href: '/app/seo/performance' },
  { id: 'liens', label: 'Liens', href: '/app/seo/liens' },
  { id: 'geo', label: 'Lisible par les IA', href: '/app/seo/geo' },
] as const;

export type SeoTab = (typeof SEO_TABS)[number]['id'];

export function SeoNav({ active }: { active: SeoTab }) {
  return (
    <nav className="seo-nav" aria-label="Sections SEO">
      <Tabs items={SEO_TABS.map((t) => ({ id: t.id, label: t.label, href: t.href }))} value={active} label="Sections SEO" idBase="seo-nav" />
    </nav>
  );
}

const PROVIDER_NAME: Record<string, string> = {
  'google-search-console': 'Google Search Console',
  'pagespeed-insights': 'Google PageSpeed Insights',
  crux: 'Chrome UX Report',
  dataforseo: 'DataForSEO',
  'bing-webmaster': 'Bing Webmaster Tools',
  demo: 'données de démonstration',
  repere: 'exploration Repéré (RepereBot)',
};

/** Ligne de provenance : d'où vient le chiffre, à quelle date, démo ou non. */
export function Source({ provider, demo, at, note }: { provider: string; demo?: boolean; at?: string | null; note?: string }) {
  const names = provider.split('+').map((p) => PROVIDER_NAME[p] ?? p).join(' + ');
  return (
    <p className="seo-src">
      {demo && <StatusBadge tone="brand">Démo</StatusBadge>}
      <span>
        Source : <b>{names}</b>
        {at ? <>, {new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' })}</> : null}
        {note ? <>. {note}</> : null}
      </span>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Graphiques
// ---------------------------------------------------------------------------

/** Courbe qui se trace (+ aire), axe des abscisses minimal. `compare` : série précédente en pointillés. */
export function LineChart({ values, labels, compare, label, height = 140, invert = false, unit = '' }: { values: number[]; labels?: string[]; compare?: number[]; label: string; height?: number; invert?: boolean; unit?: string }) {
  const W = 640;
  const H = height;
  const pad = { l: 6, r: 6, t: 10, b: labels ? 20 : 6 };
  const all = [...values, ...(compare ?? [])].filter((v) => Number.isFinite(v));
  if (values.length < 2 || !all.length) return null;
  const min = invert ? Math.min(...all) : 0;
  const max = Math.max(...all) || 1;
  const x = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return pad.t + (invert ? t : 1 - t) * (H - pad.t - pad.b);
  };
  const path = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i, vs.length).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const d = path(values);
  const area = `${d}L${x(values.length - 1, values.length).toFixed(1)},${H - pad.b}L${pad.l},${H - pad.b}Z`;
  const ticks = labels ? labels.map((l, i) => ({ l, i })).filter((_, i, a) => a.length <= 8 || i % Math.ceil(a.length / 6) === 0 || i === a.length - 1) : [];
  return (
    <svg className="seo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none" style={{ height: H }}>
      <line className="gr" x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} />
      {!invert && <path className="ar" d={area} />}
      {compare && compare.length > 1 && <path className="ln2" d={path(compare)} />}
      <path className="ln" d={d} style={{ ['--len' as string]: 2200 }} />
      {ticks.map(({ l, i }) => (
        <text key={i} className="ax" x={x(i, labels!.length)} y={H - 4} textAnchor={i === 0 ? 'start' : i === labels!.length - 1 ? 'end' : 'middle'}>
          {l}
        </text>
      ))}
      <title>{`${label}${unit}`}</title>
    </svg>
  );
}

/** Barres verticales (ex. clics par mois). `dim` : barres en retrait (mois incomplet). */
export function BarChart({ values, labels, label, height = 150, dim = [] }: { values: number[]; labels: string[]; label: string; height?: number; dim?: number[] }) {
  const W = 640;
  const H = height;
  const b = 20;
  const max = Math.max(1, ...values);
  const n = values.length;
  const gap = 4;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg className="seo-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="none" style={{ height: H }}>
      <line className="gr" x1={0} x2={W} y1={H - b} y2={H - b} />
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * (H - b - 8));
        return <rect key={i} className={`bar${dim.includes(i) ? ' is-dim' : ''}`} x={i * (bw + gap)} y={H - b - h} width={bw} height={h} rx={3} style={{ animationDelay: `${i * 25}ms` }} />;
      })}
      {labels.map((l, i) =>
        n <= 8 || i % 3 === 0 || i === n - 1 ? (
          <text key={i} className="ax" x={i * (bw + gap) + bw / 2} y={H - 5} textAnchor="middle">
            {l}
          </text>
        ) : null,
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

export const firstSentence = (t: string) => (t.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? t);

export function agentHref(f: Pick<RankedFix, 'id' | 'origin'>) {
  return `/app/agent?source=${f.origin}&constat=${encodeURIComponent(f.id)}`;
}

export function SeverityBadge({ s }: { s: RankedFix['severity'] }) {
  return <StatusBadge tone={SEVERITY_TONE[s]}>{SEVERITY_LABEL[s]}</StatusBadge>;
}

/** Liste numérotée de corrections prioritaires (ordre = priorité, donc numérotation justifiée). */
export function FixList({ fixes, auditHref = '/app/seo/technique' }: { fixes: RankedFix[]; auditHref?: string }) {
  return (
    <ol className="seo-fixes">
      {fixes.map((f, i) => (
        <li key={`${f.origin}:${f.id}`} className="seo-fix">
          <span className="seo-fix-n" aria-hidden="true">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="seo-fix-t">{f.title}</p>
            <p className="seo-fix-m">
              {f.origin === 'geo' ? 'IA' : 'Google'} · {f.sectionLabel}
              {f.affectedCount > 1 ? ` · ${fmtInt(f.affectedCount)} pages` : ''} · {firstSentence(f.fix)}
            </p>
          </div>
          <div className="seo-fix-acts">
            <SeverityBadge s={f.severity} />
            {canAutoFix(f) ? (
              <Link href={agentHref(f)} className="seo-auto">
                <Icon name="spark" size={13} /> Repéré peut le faire
              </Link>
            ) : (
              <Link href={f.origin === 'geo' ? '/app/seo/geo' : `${auditHref}?constat=${encodeURIComponent(f.id)}`} className="rp-link text-[13px]">
                Voir le détail
              </Link>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** État d'une connexion de données. */
export function ConnState({ s }: { s: ProviderStatus | undefined }) {
  if (!s) return <StatusBadge tone="neutral">Inconnu</StatusBadge>;
  if (s.state === 'live') return <StatusBadge tone="up">Connecté</StatusBadge>;
  if (s.state === 'demo') return <StatusBadge tone="brand">Démo</StatusBadge>;
  return <StatusBadge tone="warn">Non connecté</StatusBadge>;
}
