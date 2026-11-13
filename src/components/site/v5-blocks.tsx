/**
 * Blocs du site V5 (SITE-POSITIONNEMENT) : Repéré, SEO + GEO pour tous les sites pros.
 * Tout est rendu côté serveur ; les chiffres viennent du code (catalogue SEO-AUDIT, méthode GEO-OPT, droits par offre).
 * Aucune donnée inventée présentée comme réelle : l'aperçu d'analyse est étiqueté « exemple, site fictif ».
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CHECKS, SECTIONS } from "@/lib/seoaudit";
import { Counter } from "@/components/motion/Counter";

/* ------------------------------------------------------------------ */
/* Chiffres du produit (lus dans le code, jamais recopiés à la main)    */
/* ------------------------------------------------------------------ */

export const SEO_CHECK_COUNT = CHECKS.length;
export const SEO_SECTION_COUNT = SECTIONS.length;

/** Sections de l'audit GEO (src/lib/geo : libellés et poids des sections). */
export const GEO_SECTIONS: { id: string; label: string; weight: number; example: string; evidence: "démontré" | "probable" | "hypothèse" | "informatif" }[] = [
  { id: "acces", label: "Accès des robots d’IA", weight: 25, example: "OAI-SearchBot, PerplexityBot ou Claude-SearchBot bloqués par robots.txt ou par le pare-feu", evidence: "démontré" },
  { id: "passages", label: "Contenu citable (passages)", weight: 25, example: "Réponse directe en tête, chiffres datés et sourcés, phrases compréhensibles hors contexte", evidence: "probable" },
  { id: "entite", label: "Identité de l’entreprise", weight: 15, example: "Nom, adresse et téléphone identiques sur le site et dans le balisage Organization", evidence: "probable" },
  { id: "questions", label: "Couverture des questions", weight: 15, example: "Prix, délais, zone, garanties : les sous-questions que l’IA va chercher", evidence: "probable" },
  { id: "hors_site", label: "Présence hors site", weight: 15, example: "Les annuaires, comparatifs et médias que les IA citent dans votre secteur", evidence: "probable" },
  { id: "donnees", label: "Données structurées utiles", weight: 10, example: "LocalBusiness, Product, Article avec auteur et dates", evidence: "hypothèse" },
  { id: "fraicheur", label: "Fraîcheur", weight: 5, example: "Date de mise à jour visible et honnête sur les pages clés", evidence: "probable" },
  { id: "llms", label: "llms.txt", weight: 0, example: "Proposé, sans effet démontré : il ne compte pas dans la note", evidence: "informatif" },
];

export function seoSectionCounts() {
  return SECTIONS.map((s) => {
    const checks = CHECKS.filter((c) => c.section === s.id);
    return { id: s.id, label: s.label, weight: s.weight, count: checks.length, examples: checks.slice(0, 2).map((c) => c.label) };
  });
}

/* ------------------------------------------------------------------ */
/* Aperçu d'analyse (héros) — exemple étiqueté                          */
/* ------------------------------------------------------------------ */

type Reader = "google" | "ia" | "both";
const READER_LABEL: Record<Reader, string> = { google: "Google", ia: "IA", both: "Google et IA" };
const READER_TONE: Record<Reader, string> = {
  google: "bg-[var(--tone-brand-bg)] text-[var(--tone-brand)]",
  ia: "bg-[var(--tone-warn-bg)] text-[var(--tone-warn)]",
  both: "bg-[var(--tone-up-bg)] text-[var(--tone-up)]",
};

const PREVIEW_FIXES: { reader: Reader; title: string; fix: string }[] = [
  { reader: "ia", title: "Vos pages « Services » n’affichent leur texte qu’avec JavaScript", fix: "Les robots d’OpenAI, Anthropic et Perplexity ne l’exécutent pas : ils voient une page vide." },
  { reader: "google", title: "14 pages portent le même titre « Accueil – Atelier Sora »", fix: "Un titre par page, avec le service et la ville : prêt à appliquer." },
  { reader: "both", title: "Votre téléphone diffère entre le site et le balisage", fix: "Google comme les IA hésitent quand deux sources se contredisent." },
];

