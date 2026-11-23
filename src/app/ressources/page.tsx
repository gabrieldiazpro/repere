import type { Metadata } from 'next';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { pageMeta } from '@/lib/seo/meta';
import { breadcrumbListLd } from '@/lib/seo/jsonld';
import { GUIDE_2027, GUIDE_2027_CHAPTERS } from '@/lib/veille/guide2027';

const PATH = '/ressources';

export const metadata: Metadata = pageMeta({
  path: PATH,
  title: 'Ressources : guides à télécharger',
  description: 'Les ressources gratuites de Repéré à télécharger : guide 2027 pour être recommandé par Google et les IA, sourcé et imprimable.',
});

export default function RessourcesPage() {
  return (
    <PageShell narrow>
      <JsonLd data={breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Ressources', path: PATH }])} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Ressources' }]} />
      <h1 className={h1Class} style={h1Style}>Ressources à télécharger</h1>
      <p className="mt-4 text-lg leading-relaxed">
        Des documents complets, sourcés et datés, à lire au calme ou à partager en interne. Gratuits, reçus par e-mail.
        Pour l&apos;actualité, consultez la <Link href="/veille" className="underline underline-offset-2">veille</Link> et les{' '}
        <Link href="/guides" className="underline underline-offset-2">guides</Link>, en accès libre.
      </p>
      <article className="mt-10 rounded-2xl border p-5 sm:p-6" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{GUIDE_2027.edition} · {GUIDE_2027_CHAPTERS.length} chapitres · PDF et version imprimable</p>
        <h2 className="mt-1 text-2xl font-semibold">
          <Link href="/ressources/guide-2027" className="hover:underline underline-offset-4">{GUIDE_2027.title}</Link>
        </h2>
        <p className="mt-2 leading-relaxed">{GUIDE_2027.subtitle}</p>
        <p className="mt-4">
          <Link href="/ressources/guide-2027" className="inline-flex min-h-12 items-center rounded-xl px-5 font-semibold text-white" style={{ background: 'var(--primary)' }}>
            Recevoir le guide
          </Link>
        </p>
      </article>
    </PageShell>
  );
}
