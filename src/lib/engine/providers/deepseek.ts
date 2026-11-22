/**
 * DeepSeek via l'API officielle (Chat Completions, `POST https://api.deepseek.com/chat/completions`) et l'outil
 * intégré `deepseek_web_search` (vérifié le 22 nov. 2026 sur api-docs.deepseek.com/guides/web_tools) :
 * - modèle `deepseek-flash` (recommandé par la doc pour les outils web ; DEEPSEEK_MODEL pour changer) ;
 * - réflexion désactivée = « recherche standard avec citations » ;
 * - citations dans `message.annotations[]` (`type: 'url_citation'`, objet `url_citation` : url, title, start_index,
 *   end_index en points de code), recherches dans `server_tool_calls[].calls[].sources[]` ;
 * - `user_location`, `allowed_domains` non pris en charge (erreur 400) : la ville reste dans la question.
 * Coût (api-docs.deepseek.com/quick_start/pricing) : depuis le 18 nov. 2026 les recherches ne sont plus facturées à
 * part, leurs résultats comptent en jetons d'entrée. deepseek-flash : 0,30 $ / M en entrée (heure pleine, sans
 * cache), 1,20 $ / M en sortie. Pire cas ≈ 20 000 jetons d'entrée + 1 500 de sortie ≈ 0,008 $ ; on compte 0,01 $.
 */
import type { RawSource } from '../types';
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
  uniqueSources,
  uniqueUrls,
} from './http';

export const DEEPSEEK_COST_PER_CALL_EUR = 0.01 * USD_TO_EUR;

export function deepseekModel(): string {
  return env('DEEPSEEK_MODEL') || 'deepseek-flash';
}

export function frenchUserInstructions(ctx: Pick<AskContext, 'city' | 'country'>): string {
  const where = [ctx.city, !ctx.country || ctx.country === 'FR' ? 'France' : ctx.country].filter(Boolean).join(', ');
  return `Réponds en français à un utilisateur situé à ${where}. Utilise la recherche web pour des recommandations à jour et cite tes sources.`;
}

/** Index en points de code → index en unités UTF-16 (les positions DeepSeek comptent les points de code). */
function cpToUtf16(text: string, cp: number): number {
  let i = 0;
  let n = 0;
  while (i < text.length && n < cp) {
    const c = text.codePointAt(i)!;
    i += c > 0xffff ? 2 : 1;
    n++;
  }
  return i;
}

export function parseDeepseek(data: Json): AskResult {
  const msg = data?.choices?.[0]?.message ?? {};
  let text = typeof msg.content === 'string' ? msg.content : Array.isArray(msg.content) ? msg.content.map((c: Json) => (typeof c?.text === 'string' ? c.text : '')).join('') : '';
  const raw: RawSource[] = [];
  for (const a of Array.isArray(msg.annotations) ? msg.annotations : []) {
    if (a?.type !== 'url_citation') continue;
    const u = a.url_citation ?? a;
    if (typeof u?.url !== 'string') continue;
    const title = typeof u.title === 'string' && u.title !== u.url ? u.title : undefined;
    raw.push({ url: u.url, title, kind: 'cited', startIndex: typeof u.start_index === 'number' ? cpToUtf16(text, u.start_index) : undefined });
  }
  raw.sort((x, y) => (x.startIndex ?? 1e9) - (y.startIndex ?? 1e9));
  const retrieved: RawSource[] = [];
  const steps = Array.isArray(data?.server_tool_calls) ? data.server_tool_calls : Array.isArray(msg.server_tool_calls) ? msg.server_tool_calls : [];
  for (const step of steps) {
    for (const call of Array.isArray(step?.calls) ? step.calls : []) {
      for (const s of Array.isArray(call?.sources) ? call.sources : []) {
        if (typeof s?.url === 'string') retrieved.push({ url: s.url, title: typeof s.title === 'string' ? s.title : undefined, snippet: typeof s.snippet === 'string' ? s.snippet : undefined, kind: 'retrieved' });
      }
    }
  }
  const lead = text.length - text.trimStart().length;
  text = text.trim();
  for (const r of raw) if (r.startIndex != null) r.startIndex = Math.max(0, Math.min(text.length, r.startIndex - lead));
  const cited = uniqueUrls(raw.map((r) => r.url));
  return {
    text,
    citations: cited.length ? cited : uniqueUrls(retrieved.map((r) => r.url)),
    sources: uniqueSources(raw.length ? [...raw, ...retrieved] : retrieved.map((r) => ({ ...r, kind: 'cited' as const }))),
  };
}

export function createDeepseekProvider(): EngineProvider | null {
  const apiKey = env('DEEPSEEK_API_KEY');
  if (!apiKey) return null;
  const model = deepseekModel();
  return {
    id: 'deepseek',
    model,
    demo: false,
    costPerCallEur: DEEPSEEK_COST_PER_CALL_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const data = await postJson('deepseek', `${engineEndpoints().deepseek}/chat/completions`, { Authorization: `Bearer ${apiKey}` }, {
        model,
        messages: [
          { role: 'system', content: frenchUserInstructions(ctx) },
          { role: 'user', content: query },
        ],
        tools: [{ type: 'deepseek_web_search' }],
        thinking: { type: 'disabled' },
        stream: false,
        max_tokens: 1500,
      });
      if (data?.error) throw new ProviderError('deepseek', data.error?.message ?? JSON.stringify(data.error).slice(0, 300));
      const r = parseDeepseek(data);
      if (!r.text) throw new ProviderError('deepseek', 'réponse vide');
      return r;
    },
  };
}
