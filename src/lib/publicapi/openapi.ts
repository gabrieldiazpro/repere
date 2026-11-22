/**
 * Document OpenAPI 3.1 de l'API publique, GÉNÉRÉ depuis la table des routes (routes.ts) : chemins, paramètres,
 * droits, pagination et réponses ne peuvent pas diverger du routeur. Servi sans authentification sur
 * GET /api/public/v1/openapi.json ; la page /developpeurs en tire sa référence.
 * Les webhooks sortants sont décrits dans la section `webhooks` (nouveauté d'OpenAPI 3.1).
 */
import { ERROR_CODES } from './errors';
import { ROUTES } from './routes';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_DOCS } from './webhook-events';

export const API_VERSION = '1.0.0';
export const API_BASE_PATH = '/api/public';

type Schema = Record<string, unknown>;

const str = (description?: string, extra: Schema = {}): Schema => ({ type: 'string', ...(description ? { description } : {}), ...extra });
const int = (description?: string, extra: Schema = {}): Schema => ({ type: 'integer', ...(description ? { description } : {}), ...extra });
const num = (description?: string, extra: Schema = {}): Schema => ({ type: 'number', ...(description ? { description } : {}), ...extra });
const bool = (description?: string): Schema => ({ type: 'boolean', ...(description ? { description } : {}) });
const nullable = (s: Schema): Schema => ({ ...s, type: [s.type as string, 'null'] });
const arr = (items: Schema, description?: string): Schema => ({ type: 'array', items, ...(description ? { description } : {}) });
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const obj = (properties: Record<string, Schema>, required: string[] = Object.keys(properties), description?: string): Schema => ({
  type: 'object',
  properties,
  required,
  ...(description ? { description } : {}),
});

