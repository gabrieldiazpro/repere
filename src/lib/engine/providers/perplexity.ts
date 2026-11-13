/** Perplexity via l'Agent API (/v1/agent), modèle perplexity/sonar (docs/04-api-ia.md § 2). */
import { env } from '../util';
import {
  type AskContext,
  type AskResult,
  type EngineProvider,
  ProviderError,
  USD_TO_EUR,
  postJson,
  toIsoCountry,
  uniqueSources,
  uniqueUrls,
} from './http';
import type { RawSource } from '../types';

/**
 * Retire les marqueurs [n] / [web:n] en notant, pour chaque numéro, la position (dans le texte nettoyé)
 * de sa première apparition (docs/v2/03-sources.md § 3.3 : lire AVANT de nettoyer).
 */
export function stripMarkers(raw: string): { text: string; firstPos: Map<number, number>; order: number[] } {
  const firstPos = new Map<number, number>();
  const order: number[] = [];
  let removed = 0;
  const text = raw.replace(/\[(?:web:)?(\d+)\]/g, (m, n: string, idx: number) => {
    const k = Number(n);
    if (!firstPos.has(k)) {
      firstPos.set(k, Math.max(0, idx - removed));
      order.push(k);
    }
    removed += m.length;
    return '';
  });
  return { text, firstPos, order };
}

export function perplexityModel(): string {
  return env('PERPLEXITY_MODEL') || 'perplexity/sonar';
}

export function createPerplexityProvider(): EngineProvider | null {
  const apiKey = env('PERPLEXITY_API_KEY');
  if (!apiKey) return null;
  const model = perplexityModel();
  return {
    id: 'perplexity',
    model,
    demo: false,
    costPerCallEur: 0.007 * USD_TO_EUR,
    async ask(query: string, ctx: AskContext): Promise<AskResult> {
      const country = toIsoCountry(ctx.country ?? 'FR');
      const loc: Record<string, string> = {};
      if (country) loc.country = country;
      if (ctx.city) loc.city = ctx.city;
      const data = await postJson('perplexity', 'https://api.perplexity.ai/v1/agent', { Authorization: `Bearer ${apiKey}` }, {
        model,
        input: query,
        tools: [{ type: 'web_search', ...(Object.keys(loc).length ? { user_location: loc } : {}) }],
      });
      if (data?.error) {
        throw new ProviderError('perplexity', data.error?.message ?? JSON.stringify(data.error).slice(0, 300));
      }
      const texts: string[] = [];
      const cited: unknown[] = [];
      const searched: unknown[] = [];
      const results: { id?: number; url?: string; title?: string; snippet?: string }[] = [];
      const annotations: { url?: string; title?: string }[] = [];
      for (const item of data?.output ?? []) {
        if (item?.type === 'search_results') {
          for (const r of item.results ?? []) {
            searched.push(r?.url);
            results.push({ id: typeof r?.id === 'number' ? r.id : Number(r?.id) || undefined, url: r?.url, title: r?.title, snippet: r?.snippet });
          }
        } else if (item?.type === 'message') {
          for (const c of item.content ?? []) {
            if (c?.type === 'output_text' && typeof c.text === 'string') {
              texts.push(c.text);
              for (const a of c.annotations ?? []) {
                cited.push(a?.url);
                annotations.push({ url: a?.url, title: a?.title });
              }
            }
          }
        }
      }
      // Ancien format Sonar (choices + citations), par sécurité.
      if (!texts.length && data?.choices?.[0]?.message?.content) {
        texts.push(String(data.choices[0].message.content));
        cited.push(...(data.citations ?? []), ...(data.search_results ?? []).map((r: { url?: string }) => r?.url));
        (data.search_results ?? []).forEach((r: { url?: string; title?: string; snippet?: string }, i: number) =>
          results.push({ id: i + 1, url: r?.url, title: r?.title, snippet: r?.snippet }),
        );
      }
      // Marqueurs de citation [1] / [web:1] : positions relevées puis retirés du texte analysé.
      const stripped = stripMarkers(texts.join('\n'));
      const lead = stripped.text.length - stripped.text.trimStart().length;
      const text = stripped.text.trim();
      if (!text) throw new ProviderError('perplexity', `réponse vide (status=${data?.status ?? '?'})`);
      const c = uniqueUrls(cited);
      const byId = new Map<number, (typeof results)[number]>();
      results.forEach((r, i) => byId.set(r.id ?? i + 1, r));
      const raw: RawSource[] = [];
      for (const n of stripped.order) {
        const r = byId.get(n);
        if (r?.url) raw.push({ url: r.url, title: r.title, snippet: r.snippet, kind: 'cited', startIndex: Math.max(0, (stripped.firstPos.get(n) ?? 0) - lead) });
      }
      for (const a of annotations) if (a.url) raw.push({ url: a.url, title: a.title ?? results.find((r) => r.url === a.url)?.title, kind: 'cited' });
      if (!raw.length) for (const u of c) raw.push({ url: u, kind: 'cited', title: results.find((r) => r.url === u)?.title });
      for (const r of results) if (r.url) raw.push({ url: r.url, title: r.title, snippet: r.snippet, kind: c.length || raw.length ? 'retrieved' : 'cited' });
      return { text, citations: c.length ? c : uniqueUrls(searched), sources: uniqueSources(raw) };
    },
  };
}
