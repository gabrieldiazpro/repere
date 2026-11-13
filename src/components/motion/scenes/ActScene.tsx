"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Typewriter } from "../Typewriter";
import { GhostCursor } from "../GhostCursor";
import { SceneFrame, reach } from "./ui";

/** Scène 3 — Agir (9,5 s), docs/v3/07 §5.3. */
export const ACT_CUES = [50, 800, 1600, 3000, 4000, 5400, 6000, 7000, 8000] as const;
export const ACT_TOTAL = 9500;
const EXTRACT =
  "Paysia s'adresse aux PME de 10 à 250 salariés qui gèrent la paie en interne. Le support répond en français, depuis Lyon, du lundi au vendredi…";

function Ring({ done, total, play }: { done: number; total: number; play: boolean }) {
  const p = done / total;
  return (
    <svg viewBox="0 0 36 36" width="30" height="30" aria-hidden="true" className="-rotate-90">
      <circle cx="18" cy="18" r="15" fill="none" stroke="#D5D9E4" strokeWidth="4" />
      <circle
        cx="18"
        cy="18"
        r="15"
        fill="none"
        stroke="#15803D"
        strokeWidth="4"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={`${p} 1`}
        className={play ? "sc-check" : ""}
        style={{ transition: "stroke-dasharray 400ms var(--ease-out)" }}
      />
    </svg>
  );
}

function Scene({ phase, playing }: { phase: number; playing: boolean }) {
  const copied = playing && phase === 5;
  const publishing = playing && phase === 6;
  const published = phase >= 7;
  const done = phase >= 8 ? 1 : 0;
  return (
    <SceneFrame account="Paysia" path="Tâches de la semaine">
      <div className={`flex flex-wrap items-center gap-2 text-[0.75rem] ${reach(phase, 1)}`}>
        <span className="rounded-full bg-primary-bg px-2 py-0.5 font-semibold text-primary">Page citable</span>
        <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold text-muted ring-1 ring-inset ring-line">15 min de relecture</span>
        <span className="ml-auto inline-flex items-center gap-1.5 font-semibold text-ink/80">
          <Ring done={done} total={3} play={playing && phase >= 8} />
          <span className="tabular">{done}/3 faites</span>
        </span>
      </div>
      <p className={`mt-2.5 font-display text-lg font-semibold leading-snug ${reach(phase, 1)}`}>
        Publier la page « Paysia ou Paylo : lequel choisir ? »
      </p>
      <p className={`mt-1 text-[0.85rem] text-muted ${reach(phase, 2)}`}>
        Pourquoi : 3 IA citent un comparatif pour cette question, et vous n&apos;en avez aucun.
      </p>
      <div className={`mt-3 rounded-xl border border-line/80 bg-canvas/60 p-3.5 text-[0.85rem] leading-relaxed ${reach(phase, 3)}`}>
        <p className="text-[0.75rem] font-semibold text-muted">Texte prêt, extrait</p>
        <p className="mt-1.5 font-semibold">Pour quelle entreprise Paysia est-il fait ?</p>
        <p className="mt-1 text-ink/85">
          <Typewriter text={EXTRACT} play={playing && phase >= 3} msPerStep={14} chunk={2} cursor={false} />
        </p>
        <div className={`mt-2 ${reach(phase, 4, "sc-fold")}`}>
          <p className="text-[0.75rem] text-muted">+ balisage FAQPage prêt (JSON-LD)</p>
          <pre className="mt-1 overflow-hidden rounded-lg [contain:inline-size] bg-ink px-3 py-2 font-mono text-[0.72rem] leading-relaxed text-white/85">
            <span className="text-on-deep">{"{"}</span> <span className="text-accent">&quot;@type&quot;</span>: &quot;FAQPage&quot;,{"\n"}
            {"  "}<span className="text-accent">&quot;mainEntity&quot;</span>: [{"{"} <span className="text-accent">&quot;@type&quot;</span>: &quot;Question&quot;,{"\n"}
            {"    "}<span className="text-accent">&quot;name&quot;</span>: &quot;Pour quelle entreprise Paysia est-il fait ?&quot; …{"\n"}
            {"  "}{"}]"} <span className="text-on-deep">{"}"}</span>
          </pre>
        </div>
      </div>
      <div className={`mt-4 flex flex-wrap items-center gap-2 ${reach(phase, 2)}`}>
        {published ? (
          <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-success-bg px-3 text-[0.85rem] font-semibold text-success-ink ${playing ? "sc-pop" : ""}`}>
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" className="sc-check">
              <path d="M2.5 6.3l2.2 2.2L9.5 3.7" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Publiée le 9 nov., page en ligne
          </span>
        ) : (
          <span
            data-ghost="validate"
            className="relative inline-flex min-h-9 items-center overflow-hidden rounded-lg bg-primary px-3 text-[0.85rem] font-semibold text-white"
          >
            {publishing ? <span className="sc-bar absolute inset-0 bg-primary-deep" style={{ animationDuration: "600ms" }} /> : null}
            <span className="relative">{publishing ? "Publication…" : "Valider la publication"}</span>
          </span>
        )}
        <span
          data-ghost="copy"
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-[0.85rem] font-semibold ring-1 ring-inset ${
            copied ? "text-success-ink ring-success/40" : "text-primary ring-line"
          }`}
        >
          {copied ? (
            <>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" className="sc-check">
                <path d="M2.5 6.3l2.2 2.2L9.5 3.7" pathLength={1} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copié
            </>
          ) : (
            "Copier le texte"
          )}
        </span>
      </div>
      <p className={`mt-3 text-[0.78rem] text-muted ${reach(phase, 9)}`}>
        Accompagné :{" "}
        <span className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4">rien n&apos;est publié sans votre accord</span>
      </p>
      <GhostCursor
        target={phase >= 8 ? null : phase >= 6 ? "validate" : phase >= 4 ? "copy" : null}
        click={phase >= 6 ? "validate" : phase >= 5 ? "copy" : null}
      />
    </SceneFrame>
  );
}

export function ActScene() {
  return (
    <ScenePlayer
      cues={ACT_CUES}
      total={ACT_TOTAL}
      label="la démonstration Agir"
      render={(phase, playing) => <Scene phase={phase} playing={playing} />}
      transcript={
        <>
          <p>Démonstration sur le compte démo Paysia : une tâche de la semaine, publier la page « Paysia ou Paylo : lequel choisir ? ».</p>
          <p>Pourquoi : 3 IA citent un comparatif pour cette question, et Paysia n&apos;en a aucun. Le texte est prêt, avec son balisage FAQPage.</p>
          <p>Le texte est copié, la publication est validée, la page est en ligne : 1 tâche sur 3 faite. Rien n&apos;est publié sans votre accord.</p>
        </>
      }
    />
  );
}

export default ActScene;
