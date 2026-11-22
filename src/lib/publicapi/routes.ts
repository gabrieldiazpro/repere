/**
 * Table des routes de l'API publique v1 : source unique du routeur (router.ts) ET du document OpenAPI (openapi.ts).
 * Chaque route déclare ses droits (`read` / `write`), ses paramètres, sa réponse et son traitant.
 *
 * Écritures sûres seulement : ajouter / supprimer une question suivie, demander une nouvelle mesure (bornée par
 * l'offre). La validation des propositions de l'agent n'existe PAS dans l'API : elle reste humaine, dans l'app.
 */
import type { AuditResult } from '@/lib/engine/types';
import type { PromptInput } from '@/lib/prompts/types';
import { ApiError } from './errors';
import { requireSpace, requireWrite, spacesOf, type Principal, type SpaceAccess } from './access';
import { paginate, parsePage } from './pagination';
import { LIMITS } from './usage';
import {
  answersFor,
  competitorsView,
  findingsOf,
  loadAudits,
  loadPrompts,
  loadProposals,
  loadSiteRuns,
  matchQueryId,
  measurementView,
  prioritiesOf,
  proposalView,
  questionView,
  reportsOf,
  scoresView,
  sitePoints,
  sourcesOf,
  spaceView,
  visibilityPoint,
} from './data';

export interface RouteCtx {
  req: Request;
  principal: Principal;
  params: Record<string, string>;
  query: URLSearchParams;
  /** origine publique de l'app (liens renvoyés) */
  base: string;
  now: Date;
  body: Record<string, unknown> | null;
  /** chemin sans requête, pour lier les curseurs à leur liste */
  path: string;
}

export interface RouteResult {
  status?: number;
  body: unknown;
}

export interface ParamDoc {
  name: string;
  in: 'path' | 'query';
  description: string;
  required?: boolean;
  schema: Record<string, unknown>;
}

export interface RouteDef {
  method: 'GET' | 'POST' | 'DELETE';
  /** gabarit OpenAPI : /v1/spaces/{spaceId} */
  path: string;
  operationId: string;
  tag: 'Clé' | 'Espaces' | 'Scores' | 'Questions' | 'Concurrents et sources' | 'Constats et priorités' | 'Agent' | 'Rapports' | 'Mesures';
  summary: string;
  description: string;
  access: 'read' | 'write';
  params?: ParamDoc[];
  /** schéma du corps (nom dans components.schemas) */
  requestBody?: string;
  /** schéma de l'élément renvoyé (nom dans components.schemas) */
  response: string;
  responseStatus?: number;
  paginated?: boolean;
  handler(ctx: RouteCtx): Promise<RouteResult>;
}

const SPACE: ParamDoc = { name: 'spaceId', in: 'path', required: true, description: 'Identifiant de l’espace (voir GET /v1/spaces).', schema: { type: 'string', maxLength: 100 } };
const QUESTION: ParamDoc = { name: 'questionId', in: 'path', required: true, description: 'Identifiant de la question suivie.', schema: { type: 'string', maxLength: 100 } };
const PAGE: ParamDoc[] = [
  { name: 'limit', in: 'query', description: 'Éléments par page (1 à 100, défaut 25).', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
  { name: 'cursor', in: 'query', description: 'Curseur « nextCursor » de la page précédente.', schema: { type: 'string' } },
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function dateParam(q: URLSearchParams, name: 'from' | 'to'): string | null {
  const v = q.get(name);
  if (v === null) return null;
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(v))) throw new ApiError(400, 'invalid_request', `« ${name} » doit être une date AAAA-MM-JJ.`);
  return v;
}

function enumParam<T extends string>(q: URLSearchParams, name: string, values: readonly T[]): T | null {
  const v = q.get(name);
  if (v === null || v === '') return null;
  if (!(values as readonly string[]).includes(v)) throw new ApiError(400, 'invalid_request', `« ${name} » doit valoir : ${values.join(', ')}.`);
  return v as T;
}

const one = (data: unknown, status = 200): RouteResult => ({ status, body: { data } });
const space = (c: RouteCtx): Promise<SpaceAccess> => requireSpace(c.principal, c.params.spaceId);
const latestOf = (audits: AuditResult[]) => audits.at(-1) ?? null;

const FREQ_LABEL = { monthly: 'par mois', weekly: 'par semaine', daily: 'par jour' } as const;

