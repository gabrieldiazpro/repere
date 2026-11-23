/**
 * V9 — /partenaires : programme partenaires (agences, plateformes, réseaux prescripteurs, écoles et formateurs),
 * annuaire public (vide tant qu'aucun partenaire réel n'est accepté ET publié avec son accord) et candidature.
 * Règles : aucun partenaire inventé ; les plateformes sont « compatibles », jamais « partenaires officiels » ;
 * conditions chiffrées présentées comme les conditions proposées, confirmées par écrit à l'acceptation.
 */
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, faqPageLd, graph, orgRef, webPageLd } from "@/lib/seo/jsonld";
import { CONTACT_EMAIL } from "@/lib/seo/site";
import {
  COMMISSION_BASIS,
  COMPATIBILITY_NOTE,
  COMPATIBLE_PLATFORMS,
  FAMILIES,
  PARTNER_FAMILIES,
  isPartnerFamily,
  pct,
  type PartnerFamily,
} from "@/lib/partners/program";
import { LIST_OK_TEXT, PARTNER_CONSENT_TEXT, listPartners, publicDirectory } from "@/lib/partners/store";
import { PartnerForm } from "./PartnerForm";

const PATH = "/partenaires";
const TITLE = "Programme partenaires";
const DESCRIPTION =
  "Agences web, plateformes, experts-comptables, CCI, fédérations, écoles : devenez partenaire de Repéré. Commission sur les paiements réels, lien de parrainage, conditions écrites.";
const UPDATED = "2026-11-23";

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });
export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "Comment la commission est-elle calculée ?",
    a: `Sur les paiements réellement encaissés par Stripe pour les clients venus par votre lien, hors taxes et hors remboursements, pendant la durée convenue à partir de leur premier paiement. Nous vous envoyons le relevé ; vous nous adressez une facture ; nous payons par virement. Rien n'est versé automatiquement.`,
  },
  {
    q: "Comment savez-vous qu'un client vient de moi ?",
    a: "Votre lien se termine par ?ref= suivi de votre code. La page d'arrivée est retenue pendant la visite, sans cookie ni stockage dans le navigateur, puis enregistrée avec l'inscription. Si la personne ferme l'onglet et revient plus tard sans votre lien, nous ne pouvons pas le savoir : dites-le-nous et nous vérifierons ensemble.",
  },
  {
    q: "Puis-je promettre des résultats à mes clients ?",
    a: "Non. Personne ne contrôle ce que Google ou les IA affichent. Repéré mesure, avec des marges d'erreur, et fait les corrections après validation. Un partenaire qui promet une position ou une citation sort du programme.",
  },
  {
    q: "Shopify, WordPress ou Wix sont-ils vos partenaires ?",
    a: "Non. Repéré est compatible avec ces outils grâce à leurs interfaces publiques, sans accord avec leurs éditeurs. Si un éditeur devient partenaire officiel, nous l'annoncerons avec son accord écrit.",
  },
  {
    q: "Pourquoi l'annuaire est-il vide ?",
    a: "Parce que le programme vient d'ouvrir et que nous n'y inscrivons que de vrais partenaires, acceptés et d'accord pour y figurer. Aucune structure n'y est ajoutée pour faire nombre.",
  },
  {
    q: "Ma CCI ne peut pas percevoir de commission : est-ce un problème ?",
    a: "Non. Nous proposons alors un atelier gratuit pour vos adhérents, et le partage des baromètres de votre territoire quand ils sont mesurés. La forme est convenue par écrit avec vous.",
  },
];

const FAMILY_ANCHOR: Record<PartnerFamily, string> = { agence: "agences", plateforme: "plateformes", prescripteur: "prescripteurs", formation: "ecoles" };

