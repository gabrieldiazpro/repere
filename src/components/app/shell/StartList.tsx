'use client';
// Liste « Bien démarrer » (Lundi) : persistante tant qu'elle n'est pas finie ou masquée. Les étapes faites sont
// déduites des données (serveur) ; « Je l'ai fait » et « Masquer » sont gardés sur l'appareil, par commerce.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import { DEMARRAGE_STORAGE, etapesDemarrage, parseDemarrage, progression, type DemarrageLocal, type EtapeId, type Signaux } from './demarrage';

export function StartList({ businessId, signaux, demo }: { businessId: string; signaux: Signaux; demo: boolean }) {
  const key = `${DEMARRAGE_STORAGE}:${businessId}`;
  const [local, setLocal] = useState<DemarrageLocal | null>(null);
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      /* rien */
    }
    setLocal(parseDemarrage(raw));
  }, [key]);
  const persist = (v: DemarrageLocal) => {
    setLocal(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* rien */
    }
  };
  const etapes = etapesDemarrage(signaux, new Set(local?.manual ?? []));
  const p = progression(etapes);
  if (!local || local.hidden || p.termine) return null;

  const markDone = (id: EtapeId) => persist({ ...local, manual: [...new Set([...local.manual, id])] });

  return (
    <section className="rp-panel" aria-labelledby="start-h">
      <div className="rp-panel-head">
        <h2 id="start-h" className="rp-h2">
          Bien démarrer
        </h2>
        <button type="button" className="rp-link text-[13px]" onClick={() => persist({ ...local, hidden: true })}>
          Masquer
        </button>
      </div>
      <div className="rp-panel-body">
        <div className="flex items-center gap-3">
          <div
            className="rp-progress flex-1"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={p.total}
            aria-valuenow={p.faites}
            aria-label={`Étapes faites : ${p.label}`}
          >
            <span style={{ width: `${(p.faites / p.total) * 100}%` }} />
          </div>
          <span className="rp-num text-[13px] font-semibold">{p.label}</span>
        </div>
        {p.minutesRestantes > 0 && <p className="mt-1 text-[12px] text-[var(--muted)]">Environ {p.minutesRestantes} min pour tout finir.</p>}
        {demo && <p className="mt-1 text-[12px] text-[var(--muted)]">Compte démo : vos coches restent sur cet appareil.</p>}
        <ol className="mt-3 flex flex-col gap-1">
          {etapes.map((e, i) => {
            const next = p.suivante?.id === e.id;
            return (
              <li key={e.id} className={`flex items-start gap-3 rounded-lg px-2 py-2 ${next ? 'bg-[var(--primary-bg)]' : ''}`}>
                <span className={`rp-step-dot mt-0.5 ${e.done ? 'is-done' : next ? 'is-next' : ''}`} aria-hidden="true">
                  {e.done ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[14px] font-semibold leading-snug ${e.done ? 'text-[var(--muted)] line-through decoration-[var(--line-strong)]' : ''}`}>
                    {e.titre}
                    <span className="sr-only">{e.done ? ' : fait' : ' : à faire'}</span>
                  </p>
                  {!e.done && <p className="text-[13px] text-[var(--muted)]">{e.detail}</p>}
                  {!e.done && next && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={e.href} className="rp-btn rp-btn-primary rp-btn-sm">
                        {e.id === 'action' ? 'Voir l’action' : 'Commencer'} · {e.minutes} min
                      </Link>
                      <button type="button" className="rp-btn rp-btn-ghost rp-btn-sm" onClick={() => markDone(e.id)}>
                        Je l’ai déjà fait
                      </button>
                    </div>
                  )}
                </div>
                {!e.done && !next && (
                  <Link href={e.href} className="rp-link mt-0.5 text-[13px]" aria-label={`${e.titre} : y aller`}>
                    Y aller
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
