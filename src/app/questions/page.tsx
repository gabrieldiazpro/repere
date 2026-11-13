import { pageMeta } from '@/lib/seo/meta';
import Link from 'next/link';
import { PageShell, Crumbs, JsonLd, h1Class, h1Style } from '@/lib/seo/shell';
import { Byline, RelatedLinks, AuditCta, EDITORIAL_UPDATED } from '@/lib/seo/editorial';
import { breadcrumbListLd, faqPageLd, graph, webPageLd } from '@/lib/seo/jsonld';

const PATH = '/questions';
const TITLE = 'Référencement IA : 30 questions de dirigeants, 30 réponses directes';
const DESCRIPTION =
  "Comment apparaître dans ChatGPT, que faire si une IA dit des choses fausses sur votre entreprise, combien coûte le GEO : 30 réponses courtes et sourcées, avec un lien vers la page détaillée.";

const SEO_TITLE = "Référencement IA : 30 questions, 30 réponses";

export const metadata = pageMeta({
  path: PATH,
  title: SEO_TITLE,
  ogTitle: TITLE,
  description: DESCRIPTION,
  type: 'website',
});

interface Question {
  id: string;
  theme: 'Comprendre' | 'Apparaître' | 'Erreurs et réputation' | 'Mesurer' | 'Coût et prestataires';
  q: string;
  /** réponse directe de 40 à 60 mots */
  a: string;
  link: { href: string; label: string };
}

