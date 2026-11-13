import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
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
  stripRefs,
  EDITORIAL_PUBLISHED,
  EDITORIAL_UPDATED,
  type Source,
} from '@/lib/seo/editorial';
import { articleLd, breadcrumbListLd, faqPageLd, graph, webPageLd, organizationLd, type QA } from '@/lib/seo/jsonld';

const PATH = '/geo';
const TITLE = "Qu'est-ce que le GEO (référencement IA) ? Définition, leviers, chiffres";
const DESCRIPTION =
  "Le GEO, ou référencement IA, augmente la probabilité d'être cité par ChatGPT, Gemini, Perplexity et Google AI Overviews. Définition, différences avec le SEO et l'AEO, 7 leviers, idées reçues et chiffres sourcés.";

const SEO_TITLE = "GEO (référencement IA) : définition et leviers";

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'article',
  publishedTime: EDITORIAL_PUBLISHED,
  modifiedTime: EDITORIAL_UPDATED,
});

const DEFINITION = [
  "Le GEO (Generative Engine Optimization), ou référencement IA, est l'ensemble des actions qui augmentent la probabilité qu'un assistant d'IA générative, comme ChatGPT, Gemini, Perplexity ou Google AI Overviews, cite et recommande une entreprise, une marque ou un produit dans ses réponses.",
  "Il complète le référencement naturel (SEO) : le SEO vise une position dans une liste de liens, le GEO vise une mention dans une réponse rédigée par une IA.",
];

const SOURCES: Source[] = [
  { label: 'Aggarwal et al., « GEO: Generative Engine Optimization », arXiv 2311.09735', url: 'https://arxiv.org/abs/2311.09735', note: 'article de recherche accepté à KDD 2024, version 3 du 28 juin 2024' },
  { label: 'Google Search Central, « AI features and your website »', url: 'https://developers.google.com/search/docs/appearance/ai-features', note: 'documentation officielle, mise à jour le 10 décembre 2025' },
  { label: 'OpenAI Help Center, « ChatGPT search »', url: 'https://help.openai.com/en/articles/9237897-chatgpt-search', note: 'documentation officielle, consultée le 9 novembre 2026' },
  { label: 'OpenAI, « Overview of OpenAI Crawlers »', url: 'https://developers.openai.com/api/docs/bots.md', note: 'documentation officielle, consultée le 9 novembre 2026' },
  { label: "Search Engine Roundtable, « Google: No AI System Currently Uses LLMs.txt »", url: 'https://seroundtable.com/google-ai-llms-txt-39607.html', note: 'propos de John Mueller (Google) du 17 juin 2025' },
  { label: 'Arcep, Baromètre du numérique, édition 2026 (communiqué)', url: 'https://www.arcep.fr/actualites/actualites-et-communiques/detail/n/equipements-et-usages-du-numerique-090226.html', note: 'enquête Crédoc, 4 145 personnes de 12 ans et plus, terrain juin 2025, publié le 9 février 2026' },
  { label: 'Siècle Digital, Observatoire Eskimoz × Ipsos, 3e édition', url: 'https://siecledigital.fr/2026/05/28/etude-les-francais-se-tournent-massivement-vers-lia-pour-effectuer-leurs-recherches-en-ligne/', note: 'article du 28 mai 2026 ; Eskimoz est une agence SEO, taille d’échantillon non précisée dans l’article' },
  { label: 'Pew Research Center, « Google users are less likely to click on links when an AI summary appears in the results »', url: 'https://www.pewresearch.org/short-reads/2025/07/22/google-users-are-less-likely-to-click-on-links-when-an-ai-summary-appears-in-the-results/', note: '22 juillet 2025, environ 900 adultes américains, navigation de mars 2025' },
  { label: 'PPC Land, lancement des AI Overviews et d’AI Mode en France', url: 'https://ppc.land/google-ends-france-ai-overviews-blackout-as-68-users-flagged-the-gap', note: 'article du 22 juillet 2026' },
  { label: 'Semrush, « Most cited domains in AI »', url: 'https://www.semrush.com/blog/most-cited-domains-ai/', note: '230 000 prompts, juillet à octobre 2025 ; éditeur d’outils SEO' },
  { label: 'Similarweb, « Most cited domains by LLMs »', url: 'https://aisearch.similarweb.com/blog/most-cited-domains-llms/', note: 'environ 600 000 citations, États-Unis, janvier-février 2026' },
  { label: 'G2, « 2026 AI Search Insight Report »', url: 'https://learn.g2.com/g2-2026-ai-search-insight-report', note: 'mars 2026, 1 076 décideurs B2B ; G2 vend de la visibilité sur ses avis' },
  { label: 'Orbit Media, « Conversion rates from AI search »', url: 'https://www.orbitmedia.com/blog/conversion-rates-ai-search/', note: '97 sites B2B, juillet 2025 à juin 2026' },
  { label: 'Insites, « Does ChatGPT hallucinate local businesses? »', url: 'https://insites.com/blog/does-chatgpt-hallucinate-local-businesses-the-data-on-ai-accuracy/', note: '10 000 commerces américains ; éditeur de solutions marketing local' },
  { label: 'BrightLocal, « How AI search uses listings sources »', url: 'https://brightlocal.com/blog/ai-search-using-listings-sources', note: '10 secteurs locaux ; éditeur d’outils SEO local' },
];

