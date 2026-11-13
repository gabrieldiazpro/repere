'use client';
// Bascule de thème (système / clair / sombre), mémorisée dans le cookie rp_theme (lu par le serveur).
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../icons';
import { setTheme, THEMES, type Theme } from './client';

const ICON: Record<Theme, IconName> = { system: 'monitor', light: 'sun', dark: 'moon' };

export function ThemeToggle({ initial, variant = 'deep' }: { initial: Theme; variant?: 'deep' | 'plain' }) {
  const [t, setT] = useState<Theme>(initial);
  useEffect(() => {
    const on = (e: Event) => setT((e as CustomEvent<Theme>).detail);
    window.addEventListener('rp:theme', on);
    return () => window.removeEventListener('rp:theme', on);
  }, []);
  const pick = (v: Theme) => {
    setT(v);
    setTheme(v);
  };
  return (
    <div role="radiogroup" aria-label="Thème d’affichage" className={variant === 'deep' ? 'rp-theme rp-theme-deep' : 'rp-theme'}>
      {THEMES.map((o, i) => (
        <button
          key={o.v}
          type="button"
          role="radio"
          aria-checked={t === o.v}
          tabIndex={t === o.v ? 0 : -1}
          title={o.label}
          className="rp-theme-btn"
          onClick={() => pick(o.v)}
          onKeyDown={(e) => {
            const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const n = (i + d + THEMES.length) % THEMES.length;
            e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[n]?.focus();
            pick(THEMES[n].v);
          }}
        >
          <Icon name={ICON[o.v]} size={15} />
          <span className={variant === 'deep' ? 'sr-only' : ''}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
