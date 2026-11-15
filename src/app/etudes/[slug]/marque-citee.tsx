/**
 * Étude « Pourquoi une IA recommande-t-elle une marque ? » : synthèse des documentations officielles et des études
 * publiques 2024-2026, chaque constat avec son niveau de preuve (démontré / probable / hypothèse, voir /methode).
 * Aucune donnée Repéré : nos propres mesures viendront avec le Baromètre.
 */
import Link from 'next/link';
import { QaSection, Toc } from '@/lib/seo/editorial';
import { refResolver } from '@/app/questions/_lib/refs';
import { Blocks, plain, resolveBlocks } from '@/app/questions/_lib/render';
import type { Block } from '@/app/questions/_lib/target-questions';

export const BRAND_STUDY_SLUG = 'pourquoi-les-ia-recommandent-une-marque';

const INTRO =
  "Ce qui fait qu'une IA générative recommande une marque n'est publié par aucun opérateur sous forme de recette. On dispose de trois types de preuves : ce que les opérateurs écrivent eux-mêmes, quelques expériences contrôlées, et de grandes études de corrélation menées, pour la plupart, par des éditeurs d'outils. Cette synthèse les sépare, avec la portée et le biais de chacune.";

const SECTIONS: { id: string; q: string; answer: string; blocks: Block[] }[] = [
  {
    id: 'operateurs',
    q: 'Que disent les opérateurs eux-mêmes ?',
    answer:
      "Ils publient des conditions d'accès, pas de recette : être explorable et indexable, ne pas bloquer leurs robots de recherche, écrire des pages claires et originales. Google précise que le SEO classique reste valable pour ses fonctions IA [@googleAiGuide], et Bing que le GEO ne garantit aucune citation [@bingGuidelines].",
    blocks: [
      {
        table: {
          head: ['Opérateur', 'Ce qui est écrit', 'Source'],
          rows: [
            [
              'Google (AI Overviews, AI Mode)',
              'Les fonctions IA reposent sur les systèmes de classement de la recherche ; pas besoin de fichiers spéciaux (llms.txt), de découpage en petits morceaux ni de balisage schema.org particulier ; chercher des mentions inauthentiques est peu utile ; un contenu original, non interchangeable, compte le plus à long terme ; fiches d’établissement et Merchant Center aident à être visible dans les réponses IA.',
              '[@googleAiGuide]',
            ],
            ['OpenAI (ChatGPT)', 'Tout site public peut apparaître dans la recherche de ChatGPT ; ne pas bloquer OAI-SearchBot ; les liens portent utm_source=chatgpt.com.', '[@openaiPublishers][@openaiBots]'],
            [
              'Microsoft (Bing, Copilot)',
              'Le GEO entre dans les consignes : noms d’entités clairs et cohérents, un sujet par URL, faits explicites, l’essentiel en haut ; aucune garantie de citation ; le langage fabriqué pour déclencher des citations et l’injection de consignes sont des abus.',
              '[@bingGuidelines]',
            ],
            ['Perplexity', 'PerplexityBot sert la recherche, pas l’entraînement, et respecte robots.txt ; ses adresses IP sont publiées pour les pare-feu.', '[@perplexityBots]'],
            ['Anthropic (Claude)', 'Claude-SearchBot alimente la recherche de Claude ; le bloquer réduit la visibilité dans les réponses avec recherche.', '[@anthropicBots]'],
            ['Mistral (Le Chat)', 'MistralAI-User lit les pages à la demande des utilisateurs, selon robots.txt.', '[@mistralBots]'],
          ],
        },
      },
    ],
  },
  {
    id: 'experiences',
    q: 'Que montrent les expériences contrôlées ?',
    answer:
      "La principale expérience publique et relue mesure l'effet de réécritures : ajouter des citations, des statistiques et des sources augmente la part d'une page dans la réponse générée, le bourrage de mots-clés la réduit [@kdd2024]. Une autre montre que les reclasseurs à base de LLM préfèrent les passages datés récemment [@fang2025].",
    blocks: [
      {
        table: {
          head: ['Étude', 'Résultat', 'Portée'],
          rows: [
            ['Aggarwal et al., KDD 2024 [@kdd2024]', '+41 % de visibilité avec des citations, +31 % avec des statistiques, +27 % avec des sources, +28 % en améliorant la fluidité ; −8 % avec le bourrage de mots-clés', 'Moteur simulé et Perplexity (200 requêtes) ; gains plus forts pour les sources mal classées'],
            ['Fang et al., 2025 [@fang2025]', 'À contenu égal, les passages datés plus récemment sont préférés, jusqu’à 25 % de préférences inversées', 'Laboratoire ; prépublication'],
          ],
        },
      },
    ],
  },
  {
    id: 'correlations',
    q: "Qu'observent les grandes études de citations ?",
    answer:
      "Que les IA citent surtout des sources tierces plutôt que le site de la marque, que les mentions d'une marque sur le web vont de pair avec sa visibilité bien plus que les liens, et que les articles « meilleurs outils » sont le premier type de page cité sur les requêtes de comparaison. Ce sont des corrélations, pas des preuves de cause.",
    blocks: [
      {
        table: {
          head: ['Constat', 'Chiffre', 'Étude'],
          rows: [
            ['Sources tierces préférées au site de la marque', 'ChatGPT, Perplexity et Gemini citent majoritairement des médias tiers « gagnés » ; Google montre un mélange plus équilibré', '[@chen2025]'],
            ['Mentions plutôt que liens', 'Corrélation avec la visibilité dans AI Overviews : 0,664 pour les mentions de la marque sur le web, 0,218 pour le nombre de liens', '[@ahrefsMentions] (75 000 marques)'],
            ['Les listes « meilleurs X » dominent', '43,8 % des pages citées par ChatGPT sur 750 requêtes de comparaison ; 79,1 % de ces listes mises à jour en 2025', '[@ahrefsBestLists]'],
            ['Se classer soi-même premier : effet faible', 'Recommandation de la marque auteure de 4 % à 7 % environ quand sa liste est citée, dont une part relève du placebo ; un concurrent est recommandé à sa place dans 24,3 % des cas', '[@scrunch]'],
            ['Logiciels B2B : contenu indépendant d’abord', 'Environ 79 % des citations vont au contenu indépendant et aux pages des éditeurs, 7,3 % aux sites d’avis ; Reddit cité seulement par Perplexity dans l’échantillon', '[@growfusely]'],
            ['L’essentiel en haut de page', '44 % des citations de ChatGPT viennent du premier tiers de la page', '[@indig]'],
            ['Avis et confiance', 'Pour les acheteurs B2B, la citation d’un site d’avis est le premier signal de confiance dans une réponse IA (45 %)', '[@g2Report]'],
            ['Wikipédia et Reddit très cités', 'Wikipédia 13,2 % et Reddit 12,0 % des citations de ChatGPT, aux États-Unis', '[@similarwebDomains]'],
          ],
        },
      },
      {
        p: 'Lecture critique : presque toutes ces études sont publiées par des éditeurs qui vendent des outils ou des services de visibilité IA ; elles portent souvent sur les États-Unis, sur des API plutôt que sur les applications grand public, et sur une période courte. Les sources citées changent vite d’un mois à l’autre.',
      },
    ],
  },
  {
    id: 'pas-prouve',
    q: "Qu'est-ce qui n'est pas prouvé ?",
    answer:
      "Le fichier llms.txt, un balisage schema.org « pour l'IA » et le découpage du texte en petits blocs n'ont pas d'effet démontré sur les citations : Google dit ne pas en avoir besoin [@googleAiGuide], et une étude sur 300 000 domaines ne trouve pas d'effet de llms.txt [@seRankingLlms].",
    blocks: [
      {
        ul: [
          'llms.txt : sans effet mesuré ; inoffensif, mais pas un levier [@googleAiGuide][@seRankingLlms].',
          'Données structurées : non requises par Google pour ses fonctions IA ; utiles pour les résultats enrichis et la cohérence des informations [@googleAiGuide].',
          'Wikidata, sameAs, Knowledge Graph : aident vraisemblablement à identifier une entité, mais aucun opérateur ne publie d’effet sur les citations (hypothèse).',
          'Nombre d’avis : corrélé à la confiance des acheteurs [@g2Report], effet direct sur les citations non mesuré publiquement.',
        ],
      },
    ],
  },
  {
    id: 'interdit',
    q: "Qu'est-ce qui est interdit ou contre-productif ?",
    answer:
      "Le texte caché ou les consignes adressées aux IA, le langage fabriqué pour déclencher des citations, les pages produites en masse sans relecture, et les mentions ou avis inauthentiques : Bing et Google les classent parmi les abus [@bingGuidelines][@googleAiGuide], et les faux avis sont illégaux en France.",
    blocks: [
      {
        ul: [
          'Injection de consignes (prompt injection) et manipulation des modèles : section dédiée des consignes de Bing depuis février 2026 [@bingGuidelines].',
          'Contenu à grande échelle sans contrôle éditorial : visé par Bing [@bingGuidelines] et par la politique de Google sur les contenus produits en masse [@googleAiGuide].',
          'Mentions inauthentiques : Google les juge peu utiles [@googleAiGuide] ; des comparatifs auto-classés ont un effet faible et peuvent profiter aux concurrents [@scrunch].',
          'Faux avis : voir notre [guide sur les avis clients et les IA](/guides/avis-clients-ia).',
        ],
      },
    ],
  },
  {
    id: 'en-pratique',
    q: 'Que faut-il en retenir en pratique ?',
    answer:
      "Rendre le site lisible par les robots de recherche, publier des pages originales qui répondent clairement et sourcent leurs chiffres, garder une identité identique partout, et surtout être présent, honnêtement, sur les sources tierces que les IA citent dans votre secteur : comparatifs, annuaires, avis, presse.",
    blocks: [
      {
        table: {
          head: ['Levier', 'Niveau de preuve', 'Sur quoi il repose'],
          rows: [
            ['Ne pas bloquer les robots de recherche des IA', 'Démontré', 'Documentation d’OpenAI, Perplexity, Anthropic, Google [@openaiPublishers][@perplexityBots][@anthropicBots][@googleAiGuide]'],
            ['Pages indexables, SEO technique sain', 'Démontré (Google)', 'Guide officiel de Google [@googleAiGuide]'],
            ['Réponses claires, chiffres et sources cités', 'Démontré en laboratoire, probable en conditions réelles', 'KDD 2024, consignes de Bing [@kdd2024][@bingGuidelines]'],
            ['Dates honnêtes, contenus tenus à jour', 'Probable', 'Expérience de laboratoire, fraîcheur des listes citées [@fang2025][@ahrefsBestLists]'],
            ['Présence sur comparatifs, avis, presse, forums', 'Probable (corrélation forte)', 'Études de citations [@chen2025][@ahrefsMentions]'],
            ['Identité cohérente (nom, description, profils officiels)', 'Probable (recommandation de Bing), hypothèse pour sameAs', 'Consignes de Bing [@bingGuidelines]'],
            ['Fiche d’établissement Google, si éligible', 'Démontré comme voie de visibilité, effet non chiffré', 'Guide de Google [@googleAiGuide][@gbpGuidelines]'],
            ['llms.txt', 'Non démontré', '[@seRankingLlms]'],
          ],
        },
      },
    ],
  },
];

