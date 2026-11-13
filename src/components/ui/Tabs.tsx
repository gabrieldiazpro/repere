'use client';

import Link from 'next/link';
import { useCallback, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

export type TabItem = { id: string; label: ReactNode; count?: number; href?: string };

const useIsoLayout = typeof window === 'undefined' ? () => {} : useLayoutEffect;

/**
 * Onglets avec indicateur qui glisse (transform, 400 ms ease-out ; immédiat en mouvement réduit via CSS).
 * Deux modes : boutons (`value` + `onChange`, rôle tablist, flèches clavier) ou liens (`href` sur chaque item, aria-current).
 * Sans JS : soulignement statique sur l'onglet actif. Variante « pill » pour un sélecteur compact.
 * <Tabs items={[{ id: 'all', label: 'Toutes', count: 12 }, { id: 'todo', label: 'À faire', count: 3 }]} value={v} onChange={setV} label="Filtrer" />
 * Contenu : <div role="tabpanel" id={`${idBase}-panel`} className="ui-tabpanel" key={v}>…</div> (la clé rejoue le fondu).
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
  variant = 'line',
  idBase = 'tabs',
  className = '',
}: {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  label: string;
  variant?: 'line' | 'pill';
  idBase?: string;
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const ink = useRef<HTMLSpanElement>(null);
  const links = items.some((i) => i.href);

  const place = useCallback(() => {
    const el = root.current;
    const on = el?.querySelector<HTMLElement>('[aria-selected="true"], [aria-current="page"]');
    if (!el || !on || !ink.current) return;
    ink.current.style.setProperty('--x', `${on.offsetLeft}px`);
    ink.current.style.setProperty('--w', `${on.offsetWidth}`);
    el.setAttribute('data-ready', '');
  }, []);

  useIsoLayout(() => {
    place();
  }, [value, items.length, place]);
  useIsoLayout(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);

  const onKey = (e: KeyboardEvent<HTMLElement>, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    const home = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : -1;
    if (!d && home < 0) return;
    e.preventDefault();
    const next = home >= 0 ? home : (i + d + items.length) % items.length;
    const btns = root.current?.querySelectorAll<HTMLElement>('.ui-tab');
    btns?.[next]?.focus();
    if (!links) onChange?.(items[next].id);
  };

  return (
    <div
      ref={root}
      className={`ui-tabs ${className}`}
      data-variant={variant === 'pill' ? 'pill' : undefined}
      role={links ? undefined : 'tablist'}
      aria-label={label}
    >
      <span ref={ink} className="ui-tabs-ink" aria-hidden="true" />
      {items.map((it, i) => {
        const on = it.id === value;
        const inner = (
          <>
            {it.label}
            {it.count !== undefined ? <span className="ui-tab-count">{it.count}</span> : null}
          </>
        );
        return it.href ? (
          <Link key={it.id} href={it.href} className="ui-tab" aria-current={on ? 'page' : undefined} onKeyDown={(e) => onKey(e, i)}>
            {inner}
          </Link>
        ) : (
          <button
            key={it.id}
            type="button"
            role="tab"
            id={`${idBase}-${it.id}`}
            aria-selected={on}
            aria-controls={`${idBase}-panel`}
            tabIndex={on ? 0 : -1}
            className="ui-tab"
            onClick={() => onChange?.(it.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
