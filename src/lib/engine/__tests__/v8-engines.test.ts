/**
 * V8 · nouvelles IA : DeepSeek, Grok (API officielles avec recherche web), aperçus IA et AI Mode de Google, Copilot dans
 * Bing (pages de résultats relevées via DataForSEO). Faux serveurs locaux uniquement (aucun réseau) : réponses
 * « enregistrées » d'après la documentation officielle de chaque API (formes et champs, vérifiés le 22 nov. 2026).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startFakeServer, type FakeServer } from '../../seodata/__tests__/fake-server';
import { createMockAudit, runAudit, selectedProviders, PROVIDER_LABELS, ALL_PROVIDERS, EXTENDED_PROVIDERS, type AuditInput } from '../index';
import {
  configuredExtended,
  createRealProvider,
  enabledSerpEngines,
  methodNote,
  parseDeepseek,
  parseGrok,
  parseSerpAi,
  providerMethod,
  setEngineEndpoints,
} from '../providers';
import { detectMention } from '../detect';

const KEYS = [
  'OPENAI_API_KEY', 'PERPLEXITY_API_KEY', 'GEMINI_API_KEY', 'ANTHROPIC_API_KEY', 'MISTRAL_API_KEY', 'DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL',
  'XAI_API_KEY', 'XAI_MODEL', 'DATAFORSEO_LOGIN', 'DATAFORSEO_PASSWORD', 'AUDIT_SERP_ENGINES', 'AUDIT_SERP_DEVICE', 'AUDIT_PROVIDERS', 'AUDIT_EXTRACTOR', 'AUDIT_RETRIES', 'AUDIT_PAID_EXTRA_ENGINES',
];
const saved: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const k of KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.AUDIT_RETRIES = '0';
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

let srv: FakeServer;
beforeAll(async () => {
  srv = await startFakeServer();
  setEngineEndpoints({ deepseek: srv.url, xai: `${srv.url}/v1`, dataforseo: `${srv.url}/v3` });
});
afterAll(async () => {
  setEngineEndpoints(null);
  await srv.close();
});

const input: AuditInput = { businessName: 'Plomberie Martin', trade: 'plombier', city: 'Paris', district: '11e', website: 'plomberie-martin.example' };

/** Réponse Chat Completions DeepSeek avec deepseek_web_search (api-docs.deepseek.com/guides/web_tools). */
function deepseekReply(text: string) {
  return {
    id: 'x',
    object: 'chat.completion',
    model: 'deepseek-flash',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: `\n${text}`,
          annotations: [
            { type: 'url_citation', url_citation: { url: 'https://www.pagesjaunes.fr/plombiers-paris?utm_source=x', title: 'Plombiers à Paris', start_index: 1, end_index: 20 } },
            { type: 'url_citation', url_citation: { url: 'https://plomberie-martin.example/', title: 'https://plomberie-martin.example/', start_index: 30, end_index: 40 } },
          ],
        },
      },
    ],
    server_tool_calls: [{ index: 0, reasoning_content: '', calls: [{ index: 0, id: 'c1', type: 'deepseek_web_search', status: 'success', sources: [{ url: 'https://www.travaux.com/plombier', title: 'Travaux.com' }] }] }],
    usage: { prompt_tokens: 9000, completion_tokens: 400, server_tool_use: { web_search_requests: 1 } },
  };
}

