"use client";

import { useId, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "ok"; newsletter: boolean } | { kind: "error"; text: string };

/**
 * Demande du guide contre e-mail. Deux consentements distincts : l'envoi du guide (obligatoire pour ce service) et
 * la lettre mensuelle (facultative, non cochée, confirmée ensuite par e-mail).
 */
export function GuideRequestForm() {
  const id = useId();
  const [email, setEmail] = useState("");
  const [consentGuide, setConsentGuide] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [hp, setHp] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setState({ kind: "error", text: "Cette adresse e-mail semble incomplète. Vérifiez-la, par exemple vous@exemple.fr." });
      return;
    }
    if (!consentGuide) {
      setState({ kind: "error", text: "Cochez la première case : elle nous autorise à vous envoyer le lien du guide." });
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/newsletter/ressource", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), resource: "guide-2027", consentGuide: true, newsletter, page: window.location.pathname, hp }),
      });
      if (res.ok) {
        setState({ kind: "ok", newsletter });
        return;
      }
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setState({ kind: "error", text: data?.error ?? "Envoi impossible pour le moment. Réessayez dans quelques minutes." });
    } catch {
      setState({ kind: "error", text: "Envoi impossible pour le moment. Réessayez dans quelques minutes." });
    }
  }

  if (state.kind === "ok") {
    return (
      <div role="status" className="rounded-2xl bg-white p-5 ring-1 ring-line">
        <p className="text-lg font-semibold">C&apos;est parti : vérifiez votre boîte de réception.</p>
        <p className="mt-2">
          Le lien vers le guide (lecture en ligne, impression et PDF) vient de partir à {email.trim()}.
          {state.newsletter ? " Le même e-mail contient un lien pour confirmer votre inscription à la lettre : sans ce clic, vous ne la recevrez pas." : ""}
        </p>
        <p className="mt-2 text-sm text-muted">Rien reçu dans cinq minutes ? Regardez dans les indésirables, puis réessayez.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor={`${id}-email`} className="block font-semibold">Votre adresse e-mail professionnelle</label>
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
          className="mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-4 text-base"
        />
        <input type="text" name="website_hp" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={hp} onChange={(e) => setHp(e.target.value)} />
      </div>
      <label className="flex items-start gap-3 text-[0.95rem]">
        <input type="checkbox" checked={consentGuide} onChange={(e) => setConsentGuide(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
        <span>Envoyez-moi le lien du guide par e-mail. <span className="text-muted">(Un seul e-mail, nécessaire pour recevoir le guide.)</span></span>
      </label>
      <label className="flex items-start gap-3 text-[0.95rem]">
        <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--color-primary)]" />
        <span>Je veux aussi recevoir la lettre mensuelle de veille Google et IA. <span className="text-muted">(Facultatif. Confirmation par e-mail, désinscription en un clic.)</span></span>
      </label>
      <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}>
        {state.kind === "sending" ? "Envoi…" : "Recevoir le guide"}
      </button>
      {state.kind === "error" ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger-ink">{state.text}</p>
      ) : (
        <p className="text-xs text-muted">
          Votre adresse sert à vous envoyer le guide et, seulement si vous cochez la seconde case et confirmez, la lettre mensuelle.
          Elle n&apos;est ni vendue ni partagée. <a href="/confidentialite" className="underline underline-offset-2">Confidentialité</a>
        </p>
      )}
    </form>
  );
}
