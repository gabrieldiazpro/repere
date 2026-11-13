'use client';
// AVANT / APRÈS côte à côte, différences surlignées (retrait barré, ajout souligné), « [à compléter] » en ambre pointillé.
import { Fragment, useMemo } from 'react';
import { CODE_KINDS, diffWords, diffStats, TO_COMPLETE_SPLIT, type Change } from './model';

function Marked({ text, cls }: { text: string; cls?: string }) {
  const parts = text.split(TO_COMPLETE_SPLIT);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="ag-todo">
            {p}
            <span className="sr-only"> (à compléter avant validation)</span>
          </mark>
        ) : p ? (
          cls ? (
            <span key={i} className={cls}>
              {p}
            </span>
          ) : (
            <Fragment key={i}>{p}</Fragment>
          )
        ) : null,
      )}
    </>
  );
}

export function DiffColumns({ change, editor }: { change: Pick<Change, 'kind' | 'before' | 'after' | 'beforeSource'>; editor?: React.ReactNode }) {
  const segs = useMemo(() => diffWords(change.before, change.after), [change.before, change.after]);
  const stats = diffStats(segs);
  const code = CODE_KINDS.has(change.kind);
  const emptyBefore = !change.before;
  return (
    <>
      <div className="ag-diff">
        <div className="ag-col" data-side="before">
          <div className="ag-col-h">
            <b>Avant</b>
            <span>{change.beforeSource === 'platform' ? 'lu sur votre site' : change.beforeSource === 'crawl' ? 'lu lors de l’analyse' : 'absent'}</span>
          </div>
          {emptyBefore ? (
            <p className="ag-txt" data-empty="">
              Rien pour l’instant
            </p>
          ) : (
            <p className="ag-txt" data-code={code ? '' : undefined}>
              {segs.map((s, i) =>
                s.t === 'add' ? null : s.t === 'del' ? (
                  <del key={i} className="ag-del">
                    <span className="sr-only">[retiré : </span>
                    {s.s}
                    <span className="sr-only">]</span>
                  </del>
                ) : (
                  <Fragment key={i}>{s.s}</Fragment>
                ),
              )}
            </p>
          )}
        </div>
        <div className="ag-col" data-side="after">
          <div className="ag-col-h">
            <b>Après</b>
            <span>
              {stats.added ? `+${stats.added} mot${stats.added > 1 ? 's' : ''}` : ''}
              {stats.added && stats.removed ? ', ' : ''}
              {stats.removed ? `−${stats.removed} mot${stats.removed > 1 ? 's' : ''}` : ''}
            </span>
          </div>
          {editor ?? (
            <p className="ag-txt" data-code={code ? '' : undefined}>
              {segs.map((s, i) =>
                s.t === 'del' ? null : s.t === 'add' ? (
                  <ins key={i} className="ag-add">
                    <span className="sr-only">[ajouté : </span>
                    <Marked text={s.s} />
                    <span className="sr-only">]</span>
                  </ins>
                ) : (
                  <Marked key={i} text={s.s} />
                ),
              )}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export function DiffLegend({ todo = false }: { todo?: boolean }) {
  return (
    <p className="ag-legend m-0" aria-hidden="true">
      <span>
        <del className="ag-del">retiré</del>
      </span>
      <span>
        <ins className="ag-add">ajouté</ins>
      </span>
      {todo && (
        <span>
          <mark className="ag-todo">[à compléter]</mark> à remplir par vous
        </span>
      )}
    </p>
  );
}
