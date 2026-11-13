/**
 * Visuels des fonctions V5 (SITE-POSITIONNEMENT). Composants serveur, SVG et HTML faits maison.
 * Les seuils et les chiffres de méthode sont des faits (sources dans /methode) ; les courbes sont des données de
 * démonstration, étiquetées par la page qui les affiche.
 */
import { GEO_SECTIONS, seoSectionCounts, SEO_CHECK_COUNT } from "@/components/site/v5-blocks";

const card = "overflow-hidden rounded-2xl bg-white p-5 shadow-[0_0_0_1px_rgba(27,31,46,.08),0_24px_48px_-32px_rgba(30,26,92,.45)] sm:p-6";

/** Audit SEO : les 12 familles et leur nombre de contrôles (lu dans le code). */
export function SeoAuditMock() {
  const rows = seoSectionCounts();
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">{SEO_CHECK_COUNT} contrôles, par famille</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="grid grid-cols-[9.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[0.85rem] sm:grid-cols-[12rem_minmax(0,1fr)_2rem]">
            <span className="truncate font-medium">{r.label}</span>
            <span className="h-2 rounded-full bg-line/60" aria-hidden="true">
              <span className="block h-2 rounded-full bg-primary" style={{ width: `${Math.max(5, (r.count / max) * 100)}%` }} />
            </span>
            <span className="tabular text-right font-semibold">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Positions et Search Console : courbe de clics avec repère de correction (démonstration). */
export function PositionsMock() {
  const clicks = [38, 41, 36, 44, 40, 47, 52, 49, 58, 61, 66, 64];
  const w = 320;
  const h = 110;
  const max = 70;
  const pts = clicks.map((v, i) => `${(i / (clicks.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  const markX = (6 / (clicks.length - 1)) * w;
  const rows = [
    { q: "plombier lyon 3", pos: "4,2", d: "+2,1" },
    { q: "fuite chauffe-eau lyon", pos: "7,8", d: "+3,4" },
    { q: "plombier urgence villeurbanne", pos: "12,5", d: "−0,6" },
  ];
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">Clics Google par semaine</p>
      <svg viewBox={`0 0 ${w} ${h + 18}`} className="mt-2 w-full" role="img" aria-label="Courbe de clics hebdomadaires qui monte après une correction marquée en semaine 7">
        <line x1={markX} x2={markX} y1="0" y2={h} stroke="var(--tone-warn-solid, #b45309)" strokeDasharray="3 3" />
        <text x={markX + 4} y="11" fontSize="10" fill="var(--tone-warn, #92400e)">Titres corrigés</text>
        <polyline points={pts} fill="none" stroke="var(--tone-brand-solid, #3730a3)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <text x="0" y={h + 14} fontSize="10" fill="currentColor" opacity=".6">Sem. 1</text>
        <text x={w} y={h + 14} fontSize="10" fill="currentColor" opacity=".6" textAnchor="end">Sem. 12</text>
      </svg>
      <table className="mt-3 w-full text-left text-[0.85rem]">
        <caption className="sr-only">Positions moyennes de trois requêtes</caption>
        <thead>
          <tr className="text-muted">
            <th scope="col" className="py-1 font-medium">Requête</th>
            <th scope="col" className="py-1 text-right font-medium">Position</th>
            <th scope="col" className="py-1 text-right font-medium">Sur 4 sem.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.q} className="border-t border-line/70">
              <td className="py-1.5">{r.q}</td>
              <td className="tabular py-1.5 text-right font-semibold">{r.pos}</td>
              <td className={`tabular py-1.5 text-right font-semibold ${r.d.startsWith("+") ? "text-[var(--tone-up)]" : "text-[var(--tone-down)]"}`}>{r.d}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[0.75rem] text-muted">Position : un chiffre plus petit est meilleur ; « + » = places gagnées.</p>
    </div>
  );
}

/** Performance : les trois Signaux Web essentiels et leurs seuils officiels (faits, pas des mesures). */
export function PerfThresholds() {
  const rows = [
    { k: "LCP", name: "Affichage du contenu principal", good: "≤ 2,5 s", bad: "> 4 s" },
    { k: "INP", name: "Réaction aux clics et à la saisie", good: "≤ 200 ms", bad: "> 500 ms" },
    { k: "CLS", name: "Stabilité de la mise en page", good: "≤ 0,1", bad: "> 0,25" },
  ];
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">Seuils de Google, au 75e centile des visites</p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.k}>
            <p className="flex items-baseline justify-between gap-3">
              <span>
                <b>{r.k}</b> <span className="text-[0.88rem] text-ink/75">{r.name}</span>
              </span>
            </p>
            <div className="mt-1.5 grid grid-cols-[1fr_1fr_1fr] overflow-hidden rounded-md text-center text-[0.75rem] font-semibold">
              <span className="bg-[var(--tone-up-bg)] py-1 text-[var(--tone-up)]">Bon {r.good}</span>
              <span className="bg-[var(--tone-warn-bg)] py-1 text-[var(--tone-warn)]">À améliorer</span>
              <span className="bg-[var(--tone-down-bg)] py-1 text-[var(--tone-down)]">Mauvais {r.bad}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.75rem] text-muted">Source : web.dev, « Web Vitals ». Données réelles via PageSpeed Insights et CrUX.</p>
    </div>
  );
}

/** GEO avancé : familles et niveau de preuve. */
export function GeoMock() {
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">Audit GEO : poids dans la note et niveau de preuve</p>
      <ul className="mt-3 space-y-2">
        {GEO_SECTIONS.map((g) => (
          <li key={g.id} className="grid grid-cols-[minmax(0,1fr)_3rem_5.5rem] items-center gap-2 text-[0.85rem]">
            <span className="truncate font-medium">{g.label}</span>
            <span className="tabular text-right text-muted">{g.weight} %</span>
            <span className="text-right text-[0.75rem] font-semibold text-ink/70">{g.evidence}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Agent de publication : un changement, avant / après, en attente de validation (démonstration). */
export function AgentMock() {
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[0.85rem] font-semibold text-muted">WordPress, page « Débouchage »</p>
        <span className="rounded-[var(--r-xs,6px)] bg-[var(--tone-warn-bg)] px-2 py-0.5 text-[0.75rem] font-semibold text-[var(--tone-warn)]">En attente de votre validation</span>
      </div>
      <dl className="mt-4 space-y-3 text-[0.9rem]">
        <div>
          <dt className="text-[0.78rem] font-semibold text-muted">Titre, avant</dt>
          <dd className="mt-0.5 rounded-lg bg-[var(--tone-down-bg)] px-3 py-2 line-through decoration-[var(--tone-down)]/60">Accueil – Plomberie Martin</dd>
        </div>
        <div>
          <dt className="text-[0.78rem] font-semibold text-muted">Titre, après</dt>
          <dd className="mt-0.5 rounded-lg bg-[var(--tone-up-bg)] px-3 py-2">Débouchage de canalisations à Lyon 3e – Plomberie Martin</dd>
        </div>
        <div>
          <dt className="text-[0.78rem] font-semibold text-muted">Balisage ajouté</dt>
          <dd className="mt-0.5 rounded-lg bg-canvas px-3 py-2 font-mono text-[0.8rem]">Plumber : nom, adresse, téléphone, horaires</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2 text-[0.85rem] font-semibold">
        <span className="rounded-lg bg-primary px-3 py-2 text-white">Valider et publier</span>
        <span className="rounded-lg px-3 py-2 text-ink/70 ring-1 ring-line">Modifier</span>
        <span className="rounded-lg px-3 py-2 text-ink/70 ring-1 ring-line">Télécharger</span>
      </div>
    </div>
  );
}

/** Baromètres : la méthode de mesure (12 questions × 4 IA × 3 passages). */
export function BarometreMock() {
  const steps = [
    { n: "12", t: "questions par baromètre, sans nom d’entreprise" },
    { n: "4", t: "IA : ChatGPT, Perplexity, Gemini, Claude" },
    { n: "3", t: "passages par question et par IA" },
    { n: "144", t: "réponses lues, noms fusionnés, marges calculées" },
  ];
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">Un baromètre, chaque mois</p>
      <ol className="mt-3 grid grid-cols-2 gap-3">
        {steps.map((s, i) => (
          <li key={s.t} className={`rounded-xl p-3 ${i === steps.length - 1 ? "bg-primary text-white" : "bg-canvas"}`}>
            <span className="font-display text-[1.8rem] font-bold leading-none tabular">{s.n}</span>
            <span className={`mt-1 block text-[0.8rem] leading-snug ${i === steps.length - 1 ? "text-on-deep" : "text-ink/75"}`}>{s.t}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Analyse 60 s : les phases de l'exploration (ce que l'utilisateur voit défiler). */
export function AnalyseMock() {
  const phases = [
    { t: "robots.txt et sitemaps lus", d: "2 s" },
    { t: "Jusqu’à 60 pages explorées, 4 à la fois au plus", d: "45 s max." },
    { t: `${SEO_CHECK_COUNT} contrôles SEO et audit GEO`, d: "en direct" },
    { t: "Vitesse mesurée par PageSpeed (si disponible)", d: "en parallèle" },
    { t: "Quelques questions posées aux IA", d: "en parallèle" },
    { t: "Verdict, scores et 5 priorités", d: "à la fin" },
  ];
  return (
    <div className={card}>
      <p className="text-[0.85rem] font-semibold text-muted">Ce que vous voyez défiler</p>
      <ol className="ui-cascade mt-3 space-y-2">
        {phases.map((p, i) => (
          <li key={p.t} className="flex items-center gap-3 text-[0.9rem]" style={{ ["--i" as string]: i }}>
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--tone-up-bg)] text-[var(--tone-up)]">
              <svg viewBox="0 0 16 16" width="12" height="12">
                <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">{p.t}</span>
            <span className="shrink-0 text-[0.78rem] text-muted">{p.d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
