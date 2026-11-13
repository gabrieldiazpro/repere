// Briques communes des écrans Mesure (composants serveur, sans hook) : barre période / comparaison / IA,
// indicateurs avec marge d'erreur, export CSV verrouillable, texte surligné, « Expliquer ce changement ».
import Link from 'next/link';
import type { ChangeExplanation, ProviderId } from '@/lib/engine';
import type { Entitlements } from '@/lib/entitlements';
import { VerrouBouton } from '../shell/Verrou';
import { Icon } from '../icons';
import { fmtDate, PROVIDER_LABEL, PROVIDER_ORDER } from '../tokens';
import { plainAnswer, segmentsOf, type AnswerItem } from './derive';
import { hrefWith, PERIODS, VS, type MesureParams, type RawSearch } from './params';

export function MesureBar({
  path,
  sp,
  params,
  providers,
  compare = true,
  extra,
}: {
  path: string;
  sp: RawSearch;
  params: MesureParams;
  providers?: readonly ProviderId[];
  compare?: boolean;
  extra?: React.ReactNode;
}) {
  const ordered = providers ? PROVIDER_ORDER.filter((p) => providers.includes(p)) : [];
  return (
    <nav aria-label="Période et filtres" className="rp-mbar">
      <div className="rp-mbar-group">
        <span className="rp-mbar-label" id="mb-period">Période</span>
        <span className="rp-segs" role="group" aria-labelledby="mb-period">
          {PERIODS.map((p) => (
            <Link key={p.key} href={hrefWith(path, sp, { periode: p.key })} aria-current={params.periode === p.key ? 'true' : undefined} scroll={false}>
              {p.short}
            </Link>
          ))}
        </span>
      </div>
      {compare && (
        <div className="rp-mbar-group">
          <span className="rp-mbar-label" id="mb-vs">Comparer à</span>
          <span className="rp-segs" role="group" aria-labelledby="mb-vs">
            {VS.map((v) => (
              <Link key={v.key} href={hrefWith(path, sp, { vs: v.key })} aria-current={params.vs === v.key ? 'true' : undefined} scroll={false}>
                {v.key === 'precedent' ? 'Mesure précédente' : 'Début de période'}
              </Link>
            ))}
          </span>
        </div>
      )}
      {ordered.length > 1 && (
        <div className="rp-mbar-group">
          <span className="rp-mbar-label" id="mb-ia">IA</span>
          <span className="rp-segs" role="group" aria-labelledby="mb-ia">
            <Link href={hrefWith(path, sp, { ia: null })} aria-current={!params.ia ? 'true' : undefined} scroll={false}>
              Toutes
            </Link>
            {ordered.map((p) => (
              <Link key={p} href={hrefWith(path, sp, { ia: p })} aria-current={params.ia === p ? 'true' : undefined} scroll={false}>
                {PROVIDER_LABEL[p].replace(' (Le Chat)', '')}
              </Link>
            ))}
          </span>
        </div>
      )}
      {extra}
    </nav>
  );
}

/** Phrase d'état de la période (dates, comparaison, limite d'historique de l'offre). */
export function PeriodNote({ from, to, refDate, limitedByPlan, historyMonths }: { from: string | null; to: string | null; refDate: string | null; limitedByPlan: boolean; historyMonths: number | null }) {
  if (!to) return null;
  const d = (x: string) => fmtDate(x, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <p className="text-[13px] text-[var(--muted)]">
      {from && from !== to ? `Du ${d(from)} au ${d(to)}` : `Mesure du ${d(to)}`}
      {refDate ? `, comparé au ${d(refDate)}.` : '. Pas encore de mesure de comparaison.'}
      {limitedByPlan && historyMonths != null && (
        <>
          {' '}
          Votre offre conserve {historyMonths} mois d’historique.{' '}
          <Link href="/tarifs?depuis=app&fonction=historique" className="rp-link">
            Voir les offres
          </Link>
        </>
      )}
    </p>
  );
}

/** Indicateur : valeur, marge d'erreur (« ± x »), évolution, sous-titre. */
export function Kpi({ label, value, margin, delta, sub }: { label: string; value: string; margin?: string | null; delta?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rp-kpi">
      <dt className="text-[12px] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="rp-display rp-num text-[24px]">{value}</span>
        {margin && (
          <span className="rp-margin" title="Marge d’erreur : intervalle à 90 %, les IA ne répondent pas deux fois pareil">
            {margin}
          </span>
        )}
        {delta}
      </dd>
      {sub && <dd className="mt-0.5 text-[12px] text-[var(--muted)]">{sub}</dd>}
    </div>
  );
}

/** Variation en points avec sa lecture (dans la marge = « dans le bruit »). */
export function DeltaPts({ delta, margin, unit = 'pts' }: { delta: number; margin?: number | null; unit?: 'pts' | '' }) {
  const v = Math.round(delta);
  const noise = margin != null && Math.abs(delta) <= margin;
  const cls = noise || v === 0 ? 'rp-chip' : v > 0 ? 'rp-chip rp-chip-success' : 'rp-chip rp-chip-danger';
  return (
    <span className={`${cls} rp-num`} title={noise ? 'Variation inférieure à la marge d’erreur : à confirmer à la prochaine mesure' : undefined}>
      <span aria-hidden="true">{v > 0 ? '↑' : v < 0 ? '↓' : '→'}</span>
      {v > 0 ? '+' : v < 0 ? '−' : ''}
      {Math.abs(v)}
      {unit ? ` ${unit}` : ''}
      {noise && <span className="font-normal"> · dans la marge</span>}
      <span className="sr-only">{v > 0 ? ' en hausse' : v < 0 ? ' en baisse' : ' stable'}</span>
    </span>
  );
}

