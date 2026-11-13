import Link from 'next/link';
import { JsonLd, Card, CtaLink, h2Class } from '@/lib/seo/shell';
import { EditorialFrame } from '@/components/pages/v4/Editorial';
import { ScoreFormula } from '@/components/pages/v4/ScoreFormula';
import { METHOD_VERSION, BRAND, abs } from '@/lib/seo';
import { pageMeta } from '@/lib/seo/meta';
import { Byline, RelatedLinks } from '@/lib/seo/editorial';
import { PAGE_UPDATED } from '@/lib/seo/site';
import { articleLd, breadcrumbListLd, graph, webPageLd } from '@/lib/seo/jsonld';
import { MethodV3Sections } from './V3Sections';
import { METHOD_V5_TOC, MethodV5Sections } from './V5Sections';

const PATH = '/methode';
const TITLE = 'Méthode : comment Repéré analyse votre site et mesure les IA';
const DESCRIPTION =
  'Exploration du site, audit SEO, audit GEO et niveaux de preuve, Search Console, agent, score IA, marge d’erreur, sources, limites et versions.';
/** Première version publique de la méthode (v1.0). */
const METHOD_PUBLISHED = '2026-11-09';

export const metadata = pageMeta({ path: PATH, title: TITLE, description: DESCRIPTION, type: 'article', publishedTime: METHOD_PUBLISHED, modifiedTime: PAGE_UPDATED[PATH] });

const WEIGHTS = [
  { k: 'M', name: 'Taux de mention', w: 45, desc: 'Part des réponses valides des IA qui citent votre établissement. Le plus stable des indicateurs : il pèse le plus.' },
  { k: 'R', name: 'Qualité du rang', w: 20, desc: 'Position dans la réponse quand vous êtes cité (1er = 100 %, 6e et au-delà = 0 %), avec un rétrécissement quand les mentions sont rares. Volatil : poids réduit.' },
  { k: 'V', name: 'Part des recommandations', w: 20, desc: 'Vos citations rapportées à toutes les citations (vous et concurrents). Un quart des citations sur un marché local vaut le maximum.' },
  { k: 'C', name: 'Couverture des IA', w: 15, desc: 'Part des IA qui vous citent dans au moins 2 réponses sur 16 : vos clients n\'utilisent pas tous le même assistant.' },
];

const QUERIES = [
  ['Meilleur', 'Quel est le meilleur plombier à Paris 11e ?', 'Tu peux me conseiller un bon plombier à Paris 11e ?'],
  ['Proximité', 'Plombier près de Bastille, lequel choisir ?', 'Je cherche un plombier pas loin de chez moi, j\'habite Paris 11e. Des adresses ?'],
  ['Urgence', 'Urgent : fuite d\'eau, quel plombier peut intervenir rapidement à Paris 11e ?', ''],
  ['Précis', 'Qui fait de la recherche de fuite à Paris 11e ?', 'Je cherche un plombier spécialisé en chauffe-eau à Paris, tu as des noms ?'],
  ['Avis', 'Quel plombier a les meilleurs avis à Paris 11e ?', ''],
];

const CHANGELOG = [
  {
    v: 'Analyse du site (V5)', date: '13 novembre 2026',
    txt: 'Exploration réelle du site par RepereBot, audit SEO en 12 familles (contrôles sourcés Google et web.dev, à jour de 2026), audit GEO en 8 familles avec niveau de preuve par règle, Search Console, PageSpeed et CrUX, positions suivies, agent de publication avec validation, journal et retour arrière. La formule du score de visibilité dans les IA est inchangée.',
  },
  {
    v: 'v3.0', date: '9 novembre 2026',
    txt: 'Questions personnalisées (remplacer ou compléter les requêtes types), Mistral (Le Chat) en option, marge d’erreur sur le score, le taux de mention et la part de voix (bootstrap sur les questions), part de voix par thème et par IA, pages citées une par une, « Expliquer ce changement », indice de demande (faible, moyen, fort, étiqueté estimation, jamais de volume), audit de page par 20 règles publiées et audit « prêt pour les IA », carte de visibilité par quartier (simulation), mesure avant/après à J+14 et J+30, robot RepereBot. Les aperçus IA de Google restent non mesurés. La formule du score est inchangée.',
  },
  {
    v: 'v2.0', date: '9 novembre 2026',
    txt: 'Trois parcours (local, PME, e-commerce) avec des requêtes propres à chacun. Nouveaux piliers : sources citées (collecte, classement, présence, opportunités), perception des IA (sentiment, verbatims), vérification des faits contre votre fiche de vérité, benchmark, mesure du trafic IA sans cookie. Gemini n\'est utilisé que pour la perception et la vérité, pas pour les sources. La formule du score (4 composantes, mêmes poids) et la fourchette sont inchangées.',
  },
  { v: 'v1.0', date: '9 novembre 2026', txt: 'Première version publique : 8 requêtes, 2 exécutions, 3 IA, formule à 4 composantes, fourchette calculée par rééchantillonnage.' },
];

