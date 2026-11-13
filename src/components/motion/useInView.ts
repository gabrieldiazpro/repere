"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { observe } from "./lib";

/**
 * Vrai une fois l'élément entré à l'écran (seuil par défaut 0,3), puis reste vrai.
 * Rendu serveur et premier rendu : `false` → les composants doivent afficher l'ÉTAT FINAL tant que `ready` est faux
 * (renvoyé en second) pour que le HTML serveur soit complet. Joue aussi en mouvement réduit (règle V4).
 */
export function useInView<T extends Element>(threshold = 0.3): [RefObject<T | null>, boolean, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setReady(true);
    const off = observe(
      el,
      (e) => {
        if (e.isIntersecting) {
          setInView(true);
          off();
        }
      },
      { threshold },
    );
    return off;
  }, [threshold]);
  return [ref, inView, ready];
}

export default useInView;
