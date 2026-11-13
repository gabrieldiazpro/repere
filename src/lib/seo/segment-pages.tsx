import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd, Card, CtaLink, h1Class, h1Style, h2Class } from './shell';
import { breadcrumbLd, faqLd } from './index';
import { pageMeta } from './meta';
import {
  SEGMENTS, CATEGORY_LABELS, categoriesFor, getCategory, categoryPath, categoryAuditHref, resolveSources,
  segmentFaq, categoryServiceLd, getSegmentStats, isSegmentIndexable, type SegmentKey,
} from './segments';

export function hubMetadata(segment: SegmentKey): Metadata {
  const s = SEGMENTS[segment];
  return segment === 'pme'
    ? pageMeta({
        path: s.path,
        title: 'Visibilité IA par secteur B2B : sources et leviers',
        description: 'Questions d\'acheteurs B2B, sources que les IA citent et leviers par secteur : logiciel RH, conseil, formation, ESN, agence marketing.',
      })
    : pageMeta({
        path: s.path,
        title: 'Visibilité IA par catégorie e-commerce',
        description: 'Requêtes produit, sources de test et de comparaison, leviers par catégorie : cosmétiques, mode, maison, alimentation, sport.',
      });
}

export function SegmentHub({ segment }: { segment: SegmentKey }) {
  const s = SEGMENTS[segment];
  const cats = categoriesFor(segment);
  const pme = segment === 'pme';
  return (
    <PageShell>
      <JsonLd data={breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Visibilité IA', path: '/visibilite-ia' }, { name: s.name, path: s.path }])} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Visibilité IA', href: '/visibilite-ia' }, { name: s.name }]} />
      <h1 className={h1Class} style={h1Style}>
        {pme ? 'Visibilité IA des PME par secteur : questions, sources, leviers' : 'Visibilité IA e-commerce par catégorie : requêtes, sources, leviers'}
      </h1>
      <p className="mt-3 text-sm">
        <Link href={pme ? '/pme' : '/e-commerce'} className="font-semibold underline" style={{ color: 'var(--primary)' }}>
          {pme ? 'Notre offre pour les PME' : 'Notre offre pour l\'e-commerce'}
        </Link>
        {' · '}
        <Link href={pme ? '/guides/apparaitre-dans-chatgpt-pme' : '/guides/trafic-chatgpt-ga4'} className="underline" style={{ color: 'var(--primary)' }}>
          {pme ? 'Guide : apparaître dans ChatGPT quand on est une PME' : 'Guide : mesurer le trafic venu de ChatGPT'}
        </Link>
      </p>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>
        {pme
          ? 'Avant de vous appeler, un acheteur B2B demande souvent à une IA une short-list de prestataires. Voici, par secteur, les questions qu\'il pose et les sources que les IA citent. Les spécialistes parlent de « GEO » (être recommandé par les assistants IA).'
          : 'Vos clients demandent à une IA quel produit choisir, parfois avec un bouton d\'achat. Voici, par catégorie, les requêtes produit et les sources de test ou de comparaison que nous observons.'}
      </p>
      <h2 className={h2Class}>{pme ? 'Choisissez votre secteur' : 'Choisissez votre catégorie'}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {cats.map((c) => (
          <Card key={c.slug}>
            <h3 className="font-semibold text-lg">{c.name}</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{c.intro}</p>
            <Link href={categoryPath(c)} className="mt-3 inline-block text-sm underline" style={{ color: 'var(--primary)' }}>
              Questions types et sources : {c.name.toLowerCase()}
            </Link>
          </Card>
        ))}
      </div>
      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">{pme ? 'Quels noms ChatGPT donne-t-il dans votre secteur ?' : 'Que conseille ChatGPT quand on cherche vos produits ?'}</p>
        <CtaLink href={`/audit?segment=${s.auditSegment}`}>{pme ? 'Tester mon entreprise gratuitement' : 'Tester ma boutique gratuitement'}</CtaLink>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Les scores sont des mesures à un instant donné, avec une fourchette. <Link href="/methode" className="underline">Voir la méthode</Link>.
        </p>
      </div>
    </PageShell>
  );
}

