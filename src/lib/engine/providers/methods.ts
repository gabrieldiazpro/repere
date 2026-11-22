/**
 * V8 : comment chaque IA est mesurée — source unique pour l'interface (« Mesuré via… »), les rapports et la doc.
 *
 * Deux familles, dites clairement à l'utilisateur :
 * - 'api'  : API officielle de l'éditeur, avec son outil de recherche web quand il existe (proche de ce que voit un
 *            utilisateur de l'application, sans être identique : modèle, consignes et personnalisation diffèrent) ;
 * - 'serp' : pas d'API grand public (aperçus IA et AI Mode de Google, Copilot dans Bing) : on relève la page de
 *            résultats telle qu'elle s'affiche en France, via un fournisseur de SERP (DataForSEO).
 * Sources vérifiées le 22 nov. 2026 : docs/v8/progress/MOTEURS-IA.md.
 */
import type { ProviderId } from '../types';
import { PROVIDER_LABELS } from '../types';
import { env } from '../util';

export interface ProviderMethod {
  via: 'api' | 'serp';
  vendor: string;
  /** la réponse s'appuie sur une recherche web en direct (par défaut, avec la configuration actuelle) */
  webSearch: boolean;
  /** localisation transmise au fournisseur */
  location: 'ville' | 'pays' | 'aucune';
  device?: 'mobile' | 'desktop';
  /** ce que l'on mesure, en une phrase */
  what: string;
  /** limite honnête à afficher */
  caveat: string;
}

/** Appareil des relevés de pages de résultats Google (AUDIT_SERP_DEVICE : mobile par défaut, ou desktop). */
export function serpDevice(): 'mobile' | 'desktop' {
  return (env('AUDIT_SERP_DEVICE') || '').trim().toLowerCase() === 'desktop' ? 'desktop' : 'mobile';
}

function geminiGrounded(): boolean {
  return (env('GEMINI_GROUNDING') || '').trim().toLowerCase() === 'on';
}

export function providerMethod(id: ProviderId): ProviderMethod {
  switch (id) {
    case 'chatgpt':
      return { via: 'api', vendor: 'OpenAI', webSearch: true, location: 'ville', what: 'API OpenAI (Responses) avec l’outil de recherche web, position approximative transmise.', caveat: 'Proche de ChatGPT avec recherche, sans l’historique ni la mémoire d’un utilisateur.' };
    case 'perplexity':
      return { via: 'api', vendor: 'Perplexity', webSearch: true, location: 'ville', what: 'API Perplexity (Agent API, modèle Sonar) avec recherche web, position transmise.', caveat: 'Le modèle de l’application peut différer selon l’abonnement de l’utilisateur.' };
    case 'gemini':
      return geminiGrounded()
        ? { via: 'api', vendor: 'Google', webSearch: true, location: 'aucune', what: 'API Gemini avec ancrage Google Search.', caveat: 'Sources non conservées (conditions de Google).' }
        : { via: 'api', vendor: 'Google', webSearch: false, location: 'aucune', what: 'API Gemini sans recherche web (connaissances du modèle).', caveat: 'L’application Gemini peut chercher sur le web : ses réponses peuvent être plus récentes.' };
    case 'claude':
      return { via: 'api', vendor: 'Anthropic', webSearch: true, location: 'ville', what: 'API Anthropic (Messages) avec l’outil de recherche web, position approximative transmise.', caveat: 'Proche de Claude avec recherche, sans projets ni mémoire d’un utilisateur.' };
    case 'mistral':
      return { via: 'api', vendor: 'Mistral AI', webSearch: true, location: 'aucune', what: 'API Mistral (Conversations) avec l’outil de recherche web, consigne « utilisateur en France ».', caveat: 'L’assistant grand public s’appelle Vibe depuis le 28 mai 2026 ; l’API n’utilise pas forcément le même modèle.' };
    case 'deepseek':
      return { via: 'api', vendor: 'DeepSeek', webSearch: true, location: 'aucune', what: 'API DeepSeek (Chat Completions) avec l’outil deepseek_web_search, consigne « utilisateur en France ».', caveat: 'L’API ne permet pas de transmettre une position : la ville figure seulement dans la question.' };
    case 'grok':
      return { via: 'api', vendor: 'xAI', webSearch: true, location: 'aucune', what: 'API xAI (Responses) avec l’outil web_search, consigne « utilisateur en France ».', caveat: 'Peu utilisé en France ; l’API ne permet pas de transmettre une position.' };
    case 'google_aio':
      return { via: 'serp', vendor: 'DataForSEO', webSearch: true, location: 'pays', device: serpDevice(), what: 'Aperçu IA affiché en haut de la page de résultats Google, relevé en France, en français.', caveat: 'Google n’affiche pas d’aperçu IA pour toutes les recherches : son absence est comptée à part, pas comme un oubli.' };
    case 'google_ai_mode':
      return { via: 'serp', vendor: 'DataForSEO', webSearch: true, location: 'pays', what: 'Réponse du mode IA de Google (AI Mode), relevée en France, en français.', caveat: 'Relevé sans compte Google : la personnalisation d’un utilisateur connecté n’est pas reproduite.' };
    case 'copilot':
      return { via: 'serp', vendor: 'DataForSEO', webSearch: true, location: 'pays', device: 'desktop', what: 'Réponse Copilot affichée dans la recherche Bing, relevée en France, en français, sur ordinateur.', caveat: 'C’est Copilot dans Bing, pas l’application Copilot (sans API publique) ; Bing n’affiche pas toujours de réponse Copilot.' };
    default:
      return { via: 'api', vendor: '?', webSearch: false, location: 'aucune', what: '', caveat: '' };
  }
}

const DEVICE: Record<'mobile' | 'desktop', string> = { mobile: 'sur mobile', desktop: 'sur ordinateur' };

/** Phrase courte affichée sous le nom de l'IA (« Mesuré via les résultats Google en France, sur mobile, en français »). */
export function methodNote(id: ProviderId, opts: { model?: string; demo?: boolean } = {}): string {
  const m = providerMethod(id);
  if (opts.demo) return `${PROVIDER_LABELS[id]} : données de démonstration (aucune mesure réelle).`;
  if (m.via === 'serp') {
    const engine = id === 'copilot' ? 'Bing' : 'Google';
    return `Mesuré via les résultats ${engine} en France${m.device ? `, ${DEVICE[m.device]}` : ''}, en français (relevé ${m.vendor}). ${m.caveat}`;
  }
  const model = opts.model ? ` (modèle ${opts.model})` : '';
  return `Mesuré via l’API officielle ${m.vendor}${model}, ${m.webSearch ? 'avec' : 'sans'} recherche web, en français${m.location === 'ville' ? ', position en France transmise' : ''}. ${m.caveat}`;
}