export default async function PartenairesPage({ searchParams }: { searchParams: Promise<{ famille?: string | string[] }> }) {
  const sp = await searchParams;
  const famParam = Array.isArray(sp.famille) ? sp.famille[0] : sp.famille;
  const defaultFamily = isPartnerFamily(famParam) ? famParam : undefined;
  let directory: ReturnType<typeof publicDirectory> = [];
  try {
    directory = publicDirectory(await listPartners());
  } catch {
    directory = [];
  }
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Partenaires", path: PATH },
  ];
  const jsonLd = graph([
    { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: UPDATED, datePublished: UPDATED }, { withContext: false }), about: orgRef() },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
    faqPageLd(PATH, FAQ, { withContext: false }),
  ]);

  return (
    <SitePage jsonLd={jsonLd}>
      <PageHero
        crumbs={[{ name: "Accueil", href: "/" }, { name: "Partenaires" }]}
        title="Travaillons ensemble pour rendre les entreprises visibles"
        lead="Agences, plateformes, réseaux de conseil, écoles : quatre façons de devenir partenaire. Des conditions écrites, une commission calculée sur des paiements réels, et jamais de promesse de résultat faite à vos clients."
        aside={
          <div className="rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line),0_24px_48px_-32px_rgba(30,26,92,.35)] sm:p-7">
            <p className="font-display text-lg font-bold">Ce que chaque partenaire gagne</p>
            <ul className="mt-4 divide-y divide-line">
              {PARTNER_FAMILIES.map((id) => {
                const f = FAMILIES[id];
                return (
                  <li key={id}>
                    <a href={`#${FAMILY_ANCHOR[id]}`} className="group flex min-h-14 items-center justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block font-semibold group-hover:underline">{f.label}</span>
                        <span className="block text-[0.88rem] text-ink/65">{f.commission ? `${f.commission.months} mois de commission sur les paiements HT` : "Intégration et contenus communs"}</span>
                      </span>
                      <span className={`shrink-0 font-display text-[1.7rem] font-bold leading-none tabular ${f.commission ? "text-primary" : "text-ink/40"}`}>
                        {f.commission ? pct(f.commission.rate) : "0 %"}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[0.85rem] text-muted">Conditions proposées à l&apos;ouverture du programme, confirmées par écrit à l&apos;acceptation de votre candidature.</p>
          </div>
        }
      >
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <a href="#candidature" className={buttonClasses({ size: "lg" })}>Poser ma candidature</a>
          <Link href="/rendez-vous?offre=agence" className={buttonClasses({ size: "lg", variant: "secondary" })}>Réserver une démo</Link>
        </div>
      </PageHero>

      {PARTNER_FAMILIES.map((id, i) => {
        const f = FAMILIES[id];
        return (
          <section key={id} id={FAMILY_ANCHOR[id]} aria-labelledby={`fam-${id}`} className={`scroll-mt-20 py-16 sm:py-20 ${i % 2 === 0 ? "bg-white" : "bg-canvas"}`}>
            <Container>
              <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)] lg:gap-14">
                <div>
                  <h2 id={`fam-${id}`} className="font-display text-[1.75rem] font-bold leading-tight sm:text-[2.2rem]">{f.label}</h2>
                  <p className="mt-3 text-ink/75">{f.who}</p>
                  {f.commission ? (
                    <p className="mt-5 inline-flex items-baseline gap-2 rounded-xl bg-primary-bg px-3.5 py-2 text-primary">
                      <span className="font-display text-xl font-bold tabular">{pct(f.commission.rate)}</span>
                      <span className="text-[0.92rem]">pendant {f.commission.months} mois</span>
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-8 md:grid-cols-3">
                  <div className="border-t-4 border-primary pt-4">
                    <h3 className="font-display text-lg font-bold">Ce que vous gagnez</h3>
                    <ul className="mt-3 space-y-2.5 text-[0.98rem]">{f.gains.map((g) => <li key={g}>{g}</li>)}</ul>
                  </div>
                  <div className="border-t-4 border-accent pt-4">
                    <h3 className="font-display text-lg font-bold">Ce que nous attendons</h3>
                    <ul className="mt-3 space-y-2.5 text-[0.98rem]">{f.expect.map((g) => <li key={g}>{g}</li>)}</ul>
                  </div>
                  <div className="border-t-4 border-ink/15 pt-4">
                    <h3 className="font-display text-lg font-bold">Comment ça marche</h3>
                    {id === "plateforme" ? (
                      <ul className="mt-3 space-y-2.5 text-[0.98rem]">{f.how.map((g) => <li key={g}>{g}</li>)}</ul>
                    ) : (
                      <ol className="mt-3 space-y-2.5 text-[0.98rem]">
                        {f.how.map((g, n) => (
                          <li key={g} className="flex gap-2.5">
                            <span aria-hidden="true" className="tabular font-display font-bold text-primary">{n + 1}.</span>
                            <span>{g}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              </div>
              {id === "plateforme" ? (
                <div className="mt-10 rounded-2xl bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-6">
                  <p className="font-semibold">Compatible aujourd&apos;hui avec</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {COMPATIBLE_PLATFORMS.map((p) => (
                      <li key={p} className="rounded-full border border-line px-3.5 py-1.5 text-[0.95rem]">{p}</li>
                    ))}
                  </ul>
                  <p className="mt-4 max-w-[75ch] text-[0.88rem] text-muted">{COMPATIBILITY_NOTE}</p>
                  <p className="mt-2 text-[0.95rem]">
                    Le détail par outil : <Link href="/integrations" className={linkClass}>Intégrations</Link>.
                  </p>
                </div>
              ) : null}
              {id === "agence" ? (
                <p className="mt-8 text-[0.98rem]">
                  L&apos;offre revendeur en détail : <Link href="/agences" className={linkClass}>Repéré pour les agences</Link> et{" "}
                  <Link href="/developpeurs" className={linkClass}>l&apos;API et le serveur MCP</Link>.
                </p>
              ) : null}
            </Container>
          </section>
        );
      })}

      <section aria-labelledby="suivi" className="bg-primary-deep py-16 text-white on-dark sm:py-20">
        <Container>
          <h2 id="suivi" className="font-display text-[1.75rem] font-bold leading-tight text-white sm:text-[2.2rem]">Un lien, des paiements réels, une facture</h2>
          <ol className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              ["Votre lien", "Un code à vous, à ajouter à n'importe quelle page du site : repere-ia.fr/?ref=votre-code. Pas de cookie : la page d'arrivée est retenue pendant la visite et enregistrée à l'inscription."],
              ["Le suivi", "Nous suivons les inscriptions venues de votre lien et les paiements que Stripe a réellement encaissés pour elles. Aucune estimation."],
              ["Le versement", `Chaque trimestre, le relevé ; vous facturez, nous payons par virement. ${COMMISSION_BASIS}`],
            ].map(([t, d], n) => (
              <li key={t} className="border-l-2 border-white/25 pl-5">
                <p className="font-display text-[1.6rem] font-bold leading-none text-accent tabular">{n + 1}</p>
                <h3 className="mt-2 font-display text-lg font-bold text-white">{t}</h3>
                <p className="mt-1.5 text-on-deep">{d}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="annuaire" aria-labelledby="annuaire-h" className="scroll-mt-20 bg-white py-16 sm:py-20">
        <Container>
          <h2 id="annuaire-h" className="font-display text-[1.75rem] font-bold leading-tight sm:text-[2.2rem]">Annuaire des partenaires</h2>
          {directory.length === 0 ? (
            <div className="mt-8 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <ul aria-hidden="true" className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((n) => (
                  <li key={n} className={`flex h-24 items-center justify-center rounded-2xl border-2 border-dashed ${n === 0 ? "border-primary/60 bg-primary-bg" : "border-line"}`}>
                    {n === 0 ? <span className="font-display text-lg font-bold text-primary">Vous ?</span> : null}
                  </li>
                ))}
              </ul>
              <div>
                <p className="font-display text-xl font-bold">Aucun partenaire pour l&apos;instant : devenez le premier.</p>
                <p className="mt-2 max-w-[60ch] text-ink/75">
                  Le programme vient d&apos;ouvrir. Seuls y figurent les partenaires réellement acceptés qui ont donné leur accord ; personne n&apos;est ajouté pour faire nombre.
                </p>
                <a href="#candidature" className={buttonClasses({ className: "mt-5" })}>Poser ma candidature</a>
              </div>
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {directory.map((p) => (
                <li key={p.id} className="rounded-2xl bg-canvas p-5">
                  <p className="font-display text-lg font-bold">{p.company}</p>
                  <p className="mt-1 text-[0.92rem] text-ink/70">{FAMILIES[p.family].label}{p.city ? `, ${p.city}` : ""}</p>
                  <a href={p.website} rel="noopener nofollow" className={`${linkClass} mt-3 inline-block text-[0.95rem]`}>{p.domain}</a>
                </li>
              ))}
            </ul>
          )}
        </Container>
      </section>

      <section id="candidature" aria-labelledby="candidature-h" className="scroll-mt-20 bg-canvas py-16 sm:py-20">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] lg:gap-16">
            <div>
              <h2 id="candidature-h" className="font-display text-[1.9rem] font-bold leading-tight sm:text-[2.4rem]">Poser votre candidature</h2>
              <div className="relative mt-6 rounded-[20px] bg-white p-5 shadow-[0_0_0_1px_var(--color-line)] sm:p-8">
                <PartnerForm email={CONTACT_EMAIL} consentText={PARTNER_CONSENT_TEXT} listOkText={LIST_OK_TEXT} defaultFamily={defaultFamily} />
              </div>
            </div>
            <aside className="space-y-8 lg:pt-16">
              <div>
                <h2 className="font-display text-xl font-bold">Ce qui se passe ensuite</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  Le fondateur lit chaque candidature et répond à toutes sous 5 jours ouvrés. Si la vôtre est acceptée, vous recevez vos conditions par écrit et votre lien de parrainage.
                </p>
              </div>
              <div>
                <h2 className="font-display text-xl font-bold">Voir l&apos;outil d&apos;abord ?</h2>
                <p className="mt-2 text-[0.98rem] text-ink/80">
                  La <Link href="/demo" className={linkClass}>démo</Link> s&apos;ouvre sans compte. Pour une présentation guidée de 30 minutes :{" "}
                  <Link href="/rendez-vous?offre=agence" className={linkClass}>réserver une démo</Link>.
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