export const ROUTES: RouteDef[] = [
  {
    method: 'GET',
    path: '/v1/me',
    operationId: 'getKey',
    tag: 'Clé',
    summary: 'Votre clé',
    description: 'Droits, portée et limites de la clé utilisée. Pratique pour vérifier une intégration.',
    access: 'read',
    response: 'KeyInfo',
    async handler(c) {
      const spaces = await spacesOf(c.principal);
      const p = c.principal;
      return one({
        keyId: p.keyId,
        demo: p.demo,
        access: p.access,
        scope: p.scope.kind,
        spaces: spaces.length,
        rateLimits: p.demo
          ? { perMinute: LIMITS.demoPerMinute, perDay: LIMITS.demoPerDay, per: 'ip' }
          : { readPerMinute: LIMITS.readPerMinute, writePerMinute: LIMITS.writePerMinute, perDay: LIMITS.perDay, per: 'key' },
        ...(p.demo ? { notice: 'Clé de démonstration publique : lecture seule, comptes démo fictifs uniquement.' } : {}),
      });
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces',
    operationId: 'listSpaces',
    tag: 'Espaces',
    summary: 'Lister les espaces',
    description: 'Espaces accessibles avec cette clé : un seul pour une clé d’espace, tous les espaces clients en offre Agence pour une clé d’agence.',
    access: 'read',
    params: PAGE,
    response: 'Space',
    paginated: true,
    async handler(c) {
      const spaces = await spacesOf(c.principal);
      const views = [];
      for (const s of spaces) views.push(spaceView(s.business, s.entitlements, await loadAudits(s.business.id)));
      return { body: paginate(views, parsePage(c.query, c.path)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}',
    operationId: 'getSpace',
    tag: 'Espaces',
    summary: 'Un espace',
    description: 'Nom, parcours, offre et dernière mesure de l’espace.',
    access: 'read',
    params: [SPACE],
    response: 'Space',
    async handler(c) {
      const s = await space(c);
      return one(spaceView(s.business, s.entitlements, await loadAudits(s.business.id)));
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/scores',
    operationId: 'getScores',
    tag: 'Scores',
    summary: 'Scores actuels (IA, SEO, GEO)',
    description:
      'Visibilité dans les IA (score sur 100 avec son intervalle à 90 %, taux de mention, part de voix, détail par IA) et scores SEO et GEO de la dernière exploration du site. Une valeur absente vaut null : rien n’est estimé.',
    access: 'read',
    params: [SPACE],
    response: 'Scores',
    async handler(c) {
      const s = await space(c);
      const [audits, runs] = await Promise.all([loadAudits(s.business.id), loadSiteRuns(s.business, c.now)]);
      return one(scoresView(audits, runs));
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/scores/history',
    operationId: 'getScoreHistory',
    tag: 'Scores',
    summary: 'Historique des scores',
    description: 'Points datés, du plus ancien au plus récent : visibilité dans les IA (avec marge basse et haute) et scores SEO / GEO des explorations.',
    access: 'read',
    params: [
      SPACE,
      { name: 'type', in: 'query', description: 'Filtrer : ai_visibility, seo ou geo.', schema: { type: 'string', enum: ['ai_visibility', 'seo', 'geo'] } },
      { name: 'from', in: 'query', description: 'Date de début incluse (AAAA-MM-JJ).', schema: { type: 'string', format: 'date' } },
      { name: 'to', in: 'query', description: 'Date de fin incluse (AAAA-MM-JJ).', schema: { type: 'string', format: 'date' } },
      ...PAGE,
    ],
    response: 'HistoryPoint',
    paginated: true,
    async handler(c) {
      const type = enumParam(c.query, 'type', ['ai_visibility', 'seo', 'geo'] as const);
      const from = dateParam(c.query, 'from');
      const to = dateParam(c.query, 'to');
      const s = await space(c);
      const [audits, runs] = await Promise.all([loadAudits(s.business.id), loadSiteRuns(s.business, c.now)]);
      const points = [...audits.map(visibilityPoint), ...sitePoints(runs)]
        .filter((p) => !type || p.type === type)
        .filter((p) => (!from || p.measuredAt.slice(0, 10) >= from) && (!to || p.measuredAt.slice(0, 10) <= to))
        .sort((a, b) => a.measuredAt.localeCompare(b.measuredAt) || a.type.localeCompare(b.type));
      return { body: paginate(points, parsePage(c.query, `${c.path}?${type}${from}${to}`)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/measurements',
    operationId: 'listMeasurements',
    tag: 'Mesures',
    summary: 'Lister les mesures',
    description: 'Mesures des IA terminées, de la plus récente à la plus ancienne.',
    access: 'read',
    params: [SPACE, ...PAGE],
    response: 'Measurement',
    paginated: true,
    async handler(c) {
      const s = await space(c);
      const list = (await loadAudits(s.business.id)).map(measurementView).reverse();
      return { body: paginate(list, parsePage(c.query, c.path)) };
    },
  },
  {
    method: 'POST',
    path: '/v1/spaces/{spaceId}/measurements',
    operationId: 'createMeasurement',
    tag: 'Mesures',
    summary: 'Demander une nouvelle mesure',
    description:
      'Met en file une nouvelle mesure des IA (questions suivies et IA de l’offre). Bornée par l’offre : une mesure par période (semaine pour Accompagné et Agence). Réponse 202 : la mesure prend quelques minutes ; abonnez-vous au webhook « audit.completed » pour être prévenu.',
    access: 'write',
    params: [SPACE],
    response: 'MeasurementJob',
    responseStatus: 202,
    async handler(c) {
      requireWrite(c.principal);
      const s = await space(c);
      const { isAuditDue, MIN_INTERVAL_MS, periodKey } = await import('@/lib/jobs/platform');
      const ent = s.entitlements;
      const audits = await loadAudits(s.business.id);
      const times = audits.map((a) => Date.parse(a.createdAt)).filter(Number.isFinite).sort((a, b) => b - a);
      const lastAt = times[0];
      if (lastAt !== undefined && audits.length > 1 && !isAuditDue(ent.frequency, new Date(lastAt).toISOString(), c.now)) {
        const next = new Date(lastAt + MIN_INTERVAL_MS[ent.frequency]);
        throw new ApiError(402, 'quota_exceeded', `Votre offre comprend une mesure ${FREQ_LABEL[ent.frequency]} : prochaine mesure possible le ${next.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}.`, { nextAllowedAt: next.toISOString() });
      }
      const { enqueue } = await import('@/lib/jobs');
      const id = s.business.id;
      const { id: jobId } = await enqueue('audit.run', { businessId: id, trigger: 'manual' }, { businessId: id, dedupeKey: `audit.run:${id}:${periodKey(ent.frequency, c.now)}:${audits.length > 1 ? 'p' : 'first'}` });
      return one({ jobId, status: 'queued', frequency: ent.frequency, requestedAt: c.now.toISOString() }, 202);
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/questions',
    operationId: 'listQuestions',
    tag: 'Questions',
    summary: 'Questions suivies et résultats par IA',
    description: 'Questions posées aux IA à chaque mesure, avec, pour la dernière mesure, le résultat de chaque IA : réponses, citations, taux de citation et son intervalle de Wilson à 90 %, meilleure position.',
    access: 'read',
    params: [SPACE, { name: 'active', in: 'query', description: 'true : actives seulement ; false : en pause seulement.', schema: { type: 'boolean' } }, ...PAGE],
    response: 'Question',
    paginated: true,
    async handler(c) {
      const active = enumParam(c.query, 'active', ['true', 'false'] as const);
      const s = await space(c);
      const [prompts, audits] = await Promise.all([loadPrompts(s.business.id), loadAudits(s.business.id)]);
      const latest = latestOf(audits);
      const list = prompts.filter((p) => active === null || p.active === (active === 'true')).map((p) => questionView(p, latest));
      return { body: paginate(list, parsePage(c.query, `${c.path}?${active}`)) };
    },
  },
  {
    method: 'POST',
    path: '/v1/spaces/{spaceId}/questions',
    operationId: 'createQuestion',
    tag: 'Questions',
    summary: 'Ajouter une question suivie',
    description: 'Ajoute une question, mesurée dès la prochaine mesure. Refus : doublon (409), quota de questions actives de l’offre atteint (402).',
    access: 'write',
    params: [SPACE],
    requestBody: 'QuestionInput',
    response: 'Question',
    responseStatus: 201,
    async handler(c) {
      requireWrite(c.principal);
      const s = await space(c);
      const b = c.body ?? {};
      if (typeof b.text !== 'string') throw new ApiError(400, 'invalid_request', '« text » (la question) est obligatoire.');
      const input: PromptInput = {
        text: b.text,
        ...(typeof b.theme === 'string' ? { theme: b.theme } : {}),
        ...(Array.isArray(b.tags) ? { tags: b.tags.filter((t): t is string => typeof t === 'string').slice(0, 10) } : {}),
        ...(typeof b.intent === 'string' ? { intent: b.intent as PromptInput['intent'] } : {}),
        ...(typeof b.active === 'boolean' ? { active: b.active } : {}),
        origin: 'client',
      };
      const { createPrompt } = await import('@/lib/prompts/repo');
      const { HttpError } = await import('@/lib/auth/roles');
      const p = await createPrompt(s.business, input).catch((e: unknown) => {
        // Quota de questions actives de l'offre : code dédié (le client peut mettre une question en pause).
        if (e instanceof HttpError && e.status === 402) throw new ApiError(402, 'quota_exceeded', e.message);
        throw e;
      });
      return one(questionView(p, null), 201);
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/questions/{questionId}',
    operationId: 'getQuestion',
    tag: 'Questions',
    summary: 'Une question suivie',
    description: 'La question et le résultat de chaque IA à la dernière mesure.',
    access: 'read',
    params: [SPACE, QUESTION],
    response: 'Question',
    async handler(c) {
      const s = await space(c);
      const [prompts, audits] = await Promise.all([loadPrompts(s.business.id), loadAudits(s.business.id)]);
      const p = prompts.find((x) => x.id === c.params.questionId);
      if (!p) throw new ApiError(404, 'not_found', 'Question introuvable.');
      return one(questionView(p, latestOf(audits)));
    },
  },
  {
    method: 'DELETE',
    path: '/v1/spaces/{spaceId}/questions/{questionId}',
    operationId: 'deleteQuestion',
    tag: 'Questions',
    summary: 'Supprimer une question suivie',
    description: 'Suppression définitive : la question ne sera plus posée. Les mesures passées restent consultables.',
    access: 'write',
    params: [SPACE, QUESTION],
    response: 'Deleted',
    async handler(c) {
      requireWrite(c.principal);
      const s = await space(c);
      const { deletePrompt, getPrompt } = await import('@/lib/prompts/repo');
      const p = await getPrompt(c.params.questionId);
      if (!p || p.businessId !== s.business.id) throw new ApiError(404, 'not_found', 'Question introuvable.');
      await deletePrompt(s.business, p.id);
      return one({ id: p.id, deleted: true });
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/questions/{questionId}/answers',
    operationId: 'listAnswers',
    tag: 'Questions',
    summary: 'Réponses des IA à une question',
    description: 'Texte complet des réponses de chaque IA (chaque passage), avec citation, position, concurrents et sources citées. Par défaut : dernière mesure.',
    access: 'read',
    params: [SPACE, QUESTION, { name: 'measurementId', in: 'query', description: 'Une mesure précise (voir GET …/measurements).', schema: { type: 'string' } }, ...PAGE],
    response: 'Answer',
    paginated: true,
    async handler(c) {
      const s = await space(c);
      const [prompts, audits] = await Promise.all([loadPrompts(s.business.id), loadAudits(s.business.id)]);
      const p = prompts.find((x) => x.id === c.params.questionId);
      if (!p) throw new ApiError(404, 'not_found', 'Question introuvable.');
      const mid = c.query.get('measurementId');
      const audit = mid ? audits.find((a) => a.id === mid) : latestOf(audits);
      if (mid && !audit) throw new ApiError(404, 'not_found', 'Mesure introuvable.');
      const qid = audit ? matchQueryId(p, audit) : null;
      const list = audit && qid ? answersFor(audit, qid) : [];
      return { body: paginate(list, parsePage(c.query, `${c.path}?${mid ?? ''}`)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/competitors',
    operationId: 'getCompetitors',
    tag: 'Concurrents et sources',
    summary: 'Concurrents et part de voix',
    description: 'Classement des acteurs cités dans les mêmes réponses que vous (dernière mesure), part de voix de chacun, et votre part de voix avec son intervalle à 90 %.',
    access: 'read',
    params: [SPACE],
    response: 'Competitors',
    async handler(c) {
      const s = await space(c);
      const last = latestOf(await loadAudits(s.business.id));
      return one(last ? competitorsView(last) : null);
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/sources',
    operationId: 'listSources',
    tag: 'Concurrents et sources',
    summary: 'Sources citées par les IA',
    description: 'Domaines cités dans les réponses (dernière mesure) : nombre et part des citations, IA concernées, votre présence, concurrents présents.',
    access: 'read',
    params: [SPACE, ...PAGE],
    response: 'Source',
    paginated: true,
    async handler(c) {
      const s = await space(c);
      const last = latestOf(await loadAudits(s.business.id));
      return { body: paginate(last ? sourcesOf(last) : [], parsePage(c.query, c.path)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/findings',
    operationId: 'listFindings',
    tag: 'Constats et priorités',
    summary: 'Constats SEO et GEO',
    description: 'Constats de la dernière exploration du site (SEO et GEO), triés par priorité (gravité × impact ÷ effort).',
    access: 'read',
    params: [
      SPACE,
      { name: 'source', in: 'query', description: 'seo ou geo.', schema: { type: 'string', enum: ['seo', 'geo'] } },
      { name: 'severity', in: 'query', description: 'critical, high, medium ou low.', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] } },
      ...PAGE,
    ],
    response: 'Finding',
    paginated: true,
    async handler(c) {
      const source = enumParam(c.query, 'source', ['seo', 'geo'] as const);
      const severity = enumParam(c.query, 'severity', ['critical', 'high', 'medium', 'low'] as const);
      const s = await space(c);
      const runs = await loadSiteRuns(s.business, c.now);
      const list = findingsOf(runs.at(-1) ?? null).filter((f) => (!source || f.source === source) && (!severity || f.severity === severity));
      return { body: paginate(list, parsePage(c.query, `${c.path}?${source}${severity}`)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/priorities',
    operationId: 'listPriorities',
    tag: 'Constats et priorités',
    summary: 'Priorités',
    description: 'Les 10 correctifs à traiter d’abord, d’après la dernière exploration du site.',
    access: 'read',
    params: [SPACE],
    response: 'Finding',
    async handler(c) {
      const s = await space(c);
      const runs = await loadSiteRuns(s.business, c.now);
      return one(prioritiesOf(runs.at(-1) ?? null));
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/proposals',
    operationId: 'listProposals',
    tag: 'Agent',
    summary: 'Propositions de l’agent',
    description:
      'Corrections préparées par l’agent, avec l’avant / après exact. Lecture seule : la validation (ou le refus) se fait uniquement par un humain dans l’app (lien « reviewUrl »). Rien n’est publié chez le client sans cette validation.',
    access: 'read',
    params: [SPACE, { name: 'status', in: 'query', description: 'draft, proposed (à valider), validated, applied, rejected, reverted…', schema: { type: 'string' } }, ...PAGE],
    response: 'Proposal',
    paginated: true,
    async handler(c) {
      const status = c.query.get('status');
      if (status !== null && !/^[a-z_]{2,30}$/.test(status)) throw new ApiError(400, 'invalid_request', '« status » invalide.');
      const s = await space(c);
      const list = (await loadProposals(s.business.id)).filter((x) => !status || x.status === status).map((x) => proposalView(x, c.base));
      return { body: paginate(list, parsePage(c.query, `${c.path}?${status ?? ''}`)) };
    },
  },
  {
    method: 'GET',
    path: '/v1/spaces/{spaceId}/reports',
    operationId: 'listReports',
    tag: 'Rapports',
    summary: 'Rapports',
    description: 'Rapports disponibles : rapport mensuel imprimable et rapport PDF de chaque mesure (ouverts dans l’app, avec une session).',
    access: 'read',
    params: [SPACE, ...PAGE],
    response: 'Report',
    paginated: true,
    async handler(c) {
      const s = await space(c);
      const audits = await loadAudits(s.business.id);
      return { body: paginate(reportsOf(audits, c.base), parsePage(c.query, c.path)) };
    },
  },
];

// ---------------------------------------------------------------------------
// Correspondance chemin → route
// ---------------------------------------------------------------------------
export interface Match {
  route: RouteDef;
  params: Record<string, string>;
}

function compile(path: string): { re: RegExp; names: string[] } {
  const names: string[] = [];
  const src = path
    .split('/')
    .map((seg) => {
      const m = /^\{(\w+)\}$/.exec(seg);
      if (!m) return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      names.push(m[1]);
      return '([^/]+)';
    })
    .join('/');
  return { re: new RegExp(`^${src}$`), names };
}

const COMPILED = ROUTES.map((r) => ({ r, ...compile(r.path) }));

/** Routes dont le gabarit correspond au chemin (toutes méthodes) : sert aussi au 405 et à l'en-tête Allow. */
export function matchPath(path: string): Match[] {
  const out: Match[] = [];
  for (const c of COMPILED) {
    const m = c.re.exec(path);
    if (!m) continue;
    const params: Record<string, string> = {};
    let ok = true;
    c.names.forEach((n, i) => {
      try {
        params[n] = decodeURIComponent(m[i + 1]);
      } catch {
        ok = false;
      }
    });
    if (ok) out.push({ route: c.r, params });
  }
  return out;
}

