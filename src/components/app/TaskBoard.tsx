'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecTask, TaskStatus } from '@/lib/engine/types-v2';
import { CopyButton } from './CopyButton';
import { Icon } from './icons';
import { localDemo, sessionHeaders } from './localDemo';
import { applyDemoTaskState } from './demoTaskState';
import { toast } from './shell/client';
import { ProgressBar } from '@/components/ui/Progress';
import { AUTOMATION_LABEL, minutes, STATUS_LABEL, TASK_KIND_LABEL } from './tokens';
import { fr } from '@/components/ui/typo';

type Deliverable = NonNullable<ExecTask['deliverable']>[number];

/** Événement émis à chaque changement de statut : la coquille (badge « à faire » du menu) se met à jour tout de suite. */
export const TASK_EVENT = 'rp:task-status';
export interface TaskEventDetail { id: string; status: TaskStatus }

export function useTasks(initial: ExecTask[], businessId: string, demo: boolean) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initial);
  const [note, setNote] = useState<string | null>(null);
  const refresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(tasks);
  latest.current = tasks;
  useEffect(() => {
    if (!demo) return;
    const st = localDemo.taskState();
    const created = localDemo.created(businessId);
    setTasks((cur) => applyDemoTaskState([...created.filter((c) => !cur.some((t) => t.id === c.id)), ...cur], st));
  }, [businessId, demo]);
  // Un autre bloc de la page (accueil, Centre d'actions) a changé une tâche : on s'aligne.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<TaskEventDetail>).detail;
      setTasks((cur) => (cur.some((t) => t.id === d.id && t.status !== d.status) ? cur.map((t) => (t.id === d.id ? { ...t, status: d.status, doneAt: d.status === 'done' ? t.doneAt ?? new Date().toISOString() : undefined } : t)) : cur));
    };
    window.addEventListener(TASK_EVENT, on);
    return () => window.removeEventListener(TASK_EVENT, on);
  }, []);
  useEffect(() => () => {
    if (refresh.current) clearTimeout(refresh.current);
  }, []);

  /** Rafraîchit les parties rendues côté serveur (accueil, compteurs) une fois l'enregistrement fait. */
  function syncServer() {
    if (refresh.current) clearTimeout(refresh.current);
    refresh.current = setTimeout(() => router.refresh(), 700);
  }

  function apply(id: string, status: TaskStatus) {
    latest.current = latest.current.map((t) => (t.id === id ? { ...t, status } : t));
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status, doneAt: status === 'done' ? new Date().toISOString() : undefined } : t)));
    window.dispatchEvent(new CustomEvent<TaskEventDetail>(TASK_EVENT, { detail: { id, status } }));
  }

  async function setStatus(id: string, status: TaskStatus, opts: { silent?: boolean } = {}) {
    const before = latest.current.find((t) => t.id === id);
    if (!before || before.status === status) return;
    // Mise à jour optimiste : coche, compteurs et annonce tout de suite (l'enregistrement suit).
    apply(id, status);
    setNote(null);
    if (status === 'done' && !opts.silent) {
      toast({
        tone: 'success',
        text: demo ? 'C’est fait. Démo : enregistré sur cet appareil.' : 'C’est fait. Repéré mesurera l’effet à J+14 puis à J+30.',
        action: { label: 'Annuler', onClick: () => void setStatus(id, before.status, { silent: true }) },
      });
    }
    if (demo) {
      // Comptes démo en lecture seule côté serveur : l'état vit sur cet appareil (relu par le rendu serveur via cookie).
      localDemo.setStatus(id, status);
      syncServer();
      return;
    }
    try {
      const res = await fetch(`/api/exec/tasks/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: sessionHeaders(),
        credentials: 'same-origin',
        body: JSON.stringify({ businessId, status }),
      });
      if (!res.ok) throw new Error(String(res.status));
      syncServer();
    } catch {
      apply(id, before.status);
      setNote('Le changement n’a pas été enregistré. Vérifiez votre connexion puis réessayez.');
      toast({ tone: 'error', text: 'Le changement n’a pas été enregistré. Réessayez.' });
    }
  }
  return { tasks, setStatus, note };
}

function mondayIso() {
  const d = new Date();
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export function Impact({ n }: { n: 1 | 2 | 3 }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Impact ${n} sur 3`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className="h-2.5 w-1.5 rounded-[2px]" style={{ background: i <= n ? 'var(--primary)' : 'var(--line)' }} aria-hidden="true" />
      ))}
      <span className="sr-only">Impact {n} sur 3</span>
    </span>
  );
}

