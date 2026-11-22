/**
 * Bandeau « Les IA que nous interrogeons » (docs/v3/07 §5.6.1, contrat V3 décisions 3 et 5 ; V8 : 10 IA mesurables) :
 * noms écrits en toutes lettres dans des pastilles typographiques, jamais de logo ; le mode d'interrogation est
 * affiché (l'honnêteté sur la méthode est un argument). Les IA qu'aucune offre n'annonce sont dites « en option ».
 * Serveur uniquement (lit la table des droits via ai-coverage.ts).
 */
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { aiCoverage, aiCoverageCounts, type AiCoverage } from "./ai-coverage";

/** Compatibilité : liste des IA affichées (nom, mode, offres). */
export const TRACKED_AIS = aiCoverage().map((a) => ({ name: a.name, mode: a.mode, offers: a.offers }));

function Pill({ a }: { a: AiCoverage }) {
  return (
    <>
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${a.status === "offres" ? "border-ink/70" : "border-dashed border-ink/40"}`} />
      <span className="min-w-0">
        <span className="block font-sans text-[0.98rem] font-semibold leading-tight text-ink">{a.name}</span>
        <span className="block text-[0.75rem] leading-snug text-muted">{a.mode}</span>
        <span className={`block text-[0.75rem] leading-snug ${a.status === "offres" ? "text-ink/70" : "text-muted"}`}>
          {a.status === "offres" ? (a.offers === "Toutes les offres" ? a.offers : `Offres : ${a.offers}`) : a.offers}
        </span>
      </span>
    </>
  );
}

export function AiStrip({ className = "" }: { className?: string }) {
  const list = aiCoverage();
  const c = aiCoverageCounts();
  return (
    <section aria-labelledby="ia-suivies-title" className={`border-y border-line/70 bg-white py-8 sm:py-10 ${className}`}>
      <Container>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
            <h2 id="ia-suivies-title" className="font-sans text-[1.05rem] font-semibold tracking-normal text-ink/85">
              Nous posons vos questions clients à {c.total} IA
            </h2>
            <p className="text-[0.85rem] text-muted">
              {c.inOffers} dans les offres, {c.optional} en option. Méthode affichée pour chacune.
            </p>
          </div>
          <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {list.map((a, k) => (
              <Reveal as="li" i={k % 5} key={a.id} className="flex min-h-14 items-center gap-2.5 rounded-xl bg-canvas px-3 py-2">
                <Pill a={a} />
              </Reveal>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-[0.82rem] text-muted">
          Par les API officielles des éditeurs, ou en relevant la page de résultats telle qu&apos;elle s&apos;affiche en France pour les aperçus IA,
          le mode IA de Google et Copilot dans Bing. Les réponses peuvent différer de l&apos;application grand public ; une recherche sans aperçu IA
          est comptée à part, jamais comme un oubli. Une IA en option n&apos;est interrogée que si elle est activée, jamais simulée.{" "}
          <Link href="/methode#chaque-ia" className="underline underline-offset-2 hover:text-ink">
            Comment chaque IA est mesurée
          </Link>
        </p>
      </Container>
    </section>
  );
}

/** Tableau détaillé (méthode, limite, offres) : /methode, /comparatif, /tarifs. Serveur. */
export function AiCoverageTable({ caption = "Les IA mesurées par Repéré, leur méthode et les offres qui les incluent" }: { caption?: string }) {
  const list = aiCoverage();
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
      <table className="w-full border-collapse text-left text-[0.93rem] max-md:block">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-canvas max-md:hidden">
          <tr>
            <th scope="col" className="px-4 py-3 font-display font-semibold">IA</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Comment nous la mesurons</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Limite à connaître</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Offres</th>
          </tr>
        </thead>
        <tbody className="max-md:block">
          {list.map((a) => (
            <tr key={a.id} className="border-t border-line/70 align-top max-md:block max-md:px-4 max-md:py-3">
              <th scope="row" className="px-4 py-3 font-semibold max-md:block max-md:p-0">{a.name}</th>
              <td className="px-4 py-3 max-md:block max-md:p-0 max-md:pt-1">{a.mode}</td>
              <td className="px-4 py-3 text-ink/70 max-md:block max-md:p-0 max-md:pt-1 max-md:text-[0.88rem]">{a.caveat}</td>
              <td className={`px-4 py-3 max-md:block max-md:p-0 max-md:pt-1 ${a.status === "offres" ? "font-medium" : "text-muted"}`}>
                {a.status === "offres" ? <span className="md:hidden">Offres : </span> : null}
                {a.offers}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AiStrip;
