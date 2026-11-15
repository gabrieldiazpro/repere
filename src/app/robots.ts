import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/**
 * Ce que nous recommandons à nos clients, appliqué à notre propre site (voir /geo et /methode).
 *
 * - /rapport/ reste explorable : les aperçus de partage (LinkedInBot, Twitterbot, Slack…) doivent lire l'image OG,
 *   et Google doit pouvoir lire le noindex de ces pages (une URL bloquée peut être indexée « sans contenu »).
 * - /api/, /app, /admin : espaces privés, sans intérêt pour un moteur. « /app » sans barre finale couvre aussi l'entrée
 *   de l'espace (/app, /app?visite=1…, qui redirige vers /connexion) : « /app/ » seul la laissait explorer (V6).
 */
// /outils/api/ : points d'entrée POST des outils gratuits, aucun contenu à explorer (OUTILS, V6).
const DISALLOW = ['/api/', '/app', '/admin', '/outils/api/'];
/**
 * Exception : le balisage schema.org servi par /api/schema/<compte> est fait pour être lu par les robots (c'est le
 * livrable « données structurées » d'Accompagné, lié depuis /tarifs et les parcours). La règle la plus longue l'emporte.
 */
const ALLOW = ['/', '/api/schema/'];

/** Recherche et réponses en temps réel : à autoriser pour être cité. */
const AI_SEARCH_AND_USER_AGENTS = [
  'OAI-SearchBot', // index de la recherche ChatGPT
  'ChatGPT-User', // visites à la demande d'un utilisateur de ChatGPT
  'Claude-SearchBot', // index de recherche de Claude
  'Claude-User', // visites à la demande d'un utilisateur de Claude
  'PerplexityBot', // index de Perplexity
  'Perplexity-User', // visites à la demande d'un utilisateur de Perplexity
  'MistralAI-User', // Le Chat (Mistral AI)
  'DuckAssistBot', // réponses DuckDuckGo
  'Bingbot', // moteur de Copilot
  'Applebot', // Siri, Spotlight, Apple Intelligence
  'Googlebot', // Google Search, AI Overviews et AI Mode
];

/** Entraînement et ancrage des modèles : choix assumé, autorisé (nos contenus sont faits pour être repris). */
const AI_TRAINING_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'Applebot-Extended', 'CCBot', 'Meta-ExternalAgent'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ALLOW, disallow: DISALLOW },
      { userAgent: AI_SEARCH_AND_USER_AGENTS, allow: ALLOW, disallow: DISALLOW },
      { userAgent: AI_TRAINING_AGENTS, allow: ALLOW, disallow: DISALLOW },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
