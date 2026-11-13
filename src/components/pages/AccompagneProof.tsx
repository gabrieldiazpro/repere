/**
 * Section « Avant de prendre Accompagné » (/tarifs) : livrables consultables, déroulé du premier mois, ce que le
 * client valide. Aucun client, avis, logo ni chiffre de résultat : Repéré appliqué à lui-même, et les comptes démo
 * (entreprises fictives) étiquetés comme tels.
 */
import Link from "next/link";
import { CheckIcon, CrossIcon } from "@/components/site/blocks";
import {
  COMMITMENT_MONTHS,
  WE_NEVER,
  YOU_VALIDATE,
  accompagneFeatures,
  deliverableExamples,
  firstMonth,
  type AccSeg,
} from "./accompagne-data";

const SEG_LABEL: Record<AccSeg, string> = { local: "Commerce local", pme: "PME et services", ecommerce: "E-commerce" };

function KindPill({ kind }: { kind: "reel" | "demo" }) {
  return kind === "reel" ? (
    <span className="rounded-full bg-success-bg px-2 py-0.5 text-[0.72rem] font-semibold text-success-ink">Réel : Repéré pour lui-même</span>
  ) : (
    <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Compte démo, entreprise fictive</span>
  );
}

export function AccompagneProof({ segment }: { segment: AccSeg }) {
  const examples = deliverableExamples(segment);
  const steps = firstMonth(segment);
  const features = accompagneFeatures(segment);
  const others = (["local", "pme", "ecommerce"] as const).filter((s) => s !== segment);
  return (
    <div className="space-y-16">
      <nav aria-label="Autres parcours" className="flex flex-wrap gap-x-5 gap-y-1 text-[0.95rem]">
        <span className="font-semibold text-ink">Parcours : {SEG_LABEL[segment]}</span>
        {others.map((s) => (
          <Link key={s} href={`/tarifs?segment=${s}#accompagne`} className="font-semibold text-primary underline-offset-4 hover:underline">
            Voir pour {SEG_LABEL[s].toLowerCase()}
          </Link>
        ))}
      </nav>

      <div>
        <h3 className="text-[1.4rem] font-bold">Des livrables que vous pouvez ouvrir maintenant</h3>
        <p className="mt-2 max-w-[65ch] text-ink/75">
          Pas de maquette : ce sont les pages et fichiers réellement servis. Repéré se les applique à lui-même ; les comptes démo montrent les mêmes
          livrables pour une entreprise fictive de votre parcours.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {examples.map((e) => (
            <li key={e.href} className="flex flex-col rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
              <KindPill kind={e.kind} />
              <h4 className="mt-3 text-[1.05rem] font-bold leading-snug">{e.title}</h4>
              <p className="mt-1.5 text-[0.93rem] text-ink/75">{e.what}</p>
              {e.raw ? (
                <a href={e.href} target="_blank" rel="noopener nofollow" className="mt-auto inline-flex min-h-11 items-center pt-3 font-semibold text-primary underline underline-offset-4 hover:no-underline">
                  Ouvrir le fichier<span className="sr-only"> (nouvel onglet)</span>
                </a>
              ) : (
                <Link href={e.href} className="mt-auto inline-flex min-h-11 items-center pt-3 font-semibold text-primary underline underline-offset-4 hover:no-underline">
                  Ouvrir
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-[1.4rem] font-bold">Votre premier mois, étape par étape</h3>
        <p className="mt-2 max-w-[65ch] text-ink/75">
          Les dates exactes dépendent du jour où vous nous donnez les accès. {COMMITMENT_MONTHS} mois minimum : le premier sert surtout à tout mettre en
          place, les effets se mesurent ensuite.
        </p>
        <ol className="mt-6 space-y-4">
          {steps.map((s, i) => (
            <li key={s.title} className="grid gap-3 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)] md:grid-cols-[11rem_minmax(0,1fr)_minmax(0,1fr)] md:gap-6">
              <div>
                <p className="text-[0.82rem] font-semibold uppercase tracking-wide text-muted">{s.when}</p>
                <p className="mt-1 font-display text-[1.05rem] font-bold">
                  {i + 1}. {s.title}
                </p>
              </div>
              <div>
                <p className="text-[0.82rem] font-semibold text-primary">Ce que nous faisons</p>
                <p className="mt-1 text-[0.95rem] text-ink/85">{s.us}</p>
              </div>
              <div>
                <p className="text-[0.82rem] font-semibold text-success-ink">Ce que vous validez</p>
                <p className="mt-1 text-[0.95rem] text-ink/85">{s.you}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
          <h3 className="text-[1.15rem] font-bold">Chaque mois, l&apos;offre comprend</h3>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            {features.map((f) => (
              <li key={f} className="flex gap-2.5">
                <CheckIcon className="mt-0.5 text-primary" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.85rem] text-muted">Liste contractuelle, reprise des conditions générales de vente.</p>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
          <h3 className="text-[1.15rem] font-bold">Vous validez toujours</h3>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            {YOU_VALIDATE.map((f) => (
              <li key={f} className="flex gap-2.5">
                <CheckIcon className="mt-0.5 text-success" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
          <h3 className="text-[1.15rem] font-bold">Nous ne faisons jamais</h3>
          <ul className="mt-3 space-y-2 text-[0.95rem]">
            {WE_NEVER.map((f) => (
              <li key={f} className="flex gap-2.5">
                <CrossIcon className="mt-0.5 text-danger-ink" />
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.88rem] text-ink/75">
            Repéré est jeune : nous n&apos;affichons ni témoignage ni logo tant que de vrais clients ne nous ont pas donné leur accord écrit. Ce que vous
            pouvez vérifier, ce sont les livrables ci-dessus et{" "}
            <Link href="/methode" className="font-semibold text-primary underline underline-offset-4">
              la méthode
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

export default AccompagneProof;
