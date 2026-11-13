/**
 * Première page vue, gardée EN MÉMOIRE de l'onglet (aucun cookie, aucun stockage local, aucun identifiant) :
 * la navigation Next.js entre pages ne recharge pas le document, donc l'origine de l'arrivée sur le site reste
 * connue jusqu'au formulaire (audit, analyse, inscription). Un rechargement complet la perd : les liens des baromètres
 * portent aussi des UTM (src/lib/roi/core.ts `barometreUtm`), lus à l'arrivée sur la page du formulaire.
 * Respecte « Ne pas me suivre » (Do Not Track), comme le script de mesure du site.
 */
import { attributionFromLocation, type Attribution } from './core';

type G = { __repereLanding?: Attribution | null };

function dnt(): boolean {
  if (typeof navigator === 'undefined') return false;
  const n = navigator as Navigator & { msDoNotTrack?: string };
  const w = (typeof window !== 'undefined' ? window : {}) as { doNotTrack?: string };
  return n.doNotTrack === '1' || w.doNotTrack === '1' || n.msDoNotTrack === '1';
}

/** À appeler au premier rendu d'une page publique : mémorise l'origine de l'arrivée (une seule fois par document). */
export function captureLanding(): void {
  if (typeof window === 'undefined' || dnt()) return;
  const g = window as unknown as G;
  if (g.__repereLanding !== undefined) return;
  g.__repereLanding = attributionFromLocation({ href: window.location.href, referrer: document.referrer, selfHost: window.location.hostname });
}

/**
 * Origine à joindre à un formulaire : la première page vue si elle est connue ; sinon (ou si elle n'a pas d'UTM)
 * les UTM de la page courante. Null avec Do Not Track ou hors navigateur.
 */
export function currentAttribution(): Attribution | null {
  if (typeof window === 'undefined' || dnt()) return null;
  captureLanding();
  const first = (window as unknown as G).__repereLanding ?? null;
  const here = attributionFromLocation({ href: window.location.href, referrer: null, selfHost: window.location.hostname });
  if (!first) return here?.utmSource ? here : null;
  if (!first.utmSource && here?.utmSource) return { ...first, utmSource: here.utmSource, utmMedium: here.utmMedium, utmCampaign: here.utmCampaign };
  return first;
}