export function HeroAnalysisPreview() {
  return (
    <figure className="relative m-0">
      <div className="overflow-hidden rounded-[var(--r-xl,20px)] bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08),0_30px_60px_-34px_rgba(30,26,92,.55)]">
        <div className="flex items-center gap-3 border-b border-line/70 px-4 py-3 sm:px-5">
          <span aria-hidden="true" className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
            <span className="h-2.5 w-2.5 rounded-full bg-line" />
          </span>
          <span className="min-w-0 flex-1 truncate rounded-md bg-canvas px-3 py-1 text-[0.82rem] text-ink/70">atelier-sora.fr</span>
          <span className="ui-live shrink-0 text-[0.78rem] font-semibold text-[var(--tone-up)]">
            <span className="ui-live-bar" />
            Analyse terminée
          </span>
        </div>

        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 px-4 pt-5 sm:gap-5 sm:px-6">
          <div>
            <p className="text-[0.8rem] font-semibold text-ink/70">Lu par Google</p>
            <p className="font-display text-[2.4rem] font-bold leading-none tabular sm:text-[2.9rem]">
              <Counter value={62} />
              <span className="ml-0.5 text-[0.95rem] font-semibold text-muted">/100</span>
            </p>
          </div>
          <div>
            <p className="text-[0.8rem] font-semibold text-ink/70">Lu par les IA</p>
            <p className="font-display text-[2.4rem] font-bold leading-none tabular sm:text-[2.9rem]">
              <Counter value={41} />
              <span className="ml-0.5 text-[0.95rem] font-semibold text-muted">/100</span>
            </p>
          </div>
          <dl className="pb-1 text-right text-[0.75rem] leading-snug text-muted">
            <dt className="sr-only">Pages explorées</dt>
            <dd>
              <b className="text-ink">42</b> pages
            </dd>
            <dt className="sr-only">Contrôles</dt>
            <dd>
              <b className="text-ink">{SEO_CHECK_COUNT}</b> contrôles
            </dd>
          </dl>
        </div>

        <p className="mx-4 mt-4 rounded-lg bg-canvas px-3 py-2.5 text-[0.92rem] font-medium leading-snug sm:mx-6">
          Google vous trouve, les IA vous lisent mal : trois pages clés sont vides sans JavaScript.
        </p>

        <ol className="ui-cascade mt-4 space-y-2 px-4 pb-5 sm:px-6" aria-label="Les priorités de l'exemple">
          {PREVIEW_FIXES.map((f, i) => (
            <li key={f.title} className="flex gap-3 rounded-xl border border-line/70 p-3" style={{ ["--i" as string]: i }}>
              <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[0.78rem] font-bold text-white">
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[0.92rem] font-semibold leading-snug">{f.title}</span>
                </span>
                <span className="mt-1 block text-[0.82rem] leading-snug text-ink/70">{f.fix}</span>
                <span className={`mt-1.5 inline-block rounded-[var(--r-xs,6px)] px-1.5 py-0.5 text-[0.72rem] font-semibold ${READER_TONE[f.reader]}`}>
                  Compte pour : {READER_LABEL[f.reader]}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>
      <figcaption className="mt-2 text-[0.78rem] leading-snug text-muted">
        Exemple illustratif sur un site fictif. Votre analyse porte sur votre vrai site, page par page.
      </figcaption>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Deux lecteurs : Google et les IA                                    */
/* ------------------------------------------------------------------ */

function ReaderCard({ title, steps, result, tone }: { title: string; steps: string[]; result: ReactNode; tone: "brand" | "warn" }) {
  return (
    <div className="relative rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08)] sm:p-6">
      <h3 className={`text-lg font-bold ${tone === "brand" ? "text-[var(--tone-brand)]" : "text-[var(--tone-warn)]"}`}>{title}</h3>
      <ol className="mt-3 space-y-2 text-[0.95rem]">
        {steps.map((s, i) => (
          <li key={s} className="flex gap-2.5">
            <span aria-hidden="true" className="mt-[0.2rem] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line text-[0.72rem] font-semibold text-ink/70">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-xl bg-canvas p-3 text-[0.9rem]">{result}</div>
    </div>
  );
}

export function TwoReaders() {
  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-stretch">
        <div className="flex flex-col justify-center rounded-2xl bg-ink p-5 text-white sm:p-6">
          <p className="text-[0.85rem] text-white/70">Le point de départ</p>
          <p className="mt-1 text-xl font-bold leading-snug">Votre site, tel qu&apos;un robot le reçoit</p>
          <p className="mt-3 text-[0.92rem] leading-relaxed text-white/80">
            Le HTML, le robots.txt, le sitemap, les titres, le balisage. Pas ce que vous voyez dans votre navigateur.
          </p>
        </div>
        <ReaderCard
          tone="brand"
          title="Google classe des pages"
          steps={["Googlebot explore et rend la page", "Il l’indexe s’il n’y a pas d’obstacle", "Il la classe parmi d’autres, requête par requête"]}
          result={
            <>
              <span className="font-semibold">Résultat :</span> une position dans une liste, des clics mesurables dans la Search Console. Les aperçus IA
              de Google s&apos;appuient sur le même index.
            </>
          }
        />
        <ReaderCard
          tone="warn"
          title="Les IA citent des passages"
          steps={["Leur robot de recherche lit la page, souvent sans JavaScript", "Le modèle cherche plusieurs sous-questions", "Il extrait un passage et cite quelques sources"]}
          result={
            <>
              <span className="font-semibold">Résultat :</span> trois à cinq noms dans une réponse, qui varient d&apos;un essai à l&apos;autre. On le
              mesure en répétant les questions.
            </>
          }
        />
      </div>
      <div className="mt-4 rounded-2xl border border-dashed border-primary/40 bg-white p-5 sm:p-6">
        <p className="font-semibold">Ce qui sert aux deux, et que Repéré contrôle en premier</p>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-[0.95rem] sm:grid-cols-2">
          {[
            "Des pages accessibles aux robots, sans blocage involontaire",
            "Le texte présent dans le HTML, pas seulement après JavaScript",
            "Une identité claire : nom, adresse, téléphone, partout les mêmes",
            "Des réponses directes, datées, avec leurs sources",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className="mt-1 shrink-0 text-primary">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ce que l'analyse contrôle (chiffres lus dans le code)               */
/* ------------------------------------------------------------------ */

export function ChecksMap() {
  const seo = seoSectionCounts();
  const max = Math.max(...seo.map((s) => s.count));
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      <section aria-labelledby="checks-seo">
        <h3 id="checks-seo" className="text-xl font-bold">
          Google : {SEO_CHECK_COUNT} contrôles en {SEO_SECTION_COUNT} familles
        </h3>
        <p className="mt-1 text-[0.95rem] text-ink/70">Chacun s&apos;appuie sur une règle publiée par Google ou web.dev. La barre montre le nombre de contrôles.</p>
        <ul className="mt-4 space-y-1.5">
          {seo.map((s) => (
            <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span className="min-w-0">
                <span className="block text-[0.95rem] font-semibold leading-snug">{s.label}</span>
                <span className="relative mt-1 block h-1.5 overflow-hidden rounded-full bg-line/60" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--tone-brand-solid,#3730a3)]" style={{ width: `${Math.max(6, (s.count / max) * 100)}%` }} />
                </span>
              </span>
              <span className="tabular text-[0.95rem] font-semibold text-ink/80">{s.count}</span>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="checks-geo">
        <h3 id="checks-geo" className="text-xl font-bold">Les IA : {GEO_SECTIONS.length} familles, avec leur niveau de preuve</h3>
        <p className="mt-1 text-[0.95rem] text-ink/70">
          « Démontré » : l&apos;éditeur de l&apos;IA le dit, ou une expérience publiée l&apos;a mesuré. « Probable » : corrélation observée. Nous ne
          mélangeons pas les deux.
        </p>
        <ul className="mt-4 space-y-2">
          {GEO_SECTIONS.map((g) => (
            <li key={g.id} className="rounded-lg px-2 py-1.5 hover:bg-canvas">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[0.95rem] font-semibold">{g.label}</span>
                <span
                  className={`rounded-[var(--r-xs,6px)] px-1.5 py-0.5 text-[0.72rem] font-semibold ${
                    g.evidence === "démontré"
                      ? "bg-[var(--tone-up-bg)] text-[var(--tone-up)]"
                      : g.evidence === "probable"
                        ? "bg-[var(--tone-brand-bg)] text-[var(--tone-brand)]"
                        : "bg-[var(--tone-neutral-bg)] text-[var(--tone-neutral)]"
                  }`}
                >
                  {g.evidence}
                </span>
              </span>
              <span className="mt-0.5 block text-[0.85rem] leading-snug text-ink/70">{g.example}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[0.88rem]">
          <Link href="/methode#geo" className="font-semibold text-primary underline underline-offset-4">
            Les règles, les sources et les niveaux de preuve
          </Link>
        </p>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* L'agent de publication                                              */
/* ------------------------------------------------------------------ */

export const PUBLISH_PLATFORMS = ["WordPress", "Shopify", "Webflow", "PrestaShop"] as const;

const AGENT_STEPS: { title: string; text: string }[] = [
  { title: "Préparé", text: "Titres, descriptions, textes alternatifs, balisage, redirections : l’agent rédige à partir de votre site, sans inventer de chiffre." },
  { title: "Montré", text: "Vous voyez l’avant et l’après, page par page. Ce qui manque est marqué « à compléter » et bloque la validation." },
  { title: "Validé par vous", text: "Rien ne part sans votre accord explicite." },
  { title: "Appliqué, puis vérifié", text: "Publication par l’accès que vous donnez, relecture de la page publique, nouvelle mesure 7 jours plus tard." },
  { title: "Annulable", text: "Chaque changement garde sa valeur d’origine et se défait en un clic. Tout est journalisé." },
];

export function AgentFlow({ dark = false }: { dark?: boolean }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {AGENT_STEPS.map((s, i) => (
        <li
          key={s.title}
          className={`relative rounded-2xl p-4 ${dark ? "bg-white/[.06] ring-1 ring-white/15" : "bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)]"}`}
        >
          <span className={`text-[0.8rem] font-semibold ${dark ? "text-on-deep" : "text-muted"}`}>Étape {i + 1}</span>
          <p className={`mt-1 text-[1.05rem] font-bold ${dark ? "text-white" : ""}`}>{s.title}</p>
          <p className={`mt-1.5 text-[0.88rem] leading-snug ${dark ? "text-on-deep" : "text-ink/75"}`}>{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Comparaison par familles d'outils                                   */
/* ------------------------------------------------------------------ */

export const FAMILY_COMPARE: { label: string; seo: string; geo: string; us: string }[] = [
  { label: "Pour qui", seo: "Experts SEO et agences", geo: "Équipes marketing", us: "Dirigeants, commerçants, équipes sans expert" },
  { label: "Audit technique du site", seo: "Très complet", geo: "Accès des robots d’IA, parfois", us: `${SEO_CHECK_COUNT} contrôles SEO et ${GEO_SECTIONS.length} familles GEO, en français` },
  { label: "Réponses des IA", seo: "Module en option, souvent en supplément", geo: "Le cœur de l’offre", us: "4 à 5 IA, questions répétées, marge d’erreur affichée" },
  { label: "Positions et Search Console", seo: "Oui", geo: "Rarement", us: "Oui : Search Console, PageSpeed, positions suivies" },
  { label: "Corrections", seo: "À faire vous-même", geo: "Recommandations, parfois un agent", us: "Prêtes à copier, ou appliquées sur votre site après validation" },
  { label: "Prix d’entrée", seo: "Environ 130 à 140 $/mois", geo: "29 à 95 $/mois", us: "0 €, puis dès 29 €/mois" },
];

export function FamilyCompare() {
  return (
    <div>
      <div className="grid gap-3 md:hidden">
        {(
          [
            ["Suites SEO", "seo"],
            ["Outils de suivi des IA", "geo"],
            ["Repéré", "us"],
          ] as const
        ).map(([name, key]) => (
          <section key={key} aria-label={name} className={`rounded-2xl p-5 ${key === "us" ? "bg-primary text-white" : "bg-white ring-1 ring-line"}`}>
            <h3 className={`text-lg font-bold ${key === "us" ? "text-white" : ""}`}>{name}</h3>
            <dl className="mt-3 space-y-2.5 text-[0.95rem]">
              {FAMILY_COMPARE.map((r) => (
                <div key={r.label}>
                  <dt className={`text-[0.82rem] ${key === "us" ? "text-on-deep" : "text-muted"}`}>{r.label}</dt>
                  <dd className="font-medium">{r[key]}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)] md:block">
        <table className="w-full border-collapse text-left text-[0.95rem]">
          <caption className="sr-only">Comparaison entre suites SEO, outils de suivi des IA et Repéré</caption>
          <thead>
            <tr>
              <td className="w-[20%] p-5" />
              <th scope="col" className="w-[25%] p-5 align-bottom font-display text-lg font-semibold text-ink/80">
                Suites SEO
                <span className="block text-[0.8rem] font-normal text-muted">Semrush, Ahrefs, Screaming Frog</span>
              </th>
              <th scope="col" className="w-[25%] p-5 align-bottom font-display text-lg font-semibold text-ink/80">
                Suivi des IA
                <span className="block text-[0.8rem] font-normal text-muted">Peec AI, Otterly.AI, Meteoria</span>
              </th>
              <th scope="col" className="w-[30%] bg-primary p-5 align-bottom font-display text-lg font-semibold text-white">Repéré</th>
            </tr>
          </thead>
          <tbody>
            {FAMILY_COMPARE.map((r, i) => (
              <tr key={r.label} className="border-t border-line/70">
                <th scope="row" className="p-5 font-semibold">{r.label}</th>
                <td className="p-5 text-ink/75">{r.seo}</td>
                <td className="p-5 text-ink/75">{r.geo}</td>
                <td className={`bg-primary p-5 font-medium text-white ${i === FAMILY_COMPARE.length - 1 ? "" : "border-b border-white/10"}`}>{r.us}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[0.82rem] text-muted">
        Prix publics relevés le 13 novembre 2026, hors taxes ; le détail, les sources et ce que chaque outil fait mieux que nous sont sur{" "}
        <Link href="/comparatif" className="underline underline-offset-2">
          le comparatif
        </Link>
        .
      </p>
    </div>
  );
}
