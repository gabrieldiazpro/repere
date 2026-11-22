/**
 * Webflow (Data API v2) : la Data API ne crée pas de pages statiques ; elle crée des éléments de collection CMS.
 * Les articles sont donc créés dans la collection choisie par le client (réglage « collection des articles »), avec
 * `isDraft: true` (élément brouillon, non publié) ; mise en ligne : `POST /collections/{c}/items/publish` ; retrait :
 * `DELETE /collections/{c}/items/{i}/live` (l'élément reste en brouillon) ; suppression : `DELETE /collections/{c}/items/{i}`.
 * Champ du corps : premier champ « RichText » de la collection ; titre : `name` ; adresse : `slug`.
 * https://developers.webflow.com/data/reference/cms/collection-items/staged-items/create-item
 */
import { requestJson } from '../http';
import { WEBFLOW_API } from '../connectors/webflow';
import { PublishError, type ConnectorContext } from '../types';
import type { PageConnector, PageOptions, RemotePage } from './types';

interface WfField {
  slug: string;
  type: string;
  displayName?: string;
}
interface WfItem {
  id: string;
  isDraft?: boolean;
  isArchived?: boolean;
  lastPublished?: string | null;
  fieldData?: Record<string, unknown>;
}

const h = (ctx: ConnectorContext) => ({ authorization: `Bearer ${ctx.credentials.token ?? ''}`, accept: 'application/json' });

async function wf<T>(ctx: ConnectorContext, method: 'GET' | 'POST' | 'DELETE' | 'PATCH', path: string, body: unknown, what: string, ok = [200, 201, 202, 204]): Promise<T> {
  return requestJson<T>(ctx.http, { method, url: `${WEBFLOW_API}${path}`, headers: { ...h(ctx), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, what, ok);
}

function collectionOf(opts: PageOptions): string {
  const c = String(opts.webflowCollectionId ?? '').trim();
  if (!/^[a-f0-9]{24}$/i.test(c)) throw new PublishError(422, 'Choisissez la collection CMS des articles Webflow dans les réglages du contenu.', 'needs_setting');
  return c;
}

async function fieldsOf(ctx: ConnectorContext, c: string): Promise<{ body: string; summary?: string; slugBase: string }> {
  const col = await wf<{ fields?: WfField[]; slug?: string }>(ctx, 'GET', `/collections/${c}`, undefined, 'Collection Webflow', [200]);
  const fields = col.fields ?? [];
  const body = fields.find((f) => f.type === 'RichText');
  if (!body) throw new PublishError(422, 'Cette collection Webflow n’a pas de champ « texte enrichi » pour le corps de l’article.', 'unsupported');
  const summary = fields.find((f) => f.type === 'PlainText' && /summary|resume|résumé|extrait|excerpt|description/i.test(`${f.slug} ${f.displayName ?? ''}`));
  return { body: body.slug, summary: summary?.slug, slugBase: col.slug ?? 'blog' };
}

function toRemote(ctx: ConnectorContext, c: string, it: WfItem, bodyField?: string, slugBase?: string): RemotePage {
  const fd = it.fieldData ?? {};
  const slug = String(fd.slug ?? '');
  const domain = ctx.config.domain;
  return {
    platform: 'webflow',
    format: 'article',
    id: it.id,
    status: it.isArchived ? 'trashed' : it.isDraft || !it.lastPublished ? 'draft' : 'published',
    ...(domain && slug ? { url: `https://${domain}/${slugBase ?? 'blog'}/${slug}` } : {}),
    title: typeof fd.name === 'string' ? fd.name : undefined,
    html: bodyField && typeof fd[bodyField] === 'string' ? String(fd[bodyField]).slice(0, 200_000) : undefined,
    extra: { collectionId: c, ...(bodyField ? { bodyField } : {}), ...(slugBase ? { slugBase } : {}) },
  };
}

export const webflowPages: PageConnector = {
  platform: 'webflow',
  support: { page: false, article: true, draft: true, unpublish: true, notes: ['Webflow ne permet pas de créer une page statique par l’API : les pages passent par l’export, les articles par une collection CMS.'] },

  async findBySlug(ctx, format, slug, opts) {
    if (format === 'page') return null;
    const c = collectionOf(opts);
    const d = await wf<{ items: WfItem[] }>(ctx, 'GET', `/collections/${c}/items?slug=${encodeURIComponent(slug)}&limit=5`, undefined, 'Recherche Webflow', [200]);
    const hit = d.items.find((i) => i.fieldData?.slug === slug);
    return hit ? toRemote(ctx, c, hit) : null;
  },

  async createDraft(ctx, input, opts) {
    if (input.format === 'page') throw new PublishError(422, 'Webflow : création de page statique impossible par l’API (utilisez l’export).', 'unsupported');
    const c = collectionOf(opts);
    const f = await fieldsOf(ctx, c);
    const it = await wf<WfItem>(
      ctx,
      'POST',
      `/collections/${c}/items`,
      { isArchived: false, isDraft: true, fieldData: { name: input.title, slug: input.slug, [f.body]: input.html, ...(f.summary && input.excerpt ? { [f.summary]: input.excerpt } : {}) } },
      'Création de l’article Webflow',
    );
    return toRemote(ctx, c, it, f.body, f.slugBase);
  },

  async read(ctx, ref, opts) {
    const c = ref.extra?.collectionId ?? collectionOf(opts);
    const res = await ctx.http({ method: 'GET', url: `${WEBFLOW_API}/collections/${c}/items/${encodeURIComponent(ref.id)}`, headers: h(ctx) });
    if (res.status === 404) return null;
    if (res.status !== 200) throw new PublishError(502, `Relecture Webflow : erreur ${res.status}.`, 'upstream');
    return toRemote(ctx, c, JSON.parse(res.text) as WfItem, ref.extra?.bodyField, ref.extra?.slugBase);
  },

  async publish(ctx, ref, opts) {
    const c = ref.extra?.collectionId ?? collectionOf(opts);
    // L'élément doit d'abord quitter l'état brouillon, puis être publié.
    await wf(ctx, 'PATCH', `/collections/${c}/items/${encodeURIComponent(ref.id)}`, { isDraft: false }, 'Webflow (brouillon)');
    await wf(ctx, 'POST', `/collections/${c}/items/publish`, { itemIds: [ref.id] }, 'Publication Webflow');
    return { ...ref, status: 'published' };
  },

  async unpublish(ctx, ref, opts) {
    const c = ref.extra?.collectionId ?? collectionOf(opts);
    await wf(ctx, 'DELETE', `/collections/${c}/items/${encodeURIComponent(ref.id)}/live`, undefined, 'Retrait Webflow');
    await wf(ctx, 'PATCH', `/collections/${c}/items/${encodeURIComponent(ref.id)}`, { isDraft: true }, 'Webflow (brouillon)');
    return { ...ref, status: 'draft' };
  },

  async remove(ctx, ref, opts) {
    const c = ref.extra?.collectionId ?? collectionOf(opts);
    await wf(ctx, 'DELETE', `/collections/${c}/items/${encodeURIComponent(ref.id)}`, undefined, 'Suppression Webflow');
  },
};
