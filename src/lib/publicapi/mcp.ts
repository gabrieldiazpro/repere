/**
 * Serveur MCP (Model Context Protocol) en lecture seule, transport « Streamable HTTP », authentifié par clé d'API.
 * Pour brancher Repéré dans Claude, ChatGPT ou tout outil compatible MCP : URL https://<app>/api/mcp,
 * en-tête « Authorization: Bearer rp_live_… ».
 *
 * Spécification suivie (lue le 22 nov. 2026 sur modelcontextprotocol.io) :
 * - révision 2026-07-28 (« moderne », sans session ni poignée de main) : chaque requête porte sa version dans
 *   params._meta["io.modelcontextprotocol/protocolVersion"], recopiée dans les en-têtes MCP-Protocol-Version,
 *   Mcp-Method et Mcp-Name (tools/call) ; en-têtes absents ou différents du corps → 400 + erreur -32020
 *   (HeaderMismatch) ; version inconnue → 400 + -32022 (UnsupportedProtocolVersionError, liste « supported ») ;
 *   méthode inconnue → 404 + -32601 ; notification → 202 sans corps ; GET / DELETE → 405 ; server/discover obligatoire ;
 *   en-tête Origin invalide → 403 (protection contre le DNS rebinding).
 *   https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http
 *   https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning
 *   https://modelcontextprotocol.io/specification/2026-07-28/server/discover
 * - compatibilité « double ère » (autorisée par la page Versioning) : un client ancien (2025-03-26 à 2025-11-25) qui
 *   ouvre par `initialize` est servi selon sa révision, sans identifiant de session (facultatif dans ces révisions)
 *   et sans flux GET (405, autorisé).
 * Aucune dépendance : le SDK officiel n'est pas installé dans le projet (pas d'installation npm permise) ; le
 * sous-ensemble utile (outils en lecture) tient en un fichier, couvert par des tests.
 * Authentification : simple jeton porteur (la spécification recommande OAuth pour les serveurs distants ; une clé
 * d'API reste acceptée par les clients qui permettent d'ajouter un en-tête — voir /developpeurs).
 */
import { ApiError, toApiError } from './errors';
import { authenticate, requireSpace, spacesOf, type Principal, type SpaceAccess } from './access';
import { ownerRef, touchKey } from './keys';
import { checkRate, recordUsage } from './usage';
import { appUrl } from '@/lib/email';
import { isDemoBusinessId } from '@/lib/demo-v2';
import {
  answersFor,
  competitorsView,
  loadAudits,
  loadPrompts,
  loadProposals,
  loadSiteRuns,
  matchQueryId,
  prioritiesOf,
  questionView,
  scoresView,
  sourcesOf,
  spaceView,
} from './data';

export const MODERN_VERSIONS = ['2026-07-28'] as const;
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'] as const;
export const SUPPORTED_VERSIONS: string[] = [...MODERN_VERSIONS, ...LEGACY_VERSIONS];
const META_VERSION = 'io.modelcontextprotocol/protocolVersion';

export const SERVER_INFO = { name: 'repere', title: 'Repéré — visibilité SEO et IA', version: '1.0.0' };
export const INSTRUCTIONS =
  'Outils en lecture seule sur les espaces Repéré (visibilité d’une entreprise dans les IA et sur Google). ' +
  'Commencez par « lister_espaces » si la clé donne accès à plusieurs espaces. Les scores des IA sont des mesures sur un échantillon : ' +
  'citez toujours leur intervalle (low–high) et ne concluez à une évolution que si les intervalles ne se chevauchent pas. ' +
  'Les données marquées demo sont fictives. Aucun outil ne modifie ni ne publie quoi que ce soit.';

// JSON-RPC
export const ERR = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602, internal: -32603, unauthorized: -32001, headerMismatch: -32020, unsupportedVersion: -32022 } as const;

