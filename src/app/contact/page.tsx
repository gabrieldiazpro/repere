import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { ContactForm } from "@/components/pages/ContactForm";
import { Counter } from "@/components/motion/Counter";
import { Icon } from "@/components/app/icons";
import { CONTACT_SUBJECTS, type ContactSubject } from "@/components/pages/contact";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL } from "@/lib/seo/site";

const PATH = "/contact";
const TITLE = "Contacter Repéré";
const DESCRIPTION = "Une question, un devis, un partenariat agence ? Écrivez-nous : réponse sous 48 heures ouvrées, en français.";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

type SP = Record<string, string | string[] | undefined>;

export default async function ContactPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.sujet) ? sp.sujet[0] : sp.sujet;
  const initial = CONTACT_SUBJECTS.find((s) => s.id === raw)?.id as ContactSubject | undefined;
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Contact", path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: "ContactPage", dateModified: "2026-11-09" }, { withContext: false }), about: orgRef() },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Contact" }]}
        title="Écrivez-nous"
        lead="Une personne vous répond sous 48 heures ouvrées, en français. Pas de rappel commercial non demandé."
        aside={
          <div data-reveal="" className="rounded-[20px] bg-white p-6 shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-32px_rgba(30,26,92,.35)] sm:p-8">
            <p className="font-display text-[3.4rem] font-bold leading-none text-primary sm:text-[4.2rem]">
              <Counter value={48} suffix={"\u00a0h"} />
            </p>
            <p className="mt-2 font-semibold">pour vous répondre, en jours ouvrés</p>
            <ul className="mt-5 grid gap-3 text-[0.98rem] text-ink/80">
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-bg text-primary" aria-hidden="true"><Icon name="users" size={16} /></span>
                Une personne, pas un robot
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-bg text-primary" aria-hidden="true"><Icon name="flag" size={16} /></span>
                En français
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-bg text-primary" aria-hidden="true"><Icon name="bell" size={16} /></span>
                Aucun rappel commercial non demandé
              </li>
            </ul>
          </div>
        }
      />
      <section aria-label="Formulaire de contact" className="bg-canvas pb-16 sm:pb-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
            <div className="relative rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-8">
              <ContactForm email={CONTACT_EMAIL} initialSubject={initial} />
            </div>
            <aside className="space-y-8">
              <div>
                <h2 className="font-display text-xl font-bold">Par e-mail</h2>
                <p className="mt-2">
                  <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
                    {CONTACT_EMAIL}
                  </a>
                </p>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Avant d&apos;écrire</h2>
                <ul className="mt-2 space-y-2 text-[0.98rem]">
                  <li>
                    <Link href="/aide" className={linkClass}>Le centre d&apos;aide</Link> répond aux questions courantes.
                  </li>
                  <li>
                    <Link href="/demo" className={linkClass}>La démo</Link> montre l&apos;application sans inscription.
                  </li>
                  <li>
                    <Link href="/tarifs" className={linkClass}>Les tarifs</Link> sont publics et nets.
                  </li>
                </ul>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Déjà client ?</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  Répondez simplement à n&apos;importe quel e-mail de Repéré. Votre espace : <Link href="/connexion" className={linkClass}>connexion</Link>.
                </p>
              </div>
            </aside>
          </div>
        </Container>
      </section>
    </SitePage>
  );
}
