/**
 * Aperçus statiques des modules (HTML léger, données de démonstration étiquetées « Démo » par AppFrame).
 * Comptes démo : Plomberie Martin (local), Paysia (PME), Maison Sora (e-commerce).
 */
import type { ReactNode } from "react";
import { AppFrame } from "@/components/site/mockups";
import { demoEngineSplit, demoLocal, demoMeasure, demoProducts, demoQuestions, demoTraffic, orNull } from "@/components/site/demo-figures";

function Pill({ tone, children }: { tone: "ok" | "ko" | "warn" | "neutral"; children: ReactNode }) {
  const cls = {
    ok: "bg-success-bg text-success-ink",
    ko: "bg-danger-bg text-danger-ink",
    warn: "bg-warning-bg text-warning-ink",
    neutral: "bg-canvas text-muted ring-1 ring-inset ring-line",
  }[tone];
  return <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ${cls}`}>{children}</span>;
}

export function QuestionsMock() {
  const d = demoQuestions("local");
  return (
    <AppFrame account={d.account} path="Questions suivies" label={`Aperçu : quatre questions suivies avec leur thème et le résultat sur ${d.engines.length} IA`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-display text-lg font-semibold">Vos questions</p>
        <p className="text-[0.78rem] text-muted">{d.engines.join(", ")}</p>
      </div>
      <ul className="mt-3 divide-y divide-line/70 text-[0.85rem]">
        {d.rows.map((r) => (
          <li key={r.q} className="py-2.5">
            <p className="font-semibold leading-snug">{r.q}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {r.theme ? <Pill tone="neutral">{r.theme}</Pill> : null}
              <span className="ml-auto flex gap-1" aria-label={`Cité par ${r.res.filter(Boolean).length} IA sur ${r.res.length}`}>
                {r.res.map((x, i) => (
                  <span key={i} aria-hidden="true" title={d.engines[i]} className={`h-2.5 w-6 rounded-full ${x ? "bg-success" : "bg-line"}`} />
                ))}
              </span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.78rem] text-muted">Une barre verte par IA qui vous cite au moins une fois sur cette question, à la dernière mesure.</p>
    </AppFrame>
  );
}

export async function CopilotMock() {
  const d = await orNull(demoEngineSplit("pme"));
  if (!d) return null;
  const lines = d.rows.map((r) => `${r.ia} : vous dans ${r.me} réponses sur ${r.answers}, ${d.rival} dans ${r.him}`);
  return (
    <AppFrame account={d.account} path="Copilote" label="Aperçu : une question posée au copilote et une réponse qui cite les données du compte">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[0.9rem] text-white">
        IA par IA, où {d.rival} me passe-t-il devant ?
      </div>
      <div className="mt-3 max-w-[92%] rounded-2xl rounded-bl-md bg-canvas px-3.5 py-3 text-[0.88rem] leading-relaxed">
        <ul className="space-y-1">
          {lines.map((l) => (
            <li key={l}>{l}.</li>
          ))}
        </ul>
        <p className="mt-2.5 text-[0.75rem] text-muted">Données utilisées : dernière mesure, onglet Concurrents (mêmes réponses que le classement).</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[0.8rem]">
        <span className="rounded-full px-3 py-1 font-semibold text-primary ring-1 ring-inset ring-line">Voir la comparaison</span>
        <span className="rounded-full px-3 py-1 font-semibold text-primary ring-1 ring-inset ring-line">Quelle tâche faire ?</span>
      </div>
    </AppFrame>
  );
}

const CHECKS = [
  { l: "Robots des IA autorisés", s: "ok", d: "GPTBot, PerplexityBot, ClaudeBot : autorisés" },
  { l: "Contenu lisible sans JavaScript", s: "warn", d: "Les tarifs n'apparaissent qu'après chargement du script" },
  { l: "Balisage JSON-LD", s: "ko", d: "Aucun bloc Organization ni FAQPage" },
  { l: "Réponse en tête de page", s: "ok", d: "La première phrase répond à la question" },
  { l: "Date et auteur", s: "ko", d: "Page non datée, sans auteur" },
] as const;

export function AuditPageMock() {
  return (
    <AppFrame account="Paysia" path="Audit de page : /tarifs" label="Aperçu : cinq contrôles techniques d'une page avec leur statut">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[0.8rem] text-muted">Citabilité</p>
          <p className="tabular font-display text-3xl font-bold">
            58<span className="text-base font-medium text-muted">/100</span>
          </p>
        </div>
        <Pill tone="warn">3 corrections proposées</Pill>
      </div>
      <ul className="mt-3 divide-y divide-line/70 text-[0.85rem]">
        {CHECKS.map((c) => (
          <li key={c.l} className="flex items-start justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block font-semibold">{c.l}</span>
              <span className="block text-[0.78rem] text-muted">{c.d}</span>
            </span>
            <Pill tone={c.s}>{c.s === "ok" ? "OK" : c.s === "warn" ? "À revoir" : "Manquant"}</Pill>
          </li>
        ))}
      </ul>
    </AppFrame>
  );
}

const NAP_LABEL = { verified: ["ok", "Vérifié"], declared: ["warn", "Déclaré"], absent: ["ko", "Absent"], unknown: ["neutral", "À vérifier"] } as const;

export async function LocalMock() {
  const d = await orNull(demoLocal());
  if (!d) return null;
  return (
    <AppFrame account={d.account} path="Local" label="Aperçu : note de la fiche Google, cohérence des annuaires et citations par quartier">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-canvas p-3.5">
          <p className="text-[0.8rem] text-muted">Fiche Google</p>
          <p className="tabular font-display text-3xl font-bold">
            {d.gbpScore}
            <span className="text-base font-medium text-muted">/100</span>
          </p>
          {d.missing.length ? <p className="mt-1 text-[0.78rem] text-muted">À revoir : {d.missing.join(", ")}</p> : null}
        </div>
        <div className="rounded-xl bg-canvas p-3.5">
          <p className="text-[0.8rem] text-muted">Annuaires</p>
          <ul className="mt-1 space-y-1 text-[0.82rem]">
            {d.nap.map((r) => {
              const [tone, label] = r.issues ? (["ko", `${r.issues} écart${r.issues > 1 ? "s" : ""}`] as const) : NAP_LABEL[r.status];
              return (
                <li key={r.name} className="flex justify-between gap-2">
                  {r.name} <Pill tone={tone}>{label}</Pill>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <p className="mt-4 text-[0.85rem] font-semibold">Taux de mention par quartier (simulation)</p>
      <ul className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[0.8rem] sm:grid-cols-6">
        {d.zones.map((z) => (
          <li
            key={z.n}
            className={`rounded-lg py-2 font-semibold ${z.band === "fort" ? "bg-primary text-white" : z.band === "moyen" ? "bg-primary/60 text-white" : z.band === "faible" ? "bg-primary-bg text-primary" : "bg-canvas text-muted ring-1 ring-inset ring-line"}`}
          >
            <span className="block truncate px-1">{z.n}</span>
            <span className="block text-[0.72rem] font-medium opacity-90">{z.rate} %</span>
          </li>
        ))}
      </ul>
    </AppFrame>
  );
}

export async function EcommerceMock() {
  const d = await orNull(demoProducts());
  if (!d) return null;
  return (
    <AppFrame account={d.account} path="Produits suivis" label="Aperçu : trois produits suivis, dans combien de réponses ils apparaissent et qui est recommandé à leur place">
      <p className="font-display text-lg font-semibold">Vos produits dans les réponses</p>
      <ul className="mt-3 divide-y divide-line/70 text-[0.85rem]">
        {d.products.map((r) => (
          <li key={r.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3 py-2.5">
            <span className="min-w-0 font-semibold">{r.name}</span>
            <Pill tone={r.appearances === 0 ? "ko" : r.appearances * 4 < r.answers ? "warn" : "ok"}>
              Cité <span className="tabular ml-1">{r.appearances}/{r.answers}</span>
            </Pill>
          </li>
        ))}
      </ul>
      {d.instead && d.instead.rivals.length ? (
        <div className="mt-3 rounded-xl bg-canvas p-3.5 text-[0.82rem]">
          <p className="font-semibold">Recommandés à la place de « {d.instead.product} »</p>
          <p className="mt-1 text-muted">{d.instead.rivals.map((x) => `${x.label} (${x.count} fois)`).join(", ")}</p>
        </div>
      ) : null}
    </AppFrame>
  );
}

export async function ReportsMock() {
  const m = demoMeasure("pme");
  const t = await orNull(demoTraffic("pme"));
  const month = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(new Date());
  return (
    <AppFrame account={m.account} path="Rapports" label="Aperçu : rapport du mois avec quatre indicateurs et les options de partage">
      <p className="font-display text-lg font-semibold">Rapport de {month}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[0.82rem] sm:grid-cols-4">
        {[
          ["Score", `${m.score}/100`],
          ["Réponses qui vous citent", `${m.citations} sur ${m.answers}`],
          ["Part de voix", `${m.shareOfVoice}\u00a0%`],
          ["Visites IA, 30 j", t ? String(t.visits30) : "–"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-canvas p-3">
            <dt className="text-muted">{k}</dt>
            <dd className="tabular mt-0.5 font-display text-xl font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <ul className="mt-4 space-y-2 text-[0.85rem]">
        <li className="flex items-center justify-between gap-3">
          <span>Lien de partage, expire le 30 novembre</span>
          <Pill tone="ok">Actif</Pill>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>Envoi chaque 1er du mois à 2 personnes</span>
          <Pill tone="neutral">Planifié</Pill>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>Export CSV des réponses</span>
          <Pill tone="neutral">Télécharger</Pill>
        </li>
      </ul>
    </AppFrame>
  );
}
