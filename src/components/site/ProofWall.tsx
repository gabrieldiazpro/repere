/**
 * Mur de preuves honnêtes (docs/v3/07 §5.6.7) : méthode ouverte, marge d'erreur publiée, chiffres sourcés,
 * garanties, données. Aucun faux client, aucune note inventée, aucun compteur sans base réelle.
 * Chaque affirmation renvoie à la page qui la détaille (/methode, /cgv, /confidentialite).
 */
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Counter } from "@/components/motion/Counter";
import { FACTS, type Fact } from "./facts";
import { CheckIcon } from "./blocks";

/**
 * Exemple de grille de mesure du test gratuit local (/methode) : 8 questions × 3 IA × 2 passages = 48 réponses.
 * Une colonne par question ; dans chaque colonne, ChatGPT, Gemini, Perplexity, deux passages chacun.
 */
export const GRID_QUESTIONS = 8;
export const GRID_ENGINES = 3;
export const GRID_PASSES = 2;
export const GRID: number[][] = [
  [1, 1, 0, 1, 1, 1], [0, 0, 1, 1, 0, 0], [0, 0, 0, 1, 0, 1], [1, 1, 1, 0, 0, 1],
  [1, 0, 1, 0, 0, 0], [1, 1, 0, 0, 0, 1], [1, 0, 1, 0, 0, 0], [1, 0, 1, 0, 1, 1],
];