const COMPARISON_ROWS = [
  ['Objectif', 'Une position dans la liste de liens de Google ou Bing', 'Être la réponse directe (extrait optimisé, assistant vocal)', 'Être cité ou recommandé dans une réponse rédigée par une IA'],
  ['Où', 'Pages de résultats des moteurs', 'Extraits optimisés, « Autres questions posées », assistants vocaux', 'ChatGPT, Gemini, Perplexity, Copilot, Google AI Overviews et AI Mode'],
  ['Unité de mesure', 'Position, clics, impressions', 'Présence dans l’extrait', 'Taux de mention, rang dans la réponse, part de voix, sources citées'],
  ['Ce qui compte', 'Pertinence, technique, liens, contenu', 'Réponse courte et structurée à une question précise', 'Ce que disent de vous les sources que l’IA lit (votre site, annuaires, avis, comparatifs, presse, forums)'],
  ['Stabilité', 'Classement relativement stable', 'Variable', 'Réponses non déterministes : deux questions identiques peuvent donner deux réponses différentes'],
  ['Outils de mesure', 'Search Console, outils SEO', 'Outils SEO', 'Interrogations répétées des IA, analyse des citations ; les IA ne fournissent pas de statistiques aux entreprises'],
];

const LEVERS: { title: string; text: string }[] = [
  {
    title: 'Laisser les robots des IA lire votre site',
    text: "OpenAI indique que les sites qui bloquent OAI-SearchBot ne sont pas affichés dans les réponses de recherche de ChatGPT [4]. Côté Google, une page doit être indexée et pouvoir s'afficher avec un extrait pour servir de lien dans AI Overviews ou AI Mode [2]. Vérifiez votre robots.txt avant tout le reste.",
  },
  {
    title: 'Tenir une fiche de vérité cohérente partout',
    text: "Nom, adresse, téléphone, horaires, prix, services : les IA reprennent ce qu'elles trouvent, même faux. Sur 10 000 commerces américains, ChatGPT n'avait toutes les informations exactes que pour 56 % d'entre eux selon Insites [14]. Une même information, identique sur votre site, vos fiches et vos annuaires, réduit ce risque.",
  },
  {
    title: 'Être présent sur les sources que les IA citent pour vos questions',
    text: "Les IA s'appuient sur d'autres sites que le vôtre : annuaires, comparatifs, presse, forums, sites d'avis. BrightLocal observe que tous les assistants testés utilisent des annuaires dans les recherches locales [15]. Les sources citées varient selon l'IA et changent vite [10][11] : il faut les mesurer sur vos propres questions plutôt que suivre une liste générique.",
  },
  {
    title: 'Recueillir de vrais avis clients et y répondre',
    text: "Selon G2, la citation d'un site d'avis est le premier signal de confiance des acheteurs B2B dans une réponse d'IA (45 %) [12]. Les avis doivent venir de vrais clients : les faux avis sont interdits par la loi et par les plateformes.",
  },
  {
    title: 'Publier des pages citables',
    text: "Une page citable répond à une question en une phrase, donne des faits vérifiables et cite ses sources. Dans l'étude fondatrice du GEO, ajouter des sources, des citations et des statistiques comptait parmi les méthodes les plus efficaces, avec une visibilité améliorée jusqu'à 40 % sur leur banc d'essai [1].",
  },
  {
    title: 'Baliser vos informations en données structurées',
    text: "Le balisage schema.org (Organization, LocalBusiness, Product, FAQPage) rend vos informations lisibles par les machines. Google précise toutefois qu'aucun balisage spécial n'est requis pour ses fonctionnalités IA [2] : c'est une aide à la lecture, pas un passe-droit.",
  },
  {
    title: 'Mesurer régulièrement, sur vos vraies questions',
    text: "Les IA ne publient aucune statistique pour les entreprises, et leurs réponses varient d'une fois à l'autre. Mesurer, c'est poser plusieurs fois les questions de vos clients à plusieurs IA, noter qui est cité et quelles sources sont lues, puis comparer mois après mois. C'est ce que décrit notre méthode.",
  },
];

