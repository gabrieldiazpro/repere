'use client';
// Aides côté navigateur des écrans métiers : appels API homogènes, mémoire locale de la démo, messages.
import { useCallback, useEffect, useState } from 'react';

export function ReloadButton() {
  return (
    <button type="button" className="rp-btn" onClick={() => window.location.reload()}>
      Réessayer
    </button>
  );
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  code?: string;
  status: number;
  demo?: boolean;
}

/**
 * Appel JSON vers nos routes. Gère les deux formes de réponse (`{ ok, data }` des routes /api/local et `{ ok, …champs }`
 * des routes /api/ecommerce) et traduit les erreurs réseau en message lisible.
 */
export async function api<T = Record<string, unknown>>(url: string, init?: { method?: string; body?: unknown }): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: init?.method ?? (init?.body ? 'POST' : 'GET'),
      headers: init?.body ? { 'content-type': 'application/json' } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      credentials: 'same-origin',
    });
    const j = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const ok = res.ok && j.ok !== false;
    return {
      ok,
      status: res.status,
      data: ('data' in j ? j.data : j) as T,
      error: ok ? undefined : typeof j.error === 'string' ? j.error : messageFor(res.status),
      code: typeof j.code === 'string' ? j.code : undefined,
      demo: j.demo === true,
    };
  } catch {
    return { ok: false, status: 0, error: 'Connexion impossible : vérifiez votre réseau puis réessayez.' };
  }
}

function messageFor(status: number): string {
  if (status === 401) return 'Votre session a expiré : reconnectez-vous.';
  if (status === 402) return 'Cette fonction n’est pas incluse dans votre offre.';
  if (status === 403) return 'Vous n’avez pas les droits pour cette action.';
  if (status === 429) return 'Trop de demandes : réessayez plus tard.';
  return 'Une erreur est survenue. Réessayez dans un instant.';
}

/** Mémoire locale (démo : les modifications restent sur l'appareil). Toujours protégée : le navigateur peut refuser. */
export function useLocalState<T>(key: string, initial: T): [T, (v: T) => void, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`rp-metiers:${key}`);
      if (raw) setValue(JSON.parse(raw) as T);
    } catch {
      /* stockage indisponible */
    }
    setLoaded(true);
  }, [key]);
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(`rp-metiers:${key}`, JSON.stringify(v));
      } catch {
        /* stockage indisponible : l'état reste en mémoire */
      }
    },
    [key],
  );
  return [value, set, loaded];
}

/** Message d'état annoncé aux lecteurs d'écran. */
export function Notice({ tone = 'info', children }: { tone?: 'info' | 'success' | 'error' | 'demo'; children: React.ReactNode }) {
  if (!children) return null;
  const cls =
    tone === 'error'
      ? 'bg-[var(--danger-bg)] text-[var(--danger-ink)]'
      : tone === 'success'
        ? 'bg-[var(--success-bg)] text-[var(--success-ink)]'
        : tone === 'demo'
          ? 'bg-[var(--warning-bg)] text-[var(--warning-ink)]'
          : 'bg-[var(--primary-bg)] text-[var(--primary)]';
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-[13px] ${cls}`}>
      {children}
    </p>
  );
}

export const DEMO_SAVED = 'Démo : modification gardée sur cet appareil seulement, rien n’est enregistré sur nos serveurs.';