/** Réponses directes : 40 à 60 mots chacune. */
const QUESTIONS: Question[] = [
  // Comprendre
  {
    id: 'cest-quoi-le-geo', theme: 'Comprendre',
    q: "Qu'est-ce que le GEO ou référencement IA ?",
    a: "Le GEO, ou référencement IA, regroupe les actions qui augmentent la probabilité qu'une IA comme ChatGPT, Gemini ou Perplexity cite votre entreprise quand on lui pose une question de votre domaine. Il complète le référencement Google : le SEO vise une position dans des liens, le GEO une mention dans une réponse rédigée.",
    link: { href: '/geo', label: "Qu'est-ce que le GEO ?" },
  },
  {
    id: 'comment-chatgpt-choisit', theme: 'Comprendre',
    q: 'Comment ChatGPT choisit-il les entreprises qu’il recommande ?',
    a: "ChatGPT combine ce qu'il a appris pendant son entraînement et, quand la question le justifie, une recherche web en temps réel. Il cite ensuite les entreprises que les sources consultées présentent de façon cohérente : votre site, des annuaires, des avis, des comparatifs, la presse. OpenAI ne publie pas ses critères exacts de choix.",
    link: { href: '/geo#choix', label: 'Comment les IA choisissent' },
  },
  {
    id: 'geo-remplace-seo', theme: 'Comprendre',
    q: 'Le référencement IA remplace-t-il le référencement Google ?',
    a: "Non. Google indique que les bonnes pratiques de référencement restent valables pour ses fonctions IA, sans exigence supplémentaire, et la majorité des Français utilisent encore un moteur de recherche chaque jour. Le référencement IA s'ajoute au SEO : fiches complètes, avis et pages claires servent les deux à la fois.",
    link: { href: '/geo#idees-recues', label: 'Les idées reçues sur le GEO' },
  },
  {
    id: 'mon-secteur-concerne', theme: 'Comprendre',
    q: 'Mon entreprise est-elle concernée par la recherche IA ?',
    a: "Probablement. En 2025, 48 % des Français de 12 ans et plus utilisaient une IA générative, et 73 % de ces utilisateurs s'en servaient pour chercher de l'information, selon le Baromètre du numérique 2026. Le plus simple est de vérifier : posez à ChatGPT les questions de vos clients et regardez qui il cite.",
    link: { href: '/etudes/ce-que-nous-savons-deja', label: 'Les chiffres de la recherche IA en France' },
  },
  {
    id: 'ai-overviews-france', theme: 'Comprendre',
    q: 'Les résumés IA de Google sont-ils arrivés en France ?',
    a: "Oui. Google a activé les AI Overviews et AI Mode en France le 22 juillet 2026, après un report lié notamment aux droits voisins de la presse. Aux États-Unis, Pew Research a mesuré que les internautes cliquent moins souvent sur un lien quand un résumé IA s'affiche : 8 % des recherches contre 15 %.",
    link: { href: '/glossaire#ai-overviews', label: 'AI Overviews dans le glossaire' },
  },
  // Apparaître
  {
    id: 'apparaitre-dans-chatgpt', theme: 'Apparaître',
    q: 'Comment apparaître dans ChatGPT ?',
    a: "Autorisez le robot OAI-SearchBot dans votre robots.txt, tenez des informations identiques partout, soyez présent sur les annuaires, comparatifs et sites d'avis que ChatGPT cite dans votre secteur, recueillez de vrais avis et publiez des pages qui répondent clairement aux questions de vos clients. Rien ne garantit une citation, mais ces actions augmentent vos chances.",
    link: { href: '/guides/apparaitre-dans-chatgpt-pme', label: 'Guide : apparaître dans ChatGPT' },
  },
  {
    id: 'pourquoi-concurrent-cite', theme: 'Apparaître',
    q: 'Pourquoi ChatGPT recommande-t-il mon concurrent et pas moi ?',
    a: "En général, votre concurrent est présent sur des sources que l'IA consulte et vous non : annuaires, comparatifs, articles, forums, sites d'avis. Il peut aussi avoir plus d'avis ou un site plus explicite. Pour le savoir, il faut relever les sources citées dans les réponses et comparer votre présence à la sienne, source par source.",
    link: { href: '/methode', label: 'Notre méthode d’analyse des sources' },
  },
  {
    id: 'bloquer-robots-ia', theme: 'Apparaître',
    q: 'Faut-il bloquer ou autoriser les robots des IA ?',
    a: "Distinguez deux familles. Les robots d'entraînement, comme GPTBot, collectent des pages pour entraîner les modèles ; les bloquer est un choix légitime. Les robots de recherche, comme OAI-SearchBot, permettent d'être cité : OpenAI précise qu'un site qui bloque OAI-SearchBot n'apparaît pas dans les réponses de recherche de ChatGPT.",
    link: { href: '/glossaire#oai-searchbot', label: 'OAI-SearchBot et GPTBot' },
  },
  {
    id: 'llms-txt-utile', theme: 'Apparaître',
    q: 'Le fichier llms.txt aide-t-il à être cité ?',
    a: "Rien ne le montre à ce jour. En juin 2025, John Mueller, de Google, a déclaré qu'aucun système d'IA n'utilisait llms.txt et que les assistants lisent directement les pages. Le publier ne coûte presque rien et ne nuit pas, mais ce n'est pas un levier prouvé : priorisez vos pages, vos fiches et vos avis.",
    link: { href: '/geo#idees-recues', label: 'llms.txt et autres idées reçues' },
  },
  {
    id: 'bing-chatgpt', theme: 'Apparaître',
    q: 'ChatGPT utilise-t-il Bing ?',
    a: "En partie. OpenAI écrit que la recherche de ChatGPT peut transmettre des requêtes à des fournisseurs tiers « tels que Bing ». Mais OpenAI explore aussi le web avec son propre robot, OAI-SearchBot, et c'est le modèle qui choisit quoi citer. Soigner sa présence sur Bing est utile, sans suffire à être recommandé.",
    link: { href: '/geo#idees-recues', label: 'ChatGPT et Bing' },
  },
  {
    id: 'avis-clients-ia', theme: 'Apparaître',
    q: 'Les avis clients comptent-ils pour les IA ?',
    a: "Oui, d'après les études disponibles. Selon G2, la citation d'un site d'avis est le premier signal de confiance des acheteurs B2B dans une réponse d'IA, à 45 %. Les avis doivent venir de vrais clients : acheter ou rédiger de faux avis est interdit par la loi française et par les plateformes.",
    link: { href: '/guides/avis-clients-ia', label: 'Guide : avis clients et IA' },
  },
  {
    id: 'donnees-structurees', theme: 'Apparaître',
    q: 'Les données structurées schema.org sont-elles indispensables ?',
    a: "Non, mais elles aident. Le balisage JSON-LD (Organization, LocalBusiness, Product, FAQPage) rend vos informations lisibles par les machines. Google précise qu'aucun balisage spécial n'est requis pour apparaître dans AI Overviews ou AI Mode. Voyez-le comme une aide à la compréhension de votre site, pas comme un raccourci vers les recommandations.",
    link: { href: '/glossaire#json-ld', label: 'JSON-LD dans le glossaire' },
  },
  // Erreurs et réputation
  {
    id: 'chatgpt-dit-faux', theme: 'Erreurs et réputation',
    q: 'ChatGPT dit des choses fausses sur mon entreprise : que faire ?',
    a: "Notez précisément l'erreur, puis cherchez d'où elle vient : ancienne fiche, annuaire, article. Corrigez la source, publiez l'information exacte sur votre site et vos fiches, et signalez la réponse avec les outils de retour de ChatGPT. La correction n'est pas immédiate : revérifiez quelques semaines plus tard, en posant plusieurs fois la question.",
    link: { href: '/guides/ia-disent-des-choses-fausses', label: 'Guide : corriger les erreurs des IA' },
  },
  {
    id: 'erreurs-frequentes', theme: 'Erreurs et réputation',
    q: 'Les erreurs des IA sur les entreprises sont-elles fréquentes ?',
    a: "Oui. Sur 10 000 commerces américains, Insites a constaté que ChatGPT n'avait toutes les informations exactes que pour 56 % d'entre eux, et donnait un mauvais numéro de téléphone pour 30 %. Une étude britannique de Searchable, en 2026, conclut que les petits commerces sont plus touchés que les grandes marques.",
    link: { href: '/etudes/ce-que-nous-savons-deja', label: 'Les études sur l’exactitude des IA' },
  },
  {
    id: 'fiche-de-verite', theme: 'Erreurs et réputation',
    q: "Qu'est-ce qu'une fiche de vérité et à quoi sert-elle ?",
    a: "C'est la liste de référence de vos informations exactes : nom, adresse, téléphone, horaires, prix, services, zone couverte. Validée par vous, elle sert à comparer ce que disent les IA à la réalité, à repérer les erreurs et à corriger les sources qui les propagent. Elle évite aussi les incohérences entre vos propres fiches.",
    link: { href: '/glossaire#fiche-de-verite', label: 'Fiche de vérité' },
  },
  {
    id: 'faire-retirer-avis', theme: 'Erreurs et réputation',
    q: "Peut-on demander à ChatGPT de retirer une information sur mon entreprise ?",
    a: "Il n'existe pas de bouton pour modifier directement une réponse. Vous pouvez signaler une réponse dans ChatGPT et, pour des données personnelles, exercer vos droits auprès d'OpenAI. Le levier le plus efficace reste de corriger les pages sources que l'IA lit, puisque c'est d'elles que vient, le plus souvent, l'information fausse.",
    link: { href: '/guides/ia-disent-des-choses-fausses', label: 'Corriger les erreurs des IA' },
  },
  // Mesurer
  {
    id: 'savoir-si-chatgpt-me-cite', theme: 'Mesurer',
    q: 'Comment savoir si ChatGPT cite mon entreprise ?',
    a: "Posez plusieurs fois les questions de vos clients à ChatGPT, dans des conversations séparées, et notez qui est cité à chaque fois. Une seule réponse ne prouve rien, car les IA varient d'une fois à l'autre. Un outil de mesure fait ce travail sur plusieurs IA et doit indiquer le nombre de réponses analysées.",
    link: { href: '/audit', label: 'Test gratuit Repéré' },
  },
  {
    id: 'mesurer-trafic-ia', theme: 'Mesurer',
    q: 'Comment mesurer les visites venues de ChatGPT sur mon site ?',
    a: "Dans Google Analytics 4, filtrez la source de session sur chatgpt.com, perplexity.ai, gemini.google.com ou copilot.microsoft.com. ChatGPT ajoute souvent utm_source=chatgpt.com à ses liens. Ce chiffre est un plancher : une partie arrive en accès direct, et Google AI Mode est comptée avec la recherche classique, sans possibilité de la distinguer.",
    link: { href: '/guides/trafic-chatgpt-ga4', label: 'Guide : trafic ChatGPT dans GA4' },
  },
  {
    id: 'score-visibilite-ia', theme: 'Mesurer',
    q: "Qu'est-ce qu'un score de visibilité IA ?",
    a: "C'est un indicateur qui résume, sur un ensemble de questions posées à plusieurs IA, à quelle fréquence et à quel rang votre entreprise est citée, face à vos concurrents. Un score honnête est daté, indique le nombre de réponses analysées et une fourchette, car les réponses des IA changent d'une fois à l'autre.",
    link: { href: '/methode', label: 'La formule du score Repéré' },
  },
  {
    id: 'marge-erreur-score', theme: 'Mesurer',
    q: "Que signifie la marge d'erreur d'un score de visibilité IA ?",
    a: "Elle indique l'intervalle où la vraie valeur se situe vraisemblablement : « 54 ± 7 » veut dire entre 47 et 61. Elle est plus large quand on suit peu de questions. Une évolution plus petite que la marge n'est pas une évolution : on la lit comme « stable » tant qu'elle reste dedans.",
    link: { href: '/methode#marge-erreur', label: 'Comment la marge est calculée' },
  },
  {
    id: 'combien-de-questions', theme: 'Mesurer',
    q: 'Combien de questions faut-il suivre dans les IA ?',
    a: "Commencez par cinq questions de clients bien choisies : c'est suffisant pour une première lecture, mais la marge d'erreur reste large. Passez à vingt quand vous savez agir sur les résultats, puis à cinquante ou cent si vous avez plusieurs services, produits ou villes. Gardez la liste stable pour comparer.",
    link: { href: '/guides/suivre-ses-questions-chatgpt', label: 'Guide : choisir ses questions' },
  },
  {
    id: 'action-a-marche', theme: 'Mesurer',
    q: "Comment savoir si une action a amélioré ma visibilité dans les IA ?",
    a: "Mesurez les mêmes questions avant l'action, puis deux à quatre semaines après, et comparez avec la marge d'erreur. Si l'écart reste dans la marge, ne concluez rien. S'il la dépasse, c'est une corrélation, pas une preuve : d'autres facteurs ont pu jouer, et les IA varient d'une réponse à l'autre.",
    link: { href: '/methode#avant-apres', label: 'La mesure avant/après' },
  },
  {
    id: 'ai-overviews-suivis', theme: 'Mesurer',
    q: 'Repéré mesure-t-il les aperçus IA de Google ?',
    a: "Non. Repéré suit ChatGPT, Perplexity, Gemini et Claude, avec Mistral en option, mais pas les aperçus IA ni le mode IA de Google, faute d'interface fiable pour les interroger. Plusieurs concurrents les suivent avec leurs propres méthodes. Être présent dans l'index de Google reste un prérequis, que notre audit de site vérifie.",
    link: { href: '/comparatif', label: 'Ce que suit chaque outil' },
  },
  {
    id: 'page-citable', theme: 'Apparaître',
    q: 'Comment écrire une page que les IA peuvent citer ?',
    a: "Répondez à la question principale dans les soixante premiers mots, titrez avec les questions de vos clients, donnez des chiffres sourcés, affichez une date et un auteur, et servez le texte dans le HTML initial. Ce sont des bonnes pratiques de rédaction : elles rendent une page citable, sans garantir qu'elle le soit.",
    link: { href: '/guides/page-que-les-ia-citent', label: 'Guide : 9 règles' },
  },
  {
    id: 'trafic-ia-volume', theme: 'Mesurer',
    q: 'Le trafic venu des IA représente-t-il beaucoup de visites ?',
    a: "Pas encore, mais il convertit bien. Sur 97 sites B2B étudiés par Orbit Media, le trafic IA représentait environ 0,5 % des sessions, mais convertissait en contacts à 1,91 %, contre environ 0,5 % pour le trafic organique. L'enjeu principal reste d'être dans la courte liste que l'IA donne à l'acheteur.",
    link: { href: '/etudes/ce-que-nous-savons-deja', label: 'Les chiffres du trafic IA' },
  },
  // Coût et prestataires
  {
    id: 'combien-coute-geo', theme: 'Coût et prestataires',
    q: 'Combien coûte le GEO ?',
    a: "Les prix publics relevés en novembre 2026 vont d'environ 30 à 500 € par mois pour un outil de mesure, et de 950 à 2 500 € par mois pour un accompagnement d'agence, avec un audit initial souvent facturé 1 500 € ou plus. Le faire soi-même coûte surtout du temps, plusieurs heures chaque mois.",
    link: { href: '/comparatif', label: 'Comparatif des prix' },
  },
  {
    id: 'garantie-premier', theme: 'Coût et prestataires',
    q: 'Peut-on garantir d’être premier dans ChatGPT ?',
    a: "Non, et personne ne peut le promettre honnêtement. Les IA donnent des réponses différentes d'une fois à l'autre, changent de sources sans préavis et ne publient pas leurs règles. Un prestataire sérieux garantit le travail réalisé et une mesure transparente de son effet, jamais une position ou une citation dans une IA.",
    link: { href: '/a-propos#engagements', label: 'Nos engagements' },
  },
  {
    id: 'outil-ou-agence', theme: 'Coût et prestataires',
    q: 'Faut-il un outil de mesure ou une agence GEO ?',
    a: "Un outil convient si une personne de votre équipe a le temps d'appliquer les recommandations chaque semaine. Une agence convient si vous avez le budget et voulez déléguer entièrement. Entre les deux, des services comme Repéré mesurent et réalisent le travail pour un prix mensuel plus proche d'un logiciel que d'une agence.",
    link: { href: '/comparatif', label: 'Repéré, outils et agences comparés' },
  },
  {
    id: 'faire-soi-meme', theme: 'Coût et prestataires',
    q: 'Peut-on faire son référencement IA soi-même ?',
    a: "Oui, en grande partie. Vérifier son robots.txt, compléter ses fiches, demander des avis à ses clients et rédiger des pages claires ne demande pas de compétence technique. La difficulté est de mesurer correctement, de savoir quelles sources comptent dans son secteur et de tenir l'effort dans la durée, chaque mois.",
    link: { href: '/guides', label: 'Nos guides pratiques' },
  },
  {
    id: 'delai-resultats', theme: 'Coût et prestataires',
    q: 'En combien de temps voit-on des résultats ?',
    a: "Il n'existe pas de délai fiable. OpenAI indique qu'un changement de robots.txt est pris en compte en environ 24 heures, mais une nouvelle fiche, de nouveaux avis ou un article sur un site tiers peuvent mettre des semaines ou des mois à influencer les réponses. Mesurez avant d'agir, puis chaque mois.",
    link: { href: '/methode', label: 'Comment nous mesurons l’évolution' },
  },
];