export function DoneButton({ task, onSet, size = 'md' }: { task: ExecTask; onSet: (s: TaskStatus) => void; size?: 'sm' | 'md' }) {
  const done = task.status === 'done';
  const [played, setPlayed] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPlayed(!done);
        onSet(done ? 'todo' : 'done');
      }}
      aria-pressed={done}
      className={`rp-btn v4-press ${size === 'sm' ? 'rp-btn-sm' : ''} ${done ? 'rp-btn-done' : ''} ${done && played ? 'v4-pop' : ''}`}
    >
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`v4-check ${done && played ? 'v4-check-play' : ''}`}>
        <rect x="4" y="4" width="16" height="16" rx="4" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </svg>
      {done ? 'Fait' : 'C’est fait'}
      <span className="sr-only"> : {task.title}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Livrables
// ---------------------------------------------------------------------------
function JsonLdPreview({ code }: { code: string }) {
  let obj: Record<string, unknown> | null = null;
  try {
    obj = JSON.parse(code) as Record<string, unknown>;
  } catch {
    obj = null;
  }
  if (!obj) return <p className="text-[13px] text-[var(--muted)]">Aperçu indisponible : le code n’est pas un JSON valide.</p>;
  const rows = Object.entries(obj).filter(([k]) => k !== '@context');
  const show = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(show).join(', ');
    const o = v as Record<string, unknown>;
    const parts = Object.entries(o).filter(([k]) => k !== '@type').map(([, x]) => show(x));
    return `${o['@type'] ? `${String(o['@type'])} : ` : ''}${parts.join(', ')}`;
  };
  return (
    <dl className="grid grid-cols-[minmax(110px,30%)_1fr] gap-x-3 gap-y-1.5 rounded-[10px] border border-[var(--hair)] bg-[var(--bg)] p-3 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-[var(--muted)]">{k === '@type' ? 'Type' : k}</dt>
          <dd className="min-w-0 break-words">{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tabs({ tabs }: { tabs: { label: string; node: React.ReactNode }[] }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div role="tablist" className="mb-2 inline-flex rounded-lg bg-[var(--bg)] p-0.5">
        {tabs.map((t, k) => (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={i === k}
            onClick={() => setI(k)}
            className={`min-h-[30px] rounded-md px-3 text-[13px] font-medium ${i === k ? 'bg-[var(--surface)] text-[var(--ink)] shadow-[0_1px_2px_rgba(27,31,46,0.12)]' : 'text-[var(--muted)]'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tabs[i].node}</div>
    </div>
  );
}

export function DeliverableView({ d }: { d: Deliverable }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  let body: React.ReactNode;
  let copy = d.content;
  if (d.type === 'jsonld') {
    let pretty = d.content;
    try {
      pretty = JSON.stringify(JSON.parse(d.content), null, 2);
    } catch {
      /* tel quel */
    }
    copy = pretty;
    body = <Tabs tabs={[{ label: 'Aperçu', node: <JsonLdPreview code={pretty} /> }, { label: 'Code', node: <pre className="rp-code">{pretty}</pre> }]} />;
  } else if (d.type === 'html') {
    body = (
      <Tabs
        tabs={[
          { label: 'Code', node: <pre className="rp-code">{d.content}</pre> },
          {
            label: 'Aperçu',
            node: (
              <iframe
                title={`Aperçu : ${d.label ?? 'HTML'}`}
                sandbox=""
                srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font:14px/1.5 system-ui,sans-serif;color:#1B1F2E;background:#fff;margin:12px}summary{font-weight:600;cursor:pointer;margin:6px 0}</style>${d.content}`}
                className="h-48 w-full rounded-[10px] border border-[var(--hair)] bg-[var(--surface)]"
              />
            ),
          },
        ]}
      />
    );
  } else if (d.type === 'link') {
    const href = d.content;
    body = (
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--hair)] bg-[var(--bg)] p-3 text-[14px]">
        <span className="min-w-0 flex-1 truncate font-medium">{href}</span>
        <a href={href} target="_blank" rel="noopener" className="rp-btn rp-btn-sm">
          <Icon name="external" size={16} /> Ouvrir
        </a>
      </div>
    );
    copy = href.startsWith('/') && typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;
  } else if (d.type === 'checklist') {
    const items = d.content.split('\n').filter(Boolean);
    body = (
      <ul className="flex flex-col gap-1.5 rounded-[10px] border border-[var(--hair)] bg-[var(--bg)] p-3 text-[14px]">
        {items.map((it, k) => (
          <li key={k}>
            <label className="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" className="rp-check" checked={!!checked[k]} onChange={(e) => setChecked({ ...checked, [k]: e.target.checked })} />
              <span className={checked[k] ? 'text-[var(--muted)] line-through' : ''}>{it}</span>
            </label>
          </li>
        ))}
      </ul>
    );
  } else {
    body = <div className="rp-deliv-text">{d.content}</div>;
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{d.label ?? (d.type === 'jsonld' ? 'Balisage JSON-LD' : 'Livrable')}</p>
        {d.type !== 'checklist' && <CopyButton text={copy} />}
      </div>
      {body}
    </div>
  );
}