type Id = string | number | null;
interface RpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------
const ESPACE = { type: 'string', description: 'Identifiant de l’espace (voir lister_espaces). Facultatif si la clé ne donne accès qu’à un espace.', maxLength: 100 };
const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export const TOOLS = [
  {
    name: 'lister_espaces',
    title: 'Lister les espaces',
    description: 'Espaces (entreprises suivies) accessibles avec cette clé : identifiant, nom, activité, ville, dernière mesure.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { title: 'Lister les espaces', ...READ_ONLY },
  },
  {
    name: 'scores',
    title: 'Scores',
    description: 'Score de visibilité dans les IA (sur 100, avec son intervalle à 90 %, taux de mention, part de voix, détail par IA) et scores SEO et GEO du site.',
    inputSchema: { type: 'object', properties: { espace: ESPACE }, additionalProperties: false },
    annotations: { title: 'Scores', ...READ_ONLY },
  },
  {
    name: 'questions_reponses',
    title: 'Questions et réponses des IA',
    description:
      'Questions suivies et, à la dernière mesure, le résultat de chaque IA (citations, taux et marge). Avec « question », renvoie aussi le texte des réponses des IA à cette question.',
    inputSchema: {
      type: 'object',
      properties: {
        espace: ESPACE,
        question: { type: 'string', description: 'Identifiant d’une question suivie : ajoute les réponses complètes des IA.', maxLength: 100 },
        limite: { type: 'integer', minimum: 1, maximum: 50, description: 'Nombre de questions (défaut 20).' },
      },
      additionalProperties: false,
    },
    annotations: { title: 'Questions et réponses des IA', ...READ_ONLY },
  },
  {
    name: 'priorites',
    title: 'Priorités',
    description: 'Les correctifs SEO et GEO à traiter d’abord (dernière exploration du site) et le nombre de propositions de l’agent en attente de validation humaine.',
    inputSchema: { type: 'object', properties: { espace: ESPACE }, additionalProperties: false },
    annotations: { title: 'Priorités', ...READ_ONLY },
  },
  {
    name: 'concurrents',
    title: 'Concurrents',
    description: 'Concurrents cités par les IA dans les mêmes réponses, part de voix de chacun (et la vôtre avec sa marge), principales sources citées.',
    inputSchema: { type: 'object', properties: { espace: ESPACE }, additionalProperties: false },
    annotations: { title: 'Concurrents', ...READ_ONLY },
  },
] as const;

type ToolName = (typeof TOOLS)[number]['name'];
const isTool = (n: unknown): n is ToolName => typeof n === 'string' && TOOLS.some((t) => t.name === n);

