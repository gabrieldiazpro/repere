/**
 * Tarifs V5 : ce que chaque offre inclut en SEO et avec l'agent de publication. Toutes les valeurs sont lues dans
 * src/lib/entitlements.ts (qui fait foi) via v5OfferFacts ; rien n'est recopié à la main. Composant serveur.
 */
import { v5OfferFacts, type OfferSegment, type OfferTier } from "@/components/site/offer-facts";
import { SEO_CHECK_COUNT, GEO_SECTIONS } from "@/components/site/v5-blocks";

const TIERS: { id: OfferTier; name: string }[] = [
  { id: "decouverte", name: "Découverte" },
  { id: "essentiel", name: "Essentiel" },
  { id: "accompagne", name: "Accompagné" },
];
const SEGS: { id: OfferSegment; name: string }[] = [
  { id: "local", name: "commerce local" },
  { id: "pme", name: "PME" },
  { id: "ecommerce", name: "e-commerce" },
];

const nf = (n: number) => n.toLocaleString("fr-FR");

/** Valeur unique si identique pour les 3 parcours, sinon détail par parcours. */
function bySegment(tier: OfferTier, pick: (s: OfferSegment) => string): string {
  const vals = SEGS.map((s) => pick(s.id));
  if (vals.every((v) => v === vals[0])) return vals[0];
  const groups = new Map<string, string[]>();
  SEGS.forEach((s, i) => groups.set(vals[i], [...(groups.get(vals[i]) ?? []), s.name]));
  return [...groups.entries()].map(([v, segs]) => `${v} (${segs.join(" et ")})`).join(" ; ");
}

export function seoOfferRows(): { label: string; cells: string[] }[] {
  const f = (t: OfferTier, s: OfferSegment) => v5OfferFacts(s, t);
  return [
    { label: "Analyse du site", cells: TIERS.map((t) => bySegment(t.id, (s) => `${nf(f(t.id, s).pages)} pages, ${f(t.id, s).reanalysis}`)) },
    { label: "Audit SEO et GEO", cells: TIERS.map(() => `${SEO_CHECK_COUNT} contrôles SEO, ${GEO_SECTIONS.length} familles GEO, 5 priorités`) },
    { label: "Search Console et PageSpeed", cells: TIERS.map(() => "Inclus") },
    {
      label: "Positions Google suivies",
      cells: TIERS.map((t) => bySegment(t.id, (s) => (f(t.id, s).keywords > 0 ? `${nf(f(t.id, s).keywords)} mots-clés, ${f(t.id, s).devices}` : "Non incluses"))),
    },
    { label: "Liens entrants", cells: TIERS.map((t) => bySegment(t.id, (s) => (f(t.id, s).backlinks ? "Inclus" : "Non inclus"))) },
    {
      label: "Agent de publication",
      cells: TIERS.map((t) =>
        bySegment(t.id, (s) => (f(t.id, s).apply ? `Appliqué après validation, ${nf(f(t.id, s).changeSets)} séries par mois` : "Corrections à télécharger")),
      ),
    },
  ];
}

export function SeoOfferTable() {
  const rows = seoOfferRows();
  return (
    <div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.08)]">
        <table className="w-full min-w-[40rem] border-collapse text-left text-[0.93rem]">
          <caption className="sr-only">Ce que chaque offre inclut en SEO et avec l&apos;agent de publication</caption>
          <thead>
            <tr className="border-b border-line/70">
              <td className="w-[22%] p-4" />
              {TIERS.map((t) => (
                <th key={t.id} scope="col" className="p-4 font-display text-[1.05rem] font-semibold">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-line/50 last:border-0">
                <th scope="row" className="p-4 align-top font-semibold">
                  {r.label}
                </th>
                {r.cells.map((c, i) => (
                  <td key={i} className={`p-4 align-top ${/^Non|à télécharger/.test(c) ? "text-muted" : "text-ink/85"}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[0.85rem] text-muted">
        Positions et liens entrants : données d&apos;un fournisseur payant (DataForSEO), avec un plafond de dépense par compte ; tant qu&apos;il
        n&apos;est pas activé, l&apos;écran l&apos;indique au lieu d&apos;afficher des chiffres. Search Console et PageSpeed sont des données
        Google gratuites. L&apos;analyse publique sans compte explore 60 pages.
      </p>
    </div>
  );
}