export function TaskDetail({ task, onSet }: { task: ExecTask; onSet: (s: TaskStatus) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rp-chip rp-chip-primary">{TASK_KIND_LABEL[task.kind]}</span>
          <span className="rp-chip">{AUTOMATION_LABEL[task.automation]}</span>
          <span className="rp-chip rp-num">{minutes(task.minutes)}</span>
          <span className={`rp-chip ${task.status === 'done' ? 'rp-chip-success' : task.status === 'in_progress' ? 'rp-chip-warning' : ''}`}>{STATUS_LABEL[task.status]}</span>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink)]">{task.why}</p>
        {task.sourceDomain && <p className="mt-1 text-[13px] text-[var(--muted)]">Source visée : {task.sourceDomain}</p>}
      </div>
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
      {task.deliverable?.map((d, i) => <DeliverableView key={i} d={d} />)}
      <div className="flex flex-wrap gap-2 border-t border-[var(--hair)] pt-3">
        <DoneButton task={task} onSet={onSet} />
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
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tableau complet (page Tâches)
// ---------------------------------------------------------------------------
export function TaskBoard({ initial, businessId, demo, initialSelected, weekIds }: { initial: ExecTask[]; businessId: string; demo: boolean; initialSelected?: string; weekIds?: string[] }) {
  const { tasks, setStatus, note } = useTasks(initial, businessId, demo);
  const week = mondayIso();
  const groups = useMemo(() => {
    const open = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
    const thisWeek = open.filter((t) => (weekIds ? weekIds.includes(t.id) || !initial.some((i) => i.id === t.id) : (t.week ?? '') >= week || t.kind === 'fact_fix'));
    const later = open.filter((t) => !thisWeek.includes(t));
    const done = tasks.filter((t) => t.status === 'done' || t.status === 'skipped');
    return [
      { key: 'week', label: 'Cette semaine', items: thisWeek, empty: 'Rien de prévu cette semaine. Prenez une tâche dans « Plus tard ».' },
      { key: 'later', label: 'Plus tard', items: later, empty: 'Aucune tâche en attente.' },
      { key: 'done', label: 'Fait', items: done, empty: 'Les tâches faites apparaîtront ici.' },
    ];
  }, [tasks, week, weekIds, initial]);
  const [sel, setSel] = useState<string | null>(initialSelected ?? groups[0].items[0]?.id ?? tasks[0]?.id ?? null);
  useEffect(() => {
    // sur mobile, rien n'est déplié d'office (sauf lien direct vers une tâche)
    if (!initialSelected && window.matchMedia('(max-width: 1023px)').matches) setSel(null);
  }, [initialSelected]);
  const selected = tasks.find((t) => t.id === sel) ?? null;
  const weekMin = groups[0].items.reduce((s, t) => s + t.minutes, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-5">
      <div className="flex flex-col gap-4">
        {note && (
          <p role="status" className="rounded-lg bg-[var(--primary-bg)] px-3 py-2 text-[13px] text-[var(--primary)]">
            {note}
          </p>
        )}
        {groups.map((g) => (
          <section key={g.key} aria-labelledby={`g-${g.key}`} className="rp-panel">
            <div className="rp-panel-head pb-2">
              <h2 id={`g-${g.key}`} className="rp-h2">
                {g.label} <span className="rp-num font-normal text-[var(--muted)]">· {g.items.length}</span>
              </h2>
              {g.key === 'week' && g.items.length > 0 && <span className="rp-sub rp-num">≈ {minutes(weekMin)} au total</span>}
            </div>
            {g.items.length === 0 ? (
              <p className="px-4 pb-4 text-[13px] text-[var(--muted)] lg:px-5">{g.empty}</p>
            ) : (
              <ul className="border-t border-[var(--hair)]">
                {g.items.map((t) => {
                  const on = t.id === sel;
                  return (
                    <li key={t.id} className="border-b border-[var(--hair)] last:border-b-0">
                      <div className={`flex items-start gap-3 px-4 py-3 lg:px-5 ${on ? 'bg-[var(--primary-bg)]' : ''}`}>
                        <button
                          type="button"
                          onClick={() => setSel(on ? null : t.id)}
                          aria-expanded={on}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className={`block text-[14px] font-semibold leading-snug ${t.status === 'done' ? 'text-[var(--muted)] line-through decoration-1' : ''}`}>{fr(t.title)}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--muted)]">
                            <span>{TASK_KIND_LABEL[t.kind]}</span>
                            <span aria-hidden="true">·</span>
                            <span className="rp-num">{minutes(t.minutes)}</span>
                            <Impact n={t.impact} />
                            {t.status === 'in_progress' && <span className="rp-chip rp-chip-warning">En cours</span>}
                            {t.status === 'skipped' && <span className="rp-chip">Écartée</span>}
                            {t.deliverable?.length ? <span className="rp-chip">Livrable prêt</span> : null}
                          </span>
                        </button>
                        <DoneButton task={t} onSet={(s) => setStatus(t.id, s)} size="sm" />
                      </div>
                      {on && (
                        <div className="border-t border-[var(--hair)] bg-[var(--surface)] px-4 py-4 lg:hidden">
                          <TaskDetail task={t} onSet={(s) => setStatus(t.id, s)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
      <aside className="hidden lg:sticky lg:top-5 lg:block" aria-label="Détail de la tâche">
        {selected ? (
          <div className="rp-panel">
            <div className="rp-panel-head">
              <h2 className="rp-display text-[19px]">{fr(selected.title)}</h2>
            </div>
            <div className="rp-panel-body">
              <TaskDetail task={selected} onSet={(s) => setStatus(selected.id, s)} />
            </div>
          </div>
        ) : (
          <div className="rp-panel p-6 text-center text-[14px] text-[var(--muted)]">Choisissez une tâche pour voir son livrable.</div>
        )}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Version courte (accueil) : 3 tâches de la semaine
// ---------------------------------------------------------------------------
export function WeeklyTasks({ initial, businessId, demo }: { initial: ExecTask[]; businessId: string; demo: boolean }) {
  const { tasks, setStatus, note } = useTasks(initial, businessId, demo);
  const shown = tasks.filter((t) => initial.some((i) => i.id === t.id));
  const done = shown.filter((t) => t.status === 'done').length;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <ProgressBar value={done} max={Math.max(1, shown.length)} label={`${done} tâche${done > 1 ? 's' : ''} de la semaine faite${done > 1 ? 's' : ''} sur ${shown.length}`} tone="up" size="sm" className="flex-1" />
        <span className="rp-num text-[12px] text-[var(--muted)]">
          {done}/{shown.length} faites
        </span>
      </div>
      <ul className="flex flex-col">
        {shown.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-[var(--hair)] py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <Link href={`/app/actions?t=${encodeURIComponent(t.id)}`} className={`block text-[14px] font-semibold leading-snug hover:underline ${t.status === 'done' ? 'text-[var(--muted)] line-through decoration-1' : ''}`}>
                {t.title}
              </Link>
              <span className="mt-0.5 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                <span className="rp-num">{minutes(t.minutes)}</span>
                <Impact n={t.impact} />
                <span>{AUTOMATION_LABEL[t.automation]}</span>
              </span>
            </div>
            <DoneButton task={t} onSet={(s) => setStatus(t.id, s)} size="sm" />
          </li>
        ))}
      </ul>
      {note && (
        <p role="status" className="mt-2 text-[12px] text-[var(--muted)]">
          {note}
        </p>
      )}
    </div>
  );
}