const MYTHS: { claim: string; answer: string }[] = [
  {
    claim: '« Un fichier llms.txt suffit pour être cité par les IA. »',
    answer:
      "Faux à ce jour. En juin 2025, John Mueller (Google) a déclaré qu'aucun système d'IA n'utilisait llms.txt et que les assistants lisent les pages elles-mêmes [5]. Le fichier ne coûte presque rien à publier, mais aucune source primaire ne montre qu'il fait citer une entreprise.",
  },
  {
    claim: '« ChatGPT, c’est Bing : il suffit d’être bien classé sur Bing. »',
    answer:
      "Simplification trompeuse. OpenAI écrit que ChatGPT peut transmettre des requêtes à des fournisseurs de recherche tiers « tels que Bing » [3], mais il utilise aussi son propre robot, OAI-SearchBot [4], et c'est le modèle qui choisit les sources qu'il cite. Être bien présent sur Bing aide sans doute ; ce n'est ni nécessaire ni suffisant de façon démontrée.",
  },
  {
    claim: '« Le GEO remplace le SEO. »',
    answer:
      "Non. Google indique que les bonnes pratiques SEO restent valables pour AI Overviews et AI Mode, sans exigence supplémentaire [2]. Et 85 % des Français utilisent encore un moteur de recherche chaque jour selon l'Observatoire Eskimoz × Ipsos [7]. Le GEO s'ajoute au SEO.",
  },
  {
    claim: '« Une agence peut garantir que ChatGPT vous recommandera. »',
    answer:
      "Personne ne le peut honnêtement. Les réponses des IA ne sont pas déterministes et leurs sources changent : Semrush a mesuré qu'à la mi-septembre 2025, la part des réponses de ChatGPT citant Reddit était passée d'environ 60 % à environ 10 % [10]. On peut garantir un travail et une mesure, pas une position.",
  },
  {
    claim: '« Les IA ne citent que les grandes marques. »',
    answer:
      "Pas en local. Dans l'étude de BrightLocal, les sites des entreprises restaient la première source des assistants pour des recherches locales, devant les annuaires [15]. En revanche, les petites entreprises sont plus exposées aux informations fausses, d'où l'importance de la fiche de vérité.",
  },
];

