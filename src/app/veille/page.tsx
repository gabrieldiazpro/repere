import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { abs } from '@/lib/seo/site';
import { breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { Byline } from '@/lib/seo/editorial';
import { VEILLE_ENTRIES, VEILLE_PUBLISHED, VEILLE_UPDATED, frDate, sortedEntries, timeline, upcoming, veillePath } from '@/lib/veille';
import { NewsletterForm } from '@/lib/newsletter/ui/NewsletterForm';
import { VeilleExplorer } from './_components/VeilleExplorer';
import { Frise } from './_components/Frise';

const PATH = '/veille';
const TITLE = 'Ce qui change pour votre visibilité sur Google et dans les IA';
const DESCRIPTION =
  'Veille datée et sourcée : Aperçus IA de Google en France, mises à jour de Google, AI Act, avis en ligne, robots des IA, accessibilité. Ce qui change, pour qui, et ce qu’il faut faire.';

export const metadata: Metadata = pageMeta({ path: PATH, title: 'Veille Google et IA : ce qui change pour votre site', ogTitle: TITLE, description: DESCRIPTION });

export default function VeillePage() {
  const entries = sortedEntries();
  const next = upcoming(VEILLE_ENTRIES, VEILLE_UPDATED);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Veille', path: PATH },
  ];
  const ld = graph([
    webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'CollectionPage', datePublished: VEILLE_PUBLISHED, dateModified: VEILLE_UPDATED }, { withContext: false }),
    {
      '@type': 'ItemList',
      '@id': `${abs(PATH)}#fiches`,
      name: 'Fiches de veille',
      numberOfItems: entries.length,
      itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(veillePath(e)), name: e.title })),
    },
    breadcrumbListLd(PATH, crumbs, { withContext: false }),
  ]);

  return (
    <PageShell>
      <JsonLd data={ld} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Veille' }]} />
      <div className="max-w-3xl">
        <h1 className={h1Class} style={h1Style}>{TITLE}</h1>
        <p className="mt-4 text-lg leading-relaxed">
          Google, les assistants IA et les autorités changent les règles plusieurs fois par mois. Ici, chaque changement a sa
          fiche : la date, qui est concerné, ce qui change, ce qu&apos;il faut faire, et les sources officielles. Ce qui
          n&apos;est pas confirmé est écrit comme tel.
        </p>
        <Byline published={VEILLE_PUBLISHED} updated={VEILLE_UPDATED} />
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          {entries.length} fiches · sources relues le {frDate(VEILLE_UPDATED)} ·{' '}
          <a href="/veille/rss.xml" className="underline underline-offset-2">flux RSS</a> ·{' '}
          <Link href="/veille/lettre" className="underline underline-offset-2">lettre mensuelle</Link>
        </p>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="fiches-h">
          <h2 id="fiches-h" className="sr-only">Les fiches</h2>
          <VeilleExplorer entries={entries} />
        </section>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start" aria-label="Échéances et lettre">
          <section aria-labelledby="next-h" className="rounded-2xl border p-5" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <h2 id="next-h" className="text-lg font-semibold">Prochaines échéances</h2>
            {next.length ? (
              <ul className="mt-3 space-y-3">
                {next.map((t) => (
                  <li key={`${t.date}-${t.slug}`}>
                    <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--warning-ink)' }}>
                      <span aria-hidden>◆ </span><time dateTime={t.date}>{frDate(t.date)}</time>
                    </p>
                    <Link href={veillePath(t.slug)} className="text-[0.95rem] underline-offset-2 hover:underline">{t.label}</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">Aucune échéance à venir recensée au {frDate(VEILLE_UPDATED)}.</p>
            )}
            <a href="#frise" className="mt-4 inline-block text-sm font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>
              Voir la frise complète
            </a>
          </section>
          <NewsletterForm source="veille" stacked title="Recevoir la veille chaque mois" text="Un e-mail par mois avec les nouvelles fiches et les échéances. Confirmation par e-mail, désinscription en un clic." />
        </aside>
      </div>

      <section id="frise" aria-labelledby="frise-h" className="mt-16 scroll-mt-24">
        <h2 id="frise-h" className="text-2xl font-semibold">Frise chronologique</h2>
        <p className="mt-2 max-w-2xl" style={{ color: 'var(--muted)' }}>
          Toutes les dates citées dans les fiches, des plus anciennes aux plus récentes. Les points creux orange sont à venir.
        </p>
        <div className="mt-6 max-w-2xl">
          <Frise items={timeline(VEILLE_ENTRIES, VEILLE_UPDATED)} today={VEILLE_UPDATED} />
        </div>
      </section>

      <section aria-labelledby="methode-h" className="mt-14 max-w-3xl rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        <h2 id="methode-h" className="text-xl font-semibold">Comment nous tenons cette veille</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed">
          <li>Chaque fiche cite ses sources avec leur date de publication et la date à laquelle nous les avons relues.</li>
          <li>Nous privilégions les sources primaires : documentation des éditeurs, textes officiels, autorités. Une source secondaire (presse, cabinet) est signalée comme telle.</li>
          <li>Quand une source officielle n&apos;a pas pu être consultée, la fiche le dit dans « Ce qui reste incertain ».</li>
          <li>Ces fiches informent ; elles ne remplacent pas un conseil juridique.</li>
        </ul>
        <p className="mt-4">
          Pour aller plus loin, téléchargez le guide{' '}
          <Link href="/ressources/guide-2027" className="font-semibold underline underline-offset-2" style={{ color: 'var(--primary)' }}>
            Être recommandé par Google et les IA en 2027
          </Link>
          , ou parcourez nos <Link href="/guides" className="underline underline-offset-2">guides</Link>.
        </p>
      </section>
    </PageShell>
  );
}
