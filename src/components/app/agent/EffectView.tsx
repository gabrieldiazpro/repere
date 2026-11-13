'use client';
// Effet mesuré d'une publication : remesure de la page à J+7, citations par les IA avec marge d'erreur, repère sur la courbe.
import { ChartDraw } from '@/components/motion/ChartDraw';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { fmtMargin, fmtPts } from '@/lib/text';
import { fmtDate } from '../tokens';
import { EFFECT_VERDICT, rate, type AgentEffect } from './effect';

export function EffectView({ effect }: { effect: AgentEffect }) {
  const due = fmtDate(effect.dueAt, { day: 'numeric', month: 'long' });
  const r = effect.ai?.result;
  const v = r ? EFFECT_VERDICT[r.verdict] : null;
  return (
    <div className="flex flex-col gap-4" data-effect={effect.status}>
      {effect.status === 'scheduled' && (
        <p className="m-0 flex flex-wrap items-center gap-2 text-[14.5px]">
          <StatusBadge tone="brand" live>
            Remesure prévue le {due}
          </StatusBadge>
          <span className="text-[var(--muted)]">La page est relue 7 jours après la publication, puis vos questions suivies à la mesure hebdomadaire.</span>
        </p>
      )}
      {effect.status === 'failed' && (
        <p className="m-0 text-[14.5px] text-[var(--tone-down)]">La remesure du {due} n’a pas abouti{effect.error ? ` : ${effect.error}` : ''}. Elle sera refaite à la prochaine analyse.</p>
      )}
      {effect.status === 'none' && <p className="m-0 text-[14.5px] text-[var(--muted)]">Modification annulée avant la remesure : aucun effet à mesurer.</p>}
      {effect.status === 'done' && (
        <div className="ag-effect">
          {effect.page && (
            <div className="ag-fig">
              <p className="ag-fig-v m-0">
                {effect.page.before ?? '—'} <span aria-hidden="true">→</span>
                <span className="sr-only">devient</span> {effect.page.after ?? '—'}
              </p>
              <p className="ag-fig-l m-0">{effect.page.label}</p>
              <p className="ag-fig-l m-0">Remesure du {due}. Même page, même calcul : pas de marge d’erreur.</p>
            </div>
          )}
          {effect.ai && r && v && (
            <div className="ag-fig">
              <p className="ag-fig-v m-0">
                {rate(effect.ai.before)} % <span aria-hidden="true">→</span>
                <span className="sr-only">devient</span> {rate(effect.ai.after)} %
              </p>
              <p className="ag-fig-l m-0">
                Réponses{effect.ai.provider ? ` de ${effect.ai.provider}` : ' des IA'} qui vous citent, sur {effect.ai.questions} questions suivies ({effect.ai.after.mentioned}/{effect.ai.after.answers})
              </p>
              <p className="m-0 mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge tone={v.tone}>{v.label}</StatusBadge>
                <span className="text-[13px] font-semibold">
                  {fmtPts(r.delta)} <span className="font-normal text-[var(--muted)]">(marge d’erreur {fmtMargin(r.margin)})</span>
                </span>
              </p>
            </div>
          )}
        </div>
      )}
      {r && v && <p className="m-0 text-[13.5px] text-[var(--muted)]">{v.sentence}</p>}
      {effect.curve && (
        <figure className="m-0 max-w-[560px]">
          <ChartDraw values={effect.curve.values} marker={effect.curve.marker} label={effect.curve.label} width={560} height={120} className="w-full text-[var(--tone-brand)]" />
          <figcaption className="ui-caption mt-1 text-[var(--muted)]">
            Score de visibilité, mesure par mesure. Le repère vertical marque la publication (le même repère apparaît sur vos courbes).
          </figcaption>
        </figure>
      )}
      {effect.demo && effect.status === 'done' && <span className="ag-simtag self-start">Chiffres d’exemple</span>}
    </div>
  );
}
