/**
 * AuditIA Local : snippets des providers IA (fetch natif, sans SDK).
 * Vérifié contre la documentation officielle le 9 novembre 2026 (voir docs/04-api-ia.md).
 *
 * Chaque fonction a la signature :
 *   (query, { city?, country?, apiKey }) => Promise<{ text, citations }>
 * Elle LÈVE une ProviderError en cas d'échec (HTTP, timeout, réponse vide). Le moteur
 * (audit.ts) l'attrape et remplit ProviderAnswer.error.
 *
 * `country` peut être un code ISO alpha-2 ("FR") ou un nom ("France") : il est normalisé.
 * Les modèles se surchargent par variable d'environnement (OPENAI_MODEL, PERPLEXITY_MODEL,
 * GEMINI_MODEL, ANTHROPIC_MODEL), car les noms changent vite.
 *
 * [NON VÉRIFIÉ] = point non confirmé dans la doc officielle au 09/11/2026 : à tester avec une vraie clé.
 */

export interface AskOpts {
  city?: string;
  country?: string;
  apiKey: string;
  /** Optionnel : délai max en ms (défaut 60 s, car une recherche web prend 5 à 30 s). */
  timeoutMs?: number;
}
export interface AskResult {
  text: string;
  citations: string[];
}

export class ProviderError extends Error {
  constructor(
    public provider: 'openai' | 'perplexity' | 'gemini' | 'anthropic',
    message: string,
    public status?: number,
    public retryable = false,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

const DEFAULT_TIMEOUT_MS = 60_000;

const env = (k: string): string | undefined =>
  typeof process !== 'undefined' ? process.env?.[k] : undefined;

/* ------------------------------------------------------------------ */
/* Helpers communs                                                     */
/* ------------------------------------------------------------------ */

const COUNTRY_CODES: Record<string, string> = {
  france: 'FR', belgique: 'BE', belgium: 'BE', suisse: 'CH', switzerland: 'CH',
  luxembourg: 'LU', canada: 'CA', monaco: 'MC', 'royaume-uni': 'GB', 'united kingdom': 'GB',
  espagne: 'ES', italie: 'IT', allemagne: 'DE', 'etats-unis': 'US', 'états-unis': 'US', usa: 'US',
};

/** "France" → "FR", "fr" → "FR". Retourne undefined si inconnu (on n'envoie alors pas de pays). */
export function toIsoCountry(country?: string): string | undefined {
  if (!country) return undefined;
  const c = country.trim();
  if (/^[a-z]{2}$/i.test(c)) return c.toUpperCase();
  return COUNTRY_CODES[c.toLowerCase()];
}

/** Déduplique et nettoie une liste d'URL (retire les paramètres utm_*). */
function uniqueUrls(urls: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    if (!raw || typeof raw !== 'string') continue;
    let u = raw.trim();
    try {
      const parsed = new URL(u);
      [...parsed.searchParams.keys()]
        .filter((k) => k.startsWith('utm_'))
        .forEach((k) => parsed.searchParams.delete(k));
      u = parsed.toString();
    } catch {
      continue; // pas une URL valide
    }
    if (!seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/**
 * POST JSON avec timeout (AbortController) et UNE nouvelle tentative sur 429 ou 5xx.
 * Lève ProviderError avec un extrait du corps d'erreur.
 */
async function postJson(
  provider: ProviderError['provider'],
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  attempt = 1,
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timer);
    if (err?.name === 'AbortError') {
      throw new ProviderError(provider, `timeout après ${timeoutMs} ms`, undefined, true);
    }
    throw new ProviderError(provider, `erreur réseau : ${err?.message ?? String(err)}`, undefined, true);
  }
  clearTimeout(timer);

  const raw = await res.text();
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < 2) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 10_000) : 2_000;
      await new Promise((r) => setTimeout(r, waitMs));
      return postJson(provider, url, headers, body, timeoutMs, attempt + 1);
    }
    let msg = raw.slice(0, 500);
    try {
      const j = JSON.parse(raw);
      msg = j?.error?.message ?? j?.message ?? msg;
    } catch { /* corps non JSON */ }
    throw new ProviderError(provider, `HTTP ${res.status} : ${msg}`, res.status, retryable);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new ProviderError(provider, 'réponse non JSON', res.status);
  }
}

