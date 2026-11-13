/**
 * Aperçus produit en HTML/SVG inline (aucune image externe).
 * Toutes les données sont des données de démonstration, étiquetées comme telles.
 * Comptes démo : Paysia (PME), Maison Sora (e-commerce), Plomberie Martin (local).
 */
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { demoDigest, measureSceneData, orNull, proveSceneData, understandSceneData } from "./demo-figures";
import type { HeroAnswerData } from "./hero-answers";

export type { HeroAnswerData };

/* ---------- Cadre ---------- */

export function AppFrame({
  account,
  path,
  children,
  className = "",
  label,
}: {
  account: string;
  path: string;
  children: ReactNode;
  className?: string;
  /** Description pour les lecteurs d'écran. */
  label: string;
}) {
  return (
    <figure className={`app-frame overflow-hidden text-ink ${className}`} aria-label={label}>
      <div className="flex items-center gap-2 border-b border-line/80 bg-canvas/70 px-3.5 py-2.5 text-[0.8rem]">
        <LogoMark size={18} />
        <span className="truncate font-semibold">{account}</span>
        <span aria-hidden="true" className="text-line">/</span>
        <span className="truncate text-muted">{path}</span>
        <span className="ml-auto shrink-0 rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">
          Démo
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  );
}

function Tick({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${
        ok ? "bg-success-bg text-success-ink" : "bg-danger-bg text-danger-ink"
      }`}
    >
      <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
        {ok ? (
          <path d="M2.5 6.3l2.2 2.2L9.5 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        )}
      </svg>
      {label}
    </span>
  );
}

/* ---------- Héros : une réponse d'IA, votre nom repéré ---------- */

export function HeroAnswer({ data, animated = true }: { data: HeroAnswerData; animated?: boolean }) {
  return (
    <figure className="app-frame relative overflow-hidden text-ink" aria-label={data.label}>
      <div className="flex items-center justify-between border-b border-line/80 px-4 py-2.5 text-[0.8rem] text-muted">
        <span className="font-semibold text-ink">{data.ia}</span>
        <span className="rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Exemple</span>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <p className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-primary-bg px-4 py-2.5 text-[0.95rem] text-primary-deep">
          {data.question}
        </p>
        <div className="max-w-[96%] space-y-2 text-[0.95rem] leading-relaxed">
          <p>{data.intro}</p>
          <ol className="space-y-3 pl-1 leading-[1.75]">
            {data.items.map((it) => (
              <li key={it.name}>
                {it.you ? (
                  <span className={`lock-on ${animated ? "is-animated" : ""}`}>{it.name}</span>
                ) : (
                  <strong className="font-semibold">{it.name}</strong>
                )}{" "}
                : {it.note}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line/80 bg-canvas/60 px-4 py-2.5 text-[0.78rem] text-muted">
        <span>{data.footer[0]}</span>
        <span>{data.footer[1]}</span>
      </div>
    </figure>
  );
}

/* ---------- 1. Mesurer ---------- */

export function MeasureScreen() {
  const d = measureSceneData();
  const max = Math.max(1, ...d.sov.map((x) => x.v));
  return (
    <AppFrame account={d.account} path="Ce que disent les IA" label="Aperçu : réponses de trois IA à une question d'acheteur et part de voix face aux concurrents">
      <p className="text-[0.8rem] text-muted">Question suivie : {d.asked} réponses à la dernière mesure</p>
      <p className="mt-1 font-display text-lg font-semibold leading-snug">{`«\u00A0${d.question.replace(/\s*\?$/, "\u00A0?")}\u00A0»`}</p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {d.answers.map((a) => (
          <div key={a.ia} className="rounded-xl border border-line/80 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.85rem] font-semibold">{a.ia}</span>
              <Tick ok={a.you > 0} label={a.you > 0 ? `Cité, ${a.you}ᵉ` : "Absent"} />
            </div>
            <ol className="mt-2 space-y-1 text-[0.85rem]">
              {a.names.map((n, i) => (
                <li key={n} className={`flex gap-2 rounded-md px-1.5 py-0.5 ${n === d.account ? "bg-accent-soft font-semibold" : "text-ink/80"}`}>
                  <span className="tabular w-3 text-muted">{i + 1}</span>
                  {n}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <p className="text-[0.85rem] font-semibold">Part de voix, {d.questions} questions</p>
          <p className="text-[0.78rem] text-muted">{d.analysed} réponses analysées</p>
        </div>
        <ul className="mt-2 space-y-1.5">
          {d.sov.map((x) => (
            <li key={x.name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-[0.8rem]">
              <span className={`truncate ${x.you ? "font-semibold" : "text-ink/80"}`}>{x.you ? `${x.name} (vous)` : x.name}</span>
              <span className="h-2 rounded-full bg-canvas">
                <span className={`block h-2 rounded-full ${x.you ? "bg-primary" : "bg-line"}`} style={{ width: `${(x.v / max) * 100}%` }} />
              </span>
              <span className="tabular text-right text-muted">{x.v} %</span>
            </li>
          ))}
        </ul>
      </div>
    </AppFrame>
  );
}

/* ---------- 2. Comprendre ---------- */

export function SourcesScreen() {
  const d = understandSceneData();
  return (
    <AppFrame account={d.account} path="Sources" label={`Aperçu : les sites que lisent les IA, la présence de ${d.account} sur chacun et pourquoi le concurrent passe devant`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-semibold">Les pages que lisent les IA</p>
        <p className="text-[0.78rem] text-muted">{d.engines}</p>
      </div>
      <ul className="mt-3 divide-y divide-line/70 text-[0.85rem]">
        {d.rows.map((x) => (
          <li key={x.d} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[1fr_6rem_3rem_auto]">
            <span className="min-w-0">
              <span className="block truncate font-semibold">{x.d}</span>
              <span className="text-[0.75rem] text-muted sm:hidden">{x.t}, cité {x.n} fois</span>
            </span>
            <span className="hidden text-muted sm:block">{x.t}</span>
            <span className="tabular hidden text-right text-muted sm:block">{x.n}×</span>
            <Tick ok={x.here} label={x.here ? "Présent" : "Absent"} />
          </li>
        ))}
      </ul>
      <div className="mt-4 rounded-xl bg-canvas p-3.5">
        <p className="text-[0.85rem] font-semibold">Pourquoi {d.ahead} passe devant</p>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[0.8rem]">
          {d.compare.map((c) => (
            <div key={c.k}>
              <dt className="text-muted">{c.k}</dt>
              <dd className="mt-0.5">
                <span className="tabular font-semibold">{c.of ? `${c.them} / ${c.of}` : c.them}</span>
                <span className="text-muted"> contre </span>
                <span className="tabular font-semibold text-primary">{c.of ? `${c.you} / ${c.of}` : c.you}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </AppFrame>
  );
}

/* ---------- 3. Agir ---------- */

export function TaskScreen() {
  return (
    <AppFrame account="Paysia" path="Tâches de la semaine" label="Aperçu : une tâche avec son texte prêt à publier et la validation en un clic">
      <div className="flex flex-wrap items-center gap-2 text-[0.75rem]">
        <span className="rounded-full bg-primary-bg px-2 py-0.5 font-semibold text-primary">Page citable</span>
        <span className="rounded-full bg-canvas px-2 py-0.5 font-semibold text-muted ring-1 ring-inset ring-line">15 min de relecture</span>
      </div>
      <p className="mt-2.5 font-display text-lg font-semibold leading-snug">Publier la page « Paysia ou Paylo : lequel choisir ? »</p>
      <p className="mt-1 text-[0.85rem] text-muted">
        Pourquoi : 3 IA citent un comparatif pour cette question, et vous n&apos;en avez aucun.
      </p>
      <div className="mt-3 rounded-xl border border-line/80 bg-canvas/60 p-3.5 text-[0.85rem] leading-relaxed">
        <p className="text-[0.75rem] font-semibold text-muted">Texte prêt, extrait</p>
        <p className="mt-1.5 font-semibold">Pour quelle entreprise Paysia est-il fait ?</p>
        <p className="mt-1 text-ink/85">
          Paysia s&apos;adresse aux PME de 10 à 250 salariés qui gèrent la paie en interne. Le support répond en français,
          depuis Lyon, du lundi au vendredi…
        </p>
        <p className="mt-2 text-[0.75rem] text-muted">+ balisage FAQPage prêt (JSON-LD)</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-[0.85rem] font-semibold text-white">Valider la publication</span>
        <span className="inline-flex min-h-9 items-center rounded-lg px-3 text-[0.85rem] font-semibold text-primary ring-1 ring-inset ring-line">Copier le texte</span>
        <span className="ml-auto text-[0.75rem] text-muted">Accompagné : nous publions après votre accord</span>
      </div>
    </AppFrame>
  );
}

/* ---------- 4. Prouver ---------- */

export async function TrafficScreen() {
  const d = await orNull(proveSceneData());
  if (!d) return null;
  const w = 320;
  const h = 110;
  const max = Math.max(10, Math.ceil((Math.max(...d.weekly) * 1.1) / 10) * 10);
  const step = w / (d.weekly.length - 1);
  const pts = d.weekly.map((v, i) => [i * step, h - (v / max) * h] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1];
  return (
    <AppFrame account={d.account} path="Trafic IA" label="Aperçu : visites venues des IA sur 30 jours, courbe sur 12 semaines et répartition par IA">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[0.8rem] text-muted">Visites venues des IA, 30 jours</p>
          <p className="font-display text-3xl font-bold tabular">
            {d.visits30}{" "}
            {d.growth30 !== null ? (
              <span className={`text-base font-semibold ${d.growth30 >= 0 ? "text-success-ink" : "text-danger-ink"}`}>
                {d.growth30 >= 0 ? "+" : "−"}
                {Math.abs(d.growth30)} % sur 30 j
              </span>
            ) : null}
          </p>
        </div>
        {d.orders30 !== null ? (
          <p className="text-[0.8rem] text-muted">
            Commandes attribuées, 30 jours : <span className="tabular font-semibold text-ink">{d.orders30}</span>
            {d.revenue30 ? <span className="font-semibold text-ink"> ({d.revenue30})</span> : null}
          </p>
        ) : null}
      </div>
      <svg viewBox={`0 -6 ${w} ${h + 12}`} className="mt-3 h-auto w-full" role="img" aria-label={`Visites hebdomadaires venues des IA, de ${d.weekly[0]} à ${d.weekly[d.weekly.length - 1]} en 12 semaines`}>
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="#D5D9E4" strokeWidth="0.75" strokeDasharray="2 4" />
        ))}
        <path d={area} fill="#3730A3" opacity="0.08" />
        <path d={line} fill="none" stroke="#3730A3" strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={last[0]} cy={last[1]} r="4" fill="#3730A3" stroke="#fff" strokeWidth="2" />
      </svg>
      <p className="mt-1 text-[0.75rem] text-muted">Visites par semaine, 12 dernières semaines</p>
      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[0.8rem] sm:grid-cols-4">
        {d.engines.map((e) => (
          <li key={e.n}>
            <span className="block truncate text-muted">{e.n}</span>
            <span className="tabular font-semibold">{e.v} %</span>
          </li>
        ))}
      </ul>
    </AppFrame>
  );
}

/* ---------- Alerte hallucination ---------- */

/** Erreur d'une IA relevée sur le compte démo local (Plomberie Martin), telle que l'affiche l'e-mail du lundi. */
export async function HallucinationScreen() {
  const d = await orNull(demoDigest("local"));
  if (!d) return null;
  const e = d.factError;
  return (
    <AppFrame account={d.account} path="Vérité" label="Aperçu : alerte quand une IA donne une information fausse, avec la bonne information et la correction préparée">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 3.5 17.5 16.5h-15Z" strokeLinejoin="round" />
            <path d="M10 8.5v3.5M10 14.2v.1" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold leading-snug">{d.headline.replace(/\.$/, "")}</p>
          <p className="text-[0.8rem] text-muted">Relevé à la dernière mesure, face à votre fiche de vérité</p>
        </div>
      </div>
      {e ? (
        <dl className="mt-4 grid gap-2 text-[0.85rem] sm:grid-cols-2">
          <div className="rounded-xl bg-danger-bg p-3">
            <dt className="text-[0.75rem] font-semibold text-danger-ink">Ce que dit {e.ia}</dt>
            <dd className="mt-1 font-semibold text-danger-ink">« {e.stated} »</dd>
          </div>
          <div className="rounded-xl bg-success-bg p-3">
            <dt className="text-[0.75rem] font-semibold text-success-ink">Votre fiche de vérité ({e.label.toLowerCase()})</dt>
            <dd className="mt-1 font-semibold text-success-ink">{e.expected}</dd>
          </div>
        </dl>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-[0.85rem] font-semibold text-white">
          {d.fixMinutes ? `Corriger en ${d.fixMinutes} min` : "Corriger"}
        </span>
        <span className="inline-flex min-h-9 items-center rounded-lg px-3 text-[0.85rem] font-semibold text-primary ring-1 ring-inset ring-line">Voir les réponses</span>
      </div>
    </AppFrame>
  );
}

/* ---------- Le digest du lundi ---------- */

/** E-mail du lundi du compte démo PME (Paysia), construit par le même code que l'envoi réel (buildWeeklyDigest). */
export async function DigestScreen() {
  const d = await orNull(demoDigest("pme"));
  if (!d) return null;
  return (
    <figure className="app-frame overflow-hidden text-ink" aria-label="Aperçu : l'e-mail du lundi avec la phrase de la semaine, le rang et les trois tâches">
      <div className="border-b border-line/80 px-4 py-3 text-[0.8rem]">
        <div className="flex items-center gap-2">
          <LogoMark size={18} />
          <span className="font-semibold">Repéré</span>
          <span className="text-muted">lundi, 8 h 02</span>
          <span className="ml-auto rounded-full bg-warning-bg px-2 py-0.5 text-[0.72rem] font-semibold text-warning-ink">Démo</span>
        </div>
        <p className="mt-1.5 font-semibold">Votre semaine dans les IA, {d.account}</p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <div>
          <p className="font-display text-xl font-semibold leading-snug">{d.headline}</p>
          {d.headlineSub ? <p className="mt-1 text-[0.85rem] text-ink/75">{d.headlineSub}</p> : null}
        </div>
<div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["Rang", `${d.rank}ᵉ / ${d.of}`],
            ["Score", String(d.score)],
            ["Visites IA, 7 j", d.visits7 === null ? "–" : String(d.visits7)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-canvas px-2 py-2.5">
              <p className="tabular font-display text-xl font-bold">{v}</p>
              <p className="text-[0.72rem] text-muted">{k}</p>
            </div>
          ))}
        </div>
        <div>
          <p className="text-[0.85rem] font-semibold">Vos 3 actions de la semaine</p>
          <ol className="mt-2 space-y-1.5 text-[0.85rem]">
            {d.tasks.map((x) => [x.title, `${x.minutes} min`]).map(([t, m], i) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.7rem] font-bold text-white">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{t}</span>
                <span className="shrink-0 text-[0.75rem] text-muted">{m}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </figure>
  );
}
