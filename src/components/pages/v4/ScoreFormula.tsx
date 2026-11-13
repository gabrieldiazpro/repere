/**
 * La formule du score de visibilité en une barre : chaque composante prend sa part (poids publiés sur /methode),
 * les segments se remplissent tour à tour et les pourcentages comptent. Composant serveur (+ Counter).
 */
import type { CSSProperties } from "react";
import { Counter } from "@/components/motion/Counter";
import s from "./v4.module.css";

const SHADES = ["var(--color-primary-deep)", "var(--color-primary)", "#6A64D8", "#A5A1EC"];

export function ScoreFormula({ weights }: { weights: { k: string; name: string; w: number }[] }) {
  return (
    <figure data-reveal="" className={s.formula} aria-label="Composition du score sur 100">
      <figcaption className={s.formulaHead}>
        <span className={s.formulaTitle}>Le score sur 100, composante par composante</span>
        <code className={s.formulaCode}>100 × ({weights.map((w, i) => `${i ? " + " : ""}0,${String(w.w).padStart(2, "0")} × ${w.k}`).join("")})</code>
      </figcaption>
      <div className={s.formulaBar} aria-hidden="true">
        {weights.map((w, i) => (
          <span
            key={w.k}
            className={`${s.formulaSeg} ${s.grow}`}
            style={{ flexGrow: w.w, background: SHADES[i % SHADES.length], ["--d" as string]: `${150 + i * 220}ms` } as CSSProperties}
          >
            {w.k}
          </span>
        ))}
      </div>
      <ul className={s.formulaLegend}>
        {weights.map((w, i) => (
          <li key={w.k}>
            <span className={s.formulaSwatch} style={{ background: SHADES[i % SHADES.length] }} aria-hidden="true" />
            <span className={s.formulaPct}>
              <Counter value={w.w} suffix={"\u00a0%"} />
            </span>
            <span className={s.formulaName}>
              <b>{w.k}</b> {w.name}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export default ScoreFormula;
