/**
 * Appel LLM du copilote : Anthropic (ANTHROPIC_API_KEY, modèle ANTHROPIC_MODEL_COPILOT) en priorité, sinon OpenAI
 * (OPENAI_API_KEY, modèle OPENAI_MODEL_COPILOT). Streaming SSE converti en flux de texte. Sans clé : null (mode démo).
 */
export type LlmMessage = { role: 'user' | 'assistant'; content: string };

export interface LlmConfig {
  provider: 'anthropic' | 'openai';
  model: string;
  apiKey: string;
  /** € par million de jetons (estimation de coût, réglable par env) */
  priceIn: number;
  priceOut: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

const MAX_TOKENS = 1800;

export function copilotLlmConfig(): LlmConfig | null {
  const priceIn = Number(process.env.COPILOT_PRICE_IN_EUR_PER_MTOK || 3);
  const priceOut = Number(process.env.COPILOT_PRICE_OUT_EUR_PER_MTOK || 15);
  if (process.env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL_COPILOT || process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5',
      priceIn,
      priceOut,
    };
  }
  if (process.env.OPENAI_API_KEY) {
    return {
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL_COPILOT || process.env.OPENAI_MODEL || 'gpt-5.6-luna',
      priceIn,
      priceOut,
    };
  }
  return null;
}

export function estimateCostEur(cfg: LlmConfig, u: LlmUsage): number {
  return (u.inputTokens * cfg.priceIn + u.outputTokens * cfg.priceOut) / 1_000_000;
}

/** Estimation prudente avant appel (≈ 4 caractères par jeton, sortie maximale). */
export function worstCaseCostEur(cfg: LlmConfig, inputChars: number): number {
  return estimateCostEur(cfg, { inputTokens: Math.ceil(inputChars / 3.5), outputTokens: MAX_TOKENS });
}

async function* sseEvents(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
    }
  }
  if (buf.trim().startsWith('data:')) yield buf.trim().slice(5).trim();
}

/**
 * Flux de texte. `usage` est rempli à la fin du flux.
 * @throws Error si l'API répond en erreur (message sans secret)
 */
export async function* streamLlm(
  cfg: LlmConfig,
  system: string,
  messages: LlmMessage[],
  usage: LlmUsage,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  if (cfg.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: MAX_TOKENS, system, messages, stream: true }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    for await (const data of sseEvents(res)) {
      let ev: { type?: string; delta?: { type?: string; text?: string }; message?: { usage?: { input_tokens?: number } }; usage?: { output_tokens?: number }; error?: { message?: string } };
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      if (ev.type === 'message_start') usage.inputTokens = ev.message?.usage?.input_tokens ?? 0;
      else if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) yield ev.delta.text;
      else if (ev.type === 'message_delta') usage.outputTokens = ev.usage?.output_tokens ?? usage.outputTokens;
      else if (ev.type === 'error') throw new Error(`Anthropic : ${ev.error?.message ?? 'erreur'}`);
    }
    return;
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  for await (const data of sseEvents(res)) {
    if (data === '[DONE]') break;
    let ev: { choices?: { delta?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
    try {
      ev = JSON.parse(data);
    } catch {
      continue;
    }
    const t = ev.choices?.[0]?.delta?.content;
    if (t) yield t;
    if (ev.usage) {
      usage.inputTokens = ev.usage.prompt_tokens ?? 0;
      usage.outputTokens = ev.usage.completion_tokens ?? 0;
    }
  }
}

// ---------------------------------------------------------------------------
// V3 : appels d'outils (non diffusés), Anthropic ou OpenAI
// ---------------------------------------------------------------------------

export interface ToolSpec {
  name: string;
  description: string;
  parameters: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export interface ToolCallReq {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolTurn {
  text: string;
  calls: ToolCallReq[];
  usage: LlmUsage;
  /** message de l'assistant, au format du fournisseur (à renvoyer tel quel) */
  assistant: unknown;
}

/** Transcription au format du fournisseur (messages Anthropic, ou messages OpenAI sans le système). */
export type Transcript = unknown[];

export const TOOL_TURN_MAX_TOKENS = 1500;

export function initialTranscript(messages: LlmMessage[]): Transcript {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function parseArgs(s: unknown): Record<string, unknown> {
  if (s && typeof s === 'object' && !Array.isArray(s)) return s as Record<string, unknown>;
  if (typeof s !== 'string') return {};
  try {
    const v = JSON.parse(s) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Un tour de la boucle : le modèle répond par du texte et/ou des appels d'outils.
 * `allowTools: false` force une réponse finale (dernier tour).
 * @throws Error si l'API répond en erreur (message sans secret)
 */
export async function callWithTools(
  cfg: LlmConfig,
  system: string,
  transcript: Transcript,
  tools: ToolSpec[],
  opts: { allowTools: boolean; signal?: AbortSignal; fetchImpl?: typeof fetch } = { allowTools: true },
): Promise<ToolTurn> {
  const f = opts.fetchImpl ?? fetch;
  if (cfg.provider === 'anthropic') {
    const res = await f('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: opts.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: TOOL_TURN_MAX_TOKENS,
        system,
        messages: transcript,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
        tool_choice: opts.allowTools ? { type: 'auto' } : { type: 'none' },
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const j = (await res.json()) as { content?: { type: string; text?: string; id?: string; name?: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const content = j.content ?? [];
    return {
      text: content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join(''),
      calls: opts.allowTools ? content.filter((b) => b.type === 'tool_use').map((b) => ({ id: String(b.id), name: String(b.name), args: parseArgs(b.input) })) : [],
      usage: { inputTokens: j.usage?.input_tokens ?? 0, outputTokens: j.usage?.output_tokens ?? 0 },
      assistant: { role: 'assistant', content },
    };
  }
  const res = await f('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: opts.signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({
      model: cfg.model,
      max_completion_tokens: TOOL_TURN_MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...transcript],
      tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
      tool_choice: opts.allowTools ? 'auto' : 'none',
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const j = (await res.json()) as {
    choices?: { message?: { content?: string | null; tool_calls?: { id: string; function?: { name?: string; arguments?: string } }[] } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const msg = j.choices?.[0]?.message ?? {};
  return {
    text: msg.content ?? '',
    calls: opts.allowTools ? (msg.tool_calls ?? []).map((c) => ({ id: c.id, name: String(c.function?.name), args: parseArgs(c.function?.arguments) })) : [],
    usage: { inputTokens: j.usage?.prompt_tokens ?? 0, outputTokens: j.usage?.completion_tokens ?? 0 },
    assistant: { role: 'assistant', content: msg.content ?? null, ...(msg.tool_calls?.length ? { tool_calls: msg.tool_calls } : {}) },
  };
}

/** Ajoute le tour de l'assistant et les résultats d'outils à la transcription. */
export function appendToolResults(cfg: LlmConfig, transcript: Transcript, turn: ToolTurn, results: { id: string; content: string }[]): Transcript {
  if (cfg.provider === 'anthropic') {
    return [...transcript, turn.assistant, { role: 'user', content: results.map((r) => ({ type: 'tool_result', tool_use_id: r.id, content: r.content })) }];
  }
  return [...transcript, turn.assistant, ...results.map((r) => ({ role: 'tool', tool_call_id: r.id, content: r.content }))];
}

/** Coût prudent d'un tour (entrée estimée, sortie maximale). */
export function worstCaseTurnEur(cfg: LlmConfig, inputChars: number): number {
  return estimateCostEur(cfg, { inputTokens: Math.ceil(inputChars / 3.5), outputTokens: TOOL_TURN_MAX_TOKENS });
}
