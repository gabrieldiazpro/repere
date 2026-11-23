"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { FAMILIES, PARTNER_FAMILIES, type PartnerFamily } from "@/lib/partners/program";
import { AUDIENCE_SIZES, EMPTY_PARTNER, MESSAGE_MAX, validatePartner, type PartnerErrors, type PartnerFields } from "@/lib/partners/validate";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; duplicate: boolean } | { kind: "error"; message: string };

/**
 * Candidature au programme partenaires : POST /partenaires/candidature. Champ piège, consentement obligatoire,
 * validation identique côté serveur ; si l'envoi échoue, l'adresse e-mail de secours est proposée.
 */
export function PartnerForm({ email, consentText, listOkText, defaultFamily }: { email: string; consentText: string; listOkText: string; defaultFamily?: PartnerFamily }) {
  const id = useId();
  const [f, setF] = useState<PartnerFields>({ ...EMPTY_PARTNER, family: defaultFamily ?? "" });
  const [errors, setErrors] = useState<PartnerErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });
  const hp = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  const set = <K extends keyof PartnerFields>(k: K, v: PartnerFields[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validatePartner(f);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/partenaires/candidature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, hp: hp.current?.value ?? "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { duplicate?: boolean; error?: string; errors?: PartnerErrors };
      if (res.ok) {
        setState({ kind: "sent", duplicate: data.duplicate === true });
        requestAnimationFrame(() => done.current?.focus());
        return;
      }
      if (res.status === 400 && data.errors) {
        setErrors(data.errors);
        setState({ kind: "idle" });
        requestAnimationFrame(() => summary.current?.focus());
        return;
      }
      setState({ kind: "error", message: data.error || "L'envoi n'a pas abouti." });
    } catch {
      setState({ kind: "error", message: "L'envoi n'a pas abouti : la connexion a été interrompue." });
    }
  }

  if (state.kind === "sent") {
    return (
      <div ref={done} tabIndex={-1} role="status" className="rounded-2xl bg-success-bg p-6 text-success-ink outline-none">
        <p className="font-display text-xl font-bold">{state.duplicate ? "Votre candidature est déjà enregistrée." : "Candidature envoyée."}</p>
        <p className="mt-2">
          Le fondateur la lit personnellement et vous répond sous 5 jours ouvrés, à l&apos;adresse {f.email}. En attendant, la{" "}
          <Link href="/demo" className="font-semibold underline">démo</Link> montre l&apos;application avec des données d&apos;exemple.
        </p>
      </div>
    );
  }

  const input = "mt-1.5 block w-full rounded-xl border bg-white px-3.5 py-3 text-[1rem] focus:border-primary";
  const errIds = Object.keys(errors) as (keyof PartnerFields)[];
  const field = (k: keyof PartnerFields) => ({
    id: `${id}-${k}`,
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${id}-${k}-err` : undefined,
    className: `${input} ${errors[k] ? "border-danger" : "border-line"}`,
  });
  const err = (k: keyof PartnerFields) => (errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-[0.9rem] text-danger">{errors[k]}</p> : null);
  const label = (k: keyof PartnerFields, text: ReactNode) => (
    <label htmlFor={`${id}-${k}`} className="font-semibold">
      {text}
    </label>
  );
  const optional = <span className="font-normal text-muted">(facultatif)</span>;

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby={`${id}-req`}>
      <p id={`${id}-req`} className="text-[0.9rem] text-muted">
        Trois minutes suffisent. Les champs sans mention « facultatif » sont obligatoires.
      </p>
      {errIds.length ? (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-xl bg-danger-bg p-4 text-danger-ink">
          <p className="font-semibold">Corrigez {errIds.length === 1 ? "ce point" : "ces points"} :</p>
          <ul className="mt-1 list-disc pl-5">
            {errIds.map((k) => (
              <li key={k}>
                <a href={`#${id}-${k}`} className="underline">{errors[k]}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <fieldset>
        <legend className="font-semibold">Vous êtes</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {PARTNER_FAMILIES.map((fam, i) => (
            <label key={fam} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 ${f.family === fam ? "border-primary bg-primary-bg" : errors.family ? "border-danger" : "border-line"}`}>
              <input type="radio" name={`${id}-family`} id={i === 0 ? `${id}-family` : undefined} value={fam} checked={f.family === fam} onChange={() => set("family", fam)} className="h-4 w-4 accent-[var(--color-primary)]" />
              <span>{FAMILIES[fam].label}</span>
            </label>
          ))}
        </div>
        {err("family")}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label("company", "Nom de votre structure")}
          <input autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} {...field("company")} />
          {err("company")}
        </div>
        <div>
          {label("website", "Adresse du site")}
          <input inputMode="url" autoComplete="url" placeholder="www.exemple.fr" value={f.website} onChange={(e) => set("website", e.target.value)} {...field("website")} />
          {err("website")}
        </div>
        <div>
          {label("city", <>Ville {optional}</>)}
          <input autoComplete="address-level2" value={f.city} onChange={(e) => set("city", e.target.value)} {...field("city")} />
          {err("city")}
        </div>
        <div>
          {label("audience", <>Clients, adhérents ou élèves concernés {optional}</>)}
          <select value={f.audience} onChange={(e) => set("audience", e.target.value as PartnerFields["audience"])} {...field("audience")}>
            <option value="">Je ne sais pas encore</option>
            {AUDIENCE_SIZES.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {err("audience")}
        </div>
        <div>
          {label("name", "Votre nom")}
          <input autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} {...field("name")} />
          {err("name")}
        </div>
        <div>
          {label("email", "Votre e-mail")}
          <input type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} {...field("email")} />
          {err("email")}
        </div>
        <div className="sm:col-span-2">
          {label("role", <>Votre fonction {optional}</>)}
          <input autoComplete="organization-title" placeholder="Fondatrice, chargé de mission numérique…" value={f.role} onChange={(e) => set("role", e.target.value)} {...field("role")} />
          {err("role")}
        </div>
      </div>

      <div>
        {label("message", "Comment imaginez-vous le partenariat ?")}
        <p className="text-[0.9rem] text-muted">Par exemple : « nous refaisons 15 sites par an pour des artisans », « nos adhérents nous demandent comment apparaître dans ChatGPT ».</p>
        <textarea rows={5} maxLength={MESSAGE_MAX + 200} value={f.message} onChange={(e) => set("message", e.target.value)} {...field("message")} />
        {err("message")}
      </div>

      <div className="space-y-3 rounded-xl bg-canvas p-4">
        <label className="flex cursor-pointer gap-3">
          <input type="checkbox" checked={f.listOk} onChange={(e) => set("listOk", e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
          <span>{listOkText}</span>
        </label>
        <label className="flex cursor-pointer gap-3" htmlFor={`${id}-consent`}>
          <input id={`${id}-consent`} type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${id}-consent-err` : undefined} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
          <span>{consentText}</span>
        </label>
        {err("consent")}
      </div>

      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir
          <input ref={hp} tabIndex={-1} autoComplete="off" name="site_web_2" />
        </label>
      </div>

      {state.kind === "error" ? (
        <div role="alert" className="rounded-xl bg-warning-bg p-4 text-warning-ink">
          <p className="font-semibold">{state.message}</p>
          <p className="mt-1">
            Réessayez dans un instant, ou écrivez directement à{" "}
            <a href={`mailto:${email}?subject=${encodeURIComponent("Candidature partenaire")}`} className="font-semibold underline">{email}</a>.
          </p>
        </div>
      ) : null}

      <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}>
        {state.kind === "sending" ? "Envoi en cours…" : "Envoyer ma candidature"}
      </button>
      <p className="text-[0.85rem] text-muted">
        Vos informations servent uniquement à étudier votre candidature. Détails dans notre <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>
    </form>
  );
}

export default PartnerForm;
