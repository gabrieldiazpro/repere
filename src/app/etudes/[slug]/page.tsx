import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo/meta';

/** Titles SEO de 50 à 60 caractères (le h1 garde le titre complet). */
const SEO_TITLES: Record<string, string> = {
  'barometre-visibilite-ia': 'Baromètre de la visibilité IA en France',
  'ce-que-nous-savons-deja': 'Recherche IA en France : ce que disent les études',
};
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import {
  Byline,
  QaSection,
  SourcesList,
  Toc,
  RelatedLinks,
  TableWrap,
  AuditCta,
  withRefs,
  type Source,
} from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, graph, orgRef, pageIds, webPageLd } from '@/lib/seo/jsonld';
import { abs, fmtDate, METHOD_VERSION } from '@/lib/seo';
import {
  STUDIES,
  STUDY_MIN_SUBGROUP,
  STUDY_PUBLISH_AT,
  getStudy,
  getStudyStats,
  studyPath,
  type StudyMeta,
  type StudyStats,
} from '@/lib/studies';

export const dynamicParams = false;
/** Le Baromètre se recalcule au plus une fois par jour. */
export const revalidate = 86400;

export function generateStaticParams() {
  return STUDIES.map((s) => ({ slug: s.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = getStudy((await params).slug);
  if (!s) return { robots: { index: false } };
  return pageMeta({
    path: studyPath(s),
    title: SEO_TITLES[s.slug] ?? s.title,
    ogTitle: s.title,
    description: s.description,
    type: 'article',
    publishedTime: s.published,
    modifiedTime: s.updated,
  });
}

export default async function StudyPage({ params }: Props) {
  const s = getStudy((await params).slug);
  if (!s) notFound();
  const path = studyPath(s);
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Études', path: '/etudes' },
    { name: s.title, path },
  ];
  const stats = s.slug === 'barometre-visibilite-ia' ? await getStudyStats() : null;
  const published = !!stats && stats.count >= STUDY_PUBLISH_AT;
  const sources = s.slug === 'ce-que-nous-savons-deja' ? KNOWN_SOURCES : [];

  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          webPageLd(path, { name: s.title, description: s.description, dateModified: published ? stats!.computedAt.slice(0, 10) : s.updated }, { withContext: false }),
          articleLd({
            path,
            headline: s.title,
            description: s.description,
            datePublished: s.published,
            dateModified: published ? stats!.computedAt.slice(0, 10) : s.updated,
            type: 'Report',
            citation: sources.map((x) => x.url),
            image: abs(`${path}/opengraph-image`),
            withContext: false,
          }),
          published ? datasetLd(s, stats!) : null,
          breadcrumbListLd(path, crumbs, { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Études', href: '/etudes' }, { name: s.title }]} />
      <h1 className={h1Class} style={h1Style}>
        {s.title}
      </h1>
      <Byline published={s.published} updated={published ? stats!.computedAt.slice(0, 10) : s.updated} />
      {s.slug === 'barometre-visibilite-ia' ? <Barometre stats={stats} /> : <KnownStudies />}
      <AuditCta />
      {sources.length > 0 && <SourcesList sources={sources} />}
      <RelatedLinks current="/etudes" />
    </PageShell>
  );
}

/* ------------------------------------------------------------------ */
/* Baromètre                                                           */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL: Record<string, string> = {
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
  perplexity: 'Perplexity',
  claude: 'Claude',
  copilot: 'Copilot',
};
const SEGMENT_LABEL: Record<string, string> = {
  local: 'Commerces locaux',
  pme: 'PME et services B2B',
  ecommerce: 'E-commerce',
  inconnu: 'Parcours non renseigné',
};

function datasetLd(s: StudyMeta, st: StudyStats) {
  const ids = pageIds(studyPath(s));
  return {
    '@type': 'Dataset',
    '@id': ids.dataset,
    name: 'Baromètre Repéré de la visibilité IA (agrégats)',
    description: `Statistiques agrégées et anonymes de ${st.count} audits de visibilité IA réalisés par Repéré sur ChatGPT, Gemini et Perplexity, entre le ${fmtDate(st.periodStart)} et le ${fmtDate(st.periodEnd)}.`,
    url: abs(studyPath(s)),
    inLanguage: 'fr-FR',
    creator: orgRef(),
    publisher: orgRef(),
    isAccessibleForFree: true,
    dateModified: st.computedAt,
    temporalCoverage: `${st.periodStart.slice(0, 10)}/${st.periodEnd.slice(0, 10)}`,
    spatialCoverage: { '@type': 'Country', name: 'France' },
    measurementTechnique: `Questions de clients posées plusieurs fois à plusieurs assistants d'IA ; score Repéré ${METHOD_VERSION} (taux de mention, rang, part de voix, couverture des IA).`,
    variableMeasured: ['Score de visibilité IA (0-100)', 'Taux de mention', 'Part de voix', 'Score par IA'],
  };
}

function Barometre({ stats }: { stats: StudyStats | null }) {
  const n = stats?.count ?? 0;
  const published = n >= STUDY_PUBLISH_AT;
  const toc = [
    { id: 'etat', label: 'Où en est la collecte ?' },
    ...(published ? [{ id: 'resultats', label: 'Que montrent les résultats ?' }] : []),
    { id: 'methode', label: 'Comment le Baromètre est-il calculé ?' },
    { id: 'limites', label: 'Quelles sont les limites ?' },
  ];
  return (
    <>
      <p className="mt-6 text-lg leading-relaxed">
        Le Baromètre Repéré mesure à quelle fréquence ChatGPT, Gemini et Perplexity citent les entreprises françaises quand on leur pose les
        questions de leurs clients. Il agrège les audits réalisés par Repéré, de façon anonyme, et ne publie des chiffres qu&apos;à partir de{' '}
        {STUDY_PUBLISH_AT} audits.
      </p>
      <Toc items={toc} />

      <QaSection
        id="etat"
        q="Où en est la collecte ?"
        answer={
          published
            ? `Le Baromètre repose sur ${n} audits réalisés entre le ${fmtDate(stats!.periodStart)} et le ${fmtDate(stats!.periodEnd)} ; il est recalculé chaque jour.`
            : `Collecte en cours : les résultats seront publiés à partir de ${STUDY_PUBLISH_AT} audits. D'ici là, nous ne publions aucun chiffre.`
        }
      >
        {!published && (
          <div className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
            <p className="font-semibold">État : collecte en cours, publication à {STUDY_PUBLISH_AT} audits.</p>
            {n > 0 && (
              <>
                <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                  {n} audits pris en compte sur {STUDY_PUBLISH_AT}.
                </p>
                <div
                  className="mt-3 h-2 w-full overflow-hidden rounded-full"
                  style={{ background: 'var(--line)' }}
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={STUDY_PUBLISH_AT}
                  aria-valuenow={n}
                  aria-label="Avancement de la collecte"
                >
                  <div className="h-full" style={{ width: `${Math.min(100, (100 * n) / STUDY_PUBLISH_AT)}%`, background: 'var(--primary)' }} />
                </div>
              </>
            )}
            <p className="mt-3 leading-relaxed">
              Chaque{' '}
              <Link href="/audit" className="underline" style={{ color: 'var(--primary)' }}>
                test gratuit
              </Link>{' '}
              contribue au Baromètre, sans que le nom de l&apos;entreprise soit jamais publié. En attendant, consultez notre{' '}
              <Link href="/etudes/ce-que-nous-savons-deja" className="underline" style={{ color: 'var(--primary)' }}>
                synthèse des études publiques
              </Link>
              .
            </p>
          </div>
        )}
      </QaSection>

      {published && stats && <BarometreResults stats={stats} />}

      <QaSection
        id="methode"
        q="Comment le Baromètre est-il calculé ?"
        answer="Chaque audit pose plusieurs fois les questions de clients d'une entreprise à plusieurs IA, puis calcule un score sur 100 ; le Baromètre agrège ces scores sans aucune donnée nominative."
      >
        <ul className="list-disc space-y-2 pl-6 leading-relaxed">
          <li>
            <strong>Questions.</strong> Des questions formulées comme un vrai client (métier et ville, secteur, catégorie de produit), posées
            plusieurs fois à ChatGPT, Gemini et Perplexity, car les réponses varient.
          </li>
          <li>
            <strong>Score.</strong> Score Repéré {METHOD_VERSION} : taux de mention (45 %), rang dans la réponse (20 %), part de voix face aux
            concurrents cités (20 %) et nombre d&apos;IA qui citent l&apos;entreprise (15 %). Formule complète sur la page{' '}
            <Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>
              Méthode
            </Link>
            .
          </li>
          <li>
            <strong>Échantillon.</strong> Audits réels uniquement ; les audits de démonstration sont exclus. Une IA ou un parcours n&apos;est
            détaillé que s&apos;il compte au moins {STUDY_MIN_SUBGROUP} audits.
          </li>
          <li>
            <strong>Indicateurs publiés.</strong> Score médian et quartiles, répartition par tranche (0-39 « invisible », 40-69 « peu visible »,
            70-100 « bien recommandé »), part des entreprises jamais citées, taux de mention et part de voix médians, score médian par IA et par
            parcours.
          </li>
          <li>
            <strong>Confidentialité.</strong> Aucun nom d&apos;entreprise, aucune réponse individuelle, aucun chiffre sur un groupe de moins de{' '}
            {STUDY_MIN_SUBGROUP} audits.
          </li>
        </ul>
      </QaSection>

      <QaSection
        id="limites"
        q="Quelles sont les limites du Baromètre ?"
        answer="Le Baromètre décrit les entreprises qui ont fait un audit Repéré, pas l'ensemble des entreprises françaises, et il mesure les IA à travers leurs API, qui ne reproduisent pas exactement les applications grand public."
      >
        <ul className="list-disc space-y-2 pl-6 leading-relaxed">
          <li>Échantillon auto-sélectionné : les entreprises qui testent leur visibilité ne sont pas représentatives de toutes les entreprises.</li>
          <li>Les réponses des IA changent d&apos;un mois à l&apos;autre : chaque chiffre est daté et doit être lu comme une photographie.</li>
          <li>Gemini avec recherche web ne permet pas d&apos;analyser les sources citées dans les conditions de son API ; le Baromètre ne publie donc pas de sources pour Gemini.</li>
          <li>Google AI Overviews et AI Mode ne sont pas mesurés directement.</li>
        </ul>
      </QaSection>
    </>
  );
}

function BarometreResults({ stats }: { stats: StudyStats }) {
  const providers = Object.entries(stats.byProvider);
  const segments = Object.entries(stats.bySegment).filter(([, v]) => v && v.median !== null);
  return (
    <QaSection
      id="resultats"
      q="Que montrent les résultats ?"
      answer={`Sur ${stats.count} audits, le score médian de visibilité IA est de ${stats.score.median} sur 100, et ${stats.neverMentioned} % des entreprises auditées ne sont citées dans aucune des réponses analysées.`}
    >
      <TableWrap
        caption={`Calculé le ${fmtDate(stats.computedAt)} sur ${stats.count} audits (${fmtDate(stats.periodStart)} – ${fmtDate(stats.periodEnd)}).`}
        head={['Indicateur', 'Valeur']}
        rows={[
          ['Score médian (sur 100)', `${stats.score.median} (quartiles : ${stats.score.p25} – ${stats.score.p75})`],
          ['Entreprises « invisibles » (0-39)', `${stats.bands.invisible} %`],
          ['Entreprises « peu visibles » (40-69)', `${stats.bands.peuVisible} %`],
          ['Entreprises « bien recommandées » (70-100)', `${stats.bands.bienRecommande} %`],
          ['Jamais citées dans les réponses analysées', `${stats.neverMentioned} %`],
          ['Taux de mention médian', `${stats.mentionRateMedian.toLocaleString('fr-FR')} %`],
          ['Part de voix médiane face aux concurrents cités', `${stats.shareOfVoiceMedian.toLocaleString('fr-FR')} %`],
        ]}
      />
      {providers.length > 0 && (
        <TableWrap
          head={['IA', 'Score médian', 'Audits']}
          rows={providers.map(([p, v]) => [PROVIDER_LABEL[p] ?? p, String(v!.median), String(v!.n)])}
        />
      )}
      {segments.length > 0 && (
        <TableWrap
          head={['Parcours', 'Score médian', 'Audits']}
          rows={segments.map(([k, v]) => [SEGMENT_LABEL[k] ?? k, String(v!.median), String(v!.n)])}
        />
      )}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
        Pour citer ces chiffres : « Baromètre Repéré de la visibilité IA, {stats.count} audits, {fmtDate(stats.computedAt)} », avec un lien vers cette
        page.
      </p>
    </QaSection>
  );
}

/* ------------------------------------------------------------------ */
/* Ce que nous savons déjà                                             */
/* ------------------------------------------------------------------ */

const KNOWN_SOURCES: Source[] = [
  { label: 'Arcep, Baromètre du numérique, édition 2026 (communiqué)', url: 'https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/equipements-et-usages-du-numerique-090226.html', note: 'Crédoc pour l’Arcep, l’Arcom, le CGE et l’ANCT ; 4 145 personnes de 12 ans et plus, terrain juin 2025 ; publié le 9 février 2026' },
  { label: 'Siècle Digital, Observatoire Eskimoz × Ipsos, 3e édition', url: 'https://siecledigital.fr/2026/05/28/etude-les-francais-se-tournent-massivement-vers-lia-pour-effectuer-leurs-recherches-en-ligne/', note: '28 mai 2026 ; source secondaire, Eskimoz est une agence SEO ; échantillon non précisé dans l’article' },
  { label: 'Siècle Digital, étude Bpifrance Le Lab sur l’IA dans les PME', url: 'https://siecledigital.fr/2025/06/05/seulement-32-des-pme-francaises-utilisent-lia-une-revolution-encore-timide/', note: '5 juin 2025 ; 1 209 dirigeants de PME et ETI ; source secondaire' },
  { label: 'PPC Land, AI Overviews et AI Mode en France', url: 'https://ppc.land/google-ends-france-ai-overviews-blackout-as-68-users-flagged-the-gap', note: '22 juillet 2026' },
  { label: 'Pew Research Center, clics en présence d’un résumé IA', url: 'https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/', note: '22 juillet 2025 ; environ 900 adultes américains' },
  { label: 'G2, 2026 AI Search Insight Report', url: 'https://learn.g2.com/g2-2026-ai-search-insight-report', note: 'mars 2026 ; 1 076 décideurs B2B, monde ; G2 vend de la visibilité sur ses avis' },
  { label: '6sense, Buyer Experience Report 2025 (communiqué Business Wire)', url: 'https://www.businesswire.com/news/home/20251112018032/en', note: '12 novembre 2025 ; plus de 4 000 acheteurs B2B' },
  { label: 'Similarweb, domaines les plus cités par les LLM', url: 'https://aisearch.similarweb.com/blog/most-cited-domains-llms/', note: 'environ 600 000 citations, États-Unis, janvier-février 2026' },
  { label: 'Semrush, domaines les plus cités par l’IA', url: 'https://www.semrush.com/blog/most-cited-domains-ai/', note: '230 000 prompts, juillet-octobre 2025' },
  { label: 'BrightLocal, sources d’annuaires dans la recherche IA locale', url: 'https://brightlocal.com/blog/ai-search-using-listings-sources', note: '10 secteurs locaux ; éditeur d’outils SEO local' },
  { label: 'Journal du Net, étude Partoo × Meteoria sur le retail', url: 'https://www.journaldunet.com/retail/1547739-etude-partoo-meteoria-le-retail-a-l-epreuve-des-ia-qui-l-ia-choisit-elle-vraiment', note: '10 000 requêtes en France, février 2026 ; éditeurs de solutions' },
  { label: 'Insites, exactitude de ChatGPT sur les commerces locaux', url: 'https://insites.com/blog/does-chatgpt-hallucinate-local-businesses-the-data-on-ai-accuracy/', note: '10 000 commerces américains' },
  { label: 'Retail Technology Innovation Hub, étude Searchable', url: 'https://retailtechinnovationhub.com/home/2026/7/15/many-uk-high-street-retailers-are-suffering-from-ai-chatbot-inaccuracies-searchable-research-finds', note: '15 juillet 2026 ; 72 000 questions, commerces britanniques ; source secondaire' },
  { label: 'Orbit Media, taux de conversion du trafic IA', url: 'https://www.orbitmedia.com/blog/conversion-rates-ai-search/', note: '97 sites B2B, juillet 2025 à juin 2026' },
  { label: 'The Media Leader FR, baromètre Valiuz du trafic IA en e-commerce', url: 'https://fr.themedialeader.com/?p=210038', note: '6 février 2026 ; France ; source secondaire' },
  { label: 'Adobe, AI Traffic Trends Report, août 2026', url: 'https://business.adobe.com/assets/pdfs/resources/sdk/ai-traffic-trends-report-august-2026/ai-traffic-trends-report-2026-08-19.pdf', note: 'commerce en ligne aux États-Unis' },
];

const KNOWN_SECTIONS: { id: string; q: string; answer: string; head: string[]; rows: string[][]; after?: string }[] = [
  {
    id: 'usages',
    q: 'Les Français utilisent-ils l’IA pour chercher ?',
    answer: "Oui : près d'un Français sur deux utilise une IA générative, et la recherche d'information est son premier usage, même si les moteurs de recherche restent le réflexe quotidien.",
    head: ['Chiffre', 'Périmètre', 'Source'],
    rows: [
      ['48 % des Français de 12 ans et plus ont utilisé une IA générative en 2025, soit 15 points de plus qu’un an plus tôt', 'France, 4 145 personnes', '[1]'],
      ['73 % de ces utilisateurs s’en servent pour rechercher de l’information', 'France, utilisateurs d’IA générative', '[1]'],
      ['50 % des Français utilisent une IA générative chaque semaine, contre 29 % un an plus tôt', 'France', '[2]'],
      ['43 % des Parisiens utilisent la recherche conversationnelle, contre 24 % dans le reste du pays', 'France', '[2]'],
      ['85 % des Français utilisent un moteur de recherche chaque jour', 'France', '[2]'],
      ['32 % des dirigeants de PME et ETI déclarent utiliser l’IA dans leur entreprise', 'France, 1 209 dirigeants', '[3]'],
    ],
  },
  {
    id: 'google',
    q: 'Les résumés IA de Google changent-ils les clics ?',
    answer: "Les AI Overviews et AI Mode sont disponibles en France depuis le 22 juillet 2026 ; aux États-Unis, les internautes cliquent presque deux fois moins sur les liens quand un résumé IA s'affiche.",
    head: ['Chiffre', 'Périmètre', 'Source'],
    rows: [
      ['AI Overviews et AI Mode activés en France le 22 juillet 2026', 'France', '[4]'],
      ['Clic sur un lien classique dans 8 % des recherches avec résumé IA, contre 15 % sans', 'États-Unis, environ 900 adultes, mars 2025', '[5]'],
    ],
    after: 'Aucune étude publique comparable n’a encore été publiée pour la France à notre connaissance.',
  },
  {
    id: 'b2b',
    q: 'Les acheteurs B2B passent-ils par les IA ?',
    answer: "Oui, de plus en plus : selon G2, la moitié des acheteurs de logiciels commencent leur recherche dans un chatbot, et l'IA les a souvent fait changer de fournisseur.",
    head: ['Chiffre', 'Périmètre', 'Source'],
    rows: [
      ['51 % des acheteurs de logiciels commencent leur recherche plus souvent dans un chatbot que sur Google', 'Monde, 1 076 décideurs', '[6]'],
      ['69 % ont choisi un autre fournisseur que celui prévu à cause de l’IA', 'Monde, 1 076 décideurs', '[6]'],
      ['La citation d’un site d’avis est le premier signal de confiance dans une réponse IA (45 %)', 'Monde, 1 076 décideurs', '[6]'],
      ['Le fournisseur préféré avant le premier contact remporte environ 80 % des contrats', 'Plus de 4 000 acheteurs B2B', '[7]'],
    ],
    after: 'Ces deux études sont publiées par des éditeurs qui vendent de la visibilité ou des données d’intention : leurs chiffres vont dans le sens de leur offre.',
  },
  {
    id: 'sources',
    q: 'Quelles sources les IA citent-elles ?',
    answer: "Aucun site ne domine : les plus cités pèsent moins de 15 % des citations, les sources varient selon l'IA et changent vite, et en local les sites des entreprises et les annuaires restent centraux.",
    head: ['Constat', 'Périmètre', 'Source'],
    rows: [
      ['Wikipédia (13,2 %) et Reddit (12,0 %) sont les domaines les plus cités par ChatGPT', 'États-Unis, environ 600 000 citations, début 2026', '[8]'],
      ['À la mi-septembre 2025, la part des réponses de ChatGPT citant Reddit passe d’environ 60 % à environ 10 %', '230 000 prompts', '[9]'],
      ['Les sites des entreprises restent la première source pour les recherches locales ; tous les assistants utilisent des annuaires', '10 secteurs locaux', '[10]'],
      ['En France, pour les supermarchés, les IA s’appuient sur les localisateurs de magasins des enseignes, les sites spécialisés et les annuaires structurés', 'France, 10 000 requêtes', '[11]'],
    ],
  },
  {
    id: 'exactitude',
    q: 'Les IA se trompent-elles sur les entreprises ?',
    answer: "Souvent : dans les deux études disponibles, 44 % à 64 % des commerces ont au moins une information inexacte dans les réponses des IA, et les petits commerces sont plus touchés.",
    head: ['Chiffre', 'Périmètre', 'Source'],
    rows: [
      ['ChatGPT n’a toutes les informations exactes que pour 56 % des commerces ; mauvais numéro de téléphone pour 30 %', 'États-Unis, 10 000 commerces', '[12]'],
      ['64 % des commerces ont au moins une information fausse ; les petits commerces sont plus touchés que les grandes marques', 'Royaume-Uni, 72 000 questions, 2026', '[13]'],
    ],
  },
  {
    id: 'trafic',
    q: 'Combien de trafic les IA envoient-elles aux sites ?',
    answer: "Peu en volume, de l'ordre de 0,5 % des visites sur les sites B2B étudiés, mais ce trafic convertit mieux que la moyenne, et il vient très majoritairement de ChatGPT.",
    head: ['Chiffre', 'Périmètre', 'Source'],
    rows: [
      ['Le trafic IA représente environ 0,5 % des sessions et convertit à 1,91 %, contre environ 0,5 % pour l’organique', '97 sites B2B', '[14]'],
      ['Plus de 90 % du trafic IA des sites e-commerce vient de ChatGPT ; conversion d’environ 1,7 %', 'France, e-commerce', '[15]'],
      ['Le trafic IA convertit 60 % mieux que les autres sources en juillet 2026', 'États-Unis, commerce en ligne', '[16]'],
    ],
  },
];

function KnownStudies() {
  const toc = [...KNOWN_SECTIONS.map((x) => ({ id: x.id, label: x.q })), { id: 'inconnu', label: 'Que ne savons-nous pas encore ?' }];
  return (
    <>
      <p className="mt-6 text-lg leading-relaxed">
        Cette synthèse compile les études publiques 2025-2026 sur la recherche par IA, en privilégiant les sources françaises et primaires. Pour chaque
        chiffre : son périmètre, sa source et, quand c&apos;est utile, le biais de l&apos;éditeur. Les études américaines ou britanniques sont signalées
        comme telles.
      </p>
      <Toc items={toc} />
      {KNOWN_SECTIONS.map((sec) => (
        <QaSection key={sec.id} id={sec.id} q={sec.q} answer={sec.answer}>
          <TableWrap head={sec.head} rows={sec.rows.map((r) => r.map((c) => withRefs(c)))} />
          {sec.after && <p className="leading-relaxed">{sec.after}</p>}
        </QaSection>
      ))}
      <QaSection
        id="inconnu"
        q="Que ne savons-nous pas encore ?"
        answer="Il n'existe pas encore de chiffre public fiable sur le volume de questions posées aux IA par secteur en France, ni sur l'effet mesuré de chaque levier du GEO sur les citations."
      >
        <ul className="list-disc space-y-2 pl-6 leading-relaxed">
          <li>Le nombre de recherches locales ou B2B faites dans les IA en France, par métier ou par secteur.</li>
          <li>La part du trafic venu des IA pour les TPE et PME françaises, hors e-commerce.</li>
          <li>L&apos;effet causal de chaque action (avis, annuaires, données structurées) sur la probabilité d&apos;être cité.</li>
        </ul>
        <p className="mt-3 leading-relaxed">
          C&apos;est l&apos;objet du{' '}
          <Link href="/etudes/barometre-visibilite-ia" className="underline" style={{ color: 'var(--primary)' }}>
            Baromètre Repéré de la visibilité IA
          </Link>
          . Pour les définitions, voir le{' '}
          <Link href="/glossaire" className="underline" style={{ color: 'var(--primary)' }}>
            glossaire
          </Link>{' '}
          ; pour la synthèse pratique, la page{' '}
          <Link href="/geo" className="underline" style={{ color: 'var(--primary)' }}>
            qu&apos;est-ce que le GEO
          </Link>
          .
        </p>
      </QaSection>
    </>
  );
}
