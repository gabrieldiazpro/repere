import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { Reveal } from "@/components/motion/Reveal";
import { CheckIcon } from "@/components/site/blocks";
import { CtaBand, MainActions, PageHero, SitePage, linkClass } from "@/components/pages/ui";
import { USE_CASES, USE_CASES_UPDATED, getUseCase, casUsagePath } from "@/components/pages/cas-usage-data";
import { DEMO_ACCOUNTS, demoAppHref } from "@/components/pages/demo-data";
import { pageMeta } from "@/lib/seo/meta";
import { breadcrumbListLd, graph, webPageLd } from "@/lib/seo/jsonld";

type Params = { metier: string };

export const dynamicParams = false;

export function generateStaticParams(): Params[] {
  return USE_CASES.map((u) => ({ metier: u.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const u = getUseCase((await params).metier);
  if (!u) return {};
  return pageMeta({ path: casUsagePath(u.slug), title: u.title, description: u.description });
}

export default async function CasUsageMetierPage({ params }: { params: Promise<Params> }) {
  const u = getUseCase((await params).metier);
  if (!u) notFound();
  const path = casUsagePath(u.slug);
  const crumbs = [
    { name: "Accueil", path: "/" },
    { name: "Cas d'usage", path: "/cas-usage" },
    { name: u.name, path },
  ];
  const jsonLd = graph([
    webPageLd(path, { name: u.title, description: u.description, dateModified: USE_CASES_UPDATED }, { withContext: false }),
    breadcrumbListLd(path, crumbs, { withContext: false }),
  ]);
  const demo = DEMO_ACCOUNTS.find((a) => a.id === u.demoAccount);
  const others = USE_CASES.filter((x) => x.slug !== u.slug);

  return (
    <SitePage jsonLd={jsonLd} segment={u.segment}>
      <PageHero crumbs={[{ name: "Accueil", href: "/" }, { name: "Cas d'usage", href: "/cas-usage" }, { name: u.name }]} title={u.title} lead={u.lead}>
        <MainActions segment={u.segment} />
      </PageHero>

      <section aria-labelledby="questions-title" className="bg-white py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <h2 id="questions-title" className="text-[1.8rem] font-bold leading-tight sm:text-[2.2rem]">
                Des questions comme celles-ci
              </h2>
              <p className="mt-3 text-[1rem] text-ink/75">Exemples de questions posées aux IA {u.forWho}. Vos questions suivies sont choisies avec vous.</p>
            </div>
            <ul className="space-y-3">
              {u.questions.map((q, i) => (
                <Reveal as="li" i={i} key={q} className="rounded-2xl rounded-bl-md bg-canvas px-5 py-4 font-display text-[1.15rem] font-semibold">
                  {q}
                </Reveal>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      <section aria-labelledby="signaux-title" className="bg-canvas py-16 sm:py-20">
        <Container>
          <h2 id="signaux-title" className="text-[1.8rem] font-bold leading-tight sm:text-[2.2rem]">
            Ce que les IA regardent
          </h2>
          <ul className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-3">
            {u.signals.map((s) => (
              <li key={s.title} className="border-t-2 border-primary pt-5">
                <h3 className="text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-[0.98rem] text-ink/75">{s.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section aria-labelledby="repere-title" className="bg-white py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 id="repere-title" className="text-[1.8rem] font-bold leading-tight sm:text-[2.2rem]">
                Ce que Repéré fait {u.forWho}
              </h2>
              <ul className="mt-6 space-y-3 text-[1.02rem]">
                {u.actions.map((a) => (
                  <li key={a} className="flex gap-2.5">
                    <CheckIcon className="mt-0.5 text-primary" />
                    {a}
                  </li>
                ))}
              </ul>
              <p className="mt-6 rounded-xl border-l-4 border-accent bg-canvas p-4 text-[0.98rem]">
                <strong className="font-semibold">À surveiller : </strong>
                {u.watch}
              </p>
            </div>
            {demo ? (
              <div className="h-fit rounded-2xl bg-primary-deep p-6 text-white sm:p-8">
                <p className="text-[0.9rem] text-on-deep">Compte démo, données fictives</p>
                <h3 className="mt-1 text-2xl font-bold text-white">{demo.name}</h3>
                <p className="mt-1 text-on-deep">{demo.activity}</p>
                <p className="mt-4 text-[1rem] text-white/90">{demo.text}</p>
                <Link href={demoAppHref(demo)} rel="nofollow" className={buttonClasses({ variant: "light", className: "mt-6" })}>
                  Explorer ce compte démo
                </Link>
              </div>
            ) : null}
          </div>
          <p className="mt-12 text-[0.98rem] text-ink/80">
            Pour aller plus loin : <Link href={u.resource.href} className={linkClass}>{u.resource.label}</Link>.
          </p>
        </Container>
      </section>

      <section aria-labelledby="autres-title" className="bg-canvas py-14">
        <Container>
          <h2 id="autres-title" className="font-display text-xl font-bold">
            Autres métiers
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={casUsagePath(o.slug)} className="inline-flex min-h-10 items-center rounded-full bg-white px-4 text-[0.92rem] font-semibold text-ink/80 shadow-[0_0_0_1px_rgba(27,31,46,.09)] hover:text-primary">
                  {o.name}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <CtaBand title={`Et vous, que disent les IA de votre entreprise ?`} text="Créez un compte gratuit : 5 questions suivies sur 3 IA, sans carte bancaire." segment={u.segment} />
    </SitePage>
  );
}