async function pickSpace(p: Principal, espace: unknown): Promise<SpaceAccess> {
  if (typeof espace === 'string' && espace) return requireSpace(p, espace);
  const all = await spacesOf(p);
  if (all.length === 1) return all[0];
  throw new ApiError(400, 'invalid_request', `Cette clé donne accès à ${all.length} espaces : indiquez « espace » (identifiant donné par lister_espaces).`);
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

export interface ToolOutput {
  text: string;
  data: Record<string, unknown>;
}

export async function runTool(p: Principal, name: ToolName, args: Record<string, unknown>, now: Date = new Date()): Promise<ToolOutput> {
  if (name === 'lister_espaces') {
    const spaces = await spacesOf(p);
    const views = [];
    for (const s of spaces) views.push(spaceView(s.business, s.entitlements, await loadAudits(s.business.id)));
    const lines = views.map((v) => `- ${v.name} (${v.id})${v.demo ? ' [démo, fictif]' : ''} : ${[v.trade, v.city].filter(Boolean).join(', ')} — ${v.measurements} mesure(s)`);
    return { text: `${views.length} espace(s) :\n${lines.join('\n')}`, data: { spaces: views } };
  }
  const s = await pickSpace(p, args.espace);
  const b = s.business;
  const demoNote = p.demo || isDemoBusinessId(b.id) ? '\n(Données de démonstration, fictives.)' : '';
  if (name === 'scores') {
    const v = scoresView(await loadAudits(b.id), await loadSiteRuns(b, now));
    const a = v.aiVisibility;
    const lines = [
      `Espace : ${b.name}`,
      a
        ? `Visibilité dans les IA : ${a.score.value}/100 (intervalle à 90 % : ${a.score.low}–${a.score.high}), mesure du ${a.measuredAt.slice(0, 10)}, confiance ${a.confidence}. Taux de mention ${pct(a.mentionRate.value)} (${pct(a.mentionRate.low)}–${pct(a.mentionRate.high)}), part de voix ${pct(a.shareOfVoice.value)}.`
        : 'Visibilité dans les IA : pas encore de mesure.',
      a ? `Par IA : ${a.byProvider.map((x) => `${x.name} ${x.score ?? 'n.d.'}`).join(', ')}.` : '',
      v.seo ? `SEO : ${v.seo.score}/100 (${v.seo.grade}), exploration du ${v.seo.measuredAt.slice(0, 10)}.` : 'SEO : aucune exploration du site.',
      v.geo ? `GEO (préparation du site pour les IA) : ${v.geo.score}/100.` : '',
    ].filter(Boolean);
    return { text: lines.join('\n') + demoNote, data: v as unknown as Record<string, unknown> };
  }
  if (name === 'questions_reponses') {
    const limit = typeof args.limite === 'number' && Number.isInteger(args.limite) ? Math.min(50, Math.max(1, args.limite)) : 20;
    const [prompts, audits] = await Promise.all([loadPrompts(b.id), loadAudits(b.id)]);
    const latest = audits.at(-1) ?? null;
    if (typeof args.question === 'string' && args.question) {
      const pr = prompts.find((x) => x.id === args.question);
      if (!pr) throw new ApiError(404, 'not_found', 'Question introuvable dans cet espace.');
      const q = questionView(pr, latest);
      const qid = latest ? matchQueryId(pr, latest) : null;
      const answers = latest && qid ? answersFor(latest, qid).slice(0, 30).map((x) => ({ ...x, text: x.text.slice(0, 2000) })) : [];
      const lines = [`Question : « ${q.text} »`, ...(q.latest?.byProvider ?? []).map((r) => `- ${r.name} : cité ${r.cited}/${r.answers} (${pct(r.rate)}, marge ${pct(r.low)}–${pct(r.high)})`)];
      for (const x of answers) lines.push(`\n[${x.name}, passage ${x.run}${x.mentioned ? ', vous cite' : ''}] ${x.text.slice(0, 600)}${x.text.length > 600 ? '…' : ''}`);
      return { text: lines.join('\n') + demoNote, data: { question: q, answers } };
    }
    const list = prompts.filter((x) => x.active).slice(0, limit).map((x) => questionView(x, latest));
    const lines = list.map((q) => {
      const r = q.latest?.byProvider ?? [];
      const cited = r.reduce((n, x) => n + x.cited, 0);
      const total = r.reduce((n, x) => n + x.answers, 0);
      return `- (${q.id}) « ${q.text} » : ${total ? `cité dans ${cited}/${total} réponses` : 'pas encore mesurée'}`;
    });
    return { text: `${list.length} question(s) suivie(s) active(s) — ${b.name} :\n${lines.join('\n')}` + demoNote, data: { questions: list } };
  }
  if (name === 'priorites') {
    const [runs, proposals] = await Promise.all([loadSiteRuns(b, now), loadProposals(b.id)]);
    const list = prioritiesOf(runs.at(-1) ?? null);
    const pending = proposals.filter((x) => x.status === 'proposed').length;
    const lines = list.map((f, i) => `${i + 1}. [${f.source.toUpperCase()}, ${f.severity}] ${f.title} — ${f.fix}`);
    return {
      text: `${list.length ? `Priorités — ${b.name} :\n${lines.join('\n')}` : 'Aucune exploration du site : pas de priorités calculées.'}\nPropositions de l’agent à valider dans l’app : ${pending}.` + demoNote,
      data: { priorities: list, pendingProposals: pending, reviewUrl: `${appUrl()}/app/agent` },
    };
  }
  // concurrents
  const last = (await loadAudits(b.id)).at(-1) ?? null;
  if (!last) return { text: `${b.name} : pas encore de mesure des IA.`, data: { competitors: null, sources: [] } };
  const c = competitorsView(last);
  const sources = sourcesOf(last).slice(0, 10);
  const lines = [
    `Concurrents cités par les IA — ${b.name} (mesure du ${c.measuredAt.slice(0, 10)}) :`,
    ...c.actors.slice(0, 15).map((x) => `${x.rank}. ${x.name}${x.isYou ? ' (vous)' : ''} : part de voix ${pct(x.shareOfVoice)}`),
    `Votre part de voix : ${pct(c.you.shareOfVoice.value)} (marge ${pct(c.you.shareOfVoice.low)}–${pct(c.you.shareOfVoice.high)}).`,
    sources.length ? `Sources les plus citées : ${sources.map((x) => x.domain).join(', ')}.` : '',
  ].filter(Boolean);
  return { text: lines.join('\n') + demoNote, data: { competitors: c, sources } };
}

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------
function defaultOrigins(): string[] {
  const out = ['https://claude.ai', 'https://chatgpt.com', 'https://chat.openai.com'];
  try {
    out.push(new URL(appUrl()).origin);
  } catch {
    /* ignore */
  }
  for (const o of (process.env.PUBLIC_MCP_ALLOWED_ORIGINS ?? '').split(',')) if (o.trim()) out.push(o.trim().replace(/\/$/, ''));
  return out;
}

/** Origin absent (client serveur) : accepté. Présent : doit figurer dans la liste (protection DNS rebinding). */
export function originAllowed(origin: string | null): boolean {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  return defaultOrigins().includes(origin.replace(/\/$/, ''));
}

function cors(origin: string | null): Record<string, string> {
  return origin && originAllowed(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization, content-type, accept, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id, last-event-id',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-expose-headers': 'www-authenticate',
        vary: 'Origin',
      }
    : {};
}

function rpcResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { ...(body === null ? {} : { 'content-type': 'application/json; charset=utf-8' }), 'cache-control': 'no-store', ...headers },
  });
}

