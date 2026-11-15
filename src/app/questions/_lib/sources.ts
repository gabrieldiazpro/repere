/**
 * Sources des pages /questions/[slug] et de l'étude « Pourquoi une IA recommande-t-elle une marque ? ».
 * Règle : chaque source est datée (publication ou date de lecture) et son biais éventuel est dit dans `note`.
 * Les clés de src/lib/seo/competitors.ts (SRC) sont aussi utilisables dans les textes : voir refs.ts.
 * Relevé : agent GEO-MARQUE, 15 novembre 2026. À revérifier avant toute republication.
 */
import type { Source } from '@/lib/seo/editorial';

/** Date de lecture des sources de ce fichier. */
export const GEO_SOURCES_CHECKED = '2026-11-15';

export const GEO_SRC = {
  /* Opérateurs (documentation officielle) */
  googleAiGuide: {
    label: 'Google Search Central, « Optimizing for generative AI search »',
    url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
    note: 'documentation officielle, mise à jour le 10 juillet 2026, lue le 15 novembre 2026',
  },
  googleAiFeatures: {
    label: 'Google Search Central, « AI features and your website »',
    url: 'https://developers.google.com/search/docs/appearance/ai-features',
    note: 'documentation officielle',
  },
  openaiPublishers: {
    label: 'OpenAI, « Publishers and developers FAQ »',
    url: 'https://help.openai.com/en/articles/12627856-publishers-and-developers-faq',
    note: 'aide officielle, lue le 15 novembre 2026',
  },
  openaiBots: {
    label: 'OpenAI, « Overview of OpenAI crawlers »',
    url: 'https://developers.openai.com/api/docs/bots.md',
    note: 'documentation officielle',
  },
  perplexityBots: {
    label: 'Perplexity, documentation des robots (PerplexityBot, Perplexity-User)',
    url: 'https://docs.perplexity.ai/docs/resources/perplexity-crawlers.md',
    note: 'documentation officielle',
  },
  anthropicBots: {
    label: 'Anthropic, robots de Claude (ClaudeBot, Claude-SearchBot, Claude-User)',
    url: 'https://support.claude.com/en/articles/8896518',
    note: 'aide officielle',
  },
  mistralBots: { label: 'Mistral AI, robots (MistralAI-User, MistralAI-Index)', url: 'https://docs.mistral.ai/robots', note: 'documentation officielle' },
  bingGuidelines: {
    label: 'Search Engine Journal, « Bing adds GEO to official guidelines, expands AI abuse definitions »',
    url: 'https://www.searchenginejournal.com/bing-adds-geo-to-official-guidelines-expands-ai-abuse-definitions/568442/',
    note: '27 février 2026, mis à jour le 2 mars 2026 ; compte rendu des consignes officielles de Bing',
  },
  bingAiPerformance: {
    label: 'PPC Land, rapport « AI Performance » de Bing Webmaster Tools',
    url: 'https://ppc.land/bing-gives-publishers-first-look-at-how-ai-systems-cite-their-content/',
    note: '14 février 2026 ; préversion publique annoncée par Microsoft le 10 février 2026',
  },
  gbpGuidelines: {
    label: 'Google, consignes de représentation des fiches d’établissement',
    url: 'https://support.google.com/business/answer/3038177?hl=fr',
    note: 'aide officielle, lue le 15 novembre 2026',
  },
  searchConsole: { label: 'Google Search Console', url: 'https://search.google.com/search-console/about', note: 'outil gratuit de Google' },
  pagespeed: { label: 'Google PageSpeed Insights', url: 'https://pagespeed.web.dev/', note: 'outil gratuit de Google' },
  bingWebmaster: { label: 'Bing Webmaster Tools', url: 'https://www.bing.com/webmasters/about', note: 'outil gratuit de Microsoft' },

  /* Expériences contrôlées et prépublications */
  kdd2024: {
    label: 'Aggarwal et al., « GEO: Generative Engine Optimization », KDD 2024',
    url: 'https://arxiv.org/abs/2311.09735',
    note: 'expérience contrôlée sur un moteur simulé et sur Perplexity ; article relu par les pairs',
  },
  fang2025: {
    label: 'Fang et al., biais de fraîcheur des reclasseurs à base de LLM',
    url: 'https://arxiv.org/abs/2509.11353',
    note: 'prépublication, septembre 2025 ; expérience en laboratoire',
  },
  chen2025: {
    label: 'Chen, Wang, Chen et Koudas (Université de Toronto), « Generative Engine Optimization: How to Dominate AI Search »',
    url: 'https://arxiv.org/abs/2509.08919',
    note: 'prépublication du 10 septembre 2025 ; non relue par les pairs',
  },

  /* Études d'éditeurs (corrélations) */
  ahrefsMentions: {
    label: 'Ahrefs, « An Analysis of AI Overview Brand Visibility Factors (75K Brands Studied) »',
    url: 'https://ahrefs.com/blog/ai-overview-brand-correlation/',
    note: '26 mai 2025 ; corrélations de Spearman ; Ahrefs vend des outils de visibilité IA',
  },
  ahrefsBestLists: {
    label: 'Ahrefs, « Do Self-Promotional “Best” Lists Boost ChatGPT Visibility? »',
    url: 'https://ahrefs.com/blog/best-lists-research/',
    note: '4 décembre 2025 ; 750 requêtes, ChatGPT ; Ahrefs publie lui-même des comparatifs',
  },
  scrunch: {
    label: 'PPC Land, étude Scrunch sur les comparatifs auto-classés',
    url: 'https://ppc.land/self-ranked-brands-gain-ai-recommendations-from-4-to-7-scrunch-finds/',
    note: '24 septembre 2026 ; environ 10 000 URL citées, 7 moteurs ; Scrunch vend un service de visibilité IA ; non relue par les pairs',
  },
  growfusely: {
    label: 'Growfusely, analyse des citations IA sur les requêtes de logiciels B2B',
    url: 'https://growfusely.com/blog/ai-citation-analysis-b2b-software/',
    note: '28 juillet 2026 ; 128 requêtes, 1 739 citations, ChatGPT (API) et Perplexity ; agence qui vend ce service',
  },
  indig: {
    label: 'Search Engine Land, étude de Kevin Indig sur 18 012 citations de ChatGPT',
    url: 'https://searchengineland.com/chatgpt-citations-content-study-469483',
    note: 'corrélation, ChatGPT seul',
  },
  seRankingLlms: {
    label: 'Search Engine Journal, llms.txt sans effet mesurable sur 300 000 domaines (SE Ranking)',
    url: 'https://www.searchenginejournal.com/llms-txt-shows-no-clear-effect-on-ai-citations-based-on-300k-domains/561542/',
    note: 'novembre 2025 ; éditeur d’outils SEO',
  },
  g2Report: {
    label: 'G2, 2026 AI Search Insight Report',
    url: 'https://learn.g2.com/g2-2026-ai-search-insight-report',
    note: 'mars 2026 ; 1 076 décideurs B2B ; G2 vend de la visibilité sur ses avis',
  },
  similarwebDomains: {
    label: 'Similarweb, domaines les plus cités par les LLM',
    url: 'https://aisearch.similarweb.com/blog/most-cited-domains-llms/',
    note: 'environ 600 000 citations, États-Unis, janvier-février 2026',
  },

  /* Comparatifs francophones lus le 15 novembre 2026 */
  lfdnGeo: {
    label: 'La Fabrique du Net, comparatif des outils GEO',
    url: 'https://www.lafabriquedunet.fr/logiciels/marketing-digital/outils-geo',
    note: 'mis à jour le 13 novembre 2026, prix relevés le 6 octobre 2026 ; la page indique que certaines positions peuvent être rémunérées',
  },
  lfdnSemrush: {
    label: 'La Fabrique du Net, alternatives à Semrush',
    url: 'https://www.lafabriquedunet.fr/logiciels/alternatives/alternative-semrush/',
    note: 'mis à jour le 7 octobre 2026 ; la page déclare qu’aucun éditeur ne paie pour y figurer, avec des liens affiliés',
  },
  toolAdvisorLlm: {
    label: 'Tool Advisor, outils de suivi de visibilité dans les LLM',
    url: 'https://tool-advisor.fr/blog/outil-suivi-llm/',
    note: '16 mars 2026, modifié le 30 juillet 2026',
  },
  codeurGeo: {
    label: 'Codeur.com, comparatif des outils GEO',
    url: 'https://www.codeur.com/comparatif/outil-geo',
    note: 'juin 2026 ; la page indique que la première position peut être liée à un sponsoring',
  },
} as const satisfies Record<string, Source>;

export type GeoSrcKey = keyof typeof GEO_SRC;
