"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Counter } from "../Counter";
import { GhostCursor } from "../GhostCursor";
import { SceneFrame, Tick, reach, i } from "./ui";

/** Données de la scène : sources du compte démo Paysia, calculées côté serveur (src/components/site/demo-figures.ts). */
export type UnderstandSceneData = {
  account: string;
  engines: string;
  rows: { d: string; t: string; n: number; here: boolean }[];
  firstHint: string;
  ahead: string;
  compare: { k: string; them: number | string; you: number | string; of?: number }[];
};
/** Scène 2 — Comprendre (9,0 s), docs/v3/07 §5.3. */
export const UNDERSTAND_CUES = [50, 1200, 2400, 3400, 4200, 6000, 7000] as const;
export const UNDERSTAND_TOTAL = 9000;

function Val({ v, play, of }: { v: number | string; play: boolean; of?: number }) {
  if (typeof v === "string") return <>{v}</>;
  return (
    <>
      <Counter value={v} play={play} duration={800} />
      {of ? ` / ${of}` : ""}
    </>
  );
}

function Scene({ d, phase, playing }: { d: UnderstandSceneData; phase: number; playing: boolean }) {
  const hover = phase >= 3 && phase < 5 && playing;
  return (
    <SceneFrame account={d.account} path="Sources">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-semibold">Les pages que lisent les IA</p>
        <p className="text-[0.78rem] text-muted">{d.engines}</p>
      </div>
      <ul className="relative mt-3 divide-y divide-line/70 text-[0.85rem]">
        {d.rows.map((s, k) => (
          <li
            key={s.d}
            data-ghost={k === 0 ? "row" : undefined}
            style={i(k)}
            className={`grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md px-1 py-2 sm:grid-cols-[1fr_6rem_3rem_auto] ${
              k === 0 && hover ? "scene-highlight" : ""
            } ${reach(phase, 1)}`}
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{s.d}</span>
              <span className="text-[0.75rem] text-muted sm:hidden">{s.t}, citée {s.n} fois</span>
            </span>
            <span className="hidden text-muted sm:block">{s.t}</span>
            <span className="hidden text-right text-muted sm:block">
              <Counter value={s.n} play={phase >= 1} duration={600} suffix="×" />
            </span>
            <span style={{ ["--i" as string]: k * 1.7 }} className={reach(phase, 2, "sc-pop")}>
              <Tick ok={s.here} label={s.here ? "Présent" : "Absent"} />
            </span>
          </li>
        ))}
        {hover ? (
          <li className="sc-drop absolute left-6 top-10 z-10 rounded-lg bg-ink px-2.5 py-1.5 text-[0.75rem] font-semibold text-white shadow-lg">
            {d.firstHint}
          </li>
        ) : null}
      </ul>
      <div className={`mt-4 rounded-xl bg-canvas p-3.5 ${reach(phase, 4, "sc-fold")}`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[0.85rem] font-semibold">Pourquoi {d.ahead} passe devant</p>
          <span
            data-ghost="task"
            className={`inline-flex min-h-8 items-center rounded-lg bg-primary px-2.5 text-[0.78rem] font-semibold text-white ${reach(phase, 6, "sc-pop")}`}
          >
            Créer la tâche
          </span>
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[0.8rem]">
          {d.compare.map((c, k) => (
            <div key={c.k} style={i(k)} className={reach(phase, 5)}>
              <dt className="text-muted">{c.k}</dt>
              <dd className="mt-0.5">
                <span className="tabular font-semibold">
                  <Val v={c.them} of={c.of} play={phase >= 5} />
                </span>
                <span className="text-muted"> contre </span>
                <span className="tabular font-semibold text-primary underline decoration-accent decoration-2 underline-offset-4">
                  <Val v={c.you} of={c.of} play={phase >= 5} />
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      {playing && phase >= 7 ? (
        <p className="sc-toast absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-xl bg-ink px-3 py-2 text-[0.8rem] font-semibold text-white shadow-xl">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2.5 6.3l2.2 2.2L9.5 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Tâche ajoutée à la semaine
        </p>
      ) : null}
      <GhostCursor target={phase >= 6 ? "task" : phase >= 3 ? "row" : null} click={phase >= 7 ? "task" : phase >= 4 ? "row" : null} />
    </SceneFrame>
  );
}

export function UnderstandScene({ data: d }: { data: UnderstandSceneData }) {
  return (
    <ScenePlayer
      cues={UNDERSTAND_CUES}
      total={UNDERSTAND_TOTAL}
      label="la démonstration Comprendre"
      render={(phase, playing) => <Scene d={d} phase={phase} playing={playing} />}
      transcript={
        <>
          <p>Démonstration sur le compte démo {d.account} (entreprise fictive) : les pages que lisent les IA.</p>
          <p>{d.rows.map((r) => `${r.d}, ${r.t.toLowerCase()}, cité ${r.n} fois : ${r.here ? "présent" : "absent"}`).join(". ")}.</p>
          <p>
            Pourquoi {d.ahead} passe devant : {d.compare.map((c) => `${c.k.toLowerCase()}, ${c.them}${c.of ? ` sur ${c.of}` : ""} contre ${c.you}`).join(" ; ")}. Une tâche est créée.
          </p>
        </>
      }
    />
  );
}

export default UnderstandScene;
