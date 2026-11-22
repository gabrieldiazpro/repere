/**
 * WordPress : pages (`/wp/v2/pages`) et articles (`/wp/v2/posts`) créés avec `status: draft` — invisibles du public
 * jusqu'à la mise en ligne (`status: publish`) ; retrait = retour en brouillon ; corbeille = `DELETE` sans `force`
 * (récupérable 30 jours dans WordPress). https://developer.wordpress.org/rest-api/reference/pages/
 * Méta titre / description : métas Yoast (`_yoast_wpseo_*`, si exposées) ou Rank Math (`rankmath/v1/updateMeta`),
 * comme le connecteur de correctifs ; sinon le contenu est créé sans elles (signalé).
 */
import { basicAuth, requestJson } from '../http';
import { PublishError, type ConnectorContext } from '../types';
import { jsonLdHtml } from './render';
import type { PageConnector, PageFormat, RemotePage } from './types';

interface WpItem {
  id: number;
  link?: string;
  slug?: string;
  status?: string;
  title?: { raw?: string; rendered?: string };
  content?: { raw?: string; rendered?: string };
  meta?: Record<string, unknown>;
}

const base = (f: PageFormat) => (f === 'article' ? 'posts' : 'pages');
const api = (ctx: ConnectorContext, p: string) => `${ctx.config.siteUrl}/wp-json${p}`;
const auth = (ctx: ConnectorContext) => ({ authorization: basicAuth(ctx.credentials.username ?? '', ctx.credentials.password ?? '') });

async function call<T>(ctx: ConnectorContext, method: 'GET' | 'POST' | 'DELETE', p: string, body: unknown, what: string, ok = [200, 201]): Promise<T> {
  return requestJson<T>(ctx.http, { method, url: api(ctx, p), headers: { ...auth(ctx), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, what, ok);
}

function toRemote(ctx: ConnectorContext, f: PageFormat, it: WpItem): RemotePage {
  const status = it.status === 'publish' ? 'published' : it.status === 'trash' ? 'trashed' : 'draft';
  return {
    platform: 'wordpress',
    format: f,
    id: String(it.id),
    status,
    url: it.link,
    editUrl: `${ctx.config.siteUrl}/wp-admin/post.php?post=${it.id}&action=edit`,
    title: it.title?.raw ?? it.title?.rendered,
    html: (it.content?.raw ?? it.content?.rendered ?? '').slice(0, 200_000),
  };
}

export const wordpressPages: PageConnector = {
  platform: 'wordpress',
  support: { page: true, article: true, draft: true, unpublish: true, notes: ['Brouillon WordPress invisible du public jusqu’à la mise en ligne ; la corbeille se vide après 30 jours.'] },

  async findBySlug(ctx, format, slug) {
    const list = await call<WpItem[]>(ctx, 'GET', `/wp/v2/${base(format)}?slug=${encodeURIComponent(slug)}&status=publish,draft,pending,private&context=edit&_fields=id,link,slug,status,title`, undefined, 'Recherche de l’adresse', [200]);
    const hit = list.find((x) => x.slug === slug);
    return hit ? toRemote(ctx, format, hit) : null;
  },

  async createDraft(ctx, input, opts) {
    const content = opts.allowScript && input.jsonLd.length ? `${input.html}\n${jsonLdHtml(input.jsonLd)}` : input.html;
    const created = await call<WpItem>(
      ctx,
      'POST',
      `/wp/v2/${base(input.format)}`,
      { title: input.title, slug: input.slug, content, status: 'draft', ...(input.excerpt ? { excerpt: input.excerpt } : {}) },
      'Création du brouillon WordPress',
    );
    const plugin = ctx.config.seoPlugin;
    try {
      if (plugin === 'rankmath') {
        await call(ctx, 'POST', '/rankmath/v1/updateMeta', { objectType: 'post', objectID: created.id, meta: { rank_math_title: input.metaTitle, rank_math_description: input.metaDescription } }, 'Méta Rank Math');
      } else if (plugin === 'yoast' && created.meta && '_yoast_wpseo_title' in created.meta) {
        await call(ctx, 'POST', `/wp/v2/${base(input.format)}/${created.id}`, { meta: { _yoast_wpseo_title: input.metaTitle, _yoast_wpseo_metadesc: input.metaDescription } }, 'Méta Yoast');
      }
    } catch {
      /* le brouillon existe : les métas restent à reporter à la main (signalé par la vérification) */
    }
    return toRemote(ctx, input.format, created);
  },

  async read(ctx, ref) {
    const res = await ctx.http({ method: 'GET', url: api(ctx, `/wp/v2/${base(ref.format)}/${encodeURIComponent(ref.id)}?context=edit`), headers: auth(ctx) });
    if (res.status === 404 || res.status === 410) return null;
    if (res.status !== 200) throw new PublishError(502, `Relecture WordPress : erreur ${res.status}.`, 'upstream');
    return toRemote(ctx, ref.format, JSON.parse(res.text) as WpItem);
  },

  async publish(ctx, ref) {
    const it = await call<WpItem>(ctx, 'POST', `/wp/v2/${base(ref.format)}/${encodeURIComponent(ref.id)}`, { status: 'publish' }, 'Mise en ligne WordPress');
    return toRemote(ctx, ref.format, it);
  },

  async unpublish(ctx, ref) {
    const it = await call<WpItem>(ctx, 'POST', `/wp/v2/${base(ref.format)}/${encodeURIComponent(ref.id)}`, { status: 'draft' }, 'Retrait WordPress');
    return toRemote(ctx, ref.format, it);
  },

  async remove(ctx, ref) {
    await call(ctx, 'DELETE', `/wp/v2/${base(ref.format)}/${encodeURIComponent(ref.id)}`, undefined, 'Mise à la corbeille WordPress', [200]);
  },
};

