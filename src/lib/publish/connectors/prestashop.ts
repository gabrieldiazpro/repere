/**
 * Connecteur PrestaShop (webservice, docs/v5/publication.md § PrestaShop).
 * Lecture en JSON (`output_format=JSON`) ; écriture en XML (le webservice ne lit pas le JSON) : PATCH avec l'id et le
 * seul champ multilingue modifié (toutes langues renvoyées, une seule changée) ; sur 405 (versions < 8), PUT du XML
 * complet relu juste avant, où seul le nœud visé est remplacé.
 */
import { basicAuth, normalizeSiteUrl, parseJson, statusError } from '../http';
import { PublishError, type Change, type ConnectInput, type ConnectorContext, type PublishConnector, type ResourceRef, type TestResult } from '../types';

const RESOURCES = { product: { path: 'products', node: 'product' }, category: { path: 'categories', node: 'category' }, cms: { path: 'content_management_system', node: 'content' } } as const;
type PsType = keyof typeof RESOURCES;

const FIELD: Record<string, string> = { 'meta.title': 'meta_title', 'meta.description': 'meta_description' };

const auth = (ctx: ConnectorContext) => ({ authorization: basicAuth(ctx.credentials.apiKey ?? '', '') });
const api = (ctx: ConnectorContext, path: string) => `${ctx.config.siteUrl}/api/${path}`;

/** URL publique → ressource (formats par défaut : produit « …/12-nom.html », catégorie « /3-nom », CMS « /content/4-nom »). */
export function prestashopPath(url: string): { type: PsType; id: string } | null {
  let p: string;
  try {
    p = new URL(url).pathname;
  } catch {
    return null;
  }
  let m = /\/content\/(\d+)-[^/]*$/.exec(p);
  if (m) return { type: 'cms', id: m[1] };
  m = /\/(\d+)(?:-\d+)?-[^/]*\.html$/.exec(p);
  if (m) return { type: 'product', id: m[1] };
  m = /^(?:\/[a-z]{2})?\/(\d+)-[^/.]*$/.exec(p);
  if (m) return { type: 'category', id: m[1] };
  return null;
}

