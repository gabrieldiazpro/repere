import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { AnalysisApp } from '@/components/analysis/AnalysisApp';
import { brandTestEngines } from '@/lib/analysis/aicheck';
import { resolveAnalysisPrefill } from '@/components/analysis/prefill';
import s from '@/components/analysis/analysis.module.css';
import { BRAND, abs } from '@/lib/seo/site';
import { SOFTWARE_ID, breadcrumbListLd, graph, orgRef, pageIds, webPageLd } from '@/lib/seo/jsonld';
import { JsonLd } from '@/lib/seo/shell';

const PATH = '/analyse';
const TITLE = 'Test gratuit : votre marque est-elle citée par les IA ?';
const DESC =
  'Vraies questions de clients posées en direct aux IA : êtes-vous cité, à quelle place, qui l’est à votre place et pourquoi. Puis l’analyse SEO et GEO du site.';

export const metadata: Metadata = {
  // Titre absolu : avec « | Repéré », il dépassait 60 caractères (coupé dans Google).
  title: { absolute: TITLE },
  description: DESC,
  alternates: { canonical: abs(PATH) },
  openGraph: { title: TITLE, description: DESC, url: abs(PATH), type: 'website', locale: 'fr_FR', siteName: BRAND, images: [{ url: abs('/opengraph-image'), width: 1200, height: 630, alt: `${BRAND} — analyse SEO et IA` }] },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: [abs('/opengraph-image')] },
};

/** Étapes visibles sur la page ET dans le JSON-LD HowTo (mêmes textes). */
const STEPS = [
  { name: 'Entrez l’adresse de votre site', text: 'Un seul champ : la marque, la ville et le métier sont détectés sur votre site, et vous pouvez les corriger.' },
  { name: 'Voyez les IA répondre en direct', text: 'Nous posons 3 à 5 questions de clients à chaque IA configurée : cité ou non, à quelle place, qui l’est à votre place, la phrase exacte et les sources lues, avec la marge d’erreur.' },
  { name: 'Comprenez pourquoi, puis agissez', text: 'Pour chaque concurrent cité à votre place : ce que l’IA a lu et ce que son site montre que le vôtre ne montre pas. Puis l’analyse de votre site (jusqu’à 60 pages) et vos premières actions.' },
];

const ld = graph([
  webPageLd(PATH, { name: TITLE, description: DESC, mainEntity: `${abs(PATH)}#app` }, { withContext: false }),
  breadcrumbListLd(
    PATH,
    [
      { name: 'Accueil', path: '/' },
      { name: 'Analyse gratuite', path: PATH },
    ],
    { withContext: false },
  ),
  {
    // Service (et non WebApplication) : Google exige aggregateRating/review pour un logiciel ; nous n'en publions pas.
    '@type': 'Service',
    '@id': `${abs(PATH)}#app`,
    name: `Analyse SEO et IA ${BRAND}`,
    url: abs(PATH),
    description: DESC,
    serviceType: 'Audit SEO et référencement IA (GEO)',
    areaServed: { '@type': 'Country', name: 'France' },
    audience: { '@type': 'BusinessAudience', name: 'Professionnels' },
    availableChannel: { '@type': 'ServiceChannel', serviceUrl: abs(PATH) },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR', category: 'Gratuit', availability: 'https://schema.org/OnlineOnly' },
    provider: orgRef(),
    isRelatedTo: { '@id': SOFTWARE_ID },
  },
  {
    '@type': 'HowTo',
    '@id': `${pageIds(PATH).url}#howto`,
    name: 'Savoir si sa marque est citée par les IA, et pourquoi',
    description: DESC,
    inLanguage: 'fr-FR',
    totalTime: 'PT1M',
    tool: { '@type': 'HowToTool', name: `Analyse ${BRAND}` },
    step: STEPS.map((st, i) => ({ '@type': 'HowToStep', position: i + 1, name: st.name, text: st.text, url: `${abs(PATH)}#etape-${i + 1}` })),
  },
]);

type SP = Record<string, string | string[] | undefined>;

export default async function AnalysePage({ searchParams }: { searchParams: Promise<SP> }) {
  const prefill = resolveAnalysisPrefill(await searchParams);
  return (
    <>
      <JsonLd data={ld} />
      <Header />
      <main id="contenu" style={{ background: 'var(--color-canvas)' }}>
        <AnalysisApp prefill={prefill} engines={brandTestEngines()}>
        <section className={s.section} aria-labelledby="comment-h">
          <h2 id="comment-h" className={s.h2}>
            Comment se passe l’analyse
          </h2>
          <ol className={s.prios}>
            {STEPS.map((st, i) => (
              <li key={st.name} id={`etape-${i + 1}`} className={s.prio}>
                <h3 className={s.prioTitle} style={{ marginTop: 4 }}>
                  {st.name}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted">{st.text}</p>
              </li>
            ))}
          </ol>
          <p className={`${s.small} mt-6`}>
            Pas encore de site, ou vous voulez seulement savoir si les IA vous citent ?{' '}
            <Link href="/audit" className="font-semibold text-primary underline underline-offset-2">
              Faites le test de visibilité IA avec le nom de votre entreprise
            </Link>
            . Pour aller plus loin : <Link href="/methode" className="underline underline-offset-2">notre méthode</Link>,{' '}
            <Link href="/questions/audit-seo-gratuit" className="underline underline-offset-2">comment faire un audit SEO gratuit</Link> et{' '}
            <Link href="/questions/savoir-si-les-ia-recommandent-mon-entreprise" className="underline underline-offset-2">comment savoir si les IA vous recommandent</Link>.
          </p>
        </section>
        </AnalysisApp>
      </main>
      <Footer />
    </>
  );
}
