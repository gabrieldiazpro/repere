'use client';

// État d'erreur des écrans Mesure : dit ce qui s'est passé et propose de réessayer (jamais d'erreur brute).
import { useEffect } from 'react';

export function MesureError({ title, error, reset }: { title: string; error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(`[app/${title}]`, error.digest ?? error.message);
  }, [title, error]);
  return (
    <div className="rp-page">
      <div className="rp-panel mt-6 p-6 text-center">
        <p className="rp-display text-[20px]">{title} : affichage impossible pour l’instant</p>
        <p className="mx-auto mt-2 max-w-md text-[14px] text-[var(--muted)]">Vos données n’ont pas pu être lues. Rien n’est perdu : réessayez, ou revenez dans quelques minutes.</p>
        <button type="button" onClick={reset} className="rp-btn rp-btn-primary mt-4">
          Réessayer
        </button>
      </div>
    </div>
  );
}
