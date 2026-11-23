import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, faqPageLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL } from "@/lib/seo/site";
import { getPlan, type PlanId } from "@/lib/plans";
import { PILOT_MONTHS, PILOT_SLOTS, PILOT_SLOTS_BY_SEGMENT, PILOT_SEGMENT_SHORT, type PilotSegment } from "@/lib/pilots/validate";
import { CONSENT_TEXT, listPilots, seatsBySegment, seatsTaken } from "@/lib/pilots/store";
import { PilotForm } from "./PilotForm";

const PATH = "/pilotes";
const TITLE = "Programme entreprises pilotes";
const DESCRIPTION = `Repéré cherche ${PILOT_SLOTS} entreprises pilotes : l'offre Accompagné offerte ${PILOT_MONTHS} mois contre vos retours. ${PILOT_SLOTS_BY_SEGMENT.local} commerces, ${PILOT_SLOTS_BY_SEGMENT.pme} PME, ${PILOT_SLOTS_BY_SEGMENT.ecommerce} e-commerces.`;
const UPDATED = "2026-11-23";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });
export const dynamic = "force-dynamic";

const euros = (cents: number) => `${(cents / 100).toLocaleString("fr-FR")} €`;
const OFFERS: { id: PlanId; who: string }[] = [
  { id: "local_accompagne_month", who: "Commerce local" },
  { id: "pme_accompagne_month", who: "PME / B2B" },
  { id: "ecom_accompagne_month", who: "E-commerce" },
];

const FAQ = [
  {
    q: "Pourquoi offrir l'offre Accompagné ?",
    a: "Parce que Repéré n'a pas encore de clients. Nous préférons apprendre avec dix entreprises réelles, mesurer honnêtement ce qui change, et corriger le produit avec elles avant d'ouvrir plus largement.",
  },
  {
    q: "Y a-t-il un engagement ou une carte bancaire à donner ?",
    a: `Non. Les ${PILOT_MONTHS} mois sont offerts sans carte bancaire. À la fin, vous choisissez librement : passer à une offre payante, revenir à l'offre gratuite Découverte, ou arrêter. Aucun prélèvement automatique.`,
  },
  {
    q: "Garantissez-vous un résultat ?",
    a: "Non. Personne ne contrôle ce que Google ou les IA affichent. Nous mesurons avant, pendant et après, avec les marges d'erreur, et nous vous montrons ce qui a bougé et ce qui n'a pas bougé.",
  },
  {
    q: "Mon avant/après sera-t-il publié ?",
    a: "Seulement avec votre accord écrit. Il est facultatif, vous relisez et validez chaque texte avant publication, et vous pouvez le retirer à tout moment. Sans accord écrit, rien n'est publié, même anonymisé.",
  },
  {
    q: "Comment les pilotes sont-ils choisis ?",
    a: `Pour avoir des cas variés : ${PILOT_SLOTS_BY_SEGMENT.local} commerces locaux, ${PILOT_SLOTS_BY_SEGMENT.pme} PME et ${PILOT_SLOTS_BY_SEGMENT.ecommerce} boutiques en ligne, dans plusieurs villes et plusieurs métiers. Le fondateur lit chaque candidature et répond à toutes, retenues ou non, sous 5 jours ouvrés.`,
  },
];

