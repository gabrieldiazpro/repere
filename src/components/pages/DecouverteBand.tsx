/** Offre Découverte (décision 2 du contrat V3) : gratuite, permanente, visible en tête de /tarifs. Serveur. */
import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon } from "@/components/site/blocks";
import { plansFor } from "@/components/site/plans-v2";

const FALLBACK_FEATURES = ["1 marque suivie", "5 questions suivies", "1 mesure par mois", "3 IA : ChatGPT, Gemini, Perplexity", "Historique de vos mesures"];

export function DecouverteBand({ segment }: { segment: "local" | "pme" | "ecommerce" }) {
  const plan = plansFor(segment).find((p) => /_decouverte$/.test(p.id));
  const features = (plan?.features ?? FALLBACK_FEATURES).filter((f) => !/^Gratuit/.test(f));
  return (
    <section
      aria-labelledby="decouverte-title"
      className="grid gap-6 rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.09)] sm:p-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)_auto] lg:items-center lg:gap-10"
    >
      <div>
        <h2 id="decouverte-title" className="text-2xl font-bold">
          Découverte
        </h2>
        <p className="mt-1 font-display text-3xl font-bold tabular">
          0&nbsp;€<span className="ml-1.5 text-base font-medium text-muted">pour toujours</span>
        </p>
        <p className="mt-1 text-[0.92rem] text-muted">Sans carte bancaire, sans limite de durée.</p>
      </div>
      <ul className="grid gap-x-6 gap-y-2 text-[0.97rem] sm:grid-cols-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <CheckIcon className="mt-0.5 text-primary" />
            {f}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-2">
        <Link href={`/inscription?parcours=${segment}`} className={buttonClasses({ className: "lift whitespace-nowrap" })}>
          Créer mon compte gratuit
        </Link>
        <a href="#comparer" className="text-center text-[0.9rem] font-semibold text-primary underline-offset-4 hover:underline">
          Ce qui n&apos;est pas inclus
        </a>
      </div>
    </section>
  );
}

export default DecouverteBand;
