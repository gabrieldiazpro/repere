"use client";

import { useEffect } from "react";
import { observe } from "./lib";

/**
 * Seul script nécessaire aux reveals : à placer une fois par page (n'affiche rien).
 * 1. marque tout de suite comme « entrés » les éléments [data-reveal] déjà à l'écran (pas de clignotement) ;
 * 2. pose html[data-motion] (les états initiaux CSS ne s'appliquent qu'à partir de là : sans JS, rien n'est masqué) ;
 * 3. observe les autres et pose data-in à leur entrée (seuil 0,15, une fois).
 */
export function MotionRoot() {
  useEffect(() => {
    const html = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-in])"));
    const vh = window.innerHeight;
    const offs: (() => void)[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.95 && r.bottom > 0) el.setAttribute("data-in", "");
    }
    html.setAttribute("data-motion", "");
    for (const el of els) {
      if (el.hasAttribute("data-in")) continue;
      const off = observe(
        el,
        (e) => {
          if (!e.isIntersecting) return;
          el.setAttribute("data-in", "");
          off();
        },
        { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
      );
      offs.push(off);
    }
    return () => offs.forEach((f) => f());
  }, []);
  return null;
}

export default MotionRoot;
