import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { GUIDE_2027, GUIDE_2027_CHAPTERS, GUIDE_2027_SOURCES } from '@/lib/veille/guide2027';
import { frDate } from '@/lib/veille';
import { GuideRequestForm } from './_components/GuideRequestForm';
import { rich } from './_components/GuideBody';

const PATH = '/ressources/guide-2027';
const DESCRIPTION =
  'Guide gratuit d’une vingtaine de pages, sourcé : ce qui a changé sur Google et dans les IA, ce qui compte pour être cité, un plan sur douze mois, et ce que personne ne sait encore. Reçu par e-mail, à lire, imprimer ou télécharger en PDF.';

export const metadata: Metadata = pageMeta({ path: PATH, title: 'Guide 2027 : être recommandé par Google et les IA', ogTitle: GUIDE_2027.title, description: DESCRIPTION });

export default function Guide2027Landing() {
  const intro = GUIDE_2027_CHAPTERS[0];
  const primary = GUIDE_2027_SOURCES.filter((s) => s.primary).length;
  const ld = graph([
    webPageLd(PATH, { name: GUIDE_2027.title, description: DESCRIPTION, datePublished: GUIDE_2027.published, dateModified: GUIDE_2027.updated }, { withContext: false }),
    breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Ressources', path: '/ressources' }, { name: 'Guide 2027', path: PATH }], { withContext: false }),
  ]);
  return (
    <PageShell>
      <JsonLd data={ld} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Ressources', href: '/ressources' }, { name: 'Guide 2027' }]} />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <h1 className={h1Class} style={h1Style}>{GUIDE_2027.title}</h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed">{GUIDE_2027.subtitle}</p>
          <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
            {GUIDE_2027.edition} · {GUIDE_2027_CHAPTERS.length} chapitres · {GUIDE_2027_SOURCES.length} sources dont {primary} primaires, relues le {frDate(GUIDE_2027.updated)} · gratuit
          </p>

          <section aria-labelledby="sommaire-h" className="mt-10">
            <h2 id="sommaire-h" className="text-2xl font-semibold">Au sommaire</h2>
            <ol className="mt-4 space-y-3">
              {GUIDE_2027_CHAPTERS.map((c) => (
                <li key={c.id} className="border-t pt-3" style={{ borderColor: 'var(--line)' }}>
                  <p className="font-semibold">{c.title}</p>
                  <p className="mt-1 text-[0.95rem]" style={{ color: 'var(--muted)' }}>{c.lead}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="extrait-h" className="mt-12 max-w-2xl">
            <h2 id="extrait-h" className="text-2xl font-semibold">Extrait : {intro.title}</h2>
            <p className="mt-3 text-lg" style={{ color: 'var(--muted)' }}>{intro.lead}</p>
            {intro.blocks[0].paras?.map((p, i) => <p key={i} className="mt-3 leading-relaxed">{rich(p)}</p>)}
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <h2 className="text-xl font-semibold">Recevoir le guide</h2>
            <p className="mt-1 mb-5 text-[0.95rem]" style={{ color: 'var(--muted)' }}>Le lien arrive par e-mail : lecture en ligne, version à imprimer et PDF.</p>
            <GuideRequestForm />
          </div>
          <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
            Mis à jour en continu dans la <Link href="/veille" className="underline underline-offset-2">veille Google et IA</Link>, en accès libre.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}