/** Textes et sources résolus une fois, dans l'ordre de lecture. */
function build() {
  const { t, sources } = refResolver();
  const sections = SECTIONS.map((s) => ({ ...s, answer: t(s.answer), blocks: resolveBlocks(s.blocks, t) }));
  return { sections, sources: sources() };
}
const BUILT = build();

export const BRAND_STUDY_SOURCES = BUILT.sources;
/** Questions-réponses de l'étude (JSON-LD FAQPage), en texte brut. */
export const BRAND_STUDY_QA = SECTIONS.map((s) => ({ q: s.q, a: plain(s.answer) }));

export function BrandCitationStudy() {
  const toc = [...BUILT.sections.map((s) => ({ id: s.id, label: s.q })), { id: 'nos-mesures', label: 'Et les mesures de Repéré ?' }];
  return (
    <>
      <p className="mt-6 text-lg leading-relaxed">{INTRO}</p>
      <Toc items={toc} />
      {BUILT.sections.map((s) => (
        <QaSection key={s.id} id={s.id} q={s.q} answer={s.answer}>
          <Blocks blocks={s.blocks} />
        </QaSection>
      ))}
      <QaSection
        id="nos-mesures"
        q="Et les mesures de Repéré ?"
        answer="Nous n'en publions pas encore : nos premières mesures agrégées viendront avec le Baromètre Repéré de la visibilité IA, publié seulement quand l'échantillon sera suffisant."
      >
        <p className="leading-relaxed">
          Les niveaux de preuve suivent notre{' '}
          <Link href="/methode" className="underline" style={{ color: 'var(--primary)' }}>
            méthode
          </Link>{' '}
          ; l&apos;état de la collecte est sur la page du{' '}
          <Link href="/etudes/barometre-visibilite-ia" className="underline" style={{ color: 'var(--primary)' }}>
            Baromètre
          </Link>
          . Pour les usages des IA en France, voir la{' '}
          <Link href="/etudes/ce-que-nous-savons-deja" className="underline" style={{ color: 'var(--primary)' }}>
            synthèse des études publiques
          </Link>
          .
        </p>
      </QaSection>
    </>
  );
}
