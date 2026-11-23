"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { currentAttribution } from "@/lib/roi/landing";
import {
  EMPTY_MEETING,
  MAX_SLOTS,
  MEETING_OFFERS,
  NEED_MAX,
  PERIODS,
  SEGMENTS,
  SIZES,
  slotLabel,
  validateMeeting,
  type MeetingErrors,
  type MeetingFields,
  type MeetingOffer,
  type MeetingSegment,
  type Slot,
} from "@/lib/meetings/validate";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; duplicate: boolean } | { kind: "error"; message: string };

/**
 * Demande de démo : POST /rendez-vous/demande. Champ piège, consentement obligatoire, validation identique côté
 * serveur, origine de la visite jointe (sans cookie, src/lib/roi/landing.ts).
 */
export function MeetingForm({
  email,
  consentText,
  bounds,
  defaultOffer,
  defaultSegment,
  bookingUrl,
}: {
  email: string;
  consentText: string;
  bounds: { min: string; max: string };
  defaultOffer?: MeetingOffer;
  defaultSegment?: MeetingSegment;
  bookingUrl?: string | null;
}) {
  const id = useId();
  const [f, setF] = useState<MeetingFields>({ ...EMPTY_MEETING, offer: defaultOffer ?? "", segment: defaultSegment ?? "", slots: [{ date: "", period: "matin" }] });
  const [errors, setErrors] = useState<MeetingErrors>({});
  const [state, setState] = useState<State>({ kind: "idle" });
  const hp = useRef<HTMLInputElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLDivElement>(null);

  const set = <K extends keyof MeetingFields>(k: K, v: MeetingFields[K]) => setF((p) => ({ ...p, [k]: v }));
  const setSlot = (i: number, patch: Partial<Slot>) => setF((p) => ({ ...p, slots: p.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const filled = (fields: MeetingFields): MeetingFields => ({ ...fields, slots: fields.slots.filter((s) => s.date) });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = filled(f);
    const errs = validateMeeting(payload);
    setErrors(errs);
    if (Object.keys(errs).length) {
      requestAnimationFrame(() => summary.current?.focus());
      return;
    }
    setState({ kind: "sending" });
    try {
      const res = await fetch("/rendez-vous/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, attribution: currentAttribution() ?? undefined, hp: hp.current?.value ?? "" }),
      });
      const data = (await res.json().catch(() => ({}))) as { duplicate?: boolean; error?: string; errors?: MeetingErrors };
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
    const slots = filled(f).slots;
    return (
      <div ref={done} tabIndex={-1} role="status" className="rounded-2xl bg-success-bg p-6 text-success-ink outline-none">
        <p className="font-display text-xl font-bold">{state.duplicate ? "Votre demande est déjà enregistrée." : "Demande envoyée."}</p>
        <p className="mt-2">
          Nous revenons vers vous sous 1 jour ouvré, à l&apos;adresse {f.email}, pour confirmer un créneau. Aucun rendez-vous n&apos;est encore fixé.
        </p>
        {slots.length ? <p className="mt-2 text-[0.95rem]">Vos créneaux : {slots.map(slotLabel).join(" ; ")}.</p> : null}
        {bookingUrl ? (
          <p className="mt-3">
            Vous préférez choisir vous-même ?{" "}
            <a href={bookingUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Voir les créneaux libres</a>
          </p>
        ) : null}
      </div>
    );
  }

  const input = "mt-1.5 block w-full rounded-xl border bg-white px-3.5 py-3 text-[1rem] focus:border-primary";
  const errIds = Object.keys(errors) as (keyof MeetingFields)[];
  const field = (k: keyof MeetingFields) => ({
    id: `${id}-${k}`,
    "aria-invalid": !!errors[k],
    "aria-describedby": errors[k] ? `${id}-${k}-err` : undefined,
    className: `${input} ${errors[k] ? "border-danger" : "border-line"}`,
  });
  const err = (k: keyof MeetingFields) => (errors[k] ? <p id={`${id}-${k}-err`} className="mt-1 text-[0.9rem] text-danger">{errors[k]}</p> : null);
  const label = (k: keyof MeetingFields, text: ReactNode) => (
    <label htmlFor={`${id}-${k}`} className="font-semibold">
      {text}
    </label>
  );
  const optional = <span className="font-normal text-muted">(facultatif)</span>;
  const agency = f.offer === "agence";

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5" aria-describedby={`${id}-req`}>
      <p id={`${id}-req`} className="text-[0.9rem] text-muted">Deux minutes. Les champs sans mention « facultatif » sont obligatoires.</p>
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
        <legend className="font-semibold">La démo de l&apos;offre</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {MEETING_OFFERS.map((o, i) => (
            <label key={o.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 ${f.offer === o.id ? "border-primary bg-primary-bg" : errors.offer ? "border-danger" : "border-line"}`}>
              <input type="radio" name={`${id}-offer`} id={i === 0 ? `${id}-offer` : undefined} value={o.id} checked={f.offer === o.id} onChange={() => setF((p) => ({ ...p, offer: o.id, size: "" }))} className="h-4 w-4 accent-[var(--color-primary)]" />
              <span>
                <span className="font-semibold">{o.label}</span> <span className="text-ink/70">{o.who}</span>
              </span>
            </label>
          ))}
        </div>
        {err("offer")}
      </fieldset>

      {f.offer === "accompagne" ? (
        <fieldset>
          <legend className="font-semibold">Votre entreprise</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SEGMENTS.map((s, i) => (
              <label key={s.id} className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 ${f.segment === s.id ? "border-primary bg-primary-bg" : errors.segment ? "border-danger" : "border-line"}`}>
                <input type="radio" name={`${id}-segment`} id={i === 0 ? `${id}-segment` : undefined} value={s.id} checked={f.segment === s.id} onChange={() => set("segment", s.id)} className="h-4 w-4 accent-[var(--color-primary)]" />
                {s.label}
              </label>
            ))}
          </div>
          {err("segment")}
        </fieldset>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          {label("company", agency ? "Nom de l'agence" : "Nom de l'entreprise")}
          <input autoComplete="organization" value={f.company} onChange={(e) => set("company", e.target.value)} {...field("company")} />
          {err("company")}
        </div>
        <div>
          {label("website", "Adresse du site")}
          <input inputMode="url" autoComplete="url" placeholder="www.exemple.fr" value={f.website} onChange={(e) => set("website", e.target.value)} {...field("website")} />
          {err("website")}
        </div>
        <div className="sm:col-span-2">
          {label("size", agency ? "Clients suivis" : "Taille de l'entreprise")}
          <select value={f.size} disabled={!f.offer} onChange={(e) => set("size", e.target.value)} {...field("size")}>
            <option value="">{f.offer ? "Choisissez" : "Choisissez d'abord l'offre"}</option>
            {(f.offer ? SIZES[f.offer] : []).map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
          {err("size")}
        </div>
      </div>

      <div>
        {label("need", "Ce que vous voulez voir pendant la démo")}
        <p className="text-[0.9rem] text-muted">
          {agency ? "Par exemple : « la marque blanche et la validation par le client », « brancher l'API dans notre reporting »." : "Par exemple : « pourquoi ChatGPT cite nos concurrents et pas nous », « ce que vous corrigez sur notre site »."}
        </p>
        <textarea rows={4} maxLength={NEED_MAX + 200} value={f.need} onChange={(e) => set("need", e.target.value)} {...field("need")} />
        {err("need")}
      </div>

      <fieldset aria-describedby={errors.slots ? `${id}-slots-err` : undefined}>
        <legend className="font-semibold">Créneaux souhaités</legend>
        <p className="text-[0.9rem] text-muted">Du lundi au vendredi, 30 minutes en visioconférence. Jusqu&apos;à {MAX_SLOTS} propositions.</p>
        <ul className="mt-2 space-y-2">
          {f.slots.map((s, i) => (
            <li key={i} className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[10rem] flex-1 flex-col text-[0.9rem]">
                <span className="sr-only sm:not-sr-only">Jour {i + 1}</span>
                <input id={i === 0 ? `${id}-slots` : undefined} type="date" min={bounds.min} max={bounds.max} value={s.date} onChange={(e) => setSlot(i, { date: e.target.value })} aria-label={`Jour du créneau ${i + 1}`} className={`${input} ${errors.slots ? "border-danger" : "border-line"}`} />
              </label>
              <label className="flex min-w-[10rem] flex-1 flex-col text-[0.9rem]">
                <span className="sr-only sm:not-sr-only">Moment</span>
                <select value={s.period} onChange={(e) => setSlot(i, { period: e.target.value as Slot["period"] })} aria-label={`Moment du créneau ${i + 1}`} className={`${input} border-line`}>
                  {PERIODS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </label>
              {f.slots.length > 1 ? (
                <button type="button" onClick={() => setF((p) => ({ ...p, slots: p.slots.filter((_, j) => j !== i) }))} className="min-h-12 rounded-xl px-3 text-[0.95rem] font-semibold text-primary underline-offset-4 hover:underline">
                  Retirer<span className="sr-only"> le créneau {i + 1}</span>
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {f.slots.length < MAX_SLOTS ? (
          <button type="button" onClick={() => setF((p) => ({ ...p, slots: [...p.slots, { date: "", period: "matin" }] }))} className="mt-2 min-h-11 font-semibold text-primary underline-offset-4 hover:underline">
            Ajouter un créneau
          </button>
        ) : null}
        {errors.slots ? <p id={`${id}-slots-err`} className="mt-1 text-[0.9rem] text-danger">{errors.slots}</p> : null}
        <div className="mt-3">
          {label("otherTimes", <>Ou décrivez vos disponibilités {optional}</>)}
          <input placeholder="Plutôt le mardi en fin de matinée" value={f.otherTimes} onChange={(e) => set("otherTimes", e.target.value)} {...field("otherTimes")} />
          {err("otherTimes")}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
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
        <div>
          {label("phone", <>Téléphone {optional}</>)}
          <input type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} {...field("phone")} />
          {err("phone")}
        </div>
      </div>

      <div className="rounded-xl bg-canvas p-4">
        <label className="flex cursor-pointer gap-3" htmlFor={`${id}-consent`}>
          <input id={`${id}-consent`} type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? `${id}-consent-err` : undefined} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-primary)]" />
          <span>{consentText}</span>
        </label>
        {err("consent")}
      </div>

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
            <a href={`mailto:${email}?subject=${encodeURIComponent("Demande de démo")}`} className="font-semibold underline">{email}</a>.
          </p>
        </div>
      ) : null}

      <button type="submit" disabled={state.kind === "sending"} className={buttonClasses({ size: "lg", className: "w-full sm:w-auto" })}>
        {state.kind === "sending" ? "Envoi en cours…" : "Demander ma démo"}
      </button>
      <p className="text-[0.85rem] text-muted">
        Vos informations servent uniquement à organiser la démo. Détails dans notre <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>
    </form>
  );
}

export default MeetingForm;
