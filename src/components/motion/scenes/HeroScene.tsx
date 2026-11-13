"use client";

import { ScenePlayer } from "../ScenePlayer";
import { Typewriter } from "../Typewriter";
import { GaugeMorph } from "../GaugeMorph";
import { typedLength, typingDuration } from "../lib";
import { useClock } from "../useClock";
import { useScene } from "../SceneContext";
import {
  citedCount,
  heroCues,
  mainAnswerText,
  QUESTION_MS,
  STREAM_CHUNK,
  STREAM_MS,
  type HeroSceneData,
  type HeroSegment,
} from "./hero-data";

/** Espaces insécables avant la ponctuation haute (même longueur : le décompte de frappe reste juste). */
const nbsp = (s: string) => s.replace(/ ([:;?!»])/g, "\u00a0$1");

/** Rendu progressif de la réponse principale : le nom « repéré » passe en cadre de visée à l'étape 5. */
function StreamedAnswer({ d, play, found }: { d: HeroSceneData; play: boolean; found: boolean }) {
  // Mouvement réduit : l'écriture se joue quand même (V4 : on ne coupe que les déplacements).
  const { playing } = useScene();
  const text = mainAnswerText(d);
  const total = typingDuration(text.length, STREAM_MS, STREAM_CHUNK);
  const active = playing && play;
  const t = useClock(active, total);
  let budget = !playing ? text.length : active ? typedLength(text.length, t, STREAM_MS, STREAM_CHUNK) : 0;
  // `sep` = caractères qui suivent ce morceau dans mainAnswerText (saut de ligne entre deux lignes, rien entre le nom et sa note).
  const take = (s: string, sep = 1) => {
    const n = Math.max(0, Math.min(budget, s.length));
    budget -= s.length + sep;
    return { shown: s.slice(0, n), rest: s.slice(n) };
  };
  const intro = take(nbsp(d.main.intro));
  return (
    <div className="space-y-1.5 text-[0.9rem] leading-relaxed">
      <p>
        {intro.shown}
        <span className="invisible">{intro.rest}</span>
      </p>
      <ol className="space-y-2 leading-[1.7]">
        {d.main.items.map((it) => {
          const name = take(it.name, 0);
          const note = take(nbsp(` : ${it.note}`));
          const complete = name.rest === "";
          return (
            <li key={it.name}>
              {it.you && complete ? (
                <span className={`lock-on ${found && playing ? "is-animated" : ""} ${found ? "" : "!bg-transparent before:hidden"}`}>{name.shown}</span>
              ) : (
                <strong className="font-semibold">{name.shown}</strong>
              )}
              <span className="invisible">{name.rest}</span>
              {note.shown}
              <span className="invisible">{note.rest}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Badge({ rank }: { rank: number | null }) {
  return rank ? (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-success-bg px-1.5 py-px text-[0.68rem] font-semibold text-success-ink">
      Cité, {rank}
      <sup>e</sup>
    </span>
  ) : (
    <span className="whitespace-nowrap rounded-full bg-danger-bg px-1.5 py-px text-[0.68rem] font-semibold text-danger-ink">Absent</span>
  );
}

function Scene({ d, phase, playing }: { d: HeroSceneData; phase: number; playing: boolean }) {
  const at = (n: number) => phase >= n;
  const show = (n: number, cls = "sc-enter") => (at(n) ? cls : "invisible");
  // Avant leur tour, les blocs principaux s'affichent en silhouette (pas de grand cadre vide au premier écran).
  const ghost = (n: number, cls = "sc-enter") => (at(n) ? cls : "sc-ghost");
  const others = d.engines.filter((e) => e.ia !== d.main.ia);
  const mainEngine = d.engines.find((e) => e.ia === d.main.ia)!;
  const thinking = playing && phase === 3;

  return (
    <div className="app-frame relative overflow-hidden text-ink">
      <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-2.5 text-[0.8rem]">
        <span className="font-semibold">Qui l&apos;IA recommande ?</span>
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Compte démo, {d.business}</span>
      </div>

      <div className="space-y-3.5 p-4 sm:p-5">
        <p className="ml-auto max-w-[90%] rounded-2xl rounded-br-md bg-primary-bg px-3.5 py-2 text-[0.92rem] text-primary-deep">
          <Typewriter text={nbsp(d.main.question)} play={playing && at(1)} msPerStep={QUESTION_MS} />
        </p>

        {/* Onglets des IA du compte démo, avec leur verdict à l'étape 5 */}
        <ul className={`grid grid-cols-2 gap-1.5 ${d.engines.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {d.engines.map((e, i) => (
            <li
              key={e.ia}
              style={{ ["--i" as string]: i }}
              className={`flex min-h-9 flex-wrap items-center justify-between gap-1 rounded-lg px-2 py-1 text-[0.78rem] ring-1 ring-inset ${
                e.ia === d.main.ia ? "bg-white font-semibold ring-primary/40" : "bg-canvas ring-line/70"
              } ${ghost(2)}`}
            >
              <span>{e.ia}</span>
              {thinking ? (
                <span className="flex gap-0.5" style={{ ["--d" as string]: `${i * 120}ms` }}>
                  {[0, 1, 2].map((k) => (
                    <span key={k} className="h-1 w-1 rounded-full bg-muted animate-dot" style={{ animationDelay: `${i * 120 + k * 150}ms` }} />
                  ))}
                </span>
              ) : at(5) ? (
                <span className="sc-pop" style={{ ["--i" as string]: i }}>
                  <Badge rank={e.rank} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {/* Réponse au premier plan, deux cartes empilées derrière (les autres IA) */}
        <div className={`relative ${ghost(4)}`}>
          <span aria-hidden="true" className="absolute inset-x-4 -bottom-2 h-full rounded-xl bg-white ring-1 ring-line/60" />
          <span aria-hidden="true" className="absolute inset-x-2 -bottom-1 h-full rounded-xl bg-white ring-1 ring-line/70" />
          <div className="relative rounded-xl bg-white p-3.5 ring-1 ring-line/80">
            <p className="mb-1.5 flex items-center justify-between text-[0.75rem] font-semibold text-muted">
              Réponse de {d.main.ia}
              {at(5) ? <Badge rank={mainEngine.rank} /> : null}
            </p>
            <StreamedAnswer d={d} play={at(4)} found={at(5)} />
          </div>
        </div>

        {/* Les autres IA, en une ligne chacune (bureau) */}
        <ul className="hidden space-y-1 pt-1 text-[0.78rem] sm:block">
          {others.map((e, i) => (
            <li key={e.ia} style={{ ["--i" as string]: i }} className={`flex items-baseline gap-2 ${show(4)}`}>
              <span className="w-[4.6rem] shrink-0 font-semibold">{e.ia}</span>
              <span className="min-w-0 flex-1 truncate text-ink/75">
                {e.names.map((n, k) => (
                  <span key={n}>
                    {k ? ", " : ""}
                    <span className={n === d.business || n.startsWith(d.business) ? (at(5) ? "rounded bg-accent-soft px-1 font-semibold text-ink" : "") : ""}>{n}</span>
                  </span>
                ))}
              </span>
              {at(5) ? (
                <span className="sc-pop shrink-0" style={{ ["--i" as string]: i + 1 }}>
                  <Badge rank={e.rank} />
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* Synthèse + jauge */}
      <div className={`flex items-center gap-3 border-t border-line/80 bg-canvas/70 px-4 py-3 ${show(6)}`}>
        <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5 text-[0.75rem]">
          <li className="rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-inset ring-line">
            Cité par {citedCount(d)} IA sur {d.engines.length}
          </li>
          <li className="rounded-full bg-white px-2 py-0.5 text-ink/80 ring-1 ring-inset ring-line">{d.answers}</li>
          <li className="rounded-full bg-white px-2 py-0.5 text-ink/80 ring-1 ring-inset ring-line">{d.confidence}</li>
        </ul>
        <div className={show(7)}>
          <GaugeMorph score={d.score} play={at(7)} size={92} />
        </div>
      </div>
      <p className={`flex items-center gap-2 bg-primary px-4 py-2 text-[0.85rem] font-semibold text-white ${show(8)}`}>
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" className="shrink-0 rotate-180 max-lg:rotate-[-90deg]">
          <path d="M4 10h11M11 5.5 15.5 10 11 14.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Et vous ? Les IA vous citent-elles ?
      </p>
    </div>
  );
}

/**
 * Scène du hero (§5.2) : question tapée → les IA répondent → votre nom est repéré → la jauge se calcule.
 * `data` vient du compte démo du parcours (src/components/site/demo-figures.ts, calculé côté serveur).
 */
export function HeroScene({ segment, data }: { segment: HeroSegment; data: HeroSceneData }) {
  const d = data;
  const { cues, total } = heroCues(d);
  const cited = d.engines.filter((e) => e.rank !== null).map((e) => `${e.ia} (${e.rank}e)`);
  const absent = d.engines.filter((e) => e.rank === null).map((e) => e.ia);
  return (
    <ScenePlayer
      cues={cues}
      total={total}
      replayKey={segment}
      label="la démonstration « Qui l'IA recommande ? »"
      render={(phase, playing) => <Scene d={d} phase={phase} playing={playing} />}
      transcript={
        <>
          <p>Compte démo {d.business} (entreprise fictive). Question posée aux IA : {d.main.question}</p>
          <p>
            Réponse de {d.main.ia} : {d.main.intro} {d.main.items.map((it, i) => `${i + 1}. ${it.name}, ${it.note}`).join(" ")}
          </p>
          <p>
            {d.business} est cité par {cited.join(", ")}
            {absent.length ? <> ; absent chez {absent.join(" et ")}</> : null}. {d.answers}. {d.confidence}. Score du compte démo : {d.score} sur 100.
          </p>
        </>
      }
    />
  );
}

export default HeroScene;
