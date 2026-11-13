"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { CONTACT_SUBJECTS, contactMailto, leadPayload, validateContact, type ContactErrors, type ContactFields, type ContactSubject } from "./contact";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent" } | { kind: "fallback"; mailto: string };

/**
 * Formulaire de contact : POST /api/leads (source 'contact'). Si l'envoi échoue (route indisponible ou refus),
 * on propose le même message prêt à partir par e-mail : la demande n'est jamais perdue.
 */
export function ContactForm({ email, initialSubject = "question" }: { email: string; initialSubject?: ContactSubject }) {
  const id = useId();
  const [f, setF] = useState<ContactFields>({ name: "", email: "", company: "", subject: initialSubject, message: "" });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });
  const hp = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);

  const set = <K extends keyof ContactFields>(k: K, v: ContactFields[K]) => setF((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateContact(f);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...leadPayload(f), hp: hp.current?.value ?? "" }),
      });
      if (res.ok) {
        setState({ kind: "sent" });
        return;
      }
      throw new Error(String(res.status));
    } catch {
      setState({ kind: "fallback", mailto: contactMailto(email, f) });
    }
  }

  if (state.kind === "sent") {
    return (
      <div role="status" className="rounded-2xl bg-success-bg p-6 text-success-ink">
        <p className="font-display text-xl font-bold">Message envoyé.</p>
        <p className="mt-2">Nous vous répondons sous 48 heures ouvrées, à l&apos;adresse {f.email}.</p>
      </div>
    );
  }

  const input = "mt-1.5 block w-full rounded-xl border bg-white px-3.5 py-3 text-[1rem] focus:border-primary";
  const errIds = Object.keys(errors) as (keyof ContactFields)[];

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby={`${id}-req`}>
      <p id={`${id}-req`} className="text-[0.9rem] text-muted">
        Tous les champs sont obligatoires, sauf l&apos;entreprise.
      </p>
      {errIds.length ? (
        <div ref={summary} tabIndex={-1} role="alert" className="rounded-xl bg-danger-bg p-4 text-danger-ink">
          <p className="font-semibold">Corrigez {errIds.length === 1 ? "ce point" : "ces points"} :</p>
          <ul className="mt-1 list-disc pl-5">
            {errIds.map((k) => (
              <li key={k}>
                <a href={`#${id}-${k}`} className="underline">
                  {errors[k]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="font-semibold">Votre nom</label>
          <input id={`${id}-name`} autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-err` : undefined} className={`${input} ${errors.name ? "border-danger" : "border-line"}`} />
          {errors.name ? <p id={`${id}-name-err`} className="mt-1 text-[0.9rem] text-danger">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor={`${id}-email`} className="font-semibold">Votre e-mail</label>
          <input id={`${id}-email`} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-err` : undefined} className={`${input} ${errors.email ? "border-danger" : "border-line"}`} />
          {errors.email ? <p id={`${id}-email-err`} className="mt-1 text-[0.9rem] text-danger">{errors.email}</p> : null}
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-company`} className="font-semibold">Entreprise <span className="font-normal text-muted">(facultatif)</span></label>
        <input id={`${id}-company`} autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} className={`${input} border-line`} />
      </div>
      <div>
        <label htmlFor={`${id}-subject`} className="font-semibold">Sujet</label>
        <select id={`${id}-subject`} value={f.subject} onChange={(e) => set("subject", e.target.value as ContactSubject)} className={`${input} border-line`}>
          {CONTACT_SUBJECTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${id}-message`} className="font-semibold">Votre message</label>
        <textarea id={`${id}-message`} rows={6} value={f.message} onChange={(e) => set("message", e.target.value)} aria-invalid={!!errors.message} aria-describedby={errors.message ? `${id}-message-err` : undefined} className={`${input} ${errors.message ? "border-danger" : "border-line"}`} />
        {errors.message ? <p id={`${id}-message-err`} className="mt-1 text-[0.9rem] text-danger">{errors.message}</p> : null}
      </div>
      {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Ne pas remplir
          <input ref={hp} tabIndex={-1} autoComplete="off" name="site_web" />
        </label>
      </div>

      {state.kind === "fallback" ? (
        <div role="alert" className="rounded-xl bg-warning-bg p-4 text-warning-ink">
          <p className="font-semibold">Le formulaire n&apos;a pas pu envoyer votre message.</p>
          <p className="mt-1">
            Il est prêt dans votre messagerie :{" "}
            <a href={state.mailto} className="font-semibold underline">
              envoyer le message à {email}
            </a>
            .
          </p>
        </div>
      ) : null}

      <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}>
        {state.kind === "sending" ? "Envoi en cours…" : "Envoyer le message"}
      </button>
      <p className="text-[0.85rem] text-muted">
        Votre message sert uniquement à vous répondre. Détails dans notre politique de confidentialité.
      </p>
    </form>
  );
}

export default ContactForm;