function assertKey(provider: ProviderError['provider'], apiKey: string) {
  if (!apiKey) throw new ProviderError(provider, 'clé API manquante');
}

/* ------------------------------------------------------------------ */
/* 1. OpenAI : Responses API + outil web_search                       */
/* ------------------------------------------------------------------ */
/**
 * Modèle par défaut : gpt-5.6-luna (0,20 $ / 1,20 $ par million de tokens, web_search
 * confirmé sur sa fiche). gpt-6-luna (0,10 $ / 0,50 $) est moins cher, mais le support de
 * web_search n'a pas été confirmé sur sa fiche [NON VÉRIFIÉ] : mettre OPENAI_MODEL=gpt-6-luna après un test.
 * Coût outil : 10 $ / 1 000 appels de recherche, plus les tokens de contenu de recherche au tarif du modèle.
 */
export async function askOpenAI(query: string, opts: AskOpts): Promise<AskResult> {
  assertKey('openai', opts.apiKey);
  const country = toIsoCountry(opts.country);
  const userLocation: Record<string, string> = { type: 'approximate' };
  if (country) userLocation.country = country;
  if (opts.city) userLocation.city = opts.city;
  if (country === 'FR') userLocation.timezone = 'Europe/Paris';

  const body = {
    model: env('OPENAI_MODEL') ?? 'gpt-5.6-luna',
    input: query,
    tools: [
      {
        type: 'web_search', // ne pas utiliser web_search_preview (ancien outil)
        search_context_size: 'low', // low | medium (défaut) | high : low réduit les tokens facturés
        ...(Object.keys(userLocation).length > 1 ? { user_location: userLocation } : {}),
      },
    ],
    // "none" peut dégrader la qualité avec la recherche, d'après la doc ; "low" reste bon marché.
    reasoning: { effort: 'low' },
    // max_tool_calls: 2,  // [NON VÉRIFIÉ] plafonne le nombre de recherches, et donc le coût
    store: false,
  };

  const data = await postJson(
    'openai',
    'https://api.openai.com/v1/responses',
    { Authorization: `Bearer ${opts.apiKey}` },
    body,
    opts.timeoutMs,
  );

  if (data?.error) throw new ProviderError('openai', data.error.message ?? 'erreur inconnue');

  // output[] contient des items "web_search_call" puis un item "message".
  // message.content[] : { type: "output_text", text, annotations: [{ type: "url_citation", url, title, start_index, end_index }] }
  const texts: string[] = [];
  const urls: string[] = [];
  for (const item of data?.output ?? []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') {
        texts.push(c.text);
        for (const a of c.annotations ?? []) {
          if (a?.type === 'url_citation') urls.push(a.url);
        }
      }
    }
  }
  const text = texts.join('\n').trim() || (typeof data?.output_text === 'string' ? data.output_text : '');
  if (!text) throw new ProviderError('openai', `réponse vide (status=${data?.status ?? '?'})`);
  return { text, citations: uniqueUrls(urls) };
}

/* ------------------------------------------------------------------ */
/* 2. Perplexity : Agent API (/v1/agent), modèle perplexity/sonar     */
/* ------------------------------------------------------------------ */
/**
 * Le support de Sonar Chat Completions (/chat/completions) a pris fin le 27/09/2026 : les requêtes
 * synchrones sont « reformulées » en Agent API. On appelle donc directement /v1/agent.
 * Tarif : perplexity/sonar à 0,25 $ / 2,50 $ par million de tokens, plus web_search à 0,0025 $ par
 * appel (ou 0,001 $ en Fast Search).
 * La structure exacte des annotations ({ type: "citation", url }) n'est montrée que par un seul
 * exemple de la doc ; repli sur search_results.
 */
