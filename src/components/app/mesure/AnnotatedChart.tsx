'use client';

// Courbe avec repères (tâches faites, repères manuels) et ajout d'un repère (/api/annotations).
// Compte démo : le repère est gardé sur cet appareil, avec la mention « démo ».
import { useEffect, useId, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, type Series } from '../ChartsClient';
import { markersFor } from './chart';
import { demoStore, type DemoNote } from './demoStore';

export interface ChartNote {
  id: string;
  date: string;
  label: string;
  kind: 'manual' | 'action' | 'external' | 'local';
}

const KIND_LABEL: Record<ChartNote['kind'], string> = { manual: 'Votre repère', action: 'Tâche faite', external: 'Événement', local: 'Repère (démo, cet appareil)' };

export function AnnotatedChart({
  title,
  series,
  labels,
  dates,
  notes,
  businessId,
  demo,
  mode = 'pct',
  height = 240,
  seriesKey = 'all',
}: {
  title: string;
  series: Series[];
  labels: string[];
  /** date ISO de chaque point (même longueur que labels) */
  dates: string[];
  notes: ChartNote[];
  businessId: string;
  demo: boolean;
  mode?: 'pct' | 'int' | 'dec';
  height?: number;
  seriesKey?: 'all' | 'score' | 'sov' | 'citations';
}) {
  const router = useRouter();
  const uid = useId();
  const [local, setLocal] = useState<DemoNote[]>([]);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'busy' | 'ok' | 'local' | 'err'; msg?: string }>({ kind: 'idle' });

  useEffect(() => {
    if (demo) setLocal(demoStore.notes(businessId));
  }, [demo, businessId]);

  const all: ChartNote[] = useMemo(
    () => [...notes, ...local.map((n) => ({ ...n, kind: 'local' as const }))].sort((a, b) => a.date.localeCompare(b.date)),
    [notes, local],
  );
  const markers = useMemo(() => markersFor(dates, all), [dates, all]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = label.trim();
    if (!text) return setState({ kind: 'err', msg: 'Écrivez ce qui s’est passé (80 caractères au plus).' });
    setState({ kind: 'busy' });
    try {
      const res = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ businessId, date, label: text.slice(0, 80), series: seriesKey }),
      });
      if (res.ok) {
        setLabel('');
        setState({ kind: 'ok' });
        router.refresh();
        return;
      }
      if (demo && (res.status === 403 || res.status === 401)) throw new Error('demo');
      const j = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: 'err', msg: j?.error ?? 'Le repère n’a pas été enregistré. Réessayez.' });
    } catch {
      if (demo) {
        demoStore.addNote(businessId, date, text.slice(0, 80));
        setLocal(demoStore.notes(businessId));
        setLabel('');
        setState({ kind: 'local' });
      } else setState({ kind: 'err', msg: 'Connexion impossible : le repère n’a pas été enregistré.' });
    }
  }

  return (
    <div>
      {labels.length > 1 ? (
        <LineChart title={title} series={series} labels={labels} mode={mode} height={height} markers={markers} />
      ) : (
        <p className="text-[14px] text-[var(--muted)]">La courbe apparaîtra à la deuxième mesure. Choisissez une période plus longue si vous avez déjà plusieurs mesures.</p>
      )}
      <div className="mt-3 border-t border-[var(--hair)] pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold">Repères {all.length ? <span className="rp-num font-normal text-[var(--muted)]">({all.length})</span> : null}</p>
          <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" aria-expanded={open} aria-controls={`${uid}-f`} onClick={() => setOpen((o) => !o)}>
            {open ? 'Fermer' : '+ Ajouter un repère'}
          </button>
        </div>
        {all.length ? (
          <ul className="mt-1 flex flex-col gap-1 text-[13px]">
            {all.slice(-6).map((n) => (
              <li key={n.id} className="flex flex-wrap gap-x-2">
                <span className="rp-num text-[var(--muted)]">{new Date(`${n.date.slice(0, 10)}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                <span>{n.label}</span>
                <span className="text-[12px] text-[var(--muted)]">{KIND_LABEL[n.kind]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[13px] text-[var(--muted)]">Les tâches faites s’affichent ici. Ajoutez vos propres repères : article paru, nouvelle page, campagne d’avis.</p>
        )}
        {open && (
          <form id={`${uid}-f`} onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-[var(--muted)]">
              Date
              <input type="date" className="rp-input w-[160px]" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[12px] text-[var(--muted)]">
              Ce qui s’est passé
              <input className="rp-input" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} placeholder="Article paru dans la presse locale" required />
            </label>
            <button type="submit" className="rp-btn rp-btn-primary" disabled={state.kind === 'busy'}>
              Ajouter le repère
            </button>
          </form>
        )}
        <p role="status" className="mt-2 text-[13px]">
          {state.kind === 'ok' && <span className="text-[var(--success-ink)]">Repère ajouté.</span>}
          {state.kind === 'local' && <span className="text-[var(--warning-ink)]">Repère ajouté sur cet appareil seulement (compte de démonstration).</span>}
          {state.kind === 'err' && <span className="text-[var(--danger-ink)]">{state.msg}</span>}
        </p>
      </div>
    </div>
  );
}
