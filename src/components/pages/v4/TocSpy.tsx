"use client";

import { useEffect, useState } from "react";
import s from "./v4.module.css";

export type TocItem = { id: string; label: string };

/**
 * Sommaire cliquable qui suit la lecture : la section en cours passe en gras, un rail se remplit.
 * Rendu serveur : liste complète de liens (aucune section active). Le rail se remplit en transform (scaleY) :
 * pas de déplacement, donc joué aussi en mouvement réduit (règle V4).
 */
export function TocSpy({ items, label = "Sommaire", id }: { items: TocItem[]; label?: string; id: string }) {
  const [active, setActive] = useState<number>(-1);

  useEffect(() => {
    let raf = 0;
    const els = items.map((i) => document.getElementById(i.id));
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let k = -1;
      els.forEach((el, i) => {
        if (el && el.getBoundingClientRect().top <= line) k = i;
      });
      // En bas de page, la dernière section est la section lue.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) k = items.length - 1;
      setActive(k);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items]);

  const progress = items.length > 1 ? Math.max(0, active) / (items.length - 1) : 1;
  return (
    <nav aria-labelledby={id} className={s.toc}>
      <p id={id} className={s.tocTitle}>
        {label}
      </p>
      <div className={s.tocBody}>
        <span aria-hidden="true" className={s.tocRail}>
          <span className={s.tocFill} style={{ transform: `scaleY(${active < 0 ? 0 : progress})` }} />
        </span>
        <ol className={s.tocList}>
          {items.map((it, i) => (
            <li key={it.id}>
              <a href={`#${it.id}`} aria-current={i === active ? "location" : undefined} data-done={i < active ? "" : undefined}>
                {it.label}
              </a>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}

export default TocSpy;
