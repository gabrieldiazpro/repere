/**
 * Schéma maison « question → IA → sources → réponse → vous » (accueil V4). Composant serveur : tout le texte est
 * dans le HTML ; l'animation (traits qui se tracent, étapes qui apparaissent l'une après l'autre) se joue une fois à
 * l'entrée à l'écran via <Reveal> + les classes .bx de globals.css. Pictos génériques, jamais de logo d'IA.
 */
import type { ReactNode } from "react";
import { Reveal } from "@/components/motion/Reveal";

type Step = { title: string; text: string; art: ReactNode };

const ink = "currentColor";

const STEPS: Step[] = [
  {
    title: "Une question",
    text: "Vos clients demandent à une IA plutôt que de comparer dix liens.",
    art: (
      <div className="w-full rounded-2xl rounded-br-md bg-primary-bg px-3 py-2 text-[0.82rem] font-medium text-primary-deep">
        «&nbsp;Bon plombier dans le 11e&nbsp;?&nbsp;»
      </div>
    ),
  },
  {
    title: "Une IA",
    text: "ChatGPT, Gemini ou Perplexity cherche quoi répondre.",
    art: (
      <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" className="text-primary">
        <circle cx="32" cy="32" r="27" fill="var(--color-primary-bg)" />
        <path d="M32 16c1.6 8.4 7.6 14.4 16 16-8.4 1.6-14.4 7.6-16 16-1.6-8.4-7.6-14.4-16-16 8.4-1.6 14.4-7.6 16-16Z" fill={ink} />
      </svg>
    ),
  },
  {
    title: "Des sources",
    text: "Elle lit des fiches, des annuaires, des avis et des comparatifs.",
    art: (
      <svg viewBox="0 0 96 64" width="84" height="56" aria-hidden="true" className="text-ink/70">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${8 + i * 22} ${14 - i * 5})`}>
            <rect width="40" height="44" rx="6" fill="#fff" stroke={ink} strokeOpacity=".25" />
            <rect x="7" y="9" width="20" height="4" rx="2" fill={ink} fillOpacity=".55" />
            <rect x="7" y="18" width="26" height="3" rx="1.5" fill={ink} fillOpacity=".2" />
            <rect x="7" y="25" width="22" height="3" rx="1.5" fill={ink} fillOpacity=".2" />
            <rect x="7" y="32" width="18" height="3" rx="1.5" fill={ink} fillOpacity=".2" />
          </g>
        ))}
      </svg>
    ),
  },
  {
    title: "Trois à cinq noms",
    text: "La réponse ne garde que quelques entreprises.",
    art: (
      <ol className="w-full space-y-1 text-[0.78rem]">
        {["Ets Renaud", "Atelier Henry", "Atelier Chevalier"].map((n, i) => (
          <li key={n} className="flex items-center gap-1.5 rounded-md bg-canvas px-2 py-1">
            <span className="tabular text-muted">{i + 1}.</span>
            <span className="font-semibold">{n}</span>
          </li>
        ))}
      </ol>
    ),
  },
  {
    title: "Et vous ?",
    text: "Absent de la réponse, vous n'êtes pas comparé. Et personne ne vous prévient.",
    art: (
      <div className="flex w-full flex-col items-center gap-2">
        <span className="lock-on text-[0.9rem]">Votre entreprise</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-bg px-2 py-0.5 text-[0.72rem] font-semibold text-danger-ink">
          <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
            <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Absent
        </span>
      </div>
    ),
  },
];

function Connector({ i }: { i: number }) {
  return (
    <svg
      viewBox="0 0 40 16"
      aria-hidden="true"
      className="mx-auto h-5 w-10 shrink-0 rotate-90 text-primary/60 lg:mt-14 lg:h-4 lg:w-full lg:rotate-0"
      preserveAspectRatio="none"
    >
      <path
        d="M2 8h32m-6-5 6 5-6 5"
        pathLength={1}
        strokeDasharray="1"
        className="bx bx-draw"
        style={{ ["--d" as string]: `${i * 260 + 180}ms` }}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function AnswerPath() {
  return (
    <Reveal as="ol" className="bx-scope grid gap-2 lg:grid-cols-[1fr_2.5rem_1fr_2.5rem_1fr_2.5rem_1fr_2.5rem_1fr] lg:gap-0" aria-label="Comment une IA choisit qui recommander">
      {STEPS.map((s, i) => (
        <li key={s.title} className="contents">
          {i > 0 ? <Connector i={i - 1} /> : null}
          <div
            className={`bx bx-fade flex flex-col items-center rounded-2xl p-4 text-center ${i === 4 ? "bg-white shadow-[0_0_0_2px_var(--color-primary)]" : "bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)]"}`}
            style={{ ["--d" as string]: `${i * 260}ms` }}
          >
            <div className="flex min-h-[4.5rem] w-full items-center justify-center">{s.art}</div>
            <h3 className="mt-3 font-display text-[1.05rem] font-semibold">{s.title}</h3>
            <p className="mt-1 text-[0.9rem] leading-snug text-ink/75">{s.text}</p>
          </div>
        </li>
      ))}
    </Reveal>
  );
}

export default AnswerPath;