/** Résultat DataForSEO avec un élément ai_overview (docs.dataforseo.com, Google Organic / AI Mode / Bing Advanced). */
function dfsResult(withAi: boolean, type = 'organic') {
  const items: unknown[] = [{ type: 'organic', rank_group: 1, url: 'https://www.pagesjaunes.fr/', title: 'PagesJaunes' }];
  if (withAi)
    items.unshift({
      type: 'ai_overview',
      asynchronous_ai_overview: true,
      markdown: 'ignoré quand les éléments sont présents',
      items: [
        {
          type: 'ai_overview_element',
          title: 'Plombiers bien notés à Paris 11e',
          markdown: 'Parmi les plombiers bien notés, **Plomberie Martin** et Allo Plombier 11 reviennent souvent [1](https://plomberie-martin.example/).',
          references: [{ source: 'Plomberie Martin', domain: 'plomberie-martin.example', url: 'https://plomberie-martin.example/', title: 'Plomberie Martin', text: 'Devis gratuit' }],
        },
      ],
      references: [{ source: 'PagesJaunes', domain: 'pagesjaunes.fr', url: 'https://www.pagesjaunes.fr/', title: 'PagesJaunes', text: 'Annuaire' }],
    });
  return { status_code: 20000, status_message: 'Ok.', cost: 0.004, tasks: [{ status_code: 20000, status_message: 'Ok.', cost: 0.004, result: [{ keyword: 'k', type, items, item_types: items.map((i) => (i as { type: string }).type) }] }] };
}

describe('V8 · configuration : chaque IA derrière sa variable, désactivée sinon', () => {
  it('sans clé : aucune IA en option, ni en gratuit ni en payant', () => {
    for (const id of EXTENDED_PROVIDERS) expect(createRealProvider(id)).toBeNull();
    expect(configuredExtended()).toEqual([]);
    expect(selectedProviders('paid')).toEqual(['chatgpt', 'perplexity', 'gemini', 'claude']);
  });
  it('pages de résultats : identifiants DataForSEO ET activation explicite', () => {
    process.env.AUDIT_SERP_ENGINES = 'aio,ai_mode,bing';
    expect(enabledSerpEngines()).toEqual(['google_aio', 'google_ai_mode', 'copilot']);
    expect(createRealProvider('google_aio')).toBeNull(); // pas d'identifiants
    process.env.DATAFORSEO_LOGIN = 'l';
    process.env.DATAFORSEO_PASSWORD = 'p';
    process.env.AUDIT_SERP_ENGINES = 'google_aio';
    expect(createRealProvider('google_aio')).not.toBeNull();
    expect(createRealProvider('google_ai_mode')).toBeNull();
    process.env.DEEPSEEK_API_KEY = 'k';
    expect(selectedProviders('paid')).toEqual(['chatgpt', 'perplexity', 'gemini', 'claude', 'google_aio', 'deepseek']);
    expect(selectedProviders('free')).toEqual(['chatgpt', 'perplexity', 'gemini']);
  });
  it('coûts déclarés (pire cas, sources dans les en-têtes des fournisseurs)', () => {
    process.env.DEEPSEEK_API_KEY = 'k';
    process.env.XAI_API_KEY = 'k';
    process.env.DATAFORSEO_LOGIN = 'l';
    process.env.DATAFORSEO_PASSWORD = 'p';
    process.env.AUDIT_SERP_ENGINES = 'all';
    const cost = (id: (typeof EXTENDED_PROVIDERS)[number]) => createRealProvider(id)!.costPerCallEur;
    expect(cost('google_aio')).toBeCloseTo(0.004 * 0.92, 6);
    expect(cost('google_ai_mode')).toBeCloseTo(0.004 * 0.92, 6);
    expect(cost('copilot')).toBeCloseTo(0.002 * 0.92, 6);
    expect(cost('deepseek')).toBeCloseTo(0.01 * 0.92, 6);
    expect(cost('grok')).toBeCloseTo(0.035 * 0.92, 6);
  });
  it('libellés en texte (aucun logo), Mistral renommé Vibe', () => {
    expect(PROVIDER_LABELS.mistral).toBe('Mistral Vibe');
    expect(PROVIDER_LABELS.google_aio).toBe('Google AI Overviews');
    expect(PROVIDER_LABELS.copilot).toBe('Copilot (Bing)');
    expect(ALL_PROVIDERS).toHaveLength(10);
  });
});