const FAQ: QA[] = [
  {
    q: 'GEO, AEO, SEO IA, référencement IA : est-ce la même chose ?',
    a: "Presque. GEO (Generative Engine Optimization) et référencement IA désignent le même travail : être cité par les assistants d'IA. L'AEO (Answer Engine Optimization) vise plus largement les réponses directes, y compris les extraits de Google et les assistants vocaux. « SEO IA » est un terme d'agence, sans définition stable.",
  },
  {
    q: "Combien de temps faut-il pour voir un effet du GEO ?",
    a: "Il n'existe pas de délai fiable. Une correction de robots.txt est prise en compte en environ 24 heures par OpenAI selon sa documentation ; une nouvelle source ou de nouveaux avis peuvent mettre des semaines ou des mois à se refléter. C'est pourquoi il faut mesurer avant, puis régulièrement après.",
  },
  {
    q: "Le GEO concerne-t-il les petites entreprises ?",
    a: "Oui. 48 % des Français de 12 ans et plus utilisaient une IA générative en 2025, et 73 % d'entre eux s'en servent pour chercher de l'information, selon le Baromètre du numérique 2026. Les commerces locaux sont aussi les plus exposés aux informations fausses dans les réponses des IA.",
  },
  {
    q: 'Faut-il bloquer les robots des IA ?',
    a: "Distinguez les robots d'entraînement (comme GPTBot) des robots de recherche (comme OAI-SearchBot). Bloquer GPTBot empêche l'usage de vos pages pour entraîner les modèles d'OpenAI ; bloquer OAI-SearchBot vous retire des réponses de recherche de ChatGPT. Vous pouvez autoriser l'un et bloquer l'autre.",
  },
  {
    q: 'Les AI Overviews de Google sont-ils disponibles en France ?',
    a: "Oui. Google a activé AI Overviews et AI Mode en France le 22 juillet 2026, après un report lié notamment aux droits voisins de la presse. Google indique qu'aucune optimisation spéciale n'est requise : une page indexée et éligible à un extrait peut être citée.",
  },
  {
    q: 'Comment savoir si ChatGPT cite mon entreprise ?',
    a: "Posez-lui plusieurs fois les questions que posent vos clients, dans des conversations séparées, et notez qui est cité. Une seule réponse ne prouve rien, car les réponses varient. Le test gratuit de Repéré le fait sur trois IA et indique sa marge d'erreur.",
  },
];

const TOC = [
  { id: 'definition', label: 'Définition' },
  { id: 'difference', label: 'GEO, SEO, AEO : quelles différences ?' },
  { id: 'choix', label: 'Comment les IA choisissent-elles qui recommander ?' },
  { id: 'leviers', label: 'Quels sont les 7 leviers du GEO ?' },
  { id: 'idees-recues', label: 'Quelles idées reçues éviter ?' },
  { id: 'chiffres', label: 'Que disent les chiffres ?' },
  { id: 'faq', label: 'Questions fréquentes' },
];

