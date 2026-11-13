'use client';
// Annonces de la coquille (événement « rp:toast ») : région aria-live polie, disparaissent seules après 6 s (9 s avec lien ou bouton).
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '../icons';
import type { ToastDetail } from './client';

type T = ToastDetail & { id: number };

export function Toaster() {
  const [list, setList] = useState<T[]>([]);
  useEffect(() => {
    let n = 0;
    const on = (e: Event) => {
      const d = (e as CustomEvent<ToastDetail>).detail;
      if (!d?.text) return;
      const id = ++n;
      setList((l) => [...l.slice(-2), { ...d, id }]);
      setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), d.href || d.action ? 9000 : 6000);
    };
    window.addEventListener('rp:toast', on);
    return () => window.removeEventListener('rp:toast', on);
  }, []);
  return (
    <div className="rp-toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`rp-toast ${t.tone === 'error' ? 'rp-toast-error' : t.tone === 'success' ? 'rp-toast-success' : ''}`}>
          {t.tone === 'success' ? (
            // Coche qui se dessine (tracé : joue aussi en mouvement réduit)
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path className="v4-check-mark" d="m8 12.5 2.8 2.8L16.2 9.6" />
            </svg>
          ) : (
            <Icon name={t.tone === 'error' ? 'alert' : 'info'} size={18} />
          )}
          <p className="min-w-0 flex-1 text-[14px]">
            {t.text}
            {t.href && (
              <>
                {' '}
                <Link href={t.href} className="font-semibold underline underline-offset-2">
                  {t.linkLabel ?? 'Voir'}
                </Link>
              </>
            )}
          </p>
          {t.action && (
            <button
              type="button"
              className="rp-toast-act"
              onClick={() => {
                t.action?.onClick();
                setList((l) => l.filter((x) => x.id !== t.id));
              }}
            >
              {t.action.label}
            </button>
          )}
          <button type="button" className="rp-toast-x" aria-label="Fermer l’annonce" onClick={() => setList((l) => l.filter((x) => x.id !== t.id))}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
