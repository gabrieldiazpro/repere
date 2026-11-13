/**
 * Robots d'IA suivis par les outils (tableau versionné et daté, à revoir chaque trimestre : les noms changent).
 * Source interne : docs/v2/05-ai-sources.json (documentation des opérateurs lue le 2026-11-09 pour OpenAI,
 * Perplexity et Anthropic ; sources secondaires pour Google-Extended et Applebot-Extended ; le reste à revérifier).
 */
import type { AiBot, BotRole } from './types';

export const BOTS_VERSION = '2026-11-09';

export const ROLE_LABELS: Record<BotRole, string> = {
  training: 'Entraînement',
  search: 'Recherche (index)',
  user: 'Navigation à la demande',
  control: 'Jeton de contrôle (entraînement)',
};

export const AI_BOTS: AiBot[] = [
  { token: 'GPTBot', operator: 'OpenAI', product: 'ChatGPT', role: 'training', meaning: 'Collecte pour entraîner les modèles d’OpenAI. Le bloquer ne retire pas le site de ChatGPT Search.' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', product: 'ChatGPT', role: 'search', meaning: 'Index de la recherche ChatGPT. Le bloquer retire le site des réponses de recherche de ChatGPT (prise en compte en 24 h environ, selon OpenAI).' },
  { token: 'ChatGPT-User', operator: 'OpenAI', product: 'ChatGPT', role: 'user', mayIgnoreRobots: true, meaning: 'Lecture d’une page à la demande d’un utilisateur de ChatGPT. Selon OpenAI, robots.txt peut ne pas s’appliquer.' },
  { token: 'PerplexityBot', operator: 'Perplexity', product: 'Perplexity', role: 'search', meaning: 'Index de recherche de Perplexity (annoncé comme non utilisé pour l’entraînement).' },
  { token: 'Perplexity-User', operator: 'Perplexity', product: 'Perplexity', role: 'user', mayIgnoreRobots: true, meaning: 'Lecture en temps réel pour répondre à un utilisateur ; ignore généralement robots.txt selon Perplexity.' },
  { token: 'ClaudeBot', operator: 'Anthropic', product: 'Claude', role: 'training', meaning: 'Collecte pouvant servir à l’entraînement des modèles d’Anthropic.' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', product: 'Claude', role: 'search', meaning: 'Index pour les résultats de recherche de Claude.' },
  { token: 'Claude-User', operator: 'Anthropic', product: 'Claude', role: 'user', meaning: 'Lecture d’une page quand un utilisateur de Claude pose une question (respecte robots.txt selon Anthropic).' },
  { token: 'Google-Extended', operator: 'Google', product: 'Gemini', role: 'control', tokenOnly: true, meaning: 'Jeton robots.txt (aucune visite) : autorise ou non l’usage de vos pages pour l’entraînement et l’ancrage de Gemini. Sans effet sur la recherche Google, les AI Overviews et l’AI Mode.' },
  { token: 'Googlebot', operator: 'Google', product: 'Google Search, AI Overviews, AI Mode', role: 'search', meaning: 'Robot de la recherche Google. Les AI Overviews et l’AI Mode s’appuient sur cet index.' },
  { token: 'Bingbot', operator: 'Microsoft', product: 'Bing, Copilot', role: 'search', meaning: 'Robot de Bing, dont l’index alimente Copilot et d’autres assistants.' },
  { token: 'Applebot', operator: 'Apple', product: 'Siri, Spotlight, Safari', role: 'search', meaning: 'Index d’Apple (Siri, Spotlight, Safari).' },
  { token: 'Applebot-Extended', operator: 'Apple', product: 'Apple Intelligence', role: 'control', tokenOnly: true, meaning: 'Jeton robots.txt (aucune visite) : autorise ou non l’entraînement des modèles d’Apple sur les pages collectées par Applebot.' },
  { token: 'MistralAI-User', operator: 'Mistral', product: 'Le Chat', role: 'user', mayIgnoreRobots: true, meaning: 'Lecture à la demande d’un utilisateur du Chat de Mistral.' },
  { token: 'Meta-ExternalAgent', operator: 'Meta', product: 'Meta AI', role: 'training', meaning: 'Collecte de Meta pour l’entraînement et l’indexation de ses IA (à confirmer sur journaux réels).' },
  { token: 'Meta-ExternalFetcher', operator: 'Meta', product: 'Meta AI', role: 'user', mayIgnoreRobots: true, meaning: 'Lecture à la demande d’un utilisateur de Meta AI.' },
  { token: 'Amazonbot', operator: 'Amazon', product: 'Alexa, Rufus', role: 'search', meaning: 'Robot d’Amazon (Alexa et services d’IA).' },
  { token: 'DuckAssistBot', operator: 'DuckDuckGo', product: 'DuckAssist', role: 'user', meaning: 'Lecture pour les réponses IA de DuckDuckGo.' },
  { token: 'CCBot', operator: 'Common Crawl', product: 'Common Crawl', role: 'training', meaning: 'Corpus public Common Crawl, réutilisé pour entraîner de nombreux modèles.' },
  { token: 'Bytespider', operator: 'ByteDance', product: 'Doubao, TikTok', role: 'training', meaning: 'Collecte pour l’entraînement des modèles de ByteDance (respect du robots.txt contesté par des tiers).' },
];

/** Robots dont le blocage rend le site invisible dans les réponses d'IA avec recherche. */
export const SEARCH_CRITICAL = ['OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot', 'Googlebot', 'Bingbot'];