const THEMES = ['Comprendre', 'Apparaître', 'Erreurs et réputation', 'Mesurer', 'Coût et prestataires'] as const;

export default function QuestionsPage() {
  const crumbs = [
    { name: 'Accueil', path: '/' },
    { name: 'Questions', path: PATH },
  ];
  return (
    <PageShell narrow>
      <JsonLd
        data={graph([
          webPageLd(PATH, { name: TITLE, description: DESCRIPTION, dateModified: EDITORIAL_UPDATED }, { withContext: false }),
          faqPageLd(PATH, QUESTIONS.map((x) => ({ q: x.q, a: x.a })), { withContext: false }),
          breadcrumbListLd(PATH, crumbs, { withContext: false }),
        ])}
      />
      <Crumbs items={[{ name: 'Accueil', href: '/' }, { name: 'Questions' }]} />
      <h1 className={h1Class} style={h1Style}>
        Référencement IA : les 30 questions des dirigeants
      </h1>
      <Byline />
      <p className="mt-6 text-lg leading-relaxed">
        Les questions que les dirigeants posent à ChatGPT, à Google ou à nous sur le référencement IA, avec une réponse directe en tête et un
        lien vers la page détaillée. Les chiffres cités sont sourcés sur les pages{' '}
        <Link href="/geo#sources" className="underline" style={{ color: 'var(--primary)' }}>GEO</Link>,{' '}
        <Link href="/etudes/ce-que-nous-savons-deja" className="underline" style={{ color: 'var(--primary)' }}>études</Link> et{' '}
        <Link href="/comparatif" className="underline" style={{ color: 'var(--primary)' }}>comparatif</Link>.
      </p>

      <nav aria-label="Thèmes" className="mt-8 rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--line)', background: '#fff' }}>
        {THEMES.map((t) => (
          <div key={t} className="mb-3 last:mb-0">
            <p className="font-semibold">{t}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {QUESTIONS.filter((x) => x.theme === t).map((x) => (
                <li key={x.id}>
                  <a href={`#${x.id}`} className="underline underline-offset-2">
                    {x.q}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {THEMES.map((t) => (
        <section key={t} aria-label={t}>
          <h2 className="mt-12 mb-2 font-semibold text-2xl">{t}</h2>
          {QUESTIONS.filter((x) => x.theme === t).map((x) => (
            <article key={x.id} id={x.id} className="scroll-mt-20 border-b py-5" style={{ borderColor: 'var(--line)' }}>
              <h3 className="font-semibold text-xl">{x.q}</h3>
              <p className="mt-2 leading-relaxed">{x.a}</p>
              <p className="mt-2 text-sm">
                <Link href={x.link.href} className="underline" style={{ color: 'var(--primary)' }}>
                  {x.link.label} →
                </Link>
              </p>
            </article>
          ))}
        </section>
      ))}

      <AuditCta />
      <RelatedLinks current={PATH} />
    </PageShell>
  );
}
