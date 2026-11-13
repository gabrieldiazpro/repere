'use client';
// Petits utilitaires navigateur de la coquille : thème, annonces (toasts), mesure et suivi de tâche de fond.

export type Theme = 'system' | 'light' | 'dark';
export const THEMES: { v: Theme; label: string }[] = [
  { v: 'system', label: 'Système' },
  { v: 'light', label: 'Clair' },
  { v: 'dark', label: 'Sombre' },
];
export const THEME_COOKIE = 'rp_theme';

export function isTheme(v: unknown): v is Theme {
  return v === 'system' || v === 'light' || v === 'dark';
}

/** Applique et mémorise le thème (cookie lu par le serveur : pas de flash au chargement). */
export function setTheme(t: Theme) {
  document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  document.querySelectorAll<HTMLElement>('.rp-app').forEach((el) => (el.dataset.theme = t));
  window.dispatchEvent(new CustomEvent('rp:theme', { detail: t }));
}

export function currentTheme(): Theme {
  const v = document.querySelector<HTMLElement>('.rp-app')?.dataset.theme;
  return isTheme(v) ? v : 'system';
}

export type ToastTone = 'info' | 'success' | 'error';
export interface ToastDetail {
  text: string;
  tone?: ToastTone;
  href?: string;
  linkLabel?: string;
  /** Bouton dans l'annonce (ex. « Annuler ») : l'annonce se ferme au clic. */
  action?: { label: string; onClick: () => void };
}

/** Annonce visible et lue par les lecteurs d'écran (rendue par <Toaster />). */
export function toast(d: ToastDetail) {
  window.dispatchEvent(new CustomEvent<ToastDetail>('rp:toast', { detail: d }));
}

export function openPalette(query = '') {
  window.dispatchEvent(new CustomEvent('rp:palette', { detail: query }));
}

export interface JobState {
  id: string;
  status: 'queued' | 'running' | 'done' | 'dead' | string;
  label?: string;
  result?: Record<string, unknown>;
}

/** Lance une mesure (POST /api/audit {businessId}) → identifiant de tâche, ou message d'erreur lisible. */
export async function startMeasure(businessId: string): Promise<{ jobId: string } | { error: string }> {
  try {
    const r = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId }),
    });
    const j = (await r.json().catch(() => ({}))) as { jobId?: string; error?: string };
    if (r.ok && j.jobId) return { jobId: j.jobId };
    if (r.status === 403) return { error: 'Compte démo : la mesure n’est pas relancée. Créez votre espace pour mesurer votre commerce.' };
    if (r.status === 402) return { error: j.error ?? 'Votre offre ne permet pas de nouvelle mesure pour le moment.' };
    if (r.status === 429) return { error: 'Une mesure a déjà été demandée aujourd’hui. Réessayez demain.' };
    return { error: j.error ?? 'La mesure n’a pas pu être lancée. Réessayez dans un instant.' };
  } catch {
    return { error: 'Pas de réseau : la mesure n’a pas pu être lancée.' };
  }
}

/** Suit une tâche de fond jusqu'à « done » ou « dead » (GET /api/jobs/[id]). Renvoie une fonction d'arrêt. */
export function pollJob(id: string, onUpdate: (s: JobState) => void, everyMs = 4000, maxMs = 15 * 60_000): () => void {
  let stopped = false;
  const t0 = Date.now();
  const tick = async () => {
    if (stopped) return;
    try {
      const r = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { cache: 'no-store' });
      if (r.ok) {
        const s = (await r.json()) as JobState;
        onUpdate(s);
        if (s.status === 'done' || s.status === 'dead') return;
      }
    } catch {
      /* réseau : on réessaie */
    }
    if (Date.now() - t0 < maxMs) setTimeout(tick, everyMs);
  };
  void tick();
  return () => {
    stopped = true;
  };
}