export const SCHEMAS: Record<string, Schema> = {
  Error: obj({
    error: obj({
      code: str('Code stable, à tester dans vos programmes.', { enum: [...ERROR_CODES] }),
      message: str('Explication en français, affichable.'),
      status: int('Statut HTTP.'),
      requestId: str('Identifiant de la requête (à nous transmettre en cas de problème).'),
      docs: str('Documentation.'),
      details: { type: 'object', additionalProperties: true, description: 'Précisions (ex. retryAfter, nextAllowedAt).' },
    }, ['code', 'message', 'status', 'requestId']),
  }),
  Pagination: obj({
    limit: int(),
    total: int('Nombre total d’éléments.'),
    hasMore: bool(),
    nextCursor: nullable(str('À passer en « cursor » pour la page suivante.')),
  }),
  Interval: obj({
    value: num('Valeur mesurée.'),
    low: num('Borne basse de l’intervalle à 90 %.'),
    high: num('Borne haute de l’intervalle à 90 %.'),
    margin: num('Demi-largeur (±).'),
  }, ['value', 'low', 'high', 'margin'], 'Mesure avec sa marge d’erreur : ne comparez deux valeurs que si leurs intervalles ne se chevauchent pas.'),
  KeyInfo: obj({
    keyId: str(),
    demo: bool('Clé de démonstration (données fictives).'),
    access: str('read ou write.', { enum: ['read', 'write'] }),
    scope: str('space, agency ou demo.', { enum: ['space', 'agency', 'demo'] }),
    spaces: int('Espaces accessibles.'),
    rateLimits: { type: 'object', additionalProperties: true },
    notice: str(),
  }, ['keyId', 'demo', 'access', 'scope', 'spaces', 'rateLimits']),
  Space: obj({
    id: str(),
    name: str(),
    segment: str('local, pme ou ecommerce.', { enum: ['local', 'pme', 'ecommerce'] }),
    trade: nullable(str('Activité.')),
    city: nullable(str()),
    website: nullable(str()),
    plan: str('Offre.'),
    demo: bool(),
    measurements: int('Mesures des IA terminées.'),
    lastMeasuredAt: nullable(str(undefined, { format: 'date-time' })),
  }),
  Scores: obj({
    aiVisibility: {
      oneOf: [
        obj({
          measurementId: str(),
          measuredAt: str(undefined, { format: 'date-time' }),
          score: ref('Interval'),
          level: num('Niveau de l’intervalle (0,9).'),
          confidence: str('faible, moyenne ou bonne.'),
          mentionRate: ref('Interval'),
          shareOfVoice: ref('Interval'),
          rank: nullable(int()),
          rankedActors: int(),
          byProvider: arr(obj({ provider: str(), name: str(), score: nullable(int()) })),
          method: str('Méthode de la marge, en une phrase.'),
          demo: bool(),
        }),
        { type: 'null' },
      ],
    },
    seo: { oneOf: [obj({ score: int(), grade: str(), measuredAt: str(), pagesCrawled: int(), demo: bool() }), { type: 'null' }] },
    geo: { oneOf: [obj({ score: int(), measuredAt: str(), demo: bool() }), { type: 'null' }] },
    notes: arr(str()),
  }),
  HistoryPoint: {
    type: 'object',
    description: 'Point d’historique. ai_visibility : score des IA avec marge ; seo / geo : score d’une exploration du site.',
    properties: {
      type: str(undefined, { enum: ['ai_visibility', 'seo', 'geo'] }),
      measuredAt: str(undefined, { format: 'date-time' }),
      score: int(),
      low: int('ai_visibility seulement.'),
      high: int('ai_visibility seulement.'),
      measurementId: str('ai_visibility seulement.'),
      runId: str('seo / geo seulement.'),
      mentionRate: num(),
      shareOfVoice: num(),
      confidence: str(),
      byProvider: { type: 'object', additionalProperties: { type: ['integer', 'null'] } },
      pagesCrawled: int(),
      demo: bool(),
    },
    required: ['type', 'measuredAt', 'score', 'demo'],
  },
  Measurement: obj({
    id: str(),
    measuredAt: str(undefined, { format: 'date-time' }),
    score: int(),
    low: int(),
    high: int(),
    providers: arr(str()),
    questions: int(),
    answers: int(),
    demo: bool(),
  }),
  MeasurementJob: obj({ jobId: str(), status: str(undefined, { enum: ['queued'] }), frequency: str(), requestedAt: str(undefined, { format: 'date-time' }) }),
  ProviderResult: obj({
    provider: str(),
    name: str(),
    answers: int('Réponses relevées.'),
    cited: int('Réponses qui vous citent.'),
    rate: num('Taux de citation (0–1).'),
    low: num('Borne basse (Wilson, 90 %).'),
    high: num('Borne haute (Wilson, 90 %).'),
    bestRank: nullable(int()),
  }),
  Question: obj({
    id: str(),
    text: str(),
    intent: str(),
    theme: str(),
    tags: arr(str()),
    active: bool(),
    origin: str(),
    createdAt: str(undefined, { format: 'date-time' }),
    latest: {
      oneOf: [obj({ measurementId: str(), measuredAt: str(), queryId: str(), byProvider: arr(ref('ProviderResult')), demo: bool() }), { type: 'null' }],
    },
  }),
  QuestionInput: obj({
    text: str('La question, telle qu’un client la poserait à une IA (5 à 300 caractères).'),
    intent: str('Intention (facultatif, déduite sinon) : recommandation, proximite, urgence, service, avis, comparatif, alternative, prix, achat, marque.'),
    theme: str('Thème libre.'),
    tags: arr(str()),
    active: bool('false : ajoutée en pause (hors quota).'),
  }, ['text']),
  Deleted: obj({ id: str(), deleted: bool() }),
  Answer: obj({
    provider: str(),
    name: str(),
    run: int('Passage (une même question est posée plusieurs fois).'),
    model: nullable(str()),
    at: str(),
    mentioned: bool(),
    rank: nullable(int()),
    competitors: arr(str()),
    sources: arr(str()),
    text: str('Réponse complète de l’IA.'),
    demo: bool(),
  }),
  Competitors: {
    oneOf: [
      obj({
        measurementId: str(),
        measuredAt: str(),
        rankedActors: int(),
        you: obj({ rank: nullable(int()), shareOfVoice: ref('Interval') }),
        actors: arr(obj({ rank: int(), name: str(), isYou: bool(), mentions: int(), shareOfVoice: num() })),
        demo: bool(),
      }),
      { type: 'null' },
    ],
  },
  Source: obj({
    domain: str(),
    label: str(),
    category: str(),
    citations: int(),
    share: num(),
    providers: arr(str()),
    questions: int(),
    yourPresence: str('present, absent ou unknown.'),
    competitorsPresent: arr(str()),
    sampleUrls: arr(str()),
  }),
  Finding: obj({
    id: str(),
    source: str(undefined, { enum: ['seo', 'geo'] }),
    category: str(),
    severity: str(undefined, { enum: ['critical', 'high', 'medium', 'low'] }),
    title: str(),
    why: str(),
    fix: str(),
    affectedCount: int(),
    sampleUrls: arr(str()),
    impact: int(undefined, { minimum: 1, maximum: 3 }),
    effort: int(undefined, { minimum: 1, maximum: 3 }),
    priority: num('Gravité × impact ÷ effort.'),
    autoFixable: bool('L’agent peut proposer ce correctif (validation humaine requise).'),
  }),
  Proposal: obj({
    id: str(),
    title: str(),
    status: str(),
    platform: str(),
    risk: str(),
    createdAt: str(),
    proposedAt: nullable(str()),
    validatedAt: nullable(str()),
    appliedAt: nullable(str()),
    finding: obj({ id: str(), title: nullable(str()), severity: nullable(str()) }),
    changes: arr(obj({ id: str(), kind: str(), before: nullable(str()), after: nullable(str()), rationale: str(), status: str() })),
    reviewUrl: str('Validation ou refus : par un humain, dans l’app.'),
    demo: bool(),
  }),
  Report: obj({
    id: str(),
    kind: str(undefined, { enum: ['measurement', 'monthly'] }),
    title: str(),
    date: str(undefined, { format: 'date' }),
    pdfUrl: nullable(str()),
    appUrl: str(),
    demo: bool(),
  }),
  WebhookEvent: obj({
    id: str('Identifiant de livraison (identique à chaque tentative : dédoublonnez dessus).'),
    event: str(undefined, { enum: [...WEBHOOK_EVENTS] }),
    createdAt: str(undefined, { format: 'date-time' }),
    businessId: str('Espace concerné.'),
    data: { type: 'object', additionalProperties: true },
  }),
};