describe('V8 · DeepSeek (API officielle + deepseek_web_search)', () => {
  it('requête conforme à la doc et lecture des citations', async () => {
    process.env.DEEPSEEK_API_KEY = 'cle-ds';
    srv.on('POST', '/chat/completions', () => ({ json: deepseekReply('Plomberie Martin et Allo Plombier 11 sont bien notés à Paris 11e.') }));
    const p = createRealProvider('deepseek')!;
    expect(p.model).toBe('deepseek-flash');
    const r = await p.ask('Quel plombier à Paris 11e ?', { city: 'Paris', country: 'FR', queryId: 'Q1', run: 1 });
    const req = srv.requests.filter((x) => x.path === '/chat/completions').at(-1)!;
    expect(req.headers.authorization).toBe('Bearer cle-ds');
    const body = req.json as { tools: { type: string }[]; thinking: { type: string }; stream: boolean; messages: { role: string; content: string }[] };
    expect(body.tools).toEqual([{ type: 'deepseek_web_search' }]);
    expect(body.thinking).toEqual({ type: 'disabled' });
    expect(body.stream).toBe(false);
    expect(body.messages[0].content).toMatch(/en français.*Paris, France/);
    expect(r.text.startsWith('Plomberie Martin')).toBe(true);
    expect(r.citations).toEqual(['https://www.pagesjaunes.fr/plombiers-paris', 'https://plomberie-martin.example/']);
    expect(r.sources?.[0]).toMatchObject({ kind: 'cited', startIndex: 0, title: 'Plombiers à Paris' });
    expect(r.sources?.[1].title).toBeUndefined(); // titre = URL quand inconnu (doc)
    expect(r.sources?.some((s) => s.kind === 'retrieved' && s.url.includes('travaux.com'))).toBe(true);
  });
  it('positions en points de code (émoji avant la citation)', () => {
    const r = parseDeepseek({ choices: [{ message: { content: '😀 A. Plomberie Martin', annotations: [{ type: 'url_citation', url_citation: { url: 'https://a.fr/', start_index: 5 } }] } }] });
    expect(r.text.slice(r.sources![0].startIndex!)).toBe('Plomberie Martin');
  });
  it('erreur 401 : erreur explicite, aucune réponse inventée', async () => {
    process.env.DEEPSEEK_API_KEY = 'mauvaise';
    srv.on('POST', '/chat/completions', () => ({ status: 401, json: { error: { message: 'Authentication Fails' } } }));
    await expect(createRealProvider('deepseek')!.ask('q', { queryId: 'Q', run: 1 })).rejects.toThrow(/401.*Authentication/);
  });
});

