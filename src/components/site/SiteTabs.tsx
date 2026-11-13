"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type SiteTab = { id: string; label: string; hint?: string; panel: ReactNode };

/**
 * Onglets du site (V4) : indicateur qui glisse sous l'onglet actif, panneau qui entre en fondu. Tous les panneaux
 * sont rendus côté serveur (présents dans le HTML) ; seul l'actif est affiché. Clavier : flèches, Début, Fin.
 * `numbered` : uniquement quand les onglets sont une vraie suite (Mesurer → Prouver).
 */
export function SiteTabs({
  tabs,
  label,
  numbered = false,
  initial,
  className = "",
}: {
  tabs: SiteTab[];
  label: string;
  numbered?: boolean;
  initial?: string;
  className?: string;
}) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, tabs.findIndex((t) => t.id === active));

  function onKey(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % tabs.length;
    if (e.key === "ArrowLeft") n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") n = 0;
    if (e.key === "End") n = tabs.length - 1;
    if (n >= 0) {
      e.preventDefault();
      setActive(tabs[n].id);
      refs.current[n]?.focus();
    }
  }

  return (
    <div className={className}>
      <div className="-mx-4 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <div role="tablist" aria-label={label} className="relative flex min-w-max border-b border-line sm:min-w-0">
          {tabs.map((t, i) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                role="tab"
                type="button"
                id={`${base}-tab-${t.id}`}
                aria-selected={on}
                aria-controls={`${base}-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`relative min-h-12 flex-1 px-3 pb-3 pt-2 text-left transition-colors duration-[var(--dur-base)] sm:px-4 ${on ? "text-ink" : "text-ink/60 hover:text-ink"}`}
              >
                <span className="flex items-baseline gap-2 font-display text-[1.02rem] font-semibold sm:text-lg">
                  {numbered ? <span className={`tabular text-[0.85rem] ${on ? "text-primary" : "text-muted"}`}>{i + 1}</span> : null}
                  {t.label}
                </span>
                {t.hint ? <span className="mt-0.5 hidden text-[0.85rem] font-normal text-muted md:block">{t.hint}</span> : null}
              </button>
            );
          })}
          <span
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-[3px] rounded-full bg-primary transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ width: `${100 / tabs.length}%`, transform: `translateX(${idx * 100}%)` }}
          />
        </div>
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          id={`${base}-panel-${t.id}`}
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={t.id !== active}
          tabIndex={0}
          className="site-tab-in pt-8 focus-visible:outline-offset-8"
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}

export default SiteTabs;