const rpcError = (id: Id, code: number, message: string, data?: unknown) => ({ jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
const rpcResult = (id: Id, result: unknown) => ({ jsonrpc: '2.0', id, result });

/** Décode la valeur « =?base64?…?= » des en-têtes Mcp-Name / Mcp-Param-*. */
export function decodeHeaderValue(v: string): string {
  const m = /^=\?base64\?([A-Za-z0-9+/=]*)\?=$/.exec(v);
  return m ? Buffer.from(m[1], 'base64').toString('utf8') : v;
}

/** Contrôles d'en-têtes d'une requête moderne (2026-07-28). Renvoie un message d'écart, ou null. */
export function headerMismatch(req: Request, msg: { method: string; params: Record<string, unknown> }, version: string): string | null {
  const h = req.headers;
  const pv = h.get('mcp-protocol-version');
  if (!pv) return 'En-tête MCP-Protocol-Version manquant.';
  if (pv !== version) return `MCP-Protocol-Version « ${pv} » différent du corps « ${version} ».`;
  const mm = h.get('mcp-method');
  if (!mm) return 'En-tête Mcp-Method manquant.';
  if (mm !== msg.method) return `Mcp-Method « ${mm} » différent du corps « ${msg.method} ».`;
  if (msg.method === 'tools/call' || msg.method === 'resources/read' || msg.method === 'prompts/get') {
    const raw = h.get('mcp-name');
    const body = String(msg.params.name ?? msg.params.uri ?? '');
    if (!raw) return 'En-tête Mcp-Name manquant.';
    if (decodeHeaderValue(raw) !== body) return `Mcp-Name différent du corps (« ${body} »).`;
  }
  return null;
}

const toolsList = () => TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations }));

