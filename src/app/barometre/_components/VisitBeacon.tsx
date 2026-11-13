'use client';
/**
 * Compte une visite d'une page de baromètre (POST /api/v5/roi/hit) : chemin, domaine d'origine, utm_source.
 * Sans cookie ni identifiant ; ne s'exécute pas avec « Ne pas me suivre » (Do Not Track). Une fois par affichage.
 */
import { useEffect } from 'react';

/** Navigation interne (sans rechargement) : document.referrer reste celui de l'arrivée, on ne le renvoie qu'une fois. */
let firstView = true;

export function VisitBeacon() {
  useEffect(() => {
    try {
      const n = navigator as Navigator & { msDoNotTrack?: string };
      if (n.doNotTrack === '1' || (window as { doNotTrack?: string }).doNotTrack === '1' || n.msDoNotTrack === '1') return;
      const body = JSON.stringify({
        p: window.location.pathname,
        r: firstView ? document.referrer || '' : window.location.origin,
        u: new URLSearchParams(window.location.search).get('utm_source') || '',
      });
      firstView = false;
      if (navigator.sendBeacon) navigator.sendBeacon('/api/v5/roi/hit', new Blob([body], { type: 'application/json' }));
      else void fetch('/api/v5/roi/hit', { method: 'POST', body, headers: { 'content-type': 'application/json' }, keepalive: true }).catch(() => undefined);
    } catch {
      /* mesure facultative */
    }
  }, []);
  return null;
}