export default function GeoPage() {
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: "Qu'est-ce que le GEO ?", path: PATH },
  ];
  const wordCount = [
    ...DEFINITION,
    ...LEVERS.map((l) => l.text),
    ...MYTHS.map((m) => m.answer),
    ...FAQ.map((f) => f.a),
  ]
    .join(' ')
    .split(/\s+/).length;

  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: EDITORIAL_UPDATED }, { withContext: false }),
          articleLd({
            path: PATH,
            headline: "Qu'est-ce que le GEO (référencement IA) ?",
            description: DESCRIPTION,
            datePublished: EDITORIAL_PUBLISHED,
            dateModified: EDITORIAL_UPDATED,
            wordCount,
            about: ['Generative Engine Optimization', 'Référencement IA', 'ChatGPT', 'Google AI Overviews'],
            citation: SOURCES.map((s) => s.url),
            withContext: false,
          }),
          faqPageLd(PATH, FAQ, { withContext: false }),
          breadcrumbListLd(PATH, crumbs, { withContext: false }),
          organizationLd({ withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: "Qu'est-ce que le GEO ?" }]} />
      <h1 className={h1Class} style={h1Style}>
        Qu&apos;est-ce que le GEO (référencement IA) ?
      </h1>
      <Byline />

      <section id="definition" className="scroll-mt-20">
        <div className="mt-6 rounded-xl border-l-4 p-5 text-lg leading-relaxed" style={{ borderColor: 'var(--primary)', background: '#fff' }}>
          {DEFINITION.map((p) => (
            <p key={p} className="mb-2 last:mb-0">
              {p}
            </p>
          ))}
        </div>
        <p className="mt-4 leading-relaxed">
          {withRefs(
            "Le terme vient d'un article de chercheurs publié en 2023 et accepté à la conférence KDD 2024, qui l'a défini et mesuré sur un banc d'essai de requêtes [1]. En France, on parle aussi de « référencement IA » ou de « visibilité dans ChatGPT ».",
          )}
        </p>
      </section>

      <Toc items={TOC} />

      <QaSection
        id="difference"
        q="GEO, SEO, AEO : quelles différences ?"
        answer="Le SEO vise une position dans une liste de liens, l'AEO vise la réponse directe d'un moteur, et le GEO vise une citation dans la réponse rédigée par une IA générative."
      >
        <TableWrap head={['', 'SEO', 'AEO', 'GEO (référencement IA)']} rows={COMPARISON_ROWS} />
        <p className="leading-relaxed">
          Les trois se recoupent : une page bien référencée sur Google a plus de chances d&apos;être lue par une IA. Pour les termes
          techniques, consultez le <Link href="/glossaire" className="underline" style={{ color: 'var(--primary)' }}>glossaire du référencement IA</Link>.
        </p>
      </QaSection>

      <QaSection
        id="choix"
        q="Comment les IA choisissent-elles qui recommander ?"
        answer="Une IA combine ce qu'elle a appris pendant son entraînement et, de plus en plus, une recherche sur le web en temps réel ; elle cite ensuite les entreprises que les sources consultées présentent de façon cohérente et répétée."
      >
        <ol className="mb-4 list-decimal space-y-3 pl-6 leading-relaxed">
          <li>
            <strong>La mémoire du modèle.</strong> Ce que le modèle a lu avant sa date de coupure. Elle est figée et peut être fausse ou datée.
          </li>
          <li>
            <strong>La recherche en temps réel (ancrage).</strong>{' '}
            {withRefs(
              "ChatGPT lance une recherche web quand la question le justifie et peut transmettre des requêtes à des fournisseurs tiers comme Bing [3] ; OpenAI explore aussi le web avec son robot OAI-SearchBot [4]. Google AI Overviews et AI Mode peuvent lancer plusieurs recherches liées sur des sous-thèmes (« query fan-out ») [2].",
            )}
          </li>
          <li>
            <strong>La synthèse.</strong> Le modèle rédige une réponse à partir de ces éléments et choisit quelques noms, souvent trois à cinq. Ses critères exacts ne sont pas publiés.
          </li>
        </ol>
        <p className="leading-relaxed">
          {withRefs(
            "Les sources lues dépendent de l'IA et du type de question. Similarweb observe que les questions d'opinion ou de comparaison favorisent les communautés et les éditeurs spécialisés, tandis que les questions de décision favorisent les grands éditeurs, les agrégateurs et les sites de marque [11]. C'est notre lecture de ces études, pas une règle publiée par les éditeurs d'IA.",
          )}
        </p>
      </QaSection>

      <QaSection
        id="leviers"
        q="Quels sont les 7 leviers du GEO ?"
        answer="Les sept leviers sont : ouvrir son site aux robots des IA, tenir une fiche de vérité cohérente, être présent sur les sources citées, recueillir de vrais avis, publier des pages citables, baliser ses données et mesurer régulièrement."
      >
        <ol className="space-y-4">
          {LEVERS.map((l, i) => (
            <li key={l.title} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: '#fff' }}>
              <h3 className="mb-1 font-semibold text-lg">
                {i + 1}. {l.title}
              </h3>
              <p className="leading-relaxed">{withRefs(l.text)}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 leading-relaxed">
          Aucun de ces leviers ne garantit une citation : ils augmentent la probabilité d&apos;être lu et cité. Pour le détail, lisez{' '}
          <Link href="/guides/apparaitre-dans-chatgpt-pme" className="underline" style={{ color: 'var(--primary)' }}>
            comment apparaître dans ChatGPT quand on est une PME
          </Link>{' '}
          et{' '}
          <Link href="/guides/ia-disent-des-choses-fausses" className="underline" style={{ color: 'var(--primary)' }}>
            que faire quand les IA disent des choses fausses
          </Link>
          .
        </p>
      </QaSection>

      <QaSection
        id="idees-recues"
        q="Quelles idées reçues sur le GEO faut-il éviter ?"
        answer="Les cinq idées reçues les plus courantes sont fausses ou exagérées : llms.txt ne fait pas citer, ChatGPT ne se résume pas à Bing, le GEO ne remplace pas le SEO, personne ne peut garantir une recommandation, et les petites entreprises peuvent être citées."
      >
        <div className="space-y-4">
          {MYTHS.map((m) => (
            <div key={m.claim}>
              <h3 className="font-semibold text-lg">{m.claim}</h3>
              <p className="mt-1 leading-relaxed">{withRefs(m.answer)}</p>
            </div>
          ))}
        </div>
      </QaSection>

      <QaSection
        id="chiffres"
        q="Que disent les chiffres sur la recherche par IA ?"
        answer="Près d'un Français sur deux utilise une IA générative, les résumés IA réduisent les clics vers les sites, et le trafic venu des IA reste faible en volume mais convertit mieux que la moyenne."
      >
        <ul className="list-disc space-y-2 pl-6 leading-relaxed">
          <li>{withRefs("48 % des Français de 12 ans et plus utilisaient une IA générative en 2025, en hausse de 15 points en un an ; 73 % de ces utilisateurs s'en servent pour rechercher de l'information [6].")}</li>
          <li>{withRefs("50 % des Français utilisent une IA générative chaque semaine, contre 29 % un an plus tôt ; à Paris, 43 % utilisent la recherche conversationnelle contre 24 % dans le reste du pays [7].")}</li>
          <li>{withRefs("Aux États-Unis, les internautes ont cliqué sur un lien classique dans 8 % des recherches Google affichant un résumé IA, contre 15 % sans résumé [8].")}</li>
          <li>{withRefs("AI Overviews et AI Mode sont disponibles en France depuis le 22 juillet 2026 [9].")}</li>
          <li>{withRefs("51 % des acheteurs de logiciels B2B interrogés par G2 commencent leur recherche plus souvent dans un chatbot que sur Google [12].")}</li>
          <li>{withRefs("Sur 97 sites B2B, le trafic venu des IA représentait environ 0,5 % des sessions mais convertissait en contacts à 1,91 %, contre environ 0,5 % pour le trafic organique [13].")}</li>
        </ul>
        <p className="mt-4 leading-relaxed">
          D&apos;autres chiffres, avec leurs limites, sont réunis dans notre synthèse{' '}
          <Link href="/etudes/ce-que-nous-savons-deja" className="underline" style={{ color: 'var(--primary)' }}>
            « Ce que nous savons déjà »
          </Link>
          . Pour mesurer ce trafic sur votre site, voir le guide{' '}
          <Link href="/guides/trafic-chatgpt-ga4" className="underline" style={{ color: 'var(--primary)' }}>
            mesurer le trafic venu de ChatGPT dans GA4
          </Link>
          .
        </p>
      </QaSection>

      <section id="faq" className="scroll-mt-20">
        <h2 className="mt-12 mb-4 font-semibold text-2xl">Questions fréquentes sur le GEO</h2>
        <div className="space-y-5">
          {FAQ.map((f) => (
            <div key={f.q}>
              <h3 className="font-semibold text-lg">{f.q}</h3>
              <p className="mt-1 leading-relaxed">{stripRefs(f.a)}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 leading-relaxed">
          Vingt-cinq autres réponses courtes : <Link href="/questions" className="underline" style={{ color: 'var(--primary)' }}>les questions des dirigeants sur le référencement IA</Link>.
        </p>
      </section>

      <AuditCta />
      <SourcesList sources={SOURCES} />
      <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
        Contenu d&apos;information, rédigé avec l&apos;aide d&apos;un outil d&apos;IA et relu par l&apos;équipe. Les IA évoluent vite : signalez-nous
        toute erreur à l&apos;adresse indiquée sur la page <Link href="/a-propos" className="underline">À propos</Link>.
      </p>
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
