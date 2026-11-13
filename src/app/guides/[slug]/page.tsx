import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { PageShell, Crumbs, JsonLd, CtaLink, h1Class, h1Style } from '@/lib/seo/shell';
import { abs } from '@/lib/seo';
import { GUIDES, getGuide, guidePath, guidePublished, guideWordCount } from '@/lib/seo/guides';
import { pageMeta } from '@/lib/seo/meta';
import { Byline } from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, faqPageLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { GuideFigure } from '@/components/pages/guide-figures';

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return { robots: { index: false } };
  return pageMeta({
    path: guidePath(g),
    title: g.seoTitle ?? g.title,
    ogTitle: g.title,
    description: g.description,
    type: 'article',
    publishedTime: guidePublished(g),
    modifiedTime: g.updated,
  });
}

/** Transforme les renvois [n] en liens vers la liste des sources. */
function withRefs(text: string): ReactNode {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = /^\[(\d+)\]$/.exec(p);
    return m ? (
      <sup key={i}><a href={`#source-${m[1]}`} className="px-0.5 underline" style={{ color: 'var(--primary)' }}>{m[1]}</a></sup>
    ) : (
      <span key={i}>{p}</span>
    );
  });
}

const isCode = (t: string) => /^[a-z0-9|\\.]+$/i.test(t) && t.includes('|');

export default async function GuidePage({ params }: Props) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const path = guidePath(g);
  const related = g.related.map(getGuide).filter((x): x is NonNullable<typeof x> => !!x);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: g.title, path },
  ];
  const ld = graph([
    webPageLd(path, { name: g.title, description: g.description, datePublished: guidePublished(g), dateModified: g.updated }, { withContext: false }),
    articleLd({
      path,
      headline: g.title,
      description: g.description,
      datePublished: guidePublished(g),
      dateModified: g.updated,
      wordCount: guideWordCount(g),
      citation: g.sources.map((x) => x.url),
      image: abs(`${path}/opengraph-image`),
      withContext: false,
    }),
    breadcrumbListLd(path, crumbs, { withContext: false }),
    ...(g.faq?.length ? [faqPageLd(path, g.faq, { withContext: false })] : []),
  ]);
  return (
    <PageShell narrow>
      <JsonLd data={ld} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Guides', href: '/guides' }, { name: g.title }]} />
      <h1 className={h1Class} style={h1Style}>{g.title}</h1>
      <Byline published={guidePublished(g)} updated={g.updated} />
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Sources vérifiées à la date de mise à jour. Les réponses des IA évoluent vite : revérifiez avant de décider.</p>
      <div className="mt-6 space-y-4 text-lg leading-relaxed">
        {g.intro.map((p, i) => <p key={i}>{withRefs(p)}</p>)}
      </div>

      <nav aria-label="Sommaire" className="mt-8 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        <p className="mb-2 font-semibold">Dans ce guide</p>
        <ol className="list-decimal space-y-1 pl-5">
          {g.sections.map((s, i) => (
            <li key={s.h2}><a href={`#s${i + 1}`} className="underline underline-offset-2">{s.h2}</a></li>
          ))}
        </ol>
      </nav>

      {g.sections.map((s, i) => (
        <section key={s.h2} id={`s${i + 1}`} className="scroll-mt-20">
          <h2 className="mt-10 mb-3 font-semibold text-2xl">{s.h2}</h2>
          {s.figure ? <GuideFigure id={s.figure} /> : null}
          {s.paras?.map((p, j) =>
            isCode(p) ? (
              <p key={j} className="mb-3 relative overflow-x-auto rounded-lg border p-3 font-mono text-sm" style={{ background: '#fff', borderColor: 'var(--line)' }}>{p}</p>
            ) : (
              <p key={j} className="mb-3 leading-relaxed">{withRefs(p)}</p>
            ),
          )}
          {s.list && (
            <ul className="mb-3 list-disc space-y-2 pl-6 leading-relaxed">
              {s.list.map((l, j) => <li key={j}>{withRefs(l)}</li>)}
            </ul>
          )}
          {s.after?.map((p, j) => <p key={j} className="mb-3 leading-relaxed">{withRefs(p)}</p>)}
        </section>
      ))}

      {g.faq?.length ? (
        <section aria-labelledby="faq-guide" className="scroll-mt-20">
          <h2 id="faq-guide" className="mt-12 mb-3 font-semibold text-2xl">Questions fréquentes</h2>
          <div className="space-y-3">
            {g.faq.map((f) => (
              <details key={f.q} className="site-details rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
                <summary className="cursor-pointer font-semibold">{f.q}</summary>
                <p className="mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">{g.cta.text}</p>
        <CtaLink href={g.cta.href}>{g.cta.label}</CtaLink>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          {g.cta.href === '/analyse' ? '60 secondes, sans compte ni carte bancaire.' : 'Gratuit, sans carte bancaire.'} <Link href="/methode" className="underline">Voir la méthode</Link>.
        </p>
      </div>

      <h2 className="mt-12 mb-3 font-semibold text-2xl">Sources</h2>
      <ol className="list-decimal space-y-2 pl-6 text-sm leading-relaxed">
        {g.sources.map((s, i) => (
          <li key={s.url} id={`source-${i + 1}`} className="scroll-mt-20">
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>{s.label}</a>
            {s.note && <span style={{ color: 'var(--muted)' }}> ({s.note})</span>}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Ce guide est un contenu d&apos;information, pas un avis juridique. Il a été rédigé avec l&apos;aide d&apos;un outil d&apos;IA ; signalez-nous toute erreur.
      </p>

      <h2 className="mt-10 mb-3 font-semibold text-2xl">À lire aussi</h2>
      <ul className="list-disc space-y-1 pl-6">
        {related.map((r) => (
          <li key={r.slug}><Link href={guidePath(r)} className="underline" style={{ color: 'var(--primary)' }}>{r.title}</Link></li>
        ))}
        <li><Link href="/visibilite-ia" className="underline" style={{ color: 'var(--primary)' }}>Visibilité IA par métier, secteur et catégorie</Link></li>
        <li><Link href="/geo" className="underline" style={{ color: 'var(--primary)' }}>Qu&apos;est-ce que le GEO (référencement IA) ?</Link></li>
        <li><Link href="/glossaire" className="underline" style={{ color: 'var(--primary)' }}>Glossaire du référencement IA</Link></li>
        {g.slug !== 'seo-geo-sites-pros-2026' ? (
          <li><Link href="/guides/seo-geo-sites-pros-2026" className="underline" style={{ color: 'var(--primary)' }}>Le guide SEO + GEO pour les sites pros en 2026</Link></li>
        ) : null}
        <li><Link href="/tarifs" className="underline" style={{ color: 'var(--primary)' }}>Nos tarifs : analyse gratuite, puis dès 29 € par mois</Link></li>
      </ul>
    </PageShell>
  );
}
