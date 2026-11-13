'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Entitlements } from '@/lib/entitlements';
import type { ExecTask, TaskStatus } from '@/lib/engine/types-v2';
import type { ActionImpact } from '@/lib/measure';
import { fr } from '@/components/ui/typo';
import { Icon } from '../icons';
import { Verrou } from '../shell/Verrou';
import { DeliverableView, DoneButton, Impact, useTasks } from '../TaskBoard';
import { AUTOMATION_LABEL, EFFORT_LABEL, fmtDate, minutes, TASK_KIND_LABEL } from '../tokens';
import { ImpactView } from './ImpactView';
import { Verdict } from '../v4/Verdict';
import { FillBar } from '../v4/motion';
import { actionScore, calendarWeeks, effortOf, GROUP_LABEL, GROUP_ORDER, groupOf, sortActions, type ActionProof } from './model';
import { agentHrefForTask, agentKindForTask } from '../agent/model';

export interface ActionRow {
  id: string;
  proof: ActionProof;
}

const PROOF_ICON = { question: 'quote', source: 'link', error: 'alert', none: 'info' } as const;

function ProofLine({ proof }: { proof: ActionProof }) {
  return (
    <p className={`mt-1.5 flex gap-1.5 text-[13px] leading-snug ${proof.kind === 'error' ? 'text-[var(--danger-ink)]' : 'text-[var(--muted)]'}`}>
      <Icon name={PROOF_ICON[proof.kind]} size={15} className="mt-0.5 flex-none" />
      <span className="min-w-0">
        <span className="sr-only">Preuve : </span>
        {proof.text}
        {proof.href && (
          <>
            {' '}
            <Link href={proof.href} className="rp-link whitespace-nowrap">
              Voir
            </Link>
          </>
        )}
      </span>
    </p>
  );
}

function useImpact(task: ExecTask, businessId: string, demo: boolean, initial: ActionImpact | undefined) {
  const [impact, setImpact] = useState<ActionImpact | null>(initial ?? null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  useEffect(() => {
    if (task.status !== 'done' || impact || demo) return;
    let off = false;
    setState('loading');
    // La mesure démarre côté serveur quand la tâche passe à « faite » ; on lit son état.
    fetch(`/api/measure?businessId=${encodeURIComponent(businessId)}&taskId=${encodeURIComponent(task.id)}`, { credentials: 'same-origin' })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as { impact?: ActionImpact } | null;
        if (off) return;
        if (r.ok && j?.impact) {
          setImpact(j.impact);
          setState('idle');
        } else setState('error');
      })
      .catch(() => !off && setState('error'));
    return () => {
      off = true;
    };
  }, [task.status, task.id, businessId, demo, impact]);
  return { impact, state };
}

function DoneFollowUp({ task, businessId, demo, initial }: { task: ExecTask; businessId: string; demo: boolean; initial?: ActionImpact }) {
  const { impact, state } = useImpact(task, businessId, demo, initial);
  return (
    <div className="rounded-xl border border-[var(--hair)] p-3">
      <p className="mb-2 text-[13px] font-semibold">Avant / après</p>
      {impact ? (
        <ImpactView impact={impact} />
      ) : state === 'loading' ? (
        <div className="h-16 animate-pulse rounded-lg bg-[var(--bg)]" aria-label="Chargement de la mesure" />
      ) : demo ? (
        <p className="text-[13px] text-[var(--muted)]">
          Démo : sur un vrai compte, l’état « avant » est pris maintenant, puis les questions liées sont reposées aux IA à J+14 et J+30. Le résultat s’affiche ici avec sa marge d’erreur.
        </p>
      ) : (
        <p className="text-[13px] text-[var(--muted)]">La mesure démarre : l’état « avant » est enregistré, les relances sont prévues à J+14 et J+30. Revenez plus tard.</p>
      )}
    </div>
  );
}

