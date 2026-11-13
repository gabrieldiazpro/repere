'use client';

// Bouton « Créer la tâche » des écrans Mesure (POST /api/exec/tasks). Démo : tâche gardée sur cet appareil.
import { useState } from 'react';
import Link from 'next/link';
import type { ExecTask } from '@/lib/engine/types-v2';
import { Icon } from '../icons';
import { localDemo } from '../localDemo';

export interface TaskDraft {
  id: string;
  title: string;
  why: string;
  minutes: number;
  impact: 1 | 2 | 3;
  steps?: string[];
  kind?: ExecTask['kind'];
  sourceDomain?: string;
}

export function TaskButton({ businessId, draft, demo, label = 'Créer la tâche', size = 'sm', primary = false }: { businessId: string; draft: TaskDraft; demo: boolean; label?: string; size?: 'sm' | 'md'; primary?: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'local' | 'err'>('idle');
  const [id, setId] = useState(draft.id);
  async function create() {
    setState('busy');
    try {
      const res = await fetch('/api/exec/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          businessId,
          task: {
            title: draft.title.slice(0, 160),
            why: draft.why.slice(0, 600),
            minutes: Math.min(600, draft.minutes),
            impact: draft.impact,
            steps: draft.steps?.slice(0, 12).map((x) => x.slice(0, 300)),
          },
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const j = (await res.json().catch(() => null)) as { task?: { id?: string } } | null;
      if (j?.task?.id) setId(j.task.id);
      setState('done');
    } catch {
      if (demo) {
        localDemo.addTask({
          id: draft.id,
          businessId,
          kind: draft.kind ?? 'content',
          title: draft.title,
          why: draft.why,
          automation: 'guide',
          minutes: draft.minutes,
          impact: draft.impact,
          status: 'todo',
          steps: draft.steps,
          sourceDomain: draft.sourceDomain,
          createdAt: new Date().toISOString(),
        } as ExecTask);
        setState('local');
      } else setState('err');
    }
  }
  if (state === 'done' || state === 'local')
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-[var(--success-ink)]" role="status">
        <Icon name="check" size={16} /> Tâche créée{state === 'local' ? ' sur cet appareil (démo)' : ''}.
        <Link href={`/app/actions?t=${encodeURIComponent(id)}`} className="rp-link">
          Voir la tâche
        </Link>
      </span>
    );
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className={`rp-btn ${size === 'sm' ? 'rp-btn-sm' : ''} ${primary ? 'rp-btn-primary' : ''}`} onClick={create} disabled={state === 'busy'}>
        <Icon name="plus" size={15} /> {label}
      </button>
      {state === 'err' && <span className="text-[13px] text-[var(--danger-ink)]">La tâche n’a pas été créée. Réessayez.</span>}
    </span>
  );
}

/** Copier un texte (brief, réponse) dans le presse-papiers. */
export function CopyText({ text, label = 'Copier' }: { text: string; label?: string }) {
  const [ok, setOk] = useState<boolean | null>(null);
  return (
    <button
      type="button"
      className="rp-btn rp-btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
        } catch {
          setOk(false);
        }
        setTimeout(() => setOk(null), 2500);
      }}
    >
      <Icon name={ok ? 'check' : 'copy'} size={15} />
      {ok === true ? 'Copié' : ok === false ? 'Copie impossible' : label}
      <span className="sr-only" role="status">{ok === true ? 'Texte copié' : ''}</span>
    </button>
  );
}
