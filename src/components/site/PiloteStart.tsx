"use client";

/**
 * Parcours 100 % sans contact (V10, PILOTE-AUTO) : activité → plateforme du site → ce que le pilote fera seul ou non,
 * DIT AVANT LE PAIEMENT → déclaration professionnelle → paiement Stripe en libre-service. Aucun appel, aucun rendez-vous.
 * Site non connectable : pas de paiement du pilote, Essentiel proposé à la place (même travail, fichiers à déposer).
 */
import Link from "next/link";
import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CheckIcon } from "./blocks";
import { PLATFORM_FITS, platformFit, type PlatformId } from "./pilote-data";
import { currentAttribution } from "@/lib/roi/landing";
import { partnerCodeOf } from "@/lib/roi/core";

type Seg = "local" | "pme" | "ecommerce";
export interface PiloteOffer {
  segment: Seg;
  planId: string;
  price: string;
  essentielId: string;
  essentielPrice: string;
}

const SEG_LABEL: Record<Seg, string> = { local: "Commerce local", pme: "PME et services B2B", ecommerce: "E-commerce" };

export function PiloteStart({ offers, initial }: { offers: PiloteOffer[]; initial: Seg }) {
  const [seg, setSeg] = useState<Seg>(initial);
  const [platform, setPlatform] = useState<PlatformId | "">("");
  const [pro, setPro] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offer = offers.find((o) => o.segment === seg) ?? offers[0];
  const fit = platformFit(platform);

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: offer.planId, pro: true, email: email.trim() || undefined, ref: partnerCodeOf(currentAttribution()) ?? undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || "Le paiement n'a pas pu démarrer.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le paiement n'a pas pu démarrer.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-8">
      <ol className="space-y-8">
        <li>
          <h3 className="font-display text-lg font-bold">1. Votre activité</h3>
          <div role="radiogroup" aria-label="Votre activité" className="mt-3 grid gap-2 sm:grid-cols-3">
            {offers.map((o) => (
              <label
                key={o.segment}
                className={`flex min-h-12 cursor-pointer flex-col justify-center rounded-xl px-4 py-2 ring-1 ring-inset transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${seg === o.segment ? "bg-primary-bg ring-primary" : "ring-line hover:ring-primary/50"}`}
              >
                <input type="radio" name="pilote-seg" value={o.segment} checked={seg === o.segment} onChange={() => setSeg(o.segment)} className="sr-only" />
                <span className="font-semibold">{SEG_LABEL[o.segment]}</span>
                <span className="tabular text-[0.92rem] text-muted">{o.price}/mois, sans engagement</span>
              </label>
            ))}
          </div>
        </li>
        <li>
          <h3 className="font-display text-lg font-bold">2. Votre site est fait avec…</h3>
          <label htmlFor="pilote-platform" className="sr-only">
            Plateforme de votre site
          </label>
          <select
            id="pilote-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value as PlatformId)}
            className="mt-3 min-h-12 w-full rounded-xl bg-white px-3 text-[1rem] ring-1 ring-inset ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <option value="">Choisissez votre plateforme</option>
            {PLATFORM_FITS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          {fit ? (
            <div aria-live="polite" className={`mt-4 rounded-xl p-4 ${fit.connectable ? "bg-canvas" : "bg-warning-bg"}`}>
              <p className="font-semibold">{fit.connectable ? "Votre site se connecte : voici ce que le pilote fera seul." : "Votre site ne se connecte pas : le pilote ne peut rien appliquer seul."}</p>
              <p className="mt-1 text-[0.95rem] text-ink/80">{fit.how}</p>
              {fit.auto.length ? (
                <ul className="mt-3 space-y-1.5 text-[0.95rem]">
                  {fit.auto.map((a) => (
                    <li key={a} className="flex gap-2">
                      <CheckIcon className="mt-0.5 shrink-0 text-success-ink" />
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="mt-2 space-y-1.5 text-[0.95rem] text-ink/80">
                {fit.email.map((a) => (
                  <li key={a} className="flex gap-2">
                    <span aria-hidden="true" className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
              {!fit.connectable ? (
                <p className="mt-3 text-[0.95rem]">
                  Nous ne vous vendrons pas le pilote automatique pour ce site. L&apos;offre{" "}
                  <Link href={`/tarifs?segment=${seg}#${offer.essentielId}`} className="font-semibold text-primary underline underline-offset-4">
                    Essentiel ({offer.essentielPrice}/mois)
                  </Link>{" "}
                  vous donne les mêmes corrections, prêtes à déposer. Votre prestataire peut aussi nous écrire pour connecter le site.
                </p>
              ) : null}
            </div>
          ) : null}
        </li>
        <li>
          <h3 className="font-display text-lg font-bold">3. Paiement en ligne, sans appel</h3>
          <label htmlFor="pilote-email" className="mt-3 block text-[0.95rem] font-semibold">
            Votre e-mail professionnel <span className="font-normal text-muted">(facultatif ici, demandé par Stripe sinon)</span>
          </label>
          <input
            id="pilote-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1.5 min-h-12 w-full rounded-xl bg-white px-3 text-[1rem] ring-1 ring-inset ring-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          />
          <label className="mt-4 flex cursor-pointer gap-3 text-[0.95rem]">
            <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
            <span>Je déclare agir pour les besoins de mon activité professionnelle (Repéré est réservé aux professionnels, CGV article 4).</span>
          </label>
          <button
            type="button"
            onClick={pay}
            disabled={busy || !pro || !fit || !fit.connectable}
            className={buttonClasses({ size: "lg", className: "mt-5 w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto" })}
          >
            {busy ? "Ouverture du paiement…" : `Payer ${offer.price}/mois et démarrer`}
          </button>
          {!fit ? <p className="mt-2 text-[0.9rem] text-muted">Choisissez d&apos;abord votre plateforme : nous vous disons avant de payer ce qui sera fait.</p> : null}
          {error ? (
            <p role="alert" className="mt-2 text-[0.95rem] text-danger-ink">
              {error}
            </p>
          ) : null}
          <p className="mt-3 text-[0.9rem] text-muted">
            Après le paiement : connexion du site avec l&apos;assistant, fiche officielle pré-remplie à confirmer en un écran, puis le mandat à signer. Le
            mandat est affiché en entier avant signature et se révoque en un clic. Résiliation en un clic, sans engagement.
          </p>
        </li>
      </ol>
    </div>
  );
}
