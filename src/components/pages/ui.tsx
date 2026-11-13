/** Briques communes des pages du site (serveur). */
import Link from "next/link";
import type { ReactNode } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Container } from "@/components/ui/Container";
import { buttonClasses } from "@/components/ui/Button";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { JsonLd } from "@/lib/seo/shell";
import type { LandingSegment } from "@/components/site/nav";

export function SitePage({ jsonLd, segment, children }: { jsonLd?: unknown; segment?: LandingSegment; children: ReactNode }) {
  return (
    <>
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <Header segment={segment} />
      <main id="contenu">
        <MotionRoot />
        {children}
      </main>
      <Footer />
    </>
  );
}

export type Crumb = { name: string; href?: string };

export function Breadcrumbs({ items, dark = false }: { items: Crumb[]; dark?: boolean }) {
  return (
    <nav aria-label="Fil d'Ariane" className={`text-[0.9rem] ${dark ? "text-on-deep" : "text-muted"}`}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((it, i) => (
          <li key={it.name} className="flex items-center gap-2">
            {it.href ? (
              <Link href={it.href} className="underline-offset-4 hover:underline">
                {it.name}
              </Link>
            ) : (
              <span aria-current="page" className={dark ? "text-white" : "text-ink"}>
                {it.name}
              </span>
            )}
            {i < items.length - 1 ? <span aria-hidden="true">/</span> : null}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** En-tête de page : fil d'Ariane, H1, chapeau, actions. Le H1 n'est jamais animé (LCP). */
export function PageHero({
  crumbs,
  title,
  lead,
  id = "page-title",
  children,
  aside,
}: {
  crumbs: Crumb[];
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="relative overflow-hidden bg-canvas">
      <div aria-hidden="true" className="scope-grid absolute inset-x-0 top-0 h-72 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
      <Container className="relative pb-14 pt-8 sm:pb-20 sm:pt-12">
        <Breadcrumbs items={crumbs} />
        <div className={aside ? "mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14" : "mt-8"}>
          <div>
            <h1 id={id} className="max-w-3xl text-[2.25rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[3.25rem]">
              {title}
            </h1>
            {lead ? <p className="mt-5 max-w-[60ch] text-lg text-ink/75 sm:text-xl">{lead}</p> : null}
            {children}
          </div>
          {aside ? <div className="min-w-0">{aside}</div> : null}
        </div>
      </Container>
    </section>
  );
}

/** Les deux actions principales du site (V5) : l'analyse gratuite du site en 60 s, puis la démo. */
export function MainActions({ segment, dark = false, demo = true }: { segment?: LandingSegment; dark?: boolean; demo?: boolean }) {
  const analyse = segment ? `/analyse?segment=${segment}` : "/analyse";
  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Link href={analyse} className={buttonClasses({ size: "lg", variant: dark ? "light" : "primary", className: "lift" })}>
        Analyser mon site gratuitement
      </Link>
      {demo ? (
        <Link
          href="/demo"
          className={
            dark
              ? "inline-flex min-h-12 items-center px-2 font-semibold text-white underline underline-offset-4 hover:no-underline"
              : buttonClasses({ size: "lg", variant: "secondary" })
          }
        >
          Voir la démo
        </Link>
      ) : null}
    </div>
  );
}

/** Ce que l'outil ne fait pas : écrit en clair, jamais en petits caractères. */
export function LimitsNote({ items, title = "Ce que nous ne faisons pas, ou pas encore", id }: { items: string[]; title?: string; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border-l-4 border-accent bg-white p-6 shadow-[0_0_0_1px_rgba(27,31,46,.07)] sm:p-8">
      <h2 id={id} className="font-display text-2xl font-bold">
        {title}
      </h2>
      <ul className="mt-4 space-y-3 text-[1.02rem] text-ink/85">
        {items.map((t) => (
          <li key={t} className="flex gap-3">
            <span aria-hidden="true" className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/50" />
            <span className="max-w-[70ch]">{t}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CtaBand({ title, text, segment, id = "cta-title" }: { title: string; text: string; segment?: LandingSegment; id?: string }) {
  return (
    <section aria-labelledby={id} className="on-dark relative overflow-hidden bg-primary-deep py-16 text-white sm:py-20">
      <div aria-hidden="true" className="scope-grid-dark absolute inset-0 opacity-60" />
      <Container className="relative">
        <h2 id={id} className="max-w-3xl text-[1.9rem] font-bold leading-tight text-white sm:text-[2.6rem]">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-on-deep">{text}</p>
        <MainActions segment={segment} dark />
        <p className="mt-4 text-[0.9rem] text-on-deep">
          60 secondes, sans compte ni carte bancaire. Ensuite, l&apos;offre Découverte reste gratuite, sans limite de durée.
        </p>
      </Container>
    </section>
  );
}

export const linkClass = "font-semibold text-primary underline underline-offset-4 hover:no-underline";
