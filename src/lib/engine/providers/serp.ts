/**
 * IA sans API grand public, mesurées sur la page de résultats telle qu'elle s'affiche en France, via DataForSEO
 * (déjà intégré pour les positions : mêmes identifiants DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD). Vérifié le
 * 22 nov. 2026 sur docs.dataforseo.com et dataforseo.com/pricing :
 *
 * | IA                  | Endpoint (Live, Advanced)              | Élément lu        | Coût par relevé                       |
 * |---------------------|----------------------------------------|-------------------|---------------------------------------|
 * | Google AI Overviews | /serp/google/organic/live/advanced     | item `ai_overview`| 0,002 $ + 0,002 $ (load_async_ai_overview, remboursé si absent) |
 * | Google AI Mode      | /serp/google/ai_mode/live/advanced     | item `ai_overview`| 0,004 $                               |
 * | Copilot (Bing)      | /serp/bing/organic/live/advanced       | item `ai_overview`| 0,002 $                               |
 *
 * L'élément `ai_overview` contient `markdown`, `items[]` (`ai_overview_element` : title, text, markdown,
 * references[]) et `references[]` (source, domain, url, title, text). Pas d'élément = Google (ou Bing) n'a pas affiché
 * de réponse IA pour cette recherche : `absent: true` (mesure valide, comptée à part, jamais comme un oubli).
 * Activation explicite : AUDIT_SERP_ENGINES=google_aio,google_ai_mode,copilot (+ identifiants DataForSEO).
 * Coûts comptés dans `details.estimatedCostEur` de l'audit (compteur OPS « Audits (IA) »), pas dans le plafond
 * mensuel SEO-DATA du compte (pas de double compte).
 */
import type { ExtendedProviderId, RawSource } from '../types';
import { env } from '../util';
import {
  type AskContext,
  type AskResult,
  type EngineProvider,
  type Json,
  ProviderError,
  USD_TO_EUR,
  engineEndpoints,
  postJson,
  toIsoCountry,
  uniqueSources,
  uniqueUrls,
} from './http';
import { serpDevice } from './methods';

export type SerpEngineId = Extract<ExtendedProviderId, 'google_aio' | 'google_ai_mode' | 'copilot'>;
export const SERP_ENGINES: SerpEngineId[] = ['google_aio', 'google_ai_mode', 'copilot'];

/** Coût pire cas d'un relevé, en dollars (tarifs Live DataForSEO). */
export const SERP_COST_USD: Record<SerpEngineId, number> = { google_aio: 0.004, google_ai_mode: 0.004, copilot: 0.002 };

/** Codes de lieu DataForSEO (pays) ; France par défaut. */
const LOCATION_CODES: Record<string, number> = { FR: 2250, BE: 2056, CH: 2756, LU: 2442, CA: 2124, MC: 2492 };

const ALIASES: Record<string, SerpEngineId> = {
  google_aio: 'google_aio', aio: 'google_aio', ai_overviews: 'google_aio', 'ai-overviews': 'google_aio', apercus: 'google_aio',
  google_ai_mode: 'google_ai_mode', ai_mode: 'google_ai_mode', 'ai-mode': 'google_ai_mode', aimode: 'google_ai_mode',
  copilot: 'copilot', bing: 'copilot', bing_copilot: 'copilot',
};

export function dataForSeoCreds(): { login: string; password: string } | null {
  const login = env('DATAFORSEO_LOGIN');
  const password = env('DATAFORSEO_PASSWORD');
  return login && password ? { login, password } : null;
}

/** IA de SERP activées (AUDIT_SERP_ENGINES), qu'elles aient ou non des identifiants. */
export function enabledSerpEngines(): SerpEngineId[] {
  const raw = (env('AUDIT_SERP_ENGINES') || '').trim().toLowerCase();
  if (!raw) return [];
  if (raw === 'all' || raw === 'tous' || raw === '1' || raw === 'on') return [...SERP_ENGINES];
  const ids = raw.split(/[\s,;]+/).map((s) => ALIASES[s]).filter((x): x is SerpEngineId => !!x);
  return SERP_ENGINES.filter((e) => ids.includes(e));
}