export async function askPerplexity(query: string, opts: AskOpts): Promise<AskResult> {
  assertKey('perplexity', opts.apiKey);
  const country = toIsoCountry(opts.country);
  const userLocation: Record<string, string> = {};
  if (country) userLocation.country = country;
  if (opts.city) userLocation.city = opts.city;

  const body = {
    model: env('PERPLEXITY_MODEL') ?? 'perplexity/sonar',
    input: query,
    tools: [
      {
        type: 'web_search',
        // search_type: 'fast',   // 0,001 $ au lieu de 0,0025 $ par appel (moins de profondeur)
        ...(Object.keys(userLocation).length ? { user_location: userLocation } : {}),
      },
    ],
  };

  const data = await postJson(
    'perplexity',
    'https://api.perplexity.ai/v1/agent',
    { Authorization: `Bearer ${opts.apiKey}` },
    body,
    opts.timeoutMs,
  );

  if (data?.error) {
    throw new ProviderError('perplexity', data.error?.message ?? JSON.stringify(data.error).slice(0, 300));
  }

  // output[] : { type: "search_results", results: [{ url, title, ... }] } puis
  //            { type: "message", content: [{ type: "output_text", text, annotations: [...] }] }
  const texts: string[] = [];
  const cited: string[] = [];
  const searched: string[] = [];
  for (const item of data?.output ?? []) {
    if (item?.type === 'search_results') {
      for (const r of item.results ?? []) searched.push(r?.url);
    } else if (item?.type === 'message') {
      for (const c of item.content ?? []) {
        if (c?.type === 'output_text' && typeof c.text === 'string') {
          texts.push(c.text);
          for (const a of c.annotations ?? []) cited.push(a?.url);
        }
      }
    }
  }
  // Compatibilité avec l'ancien format Sonar (choices + citations), au cas où.
  if (!texts.length && data?.choices?.[0]?.message?.content) {
    texts.push(data.choices[0].message.content);
    cited.push(...(data.citations ?? []), ...((data.search_results ?? []).map((r: any) => r?.url)));
  }
  const text = texts.join('\n').trim();
  if (!text) throw new ProviderError('perplexity', `réponse vide (status=${data?.status ?? '?'})`);
  // Les annotations sont parfois vides : on se rabat alors sur les sources consultées.
  const citations = uniqueUrls(cited.length ? cited : searched);
  return { text, citations };
}

/* ------------------------------------------------------------------ */
/* 3. Google Gemini : Interactions API + outil google_search          */
/* ------------------------------------------------------------------ */
/**
 * Modèle par défaut : gemini-3.5-flash-lite (0,30 $ / 2,50 $), recommandé par Google pour les nouveaux projets.
 * Ancrage : pour Gemini 3 et suivants, facturation PAR REQUÊTE DE RECHERCHE exécutée par le modèle,
 * 5 000 gratuites par mois (partagées entre modèles 3.x) puis 14 $ / 1 000. Pas d'ancrage sur le tier gratuit.
 * L'Interactions API n'a pas de paramètre de localisation documenté : on ajoute donc le contexte
 * géographique dans le prompt (les requêtes AuditIA contiennent déjà la ville).
 * CGU : interdiction d'« analyze / resell » les Grounded Results et obligation d'afficher les
 * Search Suggestions. Voir docs/04-api-ia.md §5, BLOQUANT à trancher avant la production.
 */
export async function askGemini(query: string, opts: AskOpts): Promise<AskResult> {
  assertKey('gemini', opts.apiKey);
  const where = [opts.city, opts.country].filter(Boolean).join(', ');
  const input = where ? `${query}\n\n(Contexte : l'utilisateur se trouve à ${where}.)` : query;

  const body = {
    model: env('GEMINI_MODEL') ?? 'gemini-3.5-flash-lite',
    input,
    tools: [{ type: 'google_search' }],
  };

  const data = await postJson(
    'gemini',
    'https://generativelanguage.googleapis.com/v1beta/interactions',
    { 'x-goog-api-key': opts.apiKey, 'Api-Revision': '2026-05-20' },
    body,
    opts.timeoutMs,
  );

  if (data?.error) throw new ProviderError('gemini', data.error.message ?? 'erreur inconnue', data.error.code);

  // steps[] : thought, google_search_call, google_search_result, model_output.
  // model_output.content[] : { type: "text", text, annotations: [{ type: "url_citation", url, title, start_index, end_index }] }
  const texts: string[] = [];
  const urls: string[] = [];
  for (const step of data?.steps ?? []) {
    if (step?.type !== 'model_output') continue;
    for (const c of step.content ?? []) {
      if (c?.type === 'text' && typeof c.text === 'string') {
        texts.push(c.text);
        for (const a of c.annotations ?? []) if (a?.type === 'url_citation') urls.push(a.url);
      }
    }
  }
  // Repli : ancien format generateContent (candidates[].groundingMetadata.groundingChunks[].web.uri).
  if (!texts.length && data?.candidates?.length) {
    const cand = data.candidates[0];
    for (const p of cand?.content?.parts ?? []) if (typeof p.text === 'string') texts.push(p.text);
    for (const ch of cand?.groundingMetadata?.groundingChunks ?? []) urls.push(ch?.web?.uri);
  }
  const text = texts.join('\n').trim();
  if (!text) throw new ProviderError('gemini', 'réponse vide (blocage sécurité ou format inattendu)');
  return { text, citations: uniqueUrls(urls) };
}

