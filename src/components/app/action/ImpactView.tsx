// Suivi avant / après d'une action faite (aucun hook : utilisable côté serveur ou client).
import type { ActionImpact, Snapshot } from '@/lib/measure';
import { fmtMargin, fmtPts } from '@/lib/text';
import { fmtDate, pct } from '../tokens';

export const VERDICT: Record<ActionImpact['verdict'], { label: string; cls: string }> = {
  hausse: { label: 'En hausse', cls: 'rp-chip-success' },
  baisse: { label: 'En baisse', cls: 'rp-chip-danger' },
  stable: { label: 'Dans la marge d’erreur', cls: '' },
  en_attente: { label: 'Mesure en cours', cls: 'rp-chip-primary' },
  insuffisant: { label: 'Non mesurable', cls: '' },
};

function pts(n: number) {
  return fmtPts(n);
}

function Cell({ title, snap, pending }: { title: string; snap: Snapshot | null | undefined; pending?: string }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[var(--hair)] bg-[var(--bg)] px-3 py-2">
      <p className="text-[12px] text-[var(--muted)]">{title}</p>
      {snap ? (
        <>
          <p className="rp-display rp-num text-[20px]">{pct(snap.rate)}</p>
          <p className="text-[11px] text-[var(--muted)]">
            {snap.mentioned}/{snap.answers} réponses · {fmtDate(snap.at, { day: 'numeric', month: 'short' })}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[13px] text-[var(--muted)]">{pending ?? 'à venir'}</p>
      )}
    </div>
  );
}

export function ImpactView({ impact, compact = false }: { impact: ActionImpact; compact?: boolean }) {
  const v = VERDICT[impact.verdict];
  const cp = (d: number) => impact.checkpoints.find((c) => c.day >= d - 3 && c.day <= d + 10) ?? impact.checkpoints.find((c) => c.day === d);
  const c14 = cp(14);
  const c30 = cp(30);
  const due = (c: typeof c14) => (c ? (c.status === 'failed' ? 'relance échouée' : `prévue le ${fmtDate(c.dueAt, { day: 'numeric', month: 'short' })}`) : 'non planifiée');
  return (
    <div className="flex flex-col gap-2" data-impact={impact.verdict}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rp-chip ${v.cls}`}>{v.label}</span>
        {impact.delta !== null && (
          <span className="rp-num text-[13px] font-semibold">
            {pts(impact.delta)}
            {impact.margin !== null && <span className="font-normal text-[var(--muted)]"> (marge {fmtMargin(impact.margin)})</span>}
          </span>
        )}
        {impact.demo && <span className="rp-chip">démo</span>}
      </div>
      {!compact && (
        <div className="grid grid-cols-3 gap-2">
          <Cell title="Avant" snap={impact.before} pending="pas de mesure" />
          <Cell title="J+14" snap={c14?.snapshot} pending={due(c14)} />
          <Cell title="J+30" snap={c30?.snapshot} pending={due(c30)} />
        </div>
      )}
      <p className="text-[13px]">{impact.label}</p>
      {!compact && (
        <p className="text-[12px] text-[var(--muted)]">
          Taux de citation sur {impact.queries.length} question{impact.queries.length > 1 ? 's' : ''} liée{impact.queries.length > 1 ? 's' : ''} à cette action. {impact.note} Un repère est ajouté sur vos courbes à la date de l’action.
        </p>
      )}
    </div>
  );
}