const QUERIES_V2 = [
  ['PME (B2B)', 'Quel est le meilleur logiciel de paie pour une PME de 50 salariés ?', 'Alternative à un grand éditeur de paie pour une entreprise de 100 personnes ?'],
  ['E-commerce', 'Meilleure crème solaire visage non grasse pour peau sensible ?', 'Alternative à une grande marque de cosmétiques, plus naturelle, moins de 30 € ?'],
];

const SOURCE_CATS = [
  ['Annuaire, fiche', 'PagesJaunes, Google Maps, annuaires professionnels'],
  ['Plateforme d\'avis', 'Tripadvisor, TheFork, Trustpilot, G2'],
  ['Comparatif, guide', 'Capterra, Appvizer, Les Numériques, Petit Futé'],
  ['Média national ou local', 'presse généraliste, spécialisée, régionale'],
  ['Forum, communauté', 'Reddit, Quora, forums spécialisés'],
  ['Marketplace', 'Amazon, Cdiscount, Malt, Booking'],
  ['Réseau social, vidéo', 'LinkedIn, YouTube, Instagram, Facebook'],
  ['Encyclopédie, institutionnel', 'Wikipédia, service-public.fr, CCI, ordres professionnels'],
  ['Site d\'un concurrent, votre site, autre', 'mis à part : ils alimentent la comparaison, pas la liste des sources à viser'],
];

const TOC = [
  { id: 'resume', label: 'En résumé' },
  ...METHOD_V5_TOC,
  { id: 'formule', label: 'La formule' },
  { id: 'lecture', label: 'Lecture du score' },
  { id: 'requetes', label: 'Les requêtes types' },
  { id: 'sources', label: 'Les sources' },
  { id: 'perception', label: 'La perception' },
  { id: 'faits', label: 'La vérification des faits' },
  { id: 'benchmark', label: 'Le benchmark' },
  { id: 'trafic', label: 'Le trafic IA, sans cookie' },
  { id: 'executions', label: 'Plusieurs exécutions' },
  { id: 'questions-personnalisees', label: 'Vos propres questions' },
  { id: 'ia-suivies', label: 'Les IA suivies' },
  { id: 'marge-erreur', label: 'La marge d’erreur' },
  { id: 'part-de-voix', label: 'Part de voix' },
  { id: 'pages-citees', label: 'Les pages citées' },
  { id: 'expliquer', label: 'Expliquer un changement' },
  { id: 'indice-demande', label: 'L’indice de demande' },
  { id: 'citabilite', label: 'L’audit d’une page' },
  { id: 'quartiers', label: 'La carte par quartier' },
  { id: 'avant-apres', label: 'Avant / après une action' },
  { id: 'donnees-sortantes', label: 'Partage et exports' },
  { id: 'ai-overviews', label: 'Ce que nous ne mesurons pas' },
  { id: 'limites', label: 'Les limites' },
  { id: 'versions', label: 'Historique des versions' },
  { id: 'notre-site', label: 'Sur notre propre site' },
];