export default async function PilotesPage() {
  let taken = 0;
  let bySeg = seatsBySegment([]);
  try {
    const rows = await listPilots();
    taken = Math.min(PILOT_SLOTS, seatsTaken(rows));
    bySeg = seatsBySegment(rows);
  } catch {
    taken = 0;
  }
  const left = PILOT_SLOTS - taken;
  const prices = OFFERS.map((o) => ({ ...o, price: getPlan(o.id).priceCents }));
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Entreprises pilotes", path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED, datePublished: UPDATED }, { withContext: false }), about: orgRef() },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    faqPageLd(PATH, FAQ, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Entreprises pilotes" }]}
        title={`Repéré se lance : nous cherchons ${PILOT_SLOTS} entreprises pilotes`}
        lead={`Nous n'avons pas encore de clients, et nous préférons le dire. Pendant ${PILOT_MONTHS} mois, nous faisons le travail complet avec vous, gratuitement, et nous mesurons honnêtement ce qui change sur Google et dans les IA.`}
        aside={
          <div className="rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-32px_rgba(30,26,92,.35)] sm:p-8">
            <p className="font-display text-[3.4rem] font-bold leading-none text-primary sm:text-[4.2rem]">
              {left}
              <span className="ml-2 align-baseline text-[1.4rem] font-semibold text-ink sm:text-[1.6rem]">place{left > 1 ? "s" : ""} sur {PILOT_SLOTS}</span>
            </p>
            <ol aria-label={`${taken} place${taken > 1 ? "s" : ""} attribuée${taken > 1 ? "s" : ""}, ${left} libre${left > 1 ? "s" : ""}`} className="mt-5 grid grid-cols-5 gap-2">
              {Array.from({ length: PILOT_SLOTS }, (_, i) => (
                <li
                  key={i}
                  aria-hidden="true"
                  className={`aspect-square rounded-lg ${i < taken ? "bg-primary" : "border-2 border-dashed border-primary/35 bg-primary-bg"}`}
                />
              ))}
            </ol>
            <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-[0.88rem]" aria-label="Places par parcours">
              {(Object.keys(PILOT_SLOTS_BY_SEGMENT) as PilotSegment[]).map((s) => (
                <li key={s} className="rounded-lg bg-canvas px-2 py-2">
                  <span className="block font-display text-lg font-bold text-ink">
                    {bySeg[s].left}/{bySeg[s].slots}
                  </span>
                  <span className="text-muted">{PILOT_SEGMENT_SHORT[s]}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.95rem] text-ink/75">
              {taken === 0 ? "Aucune place attribuée pour l'instant." : `${taken} entreprise${taken > 1 ? "s" : ""} retenue${taken > 1 ? "s" : ""}.`} Compteur tenu à jour à partir des candidatures réellement retenues.
            </p>
            <a href="#candidature" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-primary px-5 font-semibold text-white hover:bg-primary-strong">
              Poser ma candidature
            </a>
          </div>
        }
      />

      <section aria-labelledby="echange" className="bg-canvas pb-16 sm:pb-20">
        <Container>
          <h2 id="echange" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">L&apos;échange, en clair</h2>
          <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
            <div className="border-t-4 border-primary pt-5">
              <h3 className="font-display text-xl font-bold">Ce que vous recevez</h3>
              <ul className="mt-4 space-y-3 text-[1.02rem]">
                <li><strong>L&apos;offre Accompagné offerte {PILOT_MONTHS} mois</strong>, sans carte bancaire ni engagement ensuite.</li>
                <li>L&apos;exploration complète de votre site, les contrôles SEO et ce que les IA peuvent en lire.</li>
                <li>Les corrections faites avec vous : rien n&apos;est publié sans votre validation, tout se défait.</li>
                <li>Un rapport mesuré au départ, à 30 jours et à 90 jours, avec les marges d&apos;erreur.</li>
                <li>Une ligne directe avec le fondateur pendant tout le programme.</li>
              </ul>
              <table className="mt-6 w-full text-left text-[0.95rem]">
                <caption className="mb-2 text-left text-muted">Valeur de l&apos;offre Accompagné au tarif public</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-2 font-semibold">Votre entreprise</th>
                    <th scope="col" className="py-2 text-right font-semibold">Par mois</th>
                    <th scope="col" className="py-2 text-right font-semibold">{PILOT_MONTHS} mois offerts</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((p) => (
                    <tr key={p.id} className="border-b border-line/70">
                      <td className="py-2">{p.who}</td>
                      <td className="py-2 text-right rp-num">{euros(p.price)}</td>
                      <td className="py-2 text-right font-semibold rp-num">{euros(p.price * PILOT_MONTHS)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[0.85rem] text-muted">
                Détail sur la page <Link href="/tarifs" className={linkClass}>Tarifs</Link>.
              </p>
            </div>
            <div className="border-t-4 border-accent pt-5">
              <h3 className="font-display text-xl font-bold">Ce que nous vous demandons</h3>
              <ul className="mt-4 space-y-3 text-[1.02rem]">
                <li><strong>Vos retours francs</strong> : un échange de 30 minutes par mois, et un mot quand quelque chose ne va pas.</li>
                <li><strong>Les accès utiles</strong> à votre site ou à votre fiche Google, pour que les corrections soient réellement faites.</li>
                <li>
                  <strong>Si vous le voulez</strong>, votre accord écrit pour publier votre avant/après chiffré à la fin. C&apos;est facultatif, vous relisez tout, et
                  vous pouvez le retirer quand vous voulez ; sans accord écrit, rien n&apos;est publié.
                </li>
              </ul>
              <h3 className="mt-10 font-display text-xl font-bold">Qui nous cherchons</h3>
              <ul className="mt-4 space-y-3 text-[1.02rem]">
                <li><strong>Des commerces locaux</strong> : boutique, restaurant, artisan, cabinet, avec une fiche Google et un site.</li>
                <li><strong>Des PME et entreprises B2B</strong> dont les clients comparent les fournisseurs en ligne.</li>
                <li><strong>Des boutiques en ligne</strong> (Shopify, WooCommerce, PrestaShop ou autre) avec un catalogue actif.</li>
                <li>Une entreprise en France, un site en français, et quelqu&apos;un de disponible pour échanger avec nous.</li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      <section aria-labelledby="deroule" className="bg-white py-16 sm:py-20">
        <Container>
          <h2 id="deroule" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Trois mesures, aux mêmes dates pour tous</h2>
          <p className="mt-3 max-w-[62ch] text-lg text-ink/75">
            Les scores viennent des mesures réelles de votre espace Repéré, jamais d&apos;une estimation. Si une mesure manque, nous l&apos;écrivons.
          </p>
          <ol className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              ["J0", "Point de départ", "Exploration du site, note SEO et GEO, questions posées aux IA. Nous choisissons ensemble les 5 corrections qui comptent."],
              ["J30", "Premières corrections", "Corrections publiées après votre validation, nouvelle mesure, échange de 30 minutes sur ce qui a bougé."],
              ["J90", "Bilan", "Mesure finale et comparaison à J0, avec les marges d'erreur. Vous décidez de la suite, et de la publication ou non du bilan."],
            ].map(([day, title, text]) => (
              <li key={day} className="relative border-l-2 border-primary/30 pl-5">
                <p className="font-display text-[2.2rem] font-bold leading-none text-primary">{day}</p>
                <h3 className="mt-3 font-display text-lg font-bold">{title}</h3>
                <p className="mt-2 text-[1rem] text-ink/80">{text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="candidature" aria-labelledby="candidature-h" className="scroll-mt-20 bg-canvas py-16 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
            <div>
              <h2 id="candidature-h" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Poser votre candidature</h2>
              <div className="relative mt-6 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-8">
                <PilotForm email={CONTACT_EMAIL} consentText={CONSENT_TEXT} />
              </div>
            </div>
            <aside className="space-y-8 lg:pt-16">
              <div>
                <h2 className="font-display text-xl font-bold">Ce qui se passe ensuite</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  Le fondateur lit chaque candidature et répond à toutes sous 5 jours ouvrés. Si la vôtre est retenue, un premier appel de 20 minutes fixe la date de J0.
                </p>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Pas encore prêt ?</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  L&apos;<Link href="/analyse" className={linkClass}>analyse gratuite</Link> de votre site prend 60 secondes, sans compte. La{" "}
                  <Link href="/demo" className={linkClass}>démo</Link> montre l&apos;application avec des données d&apos;exemple.
                </p>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Une question ?</h2>
                <p className="mt-2 text-[0.98rem]">
                  <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>{CONTACT_EMAIL}</a>
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>

      <section aria-labelledby="faq" className="bg-white py-16 sm:py-20">
        <Container size="narrow">
          <h2 id="faq" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Questions fréquentes</h2>
          <div className="mt-6 divide-y divide-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-primary transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 max-w-[68ch] text-ink/80">{f.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>
    </SitePage>
  );
}
