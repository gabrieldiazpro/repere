import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { JsonLd } from '@/lib/seo/shell';
import { ChoiceCards, EditorialFrame } from '@/components/pages/v4/Editorial';
import { Counter } from '@/components/motion/Counter';
import {
  Byline,
  QaSection,
  SourcesList,
  RelatedLinks,
  TableWrap,
  AuditCta,
  withRefs,
  EDITORIAL_PUBLISHED,
  EDITORIAL_UPDATED,
} from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, faqPageLd, graph, webPageLd, type QA } from '@/lib/seo/jsonld';
import { fmtDate } from '@/lib/seo';
import { CELLS, COLUMN_LABELS, COMPARE_CHECKED, COMPARE_CHECKED_SEO, COMPETITORS, FEATURES, OTHER_FR, competitorPath, makeRefs, type ColumnId, type FeatureId } from '@/lib/seo/competitors';

const PATH = '/comparatif';
const TITLE = 'Repéré, Semrush, Ahrefs, Screaming Frog, Peec, Otterly, Meteoria, agences : comparatif honnête';
const DESCRIPTION =
  "Suites SEO et outils GEO comparés : audit, positions, IA suivies, exécution, prix publics datés et sourcés, et quand choisir un autre outil.";
const SEO_TITLE = 'Repéré vs Semrush, Ahrefs, Peec, Otterly : comparatif';

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'article',
  publishedTime: EDITORIAL_PUBLISHED,
  modifiedTime: EDITORIAL_UPDATED,
});

const COLS: ColumnId[] = ['repere', 'peec', 'otterly', 'profound', 'meteoria', 'qwairy', 'agence-geo'];
/** V5 : Repéré face aux suites SEO (relevé du 13 novembre 2026). */
const SEO_COLS: ColumnId[] = ['repere', 'semrush', 'ahrefs', 'screaming-frog'];
const SEO_ROWS: FeatureId[] = ['audit', 'seo', 'positions', 'ia', 'questions', 'execution', 'gratuit', 'prix', 'integrations'];

/** Où un concurrent est meilleur que Repéré : dit sans détour. */
const BETTER_ELSEWHERE = [
  'Couverture des IA : Peec, Otterly, Profound, Meteoria et Qwairy suivent les AI Overviews ou l’AI Mode de Google ; Repéré ne les mesure pas, faute d’interface propre pour le faire.',
  'Intégrations : API, serveur MCP et Looker Studio existent chez plusieurs concurrents, pas chez Repéré.',
  'SEO avancé : Semrush et Ahrefs ont des index de mots-clés et de liens que Repéré n’a pas ; Screaming Frog explore des sites bien plus grands.',
  'Volume : au-delà de 100 questions suivies ou de plusieurs pays, un outil spécialisé est plus adapté.',
  'Preuves publiques : Peec, Otterly, Profound et Qwairy ont des notes et des avis publics ; Repéré n’en a pas encore, et n’en invente pas.',
  'Audit de page détaillé : Otterly teste l’accès d’une vingtaine de robots d’IA un par un.',
];

const NOT_US: { title: string; text: string }[] = [
  {
    title: 'Vous avez une équipe marketing qui veut piloter elle-même',
    text: 'Si une personne de votre équipe a le temps d’exploiter un tableau de bord chaque semaine et veut suivre des centaines de questions, plusieurs pays ou plus de quatre IA, Peec, Otterly, Meteoria ou Qwairy seront plus complets que Repéré sur la mesure.',
  },
  {
    title: 'Vous êtes une grande marque ou une ETI multi-pays',
    text: 'Repéré est conçu pour les TPE, PME et e-commerces, en France et en français. Pour SSO, SOC 2, neuf moteurs et un contrat sur devis, Profound ou une agence seront mieux adaptés.',
  },
  {
    title: 'Vous voulez une refonte de site, du SEO lourd ou des relations presse',
    text: 'Nous rédigeons des pages, balisons et préparons des démarches vers les sources citées, mais nous ne refaisons pas de site et ne menons pas de campagnes de relations presse. Une agence complète est plus adaptée.',
  },
  {
    title: 'Vous êtes une agence qui veut un espace multi-clients maintenant',
    text: 'Qwairy, Peec et Otterly proposent des espaces pour agences dès aujourd’hui. Notre offre Agence (marque blanche, rapports partagés) est en liste d’attente à l’achat.',
  },
  {
    title: 'Vous attendez une garantie de position',
    text: 'Nous ne promettons ni d’être premier, ni d’être cité. Si c’est la condition de votre achat, ne nous choisissez pas, et méfiez-vous de ceux qui la promettent.',
  },
  {
    title: 'Vous avez le temps et l’envie de tout faire vous-même',
    text: 'Nos guides, notre glossaire et nos outils gratuits sont gratuits. Avec quelques heures par mois, vous pouvez faire l’essentiel seul ; l’offre Découverte suffit alors pour mesurer votre point de départ.',
  },
];