export default function MethodPage() {
  return (
    <EditorialFrame
      head={
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, datePublished: METHOD_PUBLISHED, dateModified: PAGE_UPDATED[PATH] }, { withContext: false }),
          articleLd({
            path: PATH,
            type: 'TechArticle',
            headline: 'Comment nous analysons votre site et mesurons les IA',
            description: DESCRIPTION,
            datePublished: METHOD_PUBLISHED,
            dateModified: PAGE_UPDATED[PATH],
            version: METHOD_VERSION,
            image: abs(`${PATH}/opengraph-image`),
            withContext: false,
          }),
          breadcrumbListLd(PATH, [{ name: 'Accueil', path: '/' }, { name: 'Méthode', path: PATH }], { withContext: false }),
        ])}
      />
      }
      crumbs={[{ name: 'Accueil', href: '/' }, { name: 'Méthode' }]}
      title="Comment nous analysons votre site et mesurons les IA"
      meta={<Byline published={METHOD_PUBLISHED} updated={PAGE_UPDATED[PATH]} />}
      intro={<p>Version de la méthode : {METHOD_VERSION}. {BRAND} explore d&apos;abord votre site comme Google et les robots des IA le lisent, puis
        le contrôle (audit SEO et audit GEO, chaque règle avec sa source). Ensuite, il pose à ChatGPT, Gemini, Perplexity et Claude (et, en option, Mistral) les questions qu&apos;un client ou un acheteur poserait,
        puis regarde si votre entreprise est citée, à quelle place, face à qui, et sur quelles sources les IA s&apos;appuient. Tout est expliqué ici,
        pour que vous puissiez refaire le test vous-même.</p>}
      visual={<ScoreFormula weights={WEIGHTS} />}
      toc={TOC}
    >
      <>
      <h2 id="resume" className={h2Class}>En résumé</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><p className="text-3xl font-semibold">8 à 10</p><p className="text-sm" style={{ color: 'var(--muted)' }}>requêtes types au test gratuit (8 en local, 10 pour une PME ou un e-commerce)</p></Card>
        <Card><p className="text-3xl font-semibold">2</p><p className="text-sm" style={{ color: 'var(--muted)' }}>exécutions par requête et par IA</p></Card>
        <Card><p className="text-3xl font-semibold">48 et plus</p><p className="text-sm" style={{ color: 'var(--muted)' }}>réponses analysées au test local (8 × 2 × 3 IA) ; le nombre exact est affiché sur chaque rapport</p></Card>
      </div>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Le suivi et les audits approfondis utilisent davantage de requêtes (jusqu&apos;à 100 selon l&apos;offre), plusieurs exécutions et ajoutent Claude pour les sources. Chaque rapport indique le nombre de réponses analysées.</p>

      <MethodV5Sections />

      <h2 id="formule" className={h2Class}>La formule du score de visibilité dans les IA</h2>
      <p className="relative overflow-x-auto rounded-lg border p-4 font-mono text-sm sm:text-base" style={{ background: '#fff', borderColor: 'var(--line)' }}>
        Score /100 = 100 × (0,45 × M + 0,20 × R + 0,20 × V + 0,15 × C)
      </p>
      <div className="mt-4 relative overflow-x-auto">
        {/* Mobile : chaque composante devient un bloc (lettre, nom, poids sur une ligne ; définition dessous), même HTML. */}
        <table className="w-full border-collapse text-left text-sm max-sm:block">
          <thead className="max-sm:sr-only"><tr>{['', 'Composante', 'Poids', 'Définition'].map((h) => <th key={h} className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{h}</th>)}</tr></thead>
          <tbody className="max-sm:block">
            {WEIGHTS.map((r) => (
              <tr key={r.k} className="max-sm:grid max-sm:w-full max-sm:grid-cols-[2rem_minmax(0,1fr)_auto] max-sm:border-b max-sm:py-2" style={{ borderColor: 'var(--line)' }}>
                <td className="border-b p-2 font-semibold max-sm:border-0 max-sm:py-0" style={{ borderColor: 'var(--line)' }}>{r.k}</td>
                <td className="border-b p-2 max-sm:border-0 max-sm:py-0 max-sm:font-semibold" style={{ borderColor: 'var(--line)' }}>{r.name}</td>
                <td className="border-b p-2 max-sm:border-0 max-sm:py-0 max-sm:text-right max-sm:font-semibold" style={{ borderColor: 'var(--line)' }}>{r.w} %</td>
                <td className="border-b p-2 max-sm:col-span-3 max-sm:border-0 max-sm:pt-1 max-sm:pb-0" style={{ borderColor: 'var(--line)', color: 'inherit' }}>{r.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 leading-relaxed">
        Les réponses qui ne recommandent aucune entreprise (refus, « consultez Google Maps ») sont exclues du calcul. Les réponses
        simulées (mode démo) ne sont jamais comptées.
      </p>

      <h2 id="lecture" className={h2Class}>Lecture du score</h2>
      <ul className="list-disc space-y-1 pl-6">
        <li><strong>0 à 39 : Invisible</strong>, les IA vous recommandent rarement, voire jamais.</li>
        <li><strong>40 à 69 : Peu visible</strong>, vous êtes cité sur certaines IA ou certaines questions.</li>
        <li><strong>70 à 100 : Bien recommandé</strong>, vous êtes souvent cité, souvent en haut de liste.</li>
      </ul>

      <h2 id="requetes" className={h2Class}>Les requêtes types</h2>
      <p className="mb-3">Écrites comme un vrai client, sans consigne de format et sans jamais citer votre nom. Exemples pour un plombier à Paris 11e (certaines formulations sont familières, comme le ferait un client) :</p>
      <div className="space-y-3">
        {QUERIES.map(([intent, a, b]) => (
          <Card key={intent}>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{intent}</p>
            <p>« {a} »</p>
            {b && <p>« {b} »</p>}
          </Card>
        ))}
      </div>
      <p className="mt-4 mb-3">Pour une PME ou un e-commerce, les requêtes sont organisées par parcours d&apos;achat : comparaison, alternative, prix, usage. Exemples :</p>
      <div className="space-y-3">
        {QUERIES_V2.map(([intent, a, b]) => (
          <Card key={intent}>
            <p className="text-sm font-semibold" style={{ color: 'var(--primary)' }}>{intent}</p>
            <p>« {a} »</p>
            <p>« {b} »</p>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>La liste des requêtes est figée pour chaque entreprise, afin de comparer d&apos;un mois sur l&apos;autre.</p>

      <h2 id="sources" className={h2Class}>Les sources : ce que les IA lisent pour répondre</h2>
      <p className="leading-relaxed">
        Savoir si vous êtes cité ne suffit pas : il faut savoir <em>pourquoi</em> les IA citent vos concurrents. Pour chaque réponse, nous
        gardons les pages que l&apos;IA indique avoir utilisées, puis nous les analysons en quatre étapes.
      </p>
      <h3 className="mt-6 mb-2 font-semibold text-lg">1. Collecte</h3>
      <p className="leading-relaxed">
        Pour chaque page citée : l&apos;adresse, le titre, un extrait, la place dans la réponse, la question et l&apos;IA concernées. Nous distinguons les pages
        <strong> citées</strong> dans la réponse, les pages <strong>consultées</strong> sans être citées (quand l&apos;API le permet), les adresses écrites dans le texte et
        les plateformes simplement nommées (« sur TheFork »). Les adresses sont nettoyées (paramètres de suivi retirés) et ramenées à leur domaine.
      </p>
      <h3 className="mt-6 mb-2 font-semibold text-lg">2. Classification</h3>
      <p className="mb-3 leading-relaxed">
        Chaque domaine reçoit une catégorie, d&apos;abord par une table de plusieurs centaines de domaines français et internationaux que nous tenons à la main, puis par des
        règles (nom de domaine, type de page), puis, pour les domaines inconnus vus plusieurs fois, par un modèle d&apos;IA en lot. Un domaine classé par le modèle est
        confirmé seulement s&apos;il reçoit la même catégorie sur plusieurs audits distincts. Les catégories :
      </p>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead><tr>{['Catégorie', 'Exemples'].map((h) => <th key={h} className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{h}</th>)}</tr></thead>
          <tbody>
            {SOURCE_CATS.map(([c, e]) => (
              <tr key={c}><td className="border-b p-2 font-semibold" style={{ borderColor: 'var(--line)' }}>{c}</td><td className="border-b p-2" style={{ borderColor: 'var(--line)' }}>{e}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="mt-6 mb-2 font-semibold text-lg">3. Votre présence sur la source</h3>
      <p className="leading-relaxed">
        Trois niveaux, du gratuit au plus coûteux, on s&apos;arrête au premier qui conclut : (1) ce que l&apos;IA renvoie déjà (votre nom dans le titre, l&apos;extrait
        ou le passage qui porte la citation) ; (2) votre déclaration (« j&apos;y suis déjà ») ; (3) pour les pages prioritaires seulement, une requête HTTP légère et
        optionnelle, qui respecte le fichier robots.txt, sans exécuter de JavaScript ni contourner un accès restreint. Nous ne requêtons jamais les grandes plateformes
        qui réservent l&apos;accès automatisé à leur API (réseaux sociaux, Reddit, TripAdvisor, Amazon…) : la présence y reste « à vérifier ». Nous ne conservons que le verdict,
        jamais le contenu de la page.
      </p>
      <h3 className="mt-6 mb-2 font-semibold text-lg">4. Opportunités : les 10 sources à viser</h3>
      <p className="mb-3 relative overflow-x-auto rounded-lg border p-4 font-mono text-sm sm:text-base" style={{ background: '#fff', borderColor: 'var(--line)' }}>
        Opportunité = 100 × Fréquence × Poids × Absence × Faisabilité
      </p>
      <ul className="list-disc space-y-1 pl-6 leading-relaxed">
        <li><strong>Fréquence</strong> : part des réponses qui citent la source et nombre d&apos;IA concernées. Une source citée dans moins de deux réponses compte moitié moins.</li>
        <li><strong>Poids</strong> : importance de la catégorie pour votre parcours (les annuaires et avis pèsent plus en local ; les comparatifs et les forums plus en B2B et e-commerce).</li>
        <li><strong>Absence</strong> : maximal si un concurrent y est présent et pas vous ; réduit si votre présence est inconnue ou déjà acquise.</li>
        <li><strong>Faisabilité</strong> : créer une fiche d&apos;annuaire est rapide ; être ajouté à un comparatif ou obtenir un article dépend d&apos;un tiers.</li>
      </ul>
      <p className="mt-3 leading-relaxed">
        L&apos;effort affiché (moins d&apos;une heure, jusqu&apos;à une journée, plusieurs semaines) en découle. Les formules sont des conventions de classement, pas des lois : elles
        servent à ordonner des actions, pas à prédire un gain. Les statistiques de sources sont agrégées en additionnant numérateurs et dénominateurs, jamais en
        moyennant des pourcentages, et le dénominateur est toujours affiché.
      </p>
      <h3 className="mt-6 mb-2 font-semibold text-lg">La limite concernant Gemini</h3>
      <p className="leading-relaxed">
        ChatGPT, Perplexity et Claude renvoient les adresses des pages qu&apos;ils citent par leur API : elles alimentent le pilier Sources. <strong>Gemini</strong> n&apos;est
        pas utilisé pour les sources : l&apos;usage de ses résultats ancrés (les liens fournis avec les réponses de recherche) est restreint par les conditions d&apos;utilisation de
        Google, qui interdisent notamment de les analyser ou de les stocker pour constituer un index, et ces liens sont des redirections sans l&apos;adresse réelle de la page. Sans
        ancrage, Gemini ne fournit aucune source ; il écrit parfois des noms de plateformes ou des adresses, qui peuvent être inventées. Nous ne gardons alors que le nom de
        domaine, comme signal faible de ce que Gemini « associe » à votre métier, avec un poids réduit, sans jamais suivre le lien. Gemini reste utilisé pour la perception
        et la vérification des faits. Les sources que nous affichons concernent donc trois IA sur quatre, et le rapport le dit.
      </p>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Les sources citées varient fortement d&apos;un mois à l&apos;autre selon les études publiques : nous datons chaque mesure et ne promettons pas qu&apos;une source restera citée.
        Les adresses brutes sont conservées 90 jours, puis seuls les totaux par domaine subsistent.
      </p>

      <h2 id="perception" className={h2Class}>La perception : ce que les IA disent de vous</h2>
      <p className="leading-relaxed">
        Pour chaque passage de réponse qui vous mentionne, nous relevons le ton (positif, neutre, réservé, négatif) et les thèmes associés : prix, délai, qualité, accueil, fiabilité.
        La classification est faite par un modèle d&apos;IA, avec un format de sortie contraint. Nous affichons toujours la phrase d&apos;origine, l&apos;IA et la question posée,
        pas seulement l&apos;étiquette. Un ton n&apos;est pas une note : « bon mais cher » n&apos;est ni positif ni négatif. Cette classification peut se tromper sur l&apos;ironie ou les formulations
        ambiguës, d&apos;où l&apos;affichage du texte brut.
      </p>

      <h2 id="faits" className={h2Class}>La vérification des faits</h2>
      <p className="leading-relaxed">
        Vous renseignez une <strong>fiche de vérité</strong> : adresse, horaires, téléphone, services, tarifs ou fourchettes, zone, dirigeant, date de création. Un modèle d&apos;IA
        extrait des réponses collectées les affirmations factuelles sur votre entreprise ; nous les comparons à votre fiche avec des tolérances raisonnables (formats de téléphone,
        horaires équivalents). Trois verdicts : <strong>conforme</strong>, <strong>contredit</strong> (avec l&apos;IA, la question et la phrase) et <strong>non vérifiable</strong>
        quand votre fiche ne contient pas le fait. Une affirmation absente de votre fiche n&apos;est jamais déclarée fausse. Chaque erreur confirmée donne une tâche de correction.
        L&apos;extraction peut elle-même se tromper : c&apos;est pourquoi la phrase d&apos;origine est toujours affichée, pour que vous jugiez par vous-même.
      </p>

      <h2 id="benchmark" className={h2Class}>Le benchmark</h2>
      <p className="leading-relaxed">
        <strong>Votre rang</strong> (par exemple « 4e sur 12 ») compare votre part de recommandations à celle des concurrents que les IA citent pour les mêmes questions. Il ne dépend
        donc pas du nombre de clients de {BRAND}. Le rang change quand l&apos;ensemble des entreprises citées change : il est donné avec le nombre de concurrents comptés. Un benchmark
        entre clients, anonymisé et agrégé, n&apos;est publié que pour une cohorte d&apos;au moins 5 clients, et l&apos;appartenance à un classement public est facultative.
      </p>

      <h2 id="trafic" className={h2Class}>Le trafic IA : ce qui est mesuré, sans cookie</h2>
      <p className="leading-relaxed">
        Le trafic venu des IA est un <strong>plancher mesuré</strong>, jamais un total. Trois canaux, que nous ne cumulons pas : le script de mesure de {BRAND}, votre Google Analytics 4
        (connexion en lecture seule, facultative) et, pour les boutiques Shopify, les rapports de sessions par source.
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li><strong>Ce que le script mesure</strong> : seulement les visites dont le référent ou le paramètre utm_source indique un assistant (ChatGPT, Perplexity, Gemini, Copilot, Claude et autres). Les autres visites ne sont pas envoyées. Pour chaque visite : le jour, le moteur, la page d&apos;arrivée, et, si vous le demandez, une conversion sur la même page vue.</li>
        <li><strong>Ce qu&apos;il ne fait pas</strong> : aucun cookie, aucun stockage dans le navigateur, aucun identifiant, aucune session, aucune empreinte, aucune adresse IP conservée (elle sert uniquement à limiter les abus, en mémoire). Les données sont des totaux par jour, conservées 13 mois et cloisonnées par site.</li>
        <li><strong>Ce que nous ne voyons pas</strong> : Google AI Mode et les aperçus IA, indiscernables de l&apos;organique ; les visites sans référent (applications mobiles, liens copiés), classées « Direct » et jamais attribuées à une IA ; les mentions sans clic.</li>
        <li><strong>Robots d&apos;IA</strong> : quand vous installez notre plugin ou nos journaux, nous comptons par catégorie (indexation, visite en temps réel, entraînement) les robots qui lisent votre site, sans conserver d&apos;adresse IP.</li>
        <li><strong>Attribution</strong> : les conversions sont rattachées au dernier clic. Nous écrivons « visites IA suivies de X demandes », jamais « l&apos;IA a généré X euros ».</li>
      </ul>
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Si le script et GA4 coexistent, GA4 sert de référence et le script de contrôle ; un écart supérieur à 30 % déclenche une alerte (bandeau cookies, bloqueurs).
        Voir notre guide <Link href="/guides/trafic-chatgpt-ga4" className="underline">Mesurer le trafic venu de ChatGPT dans GA4</Link> et la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>.
      </p>

      <h2 id="executions" className={h2Class}>Pourquoi plusieurs exécutions, et une fourchette</h2>
      <p className="leading-relaxed">
        Une IA ne répond jamais deux fois exactement la même chose. Des travaux publiés en 2026 (<a href="https://www.searchenginejournal.com/ai-recommendations-change-with-nearly-every-query-sparktoro/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">SparkToro et Gumshoe</a>, 600 volontaires, près de 3 000 exécutions) montrent qu&apos;obtenir deux fois
        la même liste de recommandations est très rare, alors que certaines marques reviennent dans la majorité des réponses. Nous mesurons donc
        des fréquences plutôt qu&apos;un rang exact, nous répétons chaque question, et nous affichons une fourchette (celle où le score se situe 9 fois sur 10, calculée par
        rééchantillonnage des questions, 500 tirages) ainsi qu&apos;un indice de confiance : faible, moyenne ou bonne. Un audit gratuit de 48 réponses
        obtient en général une confiance moyenne.
      </p>
      <p className="mt-3 leading-relaxed">
        Avec 48 réponses, l&apos;incertitude sur le taux de mention est d&apos;environ ±12 points au pire. Les sous-scores par IA (16 réponses chacun) sont
        indicatifs. Une évolution d&apos;un mois à l&apos;autre n&apos;est annoncée que si elle dépasse la marge de mesure.
      </p>

      <MethodV3Sections />

      <h2 id="limites" className={h2Class}>Les limites, dites clairement</h2>
      <ul className="list-disc space-y-2 pl-6 leading-relaxed">
        <li>C&apos;est un instantané : les réponses changent selon l&apos;heure, la version du modèle et l&apos;utilisateur.</li>
        <li>Nous interrogeons les IA par les API que leurs éditeurs mettent à disposition ; les réponses peuvent différer de celles de l&apos;application grand public (historique, mémoire, position précise).</li>
        <li>Le score mesure si une IA vous cite, pas la qualité de votre travail ni celle de vos concurrents. Les concurrents affichés sont ceux cités par les IA.</li>
        <li>Les IA peuvent se tromper (nom, adresse, activité) : c&apos;est ce que la vérification des faits cherche à repérer. Les aperçus IA de Google (les résumés affichés en haut des résultats) et le mode IA de Google ne sont pas mesurés.</li>
        <li>Gemini est interrogé sans ancrage de recherche : il ne fournit pas de sources. La carte par quartier et l&apos;indice de demande sont des estimations, étiquetées comme telles.</li>
        <li>Le score de citabilité d&apos;une page est une liste de bonnes pratiques : il ne prédit pas une citation.</li>
        <li>Les statistiques par métier et par ville portent sur les établissements audités, pas sur l&apos;ensemble du marché, et ne sont publiées qu&apos;à partir de 5 audits.</li>
        <li>Aucun résultat n&apos;est promis : nous nous engageons sur une méthode, pas sur une place dans les réponses.</li>
      </ul>

      <h2 id="versions" className={h2Class}>Historique des versions</h2>
      <ul className="space-y-2">
        {CHANGELOG.map((c) => (
          <li key={c.v}><strong>{c.v}</strong> ({c.date}) : {c.txt}</li>
        ))}
      </ul>

      <div className="mt-12 rounded-2xl p-6 sm:p-8" style={{ background: 'var(--primary-bg)' }}>
        <p className="mb-3 text-lg font-semibold">Voir ce que répondent les IA pour votre métier.</p>
        <CtaLink href="/audit">Lancer mon test gratuit</CtaLink>
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>Ou parcourez <Link href="/visibilite-ia" className="underline">la visibilité IA par métier, secteur et catégorie</Link>, ou nos <Link href="/guides" className="underline">guides</Link>.</p>
      </div>
      <h2 id="notre-site" className={h2Class}>Ce que nous appliquons sur notre propre site</h2>
      <p className="leading-relaxed">
        Nous suivons sur repere-ia.fr les recommandations que nous faisons à nos clients, et vous pouvez le vérifier :
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-6 leading-relaxed">
        <li>
          <strong>Robots des IA autorisés</strong> : notre <a href="/robots.txt" className="underline">robots.txt</a> autorise explicitement les robots de
          recherche et de réponse (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot, Perplexity-User, Bingbot, Applebot…) et, par
          choix, ceux d&apos;entraînement (GPTBot, ClaudeBot, Google-Extended, Applebot-Extended).
        </li>
        <li>
          <strong>Données structurées</strong> : chaque page publie un balisage schema.org (Organization, WebSite, Service et Offer,
          Article, FAQPage, BreadcrumbList) conforme au texte visible, sans note ni avis inventés.
        </li>
        <li>
          <strong>Contenu lisible sans JavaScript</strong> : nos pages, y compris tous les prix, sont rendues côté serveur, car les robots des IA
          n&apos;exécutent pas le JavaScript.
        </li>
        <li>
          <strong>Mesure du trafic IA</strong> : notre propre script de mesure, sans cookie, est installé sur ce site, comme chez nos clients.
        </li>
        <li>
          <strong>Fichier <a href="/llms.txt" className="underline">llms.txt</a></strong> : publié par cohérence, en sachant qu&apos;aucune étude ne
          montre à ce jour d&apos;effet sur les citations.
        </li>
      </ul>
      <RelatedLinks current={PATH} />
      </>
    </EditorialFrame>
  );
}
