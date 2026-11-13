"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/Button";

type Interest = "pro" | "agency";
type State = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "error"; text: string };

/**
 * Liste d'attente (qa/ARBITRAGES.md n° 3) : POST /api/leads, source « waitlist ».
 * V2 : `fixedInterest` masque le choix (ex. page Tarifs, onglet Agences → « agency »).
 */
export function WaitlistForm({
  fixedInterest,
  submitLabel = "Rejoindre la liste d’attente",
  idPrefix = "waitlist",
}: {
  fixedInterest?: Interest;
  submitLabel?: string;
  idPrefix?: string;
} = {}) {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState<Interest>(fixedInterest ?? "pro");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setState({ kind: "error", text: "Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "waitlist", interest, consent: false, hp }),
      });
      if (res.ok) {
        setState({ kind: "ok" });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: "error", text: data?.error ?? "Inscription impossible pour le moment. Réessayez dans quelques minutes." });
    } catch {
      setState({ kind: "error", text: "Inscription impossible pour le moment. Réessayez dans quelques minutes." });
    }
  }

  if (state.kind === "ok") {
    return (
      <p role="status" className="rounded-xl bg-white p-4 text-[0.97rem] font-medium ring-1 ring-line">
        C&apos;est noté. Nous vous écrirons une seule fois, à l&apos;ouverture de l&apos;offre. Votre adresse ne sert à rien d&apos;autre.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {fixedInterest ? null : (
      <fieldset>
        <legend className="text-[0.95rem] font-semibold">Offre qui vous intéresse</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {(
            [
              ["pro", "Pro (plusieurs établissements)"],
              ["agency", "Agence (marque blanche)"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 ring-1 ring-line">
              <input type="radio" name="interest" value={v} checked={interest === v} onChange={() => setInterest(v)} />
              <span className="text-[0.95rem]">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor={`${idPrefix}-email`} className="sr-only">
          Votre e-mail
        </label>
        <input
          id={`${idPrefix}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="vous@exemple.fr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          aria-invalid={state.kind === "error"}
          aria-describedby={state.kind === "error" ? `${idPrefix}-error` : `${idPrefix}-help`}
          className="min-h-12 w-full flex-1 rounded-xl border border-line bg-white px-4 text-base"
        />
        <input
          type="text"
          name="website_hp"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
        <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "md", className: "shrink-0" })}>
          {state.kind === "sending" ? "Inscription…" : submitLabel}
        </button>
      </div>
      {state.kind === "error" ? (
        <p id={`${idPrefix}-error`} role="alert" className="text-sm font-medium text-danger-ink">
          {state.text}
        </p>
      ) : (
        <p id={`${idPrefix}-help`} className="text-sm text-muted">
          Un seul e-mail, à l&apos;ouverture de l&apos;offre. Aucun paiement, aucun engagement.
        </p>
      )}
    </form>
  );
}

export default WaitlistForm;