function ActionDetail({ task, onSet, ent, businessId, demo, impact }: { task: ExecTask; onSet: (s: TaskStatus) => void; ent: Entitlements; businessId: string; demo: boolean; impact?: ActionImpact }) {
  const q = `Comment faire : ${task.title}`;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[14px] leading-relaxed">{task.why}</p>
      {task.steps && task.steps.length > 0 && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Étapes</p>
          <ol className="flex flex-col gap-1.5 text-[14px]">
            {task.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="rp-num mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[var(--bg)] text-[11px] font-semibold text-[var(--muted)]">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {task.deliverable?.length ? (
        <Verrou ent={ent} feature="execution" titre="Livrable prêt à copier" apercu>
          <div className="flex flex-col gap-4">
            {task.deliverable.map((d, i) => (
              <DeliverableView key={i} d={d} />
            ))}
          </div>
        </Verrou>
      ) : null}
      {task.status === 'done' && <DoneFollowUp task={task} businessId={businessId} demo={demo} initial={impact} />}
      <div className="flex flex-wrap gap-2 border-t border-[var(--hair)] pt-3">
        <DoneButton task={task} onSet={onSet} />
        {agentKindForTask(task.kind) && task.status !== 'done' && task.status !== 'skipped' && (
          <Link href={agentHrefForTask(task.id)} className="rp-btn">
            <Icon name="send" size={16} /> Faire par l’agent
          </Link>
        )}
        {task.status === 'todo' && (
          <button type="button" className="rp-btn" onClick={() => onSet('in_progress')}>
            Je m’en occupe
          </button>
        )}
        {task.status !== 'skipped' && task.status !== 'done' && (
          <button type="button" className="rp-btn rp-btn-ghost" onClick={() => onSet('skipped')}>
            Écarter
          </button>
        )}
        {task.status === 'skipped' && (
          <button type="button" className="rp-btn" onClick={() => onSet('todo')}>
            Remettre à faire
          </button>
        )}
        <Link href={`/app/copilote?context=actions&q=${encodeURIComponent(q)}`} className="rp-btn rp-btn-ghost">
          <Icon name="spark" size={16} /> Demander au copilote
        </Link>
      </div>
    </div>
  );
}

function Row({ task, proof, open, onToggle, onSet, ent, businessId, demo, impact, fresh }: { task: ExecTask; proof: ActionProof; open: boolean; onToggle: () => void; onSet: (s: TaskStatus) => void; ent: Entitlements; businessId: string; demo: boolean; impact?: ActionImpact; fresh?: boolean }) {
  const score = actionScore(task);
  const done = task.status === 'done';
  const [dragging, setDragging] = useState(false);
  const canDrag = task.status === 'todo' || task.status === 'in_progress';
  return (
    <li
      className={`border-b border-[var(--hair)] last:border-b-0 ${fresh ? 'v4-swap' : ''}`}
      id={`a-${task.id}`}
      draggable={canDrag}
      data-dragging={dragging || undefined}
      onDragStart={(e) => {
        if (!canDrag) return;
        e.dataTransfer.setData('text/x-repere-task', task.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      <div className={`flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 sm:flex-nowrap lg:px-5 ${open ? 'bg-[var(--primary-bg)]' : ''}`}>
        <span
          className={`rp-num mt-0.5 flex h-9 w-9 flex-none flex-col items-center justify-center rounded-lg text-[15px] font-bold leading-none ${score >= 6 ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'bg-[var(--bg)] text-[var(--ink)]'}`}
          title="Priorité : impact × facilité, sur 9"
        >
          {score}
          <span className="sr-only"> sur 9 de priorité</span>
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-48px)] sm:basis-0">
          <button type="button" onClick={onToggle} aria-expanded={open} className="block w-full text-left">
            <span className={`block text-[15px] font-semibold leading-snug ${done ? 'text-[var(--muted)] line-through decoration-1' : ''}`}>{fr(task.title)}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
              <span>{TASK_KIND_LABEL[task.kind]}</span>
              <span aria-hidden="true">·</span>
              <Impact n={task.impact} />
              <span>{EFFORT_LABEL[effortOf(task.minutes)]}</span>
              <span className="rp-num">({minutes(task.minutes)})</span>
              <span aria-hidden="true">·</span>
              <span>{AUTOMATION_LABEL[task.automation]}</span>
              {task.status === 'in_progress' && <span className="rp-chip rp-chip-warning">En cours</span>}
              {impact && <span className="rp-chip rp-chip-primary">Mesuré</span>}
            </span>
          </button>
          {!done && <ProofLine proof={proof} />}
        </div>
        {/* Mobile : sous le texte (aligné sur lui) pour lui laisser toute la largeur. */}
        <div className="pl-12 sm:pl-0">
          <DoneButton task={task} onSet={onSet} size="sm" />
        </div>
      </div>
      {open && (
        <div className="border-t border-[var(--hair)] px-4 py-4 lg:px-5 lg:pl-[68px]">
          <ActionDetail task={task} onSet={onSet} ent={ent} businessId={businessId} demo={demo} impact={impact} />
        </div>
      )}
    </li>
  );
}

function Calendar({ tasks, onOpen }: { tasks: ExecTask[]; onOpen: (id: string) => void }) {
  const weeks = useMemo(() => calendarWeeks(tasks, new Date()), [tasks]);
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Calendrier des actions par semaine">
      {weeks.map((w) => {
        const end = new Date(`${w.monday}T00:00:00Z`);
        end.setUTCDate(end.getUTCDate() + 6);
        return (
          <li key={w.monday} className={`rp-panel p-4 ${w.current ? 'ring-2 ring-[var(--primary)]' : ''}`} aria-current={w.current ? 'date' : undefined}>
            <p className="text-[13px] font-semibold">
              {w.current ? 'Cette semaine' : `Semaine du ${fmtDate(w.monday, { day: 'numeric', month: 'short' })}`}
              <span className="font-normal text-[var(--muted)]"> · {fmtDate(w.monday, { day: 'numeric', month: 'short' })} – {fmtDate(end.toISOString(), { day: 'numeric', month: 'short' })}</span>
            </p>
            {w.planned.length + w.done.length === 0 ? (
              <p className="mt-2 text-[13px] text-[var(--muted)]">Rien de prévu.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                {w.done.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="check" size={15} className="mt-0.5 flex-none text-[var(--success)]" />
                    <button type="button" className="text-left text-[var(--muted)] line-through decoration-1 hover:underline" onClick={() => onOpen(t.id)}>
                      {fr(t.title)}
                    </button>
                  </li>
                ))}
                {w.planned.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full bg-[var(--primary)]" aria-hidden="true" />
                    <button type="button" className="text-left hover:underline" onClick={() => onOpen(t.id)}>
                      {fr(t.title)} <span className="rp-num text-[var(--muted)]">({minutes(t.minutes)})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ActionCenter({
  initial,
  proofs,
  impacts,
  businessId,
  demo,
  ent,
  initialSelected,
}: {
  initial: ExecTask[];
  proofs: Record<string, ActionProof>;
  impacts: ActionImpact[];
  businessId: string;
  demo: boolean;
  ent: Entitlements;
  initialSelected?: string;
}) {
  const { tasks, setStatus, note } = useTasks(initial, businessId, demo);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [open, setOpen] = useState<string | null>(initialSelected ?? null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const impactBy = useMemo(() => Object.fromEntries(impacts.map((i) => [i.taskId, i])), [impacts]);

  useEffect(() => {
    if (initialSelected) document.getElementById(`a-${initialSelected}`)?.scrollIntoView({ block: 'center' });
  }, [initialSelected]);

  const openTasks = sortActions(tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress'));
  const doneTasks = tasks.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const skipped = tasks.filter((t) => t.status === 'skipped');
  const groups = GROUP_ORDER.map((g) => ({ g, items: openTasks.filter((t) => groupOf(t.kind) === g) })).filter((x) => x.items.length);
  const orphanImpacts = impacts.filter((i) => !tasks.some((t) => t.id === i.taskId));
  // Démo : une action cochée sur cet appareil apparaît tout de suite ici, avec sa date (pas de mesure serveur).
  const pendingDone = demo ? doneTasks.filter((t) => t.doneAt && !impactBy[t.id]).slice(0, 4) : [];
  const plusDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86_400_000).toISOString();
  const top = openTasks[0];
  const totalMin = openTasks.reduce((s, t) => s + t.minutes, 0);
  const proof = (t: ExecTask): ActionProof => proofs[t.id] ?? { kind: 'none', text: t.why };
  const rowProps = (t: ExecTask) => ({
    task: t,
    proof: proof(t),
    open: open === t.id,
    onToggle: () => setOpen(open === t.id ? null : t.id),
    onSet: (s: TaskStatus) => markAs(t.id, s),
    ent,
    businessId,
    demo,
    impact: impactBy[t.id],
    fresh: fresh === t.id,
  });
  function markAs(id: string, s: TaskStatus) {
    void setStatus(id, s);
    setFresh(id);
    if (s === 'done') setOpen(id);
  }
  const doneShare = tasks.length ? doneTasks.length / Math.max(1, doneTasks.length + openTasks.length) : 0;

  return (
    <div className="flex flex-col gap-4" data-visite="actions">
      {top ? (
        <Verdict
          tone="brand"
          id="top-h"
          title={fr(top.title)}
          lead={
            <>
              <strong className="font-semibold text-[var(--ink)]">À faire en premier</strong>, {EFFORT_LABEL[effortOf(top.minutes)].toLowerCase()} ({minutes(top.minutes)}), {AUTOMATION_LABEL[top.automation].toLowerCase()}. {proof(top).text}
            </>
          }
          figure={{ value: openTasks.length, label: `action${openTasks.length > 1 ? 's' : ''} à faire, environ ${minutes(totalMin)} au total` }}
          action={
            <button
              type="button"
              className="rp-btn rp-btn-primary v4-press"
              onClick={() => {
                setView('list');
                setOpen(top.id);
                setTimeout(() => document.getElementById(`a-${top.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
              }}
            >
              <Icon name="file" size={16} /> Voir le livrable prêt à copier
            </button>
          }
          details={
            <p>
              Les actions sont classées par priorité : effet attendu × facilité. Chacune montre sa preuve, arrive avec son livrable prêt à copier, puis son effet est mesuré à J+14 et J+30.
            </p>
          }
          detailsLabel="Comment les actions sont classées"
        />
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="v4-progress min-w-[240px] flex-1 text-[14px] text-[var(--muted)]">
          <span>
            <strong className="rp-num font-semibold text-[var(--ink)]">{doneTasks.length}</strong> faite{doneTasks.length > 1 ? 's' : ''} sur <span className="rp-num">{doneTasks.length + openTasks.length}</span>
          </span>
          <FillBar value={doneShare} tone="good" className="max-w-[280px]" key={doneTasks.length} />
        </div>
        <div className="rp-seg" role="radiogroup" aria-label="Affichage">
          <button type="button" className="rp-seg-btn" role="radio" aria-checked={view === 'list'} onClick={() => setView('list')}>
            <Icon name="list" size={15} /> Liste
          </button>
          <button type="button" className="rp-seg-btn" role="radio" aria-checked={view === 'calendar'} onClick={() => setView('calendar')}>
            <Icon name="flag" size={15} /> Calendrier
          </button>
        </div>
      </div>
      {note && (
        <p role="status" className="rounded-lg bg-[var(--primary-bg)] px-3 py-2 text-[13px] text-[var(--primary)]">
          {note}
        </p>
      )}

      {view === 'calendar' ? (
        <Calendar
          tasks={tasks}
          onOpen={(id) => {
            setView('list');
            setOpen(id);
            setTimeout(() => document.getElementById(`a-${id}`)?.scrollIntoView({ block: 'center' }), 50);
          }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-5">
          <div className="flex flex-col gap-4">
            {groups.length === 0 && (
              <div className="rp-panel p-6 text-center">
                <p className="font-semibold">Toutes vos actions sont faites.</p>
                <p className="mx-auto mt-1 max-w-md text-[14px] text-[var(--muted)]">De nouvelles actions arrivent après la prochaine mesure. Suivez l’effet des actions faites ci-dessous.</p>
              </div>
            )}
            {groups.map(({ g, items }) => (
              <section key={g} aria-labelledby={`g-${g}`} className="rp-panel">
                <div className="rp-panel-head pb-1">
                  <h2 id={`g-${g}`} className="rp-h2">
                    {GROUP_LABEL[g].title} <span className="rp-num font-normal text-[var(--muted)]">· {items.length}</span>
                  </h2>
                </div>
                <p className="px-4 pb-2 text-[13px] text-[var(--muted)] lg:px-5">{GROUP_LABEL[g].lead}</p>
                <ul className="border-t border-[var(--hair)]">
                  {items.map((t) => (
                    <Row key={t.id} {...rowProps(t)} />
                  ))}
                </ul>
              </section>
            ))}
            {(doneTasks.length > 0 || skipped.length > 0) && (
              <section aria-labelledby="g-done" className="rp-panel">
                <div className="rp-panel-head pb-2">
                  <h2 id="g-done" className="rp-h2">
                    Faites <span className="rp-num font-normal text-[var(--muted)]">· {doneTasks.length}</span>
                  </h2>
                </div>
                <ul className="border-t border-[var(--hair)]">
                  {[...doneTasks, ...skipped].map((t) => (
                    <Row key={t.id} {...rowProps(t)} />
                  ))}
                </ul>
              </section>
            )}
          </div>
          <aside className="flex flex-col gap-4 lg:sticky lg:top-5" aria-labelledby="effet-h">
            {openTasks.length > 0 && (
              <div
                className="v4-dropzone hidden lg:flex"
                data-over={over || undefined}
                onDragOver={(e) => {
                  if (!e.dataTransfer.types.includes('text/x-repere-task')) return;
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  const id = e.dataTransfer.getData('text/x-repere-task');
                  if (id) markAs(id, 'done');
                }}
              >
                <Icon name="check" size={18} />
                {over ? 'Lâchez : c’est fait' : 'Glissez ici une action faite'}
              </div>
            )}
            <section className="rp-panel">
              <div className="rp-panel-head">
                <h2 id="effet-h" className="rp-h2">
                  Effet de vos actions
                </h2>
              </div>
              <div className="rp-panel-body flex flex-col gap-4">
                {pendingDone.map((t) => (
                  <div key={`p-${t.id}`} className="border-b border-[var(--hair)] pb-4 last:border-b-0 last:pb-0" data-impact="pending">
                    <p className="mb-1.5 text-[14px] font-semibold leading-snug">{fr(t.title)}</p>
                    <p className="mb-2 text-[12px] text-[var(--muted)]">Faite le {fmtDate(t.doneAt!, { day: 'numeric', month: 'long' })} · démo, sur cet appareil</p>
                    <p className="text-[13px]">
                      Mesure « après » prévue le {fmtDate(plusDays(t.doneAt!, 14), { day: 'numeric', month: 'long' })} (J+14) puis le {fmtDate(plusDays(t.doneAt!, 30), { day: 'numeric', month: 'long' })} (J+30). Sur votre compte, Repéré repose alors les questions liées.
                    </p>
                  </div>
                ))}
                {impacts.length === 0 && pendingDone.length === 0 ? (
                  <p className="text-[13px] text-[var(--muted)]">
                    Cochez « C’est fait » sur une action : Repéré note l’état « avant », repose les questions liées aux IA à J+14 et J+30, et vous dit honnêtement si l’écart dépasse la marge d’erreur.
                  </p>
                ) : (
                  impacts.slice(0, Math.max(0, 4 - pendingDone.length)).map((i) => (
                    <div key={i.taskId} className="border-b border-[var(--hair)] pb-4 last:border-b-0 last:pb-0">
                      <p className="mb-1.5 text-[14px] font-semibold leading-snug">{fr(i.taskTitle)}</p>
                      <p className="mb-2 text-[12px] text-[var(--muted)]">Faite le {fmtDate(i.doneAt, { day: 'numeric', month: 'long' })}</p>
                      <ImpactView impact={i} compact={!orphanImpacts.includes(i) && impacts.length > 1} />
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
