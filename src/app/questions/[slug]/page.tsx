import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageMeta } from '@/lib/seo/meta';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { Byline, SourcesList, Toc, RelatedLinks, AuditCta } from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, faqPageLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { abs } from '@/lib/seo';
import { TARGET_QUESTIONS, getTargetQuestion, targetQuestionPath } from '../_lib/target-questions';
import { refResolver } from '../_lib/refs';
import { Blocks, Rich, plain, resolveBlocks } from '../_lib/render';

export const dynamicParams = false;

export function generateStaticParams() {
  return TARGET_QUESTIONS.map((x) => ({ slug: x.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const x = getTargetQuestion((await params).slug);
  if (!x) return { robots: { index: false } };
  return pageMeta({
    path: targetQuestionPath(x),
    title: x.seoTitle,
    ogTitle: x.q,
    description: x.description,
    type: 'article',
    publishedTime: x.published,
    modifiedTime: x.updated,
  });
}

/** Résout les renvois dans l'ordre de lecture : réponse, points clés, sections. */
function resolve(slug: string) {
  const x = getTargetQuestion(slug)!;
  const { t, sources } = refResolver();
  const answer = t(x.answer);
  const takeaways = x.takeaways.map(t);
  const sections = x.sections.map((s) => ({ ...s, answer: t(s.answer), blocks: resolveBlocks(s.blocks, t) }));
  return { x, answer, takeaways, sections, sources: sources() };
}

export default async function TargetQuestionPage({ params }: Props) {
  const slug = (await params).slug;
  if (!getTargetQuestion(slug)) notFound();
  const { x, answer, takeaways, sections, sources } = resolve(slug);
  const path = targetQuestionPath(x);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Questions', path: '/questions' },
    { name: x.q, path },
  ];
  const toc = [...sections.map((s) => ({ id: s.id, label: s.q })), ...(x.faq.length ? [{ id: 'faq', label: 'Questions voisines' }] : [])];

  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          webPageLd(path, { name: x.q, description: x.description, datePublished: x.published, dateModified: x.updated }, { withContext: false }),
          articleLd({
            path,
            headline: x.q,
            description: plain(answer),
            datePublished: x.published,
            dateModified: x.updated,
            citation: sources.map((s) => s.url),
            image: abs(`${path}/opengraph-image`),
            withContext: false,
          }),
          faqPageLd(
            path,
            [{ q: x.q, a: plain(answer) }, ...sections.map((s) => ({ q: s.q, a: plain(s.answer) })), ...x.faq],
            { withContext: false },
          ),
          breadcrumbListLd(path, crumbs, { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Questions', href: '/questions' }, { name: x.q }]} />
      <h1 className={h1Class} style={h1Style}>
        {x.q}
      </h1>
      <Byline published={x.published} updated={x.updated} />

      <p className="mt-6 text-lg font-medium leading-relaxed">
        <Rich text={answer} />
      </p>

      <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        <p className="mb-2 font-semibold">En bref</p>
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          {takeaways.map((k, i) => (
            <li key={i}>
              <Rich text={k} />
            </li>
          ))}
        </ul>
      </div>

      <Toc items={toc} />

      {sections.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">{s.q}</h2>
          <p className="mb-4 text-lg font-medium leading-relaxed">
            <Rich text={s.answer} />
          </p>
          <Blocks blocks={s.blocks} />
        </section>
      ))}

      {x.faq.length > 0 && (
        <section id="faq" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Questions voisines</h2>
          {x.faq.map((f) => (
            <div key={f.q} className="border-b py-4" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-semibold text-lg">{f.q}</h3>
              <p className="mt-1 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </section>
      )}

      <AuditCta />
      {sources.length > 0 && <SourcesList sources={sources} />}
      <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        Page publiée par Repéré, qui édite l&apos;un des outils cités. Les relevés de prix et de fonctions sont datés et sourcés ; une erreur ?{' '}
        <Link href="/contact" className="underline">
          Signalez-la
        </Link>
        , nous corrigeons avec la date de correction.
      </p>
      <RelatedLinks current="/questions" extra={x.related} />
    </PageShell>
  );
}
