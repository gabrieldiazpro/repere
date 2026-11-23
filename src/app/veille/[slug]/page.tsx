import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { abs } from '@/lib/seo/site';
import { articleLd, breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { Byline } from '@/lib/seo/editorial';
import { getGuide, guidePath } from '@/lib/seo/guides';
import { AUDIENCE_LABEL, THEME_LABEL, VEILLE_ENTRIES, VEILLE_PUBLISHED, entryWordCount, frDate, getEntry, sortedEntries, timeline, veillePath } from '@/lib/veille';
import { NewsletterForm } from '@/lib/newsletter/ui/NewsletterForm';
import { StatusBadge } from '../_components/ui';
import { Frise } from '../_components/Frise';

export const dynamicParams = false;

export function generateStaticParams() {
  return VEILLE_ENTRIES.map((e) => ({ slug: e.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const e = getEntry((await params).slug);
  if (!e) return { robots: { index: false } };
  return pageMeta({
    path: veillePath(e),
    title: e.title.length > 60 ? `${e.title.slice(0, 57).replace(/\s+\S*$/, '')}…` : e.title,
    ogTitle: e.title,
    description: e.summary,
    type: 'article',
    publishedTime: VEILLE_PUBLISHED,
    modifiedTime: e.updated,
  });
}

const h2 = 'mt-10 mb-3 text-2xl font-semibold';

export default async function VeilleEntryPage({ params }: Props) {
  const e = getEntry((await params).slug);
  if (!e) notFound();
  const path = veillePath(e);
  const all = sortedEntries();
  const i = all.findIndex((x) => x.slug === e.slug);
  const newer = all[i - 1];
  const older = all[i + 1];
  const guides = e.guides.map(getGuide).filter((g): g is NonNullable<typeof g> => Boolean(g));
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Veille', path: '/veille' },
    { name: e.title, path },
  ];
  const article = articleLd({
    path,
    headline: e.title,
    description: e.summary,
    datePublished: VEILLE_PUBLISHED,
    dateModified: e.updated,
    wordCount: entryWordCount(e),
    citation: e.sources.map((s) => s.url),
    about: [...e.themes.map((t) => THEME_LABEL[t])],
    withContext: false,
  });
  const ld = graph([
    webPageLd(path, { name: e.title, description: e.summary, datePublished: VEILLE_PUBLISHED, dateModified: e.updated }, { withContext: false }),
    { ...article, '@type': 'NewsArticle', dateline: frDate(e.eventDate), image: abs('/opengraph-image') },
    breadcrumbListLd(path, crumbs, { withContext: false }),
  ]);

  return (
    <PageShell narrow>
      <JsonLd data={ld} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Veille', href: '/veille' }, { name: e.title }]} />
      <p className="flex flex-wrap items-center gap-3">
        <StatusBadge status={e.status} />
        <span className="text-sm" style={{ color: 'var(--muted)' }}>
          Évènement du <time dateTime={e.eventDate}>{frDate(e.eventDate)}</time>
        </span>
      </p>
      {e.statusNote ? <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{e.statusNote}</p> : null}
      <h1 className={`${h1Class} mt-3`} style={h1Style}>{e.title}</h1>
      <Byline published={VEILLE_PUBLISHED} updated={e.updated} />
      <p className="mt-5 text-lg leading-relaxed">{e.summary}</p>

      <dl className="mt-6 grid gap-4 rounded-2xl border p-5 sm:grid-cols-2" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        <div>
          <dt className="text-sm font-semibold">Qui est concerné</dt>
          <dd className="mt-1">{e.audiences.map((a) => AUDIENCE_LABEL[a]).join(', ')}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Thèmes</dt>
          <dd className="mt-1">{e.themes.map((t) => THEME_LABEL[t]).join(', ')}</dd>
        </div>
      </dl>

      <section aria-labelledby="change-h">
        <h2 id="change-h" className={h2}>Ce qui change</h2>
        <ul className="list-disc space-y-2 pl-6 leading-relaxed">
          {e.changes.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>

      <section aria-labelledby="todo-h">
        <h2 id="todo-h" className={h2}>Ce qu&apos;il faut faire</h2>
        <ol className="list-decimal space-y-2 pl-6 leading-relaxed">
          {e.actions.map((a) => <li key={a}>{a}</li>)}
        </ol>
      </section>

      {e.uncertain?.length ? (
        <section aria-labelledby="unsure-h" className="mt-8 rounded-2xl p-5" style={{ background: 'var(--warning-bg)', color: 'var(--warning-ink)' }}>
          <h2 id="unsure-h" className="text-lg font-semibold"><span aria-hidden>◆ </span>Ce qui reste incertain</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 leading-relaxed">
            {e.uncertain.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="dates-h">
        <h2 id="dates-h" className={h2}>Échéances</h2>
        <Frise items={timeline([e], e.updated)} today={e.updated} compact />
      </section>

      <section aria-labelledby="sources-h">
        <h2 id="sources-h" className={h2}>Sources</h2>
        <ol className="list-decimal space-y-3 pl-6 text-[0.97rem] leading-relaxed">
          {e.sources.map((s, n) => (
            <li key={s.url} id={`source-${n + 1}`}>
              <a href={s.url} rel="noopener" className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>{s.label}</a>
              <span style={{ color: 'var(--muted)' }}>
                {' '}· {s.publisher}
                {s.published ? <> · publié ou mis à jour : {frDate(s.published)}</> : null} · consulté le {frDate(s.consulted)} ·{' '}
                {s.primary ? 'source primaire' : 'source secondaire'}
              </span>
              {s.note ? <span className="block text-sm" style={{ color: 'var(--muted)' }}>{s.note}</span> : null}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Cette fiche informe ; elle ne remplace pas un conseil juridique ou technique adapté à votre situation.</p>
      </section>

      {guides.length || e.tools.length ? (
        <section aria-labelledby="go-h">
          <h2 id="go-h" className={h2}>Pour agir</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {guides.length ? (
              <div>
                <h3 className="font-semibold">Guides</h3>
                <ul className="mt-2 space-y-2">
                  {guides.map((g) => <li key={g.slug}><Link href={guidePath(g)} className="underline underline-offset-2">{g.title}</Link></li>)}
                </ul>
              </div>
            ) : null}
            {e.tools.length ? (
              <div>
                <h3 className="font-semibold">Outils</h3>
                <ul className="mt-2 space-y-2">
                  {e.tools.map((t) => <li key={t.href}><Link href={t.href} className="underline underline-offset-2">{t.label}</Link></li>)}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="mt-12">
        <NewsletterForm source="veille" />
      </div>

      <nav aria-label="Autres fiches" className="mt-10 grid gap-4 border-t pt-6 sm:grid-cols-2" style={{ borderColor: 'var(--line)' }}>
        {newer ? (
          <Link href={veillePath(newer)} className="block">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Fiche plus récente</span>
            <span className="block font-semibold underline-offset-2 hover:underline">{newer.title}</span>
          </Link>
        ) : <span />}
        {older ? (
          <Link href={veillePath(older)} className="block sm:text-right">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Fiche plus ancienne</span>
            <span className="block font-semibold underline-offset-2 hover:underline">{older.title}</span>
          </Link>
        ) : null}
      </nav>
      <p className="mt-6"><Link href="/veille" className="font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>Toutes les fiches de veille</Link></p>
    </PageShell>
  );
}
