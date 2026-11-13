'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Check, CheckStatus } from '@/lib/siteaudit/types';
import { Icon } from '../icons';
import { createTask, type NewTask } from './createTask';

export const STATUS_UI: Record<CheckStatus, { label: string; cls: string; icon: 'check' | 'alert' | 'close' }> = {
  ok: { label: 'Conforme', cls: 'rp-chip-success', icon: 'check' },
  warn: { label: 'À améliorer', cls: 'rp-chip-warning', icon: 'alert' },
  fail: { label: 'À corriger', cls: 'rp-chip-danger', icon: 'close' },
};

/** Score /100 avec jauge simple (couleur par tranche, doublée d'un libellé). */
export function ScoreBlock({ score, label, sub }: { score: number; label: string; sub?: React.ReactNode }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const tone = s >= 70 ? 'var(--success)' : s >= 40 ? 'var(--warning)' : 'var(--danger)';
  const word = s >= 70 ? 'Bon' : s >= 40 ? 'Moyen' : 'Faible';
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative grid h-[84px] w-[84px] flex-none place-items-center rounded-full"
        style={{ background: `conic-gradient(${tone} ${s * 3.6}deg, var(--hair) 0)` }}
        role="img"
        aria-label={`${label} : ${s} sur 100, ${word.toLowerCase()}`}
      >
        <div className="grid h-[68px] w-[68px] place-items-center rounded-full bg-[var(--surface)]">
          <span className="rp-display rp-num text-[26px] leading-none">{s}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13px] text-[var(--muted)]">{label}</p>
        <p className="rp-display text-[20px]">
          {word} <span className="rp-num text-[15px] font-normal text-[var(--muted)]">· {s}/100</span>
        </p>
        {sub && <div className="text-[13px] text-[var(--muted)]">{sub}</div>}
      </div>
    </div>
  );
}

export function CreateTaskButton({ businessId, demo, task, label = 'Créer la tâche' }: { businessId: string; demo: boolean; task: NewTask; label?: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'demo' | 'error'>('idle');
  const [err, setErr] = useState('');
  if (state === 'done' || state === 'demo') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-[13px] text-[var(--success-ink)]" role="status">
        <Icon name="check" size={15} /> Tâche créée{state === 'demo' ? ' (démo : gardée sur cet appareil)' : ''}.
        <Link href="/app/actions" className="rp-link">
          Voir mes actions
        </Link>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="rp-btn rp-btn-sm"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          const r = await createTask(businessId, demo, task);
          if (r.ok) setState(r.demo ? 'demo' : 'done');
          else {
            setErr(r.error);
            setState('error');
          }
        }}
      >
        <Icon name="plus" size={15} /> {state === 'busy' ? 'Création…' : label}
      </button>
      {state === 'error' && (
        <span role="alert" className="text-[12px] text-[var(--danger-ink)]">
          {err}
        </span>
      )}
    </span>
  );
}

export function impactOfCheck(c: Pick<Check, 'maxPoints'>): 1 | 2 | 3 {
  return c.maxPoints >= 10 ? 3 : c.maxPoints >= 5 ? 2 : 1;
}

/** Liste de contrôles : à corriger d'abord, puis à améliorer, puis conformes (repliés). */
export function CheckList({ checks, businessId, demo, taskPrefix }: { checks: Check[]; businessId: string; demo: boolean; taskPrefix: string }) {
  const [showOk, setShowOk] = useState(false);
  const order: CheckStatus[] = ['fail', 'warn', 'ok'];
  const sorted = [...checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || b.maxPoints - a.maxPoints);
  const ok = sorted.filter((c) => c.status === 'ok');
  const shown = showOk ? sorted : sorted.filter((c) => c.status !== 'ok');
  return (
    <div>
      <ul className="flex flex-col">
        {shown.map((c) => {
          const ui = STATUS_UI[c.status];
          return (
            <li key={c.id} className="border-b border-[var(--hair)] py-3 last:border-b-0">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rp-chip ${ui.cls} flex-none`}>
                  <Icon name={ui.icon} size={13} /> {ui.label}
                </span>
                <p className="min-w-0 flex-1 text-[14px] font-semibold leading-snug">{c.label}</p>
                {!c.informational && (
                  <span className="rp-num text-[12px] text-[var(--muted)]">
                    {c.points}/{c.maxPoints} pts
                  </span>
                )}
              </div>
              <p className="mt-1 text-[13px] text-[var(--muted)]">{c.detail}</p>
              {c.status !== 'ok' && c.fix && (
                <div className="mt-2 flex flex-col gap-2 rounded-lg bg-[var(--bg)] px-3 py-2 sm:flex-row sm:items-center">
                  <p className="min-w-0 flex-1 text-[13px]">
                    <span className="font-semibold">Correctif : </span>
                    {c.fix}
                  </p>
                  <CreateTaskButton businessId={businessId} demo={demo} task={{ title: `${taskPrefix} : ${c.label}`, why: c.detail, steps: [c.fix], minutes: 30, impact: impactOfCheck(c) }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {ok.length > 0 && (
        <button type="button" className="rp-link mt-2 text-[13px]" onClick={() => setShowOk(!showOk)} aria-expanded={showOk}>
          {showOk ? 'Masquer les points conformes' : `Voir les ${ok.length} points conformes`}
        </button>
      )}
    </div>
  );
}