export async function handleMcp(req: Request, now: Date = new Date()): Promise<Response> {
  const origin = req.headers.get('origin');
  if (!originAllowed(origin)) return rpcResponse(403, { jsonrpc: '2.0', error: { code: ERR.invalidRequest, message: 'Origine non autorisée.' } });
  const ch = cors(origin);
  const method = req.method.toUpperCase();
  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: ch });
  if (method !== 'POST') return rpcResponse(405, null, { allow: 'POST', ...ch });

  let msg: RpcMessage;
  try {
    const raw = await req.text();
    if (raw.length > 65_536) return rpcResponse(400, rpcError(null, ERR.invalidRequest, 'Message trop volumineux.'), ch);
    msg = JSON.parse(raw) as RpcMessage;
  } catch {
    return rpcResponse(400, rpcError(null, ERR.parse, 'JSON illisible.'), ch);
  }
  if (Array.isArray(msg)) return rpcResponse(400, rpcError(null, ERR.invalidRequest, 'Les lots JSON-RPC ne sont pas acceptés : un message par requête.'), ch);
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    // Une réponse JSON-RPC envoyée par le client (interdite en 2026-07-28) ou un message mal formé.
    return rpcResponse(400, rpcError(null, ERR.invalidRequest, 'Requête JSON-RPC 2.0 invalide.'), ch);
  }
  const isNotification = !('id' in msg) || msg.id === undefined;
  const id: Id = typeof msg.id === 'string' || typeof msg.id === 'number' ? msg.id : null;
  const params = (msg.params && typeof msg.params === 'object' && !Array.isArray(msg.params) ? msg.params : {}) as Record<string, unknown>;
  const meta = (params._meta && typeof params._meta === 'object' ? params._meta : {}) as Record<string, unknown>;
  const metaVersion = typeof meta[META_VERSION] === 'string' ? (meta[META_VERSION] as string) : null;
  const headerVersion = req.headers.get('mcp-protocol-version');

  // Authentification (toutes les requêtes, notifications comprises).
  let principal: Principal;
  try {
    principal = await authenticate(req);
  } catch (e) {
    const err = toApiError(e);
    return rpcResponse(401, rpcError(id, ERR.unauthorized, err.message), { 'www-authenticate': 'Bearer realm="repere-mcp"', ...ch });
  }

  // Ère : moderne si _meta porte une version ; ancienne si `initialize` ou sans _meta.
  const modern = metaVersion !== null;
  if (modern) {
    if (!(MODERN_VERSIONS as readonly string[]).includes(metaVersion!)) {
      return rpcResponse(400, rpcError(id, ERR.unsupportedVersion, 'Unsupported protocol version', { supported: SUPPORTED_VERSIONS, requested: metaVersion }), ch);
    }
    const mismatch = headerMismatch(req, { method: msg.method, params }, metaVersion!);
    if (mismatch) return rpcResponse(400, rpcError(id, ERR.headerMismatch, `Header mismatch: ${mismatch}`), ch);
  } else if (msg.method !== 'initialize' && headerVersion) {
    if ((MODERN_VERSIONS as readonly string[]).includes(headerVersion)) {
      return rpcResponse(400, rpcError(id, ERR.headerMismatch, `Header mismatch: _meta["${META_VERSION}"] manquant dans le corps.`), ch);
    }
    if (!SUPPORTED_VERSIONS.includes(headerVersion)) {
      return rpcResponse(400, rpcError(id, ERR.unsupportedVersion, 'Unsupported protocol version', { supported: SUPPORTED_VERSIONS, requested: headerVersion }), ch);
    }
  }

  if (isNotification) return rpcResponse(202, null, ch);

  const complete = (r: Record<string, unknown>) => (modern ? { resultType: 'complete', ...r } : r);
  const started = Date.now();
  let usagePath = `mcp:${msg.method}`;
  let status = 200;
  try {
    await checkRate(principal, req, 'read');
    switch (msg.method) {
      case 'initialize': {
        const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
        const version = (LEGACY_VERSIONS as readonly string[]).includes(requested) ? requested : LEGACY_VERSIONS[0];
        return rpcResponse(200, rpcResult(id, { protocolVersion: version, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS }), ch);
      }
      case 'server/discover':
        return rpcResponse(
          200,
          rpcResult(id, { resultType: 'complete', supportedVersions: SUPPORTED_VERSIONS, capabilities: { tools: {} }, _meta: { 'io.modelcontextprotocol/serverInfo': SERVER_INFO }, instructions: INSTRUCTIONS }),
          ch,
        );
      case 'ping':
        return rpcResponse(200, rpcResult(id, complete({})), ch);
      case 'tools/list':
        return rpcResponse(200, rpcResult(id, complete({ tools: toolsList() })), ch);
      case 'tools/call': {
        const name = params.name;
        if (!isTool(name)) return rpcResponse(200, rpcError(id, ERR.invalidParams, `Outil inconnu : ${String(name)}.`), ch);
        usagePath = `mcp:${name}`;
        const args = (params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? params.arguments : {}) as Record<string, unknown>;
        try {
          const out = await runTool(principal, name, args, now);
          return rpcResponse(200, rpcResult(id, complete({ content: [{ type: 'text', text: out.text }], structuredContent: out.data, isError: false })), ch);
        } catch (e) {
          const err = toApiError(e);
          if (err.status >= 500) throw e;
          status = err.status;
          // Erreur d'exécution de l'outil : renvoyée dans le résultat (le modèle peut corriger son appel).
          return rpcResponse(200, rpcResult(id, complete({ content: [{ type: 'text', text: err.message }], isError: true })), ch);
        }
      }
      default:
        status = 404;
        return rpcResponse(modern ? 404 : 200, rpcError(id, ERR.methodNotFound, `Méthode inconnue : ${msg.method}.`), ch);
    }
  } catch (e) {
    const err = toApiError(e);
    status = err.status;
    if (err.status === 429) return rpcResponse(429, rpcError(id, ERR.internal, err.message), { 'retry-after': String((err.details?.retryAfter as number) ?? 60), ...ch });
    if (err.status >= 500) console.error('[mcp]', e);
    return rpcResponse(err.status >= 500 ? 500 : err.status, rpcError(id, ERR.internal, err.message), ch);
  } finally {
    if (!principal.demo && principal.scope.kind !== 'demo') {
      await recordUsage(principal, ownerRef(principal.scope), { at: now.toISOString(), method: 'POST', path: usagePath, status, ms: Date.now() - started });
      if (principal.record) await touchKey(principal.record, now).catch(() => undefined);
    }
  }
}
