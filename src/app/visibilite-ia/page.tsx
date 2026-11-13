import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, Card, CtaLink, h1Class, h1Style, h2Class } from '@/lib/seo/shell';
import { TRADES, PRIORITY_TRADES, breadcrumbLd, tradePath, BRAND } from '@/lib/seo';
import { SEGMENTS, categoriesFor, categoryPath } from '@/lib/seo/segments';
import { pageMeta } from '@/lib/seo/meta';

export const metadata = pageMeta({
  path: '/visibilite-ia',
  title: 'Visibilité IA par métier, secteur et catégorie',
  description:
    'Comment ChatGPT, Gemini et Perplexity recommandent (ou non) les commerces locaux, les PME et les e-commerces : questions types, sources citées et leviers par activité.',
});

export default function Hub() {
  return (
    <PageShell>
      <JsonLd data={breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Visibilité IA', path: '/visibilite-ia' }])} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Visibilité IA' }]} />
      <h1 className={h1Class} style={h1Style}>Visibilité IA : votre métier est-il recommandé par ChatGPT, Gemini et Perplexity ?</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        Quand un client demande à une IA « le meilleur plombier près de chez moi », elle cite quelques noms et pas d&apos;autres.
        Chez {BRAND}, nous mesurons ces recommandations pour les commerces locaux, les PME et les e-commerces. Les spécialistes parlent de « GEO »
        (Generative Engine Optimization) : c&apos;est le cousin du référencement Google appliqué aux assistants IA.
      </p>

      <h2 className={h2Class}>PME et services B2B</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Les acheteurs demandent à l&apos;IA une short-list de prestataires. Par secteur : questions, sources citées, leviers.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categoriesFor('pme').map((c) => (
          <li key={c.slug}><Link href={categoryPath(c)} className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>{c.name}</Link></li>
        ))}
      </ul>
      <p className="mt-2 text-sm"><Link href={SEGMENTS.pme.path} className="underline" style={{ color: 'var(--primary)' }}>Tous les secteurs PME</Link></p>

      <h2 className={h2Class}>E-commerce</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>Requêtes produit, tests, comparatifs et marketplaces que les IA citent, par catégorie.</p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categoriesFor('ecommerce').map((c) => (
          <li key={c.slug}><Link href={categoryPath(c)} className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>{c.name}</Link></li>
        ))}
      </ul>
      <p className="mt-2 text-sm"><Link href={SEGMENTS.ecommerce.path} className="underline" style={{ color: 'var(--primary)' }}>Toutes les catégories e-commerce</Link></p>

      <h2 className={h2Class}>Commerces locaux : par métier</h2>
      <h3 className="mt-6 mb-2 font-semibold text-lg">Ce que vous trouverez par métier</h3>
      <ul className="list-disc space-y-1 pl-6 leading-relaxed">
        <li>des questions types que posent les clients aux IA, selon la ville et le quartier ;</li>
        <li>les annuaires et sites que les IA ont le plus de chances de citer pour ce métier ;</li>
        <li>des statistiques agrégées issues de nos audits, publiées seulement quand l&apos;échantillon est suffisant (au moins 5 audits), toujours avec leur base et leur date.</li>
      </ul>

      <h2 className={h2Class}>Premiers métiers couverts à Paris et dans 15 grandes villes</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {PRIORITY_TRADES.map((t) => (
          <Card key={t.slug}>
            <h3 className="font-semibold text-lg">{t.nom}</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>Paris (20 arrondissements) et 15 villes.</p>
            <Link href={`${tradePath(t)}/paris-11e`} className="mt-3 inline-block text-sm underline" style={{ color: 'var(--primary)' }}>
              Exemple : {t.nom.toLowerCase()} à Paris 11e
            </Link>
          </Card>
        ))}
      </div>

      <h2 className={h2Class}>Tous les métiers</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TRADES.map((t) => (
          <li key={t.slug}>
            <Link href={tradePath(t)} className="underline underline-offset-2" style={{ color: 'var(--primary)' }}>
              Visibilité IA : {t.nom_pluriel.toLowerCase()}
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
        Les professions de santé et les professions juridiques ou comptables réglementées ne sont pas auditées sur ce site.
      </p>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Et vous, êtes-vous cité ?</p>
        <CtaLink href="/audit">Lancer mon test gratuit</CtaLink>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Les scores sont des mesures à un instant donné, avec une fourchette. <Link href="/methode" className="underline">Voir la méthode</Link>.
        </p>
      </div>
    </PageShell>
  );
}
