'use client';
// Recherche globale et palette de commandes : Cmd+K / Ctrl+K (ou bouton « Rechercher »), « g » puis une lettre
// pour aller à une page, « ? » pour l'aide. Modèle combobox + listbox (WAI-ARIA), focus piégé, Échap pour fermer.
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Segment } from '@/lib/engine/types-v2';
import { Icon, type IconName } from '../icons';
import { shortcutMap } from '../nav';
import { currentTheme, pollJob, setTheme, startMeasure, toast, THEMES } from './client';
import { buildItems, isTypingTarget, search, type PaletteItem, type PaletteKind, type SearchIndex } from './palette';

const KIND_ICON: Record<PaletteKind, IconName> = {
  action: 'bolt',
  page: 'compass',
  question: 'list',
  concurrent: 'podium',
  tache: 'check',
};

export function CommandPalette({
  businessId,
  segment,
  demo,
  canExport,
  index,
}: {
  businessId: string;
  segment: Segment;
  demo: boolean;
  canExport: boolean;
  index: SearchIndex;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const listId = useId();
  const items = useMemo(() => buildItems(segment, index, { demo }), [segment, index, demo]);
  const groups = useMemo(() => search(items, q), [items, q]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const keys = useMemo(() => shortcutMap(segment), [segment]);

  const show = useCallback((query = '') => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setQ(query);
    setActive(0);
    setHelp(false);
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    setHelp(false);
    setTimeout(() => returnFocus.current?.focus?.(), 0);
  }, []);

  // Raccourcis globaux
  useEffect(() => {
    let gAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (open) close();
        else show();
        return;
      }
      if (open || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '/') {
        e.preventDefault();
        show();
        return;
      }
      if (e.key === '?') {
        e.preventDefault();
        show();
        setHelp(true);
        return;
      }
      const now = Date.now();
      if (e.key === 'g') {
        gAt = now;
        return;
      }
      if (gAt && now - gAt < 1200) {
        gAt = 0;
        const href = keys[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
      }
    };
    const onOpen = (e: Event) => show(typeof (e as CustomEvent).detail === 'string' ? (e as CustomEvent<string>).detail : '');
    window.addEventListener('keydown', onKey);
    window.addEventListener('rp:palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('rp:palette', onOpen);
    };
  }, [open, show, close, keys, router]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => setActive(0), [q]);

  const run = useCallback(
    async (it: PaletteItem) => {
      close();
      if (it.href) {
        router.push(it.href);
        return;
      }
      switch (it.command) {
        case 'theme': {
          const order = THEMES.map((t) => t.v);
          const next = order[(order.indexOf(currentTheme()) + 1) % order.length];
          setTheme(next);
          toast({ text: `Thème : ${THEMES.find((t) => t.v === next)?.label.toLowerCase()}.` });
          return;
        }
        case 'visite':
          router.push(`/app?visite=1&segment=${segment}`);
          return;
        case 'export':
          if (!canExport) {
            toast({ text: 'Les exports CSV sont disponibles avec l’offre Essentiel.', href: '/tarifs?depuis=app&fonction=exports', linkLabel: 'Voir les offres' });
            return;
          }
          window.location.href = `/api/export?businessId=${encodeURIComponent(businessId)}&kind=scores`;
          toast({ text: 'Export des scores lancé. Les autres exports sont dans Rapports.', href: '/app/rapports', linkLabel: 'Rapports' });
          return;
        case 'measure': {
          if (demo) {
            toast({ text: 'Compte démo : la mesure n’est pas relancée. Créez votre espace pour mesurer votre commerce.', href: '/inscription', linkLabel: 'Créer mon espace' });
            return;
          }
          const r = await startMeasure(businessId);
          if ('error' in r) {
            toast({ text: r.error, tone: 'error' });
            return;
          }
          toast({ text: 'Mesure lancée. Les IA répondent en quelques minutes ; vous serez prévenu ici.' });
          pollJob(r.jobId, (s) => {
            if (s.status === 'done') {
              toast({ text: 'Mesure terminée : vos chiffres sont à jour.', tone: 'success' });
              router.refresh();
            } else if (s.status === 'dead') toast({ text: 'La mesure a échoué. Notre équipe est prévenue.', tone: 'error' });
          });
          return;
        }
        default:
      }
    },
    [businessId, canExport, close, demo, router, segment],
  );

  if (!open) return null;
  const activeItem = flat[active];
  const optId = (i: number) => `${listId}-o${i}`;

  return (
    <div className="rp-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Recherche et commandes"
        className="rp-palette"
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            close();
          } else if (e.key === 'Tab') {
            // Focus piégé : un seul élément focalisable (le champ).
            e.preventDefault();
            inputRef.current?.focus();
          }
        }}
      >
        <div className="rp-palette-search">
          <Icon name="search" size={18} />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={activeItem ? optId(active) : undefined}
            aria-autocomplete="list"
            placeholder="Rechercher une page, une question, un concurrent…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(flat.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter' && activeItem) {
                e.preventDefault();
                void run(activeItem);
              }
            }}
            className="rp-palette-input"
          />
          <kbd className="rp-kbd">Échap</kbd>
        </div>
        {help ? (
          <ShortcutHelp keys={keys} />
        ) : (
          <div id={listId} role="listbox" aria-label="Résultats" className="rp-palette-list">
            {flat.length === 0 && (
              <p className="px-4 py-6 text-center text-[14px] text-[var(--muted)]">
                Aucun résultat pour « {q} ». Essayez un autre mot, ou{' '}
                <button type="button" className="rp-link" onClick={() => void run({ id: 'x', kind: 'action', label: '', href: `/app/copilote?context=${encodeURIComponent(q)}` })}>
                  posez la question au copilote
                </button>
                .
              </p>
            )}
            {(() => {
              let i = -1;
              return groups.map((g) => (
                <div key={g.kind} role="group" aria-label={g.label}>
                  <p className="rp-palette-group" aria-hidden="true">
                    {g.label}
                  </p>
                  {g.items.map((it) => {
                    i++;
                    const idx = i;
                    return (
                      <div
                        key={it.id}
                        id={optId(idx)}
                        role="option"
                        aria-selected={idx === active}
                        className="rp-palette-opt"
                        onMouseMove={() => setActive(idx)}
                        onClick={() => void run(it)}
                      >
                        <Icon name={KIND_ICON[it.kind]} size={16} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{it.label}</span>
                          {it.hint && <span className="block truncate text-[12px] text-[var(--muted)]">{it.hint}</span>}
                        </span>
                        {it.shortcut && <kbd className="rp-kbd hidden sm:inline-flex">{it.shortcut}</kbd>}
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>
        )}
        <div className="rp-palette-foot">
          <span>
            <kbd className="rp-kbd">↑</kbd> <kbd className="rp-kbd">↓</kbd> choisir · <kbd className="rp-kbd">Entrée</kbd> ouvrir
          </span>
          <button type="button" className="rp-link text-[12px]" onClick={() => setHelp((h) => !h)}>
            {help ? 'Retour aux résultats' : 'Raccourcis clavier'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShortcutHelp({ keys }: { keys: Record<string, string> }) {
  const rows: [string, string][] = [
    ['Ctrl K ou ⌘ K', 'Ouvrir ou fermer la recherche'],
    ['/', 'Ouvrir la recherche'],
    ['?', 'Afficher ces raccourcis'],
    ...Object.entries(keys).map(([k, href]): [string, string] => [`g puis ${k}`, `Aller à ${href.replace('/app', '') || 'Lundi'}`]),
  ];
  return (
    <div className="rp-palette-list px-4 py-3">
      <h2 className="rp-h2 mb-2">Raccourcis clavier</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt>
              <kbd className="rp-kbd">{k}</kbd>
            </dt>
            <dd className="text-[var(--muted)]">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Bouton qui ouvre la palette (barre latérale, page Plus). */
export function SearchButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  if (compact)
    return (
      <button
        type="button"
        className={className}
        aria-label="Rechercher"
        title="Rechercher"
        onClick={() => window.dispatchEvent(new CustomEvent('rp:palette', { detail: '' }))}
      >
        <Icon name="search" size={20} />
      </button>
    );
  return (
    <button
      type="button"
      data-visite="recherche"
      className={className}
      onClick={() => window.dispatchEvent(new CustomEvent('rp:palette', { detail: '' }))}
      aria-keyshortcuts="Control+K Meta+K"
    >
      <Icon name="search" size={16} />
      <span className="flex-1 text-left">Rechercher</span>
      <kbd className="rp-kbd rp-kbd-deep hidden lg:inline-flex" aria-hidden="true">
        Ctrl K
      </kbd>
    </button>
  );
}
