"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Counter } from "../Counter";
import { ChartDraw } from "../ChartDraw";
import { GhostCursor } from "../GhostCursor";
import { SceneFrame, reach, i } from "./ui";

/**
 * Données de la scène : trafic du compte démo Maison Sora, calculé côté serveur comme l'écran « Trafic et ventes »
 * du compte (src/components/site/demo-figures.ts). Plus aucun chiffre écrit à la main ici.
 */
export type ProveSceneData = {
  account: string;
  /** visites venues des IA par semaine, 12 semaines */
  weekly: number[];
  visits30: number;
  growth30: number | null;
  orders30: number | null;
  /** « 675,90 € » */
  revenue30: string | null;
  engines: { n: string; v: number }[];
  /** « novembre » */
  month: string;
  score: number;
  scoreDelta: number | null;
};
/** Scène 4 — Prouver (9,0 s), docs/v3/07 §5.3. */
export const PROVE_CUES = [50, 400, 1400, 2200, 3400, 4600, 5200] as const;
export const PROVE_TOTAL = 9000;

function Scene({ d, phase, playing }: { d: ProveSceneData; phase: number; playing: boolean }) {
  const max = Math.max(10, Math.ceil((Math.max(...d.weekly) * 1.1) / 10) * 10);
  return (
    <SceneFrame account={d.account} path="Trafic IA">
      <div className={`flex flex-wrap items-end justify-between gap-3 ${reach(phase, 1)}`}>
        <div>
          <p className="text-[0.8rem] text-muted">Visites venues des IA, 30 jours</p>
          <p className="font-display text-3xl font-bold">
            <Counter value={d.visits30} play={phase >= 4} />{" "}
            {d.growth30 !== null ? (
              <span className={`text-base font-semibold ${d.growth30 >= 0 ? "text-success-ink" : "text-danger-ink"} ${reach(phase, 4, "sc-pop")}`}>
                {d.growth30 >= 0 ? "+" : "−"}
                {Math.abs(d.growth30)} % sur 30 j
              </span>
            ) : null}
          </p>
        </div>
        {d.orders30 !== null ? (
          <p className="text-[0.8rem] text-muted">
            Commandes attribuées, 30 jours : <Counter value={d.orders30} play={phase >= 4} className="font-semibold text-ink" />
            {d.revenue30 ? <span className="font-semibold text-ink"> ({d.revenue30})</span> : null}
          </p>
        ) : null}
      </div>
      <div className={`mt-3 ${reach(phase, 1, "sc-enter")}`}>
        <ChartDraw
          values={d.weekly}
          max={max}
          play={phase >= 2}
          label={`Visites hebdomadaires venues des IA, de ${d.weekly[0]} à ${d.weekly[d.weekly.length - 1]} en 12 semaines`}
        />
      </div>
      <p className={`mt-1 text-[0.75rem] text-muted ${reach(phase, 3, "sc-drop")}`}>Visites par semaine, 12 dernières semaines</p>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8rem] sm:grid-cols-4">
        {d.engines.map((e, k) => (
          <li key={e.n} style={i(k)} className={reach(phase, 5)}>
            <span className="block truncate text-muted">{e.n}</span>
            <span className="font-semibold">
              <Counter value={e.v} play={phase >= 5} duration={600} suffix={" %"} />
            </span>
            <span className="mt-1 block h-1 rounded-full bg-canvas">
              <span style={{ ...i(k), width: `${e.v}%` }} className={`block h-1 rounded-full bg-primary ${reach(phase, 5, "sc-bar")}`} />
            </span>
          </li>
        ))}
      </ul>
      <div className={`mt-4 flex items-center gap-3 rounded-xl border border-line/80 p-3 ${reach(phase, 6)}`}>
        <span aria-hidden="true" className="flex h-14 w-11 shrink-0 flex-col justify-end gap-0.5 rounded-md bg-canvas p-1.5 ring-1 ring-line">
          <span className="h-1 w-full rounded bg-line" />
          <span className="h-1 w-2/3 rounded bg-line" />
          <svg viewBox="0 0 30 12" className="mt-0.5 w-full">
            <path d="M0 11 L6 9 L12 10 L18 6 L24 5 L30 1" fill="none" stroke="#3730A3" strokeWidth="1.5" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p data-ghost="report" className="text-[0.85rem] font-semibold">
            Rapport de {d.month}
          </p>
          <p className={`text-[0.78rem] text-muted ${reach(phase, 7, "sc-fold")}`}>
            Score {d.score}/100{d.scoreDelta !== null ? ` (${d.scoreDelta >= 0 ? "+" : "−"}${Math.abs(d.scoreDelta)} depuis la mesure précédente)` : ""}, visites et ventes du mois.
          </p>
        </div>
        <span className={`inline-flex min-h-9 shrink-0 items-center rounded-lg bg-primary px-3 text-[0.8rem] font-semibold text-white ${reach(phase, 7, "sc-pop")}`}>
          Télécharger le PDF
        </span>
      </div>
      <GhostCursor target={phase >= 6 && playing ? "report" : null} click={phase >= 7 ? 1 : null} />
    </SceneFrame>
  );
}

export function ProveScene({ data: d }: { data: ProveSceneData }) {
  return (
    <ScenePlayer
      cues={PROVE_CUES}
      total={PROVE_TOTAL}
      label="la démonstration Prouver"
      render={(phase, playing) => <Scene d={d} phase={phase} playing={playing} />}
      transcript={
        <>
          <p>
            Démonstration sur le compte démo {d.account} (entreprise fictive) : {d.visits30} visites venues des IA sur 30 jours
            {d.growth30 !== null ? ` (${d.growth30 >= 0 ? "+" : "−"}${Math.abs(d.growth30)} % sur les 30 jours précédents)` : ""}
            {d.orders30 !== null ? `, ${d.orders30} commandes attribuées${d.revenue30 ? ` pour ${d.revenue30}` : ""}` : ""}. Par semaine, sur 12 semaines :{" "}
            {d.weekly.join(", ")}.
          </p>
          <p>Répartition : {d.engines.map((e) => `${e.n} ${e.v} %`).join(", ")}.</p>
          <p>Rapport de {d.month} : score {d.score} sur 100. Données de démonstration.</p>
        </>
      }
    />
  );
}

export default ProveScene;