export async function categoryMetadata(segment: SegmentKey, slug: string): Promise<Metadata> {
  const c = getCategory(segment, slug);
  if (!c) return { robots: { index: false } };
  const stats = await getSegmentStats(segment, slug);
  const indexable = isSegmentIndexable(stats);
  return pageMeta({
    path: categoryPath(c),
    title: `${c.name} : que répond ChatGPT ?`,
    description: `Questions que posent les acheteurs aux IA, sources typiquement citées et leviers pour ${c.who}. Audit gratuit.`,
    // Sans données propres : noindex, canonical auto-référent (même règle que les pages métier × ville).
    noindex: !indexable,
  });
}

export async function CategoryPage({ segment, slug }: { segment: SegmentKey; slug: string }) {
  const c = getCategory(segment, slug);
  if (!c) notFound();
  const s = SEGMENTS[segment];
  const srcs = resolveSources(c);
  const faq = segmentFaq(c);
  const path = categoryPath(c);
  const others = categoriesFor(segment).filter((x) => x.slug !== c.slug);
  return (
    <PageShell>
      <JsonLd data={breadcrumbLd([{ name: 'Accueil', path: '/' }, { name: 'Visibilité IA', path: '/visibilite-ia' }, { name: s.name, path: s.path }, { name: c.name, path }])} />
      <JsonLd data={faqLd(faq, path)} />
      <JsonLd data={categoryServiceLd(c)} />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Visibilité IA', href: '/visibilite-ia' }, { name: s.name, href: s.path }, { name: c.name }]} />
      <h1 className={h1Class} style={h1Style}>{c.name} : êtes-vous cité par ChatGPT, Gemini et Perplexity ?</h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed" style={{ color: 'var(--muted)' }}>{c.intro}</p>

      <h2 className={h2Class}>Les questions que posent vos clients</h2>
      <ul className="space-y-2">
        {c.queries.map((q) => (
          <li key={q} className="rounded-lg border px-4 py-3" style={{ borderColor: 'var(--line)', background: '#fff' }}>« {q} »</li>
        ))}
      </ul>

      <h2 className={h2Class}>Les sources typiquement citées</h2>
      <p className="mb-3 text-sm" style={{ color: 'var(--muted)' }}>
        Sites que les IA ont des chances de citer pour ce secteur, d&apos;après notre table de domaines et la littérature publique. Hypothèse de départ,
        à confirmer par la mesure sur vos propres questions. Les sources citées varient fortement d&apos;un mois à l&apos;autre.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {srcs.map((d) => (
          <Card key={d.domain}>
            <p className="font-semibold">{d.label} <span className="text-xs font-normal" style={{ color: 'var(--muted)' }}>· {CATEGORY_LABELS[d.category] ?? d.category}</span></p>
            <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>{d.howToGetListed}</p>
          </Card>
        ))}
      </div>

      <h2 className={h2Class}>Les leviers</h2>
      <div className="space-y-3">
        {c.levers.map((l) => (
          <Card key={l.title}><p className="font-semibold">{l.title}</p><p className="mt-1 leading-relaxed">{l.text}</p></Card>
        ))}
      </div>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Aucun levier ne promet une citation : nous mesurons avant, pendant et après. Nous ne rédigeons jamais d&apos;avis et ne postons jamais sous une fausse identité.
      </p>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Testez {segment === 'pme' ? 'votre entreprise' : 'votre boutique'} sur ces questions.</p>
        <CtaLink href={categoryAuditHref(c)}>{segment === 'pme' ? 'Tester mon entreprise gratuitement' : 'Tester ma boutique gratuitement'}</CtaLink>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Gratuit, sans carte bancaire. <Link href="/methode" className="underline">Voir la méthode</Link>.</p>
      </div>

      <h2 className={h2Class}>Questions fréquentes</h2>
      <div className="space-y-4">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-lg border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
              <span>{f.q}</span>
              <span aria-hidden="true" className="shrink-0 text-xl leading-none transition-transform group-open:rotate-45" style={{ color: 'var(--primary)' }}>+</span>
            </summary>
            <p className="mt-2 leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <h2 className={h2Class}>Voir aussi</h2>
      <ul className="list-disc space-y-1 pl-6">
        {others.slice(0, 3).map((o) => (
          <li key={o.slug}><Link href={categoryPath(o)} className="underline" style={{ color: 'var(--primary)' }}>Visibilité IA : {o.name.toLowerCase()}</Link></li>
        ))}
        <li><Link href="/guides" className="underline" style={{ color: 'var(--primary)' }}>Nos guides sur le référencement IA</Link></li>
        <li><Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>Comment nous mesurons la visibilité IA</Link></li>
      </ul>
    </PageShell>
  );
}
