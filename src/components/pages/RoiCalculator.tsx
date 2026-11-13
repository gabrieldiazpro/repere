"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ROI_DEFAULTS, ROI_LIMITS, computeRoi, eur, sanitize } from "./roi";

type Seg = "local" | "pme" | "ecommerce";
export type RoiPrices = Record<Seg, { essentiel: number | null; accompagne: number | null }>;

const SEG_LABEL: Record<Seg, string> = { local: "Commerce local", pme: "PME et services", ecommerce: "E-commerce" };

/**
 * Calculateur de rentabilité : hypothèses modifiables, résultat recalculé à chaque saisie.
 * Aucune promesse : on compare le coût à VOTRE hypothèse, et on affiche le seuil de rentabilité.
 */
export function RoiCalculator({ prices, initial }: { prices: RoiPrices; initial: Seg }) {
  const id = useId();
  const [seg, setSeg] = useState<Seg>(initial);
  const [plan, setPlan] = useState<"essentiel" | "accompagne">("accompagne");
  const [value, setValue] = useState<string>(String(ROI_DEFAULTS[initial].clientValue));
  const [clients, setClients] = useState<string>(String(ROI_DEFAULTS[initial].clientsPerMonth));

  const price = prices[seg][plan] ?? 0;
  const r = useMemo(
    () => computeRoi({ clientValue: sanitize(value, 0, ROI_LIMITS.clientValue.max), clientsPerMonth: sanitize(clients, 0, ROI_LIMITS.clientsPerMonth.max), monthlyPriceCents: price }),
    [value, clients, price],
  );
  const fill = r.yearlyCost > 0 ? Math.min(100, (r.yearlyValue / r.yearlyCost) * 100) : 0;

  function changeSeg(s: Seg) {
    setSeg(s);
    setValue(String(ROI_DEFAULTS[s].clientValue));
    setClients(String(ROI_DEFAULTS[s].clientsPerMonth));
  }

  const field = "mt-1.5 block w-full rounded-xl border border-line bg-white px-3.5 py-3 text-lg tabular focus:border-primary";

  return (
    <div className="grid gap-8 rounded-[1.5rem] bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.08),0_24px_48px_-28px_rgba(30,26,92,.35)] sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <form onSubmit={(e) => e.preventDefault()} aria-describedby={`${id}-note`}>
        <fieldset>
          <legend className="font-semibold">Votre activité</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(Object.keys(SEG_LABEL) as Seg[]).map((s) => (
              <label key={s} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-[0.92rem] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${seg === s ? "bg-primary text-white" : "bg-canvas text-ink/80"}`}>
                <input type="radio" name={`${id}-seg`} className="sr-only" checked={seg === s} onChange={() => changeSeg(s)} />
                {SEG_LABEL[s]}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="mt-5">
          <legend className="font-semibold">Offre</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(["essentiel", "accompagne"] as const).map((p) => (
              <label key={p} className={`inline-flex min-h-10 cursor-pointer items-center rounded-lg px-3 text-[0.92rem] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${plan === p ? "bg-ink text-white" : "bg-canvas text-ink/80"}`}>
                <input type="radio" name={`${id}-plan`} className="sr-only" checked={plan === p} onChange={() => setPlan(p)} />
                {p === "essentiel" ? "Essentiel" : "Accompagné"}
                {prices[seg][p] ? <span className="ml-1.5 font-medium opacity-80">{eur((prices[seg][p] ?? 0) / 100)}/mois</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-5">
          <label htmlFor={`${id}-value`} className="font-semibold">
            Ce que vous rapporte un client (€)
          </label>
          <p id={`${id}-value-hint`} className="text-[0.88rem] text-muted">
            Votre chiffre : {ROI_DEFAULTS[seg].hint}.
          </p>
          <input
            id={`${id}-value`}
            inputMode="decimal"
            type="number"
            min={0}
            max={ROI_LIMITS.clientValue.max}
            step="any"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-describedby={`${id}-value-hint`}
            className={field}
          />
        </div>
        <div className="mt-5">
          <label htmlFor={`${id}-clients`} className="font-semibold">
            Clients de plus par mois venus des IA (votre hypothèse)
          </label>
          <input
            id={`${id}-clients`}
            inputMode="decimal"
            type="number"
            min={0}
            max={ROI_LIMITS.clientsPerMonth.max}
            step="any"
            value={clients}
            onChange={(e) => setClients(e.target.value)}
            className={field}
          />
        </div>
      </form>

      <div className="flex flex-col">
        <div aria-live="polite" className="rounded-2xl bg-canvas p-5 sm:p-6">
          <p className="text-[0.95rem] text-ink/80">Pour couvrir {plan === "essentiel" ? "Essentiel" : "Accompagné"} sur un an, il suffit de</p>
          <p className="mt-1 font-display text-[2.4rem] font-bold leading-none tabular">
            {r.breakEvenClientsPerYear === null ? "–" : r.breakEvenClientsPerYear}
            <span className="ml-2 text-lg font-semibold">
              {r.breakEvenClientsPerYear === 1 ? "client de plus par an" : "clients de plus par an"}
            </span>
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-[0.95rem]">
            <div className="flex flex-col justify-between">
              <dt className="text-muted">Coût sur 12 mois</dt>
              <dd className="tabular font-semibold">{eur(r.yearlyCost)}</dd>
            </div>
            <div className="flex flex-col justify-between">
              <dt className="text-muted">Votre hypothèse sur 12 mois</dt>
              <dd className="tabular font-semibold">{eur(r.yearlyValue)}</dd>
            </div>
          </dl>
          <div className="mt-4" aria-hidden="true">
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--dur-base,240ms)]" style={{ width: `${fill}%` }} />
            </div>
          </div>
          <p className="mt-3 text-[0.95rem]">
            {r.yearlyCost === 0
              ? "Choisissez une offre."
              : r.balance >= 0
                ? `Avec votre hypothèse, l'offre est couverte${r.ratio ? ` ${String(r.ratio).replace(".", ",")} fois` : ""}.`
                : `Avec votre hypothèse, il manque ${eur(-r.balance)} sur l'année pour couvrir l'offre.`}
          </p>
        </div>
        <p id={`${id}-note`} className="mt-4 text-[0.88rem] text-muted">
          Ce calcul ne prédit rien : il compare le prix à vos propres chiffres. Personne ne peut garantir qu&apos;une IA vous
          enverra des clients. Formule : seuil = prix sur 12 mois ÷ valeur d&apos;un client, arrondi au-dessus.{" "}
          <Link href="/methode" className="font-semibold text-primary underline underline-offset-4">
            Notre méthode de mesure
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

export default RoiCalculator;
