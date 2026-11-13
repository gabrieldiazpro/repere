import { euros, tiersFor, plansFor, VAT_NOTICE } from "./plans-v2";
import { fmtDate } from "@/lib/seo";

/**
 * « Tous les prix en un coup d'œil » : tableau statique rendu côté serveur, toujours visible.
 * Les IA citent volontiers les tableaux ; le balisage Offer de /tarifs s'y adosse (mêmes chiffres).
 */
const SEGS = [
  { id: "local", label: "Commerce local" },
  { id: "pme", label: "PME et services B2B" },
  { id: "ecommerce", label: "E-commerce" },
] as const;

const price = (cents?: number, suffix = "") => (cents === undefined ? "–" : cents === 0 ? "Gratuit" : `${euros(cents)}${suffix}`);

export function PriceTable({ updated }: { updated: string }) {
  const agency = plansFor("agence").find((p) => p.id === "agency_month");
  return (
    <div className="relative overflow-x-auto rounded-2xl bg-white shadow-[0_0_0_1px_rgba(27,31,46,.09)]">
      <table className="w-full min-w-[40rem] border-collapse text-left text-[0.95rem]">
        <caption className="px-5 pt-4 pb-2 text-left text-[0.9rem] text-muted">
          Prix nets, {VAT_NOTICE}. En vigueur au <time dateTime={updated}>{fmtDate(updated)}</time>.
        </caption>
        <thead>
          <tr className="bg-canvas">
            <th scope="col" className="px-5 py-3 font-display font-semibold">Parcours</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Test</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Audit approfondi</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Essentiel</th>
            <th scope="col" className="px-4 py-3 font-display font-semibold">Accompagné (on fait le travail)</th>
          </tr>
        </thead>
        <tbody>
          {SEGS.map((s) => {
            const t = tiersFor(s.id);
            return (
              <tr key={s.id} className="border-t border-line/70 align-top">
                <th scope="row" className="px-5 py-3 font-semibold">{s.label}</th>
                <td className="px-4 py-3">{price(t.free?.priceCents)}</td>
                <td className="tabular px-4 py-3">{price(t.deep?.priceCents, ", une fois")}</td>
                <td className="tabular px-4 py-3">
                  {price(t.essentielMonth?.priceCents, "/mois")}
                  {t.essentielYear ? <span className="block text-[0.85rem] text-muted">ou {euros(t.essentielYear.priceCents)}/an</span> : null}
                </td>
                <td className="tabular px-4 py-3">
                  {price(t.accompagne?.priceCents, "/mois")}
                  <span className="block text-[0.85rem] text-muted">3 mois minimum</span>
                </td>
              </tr>
            );
          })}
          {agency ? (
            <tr className="border-t border-line/70 align-top">
              <th scope="row" className="px-5 py-3 font-semibold">Agences</th>
              <td className="px-4 py-3" colSpan={4}>
                Partenaire : 30 % de commission pendant 12 mois, sans abonnement. Agence (marque blanche) : {euros(agency.priceCents)}/mois. Ouverture prochaine,
                sur liste d&apos;attente.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