describe('V8 · Grok (API xAI Responses + web_search)', () => {
  it('requête et citations (annotations url_citation, titre numéroté ignoré)', async () => {
    process.env.XAI_API_KEY = 'cle-x';
    srv.on('POST', '/v1/responses', () => ({
      json: {
        id: 'r',
        status: 'completed',
        output: [
          { type: 'web_search_call', status: 'completed' },
          { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Allo Plombier 11 et Plomberie Martin.', annotations: [{ type: 'url_citation', url: 'https://allo-plombier-11.fr/', start_index: 0, end_index: 16, title: '1' }] }] },
        ],
        citations: ['https://allo-plombier-11.fr/', 'https://www.pagesjaunes.fr/'],
      },
    }));
    const r = await createRealProvider('grok')!.ask('Quel plombier ?', { city: 'Paris', queryId: 'Q', run: 1 });
    const body = srv.requests.filter((x) => x.path === '/v1/responses').at(-1)!.json as { tools: unknown[]; include: string[]; model: string };
    expect(body.tools).toEqual([{ type: 'web_search' }]);
    expect(body.include).toEqual(['no_inline_citations']);
    expect(body.model).toBe('grok-4.3');
    expect(r.citations).toEqual(['https://allo-plombier-11.fr/']);
    expect(r.sources?.[0].title).toBeUndefined();
    expect(r.sources?.find((s) => s.url.includes('pagesjaunes'))?.kind).toBe('retrieved');
  });
  it('sans annotation : les URL consultées servent de sources', () => {
    const r = parseGrok({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Texte.' }] }], citations: ['https://a.fr/'] });
    expect(r.citations).toEqual(['https://a.fr/']);
  });
});

describe('V8 · pages de résultats via DataForSEO (aperçus IA, AI Mode, Copilot)', () => {
  const creds = () => {
    process.env.DATAFORSEO_LOGIN = 'login';
    process.env.DATAFORSEO_PASSWORD = 'secret';
    process.env.AUDIT_SERP_ENGINES = 'all';
  };
  it('aperçu IA Google : France, français, mobile, chargement asynchrone ; texte et références', async () => {
    creds();
    srv.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ json: dfsResult(true) }));
    const r = await createRealProvider('google_aio')!.ask('plombier paris 11e', { country: 'FR', language: 'fr', queryId: 'Q', run: 1 });
    const req = srv.requests.filter((x) => x.path === '/v3/serp/google/organic/live/advanced').at(-1)!;
    expect(req.headers.authorization).toBe(`Basic ${Buffer.from('login:secret').toString('base64')}`);
    expect(req.json).toEqual([{ keyword: 'plombier paris 11e', location_code: 2250, language_code: 'fr', device: 'mobile', depth: 10, load_async_ai_overview: true }]);
    expect(r.absent).toBeUndefined();
    expect(r.text).toMatch(/^Plombiers bien notés à Paris 11e\nParmi les plombiers bien notés, \*\*Plomberie Martin\*\*/);
    expect(r.text).not.toMatch(/\]\(/); // liens markdown retirés
    expect(r.citations).toEqual(['https://plomberie-martin.example/', 'https://www.pagesjaunes.fr/']);
    expect(r.sources?.[0]).toMatchObject({ kind: 'cited', startIndex: 0, snippet: 'Devis gratuit' });
  });
  it('pas d’aperçu IA affiché : mesure « absente », pas une erreur ni un oubli', async () => {
    creds();
    srv.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ json: dfsResult(false) }));
    const r = await createRealProvider('google_aio')!.ask('q', { queryId: 'Q', run: 1 });
    expect(r).toEqual({ text: '', citations: [], absent: true });
    const m = detectMention({ provider: 'google_aio', queryId: 'Q', run: 1, text: '', citations: [], demo: false, absent: true }, input);
    expect(m.noRec).toBe(true);
    expect(m.mentioned).toBe(false);
  });
  it('AI Mode et Copilot (Bing) : endpoints et appareils', async () => {
    creds();
    srv.on('POST', '/v3/serp/google/ai_mode/live/advanced', () => ({ json: dfsResult(true, 'ai_mode') }));
    srv.on('POST', '/v3/serp/bing/organic/live/advanced', () => ({ json: dfsResult(true) }));
    const am = await createRealProvider('google_ai_mode')!.ask('q', { queryId: 'Q', run: 1 });
    const co = await createRealProvider('copilot')!.ask('q', { queryId: 'Q', run: 1 });
    expect(am.text).toMatch(/Plomberie Martin/);
    expect(co.text).toMatch(/Plomberie Martin/);
    expect(srv.requests.filter((x) => x.path === '/v3/serp/google/ai_mode/live/advanced').at(-1)!.json).toEqual([{ keyword: 'q', location_code: 2250, language_code: 'fr' }]);
    expect((srv.requests.filter((x) => x.path === '/v3/serp/bing/organic/live/advanced').at(-1)!.json as { device: string }[])[0].device).toBe('desktop');
  });
  it('codes DataForSEO : 40102 = aucune page (absente), 40100 = erreur d’identifiants', async () => {
    creds();
    srv.on('POST', '/v3/serp/bing/organic/live/advanced', () => ({ json: { status_code: 20000, tasks: [{ status_code: 40102, status_message: 'No Search Results.' }] } }));
    expect((await createRealProvider('copilot')!.ask('q', { queryId: 'Q', run: 1 })).absent).toBe(true);
    srv.on('POST', '/v3/serp/bing/organic/live/advanced', () => ({ json: { status_code: 40100, status_message: 'You are not authorized.' } }));
    await expect(createRealProvider('copilot')!.ask('q', { queryId: 'Q', run: 1 })).rejects.toThrow(/not authorized.*40100/);
  });
  it('aperçu IA dans le panneau de connaissances (knowledge_graph_ai_overview_item)', () => {
    const r = parseSerpAi({ items: [{ type: 'knowledge_graph', items: [{ type: 'knowledge_graph_ai_overview_item', items: [{ type: 'ai_overview_element', text: 'Texte IA.' }] }] }] });
    expect(r.text).toBe('Texte IA.');
  });
  it('méthode affichée honnêtement', () => {
    expect(methodNote('google_aio')).toMatch(/^Mesuré via les résultats Google en France, sur mobile, en français \(relevé DataForSEO\)/);
    process.env.AUDIT_SERP_DEVICE = 'desktop';
    expect(methodNote('google_aio')).toMatch(/sur ordinateur/);
    expect(methodNote('copilot')).toMatch(/résultats Bing.*pas l’application Copilot/);
    expect(methodNote('deepseek', { model: 'deepseek-flash' })).toMatch(/API officielle DeepSeek \(modèle deepseek-flash\), avec recherche web/);
    expect(methodNote('gemini')).toMatch(/sans recherche web/);
    expect(providerMethod('google_ai_mode').via).toBe('serp');
  });
});

