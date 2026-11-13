"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Typewriter } from "../Typewriter";
import { Counter } from "../Counter";
import { GhostCursor } from "../GhostCursor";
import { SceneFrame, Tick, reach, i } from "./ui";

/** Données de la scène : compte démo Paysia, calculées côté serveur (src/components/site/demo-figures.ts). */
export type MeasureSceneData = {
  account: string;
  question: string;
  /** nombre de réponses analysées pour cette question à la dernière mesure */
  asked: number;
  answers: { ia: string; names: string[]; you: number }[];
  sov: { name: string; v: number; you?: boolean }[];
  questions: number;
  analysed: number;
};
/** Scène 1 — Mesurer (8,0 s), docs/v3/07 §5.3. */
export const MEASURE_CUES = [100, 1600, 2000, 3000, 3800, 4400, 5600, 6400] as const;
export const MEASURE_TOTAL = 8000;
const QUESTION = "« Meilleur logiciel de paie pour PME ? »";

function Scene({ d, phase, playing }: { d: MeasureSceneData; phase: number; playing: boolean }) {
  const max = Math.max(1, ...d.sov.map((s) => s.v));
  return (
    <SceneFrame account={d.account} path="Ce que disent les IA">
      <p className="text-[0.8rem] text-muted">Question suivie : {d.asked} réponses à la dernière mesure</p>
      <p className="mt-1 min-h-[1.75rem] font-display text-lg font-semibold leading-snug">
        <Typewriter text={`«\u00a0${d.question.replace(/\s*\?$/, "\u00a0?")}\u00a0»`} play={playing && phase >= 1} />
      </p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {d.answers.map((a, k) => (
          <div key={a.ia} style={i(k)} className={`rounded-xl border border-line/80 p-3 ${reach(phase, 2)}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.85rem] font-semibold">{a.ia}</span>
              <span style={i(k)} className={reach(phase, 4, "sc-pop")}>
                <Tick ok={a.you > 0} label={a.you > 0 ? <>Cité, {a.you}<sup>e</sup></> : "Absent"} />
              </span>
            </div>
            <ol className="mt-2 space-y-1 text-[0.85rem]">
              {a.names.map((n, r) => (
                <li
                  key={n}
                  style={i(k + r)}
                  className={`flex gap-2 rounded-md px-1.5 py-0.5 ${n === d.account && phase >= 4 ? "bg-accent-soft font-semibold" : "text-ink/80"} ${reach(phase, 3)}`}
                >
                  <span className="tabular w-3 text-muted">{r + 1}</span>
                  {n}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p data-ghost="sov" className={`rounded px-1 -mx-1 text-[0.85rem] font-semibold ${phase === 5 && playing ? "scene-highlight" : ""}`}>
            Part de voix, {d.questions} questions
          </p>
          <p className={`text-[0.78rem] text-muted ${reach(phase, 8)}`}>{d.analysed} réponses analysées</p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {d.sov.map((s, k) => (
            <li
              key={s.name}
              className={`grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 rounded-md text-[0.8rem] ${s.you && phase >= 7 ? "outline outline-2 outline-offset-2 outline-primary/60" : ""}`}
            >
              <span className={`truncate ${s.you ? "font-semibold" : "text-ink/80"}`}>{s.you ? `${s.name} (vous)` : s.name}</span>
              <span className="h-2 rounded-full bg-canvas">
                <span
                  style={{ ...i(k), width: `${(s.v / max) * 100}%` }}
                  className={`block h-2 rounded-full transition-colors duration-[var(--dur-slow)] ${s.you && phase >= 7 ? "bg-primary" : s.you ? "bg-primary/40" : "bg-line"} ${reach(phase, 6, "sc-bar")}`}
                />
              </span>
              <span className={`text-right text-muted ${reach(phase, 6, "")}`}>
                <Counter value={s.v} play={phase >= 6} duration={700} suffix={" %"} />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <GhostCursor target={phase >= 5 && phase < 8 ? "sov" : null} click={phase >= 6 ? 1 : null} />
    </SceneFrame>
  );
}

export function MeasureScene({ data: d }: { data: MeasureSceneData }) {
  const cited = d.answers.filter((a) => a.you > 0).map((a) => `${a.ia} le cite en ${a.you}e position`);
  const absent = d.answers.filter((a) => a.you === 0).map((a) => a.ia);
  return (
    <ScenePlayer
      cues={MEASURE_CUES}
      total={MEASURE_TOTAL}
      label="la démonstration Mesurer"
      render={(phase, playing) => <Scene d={d} phase={phase} playing={playing} />}
      transcript={
        <>
          <p>
            Démonstration sur le compte démo {d.account} (entreprise fictive). Question suivie : {d.question} ({d.asked} réponses à la dernière mesure).
          </p>
          <p>
            {cited.join(", ")}
            {absent.length ? `, ${absent.join(" et ")} ne le cite pas` : ""}.
          </p>
          <p>
            Part de voix sur {d.questions} questions : {d.sov.map((s) => `${s.name} ${s.v} %`).join(", ")}. {d.analysed} réponses analysées.
          </p>
        </>
      }
    />
  );
}

export default MeasureScene;