const ERRORS: Record<string, string> = {
  '400': 'Requête invalide.',
  '401': 'Clé absente, invalide ou révoquée.',
  '402': 'Offre insuffisante ou quota de l’offre atteint.',
  '403': 'Droits insuffisants (clé en lecture seule, clé de démonstration).',
  '404': 'Ressource introuvable (ou hors du périmètre de la clé).',
  '429': 'Limite de débit atteinte (voir Retry-After).',
};

function errorResponses(write: boolean): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [code, description] of Object.entries(ERRORS)) {
    if (code === '403' && !write) continue;
    out[code] = { description, content: { 'application/json': { schema: ref('Error') } } };
  }
  return out;
}

const RATE_HEADERS = {
  'X-RateLimit-Limit': { description: 'Requêtes autorisées par minute.', schema: { type: 'integer' } },
  'X-RateLimit-Remaining': { description: 'Requêtes restantes dans la minute.', schema: { type: 'integer' } },
  'X-Request-Id': { description: 'Identifiant de la requête.', schema: { type: 'string' } },
};

export function buildOpenApi(serverUrl: string): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const r of ROUTES) {
    const item = (paths[r.path] ??= {});
    const dataSchema = r.paginated ? obj({ data: arr(ref(r.response)), pagination: ref('Pagination') }) : obj({ data: ref(r.response) });
    item[r.method.toLowerCase()] = {
      operationId: r.operationId,
      tags: [r.tag],
      summary: r.summary,
      description: `${r.description}${r.access === 'write' ? '\n\nDroits : clé « lecture et écriture ».' : ''}`,
      security: [{ bearerKey: [] }],
      ...(r.params?.length ? { parameters: r.params.map((p) => ({ name: p.name, in: p.in, required: p.in === 'path' ? true : !!p.required, description: p.description, schema: p.schema })) } : {}),
      ...(r.requestBody ? { requestBody: { required: true, content: { 'application/json': { schema: ref(r.requestBody) } } } } : {}),
      responses: {
        [String(r.responseStatus ?? 200)]: { description: 'Succès.', headers: RATE_HEADERS, content: { 'application/json': { schema: dataSchema } } },
        ...errorResponses(r.access === 'write'),
      },
      'x-access': r.access,
    };
  }
  const webhooks: Record<string, unknown> = {};
  for (const e of WEBHOOK_EVENTS) {
    const d = WEBHOOK_EVENT_DOCS[e];
    webhooks[e] = {
      post: {
        summary: d.label,
        description: `${d.description}\n\nEn-têtes : X-Repere-Event, X-Repere-Delivery, X-Repere-Signature (t=<secondes>,v1=<HMAC-SHA256 hex de « t.corps » avec votre secret whsec_…>). Répondez 2xx sous 10 s ; sinon nouvelles tentatives avec attente croissante.`,
        requestBody: { content: { 'application/json': { schema: ref('WebhookEvent'), example: d.example } } },
        responses: { '200': { description: 'Reçu.' } },
      },
    };
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'API publique Repéré',
      version: API_VERSION,
      summary: 'Scores SEO, GEO et visibilité dans les IA, questions suivies, concurrents, sources, constats, propositions de l’agent et rapports.',
      description:
        'Lecture des données de vos espaces et quelques écritures sûres (questions suivies, nouvelle mesure). Réservée aux offres Accompagné et Agence. ' +
        'Les mesures des IA sont des échantillons : chaque score est accompagné de sa marge (intervalle à 90 %). ' +
        'La validation des propositions de l’agent reste humaine, dans l’app : l’API ne publie rien chez vos clients.',
      contact: { name: 'Repéré', url: `${serverUrl}/developpeurs` },
    },
    servers: [{ url: `${serverUrl}${API_BASE_PATH}`, description: 'Production' }],
    security: [{ bearerKey: [] }],
    tags: [...new Set(ROUTES.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    webhooks,
    components: {
      securitySchemes: {
        bearerKey: { type: 'http', scheme: 'bearer', bearerFormat: 'rp_live_…', description: 'Clé créée dans Réglages › API (affichée une seule fois). Clé de démonstration en lecture seule : voir /developpeurs.' },
      },
      schemas: SCHEMAS,
    },
  };
}
