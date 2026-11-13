/**
 * Accès au fournisseur d'IA configuré (src/lib/engine/providers : extracteur JSON le moins cher disponible).
 * Sans clé : null → replis déterministes (mode démo étiqueté). Injectable pour les tests.
 */
import { getExtractor } from '@/lib/engine/providers';

export interface GeoLlm {
  model: string;
  /** Réponse texte (JSON attendu) ; peut lever. */
  completeJson(system: string, user: string): Promise<string>;
}

/** Fournisseur configuré, ou null (aucune clé, GEO_LLM=off). */
export function defaultGeoLlm(): GeoLlm | null {
  if ((process.env.GEO_LLM ?? '').toLowerCase() === 'off') return null;
  try {
    const x = getExtractor();
    return x ? { model: `${x.vendor}:${x.model}`, completeJson: (s, u) => x.completeJson(s, u) } : null;
  } catch {
    return null;
  }
}

/** Premier objet JSON d'une réponse (tolère ```json). */
export function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as T;
  } catch {
    return null;
  }
}

/** Délai maximal d'un appel (l'analyse publique tient en 60 s). */
export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([p, new Promise<T>((_, rej) => (t = setTimeout(() => rej(new Error('délai dépassé')), ms)))]);
  } finally {
    if (t) clearTimeout(t);
  }
}