const FAQ: QA[] = [
  {
    q: 'Quelle est la différence entre Repéré et un outil comme Peec ou Otterly ?',
    a: "Un outil de mesure montre ce que répondent les IA et recommande des actions ; vous les réalisez. Repéré mesure aussi, explique quelles sources font citer vos concurrents, vérifie les faits dits sur vous et, avec l'offre Accompagné, réalise le travail après votre validation.",
  },
  {
    q: 'Pourquoi Repéré coûte-t-il moins cher qu’une agence GEO ?',
    a: "Parce que la mesure et la préparation des actions sont automatisées, et que l'offre est limitée à un périmètre précis par mois (fiches, pages, sources). Une agence propose un accompagnement plus large et sur mesure, à un prix plus élevé.",
  },
  {
    q: 'Ces prix sont-ils à jour ?',
    a: `Ils ont été relevés le ${fmtDate(COMPARE_CHECKED)} sur les pages citées en source. Quand le site de l'éditeur n'a pas pu être lu, le prix est marqué « non vérifié » et vient d'un annuaire ou d'une source tierce. Les éditeurs changent souvent leurs grilles : vérifiez sur leur site avant de décider.`,
  },
  {
    q: 'Repéré est-il partenaire ou concurrent des outils cités ?',
    a: "Concurrent. Nous n'avons aucun lien commercial avec les outils ni les agences mentionnés. C'est pourquoi chaque fait de cette page renvoie à une source publique et datée.",
  },
  {
    q: 'Repéré suit-il les AI Overviews de Google ?',
    a: "Non. Nous ne mesurons pas les AI Overviews ni l'AI Mode de Google, faute d'interface propre pour le faire de façon fiable. Repéré suit ChatGPT, Perplexity, Gemini et Claude, avec Mistral en option.",
  },
];

const TOC = [
  { id: 'resume', label: 'Quelle option choisir, en une phrase ?' },
  { id: 'fonctions', label: 'Fonctionnalité par fonctionnalité' },
  { id: 'suites-seo', label: 'Repéré face à Semrush, Ahrefs et Screaming Frog' },
  { id: 'prix', label: 'Combien coûtent les outils, les agences et Repéré ?' },
  { id: 'autres', label: 'Où un autre outil est meilleur' },
  { id: 'pas-repere', label: 'Quand choisir un autre outil ?' },
  { id: 'detail', label: 'Comparatifs détaillés, outil par outil' },
  { id: 'faq', label: 'Questions fréquentes' },
];