function cleanMarkdown(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\((?:https?:)?[^)]*\)/g, '$1')
    .replace(/\[\d+(?:,\s*\d+)*\]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function refsOf(x: Json): RawSource[] {
  return (Array.isArray(x?.references) ? x.references : [])
    .filter((r: Json) => typeof r?.url === 'string')
    .map((r: Json) => ({
      url: r.url as string,
      title: typeof r.title === 'string' ? r.title : typeof r.source === 'string' ? r.source : undefined,
      snippet: typeof r.text === 'string' ? r.text.slice(0, 300) : undefined,
      kind: 'cited' as const,
    }));
}

/** Éléments `ai_overview` d'un résultat (au premier niveau ou dans le panneau de connaissances). */
function aiOverviewItems(result: Json): Json[] {
  const out: Json[] = [];
  for (const it of Array.isArray(result?.items) ? result.items : []) {
    if (it?.type === 'ai_overview') out.push(it);
    else if (it?.type === 'knowledge_graph') {
      for (const k of Array.isArray(it.items) ? it.items : []) if (k?.type === 'knowledge_graph_ai_overview_item') out.push(k);
    }
  }
  return out;
}

/** Lit la réponse IA d'un résultat DataForSEO (organique Google / Bing, ou AI Mode). */
export function parseSerpAi(result: Json): AskResult {
  const blocks = aiOverviewItems(result);
  if (!blocks.length) return { text: '', citations: [], absent: true };
  let text = '';
  const raw: RawSource[] = [];
  for (const b of blocks) {
    const elements: Json[] = (Array.isArray(b.items) ? b.items : []).filter((e: Json) => e && (typeof e.text === 'string' || typeof e.markdown === 'string'));
    if (elements.length) {
      for (const e of elements) {
        const body = cleanMarkdown(typeof e.markdown === 'string' && e.markdown.trim() ? e.markdown : String(e.text ?? ''));
        const title = typeof e.title === 'string' && e.title.trim() && !body.startsWith(e.title.trim()) ? `${e.title.trim()}\n` : '';
        const chunk = `${title}${body}`.trim();
        if (!chunk) continue;
        if (text) text += '\n\n';
        const start = text.length;
        text += chunk;
        for (const r of refsOf(e)) raw.push({ ...r, startIndex: start });
      }
    } else if (typeof b.markdown === 'string' || typeof b.text === 'string') {
      const chunk = cleanMarkdown(String(b.markdown ?? b.text));
      if (chunk) text += (text ? '\n\n' : '') + chunk;
    }
    raw.push(...refsOf(b));
  }
  text = text.trim();
  if (!text) return { text: '', citations: [], absent: true };
  return { text, citations: uniqueUrls(raw.map((r) => r.url)), sources: uniqueSources(raw) };
}

const PATHS: Record<SerpEngineId, string> = {
  google_aio: '/serp/google/organic/live/advanced',
  google_ai_mode: '/serp/google/ai_mode/live/advanced',
  copilot: '/serp/bing/organic/live/advanced',
};

export function serpTaskFor(id: SerpEngineId, query: string, ctx: Pick<AskContext, 'country' | 'language'>): Record<string, unknown> {
  const location_code = LOCATION_CODES[toIsoCountry(ctx.country ?? 'FR') ?? 'FR'] ?? LOCATION_CODES.FR;
  const base = { keyword: query.slice(0, 700), location_code, language_code: ctx.language || 'fr' };
  if (id === 'google_aio') return { ...base, device: serpDevice(), depth: 10, load_async_ai_overview: true };
  if (id === 'copilot') return { ...base, device: 'desktop', depth: 10 };
  return base;
}

const OK = new Set([20000, 20100]);

export function createSerpProvider(id: SerpEngineId): EngineProvider | null {
  const creds = dataForSeoCreds();
  if (!creds || !enabledSerpEngines().includes(id)) return null;
  const auth = `Basic ${Buffer.from(`${creds.login}:${creds.password}`).toString('base64')}`;
  return {
    id,
    model: id === 'copilot' ? 'bing-serp-fr' : id === 'google_ai_mode' ? 'google-ai-mode-fr' : `google-serp-fr-${serpDevice()}`,
    demo: false,
    costPerCallEur: SERP_COST_USD[id] * USD_TO_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const data = await postJson('dataforseo', `${engineEndpoints().dataforseo}${PATHS[id]}`, { Authorization: auth }, [serpTaskFor(id, query, ctx)]);
      const top = Number(data?.status_code);
      if (Number.isFinite(top) && !OK.has(top)) throw new ProviderError('dataforseo', `${data?.status_message ?? 'erreur'} (code ${top})`, undefined, top >= 50000);
      const task = data?.tasks?.[0];
      if (!task) throw new ProviderError('dataforseo', 'réponse vide');
      const code = Number(task.status_code);
      // 40102 « No Search Results » : aucune page relevée, donc aucune réponse IA affichée.
      if (code === 40102) return { text: '', citations: [], absent: true };
      if (Number.isFinite(code) && !OK.has(code)) throw new ProviderError('dataforseo', `${task.status_message ?? 'erreur'} (code ${code})`, undefined, code >= 50000 || code === 40202);
      const result = Array.isArray(task.result) ? task.result[0] : null;
      if (!result) return { text: '', citations: [], absent: true };
      return parseSerpAi(result);
    },
  };
}
