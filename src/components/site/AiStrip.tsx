/**
 * Bandeau « Les IA que nous interrogeons » (docs/v3/07 §5.6.1, contrat V3 décisions 3 et 5) :
 * noms écrits en toutes lettres dans des pastilles typographiques, jamais de logo ; le mode d'interrogation
 * est affiché (l'honnêteté sur la méthode est un argument).
 */
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { offersIncluding } from "./offer-facts";

/** Mode d'interrogation, et offres qui incluent chaque IA (lues dans src/lib/entitlements.ts). */
export const TRACKED_AIS = [
  { name: "ChatGPT", mode: "avec recherche web", offers: offersIncluding("chatgpt") },
  { name: "Perplexity", mode: "avec recherche web", offers: offersIncluding("perplexity") },
  { name: "Gemini", mode: "sans recherche web, donc sans sources", offers: offersIncluding("gemini") },
  { name: "Claude", mode: "avec recherche web", offers: offersIncluding("claude") },
  { name: "Mistral Le Chat", mode: "en option, avec recherche web", offers: offersIncluding("mistral") },
];

export function AiStrip({ className = "" }: { className?: string }) {
  return (
    <section aria-labelledby="ia-suivies-title" className={`border-y border-line/70 bg-white py-8 sm:py-10 ${className}`}>
      <Container>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:gap-10">
          <h2 id="ia-suivies-title" className="shrink-0 font-sans text-[0.98rem] font-semibold tracking-normal text-ink/80 lg:max-w-[13rem]">
            Nous posons vos questions clients à
          </h2>
          <ul className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {TRACKED_AIS.map((a, k) => (
              <Reveal as="li" i={k} key={a.name} className="flex min-h-14 items-center gap-2.5 rounded-xl bg-canvas px-3 py-2">
                <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-ink/70" />
                <span className="min-w-0">
                  <span className="block font-sans text-[0.98rem] font-semibold leading-tight text-ink">{a.name}</span>
                  <span className="block text-[0.75rem] leading-snug text-muted">{a.mode}</span>
                  <span className="block text-[0.75rem] leading-snug text-ink/70">{a.offers === "toutes les offres" ? "Toutes les offres" : `Offres : ${a.offers}`}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </div>
        <p className="mt-4 text-[0.82rem] text-muted">
          Par les API officielles des éditeurs ; les réponses peuvent différer de l&apos;application grand public. Les aperçus IA et le mode IA de
          Google ne sont pas mesurés : aucune API ne le permet proprement.{" "}
          <Link href="/methode" className="underline underline-offset-2 hover:text-ink">
            Notre méthode
          </Link>
        </p>
      </Container>
    </section>
  );
}

export default AiStrip;