const cdata = (s: string) => `<![CDATA[${s.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

type LangValues = { id: string; value: string }[];

async function readLangs(ctx: ConnectorContext, type: PsType, id: string, field: string): Promise<LangValues> {
  const r = RESOURCES[type];
  const res = await ctx.http({ method: 'GET', url: api(ctx, `${r.path}/${encodeURIComponent(id)}?output_format=JSON&display=full`), headers: auth(ctx) });
  if (res.status !== 200) throw statusError(res, 'Lecture PrestaShop');
  const j = parseJson<Record<string, unknown>>(res, 'PrestaShop');
  // display=full : { "products": [ {...} ] } ; sans display : { "product": {...} }
  const obj = (j[r.node] ?? (Array.isArray(j[r.path]) ? (j[r.path] as unknown[])[0] : undefined)) as Record<string, unknown> | undefined;
  const v = obj?.[field];
  if (Array.isArray(v)) return v.map((x) => ({ id: String((x as { id: unknown }).id), value: String((x as { value?: unknown }).value ?? '') }));
  if (typeof v === 'string') return [{ id: ctx.config.languageId || '1', value: v }];
  return [];
}

function langXml(field: string, langs: LangValues): string {
  return `<${field}>${langs.map((l) => `<language id="${l.id.replace(/\D/g, '')}">${cdata(l.value)}</language>`).join('')}</${field}>`;
}

async function writeField(ctx: ConnectorContext, type: PsType, id: string, field: string, value: string): Promise<void> {
  const r = RESOURCES[type];
  const lang = ctx.config.languageId || '1';
  const langs = await readLangs(ctx, type, id, field);
  const next = langs.some((l) => l.id === lang) ? langs.map((l) => (l.id === lang ? { ...l, value } : l)) : [...langs, { id: lang, value }];
  const body = `<?xml version="1.0" encoding="UTF-8"?><prestashop xmlns:xlink="http://www.w3.org/1999/xlink"><${r.node}><id>${cdata(id)}</id>${langXml(field, next)}</${r.node}></prestashop>`;
  const res = await ctx.http({ method: 'PATCH', url: api(ctx, `${r.path}/${encodeURIComponent(id)}`), headers: { ...auth(ctx), 'content-type': 'application/xml' }, body });
  if (res.status === 200 || res.status === 201) return;
  if (res.status !== 405) throw statusError(res, 'Mise à jour PrestaShop');
  // Repli : PUT du XML complet (seul le nœud du champ est remplacé).
  const full = await ctx.http({ method: 'GET', url: api(ctx, `${r.path}/${encodeURIComponent(id)}`), headers: auth(ctx) });
  if (full.status !== 200) throw statusError(full, 'Lecture PrestaShop');
  const re = new RegExp(`<${field}>[\\s\\S]*?</${field}>|<${field}\\s*/>`);
  if (!re.test(full.text)) throw new PublishError(422, 'Champ introuvable dans la ressource PrestaShop.', 'unsupported');
  // Champs en lecture seule refusés par un PUT (documentés comme non modifiables).
  const xml = full.text.replace(re, langXml(field, next)).replace(/<(manufacturer_name|quantity|position_in_category)>[\s\S]*?<\/\1>/g, '');
  const put = await ctx.http({ method: 'PUT', url: api(ctx, `${r.path}/${encodeURIComponent(id)}`), headers: { ...auth(ctx), 'content-type': 'application/xml' }, body: xml });
  if (put.status !== 200 && put.status !== 201) throw statusError(put, 'Mise à jour PrestaShop');
}

export const prestashopConnector: PublishConnector = {
  platform: 'prestashop',
  kinds: ['meta.title', 'meta.description'],

  connect(input: ConnectInput): ConnectInput {
    const siteUrl = normalizeSiteUrl(input.config.siteUrl ?? '');
    const apiKey = String(input.credentials.apiKey ?? '').trim();
    if (!/^[A-Z0-9]{32}$/i.test(apiKey)) throw new PublishError(400, 'Clé webservice PrestaShop invalide (32 caractères, Paramètres avancés > Webservice).');
    const languageId = /^\d{1,3}$/.test(String(input.config.languageId ?? '')) ? String(input.config.languageId) : '1';
    return { config: { siteUrl, languageId }, credentials: { apiKey } };
  },

  async test(ctx): Promise<TestResult> {
    const res = await ctx.http({ method: 'GET', url: api(ctx, 'products?output_format=JSON&limit=1'), headers: auth(ctx) });
    if (res.status === 401) return { ok: false, detail: 'Clé webservice refusée (vérifiez qu’elle est active).', capabilities: [] };
    if (res.status === 403) return { ok: false, detail: 'La clé n’a pas accès aux produits : cochez GET et PUT/PATCH pour products, categories et content_management_system.', capabilities: [] };
    if (res.status !== 200) return { ok: false, detail: statusError(res, 'Webservice PrestaShop').message, capabilities: [] };
    return { ok: true, detail: 'Webservice PrestaShop joignable. Les droits d’écriture sont vérifiés à la première application.', capabilities: ['meta.title', 'meta.description'] };
  },

  async locate(_ctx, change): Promise<ResourceRef> {
    if (change.target.resource?.id) return change.target.resource;
    const p = prestashopPath(change.target.url ?? '');
    if (!p) throw new PublishError(422, 'Adresse PrestaShop non reconnue (URL personnalisées) : utilisez l’export.', 'unsupported');
    return { type: p.type, id: p.id };
  },

  async read(ctx, change: Change) {
    const ref = await prestashopConnector.locate(ctx, change);
    const field = FIELD[change.kind];
    if (!field) throw new PublishError(422, 'Modification non disponible sur PrestaShop.', 'unsupported');
    const langs = await readLangs(ctx, ref.type as PsType, ref.id ?? '', field);
    return langs.find((l) => l.id === (ctx.config.languageId || '1'))?.value ?? '';
  },

  async apply(ctx, change) {
    const ref = await prestashopConnector.locate(ctx, change);
    await writeField(ctx, ref.type as PsType, ref.id ?? '', FIELD[change.kind], change.after ?? '');
    return {};
  },

  async revert(ctx, change) {
    const ref = await prestashopConnector.locate(ctx, change);
    await writeField(ctx, ref.type as PsType, ref.id ?? '', FIELD[change.kind], change.before ?? '');
  },
};
