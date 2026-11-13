import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/meta';
import { JsonLd } from '@/lib/seo/shell';
import { EditorialFrame } from '@/components/pages/v4/Editorial';
import { Byline, SourcesList, TableWrap, AuditCta, withRefs, EDITORIAL_PUBLISHED, EDITORIAL_UPDATED } from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, faqPageLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { fmtDate } from '@/lib/seo';
import { CELLS, COMPARE_CHECKED, COMPETITORS, FEATURES, competitorPath, getCompetitor, makeRefs } from '@/lib/seo/competitors';

export const dynamicParams = false;
export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) return {};
  return pageMeta({
    path: competitorPath(c),
    title: `Repéré ou ${c.name} : lequel choisir ?`,
    description: c.description,
    type: 'article',
    publishedTime: EDITORIAL_PUBLISHED,
    modifiedTime: EDITORIAL_UPDATED,
  });
}

/** Lignes montrées côte à côte sur la page d'un concurrent (les plus décisives). */
const SIDE_BY_SIDE = ['questions', 'ia', 'faits', 'execution', 'audit', 'integrations', 'prix', 'langue', 'cible', 'engagement'] as const;

export default async function CompetitorPage({ params }: Props) {
  const { slug } = await params;
  const c = getCompetitor(slug);
  if (!c) notFound();
  const path = competitorPath(c);
  const R = makeRefs();

  const answer = R.t(c.answer);
  const intro = R.t(c.intro);
  const strengths = c.strengths.map(R.t);
  const rows = SIDE_BY_SIDE.map((id) => {
    const label = FEATURES.find((f) => f.id === id)!.label;
    return [label, withRefs(R.t(CELLS.repere[id])), withRefs(R.t(CELLS[c.slug][id]))];
  });
  const chooseThem = c.chooseThem.map(R.t);
  const chooseUs = c.chooseUs.map(R.t);
  const sources = R.sources();

  const title = `Repéré ou ${c.name} : lequel choisir ?`;
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Comparatif', path: '/comparatif' },
    { name: `Repéré ou ${c.name}`, path },
  ];
  const toc = [
    { id: 'reponse', label: 'La réponse courte' },
    { id: 'tableau', label: 'Les deux côte à côte' },
    { id: 'mieux', label: `Là où ${c.name} est plus complet` },
    { id: 'choix', label: 'Qui choisir selon votre besoin ?' },
    { id: 'limites', label: 'Les limites de Repéré' },
    { id: 'faq', label: 'Questions fréquentes' },
  ];
  const others = COMPETITORS.filter((o) => o.slug !== c.slug);

  return (
    <EditorialFrame
      head={
        <JsonLd
          data={graph([
            webPageLd(path, { name: title, description: c.description, dateModified: EDITORIAL_UPDATED }, { withContext: false }),
            articleLd({
              path,
              headline: title,
              description: c.description,
              datePublished: EDITORIAL_PUBLISHED,
              dateModified: EDITORIAL_UPDATED,
              citation: sources.map((s) => s.url),
              withContext: false,
            }),
            faqPageLd(path, c.faq, { withContext: false }),
            breadcrumbListLd(path, crumbs, { withContext: false }),
          ])}
        />
      }
      crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Comparatif', href: '/comparatif' }, { name: `Repéré ou ${c.name}` }]}
      title={title}
      meta={<Byline />}
      intro={<p>{c.what} Les prix et fonctions ci-dessous ont été relevés le {fmtDate(c.checked ?? COMPARE_CHECKED)} ; Repéré est un concurrent de {c.name}, nous le
          disons et nous indiquons nos limites.</p>}
      toc={toc}
    >
      <>

        <section id="reponse" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">La réponse courte</h2>
          <p className="mb-3 text-lg font-medium leading-relaxed">{withRefs(answer)}</p>
          <p className="leading-relaxed">{withRefs(intro)}</p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            {c.origin}. {c.priceStatus}
          </p>
        </section>

        <section id="tableau" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Les deux côte à côte</h2>
          <TableWrap caption={`Relevé du ${fmtDate(c.checked ?? COMPARE_CHECKED)}.`} head={['', 'Repéré', c.name]} rows={rows} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Le tableau complet, avec tous les outils et toutes les fonctions, est sur la page{' '}
            <Link href="/comparatif#fonctions" className="underline">Comparatif</Link>.
          </p>
        </section>

        <section id="mieux" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Là où {c.name} est plus complet que Repéré</h2>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            {strengths.map((s) => (
              <li key={s}>{withRefs(s)}</li>
            ))}
          </ul>
        </section>

        <section id="choix" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Qui choisir selon votre besoin ?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
              <h3 className="font-semibold text-lg">Choisissez {c.name} si…</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
                {chooseThem.map((x) => (
                  <li key={x}>{withRefs(x)}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
              <h3 className="font-semibold text-lg">Choisissez Repéré si…</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
                {chooseUs.map((x) => (
                  <li key={x}>{withRefs(x)}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="limites" className="scroll-mt-20">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Les limites de Repéré dans cette comparaison</h2>
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            {c.ourLimits.map((x) => (
              <li key={x}>{x}</li>
            ))}
            <li>Aucune promesse de position : ni Repéré ni {c.name} ne peuvent garantir d’être cité par une IA.</li>
          </ul>
        </section>

        <section id="faq" className="scroll-mt-20">
          <h2 className="mt-12 mb-4 font-semibold text-2xl">Questions fréquentes</h2>
          <div className="space-y-5">
            {c.faq.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-lg">{f.q}</h3>
                <p className="mt-1 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <AuditCta text={`Avant de choisir entre Repéré et ${c.name}, mesurez votre point de départ : l'offre Découverte est gratuite.`} />
        <SourcesList sources={sources} />
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Comparaison établie selon les règles de la publicité comparative : faits vérifiables, sourcés et datés, sans dénigrement. Une information vous
          paraît inexacte ? Écrivez-nous depuis la page <Link href="/a-propos" className="underline">À propos</Link> : nous vérifions et corrigeons.
        </p>

        <nav aria-label="Autres comparaisons">
          <h2 className="mt-12 mb-3 font-semibold text-2xl">Autres comparaisons</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              <Link href="/comparatif" className="underline" style={{ color: 'var(--primary)' }}>
                Le comparatif complet
              </Link>
            </li>
            {others.map((o) => (
              <li key={o.slug}>
                <Link href={competitorPath(o)} className="underline" style={{ color: 'var(--primary)' }}>
                  Repéré ou {o.name} : lequel choisir ?
                </Link>
              </li>
            ))}
            <li>
              <Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>
                Notre méthode de mesure
              </Link>
            </li>
          </ul>
        </nav>
      </>
    </EditorialFrame>
  );
}