describe('V8 · audit réel avec les nouvelles IA (faux serveurs)', () => {
  it('fiche de mesure par IA, absences comptées à part, coûts comptés, IA non configurée retirée', async () => {
    process.env.DEEPSEEK_API_KEY = 'k';
    process.env.DATAFORSEO_LOGIN = 'l';
    process.env.DATAFORSEO_PASSWORD = 'p';
    process.env.AUDIT_SERP_ENGINES = 'google_aio';
    let n = 0;
    srv.on('POST', '/chat/completions', () => ({ json: deepseekReply('Voici : 1. Plomberie Martin (Paris 11e) 2. Allo Plombier 11') }));
    // Un aperçu IA une recherche sur deux (même question = même page, comme Google).
    srv.on('POST', '/v3/serp/google/organic/live/advanced', (r) => {
      n++;
      const kw = String((r.json as { keyword: string }[])[0].keyword);
      return { json: dfsResult(kw.length % 2 === 0) };
    });
    const res = await runAudit(input, { providers: ['google_aio', 'deepseek', 'grok'], concurrency: 4 });
    expect(res.providersUsed).toEqual(['google_aio', 'deepseek']); // grok sans clé : désactivé, pas simulé
    expect(res.answers.some((a) => a.demo)).toBe(false);
    expect(n).toBeGreaterThan(0);
    const aio = res.engines!.find((e) => e.provider === 'google_aio')!;
    const ds = res.engines!.find((e) => e.provider === 'deepseek')!;
    expect(aio).toMatchObject({ via: 'serp', vendor: 'DataForSEO', webSearch: true, country: 'FR', language: 'fr', device: 'mobile', demo: false });
    expect(aio.displayed!.total).toBe(aio.answers);
    expect(aio.displayed!.shown).toBeLessThan(aio.displayed!.total);
    expect(aio.valid).toBeLessThanOrEqual(aio.displayed!.shown);
    expect(aio.note).toMatch(/résultats Google en France/);
    expect(ds).toMatchObject({ via: 'api', model: 'deepseek-flash', runsPerQuestion: 2 });
    expect(ds.mentionRate).not.toBeNull();
    expect(ds.mentionLow!).toBeLessThanOrEqual(ds.mentionRate!);
    expect(ds.mentionHigh!).toBeGreaterThanOrEqual(ds.mentionRate!);
    expect(ds.marginPts).toBeGreaterThan(0);
    expect(res.subScores.deepseek).not.toBeNull();
    // Coûts : relevés + appels DeepSeek comptés dans l'estimation (compteur OPS « Audits (IA) »).
    expect(res.details!.estimatedCostEur!).toBeGreaterThan(0);
    // Les absences ne pèsent pas dans le taux : exclues du dénominateur.
    expect(res.mentions.filter((m) => m.provider === 'google_aio' && m.noRec).length).toBeGreaterThan(0);
  });
});

