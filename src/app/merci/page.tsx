import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { LogoMark } from "@/components/site/Logo";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { PLANS } from "@/lib/plans";
import { getSession } from "@/lib/auth";
import { findSitePlan } from "@/components/site/plans-v2";
import { merciSteps, purchaseKind, spaceHref } from "@/components/pages/merci";

export const metadata: Metadata = {
  title: "Merci",
  description: "Confirmation de votre commande Repéré et prochaines étapes.",
  alternates: { canonical: "/merci" },
  robots: { index: false, follow: false },
};

type SP = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function isLoggedIn(): Promise<boolean> {
  try {
    return Boolean(await getSession());
  } catch {
    return false;
  }
}

export default async function MerciPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const demo = first(sp.demo) === "1";
  const planId = first(sp.plan);
  const auditId = first(sp.auditId) ?? first(sp.audit);
  const v2 = findSitePlan(planId);
  const v1 = planId && !v2 ? PLANS.find((p) => p.id === planId) : undefined;
  const plan = v2 ?? v1;
  const kind = purchaseKind(plan);
  const loggedIn = await isLoggedIn();
  const steps = merciSteps(kind, { loggedIn });
  const free = kind === "decouverte";

  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas">
        <Container size="narrow" className="py-16 sm:py-24">
          {demo ? (
            <p role="status" className="mb-8 rounded-xl bg-warning-bg px-4 py-3 text-[0.95rem] font-medium text-warning-ink">
              Mode démonstration : aucun paiement réel n&apos;a été effectué.
            </p>
          ) : null}

          <div className="viewfinder mx-2.5 sm:mx-0" style={{ ["--vf-color" as string]: "#3730A3" }}>
            <span className="vf-b" aria-hidden="true" />
            <div className="rounded-[1.25rem] bg-white p-6 text-center ring-1 ring-line sm:p-10">
              <LogoMark size={56} className="mx-auto" />
              <h1 className="mt-6 text-3xl font-bold sm:text-5xl">{free ? "Bienvenue, votre compte est prêt." : "Merci, c'est confirmé."}</h1>
              <p className="mx-auto mt-4 max-w-lg text-lg text-ink/80">
                {demo
                  ? "Voici ce que verra votre client après un paiement réussi."
                  : free
                    ? "Votre offre Découverte est active, sans limite de durée."
                    : "Votre paiement est confirmé. Vous recevez votre facture par e-mail."}
                {plan && !free ? (
                  <>
                    {" "}
                    Offre choisie : <strong className="font-semibold text-ink">{plan.name}</strong>.
                  </>
                ) : null}
              </p>

              <ol className="mx-auto mt-8 max-w-md space-y-3 text-left">
                {steps.map((s, i) => (
                  <li key={s} className="flex gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href={spaceHref(loggedIn)} className={buttonClasses({ size: "lg" })}>
                  Ouvrir mon espace
                </Link>
                {auditId ? (
                  <Link href={`/rapport/${encodeURIComponent(auditId)}`} className={buttonClasses({ size: "lg", variant: "secondary" })}>
                    Revoir mon rapport
                  </Link>
                ) : (
                  <Link href="/aide" className={buttonClasses({ size: "lg", variant: "secondary" })}>
                    Bien démarrer
                  </Link>
                )}
              </div>
              {!loggedIn ? (
                <p className="mt-4 text-[0.92rem] text-muted">
                  Pas de lien reçu ? Vérifiez vos indésirables, ou demandez-en un nouveau sur la page de connexion.
                </p>
              ) : null}
            </div>
          </div>

          <p className="mt-10 text-center text-sm text-muted">
            Une question sur votre commande ? Répondez simplement à l&apos;e-mail de confirmation, ou{" "}
            <Link href="/contact" className="font-semibold text-primary underline underline-offset-4">
              écrivez-nous
            </Link>
            .
          </p>
        </Container>
      </main>
      <Footer />
    </>
  );
}
