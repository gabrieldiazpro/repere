import type { ReactNode } from 'react';
import Link from 'next/link';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { Crumbs, JsonLd } from '@/lib/seo/shell';
import { abs } from '@/lib/seo';
import { pageMeta } from '@/lib/seo/meta';
import { breadcrumbListLd, graph, pageIds, webPageLd } from '@/lib/seo/jsonld';
import { buttonClasses } from '@/components/ui/Button';
import { TOOLS, TOOLS_UPDATED, toolPath } from '@/components/tools/registry';
import { ToolHub } from '@/components/tools/ToolHub';
import { HUB_GROUPS } from '@/components/tools/hub';
import { MotionRoot } from '@/components/motion/MotionRoot';
import { AiBubble, StepPath } from '@/components/pages/v4/diagrams';
import { Icon, type IconName } from '@/components/app/icons';

const PATH = '/outils';
const TITLE = 'Outils gratuits pour être lu et cité par les IA';
const DESCRIPTION =
  'Neuf outils gratuits, sans inscription : robots.txt des IA, site prêt pour ChatGPT, citabilité, JSON-LD, rendu sans JavaScript, comparateur, llms.txt, lien d’avis Google, fiche produit.';

const RULES: { icon: IconName; title: string; text: ReactNode }[] = [
  { icon: 'eye', title: 'Aucune IA interrogée', text: <>Lecture du HTML, du robots.txt et du sitemap, selon les règles de notre page <Link href="/methode" className="underline underline-offset-2">Méthode</Link>. Même site, même résultat.</> },
  { icon: 'shield', title: 'Un robot qui se déclare', text: 'RepereBot respecte le robots.txt de la page analysée et ne lit que des pages publiques.' },
  { icon: 'check', title: 'Sans inscription', text: 'Le résultat s’affiche tout de suite. L’e-mail ne sert qu’à recevoir la suite, si vous le voulez.' },
  { icon: 'lock', title: 'Usage limité', text: 'Pour éviter les abus, le nombre d’analyses par heure et par connexion est limité.' },
];

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION });

export default function OutilsHub() {
  const ids = pageIds(PATH);
  return (
    <>
      <Header />
      <main id="contenu" className="bg-canvas text-ink">
        <JsonLd
          data={graph([
            { ...webPageLd(PATH, { name: TITLE, description: DESCRIPTION, type: 'CollectionPage', dateModified: TOOLS_UPDATED }, { withContext: false }), mainEntity: { '@id': ids.list } },
            {
              '@type': 'ItemList',
              '@id': ids.list,
              itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(toolPath(t.slug)), name: t.name })),
            },
            breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Outils gratuits', path: PATH }], { withContext: false }),
          ])}
        />
        <MotionRoot />
        <section aria-labelledby="outils-h1" className="relative overflow-hidden">
          <div aria-hidden="true" className="scope-grid absolute inset-x-0 top-0 h-80 [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
          <div className="relative mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
            <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Outils gratuits' }]} />
          </div>
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14 lg:px-8 lg:pb-16">
            <div>
              <h1 id="outils-h1" className="max-w-xl text-[2.2rem] font-bold leading-[1.05] tracking-[-0.03em] sm:text-[3.1rem]" style={{ fontFamily: 'var(--font-display)' }}>
                Vérifiez ce que les IA peuvent lire de votre site
              </h1>
              <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-ink/75">
                {TOOLS.length} outils gratuits, sans inscription, résultat immédiat. Ils regardent votre site, pas ce que les IA répondent sur vous.
              </p>
            </div>
            <StepPath
              label="Le chemin d’un robot d’IA sur votre site, en trois étapes"
              start={{ icon: 'globe', text: 'Votre site' }}
              steps={HUB_GROUPS.map((g, i) => ({
                href: `#${g.id}`,
                icon: (['lock', 'database', 'quote'] as const)[i] ?? 'check',
                title: (['Entrer', 'Comprendre', 'Citer'] as const)[i] ?? g.title,
                text: g.text,
              }))}
              end={<AiBubble who="Exemple de réponse d’une IA">« D’après <mark>votre-site.fr</mark>, l’atelier est ouvert le samedi… »</AiBubble>}
            />
          </div>
        </section>
        <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
          <ToolHub items={TOOLS.map((t) => ({ slug: t.slug, href: toolPath(t.slug), name: t.name, h1: t.h1, output: t.output, parcours: t.parcours }))} />
          <section className="mt-16 grid gap-6 rounded-[20px] bg-primary-deep p-6 text-white sm:grid-cols-[1fr_auto] sm:items-center sm:p-10" aria-labelledby="hub-audit">
            <div>
              <h2 id="hub-audit" className="max-w-2xl text-[1.6rem] font-bold leading-tight sm:text-[2rem]" style={{ fontFamily: 'var(--font-display)' }}>
                Ces outils regardent votre site. L’audit regarde ce que les IA disent de vous.
              </h2>
              <p className="mt-3 max-w-[56ch] text-on-deep">Nous posons à ChatGPT, Perplexity et Gemini les questions de vos clients, et vous montrons qui elles recommandent.</p>
            </div>
            <Link href="/audit" className={buttonClasses({ variant: 'light', size: 'lg', className: 'lift' })}>
              Lancer l’audit gratuit
            </Link>
          </section>
          <section className="mt-14" aria-labelledby="hub-rules">
            <h2 id="hub-rules" className="text-[1.4rem] font-bold" style={{ fontFamily: 'var(--font-display)' }}>
              Comment fonctionnent ces outils
            </h2>
            <ul className="mt-5 grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {RULES.map((r) => (
                <li key={r.title} className="flex gap-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-primary shadow-[0_0_0_1px_var(--color-line)]" aria-hidden="true">
                    <Icon name={r.icon} size={18} />
                  </span>
                  <span className="leading-relaxed">
                    <strong className="block">{r.title}</strong>
                    <span className="text-ink/75">{r.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
