/**
 * Gabarit serveur d'une page d'outil : H1 = promesse, outil au-dessus de la ligne de flottaison, puis
 * « Comment ça marche », « Comment lire le résultat », limites, FAQ (balisée FAQPage), sources, liens.
 * JSON-LD : WebPage + Service (outil gratuit) + FAQPage + BreadcrumbList dans un seul @graph. V5 : `Service` plutôt que
 * `WebApplication`, dont le résultat enrichi exige une note ou des avis (que nous n'avons pas et n'inventons pas).
 */
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Crumbs, JsonLd } from '@/lib/seo/shell';
import { abs, fmtDate } from '@/lib/seo';
import { breadcrumbListLd, faqPageLd, graph, orgRef, webPageLd } from '@/lib/seo/jsonld';
import { pageMeta } from '@/lib/seo/meta';
import { PARCOURS_LABEL, TOOLS, TOOLS_UPDATED, toolPath, type ToolDef } from './registry';

export function toolMeta(t: ToolDef) {
  return pageMeta({ path: toolPath(t.slug), title: t.metaTitle, description: t.description });
}

export function webApplicationLd(t: ToolDef) {
  const path = toolPath(t.slug);
  return {
    '@type': 'Service',
    '@id': `${abs(path)}#app`,
    name: t.name,
    description: t.description,
    url: abs(path),
    serviceType: 'Outil gratuit de SEO et de référencement IA (GEO)',
    availableLanguage: 'fr-FR',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    provider: orgRef(),
    publisher: orgRef(),
  };
}

const h2 = 'text-2xl font-semibold text-ink';
const h2Style = { fontFamily: 'var(--font-display)' } as const;

export function ToolPage({ tool, children }: { tool: ToolDef; children: ReactNode }) {
  const path = toolPath(tool.slug);
  const others = TOOLS.filter((x) => x.slug !== tool.slug && x.parcours.some((p) => tool.parcours.includes(p))).slice(0, 3);
  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas text-ink">
        <JsonLd
          data={graph([
            {
              ...webPageLd(path, { name: tool.metaTitle, description: tool.description, dateModified: TOOLS_UPDATED, mainEntity: `${abs(path)}#app` }, { withContext: false }),
            },
            webApplicationLd(tool),
            faqPageLd(path, tool.faq, { withContext: false }),
            breadcrumbListLd(
              path,
              [
                { name: 'Accueil', path: '/' },
                { name: 'Outils gratuits', path: '/outils' },
                { name: tool.name, path },
              ],
              { withContext: false },
            ),
          ])}
        />
        <div className="mx-auto w-full max-w-6xl px-4 pb-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
          <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Outils gratuits', href: '/outils' }, { name: tool.name }]} />
          <div className="max-w-3xl">
            <p className="mb-3 flex flex-wrap gap-2 text-sm">
              <span className="rounded-full bg-success-bg px-2.5 py-0.5 font-semibold text-success-ink">Gratuit, sans inscription</span>
              {(['local', 'pme', 'ecommerce'] as const).filter((p) => tool.parcours.includes(p)).map((p) => (
                <span key={p} className="rounded-full bg-white px-2.5 py-0.5 text-muted ring-1 ring-line">
                  {PARCOURS_LABEL[p]}
                </span>
              ))}
            </p>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-[2.6rem]" style={h2Style}>
              {tool.h1}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-muted">{tool.lead}</p>
          </div>
          <div className="mt-8 max-w-5xl">{children}</div>
        </div>

        <div className="border-t border-line bg-white">
          <article className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8 *:max-w-3xl" aria-labelledby={`${tool.slug}-how`}>
            <h2 id={`${tool.slug}-how`} className={h2} style={h2Style}>
              Comment fonctionne l’outil
            </h2>
            <ol className="mt-5 space-y-4">
              {tool.howItWorks.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-bg font-semibold text-primary" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="pt-1 leading-relaxed">{s}</p>
                </li>
              ))}
            </ol>

            <h2 className={`${h2} mt-12`} style={h2Style}>
              Comment lire le résultat
            </h2>
            <div className="mt-4 space-y-3 leading-relaxed">
              {tool.reading.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            <h2 className={`${h2} mt-12`} style={h2Style}>
              Ce que l’outil ne mesure pas
            </h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed marker:text-muted">
              {tool.limits.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <h2 id="faq" className={`${h2} mt-12`} style={h2Style}>
              Questions fréquentes
            </h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {tool.faq.map((f) => (
                <details key={f.q} className="rt-details py-1">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 py-3 font-semibold focus-visible:outline-3 focus-visible:outline-primary">
                    <h3 className="text-base font-semibold">{f.q}</h3>
                    <svg className="rt-chevron shrink-0 text-muted" viewBox="0 0 16 16" width="16" height="16" aria-hidden>
                      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </summary>
                  <p className="rt-details-body pb-4 leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>

            <h2 className={`${h2} mt-12`} style={h2Style}>
              Sources
            </h2>
            <ul className="mt-4 space-y-3 text-[0.95rem]">
              {tool.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener" className="font-medium text-primary underline underline-offset-2 hover:no-underline">
                    {s.label}
                  </a>
                  {s.note && <span className="block text-sm text-muted">{s.note}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted">
              Page mise à jour le <time dateTime={TOOLS_UPDATED}>{fmtDate(TOOLS_UPDATED)}</time> par{' '}
              <Link href="/a-propos" className="underline underline-offset-2">
                l’équipe Repéré
              </Link>
              . Nos règles d’analyse sont décrites sur la page{' '}
              <Link href="/methode" className="underline underline-offset-2">
                Méthode
              </Link>
              .
            </p>

            {(tool.related.length > 0 || others.length > 0) && (
              <nav aria-label="Pour aller plus loin" className="mt-12 rounded-2xl bg-canvas p-5">
                <h2 className="text-lg font-semibold">Pour aller plus loin</h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[...tool.related, ...others.map((o) => ({ label: `Outil : ${o.name}`, href: toolPath(o.slug) }))]
                    .filter((r, k, all) => all.findIndex((x) => x.href === r.href) === k)
                    .map((r) => (
                    <li key={r.href}>
                      <Link href={r.href} className="text-primary underline underline-offset-2 hover:no-underline">
                        {r.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <Link href="/outils" className="text-primary underline underline-offset-2 hover:no-underline">
                      Tous les outils gratuits
                    </Link>
                  </li>
                </ul>
              </nav>
            )}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