export default function ComparatifPage() {
  const R = makeRefs();
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Comparatif', path: PATH },
  ];

  // Ordre de numérotation des sources = ordre d'apparition dans la page.
  const featureRows = FEATURES.map((f) => [f.label, ...COLS.map((c) => withRefs(R.t(CELLS[c][f.id])))]);
  const seoRows = SEO_ROWS.map((id) => [FEATURES.find((f) => f.id === id)!.label, ...SEO_COLS.map((c) => withRefs(R.t(CELLS[c][id])))]);
  const priceRows = [...COLS, ...SEO_COLS.slice(1)].filter((c) => c !== 'repere').map((c) => [COLUMN_LABELS[c], withRefs(R.t(CELLS[c].prix)), withRefs(R.t(CELLS[c].preuves))]);
  const otherRows = OTHER_FR.map((o) => [o.name, withRefs(R.t(o.price)), withRefs(R.t(o.engines)), withRefs(R.t(o.free))]);
  const sources = R.sources();

  return (
    <EditorialFrame
      wide
      head={
        <JsonLd
          data={graph([
            webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: EDITORIAL_UPDATED }, { withContext: false }),
            articleLd({
              path: PATH,
              headline: 'Repéré, outils de mesure, agences GEO : le comparatif',
              description: DESCRIPTION,
              datePublished: EDITORIAL_PUBLISHED,
              dateModified: EDITORIAL_UPDATED,
              citation: sources.map((s) => s.url),
              withContext: false,
            }),
            faqPageLd(PATH, FAQ, { withContext: false }),
            breadcrumbListLd(PATH, crumbs, { withContext: false }),
          ])}
        />
      }
      crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Comparatif' }]}
      title="Repéré, outils de mesure, agences GEO : le comparatif honnête"
      meta={<Byline />}
      intro={<p>Cette page compare Repéré à cinq outils de mesure de la visibilité IA (Peec AI, Otterly.AI, Profound, Meteoria, Qwairy), aux agences GEO et au
          fait de tout faire soi-même. Prix et fonctions ont été relevés le {fmtDate(COMPARE_CHECKED)}, avec leur source ; ce qui n’a pas pu être lu sur
          le site de l’éditeur est marqué « non vérifié ». Repéré est l’un des acteurs comparés : nous disons aussi où les autres sont meilleurs.</p>}
      visual={
        <ChoiceCards
          label="Les trois options en une phrase"
          items={[
            { title: 'Un outil de mesure', verdict: 'Vous montre le problème.', figure: <>29 à <Counter value={495} /> $</>, figureNote: 'par mois, entrée et milieu de gamme' },
            { title: 'Une agence GEO', verdict: 'Le traite, sur devis.', figure: <><Counter value={5000} /> €</>, figureNote: 'budget médian par prestation' },
            { title: 'Repéré', verdict: 'Mesure, puis fait le travail courant.', figure: <>0 à <Counter value={490} /> €</>, figureNote: 'par mois, selon le parcours et l’offre', mark: true },
          ]}
          caption={<>Prix publics relevés le {fmtDate(COMPARE_CHECKED)} ; détail et sources dans la section <a href="#prix" className="underline underline-offset-2">prix</a>.</>}
        />
      }
      toc={TOC}
    >
      <>

        <QaSection
          id="resume"
          q="Quelle option choisir, en une phrase ?"
          answer="Choisir en une phrase : une suite SEO ou un outil de mesure montre le problème, une agence le traite sur devis, Repéré analyse, mesure et corrige pour un prix de logiciel."
        />

      <QaSection
        id="fonctions"
        q="Qui fait quoi, fonctionnalité par fonctionnalité ?"
        answer="Tous mesurent la visibilité dans les IA ; les différences portent sur les IA couvertes, la vérification des faits, l'exécution, les intégrations et le prix d'entrée."
      >
        <TableWrap
          caption={`Relevé du ${fmtDate(COMPARE_CHECKED)}. Les chiffres entre crochets renvoient aux sources. « Non relevé » : absent de nos sources, à vérifier chez l'éditeur.`}
          head={['', ...COLS.map((c) => COLUMN_LABELS[c])]}
          rows={featureRows}
        />
      </QaSection>

        <QaSection
          id="suites-seo"
          q="Et face à Semrush, Ahrefs ou Screaming Frog ?"
          answer="Face à Semrush, Ahrefs ou Screaming Frog, Repéré est moins complet pour un spécialiste, mais réunit pour un dirigeant l'audit SEO et GEO, la mesure des IA et les corrections."
        >
          <TableWrap
            caption={`Relevé du ${fmtDate(COMPARE_CHECKED_SEO)}. Les chiffres entre crochets renvoient aux sources.`}
            head={['', ...SEO_COLS.map((c) => COLUMN_LABELS[c])]}
            rows={seoRows}
          />
        </QaSection>

        <QaSection
          id="prix"
          q="Combien coûtent les outils, les agences et Repéré ?"
          answer="Les outils de mesure des IA affichent de 29 $ à 495 $ par mois en entrée et milieu de gamme, les suites SEO de 129 $ à 499,95 $ par mois (Screaming Frog : 245 € par an), les agences GEO facturent un budget médian de 5 000 € par prestation, et Repéré coûte de 0 € à 490 € par mois selon le parcours et l'offre."
        >
          <TableWrap
            caption={`Prix publics relevés le ${fmtDate(COMPARE_CHECKED)}, non convertis. « Non vérifié » : prix lu dans un annuaire ou une source tierce, pas sur le site de l'éditeur.`}
            head={['Acteur', 'Prix publics', 'Avis publics']}
            rows={priceRows}
          />
          <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
            Repéré : Découverte gratuite ; Essentiel 29 €/mois (local), 79 € (e-commerce), 99 € (PME) ; Accompagné 99 €, 390 €, 490 € par mois, 3 mois minimum.
            Le détail est sur la page <Link href="/tarifs" className="underline">Tarifs</Link>.
          </p>
          <h3 className="mt-6 font-semibold text-lg">Autres outils français</h3>
          <TableWrap
            caption="Relevés tiers, non vérifiés sur les sites des éditeurs ; prix susceptibles d'avoir changé."
            head={['Outil', 'Prix relevés', 'IA suivies', 'Essai ou gratuit']}
            rows={otherRows}
          />
        </QaSection>

        <QaSection
          id="autres"
          q="Où un autre outil est-il meilleur que Repéré ?"
          answer="Sur la couverture des moteurs, les intégrations, le volume de questions et les preuves publiques, plusieurs concurrents sont aujourd'hui plus complets que Repéré."
        >
          <ul className="list-disc space-y-2 pl-6 leading-relaxed">
            {BETTER_ELSEWHERE.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </QaSection>

        <QaSection
          id="pas-repere"
          q="Quand choisir un autre outil ?"
          answer="Choisissez un autre outil si vous avez une équipe qui veut piloter seule une mesure très étendue, si vous êtes une grande marque multi-pays, si vous cherchez une agence complète, si vous voulez un espace d'agence maintenant ou si vous attendez une garantie de position."
        >
          <div className="space-y-4">
            {NOT_US.map((n) => (
              <div key={n.title} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
                <h3 className="font-semibold text-lg">{n.title}</h3>
                <p className="mt-1 leading-relaxed">{n.text}</p>
              </div>
            ))}
          </div>
        </QaSection>

        <QaSection
          id="detail"
          q="Repéré ou…, lequel choisir ?"
          answer="Une page par comparaison, avec les prix datés, les points forts de chacun et les cas où Repéré n'est pas le bon choix."
        >
          <ul className="list-disc space-y-1 pl-6">
            {COMPETITORS.map((c) => (
              <li key={c.slug}>
                <Link href={competitorPath(c)} className="underline" style={{ color: 'var(--primary)' }}>
                  Repéré ou {c.name} : lequel choisir ?
                </Link>
              </li>
            ))}
          </ul>
        </QaSection>

        <section id="faq" className="scroll-mt-20">
          <h2 className="mt-12 mb-4 font-semibold text-2xl">Questions fréquentes</h2>
          <div className="space-y-5">
            {FAQ.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-lg">{f.q}</h3>
                <p className="mt-1 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        <AuditCta text="Avant de choisir, mesurez votre point de départ : que disent ChatGPT, Gemini et Perplexity de votre entreprise ?" />
        <SourcesList sources={sources} />
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
          Page de comparaison établie selon les règles de la publicité comparative : caractéristiques essentielles, pertinentes, vérifiables et
          représentatives, sans dénigrement. Plusieurs sources citées sont elles-mêmes des annuaires rémunérés ou des éditeurs concurrents : nous le
          précisons à chaque fois. Un éditeur cité estime qu&apos;une information est inexacte ? Écrivez-nous depuis la page{' '}
          <Link href="/a-propos" className="underline">À propos</Link> : nous vérifions et corrigeons la page si elle est inexacte.
        </p>
        <RelatedLinks current={PATH} />
      </>
    </EditorialFrame>
  );
}