/** Lien d'export CSV (/api/export), verrouillé hors offre. */
export function ExportLink({ ent, businessId, kind, from, to, label = 'Exporter en CSV' }: { ent: Entitlements; businessId: string; kind: string; from?: string | null; to?: string | null; label?: string }) {
  const u = new URLSearchParams({ businessId, kind });
  if (from) u.set('from', from);
  if (to) u.set('to', to);
  return (
    <VerrouBouton ent={ent} feature="exports" label={label}>
      <a href={`/api/export?${u.toString()}`} className="rp-btn rp-btn-sm" download>
        <Icon name="download" size={15} />
        {label}
      </a>
    </VerrouBouton>
  );
}

export function AskCopilot({ context, question, label = 'Demander au copilote' }: { context: string; question?: string; label?: string }) {
  const u = new URLSearchParams({ context });
  if (question) u.set('q', question.slice(0, 200));
  return (
    <Link href={`/app/copilote?${u.toString()}`} className="rp-btn rp-btn-sm">
      <Icon name="spark" size={15} />
      {label}
    </Link>
  );
}

const CONF_LABEL = { forte: 'Changement net', moyenne: 'Changement probable', faible: 'Dans la marge d’erreur' } as const;

/** « Expliquer ce changement » : explication du moteur (explainChange), dépliable, et relais vers le copilote. */
export function ExplainChange({ ex, context }: { ex: ChangeExplanation | null; context: string }) {
  if (!ex) return null;
  return (
    <details className="rp-panel group">
      <summary className="flex min-h-[48px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 lg:px-5">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" className="rp-chevron flex-none" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="m9 6 6 6-6 6" />
        </svg>
        <span className="font-semibold">Expliquer ce changement</span>
        <span className="min-w-0 basis-full pl-7 text-[14px] text-[var(--muted)] lg:flex-1 lg:basis-0 lg:pl-0">{ex.headline}</span>
        <span className={`rp-chip ml-7 lg:ml-0 ${ex.confidence === 'forte' ? 'rp-chip-primary' : ex.confidence === 'moyenne' ? 'rp-chip-warning' : ''}`}>{CONF_LABEL[ex.confidence]}</span>
      </summary>
      <div className="border-t border-[var(--hair)] px-4 pb-4 pt-3 lg:px-5">
        <ul className="flex flex-col gap-1.5 text-[14px]">
          {ex.sentences.map((s) => (
            <li key={s} className="flex gap-2">
              <span className="mt-[9px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--primary)]" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
        {ex.warnings.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-[13px] text-[var(--warning-ink)]">
            {ex.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <AskCopilot context={context} question="Pourquoi mon score a-t-il bougé ?" label="Approfondir avec le copilote" />
        </div>
      </div>
    </details>
  );
}

const HL_CLASS = { client: 'rp-hl-client', concurrent: 'rp-hl-concurrent', source: 'rp-hl-source' } as const;
const HL_SR = { client: 'vous', concurrent: 'concurrent', source: 'source' } as const;

/** Réponse brute avec surlignage (vous, concurrents, sources). */
export function HighlightedAnswer({ item, className = '' }: { item: Pick<AnswerItem, 'text' | 'highlights'>; className?: string }) {
  return (
    <p className={`rp-answer ${className}`}>
      {segmentsOf(item.text, item.highlights).map((s, i) =>
        s.kind ? (
          <mark key={i} className={HL_CLASS[s.kind]} data-hl={s.kind}>
            {plainAnswer(s.text, i === 0)}
            <span className="sr-only"> ({HL_SR[s.kind]})</span>
          </mark>
        ) : (
          <span key={i}>{plainAnswer(s.text, i === 0)}</span>
        ),
      )}
    </p>
  );
}

export function HighlightLegend() {
  return (
    <p className="rp-legend" aria-label="Légende du surlignage">
      <span>
        <mark className="rp-hl-client">Vous</mark>
      </span>
      <span>
        <span className="rp-hl-concurrent">Concurrent</span>
      </span>
      <span>
        <span className="rp-hl-source">Source citée</span>
      </span>
    </p>
  );
}

/** Pastilles de présence par IA (● cité, ○ absent). */
export function Pips({ cells }: { cells: { provider: ProviderId; cited: boolean | null }[] }) {
  return (
    <span className="rp-pips">
      {cells.map((c) => (
        <span key={c.provider} className="rp-pip" data-on={c.cited ? 'true' : 'false'} title={`${PROVIDER_LABEL[c.provider]} : ${c.cited === null ? 'non mesuré' : c.cited ? 'vous cite' : 'ne vous cite pas'}`} />
      ))}
      <span className="sr-only">
        {cells.map((c) => `${PROVIDER_LABEL[c.provider]} ${c.cited === null ? 'non mesuré' : c.cited ? 'cité' : 'absent'}`).join(', ')}
      </span>
    </span>
  );
}
