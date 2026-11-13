'use client';

import { useEffect, useState } from 'react';
import { flushQueue } from './actionQueue';

/** Enregistre le service worker, propose la mise à jour, rejoue la file d'actions hors ligne. */
export function SwRegister() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState === 'visible') void flushQueue();
    };
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    void flushQueue();

    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production' && !process.env.NEXT_PUBLIC_SW_DEV) {
      return () => {
        window.removeEventListener('online', onWake);
        document.removeEventListener('visibilitychange', onWake);
      };
    }

    let reloading = false;
    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onController);

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          sw?.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) setWaiting(sw);
          });
        });
        const check = () => document.visibilityState === 'visible' && reg.update().catch(() => {});
        document.addEventListener('visibilitychange', check);
      })
      .catch(() => {
        /* SW indisponible (navigation privée, etc.) : l'app fonctionne quand même */
      });

    return () => {
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
      navigator.serviceWorker.removeEventListener('controllerchange', onController);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-[var(--ink)] px-4 py-3 text-sm text-[var(--bg)] shadow-lg"
      style={{ bottom: 'calc(var(--tabbar-h) + env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      <span className="flex-1">Nouvelle version disponible.</span>
      <button
        type="button"
        className="rp-tap rounded-xl bg-[var(--bg)] px-3 font-semibold text-[var(--ink)]"
        onClick={() => waiting.postMessage('SKIP_WAITING')}
      >
        Mettre à jour
      </button>
    </div>
  );
}
