/**
 * Renvois nommés `[@clé]` → `[n]` dans l'ordre d'apparition, sur les sources de ce dossier (GEO_SRC) et du
 * comparatif (SRC de src/lib/seo/competitors.ts). Une clé inconnue lève une erreur (testé).
 */
import type { Source } from '@/lib/seo/editorial';
import { SRC } from '@/lib/seo/competitors';
import { GEO_SRC } from './sources';

const ALL: Record<string, Source> = { ...SRC, ...GEO_SRC };

export const hasSource = (key: string) => key in ALL;

export function refResolver() {
  const order: string[] = [];
  const t = (s: string): string =>
    s.replace(/\[@(\w+)\]/g, (_m, key: string) => {
      if (!(key in ALL)) throw new Error(`Source inconnue : ${key}`);
      let i = order.indexOf(key);
      if (i < 0) {
        order.push(key);
        i = order.length - 1;
      }
      return `[${i + 1}]`;
    });
  return { t, sources: (): Source[] => order.map((k) => ALL[k]) };
}

/** Clés `[@clé]` présentes dans un texte. */
export const refKeys = (s: string): string[] => [...s.matchAll(/\[@(\w+)\]/g)].map((m) => m[1]);
