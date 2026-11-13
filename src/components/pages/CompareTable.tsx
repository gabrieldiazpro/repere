/** Tableau Découverte / Essentiel / Accompagné pour un parcours (serveur, sans JavaScript). */
import Link from "next/link";
import { CheckIcon, CrossIcon } from "@/components/site/blocks";
import { euros, tiersFor } from "@/components/site/plans-v2";
import { SEG_NAMES, compareRows, type Cell, type Seg } from "./pricing-data";

function Value({ v }: { v: Cell }) {
  if (v === true)
    return (
      <span className="inline-flex items-center gap-1.5">
        <CheckIcon className="text-success" />
        <span className="sr-only">Inclus</span>
      </span>
    );
  if (v === false)
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <CrossIcon className="text-muted" />
        <span className="sr-only">Non inclus</span>
      </span>
    );
  return <>{v}</>;
}

export function CompareTable({ segment }: { segment: Seg }) {
  const t = tiersFor(segment);
  const rows = compareRows(segment);
  const cols = [
    { key: "decouverte" as const, name: "Découverte", price: "0 €", href: `/inscription?parcours=${segment}`, cta: "Créer mon compte" },
    {
      key: "essentiel" as const,
      name: "Essentiel",
      price: t.essentielMonth ? `${euros(t.essentielMonth.priceCents)}/mois` : "–",
      href: t.essentielMonth ? `/audit?segment=${segment}&plan=${t.essentielMonth.id}` : "/tarifs",
      cta: "Choisir Essentiel",
    },
    {
      key: "accompagne" as const,
      name: "Accompagné",
      price: t.accompagne ? `${euros(t.accompagne.priceCents)}/mois` : "–",
      href: t.accompagne ? `/audit?segment=${segment}&plan=${t.accompagne.id}` : "/tarifs",
      cta: "Être accompagné",
    },
  ];

  return (
    <div>
      <nav aria-label="Parcours du tableau" className="mb-5 flex flex-wrap items-center gap-2 text-[0.92rem]">
        <span className="text-muted">Parcours :</span>
        {(Object.keys(SEG_NAMES) as Seg[]).map((s) => (
          <Link
            key={s}
            href={`/tarifs?segment=${s}#comparer`}
            aria-current={s === segment ? "true" : undefined}
            className={`inline-flex min-h-10 items-center rounded-full px-3.5 font-semibold ${s === segment ? "bg-ink text-white" : "bg-canvas text-ink/80 hover:text-primary"}`}
          >
            {SEG_NAMES[s]}
          </Link>
        ))}
      </nav>
      <div className="relative overflow-x-auto rounded-2xl shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
        <table className="w-full min-w-[40rem] border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">Comparaison des offres Découverte, Essentiel et Accompagné, parcours {SEG_NAMES[segment]}</caption>
          <thead>
            <tr className="bg-canvas align-bottom">
              <td className="w-[26%] px-4 py-4" />
              {cols.map((c) => (
                <th key={c.key} scope="col" className={`px-4 py-4 ${c.key === "accompagne" ? "bg-primary text-white" : ""}`}>
                  <span className="block font-display text-lg font-bold">{c.name}</span>
                  <span className={`tabular block text-[0.92rem] font-medium ${c.key === "accompagne" ? "text-on-deep" : "text-muted"}`}>{c.price}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-line/70 align-top">
                <th scope="row" className="sticky left-0 bg-white px-4 py-3 font-semibold">
                  {r.label}
                </th>
                <td className="px-4 py-3">
                  <Value v={r.decouverte} />
                </td>
                <td className="px-4 py-3">
                  <Value v={r.essentiel} />
                </td>
                <td className="bg-primary-bg/60 px-4 py-3">
                  <Value v={r.accompagne} />
                </td>
              </tr>
            ))}
            <tr className="border-t border-line/70">
              <td className="sticky left-0 bg-white px-4 py-4" />
              {cols.map((c) => (
                <td key={c.key} className={`px-4 py-4 ${c.key === "accompagne" ? "bg-primary-bg/60" : ""}`}>
                  <Link href={c.href} className="font-semibold text-primary underline underline-offset-4 hover:no-underline">
                    {c.cta}
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.88rem] text-muted lg:hidden">Faites défiler le tableau horizontalement.</p>
    </div>
  );
}

export default CompareTable;