/* ------------------------------------------------------------------ */
/* 4. Anthropic Claude : Messages API + outil web_search              */
/* ------------------------------------------------------------------ */
/**
 * Modèle par défaut : claude-haiku-5-5 (0,10 $ / 0,50 $ par million de tokens pour les prompts de 100 000 tokens ou moins).
 * Recherche web : 10 $ / 1 000 recherches ; les résultats comptent comme tokens d'entrée.
 * On utilise web_search_20250305 (version de base, appel direct). Les versions 20260209 et suivantes
 * passent par défaut par l'exécution de code (allowed_callers) : plus de tokens, inutile ici.
 * L'identifiant "claude-haiku-5-5" vient de la grille Perplexity ; la page de prix Anthropic ne donne
 * que le nom commercial [NON VÉRIFIÉ en direct].
 */
export async function askClaude(query: string, opts: AskOpts): Promise<AskResult> {
  assertKey('anthropic', opts.apiKey);
  const country = toIsoCountry(opts.country);
  const userLocation: Record<string, string> = { type: 'approximate' };
  if (opts.city) userLocation.city = opts.city;
  if (country) userLocation.country = country;
  if (country === 'FR') userLocation.timezone = 'Europe/Paris';

  const tools = [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 3, // plafond de coût : au plus 3 × 0,01 $ par question
      ...(Object.keys(userLocation).length > 1 ? { user_location: userLocation } : {}),
    },
  ];
  const headers = {
    'x-api-key': opts.apiKey,
    'anthropic-version': '2023-06-01',
  };
  const messages: any[] = [{ role: 'user', content: query }];
  const allBlocks: any[] = [];

  // stop_reason "pause_turn" : la doc demande de renvoyer le tour en pause pour continuer (2 relances au plus).
  for (let i = 0; i < 3; i++) {
    const data = await postJson(
      'anthropic',
      'https://api.anthropic.com/v1/messages',
      headers,
      { model: env('ANTHROPIC_MODEL') ?? 'claude-haiku-5-5', max_tokens: 1500, messages, tools },
      opts.timeoutMs,
    );
    if (data?.type === 'error') throw new ProviderError('anthropic', data.error?.message ?? 'erreur inconnue');
    allBlocks.push(...(data?.content ?? []));
    if (data?.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: data.content });
  }

  // content[] : server_tool_use, web_search_tool_result, puis des blocs
  //   { type: "text", text, citations: [{ type: "web_search_result_location", url, title, cited_text }] }
  const texts: string[] = [];
  const cited: string[] = [];
  const searched: string[] = [];
  for (const b of allBlocks) {
    if (b?.type === 'text' && typeof b.text === 'string') {
      texts.push(b.text);
      for (const c of b.citations ?? []) if (c?.url) cited.push(c.url);
    } else if (b?.type === 'web_search_tool_result') {
      if (Array.isArray(b.content)) {
        for (const r of b.content) if (r?.type === 'web_search_result') searched.push(r.url);
      } else if (b.content?.type === 'web_search_tool_result_error') {
        // Erreur de recherche renvoyée avec un HTTP 200 (codes : too_many_requests, unavailable, ...)
        if (!texts.length && allBlocks.every((x) => x?.type !== 'text')) {
          throw new ProviderError('anthropic', `recherche web : ${b.content.error_code}`, 200, true);
        }
      }
    }
  }
  const text = texts.join('').trim();
  if (!text) throw new ProviderError('anthropic', 'réponse vide');
  return { text, citations: uniqueUrls(cited.length ? cited : searched) };
}
