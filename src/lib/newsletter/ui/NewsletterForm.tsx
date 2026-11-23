"use client";

import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "ok" } | { kind: "error"; text: string };

export type NewsletterSource = "site" | "veille" | "guide" | "ressource" | "autre";

/** Texte de la case (identique à CONSENT_TEXT côté serveur, conservé avec l'inscription). */
export const NEWSLETTER_CONSENT_TEXT =
  "J'accepte de recevoir la lettre mensuelle de Repéré (veille Google et IA, une fois par mois). Je peux me désinscrire en un clic à tout moment.";

/**
 * Formulaire d'inscription à la lettre mensuelle, réutilisable (site, veille, guides) :
 *   import { NewsletterForm } from "@/lib/newsletter/ui/NewsletterForm";
 *   <NewsletterForm source="guide" />
 * Consentement explicite (case non cochée), double opt-in (e-mail de confirmation), POST /api/newsletter/subscribe.
 */
export function NewsletterForm({
  source = "site",
  title = "La lettre mensuelle de veille",
  text = "Une fois par mois : ce qui a changé sur Google et dans les IA, daté, sourcé, et ce qu'il faut faire. Pas de publicité.",
  compact = false,
  stacked = false,
  dark = false,
}: {
  source?: NewsletterSource;
  title?: string | null;
  text?: string | null;
  compact?: boolean;
  /** Champ et bouton l'un sous l'autre (colonnes étroites). */
  stacked?: boolean;
  /** Sur fond sombre (pied de page) : textes clairs. */
  dark?: boolean;
}) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setState({ kind: "error", text: "Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr." });
      return;
    }
    if (!consent) {
      setState({ kind: "error", text: "Cochez la case pour confirmer que vous voulez recevoir la lettre." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), consent: true, source, page: window.location.pathname, hp }),
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

  return (
    <section aria-labelledby={title ? `${id}-t` : undefined} className={compact ? "" : "rounded-2xl bg-primary-bg p-5 sm:p-6"}>
      {title ? (
        <h2 id={`${id}-t`} className="text-xl font-semibold text-ink">
          {title}
        </h2>
      ) : null}
      {text ? <p className="mt-1 max-w-prose text-[0.97rem] text-muted">{text}</p> : null}
      {state.kind === "ok" ? (
        <p role="status" className="mt-4 rounded-xl bg-white p-4 text-[0.97rem] font-medium text-ink ring-1 ring-line">
          Presque fini : nous venons de vous envoyer un e-mail. Cliquez sur le lien qu&apos;il contient pour confirmer
          votre inscription. Sans ce clic, vous ne recevrez rien.
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-3">
          <div className={`flex flex-col gap-3 ${stacked ? "" : "sm:flex-row"}`}>
            <label htmlFor={`${id}-email`} className="sr-only">
              Votre e-mail
            </label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="vous@exemple.fr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={200}
              aria-invalid={state.kind === "error"}
              aria-describedby={state.kind === "error" ? `${id}-error` : undefined}
              className="min-h-12 w-full min-w-0 flex-1 rounded-xl border border-line bg-white px-4 text-base text-ink"
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
            <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "md", variant: dark ? "light" : "primary", className: "shrink-0" })}>
              {state.kind === "sending" ? "Inscription…" : "M'inscrire"}
            </button>
          </div>
          <label className={`flex items-start gap-3 text-sm ${dark ? "text-on-deep" : "text-ink"}`}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]"
            />
            <span>{NEWSLETTER_CONSENT_TEXT}</span>
          </label>
          {state.kind === "error" ? (
            <p id={`${id}-error`} role="alert" className={`text-sm font-medium ${dark ? "rounded-lg bg-white px-3 py-2 text-danger-ink" : "text-danger-ink"}`}>
              {state.text}
            </p>
          ) : (
            <p className={`text-xs ${dark ? "text-on-deep" : "text-muted"}`}>
              Votre adresse sert uniquement à envoyer la lettre. Aucun pixel de suivi d&apos;ouverture.{" "}
              <a href="/confidentialite" className="underline underline-offset-2">
                Confidentialité
              </a>
            </p>
          )}
        </form>
      )}
    </section>
  );
}