describe('V8 · mesures payantes : IA en option activées par la plateforme', () => {
  it('AUDIT_PAID_EXTRA_ENGINES ajoute les IA configurées aux IA de l’offre, jamais les autres', async () => {
    process.env.DEEPSEEK_API_KEY = 'k';
    process.env.DATAFORSEO_LOGIN = 'l';
    process.env.DATAFORSEO_PASSWORD = 'p';
    process.env.AUDIT_SERP_ENGINES = 'google_aio';
    process.env.AUDIT_PAID_EXTRA_ENGINES = 'google_aio,grok';
    srv.on('POST', '/chat/completions', () => ({ json: deepseekReply('1. Plomberie Martin 2. Allo Plombier 11') }));
    srv.on('POST', '/v3/serp/google/organic/live/advanced', () => ({ json: dfsResult(true) }));
    const res = await runAudit(input, { mode: 'paid', providers: ['deepseek'], concurrency: 6, queries: [{ text: 'Quel plombier à Paris 11e ?' }, { text: 'Plombier urgence Paris 11e' }] });
    expect(res.providersUsed).toEqual(['deepseek', 'google_aio']); // grok non configuré : absent
    expect(res.engines!.find((e) => e.provider === 'google_aio')!.runsPerQuestion).toBe(3);
    delete process.env.AUDIT_PAID_EXTRA_ENGINES;
    const free = await runAudit(input, { mode: 'free', providers: ['deepseek'], queries: [{ text: 'Quel plombier à Paris 11e ?' }] });
    expect(free.providersUsed).toEqual(['deepseek']);
  });
});

describe('V8 · démo : nouvelles IA simulées et étiquetées', () => {
  it('audit démo avec les nouvelles IA : absences d’aperçu IA, notes « démonstration »', () => {
    const a = createMockAudit(input, 'v8-demo', { providers: ['chatgpt', 'google_aio', 'google_ai_mode', 'copilot', 'deepseek'] });
    expect(a.demo).toBe(true);
    expect(a.answers.some((x) => x.provider === 'google_aio' && x.absent)).toBe(true);
    expect(a.answers.some((x) => x.provider === 'google_ai_mode' && x.absent)).toBe(false);
    for (const e of a.engines!) {
      expect(e.demo).toBe(true);
      expect(e.note).toMatch(/données de démonstration/);
    }
    expect(a.engines!.find((e) => e.provider === 'google_aio')!.displayed!.shown).toBeLessThan(a.engines!.find((e) => e.provider === 'google_aio')!.displayed!.total);
  });
  it('comptes démo : les nouvelles IA figurent dans les mesures', async () => {
    const { buildDemoWorkspace } = await import('@/lib/demo-v2');
    const local = buildDemoWorkspace('local').audits.at(-1)!;
    expect(local.providersUsed).toEqual(expect.arrayContaining(['google_aio', 'google_ai_mode', 'copilot']));
    const pme = buildDemoWorkspace('pme').audits.at(-1)!;
    expect(pme.providersUsed).toEqual(expect.arrayContaining(['claude', 'google_aio', 'deepseek']));
    expect(pme.engines?.every((e) => e.demo)).toBe(true);
  }, 20_000);
});
