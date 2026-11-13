/**
 * Connecteur Google Business Profile (Business Information API v1, docs/v5/publication.md § Google Business Profile).
 * Accès aux API sur dossier : désactivé tant que `PUBLISH_GBP_ENABLED` ≠ 1. Jeton OAuth `business.manage` (flux OAuth
 * à brancher en vague B ; en attendant, jeton saisi, chiffré au repos).
 * - Description : `PATCH /v1/locations/{id}?updateMask=profile.description` ;
 * - Horaires : `updateMask=regularHours` (valeur = JSON `regularHours` canonique).
 */
import { requestJson } from '../http';
import { PublishError, type ConnectInput, type ConnectorContext, type PublishConnector, type ResourceRef, type TestResult } from '../types';

export const GBP_API = 'https://mybusinessbusinessinformation.googleapis.com/v1';
export const gbpEnabled = () => process.env.PUBLISH_GBP_ENABLED === '1';

interface Location {
  name?: string;
  title?: string;
  profile?: { description?: string };
  regularHours?: unknown;
}

const h = (ctx: ConnectorContext) => ({ authorization: `Bearer ${ctx.credentials.accessToken ?? ''}` });

/** JSON stable (clés triées) : la comparaison avant/après ne dépend pas de l'ordre renvoyé par Google. */
export function canonicalJson(v: unknown): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(sort) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
  return JSON.stringify(sort(v ?? null));
}

function guard(): void {
  if (!gbpEnabled()) throw new PublishError(503, 'La modification de la fiche Google n’est pas encore ouverte (accès à l’API Google en attente).', 'gbp_disabled');
}

async function getLocation(ctx: ConnectorContext): Promise<Location> {
  return requestJson<Location>(ctx.http, { method: 'GET', url: `${GBP_API}/${ctx.config.locationId}?readMask=name,title,profile,regularHours`, headers: h(ctx) }, 'Fiche Google', [200]);
}

async function patch(ctx: ConnectorContext, kind: string, value: string | null): Promise<void> {
  const body = kind === 'gbp.description' ? { profile: { description: value ?? '' } } : { regularHours: value ? JSON.parse(value) : null };
  const mask = kind === 'gbp.description' ? 'profile.description' : 'regularHours';
  await requestJson(ctx.http, { method: 'PATCH', url: `${GBP_API}/${ctx.config.locationId}?updateMask=${mask}`, headers: { ...h(ctx), 'content-type': 'application/json' }, body: JSON.stringify(body) }, 'Mise à jour de la fiche Google', [200]);
}

export const gbpConnector: PublishConnector = {
  platform: 'gbp',
  kinds: ['gbp.description', 'gbp.hours'],

  connect(input: ConnectInput): ConnectInput {
    guard();
    const locationId = String(input.config.locationId ?? '').trim().replace(/^accounts\/\d+\//, '');
    if (!/^locations\/\d{3,30}$/.test(locationId)) throw new PublishError(400, 'Identifiant de fiche invalide (locations/123…).');
    const accessToken = String(input.credentials.accessToken ?? '').trim();
    if (accessToken.length < 20) throw new PublishError(400, 'Jeton Google manquant.');
    return { config: { locationId }, credentials: { accessToken } };
  },

  async test(ctx): Promise<TestResult> {
    guard();
    const loc = await getLocation(ctx);
    return { ok: true, detail: `Fiche « ${loc.title ?? ctx.config.locationId} » accessible.`, capabilities: ['gbp.description', 'gbp.hours'], info: { title: String(loc.title ?? '') } };
  },

  async locate(ctx): Promise<ResourceRef> {
    return { type: 'location', id: ctx.config.locationId };
  },

  async read(ctx, change) {
    guard();
    const loc = await getLocation(ctx);
    return change.kind === 'gbp.description' ? (loc.profile?.description ?? '') : loc.regularHours ? canonicalJson(loc.regularHours) : null;
  },

  async apply(ctx, change) {
    guard();
    await patch(ctx, change.kind, change.after);
    return {};
  },

  async revert(ctx, change) {
    guard();
    await patch(ctx, change.kind, change.before);
  },
};
