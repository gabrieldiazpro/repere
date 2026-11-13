"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Typewriter } from "../Typewriter";
import { counterValue, typedLength, typingDuration } from "../lib";
import { useClock } from "../useClock";
import { useScene } from "../SceneContext";
import { storyCues, storyText, STORY_Q_MS, STORY_STREAM_CHUNK, STORY_STREAM_MS, type StoryData } from "./story-data";

/** Espaces insécables avant la ponctuation haute (même longueur : le décompte de frappe reste juste). */
const nbsp = (s: string) => s.replace(/ ([:;?!»])/g, " $1");

type Answer = StoryData["before"];

/** Réponse « streamée » : la place du texte restant est réservée (invisible), aucune variation de hauteur. */
function Streamed({ a, play, found, reveal }: { a: Answer; play: boolean; found: boolean; reveal: boolean }) {
  // Mouvement réduit : l'écriture se joue quand même (ce n'est pas un déplacement) ; seule la lecture compte.
  const { playing } = useScene();
  const text = storyText(a);
  const total = typingDuration(text.length, STORY_STREAM_MS, STORY_STREAM_CHUNK);
  const active = playing && play;
  const t = useClock(active, total);
  let budget = !playing || !reveal ? text.length : active ? typedLength(text.length, t, STORY_STREAM_MS, STORY_STREAM_CHUNK) : 0;
  const take = (s: string, sep = 1) => {
    const n = Math.max(0, Math.min(budget, s.length));
    budget -= s.length + sep;
    return { shown: s.slice(0, n), rest: s.slice(n) };
  };
  const intro = take(nbsp(a.intro));
  return (
    <div className="space-y-1.5 text-[0.88rem] leading-relaxed sm:text-[0.9rem]">
      <p className="text-ink/80">
        {intro.shown}
        <span className="invisible">{intro.rest}</span>
      </p>
      <ol className="space-y-1.5">
        {a.items.map((it, i) => {
          const name = take(it.name, 0);
          const note = take(nbsp(` : ${it.note}`));
          const done = name.rest === "";
          return (
            <li key={it.name} className="flex gap-2">
              <span className="tabular w-4 shrink-0 text-muted">{i + 1}.</span>
              <span className="min-w-0">
                {it.you && done ? (
                  <span className={`lock-on ${found && playing ? "is-animated" : ""} ${found ? "" : "!bg-transparent before:hidden"}`}>{name.shown}</span>
                ) : (
                  <strong className="font-semibold">{name.shown}</strong>
                )}
                <span className="invisible">{name.rest}</span>
                <span className="text-ink/75">{note.shown}</span>
                <span className="invisible">{note.rest}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Verdict({ rank }: { rank: number | null }) {
  return rank ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-bg px-2 py-0.5 text-[0.72rem] font-semibold text-success-ink">
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d="M2.5 6.2 5 8.6l4.6-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Cité, {rank === 1 ? "1ᵉʳ" : `${rank}ᵉ`}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-danger-bg px-2 py-0.5 text-[0.72rem] font-semibold text-danger-ink">
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      Absent
    </span>
  );
}

/** Score qui monte de la première mesure à la dernière (barre 0–100 + chiffre). */
function ScoreRise({ from, to, play, measures }: { from: number; to: number; play: boolean; measures: number }) {
  const { playing } = useScene();
  const active = playing && play;
  const t = useClock(active, 1100);
  const v = !playing ? to : active ? counterValue(from, to, t, 1100) : from;
  const delta = to - from;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between text-[0.74rem] text-muted">
          <span>Score de visibilité IA</span>
          <span className={`font-semibold text-success-ink transition-opacity duration-[var(--dur-base)] ${v === to ? "opacity-100" : "opacity-0"}`}>
            +{delta} points en {measures} mesures
          </span>
        </div>
        <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-line/70">
          <span
            className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary"
            style={{ transform: `scaleX(${v / 100})` }}
          />
          <span className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${from}%` }} />
        </div>
      </div>
      <p className="tabular w-[3.6rem] shrink-0 text-right font-display text-[1.7rem] font-bold leading-none text-ink">
        {v}
        <span className="text-[0.8rem] font-semibold text-muted">/100</span>
      </p>
    </div>
  );
}

function Scene({ d, phase, playing }: { d: StoryData; phase: number; playing: boolean }) {
  const at = (n: number) => phase >= n;
  const show = (n: number) => (at(n) ? "sc-enter" : "invisible");
  const after = at(4);
  return (
    <div className="app-frame relative overflow-hidden text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[0.8rem]">
        <span className="font-semibold">Qui {d.ia} recommande&nbsp;?</span>
        <span className="truncate rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Compte démo, {d.business}</span>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <p className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-primary-bg px-3.5 py-2 text-[0.9rem] text-primary-deep">
          <Typewriter text={nbsp(d.question)} play={playing && at(1)} msPerStep={STORY_Q_MS} />
        </p>

        {/* Ligne de temps : première mesure → dernière mesure ; l'indicateur glisse au passage. */}
        <div className={`relative grid grid-cols-2 rounded-xl bg-canvas p-1 text-[0.76rem] font-semibold ${at(2) ? "" : "opacity-40"}`}>
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08),0_2px_6px_-2px_rgba(27,31,46,.15)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-out)] motion-reduce:transition-none"
            style={{ transform: after ? "translateX(100%)" : "none" }}
          />
          <span className={`relative px-2 py-1.5 text-center transition-colors ${after ? "text-muted" : "text-ink"}`}>
            {d.before.when} · 1ʳᵉ mesure
          </span>
          <span className={`relative px-2 py-1.5 text-center transition-colors ${after ? "text-ink" : "text-muted"}`}>
            {d.after.when} · {d.measures}ᵉ mesure
          </span>
        </div>

        {/* Les deux réponses occupent la même cellule : la plus haute fixe la hauteur (CLS 0). */}
        <div className={`rounded-xl bg-white p-3.5 ring-1 ring-line/80 ${at(2) ? "" : "sc-ghost"}`}>
          <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2 text-[0.75rem] font-semibold text-muted">
            <span>Réponse de {d.ia}</span>
            <span className="grid [&>*]:col-start-1 [&>*]:row-start-1 justify-items-end">
              <span className={`transition-opacity duration-[var(--dur-base)] ${at(3) && !after ? "opacity-100" : "opacity-0"}`}>
                <Verdict rank={null} />
              </span>
              <span className={`transition-opacity duration-[var(--dur-base)] ${at(5) ? "opacity-100" : "opacity-0"}`}>
                <Verdict rank={d.after.rank} />
              </span>
            </span>
          </div>
          <div className="grid [&>*]:col-start-1 [&>*]:row-start-1">
            <div className={`transition-opacity duration-[var(--dur-slow)] ${after ? "opacity-0" : "opacity-100"}`} aria-hidden={after}>
              <Streamed a={d.before} play={at(2) && !after} found={false} reveal={at(2)} />
            </div>
            <div className={`transition-opacity duration-[var(--dur-slow)] ${after ? "opacity-100" : "opacity-0"}`}>
              <Streamed a={d.after} play={after} found={at(5)} reveal={after} />
            </div>
          </div>
        </div>

        <div className={show(3)}>
          <ScoreRise from={d.before.score} to={d.after.score} play={at(6)} measures={d.measures} />
        </div>
      </div>

      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line/80 bg-canvas/70 px-4 py-2.5 text-[0.74rem] ${show(7)}`}>
        <span className="text-muted">Même question, aujourd&apos;hui :</span>
        {d.engines.map((e, i) => (
          <span key={e.ia} className={`inline-flex items-center gap-1.5 ${at(7) && playing ? "sc-pop" : ""}`} style={{ ["--i" as string]: i }}>
            <span className="font-semibold">{e.ia}</span>
            <Verdict rank={e.rank} />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Scène du hero V4 : une question posée à une IA, la réponse qui s'écrit, votre nom absent (première mesure) puis
 * présent (dernière mesure), le score qui monte. Données réelles du compte démo (entreprise fictive),
 * calculées côté serveur par `demoHeroStory` (src/components/site/demo-figures.ts).
 */
export function StoryScene({ segment, data, dark = false }: { segment: string; data: StoryData; dark?: boolean }) {
  const d = data;
  const { cues, total } = storyCues(d);
  return (
    <ScenePlayer
      cues={cues}
      total={total}
      replayKey={segment}
      dark={dark}
      label="la démonstration « Absent, puis cité »"
      render={(phase, playing) => <Scene d={d} phase={phase} playing={playing} />}
      transcript={
        <>
          <p>
            Compte démo {d.business} (entreprise fictive). Question posée à {d.ia} : {d.question}
          </p>
          <p>
            Première mesure ({d.before.when}) : {d.business} est absent de la réponse, qui cite {d.before.items.map((i) => i.name).join(", ")}. Score {d.before.score} sur 100.
          </p>
          <p>
            Dernière mesure ({d.after.when}, {d.measures}e mesure) : {d.business} est cité en position {d.after.rank}. Score {d.after.score} sur 100. Sur la même question
            aujourd&apos;hui : {d.engines.map((e) => `${e.ia} ${e.rank ? `le cite (${e.rank}e)` : "ne le cite pas"}`).join(", ")}.
          </p>
          <p>Données du compte démo ; ce n&apos;est pas une promesse de résultat.</p>
        </>
      }
    />
  );
}

export default StoryScene;
