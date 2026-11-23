/**
 * V9 — /rendez-vous : « Réserver une démo » pour les offres Accompagné et Agence.
 * Si NEXT_PUBLIC_BOOKING_URL est défini (Cal.com ou équivalent), bouton vers l'agenda en ligne ; le formulaire reste
 * disponible. Sinon : demande enregistrée, e-mail au fondateur, réponse automatique honnête (sous 1 jour ouvré).
 */
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL } from "@/lib/seo/site";
import { bookingToolName, bookingUrl } from "@/lib/meetings/booking";
import { isMeetingOffer, isMeetingSegment, slotBounds } from "@/lib/meetings/validate";
import { MEETING_CONSENT_TEXT } from "@/lib/meetings/store";
import { MeetingForm } from "./MeetingForm";

const PATH = "/rendez-vous";
const TITLE = "Réserver une démo";
const DESCRIPTION = "Une démo de 30 minutes des offres Accompagné et Agence de Repéré, sur votre site ou celui d'un client. Réponse sous 1 jour ouvré.";
const UPDATED = "2026-11-23";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });
export const dynamic = "force-dynamic";

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RendezVousPage({ searchParams }: { searchParams: Promise<{ offre?: string | string[]; segment?: string | string[] }> }) {
  const sp = await searchParams;
  const offre = first(sp.offre);
  const seg = first(sp.segment);
  const defaultOffer = isMeetingOffer(offre) ? offre : undefined;
  const defaultSegment = isMeetingSegment(seg) ? seg : undefined;
  const booking = bookingUrl();
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: TITLE, path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED, datePublished: UPDATED }, { withContext: false }), about: orgRef() },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);
  const agency = defaultOffer === "agence";

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: TITLE }]}
        title="Réserver une démo de 30 minutes"
        lead={
          agency
            ? "Nous ouvrons avec vous la démo agence : tableau multi-clients, marque blanche, validation par vos clients, API et MCP. Sur le site d'un de vos clients si vous le souhaitez."
            : "Nous regardons ensemble votre site comme Google et les IA le lisent, ce que l'offre Accompagné corrigerait, et ce qu'elle ne peut pas promettre."
        }
        aside={
          <div className="rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-32px_rgba(30,26,92,.35)] sm:p-7">
            <p className="font-display text-lg font-bold">Pendant la démo</p>
            <ol className="mt-4 space-y-3">
              {[
                ["10 min", "Votre site, analysé en direct : ce que Google et les IA en comprennent."],
                ["15 min", agency ? "Le parcours agence sur des comptes d'exemple, puis vos questions." : "Les corrections proposées, la validation, le suivi mesuré avec ses marges d'erreur."],
                ["5 min", "Les tarifs, l'engagement, et si l'offre vous convient. Ou pas."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-3">
                  <span className="w-16 shrink-0 font-display font-bold text-primary tabular">{t}</span>
                  <span className="text-[0.97rem] text-ink/80">{d}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[0.85rem] text-muted">Avec le fondateur, en visioconférence. Gratuit et sans engagement.</p>
          </div>
        }
      />

      <section id="demande" aria-labelledby="demande-h" className="scroll-mt-20 bg-canvas pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
            <div>
              {booking ? (
                <div className="mb-8 rounded-[20px] bg-primary-deep p-6 text-white on-dark sm:p-8">
                  <h2 className="font-display text-[1.5rem] font-bold leading-tight text-white">Choisissez directement un créneau libre</h2>
                  <p className="mt-2 text-on-deep">L&apos;agenda en ligne ({bookingToolName(booking)}) montre nos disponibilités réelles et confirme le rendez-vous tout de suite.</p>
                  <a href={booking} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "lg", variant: "light", className: "mt-5" })}>
                    Ouvrir l&apos;agenda<span className="sr-only"> (nouvel onglet)</span>
                  </a>
                </div>
              ) : null}
              <h2 id="demande-h" className="font-display text-[1.75rem] font-bold leading-tight sm:text-[2.2rem]">
                {booking ? "Ou proposez vos créneaux" : "Proposez vos créneaux"}
              </h2>
              <p className="mt-2 text-ink/75">Nous revenons vers vous sous 1 jour ouvré pour confirmer l&apos;un d&apos;eux, ou en proposer un autre.</p>
              <div className="relative mt-6 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-8">
                <MeetingForm email={CONTACT_EMAIL} consentText={MEETING_CONSENT_TEXT} bounds={slotBounds()} defaultOffer={defaultOffer} defaultSegment={defaultSegment} bookingUrl={booking} />
              </div>
            </div>
            <aside className="space-y-8 lg:pt-14">
              <div>
                <h2 className="font-display text-xl font-bold">Pas besoin de démo ?</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  L&apos;<Link href="/analyse" className={linkClass}>analyse gratuite</Link> de votre site prend 60 secondes, sans compte. La{" "}
                  <Link href="/demo" className={linkClass}>démo libre</Link> ouvre l&apos;application avec des données d&apos;exemple.
                </p>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Les offres</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  <Link href="/tarifs" className={linkClass}>Tarifs</Link>, <Link href="/agences" className={linkClass}>offre Agence</Link> et{" "}
                  <Link href="/partenaires" className={linkClass}>programme partenaires</Link>.
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
    </SitePage>
  );
}