function FactFigure({ fact }: { fact: Fact }) {
  const m = fact.figure.match(/^(\d+) %$/);
  return (
    <figure>
      <p className="font-display text-[2.4rem] font-bold leading-none text-primary">
        {m ? <Counter value={Number(m[1])} suffix={" %"} /> : <span className="tabular">{fact.figure}</span>}
      </p>
      <blockquote className="mt-2 text-[0.95rem] text-ink/85">
        <p>{fact.text}</p>
      </blockquote>
      <figcaption className="mt-2 text-[0.8rem] text-muted">
        Source :{" "}
        <a href={fact.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {fact.source}
          <span className="sr-only"> (nouvel onglet)</span>
        </a>
      </figcaption>
    </figure>
  );
}

const GUARANTEES = [
  { t: "Audit approfondi remboursé sous 14 jours, sans justification", href: "/cgv" },
  { t: "Essentiel sans engagement, résiliable en un clic", href: "/cgv" },
  { t: "Rien n'est publié sans votre accord", href: "/methode" },
  { t: "Aucune promesse de position dans une IA", href: "/methode" },
];

/** `facts` : deux chiffres sourcés, à choisir pour ne pas répéter ceux déjà affichés plus haut sur la page. */
export function ProofWall({ facts = [FACTS.credoc, FACTS.g2Start] }: { facts?: readonly [Fact, Fact] } = {}) {
  const cited = GRID.flat().filter(Boolean).length;
  return (
    <div className="grid gap-4 lg:grid-cols-6 lg:gap-5">
      {/* Méthode ouverte : la grille de mesure */}
      <Reveal i={0} className="bx-scope rounded-[1.25rem] bg-primary-deep p-6 text-white lg:col-span-3 lg:row-span-2 sm:p-8">
        <h3 className="text-[1.4rem] font-bold text-white">Une méthode publiée, pas une boîte noire</h3>
        <p className="mt-2 max-w-[52ch] text-on-deep">
          Au test gratuit, chaque question est posée deux fois à chaque IA (trois fois en suivi), parce qu&apos;une IA ne répond jamais tout à fait pareil. Un score repose sur des dizaines de réponses, et nous affichons combien.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-6">
          <div aria-hidden="true" className="grid grid-flow-col grid-rows-6 gap-1">
            {GRID.flatMap((row, q) =>
              row.map((v, ia) => (
                <span
                  key={`${q}-${ia}`}
                  className={`bx bx-pop h-3 w-3 rounded-[3px] ${v ? "bg-accent" : "bg-white/15"}`}
                  style={{ ["--d" as string]: `${(q * 6 + ia) * 14}ms` }}
                />
              )),
            )}
          </div>
          <p className="text-[0.9rem] text-on-deep">
            <span className="block font-display text-[2rem] font-bold leading-none text-white">
              {cited} <span className="text-[1.1rem] font-semibold text-on-deep">sur 48</span>
            </span>
            réponses où vous êtes cité, dans cet exemple
            <span className="sr-only"> : 8 questions posées deux fois à 3 IA, soit 48 réponses analysées.</span>
          </p>
        </div>
        <p className="mt-5 text-[0.82rem] text-on-deep">{GRID_QUESTIONS} questions × {GRID_ENGINES} IA × {GRID_PASSES} passages = {GRID_QUESTIONS * GRID_ENGINES * GRID_PASSES} réponses pour un test gratuit local. Exemple fictif.</p>
        <Link href="/methode" className="mt-5 inline-flex min-h-11 items-center font-semibold text-white underline underline-offset-4 hover:no-underline">
          Lire la méthode complète
        </Link>
      </Reveal>

      {/* Marge d'erreur publiée */}
      <Reveal i={1} className="rounded-[1.25rem] bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08)] lg:col-span-3">
        <h3 className="text-[1.15rem] font-bold">La marge d&apos;erreur, affichée</h3>
        <p className="mt-3 font-display text-[2.4rem] font-bold leading-none text-primary">
          ±<Counter value={12} /> <span className="text-[1.1rem] font-semibold text-muted">points au pire</span>
        </p>
        {/* Schéma : la mesure est un point, la vérité est quelque part dans la bande. Illustration, sans chiffre inventé. */}
        <div aria-hidden="true" className="bx-scope relative mt-5" data-reveal="">
          <div className="relative h-9">
            <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line" />
            <span
              className="bx bx-grow absolute top-1/2 h-4 -translate-y-1/2 rounded-full bg-primary/20 ring-1 ring-inset ring-primary/40"
              style={{ left: "26%", width: "24%", ["--d" as string]: "200ms", transformOrigin: "50% 50%" }}
            />
            <span className="bx bx-pop absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-white" style={{ left: "38%" }} />
          </div>
          <div className="flex justify-between text-[0.75rem] text-muted">
            <span>0 %</span>
            <span className="absolute left-[38%] -translate-x-1/2 whitespace-nowrap font-semibold text-primary">mesure ± marge</span>
            <span>100 %</span>
          </div>
        </div>
        <p className="mt-3 text-[0.95rem] text-ink/80">
          sur le taux de mention, avec 48 réponses. Une évolution n&apos;est annoncée que si elle dépasse cette marge.{" "}
          <Link href="/methode" className="font-semibold text-primary underline underline-offset-4">
            Le calcul
          </Link>
        </p>
      </Reveal>

      {/* Garanties */}
      <Reveal i={2} className="rounded-[1.25rem] bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08)] lg:col-span-3">
        <h3 className="text-[1.15rem] font-bold">Ce que nous garantissons</h3>
        <ul className="mt-3 space-y-2 text-[0.95rem]">
          {GUARANTEES.map((g) => (
            <li key={g.t} className="flex gap-2.5">
              <CheckIcon className="mt-0.5 text-success" />
              <Link href={g.href} className="hover:text-primary hover:underline underline-offset-4">
                {g.t}
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>

      {/* Chiffres sourcés */}
      <Reveal i={3} className="rounded-[1.25rem] bg-canvas p-6 lg:col-span-4">
        <h3 className="sr-only">Des chiffres sourcés</h3>
        <div className="grid gap-6 sm:grid-cols-2">
          <FactFigure fact={facts[0]} />
          <FactFigure fact={facts[1]} />
        </div>
      </Reveal>

      {/* Données */}
      <Reveal i={4} className="flex flex-col rounded-[1.25rem] bg-canvas p-6 lg:col-span-2">
        <h3 className="text-[1.15rem] font-bold">Vos données restent à vous</h3>
        <p className="mt-2 text-[0.95rem] text-ink/80">
          Hébergées dans l&apos;Union européenne, jamais revendues, exportables et supprimées à votre demande.
        </p>
        <Link href="/confidentialite" className="mt-auto inline-flex min-h-11 items-center pt-3 font-semibold text-primary underline underline-offset-4 hover:no-underline">
          Politique de confidentialité
        </Link>
      </Reveal>

      <p className="text-[0.88rem] text-muted lg:col-span-6">
        Pas de logos ni de témoignages ici : Repéré est jeune, et nous n&apos;affichons que des clients réels qui ont donné leur accord écrit.
      </p>
    </div>
  );
}

export default ProofWall;
